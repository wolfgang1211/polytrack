import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'World Cup Markets',
  description: 'Track FIFA 2026 World Cup prediction markets with country-colored cards, live odds, volume and flag-based market context.',
  alternates: {
    canonical: '/world-cup',
  },
  openGraph: {
    title: 'World Cup Markets | AlphaBoard',
    description: 'Track FIFA 2026 World Cup prediction markets with country-colored cards, live odds and volume.',
    url: '/world-cup',
  },
  twitter: {
    title: 'World Cup Markets | AlphaBoard',
    description: 'Track FIFA 2026 World Cup prediction markets with country-colored cards, live odds and volume.',
  },
};

export default function WorldCupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
