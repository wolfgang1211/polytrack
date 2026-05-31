import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Market Insights | AlphaBoard',
  description: 'Global analytics and trend detection for Polymarket traders.',
};

export default function InsightsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
