import type { Metadata } from 'next';
import Logo from '@/components/Logo';

export const metadata: Metadata = {
  title: 'About',
  description: 'Learn about AlphaBoard, the real-time analytics platform for Polymarket prediction markets.',
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  return (
    <article className="mx-auto max-w-3xl py-8">
      {/* ── Hero ── */}
      <div className="flex items-center gap-4 mb-3">
        <Logo size={48} />
        <div>
          <h1 className="text-3xl font-bold text-white">About AlphaBoard</h1>
          <p className="text-sm text-purple-400/70 font-medium">Real-time alpha from the best</p>
        </div>
      </div>
      <p className="text-xs text-white/30 mb-10">Independent Polymarket Analytics Platform</p>

      <div className="prose-custom space-y-8">
        <section>
          <h2>What is AlphaBoard?</h2>
          <p>
            AlphaBoard is an independent analytics platform built for the Polymarket ecosystem. We track,
            rank, and analyze the most profitable prediction market traders in real time, giving you
            the tools to discover where smart money flows.
          </p>
          <p>
            Whether you&apos;re a seasoned trader looking for an edge, a liquidity provider searching for
            the best opportunities, or just curious about prediction markets, AlphaBoard provides the data
            and insights you need.
          </p>
        </section>

        <section>
          <h2>What We Offer</h2>
          <div className="grid gap-4 sm:grid-cols-2 not-prose">
            {[
              { icon: '🏆', title: 'Trader Leaderboard', desc: 'Top 50 traders ranked by P&L, volume and our proprietary Smart Score.' },
              { icon: '📊', title: 'Markets Explorer', desc: 'Browse 100+ active markets with real-time prices, volume and liquidity data.' },
              { icon: '⚡', title: 'Live Activity Feed', desc: 'Watch trades happen in real time with dynamic treemap visualization.' },
              { icon: '💧', title: 'Liquidity Hub', desc: 'Discover LP opportunities, analyze spreads and simulate maker rewards.' },
              { icon: '🔍', title: 'Wallet Checker', desc: 'Analyze any Ethereum wallet: P&L, win rate, trade history and more.' },
              { icon: '🔔', title: 'Smart Alerts', desc: 'Get Telegram notifications for whale trades, market moves and LP opportunities.' },
            ].map(({ icon, title, desc }) => (
              <div
                key={title}
                className="rounded-xl p-4"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <span className="text-xl">{icon}</span>
                <h3 className="mt-2 text-sm font-semibold text-white/80">{title}</h3>
                <p className="mt-1 text-xs text-white/40 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2>Our Mission</h2>
          <p>
            Prediction markets are one of the most powerful tools for information aggregation and price
            discovery. Our mission is to make this ecosystem more transparent, accessible, and data-driven.
          </p>
          <p>
            We believe that by surfacing who the best traders are and what they&apos;re doing, we help level
            the playing field for everyone.
          </p>
        </section>

        <section>
          <h2>Technology</h2>
          <p>
            AlphaBoard is built with modern web technologies for maximum speed and reliability:
          </p>
          <ul>
            <li><strong>Next.js 16</strong> with Turbopack for lightning-fast page loads</li>
            <li><strong>Real-time data</strong> from Polymarket CLOB API and on-chain sources</li>
            <li><strong>Edge-optimized</strong> deployment on Vercel&apos;s global CDN</li>
            <li><strong>Proprietary algorithms</strong> for Smart Score, LP scoring, and trend detection</li>
          </ul>
        </section>

        <section>
          <h2>Important Notice</h2>
          <p>
            AlphaBoard is an <strong>independent project</strong> and is not affiliated with, endorsed by,
            or officially connected to Polymarket. We are an analytics and data visualization tool only;
            we do not facilitate trading, custody funds, or provide financial advice.
          </p>
          <p>
            For more information, please read our{' '}
            <a href="/disclaimer" className="underline text-purple-400 hover:text-purple-300">Disclaimer</a>,{' '}
            <a href="/terms" className="underline text-purple-400 hover:text-purple-300">Terms of Service</a>, and{' '}
            <a href="/privacy" className="underline text-purple-400 hover:text-purple-300">Privacy Policy</a>.
          </p>
        </section>

        <section>
          <h2>Contact</h2>
          <p>
            Have questions, feedback, or partnership inquiries? Reach out to us:
          </p>
          <ul>
            <li>Email: <strong>hello@alphaboard.xyz</strong></li>
            <li>Telegram: <a href="https://t.me/alphaboard" target="_blank" rel="noopener noreferrer" className="underline text-purple-400 hover:text-purple-300">@alphaboard</a></li>
            <li>X (Twitter): <a href="https://x.com/alphaboard" target="_blank" rel="noopener noreferrer" className="underline text-purple-400 hover:text-purple-300">@alphaboard</a></li>
          </ul>
        </section>
      </div>
    </article>
  );
}
