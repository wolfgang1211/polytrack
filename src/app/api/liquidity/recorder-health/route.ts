import { NextResponse } from 'next/server';
import { readLpSnapshots } from '@/lib/lpSnapshots';
import { kvEnabled } from '@/lib/kv';

/* Recorder Health (LH-10) — diagnostics for the lpSnapshots series that the
 * Backtester and Vacancy Radar replay. Answers three questions the rest of the
 * Hub can't: is the 10-minute recorder actually alive, how much usable history
 * has it accumulated, and how much of that history is broken by gaps.
 *
 * Everything is derived from the recorded series — no extra storage. Coverage
 * is credited with the SAME 3h gap cap the Backtester uses, so "covered hours"
 * here matches what a 7-day backtest would actually be able to replay.
 */

const TARGET_HOURS = 24 * 7;       // 7-day goal the Backtester wants full data for
const CADENCE_MIN = 10;            // recorder writes at most once / 10 min
const GAP_CAP_MS = 3 * 3_600_000;  // matches backtest: gaps beyond 3h aren't credited
const GAP_MISS_MS = 30 * 60_000;   // a >30-min gap = at least one missed beat
const MAX_BUCKETS = 168;           // hourly density, capped at one week

export type RecorderStatus = 'disabled' | 'empty' | 'healthy' | 'delayed' | 'stale';

export interface RecorderHealthResponse {
  enabled: boolean;
  status: RecorderStatus;
  snapshots: number;
  oldestTs: number | null;
  newestTs: number | null;
  historyHours: number;        // wall-clock span oldest→newest
  coveredHours: number;        // credited hours (gaps capped at 3h) — replayable
  coveragePct: number;         // coveredHours / TARGET_HOURS, capped at 100
  targetHours: number;
  lastAgeMin: number | null;   // minutes since the newest snapshot
  medianIntervalMin: number | null;
  cadenceMin: number;          // configured target cadence
  gapsOverMiss: number;        // gaps > 30 min (missed beats)
  gapsOverCap: number;         // gaps > 3h (break backtest coverage)
  longestGapHours: number;
  marketsLatest: number;       // markets in the newest snapshot
  marketsAvg: number;          // avg markets/snapshot
  buckets: { t: number; count: number }[]; // hourly snapshot counts, oldest→newest
}

const r1 = (n: number) => Math.round(n * 10) / 10;

function empty(status: RecorderStatus, enabled: boolean): RecorderHealthResponse {
  return {
    enabled, status,
    snapshots: 0, oldestTs: null, newestTs: null,
    historyHours: 0, coveredHours: 0, coveragePct: 0, targetHours: TARGET_HOURS,
    lastAgeMin: null, medianIntervalMin: null, cadenceMin: CADENCE_MIN,
    gapsOverMiss: 0, gapsOverCap: 0, longestGapHours: 0,
    marketsLatest: 0, marketsAvg: 0, buckets: [],
  };
}

export async function GET() {
  if (!kvEnabled) {
    return NextResponse.json(empty('disabled', false));
  }

  try {
    const snapsNewestFirst = await readLpSnapshots(1000);
    if (snapsNewestFirst.length === 0) {
      return NextResponse.json(empty('empty', true));
    }

    const snaps = [...snapsNewestFirst].sort((a, b) => a.ts - b.ts); // oldest first
    const now = Date.now();
    const oldestTs = snaps[0].ts;
    const newestTs = snaps[snaps.length - 1].ts;

    // Interval + gap analysis over consecutive snapshots.
    const deltas: number[] = [];
    let coveredMs = 0;
    let gapsOverMiss = 0;
    let gapsOverCap = 0;
    let longestGapMs = 0;
    for (let i = 1; i < snaps.length; i++) {
      const d = snaps[i].ts - snaps[i - 1].ts;
      if (d <= 0) continue;
      deltas.push(d);
      coveredMs += Math.min(d, GAP_CAP_MS);
      if (d > GAP_MISS_MS) gapsOverMiss++;
      if (d > GAP_CAP_MS) gapsOverCap++;
      if (d > longestGapMs) longestGapMs = d;
    }

    const medianIntervalMin = deltas.length
      ? (() => {
          const sorted = [...deltas].sort((a, b) => a - b);
          const mid = Math.floor(sorted.length / 2);
          const m = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
          return r1(m / 60_000);
        })()
      : null;

    const lastAgeMin = r1((now - newestTs) / 60_000);
    const coveredHours = r1(coveredMs / 3_600_000);

    // Freshness → status. Tolerate two missed beats before flagging.
    let status: RecorderStatus;
    if (lastAgeMin <= CADENCE_MIN * 2) status = 'healthy';
    else if (lastAgeMin <= 90) status = 'delayed';
    else status = 'stale';

    // Hourly density buckets (oldest→newest), capped at one week of history.
    const bucketStart = Math.max(oldestTs, now - MAX_BUCKETS * 3_600_000);
    const bucketMap = new Map<number, number>();
    for (const s of snaps) {
      if (s.ts < bucketStart) continue;
      const hour = Math.floor(s.ts / 3_600_000) * 3_600_000;
      bucketMap.set(hour, (bucketMap.get(hour) ?? 0) + 1);
    }
    // Fill every hour in range so gaps render as empty bars.
    const buckets: { t: number; count: number }[] = [];
    const firstHour = Math.floor(bucketStart / 3_600_000) * 3_600_000;
    const lastHour = Math.floor(now / 3_600_000) * 3_600_000;
    for (let h = firstHour; h <= lastHour; h += 3_600_000) {
      buckets.push({ t: h, count: bucketMap.get(h) ?? 0 });
    }

    const marketsTotal = snaps.reduce((s, x) => s + x.markets.length, 0);

    const body: RecorderHealthResponse = {
      enabled: true,
      status,
      snapshots: snaps.length,
      oldestTs,
      newestTs,
      historyHours: r1((newestTs - oldestTs) / 3_600_000),
      coveredHours,
      coveragePct: r1(Math.min(100, (coveredHours / TARGET_HOURS) * 100)),
      targetHours: TARGET_HOURS,
      lastAgeMin,
      medianIntervalMin,
      cadenceMin: CADENCE_MIN,
      gapsOverMiss,
      gapsOverCap,
      longestGapHours: r1(longestGapMs / 3_600_000),
      marketsLatest: snaps[snaps.length - 1].markets.length,
      marketsAvg: Math.round(marketsTotal / snaps.length),
      buckets,
    };

    return NextResponse.json(body, {
      headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
