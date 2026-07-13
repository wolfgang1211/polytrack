'use client';

import { usePathname } from 'next/navigation';
import { useLanguage } from '@/components/LanguageProvider';

const BREADCRUMB_KEYS: Record<string, string> = {
  '/': 'breadcrumb.home',
  '/worldcup': 'breadcrumb.worldcup',
  '/world-cup': 'breadcrumb.worldcup',
  '/checker': 'breadcrumb.checker',
  '/leaderboard': 'breadcrumb.leaderboard',
  '/markets': 'breadcrumb.markets',
  '/activity': 'breadcrumb.activity',
  '/liquidity': 'breadcrumb.liquidity',
  '/insights': 'breadcrumb.insights',
  '/faq': 'breadcrumb.faq',
  '/privacy': 'breadcrumb.privacy',
  '/terms': 'breadcrumb.terms',
  '/disclaimer': 'breadcrumb.disclaimer',
  '/about': 'breadcrumb.about',
  '/compare': 'breadcrumb.compare',
  '/watchlist': 'breadcrumb.watchlist',
  '/blog': 'breadcrumb.blog',
  '/api-docs': 'breadcrumb.apiDocs',
  '/wallet': 'breadcrumb.wallet',
};

function humanizeSegment(segment: string) {
  return segment.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function Breadcrumb() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const segments = pathname.split('/').filter(Boolean);

  const crumbs: Array<{ path: string; label: string }> = [{ path: '/', label: t('breadcrumb.home') }];

  let acc = '';
  for (const seg of segments) {
    acc += `/${seg}`;
    const key = BREADCRUMB_KEYS[acc];
    crumbs.push({ path: acc, label: key ? t(key) : humanizeSegment(seg) });
  }

  return (
    <nav aria-label={t('breadcrumb.aria')} className="mb-4 flex flex-wrap items-center gap-2">
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
