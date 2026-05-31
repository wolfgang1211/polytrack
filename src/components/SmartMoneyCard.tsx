'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatCurrency, formatAddress } from '@/lib/utils';

interface LbEntry { proxyWallet: string; userName?: string | null; profileImage?: string | null; pnl: number }

/** Hero side card: a compact top-4 "smart money" preview that links through
 *  to the full leaderboard. Pulls the weekly leaderboard's first four traders. */
export default function SmartMoneyCard() {
  const [rows, setRows] = useState<LbEntry[] | null>(null);

  useEffect(() => {
    fetch('/api/leaderboard?window=1w&limit=4')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setRows(d.slice(0, 4)); })
      .catch(() => {});
  }, []);

  return (
    <div className="relative w-full rounded-2xl p-4 glass-strong"
      style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
          <span className="text-xs font-bold text-white/80">Smart Money</span>
        </div>
        <Link href="/leaderboard"
          className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-300 transition-colors hover:text-violet-200"
          style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)' }}>
          View All →
        </Link>
      </div>

      <div className="flex flex-col gap-1.5">
        {(rows ?? Array.from({ length: 4 })).map((e, i) => {
          const entry = e as LbEntry | undefined;
          if (!entry) return <div key={i} className="h-10 rounded-xl animate-shimmer" />;
          const name = entry.userName || formatAddress(entry.proxyWallet);
          return (
            <Link key={entry.proxyWallet} href={`/wallet/${entry.proxyWallet.toLowerCase()}`}
              className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors hover:bg-white/5">
              <span className="w-4 flex-shrink-0 text-center text-[11px] font-black text-white/25">{i + 1}</span>
              {entry.profileImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={entry.profileImage} alt="" className="h-7 w-7 flex-shrink-0 rounded-full object-cover" />
              ) : (
                <span className="h-7 w-7 flex-shrink-0 rounded-full"
                  style={{ background: 'linear-gradient(135deg,rgba(124,58,237,0.5),rgba(147,51,234,0.5))' }} />
              )}
              <span className="flex-1 truncate text-xs font-semibold text-white/70">{name}</span>
              <span className={`text-xs font-black tabular-nums ${entry.pnl >= 0 ? 'text-grad-profit' : 'text-grad-loss'}`}>
                {entry.pnl >= 0 ? '+' : ''}{formatCurrency(entry.pnl, true)}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
