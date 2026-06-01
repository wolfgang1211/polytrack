import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Market Insights',
  description: 'Global analytics, trend detection and AI trade signals for Polymarket traders. Understand where smart money flows.',
  alternates: {
    canonical: '/insights',
  },
  openGraph: {
    title: 'Market Insights | AlphaBoard',
    description: 'Global analytics, trend detection and AI trade signals for Polymarket traders.',
    url: '/insights',
  },
  twitter: {
    title: 'Market Insights | AlphaBoard',
    description: 'Global analytics, trend detection and AI trade signals for Polymarket traders.',
  },
};

export default function InsightsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
