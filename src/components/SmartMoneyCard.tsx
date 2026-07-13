'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatCurrency, formatAddress } from '@/lib/utils';
import { useLanguage } from '@/components/LanguageProvider';

interface LbEntry { proxyWallet: string; userName?: string | null; profileImage?: string | null; pnl: number }

export default function SmartMoneyCard() {
  const [rows, setRows] = useState<LbEntry[] | null>(null);
  const { t } = useLanguage();

  useEffect(() => {
    fetch('/api/leaderboard?window=allTime&limit=4')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setRows(d.slice(0, 4)); else setRows([]); })
      .catch(() => setRows([]));
  }, []);

  return (
    <div className="w-full min-w-0 max-w-full rounded-xl overflow-hidden"
      aria-busy={rows === null}
      style={{ border: '1px solid var(--vi-border)', background: 'rgba(255,255,255,0.015)' }}>

      {/* Terminal header */}
      <div className="flex items-center justify-between px-4 py-2.5"
        style={{ borderBottom: '1px solid var(--vi-border-xs)', background: 'rgba(139,92,246,0.06)' }}>
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] font-bold" style={{ color: 'rgba(255,255,255,0.55)' }}>
            {t('common.smartMoney')}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[9px] uppercase tracking-[0.12em]" style={{ color: 'rgba(255,255,255,0.22)' }}>{t('common.allTime')}</span>
          <Link href="/leaderboard"
            className="font-mono text-[9px] uppercase tracking-[0.12em] text-violet-400 hover:text-violet-300 transition-colors">
            {t('common.viewAll')}
          </Link>
        </div>
      </div>

      <div className="flex flex-col" data-testid={rows === null ? 'smart-money-loading' : undefined}>
        {rows?.length === 0 ? (
          <div className="flex h-44 items-center justify-center px-4 text-center font-mono text-[10px] uppercase tracking-wider text-white/30">
            {t('common.dataUnavailable')}
          </div>
        ) : (rows ?? Array.from({ length: 4 })).map((e, i) => {
          const entry = e as LbEntry | undefined;
          if (!entry) return (
            <div key={i} className="flex h-11 items-center gap-3 px-4"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <span className="h-3 w-5 rounded animate-shimmer" />
              <span className="h-3 min-w-0 flex-1 rounded animate-shimmer" />
              <span className="h-3 w-16 rounded animate-shimmer" />
            </div>
          );
          const name     = entry.userName || formatAddress(entry.proxyWallet);
          const isProfit = entry.pnl >= 0;
          const strip    = isProfit ? '#34d399' : '#fb7185';
          const stripOp  = i === 0 ? 0.90 : i === 1 ? 0.60 : 0.35;

          return (
            <Link key={entry.proxyWallet}
              href={`/wallet/${entry.proxyWallet.toLowerCase()}`}
              className="relative flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/[0.035] group"
              style={{ borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>

              {/* Colored left-edge strip */}
              <span className="absolute left-0 top-0 bottom-0 w-[3px]"
                style={{ background: strip, opacity: stripOp }} />

              <span className="w-5 flex-shrink-0 text-center font-mono text-[10px] font-black tabular-nums"
                style={{ color: i < 3 ? 'rgba(139,92,246,0.80)' : 'rgba(255,255,255,0.22)' }}>
                {String(i + 1).padStart(2, '0')}
              </span>

              <span className="flex-1 truncate text-xs font-semibold transition-colors"
                style={{ color: 'rgba(255,255,255,0.62)' }}>
                {name}
              </span>

              <span className={`text-xs font-black tabular-nums font-mono flex-shrink-0 ${isProfit ? 'text-grad-profit' : 'text-grad-loss'}`}>
                {isProfit ? '+' : ''}{formatCurrency(entry.pnl, true)}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
