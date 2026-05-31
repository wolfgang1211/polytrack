import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Markets Explorer | AlphaBoard',
  description: 'Browse active Polymarket prediction markets by category, volume and liquidity.',
};

export default function MarketsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
