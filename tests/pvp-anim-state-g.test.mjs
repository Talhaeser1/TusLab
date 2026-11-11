// Şerit G: animasyon durum makinesi, crossfade tablosu, vuruş durması, reduced-motion.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../pvp/vendor/three.module.min.js';
import {createAnimState, fadeMs, hitstopFor, FADE_MS, HITSTOP_MS} from '../pvp/anim-state.js';
import {CHOREOGRAPHY, resolveChoreography, createFighterRig} from '../pvp/fighters3d.js';
import {IMPACT_TIERS, impactTier, createImpactState, triggerImpact, stepImpact} from '../pvp/impact-feel.js';

const req = (m, n, o) => { const d = m.request(n, o); return {accept: d.accept, action: d.action, fade: d.fade}; };

test('oncelik: hit saldiriyi keser, block saldiriyi/idle degil hit i kesemez', () => {
  const m = createAnimState();
  assert.equal(req(m, 'q', {contactMs: 650}).action, 'play');
  assert.equal(req(m, 'hit').action, 'play');
  assert.equal(m.state.kind, 'hit');
  assert.equal(req(m, 'block').action, 'drop', 'block hit i kesmez');
  assert.equal(req(m, 'q', {contactMs: 650}).action, 'drop', 'saldiri hit i kesmez');
  m.finish();
  assert.equal(m.state.name, 'idle');
  req(m, 'block');
  assert.equal(req(m, 'q', {contactMs: 650}).action, 'drop', 'saldiri block u kesmez');
  assert.equal(req(m, 'hit').action, 'play', 'hit block u keser');
});

test('knockdown her seyi keser, victory/defeat sonrasi klip kilitli', () => {
  const m = createAnimState();
  req(m, 'r', {contactMs: 1300});
  assert.equal(req(m, 'ko').action, 'play');
  for (const n of ['q', 'e', 'r', 'hit', 'block', 'blockHit', 'win']) assert.equal(req(m, n).action, 'drop', n);
  assert.equal(m.finish(), null);
  assert.equal(m.state.name, 'ko');
  assert.equal(req(m, 'idle', {force: true}).action, 'play', 'force reset kilidi acar');
  const v = createAnimState();
  req(v, 'win');
  for (const n of ['q', 'hit', 'block']) assert.equal(req(v, n).action, 'drop', n);
  assert.equal(req(v, 'ko').action, 'play', 'knockdown zaferi de keser');
});

test('saldiri sirasinda yeni saldiri: temas oncesi kuyruk (max 1), sonrasi <=0.08 s kesme', () => {
  const m = createAnimState();
  req(m, 'q', {contactMs: 650});
  m.tick(300);
  assert.equal(req(m, 'e', {contactMs: 520}).action, 'queue');
  assert.equal(req(m, 'r', {contactMs: 1300}).action, 'queue');
  assert.equal(m.state.queued, 'r', 'tek kuyruk: yenisi eskinin yerini alir');
  assert.equal(m.state.name, 'q');
  assert.equal(m.finish(), 'r', 'bitince kuyruk oynar');
  assert.equal(m.state.name, 'r');
  assert.equal(m.state.queued, null);
  const c = createAnimState();
  req(c, 'q', {contactMs: 650});
  c.tick(700);
  const d = req(c, 'e', {contactMs: 520});
  assert.equal(d.action, 'play');
  assert.ok(d.fade <= 80, `kesme crossfade ${d.fade}`);
});

test('crossfade tablosu', () => {
  assert.equal(fadeMs('idle', 'q'), 100);
  assert.equal(fadeMs('q', 'idle'), 180);
  assert.equal(fadeMs('q', 'hit'), 50);
  assert.equal(fadeMs('idle', 'hit'), 50);
  assert.equal(fadeMs('hit', 'ko'), 40);
  assert.equal(fadeMs('idle', 'win'), 250);
  assert.ok(FADE_MS.attackCut <= 80);
});

test('hitstop sureleri: hafif 50, agir 90, ulti 120; reduced 0', () => {
  assert.deepEqual([HITSTOP_MS.light, HITSTOP_MS.heavy, HITSTOP_MS.ulti], [50, 90, 120]);
  assert.equal(hitstopFor('small'), 50);
  assert.equal(hitstopFor('medium'), 90);
  assert.equal(hitstopFor('large'), 120);
  assert.equal(hitstopFor('large', true), 0);
  assert.equal(IMPACT_TIERS.small.hitstopMs, 50);
  assert.equal(IMPACT_TIERS.large.hitstopMs, 120);
  assert.equal(impactTier({skill: 'r'}), 'large');
});

test('reduced-motion: sarsinti, punch ve hitstop yok', () => {
  const s = createImpactState();
  const spec = triggerImpact(s, {skill: 'r', amount: 180, fromSeat: 1}, 0, true);
  assert.equal(spec.hitstopMs, 0);
  const f = stepImpact(s, 0.016, 16, true);
  assert.deepEqual([f.shakeX, f.shakeY, f.punch, f.zoom, f.timeScale], [0, 0, 0, 0, 1]);
});

// ---- rig entegrasyonu (gercek THREE, sentetik varlik)
function asset() {
  const scene = new THREE.Group();
  const root = new THREE.Bone(); root.name = 'root';
  const head = new THREE.Bone(); head.name = 'head'; head.position.y = 1.23;
  scene.add(root); root.add(head);
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(.8, 2.4, .6), new THREE.MeshStandardMaterial({map: new THREE.Texture()})));
  const names = new Set(['Idle', '2H_Melee_Idle', 'Hit_A', 'Hit_B', 'Blocking', 'Block_Hit', 'Death_A', 'Cheer']);
  for (const id of Object.keys(CHOREOGRAPHY)) { const c = resolveChoreography(id); names.add(c.idle); for (const k of ['q', 'e', 'r']) for (const s of c[k].steps) names.add(s.clip); }
  const clips = [...names].map(n => new THREE.AnimationClip(n, 1, [new THREE.VectorKeyframeTrack('head.position', [0, 1], [0, 1.23, 0, 0, 1.3, 0])]));
  return {gltf: {scene, animations: clips}, clips};
}

test('rig: hit saldiriyi keser, knockdown sonrasi hicbir klip oynamaz, eski action durdurulur', () => {
  const rig = createFighterRig(THREE, asset(), {fighterId: 'vargr', seat: 1});
  rig.play('q');
  rig.update(0.05);
  assert.equal(rig.play('hit'), true);
  assert.equal(rig.stats().state, 'hit');
  assert.equal(rig.play('q'), false, 'hit sirasinda saldiri baslamaz');
  for (let i = 0; i < 20; i++) rig.update(0.05);
  assert.equal(rig.stats().state, 'idle');
  rig.play('r');
  rig.play('ko');
  assert.equal(rig.play('win'), false);
  assert.equal(rig.play('q'), false);
  for (let i = 0; i < 20; i++) rig.update(0.05);
  // fade bitti: ko disinda calisan action kalmadi (yarim poz yok)
  const running = Object.values(rig.actions).filter(a => rig.mixer._isActiveAction(a) && a.getEffectiveWeight() > 0.001);
  assert.equal(running.length, 1, `calisan action sayisi ${running.length}`);
  assert.equal(rig.stats().state, 'ko');
  rig.dispose();
});

test('rig: temas oncesi ikinci saldiri kuyruga girer ve birincinin ardindan oynar', () => {
  const rig = createFighterRig(THREE, asset(), {fighterId: 'vargr', seat: 1});
  rig.play('q');
  rig.update(0.1);
  assert.equal(rig.play('e'), true);
  assert.equal(rig.stats().state, 'q', 'kuyrukta: ilk saldiri surer');
  for (let i = 0; i < 80 && rig.stats().state === 'q'; i++) rig.update(0.05);
  assert.equal(rig.stats().state, 'e', 'kuyruktaki saldiri oynadi');
  rig.dispose();
});

// ---- madde 3: temas / dash / kadraj (saf)
import {contactDistance, reachFromDepth, dashProgress, frameFighters, createSkillFx, SKILL_PROFILES, PARTICLE_POOL} from '../pvp/fighters3d.js';

test('contactDistance model uzanimina gore olceklenir', () => {
  assert.equal(contactDistance(5, reachFromDepth(2.4)), 5 - 1.2 - 0.3);
  assert.ok(contactDistance(5, reachFromDepth(1.6)) > contactDistance(5, reachFromDepth(3.0)), 'uzun silah daha az yol');
  assert.equal(contactDistance(1, 1.5), 0, 'negatif olmaz');
  assert.equal(reachFromDepth(NaN), 0.95);
});

test('dash: temastan 60-120 ms once varir, temasta tam mesafe, geri donus ease-in', () => {
  const hit = 650;
  assert.equal(dashProgress(0, hit), 0);
  const arrive = dashProgress(hit - 90, hit);
  assert.ok(arrive > 0.999, `varis ${arrive}`);
  assert.ok(dashProgress(hit - 200, hit) < arrive);
  assert.equal(dashProgress(hit, hit), 1);
  assert.ok(dashProgress(hit + 100 + 160, hit, {returnMs: 320}) > 0.7, 'ease-in: ilk yarida cok az doner');
  assert.ok(dashProgress(hit + 100 + 320, hit, {returnMs: 320}) < 1e-9, 'yerine doner');
  // ease-out: ilk yarida mesafenin yarisindan fazlasi
  assert.ok(dashProgress(hit * 0.15 + (hit - 90 - hit * 0.15) / 2, hit) > 0.8);
});

test('kadraj: orta noktayi izler, yaklasinca hafif zoom', () => {
  const far = frameFighters(-3, 3), near = frameFighters(-0.8, 0.8);
  assert.equal(far.centerX, 0);
  assert.ok(near.zoom > far.zoom && near.zoom <= 0.45);
  assert.ok(frameFighters(2, 6).centerX > 0);
});

// ---- madde 4: karakter profilleri ve parcacik havuzu
test('skill fx: dort karakter profili, havuz sabit, dusuk cihazda azalir', () => {
  assert.deepEqual(Object.keys(SKILL_PROFILES).sort(), ['doran', 'konyali', 'nyx', 'sira', 'vargr']);
  const scene = new THREE.Scene();
  const fx = createSkillFx(THREE, scene);
  const pos = new THREE.Vector3(0, 1, 0);
  const hi = fx.burst('vargr', pos);
  fx.setLowQuality(true);
  const lo = fx.burst('vargr', pos);
  assert.ok(lo < hi && fx.stats().cap === PARTICLE_POOL.low);
  fx.update(0.016);
  assert.ok(fx.stats().particles > 0 && fx.stats().particles <= PARTICLE_POOL.high);
  for (let i = 0; i < 80; i++) fx.update(0.05);
  assert.equal(fx.stats().particles, 0, 'omur bitince temizlenir');
  for (const id of Object.keys(SKILL_PROFILES)) assert.ok(fx.burst(id, pos) > 0, id);
  fx.spawn({kind: 'spear', from: pos, to: new THREE.Vector3(3, 1, 0), flight: 100, profile: 'sira'});
  fx.update(0.02);
  fx.dispose();
});

// ---- block, hit sirasinda dusmez
test('rig: hit sirasinda gelen block hit bitince oynar', () => {
  const rig = createFighterRig(THREE, asset(), {fighterId: 'vargr', seat: 1});
  rig.play('hit');
  assert.equal(rig.play('block'), true);
  assert.equal(rig.stats().state, 'hit');
  for (let i = 0; i < 40 && rig.stats().state === 'hit'; i++) rig.update(0.05);
  assert.equal(rig.stats().state, 'block');
  rig.dispose();
});
