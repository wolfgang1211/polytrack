import { NextRequest, NextResponse } from 'next/server';
import { dataFailure, isWindow, NO_STORE, readLeaderboard } from '@/lib/publicDataApi';

export async function GET(req: NextRequest) {
  const window = req.nextUrl.searchParams.get('window') ?? 'allTime';
  const rawLimit = req.nextUrl.searchParams.get('limit') ?? '100';
  const limit = Number(rawLimit);
  if (!isWindow(window) || !/^\d+$/.test(rawLimit) || !Number.isSafeInteger(limit) || limit < 1 || limit > 1000) {
    return NextResponse.json({ error: 'Invalid window or limit. Limit must be an integer from 1 to 1000.' }, { status: 400, headers: NO_STORE });
  }
  try {
    const result = await readLeaderboard(window, limit, req.signal);
    return NextResponse.json(result.data, { headers: { ...NO_STORE, 'X-Data-Truncated': String(result.truncated), 'X-Volume-Unit': 'shares' } });
  } catch (error) { return dataFailure(error); }
}
