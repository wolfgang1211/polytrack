import { NextResponse } from 'next/server';
import { dataFailure, NO_STORE, readTrades } from '@/lib/publicDataApi';

const MIN_USDC = 1_000;
export async function GET() {
  try {
    const result = await readTrades();
    const ordered = [...result.data].sort((a, b) => (b.usdcSize ?? 0) - (a.usdcSize ?? 0));
    const big = ordered.filter(t => (t.usdcSize ?? 0) >= MIN_USDC);
    const trades = (big.length >= 5 ? big : ordered).slice(0, 20);
    return NextResponse.json({ trades, belowThreshold: big.length === 0, truncated: result.truncated || result.data.length > trades.length, source: 'polymarket-data-v2', sampleSize: result.data.length }, { headers: NO_STORE });
  } catch (error) { return dataFailure(error); }
}
