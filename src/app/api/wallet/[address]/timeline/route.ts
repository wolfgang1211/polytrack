import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { RecentTrade } from '@/types';
import { fetchAllGraphFills, type GraphFill } from '@/lib/graphFills';

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
  /** Data provenance — user-pnl-api is Polymarket's pre-aggregated daily PnL API. */
  source?: 'user-pnl-api' | 'graph' | 'data-api';
}

function downsample(points: TimelinePoint[], max: number): TimelinePoint[] {
  if (points.length <= max) return points;

  // We still calculate PnL from EVERY trade, but the browser cannot draw tens of
  // thousands of SVG points smoothly. So we compress the visual curve while
  // preserving each bucket's start, low, high, and end points. This keeps spikes
  // visible and avoids the “flat/blank chart” effect on high-volume wallets.
  const bucketSize = Math.ceil(points.length / Math.max(1, Math.floor(max / 4)));
  const out: TimelinePoint[] = [];

  for (let i = 0; i < points.length; i += bucketSize) {
    const bucket = points.slice(i, i + bucketSize);
    if (!bucket.length) continue;

    let min = bucket[0];
    let maxPoint = bucket[0];
    for (const p of bucket) {
      if (p.pnl < min.pnl) min = p;
      if (p.pnl > maxPoint.pnl) maxPoint = p;
    }

    for (const p of [bucket[0], min, maxPoint, bucket[bucket.length - 1]]) {
      const last = out[out.length - 1];
      if (!last || last.t !== p.t || last.pnl !== p.pnl) out.push(p);
    }
  }

  const lastRaw = points[points.length - 1];
  const lastOut = out[out.length - 1];
  if (!lastOut || lastOut.t !== lastRaw.t || lastOut.pnl !== lastRaw.pnl) {
    out.push(lastRaw);
  }
  return out;
}

async function fetchPolymarketUserPnl(address: string): Promise<TimelinePoint[] | null> {
  try {
    const url = `https://user-pnl-api.polymarket.com/user-pnl?user_address=${address}&interval=all&fidelity=1d`;
    const res = await fetch(url, { headers: HEADERS, next: { revalidate: 1800 } });
    if (!res.ok) return null;
    const json = await res.json();
    if (!Array.isArray(json)) return null;

    const points = json
      .map((p: { t?: number; p?: number }) => ({ t: Number(p.t), pnl: Number(p.p) }))
      .filter((p: TimelinePoint) => Number.isFinite(p.t) && Number.isFinite(p.pnl) && p.t > 0)
      .sort((a: TimelinePoint, b: TimelinePoint) => a.t - b.t);

    return points.length ? points : null;
  } catch {
    return null;
  }
}

// ── The Graph (Polymarket subgraph) ────────────────────────────────────────
// Query definitions + pagination live in @/lib/graphFills (shared with the
// LP earnings endpoint — LH-8).

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
  req: NextRequest,
  ctx: RouteContext<'/api/wallet/[address]/timeline'>
) {
  const { address } = await ctx.params;
  const apiKey = process.env.GRAPH_API_KEY;
  const mode = req.nextUrl.searchParams.get('mode');

  // ── Path 0: Polymarket's pre-aggregated PnL API — fast full-history chart ──
  // Predicts.guru appears to use this endpoint. It returns daily PnL points in
  // ~100ms even for wallets with hundreds of thousands of trades, because the
  // heavy trade replay is already done upstream by Polymarket.
  if (mode !== 'graph') {
    const pnlPoints = await fetchPolymarketUserPnl(address);
    if (pnlPoints?.length) {
      const realized = pnlPoints[pnlPoints.length - 1].pnl;
      const body: TimelineResponse = {
        points: downsample(pnlPoints, 300),
        realized: Math.round(realized * 100) / 100,
        trades: 0,
        ceiling: false,
        source: 'user-pnl-api',
      };
      return NextResponse.json(body, {
        headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
      });
    }
  }

  // ── Path 1: The Graph — no offset ceiling ──────────────────────────────
  if (apiKey && mode !== 'fast') {
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
