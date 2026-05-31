import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Accept: 'application/json',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
};

// Global live trade feed for the Activity page — a large recent batch the
// client aggregates into the treemap, stats and trade table.
export async function GET() {
  try {
    const res = await fetch(
      `https://data-api.polymarket.com/trades?limit=500&takerOnly=false&_=${Date.now()}`,
      { headers: HEADERS, cache: 'no-store' }
    );
    if (!res.ok) return NextResponse.json({ error: `HTTP ${res.status}` }, { status: res.status });

    const json = await res.json();
    const raw: unknown[] = Array.isArray(json) ? json : (json.value ?? json.data ?? []);

    return NextResponse.json(
      { trades: raw, count: raw.length },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch {
    return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 });
  }
}
