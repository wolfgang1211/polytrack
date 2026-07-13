export const LOCALES = ['en', 'tr'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

type MessageTree = {
  [key: string]: string | MessageTree;
};

const en = {
  brand: {
    analytics: 'Analytics',
  },
  nav: {
    worldcup: 'World Cup 🏆',
    leaderboard: 'Leaderboard',
    checker: 'Wallet Checker',
    markets: 'Markets',
    activity: 'Activity',
    liquidity: 'Liquidity',
    insights: 'Insights',
    watchlist: 'Watchlist',
    blog: 'Blog',
    apiDocs: 'API Docs',
    faq: 'FAQ',
    compare: 'Compare Traders',
    more: 'More',
    getAlerts: 'Get Alerts',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
  },
  breadcrumb: {
    aria: 'Breadcrumb',
    home: 'Home',
    worldcup: 'World Cup',
    checker: 'Wallet Checker',
    leaderboard: 'Leaderboard',
    markets: 'Markets',
    activity: 'Activity',
    liquidity: 'Liquidity',
    insights: 'Insights',
    faq: 'FAQ',
    privacy: 'Privacy Policy',
    terms: 'Terms of Service',
    disclaimer: 'Disclaimer',
    about: 'About',
    watchlist: 'Watchlist',
    blog: 'Blog',
    apiDocs: 'API Docs',
    compare: 'Compare Traders',
    wallet: 'Wallet',
  },
  footer: {
    description: 'Real-time analytics and leaderboard for Polymarket. Track top traders, monitor wallets and discover alpha, all in one place.',
    product: 'Product',
    legal: 'Legal',
    allRightsReserved: 'All rights reserved.',
    disclaimerPrefix: 'Independent analytics tool. Not affiliated with Polymarket. Not financial advice.',
    disclaimerLink: 'Disclaimer',
    liquidityHub: 'Liquidity Hub',
    privacyPolicy: 'Privacy Policy',
    termsOfService: 'Terms of Service',
  },
  home: {
    terminalIntelligence: 'Terminal Intelligence',
    hero: {
      realTime: 'Real time',
      alpha: 'alpha',
      fromTheBest: 'from the best',
      subtitle: 'Discover, follow and copy the most profitable traders on Polymarket in real time.',
    },
    sections: {
      platformStats: 'Platform Stats',
      liveFeed: 'Live Feed',
      topMarkets: 'Top Markets',
      hotBets: 'Hot Bets',
    },
  },
  common: {
    live: 'Live',
    activity: 'Activity',
    buy: 'Buy',
    sell: 'Sell',
    allTime: 'All-Time',
    viewAll: 'View All →',
    viewAllMarkets: 'View All Markets →',
    smartMoney: 'Smart Money',
    activeMarkets: 'Active Markets',
    volume24h: '24h Volume',
    volume24hShort: '24h Vol',
    trades1h: 'Trades (1h)',
    topCategory: 'Top Category',
    trades: 'trades',
    risingTraders: 'Rising Traders',
    thisWeek: 'This Week',
    topMarkets: 'Top Markets',
    hotBets: 'Hot Bets',
    market: 'Market',
    vol: 'Vol',
    last: 'Last',
    yes: 'YES',
    whale: 'Whale',
    noRecentTrades: 'No recent trades',
    loading: 'Loading live data',
    dataUnavailable: 'Live data is temporarily unavailable',
  },
  telegram: {
    title: 'Polymarket Alerts',
    description: 'Get real-time alerts for $50K+ whale moves on Polymarket. Personal wallet alerts coming soon 🚀',
    cta: 'Get Alerts',
  },
  walletSearch: {
    placeholder: 'Enter wallet address (0x…)',
    invalid: 'Must be a 0x address with 40 hex characters',
    valid: 'Valid address',
    submit: 'Track Wallet →',
  },
  checker: {
    titlePrefix: 'Wallet',
    titleAccent: 'Checker',
    subtitle: 'Enter any EVM address to view P&L, win rate, positions and full trade history.',
    explainerToggle: 'How to read these metrics',
    pnlTitle: 'What does P&L mean?',
    pnlDescription: 'Net profit or loss from all Polymarket activity: realized gains from closed positions plus unrealized mark-to-market on open ones. Read it alongside volume and position count.',
    winRateTitle: 'How to read win rate',
    winRateDescription: "Share of resolved positions that finished profitably. On its own it's not enough; position size, odds paid and total P&L together determine whether a strategy works.",
  },
  categories: {
    Crypto: 'Crypto',
    Politics: 'Politics',
    Sports: 'Sports',
    Entertainment: 'Entertainment',
    Tech: 'Tech',
    World: 'World',
    Other: 'Other',
  },
} satisfies MessageTree;

const tr = {
  brand: {
    analytics: 'Analitik',
  },
  nav: {
    worldcup: 'Dünya Kupası 🏆',
    leaderboard: 'Sıralama',
    checker: 'Cüzdan Kontrol',
    markets: 'Marketler',
    activity: 'Aktivite',
    liquidity: 'Likidite',
    insights: 'İçgörüler',
    watchlist: 'İzleme Listesi',
    blog: 'Blog',
    apiDocs: 'API Belgeleri',
    faq: 'SSS',
    compare: 'Traderları Karşılaştır',
    more: 'Daha',
    getAlerts: 'Alarm Al',
    openMenu: 'Menüyü aç',
    closeMenu: 'Menüyü kapat',
  },
  breadcrumb: {
    aria: 'Gezinti yolu',
    home: 'Ana Sayfa',
    worldcup: 'Dünya Kupası',
    checker: 'Cüzdan Kontrol',
    leaderboard: 'Sıralama',
    markets: 'Marketler',
    activity: 'Aktivite',
    liquidity: 'Likidite',
    insights: 'İçgörüler',
    faq: 'SSS',
    privacy: 'Gizlilik Politikası',
    terms: 'Kullanım Şartları',
    disclaimer: 'Sorumluluk Reddi',
    about: 'Hakkında',
    watchlist: 'İzleme Listesi',
    blog: 'Blog',
    apiDocs: 'API Belgeleri',
    compare: 'Traderları Karşılaştır',
    wallet: 'Cüzdan',
  },
  footer: {
    description: 'Polymarket için gerçek zamanlı analitik ve sıralama. En iyi traderları takip et, cüzdanları izle ve alpha fırsatlarını tek yerden keşfet.',
    product: 'Ürün',
    legal: 'Yasal',
    allRightsReserved: 'Tüm hakları saklıdır.',
    disclaimerPrefix: 'Bağımsız analitik aracı. Polymarket ile bağlantılı değildir. Finansal tavsiye değildir.',
    disclaimerLink: 'Sorumluluk Reddi',
    liquidityHub: 'Likidite Merkezi',
    privacyPolicy: 'Gizlilik Politikası',
    termsOfService: 'Kullanım Şartları',
  },
  home: {
    terminalIntelligence: 'Terminal Zekâsı',
    hero: {
      realTime: 'Gerçek zamanlı',
      alpha: 'alpha',
      fromTheBest: 'en iyilerden',
      subtitle: 'Polymarket’te en kârlı traderları gerçek zamanlı keşfet, takip et ve kopyala.',
    },
    sections: {
      platformStats: 'Platform İstatistikleri',
      liveFeed: 'Canlı Akış',
      topMarkets: 'Popüler Marketler',
      hotBets: 'Sıcak Bahisler',
    },
  },
  common: {
    live: 'Canlı',
    activity: 'Aktivite',
    buy: 'Al',
    sell: 'Sat',
    allTime: 'Tüm Zamanlar',
    viewAll: 'Tümünü Gör →',
    viewAllMarkets: 'Tüm Marketleri Gör →',
    smartMoney: 'Akıllı Para',
    activeMarkets: 'Aktif Marketler',
    volume24h: '24s Hacim',
    volume24hShort: '24s Hacim',
    trades1h: 'İşlem (1s)',
    topCategory: 'En Aktif Kategori',
    trades: 'işlem',
    risingTraders: 'Yükselen Traderlar',
    thisWeek: 'Bu Hafta',
    topMarkets: 'Popüler Marketler',
    hotBets: 'Sıcak Bahisler',
    market: 'Market',
    vol: 'Hacim',
    last: 'Son',
    yes: 'YES',
    whale: 'Balina',
    noRecentTrades: 'Yeni işlem yok',
    loading: 'Canlı veriler yükleniyor',
    dataUnavailable: 'Canlı veriler geçici olarak kullanılamıyor',
  },
  telegram: {
    title: 'Polymarket Alarmları',
    description: 'Polymarket’te $50K+ balina hareketleri için gerçek zamanlı alarm al. Kişisel cüzdan alarmları yakında 🚀',
    cta: 'Alarm Al',
  },
  walletSearch: {
    placeholder: 'Cüzdan adresi gir (0x…)',
    invalid: '40 hex karakterli geçerli bir 0x adresi olmalı',
    valid: 'Geçerli adres',
    submit: 'Cüzdanı İzle →',
  },
  checker: {
    titlePrefix: 'Cüzdan',
    titleAccent: 'Kontrol',
    subtitle: 'Herhangi bir EVM adresinin P&L, kazanma oranı, pozisyonları ve tüm işlem geçmişini görüntüle.',
    explainerToggle: 'Bu metrikler nasıl okunur?',
    pnlTitle: 'P&L ne demek?',
    pnlDescription: 'Tüm Polymarket aktivitesinden net kâr veya zarar: kapanan pozisyonlardan realize kârlar ve açık pozisyonların piyasa değerlemesi. Hacim ve pozisyon sayısıyla birlikte okunmalı.',
    winRateTitle: 'Kazanma oranı nasıl okunur?',
    winRateDescription: 'Kârlı biten çözümlenmiş pozisyonların oranı. Tek başına yeterli değildir; pozisyon büyüklüğü, ödenen oranlar ve toplam P&L birlikte stratejinin çalışıp çalışmadığını belirler.',
  },
  categories: {
    Crypto: 'Kripto',
    Politics: 'Politika',
    Sports: 'Spor',
    Entertainment: 'Eğlence',
    Tech: 'Teknoloji',
    World: 'Dünya',
    Other: 'Diğer',
  },
} satisfies MessageTree;

export const messages = { en, tr };

export function isLocale(value: string | null | undefined): value is Locale {
  return LOCALES.includes(value as Locale);
}

export function normalizeLocale(value: string | null | undefined): Locale | null {
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower.startsWith('tr')) return 'tr';
  if (lower.startsWith('en')) return 'en';
  return null;
}

function readPath(source: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object' && part in acc) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, source);
}

export function translate(locale: Locale, key: string, fallback?: string): string {
  const localized = readPath(messages[locale], key);
  if (typeof localized === 'string') return localized;

  const english = readPath(messages.en, key);
  if (typeof english === 'string') return english;

  return fallback ?? key;
}
