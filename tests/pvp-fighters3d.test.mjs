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
import {FIGHTERS, BASE_FIGHTER_IDS as FIGHTER_IDS} from '../pvp/shared/fighters.js';
import {createArena3D} from '../pvp/arena3d.js';
import {TURN} from '../pvp/visual-timeline.js';
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
    const peak=MODEL_VARIANTS.vargr.meshy.skills[skill].peakMs;
    // İş 1, 3. tur: doğal hız; hazırlık (≤750 ms) + temas + takip (≤750 ms) görünür, dönüş takipten sonra.
    assert.equal(attack.speed,1);
    assert.ok(Math.abs(attack.offset*1000-(peak-Math.min(peak,750)))<1,`${skill} hazırlık penceresi`);
    assert.ok(Math.abs(plan.hitMs-(attack.at+Math.min(peak,750)))<1,`${skill} temas = klip zirvesi`);
    assert.ok(plan.timing.returnStart>=plan.hitMs+Math.min(fullMs-peak,750)-1,`${skill} takip dönüşten önce biter`);
  }
  rig.play('r',{force:true});
  // Düzeltme turu 2 / B: ulti sahnesi ≤ ~3 sn → hazırlık temastan 1,8 sn önce başlar.
  assert.ok(Math.abs(rig.actions.Charged_Axe_Chop.time-(4.375-1.8*rig.actions.Charged_Axe_Chop.getEffectiveTimeScale()))<0.01,'ultimate windup is capped at 1.8s');
  assert.ok(rig.ultimatePeakMs<=1800+1&&rig.ultimateDurationMs<=3000+1,'ultimate scene <= 3s');
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
      const shared = FIGHTERS[id].skills[s === 'e' ? 'w' : s]; // KESINYAP 21: motor 'e' (yakın vuruş) = karakter alanı W
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
  // İş 1, 3. tur: telegraf → koşu → vuruş (doğal hız) → yön çevirip koşarak dönüş.
  const T = instance._debug.chainPlan(1, ['e']).timing;
  run(32);
  let m = instance._debug.models();
  assert.equal(m[1].state, 'e');
  assert.equal(m[1].clip, '2H_Melee_Idle', 'telegraf: yerinde hazırlık');
  run(T.telegraphMs + 60);
  assert.equal(instance._debug.models()[1].clip, 'Dodge_Forward', 'gidişte koşu klibi');
  run(T.strikes[0].start - T.telegraphMs);
  assert.equal(instance._debug.models()[1].clip, '2H_Melee_Attack_Spin', 'yolculuktan sonra saldırı klibi');
  run(T.moveStart - T.strikes[0].start + 200);
  assert.ok(instance._debug.skillFx().kinds.includes('swirl'));
  assert.equal(instance._debug.models()[1].clip, 'Dodge_Forward', 'dönüşte koşu klibi');
  assert.ok(Math.abs(instance._debug.models()[1].yaw) > 1, 'dönüşte gövde eve döner (geri geri yürümez)');
  // Server damage arrives with the cast: the defender reacts at the attacker's hit moment.
  instance.clear();
  run(T.totalMs + 2000); // raund geçişi: model yerine yürür (anında oturtma yok)
  instance.handle({type: 'SKILL_CAST', fromSeat: 1, skill: 'q'});
  instance.handle({type: 'DAMAGE_APPLIED', fromSeat: 1, toSeat: 2, amount: 60});
  run(16);
  assert.notEqual(instance._debug.models()[2].state, 'hit', 'not before the axe lands');
  run(instance._debug.chainPlan(1, ['q']).contacts[0].ms + 100);
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
  // İş 1, 3. tur: menzilli yerinde kalır; telegraf → atış klibi (doğal hız) → mermi ~600 ms → temas.
  const P = instance._debug.chainPlan(1, ['q']);
  run(P.timing.strikes[0].start + 150);
  let models = instance._debug.models();
  assert.equal(models[1].clip, 'Throw');
  assert.equal(models[2].state, 'idle');
  assert.equal(typeof models[1].x, 'number');
  assert.ok(models[1].clipTime > 0);
  assert.equal(impacts.length, 0, 'mermi varmadan hasar yok');
  // sahne biter + savunanın tepkisi + saldıran değişimi arası (~1,3 sn) + telegraf → ikinci koltuk atar
  run(P.totalMs + TURN.breathMs + P.timing.strikes[0].start + 200 - (P.timing.strikes[0].start + 150));
  models = instance._debug.models();
  assert.equal(models[2].clip, 'Throw');
  assert.equal(impacts.length, 1);
  run(P.contacts[0].ms);
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
  run(instance._debug.chainPlan(1, ['q']).contacts[0].releaseMs + 100); // İş 1, 3. tur: mızrak el bırakma karesinde çıkar
  assert.ok(instance._debug.skillFx().kinds.includes('spear'));
  instance.clear();
  instance.handle({type: 'SKILL_CAST', fromSeat: 2, skill: 'r'});
  run(750); // Şerit H: ulti başında kısa yavaş çekim (0,42) meteor çıkışını geciktirir
  assert.ok(instance._debug.skillFx().kinds.includes('meteor'));
  instance.clear();
  await instance.setFighters({1: 'sira', 2: 'doran'});
  instance.handle({type: 'SKILL_CAST', fromSeat: 2, skill: 'e'});
  run(instance._debug.chainPlan(2, ['e']).contacts[0].ms + 80); // İş 1, 3. tur: telegraf + koşu + doğal hızda vuruş → temasta kalkan kırığı
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

test('Görev 4: 3 birikmiş saldırı = 1 yaklaşma + 3 temas + 1 dönüş; bot (koltuk 2) da koşarak saldırır', async () => {
  const impacts = [];
  const {instance, run} = await buildArena({onImpact: event => impacts.push(event)});
  await instance.setFighters({1: 'vargr', 2: 'nyx'});
  const cast = (seat, skill, amount) => {
    instance.handle({type: 'SKILL_CAST', fromSeat: seat, toSeat: 3 - seat, skill});
    instance.handle({type: 'DAMAGE_APPLIED', fromSeat: seat, toSeat: 3 - seat, skill, amount});
  };
  const P = instance._debug.chainPlan(1, ['q', 'e', 'q']);
  cast(1, 'q', 40); cast(1, 'e', 40); cast(1, 'q', 40);
  const q = () => instance.visualQueue.snapshot();
  assert.equal(q().queued, 0, 'üç saldırı tek girdide birleşir');
  assert.equal(q().started, 1);
  run(150);
  assert.equal(q().phase, 'approach');
  // İş 1, 3. tur: her vuruşun hasarı KENDİ temas karesinde (temastan önce yok).
  run(P.contacts[0].ms - 150 - 60); // run() 16 ms adımla biraz aşar: güvenli pay
  assert.equal(impacts.length, 0, 'ilk temastan önce hasar yok');
  // her temas kısa hit-stop ile sahne saatini durdurur → sonraki temaslar o kadar kayar
  for (let t = 0; t < 1500 && impacts.length < 3; t += 16) run(16);
  assert.equal(impacts.length, 3, 'her hasar kendi temas karesinde, toplam 3');
  assert.ok(instance._debug.models()[1].timeScale <= 1.25);
  assert.equal(q().started, 1, 'tek girdi: gidip gelme yok');
  for (let t = 0; t < 4000 && q().busy; t += 16) run(16); // dönüş (yön çevirip koşarak) biter
  assert.equal(q().busy, false);
  // Bot koltuğu (nyx, menzilli) yerinde atar; saldıran değişimi arası (~1,3 sn, iki taraf idle) dolar.
  run(TURN.breathMs + 100);
  cast(2, 'q', 30);
  run(100);
  assert.equal(q().activeSeat, 2);
  assert.ok(['approach', 'strike'].includes(q().phase));
  run(instance._debug.chainPlan(2, ['q']).totalMs + 100);
  assert.equal(q().busy, false);
  instance.destroy();
});

test('Düzeltme turu 2 / A: ilk temastan SONRA gelen saldırılar aynı yaklaşmada zincirlenir (comboIndex 1,2,3)', async () => {
  const impacts = [];
  const {instance, run} = await buildArena({onImpact: event => impacts.push(event)});
  await instance.setFighters({1: 'vargr', 2: 'nyx'});
  const cast = (seat, skill, amount) => {
    instance.handle({type: 'SKILL_CAST', fromSeat: seat, toSeat: 3 - seat, skill});
    instance.handle({type: 'DAMAGE_APPLIED', fromSeat: seat, toSeat: 3 - seat, skill, amount});
  };
  const q = () => instance.visualQueue.snapshot();
  const runUntil = (cond, max = 8000) => { for (let t = 0; t < max && !cond(); t += 16) run(16); };
  cast(1, 'q', 40);
  run(instance._debug.chainPlan(1, ['q']).contacts[0].ms + 80); // ilk temas geçti (İş 1, 3. tur: telegraf + koşu + doğal vuruş)
  assert.equal(impacts.length, 1);
  assert.equal(q().comboIndex, 1);
  cast(1, 'q', 40); // temastan ~80 ms sonra (dönüş başlamadan): eskiden yeni girdi açılıyordu
  assert.equal(q().queued, 0, 'yeni girdi yok: zincire eklendi');
  runUntil(() => impacts.length >= 2);
  assert.equal(q().comboIndex, 2, 'ikinci hasar kendi temas karesinde');
  cast(1, 'e', 40);
  assert.equal(q().queued, 0);
  runUntil(() => impacts.length >= 3);
  assert.equal(impacts.length, 3);
  assert.equal(q().started, 1, 'tek yaklaşma + tek dönüş');
  runUntil(() => !q().busy);
  assert.equal(q().busy, false);
  run(TURN.sameSeatMs + 50); // aynı koltuğun yeni yaklaşması: kısa oturma payı
  // Dönüş başladıktan sonra gelen saldırı yeni girdi (yeni yaklaşma) olur; ışınlanma yok.
  cast(1, 'q', 40);
  assert.equal(q().started, 2);
  instance.destroy();
});

test('Düzeltme turu 2 / C: bot (koltuk 2) hasarı sahnesiz düşmez — koş→vur→dön, activeSeat 2', async () => {
  const impacts = [];
  const {instance, run} = await buildArena({onImpact: event => impacts.push(event)});
  await instance.setFighters({1: 'vargr', 2: 'nyx'});
  const q = () => instance.visualQueue.snapshot();
  instance.handle({type: 'SKILL_CAST', fromSeat: 2, toSeat: 1, skill: 'q'});
  instance.handle({type: 'DAMAGE_APPLIED', fromSeat: 2, toSeat: 1, skill: 'q', amount: 30});
  run(80);
  assert.equal(q().activeSeat, 2);
  assert.equal(impacts.length, 0, 'temas karesinden önce hasar yok');
  const phases = new Set();
  for (let i = 0; i < 160 && q().busy; i++) { run(16); phases.add(q().phase); }
  assert.equal(impacts.length, 1, 'hasar bot sahnesinin temas karesinde');
  assert.ok(phases.has('approach') && phases.has('strike'), `fazlar: ${[...phases]}`);
  instance.destroy();
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

// J2 — maça girişte eski/2B düzlem silüeti (ya da bir önceki model) parlamaz: model yüklenirken düzlem gizli, yalnız hatada yedek.
test('J2: model yüklenirken 2B düzlem silüeti görünmez; yüklenince model, hata verirse yedek silüet', async () => {
  let release;
  const gate = new Promise(r => { release = r; });
  const {instance} = await buildArena({loadModel: async () => { await gate; return fakeAsset(); }});
  const job = instance.setFighters({1: 'sira', 2: 'doran'});
  let m = instance._debug.models();
  assert.deepEqual([m[1].loaded, m[2].loaded], [false, false], 'yükleme sürüyor');
  assert.deepEqual([m[1].planeVisible, m[2].planeVisible], [false, false], 'yüklenirken eski 2B düzlem silüeti parlamaz');
  release();
  assert.equal(await job, true);
  m = instance._debug.models();
  assert.deepEqual([m[1].loaded, m[2].loaded, m[1].planeVisible], [true, true, false]);
  // Karakter değişince önceki model → düzlem silüetine DÖNMEZ; yeni model gelene dek gizli kalır.
  let release2;
  const gate2 = new Promise(r => { release2 = r; });
  const sw = await buildArena({loadModel: async (url, id) => { if (id === 'nyx') await gate2; return fakeAsset(); }});
  await sw.instance.setFighters({1: 'sira', 2: 'doran'});
  const swap = sw.instance.setFighters({1: 'nyx', 2: 'doran'});
  assert.equal(sw.instance._debug.models()[1].planeVisible, false, 'değişim sırasında düzlem silüet yok');
  assert.equal(sw.instance._debug.models()[1].loaded, false);
  release2();
  await swap;
  assert.equal(sw.instance._debug.models()[1].loaded, true);
  instance.destroy();
  sw.instance.destroy();
  // Hata: yedek düzlem silüeti görünür (bilinçli yedek).
  const bad = await buildArena({loadModel: async () => { throw new Error('404'); }});
  assert.equal(await bad.instance.setFighters({1: 'sira', 2: 'doran'}), false);
  assert.deepEqual([bad.instance._debug.models()[1].failed, bad.instance._debug.models()[1].planeVisible], [true, true]);
  bad.instance.destroy();
});
