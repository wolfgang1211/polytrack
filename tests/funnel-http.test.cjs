const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { NextRequest } = require('next/server');
const { createLoader } = require('./helpers/load-ts.cjs');
const load = createLoader();
const base = 'http://127.0.0.1:3016';
const scratch = path.join(process.env.TMPDIR || require('node:os').tmpdir(), 'alphaboard-funnel-tests');
const before = { local:process.env.ALPHABOARD_ANALYTICS_LOCAL, dir:process.env.ALPHABOARD_ANALYTICS_DIR };
function enable() { fs.mkdirSync(scratch,{recursive:true}); process.env.ALPHABOARD_ANALYTICS_LOCAL='1'; process.env.ALPHABOARD_ANALYTICS_DIR=fs.mkdtempSync(path.join(scratch,'http-')); }
afterEach(() => { mock.restoreAll(); for(const [key,value] of Object.entries({ALPHABOARD_ANALYTICS_LOCAL:before.local,ALPHABOARD_ANALYTICS_DIR:before.dir})) { if(value===undefined) delete process.env[key]; else process.env[key]=value; } });
const request = (endpoint, body, origin=base, extra={}) => new NextRequest(base+endpoint,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(origin?{Origin:origin}:{}),...extra},...(body===undefined?{}:{body:typeof body==='string'?body:JSON.stringify(body)})});
const summary = () => load('src/app/api/analytics/summary/route.ts').GET(request('/api/analytics/summary',undefined,null));

test('actual pageview and outbound routes persist a page-bound daily funnel', async () => {
  enable(); mock.method(console,'info',()=>{});
  const views=load('src/app/api/analytics/pageview/route.ts');
  assert.equal((await views.POST(request('/api/analytics/pageview',{event:'page_view',page:'home'}))).status,204);
  const clicks=load('src/app/api/analytics/outbound/route.ts');
  assert.equal((await clicks.POST(request('/api/analytics/outbound',{event:'polymarket_outbound_click',page:'home',kind:'market',placement:'home_recent_trades'}))).status,204);
  const response=await summary(); assert.equal(response.status,200);
  const body=await response.json(); assert.equal(body.totals.views,1); assert.equal(body.totals.clicks,1); assert.equal(body.totals.clicksPer100Views,100); assert.equal(body.scope,'local-qa');
});
test('disabled storage is explicit unavailable, never a fabricated empty dashboard', async () => {
  process.env.ALPHABOARD_ANALYTICS_LOCAL='0';
  assert.equal((await summary()).status,503);
  const status=await load('src/app/api/analytics/status/route.ts').GET(request('/api/analytics/status',undefined,null));
  assert.equal((await status.json()).enabled,false);
});
test('public hostname cannot activate the local operator store even with configuration', async () => {
  enable();
  const response=await load('src/app/api/analytics/summary/route.ts').GET(new NextRequest('https://www.alphaboard.xyz/api/analytics/summary'));
  assert.equal(response.status,503);
});
test('bad origins, extra identifiers and oversized bodies never enter counters', async () => {
  enable(); const {POST}=load('src/app/api/analytics/pageview/route.ts');
  const event={event:'page_view',page:'home'};
  assert.equal((await POST(request('/api/analytics/pageview',event,'https://evil.test'))).status,403);
  assert.equal((await POST(request('/api/analytics/pageview',event,null))).status,403);
  assert.equal((await POST(request('/api/analytics/pageview',{...event,wallet:'private'}))).status,400);
  assert.equal((await POST(request('/api/analytics/pageview','x'.repeat(513)))).status,413);
  assert.equal((await (await summary()).json()).totals.views,0);
});
test('privacy opt-out is respected server-side and range validation is strict', async () => {
  enable(); const {POST}=load('src/app/api/analytics/pageview/route.ts');
  assert.equal((await POST(request('/api/analytics/pageview',{event:'page_view',page:'home'},base,{DNT:'1'}))).status,204);
  assert.equal((await (await summary()).json()).totals.views,0);
  const {GET}=load('src/app/api/analytics/summary/route.ts');
  for(const days of ['0','32','NaN','1.5','']) assert.equal((await GET(request('/api/analytics/summary?days='+days,undefined,null))).status,400);
});
