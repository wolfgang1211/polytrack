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
      <span className="font-mono text-[10px] font-black tracking-widest" style={{ color: 'rgba(255,255,255,0.20)' }}>{index}</span>
      <div className="h-px w-12" style={{ background: 'var(--vi-border)' }} />
      <span className="font-mono text-[10px] uppercase tracking-[0.15em]" style={{ color: 'rgba(255,255,255,0.25)' }}>{label}</span>
      <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, var(--vi-border), transparent)' }} />
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
          <span className="font-mono text-[10px] font-black tracking-widest" style={{ color: 'rgba(255,255,255,0.20)' }}>[01]</span>
          <div className="h-px w-12" style={{ background: 'var(--vi-border)' }} />
          <span className="font-mono text-[10px] uppercase tracking-[0.15em]" style={{ color: 'rgba(255,255,255,0.22)' }}>Terminal Intelligence</span>
        </div>

        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6 sm:gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] lg:items-start">
          <div className="flex min-w-0 flex-col items-center text-center lg:items-start lg:text-left">
            <h1
              className="text-3xl font-black leading-[1.12] sm:text-4xl lg:text-5xl"
              style={{ fontFamily: 'var(--font-serif-display, Georgia, serif)' }}
            >
              <span className="text-white">Real time</span>
              <br className="sm:hidden" />
              <span className="hidden sm:inline"> </span>
              <span className="text-grad">alpha</span>
              <span className="text-white"> from the best</span>
            </h1>
            <p className="mt-4 max-w-sm text-sm font-medium leading-relaxed sm:mt-5" style={{ color: 'rgba(255,255,255,0.46)' }}>
              Discover, follow and copy the most profitable traders on Polymarket in real time.
            </p>
            <div className="mt-6 flex w-full max-w-sm flex-col gap-3 sm:flex-row lg:justify-start">
              <Link
                href="/markets"
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70"
                style={{
                  background: 'linear-gradient(135deg, rgba(124,58,237,0.95), rgba(147,51,234,0.88))',
                  border: '1px solid rgba(196,181,253,0.35)',
                  boxShadow: '0 12px 32px rgba(124,58,237,0.22)',
                }}
              >
                Explore Markets
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14m-6-6 6 6-6 6" />
                </svg>
              </Link>
              <Link
                href="/checker"
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white/75 transition-all hover:-translate-y-0.5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70"
                style={{ background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.12)' }}
              >
                <svg className="h-4 w-4 text-violet-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
