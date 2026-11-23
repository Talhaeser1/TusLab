import test from 'node:test';
import assert from 'node:assert/strict';
import {createCharacterController,MOTION_CUES} from '../pvp/characters.js';
import {clampParticles,MAX_PARTICLES,FX_CUES} from '../pvp/combat-fx.js';
function fakeScheduler(){
  let now=0,next=1;const pending=new Map();
  const scheduler={setTimeout(fn,ms){const id=next++;pending.set(id,{fn,at:now+ms});return id;},clearTimeout(id){pending.delete(id)}};
  function runTo(ms){while(true){const sorted=[...pending.entries()].sort((a,b)=>a[1].at-b[1].at||a[0]-b[0]);const item=sorted[0];if(!item||item[1].at>ms)break;pending.delete(item[0]);now=item[1].at;item[1].fn();}now=ms;}
  return {scheduler,pending,runTo,now:()=>now};
}
test('each attack includes visual cues with timestamps within timeline, and ultimate has >= 3 distinct hits',()=>{
  for(const action of ['q','e','s','r']){
    assert.ok(MOTION_CUES[action].length>=3);
    assert.deepEqual([...MOTION_CUES[action]].map(c=>c.at),[...MOTION_CUES[action]].map(c=>c.at).sort((a,b)=>a-b));
    for(const c of MOTION_CUES[action])assert.ok(FX_CUES.includes(c.type),c.type);
  }
  assert.ok(MOTION_CUES.r.filter(x=>['ultimate-hit','ground-smash','final-blast'].includes(x.type)).length>=3);
});
test('Q cue order follows anticipation/attack/impact/recovery',()=>{
  const clock=fakeScheduler(),events=[];
  const ctrl=createCharacterController({id:'fire',scheduler:clock.scheduler,onChange:e=>events.push([clock.now(),'phase',e.state]),onCue:e=>events.push([clock.now(),'cue',e.cue])});
  ctrl.trigger('q');clock.runTo(800);
  assert.deepEqual(events.filter(x=>x[1]==='phase').map(x=>x[2]),['anticipation','attack','recovery','idle']);
  assert.deepEqual(events.filter(x=>x[1]==='cue').map(x=>x[2]),['charge','blade-trail','strike','embers']);
  assert.equal(events.find(x=>x[2]==='strike')[0],290);
  assert.equal(clock.pending.size,0);
});
test('interruption cancels delayed attack cues before they fire',()=>{
  const clock=fakeScheduler(),cues=[];
  const ctrl=createCharacterController({id:'rune',scheduler:clock.scheduler,onCue:e=>cues.push(e.cue)});
  ctrl.trigger('r');clock.runTo(200);ctrl.trigger('hit');clock.runTo(3000);
  assert.ok(cues.includes('ultimate-charge'));
  assert.ok(cues.includes('damage-react'));
  assert.equal(cues.includes('ultimate-hit'),false);
  assert.equal(cues.includes('final-blast'),false);
  assert.equal(clock.pending.size,0);
});
test('queued Q E R cues start only after preceding motion ends',()=>{
  const clock=fakeScheduler(),cues=[];
  const ctrl=createCharacterController({id:'fire',scheduler:clock.scheduler,onCue:e=>cues.push([clock.now(),e.action,e.cue])});
  for(const key of ['q','e','r'])assert.equal(ctrl.trigger(key),true);
  clock.runTo(5000);
  assert.deepEqual(cues.filter(x=>x[2].includes('charge')).map(x=>x[1]),['q','e','r']);
  assert.equal(ctrl.getState().active,null);
  assert.equal(clock.pending.size,0);
});
test('VFX bounds never exceed six effects; bad values rejected',()=>{
  assert.equal(MAX_PARTICLES,6);
  assert.equal(clampParticles(4,6),2);
  assert.equal(clampParticles(6,6),0);
  assert.equal(clampParticles(0,3),3);
  assert.throws(()=>clampParticles(NaN,2),TypeError);
});
test('new FX is independent of multiplayer, HP and existing single-player engine',async()=>{
  const fs=await import('node:fs');
  const js=fs.readFileSync(new URL('../pvp/pvp-main.js',import.meta.url),'utf8');
  const css=fs.readFileSync(new URL('../pvp/combat-fx.css',import.meta.url),'utf8');
  assert.match(js,/createCombatFxDirector/);
  assert.match(js,/data-pvp-action="effects"/);
  assert.match(js,/data-demo-combo/);
  assert.match(css,/prefers-reduced-motion/);
  assert.ok(!js.includes('WebSocket('));
});
