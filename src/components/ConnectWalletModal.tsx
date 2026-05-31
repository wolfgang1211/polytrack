'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { isValidAddress } from '@/lib/utils';

export default function ConnectWalletModal({ onClose }: { onClose: () => void }) {
  const [value, setValue] = useState('');
  const [error, setError]   = useState(false);
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const addr = value.trim();
    if (!addr) return;
    if (!isValidAddress(addr)) { setError(true); return; }
    onClose();
    router.push(`/wallet/${addr.toLowerCase()}`);
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-3xl p-7 animate-scale-in"
        style={{
          background: 'linear-gradient(135deg,rgba(14,14,24,0.98),rgba(18,18,32,0.98))',
          border: '1px solid rgba(139,92,246,0.3)',
          boxShadow: '0 0 80px rgba(124,58,237,0.15), 0 30px 60px rgba(0,0,0,0.7)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/25 hover:text-white/60 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Icon */}
        <div
          className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)' }}
        >
          <svg className="h-7 w-7 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        </div>

        <h2 className="mb-1 text-lg font-black text-white">Track Your Wallet</h2>
        <p className="mb-6 text-sm leading-relaxed text-white/40">
          Paste any Polymarket wallet address to view positions, P&amp;L, and trading insights.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            value={value}
            onChange={e => { setValue(e.target.value); setError(false); }}
            placeholder="0x… wallet address"
            autoFocus
            className="w-full rounded-xl glass px-4 py-3 text-sm text-white/80 placeholder-white/25 outline-none"
            style={{ border: error ? '1px solid rgba(251,113,133,0.5)' : '1px solid rgba(139,92,246,0.2)' }}
          />
          {error && <p className="text-xs text-rose-400 -mt-1">Invalid Ethereum address</p>}
          <button
            type="submit"
            className="w-full rounded-xl py-3 text-sm font-bold text-white transition-all hover:scale-[1.02] hover:brightness-110 active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#9333ea)', boxShadow: '0 4px 24px rgba(124,58,237,0.4)' }}
          >
            View Wallet
          </button>
        </form>

        <p className="mt-4 text-center text-[10px] text-white/18">Web3 wallet connection — coming soon</p>
      </div>
    </div>
  );
}
