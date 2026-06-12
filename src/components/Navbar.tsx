'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import TelegramModal from '@/components/TelegramModal';
import Logo from '@/components/Logo';

const NAV_LINKS = [
  { href: '/world-cup',   label: 'World Cup 🏆', featured: true },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/checker',     label: 'Wallet Checker' },
  { href: '/markets',     label: 'Markets'     },
  { href: '/activity',    label: 'Activity'    },
  { href: '/liquidity',   label: 'Liquidity'   },
  { href: '/insights',    label: 'Insights'    },
];

const MORE_LINKS = [
  { href: '/watchlist', label: 'Watchlist' },
  { href: '/blog',      label: 'Blog' },
  { href: '/api-docs',  label: 'API Docs' },
  { href: '/faq',       label: 'FAQ' },
];

function WatchIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5.25c-4.2 0-7.4 2.55-9 6.75 1.6 4.2 4.8 6.75 9 6.75s7.4-2.55 9-6.75c-1.6-4.2-4.8-6.75-9-6.75Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.25a2.75 2.75 0 1 1 0 5.5 2.75 2.75 0 0 1 0-5.5Z" />
    </svg>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const [showTelegram, setShowTelegram] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  // Close menus on route change
  useEffect(() => { setMobileOpen(false); setMoreOpen(false); }, [pathname]);

  const moreActive = MORE_LINKS.some(l => pathname === l.href);

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
                  style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.36), transparent 70%)', filter: 'blur(10px)' }} />
                <Logo size={38} className="relative transition-transform duration-300 group-hover:scale-105" />
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-sm font-bold text-[#a855f7]">AlphaBoard</span>
                <span className="text-[9px] text-white/35 font-medium tracking-widest uppercase">Analytics</span>
              </div>
            </Link>

            {/* Desktop nav links */}
            <nav className="hidden items-center gap-0.5 lg:flex">
              {NAV_LINKS.map(({ href, label, featured }) => {
                const active = pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`relative rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all duration-200
                      ${active ? 'text-white' : featured ? 'text-violet-100/80 hover:text-white' : 'text-white/45 hover:text-white/75'}`}
                    style={featured && !active ? { background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(168,85,247,0.24)' } : undefined}
                  >
                    {active && (
                      <span className="absolute inset-0 rounded-lg"
                        style={featured
                          ? { background: 'linear-gradient(135deg,rgba(124,58,237,0.55),rgba(34,197,94,0.25))', border: '1px solid rgba(168,85,247,0.50)', boxShadow: '0 0 24px rgba(124,58,237,0.18)' }
                          : { background: 'var(--vi-tint)', border: '1px solid var(--vi-border)' }} />
                    )}
                    <span className="relative">{label}</span>
                  </Link>
                );
              })}

              <div className="relative">
                <button
                  onClick={() => setMoreOpen(o => !o)}
                  className={`relative rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all duration-200 ${moreActive || moreOpen ? 'text-white' : 'text-white/45 hover:text-white/75'}`}
                  aria-expanded={moreOpen}
                  aria-haspopup="menu"
                >
                  {(moreActive || moreOpen) && (
                    <span className="absolute inset-0 rounded-lg"
                      style={{ background: 'var(--vi-tint)', border: '1px solid var(--vi-border)' }} />
                  )}
                  <span className="relative inline-flex items-center gap-1.5">
                    More
                    <svg className={`h-3 w-3 transition-transform ${moreOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08Z" clipRule="evenodd" />
                    </svg>
                  </span>
                </button>
                {moreOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
                    <div className="absolute right-0 top-9 z-50 w-44 overflow-hidden rounded-2xl glass-strong p-1.5 shadow-2xl animate-scale-in">
                      {MORE_LINKS.map(({ href, label }) => {
                        const active = pathname === href;
                        return (
                          <Link
                            key={href}
                            href={href}
                            className={`block rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${active ? 'text-white' : 'text-white/45 hover:bg-white/[0.04] hover:text-white/75'}`}
                            style={active ? { background: 'var(--vi-bg)', border: '1px solid var(--vi-border)' } : {}}
                          >
                            {label}
                          </Link>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </nav>

            {/* Right actions */}
            <div className="flex items-center gap-2">
              {/* Telegram */}
              <button
                onClick={() => setShowTelegram(true)}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-white/70 transition-all hover:text-white hover:scale-[1.02]"
                style={{ background: 'var(--vi-bg)', border: '1px solid var(--vi-border)', boxShadow: '0 0 24px rgba(124,58,237,0.08)' }}
              >
                <svg className="h-3.5 w-3.5 text-emerald-300" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.478 13.9l-2.95-.924c-.643-.204-.657-.643.136-.953l11.57-4.46c.537-.194 1.006.131.66.658z"/>
                </svg>
                Get Alerts
              </button>

              {/* Watchlist — hidden on mobile (accessible via mobile menu) */}
              <Link
                href="/watchlist"
                title="Watchlist"
                aria-label="Watchlist"
                className="hidden sm:flex h-8 w-8 items-center justify-center rounded-xl text-white/45 transition-all hover:scale-[1.08] hover:text-white/80"
                style={{ background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.09)' }}
              >
                <WatchIcon />
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
              maxHeight: mobileOpen ? '580px' : '0px',
              opacity: mobileOpen ? 1 : 0,
            }}
          >
            <div className="mx-auto max-w-7xl px-4 pb-4 pt-2"
              style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>

              {/* Nav links */}
              <nav className="flex flex-col gap-0.5 mb-3">
                {[...NAV_LINKS, ...MORE_LINKS].map(({ href, label }) => {
                  const active = pathname === href;
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`relative flex items-center justify-between rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200
                        ${active ? 'text-white' : 'text-white/55 hover:text-white/85 hover:bg-white/[0.03]'}`}
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
                  style={{ background: 'var(--vi-bg)', border: '1px solid var(--vi-border)' }}
                >
                  <svg className="h-3.5 w-3.5 text-emerald-300" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.478 13.9l-2.95-.924c-.643-.204-.657-.643.136-.953l11.57-4.46c.537-.194 1.006.131.66.658z"/>
                  </svg>
                  Get Alerts
                </button>
                <Link
                  href="/watchlist"
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold text-white/70 transition-all hover:text-white"
                  style={{ background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.09)' }}
                >
                  <WatchIcon /> Watchlist
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
