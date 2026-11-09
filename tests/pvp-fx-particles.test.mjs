import test from 'node:test';
import assert from 'node:assert/strict';
import {createParticleLayer, PARTICLE_CAPS, PARTICLE_PRESETS, QUALITY_SAMPLE_FRAMES} from '../pvp/fx-particles.js';

/** Sahte 2D bağlam: tüm çizim çağrıları no-op. */
function fakeContext() {
  return new Proxy({}, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === 'createRadialGradient') return () => ({addColorStop() {}});
      return () => undefined;
    },
    set(target, key, value) { target[key] = value; return true; }
  });
}

/** Sahte DOM + elle ilerletilen requestAnimationFrame. */
function fixture({withContext = true, hidden = false} = {}) {
  const frames = new Map();
  let nextId = 0;
  const rect = (left, top, width, height) => ({left, top, width, height});
  const duel = {
    children: [],
    appendChild(n) { this.children.push(n); },
    getBoundingClientRect: () => rect(0, 0, 940, 640)
  };
  const doc = {
    hidden,
    listeners: {},
    createElement(tag) {
      return {
        tag, width: 0, height: 0, style: {}, attrs: {}, removed: false,
        setAttribute(k, v) { this.attrs[k] = v; },
        getContext: () => (withContext ? fakeContext() : null),
        remove() { this.removed = true; duel.children = duel.children.filter(c => c !== this); }
      };
    },
    addEventListener(type, fn) { this.listeners[type] = fn; },
    removeEventListener(type) { delete this.listeners[type]; }
  };
  duel.ownerDocument = doc;
  const stages = {
    1: {getBoundingClientRect: () => rect(20, 60, 400, 500)},
    2: {getBoundingClientRect: () => rect(520, 60, 400, 500)}
  };
  const root = {
    ownerDocument: doc,
    querySelector(sel) {
      if (sel === '.pvp2-duel') return duel;
      const m = /data-seat="(\d)"\] \.pvp2-stage/.exec(sel);
      return m ? stages[m[1]] : null;
    },
    querySelectorAll: () => []
  };
  let seed = 7;
  const env = {
    document: doc,
    devicePixelRatio: 2,
    random() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; },
    requestAnimationFrame(fn) { const id = ++nextId; frames.set(id, fn); return id; },
    cancelAnimationFrame(id) { frames.delete(id); }
  };
  let clock = 0;
  /** Bekleyen kareleri `ms` aralıkla çalıştırır; döngü uyuyunca durur. */
  function pump(count = 1, ms = 16) {
    for (let i = 0; i < count && frames.size; i++) {
      const [id, fn] = frames.entries().next().value;
      frames.delete(id);
      clock += ms;
      fn(clock);
    }
  }
  return {root, duel, doc, env, frames, pump};
}

test('canvas veya 2D bağlam yoksa katman sessizce no-op olur', () => {
  const none = createParticleLayer({});
  assert.equal(none.available, false);
  assert.equal(none.handle({type: 'SKILL_CAST', skill: 'q', fromSeat: 1}), 0);
  assert.equal(none.burstAt(10, 10, 'hit'), 0);
  assert.doesNotThrow(() => { none.resize(); none.setQuality('low'); none.clear(); none.destroy(); });

  const f = fixture({withContext: false});
  const layer = createParticleLayer({root: f.root, env: f.env});
  assert.equal(layer.available, false);
  assert.equal(f.duel.children.length, 0);
  assert.equal(layer.handle({type: 'DAMAGE_APPLIED', toSeat: 2, amount: 100}), 0);

  // requestAnimationFrame olmayan ortam (çıplak node)
  const g = fixture();
  const bare = createParticleLayer({root: g.root, env: {document: g.doc}});
  assert.equal(bare.available, false);
  assert.equal(g.duel.children.length, 0);
});

test('tek canvas arenaya eklenir, DPR ile boyutlanır ve tüm presetler çalışır', () => {
  const f = fixture();
  const layer = createParticleLayer({root: f.root, env: f.env});
  assert.equal(layer.available, true);
  assert.equal(f.duel.children.length, 1);
  const canvas = f.duel.children[0];
  assert.equal(canvas.className, 'pvp24-particles');
  assert.equal(canvas.style.pointerEvents, 'none');
  // Backing store ilk efekte kadar 1×1 (3B modda hiç ayrılmaz).
  assert.equal(canvas.width, 1);
  layer.burstAt(300, 200, 'hit');
  // DPR 2 isteniyor ama backing store mutlak bütçeyle (≤ ~1 MP) sınırlı: yakınlaştırma GPU işini katlamaz.
  assert.ok(canvas.width > 940 && canvas.width < 940 * 2, `width ${canvas.width}`);
  assert.ok(canvas.width * canvas.height <= 1.0e6, `backing ${canvas.width}x${canvas.height}`);
  assert.equal(canvas.style.width, '940px');
  for (const name of PARTICLE_PRESETS) {
    layer.clear();
    assert.ok(layer.burstAt(300, 200, name, {tx: 700, ty: 300, character: 'rune', amount: 200}) > 0, name);
  }
  f.pump(5, 16); // çizim yolu hata vermeden çalışır
  layer.destroy();
});

test('sunucu savaş olayları parçacık üretir ve havuz üst sınırı aşılmaz', () => {
  const f = fixture();
  const layer = createParticleLayer({root: f.root, env: f.env});
  const events = [
    {type: 'SKILL_CAST', fromSeat: 1, toSeat: 2, skill: 'q', character: 'fire'},
    {type: 'SKILL_CAST', fromSeat: 2, toSeat: 1, skill: 'r', character: 'rune'},
    {type: 'DAMAGE_APPLIED', fromSeat: 1, toSeat: 2, amount: 105, blocked: false},
    {type: 'DAMAGE_APPLIED', fromSeat: 2, toSeat: 1, amount: 185, blocked: false, hpAfter: 0},
    {type: 'DAMAGE_APPLIED', fromSeat: 1, toSeat: 2, amount: 0, blocked: true, blockKind: 'BLOCK'},
    {type: 'SHIELD_TRIGGERED', seat: 2, kind: 'PERFECT_BLOCK'},
    {type: 'PARRY_TRIGGERED', seat: 1},
    {type: 'COUNTERATTACK_CAST', fromSeat: 1, toSeat: 2},
    {type: 'SHIELD_BROKEN', seat: 2},
    {type: 'ULTIMATE_PHASE', fromSeat: 1, toSeat: 2, character: 'fire', phase: 1},
    {type: 'ULTIMATE_PHASE', fromSeat: 1, toSeat: 2, character: 'fire', phase: 2},
    {type: 'ULTIMATE_PHASE', fromSeat: 1, toSeat: 2, character: 'fire', phase: 3}
  ];
  for (const e of events.slice(0, 4)) assert.ok(layer.handle(e) > 0, e.type);
  assert.equal(layer.handle({type: 'MATCH_PAUSED'}), 0);
  assert.equal(layer.handle(null), 0);
  for (let i = 0; i < 20; i++) for (const e of events) layer.handle(e);
  assert.equal(layer.stats().alive, PARTICLE_CAPS.high);
  assert.ok(layer.stats().alive <= layer.stats().cap);
  layer.destroy();
});

test('yavaş kareler ortalaması kaliteyi düşürür ve bütçeyi yarıya indirir', () => {
  const f = fixture();
  const layer = createParticleLayer({root: f.root, env: f.env});
  assert.equal(layer.stats().quality, 'high');
  // Uzun ömürlü korlar: döngü ölçüm penceresi boyunca canlı kalır.
  for (let i = 0; i < 6; i++) layer.burstAt(400, 300, 'knockout', {character: 'fire'});
  assert.ok(layer.stats().alive > PARTICLE_CAPS.low);
  f.pump(QUALITY_SAMPLE_FRAMES + 2, 30); // ~33 fps
  const s = layer.stats();
  assert.equal(s.quality, 'low');
  assert.equal(s.cap, PARTICLE_CAPS.low);
  assert.ok(s.alive <= PARTICLE_CAPS.low);
  assert.equal(layer.canvas.width, 940, 'düşük kalitede DPR 1');

  // Hızlı karelerde düşüş olmaz.
  const g = fixture();
  const fast = createParticleLayer({root: g.root, env: g.env});
  for (let i = 0; i < 4; i++) fast.burstAt(400, 300, 'knockout');
  g.pump(QUALITY_SAMPLE_FRAMES + 2, 16);
  assert.equal(fast.stats().quality, 'high');

  // Elle sabitlenen kalite otomatik ölçümü kapatır.
  fast.setQuality('high');
  fast.burstAt(400, 300, 'knockout');
  g.pump(QUALITY_SAMPLE_FRAMES + 2, 40);
  assert.equal(fast.stats().quality, 'high');
  fast.setQuality('low');
  assert.equal(fast.stats().cap, PARTICLE_CAPS.low);
  layer.destroy();
  fast.destroy();
});

test('azaltılmış hareket ve gizli sekmede parçacık üretilmez', () => {
  const f = fixture();
  let reduced = true;
  const layer = createParticleLayer({root: f.root, env: f.env, isReduced: () => reduced});
  assert.equal(layer.handle({type: 'SKILL_CAST', fromSeat: 1, toSeat: 2, skill: 'r'}), 0);
  assert.equal(layer.burstAt(10, 10, 'parry'), 0);
  assert.equal(layer.stats().alive, 0);
  assert.equal(f.frames.size, 0);
  reduced = false;
  assert.ok(layer.burstAt(10, 10, 'parry') > 0);
  layer.destroy();

  const h = fixture({hidden: true});
  const hiddenLayer = createParticleLayer({root: h.root, env: h.env});
  assert.equal(hiddenLayer.burstAt(10, 10, 'hit'), 0);
  assert.equal(h.frames.size, 0);
  hiddenLayer.destroy();
});

test('döngü parçacık bitince uyur, yeni efektle uyanır; gizlenince durur', () => {
  const f = fixture();
  const layer = createParticleLayer({root: f.root, env: f.env});
  assert.equal(f.frames.size, 0, 'boşta kare istenmez');
  layer.burstAt(200, 200, 'hit', {amount: 100});
  assert.equal(f.frames.size, 1, 'tek rAF döngüsü');
  layer.burstAt(200, 200, 'parry');
  assert.equal(f.frames.size, 1, 'ikinci efekt ikinci döngü açmaz');
  f.pump(400, 16);
  assert.equal(layer.stats().alive, 0);
  assert.equal(layer.stats().running, false);
  assert.equal(f.frames.size, 0);
  const pooled = layer.stats().pooled;
  assert.ok(pooled > 0, 'nesneler havuza döner');

  layer.burstAt(200, 200, 'block');
  assert.ok(layer.stats().pooled < pooled, 'havuzdaki nesneler yeniden kullanılır');
  assert.equal(f.frames.size, 1);

  f.doc.hidden = true;
  f.doc.listeners.visibilitychange();
  assert.equal(f.frames.size, 0, 'gizli sekmede döngü durur');
  f.doc.hidden = false;
  f.doc.listeners.visibilitychange();
  assert.equal(f.frames.size, 1, 'görünür olunca devam eder');
  layer.clear();
  assert.equal(layer.stats().alive, 0);
  assert.equal(f.frames.size, 0);
  layer.destroy();
});

test('destroy canvası kaldırır, dinleyicileri söker ve sonraki çağrıları yok sayar', () => {
  const f = fixture();
  let observed = 0;
  let disconnected = 0;
  f.env.ResizeObserver = class {
    observe() { observed++; }
    disconnect() { disconnected++; }
  };
  const layer = createParticleLayer({root: f.root, env: f.env});
  assert.equal(observed, 1);
  layer.burstAt(100, 100, 'shatter');
  const canvas = f.duel.children[0];
  layer.destroy();
  assert.equal(canvas.removed, true);
  assert.equal(f.duel.children.length, 0);
  assert.equal(disconnected, 1);
  assert.equal(f.doc.listeners.visibilitychange, undefined);
  assert.equal(f.frames.size, 0);
  assert.equal(layer.handle({type: 'SHIELD_BROKEN', seat: 1}), 0);
  assert.equal(layer.burstAt(1, 1, 'hit'), 0);
  assert.doesNotThrow(() => layer.destroy());
});
