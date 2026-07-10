import { NextResponse } from 'next/server';
import { CLOB_BASE } from '@/lib/clob';
import { rewardsOf, isMatchMarket } from '@/lib/rewards';

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
  score: number;         // 0–100 LP-suitability score
  scoreBreakdown: {      // point contributions that sum to `score`
    rewards: number;     // out of 25 — active reward pool size
    volume: number;      // out of 20
    spread: number;      // out of 15
    stability: number;   // out of 15 — low 24h price volatility
    horizon: number;     // out of 15 — time to resolution
    balance: number;     // out of 10 — mid near 50/50
  };
  endDate?: string;
  daysToResolve: number | null;  // days until market resolves
  spreadVol: number;             // 24h spread/price volatility proxy (%)
  risk: 'Low' | 'Medium' | 'High';
  /* ── Polymarket liquidity rewards program (real data, not an estimate) ── */
  hasRewards: boolean;
  rewardsDailyRate: number;          // USD paid out per day to makers in this market
  rewardsMinSize: number | null;     // min qualifying order size (shares)
  rewardsMaxSpread: number | null;   // max distance from mid to qualify (¢)
  estDailyReward: number;            // $1K capital's est. share of the daily pool
}

interface ClobBook {
  asset_id?: string;
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
    // 1 — Wide candidate pool: top by 24h volume AND top by liquidity, deduped.
    //     One hot event (e.g. World Cup) can monopolise the volume list, which
    //     would starve the simulator/calculator of non-event and reward markets.
    const fetchGamma = async (order: string) => {
      const res = await fetch(
        `https://gamma-api.polymarket.com/markets?active=true&closed=false&order=${order}&ascending=false&limit=100`,
        { headers: G_HEADERS, next: { revalidate: 60 } }
      );
      if (!res.ok) return [];
      const json = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (Array.isArray(json) ? json : (json.markets ?? json.value ?? [])) as any[];
    };
    const [byVol, byLiq] = await Promise.all([fetchGamma('volume24hr'), fetchGamma('liquidity')]);
    if (!byVol.length && !byLiq.length) throw new Error('Markets unavailable');

    const seenIds = new Set<string>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const markets: any[] = [];
    for (const m of [...byVol, ...byLiq]) {
      const id = String(m?.conditionId ?? m?.id ?? '');
      if (!id || seenIds.has(id)) continue;
      seenIds.add(id);
      markets.push(m);
    }

    // 2 — Keep tradeable candidates suitable for LPing:
    //     real volume OR an active reward pool, NOT a match-type market,
    //     and at least 3 days from resolution (in-play risk isn't LP risk).
    const MIN_HORIZON_MS = 3 * 86_400_000;
    const candidates = markets
      .filter(m => {
        const ids = parseJson(m.clobTokenIds);
        if (!ids.length) return false;
        if (isMatchMarket(m)) return false;
        const end = m.endDate ?? m.endDateIso;
        if (end) {
          const t = new Date(end).getTime();
          if (!isNaN(t) && t - Date.now() < MIN_HORIZON_MS) return false;
        }
        const vol = m.volume24hrNum ?? Number(m.volume24hr ?? 0);
        return vol > 1000 || rewardsOf(m).dailyRate > 0;
      })
      .sort((a, b) => (b.volume24hrNum ?? Number(b.volume24hr ?? 0)) - (a.volume24hrNum ?? Number(a.volume24hr ?? 0)))
      .slice(0, 40);

    // 3 — Enrich ALL candidates with live orderbook depth. One batched
    //     POST /books call covers every market (the old per-market GETs only
    //     reached the top 15 by volume, leaving most cards "orderbook n/a");
    //     per-market GETs remain as a fallback if the batch endpoint fails.
    const candidateTokenIds = candidates.map(m => parseJson(m.clobTokenIds)[0] ?? '');
    const booksById = new Map<string, ClobBook>();
    try {
      const res = await fetch(`${CLOB_BASE}/books`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(candidateTokenIds.filter(Boolean).map(token_id => ({ token_id }))),
        cache: 'no-store',
      });
      if (res.ok) {
        const arr = (await res.json()) as ClobBook[];
        for (const b of Array.isArray(arr) ? arr : []) {
          if (b?.asset_id) booksById.set(String(b.asset_id), b);
        }
      }
    } catch { /* batch endpoint down — fall back below */ }

    if (booksById.size === 0) {
      const BOOK_LIMIT = 15;
      const settled = await Promise.allSettled(
        candidates.map((m, i) => {
          if (i >= BOOK_LIMIT) return Promise.resolve<ClobBook | null>(null);
          const tokenId = parseJson(m.clobTokenIds)[0];
          return fetch(`${CLOB_BASE}/book?token_id=${tokenId}`, {
            headers: { Accept: 'application/json' },
            cache: 'no-store',
          }).then(r => (r.ok ? (r.json() as Promise<ClobBook>) : null)).catch(() => null);
        })
      );
      settled.forEach((r, i) => {
        if (r.status === 'fulfilled' && r.value && candidateTokenIds[i]) {
          booksById.set(candidateTokenIds[i], r.value);
        }
      });
    }

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
      const book = booksById.get(tokenId) ?? null;
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

      // Real liquidity-rewards program data from gamma.
      const rw = rewardsOf(m);
      const estDailyReward = rw.dailyRate > 0 ? poolShare * rw.dailyRate : 0;

      // LP-suitability score 0–100 — what actually makes a market worth
      // quoting: a real reward pool, steady flow, capturable spread, price
      // stability, time to work the position, and a two-sided book.
      const rewardsPts   = Math.round(25 * Math.min(1, rw.dailyRate / 100));
      const volumePts    = Math.round(20 * Math.min(1, Math.log10(Math.max(1, vol24h)) / 7));
      const spreadPts    = Math.round(15 * Math.min(1, spread / 0.05));
      const stabilityPts = Math.round(15 * (1 - Math.min(1, spreadVol / 30)));
      const horizonPts   = Math.round(15 * (daysToResolve == null ? 1 : Math.min(1, daysToResolve / 30)));
      const balancePts   = Math.round(10 * (1 - Math.min(1, Math.abs(mid - 0.5) * 2)));
      const score = rewardsPts + volumePts + spreadPts + stabilityPts + horizonPts + balancePts;

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
        scoreBreakdown: { rewards: rewardsPts, volume: volumePts, spread: spreadPts, stability: stabilityPts, horizon: horizonPts, balance: balancePts },
        endDate,
        daysToResolve,
        spreadVol,
        risk,
        hasRewards: rw.dailyRate > 0,
        rewardsDailyRate: rw.dailyRate,
        rewardsMinSize: rw.minSize,
        rewardsMaxSpread: rw.maxSpread,
        estDailyReward,
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
