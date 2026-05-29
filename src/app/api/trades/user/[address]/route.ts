import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Accept: 'application/json',
};

const THIRTY_DAYS = 30 * 24 * 60 * 60;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tsOf(t: any): number {
  return Number(t.timestamp ?? t.createdAt ?? 0);
}

// Latest on-chain trades for a single wallet — powers the "Latest Moves" copy-trade feed.
export async function GET(
  _req: NextRequest,
  ctx: RouteContext<'/api/trades/user/[address]'>
) {
  const { address } = await ctx.params;

  try {
    const res = await fetch(
      `https://data-api.polymarket.com/trades?user=${address}&limit=200`,
      { headers: HEADERS, cache: 'no-store' }
    );
    if (!res.ok) return NextResponse.json({ error: `HTTP ${res.status}` }, { status: res.status });

    const json = await res.json();
    const raw: unknown[] = Array.isArray(json) ? json : (json.value ?? json.data ?? []);

    const cutoff = Math.floor(Date.now() / 1000) - THIRTY_DAYS;

    // newest first
    const sorted = [...raw].sort((a, b) => tsOf(b) - tsOf(a));

    // last 30 days; if the wallet has been inactive, fall back to its most recent trades
    const recent = sorted.filter((t) => tsOf(t) >= cutoff);
    const out = (recent.length > 0 ? recent : sorted).slice(0, 25);

    return NextResponse.json(
      { trades: out, stale: recent.length === 0 && out.length > 0 },
      { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' } }
    );
  } catch {
    return NextResponse.json({ error: 'Failed to fetch trades' }, { status: 500 });
  }
}
