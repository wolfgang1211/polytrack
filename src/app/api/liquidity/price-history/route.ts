import { NextRequest, NextResponse } from 'next/server';
import { CLOB_BASE } from '@/lib/clob';

export interface PricePoint { t: number; p: number }   // t = unix ms, p = price (0–1)
export interface PriceHistory {
  tokenId: string;
  interval: string;
  points: PricePoint[];
  first: number | null;
  last: number | null;
  min: number | null;
  max: number | null;
  changePct: number | null;   // (last - first) / first
}

// Map our UI windows to the CLOB prices-history intervals.
const INTERVALS: Record<string, string> = {
  '1d': '1d', '1w': '1w', '1m': '1m', max: 'max',
};

export async function GET(req: NextRequest) {
  const tokenId  = req.nextUrl.searchParams.get('tokenId');
  const intervalQ = req.nextUrl.searchParams.get('interval') ?? '1w';
  const interval = INTERVALS[intervalQ] ?? '1w';
  if (!tokenId) return NextResponse.json({ error: 'tokenId required' }, { status: 400 });

  try {
    const res = await fetch(
      `${CLOB_BASE}/prices-history?market=${tokenId}&interval=${interval}&fidelity=1`,
      { headers: { Accept: 'application/json' }, next: { revalidate: 120 } }
    );
    if (!res.ok) return NextResponse.json({ error: `CLOB ${res.status}` }, { status: res.status });

    const json: { history?: { t: number; p: number }[] } = await res.json();
    const raw = Array.isArray(json.history) ? json.history : [];

    const points: PricePoint[] = raw
      .map(h => ({ t: Number(h.t) * 1000, p: Number(h.p) }))
      .filter(pt => Number.isFinite(pt.t) && pt.p > 0 && pt.p < 1);

    const prices = points.map(p => p.p);
    const first = prices.length ? prices[0] : null;
    const last  = prices.length ? prices[prices.length - 1] : null;
    const min   = prices.length ? Math.min(...prices) : null;
    const max   = prices.length ? Math.max(...prices) : null;
    const changePct = first && last ? (last - first) / first : null;

    const out: PriceHistory = { tokenId, interval, points, first, last, min, max, changePct };
    return NextResponse.json(out, {
      headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=240' },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
