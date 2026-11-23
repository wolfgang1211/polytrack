interface PolymarketTradeLinkProps {
  href: string;
  compact?: boolean;
}

export default function PolymarketTradeLink({ href, compact = false }: PolymarketTradeLinkProps) {
  return (
    <div
      className={compact ? 'pt-2.5' : 'pt-3'}
      style={{ borderTop: '1px solid rgba(var(--ink-rgb),0.06)' }}
    >
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer sponsored"
        aria-label="Trade on Polymarket (opens external site)"
        data-polymarket-trade-link
        className={`inline-flex w-full items-center justify-center gap-1.5 rounded-lg font-bold text-[var(--text-primary)] transition-all hover:-translate-y-0.5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-secondary)]/70 ${
          compact ? 'min-h-11 px-2 text-xs' : 'min-h-11 px-3 text-xs'
        }`}
        style={{ background: 'var(--accent-tint)', border: '1px solid var(--accent-border-md)' }}
      >
        <span>Trade on Polymarket</span>
        <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5h5v5m0-5L10 14M19 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5" />
        </svg>
      </a>
      <p className="mt-1 text-center text-xs text-ink/55">
        External link · Referral may apply
      </p>
    </div>
  );
}
