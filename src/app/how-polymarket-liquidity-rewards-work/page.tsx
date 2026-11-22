import type { Metadata } from 'next';
import Link from 'next/link';
import { orderScore, qMin, REWARD_C } from '@/lib/lpRewardsMath';

const SLUG = '/how-polymarket-liquidity-rewards-work';
const PAGE_URL = `https://www.alphaboard.xyz${SLUG}`;
const DOCS_URL = 'https://docs.polymarket.com/market-makers/liquidity-rewards';
const TITLE = 'How Polymarket Liquidity Rewards Work';
const UPDATED = '2026-11-22'; // date the content was last checked against Polymarket's documentation
const DESCRIPTION = 'How Polymarket pays liquidity rewards: eligibility, daily pools, max spread and min size, the order scoring formula, the two-sided rule and when rewards are paid.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: SLUG },
  openGraph: { title: `${TITLE} | AlphaBoard`, description: DESCRIPTION, url: SLUG, type: 'article' },
  twitter: { title: `${TITLE} | AlphaBoard`, description: DESCRIPTION },
};

// Worked examples, computed from the documented formulas (not typed by hand).
const V = 3; // max spread, cents
const S1 = orderScore(V, 1);
const S2 = orderScore(V, 2);
const Q_SINGLE = qMin(90, 0, 0.5);
const Q_TWO = qMin(90, 60, 0.5);
const Q_SINGLE_EDGE = qMin(90, 0, 0.05);
const POOL = 100;
const SHARE = 0.05;

const fmt = (n: number) => n.toFixed(2);

const FAQ = [
  {
    q: 'Do I need to sign up for Polymarket liquidity rewards?',
    a: 'No. Makers who post resting limit orders on an incentivized market are automatically eligible; there is no application.',
  },
  {
    q: 'How often does Polymarket check my orders?',
    a: 'Polymarket samples the order book once a minute at a random offset. A reward day (epoch) is one UTC day, so it has up to 1,440 samples.',
  },
  {
    q: 'Do single-sided orders earn rewards?',
    a: `Only when the market midpoint is between 0.10 and 0.90, and then at a reduced rate (divided by c = ${REWARD_C}). Outside that range, liquidity must be two-sided to score.`,
  },
  {
    q: 'When and how are rewards paid?',
    a: 'Rewards are sent directly to maker addresses once a day at midnight UTC. Daily amounts under the $1 minimum payout are not paid.',
  },
  {
    q: 'Which markets pay the most right now?',
    a: 'AlphaBoard lists every Polymarket market with an active reward pool, ranked by daily reward and refreshed about every 15 minutes, on its Polymarket liquidity rewards page.',
  },
];

function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />;
}

function Docs({ children }: { children: React.ReactNode }) {
  return <a href={DOCS_URL} target="_blank" rel="noopener noreferrer" className="underline hover:text-ink">{children}</a>;
}

export default function HowLiquidityRewardsWorkPage() {
  const articleLd = {
    '@context': 'https://schema.org', '@type': 'Article',
    headline: TITLE, description: DESCRIPTION,
    datePublished: UPDATED, dateModified: UPDATED,
    mainEntityOfPage: PAGE_URL,
    author: { '@type': 'Organization', name: 'AlphaBoard', url: 'https://www.alphaboard.xyz' },
    publisher: { '@type': 'Organization', name: 'AlphaBoard', url: 'https://www.alphaboard.xyz' },
    citation: [DOCS_URL],
  };
  const faqLd = {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: FAQ.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };
  const breadcrumbLd = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.alphaboard.xyz/' },
      { '@type': 'ListItem', position: 2, name: TITLE, item: PAGE_URL },
    ],
  };

  const h2 = 'mb-3 mt-10 text-xl font-semibold text-ink';
  const p = 'text-sm leading-relaxed text-ink/80';

  return (
    <article className="mx-auto max-w-3xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-ink sm:text-4xl">{TITLE}</h1>
        <p className="mt-4 text-base leading-relaxed text-ink/80">
          Polymarket pays liquidity rewards to makers who keep resting limit orders close to the midpoint of incentivized markets.
          Each such market has a daily reward pool, a maximum spread and a minimum order size. Polymarket samples the order book
          once a minute, scores the qualifying orders, and pays each maker&apos;s share of that day&apos;s pool to their address
          at midnight UTC; amounts under $1 are not paid.
        </p>
        <p className="mt-3 text-xs text-ink/55">
          Last checked against <Docs>Polymarket&apos;s liquidity rewards documentation</Docs>: <time dateTime={UPDATED}>22 Nov 2026</time>.
          {' '}See which markets pay the most right now on the <Link href="/polymarket-lp-rewards" className="underline hover:text-ink">Polymarket liquidity rewards table</Link>.
        </p>
      </header>

      <section aria-labelledby="who">
        <h2 id="who" className={h2}>Who can earn rewards</h2>
        <p className={p}>
          Anyone who posts resting limit orders (orders that sit on the book instead of filling immediately) on a market with an
          active reward pool is automatically eligible. There is no sign-up. Market orders and orders that fill right away do not
          count, because they take liquidity instead of providing it.
        </p>
      </section>

      <section aria-labelledby="params">
        <h2 id="params" className={h2}>The three numbers every rewarded market sets</h2>
        <ul className={`${p} list-disc space-y-2 pl-5`}>
          <li><strong className="text-ink">Daily reward pool</strong>: the total paid out for that market for one UTC day, shared by all qualifying makers.</li>
          <li><strong className="text-ink">Maximum spread</strong> (in cents): how far from the midpoint an order may sit and still earn rewards.</li>
          <li><strong className="text-ink">Minimum order size</strong> (in shares): orders smaller than this do not count.</li>
        </ul>
        <p className={`${p} mt-3`}>
          Polymarket publishes these per market; AlphaBoard&apos;s <Link href="/polymarket-lp-rewards" className="underline hover:text-ink">rewards table</Link> shows
          all three for every market with an active pool.
        </p>
      </section>

      <section aria-labelledby="score">
        <h2 id="score" className={h2}>How an order is scored</h2>
        <p className={p}>Each qualifying order gets a score from the documented formula:</p>
        <p className="my-3 rounded-lg px-4 py-3 font-mono text-sm text-ink" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)' }}>
          S(v, s) = ((v − s) / v)² × b
        </p>
        <p className={p}>
          Here <em>v</em> is the market&apos;s maximum spread in cents, <em>s</em> is how far the order sits from the size-adjusted
          midpoint, and <em>b</em> is a multiplier Polymarket applies to in-game markets. Because the distance is squared, closeness
          to the midpoint matters a lot. With a {V}¢ maximum spread, an order at the midpoint scores 1.00, an order 1¢ away scores
          {' '}{fmt(S1)}, an order 2¢ away scores {fmt(S2)}, and an order {V}¢ away no longer scores. Each order&apos;s score is then
          weighted by its size.
        </p>
      </section>

      <section aria-labelledby="sides">
        <h2 id="sides" className={h2}>Why two-sided quotes matter</h2>
        <p className={p}>
          Polymarket adds up your scored size on each side of the book and then applies a two-sided rule with a scaling factor
          c = {REWARD_C}:
        </p>
        <ul className={`${p} mt-3 list-disc space-y-2 pl-5`}>
          <li>
            When the midpoint is between 0.10 and 0.90, single-sided liquidity still scores, but at one third. For example, 90 scored
            shares on one side alone count as {Q_SINGLE}; 90 on one side and 60 on the other count as {Q_TWO}.
          </li>
          <li>
            When the midpoint is below 0.10 or above 0.90, only two-sided liquidity scores: the same 90 shares on one side count as {Q_SINGLE_EDGE}.
          </li>
        </ul>
      </section>

      <section aria-labelledby="payout">
        <h2 id="payout" className={h2}>From one-minute samples to a daily payout</h2>
        <ol className={`${p} list-decimal space-y-2 pl-5`}>
          <li>Once a minute, at a random offset, Polymarket samples the order book and computes every maker&apos;s score.</li>
          <li>Your score in that sample is divided by the sum of all makers&apos; scores, giving your share of that minute.</li>
          <li>Those shares are added up over the reward day (one UTC day, up to 1,440 samples).</li>
          <li>The daily totals are normalised again across makers, and your final share is multiplied by the market&apos;s pool.</li>
        </ol>
        <p className={`${p} mt-3`}>
          Example: if a market&apos;s pool is ${POOL} per day and your final share is {SHARE * 100}%, you earn ${fmt(POOL * SHARE).replace(/\.00$/, '')} for the day.
          Payouts go to your address at midnight UTC; if your total for the day is under $1 it is not paid.
        </p>
      </section>

      <section aria-labelledby="practice">
        <h2 id="practice" className={h2}>What the formula rewards in practice</h2>
        <ul className={`${p} list-disc space-y-2 pl-5`}>
          <li>Quotes close to the midpoint score far more than quotes near the maximum spread.</li>
          <li>Quoting both sides avoids the one-third penalty, and is required in markets priced below 10¢ or above 90¢.</li>
          <li>Orders must meet the minimum size, and they only earn while they are resting on the book during samples.</li>
          <li>The pool is shared: more competing liquidity in a market means a smaller share for each maker.</li>
        </ul>
      </section>

      <section aria-labelledby="risks">
        <h2 id="risks" className={h2}>Risks to weigh</h2>
        <p className={p}>
          Rewards are not free money. Resting orders can be filled when the price moves against you, better-informed traders can pick
          off stale quotes, markets resolve to 0 or 1, and Polymarket can change reward parameters. This page explains the program; it is
          not financial advice.
        </p>
      </section>

      <section aria-labelledby="faq">
        <h2 id="faq" className={h2}>Frequently asked questions</h2>
        <dl className="space-y-4">
          {FAQ.map(f => (
            <div key={f.q}>
              <dt className="text-base font-semibold text-ink">{f.q}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-ink/80">
                {f.a}
                {f.q.startsWith('Which markets') && <> <Link href="/polymarket-lp-rewards" className="underline hover:text-ink">See the live table</Link>.</>}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <p className="mt-10 text-xs text-ink/55">
        Source: <Docs>Polymarket liquidity rewards documentation</Docs>. Independent analytics. Not affiliated with Polymarket. Not financial advice.
      </p>

      <JsonLd data={articleLd} />
      <JsonLd data={faqLd} />
      <JsonLd data={breadcrumbLd} />
    </article>
  );
}
