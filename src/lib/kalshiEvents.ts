/* Read-only Kalshi EVENT metadata. Reuses the fixed-host GET transport and error mapping from ./kalshi.
   Events carry no status in the source, so none is invented. Child markets are never embedded here: callers use the
   bounded GET /markets?event_ticker=… page (fetchKalshiMarkets({ eventTicker })) instead of with_nested_markets=true. */
import {
  KalshiError, TICKER_RE, assertLimit, assertTicker, getKalshiJson, isIsoTimestamp, isValidCursor,
  parseNextCursor, parsePagedQuery, validateCursor,
} from './kalshi';

export const DEFAULT_EVENT_LIMIT = 50;

export interface KalshiEvent {
  eventTicker: string;
  seriesTicker: string;
  title: string;
  subTitle: string | null;
  category: string | null; // as published; no taxonomy guessing
  mutuallyExclusive: boolean | null; // only a real boolean from the source; 'false' is NOT false
  updatedTime: string | null;
  strikeDate: string | null;
}

export interface KalshiEventsPage {
  events: KalshiEvent[];
  nextCursor: string | null;
  receivedAt: string;
  sourceAsOf: null;
  rejectedCount: number;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isTicker = (v: unknown): v is string => typeof v === 'string' && TICKER_RE.test(v);
const isTitle = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const text = (v: unknown) => (isTitle(v) ? v : null);
const iso = (v: unknown) => (isIsoTimestamp(v) ? v : null);

export function normalizeEvent(raw: unknown): KalshiEvent | null {
  if (!isObj(raw)) return null;
  const { event_ticker: eventTicker, series_ticker: seriesTicker, title } = raw;
  if (!isTicker(eventTicker) || !isTicker(seriesTicker) || !isTitle(title)) return null;
  return {
    eventTicker,
    seriesTicker,
    title,
    subTitle: text(raw.sub_title),
    category: text(raw.category),
    mutuallyExclusive: typeof raw.mutually_exclusive === 'boolean' ? raw.mutually_exclusive : null,
    updatedTime: iso(raw.last_updated_ts),
    strikeDate: iso(raw.strike_date),
  };
}

export async function fetchKalshiEvents(
  { limit = DEFAULT_EVENT_LIMIT, cursor, seriesTicker }: { limit?: number; cursor?: string; seriesTicker?: string } = {},
): Promise<KalshiEventsPage> {
  assertLimit(limit);
  const query: Record<string, string> = { status: 'open', limit: String(limit), with_nested_markets: 'false' };
  if (cursor !== undefined) query.cursor = validateCursor(cursor);
  if (seriesTicker !== undefined) query.series_ticker = assertTicker(seriesTicker);
  const body = await getKalshiJson('/events', query);
  if (!isObj(body) || !Array.isArray(body.events)) throw new KalshiError(502, 'malformed events envelope');
  const receivedAt = new Date().toISOString();
  const events: KalshiEvent[] = [];
  let rejectedCount = 0;
  for (const row of body.events) {
    const ev = normalizeEvent(row);
    // A series-filtered page never displays a row from another series (counted as quarantined).
    if (ev && (seriesTicker === undefined || ev.seriesTicker === seriesTicker)) events.push(ev);
    else rejectedCount++;
  }
  return { events, nextCursor: parseNextCursor(body.cursor), receivedAt, sourceAsOf: null, rejectedCount };
}

/** Event metadata only (exclude_markets=true); the returned event_ticker must literally match. */
export async function fetchKalshiEvent(eventTicker: string): Promise<{ event: KalshiEvent; receivedAt: string; sourceAsOf: null }> {
  assertTicker(eventTicker);
  const body = await getKalshiJson(`/events/${encodeURIComponent(eventTicker)}`, { exclude_markets: 'true' });
  const event = isObj(body) ? normalizeEvent(body.event) : null;
  if (!event) throw new KalshiError(502, 'malformed event');
  if (event.eventTicker !== eventTicker) throw new KalshiError(502, 'event ticker mismatch');
  return { event, receivedAt: new Date().toISOString(), sourceAsOf: null };
}

export function parseEventListQuery(sp: URLSearchParams): { limit: number; cursor?: string; seriesTicker?: string } {
  return parsePagedQuery(sp, DEFAULT_EVENT_LIMIT, 'series_ticker', 'seriesTicker');
}

/* ── client guards for same-origin API pages ── */

const nullableText = (v: unknown) => v === null || isTitle(v);
const nullableIso = (v: unknown) => v === null || isIsoTimestamp(v);

export function isNormalizedEvent(v: unknown): v is KalshiEvent {
  return isObj(v) && isTicker(v.eventTicker) && isTicker(v.seriesTicker) && isTitle(v.title)
    && nullableText(v.subTitle) && nullableText(v.category)
    && (v.mutuallyExclusive === null || typeof v.mutuallyExclusive === 'boolean')
    && nullableIso(v.updatedTime) && nullableIso(v.strikeDate);
}

export function isEventsPage(v: unknown): v is KalshiEventsPage {
  return isObj(v) && Array.isArray(v.events) && v.events.every(isNormalizedEvent)
    && isIsoTimestamp(v.receivedAt) && v.sourceAsOf === null
    && (v.nextCursor === null || isValidCursor(v.nextCursor))
    && typeof v.rejectedCount === 'number' && Number.isInteger(v.rejectedCount) && v.rejectedCount >= 0;
}
