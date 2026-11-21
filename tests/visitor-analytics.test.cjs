/* Visitor analytics: Vercel Web Analytics + Microsoft Clarity (production only, env-driven, privacy-preserving). */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createLoader } = require('./helpers/load-ts.cjs');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const clarity = () => createLoader()('src/lib/clarity.ts');

function walk(dir) {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(d => {
    const rel = path.join(dir, d.name);
    return d.isDirectory() ? walk(rel) : /\.(ts|tsx)$/.test(d.name) ? [rel] : [];
  });
}

test('package declares @vercel/analytics and the root layout renders <Analytics /> from the Next entry', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.ok(pkg.dependencies['@vercel/analytics'], '@vercel/analytics dependency');
  const layout = read('src/app/layout.tsx');
  assert.match(layout, /import \{ Analytics \} from '@vercel\/analytics\/next'/);
  assert.match(layout, /<Analytics \/>/);
  assert.match(layout, /<ClarityScript \/>/);
});

test('Clarity project id comes only from NEXT_PUBLIC_CLARITY_ID and must look like a Clarity id', () => {
  const { clarityProjectId } = clarity();
  assert.equal(clarityProjectId('abc123xyz9'), 'abc123xyz9');
  assert.equal(clarityProjectId('  abc123xyz9 \n'), 'abc123xyz9');
  for (const bad of [undefined, null, '', '   ', 'abc', 'abc"; alert(1)//', 'abc 123xyz', 'a'.repeat(40), '../../x']) {
    assert.equal(clarityProjectId(bad), null, String(bad));
  }
  const component = read('src/components/ClarityScript.tsx');
  assert.match(component, /process\.env\.NEXT_PUBLIC_CLARITY_ID/);
});

test('Clarity loads only in a production build with a valid id', () => {
  const { shouldLoadClarity } = clarity();
  assert.equal(shouldLoadClarity({ nodeEnv: 'production', id: 'abc123xyz9' }), true);
  assert.equal(shouldLoadClarity({ nodeEnv: 'development', id: 'abc123xyz9' }), false);
  assert.equal(shouldLoadClarity({ nodeEnv: 'test', id: 'abc123xyz9' }), false);
  assert.equal(shouldLoadClarity({ nodeEnv: 'production', id: null }), false);
});

test('bootstrap honours Do Not Track / Global Privacy Control and injects the official tag only otherwise', () => {
  const { clarityBootstrap } = clarity();
  const code = clarityBootstrap('abc123xyz9');
  const run = navigator => {
    const inserted = [];
    const first = { parentNode: { insertBefore: el => inserted.push(el) } };
    const window = {};
    const document = { createElement: tag => ({ tag }), getElementsByTagName: () => [first] };
    vm.runInNewContext(code, { window, document, navigator });
    return { inserted, window };
  };
  const on = run({ doNotTrack: null, globalPrivacyControl: false });
  assert.equal(on.inserted.length, 1);
  assert.equal(on.inserted[0].src, 'https://www.clarity.ms/tag/abc123xyz9');
  assert.equal(on.inserted[0].async, 1);
  assert.equal(typeof on.window.clarity, 'function');
  assert.equal(run({ doNotTrack: '1' }).inserted.length, 0);
  assert.equal(run({ globalPrivacyControl: true }).inserted.length, 0);
  assert.throws(() => clarityBootstrap('bad id"'), /Invalid Clarity project id/);
});

test('no hard-coded Clarity id and nothing unmasks recorded content', () => {
  for (const file of walk('src')) {
    const s = read(file);
    assert.doesNotMatch(s, /clarity\.ms\/tag\/[a-z0-9]{6,}/i, `${file}: hard-coded Clarity id`);
    assert.doesNotMatch(s, /data-clarity-unmask/, `${file}: unmasks content`);
    assert.doesNotMatch(s, /clarity\(\s*['"](?:set|identify|consent)/, `${file}: custom Clarity identity/tags`);
  }
});

test('privacy policy names both visitor analytics tools and input masking', () => {
  const privacy = read('src/app/privacy/page.tsx');
  assert.match(privacy, /Vercel Web Analytics/);
  assert.match(privacy, /Microsoft Clarity/);
  assert.match(privacy, /mask/i);
  assert.match(privacy, /Do Not Track|Global Privacy Control/);
});
