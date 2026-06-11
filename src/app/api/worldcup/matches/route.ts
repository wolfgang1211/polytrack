import { NextResponse } from 'next/server';
import { fetchWcEvents } from '@/lib/wcData';

export async function GET() {
  const events = await fetchWcEvents(); // no-store; CDN caches below
  return NextResponse.json(events, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
  });
}
