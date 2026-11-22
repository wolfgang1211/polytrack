import type { NextRequest } from 'next/server';
import { SHORT_CACHE, assertTicker, fetchKalshiOrderbook, kalshiErrorResponse } from '@/lib/kalshi';

// Read-only order book. Market metadata is verified (exists, literal ticker, binary $1) before the book is fetched.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ ticker: string }> }) {
  try {
    const ticker = assertTicker((await ctx.params).ticker);
    return Response.json(await fetchKalshiOrderbook(ticker), { headers: SHORT_CACHE });
  } catch (e) {
    return kalshiErrorResponse(e);
  }
}
