import { KalshiError, kalshiErrorResponse } from '@/lib/kalshi';
import { getCachedKalshiTop } from '@/lib/kalshiTopCache';

// Full open-market scan ranked by 24h contract volume (cached 15 min). Takes no input.
export const maxDuration = 120;

export async function GET(req: Request) {
  try {
    if ([...new URL(req.url).searchParams.keys()].length > 0) throw new KalshiError(400, 'This endpoint does not accept query parameters.');
    const scan = await getCachedKalshiTop();
    return Response.json(scan, { headers: { 'Cache-Control': 'public, s-maxage=30' } });
  } catch (e) {
    return kalshiErrorResponse(e);
  }
}
