import { NextResponse } from 'next/server';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Accept: 'application/json',
};

type Raw = Record<string, unknown>;

function text(obj: Raw, key: string): string | undefined {
  return typeof obj[key] === 'string' ? obj[key] as string : undefined;
}

function num(obj: Raw, key: string): number | undefined {
  const value = obj[key];
  if (value == null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function bool(obj: Raw, key: string): boolean | undefined {
  return typeof obj[key] === 'boolean' ? obj[key] as boolean : undefined;
}

function rawArray(value: unknown): Raw[] {
  return Array.isArray(value) ? value.filter((item): item is Raw => item != null && typeof item === 'object' && !Array.isArray(item)) : [];
}

function mapMarket(m: Raw, eventSlug?: string, eventTitle?: string) {
  return {
    id: String(m.id ?? m.conditionId ?? m.slug ?? ''),
    question: text(m, 'question') ?? '',
    slug: text(m, 'slug') ?? '',
    eventSlug,
    eventTitle,
    outcomes: text(m, 'outcomes'),
    outcomePrices: text(m, 'outcomePrices'),
    image: text(m, 'image') ?? text(m, 'icon'),
    endDate: text(m, 'endDate') ?? text(m, 'endDateIso'),
    clobTokenIds: text(m, 'clobTokenIds'),
    oneDayPriceChange: num(m, 'oneDayPriceChange'),
    lastTradePrice: num(m, 'lastTradePrice'),
    bestBid: num(m, 'bestBid'),
    bestAsk: num(m, 'bestAsk'),
    groupItemTitle: text(m, 'groupItemTitle'),
    sportsMarketType: text(m, 'sportsMarketType'),
    volume24hrNum: num(m, 'volume24hr'),
    volumeNum: num(m, 'volume') ?? num(m, 'volumeNum'),
    liquidityNum: num(m, 'liquidity') ?? num(m, 'liquidityNum'),
  };
}

function isWorldCupEvent(event: Raw): boolean {
  const value = `${text(event, 'title') ?? ''} ${text(event, 'slug') ?? ''}`.toLowerCase();
  if (/esports\s+world\s+cup|\blol\b|league\s+of\s+legends/.test(value)) return false;
  return /\bfifwc\b|fifa|world[-\s]?cup|worldcup/.test(value);
}

export async function GET() {
  try {
    const url = 'https://gamma-api.polymarket.com/events?active=true&closed=false&limit=120&order=volume24hr&ascending=false';
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return NextResponse.json({ error: `HTTP ${res.status}` }, { status: res.status });

    const json: unknown = await res.json();
    const rawEvents = rawArray(json);

    const events = rawEvents
      .filter((event) => bool(event, 'active') !== false && bool(event, 'closed') !== true && isWorldCupEvent(event))
      .map((event) => {
        const slug = text(event, 'slug') ?? '';
        const title = text(event, 'title') ?? '';
        return {
          id: String(event.id ?? slug),
          slug,
          title,
          description: text(event, 'description'),
          image: text(event, 'image') ?? text(event, 'icon'),
          icon: text(event, 'icon') ?? text(event, 'image'),
          endDate: text(event, 'endDate'),
          volume24hr: num(event, 'volume24hr'),
          volume: num(event, 'volume'),
          liquidity: num(event, 'liquidity'),
          markets: rawArray(event.markets).map((market) => mapMarket(market, slug, title)),
        };
      });

    return NextResponse.json({ events, updatedAt: new Date().toISOString() }, {
      headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch World Cup markets' }, { status: 500 });
  }
}
