// Düzeltme turu 3 (6. oturum): gösterilen can geri zıplamaz, saldırı sahneleri düşürülmez,
// ulti sırası/süresi, menzilli Meshy zinciri (bot da koşar), blok tepkisi, KRİTİK karakterlerin arkasında.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../pvp/vendor/three.module.min.js';
import {CHOREOGRAPHY, resolveChoreography, createFighterRig, MODEL_VARIANTS, COMBO} from '../pvp/fighters3d.js';
import {createArena3D} from '../pvp/arena3d.js';
import {createDisplayedHp} from '../pvp/attack-callout.js';
import {impactTier} from '../pvp/impact-feel.js';

// ------------------------------------------------------------ sentetik varlık + arena

function clipNames(extra = []) {
  const names = new Set(['Idle', '2H_Melee_Idle', 'Hit_A', 'Hit_B', 'Blocking', 'Block_Hit', 'Death_A', 'Cheer', ...extra]);
  for (const id of Object.keys(CHOREOGRAPHY)) {
    const c = resolveChoreography(id);
    names.add(c.idle);
    for (const s of ['q', 'e', 'r']) for (const step of c[s].steps) names.add(step.clip);
  }
  return [...names];
}
function fakeAsset({duration = 0.5, extra = [], variant} = {}) {
  const scene = new THREE.Group();
  const root = new THREE.Bone(); root.name = 'root';
  const head = new THREE.Bone(); head.name = 'head'; head.position.y = 1.23;
  const hand = new THREE.Bone(); hand.name = 'handslotr'; hand.position.set(0.3, 0.6, 0);
  scene.add(root); root.add(head); root.add(hand);
  const material = new THREE.MeshStandardMaterial({map: new THREE.Texture()});
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.4, 0.6).translate(0, 1.2, 0), material));
  const clips = clipNames(extra).map(name => new THREE.AnimationClip(name, duration, [
    new THREE.VectorKeyframeTrack('head.position', [0, duration], [0, 1.23, 0, 0, 1.3, 0]),
  ]));
  return {gltf: {scene, animations: clips}, clips, sharedMaterial: material, ...(variant ? {variant} : {})};
}
const meshyNames = id => [...Object.values(MODEL_VARIANTS[id].meshy.clips).flat(), ...Object.values(MODEL_VARIANTS[id].meshy.skills).map(s => s.clip)];

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
// 2B bağlam: her yöntem no-op (gradyan nesnesi döner) — KRİTİK düzlemi ve zemin dokuları çizilebilsin.
function fake2d() {
  const grad = {addColorStop() {}};
  return new Proxy({}, {get: (t, k) => (k in t ? t[k] : () => grad), set: (t, k, v) => { t[k] = v; return true; }});
}
async function buildArena({loadModel, onImpact} = {}) {
  const root = el('root');
  const duel = el('duel', {left: 0, top: 0, width: 1000, height: 500});
  root.selectors['.pvp2-duel'] = duel;
  duel.selectors['.pvp2-side[data-seat="1"] .pvp2-stage'] = el('s1', {left: 10, top: 100, width: 480, height: 300});
  duel.selectors['.pvp2-side[data-seat="2"] .pvp2-stage'] = el('s2', {left: 510, top: 100, width: 480, height: 300});
  let clock = 1000;
  const doc = {hidden: false, addEventListener() {}, removeEventListener() {},
    createElement: () => { const c = el('canvas'); c.width = 0; c.height = 0; c.getContext = kind => (kind === '2d' ? fake2d() : null); return c; }};
  root.ownerDocument = doc;
  const env = {document: doc, devicePixelRatio: 1, performance: {now: () => clock}, setTimeout, clearTimeout, advance(ms) { clock += ms; }};
  const renderer = {setPixelRatio() {}, setSize() {}, setClearColor() {}, render() {}, dispose() {}};
  const instance = await createArena3D({
    root, THREE, env, isReduced: () => false, onImpact, createRenderer: () => renderer,
    loadTexture: async () => new THREE.Texture(), loadModel: loadModel || (async () => fakeAsset()), cloneModel: o => o.clone(true),
  });
  await instance.ready;
  const run = (ms, step = 16) => { for (let t = 0; t < ms; t += step) { env.advance(step); instance._debug.tick(); } };
  return {instance, env, root, run};
}
const cast = (instance, from, skill, amount = 40, extra = {}) => {
  instance.handle({type: 'SKILL_CAST', fromSeat: from, toSeat: 3 - from, skill});
  instance.handle({type: 'DAMAGE_APPLIED', fromSeat: from, toSeat: 3 - from, skill, amount, hpAfter: 900, ...extra});
};

// ------------------------------------------------------------ (a) gösterilen can

function hpDom() {
  const observers = [];
  class MO { constructor(cb) { this.cb = cb; observers.push(this); } observe(n) { (n._mo ||= []).push(this); } disconnect() { this.off = true; } }
  const mk = () => ({style: {}, _t: '', _mo: null,
    get textContent() { return this._t; },
    set textContent(v) { this._t = v; for (const o of this._mo || []) if (!o.off) o.pending = true; }});
  const sides = {};
  for (const seat of [1, 2]) {
    const n = {'[data-server-hp]': mk(), '[data-server-hp-fill]': mk(), '[data-server-hp-trail]': mk()};
    sides[seat] = {n, querySelector: q => n[q] || null};
  }
  const root = {listeners: {}, ownerDocument: {defaultView: {MutationObserver: MO}},
    addEventListener(t, fn) { this.listeners[t] = fn; }, removeEventListener(t) { delete this.listeners[t]; },
    querySelector: q => { const m = /data-seat="(\d)"\]$/.exec(q); return m ? sides[m[1]] : null; }};
  // network.js gibi GERÇEK değeri yazar; MutationObserver geri çağrısı aynı görevin sonunda çalışır.
  const networkWrite = (seat, text) => { sides[seat].n['[data-server-hp]'].textContent = text; for (const o of observers) if (o.pending && !o.off) { o.pending = false; o.cb([]); } };
  return {root, sides, networkWrite};
}

test('gösterilen can: ağ katmanı gerçek değeri yeniden yazsa da temas karesine kadar tutulan değer kalır (geri zıplama yok)', () => {
  const {root, sides, networkWrite} = hpDom();
  let players = [{seat: 1, hp: 1200, maxHp: 1200}, {seat: 2, hp: 1200, maxHp: 1200}];
  let busy = false, t = 0;
  const hp = createDisplayedHp({root, getPlayers: () => players, isBusy: () => busy, setTimer: () => 1, clearTimer() {}, now: () => t});
  root.listeners['tuslab:pvp-match']();
  busy = true;
  players = [{seat: 1, hp: 1200, maxHp: 1200}, {seat: 2, hp: 1095, maxHp: 1200}];
  root.listeners['tuslab:pvp-match']();
  const text = () => sides[2].n['[data-server-hp]'].textContent;
  assert.equal(text(), '1.200 / 1.200 HP');
  networkWrite(2, '1.095 / 1.200 HP'); // 250 ms tikinde ağ katmanı gerçek değeri yazar
  assert.equal(text(), '1.200 / 1.200 HP', 'tutulan değer aynı görevde geri yazıldı');
  t = 300;
  hp.impact({toSeat: 2, hpAfter: 1095}); // temas karesi
  assert.equal(text(), '1.095 / 1.200 HP');
  networkWrite(2, '1.095 / 1.200 HP');
  assert.equal(text(), '1.095 / 1.200 HP');
});

test('gösterilen can: tavan (hpHoldMaxMs) her temasla yeniden başlar — önceki tutuştan kalan süre canı sahnesiz düşürmez', () => {
  const {root, sides} = hpDom();
  let players = [{seat: 2, hp: 1200, maxHp: 1200}];
  let t = 0, tick = null;
  const hp = createDisplayedHp({root, getPlayers: () => players, isBusy: () => true, setTimer: fn => { tick = fn; return 1; }, clearTimer() {}, now: () => t});
  root.listeners['tuslab:pvp-match']();
  players = [{seat: 2, hp: 1000, maxHp: 1200}];
  root.listeners['tuslab:pvp-match']();
  t = 3000; hp.impact({toSeat: 2, hpAfter: 1100});
  players = [{seat: 2, hp: 900, maxHp: 1200}];
  root.listeners['tuslab:pvp-match']();
  t = 4000; tick(); // ilk tutuştan 4 sn, son temastan 1 sn: bırakılmaz
  assert.equal(sides[2].n['[data-server-hp]'].textContent, '1.100 / 1.200 HP');
});

// ------------------------------------------------------------ (b)(c)(d) kuyruk, ulti, bot sahnesi

test('kuyruk: iki koltuk + ulti birikse de saldırı sahnesi düşürülmez; her hasar sahnesiyle (scene=true) gösterilir', async () => {
  const impacts = [];
  const {instance, run} = await buildArena({onImpact: (event, scene) => impacts.push({event, scene})});
  await instance.setFighters({1: 'vargr', 2: 'doran'});
  cast(instance, 1, 'q');
  cast(instance, 2, 'q');
  instance.handle({type: 'SKILL_CAST', fromSeat: 1, toSeat: 2, skill: 'r'});
  cast(instance, 2, 'e');
  run(14000);
  const qe = impacts.filter(i => i.event.skill !== 'r');
  assert.equal(qe.length, 3);
  assert.ok(qe.every(i => i.scene), JSON.stringify(qe.map(i => [i.event.fromSeat, i.event.skill, i.scene])));
  assert.equal(instance.visualQueue.snapshot().forced, 0, 'hiçbir girdi zorla bitirilmedi');
  instance.destroy();
});

test('ulti sırası: başka koltuk saldırırken gelen ULTIMATE_PHASE, ulti girdisi başlayana dek bekletilir (üst üste binme yok)', async () => {
  const {instance, run} = await buildArena();
  await instance.setFighters({1: 'vargr', 2: 'doran'});
  cast(instance, 1, 'q');
  run(50);
  instance.handle({type: 'SKILL_CAST', fromSeat: 2, toSeat: 1, skill: 'r'});
  instance.handle({type: 'ULTIMATE_PHASE', fromSeat: 2, toSeat: 1, skill: 'r', phase: 1, ultimateId: 7});
  instance.handle({type: 'DAMAGE_APPLIED', fromSeat: 2, toSeat: 1, skill: 'r', phase: 1, amount: 90, ultimateId: 7});
  run(100);
  assert.equal(instance._debug.ultimate(), null, 'seat 1 oynarken seat 2 ultisi başlamadı');
  assert.equal(instance.visualQueue.snapshot().activeSeat, 1);
  run(3400); // İş 1: seat 1 sahnesi (koşu + vuruş + geri yürüyüş) + saldıran değişimi arası (~1,2 sn)
  assert.equal(instance.visualQueue.snapshot().activeSeat, 2);
  assert.equal(instance._debug.ultimate()?.attacker, 2, 'ulti kendi sırasında başladı');
  instance.destroy();
});

test('ulti etki kademesi: yalnız ana vuruş (faz 2) yavaş çekimli large; çekiş/iniş medium', () => {
  assert.equal(impactTier({skill: 'r', phase: 1}), 'medium');
  assert.equal(impactTier({skill: 'r', phase: 2}), 'large');
  assert.equal(impactTier({skill: 'r', phase: 3}), 'medium');
  assert.equal(impactTier({skill: 'r'}), 'large');
});

test('menzilli Meshy (nyx) q/e zinciri kurulur: koşu ile yaklaşır, sonra büyü (bot sahnesiz kalmaz)', () => {
  const rig = createFighterRig(THREE, fakeAsset({extra: meshyNames('nyx'), variant: 'meshy'}), {fighterId: 'nyx', seat: 2});
  const run = MODEL_VARIANTS.nyx.meshy.clips.run;
  for (const skills of [['q'], ['e'], ['q', 'e', 'q']]) {
    const plan = rig.chainPlan(skills);
    assert.ok(plan, `nyx ${skills.join('')} zinciri`);
    assert.equal(plan.contacts.length, skills.length);
    assert.equal(plan.steps[0].clip, run, 'ilk adım koşu klibi');
    const lead = COMBO.rangedLeadMs; // İş 1: menzilli koşu da görünür hızda (eskiden 340 ms)
    assert.equal(plan.travelMs, lead);
    assert.equal(plan.steps[1].at, lead, 'büyü klibi varışta başlar');
    assert.equal(plan.contacts[0].ms, lead + MODEL_VARIANTS.nyx.meshy.skills[skills[0]].peakMs);
  }
  const fast = rig.chainPlan(['q'], {compress: true});
  assert.ok(fast.contacts[0].ms < COMBO.rangedLeadMs + 900 && fast.steps[1].speed <= 1.2, 'sıkıştırma: hız ≤ 1,2');
  rig.dispose();
});

test('bot zinciri: nyx q birikse de tek yaklaşma; sahne tavanı (~3 sn) aşılmaz, fazla saldırı yeni sahneye/son vuruşa gider', async () => {
  const asset = () => fakeAsset({extra: [...meshyNames('nyx'), ...meshyNames('vargr')], variant: 'meshy'});
  const impacts = [];
  const {instance, run} = await buildArena({loadModel: async () => asset(), onImpact: (event, scene) => impacts.push({event, scene})});
  await instance.setFighters({1: 'vargr', 2: 'nyx'});
  for (let i = 0; i < 4; i++) cast(instance, 2, 'q');
  run(60);
  const snap = instance.visualQueue.snapshot();
  assert.equal(snap.activeSeat, 2);
  assert.equal(instance._debug.models()[2].clip, MODEL_VARIANTS.nyx.meshy.clips.run, 'bot koşarak yaklaşıyor');
  assert.ok(instance._debug.models()[2].chainTotalMs <= 3000, `zincir ${instance._debug.models()[2].chainTotalMs} ms`);
  run(9000);
  assert.equal(impacts.length, 4);
  assert.ok(impacts.every(i => i.scene));
  instance.destroy();
});

// ------------------------------------------------------------ (e)(f) KRİTİK + blok

test('KRİTİK: temas karesinde sahnede karakterlerin GERİSİNDE (derinlik testli düzlem) görünür, sonra kaybolur', async () => {
  const {instance, run} = await buildArena();
  await instance.setFighters({1: 'vargr', 2: 'doran'});
  cast(instance, 1, 'q', 60, {bonusTags: ['RÜN']});
  run(100);
  assert.equal(instance._debug.crit(), null, 'temas öncesi yok');
  run(700); // İş 1: yaklaşma ~620 ms (görünür koşu)
  const c = instance._debug.crit();
  assert.ok(c?.visible && c.opacity > 0.3, JSON.stringify(c));
  assert.ok(c.behind > 0, 'dövüşçülerin gerisinde');
  assert.equal(c.depthTest, true, 'modeller önünde kalır');
  run(1200);
  assert.equal(instance._debug.crit().visible, false);
  instance.destroy();
});

test('blok: kuyruk meşgulken erken kalkan yok; bloklanan hasarın TEMAS karesinde blok klibi oynar', async () => {
  const {instance, run} = await buildArena();
  await instance.setFighters({1: 'vargr', 2: 'doran'});
  instance.handle({type: 'SKILL_CAST', fromSeat: 1, toSeat: 2, skill: 'q'});
  instance.handle({type: 'SHIELD_TRIGGERED', seat: 2, kind: 'PERFECT_BLOCK'});
  instance.handle({type: 'DAMAGE_APPLIED', fromSeat: 1, toSeat: 2, skill: 'q', amount: 0, blocked: true, blockKind: 'PERFECT_BLOCK'});
  run(100);
  assert.notEqual(instance._debug.models()[2].state, 'blockHit', 'saldırı ulaşmadan blok yok');
  run(600); // İş 1: yaklaşma ~620 ms
  assert.match(instance._debug.models()[2].state, /^block/, 'temasta blok klibi');
  assert.ok(instance._debug.fighter(2).bubble, 'görünür kalkan efekti');
  instance.destroy();
});
