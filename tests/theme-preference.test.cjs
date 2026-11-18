/* RED tests for Dark / Light / System theme preference (src/lib/theme.ts). */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createLoader } = require('./helpers/load-ts.cjs');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const theme = () => createLoader()('src/lib/theme.ts');
const KEY = 'alphaboard-theme';

/* ---------- fake browser environment for THEME_INIT_SCRIPT ---------- */
function makeEnv({ stored, storage = 'ok', systemDark = false, media = 'ok' } = {}) {
  const store = new Map();
  if (stored !== undefined) store.set(KEY, stored);
  const listeners = {};
  const mqls = [];
  const dataset = {};
  const attrs = {};
  const style = {
    setProperty(name, value) { if (name === 'color-scheme') style.colorScheme = value; },
    removeProperty(name) { if (name === 'color-scheme') delete style.colorScheme; },
  };
  const camel = name => name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  const classes = new Set();
  const documentElement = {
    dataset, style,
    setAttribute(name, value) { attrs[name] = String(value); if (name.startsWith('data-')) dataset[camel(name)] = String(value); },
    getAttribute(name) { return name.startsWith('data-') ? dataset[camel(name)] ?? null : attrs[name] ?? null; },
    removeAttribute(name) { delete attrs[name]; if (name.startsWith('data-')) delete dataset[camel(name)]; },
    classList: {
      add: (...c) => c.forEach(x => classes.add(x)), remove: (...c) => c.forEach(x => classes.delete(x)),
      toggle: (c, on) => { const v = on === undefined ? !classes.has(c) : !!on; if (v) classes.add(c); else classes.delete(c); return v; },
      contains: c => classes.has(c),
    },
  };
  const localStorage = {
    getItem(k) { if (storage === 'throwing') throw new Error('SecurityError'); return store.has(k) ? store.get(k) : null; },
    setItem(k, v) { if (storage === 'throwing') throw new Error('QuotaExceededError'); store.set(k, String(v)); },
    removeItem(k) { if (storage === 'throwing') throw new Error('SecurityError'); store.delete(k); },
    clear() { store.clear(); },
  };
  const matchesFor = q => /dark/.test(q) ? systemDark : /light/.test(q) ? !systemDark : false;
  function matchMedia(query) {
    if (media === 'throws') throw new Error('matchMedia unavailable');
    const mql = { media: String(query), matches: matchesFor(String(query)), onchange: null, fns: [] };
    if (media !== 'legacy') {
      mql.addEventListener = (type, fn) => { if (type === 'change') mql.fns.push(fn); };
      mql.removeEventListener = (type, fn) => { mql.fns = mql.fns.filter(f => f !== fn); };
    }
    mql.addListener = fn => mql.fns.push(fn);
    mql.removeListener = fn => { mql.fns = mql.fns.filter(f => f !== fn); };
    mqls.push(mql);
    return mql;
  }
  const window = {
    document: { documentElement },
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
    removeEventListener(type, fn) { listeners[type] = (listeners[type] || []).filter(f => f !== fn); },
  };
  if (media !== 'missing') window.matchMedia = matchMedia;
  Object.defineProperty(window, 'localStorage', {
    configurable: true, enumerable: true,
    get() { if (storage === 'blocked') throw new Error('SecurityError: storage blocked'); return localStorage; },
  });
  window.window = window;
  window.self = window;
  const context = vm.createContext(window);
  return {
    run(script) { return vm.runInContext(script, context, { timeout: 1000 }); },
    state: () => ({ theme: dataset.theme, preference: dataset.themePreference, scheme: style.colorScheme }),
    setSystemDark(value) {
      systemDark = value;
      for (const mql of mqls) {
        mql.matches = matchesFor(mql.media);
        const event = { matches: mql.matches, media: mql.media };
        for (const fn of mql.fns) fn.call(mql, event);
        if (typeof mql.onchange === 'function') mql.onchange.call(mql, event);
      }
    },
    fireStorage(key, newValue) {
      if (storage === 'ok') {
        if (key === null) store.clear();
        else if (newValue === null) store.delete(key);
        else store.set(key, newValue);
      }
      const event = { type: 'storage', key, newValue, oldValue: null, storageArea: storage === 'ok' ? localStorage : null };
      for (const fn of listeners.storage || []) fn.call(window, event);
    },
    hasStorageListener: () => (listeners.storage || []).length > 0,
  };
}
function boot(options) {
  const env = makeEnv(options);
  assert.doesNotThrow(() => env.run(theme().THEME_INIT_SCRIPT), `init script threw for ${JSON.stringify(options)}`);
  return env;
}
const expect = (env, themeName, preference, label) =>
  assert.deepEqual(env.state(), { theme: themeName, preference, scheme: themeName }, label);

/* ---------- pure exports ---------- */
test('theme module exports the storage key and a standalone init script string', () => {
  const t = theme();
  assert.equal(t.THEME_STORAGE_KEY, KEY);
  assert.equal(typeof t.THEME_INIT_SCRIPT, 'string');
  assert.ok(t.THEME_INIT_SCRIPT.trim().length > 0);
  assert.doesNotMatch(t.THEME_INIT_SCRIPT, /\brequire\(|^\s*(?:import|export)\b/m, 'must not depend on a module system');
  assert.ok(t.THEME_INIT_SCRIPT.includes(KEY), 'script reads the same storage key');
});

test('normalizeThemePreference keeps valid values and defaults everything else to system', () => {
  const { normalizeThemePreference } = theme();
  for (const v of ['dark', 'light', 'system']) assert.equal(normalizeThemePreference(v), v);
  for (const v of [undefined, null, '', 'purple', 'darkness', 'null', '"dark"', 42, true, {}, ['dark']]) {
    assert.equal(normalizeThemePreference(v), 'system', `input ${JSON.stringify(v)}`);
  }
});

test('resolveTheme maps a preference plus OS dark flag to a concrete theme', () => {
  const { resolveTheme } = theme();
  for (const os of [true, false]) {
    assert.equal(resolveTheme('dark', os), 'dark');
    assert.equal(resolveTheme('light', os), 'light');
  }
  assert.equal(resolveTheme('system', true), 'dark');
  assert.equal(resolveTheme('system', false), 'light');
  assert.equal(resolveTheme('bogus', true), 'dark', 'invalid preference behaves like system');
  assert.equal(resolveTheme('bogus', false), 'light', 'invalid preference behaves like system');
});

/* ---------- THEME_INIT_SCRIPT behavior ---------- */
test('init script: persisted dark/light overrides both OS preferences and sets dataset + colorScheme', () => {
  for (const stored of ['dark', 'light']) {
    for (const systemDark of [true, false]) {
      expect(boot({ stored, systemDark }), stored, stored, `stored=${stored} os=${systemDark}`);
    }
  }
});

test('init script: absent or invalid stored value follows the OS preference as system', () => {
  for (const stored of [undefined, '', 'purple', 'DARKER', '{"theme":"light"}', 'null']) {
    expect(boot({ stored, systemDark: true }), 'dark', 'system', `stored=${stored} os=dark`);
    expect(boot({ stored, systemDark: false }), 'light', 'system', `stored=${stored} os=light`);
  }
});

test('init script: blocked or throwing localStorage still follows the OS', () => {
  for (const storage of ['blocked', 'throwing']) {
    expect(boot({ stored: 'light', storage, systemDark: true }), 'dark', 'system', `${storage} os=dark`);
    expect(boot({ stored: 'dark', storage, systemDark: false }), 'light', 'system', `${storage} os=light`);
  }
});

test('init script: missing or failing matchMedia safely defaults to dark, explicit choice still wins', () => {
  for (const media of ['missing', 'throws']) {
    expect(boot({ media }), 'dark', 'system', `${media} no stored`);
    expect(boot({ media, stored: 'light' }), 'light', 'light', `${media} stored light`);
    expect(boot({ media, storage: 'blocked' }), 'dark', 'system', `${media} blocked storage`);
  }
});

test('init script: legacy MediaQueryList without addEventListener does not break init', () => {
  expect(boot({ media: 'legacy', systemDark: false }), 'light', 'system');
  expect(boot({ media: 'legacy', systemDark: true, stored: 'light' }), 'light', 'light');
});

test('init script: system preference reacts to OS changes, explicit dark/light stays fixed', () => {
  const auto = boot({ systemDark: false });
  expect(auto, 'light', 'system');
  auto.setSystemDark(true);
  expect(auto, 'dark', 'system', 'auto follows OS -> dark');
  auto.setSystemDark(false);
  expect(auto, 'light', 'system', 'auto follows OS -> light');

  for (const stored of ['dark', 'light']) {
    const fixed = boot({ stored, systemDark: stored === 'light' });
    fixed.setSystemDark(stored !== 'light');
    expect(fixed, stored, stored, `explicit ${stored} ignores OS change`);
    fixed.setSystemDark(stored === 'light');
    expect(fixed, stored, stored, `explicit ${stored} ignores OS change back`);
  }
});

test('init script keeps an OS listener when opening in an explicit theme then selecting system', () => {
  for (const stored of ['dark', 'light']) {
    const env = boot({ stored, systemDark: false });
    env.run("document.documentElement.dataset.themePreference = 'system';");
    env.setSystemDark(true);
    expect(env, 'dark', 'system', 'switching to system after explicit boot follows dark');
    env.setSystemDark(false);
    expect(env, 'light', 'system', 'switching to system continues following light');
  }
});

test('init script: cross-tab storage changes, removals and invalid values are applied', () => {
  const env = boot({ systemDark: true });
  assert.ok(env.hasStorageListener(), 'listens for storage events');
  expect(env, 'dark', 'system');

  env.fireStorage(KEY, 'light');
  expect(env, 'light', 'light', 'other tab chose light');
  env.setSystemDark(false); env.setSystemDark(true);
  expect(env, 'light', 'light', 'explicit light from other tab is fixed against OS');

  env.fireStorage('unrelated-key', 'dark');
  expect(env, 'light', 'light', 'unrelated keys are ignored');

  env.fireStorage(KEY, null);
  expect(env, 'dark', 'system', 'removal reverts to system');
  env.setSystemDark(false);
  expect(env, 'light', 'system', 'after removal, OS changes apply again');

  env.fireStorage(KEY, 'dark');
  expect(env, 'dark', 'dark');
  env.fireStorage(KEY, 'neon');
  expect(env, 'light', 'system', 'invalid value reverts to system');

  env.fireStorage(KEY, 'dark');
  env.fireStorage(null, null);
  expect(env, 'light', 'system', 'storage.clear() reverts to system');
});

test('init script: blocked storage never prevents applying a cross-tab theme change', () => {
  const env = boot({ storage: 'blocked', systemDark: false });
  expect(env, 'light', 'system');
  assert.doesNotThrow(() => env.fireStorage(KEY, 'dark'));
  expect(env, 'dark', 'dark', 'uses event.newValue without touching blocked storage');
  assert.doesNotThrow(() => env.fireStorage(KEY, null));
  expect(env, 'light', 'system');
});

function bootWithClient(options) {
  const env = boot(options);
  const ts = require('typescript');
  const code = ts.transpileModule(read('src/lib/theme.ts'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  env.run('var exports = {};\n' + code);
  return env;
}

test('actual select handler helper applies every preference even when persistence is blocked', () => {
  for (const storage of ['ok', 'blocked', 'throwing']) {
    const env = bootWithClient({ stored: 'dark', systemDark: false, storage });
    for (const choice of ['light', 'dark', 'system']) {
      const persisted = env.run(`exports.setThemePreference('${choice}')`);
      assert.equal(persisted, storage === 'ok');
      expect(env, choice === 'system' ? 'light' : choice, choice);
      assert.equal(env.run('exports.getThemePreferenceSnapshot()'), choice);
      if (storage === 'ok') assert.equal(env.run(`localStorage.getItem('${KEY}')`), choice);
    }
  }
});

test('actual client selection system activates OS following after a saved explicit boot', () => {
  const env = bootWithClient({ stored: 'light', systemDark: false });
  env.run("exports.setThemePreference('system')");
  env.setSystemDark(true);
  expect(env, 'dark', 'system');
  env.setSystemDark(false);
  expect(env, 'light', 'system');
});

test('same-tab preference subscribers update and unsubscribe without requiring persistence', () => {
  const env = bootWithClient({ storage: 'blocked' });
  env.run('var updates = 0; var unsubscribe = exports.subscribeThemePreference(function(){ updates++; });');
  env.run("exports.setThemePreference('dark')");
  assert.equal(env.run('updates'), 1);
  env.run('unsubscribe()');
  env.run("exports.setThemePreference('light')");
  assert.equal(env.run('updates'), 1);
});

/* ---------- static integration checks ---------- */
test('layout injects THEME_INIT_SCRIPT early, before the body renders', () => {
  const layout = read('src/app/layout.tsx');
  assert.match(layout, /import\s*\{[^}]*\bTHEME_INIT_SCRIPT\b[^}]*\}\s*from\s*['"]@\/lib\/theme['"]/);
  const use = layout.search(/__html:\s*THEME_INIT_SCRIPT/);
  assert.ok(use > 0, 'THEME_INIT_SCRIPT is rendered as inline script');
  assert.ok(use < layout.indexOf('<body'), 'theme script is placed before <body> (in <head>)');
  assert.doesNotMatch(layout.slice(Math.max(0, use - 300), use + 100), /afterInteractive|lazyOnload|worker/,
    'theme script must not be deferred');
  assert.match(layout, /<html[^>]*suppressHydrationWarning/, 'html tolerates pre-hydration data-theme');
});

function themeControlSources() {
  const navbar = read('src/components/Navbar.tsx');
  const sources = [navbar];
  for (const m of navbar.matchAll(/from\s*['"]@\/components\/([\w/-]+)['"]/g)) {
    for (const ext of ['.tsx', '.ts']) {
      const file = path.join(root, 'src/components', m[1] + ext);
      if (fs.existsSync(file)) sources.push(fs.readFileSync(file, 'utf8'));
    }
  }
  return sources.filter(s => /@\/lib\/theme/.test(s));
}

test('Navbar exposes an accessible 3-option theme control wired to the theme module', () => {
  const sources = themeControlSources();
  assert.ok(sources.length > 0, 'Navbar or a component it imports uses @/lib/theme');
  const ui = sources.join('\n');
  for (const option of ['dark', 'light', 'system']) {
    assert.match(ui, new RegExp(`['"\`]${option}['"\`]`), `option ${option}`);
  }
  assert.match(ui, /role=["']radiogroup["']|aria-pressed|aria-checked|<select|type=["']radio["']/,
    'control exposes selected state to assistive tech');
  assert.match(ui, /aria-label=\{?["'`][^"'`]*theme|aria-labelledby|<label[^>]*>[^<]*theme/i, 'control has an accessible name');
  assert.match(ui, /THEME_STORAGE_KEY/, 'persists under the shared key constant');
  const lib = read('src/lib/theme.ts');
  const writer = [ui, lib].find(s => /localStorage[\s\S]{0,40}setItem|\.setItem\(/.test(s));
  assert.ok(writer, 'preference is persisted');
  assert.match(writer, /try\s*\{[\s\S]*setItem[\s\S]*\}\s*catch/, 'persisting is guarded so blocked storage cannot stop applying');
});

function parseColor(value) {
  const hex = /#([\da-f]{6}|[\da-f]{3})\b/i.exec(value);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].replace(/./g, c => c + c) : hex[1];
    return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
  }
  const rgb = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(value);
  return rgb ? rgb.slice(1).map(Number) : null;
}
const lum = rgb => rgb.reduce((sum, v, i) => {
  const c = v / 255;
  return sum + [0.2126, 0.7152, 0.0722][i] * (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
}, 0);
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
function hue([r, g, b]) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (!d) return null;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}
function lightBlock(css) {
  const m = /\[data-theme=["']?light["']?\][^{]*\{/.exec(css);
  if (!m) return null;
  let depth = 1, i = m.index + m[0].length;
  const start = i;
  while (i < css.length && depth) { if (css[i] === '{') depth++; else if (css[i] === '}') depth--; i++; }
  return css.slice(start, i - 1);
}

test('globals.css defines readable, neutral light tokens while keeping semantic colors and no whole-UI filters', () => {
  const css = read('src/app/globals.css');
  const block = lightBlock(css);
  assert.ok(block, 'a [data-theme="light"] token block exists');
  assert.match(block, /color-scheme:\s*light/);
  const token = name => { const m = new RegExp(`${name}:\\s*([^;]+);`).exec(block); return m && parseColor(m[1]); };
  const surfaces = ['--surface-1', '--surface-2'].map(n => [n, token(n)]);
  const texts = ['--text-primary', '--text-secondary', '--text-muted'].map(n => [n, token(n)]);
  for (const [n, c] of [...surfaces, ...texts, ['--border-default', token('--border-default')]]) {
    assert.ok(c, `${n} overridden with a parsable color`);
    assert.ok(Math.max(...c) - Math.min(...c) <= 24, `${n} stays neutral/monochrome`);
  }
  for (const [sn, s] of surfaces) {
    assert.ok(lum(s) > 0.6, `${sn} is light`);
    for (const [tn, t] of texts) assert.ok(contrast(t, s) >= 4.5, `${tn} on ${sn} >= 4.5:1`);
  }
  const bgSwitches = /--color-background:/.test(block) || /--color-background:\s*var\(/.test(css);
  assert.ok(bgSwitches, 'page background (bg-background) switches with the theme');

  const ranges = { '--success': [90, 180], '--danger': [330, 380], '--warning': [30, 60], '--info': [190, 240] };
  for (const [n, [lo, hi]] of Object.entries(ranges)) {
    const c = token(n);
    if (!c) continue; // inherits the semantic dark-root value
    let h = hue(c);
    if (h !== null && h < 30 && hi > 360) h += 360;
    assert.ok(h !== null && h >= lo && h <= hi, `${n} keeps its semantic hue in light theme`);
  }
  assert.doesNotMatch(css, /filter:\s*[^;]*(?:invert|grayscale)\(/, 'no whole-UI invert/grayscale filter');
});
