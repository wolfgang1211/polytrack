import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Accept: 'application/json',
};

// Latest on-chain trades for a single wallet — powers the "Latest Moves" copy-trade feed.
export async function GET(
  _req: NextRequest,
  ctx: RouteContext<'/api/trades/user/[address]'>
) {
  const { address } = await ctx.params;

  try {
    const res = await fetch(
      `https://data-api.polymarket.com/trades?user=${address}&limit=30`,
      { headers: HEADERS, cache: 'no-store' }
    );
    if (!res.ok) return NextResponse.json({ error: `HTTP ${res.status}` }, { status: res.status });

    const json = await res.json();
    const raw: unknown[] = Array.isArray(json) ? json : (json.value ?? json.data ?? []);

    return NextResponse.json(raw.slice(0, 20), {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch trades' }, { status: 500 });
  }
}
