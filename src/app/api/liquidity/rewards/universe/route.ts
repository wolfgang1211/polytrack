import { unstable_cache } from 'next/cache';
import { fetchRewardUniverse } from '@/lib/rewardsUniverse';

/* Totals over EVERY Polymarket market with an active reward pool (CLOB rewards list, all pages), for the
   Polymarket vs Kalshi comparison. The reward screener itself only scans the top ~400 markets by liquidity/volume. */
export const maxDuration = 60;

export interface RewardUniverseSummary {
  totalDailyRewards: number; marketsWithRewards: number; medianDailyRate: number; maxDailyRate: number; maxConditionId: string | null;
  complete: boolean; receivedAt: string;
}

const summary = unstable_cache(async (): Promise<RewardUniverseSummary | null> => {
  const u = await fetchRewardUniverse();
  if (!u) return null;
  if (!u.complete) throw new Error('partial Polymarket reward universe'); // keeps the last complete total cached
  const rates = u.markets.map(m => m.dailyRate).sort((a, b) => a - b);
  const top = u.markets.reduce<(typeof u.markets)[number] | null>((best, m) => (!best || m.dailyRate > best.dailyRate ? m : best), null);
  return {
    totalDailyRewards: u.markets.reduce((s, m) => s + m.dailyRate, 0),
    marketsWithRewards: u.markets.length,
    medianDailyRate: rates.length ? rates[Math.floor(rates.length / 2)] : 0,
    maxDailyRate: top?.dailyRate ?? 0,
    maxConditionId: top?.conditionId ?? null,
    complete: true,
    receivedAt: new Date().toISOString(),
  };
}, ['poly-reward-universe-v2'], { revalidate: 900, tags: ['poly-reward-universe'] });

export async function GET() {
  try {
    const s = await summary();
    if (!s) return Response.json({ error: 'Polymarket rewards list unavailable' }, { status: 502 });
    return Response.json(s, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=900' } });
  } catch {
    return Response.json({ error: 'Polymarket rewards list incomplete right now' }, { status: 503 });
  }
}
