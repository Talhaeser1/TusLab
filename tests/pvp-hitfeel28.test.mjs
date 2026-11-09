import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../pvp/vendor/three.module.min.js';
import {createArena3D} from '../pvp/arena3d.js';

// --------------------------------------------------------------- fake DOM

class FakeClassList {
  value = new Set();
  add(...x) { x.forEach(v => this.value.add(v)); }
  remove(...x) { x.forEach(v => this.value.delete(v)); }
  contains(x) { return this.value.has(x); }
}

function el(name, rect = {left: 0, top: 0, width: 0, height: 0}) {
  const node = {
    name,
    rect,
    style: {},
    attributes: {},
    children: [],
    parentNode: null,
    listeners: {},
    classList: new FakeClassList(),
    selectors: {},
    clientLeft: 0,
    clientTop: 0,
    get firstChild() { return this.children[0] || null; },
    querySelector(q) { return this.selectors[q] || null; },
    getBoundingClientRect() { return {...this.rect, right: this.rect.left + this.rect.width, bottom: this.rect.top + this.rect.height}; },
    setAttribute(k, v) { this.attributes[k] = v; },
    insertBefore(child, ref) {
      const i = ref ? this.children.indexOf(ref) : -1;
      if (i < 0) this.children.push(child); else this.children.splice(i, 0, child);
      child.parentNode = this;
      return child;
    },
    appendChild(child) { return this.insertBefore(child, null); },
    removeChild(child) { this.children = this.children.filter(c => c !== child); child.parentNode = null; },
    remove() { this.parentNode?.removeChild(this); },
    addEventListener(t, fn) { (this.listeners[t] ||= new Set()).add(fn); },
    removeEventListener(t, fn) { this.listeners[t]?.delete(fn); },
  };
  return node;
}

/** Fake arena: duel 1000×500 with two 480×300 stages side by side. */
function fakeArena() {
  const root = el('root');
  const duel = el('duel', {left: 0, top: 0, width: 1000, height: 500});
  const s1 = el('stage1', {left: 10, top: 100, width: 480, height: 300});
  const s2 = el('stage2', {left: 510, top: 100, width: 480, height: 300});
  root.selectors['.pvp2-duel'] = duel;
  duel.selectors['.pvp2-side[data-seat="1"] .pvp2-stage'] = s1;
  duel.selectors['.pvp2-side[data-seat="2"] .pvp2-stage'] = s2;
  duel.children.push(el('side1'), el('midline'), el('side2'));
  let clock = 1000;
  const doc = {
    hidden: false,
    listeners: {},
    createElement: () => {
      const c = el('canvas');
      c.getContext = () => null; // no WebGL, no 2D: like a headless browser
      return c;
    },
    addEventListener(t, fn) { (this.listeners[t] ||= new Set()).add(fn); },
    removeEventListener(t, fn) { this.listeners[t]?.delete(fn); },
  };
  root.ownerDocument = doc;
  const env = {
    document: doc,
    devicePixelRatio: 2,
    performance: {now: () => clock},
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: h => clearTimeout(h),
    advance(ms) { clock += ms; },
  };
  return {root, duel, doc, env, s1, s2};
}

function fakeRenderer() {
  return {
    calls: {render: 0, size: [], ratio: [], disposed: 0},
    setPixelRatio(r) { this.calls.ratio.push(r); },
    setSize(w, h) { this.calls.size.push([w, h]); },
    setClearColor() {},
    render(scene, camera) {
      assert.ok(scene.isScene && camera.isCamera);
      this.calls.render++;
    },
    dispose() { this.calls.disposed++; },
  };
}

const loadTexture = async () => new THREE.Texture();

async function buildArena(extra = {}) {
  const arena = fakeArena();
  const renderer = fakeRenderer();
  const instance = await createArena3D({
    root: arena.root, THREE, env: arena.env, isReduced: () => false,
    createRenderer: () => renderer, loadTexture, ...extra,
  });
  return {...arena, renderer, instance};
}

import {createArena3DHpBars, LOW_HP_RATIO} from '../pvp/arena3d-hpbars.js';
import {createLowHpFeedback, heartbeatInterval, lowHpLevel} from '../pvp/lowhp.js';

// ------------------------------------------------------------- paket 28

test('hit-feel: a landed hit freezes poses (hit-stop) and kicks the camera away from the attacker', async () => {
  const {instance, env} = await buildArena();
  for (const key of ['hitStop', 'kick']) assert.equal(typeof instance.api[key], 'function', key);
  instance.handle({type: 'SKILL_CAST', fromSeat: 1, toSeat: 2, skill: 'e'});
  env.advance(400); instance._debug.tick();
  instance.handle({type: 'DAMAGE_APPLIED', fromSeat: 1, toSeat: 2, amount: 140, blocked: false});
  const stop = instance._debug.hitStop();
  assert.equal(stop.seat, 2);
  assert.ok(stop.until - stop.start >= 110 && stop.until - stop.start <= 160, `heavy hit stop ${stop.until - stop.start} ms`);
  assert.equal(instance._debug.camera().kicks, 1);
  instance._debug.tick();
  const frozen = instance._debug.fighter(1).pose.fwd;
  env.advance(60); instance._debug.tick();
  assert.ok(Math.abs(instance._debug.fighter(1).pose.fwd - frozen) < 0.02, 'attacker holds the impact pose');
  env.advance(400); instance._debug.tick();
  assert.ok(Math.abs(instance._debug.fighter(1).pose.fwd - frozen) > 0.02, 'motion resumes after the stop');
  instance.clear();
  assert.equal(instance._debug.camera().kicks, 0);
  assert.equal(instance._debug.hitStop().until, 0);
  instance.destroy();
});

test('hit-feel: small hits stop briefly, overlapping stops extend; reduced mode disables both', async () => {
  let quiet = false;
  const {instance} = await buildArena({isReduced: () => quiet});
  instance.handle({type: 'DAMAGE_APPLIED', fromSeat: 2, toSeat: 1, amount: 20, blocked: false});
  const small = instance._debug.hitStop();
  assert.ok(small.until - small.start < 70, 'light hit: short stop');
  instance.api.hitStop(10, 1); // shorter request never cuts an active stop
  assert.equal(instance._debug.hitStop().until, small.until);
  instance.api.hitStop(9999, 1);
  assert.ok(instance._debug.hitStop().until - instance._debug.hitStop().start <= 160, 'clamped');
  instance.clear();
  quiet = true;
  instance.handle({type: 'DAMAGE_APPLIED', fromSeat: 2, toSeat: 1, amount: 140, blocked: false});
  assert.equal(instance._debug.hitStop().until, 0);
  assert.equal(instance._debug.camera().kicks, 0);
  instance.destroy();
});

test('hpbars: shown only while a fighter is pulled off its seat; ghost trail lags behind the fill', async () => {
  const {instance, env} = await buildArena();
  const bars = createArena3DHpBars(instance.api);
  instance.registerPlugin(bars);
  assert.equal(bars.stats()[1].visible, false);
  instance.handle({type: 'HP_SYNC', players: [{seat: 1, hp: 3000, maxHp: 3000}, {seat: 2, hp: 3000, maxHp: 3000, shield: true}]});
  let s = bars.stats();
  assert.equal(s[1].known, true);
  // A big E lunge moves the pose, never the seat: still hidden.
  instance.handle({type: 'SKILL_CAST', fromSeat: 1, toSeat: 2, skill: 'e'});
  env.advance(450); instance._debug.tick();
  bars.update(0.05, 1);
  assert.equal(bars.stats()[1].visible, false, 'at its seat the side panel shows HP; overhead bar stays hidden');
  // Ultimate pull: the defender travels to the centre → the bar fades in over it.
  instance.handle({type: 'SKILL_CAST', fromSeat: 2, toSeat: 1, skill: 'r'});
  instance.handle({type: 'ULTIMATE_PHASE', fromSeat: 2, toSeat: 1, phase: 1, character: 'rune'});
  for (let i = 0; i < 4; i++) { env.advance(80); instance._debug.tick(); }
  assert.ok(instance._debug.fighter(1).traveling || Math.abs(instance._debug.fighter(1).offset.x) > 0.5, 'defender pulled');
  for (let i = 0; i < 10; i++) bars.update(0.03, 1);
  assert.equal(bars.stats()[1].visible, true, 'bar follows the pulled fighter');
  s = bars.stats();
  assert.equal(s[2].shield, true);
  instance.handle({type: 'DAMAGE_APPLIED', fromSeat: 2, toSeat: 1, amount: 2400, blocked: false, hpAfter: 600});
  bars.update(0.05, 1);
  s = bars.stats()[1];
  assert.ok(Math.abs(s.target - 0.2) < 1e-9);
  assert.ok(s.shown < 1 && s.shown > s.target, 'fill eases down');
  assert.ok(s.ghost >= s.shown, 'ghost stays above the fill');
  assert.equal(s.low, true);
  assert.ok(LOW_HP_RATIO === 0.3);
  for (let i = 0; i < 120; i++) bars.update(0.05, 1 + i * 0.05);
  s = bars.stats()[1];
  assert.ok(Math.abs(s.shown - 0.2) < 1e-3 && Math.abs(s.ghost - 0.2) < 1e-3, 'both settle on the server value');
  instance.handle({type: 'SHIELD_BROKEN', seat: 2});
  assert.equal(bars.stats()[2].shield, false);
  // Garbage is ignored.
  for (const junk of [null, {type: 'HP_SYNC'}, {type: 'HP_SYNC', players: [{seat: 9, hp: 1, maxHp: 1}]}, {type: 'DAMAGE_APPLIED', toSeat: 1}]) {
    assert.doesNotThrow(() => instance.handle(junk));
  }
  instance.clear();
  assert.equal(bars.stats()[1].known, false);
  assert.equal(bars.stats()[1].visible, false);
  instance.destroy();
});

test('lowhp: thresholds, heartbeat pacing and overlay lifecycle', () => {
  assert.equal(lowHpLevel(0.5), 'off');
  assert.equal(lowHpLevel(0.2), 'low');
  assert.equal(lowHpLevel(0.05), 'critical');
  assert.equal(lowHpLevel(0), 'off', 'knocked out: no heartbeat');
  assert.equal(heartbeatInterval(0.4), null);
  assert.ok(heartbeatInterval(0.05) < heartbeatInterval(0.25), 'faster when closer to death');
  const timers = [];
  const scheduler = {setTimeout: (fn, ms) => { timers.push({fn, ms}); return timers.length; }, clearTimeout: () => {}};
  const {root} = fakeArena();
  root.ownerDocument.createElement = () => { const n = el('div'); n.dataset = {}; n.style.setProperty = () => {}; return n; };
  let beats = 0;
  const low = createLowHpFeedback({root, scheduler, heartbeat: () => { beats++; return true; }});
  assert.equal(low.update(0.9), 'off');
  assert.equal(root.children.length, 0, 'no overlay while healthy');
  assert.equal(low.update(0.1), 'critical');
  assert.equal(root.children.length, 1);
  assert.equal(root.children[0].dataset.level, 'critical');
  timers.at(-1).fn();
  assert.equal(beats, 1);
  assert.equal(low.update(0.1, false), 'off', 'match not running');
  low.hit(0.8);
  low.destroy();
  assert.equal(root.children.length, 0);
});
