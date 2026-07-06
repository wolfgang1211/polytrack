import { NextResponse } from 'next/server';
import { scanRewardFarms } from '@/lib/rewards';
import { readLpSnapshots } from '@/lib/lpSnapshots';
import { kvEnabled } from '@/lib/kv';

/* Vacancy Radar — reward pools where competing liquidity just LEFT.
   When a maker pulls out, everyone still quoting earns a bigger share of
   the same daily pool. We compare current liquidity against the oldest
   snapshot within the last 24h and flag meaningful drops. */

export interface Vacancy {
  conditionId: string;
  question: string;
  slug: string;
  eventSlug?: string;
  image?: string;
  dailyRate: number;
  liquidityNow: number;
  liquidityThen: number;
  dropPct: number;        // how much liquidity left (%)
  shareGainPct: number;   // how much a $1K quoter's pool share improved (%)
  hoursAgo: number;       // age of the comparison snapshot
}

export async function GET() {
  try {
    if (!kvEnabled) {
      return NextResponse.json({ vacancies: [], enabled: false });
    }

    const [{ farms }, snapshots] = await Promise.all([
      scanRewardFarms(),
      readLpSnapshots(200),
    ]);

    // Oldest snapshot within 24h (list is newest-first).
    const cutoff = Date.now() - 24 * 3_600_000;
    const past = [...snapshots].reverse().find(s => s.ts >= cutoff) ?? snapshots[snapshots.length - 1];
    if (!past || Date.now() - past.ts < 30 * 60_000) {
      // No history yet (or only minutes old) — nothing meaningful to compare.
      return NextResponse.json({ vacancies: [], enabled: true, historyHours: past ? (Date.now() - past.ts) / 3_600_000 : 0 });
    }

    const pastById = new Map(past.markets.map(m => [m.id, m]));
    const hoursAgo = (Date.now() - past.ts) / 3_600_000;
    const CAP = 1_000;

    const vacancies: Vacancy[] = [];
    for (const f of farms) {
      const then = pastById.get(f.conditionId);
      if (!then || then.liq <= 0) continue;
      const dropPct = ((then.liq - f.liquidity) / then.liq) * 100;
      if (dropPct < 15) continue;               // meaningful exits only
      if (f.dailyRate <= 0) continue;
      const shareThen = CAP / (Math.max(then.liq, 10_000) + CAP);
      const shareNow = CAP / (Math.max(f.liquidity, 10_000) + CAP);
      const shareGainPct = shareThen > 0 ? ((shareNow - shareThen) / shareThen) * 100 : 0;
      if (shareGainPct <= 1) continue;          // floor swallowed the change
      vacancies.push({
        conditionId: f.conditionId,
        question: f.question,
        slug: f.slug,
        eventSlug: f.eventSlug,
        image: f.image,
        dailyRate: f.dailyRate,
        liquidityNow: f.liquidity,
        liquidityThen: then.liq,
        dropPct,
        shareGainPct,
        hoursAgo,
      });
    }

    vacancies.sort((a, b) => b.shareGainPct - a.shareGainPct);

    return NextResponse.json(
      { vacancies: vacancies.slice(0, 8), enabled: true, historyHours: hoursAgo },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
    );
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
