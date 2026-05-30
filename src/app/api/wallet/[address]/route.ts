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

  const PAGE = 500;        // data-api max page size
  const MAX_PAGES = 6;     // cap at 3,000 positions to bound latency

  try {
    // Paginate positions so wallets with >500 lifetime positions aren't truncated.
    // sizeThreshold=0 includes closed/redeemed positions (which carry realizedPnl) —
    // otherwise lifetime P&L reads $0 for wallets with no open positions.
    const positions: unknown[] = [];
    let truncated = false;
    const fetchPage = (offset: number) =>
      fetch(
        `https://data-api.polymarket.com/positions?user=${address}&limit=${PAGE}&offset=${offset}&sizeThreshold=0`,
        { headers: HEADERS }
      );

    const valuePromise = fetch(
      `https://data-api.polymarket.com/value?user=${address}`,
      { headers: HEADERS }
    );

    for (let page = 0; page < MAX_PAGES; page++) {
      const res = await fetchPage(page * PAGE).catch(() => null);
      if (!res || !res.ok) break;
      const json = await res.json();
      const batch: unknown[] = Array.isArray(json) ? json : (json.value ?? []);
      positions.push(...batch);
      if (batch.length < PAGE) break;          // last page reached
      if (page === MAX_PAGES - 1) truncated = true; // hit the safety cap
    }

    let totalValue = 0;
    const valueRes = await valuePromise.catch(() => null);
    if (valueRes && valueRes.ok) {
      const json = await valueRes.json();
      const val = Array.isArray(json) ? json[0] : json;
      totalValue = val?.value ?? 0;
    }

    return NextResponse.json({ positions, totalValue, truncated });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch wallet data' }, { status: 500 });
  }
}
