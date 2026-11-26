import { getKalshiJson, kalshiErrorResponse, normalizeOrderbook, type KalshiOrderbook } from '@/lib/kalshi';
import { readKalshiRewards } from '@/lib/kalshiRewardsCache';
import { buildKalshiOpportunity } from '@/lib/kalshiOpportunities';

// Kalshi LP opportunity cards: reward-program candidates (cached scan) + live order books, scored like Polymarket's.
export const maxDuration = 60;
const BOOK_CONCURRENCY = 4;

export async function GET() {
  try {
    const { candidates } = await readKalshiRewards();
    const books = new Map<string, KalshiOrderbook>();
    let i = 0;
    const worker = async () => {
      while (i < candidates.length) {
        const t = candidates[i++].ticker;
        try { books.set(t, normalizeOrderbook(await getKalshiJson(`/markets/${encodeURIComponent(t)}/orderbook`))); } catch { /* card falls back to top of book */ }
      }
    };
    await Promise.all(Array.from({ length: Math.min(BOOK_CONCURRENCY, candidates.length) }, worker));
    const opportunities = candidates.map(f => buildKalshiOpportunity(f, books.get(f.ticker) ?? null)).sort((a, b) => b.score - a.score);
    return Response.json({ opportunities, updatedAt: Date.now() }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } });
  } catch (e) {
    return kalshiErrorResponse(e);
  }
}
