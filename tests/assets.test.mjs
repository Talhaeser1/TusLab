import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
test('all script and stylesheet refs from index.html exist',()=>{
 const html=readFileSync(resolve(root,'index.html'),'utf8');
 const names=[...html.matchAll(/(?:src|href)="(\.\/[^"#]+\.(?:css|js|svg))"/g)].map(match=>match[1]);
 assert.ok(names.length>5);
 for(const n of names)assert.ok(existsSync(resolve(root,n)),`missing ${n}`);
});
test('PvP artwork is shipped and the network backend is not falsely bundled',()=>{
 assert.ok(existsSync(resolve(root,'assets/arena-king.webp')));
 assert.ok(existsSync(resolve(root,'assets/castle-scene.webp')));
 const state=readFileSync(resolve(root,'pvp/state.js'),'utf8');
 assert.match(state,/UNCONFIGURED/);
});

test('heavy images ship as small webp (slow connections load the arena)', async () => {
  const {statSync} = await import('node:fs');
  for (const f of ['assets/castle-scene.webp','assets/arena-king.webp','assets/rune-preview.webp',
    ...['fire','rune'].flatMap(id => ['core','guard','weapon'].map(l => `assets/rig/${id}-${l}.webp`))]) {
    assert.ok(statSync(resolve(root, f)).size < 400 * 1024, f + ' 400 KB altında olmalı');
  }
});

test('pvp music is not fetched while the arena images load (deferred to idle)', () => {
  const js = readFileSync(resolve(root, 'pvp/pvp-main.js'), 'utf8');
  assert.doesNotMatch(js, /void pvpMusic\.preload\(\);pvpMusic\.setScene/);
  assert.match(js, /deferMusicPreload\(\);pvpMusic\.setScene\('lobby'\)/);
  assert.match(js, /requestIdleCallback/);
});
