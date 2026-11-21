import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  KalshiError, TICKER_RE, fetchKalshiMarket, fetchVerifiedOrderbook, formatCents, formatContracts, formatUtc, isBookSupported,
  type KalshiDerivedLevel, type KalshiLevel, type KalshiMarket, type KalshiOrderbook,
} from '@/lib/kalshi';
import { DEFAULT_HISTORY_RANGE, fetchKalshiHistory, type KalshiHistory } from '@/lib/kalshiHistory';
import KalshiQuoteSummary, { KalshiQuotePolicyNote } from '../../KalshiQuoteSummary';
import KalshiHistoryClient from '../../KalshiHistoryClient';

const META_DESCRIPTION = 'Read-only Kalshi market metadata, published rules and order book depth. Volume is in contracts; Kalshi provides no quote timestamp.';

// Per-ticker canonical/OG without a second provider fetch; unknown tickers still 404 via the page itself.
export async function generateMetadata({ params }: { params: Promise<{ ticker: string }> }): Promise<Metadata> {
  const { ticker } = await params;
  const valid = TICKER_RE.test(ticker);
  const title = valid ? `Kalshi ${ticker}` : 'Kalshi market';
  const url = valid ? `/markets/kalshi/${encodeURIComponent(ticker)}` : '/markets?platform=kalshi';
  return {
    title,
    description: META_DESCRIPTION,
    alternates: { canonical: url },
    openGraph: { title: `${title} | AlphaBoard`, description: META_DESCRIPTION, url },
    twitter: { title: `${title} | AlphaBoard`, description: META_DESCRIPTION },
  };
}

const DEPTH = 10;
const panel = { background: 'var(--surface-1)', border: '1px solid rgba(var(--ink-rgb),0.08)' };

function Back() {
  return (
    <Link href="/markets?platform=kalshi" className="inline-flex items-center gap-1.5 text-xs text-ink/40 hover:text-ink/70 transition-colors w-fit">
      ← Back to Kalshi markets
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl p-3" style={panel}>
      <p className="text-[10px] uppercase tracking-wider text-ink/35">{label}</p>
      <p className="mt-1 text-sm font-semibold text-ink/80">{value}</p>
    </div>
  );
}

function Levels({ title, rows, derived }: { title: string; rows: (KalshiLevel | KalshiDerivedLevel)[]; derived?: string }) {
  return (
    <div className="rounded-xl p-3" style={panel}>
      <p className="text-xs font-semibold text-ink/70">{title}</p>
      {derived && <p className="text-[10px] text-ink/35">{derived}</p>}
      {rows.length === 0 ? (
        <p className="mt-2 text-xs text-ink/35">No levels (unknown, not zero)</p>
      ) : (
        <table className="mt-2 w-full text-xs">
          <thead><tr className="text-ink/35"><th className="text-left font-normal">Price</th><th className="text-right font-normal">Contracts</th></tr></thead>
          <tbody>
            {rows.slice(0, DEPTH).map((r, i) => (
              <tr key={`${r.price}-${i}`} className="text-ink/75"><td>{formatCents(r.price)}</td><td className="text-right">{r.size.toLocaleString('en-US')}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Book({ market, book, bookError }: { market: KalshiMarket; book: KalshiOrderbook | null; bookError: string | null }) {
  if (!isBookSupported(market)) {
    return <p className="text-sm text-ink/50">Order book display is not supported for this market (requires a binary market with $1 notional). No quotes are shown.</p>;
  }
  if (!book) return <p role="alert" className="text-sm text-rose-400">{bookError} Market details and rules above are still accurate as retrieved. Reload the page to retry.</p>;
  const yes = market.yesLabel ?? 'Yes';
  const no = market.noLabel ?? 'No';
  return (
    <div className="flex flex-col gap-3">
      {!book.complete && (
        <p role="alert" className="text-xs text-rose-400">Partial book: {book.rejectedLevelCount} malformed level(s) were dropped.</p>
      )}
      {/* Top levels of THIS book only — never the market-list quote fields, which come from a different snapshot. */}
      <div className="rounded-xl p-3 flex flex-col gap-1" style={panel}>
        <KalshiQuoteSummary source="book" partial={!book.complete}
          yesBid={book.yesBids[0]?.price ?? null} yesBidSize={book.yesBids[0]?.size ?? null}
          yesAsk={book.yesAsks[0]?.price ?? null} yesAskSize={book.yesAsks[0]?.size ?? null} />
        <p className="text-[10px] text-ink/35">Yes ask derived from No bids (1 − price), as in the table below.</p>
        <KalshiQuotePolicyNote />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Levels title={`Yes bids (${yes})`} rows={book.yesBids} />
        <Levels title="Yes asks" rows={book.yesAsks} derived="Derived from No bids (1 − price)" />
        <Levels title={`No bids (${no})`} rows={book.noBids} />
        <Levels title="No asks" rows={book.noAsks} derived="Derived from Yes bids (1 − price)" />
      </div>
      <p className="text-[11px] text-ink/35">Top {DEPTH} levels per side. Quotes are informational, not execution-ready.</p>
    </div>
  );
}

export default async function KalshiMarketPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  if (!TICKER_RE.test(ticker)) notFound();

  let market: KalshiMarket;
  let receivedAt: string;
  try {
    ({ market, receivedAt } = await fetchKalshiMarket(ticker));
  } catch (e) {
    if (e instanceof KalshiError && e.status === 404) notFound();
    return (
      <div className="flex flex-col gap-4">
        <Back />
        <div role="alert" className="rounded-2xl p-6 text-sm text-rose-400" style={{ background: 'rgba(244,63,94,0.07)', border: '1px solid rgba(244,63,94,0.2)' }}>
          Kalshi market data is temporarily unavailable. Please try again shortly.
        </div>
      </div>
    );
  }

  let book: (KalshiOrderbook & { receivedAt: string }) | null = null;
  let bookError: string | null = null;
  let history: KalshiHistory | null = null;
  let historyError: string | null = null;
  const supported = isBookSupported(market);
  if (supported) {
    // Book and history run in parallel from the one verified market; neither failure hides the other.
    const [b, h] = await Promise.allSettled([fetchVerifiedOrderbook(market), fetchKalshiHistory(market, DEFAULT_HISTORY_RANGE)]);
    if (b.status === 'fulfilled') book = b.value;
    else bookError = 'Order book is temporarily unavailable.';
    if (h.status === 'fulfilled') history = h.value;
    else historyError = 'Price history is temporarily unavailable.';
  }

  return (
    <div className="flex flex-col gap-5">
      <Back />
      <header className="rounded-2xl p-5" style={panel}>
        <p className="text-[10px] uppercase tracking-widest text-ink/35">Kalshi · read-only</p>
        <h1 className="mt-1 text-xl font-black text-ink sm:text-2xl">{market.title ?? market.ticker}</h1>
        <p className="mt-1 font-mono text-[11px] text-ink/40 break-all">
          {market.ticker} · event{' '}
          <Link href={`/markets/kalshi/events/${encodeURIComponent(market.eventTicker)}`} className="underline underline-offset-2 hover:text-ink/70">
            {market.eventTicker}
          </Link>
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
          <span className="rounded-full px-2.5 py-1 font-semibold text-ink/70" style={{ background: 'rgba(var(--ink-rgb),0.06)', border: '1px solid rgba(var(--ink-rgb),0.1)' }}>
            Status: {market.status}
          </span>
          <span className="rounded-full px-2.5 py-1 font-semibold text-ink/70" style={{ background: 'rgba(var(--ink-rgb),0.06)', border: '1px solid rgba(var(--ink-rgb),0.1)' }}>
            Type: {market.marketType ?? 'Unavailable'}
          </span>
        </div>
        {market.status !== 'active' && <p className="mt-2 text-xs text-ink/50">This market is not active; quotes, if any, are not tradable.</p>}
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Market metrics">
        <Stat label="Yes" value={market.yesLabel ?? 'Unavailable'} />
        <Stat label="No" value={market.noLabel ?? 'Unavailable'} />
        <Stat label="Settlement size" value={market.notionalDollars === null ? 'Unavailable' : `$${market.notionalDollars} per contract`} />
        <Stat label="Closes" value={formatUtc(market.closeTime)} />
        <Stat label="24h volume" value={formatContracts(market.volume24hContracts)} />
        <Stat label="Total volume" value={formatContracts(market.totalVolumeContracts)} />
        <Stat label="Open interest" value={formatContracts(market.openInterestContracts)} />
        <Stat label="Market record updated" value={formatUtc(market.updatedTime)} />
      </section>

      <section className="rounded-2xl p-5 flex flex-col gap-3" style={panel} aria-labelledby="rules-heading">
        <h2 id="rules-heading" className="text-sm font-bold text-ink/80">Rules (as published by Kalshi)</h2>
        <p className="whitespace-pre-line text-sm text-ink/70">{market.rulesPrimary ?? 'Primary rules unavailable.'}</p>
        {market.rulesSecondary && <p className="whitespace-pre-line text-xs text-ink/55">{market.rulesSecondary}</p>}
      </section>

      <section className="rounded-2xl p-5 flex flex-col gap-3" style={panel} aria-labelledby="book-heading">
        <h2 id="book-heading" className="text-sm font-bold text-ink/80">Order book depth</h2>
        <Book market={market} book={book} bookError={bookError} />
      </section>

      <section className="rounded-2xl p-5 flex flex-col gap-3" style={panel} aria-labelledby="history-heading">
        <h2 id="history-heading" className="text-sm font-bold text-ink/80">Price history and recent trades</h2>
        {supported ? (
          <KalshiHistoryClient key={market.ticker} ticker={market.ticker} initialRange={DEFAULT_HISTORY_RANGE} initial={history} initialError={historyError} />
        ) : (
          <p className="text-sm text-ink/50">Price history is not supported for this market (requires a binary market with $1 notional).</p>
        )}
      </section>

      <p className="text-[11px] text-ink/35">
        Metadata retrieved {formatUtc(receivedAt)}{book ? `; order book retrieved ${formatUtc(book.receivedAt)}` : ''}. These are retrieval times only;
        Kalshi provides no quote timestamp, so data may be older than shown.
      </p>
    </div>
  );
}
