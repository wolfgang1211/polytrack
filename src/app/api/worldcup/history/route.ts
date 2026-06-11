import { NextRequest, NextResponse } from 'next/server';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Accept: 'application/json',
};

const INTERVALS = new Set(['1d', '1w', '1m', 'max']);

/** Price history for a CLOB token (e.g. a team's "Yes" share on the winner market). */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const token = sp.get('token');
  const interval = INTERVALS.has(sp.get('interval') ?? '') ? sp.get('interval')! : '1m';

  if (!token || !/^\d+$/.test(token)) {
    return NextResponse.json({ error: 'Missing or invalid token' }, { status: 400 });
  }

  // Coarser candles for longer windows keeps payloads small.
  const fidelity = interval === '1d' ? 10 : interval === '1w' ? 60 : 720;

  try {
    const res = await fetch(
      `https://clob.polymarket.com/prices-history?market=${token}&interval=${interval}&fidelity=${fidelity}`,
      { headers: HEADERS }
    );
    if (!res.ok) return NextResponse.json({ error: `HTTP ${res.status}` }, { status: res.status });

    const json = await res.json();
    const history: { t: number; p: number }[] = Array.isArray(json?.history) ? json.history : [];

    return NextResponse.json(
      { points: history.map(h => ({ t: h.t, p: h.p })) },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900' } }
    );
  } catch {
    return NextResponse.json({ error: 'Failed to fetch price history' }, { status: 500 });
  }
}
