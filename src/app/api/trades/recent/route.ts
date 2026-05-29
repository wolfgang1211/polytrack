import { NextResponse } from 'next/server';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Accept: 'application/json',
};

const MIN_USDC = 1_000;

export async function GET() {
  try {
    const res = await fetch(
      'https://data-api.polymarket.com/trades?limit=200',
      { headers: HEADERS, cache: 'no-store' }
    );
    if (!res.ok) return NextResponse.json({ error: `HTTP ${res.status}` }, { status: res.status });

    const json = await res.json();
    const raw: unknown[] = Array.isArray(json) ? json : (json.value ?? json.data ?? []);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const trades = raw.filter((t: any) => {
      const usdc = t.usdcSize ?? ((t.size ?? 0) * (t.price ?? 0));
      return Number(usdc) >= MIN_USDC;
    }).slice(0, 20);

    return NextResponse.json(trades);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch trades' }, { status: 500 });
  }
}
