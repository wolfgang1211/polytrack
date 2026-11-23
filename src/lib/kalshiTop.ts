/* Kalshi "top markets" — the same idea as the Polymarket explorer: every open market, ranked by 24h volume.
   Kalshi's GET /markets has no volume sort (newest first only), so we page through ALL open, non-combo markets
   (status=open, mve_filter=exclude, limit=1000), keep the listable binary $1 ones, and rank them ourselves.
   Units stay honest: Kalshi volume and open interest are CONTRACT COUNTS, never dollars.
   If the time budget or the source's rate limit stops the scan early, the result says so (complete=false) and
   the page must show that it is a partial scan; it is never presented as a full ranking. */
import { KalshiError, getKalshiJson, isOpenListable, normalizeMarket, parseNextCursor, type KalshiMarket } from './kalshi';
import { fetchKalshiEvent } from './kalshiEvents';

export const SCAN_PAGE_LIMIT = 1000;      // Kalshi's documented max page size for GET /markets
export const MAX_SCAN_PAGES = 200;        // hard stop (200k markets) so a looping cursor can never run forever
export const SCAN_BUDGET_MS = 45_000;     // stays inside the function limit; a partial scan is labelled as partial
export const PAGE_GAP_MS = 120;           // polite spacing between pages (well under the public read rate limit)
export const RATE_LIMIT_RETRIES = 3;      // per page, on Kalshi 429 (mapped to KalshiError 503)
export const TOP_N = 120;
export const MAX_EVENT_LOOKUPS = 80;
export const EVENT_CONCURRENCY = 4;

export interface KalshiTopMarket extends KalshiMarket {
  category: string | null;   // as published by Kalshi on the event; null when the lookup failed
  eventTitle: string | null;
}

export interface KalshiTopScan {
  markets: KalshiTopMarket[];
  scannedMarkets: number;     // rows returned by the source across all pages
  listableMarkets: number;    // open binary $1 markets with a future close
  tradedMarkets: number;      // listable markets with 24h volume > 0
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

/** Keeps only the best `n` (bounded memory while scanning tens of thousands of rows). */
function keepTop(list: KalshiMarket[], n: number): KalshiMarket[] {
  return list.sort(compareByVolume).slice(0, n);
}

export async function scanKalshiTopMarkets(opts: {
  getJson?: JsonGetter;
  getEvent?: EventGetter;
  now?: () => number;
  wait?: (ms: number) => Promise<void>;
  budgetMs?: number;
  topN?: number;
} = {}): Promise<KalshiTopScan> {
  const getJson = opts.getJson ?? getKalshiJson;
  const getEvent = opts.getEvent ?? defaultGetEvent;
  const now = opts.now ?? (() => Date.now());
  const wait = opts.wait ?? sleep;
  const budget = opts.budgetMs ?? SCAN_BUDGET_MS;
  const topN = opts.topN ?? TOP_N;

  const t0 = now();
  const clock = new Date(t0);
  let cursor: string | undefined;
  let pages = 0, scanned = 0, listable = 0, traded = 0;
  let top: KalshiMarket[] = [];
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
    const batch: KalshiMarket[] = [];
    for (const row of body.markets) {
      scanned++;
      const m = normalizeMarket(row);
      if (!m || !isOpenListable(m, clock) || seen.has(m.ticker)) continue;
      seen.add(m.ticker);
      listable++;
      if ((m.volume24hContracts ?? 0) > 0) { traded++; batch.push(m); }
    }
    if (batch.length) top = keepTop(top.concat(batch), topN);
    const next = parseNextCursor(body.cursor);
    if (next === null) { stopReason = 'done'; break; }
    if (next === cursor) throw new KalshiError(502, 'cursor did not advance');
    cursor = next;
    await wait(PAGE_GAP_MS);
  }

  const markets = await attachEvents(top, getEvent);
  return {
    markets,
    scannedMarkets: scanned,
    listableMarkets: listable,
    tradedMarkets: traded,
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

/** Category and event title for the top markets' events (bounded, 4 in flight, failures stay per event). */
async function attachEvents(top: KalshiMarket[], getEvent: EventGetter): Promise<KalshiTopMarket[]> {
  const tickers = [...new Set(top.map(m => m.eventTicker))].slice(0, MAX_EVENT_LOOKUPS);
  const meta = new Map<string, { category: string | null; title: string } | null>();
  let i = 0;
  const worker = async () => {
    while (i < tickers.length) {
      const t = tickers[i++];
      try { meta.set(t, await getEvent(t)); } catch { meta.set(t, null); }
    }
  };
  await Promise.all(Array.from({ length: Math.min(EVENT_CONCURRENCY, tickers.length) }, worker));
  return top.map(m => {
    const e = meta.get(m.eventTicker) ?? null;
    return { ...m, category: e?.category ?? null, eventTitle: e?.title ?? null };
  });
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
