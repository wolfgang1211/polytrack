import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

const POSTS: Record<string, { title: string; date: string; readTime: string; content: React.ReactNode }> = {
  'polymarket-lp-guide': {
    title: 'How to Earn Yield as a Liquidity Provider on Polymarket',
    date: '2026-05-24',
    readTime: '8 min',
    content: (
      <div className="space-y-4">
        <p>
          Liquidity providing (LP) on Polymarket lets you earn fees by supplying both sides of a prediction market. 
          This guide covers spread management, depth, APR estimation, and risk mitigation.
        </p>
        <h3 className="text-sm font-semibold text-white/80 mt-6">1. Understanding Spread</h3>
        <p className="text-white/50">
          Spread is the difference between best bid and best ask. Tighter spreads attract more flow, 
          which increases fee revenue. Tight spreads also score higher on AlphaBoard&apos;s LP Score.
        </p>
        <h3 className="text-sm font-semibold text-white/80 mt-6">2. Depth Matters</h3>
        <p className="text-white/50">
          Depth represents how much capital you have at competitive prices. Deeper books reduce slippage 
          and improve your APR as more traders interact with your quotes.
        </p>
        <h3 className="text-sm font-semibold text-white/80 mt-6">3. Estimating APR</h3>
        <p className="text-white/50">
          Use AlphaBoard&apos;s estimates as a starting point only: potential rewards depend on the
          applicable Polymarket program, your share of qualifying liquidity, fills, and spread.
          Compare the estimate against the risks before committing capital.
        </p>
      </div>
    ),
  },
  'smart-score-explained': {
    title: 'Smart Score Explained: What Separates Top Polymarket Traders',
    date: '2026-05-17',
    readTime: '6 min',
    content: (
      <div className="space-y-4">
        <p>
          AlphaBoard&apos;s Smart Score is a relative 0–100 ranking within the current dataset.
          It blends P&amp;L/share efficiency with absolute P&amp;L magnitude using percentile ranks.
          It is a comparison aid, not a guarantee of consistency or future performance.
        </p>
        <h3 className="text-sm font-semibold text-white/80 mt-6">Methodology</h3>
        <p className="text-white/50">
          The score uses a 60% percentile blend for P&amp;L/share and a 40% percentile blend for
          P&amp;L magnitude. Official v2 leaderboard volume is measured in shares, so the efficiency
          ratio is P&amp;L per share rather than a capital return claim.
        </p>
      </div>
    ),
  },
  'detecting-whale-activity': {
    title: 'Detecting Whale Activity on Polymarket: Tools and Tactics',
    date: '2026-05-10',
    readTime: '7 min',
    content: (
      <div className="space-y-4">
        <p>
          Large trades often move markets. Learn how to track whale activity using AlphaBoard&apos;s
          Activity feed, wallet monitoring, and alert configuration.
        </p>
        <h3 className="text-sm font-semibold text-white/80 mt-6">What Is a Whale Trade?</h3>
        <p className="text-white/50">
          A whale trade is an unusually large transaction, typically above $10k notional.
          These trades often precede price moves and can signal informed positioning.
        </p>
      </div>
    ),
  },
  'market-microstructure': {
    title: 'Polymarket Market Microstructure for Aspiring Alpha Traders',
    date: '2026-05-03',
    readTime: '9 min',
    content: (
      <div className="space-y-4">
        <p>
          Market microstructure affects every trade. Understanding order books, spreads, 
          and resolution mechanics helps you execute with minimal slippage.
        </p>
        <h3 className="text-sm font-semibold text-white/80 mt-6">Order Book Dynamics</h3>
        <p className="text-white/50">
          Polymarket uses a central limit order book (CLOB). Liquidity is concentrated at the top of book; 
          market orders sweep through levels and incur slippage.
        </p>
      </div>
    ),
  },
};

export async function generateStaticParams() {
  return Object.keys(POSTS).map((slug) => ({ slug }));
}

export const dynamicParams = false;

type BlogParams = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: BlogParams): Promise<Metadata> {
  const { slug } = await params;
  const post = Object.hasOwn(POSTS, slug) ? POSTS[slug] : undefined;
  if (!post) notFound();
  return {
    title: post.title,
    description: `AlphaBoard blog: ${post.title}`,
    alternates: { canonical: `/blog/${slug}` },
  };
}

export default async function BlogPostPage({ params }: BlogParams) {
  const { slug } = await params;
  const post = Object.hasOwn(POSTS, slug) ? POSTS[slug] : undefined;
  if (!post) notFound();

  return (
    <article className="mx-auto max-w-3xl py-8">
      <Link href="/blog" className="text-[11px] text-white/35 hover:text-white/60 mb-6 inline-block">← Back to Blog</Link>
      <h1 className="text-2xl font-bold text-white mb-2">{post.title}</h1>
      <div className="flex items-center gap-3 mb-8">
        <span className="text-[10px] font-mono text-white/25">{new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
        <span className="text-[10px] text-white/15">•</span>
        <span className="text-[10px] text-white/25">{post.readTime} read</span>
      </div>
      <div className="prose-custom">{post.content}</div>
    </article>
  );
}
