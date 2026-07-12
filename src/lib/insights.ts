/**
 * Derived analytics for the Insights page — Phase 1.
 *
 * All functions are pure (no fetch, no state) so they can be unit-tested
 * and reused server-side later. Input is the leaderboard dataset that the
 * page already fetches; nothing here duplicates raw data shown elsewhere —
 * these are aggregations/transformations only.
 */

export interface PnlVolRow {
  pnl: number;
  vol: number;
}

/** Minimum volume for a trader to qualify for ROI ranking.
 *  Below this, ROI is statistically noisy (one lucky bet ≈ 500% ROI). */
export const ROI_MIN_VOLUME = 100_000;

/** Median of P&L values. Returns 0 for an empty dataset. */
export function medianPnl(rows: PnlVolRow[]): number {
  if (rows.length === 0) return 0;
  const sorted = rows.map(r => r.pnl).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** ROI (return on volume) as a fraction. 0 when volume is 0. */
export function roi(row: PnlVolRow): number {
  return row.vol > 0 ? row.pnl / row.vol : 0;
}

/** Top-N traders by ROI, filtered by a minimum volume so tiny wallets
 *  with one lucky bet don't dominate. Keeps original objects. */
export function roiLeaders<T extends PnlVolRow>(
  rows: T[],
  n = 3,
  minVolume = ROI_MIN_VOLUME
): (T & { roiPct: number })[] {
  return rows
    .filter(r => r.vol >= minVolume)
    .map(r => ({ ...r, roiPct: roi(r) * 100 }))
    .sort((a, b) => b.roiPct - a.roiPct)
    .slice(0, n);
}

export interface HistogramBucket {
  label: string;
  min: number;
  max: number; // Infinity for the open-ended bucket
  count: number;
}

const HISTOGRAM_EDGES: { label: string; min: number; max: number }[] = [
  { label: '<$1M',    min: -Infinity, max: 1_000_000 },
  { label: '$1–5M',   min: 1_000_000, max: 5_000_000 },
  { label: '$5–10M',  min: 5_000_000, max: 10_000_000 },
  { label: '>$10M',   min: 10_000_000, max: Infinity },
];

/** Bucket traders by P&L. Buckets are [min, max). Every row lands in
 *  exactly one bucket, so counts always sum to rows.length. */
export function pnlHistogram(rows: PnlVolRow[]): HistogramBucket[] {
  const buckets = HISTOGRAM_EDGES.map(e => ({ ...e, count: 0 }));
  for (const r of rows) {
    const b = buckets.find(b => r.pnl >= b.min && r.pnl < b.max);
    if (b) b.count++;
  }
  return buckets;
}

export interface ConcentrationStats {
  top3VolPct: number;
  top10VolPct: number;
  top3PnlPct: number;
  top10PnlPct: number;
  totalVol: number;
  totalPnl: number;
}

/** Share of total volume / P&L held by the top 3 and top 10 traders.
 *  "Top" is measured within each metric (top by vol for vol share,
 *  top by pnl for pnl share). Percentages are 0–100; 0 when total ≤ 0. */
export function concentration(rows: PnlVolRow[]): ConcentrationStats {
  const totalVol = rows.reduce((s, r) => s + r.vol, 0);
  const totalPnl = rows.reduce((s, r) => s + r.pnl, 0);

  const share = (sorted: number[], n: number, total: number) =>
    total > 0 ? (sorted.slice(0, n).reduce((s, v) => s + v, 0) / total) * 100 : 0;

  const volsDesc = rows.map(r => r.vol).sort((a, b) => b - a);
  const pnlsDesc = rows.map(r => r.pnl).sort((a, b) => b - a);

  return {
    top3VolPct:  share(volsDesc, 3, totalVol),
    top10VolPct: share(volsDesc, 10, totalVol),
    top3PnlPct:  share(pnlsDesc, 3, totalPnl),
    top10PnlPct: share(pnlsDesc, 10, totalPnl),
    totalVol,
    totalPnl,
  };
}
