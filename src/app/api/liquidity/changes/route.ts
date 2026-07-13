import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { readLpSnapshots } from '@/lib/lpSnapshots';
import { scanRewardFarms } from '@/lib/rewards';
import { kvEnabled } from '@/lib/kv';

/* Farm Δ feed — "what changed since yesterday?"
 *
 * Diffs the recorded lpSnapshots series between now and a baseline ~N hours
 * back and surfaces the events an LP acts on: pools opening or ending, reward
 * rates being raised or cut, and competing liquidity flooding in or draining
 * out (a draining pool = your share is about to grow — the Vacancy Radar
 * story, but as a feed). Everything is derived from our own snapshot history,
 * so this page cannot be reconstructed from Polymarket's live API alone.
 */

export type FarmChangeKind = 'new' | 'ended' | 'rate_up' | 'rate_down' | 'liq_out' | 'liq_in';

export interface FarmChange {
  kind: FarmChangeKind;
  conditionId: string;
  question: string | null;
  slug: string | null;
  eventSlug?: string;
  /** rate (USD/day) for new/ended/rate_*, liquidity (USD) for liq_*. */
  before: number;
  after: number;
  pct: number | null;   // signed % change where a baseline exists
  ts: number;           // when the change was observed (ms)
}

export interface ChangesResponse {
  enabled: boolean;
  hours: number;           // requested window
  effectiveHours: number;  // actual distance to the baseline snapshot
  snapshots: number;
  changes: FarmChange[];
  updatedAt: number;       // newest snapshot ts (ms) — render "ago" against this
}

const RATE_MIN_PCT = 0.2;   // report reward-rate moves >= 20%…
const RATE_MIN_ABS = 25;    // …and >= $25/day (skip noise)
const LIQ_MIN_PCT = 0.3;    // report liquidity moves >= 30%…
const LIQ_MIN_ABS = 5_000;  // …and >= $5K
const MAX_PER_KIND = 12;
const KIND_ORDER: FarmChangeKind[] = ['new', 'liq_out', 'rate_up', 'rate_down', 'liq_in', 'ended'];

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Accept: 'application/json',
};

/** CLOB fallback for markets the live farm scan no longer carries (ended
 * pools, resolved markets) — same pattern as the backtest second sweep. */
async function resolveViaClob(ids: string[]): Promise<Map<string, { question: string; slug: string | null }>> {
  const out = new Map<string, { question: string; slug: string | null }>();
  await Promise.all(ids.map(async (id) => {
    try {
      const res = await fetch(`https://clob.polymarket.com/markets/${id}`,
        { headers: HEADERS, next: { revalidate: 21600 } });
      if (!res.ok) return;
      const m = (await res.json()) as Record<string, unknown>;
      if (typeof m?.question !== 'string') return;
      out.set(id, {
        question: m.question,
        slug: typeof m.market_slug === 'string' ? m.market_slug : null,
      });
    } catch { /* unresolved — UI falls back to the condition id */ }
  }));
  return out;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const hours = Math.min(72, Math.max(6, Number(sp.get('hours')) || 24));

  if (!kvEnabled) {
    return NextResponse.json({
      enabled: false, hours, effectiveHours: 0, snapshots: 0, changes: [], updatedAt: 0,
    } satisfies ChangesResponse);
  }

  try {
    const snaps = (await readLpSnapshots(1100)).sort((a, b) => a.ts - b.ts);
    if (snaps.length < 2) {
      return NextResponse.json({
        enabled: true, hours, effectiveHours: 0, snapshots: snaps.length, changes: [],
        updatedAt: snaps.length ? snaps[snaps.length - 1].ts : 0,
      } satisfies ChangesResponse);
    }

    const latest = snaps[snaps.length - 1];
    const target = latest.ts - hours * 3_600_000;
    // Baseline: the snapshot closest to `target`, but at least 1h before now
    // so a thin history still yields a meaningful diff window.
    let baseline = snaps[0];
    for (const s of snaps) {
      if (Math.abs(s.ts - target) < Math.abs(baseline.ts - target)) baseline = s;
    }
    if (latest.ts - baseline.ts < 3_600_000) {
      return NextResponse.json({
        enabled: true, hours, effectiveHours: r2((latest.ts - baseline.ts) / 3_600_000),
        snapshots: snaps.length, changes: [], updatedAt: latest.ts,
      } satisfies ChangesResponse);
    }

    const baseMap = new Map(baseline.markets.filter(m => m.rate > 0).map(m => [m.id, m]));
    const nowMap = new Map(latest.markets.filter(m => m.rate > 0).map(m => [m.id, m]));

    // First/last sighting inside the diff window — timestamps the feed rows.
    const firstSeen = new Map<string, number>();
    const lastSeen = new Map<string, number>();
    for (const s of snaps) {
      if (s.ts < baseline.ts) continue;
      for (const m of s.markets) {
        if (m.rate <= 0) continue;
        if (!firstSeen.has(m.id)) firstSeen.set(m.id, s.ts);
        lastSeen.set(m.id, s.ts);
      }
    }

    const changes: FarmChange[] = [];
    for (const [id, m] of nowMap) {
      const b = baseMap.get(id);
      if (!b) {
        changes.push({
          kind: 'new', conditionId: id, question: null, slug: null,
          before: 0, after: r2(m.rate), pct: null, ts: firstSeen.get(id) ?? latest.ts,
        });
        continue;
      }
      const dRate = m.rate - b.rate;
      if (Math.abs(dRate) / b.rate >= RATE_MIN_PCT && Math.abs(dRate) >= RATE_MIN_ABS) {
        changes.push({
          kind: dRate > 0 ? 'rate_up' : 'rate_down', conditionId: id, question: null, slug: null,
          before: r2(b.rate), after: r2(m.rate), pct: r2((dRate / b.rate) * 100), ts: latest.ts,
        });
      }
      const liqBase = Math.max(b.liq, 1_000);
      const dLiq = m.liq - b.liq;
      if (Math.abs(dLiq) / liqBase >= LIQ_MIN_PCT && Math.abs(dLiq) >= LIQ_MIN_ABS) {
        changes.push({
          kind: dLiq < 0 ? 'liq_out' : 'liq_in', conditionId: id, question: null, slug: null,
          before: Math.round(b.liq), after: Math.round(m.liq), pct: r2((dLiq / liqBase) * 100), ts: latest.ts,
        });
      }
    }
    for (const [id, b] of baseMap) {
      if (!nowMap.has(id)) {
        changes.push({
          kind: 'ended', conditionId: id, question: null, slug: null,
          before: r2(b.rate), after: 0, pct: null, ts: lastSeen.get(id) ?? baseline.ts,
        });
      }
    }

    // Rank within each kind by impact, cap, then order kinds by actionability.
    const impact = (c: FarmChange) => Math.abs(c.after - c.before);
    const grouped: FarmChange[] = [];
    for (const kind of KIND_ORDER) {
      grouped.push(...changes.filter(c => c.kind === kind).sort((a, b) => impact(b) - impact(a)).slice(0, MAX_PER_KIND));
    }

    // Names: live farm scan first, CLOB second sweep for the rest.
    const { farms } = await scanRewardFarms().catch(() => ({ farms: [], scanned: 0 }));
    const farmById = new Map(farms.map(f => [f.conditionId, f]));
    for (const c of grouped) {
      const f = farmById.get(c.conditionId);
      if (f) { c.question = f.question; c.slug = f.slug; c.eventSlug = f.eventSlug; }
    }
    const missing = [...new Set(grouped.filter(c => !c.question).map(c => c.conditionId))].slice(0, 20);
    if (missing.length) {
      const meta = await resolveViaClob(missing);
      for (const c of grouped) {
        const m = meta.get(c.conditionId);
        if (m && !c.question) { c.question = m.question; c.slug = c.slug ?? m.slug; }
      }
    }

    const body: ChangesResponse = {
      enabled: true, hours,
      effectiveHours: r2((latest.ts - baseline.ts) / 3_600_000),
      snapshots: snaps.length,
      changes: grouped,
      updatedAt: latest.ts,
    };
    return NextResponse.json(body, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
