import { NextResponse } from 'next/server';
import { scanRewardFarms } from '@/lib/rewards';
import { recordLpSnapshot } from '@/lib/lpSnapshots';

export async function GET() {
  try {
    const { farms, scanned } = await scanRewardFarms();
    const totalDailyRewards = farms.reduce((s, f) => s + f.dailyRate, 0);

    // Opportunistic history recording (rate-limited inside; no-op without KV).
    recordLpSnapshot(farms).catch(() => {});

    return NextResponse.json(
      { farms: farms.slice(0, 30), totalDailyRewards, marketsWithRewards: farms.length, scanned, updatedAt: Date.now() },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
    );
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
