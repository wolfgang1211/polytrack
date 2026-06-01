import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Trader Leaderboard',
  description: 'Top Polymarket traders ranked by P&L, volume and win rate. Discover the smartest money on prediction markets.',
  alternates: {
    canonical: '/leaderboard',
  },
  openGraph: {
    title: 'Trader Leaderboard | AlphaBoard',
    description: 'Top Polymarket traders ranked by P&L, volume and win rate. Discover the smartest money on prediction markets.',
    url: '/leaderboard',
  },
  twitter: {
    title: 'Trader Leaderboard | AlphaBoard',
    description: 'Top Polymarket traders ranked by P&L, volume and win rate.',
  },
};

export default function LeaderboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
