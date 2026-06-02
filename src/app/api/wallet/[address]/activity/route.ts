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

  // Same 3,500-trade hard ceiling as the timeline endpoint.
  const PAGE = 500;
  const MAX_OFFSET = 3000;
  const pageCount = MAX_OFFSET / PAGE + 1; // pages 0..6

  try {
    const results = await Promise.all(
      Array.from({ length: pageCount }, (_, p) =>
        fetch(
          `https://data-api.polymarket.com/trades?user=${address}&limit=${PAGE}&offset=${p * PAGE}`,
          { headers: HEADERS, next: { revalidate: 3600 } }
        ).then(r => r.ok ? r.json() : null).catch(() => null)
      )
    );

    const trades: RecentTrade[] = [];
    for (const json of results) {
      if (!json) continue;
      const batch: RecentTrade[] = Array.isArray(json) ? json : (json.value ?? json.data ?? []);
      trades.push(...batch);
    }

    trades.sort((a, b) => tsOf(b) - tsOf(a));

    return NextResponse.json(
      { trades, count: trades.length },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' } }
    );
  } catch {
    return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 });
  }
}
