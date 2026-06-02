import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Blog',
  description: 'AlphaBoard insights: Polymarket strategies, LP guides, and smart money analysis.',
  alternates: { canonical: '/blog' },
};

const POSTS = [
  {
    slug: 'polymarket-lp-guide',
    title: 'How to Earn Yield as a Liquidity Provider on Polymarket',
    excerpt: 'A practical guide to LPing on Polymarket: spread, depth, APR, and risk management.',
    date: '2026-05-24',
    readTime: '8 min',
    tags: ['LP', 'Yield', 'Guide'],
    image: 'https://www.alphaboard.xyz/opengraph-image',
  },
  {
    slug: 'smart-score-explained',
    title: 'Smart Score Explained: What Separates Top Polymarket Traders',
    excerpt: ‘How AlphaBoard’s Smart Score works: the methodology behind ranking the best traders.’,
    date: '2026-05-17',
    readTime: '6 min',
    tags: ['Smart Score', 'Traders', 'Analytics'],
    image: 'https://www.alphaboard.xyz/opengraph-image',
  },
  {
    slug: 'detecting-whale-activity',
    title: 'Detecting Whale Activity on Polymarket: Tools and Tactics',
    excerpt: 'Track large trades and smart money movements using free analytics tools.',
    date: '2026-05-10',
    readTime: '7 min',
    tags: ['Whales', 'Activity', 'Trading'],
    image: 'https://www.alphaboard.xyz/opengraph-image',
  },
  {
    slug: 'market-microstructure',
    title: 'Polymarket Market Microstructure for Aspiring Alpha Traders',
    excerpt: 'Understanding order books, spreads, and resolution mechanics for better trade execution.',
    date: '2026-05-03',
    readTime: '9 min',
    tags: ['Trading', 'Markets', 'Strategy'],
    image: 'https://www.alphaboard.xyz/opengraph-image',
  },
];

function Tag({ label }: { label: string }) {
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest"
      style={{ background: 'rgba(168,85,247,0.12)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.25)' }}
    >
      {label}
    </span>
  );
}

export default function BlogPage() {
  return (
    <div className="mx-auto max-w-4xl py-8">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-white mb-2">Blog</h1>
        <p className="text-xs text-white/35">
          AlphaBoard research, guides, and market intelligence for Polymarket traders.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {POSTS.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="group flex flex-col rounded-2xl p-5 transition-all hover:scale-[1.01]"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div
              className="mb-4 h-36 w-full overflow-hidden rounded-xl"
              style={{
                backgroundImage: `url(${post.image})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                opacity: 0.7,
              }}
            />

            <div className="flex items-center gap-2 mb-3">
              {post.tags.map((tag) => (
                <Tag key={tag} label={tag} />
              ))}
              <span className="text-[10px] text-white/25 ml-auto font-mono">
                {post.readTime}
              </span>
            </div>

            <h2 className="text-sm font-semibold text-white/85 mb-1.5 leading-snug group-hover:text-purple-200 transition-colors">
              {post.title}
            </h2>
            <p className="text-xs text-white/35 leading-relaxed line-clamp-2">
              {post.excerpt}
            </p>

            <div className="mt-4 flex items-center justify-between">
              <span className="text-[10px] font-mono text-white/20">
                {new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              <span
                className="text-[10px] font-semibold text-purple-400 opacity-0 transition-opacity group-hover:opacity-100"
              >
                Read more →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
