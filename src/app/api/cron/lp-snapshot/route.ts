import { NextRequest, NextResponse } from 'next/server';
import { scanRewardFarms } from '@/lib/rewards';
import { recordLpSnapshot } from '@/lib/lpSnapshots';
import { kvEnabled } from '@/lib/kv';
import { readKalshiRewards } from '@/lib/kalshiRewardsCache';
import { recordKalshiSnapshot } from '@/lib/kalshiSnapshots';

export const maxDuration = 60;

/* Snapshot backstop — hit by Vercel Cron (daily) and optionally by an
   external pinger (e.g. cron-job.org every 10 min) for a denser series.
   If CRON_SECRET is set, requests must carry it as a Bearer token. */

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  if (!kvEnabled) {
    return NextResponse.json({ ok: false, reason: 'KV not configured (set UPSTASH_REDIS_REST_URL / _TOKEN)' });
  }

  try {
    const { farms } = await scanRewardFarms();
    const wrote = await recordLpSnapshot(farms, true);
    // Kalshi history (its own 30-min lock, so the 10-min pinger records it every third call). Never fails the Polymarket write.
    let kalshi: { wrote: boolean; markets: number } | { error: string };
    try {
      const k = await readKalshiRewards();
      kalshi = k.complete
        ? { wrote: await recordKalshiSnapshot({ programs: k.marketsWithRewards, totalDaily: Math.round(k.totalDailyRewards), markets: k.snapshot }), markets: k.snapshot.length }
        : { error: 'partial Kalshi scan, not recorded' };
    } catch (e) {
      kalshi = { error: String(e) };
    }
    return NextResponse.json({ ok: true, wrote, markets: farms.length, kalshi, ts: Date.now() });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
