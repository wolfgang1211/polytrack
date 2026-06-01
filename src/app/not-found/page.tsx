import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Page Not Found',
  description: 'The page you are looking for does not exist or has been moved.',
};

const LINKS = [
  { href: '/', label: 'Home', icon: '⌂' },
  { href: '/markets', label: 'Markets', icon: '📊' },
  { href: '/leaderboard', label: 'Leaderboard', icon: '🏆' },
  { href: '/liquidity', label: 'Liquidity', icon: '💧' },
  { href: '/activity', label: 'Activity', icon: '⚡' },
];

export default function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      {/* ── Large '404' with glow ── */}
      <div className="relative mb-8 select-none">
        <div
          className="absolute inset-0 mx-auto h-32 w-32 rounded-full opacity-60"
          style={{
            background: 'radial-gradient(circle, rgba(124,58,237,0.35), transparent 70%)',
            filter: 'blur(24px)',
          }}
        />
        <h1
          className="relative text-8xl font-black tracking-tight"
          style={{
            background: 'linear-gradient(135deg, #7c3aed, #c084fc)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
          }}
        >
          404
        </h1>
      </div>

      {/* ── Message ── */}
      <h2 className="mb-2 text-xl font-bold text-white/90">Page Not Found</h2>
      <p className="mb-10 max-w-md text-sm text-white/35 leading-relaxed">
        The page you’re looking for doesn’t exist or has been moved. Let’s get you back to the action.
      </p>

      {/* ── Quick links ── */}
      <div className="flex flex-wrap justify-center gap-3">
        {LINKS.map(({ href, label, icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold text-white/65 transition-all hover:text-white hover:scale-[1.03]"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <span className="text-sm leading-none">{icon}</span>
            {label}
          </Link>
        ))}
      </div>

      {/* ── CTA ── */}
      <div className="mt-10">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white transition-all hover:brightness-110"
          style={{
            background: 'linear-gradient(135deg,#7c3aed,#9333ea)',
            boxShadow: '0 4px 24px rgba(124,58,237,0.35)',
          }}
        >
          ← Back to Home
        </Link>
      </div>
    </div>
  );
}
