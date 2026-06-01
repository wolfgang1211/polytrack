import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FAQ',
  description: 'Frequently asked questions about AlphaBoard — Polymarket analytics, Smart Scores, liquidity and more.',
  alternates: { canonical: '/faq' },
};

const CATEGORIES = [
  { id: 'general', label: 'General' },
  { id: 'traders', label: 'Traders & Leaderboard' },
  { id: 'markets', label: 'Markets' },
  { id: 'liquidity', label: 'Liquidity & LP' },
  { id: 'wallet', label: 'Wallet Checker' },
  { id: 'alerts', label: 'Alerts' },
];

type QAItem = { q: string; a: React.ReactNode };
const QA: Record<string, QAItem[]> = {
  general: [
    {
      q: 'What is AlphaBoard?',
      a: 'AlphaBoard is an independent analytics platform for Polymarket prediction markets. We track top traders, analyze market data, and provide tools for liquidity providers — all in real time.',
    },
    {
      q: 'Is AlphaBoard free to use?',
      a: 'Yes! All core features including the trader leaderboard, markets explorer, activity feed, and wallet checker are completely free.',
    },
    {
      q: 'Is AlphaBoard affiliated with Polymarket?',
      a: 'No. AlphaBoard is an independent third-party analytics tool. We are not affiliated with, endorsed by, or officially connected to Polymarket. All data is sourced from public APIs and on-chain data.',
    },
    {
      q: 'Where does the data come from?',
      a: 'Our data comes from Polymarket\'s public CLOB API, on-chain data from the Polygon network, and our own scraping pipelines. We do not have access to private order books or insider data.',
    },
    {
      q: 'Do I need an account?',
      a: 'No account is needed to browse leaderboards, markets, or activity feeds. You only need an account to use the Watchlist feature or configure custom alerts.',
    },
  ],
  traders: [
    {
      q: 'How does the Smart Score work?',
      a: 'Smart Score is a proprietary metric (0–100) that combines multiple factors: P&L consistency, win rate, volume efficiency, market diversity, and recent performance trends. A higher score indicates a trader with more consistent and reliable performance.',
    },
    {
      q: 'Why does a trader have high volume but low P&L?',
      a: 'High volume with lower P&L can mean a few things: the trader takes many small positions (scalping), they\'ve been active for longer and profits compound differently, or their strategy prioritizes market making over directional bets.',
    },
    {
      q: 'How often is the leaderboard updated?',
      a: 'The leaderboard updates every few minutes. We re-fetch trader data from on-chain sources regularly to ensure accuracy.',
    },
    {
      q: 'What does "Verified" mean?',
      a: 'A verified trader is one whose on-chain identity we\'ve confirmed through Polymarket\'s verification system or other reliable sources. This helps distinguish authentic top traders from imitators.',
    },
  ],
  markets: [
    {
      q: 'What are the different market categories?',
      a: 'AlphaBoard categorizes markets into: Politics, Crypto, Sports, World, Esports, Science, Entertainment, Elections, Tech, and Other. You can filter markets by any category using the tab bar.',
    },
    {
      q: 'What do YES/NO prices mean?',
      a: 'Prices are shown in cents (¢). A "Yes" price of 55¢ means the market assigns a 55% probability to that outcome. You can buy Yes shares for 55¢ each. If the outcome resolves as "Yes", each share pays out $1.',
    },
    {
      q: 'What is "Liquidity"?',
      a: 'Liquidity represents how much capital is available in a market\'s order book at competitive prices. Higher liquidity means you can enter or exit positions with minimal price impact.',
    },
    {
      q: 'What does "Resolves In" mean?',
      a: 'This shows how many days are left until the market resolves. Once resolved, winning shares pay out $1 and losing shares expire worthless.',
    },
  ],
  liquidity: [
    {
      q: 'What is an LP (Liquidity Provider)?',
      a: 'An LP is someone who deposits funds into both sides of a prediction market, earning fees from trades that cross their spread. On Polymarket, LPs can earn maker rebates and reward bonuses.',
    },
    {
      q: 'How is the LP Score calculated?',
      a: 'LP Score = Spread (out of 35) + Volume (out of 45) + Depth (out of 20) = /100. A higher score indicates a better potential LP opportunity.',
    },
    {
      q: 'What is APR and how is it calculated?',
      a: 'APR (Annual Percentage Rate) estimates how much you could earn providing liquidity over a year. Our formula: pool_share × 24h_volume × 0.1% maker rebate rate. Actual rewards depend on spread fill rate and Polymarket\'s reward program.',
    },
    {
      q: 'Is LP risk-free?',
      a: 'No. LP carries risks including: impermanent loss (if the market price moves against your position), smart contract risk, reward program changes, and market resolution risk. Always do your own research.',
    },
  ],
  wallet: [
    {
      q: 'How do I check my wallet?',
      a: 'Go to the Wallet Checker page and paste your Ethereum wallet address (starting with 0x...). Click "Track Wallet" and we\'ll analyze your P&L, win rate, and trade history.',
    },
    {
      q: 'Does Wallet Checker show realized or unrealized P&L?',
      a: 'We show both realized P&L (from closed positions) and estimates of current unrealized P&L based on current market prices. Realized P&L is more accurate; unrealized is an estimate.',
    },
    {
      q: 'Is my wallet data private?',
      a: 'Wallet addresses are public on the blockchain. AlphaBoard only aggregates and displays data that is already publicly available. Read our Privacy Policy for more details.',
    },
  ],
  alerts: [
    {
      q: 'How do I set up alerts?',
      a: 'Click the "Get Alerts" button in the navbar and follow the instructions to connect your Telegram account. You can configure alerts for whale trades, LP opportunities, and market moves.',
    },
    {
      q: 'What types of alerts are available?',
      a: 'Currently we offer: Whale trade alerts (large trades from top traders), LP opportunity alerts (high-score spread changes), and market move alerts (significant price movements).',
    },
    {
      q: 'Is there a limit on alerts?',
      a: 'No, you can set up multiple alert preferences. We recommend using Telegram for delivery as it provides the fastest and most reliable notifications.',
    },
  ],
};

function AccordionItem({ id, q, a }: { id: string; q: string; a: React.ReactNode }) {
  return (
    <details
      className="group rounded-xl"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <summary
        className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 text-sm font-semibold text-white/80 transition-colors group-open:text-purple-300"
      >
        {q}
        <svg
          className="h-4 w-4 flex-shrink-0 text-white/30 transition-transform group-open:rotate-180"
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </summary>
      <div className="px-5 pb-4 text-xs leading-relaxed text-white/40">
        {a}
      </div>
    </details>
  );
}

function CategorySection({ id, items }: { id: string; items: QAItem[] }) {
  const label = CATEGORIES.find(c => c.id === id)?.label;
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="mb-4 flex items-center gap-3">
        <span className="inline-flex items-center rounded-lg px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
              style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.25)' }}>
          {label}
        </span>
      </h2>
      <div className="space-y-2">
        {items.map((item, i) => (
          <AccordionItem key={`${id}-${i}`} id={`${id}-${i}`} q={item.q} a={item.a} />
        ))}
      </div>
    </section>
  );
}

const faqAreas = Object.entries(QA) as Array<[string, QAItem[]]>;

export default function FAQPage() {
  return (
    <article className="mx-auto max-w-3xl py-8">
      <h1 className="text-3xl font-bold text-white mb-2">FAQ</h1>
      <p className="text-xs text-white/30 mb-8">
        Find answers to the most common questions about AlphaBoard.
      </p>

      {/* ── Category nav (horizontal pills) ── */}
      <div className="mb-10 flex flex-wrap gap-2">
        <a href="#general" className="faq-pill">General</a>
        {CATEGORIES.slice(1).map(cat => (
          <a key={cat.id} href={`#${cat.id}`} className="faq-pill">{cat.label}</a>
        ))}
      </div>

      <div className="space-y-10">
        {faqAreas.map(([id, items]) => (
          <CategorySection key={id} id={id} items={items} />
        ))}
      </div>

      {/* ── Still need help? ── */}
      <div className="mt-14 rounded-2xl p-6 text-center"
           style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <h3 className="text-sm font-semibold text-white/70 mb-2">Still have questions?</h3>
        <p className="text-xs text-white/30 mb-4">
          Can't find the answer you're looking for? Reach out to us.
        </p>
        <a href="https://t.me/alphaboard" target="_blank" rel="noopener noreferrer"
           className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white/70 transition-all hover:text-white hover:scale-[1.02]"
           style={{ background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.25)' }}>
          Contact via Telegram
        </a>
      </div>
    </article>
  );
}
