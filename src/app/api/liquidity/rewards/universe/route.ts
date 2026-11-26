import { unstable_cache } from 'next/cache';
import { fetchRewardUniverse } from '@/lib/rewardsUniverse';

/* Totals over EVERY Polymarket market with an active reward pool (CLOB rewards list, all pages), for the
   Polymarket vs Kalshi comparison. The reward screener itself only scans the top ~400 markets by liquidity/volume. */
export const maxDuration = 60;

export interface RewardUniverseSummary { totalDailyRewards: number; marketsWithRewards: number; complete: boolean; receivedAt: string }

const summary = unstable_cache(async (): Promise<RewardUniverseSummary | null> => {
  const u = await fetchRewardUniverse();
  if (!u) return null;
  if (!u.complete) throw new Error('partial Polymarket reward universe'); // keeps the last complete total cached
  return {
    totalDailyRewards: u.markets.reduce((s, m) => s + m.dailyRate, 0),
    marketsWithRewards: u.markets.length,
    complete: true,
    receivedAt: new Date().toISOString(),
  };
}, ['poly-reward-universe-v1'], { revalidate: 900, tags: ['poly-reward-universe'] });

export async function GET() {
  try {
    const s = await summary();
    if (!s) return Response.json({ error: 'Polymarket rewards list unavailable' }, { status: 502 });
    return Response.json(s, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=900' } });
  } catch {
    return Response.json({ error: 'Polymarket rewards list incomplete right now' }, { status: 503 });
  }
}
