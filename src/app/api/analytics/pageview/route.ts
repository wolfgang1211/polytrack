import { NextRequest, NextResponse } from 'next/server';
import { parseFunnelEvent } from '@/lib/funnelSchema';
import { ANALYTICS_HEADERS, AnalyticsInputError, analyticsBody, analyticsFailure, analyticsLimited, analyticsRejected, openLocalAnalytics, optedOut, sameAnalyticsOrigin, takeAnalyticsSlot } from '@/lib/analyticsTransport';

export const runtime = 'nodejs';
export async function POST(req: NextRequest) {
  if (!sameAnalyticsOrigin(req)) return analyticsRejected();
  if (optedOut(req)) return new NextResponse(null, { status: 204, headers: ANALYTICS_HEADERS });
  try {
    const event = parseFunnelEvent(await analyticsBody(req));
    if (!event || event.event !== 'page_view') throw new AnalyticsInputError(400);
    if (!takeAnalyticsSlot()) return analyticsLimited();
    const store = openLocalAnalytics(req);
    try { store.record(event); } finally { store.close(); }
    return new NextResponse(null, { status: 204, headers: ANALYTICS_HEADERS });
  } catch (error) { return analyticsFailure(error); }
}
