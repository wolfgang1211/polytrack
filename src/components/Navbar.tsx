'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import TelegramModal from '@/components/TelegramModal';
import Logo from '@/components/Logo';
import { isValidAddress } from '@/lib/utils';

const NAV_LINKS = [
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/markets',     label: 'Markets'     },
  { href: '/activity',    label: 'Activity'    },
  { href: '/liquidity',   label: 'Liquidity'   },
  { href: '/insights',    label: 'Insights'    },
];

function SearchBar() {
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);
  const [focused, setFocused] = useState(false);
  const router = useRouter();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const addr = value.trim();
    if (!addr) return;
    if (!isValidAddress(addr)) { setError(true); return; }
    setValue('');
    setError(false);
    router.push(`/wallet/${addr.toLowerCase()}`);
  }

  return (
    <form onSubmit={handleSubmit} className="relative group">
      <div
        className={`absolute inset-0 rounded-xl transition-opacity duration-300 pointer-events-none ${focused ? 'opacity-100' : 'opacity-0'}`}
        style={{ background: 'linear-gradient(135deg,rgba(139,92,246,0.4),rgba(147,51,234,0.4))', filter: 'blur(8px)', transform: 'scale(1.02)' }}
      />
      <div className={`relative flex items-center rounded-xl glass transition-all duration-200 ${error ? 'border-rose-500/60' : focused ? 'border-violet-500/50' : ''}`}>
        <button type="submit" aria-label="Search wallet"
          className={`absolute left-2.5 flex h-5 w-5 items-center justify-center transition-colors duration-200 ${focused ? 'text-violet-400' : 'text-white/30'} hover:text-violet-300`}>
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
        <input
          value={value}
          onChange={e => { setValue(e.target.value); setError(false); }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="0x… search wallet"
          spellCheck={false}
          autoComplete="off"
          className="w-44 bg-transparent py-2 pl-8 pr-3 text-xs text-white/80 placeholder-white/25 outline-none sm:w-56"
        />
      </div>
      {error && (
        <p className="absolute left-0 top-full mt-1 whitespace-nowrap rounded-md px-2 py-1 text-[10px] font-medium text-rose-300"
          style={{ background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.25)' }}>
          Enter a valid 0x wallet address (42 chars)
        </p>
      )}
    </form>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const [showTelegram, setShowTelegram] = useState(false);

  return (
    <>
      {showTelegram && <TelegramModal onClose={() => setShowTelegram(false)} />}

      <header className="sticky top-0 z-50">
        <div className="glass" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)' }}>
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

            {/* Nav links */}
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
                        style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.25)' }} />
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

              {/* Watchlist */}
              <Link
                href="/watchlist"
                title="Watchlist"
                className="flex h-8 w-8 items-center justify-center rounded-xl text-sm transition-all hover:scale-[1.08]"
                style={{ background: 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.25)' }}
              >
                ⭐
              </Link>

              {/* Search */}
              <SearchBar />
            </div>
          </div>
        </div>

        <div className="h-px w-full"
          style={{ background: 'linear-gradient(90deg,transparent,rgba(139,92,246,0.4),rgba(59,130,246,0.4),transparent)' }} />
      </header>
    </>
  );
}
