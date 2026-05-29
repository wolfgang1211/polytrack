import { NextResponse } from 'next/server';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Accept: 'application/json',
};

const MIN_USDC = 10_000;

export async function GET() {
  try {
    const since = Math.floor(Date.now() / 1000) - 86_400;

    const res = await fetch(
      'https://data-api.polymarket.com/activity?type=TRADE&limit=500',
      { headers: HEADERS }
    );
    if (!res.ok) return NextResponse.json({ error: `HTTP ${res.status}` }, { status: res.status });

    const json = await res.json();
    const raw: unknown[] = Array.isArray(json) ? json : (json.value ?? json.data ?? []);

    const trades = raw
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((t: any) => {
        const usdc = t.usdcSize ?? t.amount ?? (t.size != null && t.price != null ? t.size * t.price : 0);
        const ts   = t.timestamp ?? t.createdAt ?? 0;
        return Number(usdc) >= MIN_USDC && Number(ts) >= since;
      })
      .slice(0, 20);

    return NextResponse.json(trades);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch trades' }, { status: 500 });
  }
}
