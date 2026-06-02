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

  const PAGE = 500;
  // No hard page cap — stop naturally when the API returns a partial/empty page.
  // Safety ceiling of 600 pages (300,000 trades) guards against infinite loops on
  // API bugs; no real Polymarket wallet is expected to exceed this.
  const MAX_PAGES = 600;
  const BATCH = 20; // 20 concurrent requests per round → ~10s for 300-page wallets

  try {
    const trades: RecentTrade[] = [];
    let stop = false;
    for (let start = 0; start < MAX_PAGES && !stop; start += BATCH) {
      const end = Math.min(start + BATCH, MAX_PAGES);
      const pages = Array.from({ length: end - start }, (_, j) => start + j);
      const results = await Promise.all(pages.map(p =>
        fetch(
          `https://data-api.polymarket.com/trades?user=${address}&limit=${PAGE}&offset=${p * PAGE}`,
          // Historical trade pages are immutable — cache for 1 h to avoid
          // re-fetching thousands of pages on every wallet view.
          { headers: HEADERS, next: { revalidate: 3600 } }
        ).then(r => (r.ok ? r.json() : null)).catch(() => null)
      ));
      for (const json of results) {
        // null = transient network failure — skip this page, don't abort the whole fetch
        if (json === null || json === undefined) continue;
        const batch: RecentTrade[] = Array.isArray(json) ? json : (json?.value ?? json?.data ?? []);
        if (!batch.length) { stop = true; break; }   // empty page = data exhausted
        trades.push(...batch);
        if (batch.length < PAGE) { stop = true; break; } // partial page = last page
      }
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
    };

    return NextResponse.json(body, {
      // Cache for 1 h — trade history is append-only, old pages never change.
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to build timeline' }, { status: 500 });
  }
}
