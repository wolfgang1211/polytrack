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
  // Activity analytics (trades-by-hour, hold time, buy/sell ratio) need a
  // meaningful sample. Fetch up to 20,000 trades (40 pages) so high-volume
  // wallets get accurate behavioural stats. Natural early-exit when the API
  // returns a partial or empty page.
  const MAX_PAGES = 40;
  const BATCH = 10;

  try {
    const trades: RecentTrade[] = [];
    let stop = false;
    for (let start = 0; start < MAX_PAGES && !stop; start += BATCH) {
      const end = Math.min(start + BATCH, MAX_PAGES);
      const pages = Array.from({ length: end - start }, (_, j) => start + j);
      const results = await Promise.all(pages.map(p =>
        fetch(
          `https://data-api.polymarket.com/trades?user=${address}&limit=${PAGE}&offset=${p * PAGE}`,
          { headers: HEADERS, next: { revalidate: 3600 } }
        ).then(r => (r.ok ? r.json() : null)).catch(() => null)
      ));
      for (const json of results) {
        if (json === null || json === undefined) continue;
        const batch: RecentTrade[] = Array.isArray(json) ? json : (json.value ?? json.data ?? []);
        if (!batch.length) { stop = true; break; }
        trades.push(...batch);
        if (batch.length < PAGE) { stop = true; break; }
      }
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
