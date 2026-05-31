import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Accept: 'application/json',
};

const TRADES_PER_WALLET = 80;
const POINTS = 20;

interface Trade { side?: string; asset?: string; usdcSize?: number; size?: number; price?: number; timestamp?: number; createdAt?: number }

function tsOf(t: Trade): number { return Number(t.timestamp ?? t.createdAt ?? 0); }
function usdOf(t: Trade): number {
  const u = Number(t.usdcSize ?? 0);
  return u > 0 ? u : Number(t.size ?? 0) * Number(t.price ?? 0);
}

/** Coarse cumulative *realized P&L* curve from a wallet's most recent fills —
 *  same per-asset cost-basis replay as the wallet timeline, so a profitable
 *  trader's spark trends up (not just raw cashflow). Kept cheap: one capped
 *  request per wallet, run in parallel, short cache. */
async function sparkFor(wallet: string): Promise<number[]> {
  try {
    const res = await fetch(
      `https://data-api.polymarket.com/trades?user=${wallet}&limit=${TRADES_PER_WALLET}&offset=0`,
      { headers: HEADERS, next: { revalidate: 300 } }
    );
    if (!res.ok) return [];
    const json = await res.json();
    const trades: Trade[] = Array.isArray(json) ? json : (json.value ?? json.data ?? []);
    if (!trades.length) return [];
    trades.sort((a, b) => tsOf(a) - tsOf(b));

    // per-asset average cost basis; realize P&L on sells
    const book = new Map<string, { shares: number; cost: number }>();
    let realized = 0;
    const series: number[] = [];
    for (const t of trades) {
      const asset = String(t.asset ?? '');
      const usd = usdOf(t);
      const shares = Number(t.size ?? 0);
      if (!asset || shares <= 0) continue;
      const pos = book.get(asset) ?? { shares: 0, cost: 0 };
      if (String(t.side ?? '').toUpperCase() === 'SELL') {
        const sell = Math.min(shares, pos.shares);
        const avg = pos.shares > 0 ? pos.cost / pos.shares : 0;
        realized += usd - avg * sell;
        pos.shares -= sell; pos.cost -= avg * sell;
        if (pos.shares < 1e-9) { pos.shares = 0; pos.cost = 0; }
      } else {
        pos.shares += shares; pos.cost += usd;
      }
      book.set(asset, pos);
      series.push(Math.round(realized * 100) / 100);
    }
    if (!series.length) return [];
    // downsample to POINTS
    if (series.length <= POINTS) return series;
    const step = series.length / POINTS;
    const out: number[] = [];
    for (let i = 0; i < POINTS; i++) out.push(series[Math.floor(i * step)]);
    out.push(series[series.length - 1]);
    return out;
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('wallets') ?? '';
  const wallets = raw.split(',').map(w => w.trim()).filter(Boolean).slice(0, 20);
  if (!wallets.length) return NextResponse.json({});

  const results = await Promise.all(wallets.map(async w => [w, await sparkFor(w)] as const));
  const map: Record<string, number[]> = {};
  for (const [w, s] of results) map[w] = s;

  return NextResponse.json(map, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  });
}
