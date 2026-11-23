// docs/3 — destek hayaleti zamanlaması: çözüm modunda (resolve:true) ASSIST_CAST eklentilere hemen gitmez;
// destek hasarının bağlandığı vuruşun sahnesi oynarken, temastan ~dashEnd önce iletilir. Aynı koltuğun ikinci
// desteği birincisini ezmez (sıraya girer). Raund geçişi (settle/clear) bekleyenleri iptal eder. Canlı mod değişmez.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../pvp/vendor/three.module.min.js';
import {CHOREOGRAPHY, resolveChoreography} from '../pvp/fighters3d.js';
import {createArena3D} from '../pvp/arena3d.js';
import {createArena3DAssist, ASSIST_FX} from '../pvp/arena3d-assist.js';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

function clipNames() {
  const names = new Set(['Idle', '2H_Melee_Idle', 'Hit_A', 'Hit_B', 'Blocking', 'Block_Hit', 'Death_A', 'Cheer']);
  for (const id of Object.keys(CHOREOGRAPHY)) {
    const c = resolveChoreography(id);
    names.add(c.idle);
    for (const s of ['q', 'e', 'r']) for (const step of c[s].steps) names.add(step.clip);
  }
  return [...names];
}
function fakeAsset(duration = 0.5) {
  const scene = new THREE.Group();
  const root = new THREE.Bone(); root.name = 'root';
  const head = new THREE.Bone(); head.name = 'head'; head.position.y = 1.23;
  const hand = new THREE.Bone(); hand.name = 'handslotr'; hand.position.set(0.3, 0.6, 0);
  scene.add(root); root.add(head); root.add(hand);
  const material = new THREE.MeshStandardMaterial({map: new THREE.Texture()});
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.4, 0.6).translate(0, 1.2, 0), material));
  const clips = clipNames().map(name => new THREE.AnimationClip(name, duration, [
    new THREE.VectorKeyframeTrack('head.position', [0, duration], [0, 1.23, 0, 0, 1.3, 0]),
  ]));
  return {gltf: {scene, animations: clips}, clips, sharedMaterial: material};
}
class FakeClassList { value = new Set(); add(...x) { x.forEach(v => this.value.add(v)); } remove(...x) { x.forEach(v => this.value.delete(v)); } contains(x) { return this.value.has(x); } }
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
function fake2d() {
  const grad = {addColorStop() {}};
  return new Proxy({}, {get: (t, k) => (k in t ? t[k] : () => grad), set: (t, k, v) => { t[k] = v; return true; }});
}
async function buildArena({search = '', reduced = false} = {}) {
  const root = el('root');
  const duel = el('duel', {left: 0, top: 0, width: 1000, height: 500});
  root.selectors['.pvp2-duel'] = duel;
  duel.selectors['.pvp2-side[data-seat="1"] .pvp2-stage'] = el('s1', {left: 10, top: 100, width: 480, height: 300});
  duel.selectors['.pvp2-side[data-seat="2"] .pvp2-stage'] = el('s2', {left: 510, top: 100, width: 480, height: 300});
  let clock = 1000;
  const doc = {hidden: false, addEventListener() {}, removeEventListener() {},
    createElement: () => { const c = el('canvas'); c.width = 0; c.height = 0; c.getContext = kind => (kind === '2d' ? fake2d() : null); return c; }};
  root.ownerDocument = doc;
  const env = {document: doc, devicePixelRatio: 1, performance: {now: () => clock}, setTimeout, clearTimeout,
    location: {search}, advance(ms) { clock += ms; }, get clock() { return clock; }};
  const renderer = {setPixelRatio() {}, setSize() {}, setClearColor() {}, render() {}, dispose() {}};
  const impacts = [];
  const instance = await createArena3D({
    root, THREE, env, isReduced: () => reduced, createRenderer: () => renderer,
    onImpact: (event, scene) => impacts.push({event, scene, t: clock}),
    loadTexture: async () => new THREE.Texture(), loadModel: async () => fakeAsset(), cloneModel: o => o.clone(true),
  });
  await instance.ready;
  await instance.setFighters({1: 'vargr', 2: 'doran'});
  // Gözcü eklenti: ASSIST_CAST'in eklentilere ulaştığı an + o anki görsel kuyruk durumu.
  const got = [];
  instance.registerPlugin({handle(e) { if (e.type === 'ASSIST_CAST') got.push({t: clock, slot: e.sceneSlot, snap: instance.visualQueue.snapshot()}); }});
  const assist = createArena3DAssist(instance.api);
  instance.registerPlugin(assist);
  const run = (ms, step = 16) => { for (let t = 0; t < ms; t += step) { env.advance(step); instance._debug.tick(); } };
  const runUntil = (pred, max = 20000, step = 16) => { for (let t = 0; t < max && !pred(); t += step) { env.advance(step); instance._debug.tick(); } return pred(); };
  return {instance, env, run, runUntil, got, assist, impacts};
}
const assistCast = (from, slot, extra = {}) => ({type: 'ASSIST_CAST', fromSeat: from, toSeat: 3 - from, skill: 'assist', assist: true,
  partner: from === 1 ? 'rune' : 'fire', resolve: true, scene: 2, sceneSlot: slot, ...extra});
const assistDamage = from => ({type: 'DAMAGE_APPLIED', fromSeat: from, toSeat: 3 - from, skill: 'assist', assist: true,
  partner: from === 1 ? 'rune' : 'fire', amount: 210, hpAfter: 5000});
/** Koltuk 2'nin (canlı, tampona girmeyen) q sahnesi: koltuk 1'in sahnesi onun arkasında sıraya girer. */
const liveQ = (instance, from = 2) => {
  instance.handle({type: 'SKILL_CAST', fromSeat: from, toSeat: 3 - from, skill: 'q'});
  instance.handle({type: 'DAMAGE_APPLIED', fromSeat: from, toSeat: 3 - from, skill: 'q', amount: 40, hpAfter: 5900});
};

test('docs/3: resolve’lu ASSIST_CAST hemen oynamaz; kendi sahnesi oynarken, temastan ~dashEnd önce başlar', async () => {
  const {instance, run, runUntil, got, assist, impacts} = await buildArena();
  liveQ(instance, 2);
  assert.equal(instance.visualQueue.snapshot().activeSeat, 2, 'önce koltuk 2 sahnesi oynuyor');
  instance.handle(assistCast(1, 0));
  instance.handle(assistDamage(1));
  assert.equal(got.length, 0, 'ASSIST_CAST eklentilere hemen iletilmedi');
  assert.equal(assist.stats().casts, 0, 'hayalet başlamadı');
  run(300);
  assert.equal(got.length, 0, 'öbür koltuğun sahnesi sürerken hayalet yok');
  assert.ok(runUntil(() => got.length > 0), 'sahne sırası gelince iletildi');
  const at = got[0];
  assert.equal(at.snap.activeSeat, 1, 'kendi (koltuk 1) sahnesi oynarken');
  assert.equal(at.snap.phase, 'approach', 'ilk temastan önce');
  const s = assist.stats();
  assert.equal(s.casts, 1); assert.equal(s.seats[1].visible, true, 'hayalet görünür');
  // Hayaletin vuruş anı (dashEnd) destek hasarının temas karesiyle çakışır (±1 kare + yuvarlama).
  assert.ok(runUntil(() => impacts.some(i => i.event.assist)), 'destek hasarı temasta gösterildi');
  const hit = impacts.find(i => i.event.assist);
  assert.equal(hit.scene, true, 'hasar sahnesiyle');
  const lead = Math.round(ASSIST_FX.totalMs * ASSIST_FX.dashEnd);
  assert.ok(Math.abs((hit.t - at.t) - lead) <= 40, `hayalet temastan ${hit.t - at.t} ms önce başladı (beklenen ~${lead})`);
  instance.destroy();
});

test('docs/3: aynı raunttaki iki destek sırayla oynar, ikincisi birincisini ezmez', async () => {
  const {instance, runUntil, got, assist} = await buildArena();
  liveQ(instance, 2);
  instance.handle(assistCast(1, 3));
  instance.handle(assistDamage(1));
  instance.handle(assistCast(1, 4));
  instance.handle(assistDamage(1));
  // Not: koltuk 1'in sahnesini motor normalde SKILL_CAST'le açar; burada güvenlik ağı (bağlanacak sahne yoksa q sahnesi) açar.
  assert.equal(got.length, 0);
  assert.ok(runUntil(() => assist.stats().casts >= 1));
  let s = assist.stats();
  assert.equal(s.casts, 1, 'yalnız birincisi başladı');
  assert.equal(s.waiting + (2 - got.length), 1, 'ikincisi bekliyor (eklentide ya da çekirdekte)');
  const firstStart = s.seats[1].progress;
  assert.ok(firstStart < 0.2, 'birincisi baştan oynuyor');
  // Birincisi bitmeden ikincisi başlamaz (ilerleme sıfırlanmaz).
  const t0 = got[0].t;
  let restarted = false, prev = 0;
  runUntil(() => {
    const p = assist.stats().seats[1].progress;
    if (assist.stats().casts === 1 && p < prev) restarted = true;
    prev = p;
    return assist.stats().casts >= 2;
  });
  assert.equal(restarted, false, 'birincisi ezilmedi');
  assert.equal(assist.stats().casts, 2, 'ikincisi de oynadı');
  assert.equal(got.length, 2);
  assert.ok(got.every(g => g.t >= t0));
  instance.destroy();
});

test('docs/3: raund geçişi (settle/clear) bekleyen hayaletleri iptal eder; tur arasında hayalet doğmaz', async () => {
  for (const how of ['settle', 'clear']) {
    const {instance, run, got, assist} = await buildArena();
    liveQ(instance, 2);
    instance.handle(assistCast(1, 1));
    instance.handle(assistDamage(1));
    run(200);
    instance[how]();
    run(8000);
    assert.equal(got.length, 0, `${how}: ASSIST_CAST hiç iletilmedi`);
    const s = assist.stats();
    assert.equal(s.casts, 0, `${how}: hayalet başlamadı`); assert.equal(s.active, 0); assert.equal(s.waiting, 0);
    instance.destroy();
  }
  // Oynayan + eklentide bekleyen hayalet de clear ile durur.
  const {instance, runUntil, run, assist} = await buildArena();
  instance.handle(assistCast(1, 3)); instance.handle(assistDamage(1));
  instance.handle(assistCast(1, 4)); instance.handle(assistDamage(1));
  assert.ok(runUntil(() => assist.stats().active === 1));
  instance.settle();
  run(3000);
  const s = assist.stats();
  assert.equal(s.active, 0); assert.equal(s.waiting, 0); assert.equal(s.seats[1].visible, false);
  assert.equal(s.casts, 1, 'ikincisi raund geçişinden sonra başlamadı');
  instance.destroy();
});

test('docs/3: motor sırası — sahne olayları topluca (tampon + destek yuva 1, 2) gelir; hayaletler sahne oynarken sırayla', async () => {
  const {instance, runUntil, got, assist, impacts} = await buildArena();
  const R = {resolve: true, scene: 1};
  // Koltuk 2: Q (yuva 0) + iki destek (yuva 1, 2) — kullanıcının ölçtüğü "aynı milisaniyede iki ASSIST_CAST".
  instance.handle({type: 'SKILL_CAST', fromSeat: 2, toSeat: 1, skill: 'q', sceneSlot: 0, ...R});
  instance.handle({type: 'DAMAGE_APPLIED', fromSeat: 2, toSeat: 1, skill: 'q', amount: 40, hpAfter: 5900, ...R});
  for (const slot of [1, 2]) {
    instance.handle(assistCast(2, slot, R));
    instance.handle({...assistDamage(2), ...R});
  }
  assert.equal(got.length, 0, 'sahne başında hiçbir hayalet iletilmedi');
  await new Promise(r => setTimeout(r, 80)); // 40 ms sahne tamponu (holdSceneEvent) gerçek zamanlayıcıyla
  assert.equal(got.length, 0);
  assert.ok(runUntil(() => got.length === 2 && assist.stats().active === 0 && assist.stats().waiting === 0));
  assert.deepEqual(got.map(g => g.slot), [1, 2], 'yuva sırasıyla');
  assert.ok(got.every(g => g.snap.activeSeat === 2), 'ikisi de koltuk 2 sahnesi oynarken iletildi');
  assert.equal(assist.stats().casts, 2, 'ikisi de oynadı (ezilmedi)');
  const assists = impacts.filter(i => i.event.assist);
  assert.equal(assists.length, 2); assert.ok(assists.every(i => i.scene), 'destek hasarları sahneyle');
  instance.destroy();
});

test('docs/3: canlı modda (resolve yok) hayalet eskisi gibi anında başlar', async () => {
  const {instance, got, assist} = await buildArena();
  liveQ(instance, 2);
  instance.handle({type: 'ASSIST_CAST', fromSeat: 1, toSeat: 2, partner: 'rune'});
  assert.equal(got.length, 1, 'anında iletildi');
  assert.equal(assist.stats().casts, 1); assert.equal(assist.stats().seats[1].visible, true);
  instance.destroy();
});

test('docs/3: hareket azaltmada çözüm olayı da anında yalnız flaş (sıra yok)', async () => {
  const {instance, got, assist} = await buildArena({reduced: true});
  instance.handle(assistCast(1, 2));
  assert.equal(got.length, 1);
  const s = assist.stats();
  assert.equal(s.casts, 1); assert.equal(s.meshes, 0, 'siluet yok, yalnız flaş');
  instance.destroy();
});

test('docs/3: ?animprobe=1 altında __tuslabAssistLog hayaletin görünür olduğu anı kaydeder', async () => {
  const {instance, env, runUntil} = await buildArena({search: '?animprobe=1'});
  assert.deepEqual(env.__tuslabAssistLog, []);
  liveQ(instance, 2);
  instance.handle(assistCast(1, 3)); instance.handle(assistDamage(1));
  assert.equal(env.__tuslabAssistLog.length, 0, 'bekleyen hayalet kaydedilmez');
  assert.ok(runUntil(() => env.__tuslabAssistLog.length > 0));
  const [row] = env.__tuslabAssistLog;
  assert.deepEqual({fromSeat: row.fromSeat, sceneSlot: row.sceneSlot, resolve: row.resolve}, {fromSeat: 1, sceneSlot: 3, resolve: true});
  assert.ok(Number.isFinite(row.t));
  instance.destroy();
  const plain = await buildArena();
  assert.equal(plain.env.__tuslabAssistLog, undefined, 'bayrak yoksa kayıt yok');
  plain.instance.destroy();
});

test('docs/3: kaynak — clear() bekleyenleri boşaltır, ASSIST_CAST sahne başında iletilmez', () => {
  const src = read('pvp/arena3d.js');
  assert.match(src, /if \(deferAssistCast\(event\)\) return;[^\n]*\n\s*forwardToPlugins\(event\);/);
  const clearBody = src.slice(src.indexOf('function clear(notifyPlugins = true)'), src.indexOf('function registerPlugin('));
  assert.match(clearBody, /assistWaiting\.clear\(\)/); assert.match(clearBody, /assistCues\.length = 0/);
  assert.ok(src.indexOf('const assistWaiting') < src.indexOf('function clear(notifyPlugins'), 'TDZ yok: clear()’dan önce tanımlı');
});
