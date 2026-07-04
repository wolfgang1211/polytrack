import { NextRequest, NextResponse } from 'next/server';
import { fetchMarketsList } from '@/lib/markets';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const sortKey = sp.get('sort') ?? 'vol24h';
  const limit = Number(sp.get('limit') ?? 120) || 120;

  try {
    const markets = await fetchMarketsList(sortKey, limit);
    return NextResponse.json(markets, {
      headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    const status = /^HTTP (\d+)$/.test(msg) ? Number(msg.slice(5)) : 500;
    return NextResponse.json({ error: msg || 'Failed to fetch markets' }, { status });
  }
}
// Shared fetch logic lives in src/lib/markets.ts (also used by the /markets server component).
