import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { readLpSnapshots } from '@/lib/lpSnapshots';
import { scanRewardFarms } from '@/lib/rewards';
import { kvEnabled } from '@/lib/kv';

/* LP Backtester (LH-9) — "what would I have earned?"
 *
 * Replays the recorded lpSnapshots series (liquidity / spread / daily pool
 * every ~10 min) and simulates a fixed-capital passive quoter in each reward
 * farm: for every observed interval the quoter earns
 *
 *    share × dailyRate × dt,  share = capital / (max(liq, FLOOR) + capital)
 *
 * — the same share model the live Reward Simulator and Vacancy Radar use, so
 * numbers are comparable across the Hub. Only OBSERVED windows are credited:
 * snapshot gaps longer than GAP_CAP are clipped, and per-market coverage is
 * reported so thin history is visible instead of silently extrapolated.
 */

export interface BacktestPoint { t: number; v: number }  // ts(ms), cumulative USD

export interface BacktestResult {
  conditionId: string;
  question: string | null;
  slug: string | null;
  eventSlug?: string;
  image?: string;
  active: boolean;          // still an active reward farm right now
  resolved: boolean | null; // market closed/resolved per gamma (null = unknown)
  earned: number;           // USD earned over covered windows
  effApr: number;           // annualised return on capital over covered time (%)
  coverageHours: number;    // observed (credited) hours
  coveragePct: number;      // credited time / requested window
  avgLiquidity: number;     // time-weighted
  avgSpread: number;        // time-weighted (fraction)
  avgDailyRate: number;     // time-weighted USD/day pool
  avgShare: number;         // time-weighted pool share (fraction)
  series?: BacktestPoint[]; // cumulative earnings curve (top results only)
}

export interface BacktestResponse {
  enabled: boolean;
  capital: number;
  hours: number;
  snapshots: number;        // snapshots inside the window
  historyHours: number;     // actual span of available history in the window
  results: BacktestResult[];
}

const COMPETING_FLOOR = 10_000;    // matches rewards.ts / vacancy route
const GAP_CAP_MS = 3 * 3_600_000;  // don't credit unobserved gaps beyond 3h
const MAX_RESULTS = 20;
const SERIES_FOR_TOP = 10;
const MAX_SERIES_POINTS = 60;

interface Agg {
  earned: number;
  coveredMs: number;
  liqW: number;     // Σ liq·dt
  spreadW: number;  // Σ spread·dt
  rateW: number;    // Σ rate·dt
  shareW: number;   // Σ share·dt
  series: BacktestPoint[];
}

function downsample(points: BacktestPoint[], max: number): BacktestPoint[] {
  if (points.length <= max) return points;
  const step = Math.ceil(points.length / max);
  const out: BacktestPoint[] = [];
  for (let i = 0; i < points.length; i += step) out.push(points[i]);
  const last = points[points.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

const G_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Accept: 'application/json',
};

interface GammaMarketInfo {
  question: string | null;
  slug: string | null;
  eventSlug?: string;
  image?: string;
  closed: boolean | null;
}

/** Resolve condition ids → market metadata via gamma-api. Snapshots only
 * store condition ids; markets that dropped out of the live farm scan
 * (ended pools, resolved markets, or simply outside the top-400 window)
 * still need human-readable titles. */
async function resolveConditionIds(ids: string[]): Promise<Map<string, GammaMarketInfo>> {
  const out = new Map<string, GammaMarketInfo>();
  await Promise.all(ids.map(async (id) => {
    try {
      const res = await fetch(
        `https://gamma-api.polymarket.com/markets?condition_ids=${id}`,
        { headers: G_HEADERS, next: { revalidate: 21600 } }
      );
      if (!res.ok) return;
      const json = await res.json();
      const m = (Array.isArray(json) ? json[0] : (json?.value ?? json?.markets ?? [])[0]) as
        Record<string, unknown> | undefined;
      if (!m) return;
      const eventSlug = typeof m.eventSlug === 'string'
        ? m.eventSlug
        : (Array.isArray(m.events) && m.events[0]
            ? String((m.events[0] as Record<string, unknown>).slug ?? '') || undefined
            : undefined);
      out.set(id, {
        question: typeof m.question === 'string' ? m.question : null,
        slug: typeof m.slug === 'string' ? m.slug : null,
        eventSlug,
        image: typeof m.image === 'string' ? m.image : (typeof m.icon === 'string' ? m.icon : undefined),
        closed: typeof m.closed === 'boolean' ? m.closed : null,
      });
    } catch { /* gamma failed — CLOB fallback below */ }

    // Fallback: the CLOB API knows markets gamma no longer serves.
    if (!out.has(id)) {
      try {
        const res = await fetch(`https://clob.polymarket.com/markets/${id}`,
          { headers: G_HEADERS, next: { revalidate: 21600 } });
        if (!res.ok) return;
        const m = (await res.json()) as Record<string, unknown>;
        if (typeof m?.question !== 'string') return;
        out.set(id, {
          question: m.question,
          slug: typeof m.market_slug === 'string' ? m.market_slug : null,
          eventSlug: undefined,
          image: typeof m.icon === 'string' ? m.icon : undefined,
          closed: typeof m.closed === 'boolean' ? m.closed : null,
        });
      } catch { /* unresolved — UI falls back to the condition id */ }
    }
  }));
  return out;
}

export async function GET(req: NextRequest) {
  if (!kvEnabled) {
    return NextResponse.json({ enabled: false, capital: 0, hours: 0, snapshots: 0, historyHours: 0, results: [] } satisfies BacktestResponse);
  }

  const sp = req.nextUrl.searchParams;
  const capital = Math.min(1_000_000, Math.max(1, Number(sp.get('capital')) || 1_000));
  const hours = Math.min(24 * 14, Math.max(1, Number(sp.get('hours')) || 168));

  try {
    const [snapshotsNewestFirst, { farms }] = await Promise.all([
      readLpSnapshots(1000),
      scanRewardFarms().catch(() => ({ farms: [], scanned: 0 })),
    ]);

    const cutoff = Date.now() - hours * 3_600_000;
    const snaps = snapshotsNewestFirst
      .filter(s => s.ts >= cutoff)
      .sort((a, b) => a.ts - b.ts); // oldest first

    if (snaps.length < 2) {
      return NextResponse.json({
        enabled: true, capital, hours,
        snapshots: snaps.length,
        historyHours: snaps.length ? (Date.now() - snaps[0].ts) / 3_600_000 : 0,
        results: [],
      } satisfies BacktestResponse);
    }

    // Replay: credit each market present in snapshot i over [ts_i, ts_i+1).
    const byMarket = new Map<string, Agg>();
    for (let i = 0; i < snaps.length - 1; i++) {
      const dt = Math.min(snaps[i + 1].ts - snaps[i].ts, GAP_CAP_MS);
      if (dt <= 0) continue;
      for (const m of snaps[i].markets) {
        if (m.rate <= 0) continue;
        const share = capital / (Math.max(m.liq, COMPETING_FLOOR) + capital);
        const gain = share * m.rate * (dt / 86_400_000);

        const agg = byMarket.get(m.id) ?? {
          earned: 0, coveredMs: 0, liqW: 0, spreadW: 0, rateW: 0, shareW: 0, series: [],
        };
        agg.earned += gain;
        agg.coveredMs += dt;
        agg.liqW += m.liq * dt;
        agg.spreadW += m.spread * dt;
        agg.rateW += m.rate * dt;
        agg.shareW += share * dt;
        agg.series.push({ t: snaps[i + 1].ts, v: r2(agg.earned) });
        byMarket.set(m.id, agg);
      }
    }

    const farmById = new Map(farms.map(f => [f.conditionId, f]));

    const results: BacktestResult[] = [...byMarket.entries()]
      .map(([id, a]) => {
        const covH = a.coveredMs / 3_600_000;
        const farm = farmById.get(id);
        return {
          conditionId: id,
          question: farm?.question ?? null,
          slug: farm?.slug ?? null,
          eventSlug: farm?.eventSlug,
          image: farm?.image,
          active: Boolean(farm),
          resolved: farm ? false : null, // unknowns filled from gamma below
          earned: r2(a.earned),
          effApr: covH > 0 ? r2((a.earned / capital) * (8_760 / covH) * 100) : 0,
          coverageHours: r2(covH),
          coveragePct: r2(Math.min(100, (covH / hours) * 100)),
          avgLiquidity: a.coveredMs > 0 ? Math.round(a.liqW / a.coveredMs) : 0,
          avgSpread: a.coveredMs > 0 ? r2(a.spreadW / a.coveredMs * 1000) / 1000 : 0,
          avgDailyRate: a.coveredMs > 0 ? r2(a.rateW / a.coveredMs) : 0,
          avgShare: a.coveredMs > 0 ? Math.round(a.shareW / a.coveredMs * 1e6) / 1e6 : 0,
          series: a.series, // trimmed below
        };
      })
      .sort((a, b) => b.earned - a.earned)
      .slice(0, MAX_RESULTS);

    results.forEach((res, i) => {
      if (i < SERIES_FOR_TOP && res.series) res.series = downsample(res.series, MAX_SERIES_POINTS);
      else delete res.series;
    });

    // Fill in titles for markets missing from the live farm scan.
    const unknown = results.filter(r => r.question == null).map(r => r.conditionId);
    if (unknown.length) {
      const meta = await resolveConditionIds(unknown);
      for (const res of results) {
        const m = meta.get(res.conditionId);
        if (!m) continue;
        res.question = m.question;
        res.slug = res.slug ?? m.slug;
        res.eventSlug = res.eventSlug ?? m.eventSlug;
        res.image = res.image ?? m.image;
        res.resolved = m.closed;
      }
    }

    const body: BacktestResponse = {
      enabled: true,
      capital,
      hours,
      snapshots: snaps.length,
      historyHours: r2((snaps[snaps.length - 1].ts - snaps[0].ts) / 3_600_000),
      results,
    };

    return NextResponse.json(body, {
      headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200' },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
