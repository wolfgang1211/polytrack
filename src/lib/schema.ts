const SITE_URL = 'https://www.alphaboard.xyz';

export const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'AlphaBoard',
  url: SITE_URL,
  description: 'Polymarket analytics platform tracking top traders, liquidity and smart money.',
  sameAs: ['https://t.me/alphaboard', 'https://www.alphaboard.xyz'],
};

export const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'AlphaBoard',
  url: SITE_URL,
  description: 'Real-time Polymarket analytics and leaderboard.',
  inLanguage: 'en-US',
  potentialAction: {
    '@type': 'SearchAction',
    target: `${SITE_URL}/markets?q={search_term_string}`,
    'query-input': 'required name=search_term_string',
  },
};
