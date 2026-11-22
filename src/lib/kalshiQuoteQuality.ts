/* Pure top-of-book quote quality for one Yes bid/ask pair. No fetch, state, cache, env or time.
   Thresholds are AlphaBoard display heuristics, NOT Kalshi rules. Prices are USD per $1 contract with the
   source's 4-decimal precision, so all arithmetic is done in integer ticks of 0.0001 (= 0.01¢). */

export const WIDE_SPREAD_CENTS = 10;
export const SMALL_DISPLAYED_SIZE_CONTRACTS = 100;

const TICKS_PER_DOLLAR = 10_000;
const TICKS_PER_CENT = 100;
const MAX_SPREAD_TICKS = TICKS_PER_DOLLAR - 2; // 0.0001 bid vs 0.9999 ask

export type KalshiQuoteStatus = 'two_sided' | 'bid_only' | 'ask_only' | 'unavailable' | 'crossed';
export type KalshiQuoteWarning = 'crossed' | 'no_quotes' | 'one_sided' | 'wide_spread' | 'small_displayed_size';

export interface KalshiQuoteInput { yesBid: unknown; yesAsk: unknown; yesBidSize: unknown; yesAskSize: unknown }
export interface KalshiQuoteQuality {
  status: KalshiQuoteStatus;
  bid: number | null;
  ask: number | null;
  bidSize: number | null;
  askSize: number | null;
  /** Only for a coherent two-sided quote (ask >= bid); locked = 0. */
  spreadCents: number | null;
  warnings: KalshiQuoteWarning[];
}

/** Integer ticks for a price strictly inside (0,1) at <=4dp; anything else (incl. finer precision) is null, never rounded. */
function priceTicks(p: unknown): number | null {
  if (typeof p !== 'number' || !Number.isFinite(p) || p <= 0 || p >= 1) return null;
  const t = Math.round(p * TICKS_PER_DOLLAR);
  return t / TICKS_PER_DOLLAR === p ? t : null;
}
const usableSize = (s: unknown): s is number => typeof s === 'number' && Number.isFinite(s) && s > 0;

/** A side counts only as a price+quantity pair; an incomplete side is null on both fields. */
function side(price: unknown, size: unknown) {
  const ticks = priceTicks(price);
  return ticks !== null && usableSize(size) ? { price: price as number, size, ticks } : null;
}

export function analyzeKalshiQuotes(q: KalshiQuoteInput): KalshiQuoteQuality {
  const bid = side(q.yesBid, q.yesBidSize);
  const ask = side(q.yesAsk, q.yesAskSize);
  const warnings: KalshiQuoteWarning[] = [];
  let status: KalshiQuoteStatus;
  let spreadCents: number | null = null;
  if (bid && ask) {
    const diff = ask.ticks - bid.ticks;
    if (diff < 0) {
      status = 'crossed';
      warnings.push('crossed');
    } else {
      status = 'two_sided';
      spreadCents = diff / TICKS_PER_CENT;
      if (diff >= WIDE_SPREAD_CENTS * TICKS_PER_CENT) warnings.push('wide_spread');
    }
  } else if (bid || ask) {
    status = bid ? 'bid_only' : 'ask_only';
    warnings.push('one_sided');
  } else {
    status = 'unavailable';
    warnings.push('no_quotes');
  }
  if ([bid, ask].some(s => s !== null && s.size < SMALL_DISPLAYED_SIZE_CONTRACTS)) warnings.push('small_displayed_size');
  return {
    status,
    bid: bid?.price ?? null,
    ask: ask?.price ?? null,
    bidSize: bid?.size ?? null,
    askSize: ask?.size ?? null,
    spreadCents,
    warnings,
  };
}

/** "2¢", "0.15¢", "0¢"; anything that is not a representable spread (negative, non-finite, non-number,
    finer than 0.01¢, beyond the 99.98¢ maximum) is "Unavailable". */
export function formatSpreadCents(v: unknown): string {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return 'Unavailable';
  const ticks = Math.round(v * TICKS_PER_CENT);
  if (ticks / TICKS_PER_CENT !== v || ticks > MAX_SPREAD_TICKS) return 'Unavailable';
  return `${(ticks / TICKS_PER_CENT).toFixed(2).replace(/\.?0+$/, '')}¢`;
}
