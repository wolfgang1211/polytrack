import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { dataFailure, isWallet, PublicDataUnavailable, readTrades } from '@/lib/publicDataApi';

const MAX_PAGES = 20;

export async function GET(req: NextRequest, ctx: RouteContext<'/api/wallet/[address]/activity'>) {
  const { address } = await ctx.params;
  if (!isWallet(address)) return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  try {
    const trades = [];
    const signal = AbortSignal.any([req.signal, AbortSignal.timeout(12_000)]);
    const end = Math.floor(Date.now() / 1000);
    const seen = new Set<string>();
    let cursor: string | null = null;
    let truncated = false;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const params = new URLSearchParams({ user: address, start: '1', end: String(end), limit: '1000', taker_only: 'false', filter_type: 'TOKENS', filter_amount: '0.000001' });
      if (cursor) params.set('cursor', cursor);
      const result = await readTrades(params, signal);
      for (const trade of result.data) {
        if (trade.proxyWallet.toLowerCase() !== address.toLowerCase() || trade.timestamp < 1 || trade.timestamp > end) throw new PublicDataUnavailable();
        trades.push(trade);
      }
      if (!result.truncated) break;
      if (!result.nextCursor || seen.has(result.nextCursor)) throw new PublicDataUnavailable();
      seen.add(result.nextCursor); cursor = result.nextCursor;
      if (page === MAX_PAGES - 1) truncated = true;
    }
    trades.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
    return NextResponse.json({ trades, count: trades.length, truncated }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return dataFailure(error);
  }
}
