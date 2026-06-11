import { NextResponse } from 'next/server';
import { fetchWcEvents } from '@/lib/wcData';

/** Match events that are live now or kicking off within ~26h.
    Short CDN cache so in-match odds stay fresh. */
export async function GET() {
  const events = await fetchWcEvents(); // no-store upstream
  const now = Date.now();

  const live = events.filter(e => {
    if (!e.isMatch || !e.gameStartTime) return false;
    const t = new Date(e.gameStartTime.replace(' ', 'T')).getTime();
    if (isNaN(t)) return false;
    return t >= now - 3 * 3_600_000 && t <= now + 26 * 3_600_000;
  });

  return NextResponse.json(live, {
    headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=45' },
  });
}
