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

test('vargr meshy: GLB var, ≤ 1,5 MB, 8 klip tam, EXT_texture_webp, üretim notu', () => {
  assert.ok(existsSync(GLB), 'assets/models/vargr/vargr.glb');
  const bytes = statSync(GLB).size;
  assert.ok(bytes <= 1_500_000, `${bytes} B ≤ 1,5 MB`);
  assert.ok(bytes < statSync(resolve(ROOT, 'assets/models/vargr/kaynak/vargr-meshy-ham.glb')).size, 'ham dosyadan küçük');
  const json = readJson();
  assert.deepEqual(json.animations.map(a => a.name), [
    'Combat_Stance', 'Attack', 'Axe_Spin_Attack', 'Charged_Axe_Chop',
    'Hit_Reaction', 'Knock_Down', 'Victory_Cheer', 'Two_Handed_Parry',
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

test('vargr meshy: bayrak — varsayılan meshy; ?vargr=eski ya da localStorage eski', () => {
  assert.equal(fighterModelVariant('vargr', {}), 'meshy', 'varsayılan yeni model');
  assert.equal(fighterModelUrl('vargr', {}), './assets/models/vargr/vargr.glb');
  assert.equal(fighterModelVariant('vargr', {location: {search: '?vargr=eski'}}), 'eski');
  assert.equal(fighterModelVariant('vargr', {location: {search: '?karakter=vargr&vargr=eski&scene=colosseum'}}), 'eski');
  assert.equal(fighterModelVariant('vargr', {location: {search: '?vargr=yeni'}}), 'meshy', 'yalnız eski geri döndürür');
  assert.equal(fighterModelVariant('vargr', {localStorage: {getItem: k => (k === 'tuslab:vargr-model' ? 'eski' : null)}}), 'eski');
  assert.equal(fighterModelVariant('vargr', {localStorage: {getItem: () => { throw new Error('erişim yok'); }}}), 'meshy', 'localStorage hatası yutulur');
  assert.equal(fighterModelUrl('vargr', {localStorage: {getItem: () => 'eski'}}), './assets/characters/vargr.glb');
  assert.equal(fighterModelUrl('vargr', {location: {search: '?vargr=eski'}}), './assets/characters/vargr.glb');
  // Diğer karakterler etkilenmez.
  for (const id of ['sira', 'doran', 'nyx']) {
    assert.equal(fighterModelVariant(id, {}), 'eski');
    assert.equal(fighterModelUrl(id, {}), modelUrl(id));
  }
  assert.equal(modelUrl('sira'), './assets/characters/sira.glb');
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
    const target = spec.contactMs || CHOREOGRAPHY.vargr[skill].hitMs;
    assert.ok(target > 0, `${skill} hizalama hedefi pozitif`);
    assert.ok(spec.peakMs - target >= 0, `${skill}: peak hedeften geç → içeriden başlatma`);
    if (spec.endMs) assert.ok(spec.endMs <= dur, `${skill}.endMs klip içinde`);
  }
  // Ölçülen zirveler ve ulti hizalaması (3. evre teması ≈ 1310 ms).
  assert.equal(MESHY.skills.q.peakMs, 1060);
  assert.equal(MESHY.skills.e.peakMs, 900);
  assert.equal(MESHY.skills.r.peakMs, 4375);
  assert.equal(MESHY.skills.r.contactMs, 1310);
});

// --------------------------------------------------------------- 5) yükleme + otomatik geri dönüş

test('vargr meshy: GLB yüklenemezse ya da klipler eksikse eski modele düşer (tek uyarı)', async () => {
  // loadFighterAsset yükleyiciden ham gltf ({scene, animations}) alır; sarmalama onun işi.
  const kaykitGltf = {scene: new THREE.Group(), animations: [{name: 'Idle'}]};
  const calls = [];
  const loader = {loadAsync: async url => {
    calls.push(url);
    if (url.includes('models/vargr')) throw new Error('404');
    return kaykitGltf;
  }};
  const warns = [];
  const origWarn = console.warn;
  console.warn = message => warns.push(String(message));
  try {
    const asset = await loadFighterModel(THREE, 'vargr', {env: {}, loader});
    assert.equal(asset.gltf, kaykitGltf, 'eski varlık döner');
    assert.equal(asset.variant, undefined, 'varyant etiketi yok');
    assert.deepEqual(calls, ['./assets/models/vargr/vargr.glb', './assets/characters/vargr.glb']);
    assert.equal(warns.length, 1, 'tek uyarı');
    assert.match(warns[0], /vargr.*meshy.*eski modele/i);
    // Aynı başarısızlık ikinci kez uyarı biriktirmez.
    calls.length = 0;
    await loadFighterModel(THREE, 'vargr', {env: {}, loader});
    assert.equal(warns.length, 1, 'uyarı yalnız bir kez');
    // Klipleri eksik GLB: yine eski modele düşer (uyarı süresiz tek).
    calls.length = 0;
    const eksikGltf = {scene: new THREE.Group(), animations: [{name: 'Idle'}]}; // meshy klipleri yok
    const loader2 = {loadAsync: async url => {
      calls.push(url);
      return url.includes('models/vargr') ? eksikGltf : kaykitGltf;
    }};
    const asset2 = await loadFighterModel(THREE, 'vargr', {env: {}, loader: loader2});
    assert.equal(asset2.gltf, kaykitGltf, 'eksik klipte eski varlık');
    assert.deepEqual(calls, ['./assets/models/vargr/vargr.glb', './assets/characters/vargr.glb']);
    assert.equal(warns.length, 1, 'uyarı hâlâ tek');
    // Eski bayrağı: yalnız eski URL istenir.
    calls.length = 0;
    await loadFighterModel(THREE, 'vargr', {env: {localStorage: {getItem: () => 'eski'}}, loader});
    assert.deepEqual(calls, ['./assets/characters/vargr.glb']);
    // Diğer karakterler: tek istek, yol değişmez.
    calls.length = 0;
    await loadFighterModel(THREE, 'sira', {env: {}, loader});
    assert.deepEqual(calls, ['./assets/characters/sira.glb']);
  } finally {
    console.warn = origWarn;
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
    Hit_Reaction: 1.633, Knock_Down: 2.5, Victory_Cheer: 9.333, Two_Handed_Parry: 1.333};
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
  // Ölçek kalibrasyonu (MODEL_VARIANTS notu): meshy headToHeight 1,19 — KayKit idle
  // görünür boyuyla (2,610 birim) eşitler; genel 1,95 katsayısı modeli %36 küçültürdü.
  // Boy = Head 1,447 × 1,19 = 1,722 → ölçek = 2,68 / 1,722 = 1,556.
  assert.ok(Math.abs(rig.height - 1.447 * 1.19) < 0.02, `height ${rig.height.toFixed(3)}`);
  assert.ok(Math.abs(rig.scale - 2.68 / (1.447 * 1.19)) < 0.02, `scale ${rig.scale.toFixed(3)}`);
  assert.ok(rig.scale > 1.5 && rig.scale < 1.6, 'meshy ölçeği kalibre aralıkta');
  // Zemin ofseti: model.position.y = groundOffsetY 0,058 × ölçek (idle ayağı y=0'a kalkar).
  assert.ok(Math.abs(rig.model.position.y - 0.058 * rig.scale) < 1e-6, `zemin ofseti ${rig.model.position.y.toFixed(4)}`);
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

test('vargr meshy: saldırı klipleri hitMs/ulti temas anına hizalı — q 650, e 520, r 1310 ms', () => {
  const rig = createFighterRig(THREE, meshyAsset(), {fighterId: 'vargr', seat: 1, clone: o => o.clone(true)});
  // Q: Attack peak 1060 → içeriden 410 ms başlar; 650 ms sonra klibin 1060 ms'sinde.
  rig.play('q');
  assert.equal(rig.stats().clip, 'Attack');
  assert.ok(Math.abs(rig.actions.Attack.time - 0.410) < 0.005, `q başlangıç ofseti ${rig.actions.Attack.time.toFixed(3)}`);
  rig.update(0.65);
  assert.ok(Math.abs(rig.actions.Attack.time - 1.060) < 0.01, `q vuruş karesi ${rig.actions.Attack.time.toFixed(3)}`);
  // E: Axe_Spin_Attack peak 900 → ofset 380; 520 ms sonra 900 ms'de.
  rig.play('e');
  assert.ok(Math.abs(rig.actions.Axe_Spin_Attack.time - 0.380) < 0.005);
  rig.update(0.52);
  assert.ok(Math.abs(rig.actions.Axe_Spin_Attack.time - 0.900) < 0.01);
  // R: Charged_Axe_Chop peak 4375 → ulti 3. evre temasına (1310 ms) hizalı ofset 3065.
  rig.play('r');
  assert.ok(Math.abs(rig.actions.Charged_Axe_Chop.time - 3.065) < 0.005);
  rig.update(1.31);
  assert.ok(Math.abs(rig.actions.Charged_Axe_Chop.time - 4.375) < 0.01, 'ana iniş son/büyük temasta');
  // R penceresi (endMs 5400): toparlanma sonrası idle'a döner, klip sonuna kadar beklemez.
  rig.update(1.0);
  assert.equal(rig.stats().state, 'r', 'pencere içinde saldırı sürer');
  rig.update(0.4); // klibin ~5,48 sn'i ≥ endMs 5,4
  assert.equal(rig.stats().state, 'idle', 'endMs sonrası idle');
  rig.dispose();
});

test('vargr meshy: varyant klipleri eksikse rig sessizce varsayılan tabloya döner', () => {
  const asset = meshyAsset();
  asset.clips = asset.clips.slice(0, 2); // yalnız Combat_Stance + Attack kalsın
  const rig = createFighterRig(THREE, asset, {fighterId: 'vargr', seat: 1, clone: o => o.clone(true)});
  assert.equal(rig.variant, null, 'varyant kullanılamaz');
  assert.equal(rig.stateClips, STATE_CLIPS, 'varsayılan durum klipleri');
  assert.equal(rig.stats().clip, 'Combat_Stance', 'idle ilk kliple çözülür');
  rig.dispose();
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
