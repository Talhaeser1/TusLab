import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createCharacterController,rigMarkup,MOTIONS} from '../pvp/characters.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
function harness(id='fire'){
 let next=1;const calls=new Map();const updates=[];
 const scheduler={setTimeout(f,ms){const n=next++;calls.set(n,{f,ms});return n;},clearTimeout(n){calls.delete(n);}};
 const ctrl=createCharacterController({id,scheduler,onChange:e=>updates.push(e)});
 const tick=()=>{const [k,v]=calls.entries().next().value||[];if(!k)return false;calls.delete(k);v.f();return true;};
 return {ctrl,updates,tick,calls};
}
test('all 9 animation states are covered by phases',()=>{
 const phases=new Set(Object.values(MOTIONS).flat().map(s=>s.state));
 for(const k of ['idle','anticipation','attack','heavy','shield','hit','ultimate','victory','defeat','recovery'])assert.ok(phases.has(k),k);
});
test('Q animation transitions through anticipation, attack, recovery and idle',()=>{
 const h=harness();assert.equal(h.ctrl.trigger('q'),true);
 while(h.tick()){};
 assert.deepEqual(h.updates.map(x=>x.state),['anticipation','attack','recovery','idle']);
 assert.equal(h.ctrl.getState().active,null);
});
test('queued moves execute in order with maximum of 3 pending',()=>{
 const h=harness('rune');h.ctrl.trigger('q');for(let i=0;i<3;i++)assert.equal(h.ctrl.trigger('e'),true);
 assert.equal(h.ctrl.trigger('q'),false);
 while(h.tick()){}
 assert.equal(h.updates.filter(x=>x.state==='heavy').length,3);
 assert.equal(h.ctrl.getState().queued.length,0);
});
test('hit interrupt cancels queued attack; defeat persists until idle or new action',()=>{
 const h=harness();h.ctrl.trigger('r');h.ctrl.trigger('q');h.ctrl.trigger('hit');
 assert.equal(h.ctrl.getState().active,'hit');while(h.tick()){};
 assert.equal(h.updates.some(x=>x.state==='ultimate'),false);
 h.ctrl.trigger('defeat');assert.equal(h.ctrl.getState().state,'defeat');assert.equal(h.calls.size,0);
 h.ctrl.trigger('idle');assert.equal(h.ctrl.getState().state,'idle');assert.equal(h.ctrl.trigger('q'),true);assert.equal(h.ctrl.getState().state,'anticipation');
});
test('dispose prevents timers and actions; invalid id and action are rejected',()=>{
 assert.throws(()=>createCharacterController({id:'attacker'}));
 const h=harness();assert.equal(h.ctrl.trigger('hp:999'),false);h.ctrl.trigger('q');h.ctrl.dispose();
 assert.equal(h.ctrl.getState().disposed,true);assert.equal(h.calls.size,0);assert.equal(h.ctrl.trigger('r'),false);
});
test('characters use distinct art layers, and ability cards trigger real motion previews',()=>{
 const js=readFileSync(resolve(root,'pvp/pvp-main.js'),'utf8');
 for(const id of ['fire','rune']){
  const markup=rigMarkup(id);
  for(const layer of ['core','weapon','guard']){
   assert.match(markup,new RegExp(id+'-'+layer+'\\.webp'));
   assert.ok(existsSync(resolve(root,`assets/rig/${id}-${layer}.webp`)));
  }
 }
 assert.match(js,/data-demo-action=/);
 assert.match(js,/tuslab:pvp-animation/);
 const css=readFileSync(resolve(root,'pvp/character-motion.css'),'utf8');
 for(const state of ['attack','heavy','shield','hit','ultimate','victory','defeat'])assert.ok(css.includes(`data-motion='${state}'`),state);
 assert.match(css,/prefers-reduced-motion/);
});
