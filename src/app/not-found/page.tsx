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
        <h1
          className="relative text-8xl font-black tracking-tight"
          style={{
            color: 'var(--text-primary)',
          }}
        >
          404
        </h1>
      </div>

      {/* ── Message ── */}
      <h2 className="mb-2 text-xl font-bold text-ink/90">Page Not Found</h2>
      <p className="mb-10 max-w-md text-sm text-ink/35 leading-relaxed">
        The page you’re looking for doesn’t exist or has been moved. Let’s get you back to the action.
      </p>

      {/* ── Quick links ── */}
      <div className="flex flex-wrap justify-center gap-3">
        {LINKS.map(({ href, label, icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold text-ink/65 transition-all hover:text-ink hover:scale-[1.03]"
            style={{
              background: 'rgba(var(--ink-rgb),0.04)',
              border: '1px solid rgba(var(--ink-rgb),0.08)',
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
          className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-ink transition-all hover:brightness-110"
          style={{
            background: 'var(--accent-grad)',
          }}
        >
          ← Back to Home
        </Link>
      </div>
    </div>
  );
}
