import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { RecentTrade } from '@/types';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Accept: 'application/json',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tsOf(t: any): number {
  return Number(t.timestamp ?? t.createdAt ?? 0);
}

// Full(ish) trade history for a wallet — powers the activity/behaviour analytics
// (trades-by-hour, hold time, outcome bias, heatmap). Paginates the data-api
// trades endpoint up to a sane cap so charts have enough sample to be meaningful.
export async function GET(
  _req: NextRequest,
  ctx: RouteContext<'/api/wallet/[address]/activity'>
) {
  const { address } = await ctx.params;

  const PAGE = 500;
  const MAX_PAGES = 4;   // up to 2,000 trades

  try {
    const trades: RecentTrade[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const res = await fetch(
        `https://data-api.polymarket.com/trades?user=${address}&limit=${PAGE}&offset=${page * PAGE}`,
        { headers: HEADERS, next: { revalidate: 120 } }
      ).catch(() => null);
      if (!res || !res.ok) break;
      const json = await res.json();
      const batch: RecentTrade[] = Array.isArray(json) ? json : (json.value ?? json.data ?? []);
      if (!batch.length) break;
      trades.push(...batch);
      if (batch.length < PAGE) break;
    }

    trades.sort((a, b) => tsOf(b) - tsOf(a));

    return NextResponse.json(
      { trades, count: trades.length },
      { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' } }
    );
  } catch {
    return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 });
  }
}
