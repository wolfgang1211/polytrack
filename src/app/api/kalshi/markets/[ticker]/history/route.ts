import type { NextRequest } from 'next/server';
import { KalshiError, NO_STORE, assertTicker, fetchKalshiMarket, kalshiErrorResponse } from '@/lib/kalshi';
import { fetchKalshiHistory, parseHistoryQuery } from '@/lib/kalshiHistory';

// Read-only price history + recent trades. Ticker and query are validated before any upstream request;
// market metadata is verified (exists, literal ticker, binary $1) before history is fetched.
export async function GET(req: NextRequest, ctx: { params: Promise<{ ticker: string }> }) {
  try {
    const ticker = assertTicker((await ctx.params).ticker);
    const range = parseHistoryQuery(new URL(req.url).searchParams);
    const { market } = await fetchKalshiMarket(ticker);
    // fetchKalshiHistory throws 422 for unsupported markets before any history request.
    return Response.json(await fetchKalshiHistory(market, range), { headers: NO_STORE });
  } catch (e) {
    if (e instanceof KalshiError && e.status === 422) {
      return Response.json({ error: 'Price history is supported only for binary $1 markets.' }, { status: 422, headers: NO_STORE });
    }
    return kalshiErrorResponse(e);
  }
}
