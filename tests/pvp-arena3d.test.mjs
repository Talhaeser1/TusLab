import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../pvp/vendor/three.module.min.js';
import {createArena3D, ARENA_ENV_CAPS} from '../pvp/arena3d.js';

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

// ------------------------------------------------------------------ tests

test('arena3d: no WebGL → null and the DOM is untouched', async () => {
  const {root, duel, env} = fakeArena();
  const before = duel.children.slice();
  const result = await createArena3D({root, THREE, env});
  assert.equal(result, null);
  assert.deepEqual(duel.children, before);
  assert.equal(root.classList.contains('pvp26-3d'), false);
});

test('arena3d: missing arena markup or bad renderer → null without throwing', async () => {
  const {env} = fakeArena();
  const empty = el('root');
  empty.ownerDocument = env.document;
  assert.equal(await createArena3D({root: empty, THREE, env, createRenderer: fakeRenderer}), null);
  assert.equal(await createArena3D({root: null, THREE, env}), null);
  const {root, duel} = fakeArena();
  const throwing = await createArena3D({root, THREE, env, createRenderer: () => { throw new Error('no gl'); }});
  assert.equal(throwing, null);
  assert.equal(duel.children.some(c => c.className === 'pvp26-canvas'), false);
});

test('arena3d: builds with a fake renderer, mounts one canvas over the whole duel area', async () => {
  const {instance, duel, root, renderer} = await buildArena();
  assert.ok(instance);
  assert.equal(instance.available, true);
  assert.equal(instance.canvas.className, 'pvp26-canvas');
  assert.equal(duel.children[0], instance.canvas, 'canvas is the first child of .pvp2-duel');
  assert.equal(duel.children.filter(c => c.className === 'pvp26-canvas').length, 1);
  // Side-by-side stages: the canvas fills the whole duel (arena behind HP and stands).
  assert.equal(instance.canvas.style.left, '0px');
  assert.equal(instance.canvas.style.top, '0px');
  assert.equal(instance.canvas.style.width, '1000px');
  assert.equal(instance.canvas.style.height, '500px');
  assert.equal(instance.canvas.style.pointerEvents, 'none');
  assert.deepEqual(renderer.calls.size.at(-1), [1000, 500]);
  assert.equal(await instance.ready, true);
  assert.equal(root.classList.contains('pvp26-3d'), true);
  for (const key of ['handle', 'onMatchEnd', 'resize', 'setQuality', 'clear', 'destroy', 'registerPlugin']) {
    assert.equal(typeof instance[key], 'function', key);
  }
  for (const key of ['seatAnchor', 'seatGround', 'facing', 'onFrame', 'shake', 'flash', 'dolly', 'quality', 'isReduced']) {
    assert.equal(typeof instance.api[key], 'function', key);
  }
  assert.equal(instance.api.THREE, THREE);
  assert.ok(instance.api.scene.isScene && instance.api.camera.isPerspectiveCamera);
  instance.destroy();
});

test('arena3d: seat anchors are distinct, facing each other and projected to their stages', async () => {
  const {instance} = await buildArena();
  const {api} = instance;
  const a = api.seatAnchor(1);
  const b = api.seatAnchor(2);
  assert.ok(a.isVector3 && b.isVector3);
  assert.notEqual(api.seatAnchor(1), a, 'new vector each call');
  assert.ok(a.x < b.x, 'fire stands left of rune');
  const gap = a.distanceTo(b);
  assert.ok(gap > 2 && gap < 12, `sane spacing (${gap})`);
  assert.equal(api.facing(1), 1);
  assert.equal(api.facing(2), -1);
  const g1 = api.seatGround(1);
  assert.equal(g1.y, 0);
  assert.ok(a.y > 0.5, 'chest above the floor');
  // Ground point of seat 1 projects to the left stage centre (x = 250 of 1000).
  instance._debug.layout();
  instance._debug.tick(); // the render camera follows the layout camera on the next frame
  api.camera.updateMatrixWorld(true);
  const projected = api.seatGround(1).project(api.camera);
  const px = (projected.x + 1) / 2 * 1000;
  assert.ok(Math.abs(px - 250) < 40, `seat 1 projects near its stage centre (${px})`);
  // Feet row = 90% of the stage: y = 100 + 270 = 370 of 500.
  const py = (1 - projected.y) / 2 * 500;
  assert.ok(Math.abs(py - 370) < 30, `feet on the stage feet row (${py})`);
  instance.destroy();
});

test('arena3d: plugins receive handle/update, events map to animation state', async () => {
  const {instance, env, renderer} = await buildArena();
  const seen = [];
  const updates = [];
  let disposed = 0;
  let cleared = 0;
  const unregister = instance.registerPlugin({
    handle: e => seen.push(e.type),
    update: (dt, t) => updates.push([dt, t]),
    clear: () => cleared++,
    dispose: () => disposed++,
  });
  // A throwing plugin must not break others.
  instance.registerPlugin({handle() { throw new Error('boom'); }, update() { throw new Error('boom'); }});

  const frames = [];
  const off = instance.api.onFrame(dt => frames.push(dt));

  instance.handle({type: 'SKILL_CAST', fromSeat: 1, toSeat: 2, skill: 'e', character: 'fire'});
  assert.equal(instance._debug.fighter(1).tracks, 1);
  env.advance(250);
  instance._debug.tick();
  assert.ok(updates.length >= 1);
  assert.ok(updates.at(-1)[0] > 0 && updates.at(-1)[0] <= 0.1, 'dt is in seconds');
  assert.equal(frames.length, 1);
  off();

  instance.handle({type: 'DAMAGE_APPLIED', fromSeat: 1, toSeat: 2, amount: 90, blocked: false, skill: 'e'});
  env.advance(60);
  instance._debug.tick();
  assert.ok(instance._debug.fighter(2).pose.flash > 0, 'hit flash on defender');
  assert.ok(instance._debug.fighter(2).pose.fwd < 0, 'knockback away from attacker');

  instance.handle({type: 'DAMAGE_APPLIED', fromSeat: 2, toSeat: 1, amount: 0, blocked: true, blockKind: 'NORMAL_BLOCK', skill: 'q'});
  instance.handle({type: 'SHIELD_TRIGGERED', seat: 1, kind: 'PERFECT_BLOCK'});
  env.advance(80);
  instance._debug.tick();
  assert.equal(instance._debug.fighter(1).bubble, true, 'shield bubble pulses on block');

  instance.handle({type: 'PARRY_TRIGGERED', seat: 2, againstSeat: 1, skill: 'q'});
  instance.handle({type: 'COUNTERATTACK_CAST', fromSeat: 2, toSeat: 1, skill: 'counter'});
  instance.handle({type: 'SHIELD_BROKEN', seat: 1, bySeat: 2, skill: 'e'});
  for (const phase of [1, 2, 3]) instance.handle({type: 'ULTIMATE_PHASE', fromSeat: 2, toSeat: 1, phase, character: 'rune'});
  assert.ok(instance._debug.camera().dollySeat === 2, 'phase 3 dollies toward the attacker');
  // Garbage must be ignored.
  for (const junk of [null, undefined, 5, {}, {type: 'SKILL_CAST'}, {type: 'DAMAGE_APPLIED', toSeat: 9}, {type: 'NOPE'}]) {
    assert.doesNotThrow(() => instance.handle(junk));
  }
  for (let i = 0; i < 20; i++) { env.advance(100); instance._debug.tick(); }
  assert.ok(instance._debug.camera().shakes >= 0);

  instance.handle({type: 'KNOCKOUT', seat: 1});
  instance.onMatchEnd({winnerSeat: 2});
  assert.equal(instance._debug.fighter(1).ko, true);
  assert.equal(instance._debug.fighter(2).victory, true);
  for (let i = 0; i < 15; i++) { env.advance(100); instance._debug.tick(); }
  assert.ok(instance._debug.fighter(1).pose.tilt > 1.2, 'loser lies on the floor');
  // Downed fighters ignore further hits.
  instance.handle({type: 'DAMAGE_APPLIED', toSeat: 1, fromSeat: 2, amount: 30, blocked: false});
  assert.equal(instance._debug.fighter(1).tracks, 0);

  assert.ok(seen.includes('SKILL_CAST') && seen.includes('KNOCKOUT') && seen.includes('ULTIMATE_PHASE'));
  assert.ok(renderer.calls.render > 10);

  instance.clear();
  assert.equal(cleared, 1);
  assert.equal(instance._debug.fighter(1).ko, false);
  assert.equal(instance._debug.fighter(2).victory, false);
  assert.equal(instance._debug.camera().dolly, 0);

  unregister();
  assert.equal(disposed, 1, 'unregister disposes the plugin');
  instance.destroy();
});

test('arena3d: reduced mode skips shake/dolly; quality switching', async () => {
  let quiet = true;
  const {instance, renderer} = await buildArena({isReduced: () => quiet});
  instance.api.shake(1, 500);
  instance.api.dolly(1, 800);
  assert.equal(instance._debug.camera().shakes, 0);
  assert.equal(instance._debug.camera().dolly, 0);
  assert.equal(instance.api.isReduced(), true);
  quiet = false;
  instance.api.shake(1, 500);
  assert.equal(instance._debug.camera().shakes, 1);

  assert.equal(instance.api.quality(), 'high');
  instance.setQuality('low');
  assert.equal(instance.api.quality(), 'low');
  assert.equal(renderer.calls.ratio.at(-1), 1, 'DPR 1 on low');
  instance.setQuality('high');
  assert.equal(renderer.calls.ratio.at(-1), 2, 'DPR capped at 2');
  instance.setQuality('nonsense');
  assert.equal(instance.api.quality(), 'high');
  instance.destroy();
});

test('arena3d: bloom renders only in high quality with normal motion', async () => {
  let quiet = false;
  const renderer = fakeRenderer();
  const targets = [];
  renderer.setRenderTarget = target => targets.push(target);
  renderer.getRenderTarget = () => null;
  const {instance, env} = await buildArena({
    isReduced: () => quiet,
    createRenderer: () => renderer,
  });
  const before = renderer.calls.render;
  env.advance(16);
  instance._debug.tick();
  assert.equal(renderer.calls.render - before, 2, 'high quality renders scene and bloom composite');
  assert.ok(targets.some(Boolean), 'uses an offscreen target');

  instance.setQuality('low');
  const lowBefore = renderer.calls.render;
  env.advance(16);
  instance._debug.tick();
  assert.equal(renderer.calls.render - lowBefore, 1, 'low quality renders directly');

  instance.setQuality('high');
  quiet = true;
  const quietBefore = renderer.calls.render;
  env.advance(16);
  instance._debug.tick();
  assert.equal(renderer.calls.render - quietBefore, 1, 'reduced motion renders directly');
  instance.destroy();
});

test('arena3d: a failed bloom pass falls back to direct scene rendering', async () => {
  const renderer = fakeRenderer();
  renderer.setRenderTarget = () => {};
  renderer.getRenderTarget = () => null;
  const originalRender = renderer.render.bind(renderer);
  let failComposite = false;
  renderer.render = (scene, camera) => {
    if (failComposite && scene.children.some(child => child.material?.name === 'arena3d-bloom-composite')) {
      failComposite = false;
      throw new Error('shader compilation failed');
    }
    originalRender(scene, camera);
  };
  const {instance, env} = await buildArena({createRenderer: () => renderer});
  failComposite = true;
  const before = renderer.calls.render;
  env.advance(16);
  instance._debug.tick();
  assert.equal(renderer.calls.render - before, 2, 'offscreen draw then direct fallback');
  const next = renderer.calls.render;
  env.advance(16);
  instance._debug.tick();
  assert.equal(renderer.calls.render - next, 1, 'broken bloom stays disabled');
  instance.destroy();
});

test('arena3d: a silent bloom shader error falls back to direct scene rendering', async () => {
  const renderer = fakeRenderer();
  renderer.setRenderTarget = () => {};
  renderer.getRenderTarget = () => null;
  const oldHandler = () => {};
  renderer.debug = {checkShaderErrors: false, onShaderError: oldHandler};
  const originalRender = renderer.render.bind(renderer);
  let failComposite = false;
  renderer.render = (scene, camera) => {
    if (failComposite && scene.children.some(child => child.material?.name === 'arena3d-bloom-composite')) {
      failComposite = false;
      renderer.debug.onShaderError('gl', 'program', 'vertex', 'fragment');
    }
    originalRender(scene, camera);
  };
  const {instance, env} = await buildArena({createRenderer: () => renderer});
  failComposite = true;
  const before = renderer.calls.render;
  env.advance(16);
  instance._debug.tick();
  assert.equal(renderer.calls.render - before, 3, 'offscreen, failed composite, direct fallback');
  assert.equal(renderer.debug.onShaderError, oldHandler);
  assert.equal(renderer.debug.checkShaderErrors, false);
  const next = renderer.calls.render;
  env.advance(16);
  instance._debug.tick();
  assert.equal(renderer.calls.render - next, 1, 'bloom remains disabled');
  instance.destroy();
});

test('arena3d: reduced motion keeps idle fighters and camera still', async () => {
  const {instance, env} = await buildArena({isReduced: () => true});
  env.advance(16);
  instance._debug.tick();
  const pose = instance._debug.fighter(1).pose;
  const camera = instance.api.camera.position.clone();
  const crowd = instance.api.scene.getObjectByName('pvp26-crowd');
  const matrix = Array.from(crowd.instanceMatrix.array.slice(0, 16));
  env.advance(2000);
  instance._debug.tick();
  assert.deepEqual(instance._debug.fighter(1).pose, pose);
  assert.ok(instance.api.camera.position.equals(camera));
  assert.deepEqual(Array.from(crowd.instanceMatrix.array.slice(0, 16)), matrix);
  instance.destroy();
});

test('arena3d: destroy disposes resources and removes canvas + class', async () => {
  const {instance, duel, root, renderer} = await buildArena();
  let disposed = 0;
  instance.registerPlugin({dispose: () => disposed++});
  const geometries = [];
  instance.api.scene.traverse(o => { if (o.geometry) geometries.push(o.geometry); });
  assert.ok(geometries.length > 5);
  let geometryDisposals = 0;
  for (const g of new Set(geometries)) g.addEventListener('dispose', () => geometryDisposals++);
  instance.destroy();
  assert.equal(disposed, 1);
  assert.equal(renderer.calls.disposed, 1);
  assert.equal(geometryDisposals, new Set(geometries).size);
  assert.equal(duel.children.includes(instance.canvas), false);
  assert.equal(root.classList.contains('pvp26-3d'), false);
  // Idempotent and inert afterwards.
  assert.doesNotThrow(() => instance.destroy());
  assert.doesNotThrow(() => instance.handle({type: 'SKILL_CAST', fromSeat: 1, skill: 'q'}));
  assert.doesNotThrow(() => instance.clear());
});

test('arena3d: texture failure falls back to the DOM rigs', async () => {
  const {instance, root} = await buildArena({loadTexture: async () => { throw new Error('404'); }});
  assert.equal(await instance.ready, false);
  assert.equal(root.classList.contains('pvp26-3d'), false);
  instance.destroy();
});

test('arena3d: CSS hides the DOM rig only in 3D mode and keeps the canvas non-interactive', () => {
  const css = readFileSync(new URL('../pvp/arena3d.css', import.meta.url), 'utf8');
  assert.match(css, /\.pvp26-3d \.pvp3-rig\{visibility:hidden\}/);
  assert.match(css, /\.pvp26-canvas\{[^}]*pointer-events:none/);
  assert.match(css, /\.pvp26-3d \.pvp2-stage\{background:transparent\}/);
});

// ------------------------------------------------- ultimate choreography

const v3 = p => [p.x, p.y, p.z];
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

function runFrames(instance, env, ms, step = 16, onFrame = null) {
  for (let t = 0; t < ms; t += step) {
    env.advance(step);
    instance._debug.tick();
    onFrame?.();
  }
}

/** Server-like sequence for one fire ultimate (match.js: SHIELD_WINDOW 250, offsets 0/180/420). */
function ultEvents(fromSeat = 1, toSeat = 2, character = 'fire', ultimateId = 7) {
  const base = {fromSeat, toSeat, skill: 'r', character, ultimateId, totalPhases: 3, blocked: false};
  return {
    cast: {type: 'SKILL_CAST', ...base, amount: 305},
    phase: n => [
      {type: 'ULTIMATE_PHASE', ...base, phase: n, amount: [65, 100, 140][n - 1]},
      {type: 'DAMAGE_APPLIED', ...base, phase: n, amount: [65, 100, 140][n - 1], hpAfter: 1500},
    ],
  };
}

test('arena3d ult: pull to the VS centre, hit there, throw back home', async () => {
  const {instance, env} = await buildArena();
  const slams = [];
  instance.registerPlugin({handle: e => { if (e.type === 'ARENA_SLAM') slams.push(e); }});
  runFrames(instance, env, 50);
  const home1 = instance._debug.fighter(1).home;
  const home2 = instance._debug.fighter(2).home;
  const centre = {x: (home1.x + home2.x) / 2, y: 0, z: (home1.z + home2.z) / 2};
  const span = dist(home1, home2);
  const ev = ultEvents();

  instance.handle(ev.cast);
  runFrames(instance, env, 250);
  assert.ok(dist(instance._debug.fighter(2).position, home2) < 1e-6, 'cast alone does not move the defender');
  for (const e of ev.phase(1)) instance.handle(e);
  assert.ok(instance._debug.ultimate(), 'ultimate choreography active');
  runFrames(instance, env, 180);
  const pulled = instance._debug.fighter(2).position;
  assert.ok(Math.abs(pulled.x - centre.x) < Math.abs(home2.x - centre.x) * 0.5, `defender pulled toward centre (${pulled.x})`);
  assert.ok(Math.abs(instance._debug.fighter(1).position.x - centre.x) < Math.abs(home1.x - centre.x), 'attacker dashes in');

  for (const e of ev.phase(2)) instance.handle(e);
  let highest = 0;
  runFrames(instance, env, 240, 16, () => { highest = Math.max(highest, instance._debug.fighter(2).position.y); });
  const atHit = instance._debug.fighter(2).position;
  assert.ok(Math.abs(atHit.x - centre.x) < span * 0.3, 'defender stays at the centre during the hit');
  assert.ok(highest > 0.05, 'defender is raised / in the air at the centre');
  assert.ok(Math.abs(instance._debug.fighter(2).spin) > 0.1, 'defender tumbles');

  for (const e of ev.phase(3)) instance.handle(e);
  let peak = 0;
  runFrames(instance, env, 300, 16, () => { peak = Math.max(peak, instance._debug.fighter(2).position.y); });
  assert.ok(peak > span * 0.1, `thrown on an arc (${peak})`);
  runFrames(instance, env, 1400);
  const end2 = instance._debug.fighter(2);
  const end1 = instance._debug.fighter(1);
  assert.ok(dist(end2.position, home2) < 1e-6, `defender lands home (${v3(end2.position)})`);
  assert.ok(dist(end1.position, home1) < 1e-6, 'attacker returns home');
  assert.equal(end2.traveling, false);
  assert.equal(end1.traveling, false);
  assert.ok(Math.abs(end2.spin) < 1e-6, 'upright again');
  assert.equal(instance._debug.ultimate(), null);
  assert.equal(slams.length, 1, 'one floor slam forwarded to plugins');
  assert.equal(slams[0].seat, 2);
  assert.ok(Math.abs(slams[0].x - home2.x) < 1e-6, 'slam at the defender seat');
  instance.destroy();
});

test('arena3d ult: clear() mid-pull snaps both fighters home', async () => {
  const {instance, env} = await buildArena();
  runFrames(instance, env, 30);
  const home2 = instance._debug.fighter(2).home;
  const ev = ultEvents();
  instance.handle(ev.cast);
  for (const e of ev.phase(1)) instance.handle(e);
  runFrames(instance, env, 150);
  assert.ok(dist(instance._debug.fighter(2).position, home2) > 0.1, 'moving');
  instance.clear();
  assert.ok(dist(instance._debug.fighter(2).position, home2) < 1e-6, 'home right after clear');
  assert.equal(instance._debug.fighter(2).traveling, false);
  assert.equal(instance._debug.ultimate(), null);
  runFrames(instance, env, 500);
  assert.ok(dist(instance._debug.fighter(2).position, home2) < 1e-6, 'stays home');
  instance.destroy();
});

test('arena3d ult: reduced mode never moves fighters, just flashes the defender', async () => {
  const {instance, env} = await buildArena({isReduced: () => true});
  runFrames(instance, env, 30);
  const home1 = instance._debug.fighter(1).home;
  const home2 = instance._debug.fighter(2).home;
  const ev = ultEvents();
  instance.handle(ev.cast);
  let maxMove = 0;
  let flashed = 0;
  for (const n of [1, 2, 3]) {
    for (const e of ev.phase(n)) instance.handle(e);
    runFrames(instance, env, 200, 16, () => {
      maxMove = Math.max(maxMove, dist(instance._debug.fighter(2).position, home2), dist(instance._debug.fighter(1).position, home1));
      flashed = Math.max(flashed, instance._debug.fighter(2).pose.flash);
    });
  }
  assert.equal(maxMove, 0, 'no pull / throw travel');
  assert.ok(flashed > 0, 'short flash at the defender');
  instance.destroy();
});

test('arena3d ult: missed or bunched phases still end in a valid home pose', async () => {
  const {instance, env} = await buildArena();
  runFrames(instance, env, 30);
  const home1 = instance._debug.fighter(1).home;
  const home2 = instance._debug.fighter(2).home;
  const centreX = (home1.x + home2.x) / 2;

  // Server ultimate ids are unique (nextCombatId); one per scenario.
  let ev = ultEvents(1, 2, 'fire', 11);
  // a) Only phase 1 arrives (lost packets): watchdog throws the defender back.
  for (const e of ev.phase(1)) instance.handle(e);
  runFrames(instance, env, 2500);
  assert.ok(dist(instance._debug.fighter(2).position, home2) < 1e-6, 'a: defender home');
  assert.ok(dist(instance._debug.fighter(1).position, home1) < 1e-6, 'a: attacker home');
  assert.equal(instance._debug.ultimate(), null, 'a: finished');

  // b) Phase 1 missed: 2 then 3.
  ev = ultEvents(1, 2, 'fire', 12);
  for (const e of ev.phase(2)) instance.handle(e);
  let closest = Infinity;
  runFrames(instance, env, 240, 16, () => { closest = Math.min(closest, Math.abs(instance._debug.fighter(2).position.x - centreX)); });
  for (const e of ev.phase(3)) instance.handle(e);
  runFrames(instance, env, 2000);
  assert.ok(closest < Math.abs(home2.x - centreX) * 0.6, 'b: still reaches the centre');
  assert.ok(dist(instance._debug.fighter(2).position, home2) < 1e-6, 'b: defender home');

  // c) All three phases bunched into one frame (late delivery): still visits the centre.
  ev = ultEvents(1, 2, 'fire', 13);
  closest = Infinity;
  for (const n of [1, 2, 3]) for (const e of ev.phase(n)) instance.handle(e);
  runFrames(instance, env, 2500, 16, () => { closest = Math.min(closest, Math.abs(instance._debug.fighter(2).position.x - centreX)); });
  assert.ok(closest < Math.abs(home2.x - centreX) * 0.6, `c: bunched phases still pull (${closest})`);
  assert.ok(dist(instance._debug.fighter(2).position, home2) < 1e-6, 'c: defender home');
  assert.equal(instance._debug.fighter(2).traveling, false);

  // d) Knockout at phase 2: thrown home and stays down.
  ev = ultEvents(1, 2, 'fire', 14);
  for (const e of ev.phase(1)) instance.handle(e);
  runFrames(instance, env, 200);
  for (const e of ev.phase(2)) instance.handle(e);
  runFrames(instance, env, 100);
  instance.handle({type: 'KNOCKOUT', seat: 2});
  instance.onMatchEnd({winnerSeat: 1});
  runFrames(instance, env, 2500);
  const f2 = instance._debug.fighter(2);
  assert.ok(dist(f2.position, home2) < 1e-6, 'd: knocked-out defender lands home');
  assert.equal(f2.ko, true);
  assert.ok(f2.pose.tilt > 1.2, 'd: lies on the floor');
  assert.ok(dist(instance._debug.fighter(1).position, home1) < 1e-6, 'd: winner home');
  instance.destroy();
});

test('arena3d ult: a blocked ultimate does not pull the defender', async () => {
  const {instance, env} = await buildArena();
  runFrames(instance, env, 30);
  const home2 = instance._debug.fighter(2).home;
  let maxMove = 0;
  for (const n of [1, 2, 3]) {
    instance.handle({type: 'ULTIMATE_PHASE', fromSeat: 1, toSeat: 2, phase: n, character: 'fire', blocked: true, amount: 0});
    runFrames(instance, env, 220, 16, () => { maxMove = Math.max(maxMove, dist(instance._debug.fighter(2).position, home2)); });
  }
  runFrames(instance, env, 2000);
  assert.equal(maxMove, 0);
  assert.ok(dist(instance._debug.fighter(1).position, instance._debug.fighter(1).home) < 1e-6);
  instance.destroy();
});

// ------------------------------------------------------------ environment

test('arena3d env: colosseum crowd / braziers / banners / spots stay within caps', async () => {
  const {instance} = await buildArena();
  const high = instance._debug.environment();
  assert.ok(ARENA_ENV_CAPS.high.crowd >= 200 && ARENA_ENV_CAPS.low.crowd < ARENA_ENV_CAPS.high.crowd);
  assert.equal(high.crowd, ARENA_ENV_CAPS.high.crowd);
  assert.equal(high.braziers, ARENA_ENV_CAPS.high.braziers);
  assert.equal(high.banners, ARENA_ENV_CAPS.high.banners);
  assert.equal(high.spotlights, ARENA_ENV_CAPS.high.spotlights);
  assert.ok(high.lights <= ARENA_ENV_CAPS.high.lights && high.lights > 0, 'a few real flicker lights');
  assert.ok(high.embers <= ARENA_ENV_CAPS.high.embers);
  instance.setQuality('low');
  const low = instance._debug.environment();
  assert.equal(low.crowd, ARENA_ENV_CAPS.low.crowd);
  assert.equal(low.braziers, ARENA_ENV_CAPS.low.braziers);
  assert.equal(low.banners, ARENA_ENV_CAPS.low.banners);
  assert.equal(low.spotlights, ARENA_ENV_CAPS.low.spotlights);
  assert.equal(low.lights, 0, 'no extra real lights on low');
  assert.equal(ARENA_ENV_CAPS.low.lights, 0);
  assert.ok(low.embers <= ARENA_ENV_CAPS.low.embers);
  let points = 0;
  instance.api.scene.traverse(o => { if (o.isPointLight && o.visible) points++; });
  assert.ok(points <= 6, `point lights on low: ${points}`);
  instance.setQuality('high');
  points = 0;
  instance.api.scene.traverse(o => { if (o.isPointLight && o.visible) points++; });
  assert.ok(points <= 9, `point lights on high: ${points}`);
  instance.destroy();
});

test('arena3d env: the crowd cheers on big hits and the knockout, then settles', async () => {
  const {instance, env} = await buildArena();
  runFrames(instance, env, 100);
  assert.ok(instance._debug.environment().excite < 0.05);
  instance.handle({type: 'DAMAGE_APPLIED', fromSeat: 1, toSeat: 2, amount: 140, blocked: false, skill: 'r'});
  runFrames(instance, env, 50);
  assert.ok(instance._debug.environment().excite > 0.3, 'cheer on a heavy hit');
  runFrames(instance, env, 5000);
  assert.ok(instance._debug.environment().excite < 0.05, 'settles down');
  instance.handle({type: 'KNOCKOUT', seat: 2});
  runFrames(instance, env, 50);
  assert.ok(instance._debug.environment().excite > 0.8, 'roar on knockout');
  instance.clear();
  assert.equal(instance._debug.environment().excite, 0);
  instance.destroy();
});

test('arena3d env: destroy disposes the instanced crowd / braziers and every material', async () => {
  const {instance} = await buildArena();
  const instanced = [];
  const materials = new Set();
  instance.api.scene.traverse(o => {
    if (o.isInstancedMesh) instanced.push(o);
    for (const m of [].concat(o.material || [])) materials.add(m);
  });
  assert.ok(instanced.length >= 3, `instanced meshes: ${instanced.length}`);
  let meshDisposals = 0;
  for (const m of instanced) m.addEventListener('dispose', () => meshDisposals++);
  let materialDisposals = 0;
  for (const m of materials) m.addEventListener('dispose', () => materialDisposals++);
  instance.destroy();
  assert.equal(meshDisposals, instanced.length);
  assert.equal(materialDisposals, materials.size);
});

test('arena3d CSS: 3D mode restyles the page as a stadium and keeps the HUD readable', () => {
  const css = readFileSync(new URL('../pvp/arena3d.css', import.meta.url), 'utf8');
  assert.match(css, /#pvp-root\.pvp26-3d \.pvp2-shell\{[^}]*background:/, 'stadium background replaces the castle art');
  assert.doesNotMatch(css, /castle-scene/);
  assert.match(css, /#pvp-root\.pvp26-3d \.pvp2-side\{[^}]*linear-gradient/, 'scrim behind HP/name rows');
});
