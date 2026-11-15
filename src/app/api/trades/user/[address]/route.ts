import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { dataFailure, isWallet, PublicDataUnavailable, readTrades } from '@/lib/publicDataApi';

const THIRTY_DAYS = 30 * 24 * 60 * 60;
const MAX_PAGES = 20;

export async function GET(req: NextRequest, ctx: RouteContext<'/api/trades/user/[address]'>) {
  const { address } = await ctx.params;
  if (!isWallet(address)) return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  try {
    const cutoff = Math.floor(Date.now() / 1000) - THIRTY_DAYS;
    const end = Math.floor(Date.now() / 1000);
    const rows = [];
    const signal = AbortSignal.any([req.signal, AbortSignal.timeout(12_000)]);
    let cursor: string | null = null;
    const seen = new Set<string>();
    let truncated = false;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const params = new URLSearchParams({ user: address, start: String(cutoff), end: String(end), limit: '200', taker_only: 'false', filter_type: 'TOKENS', filter_amount: '0.000001' });
      if (cursor) params.set('cursor', cursor);
      const result = await readTrades(params, signal);
      for (const trade of result.data) {
        if (trade.proxyWallet.toLowerCase() !== address.toLowerCase() || trade.timestamp < cutoff || trade.timestamp > end) throw new PublicDataUnavailable();
        rows.push(trade);
      }
      if (!result.truncated) break;
      if (!result.nextCursor || seen.has(result.nextCursor)) throw new PublicDataUnavailable();
      seen.add(result.nextCursor); cursor = result.nextCursor;
      if (page === MAX_PAGES - 1) truncated = true;
    }
    const sorted = rows.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
    const recent = sorted.filter(t => (t.timestamp ?? 0) >= cutoff);
    const out = (recent.length > 0 ? recent : sorted).slice(0, 25);
    return NextResponse.json({ trades: out, stale: recent.length === 0 && out.length > 0, truncated: truncated || sorted.length > out.length }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return dataFailure(error);
  }
}
