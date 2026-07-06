import { NextRequest, NextResponse } from 'next/server';
import { scanRewardFarms } from '@/lib/rewards';
import { recordLpSnapshot } from '@/lib/lpSnapshots';
import { kvEnabled } from '@/lib/kv';

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
    return NextResponse.json({ ok: true, wrote, markets: farms.length, ts: Date.now() });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
