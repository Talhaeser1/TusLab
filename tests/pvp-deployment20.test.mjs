import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, stat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import worker from '../cloudflare/src/index.js';
import {inviteLink} from '../pvp/network.js';
const root=resolve(import.meta.dirname,'..');
const cfg=async name=>JSON.parse(await readFile(join(root,'cloudflare',name),'utf8'));
test('phase20: local, staging and production configs preserve three SQLite class migrations',async()=>{
  const files=['wrangler.jsonc','wrangler.staging.jsonc','wrangler.production.jsonc'];
  const [local,staging,production]=await Promise.all(files.map(cfg));
  assert.notEqual(staging.name,production.name);
  assert.notEqual(local.name,production.name,'yerel yapılandırma production Worker adını kullanmamalı');
  assert.notEqual(local.name,staging.name);
  assert.equal(local.main,staging.main);
  for(const c of [local,staging,production]){
    assert.deepEqual(c.durable_objects.bindings.map(b=>b.class_name).sort(),['PvPGuard','PvPProfiles','PvPRoom']);
    assert.deepEqual(c.migrations.map(m=>m.tag),['v1','v2','v3']);
    assert.equal(c.assets.binding,'ASSETS');
    assert.ok(c.assets.run_worker_first.includes('/api/*'));
  }
});
test('phase20: public build includes frontend and excludes server entrypoint',async()=>{
  const dir=join(root,'cloudflare','public');
  for(const path of ['index.html','pvp/network.js','pvp/sound.js','arena-sound.js'])assert.ok((await stat(join(dir,path))).isFile());
  await assert.rejects(stat(join(dir,'src','index.js')));
  await assert.rejects(stat(join(dir,'tests','pvp-security18.test.mjs')));
});
test('phase20: protocol/health and same-origin rejection are enforced in the worker',async()=>{
  const env={ASSETS:{fetch:async()=>new Response('static file')}};
  const health=await worker.fetch(new Request('https://stage.example/api/health'),env);
  assert.equal(health.status,200);
  assert.deepEqual(Object.keys(await health.json()).filter(k=>k!=='time').sort(),['ok','protocol','service','stage']);
  assert.equal(health.headers.get('cache-control'),'no-store');
  const malicious=await worker.fetch(new Request('https://stage.example/api/pvp/rooms',{
    method:'POST',headers:{origin:'https://evil.test'},body:'{}'}),env);
  assert.equal(malicious.status,403);
  const notFound=await worker.fetch(new Request('https://stage.example/api/nothing'),env);
  assert.equal(notFound.status,404);
});
test('phase20: invitation link retains deployment host and uses HTTPS',()=>{
  const invite=inviteLink('https://tuslab-neon-pvp-staging.account.workers.dev/','ABCDEFGHJKLMNPQR');
  const url=new URL(invite);
  assert.equal(url.protocol,'https:');
  assert.equal(url.searchParams.get('pvpRoom'),'ABCDEFGHJKLMNPQR');
  assert.equal(url.hostname,'tuslab-neon-pvp-staging.account.workers.dev');
});
test('phase24: health stage comes from the shared release constant and local deploy script is gone',async()=>{
  const {RELEASE_STAGE}=await import('../pvp/release.js');
  const env={ASSETS:{fetch:async()=>new Response('static file')}};
  const body=await (await worker.fetch(new Request('https://stage.example/api/health'),env)).json();
  assert.equal(body.stage,RELEASE_STAGE);
  assert.ok(RELEASE_STAGE>=24);
  const pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
  assert.equal(pkg.scripts['cf:deploy'],undefined);
});
test('phase24: animation test buttons render only behind ?debug=1',async()=>{
  const js=await readFile(join(root,'pvp','index.js'),'utf8');
  assert.match(js,/\$\{DEBUG_TOOLS\?`<div class="pvp3-stage-tests"/);
  assert.doesNotMatch(js,/FAZ 21/);
});
