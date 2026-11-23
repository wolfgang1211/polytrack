'use client';

import { useEffect, useState } from 'react';
import { formatCurrency } from '@/lib/utils';
import { marketUrl } from '@/lib/builder';

/* Farm Δ feed ([03c]) — what changed in the reward-farm universe since
   yesterday: new pools, ended programs, rate raises/cuts, and competing
   liquidity draining out (your share grows) or crowding in. Built entirely
   from our recorded snapshot series. */

type FarmChangeKind = 'new' | 'ended' | 'rate_up' | 'rate_down' | 'liq_out' | 'liq_in';

interface FarmChange {
  kind: FarmChangeKind;
  conditionId: string;
  question: string | null;
  slug: string | null;
  eventSlug?: string;
  before: number;
  after: number;
  pct: number | null;
  ts: number;
}

interface ChangesResponse {
  enabled: boolean;
  hours: number;
  effectiveHours: number;
  snapshots: number;
  changes: FarmChange[];
  updatedAt: number;
}

const KIND_META: Record<FarmChangeKind, { label: string; color: string; hint: string }> = {
  new:       { label: 'NEW POOL',   color: '#34d399', hint: 'reward program started' },
  liq_out:   { label: 'LIQ DRAIN',  color: 'var(--text-secondary)', hint: 'competitors left — your share grows' },
  rate_up:   { label: 'POOL ↑',     color: '#fbbf24', hint: 'daily reward pool raised' },
  rate_down: { label: 'POOL ↓',     color: '#fb923c', hint: 'daily reward pool cut' },
  liq_in:    { label: 'LIQ CROWD',  color: '#60a5fa', hint: 'competitors piled in' },
  ended:     { label: 'ENDED',      color: '#fb7185', hint: 'reward program gone' },
};

const WINDOWS = [
  { key: 24, label: '24H' },
  { key: 48, label: '48H' },
] as const;

function agoLabel(ms: number): string {
  if (ms < 90 * 60_000) return `${Math.max(1, Math.round(ms / 60_000))}m ago`;
  return `${Math.round(ms / 3_600_000)}h ago`;
}

function changeText(c: FarmChange): string {
  switch (c.kind) {
    case 'new':       return `— → ${formatCurrency(c.after, true)}/day`;
    case 'ended':     return `${formatCurrency(c.before, true)}/day → —`;
    case 'rate_up':
    case 'rate_down': return `${formatCurrency(c.before, true)} → ${formatCurrency(c.after, true)}/day`;
    default:          return `${formatCurrency(c.before, true)} → ${formatCurrency(c.after, true)} liquidity`;
  }
}

function SectionHeader({ index, label, controls }: { index: string; label: string; controls?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="font-mono text-[10px] font-black tracking-widest" style={{ color: 'var(--text-muted)' }}>{index}</span>
      <div className="h-px w-12" style={{ background: 'var(--accent-border)' }} />
      <span className="font-mono text-[10px] uppercase tracking-[0.15em]" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, var(--accent-border), transparent)' }} />
      {controls && <div className="flex-shrink-0 ml-2">{controls}</div>}
    </div>
  );
}

export default function FarmChanges() {
  const [win, setWin] = useState<24 | 48>(24);
  // Keyed fetch — loading/data are derived, no setState in the effect body.
  const [fetched, setFetched] = useState<{ key: number; data: ChangesResponse | null } | null>(null);
  const data = fetched && fetched.key === win ? fetched.data : null;
  const loading = fetched?.key !== win;

  useEffect(() => {
    const k = win;
    fetch(`/api/liquidity/changes?hours=${k}`)
      .then(r => r.json())
      .then(d => setFetched({ key: k, data: d?.enabled !== undefined ? d : null }))
      .catch(() => setFetched({ key: k, data: null }));
  }, [win]);

  const changes = data?.changes ?? [];

  return (
    <section>
      <SectionHeader index="[03c]" label="Farm Changes — What Moved" controls={
        <div className="flex gap-0.5 rounded-xl glass p-0.5">
          {WINDOWS.map(w => (
            <button key={w.key} onClick={() => setWin(w.key)}
              className={`relative rounded-lg px-3 py-1 text-[11px] font-bold transition-all
                ${win === w.key ? 'text-ink' : 'text-ink/55 hover:text-ink/60'}`}>
              {win === w.key && (
                <span className="absolute inset-0 rounded-lg"
                  style={{ background: 'var(--accent-fill)', border: '1px solid rgba(var(--ink-rgb),0.3)' }} />
              )}
              <span className="relative">{w.label}</span>
            </button>
          ))}
        </div>
      } />

      <div className="glass rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(var(--ink-rgb),0.07)' }}>
        {loading && (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-9 rounded-lg animate-shimmer" />)}
          </div>
        )}

        {!loading && data && changes.length === 0 && (
          <p className="text-center text-sm text-ink/55 py-8">
            No farm changes in the last {data.effectiveHours ? Math.round(data.effectiveHours) : win}h — pools, rates and competition all held steady.
          </p>
        )}

        {!loading && !data && (
          <p className="text-center text-sm text-ink/55 py-8">Farm change feed unavailable.</p>
        )}

        {!loading && data && changes.length > 0 && (
          <div>
            {changes.map(c => {
              const meta = KIND_META[c.kind];
              const inner = (
                <>
                  <span className="flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-black tracking-wider"
                    style={{ background: `${meta.color}20`, color: meta.color, border: `1px solid ${meta.color}40` }}
                    title={meta.hint}>
                    {meta.label}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold text-ink/70">
                    {c.question ?? `${c.conditionId.slice(0, 10)}…`}
                  </span>
                  <span className="flex-shrink-0 text-xs font-bold tabular-nums text-ink/55">{changeText(c)}</span>
                  {c.pct != null && (
                    <span className="w-12 flex-shrink-0 text-right text-[11px] font-black tabular-nums sm:w-14"
                      style={{ color: meta.color }}>
                      {c.pct > 0 ? '+' : ''}{Math.round(c.pct)}%
                    </span>
                  )}
                  <span className="hidden w-16 flex-shrink-0 text-right text-[10px] text-ink/55 tabular-nums sm:inline">
                    {data.updatedAt ? agoLabel(Math.max(0, data.updatedAt - c.ts)) : ''}
                  </span>
                </>
              );
              const cls = 'flex items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 transition-colors hover:bg-ink/[0.03]';
              const style = { borderBottom: '1px solid rgba(var(--ink-rgb),0.04)' };
              return c.slug ? (
                <a key={`${c.kind}-${c.conditionId}`} href={marketUrl(c.eventSlug, c.slug, 'liquidity_farm_changes')}
                  target="_blank" rel="noopener noreferrer" className={cls} style={style}>
                  {inner}
                </a>
              ) : (
                <div key={`${c.kind}-${c.conditionId}`} className={cls} style={style}>{inner}</div>
              );
            })}
          </div>
        )}

        <p className="px-4 py-3 text-[10px] text-ink/55 leading-relaxed" style={{ borderTop: '1px solid rgba(var(--ink-rgb),0.05)' }}>
          Diffed from our own 10-minute snapshot history ({data ? `${data.snapshots} snapshots` : '…'}) — pools opening/ending,
          reward-rate moves ≥20%, and competing-liquidity swings ≥30%. A liquidity drain means your pool share is growing.
        </p>
      </div>
    </section>
  );
}
