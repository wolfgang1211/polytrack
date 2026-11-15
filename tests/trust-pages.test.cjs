const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');


const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('blog route awaits Next 16 params, rejects unknown slugs, and uses the real OG image', () => {
  const source = read('src/app/blog/[slug]/page.tsx');
  assert.match(source, /import \{ notFound \} from 'next\/navigation'/);
  assert.match(source, /export const dynamicParams = false/);
  assert.match(source, /params: Promise<\{ slug: string \}>/);
  assert.match(source, /const \{ slug \} = await params/);
  assert.match(source, /if \(!post\) notFound\(\)/);
  assert.doesNotMatch(source, /Post Not Found/);
  assert.match(read('src/app/layout.tsx'), /\/opengraph-image\.png/);
  assert.match(read('src/app/blog/page.tsx'), /\/opengraph-image\.png/);
});

test('trust copy describes implemented watchlist, channel alerts, and relative Smart Score math', () => {
  const faq = read('src/app/faq/page.tsx');
  const smartArticle = read('src/app/blog/[slug]/page.tsx');
  assert.match(faq, /polytrack_watchlist/);
  assert.match(faq, /Telegram channel/);
  assert.doesNotMatch(faq, /you can configure custom alerts|maker rebate rate|0\.1%/i);
  assert.match(faq, /P&L\/share/);
  assert.match(smartArticle, /P(?:&amp;|&)L\/share/);
  assert.match(smartArticle, /relative 0–100|percentile ranks/);
  assert.doesNotMatch(smartArticle, /combines consistency|diversification into|win rate, volume efficiency/i);
});

test('compare labels and error messages are programmatically associated', () => {
  const source = read('src/app/compare/page.tsx');
  assert.match(source, /htmlFor=\{id\}/);
  assert.match(source, /id=\{id\}/);
  assert.match(source, /aria-invalid=\{Boolean\(error\)\}/);
  assert.match(source, /aria-describedby=\{error \? `\$\{id\}-error` : undefined\}/);
  assert.match(source, /id=\{`\$\{id\}-error`\}/);
});

test('homepage does not promise native copy trading', () => {
  assert.doesNotMatch(read('src/app/page.tsx'), /follow and copy the most profitable traders/i);
});

const { createLoader } = require('./helpers/load-ts.cjs');
const { renderToStaticMarkup } = require('react-dom/server');
const blog = createLoader()('src/app/blog/[slug]/page.tsx');
test('actual blog page and metadata await promised params for every published slug', async () => {
  const slugs = await blog.generateStaticParams();
  assert.equal(slugs.length, 4);
  for (const { slug } of slugs) {
    const params = { params: Promise.resolve({ slug }) };
    const metadata = await blog.generateMetadata(params);
    const html = renderToStaticMarkup(await blog.default(params));
    assert.equal(metadata.alternates.canonical, `/blog/${slug}`);
    assert.match(html, /<h1\b/);
    assert.doesNotMatch(html, /Post Not Found/);
    assert.ok(html.includes(metadata.title.replace(/&/g, '&amp;')));
  }
});
for (const slug of ['not-a-published-post', '__proto__', 'constructor', 'toString']) {
  test(`actual page and metadata throw Next's 404 signal for ${slug}`, async () => {
    for (const fn of [blog.default, blog.generateMetadata]) {
      await assert.rejects(() => fn({ params: Promise.resolve({ slug }) }), error => error.digest === 'NEXT_HTTP_ERROR_FALLBACK;404');
    }
  });
}

test('Smart Score implementation remains a percentile blend of P&L/share and P&L magnitude', () => {
  const source = read('src/lib/utils.ts');
  assert.match(source, /0\.6 \* roiP \+ 0\.4 \* pnlP/);
  assert.match(source, /pnl \/ r\.vol/);
});
