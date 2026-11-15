const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { createLoader } = require('./helpers/load-ts.cjs');
const { default: ActivityPage } = createLoader()('src/app/activity/page.tsx');
afterEach(() => mock.restoreAll());

// Controlled React-hook boundary: execute the actual page's polling effect,
// with no browser, timers, socket traffic or fabricated network observations.
async function poll(response) {
  const effects = [];
  const states = [];
  mock.method(React, 'useState', initial => {
    const slot = { value: typeof initial === 'function' ? initial() : initial };
    states.push(slot);
    return [slot.value, next => { slot.value = typeof next === 'function' ? next(slot.value) : next; }];
  });
  mock.method(React, 'useRef', current => ({ current }));
  mock.method(React, 'useCallback', callback => callback);
  mock.method(React, 'useMemo', callback => callback());
  mock.method(React, 'useEffect', callback => effects.push(callback));
  mock.method(globalThis, 'setInterval', () => 0);
  mock.method(globalThis, 'clearInterval', () => {});
  const calls = [];
  mock.method(globalThis, 'fetch', async input => { calls.push(String(input)); return response(); });
  ActivityPage();
  // paused-ref sync is first; the API polling effect is second. Socket effect
  // is deliberately not run, so this test cannot contact the external stream.
  effects[0]();
  const cleanup = effects[1]();
  await new Promise(resolve => setImmediate(resolve));
  cleanup();
  return { calls, states: states.map(slot => slot.value) };
}
test('activity client polls the validated same-origin adapter, never retired v1', async () => {
  const result = await poll(() => Response.json({ trades: [], count: 0, truncated: false }));
  assert.equal(result.calls.length, 1);
  assert.match(result.calls[0], /^\/api\/activity(?:\?|$)/);
});
test('activity client marks failed HTTP feed unavailable rather than healthy empty', async () => {
  const result = await poll(() => Response.json({ error: 'Upstream unavailable' }, { status: 502 }));
  assert.ok(result.states.some(value => typeof value === 'string' && /unavailable/i.test(value)));
});
