import Link from 'next/link';
import { marketUrl } from '@/lib/builder';
import { closesLabel, formatUsd, formatUtc, LP_REWARDS_FAQ, type LpRewardsSnapshot } from '@/lib/lpRewardsPage';
import SnapshotAge from '@/app/polymarket-lp-rewards/SnapshotAge';

const PAGE_URL = 'https://www.alphaboard.xyz/polymarket-lp-rewards';
const DOCS_URL = 'https://docs.polymarket.com/market-makers/liquidity-rewards';

const dash = '—';
const num = (n: number | null, fmt: (v: number) => string) => (n === null ? dash : fmt(n));

function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />;
}

export default function LpRewardsView({ snapshot }: { snapshot: LpRewardsSnapshot }) {
  const ok = snapshot.status === 'ok' ? snapshot : null;
  const faqLd = {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: LP_REWARDS_FAQ.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };
  const breadcrumbLd = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.alphaboard.xyz/' },
      { '@type': 'ListItem', position: 2, name: 'Polymarket LP Rewards', item: PAGE_URL },
    ],
  };
  const datasetLd = ok && {
    '@context': 'https://schema.org', '@type': 'Dataset',
    name: 'Polymarket liquidity rewards by market',
    description: 'Daily liquidity-reward pools, maximum qualifying spread and minimum qualifying size for Polymarket markets, ranked by daily reward.',
    url: PAGE_URL,
    dateModified: ok.generatedAt,
    isAccessibleForFree: true,
    creator: { '@type': 'Organization', name: 'AlphaBoard', url: 'https://www.alphaboard.xyz' },
    variableMeasured: ['Daily reward pool (USD)', 'Maximum qualifying spread (cents)', 'Minimum qualifying order size (shares)'],
    isBasedOn: 'https://gamma-api.polymarket.com/markets',
  };

  return (
    <article className="mx-auto max-w-5xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-ink sm:text-4xl">Polymarket Liquidity Rewards: Highest-Paying Markets</h1>
        {ok ? (
          <p className="mt-4 text-base leading-relaxed text-ink/80">{ok.summary}</p>
        ) : snapshot.status === 'empty' ? (
          <p className="mt-4 text-base leading-relaxed text-ink/80">
            As of {formatUtc(snapshot.generatedAt)}, none of the {snapshot.universe} Polymarket markets with a reward pool offer $1 per day or more.
          </p>
        ) : (
          <p className="mt-4 text-base leading-relaxed text-ink/80">
            Polymarket reward data is temporarily unavailable. This page refreshes about every 15 minutes; please check back shortly.
          </p>
        )}
        <p className="mt-3 text-xs text-ink/55">
          Last updated: <time dateTime={snapshot.generatedAt}>{formatUtc(snapshot.generatedAt)}</time> · Refreshed about every 15 minutes
        </p>
        {ok && !ok.complete && (
          <p role="status" className="mt-3 rounded-lg px-3 py-2 text-xs text-amber-400" style={{ border: '1px solid rgba(251,191,36,0.3)', background: 'rgba(251,191,36,0.06)' }}>
            Partial data: part of Polymarket&apos;s reward list could not be loaded in this refresh, so totals are a lower bound.
          </p>
        )}
        <SnapshotAge generatedAt={snapshot.generatedAt} />
      </header>

      {ok && (
        <section aria-labelledby="top-heading" className="mb-10">
          <h2 id="top-heading" className="mb-3 text-xl font-semibold text-ink">Top {ok.rows.length} Polymarket markets by daily liquidity reward</h2>
          <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid rgba(var(--ink-rgb),0.08)' }}>
            <table className="w-full min-w-[640px] text-left text-sm">
              <caption className="sr-only">Polymarket markets ranked by daily liquidity-reward pool, as of {formatUtc(ok.generatedAt)}</caption>
              <thead className="text-xs uppercase tracking-wider text-ink/55">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">#</th>
                  <th scope="col" className="px-3 py-2 font-medium">Market</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Daily reward</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Max spread</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Min size</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Liquidity</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Closes / starts</th>
                </tr>
              </thead>
              <tbody>
                {ok.rows.map(r => (
                  <tr key={r.conditionId} style={{ borderTop: '1px solid rgba(var(--ink-rgb),0.06)' }}>
                    <td className="px-3 py-2 text-ink/55">{r.rank}</td>
                    <td className="px-3 py-2">
                      {r.question && (r.eventSlug || r.slug) ? (
                        <a href={marketUrl(r.eventSlug, r.slug, 'lp_rewards_page')} target="_blank" rel="noopener noreferrer sponsored"
                          className="font-medium text-ink/90 hover:text-ink hover:underline">{r.question}</a>
                      ) : (
                        <span className="text-ink/70">{r.question ?? 'Market details unavailable'} <span className="font-mono text-xs text-ink/55">{r.conditionId.slice(0, 10)}…</span></span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-ink">{formatUsd(r.dailyRate)}</td>
                    <td className="px-3 py-2 text-right text-ink/80">{num(r.maxSpread, v => `${v}¢`)}</td>
                    <td className="px-3 py-2 text-right text-ink/80">{num(r.minSize, v => `${v.toLocaleString('en-US')} shares`)}</td>
                    <td className="px-3 py-2 text-right text-ink/80">{num(r.liquidity, formatUsd)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right text-ink/80">{closesLabel(r.endDate, ok.generatedAt, r.gameStart)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-ink/55">
            Showing the {ok.rows.length} largest of {ok.marketCount.toLocaleString('en-US')} pools. &ldquo;Closes / starts&rdquo; is relative to this snapshot (for games, the kick-off time);
            &ldquo;—&rdquo; means Polymarket did not publish the value. Market links open Polymarket. External link · Referral may apply.
          </p>
        </section>
      )}

      <section aria-labelledby="method-heading" className="mb-10 space-y-3 text-sm leading-relaxed text-ink/80">
        <h2 id="method-heading" className="text-xl font-semibold text-ink">How this list is built</h2>
        <p>
          AlphaBoard reads Polymarket&apos;s public list of every market with an active liquidity-reward pool (the CLOB rewards API)
          {ok ? ` (${ok.universe.toLocaleString('en-US')} markets in this snapshot)` : ''} and ranks them by daily reward, including sponsored rewards.
          Pools under $1 per day are left out because Polymarket does not pay out amounts under $1. Names, close times and liquidity
          come from Polymarket&apos;s market data for the markets shown.
        </p>
        <p>
          All market types are included, from season-long questions to single games that close within hours; check the Closes / starts column
          before quoting. Games that have started usually keep trading until they resolve. The daily reward is the whole pool for a market, shared by all qualifying makers; it is not what one provider earns.
          For estimated returns on your own capital, use the <Link href="/liquidity" className="underline hover:text-ink">Liquidity Hub</Link>.
          Program rules are set by Polymarket; see the{' '}
          <a href={DOCS_URL} target="_blank" rel="noopener noreferrer" className="underline hover:text-ink">official liquidity rewards documentation</a>.
        </p>
      </section>

      <section aria-labelledby="faq-heading" className="mb-10">
        <h2 id="faq-heading" className="mb-3 text-xl font-semibold text-ink">Frequently asked questions</h2>
        <dl className="space-y-4">
          {LP_REWARDS_FAQ.map(f => (
            <div key={f.q}>
              <dt className="text-base font-semibold text-ink">{f.q}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-ink/80">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <p className="text-xs text-ink/55">Independent analytics. Not affiliated with Polymarket. Not financial advice.</p>

      <JsonLd data={faqLd} />
      <JsonLd data={breadcrumbLd} />
      {datasetLd && <JsonLd data={datasetLd} />}
    </article>
  );
}
