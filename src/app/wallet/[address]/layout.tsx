import type { Metadata } from 'next';

export async function generateMetadata(
  { params }: { params: Promise<{ address: string }> }
): Promise<Metadata> {
  const { address } = await params;
  const addr = String(address).toLowerCase();
  const shortAddr = /^0x[a-fA-F0-9]{40}$/.test(addr)
    ? `${addr.slice(0, 6)}…${addr.slice(-4)}`
    : addr.slice(0, 16);

  const title = `Wallet ${shortAddr}`;
  const description = `Polymarket wallet ${shortAddr}: lifetime P&L, win rate, open positions and full trade history on AlphaBoard.`;
  const ogImage = `/api/wallet/${addr}/og`;

  return {
    title,
    description,
    alternates: { canonical: `/wallet/${addr}` },
    openGraph: {
      title: `${title} | AlphaBoard`,
      description,
      url: `/wallet/${addr}`,
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | AlphaBoard`,
      description,
      images: [ogImage],
    },
  };
}

export default function WalletLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
