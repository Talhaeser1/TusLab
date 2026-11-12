import test from 'node:test';
import assert from 'node:assert/strict';
import {createVisualTimeline, VISUAL_QUEUE} from '../pvp/visual-timeline.js';
import {createImpactDirector} from '../pvp/impact-feel.js';
import {TRAVEL} from '../pvp/fighters3d.js';

test('opposing attacks wait through recovery and return', () => {
  const trace = [], queue = createVisualTimeline();
  for (const seat of [1, 2]) queue.enqueue({seat, estimateMs: 1200,
    start: () => { trace.push(`start${seat}`); return {contactMs: 600, durationMs: 1200}; },
    onContact: () => trace.push(`contact${seat}`), onEnd: () => trace.push(`end${seat}`)});
  queue.tick(1199);
  assert.deepEqual(trace, ['start1', 'contact1']);
  queue.tick(1);
  assert.deepEqual(trace, ['start1', 'contact1', 'end1', 'start2']);
});

test('discarded scene delivers the damage number without hitstop or reaction', () => {
  let time = 0;
  const reactions = [], numbers = [];
  const director = createImpactDirector({now: () => time, isReduced: () => false,
    contact: event => reactions.push(event), deliver: event => numbers.push(event)});
  const event = {amount: 80};
  director.queue(event, () => false, 100);
  time = 101; director.flush();
  assert.deepEqual(numbers, [event]);
  assert.deepEqual(reactions, []);
  assert.equal(director.state.timeScale, 1);
});

test('backlog drops old waiting scenes without synthetic contacts and keeps travel visible', () => {
  const contacts = [], queue = createVisualTimeline();
  // İş 1, 3. tur: birikim eşiği okunur sahne süresine göre büyüdü (VISUAL_QUEUE.maxBacklogMs) → eşiği aşacak kadar sahne.
  const n = Math.ceil(VISUAL_QUEUE.maxBacklogMs / 1000) + 2;
  for (let i = 0; i < n; i++) queue.enqueue({seat: i % 2 + 1, estimateMs: 1000,
    start: ctx => { assert.equal(ctx.skipReturn, false); return {contactMs: 600, durationMs: 1000}; },
    onContact: ({forced}) => contacts.push(forced)});
  assert.equal(contacts.includes(true), false);
  assert.ok(queue.snapshot().forced > 0);
  assert.ok(TRAVEL.travelMs >= 300 && TRAVEL.travelMs <= 500);
  assert.ok(TRAVEL.fastTravelMs >= 300 && TRAVEL.fastTravelMs <= 500);
});

test('contact hitstop is limited to one start per 400 ms', () => {
  let time = 0;
  const director = createImpactDirector({now: () => time, isReduced: () => false,
    contact: () => {}, deliver: () => {}});
  director.hit({amount: 50});
  time = 200; director.hit({amount: 50});
  assert.equal(director.state.stopUntil, 90);
  time = 400; director.hit({amount: 50});
  assert.equal(director.state.stopUntil, 490);
});
