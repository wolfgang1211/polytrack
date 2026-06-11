import { NextResponse } from 'next/server';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Accept: 'application/json',
};

type Slim = Record<string, unknown>;

function slimMarket(m: Slim) {
  return {
    question: m.question,
    groupItemTitle: m.groupItemTitle,
    outcomes: m.outcomes,
    outcomePrices: m.outcomePrices,
    volume24hr: m.volume24hr != null ? Number(m.volume24hr) : 0,
    gameStartTime: m.gameStartTime ?? null,
    slug: m.slug,
    closed: m.closed === true,
    oneDayPriceChange: m.oneDayPriceChange != null ? Number(m.oneDayPriceChange) : 0,
    lastTradePrice: m.lastTradePrice != null ? Number(m.lastTradePrice) : null,
  };
}

export async function GET() {
  try {
    const res = await fetch(
      'https://gamma-api.polymarket.com/events?tag_slug=fifa-world-cup&closed=false&active=true&order=volume24hr&ascending=false&limit=100',
      { headers: HEADERS, cache: 'no-store' }
    );
    if (!res.ok) return NextResponse.json({ error: `HTTP ${res.status}` }, { status: res.status });

    const json = await res.json();
    const raw: Slim[] = Array.isArray(json) ? json : (json.value ?? []);

    const events = raw
      // The championship-winner event has its own endpoint.
      .filter(e => e.slug !== 'world-cup-winner')
      .map(e => {
        const markets = (Array.isArray(e.markets) ? (e.markets as Slim[]) : [])
          .filter(m => m.closed !== true)
          .map(slimMarket);
        const gameStartTime =
          (markets.find(m => m.gameStartTime)?.gameStartTime as string | null) ?? null;
        return {
          id: e.id,
          title: e.title,
          slug: e.slug,
          image: e.image ?? e.icon,
          volume24hr: e.volume24hr != null ? Number(e.volume24hr) : 0,
          volume: e.volume != null ? Number(e.volume) : 0,
          liquidity: e.liquidity != null ? Number(e.liquidity) : 0,
          endDate: e.endDate,
          gameStartTime,
          isMatch: typeof e.title === 'string' && / vs\.? /i.test(e.title as string),
          markets,
        };
      })
      .filter(e => e.markets.length > 0);

    return NextResponse.json(events, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch World Cup markets' }, { status: 500 });
  }
}
