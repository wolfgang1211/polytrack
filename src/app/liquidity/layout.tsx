import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Liquidity Hub | AlphaBoard',
  description: 'Discover LP opportunities, analyze spreads and simulate maker rewards on Polymarket.',
};

export default function LiquidityLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
