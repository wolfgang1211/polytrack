import { NextRequest, NextResponse } from 'next/server';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Accept: 'application/json',
};

// Map our UI sort keys → gamma-api order params.
const SORT_MAP: Record<string, string> = {
  vol24h: 'volume24hr',
  volume: 'volume',
  liquidity: 'liquidity',
  newest: 'startDate',
  ending: 'endDate',
};

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const sortKey = sp.get('sort') ?? 'vol24h';
  const order = SORT_MAP[sortKey] ?? 'volume24hr';
  const limit = Math.min(Number(sp.get('limit') ?? 120) || 120, 200);
  // "ending" should be ascending (soonest first); everything else descending.
  const ascending = sortKey === 'ending';

  try {
    const url =
      `https://gamma-api.polymarket.com/markets?active=true&closed=false` +
      `&order=${order}&ascending=${ascending}&limit=${limit}`;
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return NextResponse.json({ error: `HTTP ${res.status}` }, { status: res.status });
    const json = await res.json();
    const raw = Array.isArray(json) ? json : (json.value ?? json.markets ?? []);

    const nowMs = Date.now();

    // Slim the payload to the fields the UI needs.
    const markets = raw
      .filter((m: Record<string, unknown>) => {
        if (m.active === false || m.closed === true || m.resolved === true) return false;
        if (m.endDate) {
          const end = new Date(m.endDate as string).getTime();
          if (!isNaN(end) && end < nowMs - 3_600_000) return false;
        }
        return true;
      })
      .map((m: Record<string, unknown>) => ({
        id: m.id,
        question: m.question,
        slug: m.slug,
        eventSlug: m.eventSlug ?? (Array.isArray(m.events) && m.events[0] ? (m.events[0] as Record<string, unknown>).slug : undefined),
        volume24hrNum: m.volume24hr != null ? Number(m.volume24hr) : undefined,
        volumeNum: m.volumeNum != null ? Number(m.volumeNum) : (m.volume != null ? Number(m.volume) : undefined),
        liquidityNum: m.liquidityNum != null ? Number(m.liquidityNum) : (m.liquidity != null ? Number(m.liquidity) : undefined),
        outcomePrices: m.outcomePrices,
        outcomes: m.outcomes,
        image: m.image ?? m.icon,
        endDate: m.endDate ?? m.endDateIso,
        category: m.category ?? undefined,
      }));

    return NextResponse.json(markets, {
      headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch markets' }, { status: 500 });
  }
}
