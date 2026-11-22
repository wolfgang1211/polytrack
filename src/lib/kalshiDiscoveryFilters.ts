/* Pure Discover filters + URL state. No fetch, window, storage or Date.now(): closing windows are anchored to the
   SAMPLE's receivedAt so SSR and hydration agree. Filters apply only to the already-fetched sample. */
import { isIsoTimestamp } from './kalshi';
import type { KalshiDiscoveryGroup } from './kalshiDiscovery';
import { analyzeKalshiQuotes } from './kalshiQuoteQuality';

export const SPREAD_OPTIONS = ['1', '5', '10', '20'] as const;
export const SIZE_OPTIONS = ['100', '1000'] as const;
export const CLOSING_OPTIONS = ['24h', '7d'] as const;
export const FILTER_KEYS = ['q', 'category', 'maxSpread', 'minSize', 'closing'] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];

export interface DiscoveryFilters {
  q: string;
  category: string;
  maxSpread: '' | (typeof SPREAD_OPTIONS)[number];
  minSize: '' | (typeof SIZE_OPTIONS)[number];
  closing: '' | (typeof CLOSING_OPTIONS)[number];
}
export interface ParsedDiscoveryFilters { filters: DiscoveryFilters; invalidKeys: FilterKey[] }

export const DEFAULT_FILTERS: Readonly<DiscoveryFilters> = Object.freeze({ q: '', category: '', maxSpread: '', minSize: '', closing: '' });

const TEXT_MAX: Partial<Record<FilterKey, number>> = { q: 120, category: 80 };
const ENUMS: Partial<Record<FilterKey, readonly string[]>> = { maxSpread: SPREAD_OPTIONS, minSize: SIZE_OPTIONS, closing: CLOSING_OPTIONS };
const CONTROL_RE = /[\u0000-\u001f\u007f]/;
const CLOSING_MS = { '24h': 86_400_000, '7d': 604_800_000 } as const;

/** A canonical value: text is already trimmed, bounded and control-free; enums are exact ('' = off). */
export function isFilterValue(key: FilterKey, v: unknown): v is string {
  if (typeof v !== 'string') return false;
  const max = TEXT_MAX[key];
  if (max !== undefined) return v === v.trim() && v.length <= max && !CONTROL_RE.test(v);
  return v === '' || ENUMS[key]!.includes(v);
}

export const hasActiveFilters = (f: DiscoveryFilters) => FILTER_KEYS.some(k => f[k] !== '');

/** Only the five owned keys are read. Repeated or invalid values are reported, never guessed; the field stays default. */
export function parseDiscoveryFilters(sp: URLSearchParams): ParsedDiscoveryFilters {
  const filters: DiscoveryFilters = { ...DEFAULT_FILTERS };
  const invalidKeys: FilterKey[] = [];
  for (const key of FILTER_KEYS) {
    const all = sp.getAll(key);
    if (all.length === 0) continue;
    const raw = all[0];
    // Control chars are checked on the raw value so trim cannot hide them.
    const value = TEXT_MAX[key] !== undefined && !CONTROL_RE.test(raw) ? raw.trim() : raw;
    if (all.length > 1 || !isFilterValue(key, value)) invalidKeys.push(key);
    else (filters as unknown as Record<string, string>)[key] = value;
  }
  return { filters, invalidKeys };
}

/** Copy of base: unrelated keys (incl. duplicates) kept, owned keys replaced, defaults omitted. Throws on junk. */
export function serializeDiscoveryFilters(filters: DiscoveryFilters, base: URLSearchParams): URLSearchParams {
  for (const key of FILTER_KEYS) if (!isFilterValue(key, filters[key])) throw new TypeError(`Invalid discovery filter: ${key}`);
  const out = new URLSearchParams(base);
  for (const key of FILTER_KEYS) out.delete(key);
  out.set('platform', 'kalshi');
  out.set('view', 'discover');
  for (const key of FILTER_KEYS) if (filters[key] !== '') out.set(key, filters[key]);
  return out;
}

/** Pure and immutable. Every active condition must hold for the SAME market row; groups with no rows are dropped. */
export function filterDiscoveryGroups(groups: readonly KalshiDiscoveryGroup[], f: DiscoveryFilters, receivedAt: string): KalshiDiscoveryGroup[] {
  const query = f.q.trim().toLowerCase();
  const maxSpread = f.maxSpread === '' ? null : Number(f.maxSpread);
  const minSize = f.minSize === '' ? null : Number(f.minSize);
  let lo = 0, hi = 0;
  if (f.closing !== '') {
    if (!isIsoTimestamp(receivedAt)) return [];
    lo = Date.parse(receivedAt);
    hi = lo + CLOSING_MS[f.closing];
  }
  const hit = (vals: (string | null | undefined)[]) => vals.some(s => typeof s === 'string' && s.toLowerCase().includes(query));
  const out: KalshiDiscoveryGroup[] = [];
  for (const g of groups) {
    const e = g.event;
    if (f.category !== '' && (e?.category ?? null) !== f.category) continue;
    const metaHit = query === '' || hit([e?.title, e?.subTitle, e?.seriesTicker, e?.category, g.eventTicker]);
    const markets = g.markets.filter(m => {
      if (!metaHit && !hit([m.title, m.yesLabel, m.ticker])) return false;
      if (maxSpread !== null || minSize !== null) {
        // Financial filters need a coherent two-sided quote; missing, one-sided or crossed rows never pass.
        const qq = analyzeKalshiQuotes(m);
        if (qq.status !== 'two_sided' || qq.spreadCents === null) return false;
        if (maxSpread !== null && qq.spreadCents > maxSpread) return false;
        if (minSize !== null && !((qq.bidSize ?? 0) >= minSize && (qq.askSize ?? 0) >= minSize)) return false;
      }
      if (f.closing !== '') {
        if (!isIsoTimestamp(m.closeTime)) return false; // unknown close time is excluded, never treated as soon
        const t = Date.parse(m.closeTime);
        if (!(t > lo && t <= hi)) return false;
      }
      return true;
    });
    if (markets.length === 0) continue;
    out.push(markets.length === g.markets.length ? g : { ...g, markets });
  }
  return out;
}
