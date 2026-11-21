'use client';

import { useEffect, useRef, useState } from 'react';
import { formatUtc } from '@/lib/kalshi';
import {
  HISTORY_RANGES, isKalshiHistory,
  type KalshiCandlePoint, type KalshiHistory, type KalshiHistoryRange, type KalshiHistoryWindow, type KalshiTrade,
} from '@/lib/kalshiHistory';

const panel = { background: 'var(--surface-1)', border: '1px solid rgba(var(--ink-rgb),0.08)' };
const W = 600, HT = 200, PL = 40, PR = 10, PT = 10, PB = 22;
const r2 = (n: number) => Math.round(n * 100) / 100;
const utc = (sec: number) => formatUtc(new Date(sec * 1000).toISOString());
/** Published prices carry up to 6dp of a dollar, i.e. up to 4dp of a cent. */
const cents = (p: number) => `${(p * 100).toFixed(4).replace(/\.?0+$/, '')}¢`;
const contracts = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });

function Chart({ points, window, range }: { points: KalshiCandlePoint[]; window: KalshiHistoryWindow; range: KalshiHistoryRange }) {
  const span = window.endTs - window.startTs;
  const x = (ts: number) => r2(PL + ((ts - window.startTs) / span) * (W - PL - PR));
  const y = (p: number) => r2(PT + (1 - p) * (HT - PT - PB)); // fixed 0–100¢ axis, never autoscaled
  const period = window.periodMinutes * 60;
  // A line only joins known closes in directly consecutive periods: null closes and missing periods break it.
  const runs: KalshiCandlePoint[][] = [];
  let prev: KalshiCandlePoint | null = null;
  for (const p of points) {
    if (p.yesClose === null) { prev = null; continue; }
    if (prev && p.endTs - prev.endTs === period) runs[runs.length - 1].push(p);
    else runs.push([p]);
    prev = p;
  }
  const known = points.filter(p => p.yesClose !== null);
  return (
    <svg role="img" aria-label={`Yes trade close price in cents, ${range} window, UTC`} viewBox={`0 0 ${W} ${HT}`} className="w-full h-auto text-ink/60">
      <title>{`Yes trade close price (¢), ${range} window, UTC`}</title>
      {[0, 0.5, 1].map(v => (
        <g key={v}>
          <line x1={PL} x2={W - PR} y1={y(v)} y2={y(v)} stroke="currentColor" strokeOpacity={0.15} />
          <text x={PL - 6} y={y(v) + 4} textAnchor="end" fontSize={10} fill="currentColor">{v === 1 ? '100¢' : String(v * 100)}</text>
        </g>
      ))}
      <text x={PL} y={HT - 6} fontSize={10} fill="currentColor">{utc(window.startTs)}</text>
      <text x={W - PR} y={HT - 6} textAnchor="end" fontSize={10} fill="currentColor">{utc(window.endTs)}</text>
      {runs.filter(r => r.length > 1).map((r, i) => (
        <polyline key={r[0].endTs} data-segment={i} fill="none" stroke="var(--accent, currentColor)" strokeWidth={1.5}
          points={r.map(p => `${x(p.endTs)},${y(p.yesClose as number)}`).join(' ')} />
      ))}
      {known.map(p => (
        <circle key={p.endTs} data-ts={p.endTs} cx={x(p.endTs)} cy={y(p.yesClose as number)} r={2.5} fill="var(--accent, currentColor)" />
      ))}
    </svg>
  );
}

function Candles({ h }: { h: KalshiHistory }) {
  if (!h.candles.ok) return <p className="text-sm text-ink/50">{`Price chart unavailable: ${h.candles.error}`}</p>;
  const { points } = h.candles.data;
  if (points.length === 0) return <p className="text-sm text-ink/50">No candles returned for this window.</p>;
  const last = points[points.length - 1];
  return (
    <div className="flex flex-col gap-2">
      <Chart points={points} window={h.window} range={h.range} />
      <p className="text-xs text-ink/55">
        {`Last candle ends ${utc(last.endTs)}. Line breaks mark periods without a trade or without a candle; nothing is interpolated.`}
      </p>
      <details className="text-xs">
        <summary className="cursor-pointer text-ink/50">Chart data table</summary>
        <div className="overflow-x-auto">
          <table className="mt-2 w-full text-xs">
            <caption className="text-left text-ink/55">Yes trade close by interval (UTC)</caption>
            <thead><tr className="text-ink/55"><th className="text-left font-normal">Interval end</th><th className="text-right font-normal">Yes close</th><th className="text-right font-normal">Volume</th></tr></thead>
            <tbody>
              {points.map(p => (
                <tr key={p.endTs} className="text-ink/75">
                  <td>{utc(p.endTs)}</td>
                  <td className="text-right">{p.yesClose === null ? 'No trade' : cents(p.yesClose)}</td>
                  <td className="text-right">{`${contracts(p.volumeContracts)} contracts`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function Trades({ h }: { h: KalshiHistory }) {
  if (!h.trades.ok) return <p className="text-sm text-ink/50">{`Recent trades unavailable: ${h.trades.error}`}</p>;
  const { trades, hasMore } = h.trades.data;
  if (trades.length === 0) return <p className="text-sm text-ink/50">No trades returned for this window.</p>;
  const latest = trades.reduce((a: KalshiTrade, t) => (Date.parse(t.createdTime) > Date.parse(a.createdTime) ? t : a));
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-ink/55">{`Latest trade ${formatUtc(latest.createdTime)}.`}</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-xs">
          <caption className="text-left text-ink/55">Recent public trades (one page, UTC). Quantities are contracts, not dollars.</caption>
          <thead>
            <tr className="text-ink/55">
              <th className="text-left font-normal">Time</th><th className="text-right font-normal">Yes price</th>
              <th className="text-right font-normal">No price</th><th className="text-right font-normal">Contracts</th>
              <th className="text-left font-normal">Taker outcome</th><th className="text-left font-normal">Type</th>
            </tr>
          </thead>
          <tbody>
            {trades.map(t => (
              <tr key={t.tradeId} className="text-ink/75">
                <td>{formatUtc(t.createdTime)}</td>
                <td className="text-right">{cents(t.yesPrice)}</td>
                <td className="text-right">{cents(t.noPrice)}</td>
                <td className="text-right">{contracts(t.countContracts)}</td>
                <td>{t.takerOutcomeSide === 'yes' ? 'Yes' : 'No'}</td>
                <td>{t.isBlockTrade ? 'Block' : 'Order book'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasMore && (
        <p className="text-xs text-ink/50">{`More trades exist in this window; showing the ${trades.length} returned on one page (max 50).`}</p>
      )}
    </div>
  );
}

export default function KalshiHistoryClient({ ticker, initialRange, initial, initialError }: {
  ticker: string; initialRange: KalshiHistoryRange; initial: KalshiHistory | null; initialError: string | null;
}) {
  // All hooks live here; subcomponents are hook-free.
  const valid = initial !== null && isKalshiHistory(initial, { ticker, range: initialRange }) ? initial : null;
  const [range, setRange] = useState<KalshiHistoryRange>(initialRange);
  const [data, setData] = useState<KalshiHistory | null>(valid);
  const [error, setError] = useState<string | null>(valid ? null : (initialError ?? 'Price history is temporarily unavailable.'));
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  // On unmount, invalidate and abort the owned request so nothing late lands in a dead or reused instance.
  useEffect(() => () => {
    generation.current++;
    controller.current?.abort();
  }, []);

  async function load(next: KalshiHistoryRange) {
    const gen = ++generation.current;
    controller.current?.abort();
    const ctrl = new AbortController();
    controller.current = ctrl;
    if (next !== range) setData(null); // never show the old range's data under the new label
    setRange(next);
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/kalshi/markets/${encodeURIComponent(ticker)}/history?range=${next}`, { signal: ctrl.signal, cache: 'no-store' });
      const body: unknown = await res.json().catch(() => null);
      // Both guards: a superseded generation OR an aborted signal (fetch may resolve despite abort).
      if (gen !== generation.current || ctrl.signal.aborted) return;
      if (!res.ok) {
        const msg = (body as { error?: unknown } | null)?.error;
        throw new Error(typeof msg === 'string' && msg.length <= 200 ? msg : 'Price history is temporarily unavailable.');
      }
      if (!isKalshiHistory(body, { ticker, range: next })) throw new Error('Kalshi history response was malformed.');
      setData(body);
    } catch (e) {
      if (gen !== generation.current || ctrl.signal.aborted) return;
      setData(null);
      setError(e instanceof Error && e.name !== 'AbortError' ? e.message : 'Price history is temporarily unavailable.');
    } finally {
      if (gen === generation.current && !ctrl.signal.aborted) setBusy(false);
    }
  }

  const btn = 'rounded-full px-2.5 py-1 text-xs font-semibold text-ink/70';
  const btnStyle = (active: boolean) => ({ background: active ? 'rgba(var(--ink-rgb),0.14)' : 'rgba(var(--ink-rgb),0.04)', border: '1px solid rgba(var(--ink-rgb),0.1)' });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="History range" className="flex gap-1">
          {HISTORY_RANGES.map(r => (
            <button key={r} type="button" aria-pressed={r === range} className={btn} style={btnStyle(r === range)} onClick={() => load(r)}>{r}</button>
          ))}
        </div>
        <button type="button" className={btn} style={btnStyle(false)} onClick={() => load(range)}>Refresh</button>
        {busy && <span className="text-xs text-ink/55" aria-live="polite">{`Loading ${range} history…`}</span>}
      </div>

      {error && (
        <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-rose-400">
          <span>{error}</span>
          <button type="button" className={btn} style={btnStyle(false)} onClick={() => load(range)}>Retry</button>
        </div>
      )}

      {data && (
        <>
          <p className="text-xs text-ink/55">
            {`Window ${utc(data.window.startTs)} – ${utc(data.window.endTs)} · Interval: ${data.window.periodMinutes === 1 ? '1 minute' : '1 hour'} · Retrieved ${formatUtc(data.retrievedAt)}. `}
            Retrieval time is not a source timestamp; the latest candle may lag recent trades.
          </p>
          <div className="rounded-xl p-3" style={panel}>
            <p className="mb-2 text-xs font-semibold text-ink/70">Yes trade close (last traded price per interval)</p>
            <Candles h={data} />
          </div>
          <div className="rounded-xl p-3" style={panel}>
            <p className="mb-2 text-xs font-semibold text-ink/70">Recent public trades</p>
            <Trades h={data} />
          </div>
        </>
      )}
    </div>
  );
}
