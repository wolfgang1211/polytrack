import type { MetadataRoute } from 'next';

const DISALLOW = ['/api/', '/watchlist'];

/** AI assistants' crawlers and fetchers, named explicitly so they are clearly welcome (GEO). */
const AI_CRAWLERS = [
  'GPTBot', 'OAI-SearchBot', 'ChatGPT-User',
  'ClaudeBot', 'Claude-User', 'Claude-SearchBot',
  'PerplexityBot', 'Perplexity-User',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: DISALLOW },
      // A crawler that matches a named group ignores the '*' group, so the same disallows are repeated here.
      { userAgent: AI_CRAWLERS, allow: '/', disallow: DISALLOW },
    ],
    sitemap: 'https://www.alphaboard.xyz/sitemap.xml',
  };
}
