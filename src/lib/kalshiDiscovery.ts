/* Read-only Kalshi DISCOVERY: a bounded, activity-seeded SAMPLE — not a global ranking or full catalog.
   GET /markets is newest-first with no volume sort, so we seed from recent public trades instead:
   1) GET /markets/trades within one frozen 24h window (max 3 pages) -> valid, deduped trade rows;
   2) the most-traded sample tickers (max 80) -> GET /markets?tickers=… whitelisted batches (40 tickers, max 2 pages each);
   3) group open binary $1 markets by event; rank by best KNOWN 24h contract volume (null last), no summed metrics;
   4) metadata for the top 20 groups via GET /events/{ticker}?exclude_markets=true (4 in flight; failures are per group).
   Trade/market fetch failures fail the whole discovery closed. created_time is trade time, never quote freshness. */
import {
  KalshiError, MAX_LIMIT, TICKER_RE, getKalshiJson, isIsoTimestamp, isNormalizedMarket, isOpenListable, normalizeMarket,
  parseNextCursor, type KalshiMarket,
} from './kalshi';
import { fetchKalshiEvent, isNormalizedEvent, type KalshiEvent } from './kalshiEvents';

export const WINDOW_SECONDS = 86_400;
export const MAX_TRADE_PAGES = 3;
export const TRADE_PAGE_LIMIT = 1000;
export const MAX_SEED_TICKERS = 80;
export const MARKET_BATCH_SIZE = 40;
export const MAX_MARKET_PAGES_PER_BATCH = 2;
export const MAX_EVENT_ENRICHMENTS = 20;
export const EVENT_CONCURRENCY = 4;
const MAX_TRADE_ID = 128;

export type MetadataStatus = 'loaded' | 'unavailable' | 'not_requested';
const METADATA_STATUSES: readonly string[] = ['loaded', 'unavailable', 'not_requested'];

export interface KalshiDiscoveryGroup {
  eventTicker: string;
  event: KalshiEvent | null; // non-null only when metadataStatus === 'loaded'
  metadataStatus: MetadataStatus;
  markets: KalshiMarket[]; // only the SAMPLED open markets of this event, not all of its markets
}

export interface KalshiDiscoveryCoverage {
  tradePages: number;
  tradesScanned: number; // valid unique trades in the window
  rejectedTrades: number; // malformed, out-of-window or duplicate trade_id
  uniqueTickers: number;
  selectedTickers: number;
  moreTradesAvailable: boolean;
  oldestTradeAt: string | null;
  newestTradeAt: string | null;
  marketPages: number;
  rejectedMarkets: number; // malformed, not whitelisted, not open binary $1, or duplicate
  eventMetadataRequested: number;
  eventMetadataFailed: number;
  truncated: boolean; // a seed or market-page cap was hit
  windowStart: string;
  windowEnd: string;
}

export interface KalshiDiscoveryPage {
  groups: KalshiDiscoveryGroup[];
  receivedAt: string;
  sourceAsOf: null;
  coverage: KalshiDiscoveryCoverage;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const cmpStr = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
/** Descending with null last. */
const knownDesc = (a: number | null, b: number | null) => (a === null ? (b === null ? 0 : 1) : b === null ? -1 : b - a);
const isTradeId = (v: unknown): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= MAX_TRADE_ID && !/[\u0000-\u001f\u007f]/.test(v);

/** Follows a cursor chain with a page cap; a cursor seen before is a 502 loop, never a silent stop.
    A page longer than the requested limit is rejected before any row is processed (the limit is not trusted). */
async function paged(path: string, base: Record<string, string>, limit: number, maxPages: number,
  onPage: (body: Record<string, unknown>) => void, list: string) {
  const used = new Set<string>();
  let cursor: string | undefined;
  let pages = 0;
  for (;;) {
    const body = await getKalshiJson(path, { ...base, limit: String(limit), ...(cursor === undefined ? {} : { cursor }) });
    if (!isObj(body) || !Array.isArray(body[list])) throw new KalshiError(502, `malformed ${list} envelope`);
    if ((body[list] as unknown[]).length > limit) throw new KalshiError(502, `oversized ${list} page`);
    const next = parseNextCursor(body.cursor);
    pages++;
    onPage(body);
    if (next === null) return { pages, more: false };
    if (used.has(next)) throw new KalshiError(502, 'repeated cursor');
    if (pages >= maxPages) return { pages, more: true };
    used.add(next);
    cursor = next;
  }
}

async function fetchBatch(tickers: string[], now: Date) {
  const allowed = new Set(tickers);
  const seen = new Set<string>();
  const markets: KalshiMarket[] = [];
  let rejected = 0;
  const { pages, more } = await paged('/markets',
    { tickers: tickers.join(','), status: 'open', mve_filter: 'exclude' },
    MAX_LIMIT, MAX_MARKET_PAGES_PER_BATCH,
    body => {
      for (const row of body.markets as unknown[]) {
        const m = normalizeMarket(row);
        // Response identity is whitelisted: a ticker we did not ask for is never shown.
        if (m && allowed.has(m.ticker) && !seen.has(m.ticker) && isOpenListable(m, now)) { seen.add(m.ticker); markets.push(m); }
        else rejected++;
      }
    }, 'markets');
  return { markets, pages, rejected, capped: more };
}

/** Bounded worker pool; each failure becomes null for that slot only. */
async function enrich(eventTickers: string[]): Promise<(KalshiEvent | null)[]> {
  const out: (KalshiEvent | null)[] = new Array(eventTickers.length).fill(null);
  let next = 0;
  const worker = async () => {
    while (next < eventTickers.length) {
      const i = next++;
      try {
        const { event } = await fetchKalshiEvent(eventTickers[i]); // 502s on any event_ticker mismatch
        out[i] = event.eventTicker === eventTickers[i] ? event : null;
      } catch {
        out[i] = null;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(EVENT_CONCURRENCY, eventTickers.length) }, worker));
  return out;
}

export async function fetchKalshiDiscovery(): Promise<KalshiDiscoveryPage> {
  // One frozen window for every seed page.
  const maxTs = Math.floor(Date.now() / 1000);
  const minTs = maxTs - WINDOW_SECONDS;
  const now = new Date();

  const tradeIds = new Set<string>();
  const counts = new Map<string, number>();
  let rejectedTrades = 0;
  let oldest: { iso: string; ms: number } | null = null;
  let newest: { iso: string; ms: number } | null = null;

  const trades = await paged('/markets/trades',
    { min_ts: String(minTs), max_ts: String(maxTs) },
    TRADE_PAGE_LIMIT, MAX_TRADE_PAGES,
    body => {
      for (const row of body.trades as unknown[]) {
        if (!isObj(row)) { rejectedTrades++; continue; }
        const { ticker, trade_id: id, created_time: at } = row;
        const ms = isIsoTimestamp(at) ? Date.parse(at) : NaN;
        if (typeof ticker !== 'string' || !TICKER_RE.test(ticker) || !isTradeId(id) || !(ms >= minTs * 1000 && ms < (maxTs + 1) * 1000)
          || tradeIds.has(id)) { rejectedTrades++; continue; }
        tradeIds.add(id);
        counts.set(ticker, (counts.get(ticker) ?? 0) + 1);
        if (!oldest || ms < oldest.ms) oldest = { iso: at as string, ms };
        if (!newest || ms > newest.ms) newest = { iso: at as string, ms };
      }
    }, 'trades');

  // Seed: sample trade count desc, then ticker asc (deterministic; a sampling choice, not a market ranking).
  const ranked = [...counts].sort((a, b) => b[1] - a[1] || cmpStr(a[0], b[0])).map(([t]) => t);
  const selected = ranked.slice(0, MAX_SEED_TICKERS);
  const batches: string[][] = [];
  for (let i = 0; i < selected.length; i += MARKET_BATCH_SIZE) batches.push(selected.slice(i, i + MARKET_BATCH_SIZE));
  const results = await Promise.all(batches.map(b => fetchBatch(b, now)));

  const byEvent = new Map<string, KalshiMarket[]>();
  for (const m of results.flatMap(r => r.markets)) byEvent.set(m.eventTicker, [...(byEvent.get(m.eventTicker) ?? []), m]);
  const sorted = [...byEvent].map(([eventTicker, ms]) => ({
    eventTicker,
    markets: ms.sort((a, b) => knownDesc(a.volume24hContracts, b.volume24hContracts) || cmpStr(a.ticker, b.ticker)),
  })).sort((a, b) => knownDesc(a.markets[0].volume24hContracts, b.markets[0].volume24hContracts) || cmpStr(a.eventTicker, b.eventTicker));

  const targets = sorted.slice(0, MAX_EVENT_ENRICHMENTS).map(g => g.eventTicker);
  const events = await enrich(targets);
  const groups: KalshiDiscoveryGroup[] = sorted.map((g, i) => {
    const event = i < targets.length ? events[i] : null;
    return { eventTicker: g.eventTicker, event, metadataStatus: i >= targets.length ? 'not_requested' : event ? 'loaded' : 'unavailable', markets: g.markets };
  });

  const o = oldest as { iso: string } | null;
  const n = newest as { iso: string } | null;
  return {
    groups,
    receivedAt: new Date().toISOString(),
    sourceAsOf: null,
    coverage: {
      tradePages: trades.pages,
      tradesScanned: tradeIds.size,
      rejectedTrades,
      uniqueTickers: counts.size,
      selectedTickers: selected.length,
      moreTradesAvailable: trades.more,
      oldestTradeAt: o?.iso ?? null,
      newestTradeAt: n?.iso ?? null,
      marketPages: results.reduce((s, r) => s + r.pages, 0),
      rejectedMarkets: results.reduce((s, r) => s + r.rejected, 0),
      eventMetadataRequested: targets.length,
      eventMetadataFailed: events.filter(e => e === null).length,
      truncated: ranked.length > selected.length || results.some(r => r.capped),
      windowStart: new Date(minTs * 1000).toISOString(),
      windowEnd: new Date(maxTs * 1000).toISOString(),
    },
  };
}

/* ── client guard for the same-origin discovery page ── */

const COUNT_KEYS = ['tradePages', 'tradesScanned', 'rejectedTrades', 'uniqueTickers', 'selectedTickers', 'marketPages',
  'rejectedMarkets', 'eventMetadataRequested', 'eventMetadataFailed'] as const;
const isCount = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v >= 0;

function isCoverage(c: unknown): c is KalshiDiscoveryCoverage {
  return isObj(c) && COUNT_KEYS.every(k => isCount(c[k]))
    && typeof c.moreTradesAvailable === 'boolean' && typeof c.truncated === 'boolean'
    && [c.oldestTradeAt, c.newestTradeAt].every(v => v === null || isIsoTimestamp(v))
    && isIsoTimestamp(c.windowStart) && isIsoTimestamp(c.windowEnd)
    && (c.selectedTickers as number) <= (c.uniqueTickers as number)
    && (c.eventMetadataFailed as number) <= (c.eventMetadataRequested as number);
}

function isGroup(g: unknown): g is KalshiDiscoveryGroup {
  if (!isObj(g) || typeof g.eventTicker !== 'string' || !TICKER_RE.test(g.eventTicker)) return false;
  if (typeof g.metadataStatus !== 'string' || !METADATA_STATUSES.includes(g.metadataStatus)) return false;
  // Metadata binds only to its own group; loaded <=> event present.
  const eventOk = g.metadataStatus === 'loaded'
    ? isNormalizedEvent(g.event) && g.event.eventTicker === g.eventTicker
    : g.event === null;
  return eventOk && Array.isArray(g.markets) && g.markets.length > 0
    && g.markets.every(m => isNormalizedMarket(m) && m.eventTicker === g.eventTicker);
}

export function isDiscoveryPage(v: unknown): v is KalshiDiscoveryPage {
  if (!isObj(v) || !Array.isArray(v.groups) || !v.groups.every(isGroup)) return false;
  const tickers = v.groups.map(g => (g as KalshiDiscoveryGroup).eventTicker);
  return new Set(tickers).size === tickers.length
    && isIsoTimestamp(v.receivedAt) && v.sourceAsOf === null && isCoverage(v.coverage);
}
