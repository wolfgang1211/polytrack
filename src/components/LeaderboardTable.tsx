'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { LeaderboardEntry, SortOrder, TimeWindow } from '@/types';
import { formatCurrency, formatAddress, computeSmartScores, scoreTier } from '@/lib/utils';
import { profileUrl } from '@/lib/builder';
import { SkeletonRow } from './LoadingSpinner';

type LbSortField = 'pnl' | 'vol' | 'rank' | 'score';

const TIME_WINDOWS: { label: string; value: TimeWindow }[] = [
  { label: 'All Time', value: 'allTime' },
  { label: '1 Month',  value: '1m' },
  { label: '1 Week',   value: '1w' },
  { label: '24 Hours', value: '1d' },
];

const RANK_STYLES: Record<number, { text: string; bg: string; ring: string; badge: string }> = {
  1: { text: 'text-grad-gold',   bg: 'rgba(251,191,36,0.10)', ring: 'rgba(251,191,36,0.4)',  badge: '🥇' },
  2: { text: 'text-grad-silver', bg: 'rgba(148,163,184,0.08)', ring: 'rgba(148,163,184,0.3)', badge: '🥈' },
  3: { text: 'text-grad-bronze', bg: 'rgba(234,88,12,0.10)',  ring: 'rgba(234,88,12,0.35)',  badge: '🥉' },
};

interface Props {
  data: LeaderboardEntry[];
  loading: boolean;
  error: string | null;
  window: TimeWindow;
  onWindowChange: (w: TimeWindow) => void;
}

function SortArrow({ active, order }: { active: boolean; order: SortOrder }) {
  return (
    <span className={`ml-1 text-[10px] transition-colors ${active ? 'text-violet-400' : 'text-white/15'}`}>
      {active && order === 'asc' ? '↑' : '↓'}
    </span>
  );
}

export default function LeaderboardTable({ data, loading, error, window, onWindowChange }: Props) {
  const [sortField, setSortField] = useState<LbSortField>('pnl');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [search, setSearch] = useState('');
  const [profitableOnly, setProfitableOnly] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  function handleSort(field: LbSortField) {
    if (sortField === field) setSortOrder(o => o === 'desc' ? 'asc' : 'desc');
    else { setSortField(field); setSortOrder('desc'); }
  }

  // Smart Score computed across the full dataset (percentile-based)
  const scores = useMemo(() => computeSmartScores(data), [data]);

  const sorted = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = data.filter(e => {
      if (q && !e.proxyWallet.toLowerCase().includes(q) && !(e.userName || '').toLowerCase().includes(q)) return false;
      if (profitableOnly && e.pnl <= 0) return false;
      if (verifiedOnly && !e.verifiedBadge) return false;
      return true;
    });
    return [...filtered].sort((a, b) => {
      let diff: number;
      if (sortField === 'rank') diff = parseInt(a.rank) - parseInt(b.rank);
      else if (sortField === 'score') diff = (scores.get(a) ?? 0) - (scores.get(b) ?? 0);
      else diff = (a[sortField] ?? 0) - (b[sortField] ?? 0);
      return sortOrder === 'desc' ? -diff : diff;
    });
  }, [data, search, sortField, sortOrder, profitableOnly, verifiedOnly, scores]);

  return (
    <div className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>

      {/* Controls row */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Time window pills */}
        <div className="flex gap-1 rounded-2xl glass p-1">
          {TIME_WINDOWS.map(tw => (
            <button
              key={tw.value}
              onClick={() => onWindowChange(tw.value)}
              className={`relative rounded-xl px-4 py-1.5 text-xs font-semibold transition-all duration-200
                ${window === tw.value ? 'text-white' : 'text-white/35 hover:text-white/60'}`}
            >
              {window === tw.value && (
                <span className="absolute inset-0 rounded-xl"
                  style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.6), rgba(37,99,235,0.6))', border: '1px solid rgba(139,92,246,0.4)' }} />
              )}
              <span className="relative">{tw.label}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Filter chips */}
          <button
            onClick={() => setProfitableOnly(v => !v)}
            className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all ${profitableOnly ? 'text-emerald-300' : 'text-white/35 hover:text-white/60'}`}
            style={profitableOnly
              ? { background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.35)' }
              : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            Profitable
          </button>
          <button
            onClick={() => setVerifiedOnly(v => !v)}
            className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all ${verifiedOnly ? 'text-violet-300' : 'text-white/35 hover:text-white/60'}`}
            style={verifiedOnly
              ? { background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.35)' }
              : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            ✓ Verified
          </button>

          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/25" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Name or address…"
              className="glass rounded-xl pl-8 pr-3 py-2 text-xs text-white/70 placeholder-white/20 outline-none w-full sm:w-52 focus:border-violet-500/40 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-x-auto" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="min-w-[660px]">
        {/* Header */}
        <div className="grid grid-cols-[56px_1fr_120px_120px_104px_36px] glass-strong px-4 py-3"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={() => handleSort('rank')} className="text-left text-[10px] font-semibold uppercase tracking-widest text-white/30 hover:text-white/60 transition-colors">
            Rank<SortArrow active={sortField==='rank'} order={sortOrder} />
          </button>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Trader</span>
          <button onClick={() => handleSort('pnl')} className="text-right text-[10px] font-semibold uppercase tracking-widest text-white/30 hover:text-white/60 transition-colors">
            P&amp;L<SortArrow active={sortField==='pnl'} order={sortOrder} />
          </button>
          <button onClick={() => handleSort('vol')} className="text-right text-[10px] font-semibold uppercase tracking-widest text-white/30 hover:text-white/60 transition-colors">
            Volume<SortArrow active={sortField==='vol'} order={sortOrder} />
          </button>
          <button onClick={() => handleSort('score')} className="text-right text-[10px] font-semibold uppercase tracking-widest text-white/30 hover:text-white/60 transition-colors" title="Risk-adjusted smart score (0–100)">
            Smart<SortArrow active={sortField==='score'} order={sortOrder} />
          </button>
          <span />
        </div>

        {/* Rows */}
        <div>
          {loading && Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="grid grid-cols-[56px_1fr_120px_120px_104px_36px] px-4 py-3.5"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <SkeletonRow cols={6} />
            </div>
          ))}

          {error && (
            <div className="py-20 text-center">
              <p className="text-sm text-white/30">{error}</p>
            </div>
          )}

          {!loading && !error && sorted.length === 0 && (
            <div className="py-20 text-center">
              <p className="text-sm text-white/30">No results found</p>
            </div>
          )}

          {!loading && !error && sorted.map((entry, idx) => {
            const rank = parseInt(entry.rank, 10) || idx + 1;
            const rs = RANK_STYLES[rank];
            const displayName = entry.userName || formatAddress(entry.proxyWallet);
            const isTop3 = rank <= 3;
            const score = scores.get(entry) ?? 0;
            const tier = scoreTier(score);

            return (
              <Link
                key={entry.proxyWallet}
                href={`/wallet/${entry.proxyWallet.toLowerCase()}`}
                className="group block"
                style={{ animationDelay: `${idx * 25}ms` }}
              >
                <div
                  className="grid grid-cols-[56px_1fr_120px_120px_104px_36px] px-4 py-3.5 transition-all duration-200
                    hover:bg-white/[0.03] cursor-pointer"
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    borderLeft: isTop3 ? `2px solid ${rs.ring}` : '2px solid transparent',
                    background: isTop3 ? rs.bg : undefined,
                  }}
                >
                  {/* Rank */}
                  <div className="flex items-center">
                    {isTop3 ? (
                      <span className="text-lg leading-none select-none">{rs.badge}</span>
                    ) : (
                      <span className="font-mono text-xs font-semibold text-white/25">#{rank}</span>
                    )}
                  </div>

                  {/* Trader */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative flex-shrink-0">
                      {entry.profileImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={entry.profileImage} alt="" className="h-9 w-9 rounded-full object-cover" style={{ boxShadow: isTop3 ? `0 0 0 2px ${rs.ring}` : '0 0 0 1px rgba(255,255,255,0.1)' }} />
                      ) : (
                        <div className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-black text-white"
                          style={{ background: `linear-gradient(135deg, #7c3aed, #2563eb)`, boxShadow: isTop3 ? `0 0 0 2px ${rs.ring}, 0 0 16px ${rs.bg}` : '0 0 0 1px rgba(255,255,255,0.08)' }}>
                          {displayName[0]?.toUpperCase()}
                        </div>
                      )}
                      {entry.verifiedBadge && (
                        <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[7px]"
                          style={{ background: 'linear-gradient(135deg, #2563eb, #7c3aed)' }}>
                          ✓
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold truncate transition-colors duration-150 group-hover:text-violet-300
                        ${isTop3 ? rs.text : 'text-white/85'}`}>
                        {displayName}
                      </p>
                      <p className="font-mono text-[10px] text-white/20 truncate">{formatAddress(entry.proxyWallet)}</p>
                    </div>
                  </div>

                  {/* PnL */}
                  <div className="flex items-center justify-end">
                    <span className={`text-sm font-black ${entry.pnl >= 0 ? 'text-grad-profit' : 'text-grad-loss'}`}>
                      {entry.pnl >= 0 ? '+' : ''}{formatCurrency(entry.pnl, true)}
                    </span>
                  </div>

                  {/* Volume */}
                  <div className="flex items-center justify-end">
                    <span className="text-sm font-semibold text-white/40">
                      {formatCurrency(entry.vol, true)}
                    </span>
                  </div>

                  {/* Smart Score */}
                  <div className="flex items-center justify-end gap-1.5" title={`${tier.label} · score ${score}/100`}>
                    <span className="text-sm font-black tabular-nums" style={{ color: tier.color }}>{score}</span>
                    <span className="text-[11px] leading-none">{tier.badge}</span>
                  </div>

                  {/* Polymarket link — builder code dahil */}
                  <div className="flex items-center justify-center" onClick={e => e.preventDefault()}>
                    <a
                      href={profileUrl(entry.proxyWallet)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open on Polymarket"
                      className="flex h-7 w-7 items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-110"
                      style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.25)' }}
                    >
                      <svg className="h-3 w-3 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Footer */}
        {!loading && sorted.length > 0 && (
          <div className="px-4 py-3 flex items-center justify-between glass-strong"
            style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <span className="text-[10px] text-white/20">{sorted.length} traders</span>
            <span className="text-[10px] text-white/15">data-api.polymarket.com</span>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
