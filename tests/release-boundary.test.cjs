const {test,afterEach}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const React=require('react');
const {createLoader}=require('./helpers/load-ts.cjs');
const previous=process.env.ALPHABOARD_ANALYTICS_LOCAL;
afterEach(()=>{if(previous===undefined)delete process.env.ALPHABOARD_ANALYTICS_LOCAL;else process.env.ALPHABOARD_ANALYTICS_LOCAL=previous;});
test('local operator dashboard is a real 404 without explicit opt-in',()=>{
  process.env.ALPHABOARD_ANALYTICS_LOCAL='0';
  const page=createLoader()('src/app/analytics/page.tsx');
  assert.equal(page.dynamic,'force-dynamic');
  assert.throws(()=>page.default(),error=>error.digest==='NEXT_HTTP_ERROR_FALLBACK;404');
});
test('explicit local opt-in retains the user-approved operator UI',()=>{
  process.env.ALPHABOARD_ANALYTICS_LOCAL='1';
  assert.equal(React.isValidElement(createLoader()('src/app/analytics/page.tsx').default()),true);
});
test('portable aggregate tests do not depend on a developer home path',()=>{
  for(const name of ['funnel-analytics','funnel-client','funnel-durability','funnel-http']){
    const source=fs.readFileSync(path.join(__dirname,name+'.test.cjs'),'utf8');
    assert.doesNotMatch(source,/[A-Z]:\/Users\//i);
  }
});
