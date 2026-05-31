'use client';

import WalletSearch from '@/components/WalletSearch';

export default function WalletCheckerPage() {
  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="animate-fade-in-up">
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-block h-1 w-8 rounded-full"
            style={{ background: 'linear-gradient(90deg,#7c3aed,#9333ea)' }} />
          <span className="text-[10px] uppercase tracking-widest text-white/30 font-semibold">Polymarket</span>
        </div>
        <h1 className="text-3xl font-black leading-none tracking-tight sm:text-4xl">
          <span className="text-white">Wallet </span><span className="text-grad">Checker</span>
        </h1>
        <p className="mt-2 max-w-xl text-sm text-white/40">
          Check any Polymarket wallet instantly. Enter an EVM address to view P&amp;L, win rate,
          positions and full trading history.
        </p>
      </div>

      {/* Search card */}
      <div className="glass rounded-2xl p-5 sm:p-6 animate-fade-in-up" style={{ animationDelay: '60ms' }}>
        <p className="text-sm font-bold text-white/80">Enter Wallet Address</p>
        <p className="mt-0.5 mb-4 text-xs text-white/35">
          Input an Ethereum wallet address (0x…) to analyze trading activity
        </p>
        <WalletSearch />
      </div>

      {/* Quick metric explainers */}
      <div className="grid gap-4 sm:grid-cols-2 animate-fade-in-up" style={{ animationDelay: '120ms' }}>
        <div className="glass rounded-2xl p-5">
          <p className="text-sm font-bold text-white/80">What does this wallet&apos;s P&amp;L mean?</p>
          <p className="mt-2 text-xs leading-relaxed text-white/40">
            Wallet P&amp;L is the net profit or loss from the wallet&apos;s Polymarket activity. It combines
            realized profit from closed positions with the unrealized mark-to-market of open ones, so read
            it alongside volume and position count.
          </p>
        </div>
        <div className="glass rounded-2xl p-5">
          <p className="text-sm font-bold text-white/80">How to read win rate</p>
          <p className="mt-2 text-xs leading-relaxed text-white/40">
            Win rate is the share of resolved positions that finished profitably. On its own it is not
            enough: position size, odds paid and total P&amp;L together determine whether a strategy is
            actually profitable.
          </p>
        </div>
      </div>
    </div>
  );
}
