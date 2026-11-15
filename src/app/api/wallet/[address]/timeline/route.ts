import { NextRequest, NextResponse } from 'next/server';
import { dataFailure, isWallet, NO_STORE, readDataJson } from '@/lib/publicDataApi';
import { downsamplePnl, parsePnlSeries } from '@/lib/pnlSeriesV2';

export interface TimelineResponse {
  points: { t: number; pnl: number }[];
  latestPnl: number | null;
  tradeCount: number | null;
  metric: 'trade_pnl';
  source: 'data-api-v2';
}

export async function GET(
  req: NextRequest,
  ctx: RouteContext<'/api/wallet/[address]/timeline'>,
) {
  const { address } = await ctx.params;
  if (!isWallet(address)) {
    return NextResponse.json({ error: 'Invalid wallet address.' }, { status: 400, headers: NO_STORE });
  }

  try {
    const params = new URLSearchParams({ user: address, interval: 'all', fidelity: '1d' });
    const series = parsePnlSeries(await readDataJson('user-pnl', params, req.signal), address, 'all', '1d');
    const points = downsamplePnl(series.points, 300).map(({ t, pnl }) => ({ t, pnl }));
    const body: TimelineResponse = {
      points,
      latestPnl: series.latestPnl,
      tradeCount: series.tradeCount,
      metric: 'trade_pnl',
      source: 'data-api-v2',
    };
    return NextResponse.json(body, { headers: NO_STORE });
  } catch (error) {
    return dataFailure(error);
  }
}