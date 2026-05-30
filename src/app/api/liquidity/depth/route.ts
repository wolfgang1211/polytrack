import { NextRequest, NextResponse } from 'next/server';
import { CLOB_BASE } from '@/lib/clob';

export interface DepthLevel { price: number; size: number; total: number }

export interface MarketDepth {
  tokenId: string;
  bestBid: number;
  bestAsk: number;
  spread: number;
  spreadPct: number;
  midPrice: number;
  bids: DepthLevel[];
  asks: DepthLevel[];
  bidDepthTotal: number;
  askDepthTotal: number;
  imbalance: number;   // −1 (heavy ask) … +1 (heavy bid)
  qualityScore: number;  // 0–100
}

export async function GET(req: NextRequest) {
  const tokenId = req.nextUrl.searchParams.get('tokenId');
  if (!tokenId) return NextResponse.json({ error: 'tokenId required' }, { status: 400 });

  try {
    const res = await fetch(`${CLOB_BASE}/book?token_id=${tokenId}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return NextResponse.json({ error: `CLOB ${res.status}` }, { status: res.status });

    const book: { bids: { price: string; size: string }[]; asks: { price: string; size: string }[] } = await res.json();

    const MAX_LEVELS = 15;

    function buildLevels(raw: { price: string; size: string }[]): DepthLevel[] {
      let cum = 0;
      return raw.slice(0, MAX_LEVELS).map(l => {
        const price = parseFloat(l.price);
        const size  = parseFloat(l.size);
        cum += price * size;
        return { price, size, total: cum };
      });
    }

    const bids = buildLevels(book.bids ?? []);
    const asks = buildLevels(book.asks ?? []);

    const bestBid = bids[0]?.price ?? 0;
    const bestAsk = asks[0]?.price ?? 1;
    const spread  = Math.max(0, bestAsk - bestBid);
    const midPrice = (bestBid + bestAsk) / 2;
    const spreadPct = midPrice > 0 ? spread / midPrice : 0;

    const bidDepthTotal = bids[bids.length - 1]?.total ?? 0;
    const askDepthTotal = asks[asks.length - 1]?.total ?? 0;
    const totalDepth = bidDepthTotal + askDepthTotal;
    const imbalance = totalDepth > 0 ? (bidDepthTotal - askDepthTotal) / totalDepth : 0;

    // Quality score: tight spread + good depth = high score
    const spreadScore  = Math.max(0, 1 - spreadPct * 10) * 50;   // 0–50
    const depthScore   = Math.min(50, Math.log10(Math.max(1, totalDepth)) * 10);  // 0–50
    const qualityScore = Math.round(spreadScore + depthScore);

    const depth: MarketDepth = {
      tokenId, bestBid, bestAsk, spread, spreadPct, midPrice,
      bids, asks, bidDepthTotal, askDepthTotal, imbalance, qualityScore,
    };

    return NextResponse.json(depth);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
