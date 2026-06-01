import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Markets Explorer',
  description: 'Browse active Polymarket prediction markets by category, volume and liquidity. Find the hottest bets in crypto, politics, sports and more.',
  alternates: {
    canonical: '/markets',
  },
  openGraph: {
    title: 'Markets Explorer | AlphaBoard',
    description: 'Browse active Polymarket prediction markets by category, volume and liquidity.',
    url: '/markets',
  },
  twitter: {
    title: 'Markets Explorer | AlphaBoard',
    description: 'Browse active Polymarket prediction markets by category, volume and liquidity.',
  },
};

export default function MarketsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
