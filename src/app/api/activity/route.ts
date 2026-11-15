import { NextResponse } from 'next/server';
import { dataFailure, NO_STORE, readTrades } from '@/lib/publicDataApi';

export async function GET() {
  try {
    const result = await readTrades();
    return NextResponse.json({ trades: result.data, count: result.data.length, truncated: result.truncated, source: 'polymarket-data-v2' }, { headers: NO_STORE });
  } catch (error) { return dataFailure(error); }
}
