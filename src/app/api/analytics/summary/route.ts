import { NextRequest, NextResponse } from 'next/server';
import { ANALYTICS_HEADERS, analyticsFailure, analyticsRejected, openLocalAnalytics, sameAnalyticsOrigin } from '@/lib/analyticsTransport';

export const runtime = 'nodejs';
export async function GET(req: NextRequest) {
  if (req.headers.get('sec-fetch-site') === 'cross-site' || (req.headers.has('origin') && !sameAnalyticsOrigin(req))) return analyticsRejected();
  const raw = req.nextUrl.searchParams.get('days') ?? '7';
  if (!/^(?:[1-9]|[12]\d|3[01])$/.test(raw)) return NextResponse.json({ error: 'Choose 1 to 31 days.' }, { status: 400, headers: ANALYTICS_HEADERS });
  try {
    const store = openLocalAnalytics(req);
    try { return NextResponse.json(store.summary(Number(raw)), { headers: ANALYTICS_HEADERS }); }
    finally { store.close(); }
  } catch (error) { return analyticsFailure(error); }
}
