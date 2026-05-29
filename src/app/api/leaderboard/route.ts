import { NextRequest, NextResponse } from 'next/server';

// Map internal TimeWindow values → Polymarket API values
const PERIOD_MAP: Record<string, string> = {
  allTime: 'ALL',
  '1d':    'DAY',
  '1w':    'WEEK',
  '1m':    'MONTH',
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const timeWindow = searchParams.get('window') || 'allTime';
  // API max limit is 50
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 50);

  const timePeriod = PERIOD_MAP[timeWindow] ?? 'ALL';

  try {
    const res = await fetch(
      `https://data-api.polymarket.com/v1/leaderboard?timePeriod=${timePeriod}&limit=${limit}`,
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
    const data = Array.isArray(json) ? json : (json.value ?? []);

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
  }
}
