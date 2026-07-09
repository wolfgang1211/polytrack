'use client';

import { useCallback, useState } from 'react';
import { formatCurrency } from '@/lib/utils';
import type { ValidateResponse } from '@/app/api/liquidity/validate/route';

/* Model Validation (LH-C) — the bridge between simulated and real. Feed it a
   wallet that actually LP'd and it puts the wallet's REAL maker-fill spread
   earnings (LH-8 replay) next to what the LH-9 backtest model says a passive
   quoter would have earned in the SAME markets over the SAME window.
   Data from /api/liquidity/validate. */

const WINDOWS = [
  { key: 24, label: '24H' },
  { key: 72, label: '3D' },
  { key: 168, label: '7D' },
] as const;

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

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl px-3.5 py-2.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm font-black tabular-nums" style={{ color: color ?? 'rgba(255,255,255,0.88)' }}>{value}</p>
      {sub && <p className="text-[10px] text-white/25 mt-0.5">{sub}</p>}
    </div>
  );
}

const pnlColor = (v: number) =>
  v > 0.005 ? '#34d399' : v < -0.005 ? '#fb7185' : 'rgba(255,255,255,0.5)';

export default function ModelValidation() {
  const [address, setAddress] = useState('');
  const [amount, setAmount]   = useState('1000');
  const [hours, setHours]     = useState<number>(168);
  const [data, setData]       = useState<ValidateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed]   = useState(false);

  const addrOk = /^0x[0-9a-fA-F]{40}$/.test(address.trim());
  const capital = Math.max(1, parseFloat(amount) || 1000);

  const run = useCallback(() => {
    if (!addrOk || loading) return;
    setLoading(true);
    setFailed(false);
    fetch(`/api/liquidity/validate?address=${address.trim().toLowerCase()}&capital=${capital}&hours=${hours}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((d: ValidateResponse) => setData(d))
      .catch(() => { setData(null); setFailed(true); })
      .finally(() => setLoading(false));
  }, [addrOk, loading, address, capital, hours]);

  const rows = data?.rows ?? [];
  const hasResult = Boolean(data && !data.error && rows.length > 0);

  return (
    <section>
      <SectionHeader index="[08c]" label="Model Validation" controls={
        <div className="flex gap-0.5 rounded-xl glass p-0.5">
          {WINDOWS.map(w => (
            <button key={w.key} onClick={() => setHours(w.key)}
              className={`relative rounded-lg px-3 py-1 text-[11px] font-bold transition-all
                ${hours === w.key ? 'text-white' : 'text-white/30 hover:text-white/60'}`}>
              {hours === w.key && (
                <span className="absolute inset-0 rounded-lg"
                  style={{ background: 'linear-gradient(135deg,rgba(52,211,153,0.4),rgba(16,185,129,0.4))', border: '1px solid rgba(52,211,153,0.3)' }} />
              )}
              <span className="relative">{w.label}</span>
            </button>
          ))}
        </div>
      } />

      <div className="glass rounded-2xl p-5 flex flex-col gap-5" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
        {/* Inputs */}
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[260px]">
            <label className="block text-xs font-semibold text-white/50 mb-2">LP wallet address</label>
            <input type="text" value={address} spellCheck={false}
              onChange={e => setAddress(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') run(); }}
              placeholder="0x… (a wallet that made markets)"
              className="w-full rounded-xl glass px-4 py-2.5 text-sm font-mono text-white outline-none"
              style={{ border: `1px solid ${address && !addrOk ? 'rgba(251,113,133,0.4)' : 'rgba(52,211,153,0.3)'}` }} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/50 mb-2">Sim capital</label>
            <div className="relative w-32">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-white/30 font-bold">$</span>
              <input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)}
                className="w-full rounded-xl glass pl-7 pr-3 py-2.5 text-sm font-bold text-white outline-none"
                style={{ border: '1px solid rgba(255,255,255,0.1)' }} />
            </div>
          </div>
          <button onClick={run} disabled={!addrOk || loading}
            className="rounded-xl px-4 py-2.5 text-xs font-bold text-white transition-all hover:scale-[1.02] hover:brightness-110 disabled:opacity-40 disabled:hover:scale-100"
            style={{ background: 'linear-gradient(135deg,rgba(52,211,153,0.5),rgba(16,185,129,0.5))', border: '1px solid rgba(52,211,153,0.35)' }}>
            {loading ? 'Comparing…' : 'Compare'}
          </button>
        </div>

        {!data && !loading && !failed && (
          <p className="text-center text-sm text-white/25 py-6">
            Paste a wallet that actually provided liquidity to see its real maker-fill spread earnings
            next to what the backtest model predicts for the same markets and window.
          </p>
        )}

        {failed && (
          <p className="text-center text-sm text-rose-300/60 py-6">
            Comparison failed — the fill fetch or snapshot read errored. Try again in a moment.
          </p>
        )}

        {loading && (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 rounded-xl animate-shimmer" />)}
          </div>
        )}

        {!loading && data?.enabled === false && (
          <p className="text-center text-sm text-white/25 py-6">
            Validation needs both the KV snapshot store and a Graph API key configured.
          </p>
        )}

        {!loading && data?.error && data.enabled && (
          <p className="text-center text-sm text-white/25 py-6">{data.error}.</p>
        )}

        {!loading && hasResult && data && (
          <>
            {/* Headline comparison */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Real spread P&L" value={formatCurrency(data.real.realized)}
                sub={`${data.real.fills.toLocaleString()} maker fills · ${formatCurrency(data.real.makerVolume, true)} volume`}
                color={pnlColor(data.real.realized)} />
              <Stat label="Simulated rewards" value={formatCurrency(data.sim.earned)}
                sub={`passive $${capital.toLocaleString()} quoter, same markets`} color="#fbbf24" />
              <Stat label="Markets matched" value={`${data.sim.marketsCovered} / ${data.real.markets}`}
                sub="wallet markets seen by the recorder" color="#60a5fa" />
              <Stat label="Volume overlap" value={`${data.matchedVolumePct.toFixed(0)}%`}
                sub={data.matchedVolumePct < 50 ? 'thin overlap — treat as directional' : 'good overlap'}
                color={data.matchedVolumePct < 50 ? '#fb7185' : '#34d399'} />
            </div>

            {/* Per-market table */}
            <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="grid grid-cols-[1fr_100px_90px_100px_80px] px-4 py-2.5 glass-strong"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {['Market', 'Real P&L', 'Maker Vol', 'Sim Rewards', 'Coverage'].map((h, i) => (
                  <span key={h} className={`text-[10px] font-semibold uppercase tracking-widest text-white/30 ${i === 0 ? '' : 'text-right'}`}>{h}</span>
                ))}
              </div>
              {rows.map(r => (
                <div key={r.conditionId ?? r.tokenIds[0]}
                  className="grid grid-cols-[1fr_100px_90px_100px_80px] items-center px-4 py-3"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="min-w-0 pr-2">
                    <p className="truncate text-xs font-semibold text-white/70">
                      {r.question ?? `${r.tokenIds[0].slice(0, 14)}…`}
                      {r.outcome && <span className="text-white/30"> · {r.outcome}</span>}
                    </p>
                    {r.simEarned == null && (
                      <p className="text-[9px] text-white/25">not in snapshot history — no sim possible</p>
                    )}
                  </div>
                  <span className="text-right text-xs font-black tabular-nums" style={{ color: pnlColor(r.realRealized) }}>
                    {formatCurrency(r.realRealized)}
                  </span>
                  <span className="text-right text-xs font-bold tabular-nums text-white/50">
                    {formatCurrency(r.realVolume, true)}
                  </span>
                  <span className="text-right text-xs font-black tabular-nums"
                    style={{ color: r.simEarned == null ? 'rgba(255,255,255,0.2)' : '#fbbf24' }}>
                    {r.simEarned == null ? '—' : formatCurrency(r.simEarned)}
                  </span>
                  <span className={`text-right text-xs font-bold tabular-nums ${r.simCoveragePct < 50 ? 'text-rose-400/70' : 'text-white/40'}`}>
                    {r.simEarned == null ? '—' : `${r.simCoveragePct.toFixed(0)}%`}
                  </span>
                </div>
              ))}
            </div>

            <p className="text-[10px] text-white/25 leading-relaxed">
              {`Real = the wallet's realized maker-fill spread capture (cost-basis replay, reward payouts NOT included). `}
              {`Sim = the Backtester's reward-pool model (share × daily_pool × Δt) run over the same window for the same markets — spread and inventory risk NOT included. `}
              {`They measure different income streams, so don't expect equality: the bridge checks whether the model favors the markets where real LPs actually earned, and whether magnitudes are plausible. `}
              {`Low coverage or volume overlap means the snapshot history simply hasn't seen enough of this wallet's world yet.`}
            </p>
          </>
        )}
      </div>
    </section>
  );
}
