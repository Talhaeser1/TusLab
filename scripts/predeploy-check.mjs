import assert from 'node:assert/strict';
import {readFile,stat,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const cf=join(root,'cloudflare');
const tests=[];
const check=(name,assertion)=>{assertion();tests.push(name);};
for(const [kind, filename, workerName] of [
  ['local','wrangler.jsonc','tuslab-neon-pvp-dev'],
  ['staging','wrangler.staging.jsonc','tuslab-neon-pvp-staging'],
  ['production','wrangler.production.jsonc','tuslab-neon-pvp']
]){
  const config=JSON.parse(await readFile(join(cf,filename),'utf8'));
  check(`${kind} worker yapılandırması`,()=>{
    assert.equal(config.name,workerName);
    assert.equal(config.main,'./src/index.js');
    assert.ok(config.compatibility_date>='2026-10-01');
    assert.equal(config.assets?.directory,'./public');
    assert.equal(config.assets?.binding,'ASSETS');
    assert.ok(config.assets?.run_worker_first?.includes('/api/*'));
    assert.equal(config.workers_dev,true);
    assert.equal(config.observability?.enabled,true);
  });
  check(`${kind} Durable Object binding ve migration`,()=>{
    assert.deepEqual(config.durable_objects.bindings.map(b=>b.class_name).sort(),['PvPGuard','PvPProfiles','PvPRoom']);
    assert.deepEqual(config.migrations.map(m=>m.tag),['v1','v2','v3']);
    assert.deepEqual(config.migrations.flatMap(m=>m.new_sqlite_classes).sort(),['PvPGuard','PvPProfiles','PvPRoom']);
  });
}
const published=join(cf,'public');
for(const path of ['index.html','favicon.svg','app.js','pvp/index.js','pvp/network.js','pvp/sound.js','assets']){
  const s=await stat(join(published,path));
  check(`yayın içeriği: ${path}`,()=>assert.ok(s.isFile()||s.isDirectory()));
}
check('sunucu kaynak kodu static assets içinde yok',()=>{});
const entries=await readdir(published);
assert.ok(!entries.includes('cloudflare')&&!entries.includes('tests')&&!entries.includes('node_modules')&&!entries.includes('.env'));
const worker=await readFile(join(cf,'src/index.js'),'utf8');
check('sağlık kontrolü ve WebSocket yönlendirmesi',()=>{
  assert.match(worker,/\/api\/health/);assert.match(worker,/Upgrade/);assert.match(worker,/PVP_ROOMS/);
});
const index=await readFile(join(published,'index.html'),'utf8');
check('statik başlangıç dosyası',()=>assert.match(index,/app\.js/));
for(const match of index.matchAll(/(?:src|href)=[\"'](\.\/[^\"']+)[\"']/g)) {
  const relative=match[1].slice(2);
  if(!relative || relative.includes('?') || relative.includes('#'))continue;
  const found=await stat(join(published,relative));
  check(`HTML bağımlılığı: ${relative}`,()=>assert.ok(found.isFile()));
}

console.log(`Ön dağıtım kontrolü başarılı: ${tests.length}/${tests.length} kontrol.`);
