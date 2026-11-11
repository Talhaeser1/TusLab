// Paket 32: 3B rig'li dövüşçüler — koreografi tablosu, rig (mixer) davranışı, arena entegrasyonu,
// optimize GLB'ler ve yedek (düzlem) yol. Gerçek vendored THREE + sentetik (WebGL'siz) model varlığı.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, statSync, existsSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import * as THREE from '../pvp/vendor/three.module.min.js';
import {
  CHOREOGRAPHY, STATE_CLIPS, resolveChoreography, rootMotionAt, skillDuration, createFighterRig, createSkillFx,
  fighterPalette, isKnownFighter, modelUrl, MODEL_VARIANTS,
} from '../pvp/fighters3d.js';
import {FIGHTERS, FIGHTER_IDS} from '../pvp/shared/fighters.js';
import {createArena3D} from '../pvp/arena3d.js';
import {createArena3DAssist} from '../pvp/arena3d-assist.js';
import {createArena3DFx} from '../pvp/arena3d-fx.js';
import {CHARACTER_BUILDS, COMMON_CLIPS, reduceKeys, readGlb} from '../scripts/optimize-characters.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS = ['q', 'e', 'r'];

// ------------------------------------------------------------ synthetic asset

function allClipNames() {
  const names = new Set(['Idle', '2H_Melee_Idle', 'Hit_A', 'Hit_B', 'Blocking', 'Block_Hit', 'Death_A', 'Cheer']);
  for (const id of Object.keys(CHOREOGRAPHY)) {
    const c = resolveChoreography(id);
    names.add(c.idle);
    for (const s of SKILLS) for (const step of c[s].steps) names.add(step.clip);
  }
  return [...names];
}

/** Bones named like the KayKit rig after GLTFLoader name sanitising ('handslot.r' → 'handslotr'). */
function fakeAsset({duration = 0.5} = {}) {
  const scene = new THREE.Group();
  const root = new THREE.Bone(); root.name = 'root';
  const head = new THREE.Bone(); head.name = 'head'; head.position.y = 1.23;
  const hand = new THREE.Bone(); hand.name = 'handslotr'; hand.position.set(0.3, 0.6, 0);
  scene.add(root); root.add(head); root.add(hand);
  const material = new THREE.MeshStandardMaterial({map: new THREE.Texture()});
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.4, 0.6).translate(0, 1.2, 0), material);
  scene.add(mesh);
  const clips = allClipNames().map(name => new THREE.AnimationClip(name, duration, [
    new THREE.VectorKeyframeTrack('head.position', [0, duration], [0, 1.23, 0, 0, 1.3, 0]),
  ]));
  return {gltf: {scene, animations: clips}, clips, sharedMaterial: material};
}

test('Vargr melee plan plays each complete attack clip before walking back at natural speed',()=>{
  const asset=fakeAsset();
  const names=new Set(Object.values(MODEL_VARIANTS.vargr.meshy.clips).flat());
  for(const skill of Object.values(MODEL_VARIANTS.vargr.meshy.skills))names.add(skill.clip);
  for(const name of names)if(!asset.clips.some(c=>c.name===name))asset.clips.push(new THREE.AnimationClip(name,2.8,[]));
  for(const name of ['Attack','Axe_Spin_Attack']){
    const clip=asset.clips.find(c=>c.name===name);clip.duration=name==='Attack'?2.8:2.5;
  }
  const rig=createFighterRig(THREE,asset,{fighterId:'vargr',seat:1,variant:'meshy'});
  for(const skill of ['q','e']){
    const plan=rig.plan(skill),attack=plan.steps.find(s=>s.clip===MODEL_VARIANTS.vargr.meshy.skills[skill].clip);
    const fullMs=asset.clips.find(c=>c.name===attack.clip).duration*1000;
    assert.equal(attack.offset,0);
    assert.ok(attack.speed<=1.2);
    assert.ok(attack.endMs>=fullMs-1,`${skill} must include the whole clip`);
    assert.ok(plan.hitMs+plan.holdMs>=plan.travelMs+fullMs/attack.speed-1);
  }
  rig.play('r',{force:true});
  assert.equal(rig.actions.Charged_Axe_Chop.time,0,'ultimate starts at the first frame');
  assert.ok(rig.actions.Charged_Axe_Chop.getEffectiveTimeScale()<=1.2);
  rig.dispose();
});

// ------------------------------------------------------------- choreography

test('fighters3d: every fighter defines Q/E/R with its own, different clips', () => {
  assert.deepEqual([...FIGHTER_IDS].sort(), Object.keys(CHOREOGRAPHY).sort());
  const signatures = new Set();
  for (const id of FIGHTER_IDS) {
    const c = resolveChoreography(id);
    const perSkill = SKILLS.map(s => c[s].steps.map(step => step.clip).join('+'));
    assert.equal(new Set(perSkill).size, 3, `${id}: Q/E/R clip sets differ (${perSkill.join(' | ')})`);
    for (const s of SKILLS) {
      assert.ok(c[s].steps.length >= 1, `${id}.${s} has steps`);
      assert.ok(c[s].hitMs > 0 && c[s].hitMs <= skillDuration(c[s]), `${id}.${s} hit moment inside the move`);
      signatures.add(`${s}:${perSkill[SKILLS.indexOf(s)]}`);
    }
    // Shared contract: the main clip of every skill comes from pvp/shared/fighters.js.
    for (const s of SKILLS) {
      const shared = FIGHTERS[id].skills[s];
      const clips = c[s].steps.map(step => step.clip);
      assert.ok(clips.includes(shared.clip), `${id}.${s} uses shared clip ${shared.clip}`);
    }
  }
  assert.equal(signatures.size, FIGHTER_IDS.length * 3, 'no two fighters share a skill choreography');
});

test('fighters3d: signature moves — sira spear from the right hand, vargr spin, doran shield break, nyx meteor', () => {
  const sira = resolveChoreography('sira');
  assert.equal(sira.q.steps[0].clip, 'Throw');
  assert.deepEqual(sira.q.fx.map(f => [f.kind, f.from]), [['spear', 'handslot.r']]);
  assert.equal(sira.r.fx.length, 3, 'shadow volley = three throws');
  const vargr = resolveChoreography('vargr');
  assert.ok(vargr.e.motion.spins >= 1 && vargr.e.motion.spins <= 2, 'Kasırga spins 1–2 turns');
  const mid = rootMotionAt(vargr.e, vargr.e.motion.spinAt + vargr.e.motion.spinMs);
  assert.ok(Math.abs(mid.yaw - Math.PI * 2 * vargr.e.motion.spins) < 1e-6, 'full turns by the end of the spin');
  assert.equal(resolveChoreography('doran').e.steps[0].clip, 'Block_Attack');
  assert.ok(resolveChoreography('doran').e.fx.some(f => f.kind === 'shards'));
  assert.ok(resolveChoreography('nyx').r.fx.some(f => f.kind === 'meteor'));
  assert.ok(resolveChoreography('nyx').q.fx.some(f => f.kind === 'rune'));
  // Dash-in moves return home: no drift after the move.
  for (const id of FIGHTER_IDS) for (const s of SKILLS) {
    const spec = resolveChoreography(id)[s];
    const end = rootMotionAt(spec, skillDuration(spec) + 2000);
    assert.ok(Math.abs(end.fwd) < 1e-6 && Math.abs(end.lift) < 1e-6, `${id}.${s} ends at home (${end.fwd})`);
  }
});

test('fighters3d: unknown fighters / shared data fallback', () => {
  assert.equal(isKnownFighter('vargr'), true);
  assert.equal(isKnownFighter('knight'), false);
  assert.equal(isKnownFighter(undefined), false);
  const fallback = resolveChoreography('nope', {});
  assert.equal(fallback.q.steps[0].clip, CHOREOGRAPHY.vargr.q.steps[0].clip);
  // Without shared data the table defaults stay.
  assert.equal(resolveChoreography('doran', {}).e.steps[0].clip, 'Block_Attack');
  assert.equal(fighterPalette('nyx', {}).main, 0x22d6e8);
  assert.equal(fighterPalette('vargr', {vargr: {palette: {main: '#112233', accent: 0x445566}}}).main, 0x112233);
  assert.equal(modelUrl('sira'), './assets/models/sira/sira.glb');
});

// ------------------------------------------------------------------- rig

test('fighters3d rig: skills play LoopOnce clips step by step, then return to Idle', () => {
  const rig = createFighterRig(THREE, fakeAsset(), {fighterId: 'doran', seat: 2});
  assert.equal(rig.stats().state, 'idle');
  assert.equal(rig.stats().clip, 'Idle');
  assert.equal(rig.face, -1);
  assert.ok(rig.bones['handslot.r'], 'sanitised bone name is found');
  rig.play('r');
  assert.equal(rig.stats().clip, 'Jump_Start');
  assert.equal(rig.actions.Jump_Start.loop, THREE.LoopOnce);
  assert.equal(rig.actions.Jump_Start.clampWhenFinished, true);
  for (let i = 0; i < 30; i++) rig.update(0.033); // ~1 s: Jump_Land, then the slice
  assert.equal(rig.stats().clip, '1H_Melee_Attack_Slice_Horizontal');
  for (let i = 0; i < 40; i++) rig.update(0.05);
  assert.equal(rig.stats().state, 'idle', 'back to idle after the last clip');
  rig.play('ko');
  for (let i = 0; i < 40; i++) rig.update(0.05);
  assert.equal(rig.stats().state, 'ko', 'knockout stays down');
  assert.equal(rig.play('q'), false, 'no attacks while knocked out');
  rig.dispose();
});

test('fighters3d rig: timeScale (slowMo) and pause (hitStop) drive the mixer', () => {
  const rig = createFighterRig(THREE, fakeAsset({duration: 2}), {fighterId: 'nyx', seat: 1});
  rig.play('q');
  const action = rig.actions.Spellcast_Shoot;
  rig.update(0.1);
  const t1 = action.time;
  rig.setTimeScale(0.25);
  rig.update(0.1);
  const slow = action.time - t1;
  assert.ok(slow > 0 && slow < 0.1 * 1.1 * 0.3, `slowMo advances ~quarter speed (${slow})`);
  rig.setPaused(true);
  const t2 = action.time;
  rig.update(0.2);
  assert.equal(action.time, t2, 'hit-stop freezes the clip');
  assert.equal(rig.stats().paused, true);
  rig.setPaused(false);
  rig.setTimeScale(1);
  rig.update(0.1);
  assert.ok(action.time > t2);
  rig.dispose();
});

test('fighters3d rig: dispose releases materials/actions and never the shared texture', () => {
  const asset = fakeAsset();
  const rig = createFighterRig(THREE, asset, {fighterId: 'vargr', seat: 1});
  const parent = new THREE.Group();
  parent.add(rig.object);
  const own = rig.materials.slice();
  assert.ok(own.length > 0 && own.every(m => m !== asset.sharedMaterial), 'materials cloned per instance');
  const sharedMap = asset.sharedMaterial.map;
  let disposedMaps = 0;
  sharedMap.addEventListener('dispose', () => disposedMaps++);
  let disposedMaterials = 0;
  for (const m of own) m.addEventListener('dispose', () => disposedMaterials++);
  rig.play('e');
  rig.dispose();
  assert.equal(disposedMaterials, own.length);
  assert.equal(disposedMaps, 0, 'shared texture untouched');
  assert.equal(rig.object.parent, null, 'removed from the actor');
  assert.equal(Object.keys(rig.actions).length, 0);
  assert.equal(rig.stats().disposed, true);
  assert.equal(rig.play('q'), false);
  rig.dispose(); // idempotent
});

test('fighters3d ghost: translucent single-colour silhouette', () => {
  const rig = createFighterRig(THREE, fakeAsset(), {fighterId: 'sira', seat: 1, ghost: {color: 0x9fd0ff, opacity: 0.5}});
  assert.ok(rig.materials.every(m => m.isMeshBasicMaterial && m.transparent && m.opacity === 0.5 && m.depthWrite === false));
  rig.setOpacity(0.2);
  assert.ok(rig.materials.every(m => m.opacity === 0.2));
  rig.dispose();
});

test('fighters3d fx: projectiles arrive once, effects expire, dispose frees everything', () => {
  const scene = new THREE.Scene();
  const fx = createSkillFx(THREE, scene);
  let arrived = 0;
  for (const kind of ['spear', 'dagger', 'rune', 'meteor', 'column', 'shards', 'swirl']) {
    fx.spawn({kind, from: new THREE.Vector3(-2, 1, 0), to: new THREE.Vector3(2, 1, 0), flight: 200, ms: 400, onArrive: () => arrived++});
  }
  assert.equal(fx.stats().live, 7);
  for (let i = 0; i < 60; i++) fx.update(0.033);
  assert.equal(fx.stats().live, 0, 'all effects finished');
  assert.equal(arrived, 7, 'every effect reports its impact exactly once');
  fx.dispose();
  assert.equal(scene.children.length, 0);
});

// ------------------------------------------------------------- GLB assets

test('characters: four Meshy GLBs exist, fit 1.2 MiB and supply mapped clips', () => {
  for (const id of ['vargr','sira','doran','nyx']) {
    const file = resolve(ROOT, 'assets', 'models', id, `${id}.glb`);
    assert.ok(existsSync(file), `${id}.glb`);
    const bytes = statSync(file).size;
    assert.ok(bytes <= 1.2 * 1024 * 1024, `${id}.glb ${bytes} B`);
    const {json} = readGlb(readFileSync(file));
    const names = json.animations.map(a => a.name);
    assert.ok(names.length >= 9, `${id}: ${names.length} clips`);
    const variant = MODEL_VARIANTS[id].meshy;
    for (const value of Object.values(variant.clips)) for (const clip of Array.isArray(value) ? value : [value]) assert.ok(names.includes(clip), `${id} has ${clip}`);
    for (const s of SKILLS) assert.ok(names.includes(variant.skills[s].clip), `${id}.${s} clip shipped`);
    assert.equal(json.images.length, 1);
    assert.match(json.asset.generator, /Meshy AI/);
  }
  assert.ok(existsSync(resolve(ROOT, 'assets', 'characters', 'LICENSE-KayKit.txt')));
});

test('optimize: keyframe reduction keeps endpoints and linear shape', () => {
  const times = Float32Array.from([0, 1, 2, 3, 4]);
  const linear = reduceKeys(times, Float32Array.from([0, 1, 2, 3, 4]), 1, 1e-4);
  assert.deepEqual([...linear.times], [0, 4]);
  const bend = reduceKeys(times, Float32Array.from([0, 1, 2, 1, 0]), 1, 1e-4);
  assert.deepEqual([...bend.times], [0, 2, 4]);
  const flat = reduceKeys(times, Float32Array.from([5, 5, 5, 5, 5]), 1, 1e-4);
  assert.equal(flat.times.length, 1);
});

test('vendor: GLTFLoader/SkeletonUtils are local (CSP self) and import the local three build', () => {
  for (const f of ['GLTFLoader.js', 'SkeletonUtils.js', 'BufferGeometryUtils.js']) {
    const src = readFileSync(resolve(ROOT, 'pvp', 'vendor', f), 'utf8');
    assert.doesNotMatch(src, /from 'three'/);
    assert.doesNotMatch(src, /https?:\/\/cdn/);
    assert.match(src, /from '\.\/(three\.module\.min|BufferGeometryUtils)\.js'/);
  }
});

// -------------------------------------------------------- arena integration

class FakeClassList {
  value = new Set();
  add(...x) { x.forEach(v => this.value.add(v)); }
  remove(...x) { x.forEach(v => this.value.delete(v)); }
  contains(x) { return this.value.has(x); }
}
function el(name, rect = {left: 0, top: 0, width: 0, height: 0}) {
  return {
    name, rect, style: {}, attributes: {}, children: [], parentNode: null, listeners: {}, classList: new FakeClassList(),
    selectors: {}, clientLeft: 0, clientTop: 0,
    get firstChild() { return this.children[0] || null; },
    querySelector(q) { return this.selectors[q] || null; },
    getBoundingClientRect() { return {...this.rect, right: this.rect.left + this.rect.width, bottom: this.rect.top + this.rect.height}; },
    setAttribute(k, v) { this.attributes[k] = v; },
    insertBefore(child) { this.children.unshift(child); child.parentNode = this; return child; },
    removeChild(child) { this.children = this.children.filter(c => c !== child); child.parentNode = null; },
    remove() { this.parentNode?.removeChild(this); },
    addEventListener(t, fn) { (this.listeners[t] ||= new Set()).add(fn); },
    removeEventListener(t, fn) { this.listeners[t]?.delete(fn); },
  };
}
async function buildArena({loadModel, reduced = false, onImpact} = {}) {
  const root = el('root');
  const duel = el('duel', {left: 0, top: 0, width: 1000, height: 500});
  root.selectors['.pvp2-duel'] = duel;
  duel.selectors['.pvp2-side[data-seat="1"] .pvp2-stage'] = el('s1', {left: 10, top: 100, width: 480, height: 300});
  duel.selectors['.pvp2-side[data-seat="2"] .pvp2-stage'] = el('s2', {left: 510, top: 100, width: 480, height: 300});
  let clock = 1000;
  const doc = {
    hidden: false,
    createElement: () => { const c = el('canvas'); c.getContext = () => null; return c; },
    addEventListener() {}, removeEventListener() {},
  };
  root.ownerDocument = doc;
  const env = {document: doc, devicePixelRatio: 1, performance: {now: () => clock}, setTimeout, clearTimeout, advance(ms) { clock += ms; }};
  const renderer = {setPixelRatio() {}, setSize() {}, setClearColor() {}, render() {}, dispose() {}};
  const loads = [];
  const instance = await createArena3D({
    root, THREE, env, isReduced: () => reduced, onImpact, createRenderer: () => renderer,
    loadTexture: async () => new THREE.Texture(),
    loadModel: loadModel || (async (url, id) => { loads.push(id); return fakeAsset(); }),
    cloneModel: o => o.clone(true),
  });
  await instance.ready;
  const run = (ms, step = 16) => { for (let t = 0; t < ms; t += step) { env.advance(step); instance._debug.tick(); } };
  return {instance, env, root, run, loads};
}

test('arena3d + models: setFighters lazily loads the two chosen fighters and hides the planes', async () => {
  const {instance, loads} = await buildArena();
  const before = instance._debug.models();
  assert.equal(before[1].loaded, false);
  assert.equal(before[1].planeVisible, true);
  assert.equal(await instance.setFighters({1: 'sira', 2: 'sira'}), true);
  assert.deepEqual(loads, ['sira', 'sira'], 'only the chosen fighters (same fighter twice → two clones)');
  const m = instance._debug.models();
  assert.equal(m[1].loaded && m[2].loaded, true);
  assert.equal(m[1].planeVisible, false);
  assert.notEqual(instance.api.fighterModel(1).rig.model, instance.api.fighterModel(2).rig.model);
  // Same selection again → no reload.
  await instance.setFighters({1: 'sira', 2: 'sira'});
  assert.equal(loads.length, 2);
  // Changing one seat reloads only that seat; unknown ids are ignored.
  await instance.setFighters({1: 'sira', 2: 'nyx'});
  await instance.setFighters({1: 'evil<script>', 2: 'nyx'});
  assert.deepEqual(loads, ['sira', 'sira', 'nyx']);
  assert.equal(instance._debug.models()[2].fighter, 'nyx');
  instance.destroy();
});

test('arena3d + models: skills, hits, slowMo, hitStop, KO and victory drive the rig', async () => {
  const {instance, run} = await buildArena();
  await instance.setFighters({1: 'vargr', 2: 'doran'});
  instance.handle({type: 'SKILL_CAST', fromSeat: 1, skill: 'e'});
  run(32);
  let m = instance._debug.models();
  assert.equal(m[1].state, 'e');
  assert.equal(m[1].clip, 'Dodge_Forward', 'Şerit H: önce yolculuk (koşu/atılma) klibi');
  run(500);
  assert.equal(instance._debug.models()[1].clip, '2H_Melee_Attack_Spin', 'yolculuktan sonra saldırı klibi');
  run(400);
  assert.ok(Math.abs(instance._debug.models()[1].yaw) > 1, 'Kasırga turns the model on its own axis');
  assert.ok(instance._debug.skillFx().kinds.includes('swirl'));
  // Server damage arrives with the cast: the defender reacts at the attacker's hit moment.
  instance.clear();
  instance.handle({type: 'SKILL_CAST', fromSeat: 1, skill: 'q'});
  instance.handle({type: 'DAMAGE_APPLIED', fromSeat: 1, toSeat: 2, amount: 60});
  run(16);
  assert.notEqual(instance._debug.models()[2].state, 'hit', 'not before the axe lands');
  run(900);
  m = instance._debug.models();
  assert.ok(['hit', 'idle'].includes(m[2].state));
  // slowMo → mixer time scale; hitStop → paused.
  instance.api.slowMo(0.25, 1000);
  run(300);
  assert.ok(instance._debug.models()[1].timeScale < 0.5, 'slowMo slows the mixer');
  run(1200);
  assert.equal(instance._debug.models()[1].timeScale, 1);
  instance.api.hitStop(120, 2, 1);
  run(16);
  assert.equal(instance._debug.models()[2].paused, true, 'hit-stop pauses the mixer');
  run(200);
  assert.equal(instance._debug.models()[2].paused, false);
  // KO → Death_A, winner → Cheer.
  instance.handle({type: 'KNOCKOUT', seat: 2});
  instance.onMatchEnd({winnerSeat: 1});
  run(32);
  m = instance._debug.models();
  assert.equal(m[2].clip, 'Death_A');
  assert.equal(m[1].clip, 'Cheer');
  instance.clear();
  run(16);
  assert.equal(instance._debug.models()[2].state, 'idle', 'clear() stands the fighters back up');
  instance.destroy();
});

test('arena visual queue keeps two ranged attacks separate and exposes position and clip time', async () => {
  const impacts = [];
  const {instance, run} = await buildArena({loadModel: async () => fakeAsset({duration: 1.2}),
    onImpact: (event, scene) => impacts.push({event, scene})});
  await instance.setFighters({1: 'sira', 2: 'sira'});
  instance.handle({type: 'SKILL_CAST', fromSeat: 1, toSeat: 2, skill: 'q'});
  instance.handle({type: 'DAMAGE_APPLIED', fromSeat: 1, toSeat: 2, skill: 'q', amount: 50});
  instance.handle({type: 'SKILL_CAST', fromSeat: 2, toSeat: 1, skill: 'q'});
  instance.handle({type: 'DAMAGE_APPLIED', fromSeat: 2, toSeat: 1, skill: 'q', amount: 50});
  run(400);
  let models = instance._debug.models();
  assert.equal(models[1].clip, 'Throw');
  assert.equal(models[2].state, 'idle');
  assert.equal(typeof models[1].x, 'number');
  assert.ok(models[1].clipTime > 0);
  run(900);
  models = instance._debug.models();
  assert.equal(models[2].clip, 'Throw');
  assert.equal(impacts.length, 1);
  run(1100);
  assert.equal(impacts.length, 2);
  assert.ok(impacts.every(i => i.scene));
  instance.destroy();
});

test('rig hit reaction returns to idle by 1.4 seconds even if the clip is long', () => {
  const rig = createFighterRig(THREE, fakeAsset({duration: 9}), {fighterId: 'sira', seat: 1});
  rig.play('hit');
  for (let i = 0; i < 100; i++) rig.update(0.02);
  assert.equal(rig.stats().state, 'idle');
  rig.dispose();
});

test('ranged scene duration includes the full source clip', () => {
  const rig = createFighterRig(THREE, fakeAsset({duration: 2}), {fighterId: 'sira', seat: 1});
  assert.ok(rig.sceneDuration('q') >= 1800);
  rig.dispose();
});

test('arena3d + models: projectile skills spawn their effect (sira spear, nyx meteor, doran shield break)', async () => {
  const {instance, run} = await buildArena();
  await instance.setFighters({1: 'sira', 2: 'nyx'});
  instance.handle({type: 'SKILL_CAST', fromSeat: 1, skill: 'q'});
  run(700);
  assert.ok(instance._debug.skillFx().kinds.includes('spear'));
  instance.clear();
  instance.handle({type: 'SKILL_CAST', fromSeat: 2, skill: 'r'});
  run(750); // Şerit H: ulti başında kısa yavaş çekim (0,42) meteor çıkışını geciktirir
  assert.ok(instance._debug.skillFx().kinds.includes('meteor'));
  instance.clear();
  await instance.setFighters({1: 'sira', 2: 'doran'});
  instance.handle({type: 'SKILL_CAST', fromSeat: 2, skill: 'e'});
  run(950); // Şerit H: yolculuk 400 ms + kalkan vuruşu 480 ms
  assert.ok(instance._debug.fighter(1).bubble, "doran's shield bash shatters the opponent's guard");
  instance.destroy();
});

test('arena3d + models: load failure keeps the flat fighter (fallback)', async () => {
  const {instance, run, root} = await buildArena({loadModel: async () => { throw new Error('404'); }});
  assert.equal(await instance.setFighters({1: 'vargr', 2: 'doran'}), false);
  const m = instance._debug.models();
  assert.equal(m[1].loaded, false);
  assert.equal(m[1].failed, true);
  assert.equal(m[1].planeVisible, true);
  assert.equal(root.classList.contains('pvp26-3d'), true, 'flat 3D arena still runs');
  instance.handle({type: 'SKILL_CAST', fromSeat: 1, skill: 'q'});
  run(100);
  assert.ok(instance._debug.fighter(1).tracks > 0, 'flat lunge still plays');
  instance.destroy();
});

test('arena3d + models: destroy disposes rigs and effects', async () => {
  const {instance, run} = await buildArena();
  await instance.setFighters({1: 'nyx', 2: 'sira'});
  const rigs = [1, 2].map(s => instance.api.fighterModel(s).rig);
  instance.handle({type: 'SKILL_CAST', fromSeat: 1, skill: 'q'});
  run(400);
  instance.destroy();
  assert.ok(rigs.every(r => r.stats().disposed));
  assert.equal(instance.api.fighterModel(1), null);
});

test('assist: partner silhouette uses the partner 3D model when loaded', async () => {
  const {instance, run} = await buildArena();
  await instance.setFighters({1: 'vargr', 2: 'nyx'});
  const assist = createArena3DAssist(instance.api);
  instance.registerPlugin(assist);
  instance.handle({type: 'ASSIST_CAST', fromSeat: 1, toSeat: 2, partner: 'rune'});
  run(100);
  const s = assist.stats();
  assert.equal(s.seats[1].ghost, true);
  assert.equal(s.seats[1].visible, true);
  run(900);
  assert.equal(assist.stats().active, 0);
  instance.destroy();
});

test('fx plugin: a character skill replaces the archetype ring/projectile; flat fallback keeps it', async () => {
  const {instance} = await buildArena();
  await instance.setFighters({1: 'sira', 2: 'nyx'});
  const fx = createArena3DFx(instance.api);
  instance.registerPlugin(fx);
  for (const skill of ['q', 'e', 'r']) instance.handle({type: 'SKILL_CAST', fromSeat: 1, toSeat: 2, skill});
  let st = fx.stats();
  assert.equal(st.totals.characterSkills, 3);
  assert.equal(st.projectiles, 0, 'no archetype projectile on top of the spear');
  assert.equal(st.rings, 0, 'no archetype Q/E/R ring');
  // Counters and ultimates keep their shared presentation.
  instance.handle({type: 'COUNTERATTACK_CAST', fromSeat: 1, toSeat: 2});
  assert.equal(fx.stats().projectiles, 1);
  instance.destroy();

  const flat = await buildArena({loadModel: async () => { throw new Error('404'); }});
  await flat.instance.setFighters({1: 'sira', 2: 'nyx'});
  const fx2 = createArena3DFx(flat.instance.api);
  flat.instance.registerPlugin(fx2);
  flat.instance.handle({type: 'SKILL_CAST', fromSeat: 1, toSeat: 2, skill: 'q'});
  st = fx2.stats();
  assert.equal(st.totals.characterSkills, 0);
  assert.equal(st.projectiles, 1, 'flat fallback: archetype projectile as before');
  assert.ok(st.rings >= 1);
  flat.instance.destroy();
});
