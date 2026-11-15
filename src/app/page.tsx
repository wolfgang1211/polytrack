'use client';

import Link from 'next/link';
import SmartMoneyCard from '@/components/SmartMoneyCard';
import DashboardStats from '@/components/DashboardStats';
import TopMarkets from '@/components/TopMarkets';
import HotBets from '@/components/HotBets';
import RecentBigTrades from '@/components/RecentBigTrades';
import RisingTraders from '@/components/RisingTraders';
import LiveTicker from '@/components/LiveTicker';

function SectionHeader({ index, label }: { index: string; label: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="font-mono text-[10px] font-medium tracking-widest" style={{ color: 'var(--text-muted)' }}>{index}</span>
      <div className="h-px w-8" style={{ background: 'var(--accent-border)' }} />
      <span className="font-mono text-[10px] uppercase tracking-[0.15em]" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <div className="h-px flex-1" style={{ background: 'var(--accent-border)' }} />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="flex w-full min-w-0 max-w-full flex-col gap-8 sm:gap-10">

      {/* ── Live trade ticker ── */}
      <LiveTicker />

      {/* ── [01] Hero ── */}
      <div className="min-w-0 animate-fade-in-up">
        <div className="flex items-center gap-3 mb-5 sm:mb-8">
          <span className="font-mono text-[10px] font-medium tracking-widest" style={{ color: 'var(--text-muted)' }}>[01]</span>
          <div className="h-px w-8" style={{ background: 'var(--accent-border)' }} />
          <span className="font-mono text-[10px] uppercase tracking-[0.15em]" style={{ color: 'var(--text-secondary)' }}>Polymarket Intelligence</span>
        </div>

        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6 sm:gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] lg:items-start">
          <div className="flex min-w-0 flex-col items-center text-center lg:items-start lg:text-left">
            <h1
              className="text-4xl font-normal leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl"
              style={{ fontFamily: 'var(--font-serif-display, Georgia, serif)' }}
            >
              <span>Real time alpha.</span>
              <br />
              <span className="italic">Without the noise.</span>
            </h1>
            <p className="mt-5 max-w-md text-sm font-normal leading-relaxed sm:text-base" style={{ color: 'var(--text-secondary)' }}>
              Discover and analyze notable Polymarket traders and market activity in real time.
            </p>
            <div className="mt-6 flex w-full max-w-sm flex-col gap-3 sm:flex-row lg:justify-start">
              <Link
                href="/markets"
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold text-[#111111] transition-colors hover:bg-white focus-visible:ring-2 focus-visible:ring-neutral-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111111]"
                style={{
                  background: 'var(--text-primary)',
                  border: '1px solid var(--text-primary)',
                }}
              >
                Explore Markets
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14m-6-6 6 6-6 6" />
                </svg>
              </Link>
              <Link
                href="/checker"
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold text-white/85 transition-colors hover:bg-white/5 hover:text-white focus-visible:ring-2 focus-visible:ring-neutral-300"
                style={{ border: '1px solid var(--accent-border)' }}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-4.35-4.35m1.35-5.65a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
                </svg>
                Analyze a Wallet
              </Link>
            </div>
          </div>
          <SmartMoneyCard />
        </div>
      </div>

      {/* ── [02] Platform Stats ── */}
      <div className="min-w-0">
        <SectionHeader index="[02]" label="Platform Stats" />
        <DashboardStats />
      </div>

      {/* ── [03] Live Feed + Rising Traders ── */}
      <div className="min-w-0">
        <SectionHeader index="[03]" label="Live Feed" />
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <RecentBigTrades />
          <div className="min-w-0 lg:sticky lg:top-4">
            <RisingTraders />
          </div>
        </div>
      </div>

      {/* ── [04] Top Markets ── */}
      <div className="min-w-0">
        <SectionHeader index="[04]" label="Top Markets" />
        <TopMarkets limit={12} showViewAll campaignContext="home_top_markets" />
      </div>

      {/* ── [05] Hot Bets ── */}
      <div className="min-w-0">
        <SectionHeader index="[05]" label="Hot Bets" />
        <HotBets />
      </div>

    </div>
  );
}
