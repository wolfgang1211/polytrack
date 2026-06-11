import { NextResponse } from 'next/server';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Accept: 'application/json',
};

const WINNER_EVENT_SLUG = 'world-cup-winner';

function parseJsonArr(s: unknown): string[] {
  if (typeof s !== 'string') return [];
  try { return JSON.parse(s); } catch { return []; }
}

export async function GET() {
  try {
    const res = await fetch(
      `https://gamma-api.polymarket.com/events?slug=${WINNER_EVENT_SLUG}`,
      { headers: HEADERS, cache: 'no-store' }
    );
    if (!res.ok) return NextResponse.json({ error: `HTTP ${res.status}` }, { status: res.status });

    const json = await res.json();
    const event = Array.isArray(json) ? json[0] : json;
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const rawMarkets: Record<string, unknown>[] = Array.isArray(event.markets) ? event.markets : [];

    const teams = rawMarkets
      .filter(m => m.closed !== true)
      .map(m => {
        const prices = parseJsonArr(m.outcomePrices);
        const yes = parseFloat(prices[0] ?? '');
        const clobTokens = parseJsonArr(m.clobTokenIds);
        return {
          clobTokenYes: clobTokens[0],
          team: (m.groupItemTitle as string) || String(m.question ?? '').replace(/^Will\s+/i, '').replace(/\s+win.*$/i, ''),
          price: isNaN(yes) ? 0 : yes,
          change24h: m.oneDayPriceChange != null ? Number(m.oneDayPriceChange) : 0,
          volume24hr: m.volume24hr != null ? Number(m.volume24hr) : 0,
          volume: m.volumeNum != null ? Number(m.volumeNum) : (m.volume != null ? Number(m.volume) : 0),
          image: (m.image ?? m.icon) as string | undefined,
          slug: m.slug as string | undefined,
        };
      })
      .sort((a, b) => b.price - a.price);

    return NextResponse.json(
      {
        event: {
          title: event.title,
          slug: event.slug,
          volume: event.volume != null ? Number(event.volume) : 0,
          volume24hr: event.volume24hr != null ? Number(event.volume24hr) : 0,
          liquidity: event.liquidity != null ? Number(event.liquidity) : 0,
          endDate: event.endDate,
        },
        teams,
      },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } }
    );
  } catch {
    return NextResponse.json({ error: 'Failed to fetch World Cup winner odds' }, { status: 500 });
  }
}
