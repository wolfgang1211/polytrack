import type { NextRequest } from 'next/server';
import { SHORT_CACHE, assertTicker, kalshiErrorResponse } from '@/lib/kalshi';
import { fetchKalshiEvent } from '@/lib/kalshiEvents';

// Read-only event metadata (exclude_markets=true); the response event_ticker must literally match the requested one.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ eventTicker: string }> }) {
  try {
    const eventTicker = assertTicker((await ctx.params).eventTicker);
    return Response.json(await fetchKalshiEvent(eventTicker), { headers: SHORT_CACHE });
  } catch (e) {
    return kalshiErrorResponse(e);
  }
}
