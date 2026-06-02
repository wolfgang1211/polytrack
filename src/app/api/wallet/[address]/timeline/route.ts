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
  // usdcSize is notional in USD; fall back to size*price.
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
}

/**
 * Builds a cumulative *realized* P&L equity curve from a wallet's trade
 * history. Polymarket's /positions only gives a current snapshot, so to draw
 * a timeline we replay every fill and track per-asset average cost basis:
 *   BUY  -> add shares & cost
 *   SELL -> realize (proceeds - avgCost * sharesSold)
 * Redemptions/resolutions arrive as sells at price ~1 or ~0 and fall out of
 * the same maths. The series is downsampled so the chart stays light.
 */
export async function GET(
  _req: NextRequest,
  ctx: RouteContext<'/api/wallet/[address]/timeline'>
) {
  const { address } = await ctx.params;

  // data-api.polymarket.com enforces a hard server-side limit: offset > 3000
  // returns HTTP 400 ("max historical activity offset of 3000 exceeded").
  // No cursor, timestamp, or sort parameter bypasses this — all are silently
  // ignored. The absolute maximum is 7 pages × 500 = 3,500 trades.
  const PAGE = 500;
  const MAX_OFFSET = 3000; // server hard limit
  const pageCount = MAX_OFFSET / PAGE + 1; // pages 0..6

  try {
    // Fetch all pages concurrently in one round — no batching loop needed.
    const results = await Promise.all(
      Array.from({ length: pageCount }, (_, p) =>
        fetch(
          `https://data-api.polymarket.com/trades?user=${address}&limit=${PAGE}&offset=${p * PAGE}`,
          // Each page URL is immutable — pages don't change after they're full.
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

    // Oldest -> newest so the replay is chronological.
    trades.sort((a, b) => tsOf(a) - tsOf(b));

    // Per-asset cost basis: shares held + total cost paid for those shares.
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
        // treat anything non-SELL as a buy
        pos.shares += shares;
        pos.cost += usd;
      }
      book.set(asset, pos);

      points.push({ t, pnl: Math.round(realized * 100) / 100 });
    }

    // Downsample to ~300 points — finer resolution for wallets with long histories.
    const MAX_POINTS = 300;
    let series = points;
    if (points.length > MAX_POINTS) {
      const step = points.length / MAX_POINTS;
      const out: TimelinePoint[] = [];
      for (let i = 0; i < MAX_POINTS; i++) out.push(points[Math.floor(i * step)]);
      out.push(points[points.length - 1]);
      series = out;
    }

    const body: TimelineResponse = {
      points: series,
      realized: Math.round(realized * 100) / 100,
      trades: trades.length,
      ceiling: trades.length >= pageCount * PAGE,
    };

    return NextResponse.json(body, {
      // Cache for 1 h — trade history is append-only, old pages never change.
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to build timeline' }, { status: 500 });
  }
}
