import type { Metadata } from 'next';
import { Inter, JetBrains_Mono, Syne, Playfair_Display } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/Navbar';
import { AuthProvider } from '@/lib/useAuth';

const geistSans = Inter({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = JetBrains_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });
const displayFont = Syne({ variable: '--font-syne', subsets: ['latin'], weight: ['700', '800'] });
const serifFont = Playfair_Display({ variable: '--font-serif-display', subsets: ['latin'], weight: ['700', '800', '900'], style: ['normal', 'italic'] });

export const metadata: Metadata = {
  title: 'AlphaBoard — Polymarket Leaderboard & Wallet Tracker',
  description: 'Track top Polymarket traders and monitor wallet performance in real time.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${displayFont.variable} ${serifFont.variable} h-full`}>
      <body className="min-h-full antialiased overflow-x-hidden">
        {/* Fixed background — dot grid + ambient orbs */}
        <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden>
          {/* Dot grid */}
          <div className="absolute inset-0"
            style={{
              backgroundImage: 'radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)',
              backgroundSize: '28px 28px',
            }}
          />
          {/* Ambient orbs — kept subtle */}
          <div
            className="absolute -top-[30%] -left-[15%] w-[70vw] h-[70vh] rounded-full animate-orb animate-glow-pulse"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(109,40,217,0.10) 0%, transparent 70%)',
              filter: 'blur(60px)',
            }}
          />
          <div
            className="absolute -bottom-[35%] -right-[15%] w-[65vw] h-[65vh] rounded-full animate-glow-pulse"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(147,51,234,0.08) 0%, transparent 70%)',
              filter: 'blur(80px)',
              animationDelay: '2s',
            }}
          />
          {/* Noise overlay */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'repeat',
              backgroundSize: '180px',
            }}
          />
        </div>
        <AuthProvider>
          <Navbar />
          {/* 1px violet scan-line beneath navbar */}
          <div className="h-px w-full pointer-events-none"
            style={{ background: 'linear-gradient(90deg,transparent 0%,var(--vi-border-xs) 20%,var(--vi-border-xs) 80%,transparent 100%)' }} />
          <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
