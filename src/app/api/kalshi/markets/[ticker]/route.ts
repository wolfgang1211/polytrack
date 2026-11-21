import type { NextRequest } from 'next/server';
import { SHORT_CACHE, assertTicker, fetchKalshiMarket, kalshiErrorResponse } from '@/lib/kalshi';

// Read-only market metadata; the response ticker must literally match the requested one.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ ticker: string }> }) {
  try {
    const ticker = assertTicker((await ctx.params).ticker);
    return Response.json(await fetchKalshiMarket(ticker), { headers: SHORT_CACHE });
  } catch (e) {
    return kalshiErrorResponse(e);
  }
}
