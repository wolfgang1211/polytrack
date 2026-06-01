import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Live Trading Activity',
  description: 'Real-time Polymarket trading feed. Watch live buys and sells, track volume and discover trending markets as they happen.',
  alternates: {
    canonical: '/activity',
  },
  openGraph: {
    title: 'Live Trading Activity | AlphaBoard',
    description: 'Real-time Polymarket trading feed. Watch live buys and sells as they happen.',
    url: '/activity',
  },
  twitter: {
    title: 'Live Trading Activity | AlphaBoard',
    description: 'Real-time Polymarket trading feed. Watch live buys and sells as they happen.',
  },
};

export default function ActivityLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
