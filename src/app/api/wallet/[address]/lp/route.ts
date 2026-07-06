import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { fetchMakerGraphFills, type GraphFill } from '@/lib/graphFills';

/* LP Earnings (LH-8) — how much a wallet actually earned by MAKING liquidity.
 *
 * We fetch only the maker-side fills from the Polymarket orderbook subgraph
 * (same MAKER_QUERY the timeline route uses) and replay them with average
 * cost basis per token. Because the fill's `side` is recorded from the
 * TAKER's perspective, the maker's direction is the inverse: taker Buy ⇒
 * maker sold, taker Sell ⇒ maker bought. The realized number that falls out
 * of the replay is the maker's captured spread on round-tripped inventory —
 * i.e. LP trading profit, excluding UMA/liquidity reward payouts.
 */

export interface LpMarketBreakdown {
  id: string;          // clob token id (subgraph market.id)
  title: string | null;
  outcome: string | null;
  realized: number;    // realized spread P&L (USD)
  volume: number;      // maker volume (USD, buys + sells)
  fills: number;
  /** Remaining inventory from maker fills (shares / cost) — not yet round-tripped. */
  invShares: number;
  invCost: number;
  lastTs: number;      // unix seconds of latest maker fill
}

export interface LpResponse {
  available: boolean;
  realized: number;      // total realized spread earnings (USD)
  makerVolume: number;   // total maker volume (USD)
  fills: number;         // total maker fills
  marketCount: number;
  buyVolume: number;
  sellVolume: number;
  firstTs: number | null;
  lastTs: number | null;
  markets: LpMarketBreakdown[]; // top markets by maker volume
}

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Accept: 'application/json',
};

const TOP_MARKETS = 12;

interface GammaTokenInfo { title: string | null; outcome: string | null }

/** Resolve clob token ids → market question + outcome via gamma-api. */
async function resolveTokenTitles(ids: string[]): Promise<Map<string, GammaTokenInfo>> {
  const out = new Map<string, GammaTokenInfo>();

  await Promise.all(ids.map(async (id) => {
    try {
      const res = await fetch(
        `https://gamma-api.polymarket.com/markets?clob_token_ids=${id}`,
        { headers: HEADERS, next: { revalidate: 86400 } }
      );
      if (!res.ok) return;
      const json = await res.json();
      const m = (Array.isArray(json) ? json[0] : (json?.value ?? json?.markets ?? [])[0]) as
        Record<string, unknown> | undefined;
      if (!m) return;

      const title = typeof m.question === 'string' ? m.question : null;

      // Map the token id back to its outcome label via parallel arrays.
      let outcome: string | null = null;
      try {
        const tokenIds: string[] = Array.isArray(m.clobTokenIds)
          ? (m.clobTokenIds as string[])
          : JSON.parse(String(m.clobTokenIds ?? '[]'));
        const outcomes: string[] = Array.isArray(m.outcomes)
          ? (m.outcomes as string[])
          : JSON.parse(String(m.outcomes ?? '[]'));
        const idx = tokenIds.findIndex(t => String(t) === id);
        if (idx >= 0 && outcomes[idx]) outcome = String(outcomes[idx]);
      } catch { /* leave outcome null */ }

      out.set(id, { title, outcome });
    } catch { /* unresolved — UI falls back to the token id */ }
  }));

  return out;
}

interface MarketAgg {
  realized: number;
  volume: number;
  buyVol: number;
  sellVol: number;
  fills: number;
  shares: number; // open inventory
  cost: number;   // open inventory cost basis
  lastTs: number;
}

/**
 * Cost-basis replay over maker fills only.
 * Mirrors the timeline route's replay, but per-market and maker-perspective.
 */
function replayMakerFills(fills: GraphFill[]) {
  const sorted = fills.slice().sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
  const byMarket = new Map<string, MarketAgg>();

  let realized = 0;
  let makerVolume = 0;
  let buyVolume = 0;
  let sellVolume = 0;
  let firstTs: number | null = null;
  let lastTs: number | null = null;
  let counted = 0;

  for (const f of sorted) {
    const asset = f.market.id;
    const t = Number(f.timestamp);
    const shares = Number(f.size) / 1e6;
    const usd = shares * Number(f.price);
    if (!asset || !t || shares <= 0) continue;

    // side='Buy' means the TAKER bought — so the maker was selling.
    const makerIsBuying = f.side !== 'Buy';

    const agg = byMarket.get(asset) ?? {
      realized: 0, volume: 0, buyVol: 0, sellVol: 0, fills: 0, shares: 0, cost: 0, lastTs: 0,
    };

    if (makerIsBuying) {
      agg.shares += shares;
      agg.cost += usd;
      agg.buyVol += usd;
      buyVolume += usd;
    } else {
      const sellShares = Math.min(shares, agg.shares);
      const avgCost = agg.shares > 0 ? agg.cost / agg.shares : 0;
      // Only the round-tripped portion counts as realized spread. Shares sold
      // beyond tracked inventory were acquired as a taker (or minted) — that
      // P&L belongs to the trading timeline, not to LP spread capture.
      const gain = sellShares * (Number(f.price) - avgCost);
      agg.realized += gain;
      realized += gain;
      agg.shares -= sellShares;
      agg.cost -= avgCost * sellShares;
      if (agg.shares < 1e-9) { agg.shares = 0; agg.cost = 0; }
      agg.sellVol += usd;
      sellVolume += usd;
    }

    agg.volume += usd;
    agg.fills += 1;
    agg.lastTs = Math.max(agg.lastTs, t);
    byMarket.set(asset, agg);

    makerVolume += usd;
    counted += 1;
    if (firstTs === null || t < firstTs) firstTs = t;
    if (lastTs === null || t > lastTs) lastTs = t;
  }

  return { byMarket, realized, makerVolume, buyVolume, sellVolume, firstTs, lastTs, counted };
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export async function GET(
  _req: NextRequest,
  // Explicit params type: the RouteContext<'…/lp'> typed-route entry is only
  // generated on the next `next dev`/`next build`, which would break tsc here.
  ctx: { params: Promise<{ address: string }> }
) {
  const { address } = await ctx.params;
  const apiKey = process.env.GRAPH_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { available: false, error: 'GRAPH_API_KEY not configured' },
      { status: 200 }
    );
  }

  try {
    const fills = await fetchMakerGraphFills(address, apiKey);
    const { byMarket, realized, makerVolume, buyVolume, sellVolume, firstTs, lastTs, counted } =
      replayMakerFills(fills);

    const ranked = [...byMarket.entries()]
      .sort((a, b) => b[1].volume - a[1].volume)
      .slice(0, TOP_MARKETS);

    const titles = await resolveTokenTitles(ranked.map(([id]) => id));

    const markets: LpMarketBreakdown[] = ranked.map(([id, m]) => ({
      id,
      title: titles.get(id)?.title ?? null,
      outcome: titles.get(id)?.outcome ?? null,
      realized: r2(m.realized),
      volume: r2(m.volume),
      fills: m.fills,
      invShares: r2(m.shares),
      invCost: r2(m.cost),
      lastTs: m.lastTs,
    }));

    const body: LpResponse = {
      available: true,
      realized: r2(realized),
      makerVolume: r2(makerVolume),
      fills: counted,
      marketCount: byMarket.size,
      buyVolume: r2(buyVolume),
      sellVolume: r2(sellVolume),
      firstTs,
      lastTs,
      markets,
    };

    return NextResponse.json(body, {
      headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to compute LP earnings' }, { status: 500 });
  }
}
