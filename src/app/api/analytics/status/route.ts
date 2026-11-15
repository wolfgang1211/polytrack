import { NextRequest, NextResponse } from 'next/server';
import { ANALYTICS_HEADERS, localAnalyticsEnabled } from '@/lib/analyticsTransport';

export const runtime = 'nodejs';
export async function GET(req: NextRequest) {
  // Configuration flag only. Does not expose paths, credentials or counts.
  return NextResponse.json({ enabled: localAnalyticsEnabled(req), scope: 'local-qa' }, { headers: ANALYTICS_HEADERS });
}
