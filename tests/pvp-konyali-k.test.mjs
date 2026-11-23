// Görev K — beşinci dövüşçü Hacı Usta (konyali): klip tabloları, boy normalizasyonu, üç mod, HUD etiketi, bot havuzu, URL.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import * as THREE from '../pvp/vendor/three.module.min.js';
import {readGlb} from '../scripts/optimize-characters.mjs';
import {FIGHTERS, BASE_FIGHTER_IDS as FIGHTER_IDS, isFighterId, normalizeFighter} from '../pvp/shared/fighters.js';
import {MODEL_VARIANTS, MODEL_VIEW, CHOREOGRAPHY, SKILL_PROFILES, variantMissingClips, createFighterRig, isKnownFighter, createSkillFx} from '../pvp/fighters3d.js';
import {createMatch, publicMatch} from '../pvp/shared/match.js';
import {createArenaMatch, arenaPublicMatch} from '../pvp/shared/arena.js';
import {practiceFighters, createPracticeSession} from '../pvp/practice.js';
import {fighterFromUrl, fighterRosterHTML} from '../pvp/network.js';
import {fighterSkillLabels} from '../pvp/skillbar.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('K: beş karakterin hepsi için klip tablosu GLB ile eksiksiz', () => {
  assert.equal(FIGHTER_IDS.length, 5);
  for (const id of FIGHTER_IDS) {
    assert.ok(isKnownFighter(id), `${id} koreografi`);
    assert.ok(SKILL_PROFILES[id], `${id} parçacık profili`);
    const json = readGlb(readFileSync(resolve(ROOT, 'assets/models', id, `${id}.glb`))).json;
    assert.deepEqual(variantMissingClips(json.animations, MODEL_VARIANTS[id].meshy), [], `${id} eksik klip yok`);
    // KESINYAP 21: yakın vuruş klibi W alanında; E (can) klipsiz.
    if (id === 'konyali') for (const k of ['q', 'w', 'r']) assert.ok(json.animations.some(a => a.name === FIGHTERS[id].skills[k].clip), `${id}.${k} klibi GLB'de`);
  }
  const v = MODEL_VARIANTS.konyali.meshy;
  assert.deepEqual([v.skills.q.clip, v.skills.e.clip, v.skills.r.clip], ['Over_Shoulder_Throw', '360_Power_Spin_Jump', 'Ney_Ulti']);
  assert.equal(CHOREOGRAPHY.konyali.q.fx[0].kind, 'bread');
  assert.ok(CHOREOGRAPHY.konyali.r.fx.some(f => f.kind === 'shockring'));
});

test('K: kimlik, silah, yetenek adları ve arketip (denge ortalama bandında)', () => {
  const f = FIGHTERS.konyali;
  assert.equal(f.name, 'Hacı Usta');
  assert.equal(f.weapon, 'Etli ekmek & ney');
  // KESINYAP 21: dört yetenek (kullanıcı örneği: Q etli ekmek, W sema, E şerbet molası, R ney).
  assert.deepEqual(['q', 'w', 'e', 'r'].map(k => f.skills[k].name), ['Etli Ekmek Fırlatışı', 'Sema Dönüşü', 'Şerbet Molası', 'Ney Feryadı']);
  assert.equal(f.archetype, 'rune'); // hasar/can/bekleme arketipten gelir → mevcut dört karakterin sayıları değişmez
  assert.equal(normalizeFighter('konyali', 'rune'), 'konyali');
  assert.equal(normalizeFighter('konyali', 'fire'), 'vargr');
  assert.ok(isFighterId('konyali'));
});

test('K: boy normalize 2,68 (konyali iskeleti)', () => {
  assert.equal(MODEL_VIEW.heightUnits, 2.68);
  const scene = new THREE.Group(), arm = new THREE.Group(), hips = new THREE.Bone(), head = new THREE.Bone(), hand = new THREE.Bone();
  hips.name = 'Hips'; head.name = 'head_end'; head.position.set(0, 170, 0); hand.name = 'RightHand'; hand.position.set(30, 100, 0);
  scene.add(arm); arm.add(hips); hips.add(head); hips.add(hand);
  const material = new THREE.MeshStandardMaterial({map: new THREE.Texture()});
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(160, 170, 60).translate(0, 85, 0), material); arm.add(mesh);
  const names = ['Combat_Stance', 'Standard_Forward_Charge_inplace', 'Over_Shoulder_Throw', '360_Power_Spin_Jump', 'Ney_Ulti', 'Block1', 'Hit_Reaction', 'Knock_Down', 'Victory_Cheer'];
  const clips = names.map(n => new THREE.AnimationClip(n, 2, [new THREE.VectorKeyframeTrack('Hips.position', [0, 2], [0, 90, 0, 0, 90, 0])]));
  const rig = createFighterRig(THREE, {gltf: {scene, animations: clips}, clips, variant: 'meshy', sharedMaterial: material}, {fighterId: 'konyali', seat: 1, clone: o => o.clone(true)});
  assert.ok(Math.abs(rig.scale * rig.height - 2.68) < 0.02);
  rig.play('block');
  assert.equal(rig.stats().clip, 'Block1');
});

test('K: konyali seçilince üç modda (classic, rounds, arena) maça taşınır; HUD etiketi Hacı Usta', () => {
  const P = (seat, character, fighter) => ({playerId: `p${seat}`, seat, name: `O${seat}`, character, fighter});
  const classic = createMatch([P(1, 'fire', 'vargr'), P(2, 'rune', 'konyali')], 1000, 'k1');
  const rounds = createMatch([P(1, 'rune', 'konyali'), P(2, 'fire', 'sira')], 1000, 'k2', {rounds: 5, seed: 7});
  const arena = createArenaMatch([P(1, 'fire', 'vargr'), P(2, 'rune', 'konyali')], 1000, 'k3', {seed: 3});
  for (const [pub, seat] of [[publicMatch(classic, 1), 2], [publicMatch(rounds, 1), 1], [arenaPublicMatch(arena, 1), 2]]) {
    const p = pub.players.find(x => x.seat === seat);
    assert.equal(p.fighter, 'konyali');
    assert.equal(FIGHTERS[normalizeFighter(p.fighter, p.character)].name, 'Hacı Usta');
  }
  assert.equal(fighterSkillLabels('konyali').R.name, 'Ney Feryadı');
});

test('K: bot havuzu, URL parametresi, lobi kartı', () => {
  const human = practiceFighters({fighter: 'konyali'});
  assert.deepEqual([human.character, human.fighter, human.botCharacter], ['rune', 'konyali', 'fire']);
  assert.equal(practiceFighters({fighter: 'vargr', fighterRng: () => 0.7}).botFighter, 'konyali', 'bot havuzunda Hacı Usta var');
  const s = createPracticeSession({mode: 'classic', fighter: 'vargr', botFighter: 'konyali', rng: () => 0.5, createId: () => 'k'});
  assert.equal(s.botFighter, 'konyali');
  assert.equal(fighterFromUrl('http://x/index.html?karakter=konyali'), 'konyali');
  assert.equal(fighterFromUrl('http://x/index.html?fighter=KONYALI'), 'konyali');
  const html = fighterRosterHTML('konyali');
  assert.match(html, /data-fighter="konyali"/);
  assert.match(html, /data-fighter-portrait="konyali"/);
  assert.match(readFileSync(resolve(ROOT, 'pvp/lobby-v3.css'), 'utf8'), /portre-konyali\.webp/);
});

test('K: bread / shockring efektleri üretilir ve biter', () => {
  const scene = new THREE.Scene(), fx = createSkillFx(THREE, scene);
  let arrived = 0;
  fx.spawn({kind: 'bread', from: new THREE.Vector3(0, 1, 0), to: new THREE.Vector3(4, 1, 0), flight: 200, profile: 'konyali', onArrive: () => arrived++});
  fx.spawn({kind: 'shockring', to: new THREE.Vector3(0, 0, 0), ms: 300, profile: 'konyali', onArrive: () => arrived++});
  assert.deepEqual(fx.stats().kinds.sort(), ['bread', 'shockring']);
  for (let i = 0; i < 60; i++) fx.update(0.02);
  assert.equal(arrived, 2);
  assert.equal(fx.stats().live, 0);
  fx.dispose();
});
