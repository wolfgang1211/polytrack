'use client';

import { usePathname } from 'next/navigation';

const BREADCRUMB_MAP: Record<string, string> = {
  '/': 'Home',
  '/checker': 'Wallet Checker',
  '/leaderboard': 'Leaderboard',
  '/markets': 'Markets',
  '/activity': 'Activity',
  '/liquidity': 'Liquidity',
  '/insights': 'Insights',
  '/faq': 'FAQ',
  '/privacy': 'Privacy Policy',
  '/terms': 'Terms of Service',
  '/disclaimer': 'Disclaimer',
  '/about': 'About',
};

export default function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  const crumbs: Array<{ path: string; label: string }> = [{ path: '/', label: 'Home' }];

  let acc = '';
  for (const seg of segments) {
    acc += `/${seg}`;
    const known = BREADCRUMB_MAP[acc];
    crumbs.push({ path: acc, label: known ?? seg.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) });
  }

  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-2">
      {crumbs.map((c, i) => {
        const isLast = i === crumbs.length - 1;
        const textColor = isLast ? 'text-white/70' : 'text-white/30 hover:text-white/60';
        const base = `text-[11px] font-medium transition-colors ${textColor}`;
        const content = (
          <span className="inline-flex items-center gap-2">
            {i > 0 && <span className="text-white/15 text-[10px]">/</span>}
            {isLast ? (
              <span className={base}>{c.label}</span>
            ) : (
              <a href={c.path} className={base}>{c.label}</a>
            )}
          </span>
        );
        return <span key={c.path}>{content}</span>;
      })}
    </nav>
  );
}
