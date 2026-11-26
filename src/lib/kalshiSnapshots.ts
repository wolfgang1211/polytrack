/* Kalshi LP history recorder — the Kalshi twin of lpSnapshots.ts. Each snapshot keeps the 300 markets with the
   largest daily pools (compact rows), every 30 minutes, about a week deep: enough for vacancy, pool-change and
   backtest views later without storing all ~7,000 programs every time. Opportunistic (piggybacks on the Kalshi
   rewards API) plus the existing lp-snapshot cron/pinger. Graceful no-op without KV. */
import { kvEnabled, kvGet, kvSet, kvLPush, kvLTrim, kvLRange } from '@/lib/kv';

export const KALSHI_SNAP_KEY = 'kalshi:lp:snapshots';
const LOCK_KEY = 'kalshi:lp:snapshots:lock';
export const KALSHI_SNAP_INTERVAL_SEC = 1800;
export const KALSHI_SNAP_MAX = 400;          // > 7 days at 30-min cadence
export const KALSHI_SNAP_MARKETS = 300;

export interface KalshiSnapshotRow {
  t: string;      // market ticker
  liq: number;    // $ at the best Yes + No bids
  sp: number;     // spread (fraction, 3 dp)
  r: number;      // daily pool $
  v: number;      // 24h volume, contracts
  bs: number;     // contracts at the best Yes bid
  as: number;     // contracts at the best Yes ask (= best No bid)
}
export interface KalshiSnapshot { ts: number; programs: number; totalDaily: number; markets: KalshiSnapshotRow[] }

export async function recordKalshiSnapshot(
  snap: Omit<KalshiSnapshot, 'ts'>, force = false, now = Date.now(),
): Promise<boolean> {
  if (!kvEnabled || snap.markets.length === 0) return false;
  if (!force && (await kvGet(LOCK_KEY))) return false;
  await kvSet(LOCK_KEY, '1', KALSHI_SNAP_INTERVAL_SEC - 60);
  await kvLPush(KALSHI_SNAP_KEY, JSON.stringify({ ts: now, ...snap, markets: snap.markets.slice(0, KALSHI_SNAP_MARKETS) }));
  await kvLTrim(KALSHI_SNAP_KEY, 0, KALSHI_SNAP_MAX - 1);
  return true;
}

/** Newest first, read in small pages (same reason as readLpSnapshots: oversized REST responses truncate). */
export async function readKalshiSnapshots(limit = 100): Promise<KalshiSnapshot[]> {
  if (!kvEnabled) return [];
  const out: KalshiSnapshot[] = [];
  const PAGE = 50;
  for (let start = 0; start < limit; start += PAGE) {
    const stop = Math.min(start + PAGE, limit) - 1;
    const raw = await kvLRange(KALSHI_SNAP_KEY, start, stop);
    if (!raw || raw.length === 0) break;
    for (const s of raw) { try { out.push(JSON.parse(s) as KalshiSnapshot); } catch { /* skip */ } }
    if (raw.length < stop - start + 1) break;
  }
  return out;
}
