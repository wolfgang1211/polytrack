'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { isValidAddress } from '@/lib/utils';

interface Props {
  compact?: boolean;
}

export default function WalletSearch({ compact }: Props) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [focused, setFocused] = useState(false);
  const router = useRouter();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const addr = value.trim();
    if (!addr) return;
    if (!isValidAddress(addr)) { setError('Invalid Ethereum address'); return; }
    setError('');
    setValue('');
    router.push(`/wallet/${addr.toLowerCase()}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="relative">
        {focused && (
          <div className="absolute inset-0 rounded-xl pointer-events-none"
            style={{ background: 'linear-gradient(135deg,rgba(124,58,237,0.3),rgba(37,99,235,0.3))', filter:'blur(8px)', transform:'scale(1.03)' }} />
        )}
        <div className={`relative flex items-center rounded-xl transition-all duration-200 glass ${error ? '' : ''}`}
          style={{ border: `1px solid ${error ? 'rgba(244,63,94,0.4)' : focused ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.07)'}` }}>
          <svg className={`absolute left-3.5 h-3.5 w-3.5 transition-colors duration-200 ${focused ? 'text-violet-400' : 'text-white/25'}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={value}
            onChange={e => { setValue(e.target.value); setError(''); }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Enter wallet address (0x…)"
            className="w-full bg-transparent py-2.5 pl-9 pr-3 text-xs text-white/75 placeholder-white/20 outline-none"
          />
        </div>
      </div>

      {error && (
        <p className="flex items-center gap-1 text-[11px] text-rose-400/90">
          <span>⚠</span> {error}
        </p>
      )}

      {!compact && (
        <button
          type="submit"
          className="relative w-full overflow-hidden rounded-xl py-2.5 text-xs font-bold text-white transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)', boxShadow: '0 4px 20px rgba(124,58,237,0.35)' }}
        >
          <span className="relative">Track Wallet →</span>
        </button>
      )}
    </form>
  );
}
