import { kalshiRecorderStatus } from '@/lib/kalshiSnapshots';

// Kalshi LP history recorder status: snapshot count and newest/oldest timestamps (no snapshot contents).
export const dynamic = 'force-dynamic';

export async function GET() {
  const s = await kalshiRecorderStatus();
  return Response.json({ ...s, newestIso: s.newestTs ? new Date(s.newestTs).toISOString() : null, oldestIso: s.oldestTs ? new Date(s.oldestTs).toISOString() : null }, { headers: { 'Cache-Control': 'no-store' } });
}
