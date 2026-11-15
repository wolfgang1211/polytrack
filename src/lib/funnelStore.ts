import { mkdirSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { createRequire } from 'node:module';
import { PAGE_GROUPS, parseFunnelEvent, type FunnelEvent, type PageGroup } from '@/lib/funnelSchema';

interface Statement { run(...params: (string | number)[]): unknown; all(...params: (string | number)[]): Record<string, unknown>[] }
interface Database { exec(sql: string): void; prepare(sql: string): Statement; close(): void }
interface Counts { views: number; clicks: number; clicksPer100Views: number | null }
export interface FunnelSummary {
  scope: 'local-qa'; timezone: 'UTC'; collectionStartedAt: string; coverage: 'observed-only';
  totals: Counts;
  daily: Array<{ day: string; views: number | null; clicks: number | null; coverage: 'observed-only' | 'not-collected' }>;
  pages: Array<Counts & { page: PageGroup }>;
  placements: Array<{ page: PageGroup; placement: string; kind: string; clicks: number }>;
}
const DAY_MS = 86_400_000;
const utcDay = (timestamp: number) => new Date(timestamp).toISOString().slice(0, 10);
const withRate = (views: number, clicks: number): Counts => ({ views, clicks, clicksPer100Views: views > 0 ? clicks / views * 100 : null });

/** Local-only operator store. SQLite atomic increments work across processes.
 * Stores COUNTS only, never raw events, visitors, URLs or wallet identifiers.
 * Requires Node's built-in SQLite (exercised on Node 24); no package install.
 * Not a Vercel/serverless production storage adapter. */
export class FunnelStore {
  private db: Database;
  constructor(directory: string, private clock: () => number = Date.now) {
    if (!isAbsolute(directory)) throw new Error('Analytics requires an absolute local directory.');
    const sqlite = createRequire(join(process.cwd(), 'package.json'))('node:sqlite') as { DatabaseSync: new (path: string) => Database };
    mkdirSync(directory, { recursive: true });
    this.db = new sqlite.DatabaseSync(join(directory, 'funnel.sqlite'));
    try {
      this.db.exec(`PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS counts (
        day TEXT NOT NULL, page TEXT NOT NULL, event TEXT NOT NULL,
        placement TEXT NOT NULL, kind TEXT NOT NULL,
        n INTEGER NOT NULL CHECK(n >= 0 AND n <= ${Number.MAX_SAFE_INTEGER}),
        PRIMARY KEY(day,page,event,placement,kind)
      ) WITHOUT ROWID;`);
      this.db.prepare('INSERT OR IGNORE INTO metadata(key,value) VALUES(?,?)').run('started_at', new Date(this.clock()).toISOString());
    } catch (error) {
      try { this.db.close(); } catch { /* Preserve the original initialization failure. */ }
      throw error;
    }
  }
  record(input: FunnelEvent): void {
    const event = parseFunnelEvent(input);
    if (!event) throw new Error('Invalid aggregate event.');
    this.db.prepare(`INSERT INTO counts(day,page,event,placement,kind,n) VALUES(?,?,?,?,?,1)
      ON CONFLICT(day,page,event,placement,kind) DO UPDATE SET n=n+1`).run(
      utcDay(this.clock()), event.page, event.event,
      event.event === 'page_view' ? '' : event.placement,
      event.event === 'page_view' ? '' : event.kind,
    );
  }
  summary(days = 7): FunnelSummary {
    if (!Number.isInteger(days) || days < 1 || days > 31) throw new Error('Invalid day range.');
    const now = this.clock();
    const end = utcDay(now);
    const start = utcDay(Date.parse(end + 'T00:00:00Z') - (days - 1) * DAY_MS);
    const metadata = this.db.prepare('SELECT value FROM metadata WHERE key=?').all('started_at')[0];
    if (typeof metadata?.value !== 'string' || !Number.isFinite(Date.parse(metadata.value))) throw new Error('Invalid analytics metadata.');
    const collectionStartedAt = metadata.value;
    const startedDay = collectionStartedAt.slice(0, 10);
    const rows = this.db.prepare('SELECT day,page,event,placement,kind,n FROM counts WHERE day>=? AND day<=?').all(start, end);
    const dailyCounts = new Map<string, { views: number; clicks: number }>();
    const pageCounts = new Map<PageGroup, { views: number; clicks: number }>();
    const placementCounts = new Map<string, FunnelSummary['placements'][number]>();
    let views = 0, clicks = 0;
    for (const row of rows) {
      if (typeof row.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.day)
        || typeof row.n !== 'number' || !Number.isSafeInteger(row.n) || row.n < 0) throw new Error('Invalid analytics aggregate.');
      const event = row.event === 'page_view' ? parseFunnelEvent({ event: row.event, page: row.page })
        : parseFunnelEvent({ event: row.event, page: row.page, placement: row.placement, kind: row.kind });
      if (!event) throw new Error('Invalid analytics aggregate.');
      const daily = dailyCounts.get(row.day) ?? { views: 0, clicks: 0 };
      const page = pageCounts.get(event.page) ?? { views: 0, clicks: 0 };
      if (event.event === 'page_view') { daily.views += row.n; page.views += row.n; views += row.n; }
      else {
        daily.clicks += row.n; page.clicks += row.n; clicks += row.n;
        const key = [event.page, event.placement, event.kind].join('|');
        const placement = placementCounts.get(key) ?? { page: event.page, placement: event.placement, kind: event.kind, clicks: 0 };
        placement.clicks += row.n; placementCounts.set(key, placement);
      }
      if (![views, clicks, daily.views, daily.clicks, page.views, page.clicks].every(Number.isSafeInteger)) throw new Error('Analytics count overflow.');
      dailyCounts.set(row.day, daily); pageCounts.set(event.page, page);
    }
    const daily: FunnelSummary['daily'] = [];
    for (let i = 0; i < days; i++) {
      const day = utcDay(Date.parse(start + 'T00:00:00Z') + i * DAY_MS);
      const count = dailyCounts.get(day) ?? { views: 0, clicks: 0 };
      daily.push(day < startedDay ? { day, views: null, clicks: null, coverage: 'not-collected' }
        : { day, ...count, coverage: 'observed-only' });
    }
    return {
      scope: 'local-qa', timezone: 'UTC', collectionStartedAt, coverage: 'observed-only', totals: withRate(views, clicks), daily,
      pages: PAGE_GROUPS.map(page => ({ page, ...withRate(pageCounts.get(page)?.views ?? 0, pageCounts.get(page)?.clicks ?? 0) })),
      placements: [...placementCounts.values()].sort((a,b) => b.clicks - a.clicks),
    };
  }
  close(): void { this.db.close(); }
}
