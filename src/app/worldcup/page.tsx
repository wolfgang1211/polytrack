import type { Metadata } from 'next';
import { resolveTeam } from '@/lib/wcTeams';
import { fetchWinnerData, fetchWcEvents } from '@/lib/wcData';
import WorldCupClient from './WorldCupClient';

// Always render per-request: the param-less /worldcup was getting pinned to a
// stale prerendered shell in the ISR cache. Upstream data stays cached 60s
// via fetch revalidate, so this is cheap.
export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata(
  { searchParams }: { searchParams: SearchParams }
): Promise<Metadata> {
  const sp = await searchParams;
  const raw = typeof sp.team === 'string' ? sp.team : undefined;
  const team = raw ? resolveTeam(raw)?.canonical : undefined;
  const matchSlug = typeof sp.match === 'string' && /^[a-z0-9-]+$/i.test(sp.match) ? sp.match : undefined;
  const share = typeof sp.share === 'string' && /^(upset|whale)$/.test(sp.share) ? sp.share : undefined;

  // Upset/whale share links: og:image renders the live data card
  if (share) {
    const ogImage = `/api/worldcup/card?type=${share}`;
    const title = share === 'whale' ? 'World Cup Whale Alert 🐋' : 'World Cup Upset Radar 📡';
    const description = share === 'whale'
      ? 'The biggest World Cup trade on Polymarket right now — live on AlphaBoard.'
      : 'The biggest 24h World Cup odds swing on Polymarket — live on AlphaBoard.';
    return {
      title, description,
      alternates: { canonical: '/worldcup' },
      openGraph: {
        title: `${title} | AlphaBoard`, description,
        url: `/worldcup?share=${share}`,
        images: [{ url: ogImage, width: 1200, height: 630 }],
      },
      twitter: {
        card: 'summary_large_image',
        title: `${title} | AlphaBoard`, description,
        images: [ogImage],
      },
    };
  }

  // Match share links: og:image renders the live match card
  if (matchSlug) {
    const ogImage = `/worldcup/card?type=match&event=${encodeURIComponent(matchSlug)}`;
    const title = 'World Cup 2026 — Live Match Odds';
    const description = 'Market-implied win probabilities, smart money and live odds on AlphaBoard.';
    return {
      title,
      description,
      alternates: { canonical: '/worldcup' },
      openGraph: {
        title: `${title} | AlphaBoard`, description,
        url: `/worldcup?match=${encodeURIComponent(matchSlug)}`,
        images: [{ url: ogImage, width: 1200, height: 630 }],
      },
      twitter: {
        card: 'summary_large_image',
        title: `${title} | AlphaBoard`, description,
        images: [ogImage],
      },
    };
  }

  const title = team
    ? `${team} — World Cup 2026 Odds & Money Flow`
    : 'World Cup 2026 Hub';
  const description = team
    ? `Live Polymarket championship odds, match markets and smart money flow for ${team} at the FIFA World Cup 2026.`
    : 'FIFA World Cup 2026 on Polymarket: live championship odds, match markets, pro trader positions and smart money flow.';
  const ogImage = `/api/worldcup/og${team ? `?team=${encodeURIComponent(team)}` : ''}`;
  const url = team ? `/worldcup?team=${encodeURIComponent(team)}` : '/worldcup';

  return {
    title,
    description,
    alternates: { canonical: '/worldcup' },
    openGraph: {
      title: `${title} | AlphaBoard`,
      description,
      url,
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | AlphaBoard`,
      description,
      images: [ogImage],
    },
  };
}

export default async function WorldCupPage(
  { searchParams }: { searchParams: SearchParams }
) {
  const sp = await searchParams;
  const raw = typeof sp.team === 'string' ? sp.team : undefined;
  const initialTeam = raw ? (resolveTeam(raw)?.canonical ?? null) : null;

  // Server-side data so the page ships with real numbers in the HTML
  // (no empty "—" first paint; good for SEO and link previews too).
  const [initialWinner, initialEvents] = await Promise.all([
    fetchWinnerData(60),
    fetchWcEvents(60),
  ]);

  return (
    <WorldCupClient
      initialTeam={initialTeam}
      initialWinner={initialWinner}
      initialEvents={initialEvents}
    />
  );
}
