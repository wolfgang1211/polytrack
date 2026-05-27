import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/Navbar';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'PolyTrack — Polymarket Leaderboard & Cüzdan Takip',
  description: 'Polymarket trader sıralamalarını ve cüzdan performansını takip edin.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-full antialiased overflow-x-hidden">
        {/* Ambient background orbs */}
        <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden>
          <div
            className="absolute -top-[30%] -left-[15%] w-[70vw] h-[70vh] rounded-full animate-orb animate-glow-pulse"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(109,40,217,0.18) 0%, transparent 70%)',
              filter: 'blur(60px)',
            }}
          />
          <div
            className="absolute -bottom-[35%] -right-[15%] w-[65vw] h-[65vh] rounded-full animate-glow-pulse"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(37,99,235,0.14) 0%, transparent 70%)',
              filter: 'blur(80px)',
              animationDelay: '2s',
            }}
          />
          <div
            className="absolute top-[40%] left-[55%] w-[40vw] h-[40vh] rounded-full animate-glow-pulse"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(6,182,212,0.08) 0%, transparent 70%)',
              filter: 'blur(70px)',
              animationDelay: '1s',
            }}
          />
          {/* Noise overlay */}
          <div
            className="absolute inset-0 opacity-[0.025]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'repeat',
              backgroundSize: '180px',
            }}
          />
        </div>
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
