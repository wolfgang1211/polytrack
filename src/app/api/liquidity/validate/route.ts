import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { fetchRecentMakerFills, type MakerFill } from '@/lib/dataApiFills';
import { readLpSnapshots } from '@/lib/lpSnapshots';
import { kvEnabled } from '@/lib/kv';

/* Model Validation bridge (LH-C) — does the backtest model line up with what
 * a real LP wallet actually did?
 *
 * Two series, same window, side by side:
 *   REAL — the wallet's maker-fill spread capture (LH-8-style cost-basis
 *          replay over maker fills), restricted to the requested window.
 *          Fills come from the Polymarket data-api (LH-C.1): the orderbook
 *          subgraph stopped indexing ~2026-04-25, so windowed queries there
 *          return nothing for every wallet.
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
  conditionId: string | null;
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
  enabled: boolean;             // KV snapshot store configured
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
const MAX_ROWS = 25;

const r2 = (n: number) => Math.round(n * 100) / 100;

interface TokenAgg { realized: number; volume: number; fills: number; shares: number; cost: number }

/** LH-8-style cost-basis replay over maker fills, per token. Fills are
 * window-scoped at fetch time, so realized P&L here is the spread captured
 * on round-trips completed INSIDE the window; sells of inventory acquired
 * before the window aren't credited (consistent with LH-8, which also only
 * counts round-tripped maker inventory). */
function replayReal(fills: MakerFill[]) {
  const byToken = new Map<string, TokenAgg>();

  for (const f of fills) {
    const usd = f.shares * f.price;
    // takerSide is the taker's direction — the maker did the opposite.
    const makerIsBuying = f.takerSide !== 'BUY';

    const agg = byToken.get(f.tokenId) ?? { realized: 0, volume: 0, fills: 0, shares: 0, cost: 0 };

    if (makerIsBuying) {
      agg.shares += f.shares;
      agg.cost += usd;
    } else {
      const sellShares = Math.min(f.shares, agg.shares);
      const avgCost = agg.shares > 0 ? agg.cost / agg.shares : 0;
      agg.realized += sellShares * (f.price - avgCost);
      agg.shares -= sellShares;
      agg.cost -= avgCost * sellShares;
      if (agg.shares < 1e-9) { agg.shares = 0; agg.cost = 0; }
    }

    agg.volume += usd;
    agg.fills += 1;
    byToken.set(f.tokenId, agg);
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

  const empty = (error?: string): ValidateResponse => ({
    enabled: kvEnabled,
    address, capital, hours,
    windowStart: null, snapshots: 0, historyHours: 0,
    real: { realized: 0, makerVolume: 0, fills: 0, markets: 0 },
    sim: { earned: 0, marketsCovered: 0 },
    matchedVolumePct: 0, ratio: null, rows: [],
    ...(error ? { error } : {}),
  });

  if (!kvEnabled) return NextResponse.json(empty());
  if (!/^0x[0-9a-f]{40}$/.test(address)) {
    return NextResponse.json(empty('Provide a valid wallet address (?address=0x…)'), { status: 200 });
  }

  try {
    const cutoff = Date.now() - hours * 3_600_000;
    const snapshotsNewestFirst = await readLpSnapshots(1100);
    const snaps = snapshotsNewestFirst
      .filter(s => s.ts >= cutoff)
      .sort((a, b) => a.ts - b.ts);

    // Compare only where BOTH series can exist: window starts at the later of
    // the requested cutoff and the first available snapshot.
    const windowStart = snaps.length ? Math.max(cutoff, snaps[0].ts) : cutoff;
    const historyHours = snaps.length >= 2
      ? r2((snaps[snaps.length - 1].ts - snaps[0].ts) / 3_600_000)
      : 0;

    const fillsRes = await fetchRecentMakerFills(address, Math.floor(windowStart / 1000));
    const fills = fillsRes?.fills ?? null;

    if (fills === null) {
      const body = empty('Fill feed (data-api) unreachable — try again shortly');
      body.windowStart = windowStart;
      body.snapshots = snaps.length;
      body.historyHours = historyHours;
      return NextResponse.json(body, { status: 200 });
    }

    if (fills.length === 0) {
      const body = empty('No maker fills for this wallet inside the comparison window');
      body.windowStart = windowStart;
      body.snapshots = snaps.length;
      body.historyHours = historyHours;
      return NextResponse.json(body, {
        headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200' },
      });
    }

    const realByToken = replayReal(fills);

    // Group tokens into markets — data-api gives conditionId per fill.
    interface MarketGroup {
      conditionId: string; question: string | null; outcomes: Set<string>;
      tokenIds: Set<string>; realized: number; volume: number; fills: number;
    }
    const tokenMeta = new Map<string, { conditionId: string; title: string | null; outcome: string | null }>();
    for (const f of fills) {
      if (!tokenMeta.has(f.tokenId)) {
        tokenMeta.set(f.tokenId, { conditionId: f.conditionId, title: f.title, outcome: f.outcome });
      }
    }

    const groups = new Map<string, MarketGroup>();
    for (const [tokenId, agg] of realByToken) {
      const meta = tokenMeta.get(tokenId);
      if (!meta) continue;
      const g = groups.get(meta.conditionId) ?? {
        conditionId: meta.conditionId,
        question: meta.title,
        outcomes: new Set<string>(),
        tokenIds: new Set<string>(),
        realized: 0, volume: 0, fills: 0,
      };
      g.question = g.question ?? meta.title;
      if (meta.outcome) g.outcomes.add(meta.outcome);
      g.tokenIds.add(tokenId);
      g.realized += agg.realized;
      g.volume += agg.volume;
      g.fills += agg.fills;
      groups.set(meta.conditionId, g);
    }

    // Sim replay over exactly the wallet's markets.
    const wanted = new Set(groups.keys());
    const simByMarket = snaps.length >= 2 ? replaySim(snaps, wanted, capital) : new Map<string, SimAgg>();

    const effWindowMs = Math.max(1, Date.now() - windowStart);

    const rows: ValidateMarketRow[] = [...groups.values()]
      .sort((a, b) => b.volume - a.volume)
      .slice(0, MAX_ROWS)
      .map(g => {
        const sim = simByMarket.get(g.conditionId);
        return {
          conditionId: g.conditionId,
          question: g.question,
          outcome: g.outcomes.size === 1 ? [...g.outcomes][0] : null,
          tokenIds: [...g.tokenIds],
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
      .filter(g => simByMarket.has(g.conditionId))
      .reduce((s, g) => s + g.volume, 0);

    const body: ValidateResponse = {
      enabled: true,
      address, capital, hours,
      windowStart,
      snapshots: snaps.length,
      historyHours,
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
