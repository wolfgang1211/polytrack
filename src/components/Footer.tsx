import Link from 'next/link';
import Logo from '@/components/Logo';

const PRODUCT_LINKS = [
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/markets',     label: 'Markets' },
  { href: '/activity',    label: 'Activity' },
  { href: '/liquidity',   label: 'Liquidity Hub' },
  { href: '/insights',    label: 'Insights' },
  { href: '/checker',     label: 'Wallet Checker' },
  { href: '/compare',     label: 'Compare Traders' },
];

const LEGAL_LINKS = [
  { href: '/privacy',    label: 'Privacy Policy' },
  { href: '/terms',      label: 'Terms of Service' },
  { href: '/disclaimer', label: 'Disclaimer' },
  { href: '/about',      label: 'About' },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-20 border-t" style={{ borderColor: 'rgba(var(--ink-rgb),0.06)' }}>
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          {/* Brand */}
          <div className="lg:col-span-1">
            {/* Same brand lockup as the navbar: mark + HTML text */}
            <Link href="/" className="group inline-flex items-center gap-2.5">
              <div className="relative">
                <Logo size={38} />
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-sm font-bold text-[var(--text-primary)]">AlphaBoard</span>
                <span className="text-[9px] text-ink/60 font-medium tracking-widest uppercase">Analytics</span>
              </div>
            </Link>
            <p className="mt-4 max-w-xs text-xs leading-relaxed text-ink/65">
              Real-time analytics and leaderboard for Polymarket. Track top traders,
              monitor wallets and discover alpha, all in one place.
            </p>
            <div className="mt-5">
              <a
                href="https://x.com/alphaboardxyz"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="X (Twitter)"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink/60 transition-colors hover:text-ink/60"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Product */}
          <div>
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-ink/65 mb-4">Product</h3>
            <ul className="space-y-2">
              {PRODUCT_LINKS.map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="text-xs text-ink/65 transition-colors hover:text-ink/60">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-ink/65 mb-4">Legal</h3>
            <ul className="space-y-2">
              {LEGAL_LINKS.map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="text-xs text-ink/65 transition-colors hover:text-ink/60">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="my-8 h-px" style={{ background: 'rgba(var(--ink-rgb),0.06)' }} />

        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <p className="text-[11px] text-ink/55">
            &copy; {year} AlphaBoard. All rights reserved.
          </p>
          <p className="text-[10px] text-ink/55 sm:text-right max-w-sm">
            Independent analytics tool. Not affiliated with Polymarket. Not financial advice.{' '}
            <Link href="/disclaimer" className="underline underline-offset-2 hover:text-ink/60 transition-colors">
              Disclaimer
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
