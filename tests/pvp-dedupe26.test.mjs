import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const read=path=>readFile(join(root,path),'utf8');

test('phase26: combat events go to the 3D arena OR the 2D motion/particle layers, never both',async()=>{
  const js=await read('pvp/pvp-main.js');
  assert.match(js,/if\(arena3d\.instance\)arena3d\.instance\.handle\(action\);\s*else\{fx24\.motion\?\.handle\(action\);fx24\.particles\?\.handle\(action\);\}/);
  assert.doesNotMatch(js,/fx24\.particles\?\.handle\(action\);arena3d\.instance\?\.handle\(action\)/);
  assert.match(js,/if\(!arena3d\.instance\)fx24\.motion\?\.onMatchEnd/);
  // Pixel damage numbers stay in both modes.
  assert.match(js,/fx24\.damage\?\.handle\(action\);/);
});

test('phase26: text banners and ultimate phase marks yield to pixel labels',async()=>{
  const js=await read('pvp/pvp-main.js');
  assert.match(js,/function pvp13Banner\(seat,text,kind\)\{\s*if\(!root\|\|reducedEffects\|\|fx24\.damage\)return;/);
  assert.match(js,/if\(side&&!fx24\.damage\)/);
});

test('phase26: 3D mode hides legacy DOM/2D effects but keeps the damage-number container',async()=>{
  const css=await read('pvp/arena3d.css');
  for(const selector of ['.pvp10-projectile','.pvp10-cross-impact','.pvp3-vfx','.pvp21-layer','.pvp4-particle','.pvp4-effect','.pvp24-particles']){
    assert.ok(css.includes(`#pvp-root.pvp26-3d ${selector}`),`3B modda gizlenmeli: ${selector}`);
  }
  assert.ok(!/#pvp-root\.pvp26-3d \.pvp4-effects\b/.test(css),'hasar sayısı kabı (.pvp4-effects) gizlenmemeli');
});

test('arena results do not show a rounds-won scoreline (HP decides arena matches)',async()=>{
  const js=await read('pvp/rounds-ui.js');
  assert.match(js,/match\?\.mode!=='arena'&&match\?\.result\?\.mode!=='arena'\?roundsResultModel/);
});

test('network: a match packet paints the arena once (no second updateArena in the same packet)', async () => {
  const js = await read('pvp/network.js');
  assert.match(js, /this\.updateArena\(\);\r?\n[^\n]*\n\s*this\.arenaFresh=true;/);
  assert.match(js, /if\(this\.arenaFresh\)this\.arenaFresh=false;else this\.updateArena\(\);/);
  const render = js.slice(js.indexOf('  render(){'), js.indexOf('  render(){') + 1500);
  assert.equal((render.match(/this\.renderConnection\(\)/g) || []).length, 1, 'render bağlantıyı bir kez çizmeli');
});
