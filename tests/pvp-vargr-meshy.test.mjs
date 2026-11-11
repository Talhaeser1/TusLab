// Paket 23 — Vargr (Meshy) modeli: sıkıştırılmış GLB, varyant bayrağı, klip eşlemesi,
// temas hizalaması (peakMs), otomatik eski-modele-dönüş ve yayın filtresi.
// Oyun mantığı (hitMs/motion/fx sabitleri, hasar/puan) DEĞİŞMEZ; yalnız görsel katman.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, statSync, existsSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import * as THREE from '../pvp/vendor/three.module.min.js';
import {readGlb} from '../scripts/optimize-characters.mjs';
import {EXCLUDED_ASSETS} from '../cloudflare/build-assets.mjs';
import {
  MODEL_VARIANTS, STATE_CLIPS, CHOREOGRAPHY, resolveChoreography, modelUrl,
  fighterModelVariant, fighterModelUrl, variantMissingClips, loadFighterModel, createFighterRig,
} from '../pvp/fighters3d.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GLB = resolve(ROOT, 'assets', 'models', 'vargr', 'vargr.glb');
const MESHY = MODEL_VARIANTS.vargr.meshy;
const readJson = () => readGlb(readFileSync(GLB)).json;

// --------------------------------------------------------------- 1) GLB içeriği

test('vargr meshy: GLB var, ≤ 1,2 MiB, 8 klip tam, EXT_texture_webp, üretim notu', () => {
  assert.ok(existsSync(GLB), 'assets/models/vargr/vargr.glb');
  const bytes = statSync(GLB).size;
  assert.ok(bytes <= 1_258_291, `${bytes} B ≤ 1,2 MiB (900 KB sınırı 8 klip + doku için gerekçeyle aşıldı)`);
  const HAM = resolve(ROOT, "assets/models/vargr/kaynak/vargr-meshy-ham.glb");
  if (existsSync(HAM)) assert.ok(bytes < statSync(HAM).size, "ham dosyadan küçük");
  const json = readJson();
  assert.deepEqual(json.animations.map(a => a.name), [
    'Combat_Stance', 'Attack', 'Axe_Spin_Attack', 'Charged_Axe_Chop',
    'Hit_Reaction', 'Knock_Down', 'Victory_Cheer', 'Two_Handed_Parry',
    'Run_Charge', 'Walk_Back', // Şerit H: yolculuk klipleri (scripts/merge-vargr-clips.py)
  ]);
  assert.equal(json.images.length, 1, 'tek doku');
  assert.equal(json.images[0].mimeType, 'image/webp');
  assert.ok(json.extensionsUsed?.includes('EXT_texture_webp'), 'extensionsUsed');
  assert.equal(json.textures[0].extensions?.EXT_texture_webp?.source, json.textures[0].source, 'uzantı kaynağı');
  assert.equal(typeof json.textures[0].source, 'number', 'source alanı korunur');
  assert.equal(json.buffers.length, 1);
  assert.ok(json.buffers[0].byteLength > 0 && json.buffers[0].byteLength % 1 === 0);
  assert.match(json.asset.generator, /Meshy AI/);
  assert.equal(json.asset.extras?.generatedFor, 'TuşLab');
  assert.ok(existsSync(resolve(ROOT, 'assets/models/vargr/LISANS.txt')), 'lisans notu yanında');
});

// --------------------------------------------------------------- 2) klip eşlemesi

test('vargr meshy: varyant tablosundaki tüm klipler GLBde var; eski sözleşmeye dokunulmadı', () => {
  const json = readJson();
  const names = json.animations.map(a => a.name);
  assert.deepEqual(variantMissingClips(json.animations, MESHY), [], 'eksik klip yok');
  for (const value of Object.values(MESHY.clips)) {
    for (const clip of Array.isArray(value) ? value : [value]) assert.ok(names.includes(clip), `durum klipleri: ${clip}`);
  }
  for (const skill of ['q', 'e', 'r']) assert.ok(names.includes(MESHY.skills[skill].clip), `beceri klipleri: ${MESHY.skills[skill].clip}`);
  // Eski model ve zamanlama sabitleri aynen duruyor (oyun mantığına dokunulmaz).
  assert.equal(STATE_CLIPS.ko, 'Death_A');
  assert.equal(STATE_CLIPS.hit[0], 'Hit_A');
  assert.equal(CHOREOGRAPHY.vargr.idle, '2H_Melee_Idle');
  assert.equal(CHOREOGRAPHY.vargr.q.hitMs, 650);
  assert.equal(CHOREOGRAPHY.vargr.e.hitMs, 520);
  assert.equal(CHOREOGRAPHY.vargr.r.hitMs, 700);
  assert.equal(resolveChoreography('vargr').q.steps[0].clip, '2H_Melee_Attack_Chop');
});

// --------------------------------------------------------------- 3) bayrak fonksiyonu

test('all fighters always select Meshy, even with obsolete flags', () => {
  for (const id of ['vargr', 'sira', 'doran', 'nyx']) {
    const env = {location: {search: '?vargr=eski'}, localStorage: {getItem: () => 'eski'}};
    assert.equal(fighterModelVariant(id, env), 'meshy');
    assert.equal(fighterModelUrl(id, env), modelUrl(id));
  }
});

// --------------------------------------------------------------- 4) temas hizalaması (peakMs)

test('vargr meshy: her saldırının peakMs > 0, klip süresinden küçük ve hizalanabilir', () => {
  const json = readJson();
  const duration = name => {
    const anim = json.animations.find(a => a.name === name);
    return Math.max(...anim.samplers.map(s => json.accessors[s.input].max[0])) * 1000;
  };
  for (const skill of ['q', 'e', 'r']) {
    const spec = MESHY.skills[skill];
    const dur = duration(spec.clip);
    assert.ok(spec.peakMs > 0, `${skill}.peakMs pozitif`);
    assert.ok(spec.peakMs < dur, `${skill}.peakMs ${spec.peakMs} < klip süresi ${dur}`);
    assert.ok(CHOREOGRAPHY.vargr[skill].hitMs > 0, `${skill} temel koreografi var`);
  }
  // Ölçülen zirveler ve ulti hizalaması (3. evre teması ≈ 1310 ms).
  assert.equal(MESHY.skills.q.peakMs, 1060);
  assert.equal(MESHY.skills.e.peakMs, 900);
  assert.equal(MESHY.skills.r.peakMs, 4375);
  assert.equal(MESHY.skills.r.contactMs, undefined,'eski kısa temas ofseti kullanılmaz');
});

// --------------------------------------------------------------- 5) yükleme + otomatik geri dönüş

test('Meshy load and missing-clip failures reject without requesting another GLB', async () => {
  for (const id of ['vargr', 'sira', 'doran', 'nyx']) {
    const calls = [];
    const bad = {loadAsync: async url => { calls.push(url); throw new Error('404'); }};
    await assert.rejects(loadFighterModel(THREE, id, {loader: bad}), /404/);
    assert.deepEqual(calls, [modelUrl(id)]);
    calls.length = 0;
    const incomplete = {loadAsync: async url => { calls.push(url); return {scene: new THREE.Group(), animations: [{name:'Combat_Stance'}]}; }};
    await assert.rejects(loadFighterModel(THREE, id, {loader: incomplete}), /eksik klipler/);
    assert.deepEqual(calls, [modelUrl(id)]);
  }
});

// --------------------------------------------------------------- 6) rig davranışı (sentetik meshy varlığı)

/** Meshy iskeletini andıran sentetik varlık: kök ölçek 0,01, Head/RightHand/LeftHand. */
function meshyAsset() {
  const scene = new THREE.Group();
  const armature = new THREE.Group(); armature.name = 'Armature'; armature.scale.setScalar(0.01);
  const hips = new THREE.Bone(); hips.name = 'Hips'; hips.position.y = 90.95;
  const spine = new THREE.Bone(); spine.name = 'Spine01'; spine.position.y = 20;
  const head = new THREE.Bone(); head.name = 'Head'; head.position.y = 33.75; // dünya y = 1,447
  const handR = new THREE.Bone(); handR.name = 'RightHand'; handR.position.set(30, 60, 0);
  const handL = new THREE.Bone(); handL.name = 'LeftHand'; handL.position.set(-30, 60, 0);
  scene.add(armature);
  armature.add(hips); hips.add(spine);
  spine.add(head); spine.add(handR); spine.add(handL);
  const material = new THREE.MeshStandardMaterial({map: new THREE.Texture()});
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(160, 170, 60).translate(0, 85, 0), material);
  mesh.name = 'char1';
  armature.add(mesh);
  const durations = {Combat_Stance: 1.667, Attack: 2.8, Axe_Spin_Attack: 2.5, Charged_Axe_Chop: 7.667,
    Hit_Reaction: 1.633, Knock_Down: 2.5, Victory_Cheer: 9.333, Two_Handed_Parry: 1.333, Run_Charge: 0.633, Walk_Back: 1.7};
  const clips = Object.entries(durations).map(([name, duration]) => new THREE.AnimationClip(name, duration, [
    new THREE.VectorKeyframeTrack('Hips.position', [0, duration], [0, 90.95, 0, 0, 90.95, 0]),
  ]));
  return {gltf: {scene, animations: clips}, clips, variant: 'meshy', sharedMaterial: material};
}

test('vargr meshy: rig varyant tablolarını, kemik adlarını ve ölçeğini kullanır', () => {
  const rig = createFighterRig(THREE, meshyAsset(), {fighterId: 'vargr', seat: 1, clone: o => o.clone(true)});
  assert.equal(rig.variant, 'meshy');
  assert.equal(rig.stats().variant, 'meshy');
  assert.equal(rig.stats().clip, 'Combat_Stance', 'idle = Combat_Stance (döngü)');
  assert.equal(rig.actions.Combat_Stance.loop, THREE.LoopRepeat);
  assert.equal(rig.actions.Combat_Stance.clampWhenFinished, false);
  assert.equal(rig.bones['handslot.r']?.name, 'RightHand', 'el kemik takma adı');
  assert.equal(rig.bones['handslot.l']?.name, 'LeftHand');
  assert.ok(rig.boneWorld('handslot.r') instanceof THREE.Vector3, 'projektil çıkış noktası çalışır');
  // Ölçek kuralı (3B): boy = gövde yüksekliği (head_end kemiği – en alçak ayak kemiği); hedef 2,68 birim,
  // dört Meshy modelinde aynı kural → silah/kalkan/asa boyu şişirmez (Doran artık büyük değil).
  assert.ok(rig.height > 1.2 && rig.height < 2.2, `height ${rig.height.toFixed(3)}`);
  assert.ok(Math.abs(rig.scale * rig.height - 2.68) < 0.02, `scale ${rig.scale.toFixed(3)} × height ${rig.height.toFixed(3)} = 2,68`);
  // Zemin: taban (bbox tabanı, en fazla bilek − 0,2) y=0'a taşınır → model zemine gömülmez/havada kalmaz.
  assert.ok(Number.isFinite(rig.model.position.y) && Math.abs(rig.model.position.y) <= 0.25 * rig.scale + 1e-6, `zemin ofseti ${rig.model.position.y.toFixed(4)}`);
  // Durum klipleri varyant tablosundan.
  rig.play('block');
  assert.equal(rig.stats().clip, 'Two_Handed_Parry');
  rig.play('hit');
  assert.equal(rig.stats().clip, 'Hit_Reaction');
  rig.play('hit', {heavy: true});
  assert.equal(rig.stats().clip, 'Hit_Reaction', 'tek klipli isabet listesi güvenli');
  rig.play('win');
  assert.equal(rig.actions.Victory_Cheer.loop, THREE.LoopRepeat, 'zafer döngüde');
  rig.play('ko');
  assert.equal(rig.actions.Knock_Down.clampWhenFinished, true, 'KO son karede kalır');
  rig.dispose();
});

test('vargr meshy: q/e yolculuk+temas; ulti baştan sona doğal hızda', () => {
  const rig = createFighterRig(THREE, meshyAsset(), {fighterId: 'vargr', seat: 1, clone: o => o.clone(true)});
  // Şerit H: Q/E önce koşu klibi (yolculuk 400 ms), sonra saldırı klibi BAŞTAN (offset yok);
  // temas = yolculuk + peakMs/hız. Kare kare ilerletip klip zamanını ölçeriz.
  const run = (name, ms) => { for (let t = 0; t < ms; t += 1000 / 60) rig.update(1 / 60); };
  rig.play('q');
  assert.equal(rig.stats().clip, 'Run_Charge', 'yolculukta koşu klibi');
  const qPlan = rig.plan('q');
  assert.equal(qPlan.travelMs, 400);
  assert.ok(Math.abs(qPlan.hitMs - (400 + 1060 / 1.1)) < 1, `q temas ${qPlan.hitMs}`);
  assert.ok(qPlan.speed <= 1.2 && qPlan.speed >= 1, 'saldırı klibi hızı 1–1,2');
  run('q', 400 + 50);
  assert.equal(rig.stats().clip, 'Attack');
  assert.ok(rig.actions.Attack.time < 0.12, `q klibi baştan başlar ${rig.actions.Attack.time.toFixed(3)}`);
  run('q', qPlan.hitMs - 450);
  assert.ok(Math.abs(rig.actions.Attack.time - 1.060) < 0.05, `q vuruş karesi ${rig.actions.Attack.time.toFixed(3)}`);
  run('q', qPlan.totalMs); // toparlanma + geri yürüyüş sonrası idle
  assert.equal(rig.stats().state, 'idle');
  rig.play('e');
  const ePlan = rig.plan('e');
  run('e', ePlan.travelMs + 50);
  assert.ok(rig.actions.Axe_Spin_Attack.time < 0.12, 'e klibi baştan');
  run('e', ePlan.hitMs - ePlan.travelMs - 50);
  assert.ok(Math.abs(rig.actions.Axe_Spin_Attack.time - 0.900) < 0.05);
  run('e', ePlan.totalMs);
  assert.equal(rig.stats().state, 'idle');
  // R (düzeltme turu 2 / B): sahne ≤ ~3 sn. Klip temastan 1,8 sn önce başlar (2,575 s), 4375 ms zirvesi
  // temas karesidir; temastan 1,2 sn sonra biter (boşta bekleme yok).
  rig.play('r');
  assert.ok(Math.abs(rig.actions.Charged_Axe_Chop.time - 2.575) < 0.01, 'hazırlık 1,8 sn ile sınırlı');
  rig.update(1.8);
  assert.ok(Math.abs(rig.actions.Charged_Axe_Chop.time - 4.375) < 0.01, 'ana iniş son/büyük temasta');
  rig.update(0.6);
  assert.equal(rig.stats().state, 'r', 'toparlanma sırasında saldırı sürer');
  rig.update(0.8);
  assert.equal(rig.stats().state, 'idle', 'temas + 1,2 sn sonra idle');
  rig.dispose();
});

test('incomplete Meshy rig rejects instead of using generic clips', () => {
  const asset = meshyAsset();
  asset.clips = asset.clips.slice(0, 2);
  assert.throws(() => createFighterRig(THREE, asset, {fighterId: 'vargr', seat: 1, clone: o => o.clone(true)}), /eksik Meshy klipleri/);
});

// --------------------------------------------------------------- 7) yayın filtresi

test('build-assets: models/<ad>/kaynak yayına girmez; mevcut hariç tutmalar bozulmaz', () => {
  const p = (...x) => x.join('\\');
  // Yeni hariç tutma: ham model kaynak klasörü.
  assert.ok(EXCLUDED_ASSETS.test(p('C:', 'x', 'assets', 'models', 'vargr', 'kaynak')));
  assert.ok(EXCLUDED_ASSETS.test(p('C:', 'x', 'assets', 'models', 'vargr', 'kaynak', 'vargr-meshy-ham.glb')));
  assert.ok(EXCLUDED_ASSETS.test(p('C:', 'x', 'assets', 'models', 'nyx', 'kaynak', 'nyx.glb')));
  // Optimize model ve diğer varlıklar yayına girer.
  assert.ok(!EXCLUDED_ASSETS.test(p('C:', 'x', 'assets', 'models', 'vargr', 'vargr.glb')));
  assert.ok(!EXCLUDED_ASSETS.test(p('C:', 'x', 'assets', 'models', 'vargr', 'LISANS.txt')));
  assert.ok(!EXCLUDED_ASSETS.test(p('C:', 'x', 'assets', 'characters', 'vargr.glb')));
  assert.ok(!EXCLUDED_ASSETS.test(p('C:', 'x', 'assets', 'rig', 'fire.png')));
  // Mevcut hariç tutmalar (karakter kaynakları, sahne denemeleri) aynen.
  assert.ok(EXCLUDED_ASSETS.test(p('C:', 'x', 'assets', 'characters-src')));
  assert.ok(EXCLUDED_ASSETS.test(p('C:', 'x', 'assets', 'characters-src', 'Barbarian.glb')));
  assert.ok(EXCLUDED_ASSETS.test(p('C:', 'x', 'assets', 'higgsfield', 'deneme')));
  assert.ok(EXCLUDED_ASSETS.test(p('C:', 'x', 'assets', 'higgsfield', 'deneme', 'a.png')));
  assert.ok(!EXCLUDED_ASSETS.test(p('C:', 'x', 'assets', 'higgsfield', 'sahne1.png')));
});
