import { NextResponse } from 'next/server';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Accept: 'application/json',
};

const MIN_USDC = 1_000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function usdcOf(t: any): number {
  if (t.usdcSize != null) return Number(t.usdcSize);
  if (t.size != null && t.price != null) return Number(t.size) * Number(t.price);
  if (t.amount != null) return Number(t.amount);
  return 0;
}

export async function GET() {
  try {
    const res = await fetch(
      'https://data-api.polymarket.com/trades?limit=500',
      { headers: HEADERS, cache: 'no-store' }
    );
    if (!res.ok) return NextResponse.json({ error: `HTTP ${res.status}` }, { status: res.status });

    const json = await res.json();
    const raw: unknown[] = Array.isArray(json) ? json : (json.value ?? json.data ?? []);

    const big = raw
      .filter((t) => usdcOf(t) >= MIN_USDC)
      .sort((a, b) => usdcOf(b) - usdcOf(a))
      .slice(0, 20);

    if (big.length >= 5) {
      return NextResponse.json({ trades: big, belowThreshold: false });
    }

    const top = [...raw].sort((a, b) => usdcOf(b) - usdcOf(a)).slice(0, 20);
    return NextResponse.json({ trades: top, belowThreshold: big.length === 0 });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch trades' }, { status: 500 });
  }
}
