/**
 * TuşLab Neon Arena — canvas parçacık efektleri katmanı (Paket 24).
 *
 * Tamamen kozmetiktir: HP'ye, sunucu durumuna veya oyun kurallarına dokunmaz.
 * Mevcut DOM efektlerini (projectiles.js, combat-fx.js) tamamlar; onların yerine geçmez.
 *
 * Tasarım ilkeleri:
 *  - Arenanın tamamını kaplayan TEK bir <canvas> (pointer-events:none).
 *  - TEK bir requestAnimationFrame döngüsü; canlı parçacık yoksa uyur (boşta CPU yok).
 *  - Havuzlanmış parçacık nesneleri: kare başına hiçbir nesne oluşturulmaz.
 *  - 'lighter' (additive) karışım ile ucuz parıltı; parıltı sprite'ları bir kez önceden çizilir.
 *  - Otomatik kalite: ortalama kare süresi ~20ms'yi aşarsa bütçe yarıya iner.
 *  - Canvas / 2D bağlam yoksa (node testleri, eski tarayıcı) sessizce no-op olur.
 *
 * Kullanım:
 *   const fx = createParticleLayer({root, isReduced: () => reducedEffects});
 *   fx.handle(combatEvent);   // SKILL_CAST, DAMAGE_APPLIED, ULTIMATE_PHASE ...
 *   fx.destroy();             // PvP kapanırken
 */

import {budgetRatio, PIXEL_BUDGETS} from './perf-governor.js';

// ---------------------------------------------------------------------------
// Sabitler
// ---------------------------------------------------------------------------

/** Kalite seviyesine göre toplam canlı parçacık üst sınırı. */
export const PARTICLE_CAPS = Object.freeze({high: 600, low: 250});

/** Kalite seviyesine göre her efektteki parçacık sayısı çarpanı. */
const COUNT_SCALE = Object.freeze({high: 1, low: 0.5});

/** Otomatik kalite: bu kadar karelik pencerenin ortalaması ölçülür. */
export const QUALITY_SAMPLE_FRAMES = 30;
/** Otomatik kalite: ortalama kare süresi bunu aşarsa düşük kaliteye geçilir (ms). */
export const SLOW_FRAME_MS = 20;

/** Simülasyon adımı en fazla bu kadar olabilir (sekme değişimi sonrası sıçramayı önler). */
const MAX_STEP_S = 0.05;
/** Bundan uzun kare aralıkları (ör. arka plandan dönüş) ölçüme katılmaz. */
const IGNORE_FRAME_MS = 250;

// Parçacık şekilleri (sayısal: çizimde hızlı switch).
const GLOW = 0;   // önceden çizilmiş yumuşak parıltı sprite'ı
const STREAK = 1; // hız yönünde uzayan kıvılcım / alev izi
const SHARD = 2;  // dönen üçgen kristal / cam parçası
const RING = 3;   // genişleyen halka (kalkan, şok dalgası)
const GLYPH = 4;  // dönen altıgen rün mührü

// Renk paletleri. İlk renkler daha parlak (çekirdek), sonrakiler daha koyu.
const PALETTES = Object.freeze({
  fire: ['#fff3c4', '#ffd166', '#ffa23a', '#ff6a1f', '#e8361e'],
  fireDeep: ['#ff8a3d', '#ff5a1f', '#d9261c', '#a3170f'],
  rune: ['#f3eaff', '#c9a2ff', '#9b6bff', '#7c4dff', '#67e8f9'],
  runeCyan: ['#e0fbff', '#a5f3fc', '#5ee3f5', '#22d3ee'],
  shield: ['#f0fdff', '#a5f3fc', '#5ee3f5', '#22d3ee'],
  gold: ['#ffffff', '#fff6d5', '#ffe08a', '#ffc53d'],
  glass: ['#ffffff', '#e0f2fe', '#bae6fd', '#c4b5fd', '#a5f3fc'],
  white: ['#ffffff', '#f8fafc']
});

/** Karakter adı → ana palet / ikincil palet. */
function paletteFor(character) {
  return character === 'rune'
    ? {main: PALETTES.rune, alt: PALETTES.runeCyan}
    : {main: PALETTES.fire, alt: PALETTES.fireDeep};
}

/** Koltuk numarası → karakter (1 = ateş solda, 2 = rün sağda). */
function characterOfSeat(seat) {
  return Number(seat) === 2 ? 'rune' : 'fire';
}

/** Canvas yokken veya hata durumunda dönen, hiçbir şey yapmayan API. */
function createNoopLayer() {
  return {
    available: false,
    handle: () => 0,
    burstAt: () => 0,
    resize() {},
    setQuality() {},
    clear() {},
    destroy() {},
    stats: () => ({alive: 0, cap: 0, quality: 'off', running: false, pooled: 0, available: false})
  };
}

// ---------------------------------------------------------------------------
// Fabrika
// ---------------------------------------------------------------------------

/**
 * @param {object} options
 * @param {Element} options.root          PvP kök elemanı (#pvp-root).
 * @param {() => boolean} [options.isReduced]  true ise hiçbir parçacık üretilmez.
 * @param {object} [options.env]          Test/enjeksiyon için ortam (requestAnimationFrame,
 *        cancelAnimationFrame, document, ResizeObserver, devicePixelRatio, random,
 *        addEventListener/removeEventListener). Varsayılan: globalThis.
 */
export function createParticleLayer({root, isReduced = () => false, env = globalThis} = {}) {
  try {
    return buildLayer(root, isReduced, env || globalThis);
  } catch {
    // Kozmetik bir katman asla oyunu kırmamalı.
    return createNoopLayer();
  }
}

function buildLayer(root, isReduced, env) {
  if (!root || typeof root.querySelector !== 'function') return createNoopLayer();

  const doc = root.ownerDocument || env.document;
  const raf = typeof env.requestAnimationFrame === 'function' ? env.requestAnimationFrame.bind(env) : null;
  const caf = typeof env.cancelAnimationFrame === 'function' ? env.cancelAnimationFrame.bind(env) : () => {};
  if (!doc || typeof doc.createElement !== 'function' || !raf) return createNoopLayer();

  // --- Ana kapsayıcıyı bul: iki .pvp2-side'ı da içeren arena (yoksa root) ---
  const host = findArenaHost(root);

  // --- Canvas ve 2D bağlam ---
  const canvas = doc.createElement('canvas');
  const ctx = canvas && typeof canvas.getContext === 'function'
    ? // desynchronized KULLANILMAZ: bazı Windows GPU + Chromium/Brave ikililerinde bu canvas
    // saydamlığını kaybedip arenanın tamamını siyaha boyuyordu (z-index 7, tüm .pvp2-duel).
    canvas.getContext('2d', {alpha: true})
    : null;
  if (!ctx) return createNoopLayer();

  canvas.className = 'pvp24-particles';
  canvas.setAttribute?.('aria-hidden', 'true');
  if (canvas.style) {
    // CSS dosyası yüklenmese bile katman tıklamaları engellememeli.
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.pointerEvents = 'none';
  }
  host.appendChild(canvas);

  const random = typeof env.random === 'function' ? env.random : Math.random;
  const rand = (min, max) => min + (max - min) * random();
  const pick = list => list[(random() * list.length) | 0];

  // --- Durum ---
  let destroyed = false;
  let rafId = 0;
  let lastTs = null;
  let width = 0;   // CSS piksel
  let height = 0;
  let dpr = 1;
  let quality = 'high';
  let autoQuality = true;
  let sampleSum = 0;
  let sampleCount = 0;
  let canvasDirty = false;
  let sizedHidden = false;
  let activated = false;
  let idleHidden = false;

  /** Canlı parçacıklar (sıra önemsiz; silme swap-pop ile O(1)). */
  const alive = [];
  /** Kullanılmayan parçacık nesneleri. */
  const free = [];
  /** Renk → önceden çizilmiş parıltı sprite'ı. */
  const sprites = new Map();

  const cap = () => PARTICLE_CAPS[quality];
  const scaleCount = n => Math.max(1, Math.round(n * COUNT_SCALE[quality]));
  const isHidden = () => Boolean(doc.hidden);

  // -------------------------------------------------------------------------
  // Parıltı sprite'ları (renk başına bir kez; çizimde yalnızca drawImage)
  // -------------------------------------------------------------------------
  function spriteFor(color) {
    let sprite = sprites.get(color);
    if (sprite !== undefined) return sprite;
    sprite = null;
    try {
      const size = 64;
      const c = doc.createElement('canvas');
      c.width = size;
      c.height = size;
      const g = c.getContext && c.getContext('2d');
      if (g && typeof g.createRadialGradient === 'function') {
        const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.22, color);
        grad.addColorStop(0.55, color + '55');
        grad.addColorStop(1, color + '00');
        g.fillStyle = grad;
        g.fillRect(0, 0, size, size);
        sprite = c;
      }
    } catch {
      sprite = null; // drawImage yerine arc ile çizilir
    }
    sprites.set(color, sprite);
    return sprite;
  }

  // -------------------------------------------------------------------------
  // Havuz
  // -------------------------------------------------------------------------

  /**
   * Havuzdan bir parçacık alır ve temel alanları doldurur. Bütçe doluysa null.
   * Diğer alanlar (g, drag, delay, rot...) çağıran tarafından ayarlanır.
   */
  function spawn(x, y, vx, vy, life, size0, size1, color, shape) {
    if (alive.length >= cap()) return null;
    const p = free.pop() || {};
    p.x = x; p.y = y; p.vx = vx; p.vy = vy;
    p.t = 0; p.life = life;
    p.size0 = size0; p.size1 = size1;
    p.color = color; p.shape = shape;
    p.sprite = shape === GLOW ? spriteFor(color) : null;
    p.alpha = 1;       // başlangıç opaklığı
    p.g = 0;           // dikey ivme (px/s²); negatif = yükselir (kor)
    p.drag = 0;        // hız sönümü (1/s)
    p.delay = 0;       // görünmeden önce bekleme (s) — "akış" efekti için
    p.rot = 0; p.vr = 0;
    p.width = 1.5;     // çizgi kalınlığı (STREAK, RING, GLYPH)
    p.stretch = 0.035; // STREAK uzunluğu = hız * stretch
    p.flicker = 0;     // 0..1 titreme (kor efekti)
    p.seed = random() * 6.283;
    alive.push(p);
    return p;
  }

  function release(index) {
    const p = alive[index];
    const last = alive.pop();
    if (index < alive.length) alive[index] = last;
    p.sprite = null;
    free.push(p);
  }

  // -------------------------------------------------------------------------
  // Boyut ve konum
  // -------------------------------------------------------------------------

  /** CSS ile gizli mi (3B modda `.pvp24-particles{display:none}`)? */
  function cssHidden() {
    try {
      if (typeof env.getComputedStyle !== 'function' || !canvas.isConnected) return false;
      return env.getComputedStyle(canvas).display === 'none';
    } catch {
      return false;
    }
  }

  function resize() {
    if (destroyed) return;
    const rect = safeRect(host);
    width = Math.max(1, rect.width || host.clientWidth || 1);
    height = Math.max(1, rect.height || host.clientHeight || 1);
    if (canvas.style) {
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
    }
    // İlk efekte kadar ve gizliyken (3B arena açık) backing store 1×1 kalır:
    // ~1-4 MP boşa GPU belleği yok. İlk efektte ensureRunning() gerçek boyuta getirir.
    // (3B arena sonradan async açıldığı için CSS kontrolü tek başına yetmez.)
    if (!activated || cssHidden()) {
      sizedHidden = true;
      dpr = 1;
      if (canvas.width !== 1) canvas.width = 1;
      if (canvas.height !== 1) canvas.height = 1;
      return;
    }
    sizedHidden = false;
    // Oran dpr'yi izler (uzaklaştırmada 1'in altına da iner) ve MUTLAK piksel
    // bütçesiyle sınırlıdır: tarayıcı %80'e alınınca GPU işi katlanmaz.
    const deviceRatio = Number(env.devicePixelRatio) || 1;
    dpr = quality === 'low'
      ? budgetRatio(width, height, deviceRatio, {maxRatio: 1, budget: PIXEL_BUDGETS.particlesLow})
      : budgetRatio(width, height, deviceRatio, {maxRatio: 2, budget: PIXEL_BUDGETS.particlesHigh});
    const nextW = Math.max(1, Math.round(width * dpr));
    const nextH = Math.max(1, Math.round(height * dpr));
    // Aynı boyuta yeniden atama bile canvas'ı sıfırlar; yalnızca değişince ata.
    if (canvas.width !== nextW) canvas.width = nextW;
    if (canvas.height !== nextH) canvas.height = nextH;
  }

  let observer = null;
  let onWindowResize = null;
  if (typeof env.ResizeObserver === 'function') {
    observer = new env.ResizeObserver(() => resize());
    observer.observe(host);
  } else if (typeof env.addEventListener === 'function') {
    onWindowResize = () => resize();
    env.addEventListener('resize', onWindowResize);
  }

  // Sekme gizlenince döngüyü durdur; geri gelince devam et.
  const onVisibility = () => {
    if (isHidden()) stopLoop();
    else ensureRunning();
  };
  doc.addEventListener?.('visibilitychange', onVisibility);

  resize();
  setIdleHidden(true);

  /**
   * Bir koltuğun sahne merkezini canvas koordinatında döndürür.
   * Sahne bulunamazsa düzene göre makul bir tahmin kullanılır.
   */
  function stagePoint(seat) {
    const s = Number(seat) === 2 ? 2 : 1;
    const stage = root.querySelector(`.pvp2-side[data-seat="${s}"] .pvp2-stage`)
      || root.querySelector(`.pvp2-side[data-seat="${s}"]`);
    const base = safeRect(host);
    if (stage) {
      const r = safeRect(stage);
      if (r.width > 0 && r.height > 0) {
        return {
          x: r.left - base.left + r.width / 2,
          y: r.top - base.top + r.height * 0.52,
          w: r.width,
          h: r.height
        };
      }
    }
    return {x: width * (s === 1 ? 0.25 : 0.75), y: height * 0.45, w: width * 0.4, h: height * 0.5};
  }

  // -------------------------------------------------------------------------
  // Döngü
  // -------------------------------------------------------------------------

  /**
   * Uyurken canvas görünmez yapılır: boş ama tüm düelloyu kaplayan saydam bir
   * katmanı her karede birleştirmek (compositing) zayıf GPU'da boşa doldurma maliyetidir.
   */
  function setIdleHidden(on) {
    if (idleHidden === on || !canvas.style) return;
    idleHidden = on;
    canvas.style.visibility = on ? 'hidden' : '';
  }

  function ensureRunning() {
    if (destroyed || rafId || alive.length === 0 || isHidden()) return;
    activated = true;
    if (sizedHidden) resize();
    setIdleHidden(false);
    lastTs = null;
    rafId = raf(frame);
  }

  function stopLoop() {
    if (rafId) caf(rafId);
    rafId = 0;
    lastTs = null;
  }

  function frame(ts) {
    rafId = 0;
    if (destroyed) return;
    if (isHidden()) { lastTs = null; return; }

    const now = typeof ts === 'number' ? ts : Date.now();
    const firstFrame = lastTs === null;
    const elapsedMs = firstFrame ? 16.7 : now - lastTs;
    lastTs = now;
    if (!firstFrame) measure(elapsedMs); // uykudan sonraki ilk kare ölçülmez

    const dt = Math.min(MAX_STEP_S, Math.max(0, elapsedMs / 1000));
    update(dt);
    draw();

    if (alive.length > 0) rafId = raf(frame);
    else { lastTs = null; setIdleHidden(true); } // uyku: bir sonraki efekte kadar hiç kare istenmez
  }

  /** Otomatik kalite: kare süresi ortalamasını izler, yavaşsa bütçeyi yarıya indirir. */
  function measure(ms) {
    if (!autoQuality || quality === 'low' || ms > IGNORE_FRAME_MS || ms <= 0) return;
    sampleSum += ms;
    sampleCount += 1;
    if (sampleCount < QUALITY_SAMPLE_FRAMES) return;
    const average = sampleSum / sampleCount;
    sampleSum = 0;
    sampleCount = 0;
    if (average > SLOW_FRAME_MS) applyQuality('low');
  }

  function update(dt) {
    for (let i = alive.length - 1; i >= 0; i--) {
      const p = alive[i];
      if (p.delay > 0) { p.delay -= dt; continue; }
      p.t += dt;
      if (p.t >= p.life) { release(i); continue; }
      if (p.drag > 0) {
        const k = 1 / (1 + p.drag * dt);
        p.vx *= k;
        p.vy *= k;
      }
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    if (alive.length === 0) { canvasDirty = false; return; }
    canvasDirty = true;
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';

    for (let i = 0; i < alive.length; i++) {
      const p = alive[i];
      if (p.delay > 0) continue;
      const k = p.t / p.life;                  // 0 → 1 yaşam oranı
      const size = p.size0 + (p.size1 - p.size0) * k;
      let a = p.alpha * (1 - k * k);           // sona doğru hızlanan sönme
      if (p.flicker > 0) a *= 1 - p.flicker * (0.5 + 0.5 * Math.sin(p.t * 38 + p.seed));
      if (a <= 0.01 || size <= 0) continue;
      ctx.globalAlpha = a > 1 ? 1 : a;

      switch (p.shape) {
        case GLOW:
          if (p.sprite) ctx.drawImage(p.sprite, p.x - size, p.y - size, size * 2, size * 2);
          else { ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, size * 0.5, 0, 6.283); ctx.fill(); }
          break;
        case STREAK:
          ctx.strokeStyle = p.color;
          ctx.lineWidth = size;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * p.stretch, p.y - p.vy * p.stretch);
          ctx.stroke();
          break;
        case SHARD: {
          // Dönen ince üçgen: kristal / cam kırığı.
          const c = Math.cos(p.rot), s = Math.sin(p.rot);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.moveTo(p.x + c * size, p.y + s * size);
          ctx.lineTo(p.x - c * size * 0.6 - s * size * 0.45, p.y - s * size * 0.6 + c * size * 0.45);
          ctx.lineTo(p.x - c * size * 0.4 + s * size * 0.35, p.y - s * size * 0.4 - c * size * 0.35);
          ctx.closePath();
          ctx.fill();
          break;
        }
        case RING:
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.width * (1 - k * 0.7);
          ctx.beginPath();
          ctx.arc(p.x, p.y, size, 0, 6.283);
          ctx.stroke();
          break;
        case GLYPH: {
          // Dönen altıgen mühür + içte ikinci küçük altıgen.
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.width;
          ctx.beginPath();
          for (let j = 0; j <= 6; j++) {
            const ang = p.rot + j * 1.0472;
            const px = p.x + Math.cos(ang) * size, py = p.y + Math.sin(ang) * size;
            if (j === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          for (let j = 0; j <= 6; j++) {
            const ang = -p.rot * 1.5 + j * 1.0472 + 0.5236;
            const px = p.x + Math.cos(ang) * size * 0.55, py = p.y + Math.sin(ang) * size * 0.55;
            if (j === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.stroke();
          break;
        }
        default:
          break;
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // -------------------------------------------------------------------------
  // Efekt yapı taşları
  // -------------------------------------------------------------------------

  /** Merkezden dışa saçılan kıvılcımlar. angle/spread radyan. */
  function radialSparks(x, y, n, palette, {speed = [180, 480], life = [0.3, 0.65], size = [1.4, 2.6],
    g = 420, drag = 2.6, angle = 0, spread = Math.PI * 2, stretch = 0.035} = {}) {
    for (let i = 0; i < n; i++) {
      const a = angle + (random() - 0.5) * spread;
      const v = rand(speed[0], speed[1]);
      const p = spawn(x, y, Math.cos(a) * v, Math.sin(a) * v, rand(life[0], life[1]),
        rand(size[0], size[1]), 0.3, pick(palette), STREAK);
      if (!p) return;
      p.g = g; p.drag = drag; p.stretch = stretch;
    }
  }

  /** Yumuşak parıltı tozları (kor, kristal tozu). */
  function glowDust(x, y, n, palette, {radius = 14, speed = [30, 140], life = [0.35, 0.8], size = [3, 7],
    g = 0, drag = 1.6, flicker = 0, delay = 0} = {}) {
    for (let i = 0; i < n; i++) {
      const a = random() * 6.283;
      const v = rand(speed[0], speed[1]);
      const r = random() * radius;
      const p = spawn(x + Math.cos(a) * r, y + Math.sin(a) * r, Math.cos(a) * v, Math.sin(a) * v,
        rand(life[0], life[1]), rand(size[0], size[1]), 0.5, pick(palette), GLOW);
      if (!p) return;
      p.g = g; p.drag = drag; p.flicker = flicker; p.delay = delay ? random() * delay : 0;
    }
  }

  /** Tek büyük parlama (darbe anı). */
  function flash(x, y, size, color, life = 0.18) {
    const p = spawn(x, y, 0, 0, life, size, size * 0.35, color, GLOW);
    if (p) p.alpha = 0.95;
  }

  /** Genişleyen halka. */
  function ring(x, y, r0, r1, color, life = 0.45, width = 3, delay = 0) {
    const p = spawn(x, y, 0, 0, life, r0, r1, color, RING);
    if (p) { p.width = width; p.delay = delay; p.alpha = 0.9; }
  }

  /** Dönen rün mührü. */
  function glyph(x, y, r0, r1, color, life = 0.6, delay = 0) {
    const p = spawn(x, y, 0, 0, life, r0, r1, color, GLYPH);
    if (p) { p.width = 1.6; p.delay = delay; p.vr = random() < 0.5 ? -3 : 3; p.rot = random() * 6.283; p.alpha = 0.85; }
  }

  // -------------------------------------------------------------------------
  // Presetler — hepsi canvas CSS piksel koordinatlarında çalışır.
  // opts: {tx, ty} hedef nokta, character, amount, skill, scale
  // -------------------------------------------------------------------------

  const presets = {
    /** Alev Celladı yeteneği: saldırgandan savunana kor akışı + alev izleri. */
    'fire-cast'(x, y, o) {
      const skill = o.skill || 'q';
      const n = scaleCount({q: 36, e: 54, r: 80}[skill] || 36);
      const travel = skill === 'r' ? 0.55 : skill === 'e' ? 0.48 : 0.42;
      const dx = o.tx - x, dy = o.ty - y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len; // akışa dik yön
      // Ağız parlaması
      flash(x, y, skill === 'r' ? 70 : 44, '#ffb347', 0.22);
      glowDust(x, y, scaleCount(10), PALETTES.fire, {speed: [80, 180], life: [0.2, 0.35], size: [3, 6]});
      for (let i = 0; i < n; i++) {
        const side = (random() - 0.5) * 30;
        const sx = x + nx * side, sy = y + ny * side;
        const speedK = rand(0.85, 1.08);
        const wobble = (random() - 0.5) * 90;
        const isTrail = i % 3 === 0;
        const p = spawn(sx, sy, dx / travel * speedK + nx * wobble, dy / travel * speedK + ny * wobble,
          travel * rand(0.85, 1.12), isTrail ? rand(2.5, 4) : rand(3, 7), isTrail ? 0.6 : 1,
          pick(isTrail ? PALETTES.fireDeep : PALETTES.fire), isTrail ? STREAK : GLOW);
        if (!p) break;
        p.delay = (i / n) * (skill === 'r' ? 0.3 : 0.2);
        p.g = -70;                 // kor hafifçe yükselir
        p.flicker = isTrail ? 0 : 0.35;
        p.stretch = 0.05;          // daha uzun alev izi
      }
      if (skill === 'e') {
        // Yer Yaran Darbe: saldırganın ayağından yere sürünen kıvılcımlar.
        radialSparks(x, y + 40, scaleCount(14), PALETTES.fireDeep, {angle: Math.atan2(dy, dx), spread: 0.6, g: 200, speed: [260, 420]});
      }
    },

    /** Rün Muhafızı yeteneği: kristal kırıklar + mühür halkaları. */
    'rune-cast'(x, y, o) {
      const skill = o.skill || 'q';
      const n = scaleCount({q: 26, e: 40, r: 60}[skill] || 26);
      const travel = skill === 'r' ? 0.5 : 0.4;
      const dx = o.tx - x, dy = o.ty - y;
      const rings = skill === 'r' ? 3 : skill === 'e' ? 2 : 1;
      for (let i = 0; i < rings; i++) {
        glyph(x, y, 18 + i * 8, 70 + i * 22, i % 2 ? PALETTES.runeCyan[2] : PALETTES.rune[2], 0.6, i * 0.08);
        ring(x, y, 10, 90 + i * 20, PALETTES.rune[1], 0.5, 2, i * 0.08);
      }
      flash(x, y, skill === 'r' ? 64 : 40, '#b48cff', 0.2);
      for (let i = 0; i < n; i++) {
        const k = rand(0.9, 1.1);
        const p = spawn(x + (random() - 0.5) * 36, y + (random() - 0.5) * 36,
          dx / travel * k + (random() - 0.5) * 80, dy / travel * k + (random() - 0.5) * 80,
          travel * rand(0.85, 1.1), rand(4, 8), 2, pick(i % 4 === 0 ? PALETTES.runeCyan : PALETTES.rune), SHARD);
        if (!p) break;
        p.delay = (i / n) * 0.18;
        p.rot = random() * 6.283;
        p.vr = (random() - 0.5) * 14;
      }
      // Kristal kıvılcım tozu
      glowDust(x, y, scaleCount(12), PALETTES.runeCyan, {radius: 30, speed: [40, 120], size: [2, 4]});
    },

    /** Normal isabet: savunanın sahne merkezinde kıvılcımlar (hasarla ölçekli). */
    hit(x, y, o) {
      const pal = paletteFor(o.character).main;
      const n = scaleCount(clamp(Math.round((o.amount || 100) / 3.5), 14, 80));
      flash(x, y, 46, pal[1]);
      ring(x, y, 8, 62, pal[2], 0.32, 2.5);
      radialSparks(x, y, n, pal);
      glowDust(x, y, scaleCount(8), pal, {g: 120});
    },

    /** Kritik / ağır isabet: daha büyük patlama, çift halka, düşen kırıntılar. */
    crit(x, y, o) {
      const {main, alt} = paletteFor(o.character);
      const n = scaleCount(clamp(Math.round((o.amount || 180) / 2.4), 30, 110));
      flash(x, y, 96, '#ffffff', 0.22);
      flash(x, y, 70, main[1], 0.3);
      ring(x, y, 10, 110, main[1], 0.42, 4);
      ring(x, y, 6, 160, alt[0], 0.55, 2, 0.06);
      radialSparks(x, y, n, main, {speed: [260, 720], life: [0.4, 0.85], size: [1.8, 3.2]});
      glowDust(x, y, scaleCount(20), alt, {speed: [60, 240], g: 260, life: [0.6, 1.1]});
    },

    /** Blok: kıvılcımlar yukarı sapar + camgöbeği kalkan halkası. */
    block(x, y) {
      ring(x, y, 34, 88, PALETTES.shield[2], 0.42, 3.5);
      ring(x, y, 26, 70, PALETTES.shield[0], 0.32, 1.5, 0.05);
      radialSparks(x, y - 10, scaleCount(26), PALETTES.shield,
        {angle: -Math.PI / 2, spread: 1.7, speed: [220, 440], g: 620, drag: 2});
      flash(x, y, 40, PALETTES.shield[1], 0.16);
    },

    /** Parry: parlak beyaz/altın radyal yıldız. */
    parry(x, y) {
      flash(x, y, 110, '#ffffff', 0.2);
      flash(x, y, 60, PALETTES.gold[2], 0.32);
      const rays = scaleCount(14);
      for (let i = 0; i < rays; i++) {
        const a = (i / rays) * 6.283 + (random() - 0.5) * 0.12;
        const v = rand(680, 900);
        const p = spawn(x, y, Math.cos(a) * v, Math.sin(a) * v, rand(0.22, 0.32), rand(2.5, 3.6), 0.5,
          i % 2 ? '#ffffff' : PALETTES.gold[3], STREAK);
        if (!p) break;
        p.drag = 7; p.stretch = 0.06;
      }
      ring(x, y, 6, 74, PALETTES.gold[2], 0.3, 3);
      glowDust(x, y, scaleCount(14), PALETTES.gold, {radius: 20, speed: [60, 200], size: [2, 4]});
    },

    /** Mükemmel blok: altın + camgöbeği halkalar, mühür ve yörüngede parıltılar. */
    perfect(x, y) {
      ring(x, y, 20, 120, PALETTES.gold[2], 0.55, 3.5);
      ring(x, y, 14, 90, PALETTES.shield[2], 0.5, 2.5, 0.07);
      ring(x, y, 8, 150, '#ffffff', 0.6, 1.2, 0.14);
      glyph(x, y, 30, 64, PALETTES.gold[3], 0.7);
      flash(x, y, 80, '#fff6d5', 0.24);
      const n = scaleCount(24);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 6.283;
        const r = 54;
        // Teğetsel hız: halka etrafında dönen parıltılar.
        const p = spawn(x + Math.cos(a) * r, y + Math.sin(a) * r, -Math.sin(a) * 160 + Math.cos(a) * 60,
          Math.cos(a) * 160 + Math.sin(a) * 60, rand(0.45, 0.7), rand(3, 5), 0.5,
          i % 2 ? PALETTES.gold[1] : PALETTES.shield[1], GLOW);
        if (!p) break;
        p.drag = 1.5;
      }
    },

    /** Kalkan kırılması: yerçekimiyle düşen cam kırıkları. */
    shatter(x, y) {
      flash(x, y, 84, '#e0f2fe', 0.2);
      ring(x, y, 40, 110, PALETTES.shield[1], 0.3, 4);
      const n = scaleCount(46);
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (random() - 0.5) * 4.4; // çoğunlukla yukarı/yanlara
        const v = rand(140, 400);
        const r = rand(20, 46);
        const p = spawn(x + Math.cos(a) * r, y + Math.sin(a) * r, Math.cos(a) * v, Math.sin(a) * v,
          rand(0.8, 1.25), rand(5, 11), rand(3, 6), pick(PALETTES.glass), SHARD);
        if (!p) break;
        p.g = 900; p.drag = 0.8; p.rot = random() * 6.283; p.vr = (random() - 0.5) * 22; p.alpha = 0.9;
      }
      glowDust(x, y, scaleCount(16), PALETTES.glass, {radius: 40, speed: [20, 90], size: [1.5, 3], g: 160});
    },

    /** Karşı saldırı: altın şimşek çizgileri hedefe fırlar. */
    counter(x, y, o) {
      const dx = o.tx - x, dy = o.ty - y;
      const travel = 0.26;
      flash(x, y, 50, PALETTES.gold[2], 0.18);
      const n = scaleCount(22);
      for (let i = 0; i < n; i++) {
        const k = rand(0.9, 1.15);
        const p = spawn(x, y, dx / travel * k + (random() - 0.5) * 140, dy / travel * k + (random() - 0.5) * 140,
          travel * rand(0.9, 1.1), rand(2, 3.4), 0.8, i % 3 ? PALETTES.gold[2] : '#ffffff', STREAK);
        if (!p) break;
        p.delay = (i / n) * 0.12; p.stretch = 0.045;
      }
      radialSparks(x, y, scaleCount(10), PALETTES.gold, {speed: [200, 380], life: [0.2, 0.35], g: 0, drag: 4});
    },

    /** Ulti faz 1: saldırganın etrafında içe çöken enerji. */
    'ultimate-charge'(x, y, o) {
      const {main, alt} = paletteFor(o.character);
      const n = scaleCount(44);
      for (let i = 0; i < n; i++) {
        const a = random() * 6.283;
        const r = rand(90, 150);
        const life = rand(0.4, 0.6);
        const p = spawn(x + Math.cos(a) * r, y + Math.sin(a) * r, -Math.cos(a) * r / life, -Math.sin(a) * r / life,
          life, rand(2, 5), 6, pick(i % 3 ? main : alt), GLOW);
        if (!p) break;
        p.delay = random() * 0.15;
      }
      ring(x, y, 140, 12, main[2], 0.55, 2.5);
      if (o.character === 'rune') glyph(x, y, 80, 30, alt[2], 0.6);
      flash(x, y, 60, main[1], 0.5);
    },

    /** Ulti faz 3: dev radyal patlama + uzun süre süzülen korlar. */
    'ultimate-final'(x, y, o) {
      const {main, alt} = paletteFor(o.character);
      flash(x, y, 180, '#ffffff', 0.28);
      flash(x, y, 130, main[1], 0.45);
      ring(x, y, 12, 220, main[1], 0.55, 6);
      ring(x, y, 8, 290, alt[0], 0.7, 3, 0.08);
      ring(x, y, 4, 340, '#ffffff', 0.8, 1.5, 0.16);
      if (o.character === 'rune') glyph(x, y, 40, 160, alt[2], 0.9);
      radialSparks(x, y, scaleCount(110), main, {speed: [260, 920], life: [0.5, 1], size: [2, 3.6], g: 300, drag: 2.2});
      // Uzun süre kalan, yavaşça yükselen korlar / kristal toz.
      glowDust(x, y, scaleCount(60), o.character === 'rune' ? PALETTES.rune : PALETTES.fire,
        {radius: 90, speed: [20, 90], life: [1.6, 2.6], size: [2.5, 6], g: -24, drag: 1.2, flicker: 0.4, delay: 0.4});
    },

    /** Nakavt: en büyük patlama + ağır ağır düşen kıvılcım yağmuru. */
    knockout(x, y, o) {
      presets['ultimate-final'](x, y, o);
      const {main} = paletteFor(o.character);
      glowDust(x, y - 60, scaleCount(50), main,
        {radius: 160, speed: [10, 60], life: [2, 3.2], size: [2, 5], g: 40, drag: 0.8, flicker: 0.5, delay: 0.8});
    }
  };

  /** Bir preset'i çalıştırır ve üretilen parçacık sayısını döndürür. */
  function runPreset(name, x, y, opts = {}) {
    if (destroyed || isReduced() || isHidden()) return 0;
    const fn = presets[name];
    if (!fn) return 0;
    const before = alive.length;
    const o = {tx: x, ty: y, character: 'fire', ...opts};
    fn(x, y, o);
    const made = alive.length - before;
    if (made > 0) ensureRunning();
    return made;
  }

  // -------------------------------------------------------------------------
  // Sunucu savaş olayları → presetler
  // -------------------------------------------------------------------------

  function handle(event) {
    if (destroyed || !event || typeof event !== 'object') return 0;
    if (isReduced() || isHidden()) return 0;
    const type = event.type;

    if (type === 'SKILL_CAST') {
      if (!['q', 'e', 'r'].includes(event.skill)) return 0;
      const from = stagePoint(event.fromSeat);
      const to = stagePoint(event.toSeat ?? (Number(event.fromSeat) === 2 ? 1 : 2));
      const character = event.character === 'rune' || event.character === 'fire'
        ? event.character : characterOfSeat(event.fromSeat);
      return runPreset(character === 'rune' ? 'rune-cast' : 'fire-cast', from.x, from.y,
        {tx: to.x, ty: to.y, skill: event.skill, character});
    }

    if (type === 'DAMAGE_APPLIED') {
      const at = stagePoint(event.toSeat);
      const character = characterOfSeat(event.fromSeat);
      if (event.blocked) {
        // PARRY / PERFECT_BLOCK'un büyük efektlerini kendi olayları (PARRY_TRIGGERED,
        // SHIELD_TRIGGERED) çizer; burada her blokta yalnız sapan kıvılcım + kalkan halkası var.
        return runPreset('block', at.x, at.y, {character});
      }
      let made = 0;
      const amount = Number(event.amount) || 0;
      const heavy = amount >= 170 || event.counter || event.shieldBreak || event.phase === 3;
      made += runPreset(heavy ? 'crit' : 'hit', at.x, at.y, {amount, character});
      if (event.hpAfter === 0) made += runPreset('knockout', at.x, at.y, {character});
      return made;
    }

    if (type === 'ULTIMATE_PHASE') {
      const character = event.character === 'rune' ? 'rune' : event.character === 'fire' ? 'fire' : characterOfSeat(event.fromSeat);
      const fromSeat = event.fromSeat ?? (character === 'rune' ? 2 : 1);
      const from = stagePoint(fromSeat);
      const to = stagePoint(event.toSeat ?? (Number(fromSeat) === 2 ? 1 : 2));
      const phase = Number(event.phase) || 1;
      if (phase === 1) return runPreset('ultimate-charge', from.x, from.y, {character});
      if (phase === 2) {
        return runPreset(character === 'rune' ? 'rune-cast' : 'fire-cast', from.x, from.y,
          {tx: to.x, ty: to.y, skill: 'e', character});
      }
      return runPreset('ultimate-final', to.x, to.y, {character});
    }

    if (type === 'SHIELD_TRIGGERED') {
      const at = stagePoint(event.seat);
      return runPreset(event.kind === 'PERFECT_BLOCK' ? 'perfect' : 'block', at.x, at.y,
        {character: characterOfSeat(event.seat)});
    }

    if (type === 'PARRY_TRIGGERED') {
      const at = stagePoint(event.seat);
      return runPreset('parry', at.x, at.y, {character: characterOfSeat(event.seat)});
    }

    if (type === 'COUNTERATTACK_CAST') {
      const from = stagePoint(event.fromSeat);
      const to = stagePoint(event.toSeat ?? (Number(event.fromSeat) === 2 ? 1 : 2));
      return runPreset('counter', from.x, from.y, {tx: to.x, ty: to.y, character: characterOfSeat(event.fromSeat)});
    }

    if (type === 'SHIELD_BROKEN') {
      const at = stagePoint(event.seat);
      return runPreset('shatter', at.x, at.y, {character: characterOfSeat(event.seat)});
    }

    if (type === 'KNOCKOUT') {
      // İstemci tarafı yardımcı olay: {type:'KNOCKOUT', seat: yenilen koltuk, winnerSeat?}
      const at = stagePoint(event.seat);
      const winner = event.winnerSeat ?? (Number(event.seat) === 2 ? 1 : 2);
      return runPreset('knockout', at.x, at.y, {character: characterOfSeat(winner)});
    }

    return 0;
  }

  // -------------------------------------------------------------------------
  // Kalite / temizlik
  // -------------------------------------------------------------------------

  function applyQuality(level) {
    if (level !== 'high' && level !== 'low') return;
    const changed = level !== quality;
    quality = level;
    sampleSum = 0;
    sampleCount = 0;
    // Yeni bütçeyi aşan en eski olmayan parçacıkları hemen bırak.
    while (alive.length > cap()) release(alive.length - 1);
    if (changed) resize();
  }

  /** 'high' | 'low' sabitler (otomatik kapanır); 'auto' yüksekten başlatıp ölçüme açar. */
  function setQuality(level) {
    if (destroyed) return;
    if (level === 'auto') { autoQuality = true; applyQuality('high'); return; }
    if (level !== 'high' && level !== 'low') return;
    autoQuality = false;
    applyQuality(level);
  }

  function clear() {
    while (alive.length) release(alive.length - 1);
    stopLoop();
    setIdleHidden(true);
    // 3B arena açıldı (index.js bunu temizleyerek bildirir): backing store'u bırak.
    if (!destroyed && !sizedHidden && cssHidden()) resize();
    if (canvasDirty && !destroyed) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvasDirty = false;
    }
  }

  function destroy() {
    if (destroyed) return;
    clear();
    destroyed = true;
    observer?.disconnect?.();
    if (onWindowResize) env.removeEventListener?.('resize', onWindowResize);
    doc.removeEventListener?.('visibilitychange', onVisibility);
    free.length = 0;
    sprites.clear();
    canvas.remove?.();
  }

  return {
    available: true,
    handle,
    burstAt: (x, y, preset = 'hit', opts = {}) => runPreset(preset, Number(x) || 0, Number(y) || 0, opts),
    resize,
    setQuality,
    clear,
    destroy,
    /** Test ve hata ayıklama için anlık durum. */
    stats: () => ({
      alive: alive.length,
      cap: cap(),
      quality,
      auto: autoQuality,
      running: rafId !== 0,
      pooled: free.length,
      available: !destroyed
    }),
    canvas
  };
}

// ---------------------------------------------------------------------------
// Yardımcılar
// ---------------------------------------------------------------------------

/** İki .pvp2-side'ı da kapsayan arena kapsayıcısını bulur; yoksa root. */
function findArenaHost(root) {
  const duel = root.querySelector('.pvp2-duel');
  if (duel) return duel;
  const sides = typeof root.querySelectorAll === 'function' ? [...root.querySelectorAll('.pvp2-side')] : [];
  if (sides.length >= 2) {
    let node = sides[0].parentElement;
    while (node && node !== root) {
      if (node.contains?.(sides[1])) return node;
      node = node.parentElement;
    }
  }
  return root;
}

function safeRect(el) {
  try {
    const r = el.getBoundingClientRect?.();
    if (r) return r;
  } catch {
    /* ignore */
  }
  return {left: 0, top: 0, width: 0, height: 0};
}

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

/** Test edilebilirlik için dışa açılan preset adları. */
export const PARTICLE_PRESETS = Object.freeze([
  'fire-cast', 'rune-cast', 'hit', 'crit', 'block', 'parry', 'perfect',
  'shatter', 'counter', 'ultimate-charge', 'ultimate-final', 'knockout'
]);
