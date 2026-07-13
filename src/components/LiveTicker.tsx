'use client';

import { useEffect, useState, useCallback } from 'react';
import type { RecentTrade } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { marketUrl } from '@/lib/builder';
import { useLanguage } from '@/components/LanguageProvider';

const REFRESH_MS = 20_000;

function usdcSize(t: RecentTrade): number {
  if (t.usdcSize != null) return Number(t.usdcSize);
  if (t.size != null && t.price != null) return Number(t.size) * Number(t.price);
  if (t.amount != null) return Number(t.amount);
  return 0;
}

function TickerItem({ trade }: { trade: RecentTrade }) {
  const { t } = useLanguage();
  const amount = usdcSize(trade);
  const isBuy  = (trade.side ?? '').toUpperCase() === 'BUY';
  const priceC = trade.price != null ? Math.round(Number(trade.price) * 100) : null;
  const href   = marketUrl(trade.eventSlug, trade.slug);
  const time   = trade.timestamp
    ? new Date(Number(trade.timestamp) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
    : null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2.5 px-4 py-2 transition-colors hover:bg-white/[0.04]"
      style={{ borderRight: '1px solid rgba(255,255,255,0.05)' }}
    >
      <span className="text-[10px] font-black uppercase tracking-wide"
        style={{ color: isBuy ? '#34d399' : '#fb7185' }}>
        {isBuy ? `▲ ${t('common.buy')}` : `▼ ${t('common.sell')}`}
      </span>
      {trade.icon && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={trade.icon} alt="" className="h-4 w-4 rounded object-cover" />
      )}
      <span className="max-w-[200px] truncate text-xs text-white/55">
        {trade.title ?? trade.asset ?? t('common.market')}
      </span>
      {trade.outcome && (
        <span className="text-[10px] font-semibold"
          style={{ color: (trade.outcome.toLowerCase() === 'yes' || trade.outcomeIndex === 0) ? '#34d399' : '#fb7185' }}>
          {trade.outcome}{priceC != null ? ` ${priceC}¢` : ''}
        </span>
      )}
      <span className="text-xs font-black tabular-nums text-white">{formatCurrency(amount, true)}</span>
      {time && (
        <span className="text-[10px] tabular-nums text-white/25">{time}</span>
      )}
    </a>
  );
}

export default function LiveTicker() {
  const [trades, setTrades] = useState<RecentTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  const load = useCallback(() => {
    fetch('/api/trades/recent')
      .then(r => r.json())
      .then(d => {
        const list = Array.isArray(d) ? d : (d?.trades ?? []);
        if (Array.isArray(list) && list.length) setTrades(list);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  if (loading) {
    return (
      <div
        data-testid="ticker-loading"
        role="status"
        aria-label={t('common.loading')}
        className="relative flex h-[42px] w-full min-w-0 max-w-full items-stretch overflow-hidden rounded-2xl glass"
        style={{ border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="flex flex-shrink-0 items-center gap-1.5 px-4"
          style={{ background: 'rgba(52,211,153,0.08)', borderRight: '1px solid rgba(52,211,153,0.2)' }}>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300">{t('common.live')}</span>
        </div>
        <div className="m-2 min-w-0 flex-1 rounded-lg animate-shimmer" />
      </div>
    );
  }

  if (trades.length === 0) return null;

  // duplicate the list so the -50% translate loops seamlessly
  const loop = [...trades, ...trades];

  return (
    <div className="relative flex w-full min-w-0 max-w-full items-stretch overflow-hidden rounded-2xl glass"
      style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
      {/* Live label */}
      <div className="flex flex-shrink-0 items-center gap-1.5 px-4"
        style={{ background: 'rgba(52,211,153,0.08)', borderRight: '1px solid rgba(52,211,153,0.2)' }}>
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300">{t('common.live')}</span>
      </div>

      {/* Scrolling track */}
      <div className="marquee-mask min-w-0 flex-1 overflow-hidden">
        <div className="marquee-track">
          {loop.map((trade, i) => <TickerItem key={`${trade.id ?? trade.asset}-${i}`} trade={trade} />)}
        </div>
      </div>
    </div>
  );
}
