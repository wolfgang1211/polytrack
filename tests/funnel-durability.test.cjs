const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { NextRequest } = require('next/server');
const { createLoader } = require('./helpers/load-ts.cjs');
const load = createLoader();
const run = promisify(execFile);
const scratch=path.join(process.env.TMPDIR || require('node:os').tmpdir(), 'alphaboard-funnel-tests');
function directory(){fs.mkdirSync(scratch,{recursive:true});return fs.mkdtempSync(path.join(scratch,'durability-'));}

test('real concurrent processes and a fresh process readback preserve every atomic increment',async()=>{
  const dir=directory();const clock=()=>Date.parse('2026-11-14T12:00:00Z');
  const initial=new (load('src/lib/funnelStore.ts').FunnelStore)(dir,clock);initial.close();
  const loader=JSON.stringify(path.resolve('tests/helpers/load-ts.cjs'));
  const prefix=`const {createLoader}=require(${loader});const {FunnelStore}=createLoader()('src/lib/funnelStore.ts');const store=new FunnelStore(${JSON.stringify(dir)},()=>Date.parse('2026-11-14T12:00:00Z'));`;
  const iterations=[17,23];
  await Promise.all(iterations.map(n=>run(process.execPath,['-e',prefix+`for(let i=0;i<${n};i++)store.record({event:'page_view',page:'home'});store.close();`],{cwd:process.cwd(),timeout:20000})));
  const result=await run(process.execPath,['-e',prefix+'console.log(JSON.stringify(store.summary(1)));store.close();'],{cwd:process.cwd(),timeout:20000});
  assert.equal(JSON.parse(result.stdout).totals.views,iterations.reduce((a,b)=>a+b,0));
});
test('corrupt on-disk storage fails closed instead of returning empty success',async()=>{
  const dir=directory();fs.writeFileSync(path.join(dir,'funnel.sqlite'),'deliberately invalid SQLite fixture',{flag:'wx'});
  const oldLocal=process.env.ALPHABOARD_ANALYTICS_LOCAL,oldDir=process.env.ALPHABOARD_ANALYTICS_DIR;
  process.env.ALPHABOARD_ANALYTICS_LOCAL='1';process.env.ALPHABOARD_ANALYTICS_DIR=dir;
  try {
    const response=await load('src/app/api/analytics/summary/route.ts').GET(new NextRequest('http://127.0.0.1:3016/api/analytics/summary'));
    assert.equal(response.status,503);const data=await response.json();assert.equal(data.totals,undefined);assert.doesNotMatch(JSON.stringify(data),/durability-|SQLITE|C:\\/);
  } finally {
    if(oldLocal===undefined)delete process.env.ALPHABOARD_ANALYTICS_LOCAL;else process.env.ALPHABOARD_ANALYTICS_LOCAL=oldLocal;
    if(oldDir===undefined)delete process.env.ALPHABOARD_ANALYTICS_DIR;else process.env.ALPHABOARD_ANALYTICS_DIR=oldDir;
  }
});
