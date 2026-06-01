import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Blog',
  description: 'AlphaBoard blog — Polymarket strategies, LP guides, alpha signals, and smart money analysis.',
  alternates: { canonical: '/blog' },
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-4xl">{children}</div>;
}
