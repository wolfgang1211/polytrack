import { kalshiErrorResponse } from '@/lib/kalshi';
import { readKalshiRewards } from '@/lib/kalshiRewardsCache';
import { recordKalshiSnapshot } from '@/lib/kalshiSnapshots';

// Kalshi liquidity incentive programs as reward farms (cached 5 min). Mirrors /api/liquidity/rewards.
export const maxDuration = 60;

export async function GET() {
  try {
    const { snapshot, ...scan } = await readKalshiRewards();
    // Opportunistic history recording (rate-limited to one per 30 min inside; no-op without KV). Complete scans only.
    if (scan.complete) recordKalshiSnapshot({ programs: scan.marketsWithRewards, totalDaily: Math.round(scan.totalDailyRewards), markets: snapshot }).catch(() => {});
    return Response.json(scan, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
  } catch (e) {
    return kalshiErrorResponse(e);
  }
}
