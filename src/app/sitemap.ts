import type { MetadataRoute } from 'next';
import { BLOG_POSTS } from '@/lib/blogPosts';
import { EDITORIAL_UPDATED } from '@/lib/sitemapDates';

const BASE_URL = 'https://www.alphaboard.xyz';

type Freq = NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>;

/** Pages whose content is live market data: "now" is their honest last-modified time. */
const LIVE_PAGES: Array<[path: string, changeFrequency: Freq, priority: number]> = [
  ['', 'always', 1],
  ['/leaderboard', 'hourly', 0.9],
  ['/markets', 'always', 0.9],
  ['/activity', 'always', 0.8],
  ['/liquidity', 'hourly', 0.8],
  ['/polymarket-lp-rewards', 'hourly', 0.9],
  ['/insights', 'daily', 0.7],
];

const EDITORIAL_META: Record<string, [Freq, number]> = {
  '/checker': ['monthly', 0.6],
  '/compare': ['monthly', 0.6],
  '/about': ['monthly', 0.5],
  '/faq': ['monthly', 0.5],
  '/blog': ['weekly', 0.5],
  '/api-docs': ['weekly', 0.4],
  '/privacy': ['yearly', 0.3],
  '/terms': ['yearly', 0.3],
  '/disclaimer': ['yearly', 0.3],
};

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    ...LIVE_PAGES.map(([path, changeFrequency, priority]) => ({ url: `${BASE_URL}${path}`, lastModified: now, changeFrequency, priority })),
    ...Object.entries(EDITORIAL_UPDATED).map(([path, lastModified]) => {
      const [changeFrequency, priority] = EDITORIAL_META[path];
      return { url: `${BASE_URL}${path}`, lastModified, changeFrequency, priority };
    }),
    ...BLOG_POSTS.map(post => ({ url: `${BASE_URL}/blog/${post.slug}`, lastModified: post.date, changeFrequency: 'yearly' as const, priority: 0.5 })),
  ];
}
