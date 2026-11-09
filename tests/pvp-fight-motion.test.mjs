import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createFightMotion, FIGHT_MOTION_LIMITS} from '../pvp/fight-motion.js';

class FakeClassList {
  value = new Set();
  add(...x) { x.forEach(v => this.value.add(v)); }
  remove(...x) { x.forEach(v => this.value.delete(v)); }
  contains(x) { return this.value.has(x); }
}

/** Fake element with a recording `animate()` (WAAPI subset). */
function el(name, log, children = {}) {
  return {
    name,
    classList: new FakeClassList(),
    querySelector: q => children[q] || null,
    animate(keyframes, options) {
      const listeners = {};
      const anim = {
        target: name, keyframes, options, cancelled: false,
        addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
        cancel() { if (this.cancelled) return; this.cancelled = true; (listeners.cancel || []).forEach(f => f()); },
        finish() { (listeners.finish || []).forEach(f => f()); }
      };
      log.push(anim);
      return anim;
    }
  };
}

function harness({reduced = false} = {}) {
  const log = [];
  let time = 0, next = 1;
  const pending = new Map();
  const scheduler = {
    setTimeout(fn, ms) { const k = next++; pending.set(k, {fn, at: time + ms}); return k; },
    clearTimeout(k) { pending.delete(k); }
  };
  const fastForward = to => {
    for (;;) {
      const e = [...pending].sort((a, b) => a[1].at - b[1].at)[0];
      if (!e || e[1].at > to) break;
      pending.delete(e[0]); time = e[1].at; e[1].fn();
    }
    time = to;
  };
  const model1 = el('model1', log), model2 = el('model2', log);
  const rig1 = el('rig1', log, {'.pvp3-model': model1});
  const rig2 = el('rig2', log, {'.pvp3-model': model2});
  const side1 = el('side1', log, {'.pvp3-rig': rig1});
  const side2 = el('side2', log, {'.pvp3-rig': rig2});
  const duel = el('duel', log);
  const root = el('root', log, {
    '.pvp2-side[data-seat="1"]': side1,
    '.pvp2-side[data-seat="2"]': side2,
    '.pvp2-duel': duel
  });
  let isReduced = reduced;
  const fm = createFightMotion({root, scheduler, isReduced: () => isReduced});
  const live = () => log.filter(a => !a.cancelled);
  const on = name => log.filter(a => a.target === name);
  return {fm, log, live, on, duel, root, pending, fastForward, setReduced: v => { isReduced = v; }};
}

const maxAbsX = anim => Math.max(...anim.keyframes.map(k => Math.abs(parseFloat(String(k.translate || '0')))));

test('fight-motion: factory exposes API and tolerates missing elements', () => {
  const fm = createFightMotion();
  for (const k of ['handle', 'onMatchEnd', 'clear', 'destroy']) assert.equal(typeof fm[k], 'function');
  assert.equal(fm.handle({type: 'SKILL_CAST', fromSeat: 1, skill: 'q'}), false);
  assert.doesNotThrow(() => fm.onMatchEnd({winnerSeat: 1}));
  const empty = createFightMotion({root: {querySelector: () => null}});
  assert.doesNotThrow(() => empty.handle({type: 'DAMAGE_APPLIED', toSeat: 2, amount: 90}));
  assert.equal(empty.handle(null), false);
  assert.equal(empty.handle({type: 'UNKNOWN'}), false);
  fm.destroy(); empty.destroy();
});

test('fight-motion: Q jab and E heavy lunge toward opponent with squash & stretch', () => {
  const h = harness();
  assert.equal(h.fm.handle({type: 'SKILL_CAST', fromSeat: 1, skill: 'q'}), true);
  const q = h.on('rig1')[0];
  assert.ok(q.keyframes.some(k => parseFloat(k.translate) > 5), 'fire lunges right');
  assert.ok(q.keyframes.some(k => parseFloat(k.translate) < 0), 'wind-up first');
  assert.equal(h.fm.handle({type: 'SKILL_CAST', fromSeat: 2, skill: 'e'}), true);
  const e = h.on('rig2')[0];
  assert.ok(e.keyframes.some(k => parseFloat(k.translate) < -10), 'rune lunges left');
  assert.ok(e.keyframes.some(k => k.scale && k.scale !== '1 1'), 'squash & stretch');
  assert.ok(maxAbsX(e) > maxAbsX(q), 'E steps in further than Q');
  // Only individual transform properties — never `transform`.
  for (const a of h.log) for (const k of a.keyframes) assert.equal('transform' in k, false);
});

test('fight-motion: ultimate phases escalate, phase 3 shakes the arena', () => {
  const h = harness();
  const reach = [];
  for (const phase of [1, 2, 3]) {
    h.fm.handle({type: 'ULTIMATE_PHASE', fromSeat: 1, phase});
    const last = h.on('rig1').at(-1);
    reach.push(last.options.duration);
  }
  assert.ok(reach[2] > reach[0] && reach[2] > reach[1]);
  assert.equal(h.on('duel').length, 1);
  // Body channel: only the latest phase is still live on the rig.
  assert.equal(h.on('rig1').filter(a => !a.cancelled).length, 1);
});

test('fight-motion: damage → knockback + flash + shake scaled by amount', () => {
  const h = harness();
  h.fm.handle({type: 'DAMAGE_APPLIED', toSeat: 2, amount: 30, hpAfter: 1900});
  const smallKb = h.on('rig2').at(-1), smallShake = h.on('duel').at(-1);
  assert.ok(h.on('model2').some(a => a.keyframes[0].filter?.includes('brightness')));
  assert.ok(parseFloat(smallKb.keyframes[3].translate) > 0, 'rune pushed right, away from fire');
  h.fm.handle({type: 'DAMAGE_APPLIED', toSeat: 2, amount: 140, skill: 'r', phase: 3, hpAfter: 1500});
  const bigKb = h.on('rig2').at(-1), bigShake = h.on('duel').at(-1);
  assert.ok(maxAbsX(bigKb) > maxAbsX(smallKb));
  const amp = a => Math.max(...a.keyframes.map(k => Math.abs(parseFloat(k.translate))));
  assert.ok(amp(bigShake) > amp(smallShake));
});

test('fight-motion: low HP wobble only under 30%', () => {
  const h = harness();
  h.fm.handle({type: 'DAMAGE_APPLIED', toSeat: 1, amount: 60, hpAfter: 1200});
  const before = h.on('model1').filter(a => a.keyframes[1]?.rotate).length;
  assert.equal(before, 0);
  h.fm.handle({type: 'DAMAGE_APPLIED', toSeat: 1, amount: 60, hpAfter: 400});
  assert.equal(h.on('model1').filter(a => a.keyframes[1]?.rotate).length, 1);
});

test('fight-motion: block braces, parry staggers attacker, shield break stumbles', () => {
  const h = harness();
  assert.equal(h.fm.handle({type: 'DAMAGE_APPLIED', toSeat: 2, amount: 90, blocked: true, blockKind: 'BLOCK'}), true);
  assert.equal(h.on('model2').length, 0, 'no hit flash when blocked');
  assert.ok(h.on('rig2').at(-1).keyframes.some(k => k.scale === '1.05 0.95'));
  assert.equal(h.fm.handle({type: 'PARRY_TRIGGERED', seat: 2, againstSeat: 1}), true);
  const stag = h.on('rig1').at(-1);
  assert.ok(stag.keyframes.some(k => parseFloat(k.translate) < 0), 'fire knocked back left');
  assert.ok(stag.keyframes.some(k => k.rotate && k.rotate !== '0deg'));
  assert.equal(h.fm.handle({type: 'SHIELD_BROKEN', seat: 1}), true);
  assert.ok(h.on('rig1').at(-1).options.duration >= 700);
  assert.equal(h.fm.handle({type: 'SHIELD_TRIGGERED', seat: 2, kind: 'PERFECT_BLOCK'}), true);
  assert.equal(h.fm.handle({type: 'COUNTERATTACK_CAST', fromSeat: 2}), true);
});

test('fight-motion: concurrent animations are capped', () => {
  const h = harness();
  for (let i = 0; i < 80; i++) {
    h.fm.handle({type: 'DAMAGE_APPLIED', toSeat: 1 + (i % 2), amount: 50 + i, hpAfter: 100});
    h.fm.handle({type: 'SKILL_CAST', fromSeat: 1 + (i % 2), skill: i % 2 ? 'q' : 'e'});
    h.fm.handle({type: 'PARRY_TRIGGERED', seat: 1, againstSeat: 2});
  }
  assert.ok(h.live().length <= FIGHT_MOTION_LIMITS.maxActive);
  assert.ok(h.fm.stats().active <= FIGHT_MOTION_LIMITS.maxActive);
  // Finished animations are released.
  for (const a of h.live()) a.finish();
  assert.equal(h.fm.stats().active, 0);
});

test('fight-motion: reduced mode only does a tiny opacity flash', () => {
  const h = harness({reduced: true});
  h.fm.handle({type: 'SKILL_CAST', fromSeat: 1, skill: 'e'});
  h.fm.handle({type: 'ULTIMATE_PHASE', fromSeat: 1, phase: 3});
  h.fm.handle({type: 'DAMAGE_APPLIED', toSeat: 2, amount: 140, skill: 'r', phase: 3});
  h.fm.onMatchEnd({winnerSeat: 1});
  assert.ok(h.log.length > 0);
  for (const a of h.log) {
    assert.match(a.target, /^model/);
    for (const k of a.keyframes) assert.deepEqual(Object.keys(k), ['opacity']);
  }
  assert.equal(h.on('duel').length, 0);
  // pvp4-reduced on the root also counts as reduced.
  const g = harness();
  g.root.classList.add('pvp4-reduced');
  g.fm.handle({type: 'DAMAGE_APPLIED', toSeat: 1, amount: 140});
  assert.ok(g.log.every(a => a.target.startsWith('model')));
});

test('fight-motion: knockout — loser collapses (held), winner hops, slow beat on arena', () => {
  const h = harness();
  assert.equal(h.fm.onMatchEnd({winnerSeat: 2}), true);
  const fall = h.on('rig1').at(-1);
  assert.equal(fall.options.fill, 'forwards');
  assert.ok(fall.options.duration >= 1000, 'slow-motion collapse');
  assert.equal(h.on('rig2').length, 0, 'winner hop is delayed');
  assert.ok(h.duel.classList.contains('pvpfm-ko'));
  h.fastForward(FIGHT_MOTION_LIMITS.koSlowMs);
  assert.equal(h.on('rig2').length, 1);
  assert.ok(h.on('rig2')[0].keyframes.some(k => parseFloat(String(k.translate).split(' ')[1]) < -5), 'hop up');
  assert.equal(h.duel.classList.contains('pvpfm-ko'), false);
  fall.finish();
  assert.equal(fall.cancelled, false, 'collapse pose is held until clear()');
  h.fm.clear();
  assert.equal(fall.cancelled, true);
  // Draw: no body motion.
  const d = harness();
  d.fm.onMatchEnd({winnerSeat: null});
  assert.equal(d.on('rig1').length + d.on('rig2').length, 0);
});

test('fight-motion: destroy cancels everything and ignores later events', () => {
  const h = harness();
  h.fm.handle({type: 'SKILL_CAST', fromSeat: 1, skill: 'e'});
  h.fm.handle({type: 'DAMAGE_APPLIED', toSeat: 2, amount: 120});
  h.fm.onMatchEnd({winnerSeat: 1});
  assert.ok(h.pending.size > 0);
  h.fm.destroy();
  assert.equal(h.live().length, 0);
  assert.equal(h.pending.size, 0);
  assert.equal(h.fm.stats().destroyed, true);
  const count = h.log.length;
  assert.equal(h.fm.handle({type: 'SKILL_CAST', fromSeat: 1, skill: 'q'}), false);
  h.fastForward(10000);
  assert.equal(h.log.length, count);
  assert.doesNotThrow(() => h.fm.destroy());
});

test('fight-motion: CSS stays on its own layer and honours reduced motion', () => {
  const css = readFileSync(new URL('../pvp/fight-motion.css', import.meta.url), 'utf8');
  assert.match(css, /pvpfm-ko/);
  assert.match(css, /prefers-reduced-motion/);
  assert.doesNotMatch(css, /transform\s*:/, 'never overrides existing transform rules');
});
