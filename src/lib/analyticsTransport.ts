import { NextRequest, NextResponse } from 'next/server';
import { FunnelStore } from '@/lib/funnelStore';

export const ANALYTICS_HEADERS = { 'Cache-Control': 'no-store' };
const ORIGINS = new Set(['https://www.alphaboard.xyz', 'https://alphaboard.xyz',
  ...['localhost', '127.0.0.1'].flatMap(host => [3000,3016,3017].map(port => `http://${host}:${port}`))]);
export function sameAnalyticsOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  const bound = origin === req.nextUrl.origin
    || (origin === `http://127.0.0.1:${req.nextUrl.port}` && req.nextUrl.origin === `http://localhost:${req.nextUrl.port}`);
  return !!origin && ORIGINS.has(origin) && bound && req.headers.get('sec-fetch-site') !== 'cross-site';
}
export function localAnalyticsEnabled(req: NextRequest): boolean {
  return process.env.ALPHABOARD_ANALYTICS_LOCAL === '1' && !!process.env.ALPHABOARD_ANALYTICS_DIR
    && req.nextUrl.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(req.nextUrl.hostname)
    && ['3000','3016','3017'].includes(req.nextUrl.port);
}
export function openLocalAnalytics(req: NextRequest): FunnelStore {
  if (!localAnalyticsEnabled(req)) throw new Error('Local analytics disabled.');
  return new FunnelStore(process.env.ALPHABOARD_ANALYTICS_DIR!);
}
export function optedOut(req: NextRequest): boolean {
  return req.headers.get('dnt') === '1' || req.headers.get('sec-gpc') === '1';
}
export class AnalyticsInputError extends Error {
  constructor(public status: 400 | 413) { super('Invalid analytics event.'); }
}
export async function analyticsBody(req: NextRequest): Promise<unknown> {
  const reader = req.body?.getReader();
  if (!reader) throw new AnalyticsInputError(400);
  try {
    let size = 0;
    const parts: Uint8Array[] = [];
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 512) { await reader.cancel(); throw new AnalyticsInputError(413); }
      parts.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch (error) {
    if (error instanceof AnalyticsInputError) throw error;
    throw new AnalyticsInputError(400);
  } finally { reader.releaseLock(); }
}
let minute = -1, accepted = 0;
export function takeAnalyticsSlot(): boolean {
  const current = Math.floor(Date.now() / 60_000);
  if (current !== minute) { minute = current; accepted = 0; }
  if (accepted >= 1000) return false;
  accepted++; return true;
}
export const analyticsRejected = () => NextResponse.json({ error: 'Forbidden origin.' }, { status: 403, headers: ANALYTICS_HEADERS });
export const analyticsLimited = () => NextResponse.json({ error: 'Try again later.' }, { status: 429, headers: { ...ANALYTICS_HEADERS, 'Retry-After': '60' } });
export function analyticsFailure(error: unknown) {
  const status = error instanceof AnalyticsInputError ? error.status : 503;
  return NextResponse.json({ error: status === 503 ? 'Local analytics are unavailable. No metrics are estimated.' : 'Invalid analytics event.' }, { status, headers: ANALYTICS_HEADERS });
}
