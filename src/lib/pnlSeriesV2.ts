import { isWallet, numeric, PublicDataUnavailable, record } from '@/lib/publicDataApi';

export interface PnlSeriesPoint {
  t: number;
  pnl: number;
  tradeCount?: number;
}

export interface PnlSeries {
  proxyWallet: string;
  interval: string;
  fidelity: string;
  sourceFidelity: string;
  points: PnlSeriesPoint[];
  latestPnl: number | null;
  tradeCount: number | null;
}

function text(row: Record<string, unknown>, key: string): string {
  if (typeof row[key] !== 'string' || !row[key]) throw new PublicDataUnavailable();
  return row[key] as string;
}

/** Validate the complete, cumulative v2 user-pnl envelope without defaulting nulls. */
export function parsePnlSeries(body: unknown, wallet: string, expectedInterval: string, expectedFidelity: string): PnlSeries {
  if (!isWallet(wallet)) throw new PublicDataUnavailable();
  const root = record(body);
  const data = record(root.data);
  const proxyWallet = text(data, 'proxy_wallet');
  if (!isWallet(proxyWallet) || proxyWallet.toLowerCase() !== wallet.toLowerCase()) throw new PublicDataUnavailable();
  const interval = text(data, 'interval');
  const fidelity = text(data, 'fidelity');
  const sourceFidelity = text(data, 'source_fidelity');
  if (interval !== expectedInterval || fidelity !== expectedFidelity || !sourceFidelity) throw new PublicDataUnavailable();
  if (!Array.isArray(data.points)) throw new PublicDataUnavailable();

  let previousTimestamp = 0;
  const points: PnlSeriesPoint[] = data.points.map(value => {
    const row = record(value);
    const timestamp = numeric(row, 'timestamp');
    const pnl = numeric(row, 'trade_pnl');
    if (!Number.isInteger(timestamp) || timestamp <= 0 || timestamp < previousTimestamp) throw new PublicDataUnavailable();
    previousTimestamp = timestamp;
    const tradeCount = row.trade_count == null ? undefined : numeric(row, 'trade_count', true);
    if (tradeCount !== undefined && !Number.isInteger(tradeCount)) throw new PublicDataUnavailable();
    return tradeCount === undefined ? { t: timestamp, pnl } : { t: timestamp, pnl, tradeCount };
  });

  const last = points[points.length - 1];
  return {
    proxyWallet,
    interval,
    fidelity,
    sourceFidelity,
    points,
    latestPnl: last?.pnl ?? null,
    tradeCount: last?.tradeCount ?? null,
  };
}

export function downsamplePnl(points: PnlSeriesPoint[], max: number): PnlSeriesPoint[] {
  if (points.length <= max) return points;
  const out: PnlSeriesPoint[] = [];
  const step = (points.length - 1) / (max - 1);
  for (let i = 0; i < max; i += 1) out.push(points[Math.round(i * step)]);
  return out;
}
