import { NextResponse } from 'next/server';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Accept: 'application/json',
};

export async function GET() {
  try {
    const res = await fetch(
      'https://gamma-api.polymarket.com/markets?active=true&closed=false&order=volume24hr&ascending=false&limit=5',
      { headers: HEADERS }
    );
    if (!res.ok) return NextResponse.json({ error: `HTTP ${res.status}` }, { status: res.status });
    const json = await res.json();
    const markets = Array.isArray(json) ? json : (json.value ?? json.markets ?? []);
    return NextResponse.json(markets.slice(0, 5), {
      headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch markets' }, { status: 500 });
  }
}
