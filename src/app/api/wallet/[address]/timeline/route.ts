import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { RecentTrade } from '@/types';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Accept: 'application/json',
};

function tsOf(t: RecentTrade): number {
  return Number(t.timestamp ?? t.createdAt ?? 0);
}

function usdOf(t: RecentTrade): number {
  const u = Number(t.usdcSize ?? 0);
  if (u > 0) return u;
  return Number(t.size ?? 0) * Number(t.price ?? 0);
}

export interface TimelinePoint {
  t: number;   // unix seconds
  pnl: number; // cumulative realized P&L at this point
}

export interface TimelineResponse {
  points: TimelinePoint[];
  realized: number;
  trades: number;
  /** True when the wallet hit the data-api's 3,500-trade public ceiling */
  ceiling: boolean;
  /** Data provenance — 'graph' means full history, 'data-api' means capped */
  source?: 'graph' | 'data-api';
}

function downsample(points: TimelinePoint[], max: number): TimelinePoint[] {
  if (points.length <= max) return points;
  const step = points.length / max;
  const out: TimelinePoint[] = [];
  for (let i = 0; i < max; i++) out.push(points[Math.floor(i * step)]);
  out.push(points[points.length - 1]);
  return out;
}

// ── The Graph (Polymarket subgraph) ────────────────────────────────────────

interface GraphFill {
  id: string;
  timestamp: string;
  side: string;        // 'Buy' | 'Sell' — from taker's perspective
  size: string;        // micro-shares (÷ 1e6)
  price: string;       // decimal 0-1
  market: { id: string };
  maker: { id: string };
  taker: { id: string };
}

const SUBGRAPH_URL = (key: string) =>
  `https://gateway-arbitrum.network.thegraph.com/api/${key}/subgraphs/id/81Dm16JjuFSrqz813HysXoUPvzTwE7fsfPk2RTf66nyC`;

const TAKER_QUERY = `
  query TakerFills($wallet: String!, $skip: Int!) {
    enrichedOrderFilleds(
      first: 1000
      skip: $skip
      where: { taker: $wallet }
      orderBy: timestamp
      orderDirection: asc
    ) {
      id timestamp side size price
      market { id }
      maker { id }
      taker { id }
    }
  }
`;

const MAKER_QUERY = `
  query MakerFills($wallet: String!, $skip: Int!) {
    enrichedOrderFilleds(
      first: 1000
      skip: $skip
      where: { maker: $wallet }
      orderBy: timestamp
      orderDirection: asc
    ) {
      id timestamp side size price
      market { id }
      maker { id }
      taker { id }
    }
  }
`;

async function fetchFillPage(
  url: string,
  query: string,
  wallet: string,
  skip: number,
): Promise<GraphFill[]> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { wallet, skip } }),
    });
    if (!res.ok) return [];
    const json = await res.json();
    return (json?.data?.enrichedOrderFilleds ?? []) as GraphFill[];
  } catch {
    return [];
  }
}

/** Paginate one role (taker or maker) until an under-full page arrives. */
async function fetchSide(
  url: string,
  wallet: string,
  asMaker: boolean,
): Promise<Array<GraphFill & { isTaker: boolean }>> {
  const query = asMaker ? MAKER_QUERY : TAKER_QUERY;
  const out: Array<GraphFill & { isTaker: boolean }> = [];
  for (let p = 0; p < 500; p++) {
    const batch = await fetchFillPage(url, query, wallet, p * 1000);
    for (const f of batch) out.push({ ...f, isTaker: !asMaker });
    if (batch.length < 1000) break;
  }
  return out;
}

/** Fetch every fill for a wallet (both maker and taker roles), deduped by id. */
async function fetchAllGraphFills(
  address: string,
  apiKey: string,
): Promise<Array<GraphFill & { isTaker: boolean }>> {
  const url = SUBGRAPH_URL(apiKey);
  const wallet = address.toLowerCase();

  // Both sides are independent — run concurrently; each paginates sequentially.
  const [takerFills, makerFills] = await Promise.all([
    fetchSide(url, wallet, false),
    fetchSide(url, wallet, true),
  ]);

  const seen = new Set<string>();
  const fills: Array<GraphFill & { isTaker: boolean }> = [];
  for (const f of [...takerFills, ...makerFills]) {
    if (!seen.has(f.id)) { seen.add(f.id); fills.push(f); }
  }
  return fills;
}

/**
 * Cost-basis P&L replay over Graph fills.
 * side is recorded from the taker's perspective; flip it for the maker role.
 */
function replayGraphFills(
  fills: Array<GraphFill & { isTaker: boolean }>,
): { points: TimelinePoint[]; realized: number } {
  const sorted = fills.slice().sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
  const book = new Map<string, { shares: number; cost: number }>();
  const points: TimelinePoint[] = [];
  let realized = 0;

  for (const f of sorted) {
    const asset = f.market.id;
    const t = Number(f.timestamp);
    const shares = Number(f.size) / 1e6;
    const usd = shares * Number(f.price);
    if (!asset || !t || shares <= 0) continue;

    // side='Buy' means the taker was buying; the maker was therefore selling.
    const walletIsBuying = f.isTaker ? f.side === 'Buy' : f.side !== 'Buy';

    const pos = book.get(asset) ?? { shares: 0, cost: 0 };
    if (!walletIsBuying) {
      const sellShares = Math.min(shares, pos.shares);
      const avgCost = pos.shares > 0 ? pos.cost / pos.shares : 0;
      realized += usd - avgCost * sellShares;
      pos.shares -= sellShares;
      pos.cost -= avgCost * sellShares;
      if (pos.shares < 1e-9) { pos.shares = 0; pos.cost = 0; }
    } else {
      pos.shares += shares;
      pos.cost += usd;
    }
    book.set(asset, pos);
    points.push({ t, pnl: Math.round(realized * 100) / 100 });
  }

  return { points, realized };
}

// ── Route handler ──────────────────────────────────────────────────────────

/**
 * Builds a cumulative realized P&L equity curve from a wallet's trade history.
 * Tries The Graph subgraph first (full history); falls back to the data-api
 * (3,500-trade hard ceiling) when the subgraph returns no results.
 */
export async function GET(
  _req: NextRequest,
  ctx: RouteContext<'/api/wallet/[address]/timeline'>
) {
  const { address } = await ctx.params;
  const apiKey = process.env.GRAPH_API_KEY;

  // ── Path 1: The Graph — no offset ceiling ──────────────────────────────
  if (apiKey) {
    try {
      const fills = await fetchAllGraphFills(address, apiKey);
      if (fills.length > 0) {
        const { points: rawPoints, realized } = replayGraphFills(fills);
        const series = downsample(rawPoints, 300);
        const body: TimelineResponse = {
          points: series,
          realized: Math.round(realized * 100) / 100,
          trades: fills.length,
          ceiling: false,
          source: 'graph',
        };
        return NextResponse.json(body, {
          headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
        });
      }
    } catch {
      // Subgraph unavailable — fall through to data-api.
    }
  }

  // ── Path 2: data-api fallback — 3,500-trade hard ceiling ──────────────
  //
  // data-api.polymarket.com enforces offset > 3000 → HTTP 400.
  // No cursor, timestamp, or sort param bypasses this ceiling.
  const PAGE = 500;
  const MAX_OFFSET = 3000;
  const pageCount = MAX_OFFSET / PAGE + 1; // pages 0..6

  try {
    const results = await Promise.all(
      Array.from({ length: pageCount }, (_, p) =>
        fetch(
          `https://data-api.polymarket.com/trades?user=${address}&limit=${PAGE}&offset=${p * PAGE}`,
          { headers: HEADERS, next: { revalidate: 3600 } }
        ).then(r => r.ok ? r.json() : null).catch(() => null)
      )
    );

    const trades: RecentTrade[] = [];
    for (const json of results) {
      if (!json) continue;
      const batch: RecentTrade[] = Array.isArray(json) ? json : (json?.value ?? json?.data ?? []);
      trades.push(...batch);
    }

    trades.sort((a, b) => tsOf(a) - tsOf(b));

    const book = new Map<string, { shares: number; cost: number }>();
    const points: TimelinePoint[] = [];
    let realized = 0;

    for (const tr of trades) {
      const asset = String(tr.asset ?? '');
      const t = tsOf(tr);
      const usd = usdOf(tr);
      const shares = Number(tr.size ?? 0);
      const side = String(tr.side ?? '').toUpperCase();
      if (!asset || !t || shares <= 0) continue;

      const pos = book.get(asset) ?? { shares: 0, cost: 0 };
      if (side === 'SELL') {
        const sellShares = Math.min(shares, pos.shares);
        const avgCost = pos.shares > 0 ? pos.cost / pos.shares : 0;
        realized += usd - avgCost * sellShares;
        pos.shares -= sellShares;
        pos.cost -= avgCost * sellShares;
        if (pos.shares < 1e-9) { pos.shares = 0; pos.cost = 0; }
      } else {
        pos.shares += shares;
        pos.cost += usd;
      }
      book.set(asset, pos);
      points.push({ t, pnl: Math.round(realized * 100) / 100 });
    }

    const series = downsample(points, 300);

    const body: TimelineResponse = {
      points: series,
      realized: Math.round(realized * 100) / 100,
      trades: trades.length,
      ceiling: trades.length >= pageCount * PAGE,
      source: 'data-api',
    };

    return NextResponse.json(body, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to build timeline' }, { status: 500 });
  }
}
