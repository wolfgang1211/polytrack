import Link from 'next/link';
import Logo from '@/components/Logo';

const PRODUCT_LINKS = [
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/markets',     label: 'Markets' },
  { href: '/activity',    label: 'Activity' },
  { href: '/liquidity',   label: 'Liquidity Hub' },
  { href: '/insights',    label: 'Insights' },
  { href: '/checker',     label: 'Wallet Checker' },
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
    <footer className="mt-20 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
      <div className="mx-auto max-w-7xl px-4 py-12">
        {/* ── Top row: Brand + Link columns ── */}
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="lg:col-span-1">
            <Link href="/" className="group inline-flex items-center gap-2.5">
              <Logo size={32} />
              <div className="flex flex-col leading-none">
                <span className="text-sm font-bold text-grad">AlphaBoard</span>
                <span className="text-[9px] text-white/25 font-medium tracking-widest uppercase">Analytics</span>
              </div>
            </Link>
            <p className="mt-4 max-w-xs text-xs leading-relaxed text-white/35">
              Real-time analytics and leaderboard for Polymarket. Track top traders,
              monitor wallets and discover alpha — all in one place.
            </p>
            {/* Social links */}
            <div className="mt-5 flex items-center gap-3">
              {/* Telegram */}
              <a
                href="https://t.me/alphaboard"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Telegram"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-white/30 transition-all hover:text-green-400 hover:bg-green-400/10"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.478 13.9l-2.95-.924c-.643-.204-.657-.643.136-.953l11.57-4.46c.537-.194 1.006.131.66.658z"/>
                </svg>
              </a>
              {/* X / Twitter */}
              <a
                href="https://x.com/alphaboard"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="X (Twitter)"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-white/30 transition-all hover:text-white hover:bg-white/10"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
              {/* GitHub */}
              <a
                href="https://github.com/wolfgang1211/polytrack"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-white/30 transition-all hover:text-white hover:bg-white/10"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Product */}
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/50 mb-4">Product</h3>
            <ul className="space-y-2.5">
              {PRODUCT_LINKS.map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="text-xs text-white/35 transition-colors hover:text-white/70">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/50 mb-4">Legal</h3>
            <ul className="space-y-2.5">
              {LEGAL_LINKS.map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="text-xs text-white/35 transition-colors hover:text-white/70">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Community / CTA */}
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/50 mb-4">Stay Updated</h3>
            <p className="text-xs text-white/35 leading-relaxed mb-4">
              Get real-time alerts on whale trades, market moves and top trader activity via Telegram.
            </p>
            <a
              href="https://t.me/alphaboard"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white/70 transition-all hover:text-white hover:scale-[1.02]"
              style={{ background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.25)' }}
            >
              <svg className="h-3.5 w-3.5 text-green-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.478 13.9l-2.95-.924c-.643-.204-.657-.643.136-.953l11.57-4.46c.537-.194 1.006.131.66.658z"/>
              </svg>
              Join Telegram
            </a>
          </div>
        </div>

        {/* ── Divider ── */}
        <div className="my-8 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />

        {/* ── Bottom row ── */}
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-[11px] text-white/25">
            &copy; {year} AlphaBoard. All rights reserved.
          </p>
          <p className="text-[10px] text-white/20 text-center sm:text-right max-w-md">
            AlphaBoard is an independent analytics tool and is not affiliated with Polymarket.
            This platform does not provide financial advice.{' '}
            <Link href="/disclaimer" className="underline hover:text-white/40 transition-colors">
              Read full disclaimer
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
