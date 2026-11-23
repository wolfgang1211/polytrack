/* Kalshi "top markets" — the same idea as the Polymarket explorer: every open market, ranked by 24h volume.
   Kalshi's GET /markets has no volume sort (newest first only), so we page through ALL open, non-combo markets
   (status=open, mve_filter=exclude, limit=1000), keep the listable binary $1 ones, and rank them ourselves.
   Units stay honest: Kalshi volume and open interest are CONTRACT COUNTS, never dollars.
   If the time budget or the source's rate limit stops the scan early, the result says so (complete=false) and
   the page must show that it is a partial scan; it is never presented as a full ranking. */
import { KalshiError, getKalshiJson, isOpenListable, normalizeMarket, parseNextCursor, type KalshiMarket } from '@/lib/kalshi';
import { fetchKalshiEvent } from '@/lib/kalshiEvents';

export const SCAN_PAGE_LIMIT = 1000;      // Kalshi's documented max page size for GET /markets
export const MAX_SCAN_PAGES = 300;        // hard stop (300k markets) so a looping cursor can never run forever
export const SCAN_BUDGET_MS = 100_000;    // a full scan takes ~45 s (≈178 pages); maxDuration is 120 s. Partial scans are labelled
export const PAGE_GAP_MS = 0;             // sequential pages are already well under the public read limit; 429s back off
export const RATE_LIMIT_RETRIES = 3;      // per page, on Kalshi 429 (mapped to KalshiError 503)
export const TOP_EVENTS = 60;
export const OUTCOMES_PER_EVENT = 4;
export const EVENT_CONCURRENCY = 2;

/** One outcome (= one binary Kalshi market) inside an event card. Prices are Kalshi quotes in USD per contract. */
export interface KalshiTopOutcome {
  ticker: string;
  label: string;               // yes_sub_title, else the market title
  yesBid: number | null;
  yesAsk: number | null;
  volume24hContracts: number;
}

/** Explorer card: a Kalshi event with its most-traded outcomes. Volumes are CONTRACT COUNTS summed over ALL its
    traded open markets seen in the scan (not only the outcomes shown). */
export interface KalshiTopEvent {
  eventTicker: string;
  title: string;               // event title as published, else the top market's title
  category: string | null;     // as published by Kalshi on the event; null when the lookup failed
  volume24hContracts: number;
  openInterestContracts: number;
  tradedMarkets: number;
  closeTime: string | null;    // earliest close among the outcomes shown
  outcomes: KalshiTopOutcome[];
}

export interface KalshiTopScan {
  events: KalshiTopEvent[];
  scannedMarkets: number;     // rows returned by the source across all pages
  listableMarkets: number;    // open binary $1 markets with a future close
  tradedMarkets: number;      // listable markets with 24h volume > 0
  tradedEvents: number;
  pages: number;
  complete: boolean;          // true only when the source cursor was exhausted
  stopReason: 'done' | 'budget' | 'rate_limited' | 'page_cap';
  scanMs: number;
  receivedAt: string;         // retrieval time of the scan (not a quote timestamp; Kalshi provides none)
}

type JsonGetter = (path: string, query?: Record<string, string>) => Promise<unknown>;
type EventGetter = (eventTicker: string) => Promise<{ category: string | null; title: string } | null>;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Higher 24h volume first; ties by open interest, then ticker for a stable order. */
export function compareByVolume(a: KalshiMarket, b: KalshiMarket): number {
  const va = a.volume24hContracts ?? 0, vb = b.volume24hContracts ?? 0;
  if (vb !== va) return vb - va;
  const oa = a.openInterestContracts ?? 0, ob = b.openInterestContracts ?? 0;
  if (ob !== oa) return ob - oa;
  return a.ticker < b.ticker ? -1 : a.ticker > b.ticker ? 1 : 0;
}

interface Bucket { vol: number; oi: number; count: number; top: KalshiMarket[] }

export async function scanKalshiTopMarkets(opts: {
  getJson?: JsonGetter;
  getEvent?: EventGetter;
  now?: () => number;
  wait?: (ms: number) => Promise<void>;
  budgetMs?: number;
  topEvents?: number;
} = {}): Promise<KalshiTopScan> {
  const getJson = opts.getJson ?? getKalshiJson;
  const getEvent = opts.getEvent ?? defaultGetEvent;
  const now = opts.now ?? (() => Date.now());
  const wait = opts.wait ?? sleep;
  const budget = opts.budgetMs ?? SCAN_BUDGET_MS;
  const topEvents = opts.topEvents ?? TOP_EVENTS;

  const t0 = now();
  const clock = new Date(t0);
  let cursor: string | undefined;
  let pages = 0, scanned = 0, listable = 0, traded = 0;
  const buckets = new Map<string, Bucket>();
  const seen = new Set<string>();
  let stopReason: KalshiTopScan['stopReason'] = 'done';

  for (;;) {
    if (pages >= MAX_SCAN_PAGES) { stopReason = 'page_cap'; break; }
    if (now() - t0 > budget) { stopReason = 'budget'; break; }
    let body: unknown;
    let attempt = 0;
    for (;;) {
      try {
        body = await getJson('/markets', {
          status: 'open', mve_filter: 'exclude', limit: String(SCAN_PAGE_LIMIT), ...(cursor ? { cursor } : {}),
        });
        break;
      } catch (e) {
        if (e instanceof KalshiError && e.status === 503 && attempt < RATE_LIMIT_RETRIES) {
          attempt++;
          await wait(1000 * 2 ** (attempt - 1)); // 1s, 2s, 4s
          continue;
        }
        if (e instanceof KalshiError && e.status === 503 && pages > 0) { stopReason = 'rate_limited'; body = undefined; break; }
        throw e; // the very first page failing means there is nothing honest to show
      }
    }
    if (body === undefined) break;
    if (!isObj(body) || !Array.isArray(body.markets)) throw new KalshiError(502, 'malformed markets envelope');
    if (body.markets.length > SCAN_PAGE_LIMIT) throw new KalshiError(502, 'oversized markets page');
    pages++;
    for (const row of body.markets) {
      scanned++;
      const m = normalizeMarket(row);
      if (!m || !isOpenListable(m, clock) || seen.has(m.ticker)) continue;
      seen.add(m.ticker);
      listable++;
      const v = m.volume24hContracts ?? 0;
      if (v <= 0) continue;
      traded++;
      let b = buckets.get(m.eventTicker);
      if (!b) buckets.set(m.eventTicker, (b = { vol: 0, oi: 0, count: 0, top: [] }));
      b.vol += v;
      b.oi += m.openInterestContracts ?? 0;
      b.count++;
      b.top.push(m);
      if (b.top.length > OUTCOMES_PER_EVENT) b.top = b.top.sort(compareByVolume).slice(0, OUTCOMES_PER_EVENT);
    }
    const next = parseNextCursor(body.cursor);
    if (next === null) { stopReason = 'done'; break; }
    if (next === cursor) throw new KalshiError(502, 'cursor did not advance');
    cursor = next;
    if (PAGE_GAP_MS > 0) await wait(PAGE_GAP_MS);
  }

  const ranked = [...buckets.entries()]
    .sort(([ta, a], [tb, b]) => (b.vol - a.vol) || (b.oi - a.oi) || (ta < tb ? -1 : ta > tb ? 1 : 0))
    .slice(0, topEvents);
  const meta = await lookupEvents(ranked.map(([t]) => t), getEvent);
  const events: KalshiTopEvent[] = ranked.map(([eventTicker, b]) => {
    const top = b.top.sort(compareByVolume);
    const e = meta.get(eventTicker) ?? null;
    const closes = top.map(m => m.closeTime).filter((c): c is string => c !== null).sort();
    return {
      eventTicker,
      title: e?.title ?? top[0].title ?? eventTicker,
      category: e?.category ?? null,
      volume24hContracts: b.vol,
      openInterestContracts: b.oi,
      tradedMarkets: b.count,
      closeTime: closes[0] ?? null,
      outcomes: top.map(m => ({
        ticker: m.ticker, label: m.yesLabel ?? m.title ?? m.ticker,
        yesBid: m.yesBid, yesAsk: m.yesAsk, volume24hContracts: m.volume24hContracts ?? 0,
      })),
    };
  });
  return {
    events,
    scannedMarkets: scanned,
    listableMarkets: listable,
    tradedMarkets: traded,
    tradedEvents: buckets.size,
    pages,
    complete: stopReason === 'done',
    stopReason,
    scanMs: now() - t0,
    receivedAt: new Date(now()).toISOString(),
  };
}

async function defaultGetEvent(eventTicker: string) {
  const { event } = await fetchKalshiEvent(eventTicker);
  return { category: event.category, title: event.title };
}

/** Event title and category for the ranked events (2 in flight, one retry; a failed lookup stays per event). */
async function lookupEvents(tickers: string[], getEvent: EventGetter) {
  const meta = new Map<string, { category: string | null; title: string } | null>();
  let i = 0;
  const worker = async () => {
    while (i < tickers.length) {
      const t = tickers[i++];
      let got: { category: string | null; title: string } | null = null;
      for (let attempt = 0; attempt < 2 && got === null; attempt++) {
        try { got = await getEvent(t); } catch { if (attempt === 0) await sleep(1000); }
      }
      meta.set(t, got);
    }
  };
  await Promise.all(Array.from({ length: Math.min(EVENT_CONCURRENCY, tickers.length) }, worker));
  return meta;
}

/* ── display grouping: Kalshi's published categories folded into the explorer's chips ── */

export const KALSHI_CHIPS = ['All', 'Politics', 'Sports', 'Economy', 'Crypto', 'Tech', 'Culture', 'World', 'Other'] as const;
export type KalshiChip = typeof KALSHI_CHIPS[number];

const CHIP_OF: Record<string, KalshiChip> = {
  Politics: 'Politics', Elections: 'Politics',
  Sports: 'Sports',
  Economics: 'Economy', Financials: 'Economy', Companies: 'Economy', Commodities: 'Economy', Business: 'Economy',
  Crypto: 'Crypto',
  'Science and Technology': 'Tech', AI: 'Tech',
  Entertainment: 'Culture', Mentions: 'Culture', Social: 'Culture',
  World: 'World', 'Climate and Weather': 'World', Health: 'World',
};

/** Exact published category → chip; unknown or missing categories are "Other" (never guessed from the title). */
export const chipFor = (category: string | null): Exclude<KalshiChip, 'All'> =>
  (category && CHIP_OF[category] ? CHIP_OF[category] : 'Other') as Exclude<KalshiChip, 'All'>;
