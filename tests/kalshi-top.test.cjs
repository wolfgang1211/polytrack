/* Kalshi top markets: full open-market scan ranked by 24h contract volume (src/lib/kalshiTop.ts).
   Upstream is injected (getJson/getEvent); every fixture is SYNTHETIC. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createLoader } = require('./helpers/load-ts.cjs');
const load = createLoader();
const top = load('src/lib/kalshiTop.ts');
const { KalshiError } = load('src/lib/kalshi.ts');

const FUTURE = '2099-01-01T00:00:00Z';
const row = (ticker, vol, extra = {}) => ({
  ticker, event_ticker: `EV-${ticker.split('-')[0]}`, status: 'active', market_type: 'binary', notional_value_dollars: '1',
  close_time: FUTURE, title: `Market ${ticker}`, volume_24h_fp: String(vol), open_interest_fp: '10',
  yes_bid_dollars: '0.40', yes_bid_size_fp: '5', yes_ask_dollars: '0.42', yes_ask_size_fp: '5', ...extra,
});
const pagesOf = (...pages) => {
  const calls = [];
  const getJson = async (path, q) => {
    calls.push({ path, q });
    const i = q.cursor ? Number(q.cursor.slice(1)) : 0;
    const p = pages[i];
    if (p instanceof Error) throw p;
    return { markets: p, cursor: i + 1 < pages.length ? `c${i + 1}` : '' };
  };
  return { getJson, calls };
};
const noWait = async () => {};
const getEvent = async t => ({ category: t === 'EV-A' ? 'Elections' : 'Sports', title: `Event ${t}` });

test('scans every page with status=open, mve_filter=exclude, limit=1000 and ranks by 24h volume', async () => {
  const { getJson, calls } = pagesOf([row('A-1', 5), row('B-1', 50)], [row('A-2', 500), row('B-2', 0)]);
  const s = await top.scanKalshiTopMarkets({ getJson, getEvent, wait: noWait });
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].q, { status: 'open', mve_filter: 'exclude', limit: '1000' });
  assert.equal(calls[1].q.cursor, 'c1');
  // Events ranked by summed 24h volume of ALL their traded markets; outcomes inside by volume; zero-volume dropped.
  assert.deepEqual(s.events.map(e => e.eventTicker), ['EV-A', 'EV-B']);
  assert.equal(s.events[0].volume24hContracts, 505);
  assert.deepEqual(s.events[0].outcomes.map(o => o.ticker), ['A-2', 'A-1']);
  assert.deepEqual(s.events[1].outcomes.map(o => o.ticker), ['B-1']);
  assert.equal(s.complete, true);
  assert.equal(s.stopReason, 'done');
  assert.equal(s.scannedMarkets, 4);
  assert.equal(s.listableMarkets, 4);
  assert.equal(s.tradedMarkets, 3);
  assert.equal(s.tradedEvents, 2);
  assert.equal(s.events[0].category, 'Elections');
  assert.equal(s.events[0].title, 'Event EV-A');
  assert.equal(s.events[0].outcomes[0].yesAsk, 0.42);
});

test('keeps only listable binary $1 markets with a future close, deduped', async () => {
  const { getJson } = pagesOf([
    row('A-1', 9, { market_type: 'scalar' }), row('A-2', 9, { notional_value_dollars: '10' }),
    row('A-3', 9, { close_time: '2001-01-01T00:00:00Z' }), row('A-4', 9, { status: 'closed' }),
    row('B-1', 3), row('B-1', 3), row('B-2', 2), row('B-3', 1),
  ]);
  const s = await top.scanKalshiTopMarkets({ getJson, getEvent, wait: noWait });
  assert.deepEqual(s.events.map(e => e.eventTicker), ['EV-B']);
  assert.deepEqual(s.events[0].outcomes.map(o => o.ticker), ['B-1', 'B-2', 'B-3']);
  assert.equal(s.events[0].volume24hContracts, 6); // the duplicated B-1 row counts once
  assert.equal(s.listableMarkets, 3);
});

test('a time budget stop is reported as a partial scan, never as complete', async () => {
  let t = 0;
  const { getJson } = pagesOf([row('A-1', 5)], [row('A-2', 6)], [row('A-3', 7)]);
  const s = await top.scanKalshiTopMarkets({ getJson, getEvent, wait: noWait, now: () => (t += 30_000), budgetMs: 45_000 });
  assert.equal(s.complete, false);
  assert.equal(s.stopReason, 'budget');
  assert.ok(s.pages >= 1 && s.pages < 3);
});

test('rate limiting: retried with backoff; after the first page a persistent limit is a labelled partial scan', async () => {
  const waits = [];
  const limited = new KalshiError(503, 'rate limited');
  const { getJson } = pagesOf([row('A-1', 5)], limited);
  const s = await top.scanKalshiTopMarkets({ getJson, getEvent, wait: async ms => { waits.push(ms); } });
  assert.equal(s.complete, false);
  assert.equal(s.stopReason, 'rate_limited');
  assert.deepEqual(waits.filter(w => w >= 1000), [1000, 2000, 4000, 8000, 16000]);
  assert.deepEqual(s.events.map(e => e.eventTicker), ['EV-A']);
});

test('first page failing throws (nothing honest to show); malformed envelopes and stuck cursors are 502', async () => {
  await assert.rejects(top.scanKalshiTopMarkets({ getJson: pagesOf(new KalshiError(502, 'x')).getJson, getEvent, wait: noWait }), { status: 502 });
  await assert.rejects(top.scanKalshiTopMarkets({ getJson: async () => ({ nope: 1 }), getEvent, wait: noWait }), { status: 502 });
  await assert.rejects(top.scanKalshiTopMarkets({ getJson: async () => ({ markets: [], cursor: 'same' }), getEvent, wait: noWait }), { status: 502 });
});

test('event lookups failing keep the event with category null (shown as Other) and the market title', async () => {
  const { getJson } = pagesOf([row('A-1', 5)]);
  const s = await top.scanKalshiTopMarkets({ getJson, getEvent: async () => { throw new Error('down'); }, wait: noWait });
  assert.equal(s.events[0].category, null);
  assert.equal(s.events[0].title, 'Market A-1');
  assert.equal(top.chipFor(null), 'Other');
});

test('published categories fold into explorer chips; unknown categories are Other, never guessed', () => {
  assert.equal(top.chipFor('Elections'), 'Politics');
  assert.equal(top.chipFor('Financials'), 'Economy');
  assert.equal(top.chipFor('Science and Technology'), 'Tech');
  assert.equal(top.chipFor('Entertainment'), 'Entertainment');
  assert.equal(top.chipFor('Climate and Weather'), 'World');
  assert.equal(top.chipFor('Brand New Category'), 'Other');
});

test('outcomes per event are capped and the event volume still counts every traded market', async () => {
  const rows = [1, 2, 3, 4, 5, 6].map(i => row(`A-${i}`, i));
  const s = await top.scanKalshiTopMarkets({ getJson: pagesOf(rows).getJson, getEvent, wait: noWait });
  assert.equal(s.events[0].outcomes.length, top.OUTCOMES_PER_EVENT);
  assert.deepEqual(s.events[0].outcomes.map(o => o.ticker), ['A-6', 'A-5', 'A-4', 'A-3']);
  assert.equal(s.events[0].volume24hContracts, 21);
  assert.equal(s.events[0].tradedMarkets, 6);
});

test('total volume sums every listable market of the event (traded or not); openedAt is the earliest open_time', async () => {
  const rows = [
    row('A-1', 5, { volume_fp: '100', open_time: '2026-11-20T00:00:00Z' }),
    row('A-2', 0, { volume_fp: '900', open_time: '2026-11-01T00:00:00Z' }),
    row('A-3', 1, { volume_fp: '7', open_time: 'not-a-date' }),
  ];
  const s = await top.scanKalshiTopMarkets({ getJson: pagesOf(rows).getJson, getEvent, wait: noWait });
  assert.equal(s.events[0].totalVolumeContracts, 1007);
  assert.equal(s.events[0].openedAt, '2026-11-01T00:00:00Z');
  assert.equal(s.events[0].volume24hContracts, 6);
});

test('event image comes from Kalshi event metadata and only an absolute https URL is kept', async () => {
  assert.equal(top.safeImageUrl('https://kalshi-public-docs.s3.amazonaws.com/x.png'), 'https://kalshi-public-docs.s3.amazonaws.com/x.png');
  for (const bad of ['http://x.test/a.png', '/images/a.png', 'javascript:alert(1)', '', null, 7, 'https://' + 'a'.repeat(600)]) {
    assert.equal(top.safeImageUrl(bad), null, String(bad).slice(0, 30));
  }
  const s = await top.scanKalshiTopMarkets({
    getJson: pagesOf([row('A-1', 5), row('B-1', 3)]).getJson, getEvent, wait: noWait,
    getImage: async t => (t === 'EV-A' ? 'https://img.test/a.png' : (() => { throw new Error('down'); })()),
  });
  assert.equal(s.events[0].image, 'https://img.test/a.png');
  assert.equal(s.events[1].image, null, 'a failed image lookup leaves the event without an image');
  assert.equal(s.events[1].category, 'Sports');
});

test('rate-limit backoff never waits past the time budget', async () => {
  let t = 0;
  const waits = [];
  const { getJson } = pagesOf([row('A-1', 5)], new KalshiError(503, 'rate limited'));
  const s = await top.scanKalshiTopMarkets({
    getJson, getEvent, budgetMs: 5000, now: () => t, wait: async ms => { waits.push(ms); t += ms; },
  });
  assert.equal(s.stopReason, 'rate_limited');
  assert.deepEqual(waits, [1000, 2000]); // a 4 s wait would end past the 5 s budget
});

test('cache layer: only complete scans are cached; a cold partial scan is still returned, labelled', async () => {
  const cache = load('src/lib/kalshiTopCache.ts');
  const full = { complete: true, stopReason: 'done', pages: 3 };
  const part = { complete: false, stopReason: 'rate_limited', pages: 2 };
  assert.equal(await cache.completeScanOrThrow(async () => full), full);
  await assert.rejects(cache.completeScanOrThrow(async () => part), e => e instanceof cache.PartialKalshiScan && e.scan === part);
  // cold cache: unstable_cache rethrows the partial-scan error to the caller, which shows it as partial
  assert.equal(await cache.readKalshiTop(() => cache.completeScanOrThrow(async () => part)), part);
  await assert.rejects(cache.readKalshiTop(async () => { throw new KalshiError(502, 'down'); }), { status: 502 });
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'src/lib/kalshiTopCache.ts'), 'utf8');
  assert.match(src, /unstable_cache\(\s*\(\) => completeScanOrThrow\(\)/);
});
