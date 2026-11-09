import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../pvp/vendor/three.module.min.js';
import {createArena3D, CINEMATIC} from '../pvp/arena3d.js';
import {createArena3DFx} from '../pvp/arena3d-fx.js';

// Paket 29: FGC cinematics (superFreeze / slowMo / introSweep), dynamic fight
// camera, floor glow + hit waves + fog pulse, fx aura and slow-motion dt.

// --------------------------------------------------------------- fake DOM

class FakeClassList {
  value = new Set();
  add(...x) { x.forEach(v => this.value.add(v)); }
  remove(...x) { x.forEach(v => this.value.delete(v)); }
  contains(x) { return this.value.has(x); }
}

function el(name, rect = {left: 0, top: 0, width: 0, height: 0}) {
  return {
    name, rect, style: {}, attributes: {}, children: [], parentNode: null, listeners: {},
    classList: new FakeClassList(), selectors: {}, clientLeft: 0, clientTop: 0,
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
}

function fakeArena() {
  const root = el('root');
  const duel = el('duel', {left: 0, top: 0, width: 1000, height: 500});
  const s1 = el('stage1', {left: 10, top: 100, width: 480, height: 300});
  const s2 = el('stage2', {left: 510, top: 100, width: 480, height: 300});
  root.selectors['.pvp2-duel'] = duel;
  duel.selectors['.pvp2-side[data-seat="1"] .pvp2-stage'] = s1;
  duel.selectors['.pvp2-side[data-seat="2"] .pvp2-stage'] = s2;
  let clock = 1000;
  const doc = {
    hidden: false, listeners: {},
    createElement: () => { const c = el('canvas'); c.getContext = () => null; return c; },
    addEventListener() {}, removeEventListener() {},
  };
  root.ownerDocument = doc;
  const env = {
    document: doc, devicePixelRatio: 1, performance: {now: () => clock},
    setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: h => clearTimeout(h),
    advance(ms) { clock += ms; },
  };
  return {root, duel, env};
}

function fakeRenderer() {
  return {calls: {render: 0}, setPixelRatio() {}, setSize() {}, setClearColor() {}, render() { this.calls.render++; }, dispose() {}};
}

async function buildArena({reduced = () => false} = {}) {
  const arena = fakeArena();
  const instance = await createArena3D({
    root: arena.root, THREE, env: arena.env, isReduced: reduced,
    createRenderer: fakeRenderer, loadTexture: async () => new THREE.Texture(),
  });
  await instance.ready;
  return {...arena, instance};
}

function run(instance, env, ms, step = 16, each = null) {
  for (let t = 0; t < ms; t += step) { env.advance(step); instance._debug.tick(); each?.(); }
}

const cin = instance => instance._debug.cinematic();
const isZero = arr => arr.every(v => v === 0);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

// ------------------------------------------------------------------ tests

test('fgc29: new api surface exists and is inert after destroy', async () => {
  const {instance} = await buildArena();
  for (const key of ['superFreeze', 'slowMo', 'introSweep', 'timeScale']) assert.equal(typeof instance.api[key], 'function', key);
  assert.equal(instance.api.timeScale(), 1);
  assert.ok(CINEMATIC.superDim > 0.6 && CINEMATIC.superDim < 0.7, 'scene dims to ~35 %');
  instance.destroy();
  assert.doesNotThrow(() => {
    instance.api.superFreeze(1, 450);
    instance.api.slowMo(0.25, 900);
    instance.api.introSweep(1800);
  });
  assert.equal(instance.api.timeScale(), 1);
});

test('fgc29: superFreeze darkens the scene, keeps the attacker bright, freezes the opponent, then returns', async () => {
  const {instance, env} = await buildArena();
  const events = [];
  instance.registerPlugin({handle: e => events.push(e)});
  run(instance, env, 50);
  // Opponent mid-hit: its pose must hold while frozen.
  instance.handle({type: 'SKILL_CAST', fromSeat: 2, toSeat: 1, skill: 'e'});
  run(instance, env, 120);
  instance.api.superFreeze(1, 450);
  const sf = events.find(e => e.type === 'SUPER_FREEZE');
  assert.ok(sf && sf.seat === 1 && sf.ms === 450, 'plugins get SUPER_FREEZE');
  run(instance, env, 120);
  const mid = cin(instance);
  assert.ok(mid.superK > 0.9, `fully dimmed (${mid.superK})`);
  assert.equal(mid.frozenSeat, 2);
  assert.ok(mid.dim > 0.6, `dim quad ≈ 65 % black (${mid.dim})`);
  for (const ratio of mid.ambient) assert.ok(Math.abs(ratio - (1 - CINEMATIC.superDim)) < 0.08, `ambient ≈ 35 % (${ratio})`);
  assert.ok(instance._debug.fighter(1).pose.glow > 0.6, 'attacker glows');
  assert.ok(instance._debug.fighter(2).pose.dark > 0.3, 'opponent dimmed');
  const held = instance._debug.fighter(2).pose.fwd;
  run(instance, env, 96);
  assert.ok(Math.abs(instance._debug.fighter(2).pose.fwd - held) < 1e-9, 'opponent pose frozen');
  // Slight push-in toward the attacker (seat 1 is on the left: camera x < base drift range).
  assert.ok(instance.api.camera.position.z < 5.6 - 0.5, `camera pushed in (${instance.api.camera.position.z})`);
  run(instance, env, 400);
  const after = cin(instance);
  assert.equal(after.superK, 0);
  assert.equal(after.dim, 0);
  for (const ratio of after.ambient) assert.ok(Math.abs(ratio - 1) < 1e-9, 'ambient restored');
  assert.equal(after.frozenSeat, null);
  // Junk is ignored.
  assert.doesNotThrow(() => { instance.api.superFreeze(7); instance.api.superFreeze(null, 'x'); });
  assert.equal(cin(instance).superK, 0);
  instance.destroy();
});

test('fgc29: slowMo slows fighter tracks and ultimate travel but keeps real-time cues and plugin dt', async () => {
  const measure = async slow => {
    const {instance, env} = await buildArena();
    const dts = [];
    instance.registerPlugin({update: dt => dts.push(dt)});
    run(instance, env, 30);
    const home2 = {...instance._debug.fighter(2).home};
    if (slow) instance.api.slowMo(0.25, 900);
    instance.handle({type: 'ULTIMATE_PHASE', fromSeat: 1, toSeat: 2, phase: 1, character: 'fire', ultimateId: 1});
    let scale = 1;
    run(instance, env, 300, 16, () => { scale = Math.min(scale, instance.api.timeScale()); });
    const moved = dist(instance._debug.fighter(2).position, home2);
    const result = {moved, scale, dt: dts.at(-1)};
    run(instance, env, 4000);
    result.endScale = instance.api.timeScale();
    result.home = dist(instance._debug.fighter(2).position, home2);
    instance.destroy();
    return result;
  };
  const normal = await measure(false);
  const slow = await measure(true);
  assert.ok(slow.scale <= 0.26, `scale eases to 0.25 (${slow.scale})`);
  assert.ok(slow.moved < normal.moved * 0.8, `pull slowed (${slow.moved} vs ${normal.moved})`);
  assert.ok(Math.abs(slow.dt - 0.016) < 1e-9, 'plugins still get the real dt (they scale it themselves)');
  assert.equal(slow.endScale, 1, 'back to real time');
  assert.ok(slow.home < 1e-6, 'choreography still finishes at home');
});

test('fgc29: fx plugin follows slowMo and spawns a super aura in the attacker colour', async () => {
  const {instance, env} = await buildArena();
  const fx = createArena3DFx(instance.api);
  instance.registerPlugin(fx);
  run(instance, env, 30);
  instance.api.superFreeze(2, 450);
  assert.equal(fx.stats().emitters, 1, 'aura emitter');
  instance.api.superFreeze(2, 450);
  assert.equal(fx.stats().emitters, 1, 'repeat extends the same aura');
  run(instance, env, 200);
  assert.ok(fx.stats().particles > 5, 'aura particles');
  run(instance, env, 1200);
  assert.equal(fx.stats().emitters, 0, 'aura ends in real time without slowMo');

  instance.clear();
  instance.api.superFreeze(1, 450);
  instance.api.slowMo(0.25, 1500);
  run(instance, env, 1100);
  assert.equal(fx.stats().emitters, 1, 'slow motion stretches the aura (fx dt × timeScale)');
  instance.clear();
  assert.equal(fx.stats().emitters, 0);
  assert.equal(instance.api.timeScale(), 1, 'clear() resets slowMo');
  instance.destroy();
});

test('fgc29: introSweep starts wide and lands exactly on the layout camera', async () => {
  const {instance, env} = await buildArena();
  run(instance, env, 30);
  instance.api.introSweep(1800);
  run(instance, env, 16);
  const start = cin(instance);
  assert.ok(start.sweepK > 0.95, 'wide shot first');
  assert.ok(start.fov > 48, 'wider lens');
  assert.ok(instance.api.camera.position.y > 2.5, `high establishing angle (${instance.api.camera.position.y})`);
  let prev = start.sweepK;
  let monotonic = true;
  run(instance, env, 1800, 16, () => { const k = cin(instance).sweepK; if (k > prev + 1e-9) monotonic = false; prev = k; });
  assert.ok(monotonic, 'one continuous glide');
  const end = cin(instance);
  assert.equal(end.sweepK, 0);
  assert.equal(end.fov, 42);
  instance.api.introSweep(5000);
  instance.clear();
  run(instance, env, 16);
  assert.equal(cin(instance).sweepK, 0, 'clear() cancels the sweep');
  instance.destroy();
});

test('fgc29: dynamic camera is exactly the layout camera at home and frames the ultimate travel', async () => {
  const {instance, env} = await buildArena();
  run(instance, env, 200);
  assert.ok(isZero(cin(instance).framing.cam) && isZero(cin(instance).framing.look), 'zero framing while home');
  // Seat projection unchanged (same check as pvp-arena3d.test).
  instance.api.camera.updateMatrixWorld(true);
  const p = instance.api.seatGround(1).project(instance.api.camera);
  assert.ok(Math.abs((p.x + 1) / 2 * 1000 - 250) < 40);
  // A normal lunge moves the pose, not the seat: camera stays put.
  instance.handle({type: 'SKILL_CAST', fromSeat: 1, toSeat: 2, skill: 'e'});
  run(instance, env, 300);
  assert.ok(isZero(cin(instance).framing.cam), 'lunges do not move the fight camera');
  // Ultimate pull: both fighters converge on the centre → camera eases in.
  instance.handle({type: 'ULTIMATE_PHASE', fromSeat: 2, toSeat: 1, phase: 1, character: 'rune', ultimateId: 3});
  let closest = 0;
  let maxStep = 0;
  let last = cin(instance).framing.cam[2];
  run(instance, env, 400, 16, () => {
    const z = cin(instance).framing.cam[2];
    closest = Math.min(closest, z);
    maxStep = Math.max(maxStep, Math.abs(z - last));
    last = z;
  });
  assert.ok(closest < -0.2, `pushes in during the pull (${closest})`);
  assert.ok(maxStep < 0.12, `smooth, no snaps (${maxStep})`);
  run(instance, env, 4000);
  const settled = cin(instance).framing;
  assert.ok(settled.cam.every(v => Math.abs(v) < 1e-3) && settled.look.every(v => Math.abs(v) < 1e-3), 'settles back on the layout camera');
  instance.destroy();
});

test('fgc29: floor glow (one instanced draw), hit wave and fog pulse; off on low quality', async () => {
  const {instance, env} = await buildArena();
  const glow = instance.api.scene.getObjectByName('pvp29-floor-glow');
  assert.ok(glow?.isInstancedMesh && glow.count === 4, 'seat rings + waves share one InstancedMesh');
  run(instance, env, 30);
  assert.ok(glow.geometry.getAttribute('aParam').array[0] > 0.3, 'seat ring visible');
  instance.handle({type: 'DAMAGE_APPLIED', fromSeat: 1, toSeat: 2, amount: 120, blocked: false});
  run(instance, env, 16);
  assert.equal(cin(instance).waves, 1, 'floor light wave');
  assert.ok(cin(instance).fogPulse > 0.3, 'fog pulses');
  const fog = instance.api.scene.fog.color.clone();
  assert.ok(fog.r > 0x15 / 255, 'fog tinted toward the attacker colour');
  run(instance, env, 3000);
  assert.equal(cin(instance).waves, 0);
  assert.equal(cin(instance).fogPulse, 0);
  instance.setQuality('low');
  assert.equal(cin(instance).floorGlow, false);
  instance.handle({type: 'DAMAGE_APPLIED', fromSeat: 1, toSeat: 2, amount: 120, blocked: false});
  run(instance, env, 16);
  assert.equal(cin(instance).waves, 0, 'no waves on low');
  assert.equal(cin(instance).fogPulse, 0, 'no fog pulse on low');
  instance.setQuality('high');
  assert.equal(cin(instance).floorGlow, true);
  let disposed = 0;
  glow.addEventListener('dispose', () => disposed++);
  glow.geometry.addEventListener('dispose', () => disposed++);
  glow.material.addEventListener('dispose', () => disposed++);
  instance.destroy();
  assert.equal(disposed, 3, 'mesh, geometry and material disposed');
});

test('fgc29: ARENA_CUE events drive the same api; reduced mode stays still', async () => {
  const {instance, env} = await buildArena();
  instance.handle({type: 'ARENA_CUE', cue: 'superFreeze', seat: 2, ms: 600});
  instance.handle({type: 'ARENA_CUE', cue: 'slowMo', scale: 0.3, ms: 800});
  instance.handle({type: 'ARENA_CUE', cue: 'introSweep', ms: 1200});
  run(instance, env, 200);
  const c = cin(instance);
  assert.equal(c.superSeat, 2);
  assert.ok(c.timeScale < 0.35);
  assert.ok(c.sweepK > 0);
  instance.clear();
  const reset = cin(instance);
  assert.equal(reset.superK, 0);
  assert.equal(reset.timeScale, 1);
  assert.equal(reset.sweepK, 0);
  instance.destroy();

  const quiet = await buildArena({reduced: () => true});
  run(quiet.instance, quiet.env, 30);
  const cam = quiet.instance.api.camera.position.clone();
  quiet.instance.api.superFreeze(1, 450);
  quiet.instance.api.slowMo(0.25, 900);
  quiet.instance.api.introSweep(1800);
  run(quiet.instance, quiet.env, 150);
  const q = cin(quiet.instance);
  assert.equal(q.timeScale, 1, 'no slow motion');
  assert.equal(q.sweepK, 0, 'no sweep');
  assert.equal(q.frozenSeat, null, 'nobody frozen');
  assert.equal(q.dim, 0, 'no dim quad');
  assert.ok(q.superK > 0 && q.ambient[0] > 0.6, 'only a light dim');
  assert.ok(quiet.instance.api.camera.position.equals(cam), 'camera still');
  quiet.instance.destroy();
});
