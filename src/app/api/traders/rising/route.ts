import { NextResponse } from 'next/server';
import { dataFailure, NO_STORE, readLeaderboard } from '@/lib/publicDataApi';

export async function GET() {
  try {
    const result = await readLeaderboard('1w', 6);
    return NextResponse.json(result.data, { headers: { ...NO_STORE, 'X-Data-Truncated': String(result.truncated), 'X-Volume-Unit': 'shares' } });
  } catch (error) { return dataFailure(error); }
}
