const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { createLoader } = require('./helpers/load-ts.cjs');
const load = createLoader();
const originals = Object.fromEntries(['Element','navigator','window','document'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
afterEach(()=>{mock.restoreAll(); for(const [key,descriptor] of Object.entries(originals)) {if(descriptor) Object.defineProperty(globalThis,key,descriptor); else Reflect.deleteProperty(globalThis,key);} });
function setup() {
  const beacons=[];
  class FakeElement { closest() {return {href:'https://polymarket.com/event/example?utm_content=wallet_positions&ref=must-not-store'};} }
  const nav={sendBeacon:(...args)=>{beacons.push(args);return true;},doNotTrack:null,globalPrivacyControl:false};
  const doc=new EventTarget();doc.visibilityState='visible';
  const win=new EventTarget(); win.location={pathname:'/wallet/0x'+'a'.repeat(40)};
  for(const [key,value] of Object.entries({Element:FakeElement,navigator:nav,document:doc,window:win})) Object.defineProperty(globalThis,key,{configurable:true,value});
  return {beacons,nav,doc,win,FakeElement};
}
test('actual pageview emitter strips wallet and honors hidden/DNT/GPC state', async()=>{
  const {beacons,nav,doc,win}=setup();
  const {emitPageView}=load('src/components/OutboundAnalytics.tsx');
  assert.equal(emitPageView(win.location.pathname),true);
  assert.equal(beacons[0][0],'/api/analytics/pageview');
  assert.deepEqual(JSON.parse(await beacons[0][1].text()),{event:'page_view',page:'wallet'});
  doc.visibilityState='hidden';assert.equal(emitPageView('/'),false);
  doc.visibilityState='visible';nav.doNotTrack='1';assert.equal(emitPageView('/'),false);
  nav.doNotTrack=null;nav.globalPrivacyControl=true;assert.equal(emitPageView('/'),false);
  nav.globalPrivacyControl=false;assert.equal(emitPageView('/analytics'),false);
  assert.equal(beacons.length,1);
});
test('actual click payload adds only an allowlisted page group, never URL/address/referral',async()=>{
  const {beacons,FakeElement,nav}=setup();
  const {handleOutboundClick}=load('src/components/OutboundAnalytics.tsx');
  handleOutboundClick({type:'click',button:0,target:new FakeElement()});
  const body=JSON.parse(await beacons[0][1].text());
  assert.deepEqual(body,{event:'polymarket_outbound_click',page:'wallet',kind:'market',placement:'wallet_positions'});
  nav.globalPrivacyControl=true;
  handleOutboundClick({type:'click',button:0,target:new FakeElement()});
  assert.equal(beacons.length,1);
});
test('beacon rejection uses a same-origin keepalive fallback without blocking navigation',()=>{
  const {nav,FakeElement}=setup();nav.sendBeacon=()=>false;
  const fetch=mock.method(globalThis,'fetch',async()=>new Response(null,{status:204}));
  let prevented=false;
  load('src/components/OutboundAnalytics.tsx').handleOutboundClick({type:'click',button:0,target:new FakeElement(),preventDefault(){prevented=true;}});
  assert.equal(fetch.mock.callCount(),1);
  const [url,options]=fetch.mock.calls[0].arguments;
  assert.equal(url,'/api/analytics/outbound');assert.equal(options.keepalive,true);assert.equal(prevented,false);
});
test('actual report renderer labels ratios, coverage gaps and absent placement impressions honestly',()=>{
  const dir=path.join(process.env.TMPDIR || require('node:os').tmpdir(), 'alphaboard-funnel-tests');fs.mkdirSync(dir,{recursive:true});
  const {FunnelStore}=load('src/lib/funnelStore.ts');
  const store=new FunnelStore(fs.mkdtempSync(path.join(dir,'render-')),()=>Date.parse('2026-11-14T12:00:00Z'));
  store.record({event:'page_view',page:'home'});
  for(let i=0;i<2;i++) store.record({event:'polymarket_outbound_click',page:'home',kind:'market',placement:'home_recent_trades'});
  const data=store.summary(3);store.close();
  const {FunnelReport}=load('src/components/AnalyticsDashboard.tsx');
  const html=renderToStaticMarkup(React.createElement(FunnelReport,{data}));
  assert.match(html,/200\.0/);assert.match(html,/not unique visitors or conversions/);assert.match(html,/Not collected/);assert.match(html,/Placement impressions are not measured/);
  assert.equal(load('src/app/analytics/page.tsx').metadata.robots.index,false);
});

test('real hook bodies survive StrictMode, hidden visits and returning via excluded routes',async()=>{
  const {beacons,doc}=setup();
  const Module=require('node:module');const originalLoad=Module._load;
  let pathname='/',effects=[];const ref={current:null};
  mock.method(Module,'_load',function(name,...args){return name==='next/navigation'?{usePathname:()=>pathname}:originalLoad.call(this,name,...args);});
  mock.method(React,'useEffect',effect=>effects.push(effect));
  mock.method(React,'useRef',()=>ref);
  mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({enabled:true,scope:'local-qa'}),{headers:{'Content-Type':'application/json'}}));
  const Component=createLoader()('src/components/OutboundAnalytics.tsx').default;
  Component();const first=effects[0];const cancelled=first();cancelled();let cleanup=first();
  await new Promise(setImmediate);assert.equal(beacons.length,1);
  cleanup();pathname='/wallet/0x'+'b'.repeat(40);effects=[];doc.visibilityState='hidden';Component();cleanup=effects[0]();
  await new Promise(setImmediate);assert.equal(beacons.length,1);
  doc.visibilityState='visible';doc.dispatchEvent(new Event('visibilitychange'));doc.dispatchEvent(new Event('visibilitychange'));assert.equal(beacons.length,2);
  cleanup();pathname='/analytics';effects=[];Component();effects[0]();
  pathname='/wallet/0x'+'b'.repeat(40);effects=[];Component();cleanup=effects[0]();
  await new Promise(setImmediate);assert.equal(beacons.length,3,'returning to the same wallet is a new observed view, not a duplicate');cleanup();
});
