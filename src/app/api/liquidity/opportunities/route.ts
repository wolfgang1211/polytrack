import { NextResponse } from 'next/server';
import { CLOB_BASE } from '@/lib/clob';

const G_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Accept: 'application/json',
};

export interface LPOpportunity {
  conditionId: string;
  question: string;
  slug: string;
  eventSlug?: string;
  image?: string;
  volume24h: number;
  liquidity: number;
  tokenId: string;
  bestBid: number;
  bestAsk: number;
  spread: number;       // bestAsk - bestBid (in cents: ×100)
  spreadPct: number;    // spread / mid
  bidDepth: number;     // USD within 5¢ of best bid
  askDepth: number;
  score: number;        // opportunity score
}

interface ClobBook {
  bids: { price: string; size: string }[];
  asks: { price: string; size: string }[];
}

function parseJson(s: string | undefined): string[] {
  try { return JSON.parse(s ?? '[]'); } catch { return []; }
}

function bookDepth(levels: { price: string; size: string }[], best: number, side: 'bid' | 'ask'): number {
  return levels.reduce((sum, { price, size }) => {
    const p = parseFloat(price), s = parseFloat(size);
    const dist = side === 'bid' ? best - p : p - best;
    return dist <= 0.05 ? sum + p * s : sum;   // within 5¢
  }, 0);
}

export async function GET() {
  try {
    // 1 — Top markets by 24h volume
    const mRes = await fetch(
      'https://gamma-api.polymarket.com/markets?active=true&closed=false&order=volume24hr&ascending=false&limit=30',
      { headers: G_HEADERS, next: { revalidate: 120 } }
    );
    if (!mRes.ok) throw new Error(`Markets ${mRes.status}`);

    const mJson = await mRes.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const markets: any[] = Array.isArray(mJson) ? mJson : (mJson.markets ?? mJson.value ?? []);

    // 2 — Pick markets that have clobTokenIds and enough volume
    const candidates = markets
      .filter(m => {
        const ids = parseJson(m.clobTokenIds);
        const vol = m.volume24hrNum ?? Number(m.volume24hr ?? 0);
        return ids.length > 0 && vol > 1000;
      })
      .slice(0, 12);

    // 3 — Fetch orderbooks in parallel (max 12)
    const books = await Promise.allSettled(
      candidates.map(m => {
        const tokenId = parseJson(m.clobTokenIds)[0];
        return fetch(`${CLOB_BASE}/book?token_id=${tokenId}`, {
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        })
          .then(r => (r.ok ? r.json() as Promise<ClobBook> : null))
          .catch(() => null);
      })
    );

    // 4 — Compute metrics and build opportunities list
    const opportunities: LPOpportunity[] = [];

    candidates.forEach((m, i) => {
      const bookResult = books[i];
      const book: ClobBook | null =
        bookResult.status === 'fulfilled' ? bookResult.value : null;

      const vol24h = m.volume24hrNum ?? Number(m.volume24hr ?? 0);
      const liquidity = m.liquidityNum ?? Number(m.liquidity ?? 0);
      const tokenId = parseJson(m.clobTokenIds)[0] ?? '';

      let bestBid = 0, bestAsk = 1, bidDepth = 0, askDepth = 0;

      if (book && book.bids?.length && book.asks?.length) {
        bestBid = parseFloat(book.bids[0].price);
        bestAsk = parseFloat(book.asks[0].price);
        bidDepth = bookDepth(book.bids, bestBid, 'bid');
        askDepth = bookDepth(book.asks, bestAsk, 'ask');
      } else {
        // Fall back to outcomePrices if no orderbook
        const prices = parseJson(m.outcomePrices);
        if (prices.length >= 2) {
          const p0 = parseFloat(prices[0]);
          const p1 = parseFloat(prices[1]);
          bestBid = Math.min(p0, 1 - p0) - 0.01;
          bestAsk = Math.min(p0, 1 - p0) + 0.01;
        }
      }

      const spread = Math.max(0, bestAsk - bestBid);
      const mid = (bestBid + bestAsk) / 2 || 0.5;
      const spreadPct = mid > 0 ? spread / mid : 0;

      // Opportunity score: wider spread × more volume = better LP opportunity
      const score = Math.round(spreadPct * 100 * Math.pow(Math.max(1, vol24h), 0.38));

      opportunities.push({
        conditionId: m.conditionId ?? m.id ?? '',
        question: m.question ?? 'Unknown',
        slug: m.slug ?? '',
        eventSlug: m.eventSlug,
        image: m.image,
        volume24h: vol24h,
        liquidity,
        tokenId,
        bestBid,
        bestAsk,
        spread,
        spreadPct,
        bidDepth,
        askDepth,
        score,
      });
    });

    opportunities.sort((a, b) => b.score - a.score);

    return NextResponse.json(opportunities, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
