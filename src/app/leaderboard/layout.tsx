import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Trader Leaderboard | AlphaBoard',
  description: 'Top Polymarket traders ranked by P&L, volume and win rate.',
};

export default function LeaderboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
