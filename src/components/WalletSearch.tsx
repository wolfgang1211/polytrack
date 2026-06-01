'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { isValidAddress } from '@/lib/utils';

interface Props {
  compact?: boolean;
}

export default function WalletSearch({ compact }: Props) {
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const router = useRouter();

  const addr = value.trim();
  const isEmpty = addr.length === 0;
  const isValid = !isEmpty && isValidAddress(addr);
  // Show the error hint only once the user has typed enough to know the format is wrong
  const showError = !isEmpty && !isValid && addr.length >= 10;

  const borderColor = isValid
    ? 'rgba(124,58,237,0.5)'
    : showError
      ? 'rgba(244,63,94,0.4)'
      : focused
        ? 'rgba(124,58,237,0.35)'
        : 'rgba(255,255,255,0.07)';

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    setValue('');
    router.push(`/wallet/${addr.toLowerCase()}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="relative">
        {/* focus / valid glow */}
        {(focused || isValid) && (
          <div
            className="absolute inset-0 rounded-xl pointer-events-none transition-opacity duration-300"
            style={{
              background: isValid
                ? 'linear-gradient(135deg,rgba(124,58,237,0.25),rgba(147,51,234,0.2))'
                : 'linear-gradient(135deg,rgba(124,58,237,0.15),rgba(147,51,234,0.1))',
              filter: 'blur(8px)',
              transform: 'scale(1.03)',
            }}
          />
        )}

        <div
          className="relative flex items-center rounded-xl glass transition-all duration-200"
          style={{ border: `1px solid ${borderColor}` }}
        >
          {/* Search icon */}
          <svg
            className={`absolute left-3.5 h-3.5 w-3.5 flex-shrink-0 transition-colors duration-200 ${
              isValid ? 'text-violet-400' : focused ? 'text-violet-400/60' : 'text-white/25'
            }`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>

          <input
            value={value}
            onChange={e => setValue(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Enter wallet address (0x…)"
            spellCheck={false}
            autoComplete="off"
            className="w-full bg-transparent py-2.5 pl-9 pr-10 text-xs text-white/75 placeholder-white/20 outline-none font-mono"
          />

          {/* Inline validation badge */}
          <div className="absolute right-3 flex-shrink-0">
            {isValid && (
              <svg className="h-4 w-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            )}
            {showError && (
              <svg className="h-4 w-4 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </div>
        </div>
      </div>

      {/* Inline hint */}
      <div className="min-h-[16px]">
        {showError && (
          <p className="flex items-center gap-1 text-[11px] text-rose-400/80">
            <span>Must be a 0x address with 40 hex characters</span>
          </p>
        )}
        {isValid && (
          <p className="flex items-center gap-1 text-[11px] text-emerald-400/70">
            <span>Valid address</span>
          </p>
        )}
      </div>

      {!compact && (
        <button
          type="submit"
          disabled={!isValid}
          className="relative w-full overflow-hidden rounded-xl py-2.5 text-xs font-bold text-white transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-35 disabled:cursor-not-allowed disabled:scale-100"
          style={{
            background: isValid
              ? 'linear-gradient(135deg,#7c3aed,#9333ea)'
              : 'rgba(124,58,237,0.2)',
            border: '1px solid rgba(124,58,237,0.3)',
            boxShadow: isValid ? '0 4px 20px rgba(124,58,237,0.35)' : 'none',
          }}
        >
          <span className="relative">Track Wallet →</span>
        </button>
      )}
    </form>
  );
}
