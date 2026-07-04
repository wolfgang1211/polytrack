'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Position } from '@/types';
import { formatCurrency, formatAddress } from '@/lib/utils';
import { profileUrl } from '@/lib/builder';

/* ── derived wallet stats (same conventions as WalletSidebar) ── */

interface WalletStats {
  address: string;
  totalPnl: number;
  realized: number;
  unrealized: number;
  equity: number;
  openValue: number;
  invested: number;
  avgBet: number;
  wins: number;
  losses: number;
  winRate: number;
  positions: number;
  markets: number;
  truncated: boolean;
}

function computeStats(address: string, positions: Position[], openValue: number, truncated: boolean): WalletStats {
  let realized = 0, unrealized = 0, invested = 0, wins = 0, losses = 0;
  const markets = new Set<string>();
  for (const p of positions) {
    realized += Number(p.realizedPnl) || 0;
    // Only count cashPnl (unrealized mark-to-market) for OPEN positions —
    // closed/redeemed positions report cashPnl as -costBasis.
    const isOpen = p.currentValue > 0;
    if (isOpen) unrealized += Number(p.cashPnl) || 0;
    invested += p.initialValue ?? 0;
    const pnl = (Number(p.realizedPnl) || 0) + (isOpen ? (Number(p.cashPnl) || 0) : 0);
    if (pnl > 0) wins++; else if (pnl < 0) losses++;
    if (p.conditionId) markets.add(p.conditionId);
  }
  const decided = wins + losses;
  return {
    address,
    realized,
    unrealized,
    totalPnl: realized + unrealized,
    equity: openValue + realized,
    openValue,
    invested,
    avgBet: positions.length ? invested / positions.length : 0,
    wins,
    losses,
    winRate: decided ? (wins / decided) * 100 : 0,
    positions: positions.length,
    markets: markets.size,
    truncated,
  };
}

const isEvmAddress = (s: string) => /^0x[a-fA-F0-9]{40}$/.test(s.trim());

async function loadWallet(address: string): Promise<WalletStats> {
  const res = await fetch(`/api/wallet/${address.toLowerCase()}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const positions: Position[] = Array.isArray(json?.positions) ? json.positions : [];
  return computeStats(address.toLowerCase(), positions, Number(json?.totalValue) || 0, !!json?.truncated);
}

/* ── UI bits ───────────────────────────────────────────── */

function SectionHeader({ index, label }: { index: string; label: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="font-mono text-[10px] font-black tracking-widest" style={{ color: 'rgba(255,255,255,0.20)' }}>{index}</span>
      <div className="h-px w-12" style={{ background: 'var(--vi-border)' }} />
      <span className="font-mono text-[10px] uppercase tracking-[0.15em]" style={{ color: 'rgba(255,255,255,0.25)' }}>{label}</span>
      <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, var(--vi-border), transparent)' }} />
    </div>
  );
}

function AddressInput({
  label, value, onChange, error,
}: { label: string; value: string; onChange: (v: string) => void; error?: string | null }) {
  return (
    <div className="flex-1 min-w-[260px]">
      <label className="block text-xs font-semibold text-white/50 mb-2">{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="0x…"
        spellCheck={false}
        className="w-full rounded-xl glass px-4 py-2.5 text-sm font-mono text-white/80 placeholder-white/25 outline-none"
        style={{ border: `1px solid ${error ? 'rgba(251,113,133,0.4)' : 'var(--vi-border-md)'}` }}
      />
      {error && <p className="mt-1 text-[10px] text-rose-400">{error}</p>}
    </div>
  );
}

type RowDef = {
  label: string;
  value: (s: WalletStats) => number;
  fmt: (v: number) => string;
  higherIsBetter?: boolean;
  signed?: boolean;
};

const ROWS: RowDef[] = [
  { label: 'Total P&L',        value: s => s.totalPnl,   fmt: v => formatCurrency(v, true), signed: true },
  { label: 'Realized P&L',     value: s => s.realized,   fmt: v => formatCurrency(v, true), signed: true },
  { label: 'Unrealized P&L',   value: s => s.unrealized, fmt: v => formatCurrency(v, true), signed: true },
  { label: 'Portfolio Equity', value: s => s.equity,     fmt: v => formatCurrency(v, true) },
  { label: 'Open Position Value', value: s => s.openValue, fmt: v => formatCurrency(v, true) },
  { label: 'Total Invested',   value: s => s.invested,   fmt: v => formatCurrency(v, true) },
  { label: 'Win Rate',         value: s => s.winRate,    fmt: v => `${v.toFixed(1)}%` },
  { label: 'Wins / Losses',    value: s => s.wins,       fmt: v => String(Math.round(v)) },
  { label: 'Avg Bet Size',     value: s => s.avgBet,     fmt: v => formatCurrency(v, true) },
  { label: 'Positions',        value: s => s.positions,  fmt: v => String(Math.round(v)) },
  { label: 'Distinct Markets', value: s => s.markets,    fmt: v => String(Math.round(v)) },
];

function CompareInner() {
  const router = useRouter();
  const sp = useSearchParams();

  const [addrA, setAddrA] = useState(sp.get('a') ?? '');
  const [addrB, setAddrB] = useState(sp.get('b') ?? '');
  const [errA, setErrA] = useState<string | null>(null);
  const [errB, setErrB] = useState<string | null>(null);
  const [statsA, setStatsA] = useState<WalletStats | null>(null);
  const [statsB, setStatsB] = useState<WalletStats | null>(null);
  const [loading, setLoading] = useState(false);

  const compare = useCallback(async (a: string, b: string) => {
    const okA = isEvmAddress(a);
    const okB = isEvmAddress(b);
    setErrA(okA ? null : 'Enter a valid EVM address (0x + 40 hex chars)');
    setErrB(okB ? null : 'Enter a valid EVM address (0x + 40 hex chars)');
    if (!okA || !okB) return;

    setLoading(true);
    setStatsA(null);
    setStatsB(null);
    router.replace(`/compare?a=${a.trim().toLowerCase()}&b=${b.trim().toLowerCase()}`, { scroll: false });
    const [ra, rb] = await Promise.allSettled([loadWallet(a.trim()), loadWallet(b.trim())]);
    if (ra.status === 'fulfilled') setStatsA(ra.value); else setErrA('Could not load this wallet');
    if (rb.status === 'fulfilled') setStatsB(rb.value); else setErrB('Could not load this wallet');
    setLoading(false);
  }, [router]);

  // Auto-run when arriving with ?a=&b= (shared link)
  useEffect(() => {
    const a = sp.get('a') ?? '';
    const b = sp.get('b') ?? '';
    if (isEvmAddress(a) && isEvmAddress(b)) compare(a, b);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ready = statsA && statsB;

  return (
    <div className="flex flex-col gap-8">

      {/* ── [01] Header ── */}
      <div className="animate-fade-in-up">
        <SectionHeader index="[01]" label="Compare Traders" />
        <h1 className="text-3xl font-black leading-none tracking-tight sm:text-4xl mb-3">
          <span className="text-white">Trader</span>{' '}
          <span className="text-grad">Comparison</span>
        </h1>
        <p className="text-sm text-white/40 max-w-lg">
          Put two Polymarket wallets side by side — P&amp;L, win rate, portfolio value and betting style — and see who you should really be copying.
        </p>
      </div>

      {/* ── [02] Inputs ── */}
      <section className="animate-fade-in-up" style={{ animationDelay: '60ms' }}>
        <SectionHeader index="[02]" label="Pick Two Wallets" />
        <div className="glass rounded-2xl p-5 flex flex-col gap-4">
          <div className="flex flex-wrap gap-4">
            <AddressInput label="Trader A" value={addrA} onChange={setAddrA} error={errA} />
            <AddressInput label="Trader B" value={addrB} onChange={setAddrB} error={errB} />
          </div>
          <div>
            <button
              onClick={() => compare(addrA, addrB)}
              disabled={loading}
              className="rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-all hover:scale-[1.02] disabled:opacity-50"
              style={{ background: 'var(--vi-fill)', border: '1px solid var(--vi-border-lg)' }}
            >
              {loading ? 'Comparing…' : 'Compare →'}
            </button>
          </div>
        </div>
      </section>

      {/* ── [03] Results ── */}
      {loading && (
        <div className="glass rounded-2xl h-96 animate-shimmer" />
      )}

      {ready && !loading && (
        <section className="animate-fade-in-up">
          <SectionHeader index="[03]" label="Head to Head" />
          <div className="glass rounded-2xl overflow-hidden">
            {/* header row */}
            <div className="grid grid-cols-[1.2fr_1fr_1fr] px-5 py-3"
              style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <span className="text-[10px] uppercase tracking-widest text-white/30 self-center">Metric</span>
              {[statsA, statsB].map((s, i) => (
                <a key={i} href={profileUrl(s!.address)} target="_blank" rel="noopener noreferrer"
                  className="text-xs font-mono font-bold text-white/70 hover:text-white transition-colors text-right sm:text-left">
                  {formatAddress(s!.address, 6)} ↗
                </a>
              ))}
            </div>

            {ROWS.map(row => {
              const va = row.value(statsA!);
              const vb = row.value(statsB!);
              const better = row.higherIsBetter === false ? (va < vb ? 'a' : vb < va ? 'b' : null) : (va > vb ? 'a' : vb > va ? 'b' : null);
              const cell = (v: number, side: 'a' | 'b') => {
                const isBetter = better === side;
                const signCls = row.signed ? (v > 0 ? 'text-emerald-400' : v < 0 ? 'text-rose-400' : 'text-white/50') : 'text-white/70';
                return (
                  <span className={`text-sm font-bold tabular-nums text-right sm:text-left ${signCls}`}
                    style={isBetter ? { textShadow: '0 0 14px rgba(52,211,153,0.35)' } : { opacity: better && !isBetter ? 0.55 : 1 }}>
                    {row.signed && v > 0 ? '+' : ''}{row.fmt(v)}
                    {isBetter && <span className="ml-1.5 text-[9px] align-middle" style={{ color: 'rgba(52,211,153,0.8)' }}>●</span>}
                  </span>
                );
              };
              return (
                <div key={row.label} className="grid grid-cols-[1.2fr_1fr_1fr] px-5 py-2.5"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span className="text-xs text-white/40 self-center">
                    {row.label === 'Wins / Losses'
                      ? 'Wins / Losses'
                      : row.label}
                  </span>
                  {row.label === 'Wins / Losses' ? (
                    <>
                      <span className="text-sm font-bold text-white/70 tabular-nums text-right sm:text-left">{statsA!.wins} / {statsA!.losses}</span>
                      <span className="text-sm font-bold text-white/70 tabular-nums text-right sm:text-left">{statsB!.wins} / {statsB!.losses}</span>
                    </>
                  ) : (
                    <>
                      {cell(va, 'a')}
                      {cell(vb, 'b')}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {(statsA!.truncated || statsB!.truncated) && (
            <p className="mt-2 text-[10px] text-white/25">
              * One of these wallets has more than 3,000 lifetime positions; stats are computed on the most recent 3,000.
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-3">
            <a href={`/wallet/${statsA!.address}`} className="text-xs text-white/40 hover:text-white/70 transition-colors">
              Full profile: {formatAddress(statsA!.address, 6)} →
            </a>
            <a href={`/wallet/${statsB!.address}`} className="text-xs text-white/40 hover:text-white/70 transition-colors">
              Full profile: {formatAddress(statsB!.address, 6)} →
            </a>
          </div>
        </section>
      )}

      {/* Hint */}
      {!ready && !loading && (
        <p className="text-xs text-white/25">
          Tip: grab wallet addresses from the <a href="/leaderboard" className="underline hover:text-white/50">Leaderboard</a> and paste them above.
          The comparison is shareable — the URL updates with both addresses.
        </p>
      )}
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="glass rounded-2xl h-96 animate-shimmer" />}>
      <CompareInner />
    </Suspense>
  );
}
