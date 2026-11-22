/* Data shaping for the /polymarket-lp-rewards answer page. Pure: no fetching, fully testable. */
import type { RewardFarm } from '@/lib/rewards';

export const LP_REWARDS_TOP_N = 20;
/** Shown to visitors when the rendered snapshot is older than this. */
export const LP_REWARDS_STALE_MINUTES = 60;
/** Polymarket does not pay out daily amounts below $1, so smaller pools are not real opportunities. */
export const LP_REWARDS_MIN_DAILY = 1;

export interface LpRewardsRow {
  rank: number;
  question: string;
  slug: string;
  eventSlug?: string;
  dailyRate: number;
  maxSpread: number | null;
  minSize: number | null;
  liquidity: number | null;
  rewardEnd: string | null;
}

export type LpRewardsSnapshot =
  | { status: 'unavailable'; generatedAt: string }
  | { status: 'empty'; generatedAt: string; scanned: number }
  | {
      status: 'ok';
      generatedAt: string;
      scanned: number;
      marketCount: number;
      totalDaily: number;
      top10Daily: number;
      rows: LpRewardsRow[];
      summary: string;
    };

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

/** Polymarket marks open-ended reward pools with a far-future end date (e.g. 2500-12-31). */
export function rewardEndLabel(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.getUTCFullYear() >= 2100 ? 'No end date' : d.toISOString().slice(0, 10);
}

const finiteOrNull = (n: unknown): number | null => (typeof n === 'number' && Number.isFinite(n) ? n : null);

export function buildLpRewardsSnapshot(
  input: { farms: RewardFarm[]; scanned: number } | null,
  generatedAt: Date,
): LpRewardsSnapshot {
  const at = generatedAt.toISOString();
  // A failed upstream fetch yields zero scanned markets: that is "no data", never "no rewards".
  if (!input || input.scanned <= 0) return { status: 'unavailable', generatedAt: at };
  const paying = input.farms.filter(f => Number.isFinite(f.dailyRate) && f.dailyRate >= LP_REWARDS_MIN_DAILY);
  if (!paying.length) return { status: 'empty', generatedAt: at, scanned: input.scanned };

  const sorted = [...paying].sort((a, b) => b.dailyRate - a.dailyRate);
  const rows: LpRewardsRow[] = sorted.slice(0, LP_REWARDS_TOP_N).map((f, i) => ({
    rank: i + 1,
    question: f.question,
    slug: f.slug,
    eventSlug: f.eventSlug,
    dailyRate: f.dailyRate,
    maxSpread: finiteOrNull(f.maxSpread),
    minSize: finiteOrNull(f.minSize),
    liquidity: finiteOrNull(f.liquidity) !== null && f.liquidity > 0 ? f.liquidity : null,
    rewardEnd: f.rewardEnd ?? null,
  }));
  const totalDaily = sorted.reduce((s, f) => s + f.dailyRate, 0);
  const top10Daily = sorted.slice(0, 10).reduce((s, f) => s + f.dailyRate, 0);
  const first = rows[0];
  const n = sorted.length;
  const summary =
    `As of ${formatUtc(at)}, the highest daily liquidity reward among the ${n} Polymarket reward market${n === 1 ? '' : 's'} AlphaBoard tracks is `
    + `${formatUsd(first.dailyRate)} per day on "${first.question}". `
    + (n > 1
      ? `The top ${Math.min(10, n)} markets offer ${formatUsd(top10Daily)} per day combined, and all ${n} tracked markets offer ${formatUsd(totalDaily)} per day.`
      : '');
  return { status: 'ok', generatedAt: at, scanned: input.scanned, marketCount: n, totalDaily, top10Daily, rows, summary: summary.trim() };
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
