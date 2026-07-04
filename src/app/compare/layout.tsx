import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Compare Traders',
  description: 'Compare two Polymarket wallets side by side: P&L, win rate, portfolio value, average bet size and more.',
  alternates: {
    canonical: '/compare',
  },
  openGraph: {
    title: 'Compare Traders | AlphaBoard',
    description: 'Compare two Polymarket wallets side by side: P&L, win rate, portfolio value, average bet size and more.',
    url: '/compare',
  },
  twitter: {
    title: 'Compare Traders | AlphaBoard',
    description: 'Compare two Polymarket wallets side by side: P&L, win rate and portfolio performance.',
  },
};

export default function CompareLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
