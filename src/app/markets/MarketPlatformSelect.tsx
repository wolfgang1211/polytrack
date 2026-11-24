import Link from 'next/link';

export type MarketPlatform = 'polymarket' | 'kalshi';

// Each provider has one explorer view: Polymarket by 24h volume, Kalshi by 24h volume across all open markets.
const PLATFORMS: { key: MarketPlatform; label: string; href: string }[] = [
  { key: 'polymarket', label: 'Polymarket', href: '/markets?platform=polymarket' },
  { key: 'kalshi', label: 'Kalshi', href: '/markets?platform=kalshi' },
];

/** Exact scalar match only; repeated, unknown or missing values fall back to the Polymarket default. */
export function resolvePlatform(value: string | string[] | undefined): MarketPlatform {
  return value === 'kalshi' ? 'kalshi' : 'polymarket';
}

/** The single Kalshi explorer URL (legacy ?view= / ?series= URLs redirect here). */
export const KALSHI_HREF = '/markets?platform=kalshi';

const linkClass = (current: boolean) => `inline-flex min-h-[44px] items-center rounded-lg px-3 text-xs font-semibold transition-colors ${current ? 'text-ink' : 'text-ink/55 hover:text-ink/80'}`;
const linkStyle = (current: boolean) => (current ? { background: 'var(--accent-fill)', border: '1px solid var(--accent-border-md)' } : { border: '1px solid transparent' });

/* Plain navigation links (not tabs): each provider is its own URL and its own client state. */
export default function MarketPlatformSelect({ active }: { active: MarketPlatform }) {
  return (
    <nav aria-label="Market data provider" className="flex min-w-0 flex-wrap items-center gap-2">
      <span className="text-xs uppercase tracking-widest text-ink/55">Provider</span>
      <div className="flex flex-wrap gap-1 rounded-xl glass p-1">
        {PLATFORMS.map(p => {
          const current = p.key === active;
          return (
            <Link
              key={p.key}
              href={p.href}
              aria-current={current ? 'page' : undefined}
              className={linkClass(current)}
              style={linkStyle(current)}
            >
              {p.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
