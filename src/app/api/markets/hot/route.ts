import { NextRequest, NextResponse } from 'next/server';
import { dataFailure, NO_STORE, readTrades } from '@/lib/publicDataApi';

const PERIOD_SECONDS: Record<string, number> = {
  '1h':  3_600,
  '6h':  21_600,
  '12h': 43_200,
  '24h': 86_400,
};

export interface HotMarket {
  conditionId?: string;
  marketKey: string;
  marketMetadataAvailable: boolean;
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
  if (!Object.hasOwn(PERIOD_SECONDS, period)) return NextResponse.json({ error: 'Invalid period.' }, { status: 400, headers: NO_STORE });
  const windowSec = PERIOD_SECONDS[period];
  const since = Math.floor(Date.now() / 1000) - windowSec;

  try {
    const result = await readTrades();
    const raw = result.data;

    // Filter to the selected time window
    const now = Math.floor(Date.now() / 1000);
    const inWindow = raw.filter(t => (t.timestamp ?? 0) >= since && (t.timestamp ?? 0) <= now);

    // A missing validated CTF identifier falls back to the outcome token,
    // never a nonunique title or a repaired/synthetic condition identifier.
    const map = new Map<string, HotMarket>();
    for (const t of inWindow) {
      const key = t.conditionId ?? `token:${t.asset}`;
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
          conditionId: t.conditionId,
          marketKey: key,
          marketMetadataAvailable: t.marketMetadataAvailable,
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

    return NextResponse.json(hot, { headers: { ...NO_STORE, 'X-Data-Sample': 'latest-500-trades', 'X-Data-Truncated': String(result.truncated || map.size > hot.length) } });
  } catch (error) { return dataFailure(error); }
}
