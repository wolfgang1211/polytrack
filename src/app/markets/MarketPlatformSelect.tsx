import Link from 'next/link';

export type MarketPlatform = 'polymarket' | 'kalshi';

// Kalshi lands on Top (every open market ranked by 24h volume, like the Polymarket explorer); Discover, the raw newest
// list (/markets?platform=kalshi) and Events stay one click away.
const PLATFORMS: { key: MarketPlatform; label: string; href: string }[] = [
  { key: 'polymarket', label: 'Polymarket', href: '/markets?platform=polymarket' },
  { key: 'kalshi', label: 'Kalshi', href: '/markets?platform=kalshi' },
];

/** Exact scalar match only; repeated, unknown or missing values fall back to the Polymarket default. */
export function resolvePlatform(value: string | string[] | undefined): MarketPlatform {
  return value === 'kalshi' ? 'kalshi' : 'polymarket';
}

export type KalshiView = 'top' | 'discover' | 'markets' | 'events';

/** Exact scalar "top", "discover" or "events" only; repeated, unknown or missing values fall back to the raw markets list. */
export function resolveKalshiView(value: string | string[] | undefined): KalshiView {
  return value === 'events' || value === 'discover' || value === 'top' ? value : 'markets';
}

export const TOP_HREF = '/markets?platform=kalshi&view=top';
/** The single Kalshi explorer URL (legacy ?view= URLs redirect here). */
export const KALSHI_HREF = '/markets?platform=kalshi';

export const DISCOVER_HREF = '/markets?platform=kalshi&view=discover';

const VIEWS: { key: KalshiView; label: string; href: string }[] = [
  { key: 'top', label: 'Top', href: TOP_HREF },
  { key: 'discover', label: 'Discover', href: DISCOVER_HREF },
  { key: 'markets', label: 'Newest', href: '/markets?platform=kalshi' },
  { key: 'events', label: 'Events', href: '/markets?platform=kalshi&view=events' },
];

const linkClass = (current: boolean) => `inline-flex min-h-[44px] items-center rounded-lg px-3 text-xs font-semibold transition-colors ${current ? 'text-ink' : 'text-ink/55 hover:text-ink/80'}`;
const linkStyle = (current: boolean) => (current ? { background: 'var(--accent-fill)', border: '1px solid var(--accent-border-md)' } : { border: '1px solid transparent' });

/* Kalshi Markets / Events: native links, each view is its own URL. */
export function KalshiViewSelect({ active }: { active: KalshiView }) {
  return (
    <nav aria-label="Kalshi view" className="flex min-w-0 flex-wrap items-center gap-2">
      <span className="text-xs uppercase tracking-widest text-ink/55">View</span>
      <div className="flex flex-wrap gap-1 rounded-xl glass p-1">
        {VIEWS.map(v => (
          <Link key={v.key} href={v.href} aria-current={v.key === active ? 'page' : undefined}
            className={linkClass(v.key === active)} style={linkStyle(v.key === active)}>
            {v.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

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
