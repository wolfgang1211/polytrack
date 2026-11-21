import type { Metadata } from 'next';

// Two providers with different units: Polymarket volume/liquidity are USD, Kalshi volume is contract counts.
const DESCRIPTION = 'Browse active Polymarket markets by category, USD volume and liquidity, or read-only Kalshi markets with quotes and contract volume.';

export const metadata: Metadata = {
  title: 'Markets Explorer',
  description: DESCRIPTION,
  alternates: {
    canonical: '/markets',
  },
  openGraph: {
    title: 'Markets Explorer | AlphaBoard',
    description: DESCRIPTION,
    url: '/markets',
  },
  twitter: {
    title: 'Markets Explorer | AlphaBoard',
    description: DESCRIPTION,
  },
};

export default function MarketsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
