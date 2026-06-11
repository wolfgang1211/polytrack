import { NextResponse } from 'next/server';
import { fetchWinnerData } from '@/lib/wcData';

export async function GET() {
  const data = await fetchWinnerData(); // no-store; CDN caches below
  if (!data) {
    return NextResponse.json({ error: 'Failed to fetch World Cup winner odds' }, { status: 502 });
  }
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
  });
}
