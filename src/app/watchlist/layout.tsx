import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Watchlist',
  description: 'Your saved Polymarket traders and markets. Track your favorite wallets and get notified on big moves.',
  alternates: {
    canonical: '/watchlist',
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function WatchlistLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
