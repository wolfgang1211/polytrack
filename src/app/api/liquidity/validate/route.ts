import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { fetchMakerGraphFills, type GraphFill } from '@/lib/graphFills';
import { readLpSnapshots } from '@/lib/lpSnapshots';
import { kvEnabled } from '@/lib/kv';

/* Model Validation bridge (LH-C) — does the backtest model line up with what
 * a real LP wallet actually did?
 *
 * Two series, same window, side by side:
 *   REAL — the wallet's maker-fill spread capture (LH-8 replay: cost-basis
 *          over maker fills only), restricted to the requested window.
 *   SIM  — the LH-9 snapshot replay (share × dailyRate × dt with the same
 *          $10K competing floor and 3h gap cap), restricted to the markets
 *          the wallet actually quoted.
 *
 * These measure DIFFERENT income components (spread capture vs reward pool),
 * so the point is not sim == real. The bridge answers: are the markets the
 * model credits the same markets where the wallet actually made money, how
 * much of the wallet's activity does the snapshot history even cover, and
 * are the magnitudes in the same ballpark?
 */

export interface ValidateMarketRow {
  conditionId: string | null;   // null if gamma couldn't resolve the token
  question: string | null;
  outcome: string | null;
  tokenIds: string[];           // clob token ids the wallet traded in this market
  realRealized: number;         // wallet's realized spread P&L in-window (USD)
  realVolume: number;           // wallet's maker volume in-window (USD)
  realFills: number;
  simEarned: number | null;     // null = snapshots never saw this market
  simCoverageHours: number;
  simCoveragePct: number;       // vs the effective window
  simAvgShare: number;          // time-weighted pool share (fraction)
}

export interface ValidateResponse {
  enabled: boolean;             // KV + Graph key both configured
  address: string;
  capital: number;
  hours: number;
  windowStart: number | null;   // effective comparison window start (ms)
  snapshots: number;            // snapshots inside the window
  historyHours: number;
  real: { realized: number; makerVolume: number; fills: number; markets: number };
  sim: { earned: number; marketsCovered: number };
  matchedVolumePct: number;     // % of real maker volume in snapshot-covered markets
  ratio: number | null;         // sim.earned / real.realized (only when real > 0)
  rows: ValidateMarketRow[];
  error?: string;
}

const COMPETING_FLOOR = 10_000;   // matches backtest / rewards.ts
const GAP_CAP_MS = 3 * 3_600_000; // matches backtest
const MAX_TOKENS_RESOLVED = 40;   // gamma lookups per request
const MAX_ROWS = 25;

const r2 = (n: number) => Math.round(n * 100) / 100;

const G_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Accept: 'application/json',
};

interface TokenMeta { conditionId: string | null; question: string | null; outcome: string | null }

/** Resolve clob token ids → { conditionId, question, outcome } via gamma-api.
 * Same endpoint the LP earnings route uses, but we also need conditionId to
 * join real fills against the snapshot series. */
async function resolveTokens(ids: string[]): Promise<Map<string, TokenMeta>> {
  const out = new Map<string, TokenMeta>();
  await Promise.all(ids.map(async (id) => {
    try {
      const res = await fetch(
        `https://gamma-api.polymarket.com/markets?clob_token_ids=${id}`,
        { headers: G_HEADERS, next: { revalidate: 86400 } }
      );
      if (!res.ok) return;
      const json = await res.json();
      const m = (Array.isArray(json) ? json[0] : (json?.value ?? json?.markets ?? [])[0]) as
        Record<string, unknown> | undefined;
      if (!m) return;

      let outcome: string | null = null;
      try {
        const tokenIds: string[] = Array.isArray(m.clobTokenIds)
          ? (m.clobTokenIds as string[])
          : JSON.parse(String(m.clobTokenIds ?? '[]'));
        const outcomes: string[] = Array.isArray(m.outcomes)
          ? (m.outcomes as string[])
          : JSON.parse(String(m.outcomes ?? '[]'));
        const idx = tokenIds.findIndex(t => String(t) === id);
        if (idx >= 0 && outcomes[idx]) outcome = String(outcomes[idx]);
      } catch { /* leave outcome null */ }

      out.set(id, {
        conditionId: typeof m.conditionId === 'string' ? m.conditionId : null,
        question: typeof m.question === 'string' ? m.question : null,
        outcome,
      });
    } catch { /* unresolved — row keeps the raw token id */ }
  }));
  return out;
}

interface RealAgg { realized: number; volume: number; fills: number; shares: number; cost: number }

/** LH-8 cost-basis replay over maker fills, per token, window-filtered.
 * Fills BEFORE the window still build inventory (so in-window sells get the
 * right cost basis) but only in-window activity is counted as volume/P&L. */
function replayReal(fills: GraphFill[], windowStartMs: number) {
  const sorted = fills.slice().sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
  const byToken = new Map<string, RealAgg>();

  for (const f of sorted) {
    const token = f.market.id;
    const tsMs = Number(f.timestamp) * 1000;
    const shares = Number(f.size) / 1e6;
    const usd = shares * Number(f.price);
    if (!token || !tsMs || shares <= 0) continue;

    const inWindow = tsMs >= windowStartMs;
    const makerIsBuying = f.side !== 'Buy'; // side is taker-perspective

    const agg = byToken.get(token) ?? { realized: 0, volume: 0, fills: 0, shares: 0, cost: 0 };

    if (makerIsBuying) {
      agg.shares += shares;
      agg.cost += usd;
    } else {
      const sellShares = Math.min(shares, agg.shares);
      const avgCost = agg.shares > 0 ? agg.cost / agg.shares : 0;
      const gain = sellShares * (Number(f.price) - avgCost);
      if (inWindow) agg.realized += gain;
      agg.shares -= sellShares;
      agg.cost -= avgCost * sellShares;
      if (agg.shares < 1e-9) { agg.shares = 0; agg.cost = 0; }
    }

    if (inWindow) { agg.volume += usd; agg.fills += 1; }
    byToken.set(token, agg);
  }

  // Drop tokens with no in-window activity.
  for (const [token, agg] of byToken) {
    if (agg.fills === 0) byToken.delete(token);
  }
  return byToken;
}

interface SimAgg { earned: number; coveredMs: number; shareW: number }

/** LH-9 snapshot replay, restricted to a set of condition ids. */
function replaySim(
  snaps: Array<{ ts: number; markets: Array<{ id: string; liq: number; rate: number }> }>,
  wanted: Set<string>,
  capital: number,
) {
  const byMarket = new Map<string, SimAgg>();
  for (let i = 0; i < snaps.length - 1; i++) {
    const dt = Math.min(snaps[i + 1].ts - snaps[i].ts, GAP_CAP_MS);
    if (dt <= 0) continue;
    for (const m of snaps[i].markets) {
      if (!wanted.has(m.id) || m.rate <= 0) continue;
      const share = capital / (Math.max(m.liq, COMPETING_FLOOR) + capital);
      const agg = byMarket.get(m.id) ?? { earned: 0, coveredMs: 0, shareW: 0 };
      agg.earned += share * m.rate * (dt / 86_400_000);
      agg.coveredMs += dt;
      agg.shareW += share * dt;
      byMarket.set(m.id, agg);
    }
  }
  return byMarket;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const address = (sp.get('address') ?? '').trim().toLowerCase();
  const capital = Math.min(1_000_000, Math.max(1, Number(sp.get('capital')) || 1_000));
  const hours = Math.min(24 * 14, Math.max(1, Number(sp.get('hours')) || 168));
  const apiKey = process.env.GRAPH_API_KEY;

  const empty = (error?: string): ValidateResponse => ({
    enabled: Boolean(kvEnabled && apiKey),
    address, capital, hours,
    windowStart: null, snapshots: 0, historyHours: 0,
    real: { realized: 0, makerVolume: 0, fills: 0, markets: 0 },
    sim: { earned: 0, marketsCovered: 0 },
    matchedVolumePct: 0, ratio: null, rows: [],
    ...(error ? { error } : {}),
  });

  if (!kvEnabled || !apiKey) return NextResponse.json(empty());
  if (!/^0x[0-9a-f]{40}$/.test(address)) {
    return NextResponse.json(empty('Provide a valid wallet address (?address=0x…)'), { status: 200 });
  }

  try {
    const [fills, snapshotsNewestFirst] = await Promise.all([
      fetchMakerGraphFills(address, apiKey),
      readLpSnapshots(1000),
    ]);

    const cutoff = Date.now() - hours * 3_600_000;
    const snaps = snapshotsNewestFirst
      .filter(s => s.ts >= cutoff)
      .sort((a, b) => a.ts - b.ts);

    // Compare only where BOTH series can exist: window starts at the later of
    // the requested cutoff and the first available snapshot.
    const windowStart = snaps.length ? Math.max(cutoff, snaps[0].ts) : cutoff;

    const realByToken = replayReal(fills, windowStart);

    if (realByToken.size === 0) {
      const body = empty();
      body.windowStart = windowStart;
      body.snapshots = snaps.length;
      body.historyHours = snaps.length >= 2 ? r2((snaps[snaps.length - 1].ts - snaps[0].ts) / 3_600_000) : 0;
      body.error = 'No maker fills for this wallet inside the comparison window';
      return NextResponse.json(body, {
        headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200' },
      });
    }

    // Resolve the wallet's most active tokens → condition ids.
    const rankedTokens = [...realByToken.entries()]
      .sort((a, b) => b[1].volume - a[1].volume)
      .slice(0, MAX_TOKENS_RESOLVED);
    const meta = await resolveTokens(rankedTokens.map(([id]) => id));

    // Group tokens into markets (condition ids). Unresolved tokens each
    // become their own row keyed by token id so nothing silently vanishes.
    interface MarketGroup {
      conditionId: string | null; question: string | null; outcome: string | null;
      tokenIds: string[]; realized: number; volume: number; fills: number;
    }
    const groups = new Map<string, MarketGroup>();
    for (const [token, agg] of rankedTokens) {
      const m = meta.get(token);
      const key = m?.conditionId ?? `token:${token}`;
      const g = groups.get(key) ?? {
        conditionId: m?.conditionId ?? null,
        question: m?.question ?? null,
        outcome: m?.outcome ?? null,
        tokenIds: [], realized: 0, volume: 0, fills: 0,
      };
      g.tokenIds.push(token);
      g.realized += agg.realized;
      g.volume += agg.volume;
      g.fills += agg.fills;
      if (g.tokenIds.length > 1) g.outcome = null; // both sides quoted — outcome label is noise
      groups.set(key, g);
    }

    // Sim replay over exactly the wallet's markets.
    const wanted = new Set([...groups.values()].map(g => g.conditionId).filter((x): x is string => Boolean(x)));
    const simByMarket = snaps.length >= 2 ? replaySim(snaps, wanted, capital) : new Map<string, SimAgg>();

    const effWindowMs = Math.max(1, Date.now() - windowStart);

    const rows: ValidateMarketRow[] = [...groups.values()]
      .sort((a, b) => b.volume - a.volume)
      .slice(0, MAX_ROWS)
      .map(g => {
        const sim = g.conditionId ? simByMarket.get(g.conditionId) : undefined;
        return {
          conditionId: g.conditionId,
          question: g.question,
          outcome: g.outcome,
          tokenIds: g.tokenIds,
          realRealized: r2(g.realized),
          realVolume: r2(g.volume),
          realFills: g.fills,
          simEarned: sim ? r2(sim.earned) : null,
          simCoverageHours: sim ? r2(sim.coveredMs / 3_600_000) : 0,
          simCoveragePct: sim ? r2(Math.min(100, (sim.coveredMs / effWindowMs) * 100)) : 0,
          simAvgShare: sim && sim.coveredMs > 0 ? Math.round(sim.shareW / sim.coveredMs * 1e6) / 1e6 : 0,
        };
      });

    let realRealized = 0, realVolume = 0, realFills = 0;
    for (const g of groups.values()) {
      realRealized += g.realized; realVolume += g.volume; realFills += g.fills;
    }
    let simEarned = 0;
    for (const s of simByMarket.values()) simEarned += s.earned;

    const matchedVolume = [...groups.values()]
      .filter(g => g.conditionId && simByMarket.has(g.conditionId))
      .reduce((s, g) => s + g.volume, 0);

    const body: ValidateResponse = {
      enabled: true,
      address, capital, hours,
      windowStart,
      snapshots: snaps.length,
      historyHours: snaps.length >= 2 ? r2((snaps[snaps.length - 1].ts - snaps[0].ts) / 3_600_000) : 0,
      real: { realized: r2(realRealized), makerVolume: r2(realVolume), fills: realFills, markets: groups.size },
      sim: { earned: r2(simEarned), marketsCovered: simByMarket.size },
      matchedVolumePct: realVolume > 0 ? r2((matchedVolume / realVolume) * 100) : 0,
      ratio: realRealized > 0.01 && simEarned > 0 ? r2(simEarned / realRealized) : null,
      rows,
    };

    return NextResponse.json(body, {
      headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200' },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
