'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export interface AuthUser { email: string; name: string }

interface StoredUser { name: string; password: string }

interface AuthCtx {
  user: AuthUser | null;
  ready: boolean;
  signUp: (email: string, password: string, name: string) => void;
  signIn: (email: string, password: string) => void;
  signOut: () => void;
}

const USERS_KEY = 'ab_users';
const SESSION_KEY = 'ab_session';

const Ctx = createContext<AuthCtx | null>(null);

function readUsers(): Record<string, StoredUser> {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || '{}'); } catch { return {}; }
}
function writeUsers(u: Record<string, StoredUser>) {
  localStorage.setItem(USERS_KEY, JSON.stringify(u));
}

/**
 * Lightweight client-side auth (localStorage). Lets users register and sign in
 * so the app has real accounts in the browser. NOTE: this is not a secure
 * server-backed auth — swap in Clerk/Supabase/NextAuth for production.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const email = localStorage.getItem(SESSION_KEY);
      if (email) {
        const users = readUsers();
        if (users[email]) setUser({ email, name: users[email].name });
      }
    } catch { /* ignore */ }
    setReady(true);
  }, []);

  const signUp = useCallback((email: string, password: string, name: string) => {
    email = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Enter a valid email');
    if (password.length < 6) throw new Error('Password must be at least 6 characters');
    const users = readUsers();
    if (users[email]) throw new Error('An account with this email already exists');
    users[email] = { name: name.trim() || email.split('@')[0], password };
    writeUsers(users);
    localStorage.setItem(SESSION_KEY, email);
    setUser({ email, name: users[email].name });
  }, []);

  const signIn = useCallback((email: string, password: string) => {
    email = email.trim().toLowerCase();
    const users = readUsers();
    const u = users[email];
    if (!u || u.password !== password) throw new Error('Invalid email or password');
    localStorage.setItem(SESSION_KEY, email);
    setUser({ email, name: u.name });
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, ready, signUp, signIn, signOut }), [user, ready, signUp, signIn, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
