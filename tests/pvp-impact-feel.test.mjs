import test from 'node:test';
import assert from 'node:assert/strict';
import {IMPACT_TIERS, impactTier, createImpactState, addTrauma, stepImpact,
  beginHitstop, restoreHitstop, triggerImpact, resetImpact, createImpactDirector, sampleImpact} from '../pvp/impact-feel.js';

test('impact tiers derive from damage and skill with fixed contact durations', () => {
  assert.deepEqual(Object.values(IMPACT_TIERS).map(x => [x.hitstopMs,x.trauma]), [[60,.2],[90,.45],[120,.8]]);
  assert.equal(impactTier({amount:12}), 'small');
  assert.equal(impactTier({amount:45,skill:'q'}), 'medium');
  assert.equal(impactTier({amount:160}), 'large');
  assert.equal(impactTier({skill:'r'}), 'large');
  assert.equal(impactTier({type:'KNOCKOUT'}), 'large');
});
test('trauma adds, saturates and decays by real seconds', () => {
  const s=createImpactState(); addTrauma(s,.2); addTrauma(s,.45);
  assert.equal(s.trauma,.65);
  stepImpact(s,.1,100); assert.ok(Math.abs(s.trauma-.49)<1e-9);
  addTrauma(s,.8); assert.equal(s.trauma,1);
  stepImpact(s,1,1100); assert.equal(s.trauma,0);
});
test('only newest hitstop identity can restore visual time', () => {
  const s=createImpactState(); const old=beginHitstop(s,100,120);
  const recent=beginHitstop(s,150,60);
  assert.equal(restoreHitstop(s,old,230),false);
  assert.equal(s.timeScale,.05);
  assert.equal(restoreHitstop(s,recent,205),false);
  assert.equal(restoreHitstop(s,recent,230),true);
  assert.equal(s.timeScale,1);
});
test('reduced motion disables shake punch zoom and slow motion, including an active hit', () => {
  const s=createImpactState(); triggerImpact(s,{skill:'r',amount:180,fromSeat:1},0);
  const frame=stepImpact(s,.016,16,true);
  assert.equal(frame.shakeX,0); assert.equal(frame.shakeY,0);
  assert.equal(frame.punch,0); assert.equal(frame.zoom,0); assert.equal(frame.timeScale,1);
});
test('reset invalidates old timers and restores all impact channels', () => {
  const s=createImpactState(); triggerImpact(s,{skill:'r',amount:180},0);
  const old=s.stopId; resetImpact(s);
  assert.equal(restoreHitstop(s,old,1000),false);
  const frame=stepImpact(s,.1,1000);
  assert.equal(s.trauma,0); assert.equal(frame.punch,0); assert.equal(frame.zoom,0);
  assert.equal(frame.timeScale,1); assert.equal(frame.shakeX,0);
});
test('camera decay is independent of frame rate and returns to rest', () => {
  const a=createImpactState(), b=createImpactState();
  triggerImpact(a,{amount:40},0); triggerImpact(b,{amount:40},0);
  for(let i=1;i<=60;i++)stepImpact(a,1/60,i*1000/60);
  for(let i=1;i<=30;i++)stepImpact(b,1/30,i*1000/30);
  assert.ok(Math.abs(a.punch-b.punch)<1e-9);
  stepImpact(a,10,11000); assert.equal(a.punch,0); assert.equal(a.zoom,0);
});
test('contact delivers reaction and feedback together once, only when ready', () => {
  let time=0, arrived=false; const calls=[];
  const d=createImpactDirector({now:()=>time,isReduced:()=>false,
    contact:e=>calls.push(['reaction',e,time]),deliver:e=>calls.push(['feedback',e,time])});
  const event={amount:60,skill:'q'};
  d.queue(event,()=>arrived); d.flush(); assert.equal(calls.length,0);
  time=540; arrived=true; d.flush(); d.hit(event);
  assert.deepEqual(calls.map(x=>[x[0],x[2]]),[['reaction',540],['feedback',540]]);
});
test('reset discards pending contact, missing projectile has a bounded visual fallback', () => {
  let time=0, delivered=0;
  const d=createImpactDirector({now:()=>time,isReduced:()=>false,contact:()=>{},deliver:()=>delivered++});
  d.queue({amount:20},()=>false); d.clear(); time=3000; d.flush(); assert.equal(delivered,0);
  d.queue({amount:20},()=>false); time=5500; d.flush(); assert.equal(delivered,1);
});
test('large stop releases into 320ms visual slow motion and then normal time', () => {
  const s=createImpactState(); triggerImpact(s,{skill:'r'},100);
  assert.equal(stepImpact(s,0,219).timeScale,.05);
  assert.equal(stepImpact(s,0,220).timeScale,.3);
  assert.equal(stepImpact(s,0,540).timeScale,1);
});
test('a failed visual adapter cannot suppress damage text or audio delivery', () => {
  let delivered=0;
  const d=createImpactDirector({now:()=>0,isReduced:()=>false,
    contact:()=>{throw new Error('renderer unavailable');},deliver:()=>delivered++});
  assert.doesNotThrow(()=>d.hit({amount:50}));
  assert.equal(delivered,1);
});
test('frame policy is a pure calculation over an immutable state snapshot', () => {
  const input=Object.freeze({...createImpactState(),trauma:.45,punch:.2,zoom:.1});
  const a=sampleImpact(input,.1,100),b=sampleImpact(input,.1,100);
  assert.deepEqual(a,b);
  assert.equal(input.trauma,.45);assert.equal(input.punch,.2);
  assert.ok(Math.abs(a.state.trauma-.29)<1e-9);
  assert.ok(a.frame.punch<.2);
});
