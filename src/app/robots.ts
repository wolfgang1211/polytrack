import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/watchlist'],
      },
    ],
    sitemap: 'https://www.alphaboard.xyz/sitemap.xml',
  };
}
