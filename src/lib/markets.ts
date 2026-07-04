import type { TopMarket } from '@/types';

/* Shared Polymarket gamma-api market list fetcher.
   Used by /api/markets/list (client refreshes) and the /markets
   server component (SEO-visible initial render). */

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Accept: 'application/json',
};

// Map our UI sort keys → gamma-api order params.
export const SORT_MAP: Record<string, string> = {
  vol24h: 'volume24hr',
  volume: 'volume',
  liquidity: 'liquidity',
  newest: 'startDate',
  ending: 'endDate',
};

function textField(m: Record<string, unknown>, key: string): string | undefined {
  return typeof m[key] === 'string' ? (m[key] as string) : undefined;
}

function eventSlugFrom(m: Record<string, unknown>): string | undefined {
  if (typeof m.eventSlug === 'string') return m.eventSlug;
  if (Array.isArray(m.events) && m.events[0]) {
    const event = m.events[0] as Record<string, unknown>;
    return textField(event, 'slug');
  }
  return undefined;
}

function marketCategory(m: Record<string, unknown>, question: string, slug?: string, eventSlug?: string): string | undefined {
  const apiCategory = textField(m, 'category');
  const text = `${question} ${slug ?? ''} ${eventSlug ?? ''}`;

  if (/(?:\bfifwc\b|fifa|world[-\s]?cup|worldcup)/i.test(text)) return 'World Cup';
  return apiCategory;
}

export async function fetchMarketsList(sortKey = 'vol24h', limit = 120): Promise<TopMarket[]> {
  const order = SORT_MAP[sortKey] ?? 'volume24hr';
  const cappedLimit = Math.min(limit || 120, 200);
  // "ending" should be ascending (soonest first); everything else descending.
  const ascending = sortKey === 'ending';

  const url =
    `https://gamma-api.polymarket.com/markets?active=true&closed=false` +
    `&order=${order}&ascending=${ascending}&limit=${cappedLimit}`;
  const res = await fetch(url, { headers: HEADERS, next: { revalidate: 120 } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const raw = Array.isArray(json) ? json : (json.value ?? json.markets ?? []);

  const nowMs = Date.now();

  // Slim the payload to the fields the UI needs.
  return raw
    .filter((m: Record<string, unknown>) => {
      if (m.active === false || m.closed === true || m.resolved === true) return false;
      if (m.endDate) {
        const end = new Date(m.endDate as string).getTime();
        if (!isNaN(end) && end < nowMs - 3_600_000) return false;
      }
      return true;
    })
    .map((m: Record<string, unknown>) => {
      const question = textField(m, 'question') ?? '';
      const slug = textField(m, 'slug');
      const eventSlug = eventSlugFrom(m);

      return {
        id: m.id,
        question,
        slug,
        eventSlug,
        volume24hrNum: m.volume24hr != null ? Number(m.volume24hr) : undefined,
        volumeNum: m.volumeNum != null ? Number(m.volumeNum) : (m.volume != null ? Number(m.volume) : undefined),
        liquidityNum: m.liquidityNum != null ? Number(m.liquidityNum) : (m.liquidity != null ? Number(m.liquidity) : undefined),
        outcomePrices: m.outcomePrices,
        outcomes: m.outcomes,
        image: m.image ?? m.icon,
        endDate: m.endDate ?? m.endDateIso,
        category: marketCategory(m, question, slug, eventSlug),
      } as TopMarket;
    });
}
