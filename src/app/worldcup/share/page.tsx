import type { Metadata } from 'next';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const SITE_URL = 'https://www.alphaboard.xyz';
const SHARE_CARD_VERSION = '20260612b';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type ShareType = 'upset' | 'whale' | 'match';

function cleanParam(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function normalizeType(value: string | undefined): ShareType {
  return value === 'whale' || value === 'match' || value === 'upset' ? value : 'upset';
}

function cleanEvent(value: string | undefined): string | undefined {
  return value && /^[a-z0-9-]+$/i.test(value) ? value : undefined;
}

function cardImagePath(type: ShareType, event?: string): string {
  const params = new URLSearchParams({ type, v: SHARE_CARD_VERSION });
  if (type === 'match' && event) params.set('event', event);
  return `/worldcup/card?${params.toString()}`;
}

function sharePath(type: ShareType, event?: string): string {
  const params = new URLSearchParams({ type, v: SHARE_CARD_VERSION });
  if (type === 'match' && event) params.set('event', event);
  return `/worldcup/share?${params.toString()}`;
}

function titleFor(type: ShareType): string {
  if (type === 'whale') return 'World Cup Whale Flow — AlphaBoard';
  if (type === 'match') return 'World Cup Live Match Odds — AlphaBoard';
  return 'World Cup Upset Radar — AlphaBoard';
}

function descriptionFor(type: ShareType): string {
  if (type === 'whale') return 'Live World Cup money-flow signal from AlphaBoard.';
  if (type === 'match') return 'Market-implied World Cup match odds, rendered as a live AlphaBoard card.';
  return 'The biggest 24h World Cup odds swing, rendered as a live AlphaBoard card.';
}

function tweetTextFor(type: ShareType): string {
  if (type === 'whale') return '🐋 World Cup whale flow — live money moves on AlphaBoard';
  if (type === 'match') return 'World Cup live match odds on AlphaBoard';
  return '📡 World Cup upset radar — biggest 24h odds swing on AlphaBoard';
}

function xIntentUrl(text: string, url: string): string {
  return `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
}

async function getShareParams(searchParams: SearchParams) {
  const sp = await searchParams;
  const type = normalizeType(cleanParam(sp.type));
  const event = cleanEvent(cleanParam(sp.event));
  return { type, event };
}

export async function generateMetadata(
  { searchParams }: { searchParams: SearchParams }
): Promise<Metadata> {
  const { type, event } = await getShareParams(searchParams);
  const title = titleFor(type);
  const description = descriptionFor(type);
  const path = sharePath(type, event);
  const imageUrl = `${SITE_URL}${cardImagePath(type, event)}`;
  const shareUrl = `${SITE_URL}${path}`;

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      siteName: 'AlphaBoard',
      title,
      description,
      url: shareUrl,
      images: [{ url: imageUrl, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      site: '@alphaboardxyz',
      creator: '@alphaboardxyz',
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function WorldCupSharePage(
  { searchParams }: { searchParams: SearchParams }
) {
  const { type, event } = await getShareParams(searchParams);
  const title = titleFor(type);
  const description = descriptionFor(type);
  const imagePath = cardImagePath(type, event);
  const shareUrl = `${SITE_URL}${sharePath(type, event)}`;
  const intent = xIntentUrl(tweetTextFor(type), shareUrl);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 py-8">
      <div className="rounded-3xl p-5"
        style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">Shareable World Cup card</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-white">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-white/45">{description}</p>
      </div>

      <div className="overflow-hidden rounded-3xl"
        style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(168,85,247,0.30)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imagePath} alt={title} className="w-full" />
      </div>

      <div className="flex flex-wrap gap-2">
        <a href={intent} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-2xl px-4 py-2 text-sm font-black text-white transition-all hover:-translate-y-0.5"
          style={{ background: 'rgba(124,58,237,0.20)', border: '1px solid rgba(168,85,247,0.38)' }}>
          Open X composer
        </a>
        <a href={imagePath} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-2xl px-4 py-2 text-sm font-bold text-white/55 transition-colors hover:text-white/85"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)' }}>
          Open image
        </a>
        <Link href="/worldcup#upset-radar"
          className="inline-flex items-center justify-center rounded-2xl px-4 py-2 text-sm font-bold text-white/45 transition-colors hover:text-white/75"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          Back to World Cup
        </Link>
      </div>
    </div>
  );
}
