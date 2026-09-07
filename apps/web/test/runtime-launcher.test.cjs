const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync,readdirSync}=require('node:fs');
const {resolve}=require('node:path');
const app=resolve(__dirname,'..');

test('Railway launches the existing production Next server directly',()=>{
 const config=readFileSync(resolve(app,'../../railway.toml'),'utf8');
 assert.match(config,/^startCommand = "node node_modules\/next\/dist\/bin\/next start"$/m);
 assert.match(config,/^healthcheckPath = "\/admin\/login"$/m);
 const pkg=JSON.parse(readFileSync(resolve(app,'package.json'),'utf8'));
 assert.equal(pkg.scripts.start,'next start');
 assert.equal(pkg.scripts.prestart,undefined);
 assert.equal(pkg.scripts.poststart,undefined);
 assert.equal(pkg.dependencies.next,'16.2.3');
});

test('Wallet files and full server output remain in their original locations',()=>{
 const config=readFileSync(resolve(app,'next.config.ts'),'utf8');
 assert.doesNotMatch(config,/output\s*:\s*['"](?:export|standalone)['"]/);
 const assets=resolve(app,'wallet-assets/apple.pass');
 assert.equal(readdirSync(assets).filter(f=>f.endsWith('.png')).length,30);
 for(let stamps=0;stamps<=6;stamps++)for(const suffix of ['','@2x','@3x']){
  const png=readFileSync(resolve(assets,`stamp-strip-${stamps}${suffix}.png`));
  assert.deepEqual(png.subarray(0,8),Buffer.from([137,80,78,71,13,10,26,10]));
 }
});
