const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function navbarHarness() {
  const state = [];
  let cursor = 0;
  const source = fs.readFileSync(path.join(__dirname, '../src/components/Navbar.tsx'), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const context = { exports: {}, require(name) {
    if (name === 'react') return { ...React, useState(initial) {
      const i = cursor++;
      if (!(i in state)) state[i] = initial;
      return [state[i], update => { state[i] = typeof update === 'function' ? update(state[i]) : update; }];
    }, useEffect() {} };
    if (name === 'next/navigation') return { usePathname: () => '/' };
    if (name === 'next/link') return { default: ({ children, ...props }) => React.createElement('a', props, children) };
    if (name === '@/components/ThemeSelect') return { default: () => React.createElement('select', { 'aria-label': 'Theme' }, ['dark', 'light', 'system'].map(value => React.createElement('option', { value, key: value }, value))) };
    if (name === '@/components/Logo' || name === '@/components/TelegramModal') return { default: () => null };
    return require(name);
  }};
  vm.runInNewContext(compiled, context);
  function render() { cursor = 0; return context.exports.default(); }
  function all(node) {
    if (!React.isValidElement(node)) return [];
    return [node, ...React.Children.toArray(node.props.children).flatMap(all)];
  }
  function text(node) {
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    return React.isValidElement(node) ? React.Children.toArray(node.props.children).map(text).join('') : '';
  }
  return {
    html: () => renderToStaticMarkup(render()),
    clickMore() {
      const button = all(render()).find(node => node.type === 'button' && text(node).trim() === 'More');
      assert.ok(button, 'More trigger exists');
      button.props.onClick();
    },
    clickMobile() {
      const button = all(render()).find(node => node.type === 'button' && ['Open menu', 'Close menu'].includes(node.props['aria-label']));
      assert.ok(button, 'mobile trigger exists');
      button.props.onClick();
    },
  };
}

test('closed navigation does not render a theme picker on the main screen', () => {
  const h = navbarHarness();
  assert.doesNotMatch(h.html(), /aria-label="Theme"/);
});

test('desktop More reveals theme preferences only while its menu is open', () => {
  const h = navbarHarness();
  h.clickMore();
  assert.equal((h.html().match(/aria-label="Theme"/g) || []).length, 1);
  assert.match(h.html(), /Appearance/);
  h.clickMore();
  assert.doesNotMatch(h.html(), /aria-label="Theme"/);
});

test('mobile menu reveals theme preferences and unmounts them when closed', () => {
  const h = navbarHarness();
  h.clickMobile();
  assert.equal((h.html().match(/aria-label="Theme"/g) || []).length, 1);
  assert.match(h.html(), /Appearance/);
  h.clickMobile();
  assert.doesNotMatch(h.html(), /aria-label="Theme"/);
});
