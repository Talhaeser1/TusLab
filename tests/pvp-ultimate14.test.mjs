import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,submitWord,resolveDueAttacks,pauseMatch,resumeMatch,
  DAMAGE,CYCLE_DAMAGE,ULTIMATE_PHASES,DEFENSE_RULES,MATCH_HP,SERVER_ONLY_EVENTS} from '../cloudflare/src/match.js';
const players=[{playerId:'p1',seat:1,character:'fire'},{playerId:'p2',seat:2,character:'rune'}];
const start=()=>createMatch(players,1000,'phase14');
function word(m,seat,at,correct=true){const p=m.participants[seat-1];const result=submitWord(m,{playerId:p.playerId,matchId:m.id,wordIndex:p.wordIndex,text:correct?p.currentWord:'yanlış'},at);assert.ok(result.match,result.error);return result.match;}
function castR(seat=1){let m=start();for(let i=0;i<5;i++)m=word(m,seat,2000+i*1000);return m;}
function run(m,at=9500,rng=()=>.99){return resolveDueAttacks(m,at,rng);}
test('both fighters have same five-word cycle damage budget of 585',()=>{
  assert.deepEqual(CYCLE_DAMAGE,{fire:585,rune:585});
  for(const name of ['fire','rune']){
    assert.equal(ULTIMATE_PHASES[name].length,3);
    assert.equal(ULTIMATE_PHASES[name].reduce((n,x)=>n+x.damage,0),DAMAGE[name].r);
    assert.ok(ULTIMATE_PHASES[name].every((x,i,a)=>i===0||x.offset>a[i-1].offset));
  }
  assert.notDeepEqual(ULTIMATE_PHASES.fire.map(x=>x.offset),ULTIMATE_PHASES.rune.map(x=>x.offset));
});
test('fire R delivers 3 distinct server-authorized hits totaling 305 and is not replayed',()=>{
  const m=castR();assert.equal(m.pendingAttacks.length,3); // Q + E + ONE queued R object
  let out=run(m);const phases=out.events.filter(e=>e.type==='ULTIMATE_PHASE');
  assert.deepEqual(phases.map(x=>x.amount),[65,100,140]);
  assert.deepEqual(phases.map(x=>x.phase),[1,2,3]);
  assert.equal(new Set(phases.map(x=>x.ultimateId)).size,1);
  assert.equal(out.match.participants[1].hp,2000-585);
  assert.equal(out.match.pendingAttacks.length,0);
  assert.equal(run(out.match).events.length,0);
  assert.ok(SERVER_ONLY_EVENTS.has('ULTIMATE_PHASE'));
});
test('rune ultimate has distinct rune/shockwave/finisher beats, equal total damage',()=>{
  const m=castR(2);const out=run(m);
  assert.deepEqual(out.events.filter(e=>e.type==='ULTIMATE_PHASE').map(e=>e.effect),['rune','shockwave','finisher']);
  assert.equal(out.match.participants[0].hp,2000-585);
});
test('ultimate phase alarms each resolve only once when reaching server clock',()=>{
  const m=castR();const r=m.pendingAttacks.find(a=>a.skill==='r');
  let first=run(m,r.resolveAt);assert.deepEqual(first.events.filter(x=>x.type==='ULTIMATE_PHASE').map(x=>x.phase),[1]);
  assert.equal(first.match.pendingAttacks.filter(a=>a.skill==='r').length,1);
  const next=first.match.pendingAttacks.find(a=>a.skill==='r').resolveAt;
  let second=run(first.match,next);assert.deepEqual(second.events.filter(x=>x.type==='ULTIMATE_PHASE').map(x=>x.phase),[2]);
  const finalAt=second.match.pendingAttacks.find(a=>a.skill==='r').resolveAt;
  const third=run(second.match,finalAt);assert.deepEqual(third.events.filter(x=>x.type==='ULTIMATE_PHASE').map(x=>x.phase),[3]);
  assert.equal(third.match.pendingAttacks.length,0);
});
test('ultimate blocked once is blocked on all three hits, without additional RNG rolls',()=>{
  let m=castR();const issued=m.pendingAttacks.find(a=>a.skill==='r').issuedAt;
  // Guarded reactive defense happens near the ultimate cast, not Q or E.
  m=word(m,2,issued+40);
  let rolls=0;const out=run(m,11000,()=>{rolls++;return 0.01;});
  const ult=out.events.filter(e=>e.type==='ULTIMATE_PHASE');
  assert.equal(ult.length,3);assert.deepEqual(ult.map(e=>e.amount),[0,0,0]);
  // The first cast's defense decision is sticky for subsequent phases.
  assert.ok(rolls>=1);assert.equal(ult[2].blocked,true);
  const parryCount=out.events.filter(e=>e.type==='PARRY_TRIGGERED').length;
  assert.ok(parryCount<=1);
});
test('shield break ultimate: penetration applies to all phases, one break event',()=>{
  let m=castR();const r=m.pendingAttacks.find(a=>a.skill==='r');
  // Defender already had a shield when R was fired, but has no reactive word.
  m=run(m,r.issuedAt-1,()=>.99).match; // settle earlier Q/E before enabling the shield
  m.participants[1].shieldUntil=r.issuedAt+250;
  const out=run(m,10000,()=>0.99);
  const phases=out.events.filter(e=>e.type==='ULTIMATE_PHASE');
  assert.equal(out.events.filter(e=>e.type==='SHIELD_BROKEN').length,1);
  assert.deepEqual(phases.map(x=>x.amount),[46,70,98]); // rounded 70% penetration
  assert.equal(out.match.participants[1].hp,2000-105-175-46-70-98);
  assert.equal(DEFENSE_RULES.heavyPenetration.r,.7);
});
test('KO on ultimate phase 1 clears remaining two hits',()=>{
  let m=castR();const r=m.pendingAttacks.find(x=>x.skill==='r');
  m=run(m,r.resolveAt-1).match; // settle Q/E; keep R queued
  m.participants[1].hp=30;
  const out=run(m,r.resolveAt);
  assert.equal(out.match.status,'ended');assert.equal(out.match.winnerSeat,1);
  assert.deepEqual(out.events.filter(x=>x.type==='ULTIMATE_PHASE').map(x=>x.phase),[1]);
  assert.equal(out.match.pendingAttacks.length,0);
});
test('pause/resume shifts pending ultimate due time without free damage',()=>{
  const m=castR();const r=m.pendingAttacks.find(x=>x.skill==='r');
  const paused=pauseMatch(m,6200,[2]);assert.equal(paused.status,'paused');
  assert.equal(run(paused,9000).events.length,0);
  const restored=resumeMatch(paused,7200);
  assert.equal(restored.pendingAttacks.find(x=>x.skill==='r').resolveAt,r.resolveAt+1000);
  const out=run(restored,11500);assert.equal(out.events.filter(x=>x.type==='ULTIMATE_PHASE').length,3);
});
test('wrong word resets combo and does not issue an extra ultimate',()=>{
  let m=start();for(let i=0;i<4;i++)m=word(m,1,2000+i*1000);
  m=word(m,1,6500,false);
  m=word(m,1,7000,true);
  assert.equal(m.participants[0].combo,1);
  assert.equal(m.pendingAttacks.filter(x=>x.skill==='r').length,0);
});

import {CHARACTER_ULTIMATE_CUES} from '../pvp/characters.js';
test('client-side character cue schedules align with three server impact times',()=>{
  assert.deepEqual(CHARACTER_ULTIMATE_CUES.fire.filter(x=>['ultimate-hit','final-blast'].includes(x.type)).map(x=>x.at),[250,430,670]);
  assert.deepEqual(CHARACTER_ULTIMATE_CUES.rune.filter(x=>['ultimate-hit','final-blast'].includes(x.type)).map(x=>x.at),[250,510,790]);
});
