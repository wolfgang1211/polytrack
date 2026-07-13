'use client';

import { useState } from 'react';
import WalletSearch from '@/components/WalletSearch';
import { useLanguage } from '@/components/LanguageProvider';

export default function WalletCheckerPage() {
  const [showExplainers, setShowExplainers] = useState(false);
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-4">

      {/* Compact header */}
      <div className="animate-fade-in-up flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-block h-0.5 w-5 rounded-full"
              style={{ background: 'linear-gradient(90deg,#7c3aed,#9333ea)' }} />
            <span className="text-[10px] uppercase tracking-widest text-white/30 font-semibold">Polymarket</span>
          </div>
          <h1 className="text-2xl font-black leading-none tracking-tight">
            <span className="text-white">{t('checker.titlePrefix')} </span><span className="text-grad">{t('checker.titleAccent')}</span>
          </h1>
          <p className="mt-1 text-xs text-white/35">
            {t('checker.subtitle')}
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
          className="flex items-center gap-2 text-[11px] text-white/30 hover:text-white/55 transition-colors"
        >
          <span
            className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black"
            style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.25)', color: '#a78bfa' }}
          >
            ?
          </span>
          {t('checker.explainerToggle')}
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
            <div className="glass rounded-xl p-4" style={{ border: '1px solid rgba(124,58,237,0.12)' }}>
              <p className="text-xs font-bold text-white/70 mb-1.5">{t('checker.pnlTitle')}</p>
              <p className="text-[11px] leading-relaxed text-white/35">
                {t('checker.pnlDescription')}
              </p>
            </div>
            <div className="glass rounded-xl p-4" style={{ border: '1px solid rgba(124,58,237,0.12)' }}>
              <p className="text-xs font-bold text-white/70 mb-1.5">{t('checker.winRateTitle')}</p>
              <p className="text-[11px] leading-relaxed text-white/35">
                {t('checker.winRateDescription')}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
