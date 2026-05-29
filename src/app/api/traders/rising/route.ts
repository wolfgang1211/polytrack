import { NextResponse } from 'next/server';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Accept: 'application/json',
};

export async function GET() {
  try {
    const res = await fetch(
      'https://data-api.polymarket.com/v1/leaderboard?timePeriod=WEEK&limit=10',
      { headers: HEADERS, cache: 'no-store' }
    );
    if (!res.ok) return NextResponse.json({ error: `HTTP ${res.status}` }, { status: res.status });
    const json = await res.json();
    const data: unknown[] = Array.isArray(json) ? json : (json.value ?? []);
    // Sort by weekly PnL descending, take top 5
    const sorted = [...data]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .sort((a: any, b: any) => (b.pnl ?? 0) - (a.pnl ?? 0))
      .slice(0, 5);
    return NextResponse.json(sorted, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch rising traders' }, { status: 500 });
  }
}
