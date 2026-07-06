'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { formatCurrency } from '@/lib/utils';
import { marketUrl } from '@/lib/builder';
import type { BacktestResponse, BacktestResult } from '@/app/api/liquidity/backtest/route';

/* LP Backtester (LH-9) — replay recorded reward-farm snapshots and show what
   a fixed-capital passive quoter WOULD have earned per market. Data comes
   from /api/liquidity/backtest (lpSnapshots series). */

const WINDOWS = [
  { key: 24, label: '24H' },
  { key: 72, label: '3D' },
  { key: 168, label: '7D' },
] as const;

/* Below this coverage, annualising observed earnings is extrapolation noise
   (2% coverage → 50× multiplier), so the APR is de-emphasised as an estimate. */
const APR_MIN_COVERAGE = 25;

function AprCell({ apr, coveragePct }: { apr: number; coveragePct: number }) {
  if (coveragePct < APR_MIN_COVERAGE) {
    return (
      <span className="text-right text-xs font-bold tabular-nums text-white/25"
        title={`Only ${coveragePct.toFixed(0)}% of this window was observed — annualised figure is a rough extrapolation`}>
        ~{apr >= 1000 ? '>999' : apr.toFixed(0)}%
      </span>
    );
  }
  return <span className="text-right text-xs font-bold tabular-nums text-amber-300/80">{apr.toFixed(1)}%</span>;
}

function SectionHeader({ index, label, controls }: { index: string; label: string; controls?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="font-mono text-[10px] font-black tracking-widest" style={{ color: 'rgba(255,255,255,0.20)' }}>{index}</span>
      <div className="h-px w-12" style={{ background: 'var(--vi-border)' }} />
      <span className="font-mono text-[10px] uppercase tracking-[0.15em]" style={{ color: 'rgba(255,255,255,0.25)' }}>{label}</span>
      <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, var(--vi-border), transparent)' }} />
      {controls && <div className="flex-shrink-0 ml-2">{controls}</div>}
    </div>
  );
}

export default function Backtester() {
  const [amount, setAmount]   = useState('1000');
  const [hours, setHours]     = useState<number>(168);
  const [data, setData]       = useState<BacktestResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  const capital = Math.max(1, parseFloat(amount) || 1000);

  // Debounce the capital input so we don't hammer the API while typing.
  useEffect(() => {
    let live = true;
    setLoading(true);
    const t = setTimeout(() => {
      fetch(`/api/liquidity/backtest?capital=${capital}&hours=${hours}`)
        .then(r => r.ok ? r.json() : Promise.reject())
        .then((d: BacktestResponse) => {
          if (!live) return;
          setData(d);
          setSelected(prev =>
            prev && d.results.some(r => r.conditionId === prev && r.series?.length)
              ? prev
              : d.results.find(r => r.series?.length)?.conditionId ?? null);
        })
        .catch(() => { if (live) setData(null); })
        .finally(() => { if (live) setLoading(false); });
    }, 400);
    return () => { live = false; clearTimeout(t); };
  }, [capital, hours]);

  const results = data?.results ?? [];
  const sel: BacktestResult | undefined = useMemo(
    () => results.find(r => r.conditionId === selected),
    [results, selected],
  );
  const chartData = useMemo(
    () => (sel?.series ?? []).map(p => ({ t: p.t, earned: p.v })),
    [sel],
  );

  const noHistory = !loading && data?.enabled !== false && results.length === 0;

  return (
    <section>
      <SectionHeader index="[08]" label="LP Backtester" controls={
        <div className="flex gap-0.5 rounded-xl glass p-0.5">
          {WINDOWS.map(w => (
            <button key={w.key} onClick={() => setHours(w.key)}
              className={`relative rounded-lg px-3 py-1 text-[11px] font-bold transition-all
                ${hours === w.key ? 'text-white' : 'text-white/30 hover:text-white/60'}`}>
              {hours === w.key && (
                <span className="absolute inset-0 rounded-lg"
                  style={{ background: 'linear-gradient(135deg,rgba(251,191,36,0.4),rgba(249,115,22,0.4))', border: '1px solid rgba(251,191,36,0.3)' }} />
              )}
              <span className="relative">{w.label}</span>
            </button>
          ))}
        </div>
      } />

      <div className="glass rounded-2xl p-5 flex flex-col gap-5" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
        {/* Capital input */}
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-semibold text-white/50 mb-2">Capital (USDC)</label>
            <div className="relative w-44">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-white/30 font-bold">$</span>
              <input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)}
                className="w-full rounded-xl glass pl-7 pr-4 py-2.5 text-sm font-bold text-white outline-none"
                style={{ border: '1px solid rgba(251,191,36,0.3)' }} />
            </div>
          </div>
          <div className="flex gap-2">
            {[500, 1000, 5000, 10000].map(v => (
              <button key={v} onClick={() => setAmount(String(v))}
                className="rounded-lg px-2.5 py-1 text-[10px] font-semibold text-white/40 transition-all hover:text-white/70"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>
                ${v >= 1000 ? `${v / 1000}K` : v}
              </button>
            ))}
          </div>
          {data && data.historyHours > 0 && (
            <span className="ml-auto flex items-center gap-2 pb-1 text-[10px] text-white/25">
              {data.historyHours < hours * 0.5 && (
                <span className="rounded-full px-2 py-0.5 font-semibold"
                  style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)', color: '#fbbf24' }}>
                  sparse history — results are partial
                </span>
              )}
              {data.snapshots} snapshots · {data.historyHours.toFixed(0)}h of recorded history
            </span>
          )}
        </div>

        {data?.enabled === false && (
          <p className="text-center text-sm text-white/25 py-6">
            Snapshot storage is not configured — backtesting needs the KV history recorder.
          </p>
        )}

        {noHistory && (
          <p className="text-center text-sm text-white/25 py-6">
            Not enough snapshot history in this window yet. The recorder builds ~1 week of data at a 10-minute cadence — check back soon.
          </p>
        )}

        {loading && (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-10 rounded-xl animate-shimmer" />)}
          </div>
        )}

        {!loading && results.length > 0 && (
          <>
            {/* Earnings curve for the selected market */}
            {sel?.series && sel.series.length > 1 && (
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-white/35">
                    Cumulative earnings — <span className="text-amber-300/80">{sel.question ?? sel.conditionId.slice(0, 10) + '…'}</span>
                  </p>
                  <span className="text-xs font-black text-amber-300">
                    {formatCurrency(sel.earned)}
                    {sel.coveragePct >= APR_MIN_COVERAGE && <> · {sel.effApr.toFixed(1)}% APR</>}
                  </span>
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="btFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#fbbf24" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']}
                      tickFormatter={t => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                      axisLine={false} tickLine={false} minTickGap={40} />
                    <YAxis tickFormatter={v => `$${v}`}
                      tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                      axisLine={false} tickLine={false} width={46} />
                    <Tooltip
                      contentStyle={{ background: 'rgba(13,13,26,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }}
                      labelStyle={{ color: 'rgba(255,255,255,0.5)' }}
                      labelFormatter={t => new Date(t as number).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      formatter={(v) => [formatCurrency(Number(v)), 'Earned'] as [string, string]} />
                    <Area type="monotone" dataKey="earned" stroke="#fbbf24" strokeWidth={2} fill="url(#btFill)" isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Ranked results */}
            <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="grid grid-cols-[24px_1fr_90px_80px_90px_80px] px-4 py-2.5 glass-strong"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {['#', 'Market', 'Earned', 'APR', 'Avg Pool', 'Coverage'].map((h, i) => (
                  <span key={h} className={`text-[10px] font-semibold uppercase tracking-widest text-white/30 ${i < 2 ? '' : 'text-right'}`}>{h}</span>
                ))}
              </div>
              {results.map((r, i) => {
                const isSel = r.conditionId === selected;
                return (
                  <button key={r.conditionId}
                    onClick={() => r.series?.length && setSelected(r.conditionId)}
                    className="grid w-full grid-cols-[24px_1fr_90px_80px_90px_80px] items-center px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      background: isSel ? 'rgba(251,191,36,0.06)' : 'transparent',
                      cursor: r.series?.length ? 'pointer' : 'default',
                    }}>
                    <span className="font-mono text-xs text-white/25">{i + 1}</span>
                    <div className="flex min-w-0 items-center gap-2">
                      {r.image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.image} alt="" className="h-6 w-6 flex-shrink-0 rounded-md object-cover"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-white/70">
                          {r.question ?? `${r.conditionId.slice(0, 14)}…`}
                        </p>
                        {!r.active && (
                          <p className="text-[9px] text-white/25">
                            {r.resolved === true ? 'market resolved' : 'reward pool inactive'}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="text-right text-xs font-black tabular-nums" style={{ color: isSel ? '#fbbf24' : 'rgba(255,255,255,0.85)' }}>
                      {formatCurrency(r.earned)}
                    </span>
                    <AprCell apr={r.effApr} coveragePct={r.coveragePct} />
                    <span className="text-right text-xs font-bold tabular-nums text-white/50">{formatCurrency(r.avgDailyRate, true)}/d</span>
                    <span className={`text-right text-xs font-bold tabular-nums ${r.coveragePct < 50 ? 'text-rose-400/70' : 'text-white/40'}`}>
                      {r.coveragePct.toFixed(0)}%
                    </span>
                  </button>
                );
              })}
            </div>

            {/* CTA for the selected market */}
            {sel?.slug && sel.active && (
              <a href={marketUrl(sel.eventSlug, sel.slug)} target="_blank" rel="noopener noreferrer"
                className="inline-flex w-fit items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold text-white transition-all hover:scale-[1.02] hover:brightness-110"
                style={{ background: 'var(--vi-grad-60)', border: '1px solid var(--vi-border-xl)' }}>
                Quote this market on Polymarket →
              </a>
            )}

            <p className="text-[10px] text-white/25 leading-relaxed">
              Simulated from recorded 10-minute reward-farm snapshots: each interval credits
              your_share × daily_pool × Δt, where your_share = capital / (max(liquidity, $10K) + capital) —
              the same model as the Reward Simulator. Only observed windows count (coverage column);
              spread capture and price/inventory risk are NOT included. Past pool conditions don&apos;t guarantee future payouts.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
