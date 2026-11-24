/* Read-only Kalshi EVENT metadata. Reuses the fixed-host GET transport and error mapping from ./kalshi.
   Events carry no status in the source, so none is invented. Child markets are never embedded here: callers use the
   bounded GET /markets?event_ticker=… page (fetchKalshiMarkets({ eventTicker })) instead of with_nested_markets=true. */
import { KalshiError, TICKER_RE, assertTicker, getKalshiJson, isIsoTimestamp } from './kalshi';

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

/** Event metadata only (exclude_markets=true); the returned event_ticker must literally match. */
export async function fetchKalshiEvent(eventTicker: string): Promise<{ event: KalshiEvent; receivedAt: string; sourceAsOf: null }> {
  assertTicker(eventTicker);
  const body = await getKalshiJson(`/events/${encodeURIComponent(eventTicker)}`, { exclude_markets: 'true' });
  const event = isObj(body) ? normalizeEvent(body.event) : null;
  if (!event) throw new KalshiError(502, 'malformed event');
  if (event.eventTicker !== eventTicker) throw new KalshiError(502, 'event ticker mismatch');
  return { event, receivedAt: new Date().toISOString(), sourceAsOf: null };
}
