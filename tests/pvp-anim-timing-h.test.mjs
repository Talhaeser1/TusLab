import test from 'node:test';
import assert from 'node:assert/strict';
import {createVisualTimeline} from '../pvp/visual-timeline.js';
import {TRAVEL,travelProgress,travelEase} from '../pvp/fighters3d.js';
import {clampAttackSpeed} from '../pvp/anim-state.js';

test('visual timeline serializes casts and delivers their cosmetic contacts in order',()=>{
  const trace=[];const tl=createVisualTimeline();
  const add=seat=>tl.enqueue({seat,estimateMs:700,start:()=>{trace.push(`start${seat}`);return {contactMs:400,durationMs:700};},
    onContact:()=>trace.push(`hit${seat}`),onEnd:()=>trace.push(`end${seat}`)});
  add(1);add(2);
  assert.deepEqual(trace,['start1']);
  tl.tick(399);assert.deepEqual(trace,['start1']);
  tl.tick(1);assert.deepEqual(trace,['start1','hit1']);
  tl.tick(300);assert.deepEqual(trace,['start1','hit1','end1','start2']);
  tl.tick(700);assert.deepEqual(trace,['start1','hit1','end1','start2','hit2','end2']);
  assert.equal(tl.isBusy(),false);
});

test('visual timeline compresses backlog and drains all pending contacts at round end',()=>{
  const contexts=[],hits=[];const tl=createVisualTimeline();
  for(let i=0;i<5;i++)tl.enqueue({seat:1,estimateMs:900,start:ctx=>{contexts.push(ctx);return {contactMs:450,durationMs:900};},onContact:({forced})=>hits.push(forced)});
  tl.tick(900);
  assert.equal(contexts[1].compress,true);
  assert.equal(contexts[1].skipReturn,true);
  tl.drain(1500);tl.tick(1500);
  assert.equal(tl.isBusy(),false);
  assert.equal(hits.length,5);
  assert.ok(hits.some(Boolean));
});

test('travel is continuous for 60 fps and returns home; attack speed stays at most 1.2',()=>{
  assert.ok(TRAVEL.travelMs>=300&&TRAVEL.travelMs<=500);
  let previous=0,maxStep=0;
  for(let ms=0;ms<=TRAVEL.travelMs;ms+=1000/60){
    const x=travelEase(ms/TRAVEL.travelMs);maxStep=Math.max(maxStep,Math.abs(x-previous));previous=x;
  }
  assert.ok(maxStep<=0.25,`largest frame travel ${maxStep}`);
  const plan={travelMs:TRAVEL.travelMs,hitMs:1400,holdMs:400,returnMs:420};
  assert.equal(travelProgress(0,plan),0);
  assert.equal(travelProgress(plan.hitMs,plan),1);
  assert.equal(travelProgress(2220,plan),0);
  assert.equal(clampAttackSpeed(3),1.2);
});

test('reduced motion completes visual queue immediately',()=>{
  const hits=[];const tl=createVisualTimeline({isReduced:()=>true});
  tl.enqueue({seat:1,estimateMs:900,start:()=>({contactMs:450,durationMs:900}),onContact:()=>hits.push(1)});
  assert.deepEqual(hits,[1]);assert.equal(tl.isBusy(),false);
});
