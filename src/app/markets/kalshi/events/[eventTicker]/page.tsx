import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { KalshiError, TICKER_RE, fetchKalshiMarkets, formatUtc, type KalshiMarketsPage } from '@/lib/kalshi';
import { fetchKalshiEvent, type KalshiEvent } from '@/lib/kalshiEvents';
import KalshiMarketsClient from '../../../KalshiMarketsClient';

const META_DESCRIPTION = 'Read-only Kalshi event metadata and its open binary $1 markets, loaded in bounded pages.';
const EVENTS_HREF = '/markets?platform=kalshi&view=events';
const CHILD_LIMIT = 100;

// Per-event canonical/OG without a provider fetch; unknown events still 404 via the page itself.
export async function generateMetadata({ params }: { params: Promise<{ eventTicker: string }> }): Promise<Metadata> {
  const { eventTicker } = await params;
  const valid = TICKER_RE.test(eventTicker);
  const title = valid ? `Kalshi event ${eventTicker}` : 'Kalshi event';
  const url = valid ? `/markets/kalshi/events/${encodeURIComponent(eventTicker)}` : EVENTS_HREF;
  return {
    title,
    description: META_DESCRIPTION,
    alternates: { canonical: url },
    openGraph: { title: `${title} | AlphaBoard`, description: META_DESCRIPTION, url },
    twitter: { title: `${title} | AlphaBoard`, description: META_DESCRIPTION },
  };
}

const panel = { background: 'var(--surface-1)', border: '1px solid rgba(var(--ink-rgb),0.08)' };
const mutualLabel = (v: boolean | null) => (v === null ? 'Unavailable' : v ? 'Yes' : 'No');

function Back() {
  return (
    <Link href={EVENTS_HREF} className="inline-flex items-center gap-1.5 text-xs text-ink/55 hover:text-ink/70 transition-colors w-fit">
      ← Back to Kalshi events
    </Link>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl p-3" style={panel}>
      <dt className="text-xs uppercase tracking-wider text-ink/55">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-ink/80 break-all">{children}</dd>
    </div>
  );
}

export default async function KalshiEventPage({ params }: { params: Promise<{ eventTicker: string }> }) {
  const { eventTicker } = await params;
  if (!TICKER_RE.test(eventTicker)) notFound();

  let event: KalshiEvent;
  let receivedAt: string;
  try {
    ({ event, receivedAt } = await fetchKalshiEvent(eventTicker));
  } catch (e) {
    if (e instanceof KalshiError && e.status === 404) notFound();
    return (
      <div className="flex flex-col gap-4">
        <Back />
        <div role="alert" className="rounded-2xl p-6 text-sm text-rose-400" style={{ background: 'rgba(244,63,94,0.07)', border: '1px solid rgba(244,63,94,0.2)' }}>
          Kalshi event data is temporarily unavailable. Please try again shortly.
        </div>
      </div>
    );
  }

  // Bounded child page only (never with_nested_markets); its failure must not hide the verified metadata.
  let initial: KalshiMarketsPage | null = null;
  let initialError: string | null = null;
  try {
    initial = await fetchKalshiMarkets({ limit: CHILD_LIMIT, eventTicker: event.eventTicker });
  } catch {
    initialError = 'Open markets for this event could not be loaded right now.';
  }

  const seriesHref = `${EVENTS_HREF}&series=${encodeURIComponent(event.seriesTicker)}`;
  return (
    <div className="flex flex-col gap-5">
      <Back />
      <header className="rounded-2xl p-5" style={panel}>
        <p className="text-xs uppercase tracking-widest text-ink/55">Kalshi event · read-only</p>
        <h1 className="mt-1 text-xl font-black text-ink sm:text-2xl">{event.title}</h1>
        {event.subTitle && <p className="mt-1 text-sm text-ink/55">{event.subTitle}</p>}
        <p className="mt-1 font-mono text-xs text-ink/55 break-all">{event.eventTicker}</p>
      </header>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Event metadata">
        <Field label="Category">{event.category ?? 'Unavailable'}</Field>
        <Field label="Series"><Link href={seriesHref} className="font-mono underline-offset-2 hover:underline">{event.seriesTicker}</Link></Field>
        <Field label="Strike date">{formatUtc(event.strikeDate)}</Field>
        <Field label="Mutually exclusive">{mutualLabel(event.mutuallyExclusive)}</Field>
      </dl>
      <p className="text-xs text-ink/55">
        Mutually exclusive is shown as published by Kalshi; it is not verified here. Event record updated {formatUtc(event.updatedTime)}.
        Metadata retrieved {formatUtc(receivedAt)} (retrieval time only).
      </p>

      <KalshiMarketsClient key={event.eventTicker} initial={initial} initialError={initialError} eventTicker={event.eventTicker} />
    </div>
  );
}
