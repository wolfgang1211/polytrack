import { NextRequest, NextResponse } from 'next/server';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Accept: 'application/json',
};

const PERIOD_SECONDS: Record<string, number> = {
  '1h':  3_600,
  '6h':  21_600,
  '12h': 43_200,
  '24h': 86_400,
};

export interface HotMarket {
  conditionId: string;
  title: string;
  slug?: string;
  eventSlug?: string;
  icon?: string;
  tradeCount: number;
  volume: number;
  lastTrade: number;
}

export async function GET(req: NextRequest) {
  const period = req.nextUrl.searchParams.get('period') ?? '24h';
  const windowSec = PERIOD_SECONDS[period] ?? PERIOD_SECONDS['24h'];
  const since = Math.floor(Date.now() / 1000) - windowSec;

  try {
    const res = await fetch(
      'https://data-api.polymarket.com/trades?limit=500',
      { headers: HEADERS, cache: 'no-store' }
    );
    if (!res.ok) return NextResponse.json({ error: `HTTP ${res.status}` }, { status: res.status });

    const json = await res.json();
    const raw: unknown[] = Array.isArray(json) ? json : (json.value ?? json.data ?? []);

    // Filter to the selected time window
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inWindow = raw.filter((t: any) => Number(t.timestamp ?? 0) >= since);

    // Group by conditionId (fall back to title)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map = new Map<string, HotMarket>();
    for (const t of inWindow as any[]) {
      const key = t.conditionId ?? t.title ?? t.asset ?? 'unknown';
      const usdc = (t.usdcSize != null)
        ? Number(t.usdcSize)
        : Number(t.size ?? 0) * Number(t.price ?? 0);

      if (map.has(key)) {
        const m = map.get(key)!;
        m.tradeCount++;
        m.volume += usdc;
        if (Number(t.timestamp) > m.lastTrade) m.lastTrade = Number(t.timestamp);
      } else {
        map.set(key, {
          conditionId: t.conditionId ?? key,
          title:       t.title ?? t.asset ?? 'Unknown Market',
          slug:        t.slug,
          eventSlug:   t.eventSlug,
          icon:        t.icon,
          tradeCount:  1,
          volume:      usdc,
          lastTrade:   Number(t.timestamp ?? 0),
        });
      }
    }

    const hot = Array.from(map.values())
      .sort((a, b) => b.tradeCount - a.tradeCount)
      .slice(0, 10);

    return NextResponse.json(hot);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch hot markets' }, { status: 500 });
  }
}
