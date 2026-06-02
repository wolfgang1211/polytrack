import Link from 'next/link';
import type { Metadata } from 'next';

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
          which increases fee revenue. Tight spreads also score higher on AlphaBoard's LP Score.
        </p>
        <h3 className="text-sm font-semibold text-white/80 mt-6">2. Depth Matters</h3>
        <p className="text-white/50">
          Depth represents how much capital you have at competitive prices. Deeper books reduce slippage 
          and improve your APR as more traders interact with your quotes.
        </p>
        <h3 className="text-sm font-semibold text-white/80 mt-6">3. Estimating APR</h3>
        <p className="text-white/50">
          Use AlphaBoard's formula: pool_share × 24h_volume × 0.1% maker rebate. 
          Compare this against DeFi alternatives to find the best risk-adjusted yield.
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
          AlphaBoard's Smart Score combines consistency, efficiency, and diversification into a single metric. 
          Here's how we calculate it and why it matters.
        </p>
        <h3 className="text-sm font-semibold text-white/80 mt-6">Methodology</h3>
        <p className="text-white/50">
          We score P&L stability, win rate, volume efficiency, market diversity, and recent performance. 
          Each factor is weighted to reward sustainable edge over lucky streaks.
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
          Large trades often move markets. Learn how to track whale activity using AlphaBoard's 
          Activity feed, wallet monitoring, and alert configuration.
        </p>
        <h3 className="text-sm font-semibold text-white/80 mt-6">What Is a Whale Trade?</h3>
        <p className="text-white/50">
          A whale trade is an unusually large transaction — typically above $10k notional. 
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

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = POSTS[params.slug];
  if (!post) return { title: 'Post Not Found' };
  return {
    title: post.title,
    description: `AlphaBoard blog — ${post.title}`,
    alternates: { canonical: `/blog/${params.slug}` },
  };
}

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = POSTS[params.slug];

  if (!post) {
    return (
      <div className="mx-auto max-w-3xl py-8">
        <h1 className="text-2xl font-bold text-white mb-2">Post Not Found</h1>
        <Link href="/blog" className="text-xs text-purple-400 hover:text-purple-300">← Back to Blog</Link>
      </div>
    );
  }

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
