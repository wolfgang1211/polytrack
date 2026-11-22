/* Data shaping for the /polymarket-lp-rewards answer page. Pure: no fetching, fully testable. */
import type { MarketMeta, RewardUniverse } from '@/lib/rewardsUniverse';

export const LP_REWARDS_TOP_N = 50;
/** Second table: markets that stay open for more than this many days after the snapshot. */
export const LP_REWARDS_LONG_TERM_DAYS = 7;
export const LP_REWARDS_LONG_TERM_N = 25;
/** How far down the ranked list we look for long-term markets (metadata is fetched in batches). */
export const LP_REWARDS_LONG_TERM_MAX_CHECK = 1000;
export const LP_REWARDS_META_BATCH = 50;
/** Shown to visitors when the rendered snapshot is older than this. */
export const LP_REWARDS_STALE_MINUTES = 60;
/** Polymarket does not pay out daily amounts below $1, so smaller pools are not real opportunities. */
export const LP_REWARDS_MIN_DAILY = 1;

export interface LpRewardsRow {
  rank: number;
  conditionId: string;
  question: string | null;    // null when Polymarket metadata could not be loaded
  slug: string;
  eventSlug?: string;
  dailyRate: number;
  maxSpread: number | null;
  minSize: number | null;
  liquidity: number | null;
  endDate: string | null;
  gameStart: string | null;
}

export type LpRewardsSnapshot =
  | { status: 'unavailable'; generatedAt: string }
  | { status: 'empty'; generatedAt: string; universe: number }
  | {
      status: 'ok';
      generatedAt: string;
      complete: boolean;
      universe: number;       // markets with any active pool
      marketCount: number;    // markets with a pool of at least $1/day
      totalDaily: number;
      top10Daily: number;
      rows: LpRewardsRow[];
      summary: string;
      longTerm: { rows: LpRewardsRow[]; checked: number; capped: boolean };
    };

/** Open for more than 7 days after the snapshot. Games (kick-off driven) and markets without a known end date never count. */
export function isLongTerm(info: Pick<MarketMeta, 'endDate' | 'gameStart'> | undefined, snapshotIso: string): boolean {
  if (!info || info.gameStart || !info.endDate) return false;
  const end = new Date(info.endDate).getTime();
  const now = new Date(snapshotIso).getTime();
  return Number.isFinite(end) && Number.isFinite(now) && end - now > LP_REWARDS_LONG_TERM_DAYS * 86_400_000;
}

/** Ids after the main table, in ranked order, chunked for metadata requests; capped at LP_REWARDS_LONG_TERM_MAX_CHECK. */
export function longTermCandidateBatches(rankedIds: string[], batchSize = LP_REWARDS_META_BATCH): string[][] {
  const pool = rankedIds.slice(LP_REWARDS_TOP_N, LP_REWARDS_TOP_N + LP_REWARDS_LONG_TERM_MAX_CHECK);
  const out: string[][] = [];
  for (let i = 0; i < pool.length; i += batchSize) out.push(pool.slice(i, i + batchSize));
  return out;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "22 Nov 2026, 17:45 UTC": deterministic, independent of server/browser locale and time zone. */
export function formatUtc(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`;
}

/** "$1,250" for >= $100 or whole amounts, "$12.50" otherwise. */
export function formatUsd(n: number): string {
  const digits = Math.abs(n) >= 100 || Number.isInteger(n) ? 0 : 2;
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

const relative = (h: number) => (h < 1 ? '<1h' : h < 48 ? `${Math.floor(h)}h` : `${Math.floor(h / 24)}d`);

/**
 * Timing relative to the snapshot. Games: "Starts in 2h" / "Game started" (Polymarket's end date for a game is its kick-off).
 * Other markets: "in 5h", "in 3d", a date beyond 30 days, or "Awaiting resolution" once the end date has passed.
 */
export function closesLabel(endIso: string | null, snapshotIso: string, gameStartIso: string | null = null): string {
  const now = new Date(snapshotIso).getTime();
  if (!Number.isFinite(now)) return '\u2014';
  if (gameStartIso) {
    const start = new Date(gameStartIso).getTime();
    if (Number.isFinite(start)) {
      const h = (start - now) / 3_600_000;
      return h <= 0 ? 'Game started' : `Starts in ${relative(h)}`;
    }
  }
  if (!endIso) return '\u2014';
  const end = new Date(endIso).getTime();
  if (!Number.isFinite(end)) return '\u2014';
  const h = (end - now) / 3_600_000;
  if (h < 0) return 'Awaiting resolution';
  if (h < 24 * 30) return `in ${relative(h)}`;
  return new Date(end).toISOString().slice(0, 10);
}

export function buildLpRewardsSnapshot(
  universe: RewardUniverse | null,
  meta: Map<string, MarketMeta>,
  generatedAt: Date,
  longTermScan?: { checked: number; capped: boolean },
): LpRewardsSnapshot {
  const at = generatedAt.toISOString();
  if (!universe || universe.pages === 0) return { status: 'unavailable', generatedAt: at };
  const paying = universe.markets.filter(m => Number.isFinite(m.dailyRate) && m.dailyRate >= LP_REWARDS_MIN_DAILY);
  if (!paying.length) return { status: 'empty', generatedAt: at, universe: universe.markets.length };

  const sorted = [...paying].sort((a, b) => b.dailyRate - a.dailyRate || a.conditionId.localeCompare(b.conditionId));
  const toRow = (m: (typeof sorted)[number], i: number): LpRewardsRow => {
    const info = meta.get(m.conditionId);
    return {
      rank: i + 1,
      conditionId: m.conditionId,
      question: info?.question ?? null,
      slug: info?.slug ?? '',
      eventSlug: info?.eventSlug,
      dailyRate: m.dailyRate,
      maxSpread: m.maxSpread,
      minSize: m.minSize,
      liquidity: info?.liquidity ?? null,
      endDate: info?.endDate ?? null,
      gameStart: info?.gameStart ?? null,
    };
  };
  const rows = sorted.slice(0, LP_REWARDS_TOP_N).map(toRow);
  const longTermRows = sorted.filter(m => isLongTerm(meta.get(m.conditionId), at)).slice(0, LP_REWARDS_LONG_TERM_N).map(toRow);
  const longTerm = {
    rows: longTermRows,
    checked: longTermScan?.checked ?? sorted.filter(m => meta.has(m.conditionId)).length,
    capped: longTermScan?.capped ?? false,
  };
  const totalDaily = sorted.reduce((s, m) => s + m.dailyRate, 0);
  const top10Daily = sorted.slice(0, 10).reduce((s, m) => s + m.dailyRate, 0);
  const n = sorted.length;
  const first = rows[0];
  const lead = universe.complete ? '' : 'Partial data: ';
  const atLeast = universe.complete ? '' : 'at least ';
  const firstName = first.question ? ` on "${first.question}"` : '';
  const summary =
    `${lead}As of ${formatUtc(at)}, Polymarket offers liquidity rewards of $1 per day or more on ${atLeast}${n.toLocaleString('en-US')} market${n === 1 ? '' : 's'}, `
    + `worth ${atLeast}${formatUsd(totalDaily)} per day in total. `
    + `The largest pool is ${formatUsd(first.dailyRate)} per day${firstName}`
    + (n > 1 ? `; the top ${Math.min(10, n)} pools total ${formatUsd(top10Daily)} per day.` : '.');
  return { status: 'ok', generatedAt: at, complete: universe.complete, universe: universe.markets.length, marketCount: n, totalDaily, top10Daily, rows, summary, longTerm };
}

export interface FaqItem { q: string; a: string }

export const LP_REWARDS_FAQ: FaqItem[] = [
  {
    q: 'How do Polymarket liquidity rewards work?',
    a: 'Makers who post resting limit orders are automatically eligible. Each incentivized market sets a daily reward pool, a maximum qualifying spread from the midpoint and a minimum qualifying order size. Orders closer to the midpoint score higher, two-sided quotes are favored, and the pool is split by each maker’s share of the total score.',
  },
  {
    q: 'When are Polymarket liquidity rewards paid?',
    a: 'Polymarket distributes liquidity rewards directly to maker addresses once a day at midnight UTC. Daily amounts below the $1 minimum payout are not paid.',
  },
  {
    q: 'What do max spread and min size mean?',
    a: 'Max spread is the farthest an order can sit from the market midpoint, in cents, and still earn rewards. Min size is the smallest order, in shares, that counts. Both are set per market by Polymarket.',
  },
  {
    q: 'Will I earn the daily reward shown in the table?',
    a: 'No. The daily reward is the whole pool for that market, shared among every qualifying maker. Your share depends on your size, how close your quotes are to the midpoint, how long they rest and how much competing liquidity there is.',
  },
  {
    q: 'Is providing liquidity on Polymarket risk-free?',
    a: 'No. Makers carry inventory risk when prices move against filled orders, adverse selection from better-informed traders, market resolution risk and the risk that reward parameters change. This page is information, not financial advice.',
  },
  {
    q: 'How often is this page updated?',
    a: 'The page is rebuilt from Polymarket’s public market data about every 15 minutes. The time of the snapshot is shown at the top; figures can lag Polymarket by a few minutes.',
  },
];
