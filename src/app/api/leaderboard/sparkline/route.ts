import { NextRequest, NextResponse } from 'next/server';
import { dataFailure, isWallet, NO_STORE, readDataJson } from '@/lib/publicDataApi';
import { downsamplePnl, parsePnlSeries } from '@/lib/pnlSeriesV2';

const MAX_WALLETS = 20;
const POINTS = 20;

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('wallets') ?? '';
  const wallets = raw.split(',').map(wallet => wallet.trim());
  if (!raw || wallets.length === 0 || wallets.length > MAX_WALLETS || wallets.some(wallet => !isWallet(wallet))) {
    return NextResponse.json({ error: 'wallets must contain 1 to 20 valid wallet addresses.' }, { status: 400, headers: NO_STORE });
  }

  try {
    const results = await Promise.all(wallets.map(async wallet => {
      const params = new URLSearchParams({ user: wallet, interval: '1w', fidelity: '1d' });
      const series = parsePnlSeries(await readDataJson('user-pnl', params, req.signal), wallet, '1w', '1d');
      return [wallet, downsamplePnl(series.points, POINTS).map(point => point.pnl)] as const;
    }));
    const map: Record<string, number[]> = {};
    for (const [wallet, values] of results) map[wallet] = values;
    return NextResponse.json(map, { headers: NO_STORE });
  } catch (error) {
    return dataFailure(error);
  }
}