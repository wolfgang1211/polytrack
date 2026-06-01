import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Wallet Checker',
  description: 'Analyze any Polymarket wallet — check P&L, win rate, trade history and portfolio performance by Ethereum address.',
  alternates: {
    canonical: '/checker',
  },
  openGraph: {
    title: 'Wallet Checker | AlphaBoard',
    description: 'Analyze any Polymarket wallet — check P&L, win rate and trade history by Ethereum address.',
    url: '/checker',
  },
  twitter: {
    title: 'Wallet Checker | AlphaBoard',
    description: 'Analyze any Polymarket wallet — check P&L, win rate and trade history.',
  },
};

export default function CheckerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
