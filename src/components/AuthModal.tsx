'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/useAuth';
import Logo from '@/components/Logo';

type Mode = 'signin' | 'signup';

export default function AuthModal({ initialMode = 'signin', onClose }: { initialMode?: Mode; onClose: () => void }) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'signup') signUp(email, password, name);
      else signIn(email, password);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <div className="relative w-full max-w-sm rounded-2xl glass-strong p-6 animate-scale-in"
        style={{ border: '1px solid rgba(255,255,255,0.1)' }}
        onClick={e => e.stopPropagation()}>
        <button onClick={onClose} aria-label="Close"
          className="absolute right-4 top-4 text-white/40 transition-colors hover:text-white">✕</button>

        <div className="mb-5 flex flex-col items-center text-center">
          <div className="mb-3 flex items-center gap-2">
            <Logo size={30} />
            <span className="text-lg font-bold text-[#a855f7]">AlphaBoard</span>
          </div>
          <h2 className="text-xl font-black text-white">{mode === 'signup' ? 'Create your account' : 'Welcome back'}</h2>
          <p className="mt-1 text-xs text-white/40">
            {mode === 'signup' ? 'Sign up to track wallets and save your watchlist.' : 'Sign in to access your watchlist and alerts.'}
          </p>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3">
          {mode === 'signup' && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-white/70">Name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name"
                className="w-full rounded-xl glass px-3 py-2.5 text-sm text-white/80 placeholder-white/25 outline-none focus:border-violet-500/40"
                style={{ border: '1px solid rgba(255,255,255,0.08)' }} />
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-semibold text-white/70">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"
              className="w-full rounded-xl glass px-3 py-2.5 text-sm text-white/80 placeholder-white/25 outline-none focus:border-violet-500/40"
              style={{ border: '1px solid rgba(255,255,255,0.08)' }} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-white/70">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
              className="w-full rounded-xl glass px-3 py-2.5 text-sm text-white/80 placeholder-white/25 outline-none focus:border-violet-500/40"
              style={{ border: '1px solid rgba(255,255,255,0.08)' }} />
          </div>

          {error && (
            <p className="rounded-lg px-3 py-2 text-[11px] font-medium text-rose-300"
              style={{ background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.25)' }}>{error}</p>
          )}

          <button type="submit" disabled={busy}
            className="mt-1 w-full rounded-xl py-2.5 text-sm font-bold text-white transition-all hover:brightness-110 disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#9333ea)', boxShadow: '0 4px 20px rgba(124,58,237,0.35)' }}>
            {busy ? 'Please wait…' : mode === 'signup' ? 'Sign up' : 'Sign in'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-white/40">
          {mode === 'signup' ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(''); }}
            className="font-bold text-violet-300 hover:text-violet-200">
            {mode === 'signup' ? 'Sign in' : 'Sign up'}
          </button>
        </p>
      </div>
    </div>
  );
}
