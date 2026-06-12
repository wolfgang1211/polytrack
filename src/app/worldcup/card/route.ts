import type { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const target = new URL('/api/worldcup/card', req.nextUrl.origin);
  req.nextUrl.searchParams.forEach((value, key) => target.searchParams.set(key, value));

  const upstream = await fetch(target.toString(), {
    headers: {
      Accept: 'image/png,*/*',
      'User-Agent': 'Mozilla/5.0 (compatible; AlphaBoardShareCard/1.0)',
    },
    cache: 'no-store',
  });

  const body = await upstream.arrayBuffer();
  return new Response(body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') ?? 'image/png',
      'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=86400',
    },
  });
}
