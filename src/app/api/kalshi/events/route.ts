import type { NextRequest } from 'next/server';
import { SHORT_CACHE, kalshiErrorResponse } from '@/lib/kalshi';
import { fetchKalshiEvents, parseEventListQuery } from '@/lib/kalshiEvents';

// Read-only open Kalshi events page (no nested markets). Query is validated before any upstream request.
export async function GET(req: NextRequest) {
  try {
    const query = parseEventListQuery(req.nextUrl.searchParams);
    return Response.json(await fetchKalshiEvents(query), { headers: SHORT_CACHE });
  } catch (e) {
    return kalshiErrorResponse(e);
  }
}
