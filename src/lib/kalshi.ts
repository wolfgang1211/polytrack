/* Read-only Kalshi public market data adapter. Fixed host, GET only, no keys/env/cookies.
   Units: *_fp volume/open-interest fields are CONTRACT COUNTS (not USD); *_dollars are USD per contract.
   receivedAt is our retrieval time only — the source provides no quote timestamp (sourceAsOf is always null). */

export const KALSHI_BASE_URL = 'https://external-api.kalshi.com/trade-api/v2';
const TIMEOUT_MS = 8_000;
export const DEFAULT_LIMIT = 100;
export const MAX_LIMIT = 200;
const MAX_CURSOR = 512;
export const TICKER_RE = /^[A-Z0-9][A-Z0-9._-]{0,99}$/;

// Market lifecycle statuses from the official Get Market doc; anything else is rejected, never presumed active.
export const KALSHI_STATUSES = ['initialized', 'inactive', 'active', 'closed', 'determined', 'disputed', 'amended', 'finalized'] as const;
export type KalshiStatus = typeof KALSHI_STATUSES[number];

export interface KalshiMarket {
  ticker: string;
  eventTicker: string;
  title: string | null;
  yesLabel: string | null;
  noLabel: string | null;
  status: KalshiStatus;
  marketType: string | null;
  closeTime: string | null;
  updatedTime: string | null;
  volume24hContracts: number | null;
  totalVolumeContracts: number | null;
  openInterestContracts: number | null;
  yesBid: number | null;
  yesAsk: number | null;
  yesBidSize: number | null;
  yesAskSize: number | null;
  notionalDollars: number | null;
  rulesPrimary: string | null;
  rulesSecondary: string | null;
}

export interface KalshiMarketsPage {
  markets: KalshiMarket[];
  nextCursor: string | null;
  receivedAt: string;
  sourceAsOf: null;
  rejectedCount: number;
}

export interface KalshiLevel { price: number; size: number }
export interface KalshiDerivedLevel extends KalshiLevel { derivedFrom: 'no_bid' | 'yes_bid' }
export interface KalshiOrderbook {
  yesBids: KalshiLevel[];
  noBids: KalshiLevel[];
  yesAsks: KalshiDerivedLevel[];
  noAsks: KalshiDerivedLevel[];
  bestYesBid: number | null;
  bestYesAsk: number | null;
  bestNoBid: number | null;
  bestNoAsk: number | null;
  rejectedLevelCount: number;
  complete: boolean;
}

export type KalshiErrorStatus = 400 | 404 | 422 | 502 | 503 | 504;
export class KalshiError extends Error {
  constructor(public status: KalshiErrorStatus, message: string) {
    super(message);
    this.name = 'KalshiError';
  }
}

const PUBLIC_MESSAGE: Record<number, string> = {
  404: 'Not found on Kalshi.',
  422: 'Order book display is supported only for binary $1 markets.',
  502: 'Kalshi data is temporarily unavailable or malformed.',
  503: 'Kalshi is rate limiting requests. Please try again shortly.',
  504: 'Kalshi did not respond in time.',
};

/* ── value parsing (never coerce junk into 0) ─────────────── */

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const DECIMAL_RE = /^\d+(\.\d+)?$/;
const round4 = (x: number) => Math.round(x * 1e4) / 1e4;

/** Non-negative finite decimal from a decimal string (or finite number); everything else null. */
function nonNeg(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? v : null;
  if (typeof v !== 'string' || !DECIMAL_RE.test(v.trim())) return null;
  const n = Number(v.trim());
  return Number.isFinite(n) ? n : null;
}
/** Probability price in [0,1] with the source's supported precision (<=4dp). More precision is rejected, never rounded. */
function price01(v: unknown): number | null {
  if (typeof v === 'string') {
    const s = v.trim();
    if (!/^\d(\.\d{1,4})?$/.test(s)) return null;
    const n = Number(s);
    return n <= 1 ? n : null;
  }
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1) return null;
  return round4(v) === v ? v : null;
}
const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null);
const timestamp = (v: unknown) => (typeof v === 'string' && Number.isFinite(Date.parse(v)) ? v : null);

/** A displayable quote needs a price strictly inside (0,1) and a positive size; otherwise both null. */
function quote(p: unknown, s: unknown): [number | null, number | null] {
  const price = price01(p);
  const size = nonNeg(s);
  return price !== null && price > 0 && price < 1 && size !== null && size > 0 ? [price, size] : [null, null];
}

export function normalizeMarket(raw: unknown): KalshiMarket | null {
  if (!isObj(raw)) return null;
  const { ticker, event_ticker: eventTicker, status } = raw;
  if (typeof ticker !== 'string' || !TICKER_RE.test(ticker)) return null;
  if (typeof eventTicker !== 'string' || !TICKER_RE.test(eventTicker)) return null;
  if (typeof status !== 'string' || !(KALSHI_STATUSES as readonly string[]).includes(status)) return null;
  const [yesBid, yesBidSize] = quote(raw.yes_bid_dollars, raw.yes_bid_size_fp);
  const [yesAsk, yesAskSize] = quote(raw.yes_ask_dollars, raw.yes_ask_size_fp);
  const notional = nonNeg(raw.notional_value_dollars);
  return {
    ticker,
    eventTicker,
    title: text(raw.title),
    yesLabel: text(raw.yes_sub_title),
    noLabel: text(raw.no_sub_title),
    status: status as KalshiStatus,
    marketType: text(raw.market_type),
    closeTime: timestamp(raw.close_time),
    updatedTime: timestamp(raw.updated_time),
    volume24hContracts: nonNeg(raw.volume_24h_fp),
    totalVolumeContracts: nonNeg(raw.volume_fp),
    openInterestContracts: nonNeg(raw.open_interest_fp),
    yesBid, yesAsk, yesBidSize, yesAskSize,
    notionalDollars: notional !== null && notional > 0 ? notional : null,
    rulesPrimary: text(raw.rules_primary),
    rulesSecondary: text(raw.rules_secondary),
  };
}

/** Binary, $1-notional markets are the only ones whose book we render as Yes/No prices. */
export const isBookSupported = (m: KalshiMarket) => m.marketType === 'binary' && m.notionalDollars === 1;

export function isOpenListable(m: KalshiMarket | null, now: Date = new Date()): boolean {
  if (!m || m.status !== 'active' || !isBookSupported(m) || !m.closeTime) return false;
  return Date.parse(m.closeTime) > now.getTime();
}

/* ── order book ────────────────────────────────────────────── */

function side(v: unknown, counter: { rejected: number }): KalshiLevel[] {
  // Official schema: both sides are REQUIRED arrays. Missing/null is malformed; only a real [] is an empty side.
  if (!Array.isArray(v)) throw new KalshiError(502, 'malformed order book side');
  const out: KalshiLevel[] = [];
  for (const level of v) {
    const price = Array.isArray(level) && level.length >= 2 ? price01(level[0]) : null;
    const size = Array.isArray(level) && level.length >= 2 ? nonNeg(level[1]) : null;
    if (price !== null && price > 0 && price < 1 && size !== null && size > 0) out.push({ price, size });
    else counter.rejected++;
  }
  return out.sort((a, b) => b.price - a.price);
}

export function normalizeOrderbook(raw: unknown): KalshiOrderbook {
  if (!isObj(raw) || !isObj(raw.orderbook_fp)) throw new KalshiError(502, 'malformed order book envelope');
  const counter = { rejected: 0 };
  const yesBids = side(raw.orderbook_fp.yes_dollars, counter);
  const noBids = side(raw.orderbook_fp.no_dollars, counter);
  // A No bid at p is an implied Yes ask at 1-p for the same quantity (and vice versa).
  const derive = (bids: KalshiLevel[], derivedFrom: KalshiDerivedLevel['derivedFrom']) =>
    bids.map(b => ({ price: round4(1 - b.price), size: b.size, derivedFrom })).sort((a, b) => a.price - b.price);
  const yesAsks = derive(noBids, 'no_bid');
  const noAsks = derive(yesBids, 'yes_bid');
  return {
    yesBids, noBids, yesAsks, noAsks,
    bestYesBid: yesBids[0]?.price ?? null,
    bestYesAsk: yesAsks[0]?.price ?? null,
    bestNoBid: noBids[0]?.price ?? null,
    bestNoAsk: noAsks[0]?.price ?? null,
    rejectedLevelCount: counter.rejected,
    complete: counter.rejected === 0,
  };
}

/* ── input validation (before any network) ─────────────────── */

/** Opaque cursor: nonempty, bounded, no control characters. */
export const isValidCursor = (c: unknown): c is string =>
  typeof c === 'string' && c.length > 0 && c.length <= MAX_CURSOR && !/[\u0000-\u001f\u007f]/.test(c);

export function validateCursor(cursor: string): string {
  if (!isValidCursor(cursor)) throw new KalshiError(400, 'Invalid cursor.');
  return cursor;
}

export function assertTicker(ticker: unknown): string {
  if (typeof ticker !== 'string' || !TICKER_RE.test(ticker)) throw new KalshiError(400, 'Invalid Kalshi ticker.');
  return ticker;
}

export function assertLimit(limit: unknown): number {
  if (!Number.isInteger(limit) || (limit as number) < 1 || (limit as number) > MAX_LIMIT) throw new KalshiError(400, 'Invalid limit.');
  return limit as number;
}

/** Shared paged-query parser: repeated keys rejected, limit 1..MAX_LIMIT, opaque cursor, optional strict ticker filter. */
export function parsePagedQuery<K extends string>(sp: URLSearchParams, defaultLimit: number, filterParam: string, filterKey: K):
  { limit: number; cursor?: string } & Partial<Record<K, string>> {
  const keys = [...sp.keys()];
  if (new Set(keys).size !== keys.length) throw new KalshiError(400, 'Repeated query parameters are not allowed.');
  const rawLimit = sp.get('limit');
  let limit = defaultLimit;
  if (rawLimit !== null) {
    limit = /^\d{1,3}$/.test(rawLimit) ? Number(rawLimit) : NaN;
    if (!(limit >= 1 && limit <= MAX_LIMIT)) throw new KalshiError(400, `limit must be an integer from 1 to ${MAX_LIMIT}.`);
  }
  const out: Record<string, unknown> = { limit };
  const cursor = sp.get('cursor');
  if (cursor !== null) out.cursor = validateCursor(cursor);
  const filter = sp.get(filterParam);
  if (filter !== null) out[filterKey] = assertTicker(filter);
  return out as unknown as { limit: number; cursor?: string } & Partial<Record<K, string>>;
}

export function parseListQuery(sp: URLSearchParams): { limit: number; cursor?: string; eventTicker?: string } {
  return parsePagedQuery(sp, DEFAULT_LIMIT, 'event_ticker', 'eventTicker');
}

/** Official schema: cursor is a required string and only '' means exhaustion. Anything else must not look complete. */
export function parseNextCursor(next: unknown): string | null {
  if (next === '') return null;
  if (isValidCursor(next)) return next;
  throw new KalshiError(502, 'malformed or missing cursor');
}

/* ── fetchers ──────────────────────────────────────────────── */

/** Fixed-host, GET-only, unauthenticated transport with an 8s timeout (fetch + body) and no redirects. */
export async function getKalshiJson(path: string, query?: Record<string, string>): Promise<unknown> {
  const url = new URL(`${KALSHI_BASE_URL}${path}`);
  for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, v);
  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      redirect: 'error', // fixed-host boundary: never follow a redirect elsewhere
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    throw new KalshiError(isTimeout(e) ? 504 : 502, 'upstream request failed');
  }
  if (res.status === 404) throw new KalshiError(404, 'not found');
  if (res.status === 429) throw new KalshiError(503, 'rate limited');
  if (!res.ok) throw new KalshiError(502, `upstream HTTP ${res.status}`);
  try {
    return await res.json();
  } catch (e) {
    // The timeout signal also covers the body read.
    throw new KalshiError(isTimeout(e) ? 504 : 502, 'upstream body is not JSON');
  }
}

function isTimeout(e: unknown): boolean {
  const name = (e as { name?: string })?.name;
  return name === 'AbortError' || name === 'TimeoutError';
}

export async function fetchKalshiMarkets(
  { limit = DEFAULT_LIMIT, cursor, eventTicker }: { limit?: number; cursor?: string; eventTicker?: string } = {},
): Promise<KalshiMarketsPage> {
  assertLimit(limit);
  const query: Record<string, string> = { status: 'open', limit: String(limit), mve_filter: 'exclude' };
  if (cursor !== undefined) query.cursor = validateCursor(cursor);
  if (eventTicker !== undefined) query.event_ticker = assertTicker(eventTicker);
  const body = await getKalshiJson('/markets', query);
  if (!isObj(body) || !Array.isArray(body.markets)) throw new KalshiError(502, 'malformed markets envelope');
  const receivedAt = new Date().toISOString();
  const now = new Date();
  const markets: KalshiMarket[] = [];
  let rejectedCount = 0;
  for (const row of body.markets) {
    const m = normalizeMarket(row);
    // Event-filtered pages never display a row bound to a different event (counted as quarantined).
    if (m && isOpenListable(m, now) && (eventTicker === undefined || m.eventTicker === eventTicker)) markets.push(m);
    else rejectedCount++;
  }
  return { markets, nextCursor: parseNextCursor(body.cursor), receivedAt, sourceAsOf: null, rejectedCount };
}

export async function fetchKalshiMarket(ticker: string): Promise<{ market: KalshiMarket; receivedAt: string; sourceAsOf: null }> {
  assertTicker(ticker);
  const body = await getKalshiJson(`/markets/${encodeURIComponent(ticker)}`);
  const market = isObj(body) ? normalizeMarket(body.market) : null;
  if (!market) throw new KalshiError(502, 'malformed market');
  if (market.ticker !== ticker) throw new KalshiError(502, 'ticker mismatch');
  return { market, receivedAt: new Date().toISOString(), sourceAsOf: null };
}

/** Book for a market whose metadata was already verified by fetchKalshiMarket. */
export async function fetchVerifiedOrderbook(market: KalshiMarket): Promise<KalshiOrderbook & { ticker: string; receivedAt: string; sourceAsOf: null }> {
  assertTicker(market.ticker);
  if (!isBookSupported(market)) throw new KalshiError(422, 'unsupported market type or notional');
  const book = normalizeOrderbook(await getKalshiJson(`/markets/${encodeURIComponent(market.ticker)}/orderbook`));
  return { ticker: market.ticker, receivedAt: new Date().toISOString(), sourceAsOf: null, ...book };
}

/** Metadata is verified first: an empty 200 book is never proof that a ticker exists. */
export async function fetchKalshiOrderbook(ticker: string) {
  const { market } = await fetchKalshiMarket(ticker);
  return fetchVerifiedOrderbook(market);
}

/* ── normalized-shape guards (client validates same-origin API pages with these) ── */

const ISO_TZ_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;
/** Strict timezone-bearing ISO-8601 timestamp. */
export const isIsoTimestamp = (v: unknown): v is string => typeof v === 'string' && ISO_TZ_RE.test(v) && Number.isFinite(Date.parse(v));
const nullableText = (v: unknown) => v === null || typeof v === 'string';
const nullableCount = (v: unknown) => v === null || (typeof v === 'number' && Number.isFinite(v) && v >= 0);
const nullableProb = (v: unknown) => v === null || (typeof v === 'number' && v >= 0 && v <= 1);
const nullableTime = (v: unknown) => v === null || (typeof v === 'string' && Number.isFinite(Date.parse(v)));

/** True only for a fully formed normalized market (every field present; undefined is never accepted). */
export function isNormalizedMarket(v: unknown): v is KalshiMarket {
  if (!isObj(v)) return false;
  return typeof v.ticker === 'string' && TICKER_RE.test(v.ticker)
    && typeof v.eventTicker === 'string' && TICKER_RE.test(v.eventTicker)
    && typeof v.status === 'string' && (KALSHI_STATUSES as readonly string[]).includes(v.status)
    && [v.title, v.yesLabel, v.noLabel, v.marketType, v.rulesPrimary, v.rulesSecondary].every(nullableText)
    && [v.closeTime, v.updatedTime].every(nullableTime)
    && [v.volume24hContracts, v.totalVolumeContracts, v.openInterestContracts, v.yesBidSize, v.yesAskSize, v.notionalDollars].every(nullableCount)
    && [v.yesBid, v.yesAsk].every(nullableProb);
}

export function isMarketsPage(v: unknown): v is KalshiMarketsPage {
  return isObj(v) && Array.isArray(v.markets) && v.markets.every(isNormalizedMarket)
    && isIsoTimestamp(v.receivedAt) && v.sourceAsOf === null
    && (v.nextCursor === null || isValidCursor(v.nextCursor))
    && typeof v.rejectedCount === 'number' && Number.isInteger(v.rejectedCount) && v.rejectedCount >= 0;
}

/* ── display formatting (shared by server pages and client list) ── */

/** USD-per-contract price as cents; null stays an explicit "Unavailable". */
export const formatCents = (p: number | null) => (p === null ? 'Unavailable' : `${(p * 100).toFixed(2).replace(/\.?0+$/, '')}¢`);
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
/** Contract counts — never dollars. */
export const formatContracts = (n: number | null) => (n === null ? 'Unavailable' : `${compact.format(n)} contracts`);
/** Fixed UTC rendering so server and client markup match. */
export function formatUtc(iso: string | null): string {
  if (!iso || !Number.isFinite(Date.parse(iso))) return 'Unavailable';
  return `${new Date(iso).toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

/* ── route helpers ─────────────────────────────────────────── */

export const NO_STORE = { 'Cache-Control': 'no-store' };
export const SHORT_CACHE = { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30' };

/** Sanitized error response: fixed messages, never upstream body text, never cached. */
export function kalshiErrorResponse(e: unknown): Response {
  const status = e instanceof KalshiError ? e.status : 502;
  const error = status === 400 ? (e as KalshiError).message : PUBLIC_MESSAGE[status] ?? PUBLIC_MESSAGE[502];
  return Response.json({ error }, { status, headers: NO_STORE });
}
