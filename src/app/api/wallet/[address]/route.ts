import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Accept: 'application/json',
};

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<'/api/wallet/[address]'>
) {
  const { address } = await ctx.params;

  try {
    const [positionsRes, valueRes] = await Promise.allSettled([
      fetch(
        `https://data-api.polymarket.com/positions?user=${address}&limit=500`,
        { headers: HEADERS }
      ),
      fetch(
        `https://data-api.polymarket.com/value?user=${address}`,
        { headers: HEADERS }
      ),
    ]);

    let positions: unknown[] = [];
    if (positionsRes.status === 'fulfilled' && positionsRes.value.ok) {
      const json = await positionsRes.value.json();
      positions = Array.isArray(json) ? json : (json.value ?? []);
    }

    let totalValue = 0;
    if (valueRes.status === 'fulfilled' && valueRes.value.ok) {
      const json = await valueRes.value.json();
      const val = Array.isArray(json) ? json[0] : json;
      totalValue = val?.value ?? 0;
    }

    return NextResponse.json({ positions, totalValue });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch wallet data' }, { status: 500 });
  }
}
