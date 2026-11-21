/* Read-only Kalshi price history (candlesticks) and recent public trades for one verified market. */
import {
  KalshiError, TICKER_RE, assertTicker, getKalshiJson, isBookSupported, isIsoTimestamp, parseNextCursor,
  type KalshiErrorStatus, type KalshiMarket,
} from '@/lib/kalshi';

export const HISTORY_RANGES = ['1h', '24h', '7d'] as const;
export type KalshiHistoryRange = typeof HISTORY_RANGES[number];
export const DEFAULT_HISTORY_RANGE: KalshiHistoryRange = '24h';
export const MAX_CANDLES = 200;
export const TRADE_PAGE_LIMIT = 50;

const SPAN: Record<KalshiHistoryRange, number> = { '1h': 3600, '24h': 86400, '7d': 604800 };
const PERIOD: Record<KalshiHistoryRange, 1 | 60> = { '1h': 1, '24h': 60, '7d': 60 };

export interface KalshiHistoryWindow { startTs: number; endTs: number; periodMinutes: 1 | 60 }
export interface KalshiCandlePoint { endTs: number; yesClose: number | null; volumeContracts: number }
export interface KalshiTrade {
  tradeId: string; createdTime: string; yesPrice: number; noPrice: number; countContracts: number;
  takerOutcomeSide: 'yes' | 'no'; isBlockTrade: boolean;
}
export type HistorySection<T> = { ok: true; data: T } | { ok: false; status: KalshiErrorStatus; error: string };
export interface KalshiHistory {
  ticker: string;
  range: KalshiHistoryRange;
  window: KalshiHistoryWindow;
  retrievedAt: string;
  sourceAsOf: null;
  candles: HistorySection<{ seriesTicker: string; points: KalshiCandlePoint[] }>;
  trades: HistorySection<{ trades: KalshiTrade[]; hasMore: boolean }>;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isRange = (v: unknown): v is KalshiHistoryRange => typeof v === 'string' && (HISTORY_RANGES as readonly string[]).includes(v);
const bad = (why: string) => new KalshiError(502, why);

/* ── window / query (server-computed; never accepts caller timestamps) ── */

export function historyWindow(range: unknown, now: Date): KalshiHistoryWindow & { range: KalshiHistoryRange } {
  if (!isRange(range)) throw new KalshiError(400, 'range must be one of 1h, 24h, 7d.');
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) throw new Error('invalid clock');
  const endTs = Math.floor(nowMs / 1000);
  return { range, startTs: endTs - SPAN[range], endTs, periodMinutes: PERIOD[range] };
}

export function parseHistoryQuery(sp: URLSearchParams): KalshiHistoryRange {
  const keys = [...sp.keys()];
  if (keys.some(k => k !== 'range')) throw new KalshiError(400, 'Only the range parameter is allowed.');
  if (keys.length > 1) throw new KalshiError(400, 'Repeated query parameters are not allowed.');
  if (keys.length === 0) return DEFAULT_HISTORY_RANGE;
  const range = sp.get('range');
  if (!isRange(range)) throw new KalshiError(400, 'range must be one of 1h, 24h, 7d.');
  return range;
}

/* ── strict value parsing (source strings only; reject, never round/clamp/fill) ── */

const PRICE_RE = /^(?:0(?:\.\d{1,6})?|1(?:\.0{1,6})?)$/; // FixedPointDollars: responses emit up to 6dp
const COUNT_RE = /^\d+\.\d{2}$/; // FixedPointCount: responses always emit 2dp
const price01 = (v: unknown): number | null => (typeof v === 'string' && PRICE_RE.test(v) ? Number(v) : null);
const count2 = (v: unknown): number | null => {
  if (typeof v !== 'string' || !COUNT_RE.test(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const validId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 128 && !/[\u0000-\u001f\u007f]/.test(v);

/* ── candlesticks ── */

export function normalizeCandles(raw: unknown, ticker: string, window: KalshiHistoryWindow): KalshiCandlePoint[] {
  if (!isObj(raw) || raw.ticker !== ticker) throw bad('candlestick ticker mismatch');
  const rows = raw.candlesticks;
  if (!Array.isArray(rows)) throw bad('malformed candlesticks');
  if (rows.length > MAX_CANDLES) throw bad('too many candlesticks'); // bound before reading any row
  const period = window.periodMinutes * 60;
  const out: KalshiCandlePoint[] = [];
  let prev = -Infinity;
  for (const row of rows) {
    if (!isObj(row)) throw bad('malformed candlestick');
    const ts = row.end_period_ts;
    if (typeof ts !== 'number' || !Number.isInteger(ts) || ts < window.startTs || ts > window.endTs || ts % period !== 0) {
      throw bad('candlestick timestamp outside window or off period');
    }
    if (ts <= prev) throw bad('duplicate or unordered candlesticks');
    prev = ts;
    if (!isObj(row.price)) throw bad('malformed candlestick price');
    // Only the YES trade close is charted. Null/absent = no trade in that period (a real gap); previous_dollars is never used.
    const c = row.price.close_dollars;
    let yesClose: number | null = null;
    if (c !== undefined && c !== null) {
      yesClose = price01(c);
      if (yesClose === null) throw bad('invalid candlestick close');
    }
    const volumeContracts = count2(row.volume_fp);
    if (volumeContracts === null) throw bad('invalid candlestick volume');
    out.push({ endTs: ts, yesClose, volumeContracts });
  }
  return out;
}

/* ── trades ── */

export function normalizeTrades(raw: unknown, ticker: string, window: KalshiHistoryWindow): { trades: KalshiTrade[]; hasMore: boolean } {
  if (!isObj(raw) || !Array.isArray(raw.trades)) throw bad('malformed trades envelope');
  const rows = raw.trades;
  if (rows.length > TRADE_PAGE_LIMIT) throw bad('too many trades'); // never trust the requested limit
  const hasMore = parseNextCursor(raw.cursor) !== null;
  const seen = new Set<string>();
  const trades: KalshiTrade[] = [];
  for (const row of rows) {
    if (!isObj(row)) throw bad('malformed trade');
    const { trade_id: id, created_time: created, taker_outcome_side: outcome, taker_book_side: book, is_block_trade: block } = row;
    if (!validId(id) || seen.has(id)) throw bad('missing or duplicate trade id');
    seen.add(id);
    if (row.ticker !== ticker) throw bad('trade ticker mismatch');
    const countContracts = count2(row.count_fp);
    const yesPrice = price01(row.yes_price_dollars);
    const noPrice = price01(row.no_price_dollars);
    if (countContracts === null || countContracts <= 0 || yesPrice === null || noPrice === null) throw bad('invalid trade values');
    // Direction bit only: yes<->bid, no<->ask. Never mapped to Buy/Sell and never used to transform prices.
    if (!((outcome === 'yes' && book === 'bid') || (outcome === 'no' && book === 'ask'))) throw bad('invalid trade direction');
    if (typeof block !== 'boolean') throw bad('invalid block flag');
    if (!isIsoTimestamp(created)) throw bad('invalid trade time');
    const sec = Math.floor(Date.parse(created) / 1000);
    if (sec < window.startTs || sec > window.endTs) throw bad('trade outside window');
    trades.push({ tradeId: id, createdTime: created, yesPrice, noPrice, countContracts, takerOutcomeSide: outcome as 'yes' | 'no', isBlockTrade: block });
  }
  return { trades, hasMore };
}

/* ── fetch (market already verified by fetchKalshiMarket) ── */

const SECTION_MESSAGE: Record<number, string> = {
  404: 'Not found on Kalshi.',
  422: 'Price history is supported only for binary $1 markets.',
  502: 'Kalshi data is temporarily unavailable or malformed.',
  503: 'Kalshi is rate limiting requests. Please try again shortly.',
  504: 'Kalshi did not respond in time.',
};
const ERROR_STATUSES = [404, 422, 502, 503, 504];

function section<T>(r: PromiseSettledResult<T>): HistorySection<T> {
  if (r.status === 'fulfilled') return { ok: true, data: r.value };
  const s = r.reason instanceof KalshiError ? r.reason.status : 502;
  const status = (ERROR_STATUSES.includes(s) ? s : 502) as KalshiErrorStatus;
  return { ok: false, status, error: SECTION_MESSAGE[status] };
}

export async function fetchKalshiHistory(market: KalshiMarket, range: KalshiHistoryRange, now: Date = new Date()): Promise<KalshiHistory> {
  const ticker = assertTicker(market.ticker);
  if (!isBookSupported(market)) throw new KalshiError(422, 'unsupported market type or notional');
  const { startTs, endTs, periodMinutes } = historyWindow(range, now);
  const window: KalshiHistoryWindow = { startTs, endTs, periodMinutes };
  const enc = encodeURIComponent;

  const candles = (async () => {
    // Series comes only from the verified event record, never from splitting the market ticker.
    const ev = await getKalshiJson(`/events/${enc(market.eventTicker)}`);
    const event = isObj(ev) ? ev.event : null;
    if (!isObj(event) || event.event_ticker !== market.eventTicker) throw bad('event mismatch');
    const series = event.series_ticker;
    if (typeof series !== 'string' || !TICKER_RE.test(series)) throw bad('invalid series ticker');
    const raw = await getKalshiJson(`/series/${enc(series)}/markets/${enc(ticker)}/candlesticks`, {
      start_ts: String(startTs), end_ts: String(endTs), period_interval: String(periodMinutes), include_latest_before_start: 'false',
    });
    return { seriesTicker: series, points: normalizeCandles(raw, ticker, window) };
  })();
  const trades = (async () => normalizeTrades(await getKalshiJson('/markets/trades', {
    ticker, limit: String(TRADE_PAGE_LIMIT), min_ts: String(startTs), max_ts: String(endTs),
  }), ticker, window))();

  const [c, t] = await Promise.allSettled([candles, trades]);
  return {
    ticker, range, window, retrievedAt: new Date().toISOString(), sourceAsOf: null,
    candles: section(c), trades: section(t),
  };
}

/* ── client-side validation of same-origin payloads ── */

const isProb = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);

function validSection(s: unknown, data: (d: Record<string, unknown>) => boolean): boolean {
  if (!isObj(s)) return false;
  if (s.ok === true) return isObj(s.data) && data(s.data);
  return s.ok === false && ERROR_STATUSES.includes(s.status as number) && typeof s.error === 'string';
}

export function isKalshiHistory(v: unknown, expected: { ticker: string; range: KalshiHistoryRange }): v is KalshiHistory {
  if (!isObj(v) || v.ticker !== expected.ticker || v.range !== expected.range || !isRange(v.range)) return false;
  const range = v.range;
  const w = v.window;
  if (!isObj(w) || !isInt(w.startTs) || !isInt(w.endTs) || w.endTs - w.startTs !== SPAN[range] || w.periodMinutes !== PERIOD[range]) return false;
  if (!isIsoTimestamp(v.retrievedAt) || v.sourceAsOf !== null) return false;
  const startTs = w.startTs as number;
  const endTs = w.endTs as number;
  const period = PERIOD[range] * 60;

  const candlesOk = validSection(v.candles, d => {
    if (typeof d.seriesTicker !== 'string' || !TICKER_RE.test(d.seriesTicker)) return false;
    if (!Array.isArray(d.points) || d.points.length > MAX_CANDLES) return false;
    let prev = -Infinity;
    for (const p of d.points) {
      if (!isObj(p) || !isInt(p.endTs) || p.endTs < startTs || p.endTs > endTs || p.endTs % period !== 0 || p.endTs <= prev) return false;
      prev = p.endTs;
      if (!(p.yesClose === null || isProb(p.yesClose))) return false;
      if (typeof p.volumeContracts !== 'number' || !Number.isFinite(p.volumeContracts) || p.volumeContracts < 0) return false;
    }
    return true;
  });

  const tradesOk = validSection(v.trades, d => {
    if (typeof d.hasMore !== 'boolean' || !Array.isArray(d.trades) || d.trades.length > TRADE_PAGE_LIMIT) return false;
    const ids = new Set<string>();
    for (const t of d.trades) {
      if (!isObj(t) || !validId(t.tradeId) || ids.has(t.tradeId)) return false;
      ids.add(t.tradeId);
      if (!isIsoTimestamp(t.createdTime)) return false;
      const sec = Math.floor(Date.parse(t.createdTime) / 1000);
      if (sec < startTs || sec > endTs) return false;
      if (!isProb(t.yesPrice) || !isProb(t.noPrice)) return false;
      if (typeof t.countContracts !== 'number' || !Number.isFinite(t.countContracts) || t.countContracts <= 0) return false;
      if (t.takerOutcomeSide !== 'yes' && t.takerOutcomeSide !== 'no') return false;
      if (typeof t.isBlockTrade !== 'boolean') return false;
    }
    return true;
  });

  return candlesOk && tradesOk;
}
