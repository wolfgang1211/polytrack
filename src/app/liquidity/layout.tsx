import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Liquidity Hub',
  description: 'Discover LP opportunities, analyze market depth, spreads and simulate maker rewards on Polymarket.',
  alternates: {
    canonical: '/liquidity',
  },
  openGraph: {
    title: 'Liquidity Hub | AlphaBoard',
    description: 'Discover LP opportunities, analyze market depth, spreads and simulate maker rewards on Polymarket.',
    url: '/liquidity',
  },
  twitter: {
    title: 'Liquidity Hub | AlphaBoard',
    description: 'Discover LP opportunities, analyze market depth and simulate maker rewards on Polymarket.',
  },
};

export default function LiquidityLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
