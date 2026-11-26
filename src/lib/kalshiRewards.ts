/* Kalshi liquidity incentive programs as reward farms, mirroring the Polymarket screener (src/lib/rewards.ts).
   Programs: GET /incentive_programs?status=active&type=liquidity (public, no key). One program = one market, with a
   period reward (centi-cents, per period), a Target Size (contracts per side) and a Discount Factor (bps).
   Markets: GET /markets?tickers=… (public) for title, quotes, sizes, 24h price change and close time.
   Every figure here is either a program number or derived from public quotes; estimates are labelled as such. */
import { getKalshiJson, KalshiError } from '@/lib/kalshi';

type JsonGetter = (path: string, query?: Record<string, string>) => Promise<unknown>;

export const DEFAULT_CAPITAL = 1_000;          // $ of quoting capital the estimates assume, split across both sides
export const TOP_FARMS = 30;                   // rows returned, like the Polymarket screener
const TICKER_BATCH = 100;
const MARKET_CONCURRENCY = 4;
const RETRIES = 3;
const MAX_PROGRAM_PAGES = 10;
const DAY_MS = 86_400_000;

export interface KalshiRewardFarm {
  ticker: string;
  eventTicker: string;
  seriesTicker: string;
  question: string;
  volume24hContracts: number;
  liquidity: number;            // $ resting at the best Yes bid + best No bid (top of book)
  spread: number;               // yes ask − yes bid (fraction)
  dailyRate: number;            // $ per day = period reward ÷ period length in days
  periodReward: number;         // $ per program period
  periodDays: number;
  targetSize: number | null;    // contracts per side that a snapshot must reach
  discountFactor: number | null; // 0–1; lower = steeper penalty away from the reference price
  estDailyReward: number;       // est. $/day for $1K split across both sides (see estimateShare)
  estApr: number;
  endDate: string | null;       // market close time
  daysToResolve: number | null;
  competition: 'Low' | 'Medium' | 'High';
  rewardStart: string;
  rewardEnd: string;
  isNew: boolean;
  endsSoon: boolean;
  priceVol: number;
  stability: 'A' | 'B' | 'C' | 'D';
  riskAdjApr: number;
}

export interface KalshiRewardsScan {
  farms: KalshiRewardFarm[];
  totalDailyRewards: number;    // over every active liquidity program, priced or not
  marketsWithRewards: number;   // active liquidity programs (one per market)
  scanned: number;              // programs whose market had a usable two-sided quote
  complete: boolean;            // false when some market batches could not be fetched
  receivedAt: string;
}

interface Program {
  ticker: string; eventTicker: string; seriesTicker: string;
  periodReward: number; start: string; end: string; targetSize: number | null; discountFactor: number | null;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const iso = (v: unknown): string | null => (typeof v === 'string' && Number.isFinite(Date.parse(v)) ? v : null);
const sleep = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));

export function parseProgram(raw: unknown): Program | null {
  if (!isObj(raw) || raw.incentive_type !== 'liquidity') return null;
  const ticker = typeof raw.market_ticker === 'string' ? raw.market_ticker : '';
  const reward = num(raw.period_reward);
  const start = iso(raw.start_date);
  const end = iso(raw.end_date);
  if (!ticker || reward === null || reward <= 0 || !start || !end || Date.parse(end) <= Date.parse(start)) return null;
  const ts = num(raw.target_size_fp);
  const df = num(raw.discount_factor_bps);
  return {
    ticker,
    eventTicker: typeof raw.event_ticker === 'string' ? raw.event_ticker : '',
    seriesTicker: typeof raw.series_ticker === 'string' ? raw.series_ticker : '',
    periodReward: reward / 10_000, // centi-cents → dollars
    start, end,
    targetSize: ts !== null && ts > 0 ? ts : null,
    discountFactor: df !== null && df >= 0 ? df / 10_000 : null,
  };
}

/** Share of one side's pool for `contracts` resting at the reference price, when the book already fills
    max(Target Size, size at best) — the cap Kalshi scores up to. */
export function sideShare(contracts: number, targetSize: number | null, sizeAtBest: number): number {
  if (!(contracts > 0)) return 0;
  const competing = Math.max(targetSize ?? 0, sizeAtBest, 0);
  return contracts / (competing + contracts);
}

/** $1K split evenly: half buys Yes at the best Yes bid, half buys No at the best No bid (1 − yes ask). */
export function estimateDailyReward(dailyRate: number, q: { yesBid: number; yesAsk: number; yesBidSize: number; yesAskSize: number }, targetSize: number | null, capital = DEFAULT_CAPITAL): number {
  const half = capital / 2;
  const yesContracts = q.yesBid > 0 ? half / q.yesBid : 0;
  const noPrice = 1 - q.yesAsk;
  const noContracts = noPrice > 0 ? half / noPrice : 0;
  const share = (sideShare(yesContracts, targetSize, q.yesBidSize) + sideShare(noContracts, targetSize, q.yesAskSize)) / 2;
  return dailyRate * share;
}

export function buildFarm(p: Program, m: Record<string, unknown>, now: number): KalshiRewardFarm | null {
  if (m.market_type !== 'binary' || num(m.notional_value_dollars) !== 1 || m.status !== 'active') return null;
  const yesBid = num(m.yes_bid_dollars), yesAsk = num(m.yes_ask_dollars);
  const yesBidSize = num(m.yes_bid_size_fp) ?? 0, yesAskSize = num(m.yes_ask_size_fp) ?? 0;
  if (yesBid === null || yesAsk === null || !(yesBid > 0) || !(yesAsk < 1) || yesAsk < yesBid) return null;

  const startT = Date.parse(p.start), endT = Date.parse(p.end);
  const periodDays = Math.max((endT - startT) / DAY_MS, 1 / 24);
  const dailyRate = p.periodReward / periodDays;
  const liquidity = yesBidSize * yesBid + yesAskSize * (1 - yesAsk);
  const estDailyReward = estimateDailyReward(dailyRate, { yesBid, yesAsk, yesBidSize, yesAskSize }, p.targetSize);
  const estApr = (estDailyReward * 365 / DEFAULT_CAPITAL) * 100;

  const close = iso(m.close_time);
  const closeT = close ? Date.parse(close) : NaN;
  const daysToResolve = close ? Math.max(0, Math.ceil((closeT - now) / DAY_MS)) : null;

  // Same thresholds as the Polymarket screener: pool $/day per $ of competing liquidity. On Kalshi the competing
  // size per side is what scoring counts: max(Target Size, size already at the best bid), priced at that bid.
  const ts = p.targetSize ?? 0;
  const competingDollars = Math.max(ts, yesBidSize) * yesBid + Math.max(ts, yesAskSize) * (1 - yesAsk);
  const ratePerLiq = competingDollars > 0 ? dailyRate / competingDollars : 1;
  const competition: KalshiRewardFarm['competition'] = ratePerLiq >= 0.002 ? 'Low' : ratePerLiq >= 0.0005 ? 'Medium' : 'High';

  // 24h move of the last price relative to mid (Kalshi publishes last and previous-day prices).
  const mid = (yesBid + yesAsk) / 2;
  const last = num(m.last_price_dollars), prev = num(m.previous_price_dollars);
  const priceVol = last !== null && prev !== null && prev > 0 && mid > 0 ? Math.min(100, (Math.abs(last - prev) / mid) * 100) : 0;
  const stability: KalshiRewardFarm['stability'] = priceVol < 2 ? 'A' : priceVol < 5 ? 'B' : priceVol < 12 ? 'C' : 'D';
  const riskAdjApr = estApr * { A: 1, B: 0.85, C: 0.6, D: 0.3 }[stability];

  return {
    ticker: p.ticker,
    eventTicker: p.eventTicker || (typeof m.event_ticker === 'string' ? m.event_ticker : ''),
    seriesTicker: p.seriesTicker,
    question: (typeof m.title === 'string' && m.title) || p.ticker,
    volume24hContracts: num(m.volume_24h_fp) ?? 0,
    liquidity,
    spread: yesAsk - yesBid,
    dailyRate,
    periodReward: p.periodReward,
    periodDays,
    targetSize: p.targetSize,
    discountFactor: p.discountFactor,
    estDailyReward,
    estApr,
    endDate: close,
    daysToResolve,
    competition,
    rewardStart: p.start,
    rewardEnd: p.end,
    isNew: now - startT < 7 * DAY_MS,
    endsSoon: endT - now < 7 * DAY_MS || (Number.isFinite(closeT) && closeT - now < 7 * DAY_MS),
    priceVol,
    stability,
    riskAdjApr,
  };
}

async function withRetry<T>(fn: () => Promise<T>, wait: (ms: number) => Promise<void>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await fn(); } catch (e) {
      if (attempt >= RETRIES || !(e instanceof KalshiError) || (e.status !== 503 && e.status !== 504)) throw e;
      await wait(1000 * 2 ** attempt);
    }
  }
}

export async function fetchActivePrograms(getJson: JsonGetter = getKalshiJson, wait = sleep): Promise<Program[]> {
  const out: Program[] = [];
  let cursor = '';
  for (let page = 0; page < MAX_PROGRAM_PAGES; page++) {
    const q: Record<string, string> = { status: 'active', type: 'liquidity', limit: '10000' };
    if (cursor) q.cursor = cursor;
    const body = await withRetry(() => getJson('/incentive_programs', q), wait);
    if (!isObj(body) || !Array.isArray(body.incentive_programs)) throw new KalshiError(502, 'malformed incentive programs');
    for (const raw of body.incentive_programs) { const p = parseProgram(raw); if (p) out.push(p); }
    const next = typeof body.next_cursor === 'string' ? body.next_cursor : '';
    if (!next || next === cursor) break;
    cursor = next;
  }
  return out;
}

export async function scanKalshiRewardFarms(opts: { getJson?: JsonGetter; wait?: (ms: number) => Promise<void>; now?: () => number } = {}): Promise<KalshiRewardsScan> {
  const getJson = opts.getJson ?? getKalshiJson;
  const wait = opts.wait ?? sleep;
  const now = (opts.now ?? Date.now)();

  const all = await fetchActivePrograms(getJson, wait);
  // One program per market is the norm; if a market has several, Kalshi pays only the highest, so keep that one.
  const byTicker = new Map<string, Program>();
  for (const p of all) {
    const prev = byTicker.get(p.ticker);
    if (!prev || p.periodReward > prev.periodReward) byTicker.set(p.ticker, p);
  }
  const programs = [...byTicker.values()];
  const totalDailyRewards = programs.reduce((s, p) => s + p.periodReward / Math.max((Date.parse(p.end) - Date.parse(p.start)) / DAY_MS, 1 / 24), 0);

  const batches: string[][] = [];
  for (let i = 0; i < programs.length; i += TICKER_BATCH) batches.push(programs.slice(i, i + TICKER_BATCH).map(p => p.ticker));
  const markets = new Map<string, Record<string, unknown>>();
  let failed = 0;
  let next = 0;
  const worker = async () => {
    while (next < batches.length) {
      const batch = batches[next++];
      try {
        const body = await withRetry(() => getJson('/markets', { tickers: batch.join(','), limit: '1000' }), wait);
        if (isObj(body) && Array.isArray(body.markets)) {
          for (const m of body.markets) if (isObj(m) && typeof m.ticker === 'string') markets.set(m.ticker, m);
        } else failed++;
      } catch { failed++; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(MARKET_CONCURRENCY, batches.length) }, worker));
  if (batches.length > 0 && failed === batches.length) throw new KalshiError(502, 'Kalshi market data unavailable');

  const farms: KalshiRewardFarm[] = [];
  for (const p of programs) {
    const m = markets.get(p.ticker);
    const f = m ? buildFarm(p, m, now) : null;
    if (f) farms.push(f);
  }
  farms.sort((a, b) => b.riskAdjApr - a.riskAdjApr);
  return {
    farms: farms.slice(0, TOP_FARMS),
    totalDailyRewards,
    marketsWithRewards: programs.length,
    scanned: farms.length,
    complete: failed === 0,
    receivedAt: new Date(now).toISOString(),
  };
}
