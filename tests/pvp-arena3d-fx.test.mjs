// 3D savaş efektleri eklentisi (pvp/arena3d-fx.js) testleri.
// Gerçek vendored THREE ile WebGL'siz bir sahte (stub) çekirdek api'si kurulur.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../pvp/vendor/three.module.min.js';
import {createArena3DFx, FX3D_CAPS, TRAVEL_S} from '../pvp/arena3d-fx.js';

/** Çekirdek sözleşmesini taklit eden api; çağrıları kaydeder. */
function makeApi({quality = 'high', reduced = false} = {}) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 200);
  camera.position.set(0, 2.5, 9);
  camera.lookAt(0, 1.3, 0);
  camera.updateMatrixWorld();
  const calls = {shake: [], flash: [], dolly: []};
  const state = {quality, reduced, shift2: 0};
  // shift2 moves seat 2 like the core's ultimate travel (pull to centre / throw back).
  const api = {
    THREE, scene, camera, renderer: null,
    seatAnchor: (seat) => new THREE.Vector3((seat === 1 ? -2.5 : 2.5) + (seat === 2 ? state.shift2 : 0), 1.4, 0),
    seatGround: (seat) => new THREE.Vector3((seat === 1 ? -2.5 : 2.5) + (seat === 2 ? state.shift2 : 0), 0, 0),
    seatHome: (seat) => new THREE.Vector3(seat === 1 ? -2.5 : 2.5, 0, 0),
    facing: (seat) => (seat === 1 ? 1 : -1),
    onFrame: () => () => {},
    shake: (i, ms) => calls.shake.push([i, ms]),
    flash: (c, i, ms) => calls.flash.push([c, i, ms]),
    dolly: (s, ms) => calls.dolly.push([s, ms]),
    quality: () => state.quality,
    isReduced: () => state.reduced
  };
  return {api, scene, calls, state};
}

/** Oyunun ürettiği tüm olay tiplerinden örnekler (alanlar pvp/shared/match.js ile aynı). */
const ALL_EVENTS = [
  {type: 'SKILL_CAST', fromSeat: 1, toSeat: 2, skill: 'q', character: 'fire', amount: 105},
  {type: 'SKILL_CAST', fromSeat: 2, toSeat: 1, skill: 'e', character: 'rune', amount: 185},
  {type: 'SKILL_CAST', fromSeat: 1, toSeat: 2, skill: 'r', character: 'fire', amount: 305},
  {type: 'SKILL_CAST', fromSeat: 2, toSeat: 1, skill: 'r', character: 'rune', amount: 305},
  {type: 'ULTIMATE_PHASE', fromSeat: 1, toSeat: 2, skill: 'r', character: 'fire', phase: 1, totalPhases: 3, amount: 65},
  {type: 'ULTIMATE_PHASE', fromSeat: 1, toSeat: 2, skill: 'r', character: 'fire', phase: 2, totalPhases: 3, amount: 100},
  {type: 'ULTIMATE_PHASE', fromSeat: 1, toSeat: 2, skill: 'r', character: 'fire', phase: 3, totalPhases: 3, amount: 140},
  {type: 'ULTIMATE_PHASE', fromSeat: 2, toSeat: 1, skill: 'r', character: 'rune', phase: 3, totalPhases: 3, amount: 140},
  {type: 'DAMAGE_APPLIED', fromSeat: 1, toSeat: 2, skill: 'q', amount: 105, blocked: false, blockKind: null, counter: false},
  {type: 'DAMAGE_APPLIED', fromSeat: 2, toSeat: 1, skill: 'e', amount: 111, blocked: true, blockKind: 'BLOCK', counter: false},
  {type: 'DAMAGE_APPLIED', fromSeat: 2, toSeat: 1, skill: 'counter', amount: 65, blocked: false, counter: true},
  {type: 'SHIELD_TRIGGERED', seat: 2, againstSeat: 1, skill: 's', kind: 'BLOCK'},
  {type: 'SHIELD_TRIGGERED', seat: 1, againstSeat: 2, skill: 's', kind: 'PERFECT_BLOCK'},
  {type: 'PARRY_TRIGGERED', seat: 2, againstSeat: 1, skill: 'q'},
  {type: 'COUNTERATTACK_CAST', fromSeat: 2, toSeat: 1, skill: 'counter', character: 'rune', amount: 65, counter: true},
  {type: 'SHIELD_BROKEN', seat: 1, bySeat: 2, skill: 'e'},
  {type: 'KNOCKOUT', seat: 2},
  // Client-only event the core emits when a thrown defender hits the floor.
  {type: 'ARENA_SLAM', seat: 2, fromSeat: 1, character: 'fire', x: 2.5, y: 0, z: 0, power: 1, knockout: false},
  {type: 'MATCH_PAUSED'},
  {type: 'SKILL_CAST', fromSeat: 9, toSeat: 2, skill: 'q'}, // geçersiz koltuk: sessizce yok sayılır
  null
];

const step = (fx, seconds, dt = 1 / 60) => { for (let t = 0; t < seconds; t += dt) fx.update(dt, t); };

test('her olay tipi hatasız işlenir ve görsel üretir', () => {
  const {api, calls} = makeApi();
  const fx = createArena3DFx(api);
  for (const ev of ALL_EVENTS) assert.doesNotThrow(() => fx.handle(ev), `olay: ${ev?.type}`);
  const s = fx.stats();
  assert.ok(s.particles > 0, 'parçacık doğmalı');
  assert.ok(s.projectiles > 0, 'mermi uçmalı');
  assert.ok(s.rings > 0, 'halka olmalı');
  assert.ok(s.shards > 0, 'cam parçası olmalı');
  assert.ok(s.lights > 0 && s.lights <= 3, 'ışık flaşı en fazla 3');
  assert.ok(calls.shake.some(([i]) => i === 1), 'faz 3 shake(1) çağırmalı');
  assert.ok(calls.flash.length >= 2, 'parry / faz 3 flash çağırmalı');
  for (const [i] of calls.shake) assert.ok(i >= 0 && i <= 1);
  assert.doesNotThrow(() => step(fx, 4));
});

test('mermi uçar, update adımlarıyla hedefe varıp çözülür', () => {
  const {api} = makeApi();
  const fx = createArena3DFx(api);
  fx.handle({type: 'SKILL_CAST', fromSeat: 1, toSeat: 2, skill: 'e', character: 'fire', amount: 175});
  assert.equal(fx.stats().projectiles, 1);
  const proj = fx.root.children.find((o) => o.name === 'arena3d-fx-projectile-fire' && o.visible);
  assert.ok(proj, 'görünür alev mermisi');
  const startX = proj.position.x;
  fx.update(TRAVEL_S.e / 2, 0);
  assert.ok(proj.position.x > startX, 'mermi savunana doğru ilerlemeli');
  assert.ok(proj.position.y > 1.4, 'yay çizmeli');
  assert.ok(fx.stats().particles > 0, 'iz parçacıkları');
  step(fx, TRAVEL_S.e);
  const s = fx.stats();
  assert.equal(s.projectiles, 0);
  assert.equal(s.totals.projectilesResolved, 1);
  assert.equal(proj.visible, false);
});

test('resolve vuruşu: savunma işareti ve darbe uçuş ritminde sırayla çıkar', () => {
  const {api} = makeApi();
  const fx = createArena3DFx(api);
  fx.handle({type: 'SKILL_CAST', fromSeat: 1, toSeat: 2, skill: 'q', resolve: true, defenderAction: 'brace'});
  fx.handle({type: 'DAMAGE_APPLIED', fromSeat: 1, toSeat: 2, skill: 'q', amount: 90, resolve: true});
  assert.equal(fx.stats().projectiles, 1);
  assert.equal(fx.stats().rings, 1, 'ilk anda yalnız saldırı kesiği');
  step(fx, 0.17);
  assert.ok(fx.stats().rings >= 2, 'savunan siper işareti');
  const before = fx.stats().totals.spawned;
  step(fx, 0.1);
  assert.ok(fx.stats().totals.spawned > before, 'darbe uçuşun sonunda');
  fx.dispose();
});

test('ultimate R: SKILL_CAST mermi atmaz, saldırganda enerji toplar', () => {
  const {api} = makeApi();
  const fx = createArena3DFx(api);
  fx.handle({type: 'SKILL_CAST', fromSeat: 1, toSeat: 2, skill: 'r', character: 'fire', amount: 305});
  assert.equal(fx.stats().projectiles, 0, 'R çekme/fırlatma koreografisi kullanır, mermi yok');
  assert.equal(fx.stats().emitters, 1, 'enerji sarmalı');
  assert.ok(fx.stats().rings > 0);
});

test('ultimate faz 1 enerji zinciri savunanı yakalar ve onu izler; faz 3 bırakır', () => {
  const {api, state} = makeApi();
  const fx = createArena3DFx(api);
  fx.handle({type: 'ULTIMATE_PHASE', fromSeat: 1, toSeat: 2, character: 'fire', phase: 1, amount: 65});
  assert.equal(fx.stats().tethers, 1, 'zincir aktif');
  const beam = fx.root.children.find((o) => o.name === 'arena3d-fx-tether');
  assert.ok(beam, 'zincir ışını nesnesi');
  step(fx, 0.12); // beam fully reached the defender
  assert.equal(beam.visible, true);
  const before = beam.position.x;
  state.shift2 = -2.2; // core: defender pulled to the VS centre
  step(fx, 0.05);
  assert.ok(beam.position.x < before - 0.5, 'zincir savunanı takip eder');
  assert.ok(fx.stats().particles > 0, 'zincir halkası kıvılcımları');
  fx.handle({type: 'ULTIMATE_PHASE', fromSeat: 1, toSeat: 2, character: 'fire', phase: 2, amount: 100});
  assert.equal(fx.stats().tethers, 1, 'faz 2 boyunca zincir sürer');
  fx.handle({type: 'ULTIMATE_PHASE', fromSeat: 1, toSeat: 2, character: 'fire', phase: 3, amount: 140});
  assert.ok(fx.stats().emitters > 0, 'uçuş izi yayıcısı');
  step(fx, 0.3);
  assert.equal(fx.stats().tethers, 0, 'fırlatmada zincir kopar');
  assert.equal(beam.visible, false);
});

test('engellenen ultimate zinciri kalkanda kırılır, savunanı çekmez', () => {
  const {api} = makeApi();
  const fx = createArena3DFx(api);
  fx.handle({type: 'ULTIMATE_PHASE', fromSeat: 1, toSeat: 2, character: 'fire', phase: 1, amount: 0, blocked: true});
  step(fx, 0.4);
  assert.equal(fx.stats().tethers, 0);
});

test('ARENA_SLAM: oturduğu yerde krater halkası, toz, köz ve büyük sarsıntı', () => {
  const {api, calls} = makeApi();
  const fx = createArena3DFx(api);
  const before = fx.stats().totals.spawned;
  fx.handle({type: 'ARENA_SLAM', seat: 1, fromSeat: 2, character: 'rune', x: -2.5, y: 0, z: 0, power: 1, knockout: false});
  const s = fx.stats();
  assert.ok(s.totals.spawned - before > 100, 'patlama çok parçacık doğurmalı');
  assert.ok(s.rings >= 2, 'krater + şok halkası');
  assert.equal(s.pillars, 1, 'rün ışını sütunu');
  assert.ok(calls.shake.some(([i]) => i === 1), 'zemine çakılma shake(1)');
  const ring = fx.root.children.find((o) => o.name === 'arena3d-fx-ring' && o.visible);
  assert.ok(Math.abs(ring.position.x + 2.5) < 1e-6, 'savunanın kendi yerinde');
  step(fx, 4);
  assert.equal(fx.stats().particles, 0);
});

test('parçacık havuzu sınırı spam altında aşılmaz; mermi/halka/ışık sınırları korunur', () => {
  const {api} = makeApi();
  const fx = createArena3DFx(api);
  for (let k = 0; k < 200; k++) {
    for (const ev of ALL_EVENTS) fx.handle(ev);
    fx.update(1 / 60, k / 60);
    const s = fx.stats();
    assert.ok(s.particles <= FX3D_CAPS.high.particles);
    assert.ok(s.projectiles <= FX3D_CAPS.high.projectiles);
    assert.ok(s.rings <= FX3D_CAPS.high.rings);
    assert.ok(s.shards <= FX3D_CAPS.high.shards);
    assert.ok(s.lights <= FX3D_CAPS.high.lights);
    assert.ok(s.pillars <= FX3D_CAPS.high.pillars);
    assert.ok(s.emitters <= FX3D_CAPS.high.emitters);
    assert.ok(s.tethers <= 1);
  }
  assert.ok(fx.stats().particles >= FX3D_CAPS.high.particles * 0.9, 'spam havuzu (neredeyse) doldurmalı');
  assert.ok(fx.stats().totals.dropped > 0, 'fazlası reddedilmeli');
  // Havuz nesneleri sınırsız büyümemeli.
  const lights = fx.root.children.filter((o) => o.isPointLight).length;
  assert.equal(lights, 3);
  step(fx, 6);
  assert.equal(fx.stats().particles, 0, 'zamanla hepsi söner');
});

test('low kalite bütçeyi yarıya indirir', () => {
  const burstOf = (quality) => {
    const {api} = makeApi({quality});
    const fx = createArena3DFx(api);
    fx.handle({type: 'DAMAGE_APPLIED', fromSeat: 1, toSeat: 2, skill: 'e', amount: 175, blocked: false});
    return fx;
  };
  const hi = burstOf('high'), lo = burstOf('low');
  const nh = hi.stats().particles, nl = lo.stats().particles;
  assert.ok(nl > 0 && nl <= Math.ceil(nh / 2) + 2, `low=${nl} high=${nh}`);
  assert.equal(lo.stats().caps.particles, FX3D_CAPS.low.particles);
  assert.ok(FX3D_CAPS.low.particles <= FX3D_CAPS.high.particles / 2);
  // Spam altında low sınırı korunur.
  const {api} = makeApi({quality: 'low'});
  const fx = createArena3DFx(api);
  for (let k = 0; k < 100; k++) { for (const ev of ALL_EVENTS) fx.handle(ev); fx.update(1 / 60, 0); }
  const s = fx.stats();
  assert.ok(s.particles <= FX3D_CAPS.low.particles);
  assert.ok(s.projectiles <= FX3D_CAPS.low.projectiles);
  assert.ok(s.shards <= FX3D_CAPS.low.shards);
  assert.ok(s.lights <= FX3D_CAPS.low.lights);
});

test('isReduced açıkken hiçbir şey doğmaz, yalnızca minik flaş', () => {
  const {api, calls} = makeApi({reduced: true});
  const fx = createArena3DFx(api);
  const childCount = fx.root.children.length;
  for (const ev of ALL_EVENTS) fx.handle(ev);
  step(fx, 1);
  const s = fx.stats();
  assert.equal(s.particles, 0);
  assert.equal(s.projectiles, 0);
  assert.equal(s.rings, 0);
  assert.equal(s.shards, 0);
  assert.equal(s.lights, 0);
  assert.equal(s.totals.spawned, 0);
  assert.equal(calls.shake.length, 0);
  assert.ok(calls.flash.length > 0);
  for (const [, i, ms] of calls.flash) assert.ok(i <= 0.2 && ms <= 150, 'flaş minik ve kısa olmalı');
  assert.equal(fx.root.children.length, childCount, 'yeni nesne oluşturulmamalı');
});

test('clear() tüm canlı efektleri boşaltır', () => {
  const {api} = makeApi();
  const fx = createArena3DFx(api);
  for (const ev of ALL_EVENTS) fx.handle(ev);
  fx.update(1 / 60, 0);
  fx.clear();
  const s = fx.stats();
  for (const key of ['particles', 'projectiles', 'rings', 'shards', 'lights', 'emitters', 'pillars', 'tethers']) assert.equal(s[key], 0, key);
  for (const o of fx.root.children) {
    if (o.isPoints) assert.equal(o.geometry.drawRange.count, 0);
    else if (o.isInstancedMesh) assert.equal(o.count, 0);
    else if (o.isPointLight) assert.equal(o.intensity, 0);
    else assert.equal(o.visible, false, o.name);
  }
  fx.update(1 / 60, 0); // clear sonrası güncelleme güvenli
  assert.equal(fx.stats().particles, 0);
});

test('dispose() sahneden kaldırır ve tüm geometri/malzemeleri dispose eder', () => {
  const {api, scene} = makeApi();
  const before = scene.children.length;
  const fx = createArena3DFx(api);
  assert.equal(scene.children.length, before + 1);
  for (const ev of ALL_EVENTS) fx.handle(ev); // havuzları doldur (tembel oluşturulanlar dahil)
  step(fx, 0.2);
  const geometries = new Set(), materials = new Set();
  fx.root.traverse((o) => {
    if (o.geometry) geometries.add(o.geometry);
    if (o.material) [].concat(o.material).forEach((m) => materials.add(m));
  });
  assert.ok(geometries.size >= 5 && materials.size >= 5);
  const disposed = new Set();
  for (const r of [...geometries, ...materials]) r.addEventListener('dispose', () => disposed.add(r));
  fx.dispose();
  assert.equal(scene.children.length, before, 'kök grup sahneden çıkmalı');
  let leftovers = 0;
  scene.traverse((o) => { if (o.name?.startsWith('arena3d-fx')) leftovers++; });
  assert.equal(leftovers, 0);
  for (const r of [...geometries, ...materials]) assert.ok(disposed.has(r), `dispose edilmedi: ${r.type}`);
  assert.equal(fx.stats().disposed, true);
  // Dispose sonrası çağrılar no-op.
  assert.doesNotThrow(() => { fx.handle(ALL_EVENTS[0]); fx.update(1 / 60, 0); fx.clear(); fx.dispose(); });
  assert.equal(scene.children.length, before);
});

test('update milisaniye dt ve büyük sıçramalara dayanıklı', () => {
  const {api} = makeApi();
  const fx = createArena3DFx(api);
  fx.handle({type: 'SKILL_CAST', fromSeat: 2, toSeat: 1, skill: 'q', character: 'rune'});
  fx.update(16.7, 0); // ms gelirse saniyeye çevrilir
  assert.equal(fx.stats().projectiles, 1);
  fx.update(NaN, 0); fx.update(-1, 0);
  for (let k = 0; k < 20; k++) fx.update(50, 0); // 50ms kareler (adım 0.05 sn ile sınırlı)
  assert.equal(fx.stats().projectiles, 0);
});
