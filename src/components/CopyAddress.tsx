'use client';

import { useState } from 'react';

interface Props {
  address: string;
  className?: string;
}

export default function CopyAddress({ address, className = '' }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(address);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = address;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <span className={`relative inline-flex flex-shrink-0 items-center ${className}`}>
      <button
        onClick={copy}
        title="Copy address"
        aria-label="Copy address"
        className={`flex items-center justify-center rounded transition-all duration-150 ${
          copied ? 'text-violet-400' : 'text-white/25 hover:text-violet-400'
        }`}
        style={{ width: 16, height: 16 }}
      >
        {copied ? (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
        )}
      </button>
      {copied && (
        <span
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 whitespace-nowrap rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white pointer-events-none select-none"
          style={{
            background: 'rgba(109,40,217,0.95)',
            border: '1px solid rgba(139,92,246,0.5)',
            boxShadow: '0 2px 10px rgba(124,58,237,0.5)',
            zIndex: 100,
          }}
        >
          Copied
        </span>
      )}
    </span>
  );
}
