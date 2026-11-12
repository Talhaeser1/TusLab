// Dövüş temposu — deterministik saatli simülasyon (makine yükünden bağımsız).
// Kullanım: node .playwright-mcp/dovus-sim.mjs [vargr nyx]
// Gerçek arena3d + fighters3d (sentetik Meshy varlığı), 16 ms kare; her kare iki modelin durum/konumu.
import * as THREE from '../pvp/vendor/three.module.min.js';
import {CHOREOGRAPHY, resolveChoreography, MODEL_VARIANTS} from '../pvp/fighters3d.js';
import {createArena3D} from '../pvp/arena3d.js';

const ARGS = process.argv.slice(2);
const TRACE = ARGS.includes('--trace');
const [F1 = 'vargr', F2 = 'nyx'] = ARGS.filter(a => !a.startsWith('--'));
const ATK = new Set(['q', 'e', 'r', 'walkBack']);

function clipNames() {
  const names = new Set(['Idle', '2H_Melee_Idle', 'Hit_A', 'Hit_B', 'Blocking', 'Block_Hit', 'Death_A', 'Cheer']);
  for (const id of Object.keys(CHOREOGRAPHY)) {
    const c = resolveChoreography(id);
    names.add(c.idle);
    for (const s of ['q', 'e', 'r']) for (const step of c[s].steps) names.add(step.clip);
  }
  for (const id of [F1, F2]) for (const n of [...Object.values(MODEL_VARIANTS[id].meshy.clips).flat(), ...Object.values(MODEL_VARIANTS[id].meshy.skills).map(s => s.clip)]) names.add(n);
  return [...names];
}
function fakeAsset(duration = 1.2) {
  const scene = new THREE.Group();
  const root = new THREE.Bone(); root.name = 'root';
  const head = new THREE.Bone(); head.name = 'head'; head.position.y = 1.23;
  const hand = new THREE.Bone(); hand.name = 'handslotr'; hand.position.set(0.3, 0.6, 0);
  scene.add(root); root.add(head); root.add(hand);
  const material = new THREE.MeshStandardMaterial({map: new THREE.Texture()});
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.4, 0.6).translate(0, 1.2, 0), material));
  const clips = clipNames().map(name => new THREE.AnimationClip(name, duration, [
    new THREE.VectorKeyframeTrack('head.position', [0, duration], [0, 1.23, 0, 0, 1.3, 0])]));
  return {gltf: {scene, animations: clips}, clips, sharedMaterial: material, ...(ARGS.includes('--kaykit') ? {} : {variant: 'meshy'})};
}
class CL { v = new Set(); add(...x) { x.forEach(a => this.v.add(a)); } remove(...x) { x.forEach(a => this.v.delete(a)); } contains(x) { return this.v.has(x); } }
function el(name, rect = {left: 0, top: 0, width: 0, height: 0}) {
  return {name, rect, style: {}, attributes: {}, children: [], parentNode: null, listeners: {}, classList: new CL(), selectors: {}, clientLeft: 0, clientTop: 0,
    get firstChild() { return this.children[0] || null; }, querySelector(q) { return this.selectors[q] || null; },
    getBoundingClientRect() { return {...this.rect, right: this.rect.left + this.rect.width, bottom: this.rect.top + this.rect.height}; },
    setAttribute(k, v) { this.attributes[k] = v; }, insertBefore(c) { this.children.unshift(c); c.parentNode = this; return c; },
    removeChild(c) { this.children = this.children.filter(x => x !== c); }, remove() {},
    addEventListener(t, fn) { (this.listeners[t] ||= new Set()).add(fn); }, removeEventListener(t, fn) { this.listeners[t]?.delete(fn); },
    dispatchEvent(e) { for (const fn of this.listeners[e.type] || []) fn(e); return true; }};
}
const fake2d = () => { const g = {addColorStop() {}}; return new Proxy({}, {get: (t, k) => (k in t ? t[k] : () => g), set: (t, k, v) => { t[k] = v; return true; }}); };

async function build() {
  const root = el('root');
  const duel = el('duel', {left: 0, top: 0, width: 1366, height: 600});
  root.selectors['.pvp2-duel'] = duel;
  duel.selectors['.pvp2-side[data-seat="1"] .pvp2-stage'] = el('s1', {left: 10, top: 100, width: 660, height: 360});
  duel.selectors['.pvp2-side[data-seat="2"] .pvp2-stage'] = el('s2', {left: 690, top: 100, width: 660, height: 360});
  let clock = 1000;
  const doc = {hidden: false, addEventListener() {}, removeEventListener() {},
    createElement: () => { const c = el('canvas'); c.width = 0; c.height = 0; c.getContext = k => (k === '2d' ? fake2d() : null); return c; }};
  root.ownerDocument = doc;
  class CE { constructor(type, init) { this.type = type; this.detail = init?.detail; } }
  const env = {document: doc, devicePixelRatio: 1, performance: {now: () => clock}, setTimeout, clearTimeout, CustomEvent: CE, location: {search: ''}, advance(ms) { clock += ms; }};
  const renderer = {setPixelRatio() {}, setSize() {}, setClearColor() {}, render() {}, dispose() {}};
  const instance = await createArena3D({root, THREE, env, isReduced: () => false, createRenderer: () => renderer,
    loadTexture: async () => new THREE.Texture(), loadModel: async () => fakeAsset(), cloneModel: o => o.clone(true)});
  await instance.ready;
  await instance.setFighters({1: F1, 2: F2});
  const casts = [];
  root.addEventListener('tuslab:pvp-cast', e => casts.push({t: clock, seat: e.detail.seat, skill: e.detail.skill}));
  return {instance, env, root, casts, now: () => clock};
}

/** script: [[ms, seat, skill, extra?]] — sunucu olay zamanları (hasar motorda aynı anda). */
async function scenario(name, script, totalMs, step = 16) {
  const {instance, env, casts, now} = await build();
  const t0 = now();
  const home = [1, 2].map(s => instance._debug.fighter(s).home.x);
  let trail = [], hist = [], bothRows = [];
  let frame = 0, bothAtk = 0, maxJump = 0, jumpAt = '', px = null;
  const segs = [], cur = {1: null, 2: null}, lat = [];
  let lastBusy = 0; const idleGaps = [];
  const pending = script.slice().sort((a, b) => a[0] - b[0]);
  const latWait = [];
  for (let t = 0; t <= totalMs; t += step) {
    while (pending.length && pending[0][0] <= t) {
      const row = pending.shift();
      if (typeof row[1] === 'object') { instance.handle(row[1]); continue; }
      if (row[1] === 'drain') { instance.visualQueue.drain(row[2] || 1500); continue; }
      const [, seat, skill, extra = {}] = row;
      const snap = instance.visualQueue.snapshot();
      const m0 = instance._debug.models();
      const idle = !snap.busy && m0[1].state === 'idle' && m0[2].state === 'idle';
      instance.handle({type: 'SKILL_CAST', fromSeat: seat, toSeat: 3 - seat, skill});
      instance.handle({type: 'DAMAGE_APPLIED', fromSeat: seat, toSeat: 3 - seat, skill, amount: 40, hpAfter: 900, ...extra});
      if (idle) latWait.push({seat, t});
    }
    env.advance(step); instance._debug.tick(); frame++;
    const m = instance._debug.models();
    const st = [m[1].state, m[2].state], xs = [m[1].x, m[2].x];
    // Saldıran: gerçek saldırı durum adı (q/e/r/walkBack) ya da aktif sahnenin sahibi olarak yerinden oynamış.
    // Savunanın darbe/blok/çekilme tepkisi saldırı sayılmaz.
    const qs = instance.visualQueue.snapshot();
    const act = [0, 1].map(i => ATK.has(st[i]) || (qs.activeSeat === i + 1 && Math.abs(xs[i] - home[i]) > 0.06));
    if (ATK.has(st[0]) && ATK.has(st[1])) { bothAtk++; if (TRACE && bothRows.length < 30 && bothAtk % 3 === 1) { const q = instance.visualQueue.snapshot(); bothRows.push(`${t} ${st.join('/')} ${m[1].clip}/${m[2].clip} ${xs.map(v => v.toFixed(2)).join(',')} q${q.activeSeat}:${q.phase} seg${[1, 2].map(s => instance._debug.fighter(s).traveling ? 'T' : '-').join('')}`); } }
    if (px) xs.forEach((x, i) => { const d = Math.abs(x - px[i]); if (d > maxJump) { maxJump = d; jumpAt = `${t} s${i + 1} ${st[i]}`; trail = hist.slice(-10); } });
    px = xs;
    if (SETTLE && t % 160 === 0) { const q = instance.visualQueue.snapshot(); const f = [1, 2].map(s => instance._debug.fighter(s)); console.log(t, st.join('/'), `${m[1].clip}/${m[2].clip}`, `q${q.activeSeat}:${q.phase} gap${Math.round(q.gapLeftMs)} queued${q.queued}`, 'off', f.map(x => (x.position.x - x.home.x).toFixed(2) + (x.traveling ? 'T' : '')).join(','), 'tracks', f.map(x => x.tracks).join(',')); }
    if (TRACE) { const q = instance.visualQueue.snapshot(); hist.push(`${t} ${st.join('/')} ${m[1].clip}/${m[2].clip} ${xs.map(v => v.toFixed(2)).join(',')} ${q.activeSeat}:${q.phase}`); if (hist.length > 20) hist.shift(); }
    for (const i of [0, 1]) {
      const s = i + 1;
      if (act[i] && !cur[s]) { cur[s] = {seat: s, a: t, b: t}; const w = latWait.findIndex(x => x.seat === s); if (w >= 0) { lat.push(t - latWait[w].t); latWait.splice(w, 1); } }
      if (act[i]) cur[s].b = t;
      if (!act[i] && cur[s]) { segs.push(cur[s]); cur[s] = null; }
    }
    const busy = st.some(x => x !== 'idle') || xs.some((x, i) => Math.abs(x - home[i]) > 0.06);
    if (busy) lastBusy = t;
  }
  for (const s of [1, 2]) if (cur[s]) segs.push(cur[s]);
  segs.sort((a, b) => a.a - b.a);
  const switches = [];
  for (let i = 1; i < segs.length; i++) if (segs[i].seat !== segs[i - 1].seat) switches.push(segs[i].a - segs[i - 1].b);
  const snap = instance.visualQueue.snapshot();
  const castDup = casts.filter((c, i) => i && casts[i - 1].seat === c.seat && c.t - casts[i - 1].t < 50).length;
  instance.destroy();
  return {name, bothAtk, switches, maxJump: +maxJump.toFixed(3), jumpAt, lat, segs: segs.map(s => `${s.seat}:${s.a}-${s.b}`).join(' '),
    forced: snap.forced, casts: casts.length, castDup, ...(TRACE ? {trail, bothRows} : {})};
}

const SETTLE = ARGS.includes('--settle');
if (SETTLE) { await scenario('settle', [[0, 1, 'q'], [0, 2, 'q']], 5000); process.exit(0); }
const out = [];
// A: iki oyuncu sırayla/çakışarak saldırır (normal tempo)
out.push(await scenario('alterne', [[0, 1, 'q'], [300, 2, 'q'], [1500, 1, 'e'], [1700, 2, 'e'], [3000, 1, 'q'], [3300, 1, 'q'], [3400, 2, 'q'], [6000, 2, 'q']], 16000));
// B: hızlı yazan oyuncu (her 400 ms bir saldırı) + bot ara ara
const fast = []; for (let i = 0; i < 10; i++) fast.push([i * 400, 1, i % 3 === 2 ? 'e' : 'q']);
for (let i = 0; i < 4; i++) fast.push([200 + i * 1000, 2, 'q']);
out.push(await scenario('hizli', fast, 30000));
// C: kuyruk boşken tek saldırı → gecikme
out.push(await scenario('gecikme', [[500, 1, 'q'], [6000, 2, 'q'], [12000, 1, 'e']], 16000));
// D: ulti (sunucu faz zamanları 250/430/670) + blok, sonra raund sonu boşaltması
const ult = (t0, s) => [[t0, {type: 'SKILL_CAST', fromSeat: s, toSeat: 3 - s, skill: 'r'}],
  ...[[250, 1], [430, 2], [670, 3]].flatMap(([d, ph]) => [[t0 + d, {type: 'ULTIMATE_PHASE', fromSeat: s, toSeat: 3 - s, skill: 'r', phase: ph, ultimateId: 7 + s}],
    [t0 + d, {type: 'DAMAGE_APPLIED', fromSeat: s, toSeat: 3 - s, skill: 'r', phase: ph, amount: 60, hpAfter: 800, ultimateId: 7 + s}]])];
out.push(await scenario('ulti+blok', [[0, 1, 'q'], ...ult(300, 2), [900, 1, 'e', {blocked: true, blockKind: 'BLOCK', amount: 10}], [2500, 2, 'q'], ...ult(4000, 1), [4200, 2, 'e']], 20000));
// E: raund sonu: iki taraf birikmiş saldırı + drain(1500) — sahneler sıralı, zorla bitirme sayısı
out.push(await scenario('raund-sonu', [[0, 1, 'q'], [100, 2, 'q'], [200, 1, 'e'], [300, 2, 'e'], [400, 1, 'q'], [500, 2, 'q'], [600, 'drain', 1500]], 12000));
// F: rounds çözüm fazı gerçeği: 8 sıra (s1/s2 dönüşümlü) 750 ms adımla, sonra ROUND_END drain(DRAIN)
const DRAIN = Number((ARGS.find(a => a.startsWith('--drain=')) || '--drain=1500').slice(8));
const res = []; for (let i = 0; i < 8; i++) res.push([i * 750, (i % 2) + 1, i % 3 === 2 ? 'e' : 'q']);
out.push(await scenario('cozum-fazi', [...res, [6300, 'drain', DRAIN]], 16000));
for (const r of out) console.log(JSON.stringify(r));
process.exit(0);
