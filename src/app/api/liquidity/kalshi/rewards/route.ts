import { kalshiErrorResponse } from '@/lib/kalshi';
import { readKalshiRewards } from '@/lib/kalshiRewardsCache';

// Kalshi liquidity incentive programs as reward farms (cached 5 min). Mirrors /api/liquidity/rewards.
export const maxDuration = 60;

export async function GET() {
  try {
    const scan = await readKalshiRewards();
    return Response.json(scan, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
  } catch (e) {
    return kalshiErrorResponse(e);
  }
}
