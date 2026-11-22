import type { Metadata } from 'next';
import { fetchMarketMeta, fetchRewardUniverse } from '@/lib/rewardsUniverse';
import { buildLpRewardsSnapshot, LP_REWARDS_MIN_DAILY, LP_REWARDS_TOP_N } from '@/lib/lpRewardsPage';
import LpRewardsView from '@/app/polymarket-lp-rewards/LpRewardsView';

// Rebuilt in the background at most every 15 minutes (ISR); visitors and crawlers get full HTML without JavaScript.
export const revalidate = 900;

const TITLE = 'Polymarket Liquidity Rewards: Highest-Paying Markets (Updated)';
const DESCRIPTION = 'Every Polymarket market with an active liquidity-reward pool, ranked by daily reward: pool size, max spread, min size and close time, refreshed about every 15 minutes.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/polymarket-lp-rewards' },
  openGraph: { title: `${TITLE} | AlphaBoard`, description: DESCRIPTION, url: '/polymarket-lp-rewards' },
  twitter: { title: `${TITLE} | AlphaBoard`, description: DESCRIPTION },
};

/** Full scan + metadata for the rows shown. Outside the component so timing uses the clock freely. */
async function loadSnapshot() {
  const started = Date.now();
  const universe = await fetchRewardUniverse(); // null = Polymarket unreachable: rendered as "temporarily unavailable", never as zeros
  const topIds = (universe?.markets ?? [])
    .filter(m => m.dailyRate >= LP_REWARDS_MIN_DAILY)
    .sort((a, b) => b.dailyRate - a.dailyRate || a.conditionId.localeCompare(b.conditionId))
    .slice(0, LP_REWARDS_TOP_N)
    .map(m => m.conditionId);
  const meta = await fetchMarketMeta(topIds);
  // One line per (re)generation, visible in Vercel logs: how long the full scan took.
  console.info('[lp-rewards] snapshot', { pages: universe?.pages ?? 0, markets: universe?.markets.length ?? 0, complete: universe?.complete ?? false, meta: meta.size, ms: Date.now() - started });
  return buildLpRewardsSnapshot(universe, meta, new Date());
}

export default async function PolymarketLpRewardsPage() {
  return <LpRewardsView snapshot={await loadSnapshot()} />;
}
