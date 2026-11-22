/* GEO priority 0: AI crawlers allowed, honest sitemap dates, llms.txt. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createLoader } = require('./helpers/load-ts.cjs');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const BASE = 'https://www.alphaboard.xyz';
const AI_AGENTS = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'PerplexityBot', 'Perplexity-User'];
const LIVE = ['', '/leaderboard', '/markets', '/activity', '/liquidity', '/insights'];

test('robots: every AI crawler gets an explicit allow group that still keeps /api/ and /watchlist closed', () => {
  const robots = createLoader()('src/app/robots.ts').default();
  const groups = robots.rules;
  const star = groups.find(g => g.userAgent === '*');
  assert.deepEqual(star.disallow, ['/api/', '/watchlist']);
  for (const agent of AI_AGENTS) {
    const g = groups.find(r => (Array.isArray(r.userAgent) ? r.userAgent : [r.userAgent]).includes(agent));
    assert.ok(g, `${agent} group`);
    assert.equal(g.allow, '/');
    assert.deepEqual(g.disallow, ['/api/', '/watchlist'], `${agent} must not reach /api/`);
  }
  assert.equal(robots.sitemap, `${BASE}/sitemap.xml`);
});

test('sitemap: live data pages use now, editorial pages and blog posts carry fixed real dates', () => {
  const before = Date.now();
  const entries = createLoader()('src/app/sitemap.ts').default();
  const byUrl = new Map(entries.map(e => [e.url, e]));
  assert.equal(byUrl.size, entries.length, 'no duplicate URLs');
  for (const p of LIVE) {
    const e = byUrl.get(BASE + p);
    assert.ok(e, `live ${p}`);
    assert.ok(new Date(e.lastModified).getTime() >= before - 1000, `live ${p} is current`);
  }
  const editorial = entries.filter(e => !LIVE.includes(e.url.slice(BASE.length)));
  assert.ok(editorial.length >= 10);
  for (const e of editorial) {
    assert.match(String(e.lastModified), /^\d{4}-\d{2}-\d{2}$/, `${e.url} has a fixed date`);
  }
  const blog = createLoader()('src/lib/blogPosts.ts').BLOG_POSTS;
  for (const post of blog) assert.equal(byUrl.get(`${BASE}/blog/${post.slug}`)?.lastModified, post.date);
});

test('blog post list used by the sitemap matches the posts the blog route actually renders', () => {
  const page = read('src/app/blog/[slug]/page.tsx');
  const rendered = [...page.matchAll(/^ {2}'([a-z0-9-]+)': \{\s*\n\s*title: [^\n]+\n\s*date: '(\d{4}-\d{2}-\d{2})'/gm)].map(m => ({ slug: m[1], date: m[2] }));
  assert.ok(rendered.length >= 4);
  assert.deepEqual(createLoader()('src/lib/blogPosts.ts').BLOG_POSTS, rendered);
});

test('sitemap editorial dates are not older than the last git change of the page (skipped without full git history)', t => {
  const { EDITORIAL_UPDATED } = createLoader()('src/lib/sitemapDates.ts');
  let shallow = 'true';
  try { shallow = execFileSync('git', ['rev-parse', '--is-shallow-repository'], { cwd: root, encoding: 'utf8' }).trim(); } catch { /* no git */ }
  // A shallow clone reports its boundary commit as the last change of every file, which is not a real date.
  if (shallow !== 'false') { t.skip('no full git history available'); return; }
  let checked = 0;
  for (const [route, date] of Object.entries(EDITORIAL_UPDATED)) {
    const file = `src/app${route}/page.tsx`;
    let last = '';
    try { last = execFileSync('git', ['log', '-1', '--format=%cs', '--', file], { cwd: root, encoding: 'utf8' }).trim(); } catch { /* no git */ }
    if (!last) continue;
    checked++;
    assert.ok(date >= last, `${route}: sitemap ${date} older than last change ${last}`);
  }
  if (!checked) t.skip('no git history available');
});

test('llms.txt introduces AlphaBoard with absolute links to real routes and the independence note', () => {
  const txt = read('public/llms.txt');
  assert.match(txt, /^# AlphaBoard\n/);
  assert.match(txt, /^> .+/m);
  assert.match(txt, /Not affiliated with Polymarket or Kalshi/);
  const links = [...txt.matchAll(/\]\((https:\/\/www\.alphaboard\.xyz[^)]*)\)/g)].map(m => new URL(m[1]).pathname);
  assert.ok(links.length >= 6);
  for (const p of links) {
    const dir = p === '/' ? 'src/app' : `src/app${p}`;
    assert.ok(fs.existsSync(path.join(root, dir, 'page.tsx')) || /^\/blog\//.test(p), `route exists: ${p}`);
  }
});
