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
  mid: number;
  spread: number;        // bestAsk - bestBid (fraction, e.g. 0.02)
  spreadPct: number;     // spread / mid, clamped to [0,1]
  bidDepth: number | null;   // USD within 5¢ of best bid (null = orderbook unavailable)
  askDepth: number | null;
  depthKnown: boolean;
  estDailyFee: number;   // spread capture for a $1K LP position ($/day)
  score: number;         // 0–100 opportunity score
  scoreBreakdown: {      // point contributions that sum to `score`
    spread: number;      // out of 35
    volume: number;      // out of 45
    depth: number;       // out of 20 (two-sidedness / balance)
  };
  endDate?: string;
  daysToResolve: number | null;  // days until market resolves
  spreadVol: number;             // 24h spread/price volatility proxy (%)
  risk: 'Low' | 'Medium' | 'High';
}

interface ClobBook {
  bids: { price: string; size: string }[];
  asks: { price: string; size: string }[];
}

function parseJson(s: string | undefined): string[] {
  try { return JSON.parse(s ?? '[]'); } catch { return []; }
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

// Maker rebate ≈ 0.1% of notional volume traded against resting orders.
const MAKER_REBATE_RATE = 0.001;

// Assumed LP capital for estDailyFee — same assumption as the Reward Simulator.
const DEFAULT_CAPITAL = 1_000;

// Robustly derive best bid/ask + depth-within-5¢ from a raw orderbook,
// regardless of how the venue sorts the levels.
function fromBook(book: ClobBook): { bestBid: number; bestAsk: number; bidDepth: number; askDepth: number } | null {
  const bids = (book.bids ?? []).map(b => ({ p: parseFloat(b.price), s: parseFloat(b.size) })).filter(x => x.p > 0 && x.p < 1);
  const asks = (book.asks ?? []).map(a => ({ p: parseFloat(a.price), s: parseFloat(a.size) })).filter(x => x.p > 0 && x.p < 1);
  if (!bids.length || !asks.length) return null;
  const bestBid = Math.max(...bids.map(b => b.p));
  const bestAsk = Math.min(...asks.map(a => a.p));
  const bidDepth = bids.reduce((sum, b) => (bestBid - b.p <= 0.05 ? sum + b.p * b.s : sum), 0);
  const askDepth = asks.reduce((sum, a) => (a.p - bestAsk <= 0.05 ? sum + a.p * a.s : sum), 0);
  return { bestBid, bestAsk, bidDepth, askDepth };
}

export async function GET() {
  try {
    // 1 — Top markets by 24h volume (gamma already returns bestBid/bestAsk/spread)
    const mRes = await fetch(
      'https://gamma-api.polymarket.com/markets?active=true&closed=false&order=volume24hr&ascending=false&limit=40',
      { headers: G_HEADERS, next: { revalidate: 60 } }
    );
    if (!mRes.ok) throw new Error(`Markets ${mRes.status}`);

    const mJson = await mRes.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const markets: any[] = Array.isArray(mJson) ? mJson : (mJson.markets ?? mJson.value ?? []);

    // 2 — Keep tradeable, liquid candidates
    const candidates = markets
      .filter(m => {
        const ids = parseJson(m.clobTokenIds);
        const vol = m.volume24hrNum ?? Number(m.volume24hr ?? 0);
        return ids.length > 0 && vol > 1000;
      })
      .slice(0, 15);

    // 3 — Enrich the top candidates with live orderbook depth (best-effort)
    const books = await Promise.allSettled(
      candidates.map(m => {
        const tokenId = parseJson(m.clobTokenIds)[0];
        return fetch(`${CLOB_BASE}/book?token_id=${tokenId}`, {
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        }).then(r => (r.ok ? (r.json() as Promise<ClobBook>) : null)).catch(() => null);
      })
    );

    const opportunities: LPOpportunity[] = candidates.map((m, i) => {
      const vol24h    = m.volume24hrNum ?? Number(m.volume24hr ?? 0);
      const liquidity = m.liquidityNum ?? Number(m.liquidity ?? 0);
      const tokenId   = parseJson(m.clobTokenIds)[0] ?? '';
      // Polymarket pages live at /event/{eventSlug}; gamma nests it under events[].
      const eventSlug = m.eventSlug
        ?? (Array.isArray(m.events) && m.events[0] ? m.events[0].slug : undefined);

      // Prefer gamma's published top-of-book; clamp to a sane [0,1].
      let bestBid = clamp01(Number(m.bestBid ?? NaN));
      let bestAsk = clamp01(Number(m.bestAsk ?? NaN));

      // If gamma omitted them, derive from outcomePrices around the mid.
      if (!(bestBid > 0) || !(bestAsk > 0) || bestAsk < bestBid) {
        const prices = parseJson(m.outcomePrices);
        const last = Number(m.lastTradePrice ?? (prices.length ? prices[0] : 0.5)) || 0.5;
        const mid = clamp01(last);
        const half = (Number(m.spread) || 0.02) / 2;
        bestBid = clamp01(mid - half);
        bestAsk = clamp01(mid + half);
      }

      // Layer in live orderbook depth when we have it.
      const bookResult = books[i];
      const book = bookResult.status === 'fulfilled' ? bookResult.value : null;
      const parsed = book ? fromBook(book) : null;

      let bidDepth: number | null = null;
      let askDepth: number | null = null;
      if (parsed) {
        bestBid = parsed.bestBid;
        bestAsk = parsed.bestAsk;
        bidDepth = parsed.bidDepth;
        askDepth = parsed.askDepth;
      }

      const spread = Math.max(0, bestAsk - bestBid);
      const mid = (bestBid + bestAsk) / 2 || 0.5;
      const spreadPct = clamp01(mid > 0 ? spread / mid : 0);

      // Fee potential: pool-share-weighted spread capture for a $1K LP position.
      const poolShare = DEFAULT_CAPITAL / (liquidity + DEFAULT_CAPITAL || DEFAULT_CAPITAL);
      const estDailyFee = poolShare * vol24h * spread * 0.5;

      // Score 0–100: volume + spread edge + how two-sided the market is.
      const volScore     = Math.min(1, Math.log10(Math.max(1, vol24h)) / 7); // ~10M → 1
      const spreadScore  = Math.min(1, spread / 0.05);                       // 5¢ → 1
      const balanceScore = 1 - Math.min(1, Math.abs(mid - 0.5) * 2);         // 50/50 → 1
      // Point contributions (sum = score, so the badge matches the tooltip).
      const spreadPts  = Math.round(35 * spreadScore);
      const volumePts  = Math.round(45 * volScore);
      const depthPts   = Math.round(20 * balanceScore);
      const score = spreadPts + volumePts + depthPts;

      // Risk metrics ─────────────────────────────────────────────
      const endDate = m.endDate ?? m.endDateIso ?? undefined;
      const daysToResolve = endDate
        ? Math.max(0, Math.ceil((new Date(endDate).getTime() - Date.now()) / 86_400_000))
        : null;
      // No historical spread is published, so approximate spread volatility from
      // the 24h price move relative to the mid — bigger swings ⇒ less stable book.
      const odc = Math.abs(Number(m.oneDayPriceChange ?? 0));
      const spreadVol = mid > 0 ? Math.min(100, (odc / mid) * 100) : 0;

      let riskPts = 0;
      if (daysToResolve != null) {
        if (daysToResolve < 5) riskPts += 3;  // resolving imminently → High on its own
        else if (daysToResolve < 14) riskPts += 1;
      }
      if (spreadVol > 30) riskPts += 2;
      else if (spreadVol > 10) riskPts += 1;
      const risk: 'Low' | 'Medium' | 'High' = riskPts >= 3 ? 'High' : riskPts >= 1 ? 'Medium' : 'Low';

      return {
        conditionId: m.conditionId ?? m.id ?? '',
        question: m.question ?? 'Unknown',
        slug: m.slug ?? '',
        eventSlug,
        image: m.image,
        volume24h: vol24h,
        liquidity,
        tokenId,
        bestBid,
        bestAsk,
        mid,
        spread,
        spreadPct,
        bidDepth,
        askDepth,
        depthKnown: parsed != null,
        estDailyFee,
        score,
        scoreBreakdown: { spread: spreadPts, volume: volumePts, depth: depthPts },
        endDate,
        daysToResolve,
        spreadVol,
        risk,
      };
    });

    opportunities.sort((a, b) => b.score - a.score);

    return NextResponse.json(
      { opportunities, updatedAt: Date.now() },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } }
    );
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
