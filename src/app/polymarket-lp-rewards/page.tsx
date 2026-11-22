import type { Metadata } from 'next';
import { scanRewardFarms } from '@/lib/rewards';
import { buildLpRewardsSnapshot } from '@/lib/lpRewardsPage';
import LpRewardsView from '@/app/polymarket-lp-rewards/LpRewardsView';

// Rebuilt in the background at most every 15 minutes (ISR); visitors and crawlers get full HTML without JavaScript.
export const revalidate = 900;

const TITLE = 'Polymarket Liquidity Rewards: Highest-Paying Markets (Updated)';
const DESCRIPTION = 'Which Polymarket markets pay the most liquidity rewards right now: daily reward pools, max spread and min size, refreshed about every 15 minutes.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/polymarket-lp-rewards' },
  openGraph: { title: `${TITLE} | AlphaBoard`, description: DESCRIPTION, url: '/polymarket-lp-rewards' },
  twitter: { title: `${TITLE} | AlphaBoard`, description: DESCRIPTION },
};

export default async function PolymarketLpRewardsPage() {
  let data: Awaited<ReturnType<typeof scanRewardFarms>> | null = null;
  try {
    data = await scanRewardFarms();
  } catch {
    data = null; // rendered as "temporarily unavailable", never as zeros
  }
  return <LpRewardsView snapshot={buildLpRewardsSnapshot(data, new Date())} />;
}
