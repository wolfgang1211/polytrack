/* LP market history recorder — periodically snapshots reward-farm state
   (liquidity, spread, daily pool) into Upstash. This is the data moat:
   spread volatility, pool crowding trends and the Vacancy Radar are all
   built on this series. Snapshots are opportunistic (piggyback on API
   traffic) plus a daily cron backstop; writes are rate-limited. */

import { kvEnabled, kvGet, kvSet, kvLPush, kvLTrim, kvLRange } from '@/lib/kv';
import type { RewardFarm } from '@/lib/rewards';

const SNAP_KEY = 'lp:snapshots';           // list of JSON snapshots, newest first
const LOCK_KEY = 'lp:snapshots:lock';      // rate-limit marker
const MIN_INTERVAL_SEC = 600;              // at most one snapshot / 10 min
const MAX_SNAPSHOTS = 1100;                // >1 week at 10-min cadence — leaves
                                           // headroom so LTRIM can't pin history
                                           // below the 168h coverage target

export interface LpSnapshotEntry {
  id: string;        // conditionId
  liq: number;
  spread: number;
  rate: number;      // daily reward pool
  vol24h: number;
}

export interface LpSnapshot {
  ts: number;
  markets: LpSnapshotEntry[];
}

export async function recordLpSnapshot(farms: RewardFarm[], force = false): Promise<boolean> {
  if (!kvEnabled || farms.length === 0) return false;

  if (!force) {
    const locked = await kvGet(LOCK_KEY);
    if (locked) return false;
  }
  await kvSet(LOCK_KEY, '1', MIN_INTERVAL_SEC);

  const snap: LpSnapshot = {
    ts: Date.now(),
    markets: farms.map(f => ({
      id: f.conditionId,
      liq: Math.round(f.liquidity),
      spread: Math.round(f.spread * 1000) / 1000,
      rate: Math.round(f.dailyRate * 100) / 100,
      vol24h: Math.round(f.volume24h),
    })),
  };

  await kvLPush(SNAP_KEY, JSON.stringify(snap));
  await kvLTrim(SNAP_KEY, 0, MAX_SNAPSHOTS - 1);
  return true;
}

/** Read snapshots, newest first.
 *
 * Chunked LRANGE: a single 0..limit read of the full series is a multi-MB
 * REST response, and oversized responses are the prime suspect for the
 * truncated reads observed on 2026-07-09/10 (the series appeared to "grow
 * backwards" when fuller reads later revealed the real tail). Small pages
 * keep each response comfortably under any size ceiling. */
const READ_PAGE = 250;

export async function readLpSnapshots(limit = 200): Promise<LpSnapshot[]> {
  if (!kvEnabled) return [];
  const out: LpSnapshot[] = [];
  for (let start = 0; start < limit; start += READ_PAGE) {
    const stop = Math.min(start + READ_PAGE, limit) - 1;
    const raw = await kvLRange(SNAP_KEY, start, stop);
    if (!raw || raw.length === 0) break;
    for (const s of raw) {
      try { out.push(JSON.parse(s) as LpSnapshot); } catch { /* skip */ }
    }
    if (raw.length < stop - start + 1) break; // end of list
  }
  return out;
}
