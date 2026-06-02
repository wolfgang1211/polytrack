'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import TelegramModal from '@/components/TelegramModal';
import Logo from '@/components/Logo';

const NAV_LINKS = [
  { href: '/checker',     label: 'Wallet Checker' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/markets',     label: 'Markets'     },
  { href: '/activity',    label: 'Activity'    },
  { href: '/liquidity',   label: 'Liquidity'   },
  { href: '/insights',    label: 'Insights'    },
  { href: '/faq',         label: 'FAQ'         },
];

export default function Navbar() {
  const pathname = usePathname();
  const [showTelegram, setShowTelegram] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  return (
    <>
      {showTelegram && <TelegramModal onClose={() => setShowTelegram(false)} />}

      <header className="sticky top-0 z-50">
        <div
          className="glass"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)' }}
        >
          {/* ── Main nav row ── */}
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">

            {/* Logo */}
            <Link href="/" className="group flex items-center gap-2.5 flex-shrink-0">
              <div className="relative">
                <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                  style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.5), transparent 70%)', filter: 'blur(10px)' }} />
                <Logo size={38} className="relative transition-transform duration-300 group-hover:scale-105" />
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-sm font-bold text-grad">AlphaBoard</span>
                <span className="text-[9px] text-white/25 font-medium tracking-widest uppercase">Analytics</span>
              </div>
            </Link>

            {/* Desktop nav links */}
            <nav className="hidden items-center gap-0.5 lg:flex">
              {NAV_LINKS.map(({ href, label }) => {
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`relative rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all duration-200
                      ${active ? 'text-white' : 'text-white/40 hover:text-white/70'}`}
                  >
                    {active && (
                      <span className="absolute inset-0 rounded-lg"
                        style={{ background: 'var(--vi-tint)', border: '1px solid var(--vi-border)' }} />
                    )}
                    <span className="relative">{label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Right actions */}
            <div className="flex items-center gap-2">
              {/* Telegram */}
              <button
                onClick={() => setShowTelegram(true)}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-white/70 transition-all hover:text-white hover:scale-[1.02]"
                style={{ background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.25)' }}
              >
                <svg className="h-3.5 w-3.5 text-green-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.478 13.9l-2.95-.924c-.643-.204-.657-.643.136-.953l11.57-4.46c.537-.194 1.006.131.66.658z"/>
                </svg>
                Get Alerts
              </button>

              {/* Watchlist — hidden on mobile (accessible via mobile menu) */}
              <Link
                href="/watchlist"
                title="Watchlist"
                aria-label="Watchlist"
                className="hidden sm:flex h-8 w-8 items-center justify-center rounded-xl text-sm transition-all hover:scale-[1.08]"
                style={{ background: 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.25)' }}
              >
                ⭐
              </Link>

              {/* Hamburger — mobile/tablet only */}
              <button
                onClick={() => setMobileOpen(o => !o)}
                aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={mobileOpen}
                className="lg:hidden flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-200"
                style={{
                  background: mobileOpen ? 'var(--vi-tint)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${mobileOpen ? 'var(--vi-border-lg)' : 'rgba(255,255,255,0.1)'}`,
                }}
              >
                <div className="flex h-4 w-4 flex-col items-center justify-center gap-[5px]">
                  <span
                    className="block h-px w-4 rounded-full bg-white/70 transition-all duration-300 origin-center"
                    style={{ transform: mobileOpen ? 'rotate(45deg) translate(0px, 6px)' : 'none' }}
                  />
                  <span
                    className="block h-px w-4 rounded-full bg-white/70 transition-all duration-300"
                    style={{ opacity: mobileOpen ? 0 : 1, transform: mobileOpen ? 'scaleX(0)' : 'scaleX(1)' }}
                  />
                  <span
                    className="block h-px w-4 rounded-full bg-white/70 transition-all duration-300 origin-center"
                    style={{ transform: mobileOpen ? 'rotate(-45deg) translate(0px, -6px)' : 'none' }}
                  />
                </div>
              </button>
            </div>
          </div>

          {/* ── Mobile menu panel ── */}
          <div
            className="lg:hidden overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out"
            style={{
              maxHeight: mobileOpen ? '480px' : '0px',
              opacity: mobileOpen ? 1 : 0,
            }}
          >
            <div className="mx-auto max-w-7xl px-4 pb-4 pt-2"
              style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>

              {/* Nav links */}
              <nav className="flex flex-col gap-0.5 mb-3">
                {NAV_LINKS.map(({ href, label }) => {
                  const active = pathname === href;
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`relative flex items-center justify-between rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200
                        ${active ? 'text-white' : 'text-white/50 hover:text-white/80 hover:bg-white/[0.03]'}`}
                      style={active ? {
                        background: 'var(--vi-bg)',
                        border: '1px solid var(--vi-border)',
                      } : {}}
                    >
                      <span>{label}</span>
                      {active && (
                        <span className="h-1.5 w-1.5 rounded-full"
                          style={{ background: 'rgba(139,92,246,0.9)', boxShadow: '0 0 6px rgba(139,92,246,0.8)' }} />
                      )}
                    </Link>
                  );
                })}
              </nav>

              {/* Divider */}
              <div className="my-3 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />

              {/* Quick actions */}
              <div className="mb-3 flex gap-2">
                <button
                  onClick={() => { setShowTelegram(true); setMobileOpen(false); }}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold text-white/70 transition-all hover:text-white"
                  style={{ background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.25)' }}
                >
                  <svg className="h-3.5 w-3.5 text-green-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.478 13.9l-2.95-.924c-.643-.204-.657-.643.136-.953l11.57-4.46c.537-.194 1.006.131.66.658z"/>
                  </svg>
                  Get Alerts
                </button>
                <Link
                  href="/watchlist"
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold text-white/70 transition-all hover:text-white"
                  style={{ background: 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.25)' }}
                >
                  ⭐ Watchlist
                </Link>
              </div>

            </div>
          </div>
        </div>

        <div className="h-px w-full"
          style={{ background: 'linear-gradient(90deg,transparent,var(--vi-border-xl),rgba(59,130,246,0.4),transparent)' }} />
      </header>
    </>
  );
}
