'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatCurrency, formatAddress, isValidAddress } from '@/lib/utils';

interface WatchedWallet {
  address: string;
  label?: string;
  addedAt: number;
}

const STORAGE_KEY = 'polytrack_watchlist';

function load(): WatchedWallet[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch { return []; }
}

function save(list: WatchedWallet[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export default function WatchlistPage() {
  const [wallets, setWallets] = useState<WatchedWallet[]>([]);
  const [input, setInput]     = useState('');
  const [label, setLabel]     = useState('');
  const [error, setError]     = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setWallets(load()); setMounted(true); }, []);

  function add() {
    const addr = input.trim().toLowerCase();
    if (!isValidAddress(addr)) { setError('Invalid Ethereum address'); return; }
    if (wallets.some(w => w.address === addr)) { setError('Already in watchlist'); return; }
    const updated = [...wallets, { address: addr, label: label.trim() || undefined, addedAt: Date.now() }];
    setWallets(updated);
    save(updated);
    setInput(''); setLabel(''); setError('');
  }

  function remove(address: string) {
    const updated = wallets.filter(w => w.address !== address);
    setWallets(updated);
    save(updated);
  }

  if (!mounted) return null;

  return (
    <div className="flex flex-col gap-8">

      {/* Header */}
      <div className="animate-fade-in-up">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-block h-1 w-8 rounded-full"
            style={{ background: 'linear-gradient(90deg,#f59e0b,#f97316)' }} />
          <span className="text-[10px] uppercase tracking-widest text-white/30 font-semibold">Portfolio</span>
        </div>
        <h1 className="text-4xl font-black leading-none tracking-tight sm:text-5xl">
          <span className="text-white">My</span>{' '}
          <span style={{ background:'linear-gradient(135deg,#fbbf24,#f97316)', WebkitBackgroundClip:'text', backgroundClip:'text', color:'transparent' }}>
            Watchlist
          </span>
        </h1>
        <p className="mt-3 text-sm text-white/40 max-w-lg">
          Save wallet addresses to quickly track their P&amp;L and positions.
        </p>
      </div>

      {/* Add wallet form */}
      <div className="glass rounded-2xl p-5 animate-fade-in-up" style={{ animationDelay: '60ms' }}>
        <p className="mb-4 text-xs font-semibold text-white/50">Add a Wallet</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={input}
            onChange={e => { setInput(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && add()}
            placeholder="0x… wallet address"
            className="flex-1 rounded-xl glass px-4 py-2.5 text-sm text-white/80 placeholder-white/20 outline-none"
            style={{ border: error ? '1px solid rgba(251,113,133,0.4)' : '1px solid var(--vi-border-xs)' }}
          />
          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && add()}
            placeholder="Label (optional)"
            className="w-full sm:w-44 rounded-xl glass px-4 py-2.5 text-sm text-white/80 placeholder-white/20 outline-none"
            style={{ border: '1px solid rgba(255,255,255,0.07)' }}
          />
          <button
            onClick={add}
            className="flex-shrink-0 rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-all hover:scale-[1.02] hover:brightness-110"
            style={{ background: 'linear-gradient(135deg,#f59e0b,#f97316)', boxShadow: '0 4px 20px rgba(245,158,11,0.3)' }}
          >
            ⭐ Add
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
      </div>

      {/* Wallet list */}
      {wallets.length === 0 ? (
        <div className="glass rounded-2xl py-24 text-center animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <p className="text-4xl mb-4">⭐</p>
          <p className="text-sm font-semibold text-white/40 mb-1">No wallets yet</p>
          <p className="text-xs text-white/20">Paste an address above to start tracking</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          {wallets.map((w, i) => (
            <div
              key={w.address}
              className="glass glass-hover gradient-border rounded-2xl px-5 py-4 flex items-center gap-4 animate-fade-in-up"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              {/* Avatar */}
              <div className="flex-shrink-0 h-10 w-10 rounded-xl flex items-center justify-center text-sm font-black text-white"
                style={{ background: 'var(--vi-grad)', boxShadow: '0 0 0 1px var(--vi-border-md)' }}>
                {(w.label?.[0] ?? w.address[2])?.toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                {w.label && <p className="text-sm font-semibold text-white truncate">{w.label}</p>}
                <p className="font-mono text-xs text-white/35 truncate">{w.address}</p>
              </div>

              {/* Short address badge */}
              <span className="hidden sm:inline-block rounded-lg px-2.5 py-1 text-[10px] font-mono text-white/40"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                {formatAddress(w.address, 6)}
              </span>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <Link
                  href={`/wallet/${w.address}`}
                  className="rounded-xl px-3 py-1.5 text-xs font-semibold text-white/70 transition-all hover:text-white hover:scale-[1.02]"
                  style={{ background: 'var(--vi-bg)', border: '1px solid var(--vi-border)' }}
                >
                  View
                </Link>
                <button
                  onClick={() => remove(w.address)}
                  className="rounded-xl p-1.5 text-white/20 transition-all hover:text-rose-400 hover:bg-rose-400/10"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {wallets.length > 0 && (
        <p className="text-center text-[10px] text-white/15 animate-fade-in">
          Watchlist saved locally in your browser · {wallets.length} wallet{wallets.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}
