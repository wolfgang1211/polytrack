import { formatCurrency } from '@/lib/utils';
import { marketUrl } from '@/lib/builder';
import type { Position } from '@/types';

interface Props {
  position: Position;
  delay?: number;
}

export default function PositionCard({ position, delay = 0 }: Props) {
  const pnl = position.cashPnl;
  const isProfit = pnl > 0;
  const isLoss = pnl < 0;
  const isClosed = position.currentValue === 0 && position.curPrice === 0;
  const isYes = position.outcome === 'Yes';

  const endDate = position.endDate
    ? new Date(position.endDate).toLocaleDateString('tr-TR', { day:'numeric', month:'short', year:'numeric' })
    : null;

  return (
    <div
      className="glass glass-hover gradient-border rounded-2xl p-4 animate-fade-in-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Top row */}
      <div className="flex items-start gap-3">
        {position.icon ? (
          <div className="relative flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={position.icon} alt="" className="h-12 w-12 rounded-xl object-cover"
              style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }} />
          </div>
        ) : (
          <div className="h-12 w-12 rounded-xl flex-shrink-0 animate-shimmer" />
        )}

        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white/80 line-clamp-2 leading-snug">{position.title}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {/* Outcome badge */}
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
              style={isYes
                ? { background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }
                : { background: 'rgba(244,63,94,0.15)', color: '#fb7185', border: '1px solid rgba(251,113,133,0.3)' }}
            >
              {position.outcome}
            </span>
            {isClosed && (
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold text-white/35"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                Kapandı
              </span>
            )}
            {position.redeemable && !isClosed && (
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{ background: 'rgba(16,185,129,0.12)', color:'#34d399', border:'1px solid rgba(52,211,153,0.2)' }}>
                Çekilebilir ✓
              </span>
            )}
            {endDate && <span className="text-[10px] text-white/25">{endDate}</span>}
          </div>
        </div>

        {/* PnL */}
        <div className="flex-shrink-0 text-right">
          <p className={`text-base font-black leading-none ${isProfit ? 'text-grad-profit' : isLoss ? 'text-grad-loss' : 'text-white/40'}`}>
            {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
          </p>
          <p className={`mt-0.5 text-[11px] font-semibold ${isProfit ? 'text-emerald-500/70' : isLoss ? 'text-rose-500/70' : 'text-white/25'}`}>
            {position.percentPnl >= 0 ? '+' : ''}{position.percentPnl.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl px-3 py-2.5"
        style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.04)' }}>
        <div>
          <p className="text-[9px] uppercase tracking-wider text-white/25 mb-0.5">Adet</p>
          <p className="text-xs font-bold text-white/70">
            {position.size.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
          </p>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-wider text-white/25 mb-0.5">Ort. Fiyat</p>
          <p className="text-xs font-bold text-white/70">${position.avgPrice.toFixed(3)}</p>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-wider text-white/25 mb-0.5">Anlık</p>
          <p className="text-xs font-bold text-white/70">
            {position.curPrice > 0 ? `$${position.curPrice.toFixed(3)}` : '—'}
          </p>
        </div>
      </div>

      {/* Trade button — builder code dahil */}
      {!isClosed && (
        <a
          href={marketUrl(position.eventSlug, position.slug)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-[11px] font-bold transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
          style={{
            background: 'linear-gradient(135deg, rgba(124,58,237,0.25), rgba(37,99,235,0.25))',
            border: '1px solid rgba(139,92,246,0.3)',
            color: '#a78bfa',
          }}
        >
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
              d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          Polymarket&apos;ta İşlem Yap
          <svg className="h-2.5 w-2.5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      )}
    </div>
  );
}
