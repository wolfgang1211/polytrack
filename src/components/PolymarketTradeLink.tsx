interface PolymarketTradeLinkProps {
  href: string;
  compact?: boolean;
}

export default function PolymarketTradeLink({ href, compact = false }: PolymarketTradeLinkProps) {
  return (
    <div
      className={compact ? 'pt-2.5' : 'pt-3'}
      style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
    >
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer sponsored"
        aria-label="Trade on Polymarket (opens external site)"
        data-polymarket-trade-link
        className={`inline-flex w-full items-center justify-center gap-1.5 rounded-lg font-bold text-violet-200 transition-all hover:-translate-y-0.5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70 ${
          compact ? 'min-h-8 px-2 text-[10px]' : 'min-h-10 px-3 text-xs'
        }`}
        style={{ background: 'var(--vi-tint)', border: '1px solid var(--vi-border-md)' }}
      >
        <span>Trade on Polymarket</span>
        <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5h5v5m0-5L10 14M19 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5" />
        </svg>
      </a>
      <p className={`mt-1 text-center text-white/35 ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
        External link · Referral may apply
      </p>
    </div>
  );
}
