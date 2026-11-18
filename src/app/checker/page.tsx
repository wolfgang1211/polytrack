'use client';

import { useState } from 'react';
import WalletSearch from '@/components/WalletSearch';

export default function WalletCheckerPage() {
  const [showExplainers, setShowExplainers] = useState(false);

  return (
    <div className="flex flex-col gap-4">

      {/* Compact header */}
      <div className="animate-fade-in-up flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-block h-0.5 w-5 rounded-full"
              style={{ background: 'var(--text-secondary)' }} />
            <span className="text-[10px] uppercase tracking-widest text-ink/30 font-semibold">Polymarket</span>
          </div>
          <h1 className="text-2xl font-black leading-none tracking-tight">
            <span className="text-ink">Wallet </span><span className="text-grad">Checker</span>
          </h1>
          <p className="mt-1 text-xs text-ink/35">
            Enter any EVM address to view P&amp;L, win rate, positions and full trade history.
          </p>
        </div>
      </div>

      {/* Search card */}
      <div className="glass rounded-2xl p-5 animate-fade-in-up" style={{ animationDelay: '60ms' }}>
        <WalletSearch />
      </div>

      {/* Collapsible explainers */}
      <div className="animate-fade-in-up" style={{ animationDelay: '120ms' }}>
        <button
          onClick={() => setShowExplainers(v => !v)}
          className="flex items-center gap-2 text-[11px] text-ink/30 hover:text-ink/55 transition-colors"
        >
          <span
            className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black"
            style={{ background: 'rgba(var(--ink-rgb),0.15)', border: '1px solid rgba(var(--ink-rgb),0.25)', color: 'var(--text-secondary)' }}
          >
            ?
          </span>
          How to read these metrics
          <svg
            className="h-3 w-3 transition-transform duration-200"
            style={{ transform: showExplainers ? 'rotate(180deg)' : 'rotate(0deg)' }}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showExplainers && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="glass rounded-xl p-4" style={{ border: '1px solid rgba(var(--ink-rgb),0.12)' }}>
              <p className="text-xs font-bold text-ink/70 mb-1.5">What does P&amp;L mean?</p>
              <p className="text-[11px] leading-relaxed text-ink/35">
                Net profit or loss from all Polymarket activity: realized gains from closed positions plus
                unrealized mark-to-market on open ones. Read it alongside volume and position count.
              </p>
            </div>
            <div className="glass rounded-xl p-4" style={{ border: '1px solid rgba(var(--ink-rgb),0.12)' }}>
              <p className="text-xs font-bold text-ink/70 mb-1.5">How to read win rate</p>
              <p className="text-[11px] leading-relaxed text-ink/35">
                Share of resolved positions that finished profitably. On its own it&apos;s not enough;
                position size, odds paid and total P&amp;L together determine whether a strategy works.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
