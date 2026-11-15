import { NextRequest, NextResponse } from 'next/server';
import { parseOutboundEvent } from '@/lib/outboundAnalytics';
import { parseFunnelEvent } from '@/lib/funnelSchema';
import { ANALYTICS_HEADERS, AnalyticsInputError, analyticsBody, analyticsFailure, analyticsLimited, analyticsRejected, localAnalyticsEnabled, openLocalAnalytics, optedOut, sameAnalyticsOrigin, takeAnalyticsSlot } from '@/lib/analyticsTransport';

export const runtime = 'nodejs';
/** Legacy three-field clicks remain structured logs. A valid page group adds
 * local aggregate storage ONLY when the explicit loopback mode is enabled. */
export async function POST(req: NextRequest) {
  if (!sameAnalyticsOrigin(req)) return analyticsRejected();
  if (optedOut(req)) return new NextResponse(null, { status: 204, headers: ANALYTICS_HEADERS });
  try {
    const raw = await analyticsBody(req);
    const funnel = parseFunnelEvent(raw);
    const payload = funnel?.event === 'polymarket_outbound_click' ? funnel : parseOutboundEvent(raw);
    if (!payload) throw new AnalyticsInputError(400);
    if (!takeAnalyticsSlot()) return analyticsLimited();
    if (funnel?.event === 'polymarket_outbound_click' && localAnalyticsEnabled(req)) {
      const store = openLocalAnalytics(req);
      try { store.record(funnel); } finally { store.close(); }
    }
    console.info('alphaboard_outbound', JSON.stringify(payload));
    return new NextResponse(null, { status: 204, headers: ANALYTICS_HEADERS });
  } catch (error) { return analyticsFailure(error); }
}
