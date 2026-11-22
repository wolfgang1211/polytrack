import { KalshiError, NO_STORE, kalshiErrorResponse } from '@/lib/kalshi';
import { getCachedKalshiDiscovery } from '@/lib/kalshiDiscoveryCache';

// Read-only, fixed-budget discovery sample. Takes no input at all: any query key is a 400 before the cache or upstream.
// The 20 s process cache is the only reuse layer; no-store keeps CDN/browser from adding their own stale window.
export async function GET(req: Request) {
  try {
    if ([...new URL(req.url).searchParams.keys()].length > 0) throw new KalshiError(400, 'Discovery does not accept query parameters.');
    return Response.json(await getCachedKalshiDiscovery(), { headers: NO_STORE });
  } catch (e) {
    return kalshiErrorResponse(e);
  }
}
