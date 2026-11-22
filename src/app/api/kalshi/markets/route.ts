import type { NextRequest } from 'next/server';
import { SHORT_CACHE, fetchKalshiMarkets, kalshiErrorResponse, parseListQuery } from '@/lib/kalshi';

// Read-only open Kalshi markets page. Query is validated before any upstream request.
export async function GET(req: NextRequest) {
  try {
    const query = parseListQuery(req.nextUrl.searchParams);
    return Response.json(await fetchKalshiMarkets(query), { headers: SHORT_CACHE });
  } catch (e) {
    return kalshiErrorResponse(e);
  }
}
