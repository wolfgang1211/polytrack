'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { isValidAddress, formatAddress } from '@/lib/utils';

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
        style={{
          background: 'linear-gradient(135deg, rgba(139,92,246,0.4), rgba(59,130,246,0.4))',
          filter: 'blur(8px)',
          transform: 'scale(1.02)',
        }}
      />
      <div className={`relative flex items-center rounded-xl glass transition-all duration-200 ${error ? 'border-rose-500/60' : focused ? 'border-violet-500/50' : ''}`}>
        <svg className={`absolute left-3 h-3.5 w-3.5 transition-colors duration-200 ${focused ? 'text-violet-400' : 'text-white/30'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          value={value}
          onChange={e => { setValue(e.target.value); setError(false); }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="0x… search wallet"
          className="w-52 bg-transparent py-2 pl-8 pr-3 text-xs text-white/80 placeholder-white/25 outline-none sm:w-64"
        />
      </div>
    </form>
  );
}

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50">
      {/* glass bar */}
      <div className="glass" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)' }}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">

          {/* Logo */}
          <Link href="/" className="group flex items-center gap-2.5">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)' }}>
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: 'linear-gradient(135deg, #6d28d9, #1d4ed8, #0891b2)' }} />
              <span className="relative text-sm font-black text-white">P</span>
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-sm font-bold text-grad">PolyTrack</span>
              <span className="text-[9px] text-white/25 font-medium tracking-widest uppercase">Analytics</span>
            </div>
          </Link>

          {/* Nav links */}
          <nav className="hidden items-center gap-1 sm:flex">
            <Link
              href="/"
              className={`relative rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all duration-200
                ${pathname === '/'
                  ? 'text-white'
                  : 'text-white/40 hover:text-white/70'}`}
            >
              {pathname === '/' && (
                <span className="absolute inset-0 rounded-lg"
                  style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.25)' }} />
              )}
              <span className="relative">Leaderboard</span>
            </Link>
          </nav>

          {/* Search */}
          <SearchBar />
        </div>
      </div>

      {/* bottom shine line */}
      <div className="h-px w-full"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.4), rgba(59,130,246,0.4), transparent)' }} />
    </header>
  );
}
