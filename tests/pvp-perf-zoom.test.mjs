// Performans ajanı — tarayıcı uzaklaştırma (%80/%67) ve zayıf GPU koruması.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {budgetRatio, backingPixels, createFrameGovernor, PIXEL_BUDGETS, MIN_RENDER_RATIO} from '../pvp/perf-governor.js';
import {createParticleLayer} from '../pvp/fx-particles.js';
import {AUTO_QUALITY} from '../pvp/arena3d.js';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

// Sahibin makinesi: 1920×1080 ekran, Windows %125 ölçek. Brave yakınlaştırması
// CSS görüş alanını büyütür ve dpr'yi küçültür.
const ZOOMS = [
  {name: '100%', w: 1536, h: 864, dpr: 1.25},
  {name: '80%', w: 1920, h: 1080, dpr: 1.0},
  {name: '67%', w: 2304, h: 1296, dpr: 0.833},
  {name: '50%', w: 3072, h: 1728, dpr: 0.625},
  {name: '4K-benzeri', w: 3072, h: 1728, dpr: 1.25},
];

test('budgetRatio: 3B canvas hiçbir yakınlaştırmada mutlak bütçeyi aşmaz', () => {
  for (const z of ZOOMS) {
    // Düello alanı görüş alanının ~%96 × %70'i.
    const cw = Math.round(z.w * 0.96);
    const ch = Math.round(z.h * 0.7);
    const high = budgetRatio(cw, ch, z.dpr, {maxRatio: 2, budget: PIXEL_BUDGETS.arenaHigh});
    const low = budgetRatio(cw, ch, z.dpr, {maxRatio: 1, budget: PIXEL_BUDGETS.arenaLow});
    assert.ok(backingPixels(cw, ch, high) <= PIXEL_BUDGETS.arenaHigh * 1.01, `${z.name} high ${backingPixels(cw, ch, high)}`);
    assert.ok(backingPixels(cw, ch, low) <= PIXEL_BUDGETS.arenaLow * 1.01, `${z.name} low ${backingPixels(cw, ch, low)}`);
    assert.ok(high <= z.dpr + 1e-9, `${z.name}: oran dpr'yi aşmaz (${high} > ${z.dpr})`);
    assert.ok(low >= MIN_RENDER_RATIO);
  }
});

test('budgetRatio: uzaklaştırınca oran 1\'in altına iner (eski max(1,…) hatası)', () => {
  // %67: dpr 0.833 → eski kod 1'e sabitliyordu, GPU ekrandakinden %44 fazla piksel boyuyordu.
  const r = budgetRatio(1000, 500, 0.833, {maxRatio: 2, budget: 10e6});
  assert.ok(r < 1 && r >= 0.83 - 0.01, `ratio ${r}`);
  // Aynı ekran pikseli: %100 ve %80'de backing store benzer kalmalı (±%15).
  const at100 = backingPixels(1475, 554, budgetRatio(1475, 554, 1.25));
  const at80 = backingPixels(1856, 754, budgetRatio(1856, 754, 1.0));
  assert.ok(at80 <= PIXEL_BUDGETS.arenaHigh && at100 <= PIXEL_BUDGETS.arenaHigh);
  assert.equal(budgetRatio(0, 0, 1.5), 1.5, 'alan yoksa dpr kullanılır');
  assert.equal(budgetRatio(10, 10, 0.1), MIN_RENDER_RATIO, 'alt sınır');
});

test('kare valisi: ısınma ve duraklamalar sayılmaz, kademeler tek yönlü iner', () => {
  const g = createFrameGovernor({slowMs: 20, warmupFrames: 5, windowFrames: 10, maxStep: 3});
  for (let i = 0; i < 5; i++) assert.equal(g.sample(40), false, 'ısınma');
  for (let i = 0; i < 50; i++) assert.equal(g.sample(16.7), false, 'hızlı kareler düşürmez');
  for (let i = 0; i < 30; i++) g.sample(900); // shader derleme / sekme dönüşü duraklaması
  assert.equal(g.step, 0, 'uzun duraklamalar ölçülmez');
  let steps = 0;
  for (let i = 0; i < 200; i++) if (g.sample(28)) steps++;
  assert.equal(g.step, 3);
  assert.equal(steps, 3, 'bloom → çözünürlük → düşük, her biri bir kez');
  assert.equal(g.sample(50), false, 'en alt kademede durur');
  g.setStep(0);
  assert.equal(g.step, 0);
});

test('kare valisi: model ve shader hazırlığında örneklemez, sonrasında ısınmayı sıfırlar', () => {
  const g = createFrameGovernor({slowMs: 20, warmupFrames: 3, windowFrames: 4, maxStep: 3});
  g.sample(40); g.sample(40);
  g.setPaused(true);
  for (let i = 0; i < 200; i++) assert.equal(g.sample(40), false);
  assert.equal(g.step, 0);
  g.setPaused(false);
  for (let i = 0; i < 3; i++) assert.equal(g.sample(40), false, 'yeni ısınma');
  for (let i = 0; i < 3; i++) assert.equal(g.sample(40), false, 'henüz pencere dolmadı');
  assert.equal(g.sample(40), true);
  assert.equal(g.step, 1);
});

test('kare valisi: 48/50 Hz ekranın düzgün kareleri (≈20,8 ms) kaliteyi düşürmez; düzensiz ya da 30 FPS düşürür', () => {
  const steady = createFrameGovernor({slowMs: 20, warmupFrames: 5, windowFrames: 10, maxStep: 3});
  for (let i = 0; i < 400; i++) steady.sample(20.8 + (i % 3) * 0.2); // 48 Hz, ±0,4 ms titreme
  assert.equal(steady.step, 0, '48 Hz ekran yavaşlık sayılmaz');
  const fifty = createFrameGovernor({slowMs: 20, warmupFrames: 5, windowFrames: 10, maxStep: 3});
  for (let i = 0; i < 400; i++) fifty.sample(20);
  assert.equal(fifty.step, 0, '50 Hz ekran yavaşlık sayılmaz');
  const jitter = createFrameGovernor({slowMs: 20, warmupFrames: 5, windowFrames: 10, maxStep: 3});
  for (let i = 0; i < 400; i++) jitter.sample(i % 2 ? 16.7 : 33.3); // 60 Hz ekranda kare kaçırma
  assert.equal(jitter.step, 3, 'düzensiz kareler kademe düşürür');
  const thirty = createFrameGovernor({slowMs: 20, warmupFrames: 5, windowFrames: 10, maxStep: 3});
  for (let i = 0; i < 400; i++) thirty.sample(33.3);
  assert.equal(thirty.step, 3, 'sabit 30 FPS yavaştır');
});

test('arena3d: otomatik kalite eşikleri hızlı tepki verir (≈1.5 sn) ve mutlak bütçe kullanır', () => {
  assert.equal(AUTO_QUALITY.slowMs, 20);
  assert.ok(AUTO_QUALITY.warmupFrames + AUTO_QUALITY.windowFrames <= 90, 'eski 90 karelik ısınmadan hızlı');
  assert.equal(AUTO_QUALITY.lowStep, 3);
  const src = read('../pvp/arena3d.js');
  assert.match(src, /budgetRatio\(width, height, dpr/);
  assert.doesNotMatch(src, /Math\.max\(1, Math\.min\(2, dpr/, 'oran 1\'e sabitlenmez');
  assert.match(src, /bloomActive\(\)/, 'bloom yalnızca en üst kademede');
  assert.match(src, /queueWarmup\(\)/, 'kademe geçişleri için shader ön-derleme');
  assert.doesNotMatch(src, /desynchronized\s*:\s*true/);
});

function particleFixture({dpr = 1, width = 2300, height = 900, displayNone = false} = {}) {
  const frames = new Map();
  let nextId = 0;
  const duel = {
    children: [],
    appendChild(n) { this.children.push(n); n.isConnected = true; },
    getBoundingClientRect: () => ({left: 0, top: 0, width, height}),
  };
  const doc = {
    hidden: false,
    createElement: tag => ({
      tag, width: 0, height: 0, style: {}, isConnected: false,
      setAttribute() {},
      getContext: () => new Proxy({}, {get: (t, k) => (k in t ? t[k] : () => ({addColorStop() {}})), set: (t, k, v) => ((t[k] = v), true)}),
      remove() {},
    }),
    addEventListener() {},
    removeEventListener() {},
  };
  const root = {
    ownerDocument: doc,
    querySelector: sel => (sel === '.pvp2-duel' ? duel : null),
    querySelectorAll: () => [],
  };
  const env = {
    document: doc,
    devicePixelRatio: dpr,
    random: Math.random,
    getComputedStyle: () => ({display: displayNone ? 'none' : 'block'}),
    requestAnimationFrame(fn) { const id = ++nextId; frames.set(id, fn); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
  };
  return {root, env, duel, frames};
}

test('parçacık canvas\'ı: %80/%67 yakınlaştırmada ≤ 1 MP ve dpr < 1 izlenir', () => {
  for (const z of ZOOMS) {
    const f = particleFixture({dpr: z.dpr, width: Math.round(z.w * 0.96), height: Math.round(z.h * 0.7)});
    const layer = createParticleLayer({root: f.root, env: f.env});
    assert.equal(layer.canvas.width, 1, 'ilk efekte kadar ayrılmaz');
    layer.burstAt(100, 100, 'hit');
    const c = layer.canvas;
    assert.ok(c.width > 100, `${z.name}: efektle gerçek boyut`);
    assert.ok(c.width * c.height <= PIXEL_BUDGETS.particlesHigh * 1.01, `${z.name}: ${c.width}x${c.height}`);
    assert.ok(c.width <= Math.round(z.w * 0.96 * z.dpr) + 1, `${z.name}: dpr'den büyük değil`);
    layer.destroy();
  }
});

test('parçacık canvas\'ı: 3B modda (display:none) backing store 1×1, uyurken görünmez', () => {
  const f = particleFixture({displayNone: true});
  const layer = createParticleLayer({root: f.root, env: f.env});
  assert.equal(layer.canvas.width, 1);
  assert.equal(layer.canvas.height, 1);
  assert.equal(layer.canvas.style.visibility, 'hidden', 'boşta birleştirme katmanı yok');
  layer.destroy();

  const g = particleFixture({dpr: 1});
  const live = createParticleLayer({root: g.root, env: g.env});
  assert.equal(live.canvas.style.visibility, 'hidden');
  live.burstAt(100, 100, 'hit');
  assert.equal(live.canvas.style.visibility, '', 'efekt sırasında görünür');
  assert.ok(live.canvas.width > 1);
  // Döngü biter → yeniden gizlenir ve uyur.
  let guard = 0;
  let clock = 0;
  while (g.frames.size && guard++ < 1000) {
    const [id, fn] = g.frames.entries().next().value;
    g.frames.delete(id);
    fn((clock += 16));
  }
  assert.equal(live.stats().running, false);
  assert.equal(live.canvas.style.visibility, 'hidden');
  live.destroy();
});

test('CSS: 3B modda gizli DOM rig animasyonu ve backdrop-filter kapalı', () => {
  const css = read('../pvp/arena3d.css');
  assert.match(css, /\.pvp26-3d \.pvp3-rig \*\{[^}]*animation:none!important/);
  assert.match(css, /\.pvp26-3d \.pvp2-role\{[^}]*backdrop-filter:none/);
  // Tam ekran kabukta 160px bulanık iç gölge 3B modda kullanılmaz.
  const shell3d = css.match(/#pvp-root\.pvp26-3d \.pvp2-shell\{[^}]*\}/g) || [];
  assert.ok(shell3d.length >= 1);
  assert.ok(shell3d.at(-1).includes('box-shadow:none'), 'son kural gölgeyi kapatır');
  const pvp = read('../pvp/pvp.css');
  assert.match(pvp, /Performans ajanı/);
  assert.match(pvp, /clamp\(10px,\.55vw,12px\)/, 'küçük etiketler 10 px altına inmez');
});

test('parçacık canvas\'ı: 3B arena sonradan açılınca clear() backing store\'u bırakır', () => {
  let none = false;
  const f = particleFixture({dpr: 1});
  f.env.getComputedStyle = () => ({display: none ? 'none' : 'block'});
  const layer = createParticleLayer({root: f.root, env: f.env});
  layer.burstAt(100, 100, 'hit');
  assert.ok(layer.canvas.width > 1);
  none = true; // index.js: 3B arena kuruldu → fx24.particles.clear()
  layer.clear();
  assert.equal(layer.canvas.width, 1);
  assert.equal(layer.canvas.height, 1);
  none = false; // 3B kapatıldı → sonraki efekt yeniden boyutlar
  layer.burstAt(100, 100, 'hit');
  assert.ok(layer.canvas.width > 1);
  layer.destroy();
});
