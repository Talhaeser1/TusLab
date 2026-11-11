import test from 'node:test';
import assert from 'node:assert/strict';
import {createVisualTimeline, TURN} from '../pvp/visual-timeline.js';
import {hitReaction, createImpactDirector} from '../pvp/impact-feel.js';
import {chainTiming, chainProgress, COMBO} from '../pvp/fighters3d.js';
import {comboLabel, createComboCounter} from '../pvp/combo-counter.js';
import {calloutText, createDisplayedHpModel} from '../pvp/attack-callout.js';

test('iki koltuk: ikinci saldırı birincinin dönüşünden + nefesten sonra başlar', () => {
  const trace = [], q = createVisualTimeline({breathMs: TURN.breathMs});
  for (const seat of [1, 2]) q.enqueue({seat, estimateMs: 800,
    start: () => { trace.push(`start${seat}`); return {contacts: [{ms: 300, fn: () => trace.push(`hit${seat}`)}], durationMs: 800}; }});
  q.tick(799);
  assert.deepEqual(trace, ['start1', 'hit1']);
  q.tick(1); // 1. koltuk döndü; nefes başladı
  assert.deepEqual(trace, ['start1', 'hit1']);
  q.tick(TURN.breathMs - 1);
  assert.equal(trace.includes('start2'), false);
  q.tick(2);
  assert.ok(trace.includes('start2'));
  assert.ok(TURN.breathMs >= 150 && TURN.breathMs <= 250);
});

test('kombo: 3 temas tek girdide; snapshot approach → strike → return, comboIndex artar', () => {
  const hits = [], q = createVisualTimeline();
  q.enqueue({seat: 1, estimateMs: 1100, start: () => ({
    contacts: [340, 600, 860].map((ms, i) => ({ms, fn: () => hits.push(i)})), durationMs: 1100, returnStartMs: 960})});
  assert.equal(q.snapshot().phase, 'approach');
  q.tick(341); assert.equal(q.snapshot().phase, 'strike'); assert.equal(q.snapshot().comboIndex, 1);
  q.tick(260); assert.equal(q.snapshot().comboIndex, 2);
  q.tick(260); assert.deepEqual(hits, [0, 1, 2]);
  assert.equal(q.snapshot().activeSeat, 1);
  q.tick(150); assert.equal(q.snapshot().phase, 'return');
  q.tick(300); assert.equal(q.snapshot().phase, 'idle'); assert.equal(q.snapshot().active, false);
});

test('chainTiming: 3 vuruş = tek yaklaşma + 3 temas + tek dönüş; kombo etiketi 2,3', () => {
  const t = chainTiming(3);
  assert.equal(t.contacts.length, 3);
  assert.ok(t.lead >= 300 && t.lead <= 500, 'yaklaşma 300–500 ms');
  assert.equal(t.contacts[1] - t.contacts[0], t.gap);
  assert.equal(t.totalMs, t.contacts[2] + t.hold + t.returnMs);
  assert.ok(chainTiming(9).count <= COMBO.maxStrikes, 'süre tavanı: en fazla N vuruş');
  assert.equal(comboLabel(0), null);
  assert.equal(comboLabel(1), '2 KOMBO!');
  assert.equal(comboLabel(2), '3 KOMBO!');
  // Eğri sürekli ve ışınlanmasız: yaklaşma 0→1, dönüş 1→0.
  const o = {travelMs: t.lead, returnStart: t.returnStart, returnMs: t.returnMs};
  assert.equal(chainProgress(0, o), 0);
  assert.ok(Math.abs(chainProgress(t.lead, o) - 1) < 1e-6);
  assert.ok(Math.abs(chainProgress(t.totalMs, o)) < 1e-6);
  let prev = 0;
  for (let ms = 0; ms <= t.totalMs; ms += 10) { const v = chainProgress(ms, o); assert.ok(Math.abs(v - prev) < 0.1); prev = v; }
});

test('kombo sayacı DOM: 2+ vuruşta görünür, bitişten sonra gizlenir, aria-hidden', () => {
  const timers = [];
  const mk = () => ({attrs: {}, hidden: false, className: '', textContent: '', classList: {add() {}, remove() {}},
    setAttribute(k, v) { this.attrs[k] = v; }, remove() {}, offsetWidth: 0});
  const root = {listeners: {}, ownerDocument: {createElement: mk}, append(e) { this.child = e; },
    addEventListener(t, f) { this.listeners[t] = f; }, removeEventListener() {}};
  const c = createComboCounter({root, setTimer: (fn, ms) => { timers.push({fn, ms}); return timers.length; }, clearTimer() {}});
  assert.equal(c.el.attrs['aria-hidden'], 'true');
  assert.ok('data-combo-counter' in c.el.attrs);
  root.listeners['tuslab:pvp-strike']({detail: {seat: 1, index: 0}});
  assert.equal(c.el.hidden, true, 'tek vuruşta sayaç yok');
  root.listeners['tuslab:pvp-strike']({detail: {seat: 1, index: 1}});
  assert.equal(c.el.textContent, '2 KOMBO!');
  root.listeners['tuslab:pvp-strike']({detail: {seat: 1, index: 2}});
  assert.equal(c.el.textContent, '3 KOMBO!');
  root.listeners['tuslab:pvp-combo-end']();
  assert.equal(timers.at(-1).ms, 600);
  timers.at(-1).fn();
  assert.equal(c.el.hidden, true);
});

test('hasar tepkisi: son vuruş heavy, can 0 knockdown, 180 ms içinde trace', () => {
  assert.equal(hitReaction({amount: 40}, {lastAt: -Infinity, now: 1000}), 'hit');
  assert.equal(hitReaction({amount: 40, finisher: true}, {}), 'heavy');
  assert.equal(hitReaction({amount: 40, hpAfter: 0}, {}), 'knockdown');
  assert.equal(hitReaction({amount: 40}, {lastAt: 900, now: 1000}), 'trace');
});

test('klipsiz hasar hitstop tetiklemez; 400 ms içinde en fazla 1 hitstop', () => {
  let time = 0;
  const director = createImpactDirector({now: () => time, isReduced: () => false, contact: () => {}, deliver: () => {}});
  const silent = {amount: 80};
  director.silent(silent);
  assert.equal(director.state.stopUntil, 0, 'sessiz (sahnesiz) hasar durdurma yapmaz');
  const a = {amount: 80}, b = {amount: 80};
  director.queue(a, () => true); director.flush();
  const first = director.state.lastStopAt;
  time = 200; director.queue(b, () => true); director.flush();
  assert.equal(director.state.lastStopAt, first, '400 ms içinde ikinci hitstop yok');
});

test('saldırı yazısı: "A → B · AD · −N", blokta BLOK', () => {
  assert.equal(calloutText({attacker: 'vargr', defender: 'nyx', skill: 'q', amount: 120}), 'VARGR → NYX · BALTA SAVURUŞU · −120');
  assert.match(calloutText({attacker: 'nyx', defender: 'doran', skill: 'r', amount: 200}), /^NYX → DORAN · YILDIZ ÇÖKÜŞÜ · −200$/);
  assert.match(calloutText({attacker: 'sira', defender: 'vargr', skill: 'q', amount: 30, blocked: true}), /BLOK −30$/);
});

test('gösterilen can: temas karesinden önce düşmez, kuyruk bitince gerçeğe eşitlenir', () => {
  const m = createDisplayedHpModel();
  m.sync([{seat: 1, hp: 1000}, {seat: 2, hp: 1000}], false);
  m.expect(2);
  m.sync([{seat: 1, hp: 1000}, {seat: 2, hp: 880}], true); // sunucu düşürdü, sahne henüz temasa varmadı
  assert.equal(m.values()[2], 1000);
  assert.equal(m.held(), true);
  m.impact(2, 880); // temas karesi
  assert.equal(m.values()[2], 880);
  m.sync([{seat: 1, hp: 1000}, {seat: 2, hp: 700}], true);
  assert.equal(m.values()[2], 880, 'sonraki hasar kendi temasına kadar bekler');
  m.release(); // kuyruk boşaldı
  assert.equal(m.values()[2], 700);
  assert.equal(m.held(), false);
});
