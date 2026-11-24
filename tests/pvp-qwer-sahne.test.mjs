// KESINYAP 21/22 — Q/W/E/R sahne tarafı: E (kendine can) klibi, durum makinesi, rounds sahne kalabalığı, konum sınırı.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MODEL_VARIANTS, HEAL_SCENE, variantMissingClips, sceneTiming, sceneProgress, SCENE} from '../pvp/fighters3d.js';
import {createAnimState, ANIM_PRIORITY} from '../pvp/anim-state.js';
import {createCombatFxDirector} from '../pvp/combat-fx.js';
import {attachResolveUi} from '../pvp/resolve-ui.js';
import {MAX_FWD_STEP, MAX_WORLD_SPEED, MAX_POSE_DT_MS} from '../pvp/arena3d.js';

const IDS = ['vargr', 'sira', 'doran', 'nyx', 'konyali'];
const glbClips = id => {
  const b = readFileSync(new URL(`../assets/models/${id}/${id}.glb`, import.meta.url));
  return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString()).animations.map(a => a.name);
};

test('her karakterin Q, W (e), R klipleri tanımlı ve birbirinden farklı; E (can) klibi GLB’de var', () => {
  for (const id of IDS) {
    const v = MODEL_VARIANTS[id].meshy, names = glbClips(id);
    const q = v.skills.q.clip, w = v.skills.e.clip, r = v.skills.r.clip;
    assert.equal(new Set([q, w, r]).size, 3, `${id}: Q/W/R klipleri farklı`);
    assert.ok(typeof v.clips.heal === 'string' && names.includes(v.clips.heal), `${id}: heal klibi ${v.clips.heal}`);
    assert.deepEqual(variantMissingClips(names.map(name => ({name})), v), [], `${id} eksik klip yok`);
  }
  assert.ok(HEAL_SCENE.ms > 0 && HEAL_SCENE.ms <= 2000, 'can pozu kısa');
});

test('anim durumu: heal boştan oynar, saldırı onu keser, kilitlenmez', () => {
  const a = createAnimState();
  assert.equal(a.request('heal').action, 'play');
  assert.equal(a.state.kind, 'heal');
  assert.equal(ANIM_PRIORITY.heal, ANIM_PRIORITY.attack);
  assert.equal(a.request('q', {contactMs: 400}).action, 'play', 'saldırı can pozunu keser');
  a.finish();
  a.request('heal');
  assert.equal(a.finish(), null);
  assert.equal(a.state.kind, 'idle');
});

test('combat-fx: quietLabels → havada yüzen efekt adı yazılmaz (rounds)', () => {
  const label = {textContent: ''};
  const doc = {createElement: () => ({className: '', dataset: {}, style: {setProperty() {}}, setAttribute() {}, remove() {}})};
  const layer = {ownerDocument: doc, appendChild() {}};
  const node = {classList: {add() {}, remove() {}}, querySelector: s => (s === '.pvp4-effects' ? layer : s === '[data-fx-label]' ? label : null)};
  const scheduler = {setTimeout: () => 1, clearTimeout() {}};
  let quiet = true;
  const fx = createCombatFxDirector({root: node, scheduler, quietLabels: () => quiet});
  fx.play({cue: 'sparks'});
  assert.equal(label.textContent, '');
  quiet = false;
  fx.play({cue: 'sparks'});
  assert.equal(label.textContent, 'KIVILCIM');
});

test('resolve ui: quietRounds → rounds çözümünde "SALDIRI SIRASI" yok, klasik pencere bandı aynen', () => {
  const listeners = {};
  const made = [];
  const mk = () => {
    const cls = new Set();
    const e = {dataset: {}, hidden: false, textContent: '', isConnected: true, parentNode: null, attrs: {},
      classList: {add: c => cls.add(c), remove: (...c) => c.forEach(x => cls.delete(x)), toggle: (c, on) => (on ? cls.add(c) : cls.delete(c)), contains: c => cls.has(c)},
      setAttribute(k, v) { this.attrs[k] = v; }, appendChild(c) { c.parentNode = this; this.child = c; }, remove() { this.isConnected = false; }};
    made.push(e);
    return e;
  };
  const duel = mk();
  const root = {ownerDocument: {createElement: mk}, querySelector: s => (s === '.pvp2-duel' ? duel : null), querySelectorAll: () => [],
    addEventListener: (t, f) => { listeners[t] = f; }, removeEventListener: t => { delete listeners[t]; }};
  const emit = (t, detail) => listeners[t]?.({detail});
  const scheduler = {setTimeout: () => 1, clearTimeout() {}};
  const ui = attachResolveUi({root, getSeat: () => 1, scheduler, quietRounds: true});
  emit('tuslab:pvp-round', {type: 'ROUND_RESOLVE', payload: {round: 2, turns: 3}});
  emit('tuslab:pvp-combat', {type: 'DAMAGE_APPLIED', resolve: true, turn: 1, fromSeat: 1, toSeat: 2, amount: 100});
  assert.ok(!duel.child || duel.child.hidden, 'rounds: bant gösterilmez');
  emit('tuslab:pvp-round', {type: 'EXCHANGE_RESOLVE', payload: {index: 1, turns: 1}});
  assert.equal(duel.child.hidden, false, 'klasik pencere bandı kalır');
  ui.destroy();
});

test('konum sınırı hız tabanlı: 60 fps’te kare başına 0,12; düşük kare hızında hız korunur; uzun karede ≤ 0,36', () => {
  const cap = dt => MAX_WORLD_SPEED * Math.min(dt, MAX_POSE_DT_MS) / 1000;
  assert.ok(Math.abs(cap(1000 / 60) - MAX_FWD_STEP) < 1e-9);
  assert.ok(Math.abs(cap(50) / 0.05 - MAX_WORLD_SPEED) < 1e-9, '20 fps: aynı hız');
  assert.ok(cap(1000) <= 0.36 + 1e-9, 'takılmada ışınlanma yok');
  const src = readFileSync(new URL('../pvp/arena3d.js', import.meta.url), 'utf8');
  assert.ok(src.includes('const cap = MAX_WORLD_SPEED * Math.min(dtPose, MAX_POSE_DT_MS) / 1000;'));
});

test('karma zincir (Hacı Usta Q menzilli + W yakın): Q evde atılır, sonra koşu, W temasta; tek dönüş, eve varış', () => {
  const Q = {peakMs: 1950, clipMs: 4300, ranged: true}, W = {peakMs: 1300, clipMs: 3000, ranged: false};
  const T = sceneTiming([Q, W]);
  assert.equal(T.moveIn, 1);
  const [q, w] = T.strikes;
  assert.ok(q.contact < T.departMs + 1e-9 || q.release < T.departMs, 'Q yola çıkmadan bırakılır');
  for (let ms = 0; ms <= T.departMs; ms += 20) assert.equal(sceneProgress(ms, T), 0, 'Q sırasında evde');
  assert.equal(sceneProgress(T.arrive + 10, T), 1, 'W için rakibe varır');
  assert.ok(w.start >= T.arrive - SCENE.strikeLeadMs - 1e-9 && w.contact > q.contact);
  assert.ok(Math.abs(sceneProgress(T.totalMs, T)) < 1e-9, 'eve döner');
  assert.ok(T.totalMs <= 7800, `tek sahne ${Math.round(T.totalMs)} ms (kombo tavanı 7800)`);
  // eski davranış korunur: yalnız yakın / yalnız menzilli zincirde departMs = telegraf
  assert.equal(sceneTiming([W, W]).departMs, sceneTiming([W, W]).telegraphMs);
});
