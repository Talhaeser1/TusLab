// İş 15 — karaktere özgü ("imza") yetenek efektleri: arena3d-fx.signature.
// Havuz (dövüşte yeni geometri/malzeme/ışık yok), aşamalar, varış geri çağrısı, R kenar darbesi, azaltılmış hareket.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../pvp/vendor/three.module.min.js';
import {createArena3DFx, SIG_FIGHTERS, SIG_POOLS, FX3D_CAPS} from '../pvp/arena3d-fx.js';
import {FIGHTERS} from '../pvp/shared/fighters.js';
import {CHOREOGRAPHY} from '../pvp/fighters3d.js';

function makeApi({fighters = ['konyali', 'nyx'], quality = 'high', reduced = false} = {}) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 200);
  camera.position.set(0, 2.5, 9);
  scene.add(camera);
  const state = {quality, reduced};
  const rig = seat => ({boneWorld: (name, out = new THREE.Vector3()) => out.set(seat === 1 ? -2.2 : 2.2, name === 'head' ? 1.9 : name === 'chest' ? 1.4 : 1.2, 0)});
  const api = {
    THREE, scene, camera, renderer: null,
    seatAnchor: seat => new THREE.Vector3(seat === 1 ? -2.5 : 2.5, 1.4, 0),
    seatGround: seat => new THREE.Vector3(seat === 1 ? -2.5 : 2.5, 0, 0),
    facing: seat => (seat === 1 ? 1 : -1),
    shake() {}, flash() {}, dolly() {},
    quality: () => state.quality, isReduced: () => state.reduced,
    fighterModel: seat => ({fighterId: fighters[seat - 1], rig: rig(seat)}),
  };
  return {api, scene, camera, state};
}
const step = (fx, s, dt = 1 / 60) => { for (let t = 0; t < s; t += dt) fx.update(dt, t); };
/** three.js geometri/malzeme kimlikleri küresel sayaçtan artar: araya tahsis girmezse fark tam 1. */
function gpuObjects(scene) {
  let lights = 0, objects = 0;
  scene.traverse(o => { objects++; if (o.isLight) lights++; });
  const g = new THREE.BufferGeometry(), m = new THREE.MeshBasicMaterial();
  const ids = {g: g.id, m: m.id};
  g.dispose(); m.dispose();
  return {ids, lights, objects};
}

test('İş 15: beş karakter (fighters.js) imza yapılandırmasında; fx türleri koreografiyle eşleşiyor', () => {
  assert.deepEqual([...SIG_FIGHTERS].sort(), Object.keys(FIGHTERS).sort());
  for (const id of SIG_FIGHTERS) for (const s of ['q', 'e', 'r']) assert.ok(FIGHTERS[id].skills[s].name, `${id}.${s} adı`);
  assert.ok(CHOREOGRAPHY.konyali.q.fx.some(f => f.kind === 'bread'));
  assert.ok(CHOREOGRAPHY.konyali.r.fx.some(f => f.kind === 'shockring'));
});

test('İş 15: her karakter × Q/E/R için telegraf + temas efekt üretir; dövüşte yeni GPU nesnesi/ışık yok', () => {
  for (const pair of [['vargr', 'sira'], ['doran', 'nyx'], ['konyali', 'vargr']]) {
    const {api, scene} = makeApi({fighters: pair});
    const fx = createArena3DFx(api);
    step(fx, 0.1);
    const before = gpuObjects(scene);
    for (const seat of [1, 2]) {
      for (const skill of ['q', 'e', 'r']) {
        const s0 = fx.stats().totals.spawned;
        assert.equal(fx.signature({stage: 'cast', seat, def: 3 - seat, skill, hitMs: 600, contacts: [600]}), true);
        for (const item of CHOREOGRAPHY[pair[seat - 1]][skill].fx) {
          if (item.kind === 'slam') fx.signature({stage: 'slam', seat, def: 3 - seat, skill});
          else fx.signature({stage: 'launch', seat, def: 3 - seat, skill, kind: item.kind, flight: item.flight, ms: item.ms, onArrive: () => {}});
        }
        step(fx, 0.2);
        for (const phase of skill === 'r' ? [1, 2, 3] : [0]) {
          assert.equal(fx.signature({stage: 'contact', event: {type: 'DAMAGE_APPLIED', fromSeat: seat, toSeat: 3 - seat, skill, phase, amount: 120, impactContact: true}}), true);
        }
        step(fx, 0.3);
        assert.ok(fx.stats().totals.spawned - s0 > 40, `${pair[seat - 1]}.${skill} parçacık`);
      }
    }
    step(fx, 2);
    const after = gpuObjects(scene);
    assert.equal(after.ids.g, before.ids.g + 1, 'dövüşte yeni geometri yok');
    assert.equal(after.ids.m, before.ids.m + 1, 'dövüşte yeni malzeme yok');
    assert.equal(after.objects, before.objects, 'sahne nesne sayısı sabit');
    assert.equal(after.lights, FX3D_CAPS.high.lights);
    const sig = fx.stats().signature;
    assert.ok(sig.log.length > 0 && sig.log.every(r => typeof r.ms === 'number' && r.particles >= 0));
    fx.dispose();
  }
});

test('İş 15: Hacı Usta Q — etli ekmek mermisi dönerek uçar, varışta geri çağrı (temas) tam bir kez, un/kırıntı', () => {
  const {api} = makeApi({fighters: ['konyali', 'nyx']});
  const fx = createArena3DFx(api);
  let arrived = 0;
  fx.signature({stage: 'launch', seat: 1, def: 2, skill: 'q', kind: 'bread', flight: 280, from: new THREE.Vector3(-2.2, 1.6, 0), onArrive: () => arrived++});
  step(fx, 0.1);
  assert.equal(fx.stats().signature.projectiles, 1);
  const bread = fx.root.children.find(o => o.name === 'arena3d-fx-sig-projectile' && o.visible);
  const r0 = bread.children[0].rotation.y;
  step(fx, 0.05);
  assert.notEqual(bread.children[0].rotation.y, r0, 'ekmek dönüyor');
  assert.equal(arrived, 0);
  step(fx, 0.25);
  assert.equal(arrived, 1, 'varış = temas');
  assert.ok(fx.stats().signature.chunks > 0, 'ekmek parçaları');
  step(fx, 1);
  assert.equal(arrived, 1);
  fx.dispose();
});

test('İş 15: Hacı Usta R — ney ses dalgası halkaları + notalar; her ulti darbesinde kenar darbesi ve şok halkası', () => {
  const {api} = makeApi({fighters: ['konyali', 'doran']});
  const fx = createArena3DFx(api);
  fx.signature({stage: 'launch', seat: 1, def: 2, skill: 'r', kind: 'shockring', ms: 900, onArrive: () => {}});
  step(fx, 0.3);
  const s = fx.stats().signature;
  assert.equal(s.waves, 0, 'büyük dalga halkaları kapalı (13 Kas: kullanıcı sarı dalgaları istemedi)');
  assert.ok(s.glyphs >= 3, 'nota parçacıkları');
  for (const phase of [1, 2, 3]) {
    const before = fx.stats().signature.edgePulses;
    fx.handle({type: 'DAMAGE_APPLIED', fromSeat: 1, toSeat: 2, skill: 'r', phase, amount: 150, impactContact: true});
    assert.equal(fx.stats().signature.edgePulses, before + 1, `faz ${phase} kenar darbesi`);
    step(fx, 0.05);
  }
  fx.dispose(); // zemin çatlağı/krater kapalı: son darbede zemin izi beklenmez
});

test('İş 15: azaltılmış harekette imza yok (çekirdek sade yolu kullanır); düşük kalitede glif sınırı yarıda', () => {
  const r = makeApi({reduced: true});
  const fxr = createArena3DFx(r.api);
  assert.equal(fxr.signature({stage: 'cast', seat: 1, def: 2, skill: 'r'}), false);
  assert.equal(fxr.signature({stage: 'launch', seat: 1, def: 2, skill: 'q', kind: 'bread', onArrive: () => {}}), false);
  fxr.dispose();
  const l = makeApi({quality: 'low', fighters: ['konyali', 'nyx']});
  const fxl = createArena3DFx(l.api);
  for (let i = 0; i < 30; i++) fxl.signature({stage: 'launch', seat: 1, def: 2, skill: 'r', kind: 'shockring', ms: 900, onArrive: () => {}});
  step(fxl, 0.4);
  assert.ok(fxl.stats().signature.glyphs <= SIG_POOLS.glyphs / 2);
  assert.ok(fxl.stats().particles <= FX3D_CAPS.low.particles);
  fxl.dispose();
});

test('İş 15: model yokken DAMAGE eski arketip efektine düşer; clear() imzaları söndürür; dispose artık bırakmaz', () => {
  const {api, scene} = makeApi();
  delete api.fighterModel;
  const fx = createArena3DFx(api);
  fx.handle({type: 'DAMAGE_APPLIED', fromSeat: 1, toSeat: 2, skill: 'q', amount: 100, impactContact: true});
  assert.ok(fx.stats().rings > 0);
  assert.equal(fx.stats().totals.signature ?? 0, 0);
  fx.dispose();
  let left = 0;
  scene.traverse(o => { if (o.name?.startsWith('arena3d-fx')) left++; });
  assert.equal(left, 0);
});
