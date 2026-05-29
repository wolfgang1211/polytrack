import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const timeWindow = searchParams.get('window') || 'allTime';
  const limit = searchParams.get('limit') || '100';

  try {
    const res = await fetch(
      `https://data-api.polymarket.com/v1/leaderboard?timePeriod=${timeWindow}&limit=${limit}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'application/json',
        },
        cache: 'no-store',
      }
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: `Upstream error: ${res.status}` },
        { status: res.status }
      );
    }

    const json = await res.json();
    // API returns { value: [...], Count: N }
    const data = Array.isArray(json) ? json : (json.value ?? []);

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
  }
}
