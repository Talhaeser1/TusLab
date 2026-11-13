/**
 * TuşLab Neon Arena — 3D savaş efektleri eklentisi (arena3d-fx).
 *
 * Tamamen kozmetiktir: HP'ye, sunucu durumuna ya da oyun kurallarına dokunmaz.
 * `pvp/arena3d.js` çekirdeğine aşağıdaki sözleşme üzerinden takılır ve
 * çekirdekten başka hiçbir şeye bağımlı değildir (THREE dahi api ile gelir).
 *
 *   api = {
 *     THREE, scene, camera, renderer,
 *     seatAnchor(seat) -> Vector3   // karakterin göğüs hizası (yeni vektör)
 *     seatGround(seat) -> Vector3   // karakterin altındaki zemin noktası
 *     facing(seat)     -> 1 | -1    // karakterin x ekseninde baktığı yön
 *     onFrame(fn), shake(i, ms), flash(hex, i, ms), dolly(seat|null, ms),
 *     quality() -> 'high' | 'low', isReduced() -> boolean
 *     timeScale?() -> 0..1          // paket 29: KO ağır çekimi; benzetim dt'si bununla çarpılır
 *   }
 *   Paket 29 istemci olayı: {type:'SUPER_FREEZE', seat, ms} → saldıranın renginde aura.
 *
 *   const fx = createArena3DFx(api);
 *   fx.handle(event);   // her savaş olayı için (SKILL_CAST, DAMAGE_APPLIED, ...)
 *   fx.update(dt, t);   // her karede; dt saniye cinsinden
 *   fx.clear();         // canlı tüm efektleri anında söndürür
 *   fx.dispose();       // sahneden kaldırır, GPU kaynaklarını serbest bırakır
 *   fx.stats();         // canlı sayımlar + üst sınırlar
 *
 * Tasarım ilkeleri:
 *  - TEK bir THREE.Points + özel ShaderMaterial ile GPU parçacıkları (additive,
 *    depthWrite kapalı, fragment shader'da hesaplanan yumuşak yuvarlak sprite).
 *  - Sabit boyutlu havuzlar; kare başına hiç nesne/dizi oluşturulmaz.
 *    Canlı parçacıklar [0, count) aralığında sıkı tutulur (swap-remove), böylece
 *    drawRange yalnızca canlıları çizer.
 *  - Her şeyin sert üst sınırı vardır; 'low' kalitede sayılar yarıya iner,
 *    isReduced() açıkken yalnızca çekirdeğe minik bir flash isteği gider.
 *  - Ölçek bağımsızlığı: tüm mesafeler iki dövüşçü arasındaki uzaklıktan türetilen
 *    `U` birimiyle ifade edilir (U = mesafe / 5). Çekirdek sahnesi hangi ölçekte
 *    olursa olsun efektler orantılı kalır.
 */

// ---------------------------------------------------------------------------
// Sabitler
// ---------------------------------------------------------------------------

/** Kalite seviyesine göre sert üst sınırlar. */
export const FX3D_CAPS = Object.freeze({
  high: Object.freeze({particles: 2000, projectiles: 8, rings: 8, shards: 64, lights: 3, emitters: 6, pillars: 2}),
  low: Object.freeze({particles: 700, projectiles: 4, rings: 4, shards: 32, lights: 2, emitters: 3, pillars: 1})
});

/** Efekt başına parçacık sayısı çarpanı. */
const COUNT_SCALE = Object.freeze({high: 1, low: 0.5});

/**
 * Mermi uçuş süreleri (saniye). Sunucu hasarı SKILL_CAST'tan SHIELD_WINDOW_MS
 * (250ms) sonra, karşı saldırıyı counterDelayMs (180ms) sonra çözer; 2D katmandaki
 * pvp10 mermileri de bu pencerede hedefe varır. 3D mermiler de aynı ritimde iner.
 */
export const TRAVEL_S = Object.freeze({q: 0.24, e: 0.28, r: 0.32, counter: 0.17, meteor: 0.24});

/** Mermi görsel boyut çarpanı (U cinsinden). Q küçük/hızlı, E ağır, R büyük. */
const PROJECTILE_SIZE = Object.freeze({q: 1, e: 1.45, r: 2.1, counter: 0.85, meteor: 2.7});
/** Mermi izinin saniyedeki parçacık sayısı (high kalite). */
const TRAIL_RATE = Object.freeze({q: 70, e: 110, r: 170, counter: 60, meteor: 240});
/** Yay yüksekliği (U). */
const ARC_HEIGHT = Object.freeze({q: 0.35, e: 0.6, r: 1.0, counter: 0.25, meteor: 0});

/** Simülasyon adımı en fazla bu kadar olabilir (sekme dönüşü sıçramasını önler). */
const MAX_STEP_S = 0.05;
const TAU = Math.PI * 2;

// Renk paletleri (pvp/fx-particles.js'teki 2D dil ile aynı tonlar).
const PALETTE_HEX = Object.freeze({
  fire: {
    hot: [0xfff3c4, 0xffe08a, 0xffd166, 0xffc53d],
    cool: [0xff8a3d, 0xff6a1f, 0xff5a1f, 0xe8361e],
    core: 0xfff6d5, glow: 0xff7a2a, ring: 0xffa23a, light: 0xff8a3d, flash: 0xff6a1f
  },
  rune: {
    hot: [0xf3eaff, 0xe0fbff, 0xa5f3fc, 0xc4b5fd],
    cool: [0xa78bfa, 0x8b5cf6, 0x22d3ee, 0x5ee3f5],
    core: 0xf0fdff, glow: 0x8b5cf6, ring: 0x5ee3f5, light: 0x7c6cff, flash: 0x8b5cf6
  },
  shield: {
    hot: [0xf0fdff, 0xe0f2fe, 0xa5f3fc],
    cool: [0x5ee3f5, 0x22d3ee, 0x38bdf8],
    core: 0xe0f2fe, glow: 0x22d3ee, ring: 0x5ee3f5, light: 0x5ee3f5, flash: 0x5ee3f5
  },
  parry: {
    hot: [0xffffff, 0xfff6d5, 0xfff3c4],
    cool: [0xffd166, 0xffc53d, 0xffe08a],
    core: 0xffffff, glow: 0xffd166, ring: 0xfff6d5, light: 0xfff1c1, flash: 0xfff1c1
  },
  // Zemine çakılma tozu: kolezyum taşı/kumu (mor-gri, sönük).
  dust: {
    hot: [0xb8a9c9, 0x9d8fb3, 0xc9bcd6],
    cool: [0x3b2f4d, 0x2a2238, 0x4a3b5c],
    core: 0xe9e0f5, glow: 0x6b5a80, ring: 0x8f7fa6, light: 0xd8c8ff, flash: 0xffffff
  }
});

/**
 * İş 15 — karaktere özgü ("imza") efekt paletleri. hot/cool parçacık renkleri, ring halka/iz rengi,
 * flash ekran kenarı darbesi rengi.
 */
const SIG_PALETTE_HEX = Object.freeze({
  vargr: {hot: [0xfff0dc, 0xffd08a, 0xffb347], cool: [0xff7a1a, 0xe8361e, 0xb3200f], core: 0xfff6e0, glow: 0xff6a1f, ring: 0xff8a3d, light: 0xff7a1a, flash: 0xff4a1a},
  blood: {hot: [0xffd0c4, 0xff6a5a, 0xff3a4a], cool: [0xc0001e, 0x7a0010, 0xe0102a], core: 0xffe0e0, glow: 0xd0102a, ring: 0xff2a3a, light: 0xff2a2a, flash: 0xd0102a},
  sira: {hot: [0xf3e6ff, 0xe8d0ff, 0xc58cff], cool: [0xa14dff, 0x6b21c8, 0x3b0a6b], core: 0xf7efff, glow: 0xa14dff, ring: 0xb06bff, light: 0x9b4dff, flash: 0xa14dff},
  doran: {hot: [0xfffbe6, 0xfff3c4, 0xffe08a], cool: [0xffc93c, 0xd99a1c, 0xa8741a], core: 0xfffbe6, glow: 0xffc93c, ring: 0xffd35a, light: 0xffd35a, flash: 0xffc93c},
  nyx: {hot: [0xf0fdff, 0xa5f3fc, 0xe0d0ff], cool: [0x22d6e8, 0xa56bff, 0x6b3cf0], core: 0xf0fdff, glow: 0x22d6e8, ring: 0x5ee3f5, light: 0x7c6cff, flash: 0x7c6cff},
  konyali: {hot: [0xfff3d6, 0xffe0a0, 0xf2c46a], cool: [0xe0a93a, 0xb8512f, 0x8a3a1c], core: 0xfff6e0, glow: 0xe0a93a, ring: 0xf2b84a, light: 0xffb84a, flash: 0xe8a53a},
  flour: {hot: [0xffffff, 0xfffaf0, 0xf5efe4], cool: [0xd8d0c4, 0xc9bfae, 0xe8e0d0], core: 0xffffff, glow: 0xfff6e8, ring: 0xfff6e8, light: 0xfff1d6, flash: 0xfff1d6},
  crumb: {hot: [0xd9a441, 0xc58a3a, 0xe8b84a], cool: [0x8a4a1c, 0x6b3a18, 0x9c5a24], core: 0xf2c46a, glow: 0xc58a3a, ring: 0xd9a441, light: 0xffb84a, flash: 0xd9a441},
  // KESINYAP 21 — E (kendine can) motifleri: her karakterde farklı renk + biçim (yalnız ışık değil).
  healSteam: {hot: [0xf2fff4, 0xbfffd0, 0xffe7a8], cool: [0x5fe88a, 0xe6b84a, 0x3fbf6a], core: 0xf6fff0, glow: 0x7dff9a, ring: 0x9dffb4, light: 0x8cff9e, flash: 0x7dff9a},
  healRunes: {hot: [0xf0fffd, 0xb8fff4, 0xd8ffe8], cool: [0x2ee6c8, 0x5effa8, 0x22b8d6], core: 0xf0fffd, glow: 0x46f0c8, ring: 0x6effd8, light: 0x5effc0, flash: 0x46f0c8},
  healPulse: {hot: [0xffe2e2, 0xff9a9a, 0xb8ffc8], cool: [0xd01030, 0xff3048, 0x60e080], core: 0xffeef0, glow: 0xff3048, ring: 0xff4a5e, light: 0xff5060, flash: 0xff3048},
  healMist: {hot: [0xf2e8ff, 0xd8c0ff, 0xc8ffe0], cool: [0x7a3ccf, 0x4a1d8a, 0x5fd09a], core: 0xf6efff, glow: 0x9a5cff, ring: 0xb07cff, light: 0x9a6cff, flash: 0x9a5cff},
  healAegis: {hot: [0xfffbe6, 0xfff0b0, 0xd8ffd8], cool: [0xffcf4a, 0xe8b030, 0x78e08a], core: 0xfffbe6, glow: 0xffd76a, ring: 0xffe08a, light: 0xffe08a, flash: 0xffd76a},
});
/** KESINYAP 21 — karakter → E (can) motifi (pvp/shared/fighters.js skills.e.motif ile aynı). */
export const HEAL_MOTIF = Object.freeze({konyali: 'steam', nyx: 'runes', vargr: 'pulse', sira: 'mist', doran: 'aegis'});
/** KESINYAP 21 — zemin hasarı havuzları: Q/W iz (6 sn), R krater (maç sonuna dek; en çok 4 canlı + 1 solan), krater başına moloz. */
/** 13 Kas 2026 (kullanici): zeminde yarik/krater YOK; buyuk sari dalga/halka efektleri YOK — sahneyi karakterin kendi animasyonu tasir. */
export const GROUND_DAMAGE_ON = false, BIG_WAVES_ON = false;
export const GROUND_POOLS = Object.freeze({scars: 8, craters: 5, maxCraters: 4, debris: 6, scarLife: 6});

/**
 * İş 15 — karakter başına imza yapılandırması: pal (ana), ultPal (R), castDecal (telegraf zemini),
 * decal (temas izi), blade (silah izi: kemik, uzunluk U, hangi yetenekler).
 */
const SIG_CONFIG = Object.freeze({
  vargr: {pal: 'vargr', ultPal: 'blood', castDecal: 'ember', decal: 'crack', blade: {bone: 'handslot.r', len: 1.05, skills: ['q', 'e', 'r']}},
  sira: {pal: 'sira', castDecal: 'shadow', decal: 'shadow', blade: {bone: 'handslot.r', len: 0.55, skills: ['e']}},
  doran: {pal: 'doran', castDecal: 'rune', decal: 'crack', blade: {bone: 'handslot.r', len: 0.85, skills: ['q', 'r']}},
  nyx: {pal: 'nyx', castDecal: 'rune', decal: 'rune', blade: null},
  konyali: {pal: 'konyali', castDecal: 'seljuk', decal: 'flour', blade: null},
});
export const SIG_FIGHTERS = Object.freeze(Object.keys(SIG_CONFIG));

/** İş 15 havuz boyutları (maç başında bir kez kurulur; dövüşte yeni GPU nesnesi yok). */
export const SIG_POOLS = Object.freeze({decals: 8, waves: 12, glyphs: 96, chunks: 32, ghosts: 8, projectiles: 4, ribbons: 2, emitters: 6});

/** Ultimate enerji zinciri: savunanı tutup çekerken en fazla bu kadar yaşar (sn). */
const TETHER_MAX_S = 1.8;

// ---------------------------------------------------------------------------
// Shader kaynakları
// ---------------------------------------------------------------------------

/** Parçacık: dünya biriminde boyut, perspektife göre piksel boyutu. */
const PARTICLE_VERT = /* glsl */`
attribute vec3 aColor;
attribute float aSize;
attribute float aAlpha;
uniform float uScale;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(aSize * uScale / max(-mv.z, 0.001), 0.0, 192.0);
  vColor = aColor;
  vAlpha = aAlpha;
}`;

/** 128px soft sprite, with an analytic fallback for canvas-less environments. */
const PARTICLE_FRAG = /* glsl */`
uniform sampler2D uSprite;
uniform bool uHasSprite;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float d = dot(p, p);
  if (d > 1.0) discard;
  float soft = 1.0 - d;
  soft *= soft;
  if (uHasSprite) soft = texture2D(uSprite, gl_PointCoord).a;
  float core = exp(-d * 9.0);
  gl_FragColor = vec4(vColor * (soft + core * 1.4), vAlpha * soft);
}`;

/** Basit uv aktaran vertex shader (glow düzlemi ve sütun için). */
const UV_VERT = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

/** Kameraya dönük parıltı düzlemi: radyal düşüş, beyaz çekirdek. */
const GLOW_FRAG = /* glsl */`
uniform vec3 uColor;
uniform vec3 uCore;
uniform float uOpacity;
varying vec2 vUv;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float a = pow(max(0.0, 1.0 - d), 2.2);
  float c = pow(max(0.0, 1.0 - d), 8.0);
  gl_FragColor = vec4(mix(uColor, uCore, c) * (a + c), a * uOpacity);
}`;

/** Yükselen enerji sütunu: dikey sönüm + dönen şeritler. */
const PILLAR_FRAG = /* glsl */`
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uAlpha;
uniform float uTime;
varying vec2 vUv;
void main() {
  float fade = pow(1.0 - vUv.y, 1.4);
  float bands = 0.55 + 0.45 * sin(vUv.x * 6.2831 * 5.0 + uTime * 9.0 + vUv.y * 14.0);
  vec3 col = mix(uColorA, uColorB, vUv.y);
  gl_FragColor = vec4(col * (0.6 + bands * 0.8), fade * bands * uAlpha);
}`;

/** Enerji zinciri ışını: uzunluk boyunca akan halkalar, kenarda yumuşak sönüm. */
const TETHER_FRAG = /* glsl */`
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uAlpha;
uniform float uTime;
varying vec2 vUv;
void main() {
  float links = 0.5 + 0.5 * sin(vUv.y * 60.0 - uTime * 30.0);
  float edge = 1.0 - abs(vUv.x * 2.0 - 1.0);
  float core = pow(max(0.0, sin(vUv.x * 3.14159)), 3.0);
  vec3 col = mix(uColorA, uColorB, links) * (0.7 + core * 1.3);
  gl_FragColor = vec4(col, (0.35 + 0.65 * links) * (0.4 + 0.6 * edge) * uAlpha);
}`;

/** İş 15: kameraya dönük atlas glifleri (nota, rün, Selçuklu yıldızı, kesik, kıvılcım, kırıntı). */
const GLYPH_VERT = /* glsl */`
attribute float aCell;
attribute float aAlpha;
attribute float aRot;
attribute vec3 aColor;
uniform vec2 uGrid;
varying vec2 vUv;
varying float vAlpha;
varying vec3 vColor;
void main() {
  vec4 c = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float s = length(instanceMatrix[0].xyz);
  float cs = cos(aRot), sn = sin(aRot);
  c.xy += vec2(position.x * cs - position.y * sn, position.x * sn + position.y * cs) * s;
  gl_Position = projectionMatrix * c;
  float col = mod(aCell, uGrid.x);
  float row = floor(aCell / uGrid.x);
  vUv = (vec2(col, uGrid.y - 1.0 - row) + uv) / uGrid;
  vAlpha = aAlpha;
  vColor = aColor;
}`;
const GLYPH_FRAG = /* glsl */`
uniform sampler2D uMap;
uniform bool uHasMap;
varying vec2 vUv;
varying float vAlpha;
varying vec3 vColor;
void main() {
  float a;
  if (uHasMap) a = texture2D(uMap, vUv).a;
  else { vec2 p = fract(vUv * vec2(4.0, 2.0)) * 2.0 - 1.0; a = max(0.0, 1.0 - dot(p, p)); }
  gl_FragColor = vec4(vColor * (0.7 + a * 0.9), a * vAlpha);
}`;

/** İş 15: silah izi şeridi — kuyruğa doğru sönen, uca doğru beyazlaşan katman. */
const RIBBON_VERT = /* glsl */`
attribute float aFade;
attribute float aSide;
varying float vFade;
varying float vSide;
void main() {
  vFade = aFade;
  vSide = aSide;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const RIBBON_FRAG = /* glsl */`
uniform vec3 uColor;
uniform float uOpacity;
varying float vFade;
varying float vSide;
void main() {
  vec3 col = mix(uColor, vec3(1.0), vSide * vSide * 0.65);
  gl_FragColor = vec4(col, uOpacity * vFade * vFade * (0.25 + 0.75 * vSide));
}`;

/** İş 15: ekran kenarı renk darbesi (kamera önü tam ekran dörtgen; merkez saydam). */
const EDGE_VERT = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;
const EDGE_FRAG = /* glsl */`
uniform vec3 uColor;
uniform float uOpacity;
varying vec2 vUv;
void main() {
  vec2 q = abs(vUv - 0.5) * 2.0;
  float d = max(q.x, q.y * 1.08);
  float e = smoothstep(0.62, 1.0, d) + 0.35 * smoothstep(0.82, 1.0, length(q) * 0.75);
  gl_FragColor = vec4(uColor * e * uOpacity, e * uOpacity);
}`;

// ---------------------------------------------------------------------------
// İş 15 — prosedürel dokular (yalnız maç başında, canvas 2D ile; beyaz çizilir, malzeme rengiyle boyanır)
// ---------------------------------------------------------------------------

function lcg(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

function softGlow(ctx, x, y, r, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(255,255,255,${a})`);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

const DECAL_DRAW = {
  /** Akkor zemin çatlağı: merkezden kırık çizgiler + dallar. */
  crack(ctx, w, h, r) {
    const cx = w / 2, cy = h / 2;
    softGlow(ctx, cx, cy, w * 0.24, 0.8);
    ctx.strokeStyle = '#fff'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.shadowColor = '#fff'; ctx.shadowBlur = 8;
    for (let i = 0; i < 10; i++) {
      let a = (i / 10) * Math.PI * 2 + r() * 0.5, x = cx, y = cy;
      const len = w * (0.3 + r() * 0.17);
      ctx.lineWidth = 3 + r() * 3;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let s = 0; s < 6; s++) {
        a += (r() - 0.5) * 0.8; x += Math.cos(a) * len / 6; y += Math.sin(a) * len / 6; ctx.lineTo(x, y);
        if (s === 2 && r() < 0.7) {
          const ba = a + (r() < 0.5 ? -0.9 : 0.9);
          ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(ba) * len * 0.25, y + Math.sin(ba) * len * 0.25); ctx.moveTo(x, y);
        }
      }
      ctx.stroke();
    }
  },
  /** Kor serpintisi: dağınık parlak noktalar. */
  ember(ctx, w, h, r) {
    softGlow(ctx, w / 2, h / 2, w * 0.3, 0.45);
    ctx.shadowColor = '#fff'; ctx.shadowBlur = 6;
    for (let i = 0; i < 70; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * w * 0.44;
      ctx.fillStyle = `rgba(255,255,255,${0.35 + r() * 0.65})`;
      ctx.beginPath(); ctx.arc(w / 2 + Math.cos(a) * d, h / 2 + Math.sin(a) * d, 1.5 + r() * 4, 0, Math.PI * 2); ctx.fill();
    }
  },
  /** Rün halkası: iç içe çemberler, çentikler, altı rün çizgisi, heksagram. */
  rune(ctx, w, h, r) {
    const cx = w / 2, cy = h / 2;
    ctx.strokeStyle = '#fff'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 6;
    ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(cx, cy, w * 0.46, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx, cy, w * 0.37, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * w * 0.37, cy + Math.sin(a) * w * 0.37);
      ctx.lineTo(cx + Math.cos(a) * w * (i % 3 ? 0.4 : 0.44), cy + Math.sin(a) * w * (i % 3 ? 0.4 : 0.44)); ctx.stroke();
    }
    ctx.lineWidth = 3;
    for (let t = 0; t < 2; t++) {
      ctx.beginPath();
      for (let k = 0; k <= 3; k++) {
        const a = (k / 3) * Math.PI * 2 + t * Math.PI / 3 - Math.PI / 2;
        const x = cx + Math.cos(a) * w * 0.3, y = cy + Math.sin(a) * w * 0.3;
        if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    void r;
  },
  /** Un tozu: yumuşak, düzensiz beyaz bulut lekeleri. */
  flour(ctx, w, h, r) {
    for (let i = 0; i < 150; i++) {
      const a = r() * Math.PI * 2, d = (r() + r()) * 0.5 * w * 0.42;
      softGlow(ctx, w / 2 + Math.cos(a) * d, h / 2 + Math.sin(a) * d, 6 + r() * 16, 0.1 + r() * 0.22);
    }
  },
  /** Selçuklu yıldızı: iç içe geçmiş iki kare (8 köşe), iç/dış çember, köşe noktaları. */
  seljuk(ctx, w, h) {
    const cx = w / 2, cy = h / 2;
    ctx.strokeStyle = '#fff'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 7;
    ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, w * 0.46, 0, Math.PI * 2); ctx.stroke();
    for (const R of [0.4, 0.22]) {
      for (let t = 0; t < 2; t++) {
        ctx.lineWidth = R > 0.3 ? 4 : 3;
        ctx.beginPath();
        for (let k = 0; k <= 4; k++) {
          const a = (k / 4) * Math.PI * 2 + t * Math.PI / 4;
          const x = cx + Math.cos(a) * w * R, y = cy + Math.sin(a) * w * R;
          if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
    }
    ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, w * 0.29, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#fff';
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * w * 0.43, cy + Math.sin(a) * w * 0.43, 4, 0, Math.PI * 2); ctx.fill();
    }
  },
  /** Gölge izi: çapraz, sivri uçlu kesik çizgileri. */
  shadow(ctx, w, h, r) {
    softGlow(ctx, w / 2, h / 2, w * 0.2, 0.35);
    ctx.fillStyle = '#fff'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 8;
    for (let i = 0; i < 5; i++) {
      ctx.save();
      ctx.translate(w / 2 + (r() - 0.5) * w * 0.3, h / 2 + (r() - 0.5) * h * 0.3);
      ctx.rotate(-0.7 + (r() - 0.5) * 0.5);
      ctx.beginPath(); ctx.ellipse(0, 0, w * (0.28 + r() * 0.14), 3 + r() * 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  },
};
export const SIG_DECAL_TYPES = Object.freeze(Object.keys(DECAL_DRAW));

/** Glif atlası hücreleri (4×2). */
export const GLYPH = Object.freeze({note: 0, notes: 1, runeA: 2, runeB: 3, star: 4, slash: 5, sparkle: 6, crumb: 7});

function drawGlyphAtlas(ctx) {
  const C = 128;
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.shadowColor = '#fff'; ctx.shadowBlur = 10;
  const cell = (i, fn) => { ctx.save(); ctx.translate((i % 4) * C, Math.floor(i / 4) * C); fn(); ctx.restore(); };
  cell(GLYPH.note, () => {
    ctx.beginPath(); ctx.ellipse(48, 94, 19, 13, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(64, 90); ctx.lineTo(64, 22); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(64, 22); ctx.bezierCurveTo(84, 34, 96, 46, 84, 70); ctx.stroke();
  });
  cell(GLYPH.notes, () => {
    ctx.beginPath(); ctx.ellipse(34, 98, 16, 11, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(88, 86, 16, 11, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(48, 94); ctx.lineTo(48, 32); ctx.moveTo(102, 82); ctx.lineTo(102, 20); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(46, 26); ctx.lineTo(104, 14); ctx.lineTo(104, 30); ctx.lineTo(46, 42); ctx.closePath(); ctx.fill();
  });
  cell(GLYPH.runeA, () => {
    ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(52, 112); ctx.lineTo(52, 16);
    ctx.moveTo(52, 30); ctx.lineTo(92, 50); ctx.moveTo(52, 58); ctx.lineTo(92, 78); ctx.stroke();
  });
  cell(GLYPH.runeB, () => {
    ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(64, 14); ctx.lineTo(96, 50); ctx.lineTo(64, 86); ctx.lineTo(32, 50); ctx.closePath();
    ctx.moveTo(42, 74); ctx.lineTo(24, 114); ctx.moveTo(86, 74); ctx.lineTo(104, 114); ctx.stroke();
  });
  cell(GLYPH.star, () => {
    ctx.beginPath();
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2, R = k % 2 ? 26 : 50;
      const x = 64 + Math.cos(a) * R, y = 64 + Math.sin(a) * R;
      if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.closePath(); ctx.fill();
  });
  cell(GLYPH.slash, () => {
    ctx.translate(64, 64); ctx.rotate(-0.75);
    ctx.beginPath(); ctx.ellipse(0, 0, 60, 7, 0, 0, Math.PI * 2); ctx.fill();
  });
  cell(GLYPH.sparkle, () => {
    ctx.beginPath(); ctx.moveTo(64, 6); ctx.quadraticCurveTo(70, 58, 122, 64); ctx.quadraticCurveTo(70, 70, 64, 122);
    ctx.quadraticCurveTo(58, 70, 6, 64); ctx.quadraticCurveTo(58, 58, 64, 6); ctx.fill();
  });
  cell(GLYPH.crumb, () => { ctx.shadowBlur = 0; softGlow(ctx, 64, 64, 54, 1); });
}

/** Etli ekmek dokusu: üstte kızarmış hamur, ortada koyu kabuk kenarı, kıyma benekleri, maydanoz/biber. */
function drawBreadTexture(ctx, w, h, r) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#f0c070'); g.addColorStop(0.3, '#e2a24e'); g.addColorStop(0.5, '#9c5824');
  g.addColorStop(0.7, '#d99a48'); g.addColorStop(1, '#eab868');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 220; i++) {
    const top = r() < 0.8;
    const y = top ? (0.06 + r() * 0.36) * h : (0.6 + r() * 0.3) * h;
    ctx.fillStyle = r() < 0.75 ? (r() < 0.5 ? '#6b2a14' : '#8a3a1c') : (r() < 0.6 ? '#c0482a' : '#5a7a2a');
    ctx.beginPath(); ctx.ellipse(r() * w, y, 1.5 + r() * 4, 1.2 + r() * 2.5, r() * 3, 0, Math.PI * 2); ctx.fill();
  }
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(60,24,8,${0.15 + r() * 0.25})`;
    ctx.beginPath(); ctx.arc(r() * w, (0.42 + r() * 0.16) * h, 2 + r() * 6, 0, Math.PI * 2); ctx.fill();
  }
}

// ---------------------------------------------------------------------------
// Yardımcılar
// ---------------------------------------------------------------------------

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[(Math.random() * list.length) | 0];

/** Olaydan karakter: önce olaydaki `character`, yoksa koltuk (1 = alev, 2 = rün). */
function characterOf(seat, character) {
  if (character === 'fire' || character === 'rune') return character;
  return seat === 2 ? 'rune' : 'fire';
}

// ---------------------------------------------------------------------------
// Ana fabrika
// ---------------------------------------------------------------------------

/**
 * 3D efekt eklentisini oluşturur.
 * @param {object} api çekirdek sözleşmesi (dosya başındaki açıklamaya bakın)
 */
export function createArena3DFx(api) {
  if (!api || !api.THREE || !api.scene) throw new TypeError('arena3d-fx: api.THREE ve api.scene gerekli');
  const {THREE, scene, camera} = api;

  // --- Sözleşme sarmalayıcıları (çekirdek bir fonksiyonu vermese de çökmeyelim) ---
  const qualityKey = () => (typeof api.quality === 'function' && api.quality() === 'low' ? 'low' : 'high');
  const caps = () => FX3D_CAPS[qualityKey()];
  const countScale = () => COUNT_SCALE[qualityKey()];
  const reduced = () => typeof api.isReduced === 'function' && Boolean(api.isReduced());
  const facing = (seat) => (typeof api.facing === 'function' && api.facing(seat) === -1 ? -1 : 1);
  const shake = (i, ms) => { if (typeof api.shake === 'function') api.shake(clamp(i, 0, 1), ms); };
  const flash = (hex, i, ms) => { if (typeof api.flash === 'function') api.flash(hex, clamp(i, 0, 1), ms); };

  /** Kalıcı kaynak takibi: dispose() hepsini serbest bırakır. */
  const ownedGeometries = new Set();
  const ownedMaterials = new Set();
  const geo = (g) => { ownedGeometries.add(g); return g; };
  const mat = (m) => { ownedMaterials.add(m); return m; };

  /** Tüm efektlerin bağlı olduğu kök grup. */
  const root = new THREE.Group();
  root.name = 'arena3d-fx';
  scene.add(root);

  // Paletleri bir kez THREE.Color nesnelerine çevir.
  const PAL = {};
  for (const [name, p] of [...Object.entries(PALETTE_HEX), ...Object.entries(SIG_PALETTE_HEX)]) {
    PAL[name] = {
      hot: p.hot.map((h) => new THREE.Color(h)),
      cool: p.cool.map((h) => new THREE.Color(h)),
      core: new THREE.Color(p.core), glow: new THREE.Color(p.glow),
      ring: new THREE.Color(p.ring), light: new THREE.Color(p.light),
      flashHex: p.flash
    };
  }

  // Kare içinde kullanılan geçici nesneler (kare başına tahsis yok).
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  const camQ = new THREE.Quaternion();
  const tmpQ = new THREE.Quaternion();
  const tmpE = new THREE.Euler();
  const tmpM = new THREE.Matrix4();
  const tmpS = new THREE.Vector3();
  const tmpC = new THREE.Vector3();
  const AXIS_Z = new THREE.Vector3(0, 0, 1);
  const AXIS_Y = new THREE.Vector3(0, 1, 0);

  let dead = false;
  const totals = {spawned: 0, dropped: 0, projectilesResolved: 0, events: 0, characterSkills: 0};
  /** Paket 32: koltukta 3B karakter modeli varsa becerinin görseli karaktere özeldir (fighters3d.js). */
  const hasCharacterModel = seat => {
    try {
      return typeof api.fighterModel === 'function' && Boolean(api.fighterModel(seat));
    } catch {
      return false;
    }
  };
  const resolveBeats = []; // short, bounded visual delays; game state is never delayed

  // =========================================================================
  // 1) GPU parçacık sistemi
  // =========================================================================
  const PMAX = FX3D_CAPS.high.particles; // tampon her zaman en büyük boyutta; sınır cap() ile
  const P = {
    count: 0,
    pos: new Float32Array(PMAX * 3),   // position özniteliği ile paylaşılır
    vel: new Float32Array(PMAX * 3),
    c0: new Float32Array(PMAX * 3),    // doğumdaki renk
    c1: new Float32Array(PMAX * 3),    // ölümdeki renk
    col: new Float32Array(PMAX * 3),   // aColor özniteliği
    size: new Float32Array(PMAX),      // aSize özniteliği
    alpha: new Float32Array(PMAX),     // aAlpha özniteliği
    s0: new Float32Array(PMAX), s1: new Float32Array(PMAX), a0: new Float32Array(PMAX),
    age: new Float32Array(PMAX), life: new Float32Array(PMAX),
    grav: new Float32Array(PMAX), drag: new Float32Array(PMAX)
  };
  const pGeometry = geo(new THREE.BufferGeometry());
  const posAttr = new THREE.BufferAttribute(P.pos, 3).setUsage(THREE.DynamicDrawUsage);
  const colAttr = new THREE.BufferAttribute(P.col, 3).setUsage(THREE.DynamicDrawUsage);
  const sizeAttr = new THREE.BufferAttribute(P.size, 1).setUsage(THREE.DynamicDrawUsage);
  const alphaAttr = new THREE.BufferAttribute(P.alpha, 1).setUsage(THREE.DynamicDrawUsage);
  pGeometry.setAttribute('position', posAttr);
  pGeometry.setAttribute('aColor', colAttr);
  pGeometry.setAttribute('aSize', sizeAttr);
  pGeometry.setAttribute('aAlpha', alphaAttr);
  pGeometry.setDrawRange(0, 0);
  let particleSprite = null;
  try {
    const document = api.renderer?.domElement?.ownerDocument || globalThis.document;
    const canvas = document?.createElement?.('canvas');
    if (canvas) {
      canvas.width = canvas.height = 128;
      const ctx = canvas.getContext?.('2d');
      if (ctx) {
        const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.3, 'rgba(255,255,255,0.8)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 128, 128);
        particleSprite = new THREE.CanvasTexture(canvas);
      }
    }
  } catch { /* Analytic circle remains available without a 2D context. */ }
  const pMaterial = mat(new THREE.ShaderMaterial({
    uniforms: {uScale: {value: 600}, uSprite: {value: particleSprite}, uHasSprite: {value: Boolean(particleSprite)}},
    vertexShader: PARTICLE_VERT,
    fragmentShader: PARTICLE_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  }));
  const points = new THREE.Points(pGeometry, pMaterial);
  points.name = 'arena3d-fx-particles';
  points.frustumCulled = false; // sınır küresi her kare değişir; hesaplamaya değmez
  points.renderOrder = 10;
  root.add(points);

  /**
   * Tek parçacık doğurur. Sınıra ulaşıldıysa yenisini reddeder (eskiler bozulmaz).
   * Pozisyon/hız/boyut dünya birimindedir.
   */
  function spawn(x, y, z, vx, vy, vz, life, s0, s1, a0, c0, c1, grav, drag) {
    if (P.count >= caps().particles) { totals.dropped++; return false; }
    const i = P.count++;
    const i3 = i * 3;
    P.pos[i3] = x; P.pos[i3 + 1] = y; P.pos[i3 + 2] = z;
    P.vel[i3] = vx; P.vel[i3 + 1] = vy; P.vel[i3 + 2] = vz;
    P.c0[i3] = c0.r; P.c0[i3 + 1] = c0.g; P.c0[i3 + 2] = c0.b;
    P.c1[i3] = c1.r; P.c1[i3 + 1] = c1.g; P.c1[i3 + 2] = c1.b;
    P.col[i3] = c0.r; P.col[i3 + 1] = c0.g; P.col[i3 + 2] = c0.b;
    P.size[i] = s0; P.alpha[i] = a0;
    P.s0[i] = s0; P.s1[i] = s1; P.a0[i] = a0;
    P.age[i] = 0; P.life[i] = Math.max(0.01, life);
    P.grav[i] = grav; P.drag[i] = drag;
    totals.spawned++;
    return true;
  }

  /** Ölü parçacığı son canlı ile değiştirerek diziyi sıkı tutar. */
  function killParticle(i) {
    const last = --P.count;
    if (i === last) return;
    const i3 = i * 3, l3 = last * 3;
    for (let k = 0; k < 3; k++) {
      P.pos[i3 + k] = P.pos[l3 + k]; P.vel[i3 + k] = P.vel[l3 + k];
      P.c0[i3 + k] = P.c0[l3 + k]; P.c1[i3 + k] = P.c1[l3 + k]; P.col[i3 + k] = P.col[l3 + k];
    }
    P.size[i] = P.size[last]; P.alpha[i] = P.alpha[last];
    P.s0[i] = P.s0[last]; P.s1[i] = P.s1[last]; P.a0[i] = P.a0[last];
    P.age[i] = P.age[last]; P.life[i] = P.life[last];
    P.grav[i] = P.grav[last]; P.drag[i] = P.drag[last];
  }

  /** CPU fiziği: hız, yerçekimi, sürtünme, ömür; öznitelikleri günceller. */
  function updateParticles(dt) {
    let i = 0;
    while (i < P.count) {
      const age = P.age[i] + dt;
      if (age >= P.life[i]) { killParticle(i); continue; } // yerine gelen de bu karede işlenir
      P.age[i] = age;
      const i3 = i * 3;
      const damp = Math.exp(-P.drag[i] * dt);
      P.vel[i3] *= damp;
      P.vel[i3 + 1] = (P.vel[i3 + 1] - P.grav[i] * dt) * damp;
      P.vel[i3 + 2] *= damp;
      P.pos[i3] += P.vel[i3] * dt;
      P.pos[i3 + 1] += P.vel[i3 + 1] * dt;
      P.pos[i3 + 2] += P.vel[i3 + 2] * dt;
      const p = age / P.life[i];
      const fadeIn = p < 0.08 ? p / 0.08 : 1;
      P.alpha[i] = P.a0[i] * fadeIn * (1 - p) * (1 - p * 0.35);
      P.size[i] = P.s0[i] + (P.s1[i] - P.s0[i]) * p;
      P.col[i3] = P.c0[i3] + (P.c1[i3] - P.c0[i3]) * p;
      P.col[i3 + 1] = P.c0[i3 + 1] + (P.c1[i3 + 1] - P.c0[i3 + 1]) * p;
      P.col[i3 + 2] = P.c0[i3 + 2] + (P.c1[i3 + 2] - P.c0[i3 + 2]) * p;
      i++;
    }
    pGeometry.setDrawRange(0, P.count);
    posAttr.needsUpdate = true; colAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true; alphaAttr.needsUpdate = true;
  }

  /**
   * Küresel patlama. o: {n, speed:[a,b], life:[a,b], size:[a,b], end (boyut çarpanı),
   * alpha, grav, drag, up (yukarı ek hız), pal}
   */
  function burst(cx, cy, cz, o) {
    const n = Math.round(o.n * countScale());
    for (let k = 0; k < n; k++) {
      const u = Math.random() * 2 - 1, th = Math.random() * TAU, r = Math.sqrt(1 - u * u);
      const sp = rand(o.speed[0], o.speed[1]);
      const s = rand(o.size[0], o.size[1]);
      if (!spawn(cx, cy, cz,
        r * Math.cos(th) * sp, u * sp + (o.up || 0), r * Math.sin(th) * sp,
        rand(o.life[0], o.life[1]), s, s * (o.end ?? 0.2), o.alpha ?? 1,
        pick(o.pal.hot), pick(o.pal.cool), o.grav ?? 0, o.drag ?? 1.5)) break;
    }
  }

  // =========================================================================
  // 2) Ortak geometri ve malzemeler
  // =========================================================================
  const G = {
    sphere: geo(new THREE.SphereGeometry(1, 16, 12)),
    plane: geo(new THREE.PlaneGeometry(1, 1)),
    octa: geo(new THREE.OctahedronGeometry(1, 0)),
    ringCircle: geo(new THREE.RingGeometry(0.86, 1, 64)),
    ringThin: geo(new THREE.RingGeometry(0.95, 1, 72)),
    ringHex: geo(new THREE.RingGeometry(0.78, 1, 6, 1)),
    tetra: geo(new THREE.TetrahedronGeometry(1, 0)),
    pillar: geo(new THREE.CylinderGeometry(1, 0.7, 1, 28, 1, true).translate(0, 0.5, 0))
  };

  function glowMaterial(palName) {
    return mat(new THREE.ShaderMaterial({
      uniforms: {uColor: {value: PAL[palName].glow.clone()}, uCore: {value: PAL[palName].core.clone()}, uOpacity: {value: 0.95}},
      vertexShader: UV_VERT, fragmentShader: GLOW_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    }));
  }
  const additiveBasic = (hex, opacity = 1) => mat(new THREE.MeshBasicMaterial({
    color: hex, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
  }));

  const M = {
    fireCore: mat(new THREE.MeshBasicMaterial({color: 0xfff3c4})),
    runeCore: mat(new THREE.MeshBasicMaterial({color: 0xe3ffff, toneMapped: false})),
    fireGlow: glowMaterial('fire'),
    runeShard: mat(new THREE.MeshStandardMaterial({
      color: 0x2a1450, emissive: 0x8b5cf6, emissiveIntensity: 1.8,
      metalness: 0.3, roughness: 0.2, flatShading: true
    })),
    runeGlyph: additiveBasic(0x5ee3f5, 0.9),
    runeOrbiter: additiveBasic(0xa5f3fc, 1),
    runeGlow: glowMaterial('rune')
  };

  // =========================================================================
  // 3) Mermiler (havuzlu)
  // =========================================================================
  const projectiles = [];

  /** Bir mermi grubu kurar. Alt parçalar birim ölçekte, grup ölçeği U * boyut. */
  function buildProjectile(kind) {
    const group = new THREE.Group();
    group.name = `arena3d-fx-projectile-${kind}`;
    group.visible = false;
    const rec = {kind, group, active: false, mode: 'puff', skill: 'q', age: 0, dur: 0.3,
      a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(),
      unit: 1, size: 1, trailAcc: 0, spin: 0, pal: PAL[kind], toSeat: 2, amount: 0,
      glow: null, core: null, shard: null, ring: null, orbiters: []};
    if (kind === 'fire') {
      // Alevli kuyruklu yıldız: parlak çekirdek küre + kameraya dönük parıltı.
      rec.core = new THREE.Mesh(G.sphere, M.fireCore);
      rec.core.scale.setScalar(0.13);
      rec.glow = new THREE.Mesh(G.plane, M.fireGlow);
      rec.glow.scale.setScalar(0.95);
      group.add(rec.core, rec.glow);
    } else {
      // Dönen kristal parça: uzatılmış oktahedron + altıgen glif halkası + yörünge parçaları.
      rec.shard = new THREE.Mesh(G.octa, M.runeShard);
      rec.shard.scale.set(0.12, 0.24, 0.12);
      rec.ring = new THREE.Mesh(G.ringHex, M.runeGlyph);
      rec.ring.scale.setScalar(0.34);
      rec.glow = new THREE.Mesh(G.plane, M.runeGlow);
      rec.glow.scale.setScalar(0.85);
      rec.core = new THREE.Mesh(G.sphere, M.runeCore);
      rec.core.scale.setScalar(0.07);
      group.add(rec.shard, rec.ring, rec.glow, rec.core);
      for (let k = 0; k < 3; k++) {
        const o = new THREE.Mesh(G.octa, M.runeOrbiter);
        o.scale.setScalar(0.035);
        rec.orbiters.push(o);
        group.add(o);
      }
    }
    const trailGeometry = geo(new THREE.BufferGeometry());
    trailGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(25 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    rec.trail = new THREE.Line(trailGeometry, mat(new THREE.LineBasicMaterial({
      color: PAL[kind].glow, opacity: 0.65, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false,
    })));
    rec.trail.name = `arena3d-fx-trail-${kind}`;
    rec.trail.visible = false;
    rec.trail.frustumCulled = false;
    root.add(group, rec.trail);
    projectiles.push(rec);
    return rec;
  }

  /** Boştaki mermiyi verir; sınır doluysa en eskisini sessizce geri dönüştürür. */
  function acquireProjectile(kind) {
    let activeCount = 0, oldest = null, free = null, builtOfKind = 0;
    for (const r of projectiles) {
      if (r.active) { activeCount++; if (!oldest || r.age / r.dur > oldest.age / oldest.dur) oldest = r; }
      if (r.kind === kind) { builtOfKind++; if (!r.active && !free) free = r; }
    }
    if (activeCount >= caps().projectiles && oldest) {
      releaseProjectile(oldest);
      if (oldest.kind === kind) free = oldest;
    }
    if (!free && builtOfKind < FX3D_CAPS.high.projectiles) free = buildProjectile(kind);
    return free;
  }

  function releaseProjectile(rec) {
    rec.active = false;
    rec.group.visible = false;
    rec.trail.visible = false;
  }
  // Performans: her türden bir mermi baştan (gizli) kurulur → parıltı
  // ShaderMaterial programı çekirdeğin ön-derlemesinde ısınır (ölçüldü: ilk
  // mermide ~1 sn takılma, Intel UHD).
  buildProjectile('fire');
  buildProjectile('rune');

  /**
   * Mermi fırlatır. a → b ikinci dereceden Bezier yayı; c kontrol noktası.
   * mode: 'puff' (küçük varış kıvılcımı) | 'meteor' (büyük patlama).
   */
  function launch(kind, skill, a, b, unit, mode, extra) {
    const rec = acquireProjectile(kind);
    if (!rec) return null;
    rec.active = true; rec.mode = mode; rec.skill = skill;
    rec.age = 0; rec.dur = TRAVEL_S[skill] ?? TRAVEL_S.q;
    rec.a.copy(a); rec.b.copy(b);
    rec.c.copy(a).add(b).multiplyScalar(0.5);
    rec.c.y += (ARC_HEIGHT[skill] ?? 0.4) * unit;
    rec.unit = unit; rec.size = PROJECTILE_SIZE[skill] ?? 1;
    rec.trailAcc = 0; rec.spin = Math.random() * TAU;
    rec.toSeat = extra?.toSeat ?? 2; rec.amount = extra?.amount ?? 0;
    rec.group.scale.setScalar(unit * rec.size);
    rec.group.position.copy(a);
    rec.group.visible = true;
    const attr = rec.trail.geometry.getAttribute('position');
    for (let i = 0; i <= 24; i++) a.toArray(attr.array, i * 3);
    attr.needsUpdate = true;
    rec.trail.visible = true;
    return rec;
  }

  /** Bezier üzerindeki noktayı out'a yazar. */
  function bezier(rec, t, out) {
    const u = 1 - t;
    out.set(
      u * u * rec.a.x + 2 * u * t * rec.c.x + t * t * rec.b.x,
      u * u * rec.a.y + 2 * u * t * rec.c.y + t * t * rec.b.y,
      u * u * rec.a.z + 2 * u * t * rec.c.z + t * t * rec.b.z);
    return out;
  }

  function updateProjectiles(dt) {
    const scale = countScale();
    for (const rec of projectiles) {
      if (!rec.active) continue;
      rec.age += dt;
      const t = Math.min(1, rec.age / rec.dur);
      const prevX = rec.group.position.x, prevY = rec.group.position.y, prevZ = rec.group.position.z;
      bezier(rec, t, rec.group.position);
      const trail = rec.trail.geometry.getAttribute('position');
      for (let i = 0; i <= 24; i++) {
        bezier(rec, Math.max(0, t - i / 24 * 0.22), tmpA).toArray(trail.array, i * 3);
      }
      trail.needsUpdate = true;
      const U = rec.unit;
      // Kameraya dönük parıltı.
      if (rec.glow) rec.glow.quaternion.copy(camQ);
      if (rec.kind === 'fire') {
        const pulse = 1 + Math.sin(rec.age * 40) * 0.12;
        rec.core.scale.setScalar(0.13 * pulse);
      } else {
        rec.spin += dt * 14;
        rec.shard.rotation.set(0.5, rec.spin, 0.3);
        // Glif halkası kameraya bakar ve kendi ekseninde döner.
        rec.ring.quaternion.copy(camQ).multiply(tmpQ.setFromAxisAngle(AXIS_Z, -rec.spin * 0.6));
        for (let k = 0; k < rec.orbiters.length; k++) {
          const ang = rec.spin * 0.8 + (k * TAU) / rec.orbiters.length;
          rec.orbiters[k].position.set(0, Math.cos(ang) * 0.42, Math.sin(ang) * 0.42);
          rec.orbiters[k].rotation.set(ang, ang * 2, 0);
        }
      }
      // İz parçacıkları: hızın tersine hafif savrulan kıvılcımlar / közler.
      rec.trailAcc += (TRAIL_RATE[rec.skill] ?? 80) * scale * dt;
      const vx = (rec.group.position.x - prevX) / Math.max(dt, 1e-4);
      const vy = (rec.group.position.y - prevY) / Math.max(dt, 1e-4);
      const vz = (rec.group.position.z - prevZ) / Math.max(dt, 1e-4);
      while (rec.trailAcc >= 1) {
        rec.trailAcc -= 1;
        const f = Math.random(); // ara noktalarda doğ: hızlı mermide boşluk kalmasın
        const px = prevX + (rec.group.position.x - prevX) * f;
        const py = prevY + (rec.group.position.y - prevY) * f;
        const pz = prevZ + (rec.group.position.z - prevZ) * f;
        const s = rand(0.07, 0.14) * U * rec.size;
        if (rec.kind === 'fire') {
          // Közler hafifçe yükselir (negatif yerçekimi), turuncudan koyu kırmızıya söner.
          spawn(px, py, pz, -vx * 0.08 + rand(-0.4, 0.4) * U, rand(0, 0.6) * U, -vz * 0.08 + rand(-0.4, 0.4) * U,
            rand(0.25, 0.5), s * 1.4, s * 0.3, 0.9, pick(rec.pal.hot), pick(rec.pal.cool), -1.2 * U, 2.5);
        } else {
          spawn(px, py, pz, -vx * 0.05 + rand(-0.3, 0.3) * U, rand(-0.3, 0.3) * U, -vz * 0.05 + rand(-0.3, 0.3) * U,
            rand(0.2, 0.42), s, s * 0.15, 0.9, pick(PAL.rune.hot), pick(PAL.rune.cool), 0, 3);
        }
      }
      if (t >= 1) resolveProjectile(rec);
    }
  }

  /** Varış: küçük kıvılcım ya da (meteor ise) büyük patlama; mermi havuza döner. */
  function resolveProjectile(rec) {
    const p = rec.group.position, U = rec.unit;
    releaseProjectile(rec);
    totals.projectilesResolved++;
    if (rec.mode === 'meteor') {
      bigExplosion(rec.kind, p.x, p.y, p.z, rec.toSeat, U, 1);
      return;
    }
    burst(p.x, p.y, p.z, {n: 8 * rec.size, speed: [0.8 * U, 2.2 * U], life: [0.12, 0.28],
      size: [0.06 * U, 0.12 * U], end: 0.2, grav: 0, drag: 4, pal: rec.pal});
  }

  // =========================================================================
  // 4) Halkalar (zemin şok dalgası, kalkan altıgeni, mükemmel blok darbesi)
  // =========================================================================
  const rings = [];

  function acquireRing() {
    let oldest = null, free = null, activeCount = 0;
    for (const r of rings) {
      if (!r.active) { if (!free) free = r; continue; }
      activeCount++;
      if (!oldest || r.age / r.life > oldest.age / oldest.life) oldest = r;
    }
    if (activeCount >= caps().rings && oldest) return oldest; // sınır dolu: en eskiyi yeniden kullan
    if (free) return free;
    if (rings.length < FX3D_CAPS.high.rings) {
      const material = additiveBasic(0xffffff, 0);
      const mesh = new THREE.Mesh(G.ringCircle, material);
      mesh.name = 'arena3d-fx-ring';
      mesh.visible = false;
      mesh.renderOrder = 9;
      root.add(mesh);
      const rec = {mesh, material, active: false, age: 0, life: 0.5, s0: 1, s1: 2, a0: 1, spin: 0};
      rings.push(rec);
      return rec;
    }
    return oldest;
  }

  /**
   * Halka doğurur. orient: 'floor' (yatay) | 'face' (x eksenine dik, saldırgana bakar).
   * shape: 'circle' | 'thin' | 'hex'.
   */
  function spawnRing(x, y, z, orient, shape, color, s0, s1, life, a0 = 0.9, spin = 0) {
    const rec = acquireRing();
    if (!rec) return null;
    rec.active = true; rec.age = 0; rec.life = life;
    rec.s0 = s0; rec.s1 = s1; rec.a0 = a0; rec.spin = spin;
    rec.mesh.geometry = shape === 'hex' ? G.ringHex : shape === 'thin' ? G.ringThin : G.ringCircle;
    rec.mesh.position.set(x, y, z);
    if (orient === 'floor') rec.mesh.rotation.set(-Math.PI / 2, 0, 0);
    else rec.mesh.rotation.set(0, Math.PI / 2, 0);
    rec.mesh.scale.setScalar(s0);
    rec.material.color.copy(color);
    rec.material.opacity = a0;
    rec.mesh.visible = true;
    return rec;
  }

  function updateRings(dt) {
    for (const r of rings) {
      if (!r.active) continue;
      r.age += dt;
      const p = r.age / r.life;
      if (p >= 1) { r.active = false; r.mesh.visible = false; continue; }
      const e = 1 - (1 - p) * (1 - p) * (1 - p); // easeOutCubic: hızlı açılır, yavaşlar
      r.mesh.scale.setScalar(r.s0 + (r.s1 - r.s0) * e);
      r.material.opacity = r.a0 * (1 - p) * (1 - p);
      if (r.spin) r.mesh.rotation.z += r.spin * dt;
    }
  }

  // =========================================================================
  // 5) Işık flaşları (en fazla 3 PointLight; sahnede sabit kalır → shader yeniden derlenmez)
  // =========================================================================
  const lights = [];
  for (let k = 0; k < FX3D_CAPS.high.lights; k++) {
    const light = new THREE.PointLight(0xffffff, 0, 8, 2);
    light.name = 'arena3d-fx-light';
    root.add(light);
    lights.push({light, age: 0, life: 0, peak: 0});
  }

  function flashLight(x, y, z, color, strength, life, unit) {
    const usable = caps().lights;
    let best = null;
    for (let k = 0; k < usable; k++) {
      const l = lights[k];
      const remaining = l.life > 0 ? 1 - l.age / l.life : 0;
      if (!best || remaining < best.remaining) best = {l, remaining};
    }
    if (!best) return;
    const l = best.l;
    l.age = 0; l.life = life; l.peak = 30 * strength * unit * unit;
    l.light.color.copy(color);
    l.light.position.set(x, y, z);
    l.light.distance = 9 * unit;
    l.light.intensity = l.peak;
  }

  function updateLights(dt) {
    for (const l of lights) {
      if (l.life <= 0) continue;
      l.age += dt;
      const p = l.age / l.life;
      if (p >= 1) { l.life = 0; l.light.intensity = 0; continue; }
      l.light.intensity = l.peak * (1 - p) * (1 - p);
    }
  }

  // =========================================================================
  // 6) Kalkan kırılması cam parçaları (InstancedMesh, yerçekimi + dönüş + zemin)
  // =========================================================================
  const SMAX = FX3D_CAPS.high.shards;
  const S = {
    count: 0,
    pos: new Float32Array(SMAX * 3), vel: new Float32Array(SMAX * 3),
    rot: new Float32Array(SMAX * 3), spin: new Float32Array(SMAX * 3),
    scale: new Float32Array(SMAX), age: new Float32Array(SMAX), life: new Float32Array(SMAX),
    floor: new Float32Array(SMAX), unit: new Float32Array(SMAX)
  };
  const shardMaterial = mat(new THREE.MeshStandardMaterial({
    color: 0xbff6ff, emissive: 0x38bdf8, emissiveIntensity: 0.9,
    metalness: 0.1, roughness: 0.15, transparent: true, opacity: 0.85, flatShading: true
  }));
  const shardMesh = new THREE.InstancedMesh(G.tetra, shardMaterial, SMAX);
  shardMesh.name = 'arena3d-fx-shards';
  shardMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  shardMesh.frustumCulled = false;
  shardMesh.count = 0;
  root.add(shardMesh);

  function spawnShard(x, y, z, vx, vy, vz, size, life, floorY, unit) {
    if (S.count >= caps().shards) { totals.dropped++; return false; }
    const i = S.count++, i3 = i * 3;
    S.pos[i3] = x; S.pos[i3 + 1] = y; S.pos[i3 + 2] = z;
    S.vel[i3] = vx; S.vel[i3 + 1] = vy; S.vel[i3 + 2] = vz;
    S.rot[i3] = Math.random() * TAU; S.rot[i3 + 1] = Math.random() * TAU; S.rot[i3 + 2] = Math.random() * TAU;
    S.spin[i3] = rand(-12, 12); S.spin[i3 + 1] = rand(-12, 12); S.spin[i3 + 2] = rand(-12, 12);
    S.scale[i] = size; S.age[i] = 0; S.life[i] = life; S.floor[i] = floorY; S.unit[i] = unit;
    return true;
  }

  function killShard(i) {
    const last = --S.count;
    if (i === last) return;
    const i3 = i * 3, l3 = last * 3;
    for (let k = 0; k < 3; k++) {
      S.pos[i3 + k] = S.pos[l3 + k]; S.vel[i3 + k] = S.vel[l3 + k];
      S.rot[i3 + k] = S.rot[l3 + k]; S.spin[i3 + k] = S.spin[l3 + k];
    }
    S.scale[i] = S.scale[last]; S.age[i] = S.age[last]; S.life[i] = S.life[last];
    S.floor[i] = S.floor[last]; S.unit[i] = S.unit[last];
  }

  function updateShards(dt) {
    let i = 0;
    while (i < S.count) {
      const age = S.age[i] + dt;
      if (age >= S.life[i]) { killShard(i); continue; }
      S.age[i] = age;
      const i3 = i * 3, U = S.unit[i];
      S.vel[i3 + 1] -= 9.8 * U * dt;
      S.pos[i3] += S.vel[i3] * dt; S.pos[i3 + 1] += S.vel[i3 + 1] * dt; S.pos[i3 + 2] += S.vel[i3 + 2] * dt;
      if (S.pos[i3 + 1] <= S.floor[i]) {
        // Zemine çarp: hafif sek, sürtünmeyle yavaşla, dönüşü kes.
        S.pos[i3 + 1] = S.floor[i];
        S.vel[i3 + 1] = Math.abs(S.vel[i3 + 1]) * 0.28;
        S.vel[i3] *= 0.6; S.vel[i3 + 2] *= 0.6;
        S.spin[i3] *= 0.5; S.spin[i3 + 1] *= 0.5; S.spin[i3 + 2] *= 0.5;
      }
      S.rot[i3] += S.spin[i3] * dt; S.rot[i3 + 1] += S.spin[i3 + 1] * dt; S.rot[i3 + 2] += S.spin[i3 + 2] * dt;
      const remain = S.life[i] - age;
      const sc = S.scale[i] * (remain < 0.4 ? remain / 0.4 : 1); // son 0.4 sn'de küçülerek kaybol
      tmpA.set(S.pos[i3], S.pos[i3 + 1], S.pos[i3 + 2]);
      tmpQ.setFromEuler(tmpE.set(S.rot[i3], S.rot[i3 + 1], S.rot[i3 + 2]));
      tmpS.set(sc, sc * 0.35, sc * 0.8); // yassı üçgen cam kıymığı
      shardMesh.setMatrixAt(i, tmpM.compose(tmpA, tmpQ, tmpS));
      i++;
    }
    shardMesh.count = S.count;
    shardMesh.instanceMatrix.needsUpdate = true;
  }

  // =========================================================================
  // 7) Enerji sütunları (ultimate faz 2 girdabı, rün ışını)
  // =========================================================================
  const pillars = [];

  function acquirePillar() {
    let oldest = null, free = null, activeCount = 0;
    for (const p of pillars) {
      if (!p.active) { if (!free) free = p; continue; }
      activeCount++;
      if (!oldest || p.age / p.life > oldest.age / oldest.life) oldest = p;
    }
    if (activeCount >= caps().pillars && oldest) return oldest;
    if (free) return free;
    if (pillars.length < FX3D_CAPS.high.pillars) {
      const material = mat(new THREE.ShaderMaterial({
        uniforms: {uColorA: {value: new THREE.Color()}, uColorB: {value: new THREE.Color()}, uAlpha: {value: 0}, uTime: {value: 0}},
        vertexShader: UV_VERT, fragmentShader: PILLAR_FRAG,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
      }));
      const mesh = new THREE.Mesh(G.pillar, material);
      mesh.name = 'arena3d-fx-pillar';
      mesh.visible = false;
      mesh.frustumCulled = false;
      root.add(mesh);
      const rec = {mesh, material, active: false, age: 0, life: 1, radius: 1, height: 1, spin: 0};
      pillars.push(rec);
      return rec;
    }
    return oldest;
  }
  // Performans: birer halka ve sütun baştan (gizli) oluşturulur; çekirdeğin
  // shader ön-derlemesi (renderer.compile) programlarını da ısıtır. Aksi halde
  // ilk şok dalgası/ultimate karesinde program bağlama savaş ortasında takılıyordu.
  // İş 15: havuzların TAMAMI baştan kurulur (dövüş sırasında yeni malzeme yok).
  for (let k = 0; k < FX3D_CAPS.high.rings; k++) { const r = acquireRing(); if (r) r.active = true; }
  for (const r of rings) r.active = false;
  for (let k = 0; k < FX3D_CAPS.high.pillars; k++) { const p = acquirePillar(); if (p) p.active = true; }
  for (const p of pillars) p.active = false;

  function spawnPillar(x, y, z, radius, height, life, palName, spin) {
    const rec = acquirePillar();
    if (!rec) return null;
    rec.active = true; rec.age = 0; rec.life = life;
    rec.radius = radius; rec.height = height; rec.spin = spin;
    rec.mesh.position.set(x, y, z);
    rec.mesh.scale.set(radius, 0.001, radius);
    rec.material.uniforms.uColorA.value.copy(PAL[palName].cool[0]);
    rec.material.uniforms.uColorB.value.copy(PAL[palName].hot[0]);
    rec.material.uniforms.uAlpha.value = 0;
    rec.mesh.visible = true;
    return rec;
  }

  function updatePillars(dt) {
    for (const p of pillars) {
      if (!p.active) continue;
      p.age += dt;
      const k = p.age / p.life;
      if (k >= 1) { p.active = false; p.mesh.visible = false; continue; }
      const grow = Math.min(1, k * 4);
      p.mesh.scale.set(p.radius * (1 - k * 0.3), p.height * grow, p.radius * (1 - k * 0.3));
      p.mesh.rotation.y += p.spin * dt;
      p.material.uniforms.uTime.value += dt;
      p.material.uniforms.uAlpha.value = k < 0.15 ? k / 0.15 : (1 - k) / 0.85;
    }
  }

  // =========================================================================
  // 8) Sürekli yayıcılar (ultimate faz 1 sarmalı, faz 2 girdabı)
  // =========================================================================
  const emitters = [];
  for (let k = 0; k < FX3D_CAPS.high.emitters; k++) {
    emitters.push({active: false, type: 'spiral', age: 0, life: 0, x: 0, y: 0, z: 0, gy: 0, unit: 1, rate: 0, acc: 0, pal: PAL.fire});
  }

  function startEmitter(type, x, y, z, gy, unit, life, rate, pal) {
    const usable = caps().emitters;
    let slot = null;
    for (let k = 0; k < usable; k++) {
      const e = emitters[k];
      if (!e.active) { slot = e; break; }
      if (!slot || e.age / e.life > slot.age / slot.life) slot = e;
    }
    if (!slot) return null;
    Object.assign(slot, {active: true, type, age: 0, life, x, y, z, gy, unit, rate, acc: 0, pal});
    return slot;
  }

  function updateEmitters(dt) {
    const scale = countScale();
    for (const e of emitters) {
      if (!e.active) continue;
      e.age += dt;
      if (e.age >= e.life) { e.active = false; continue; }
      const k = e.age / e.life, U = e.unit;
      e.acc += e.rate * scale * dt;
      if (e.type === 'follow' || e.type === 'aura') {
        // Fırlatılan savunanın / süper yapanın izini sürer (çekirdek onu her karede taşır).
        const anchor = api.seatAnchor?.(e.seat);
        if (anchor) { e.x = anchor.x; e.y = anchor.y; e.z = anchor.z; }
      }
      while (e.acc >= 1) {
        e.acc -= 1;
        const a = Math.random() * TAU;
        if (e.type === 'follow') {
          spawn(e.x + rand(-0.35, 0.35) * U, e.y + rand(-0.6, 0.6) * U, e.z + rand(-0.25, 0.25) * U,
            rand(-0.5, 0.5) * U, rand(0, 0.8) * U, rand(-0.5, 0.5) * U,
            rand(0.3, 0.6), rand(0.1, 0.2) * U, 0.03 * U, 0.9, pick(e.pal.hot), pick(e.pal.cool), -0.8 * U, 2);
          continue;
        }
        if (e.type === 'aura') {
          // Süper aurası: gövdenin çevresinden yükselen, saldıranın renginde alev/rün dili.
          const R = rand(0.32, 0.62) * U;
          spawn(e.x + Math.cos(a) * R, e.y + rand(-1.05, 0.45) * U, e.z + Math.sin(a) * R * 0.6,
            Math.cos(a) * 0.25 * U, rand(1.3, 2.5) * U, Math.sin(a) * 0.2 * U,
            rand(0.35, 0.6), rand(0.12, 0.22) * U, 0.02 * U, 0.85 * (1 - k * 0.5), pick(e.pal.hot), pick(e.pal.cool), -0.6 * U, 1.6);
          continue;
        }
        if (e.type === 'spiral') {
          // Toplanma sarmalı: geniş çemberde doğar, teğetsel + içe doğru hızla göğse akar.
          const R = (1.6 - k * 0.8) * U;
          const h = rand(-0.9, 0.9) * U;
          const px = e.x + Math.cos(a) * R, pz = e.z + Math.sin(a) * R, py = e.y + h;
          const inward = 2.6 * U, tang = 3.2 * U;
          spawn(px, py, pz,
            -Math.cos(a) * inward - Math.sin(a) * tang, -h * 2.2, -Math.sin(a) * inward + Math.cos(a) * tang,
            rand(0.3, 0.5), rand(0.08, 0.15) * U, 0.02 * U, 0.95, pick(e.pal.hot), pick(e.pal.cool), 0, 1.2);
        } else {
          // Girdap: zeminde dar çemberden dönerek yükselen akış.
          const R = rand(0.35, 0.7) * U;
          const px = e.x + Math.cos(a) * R, pz = e.z + Math.sin(a) * R;
          spawn(px, e.gy + rand(0, 0.3) * U, pz,
            -Math.sin(a) * 2.4 * U, rand(3.5, 5.5) * U, Math.cos(a) * 2.4 * U,
            rand(0.45, 0.8), rand(0.1, 0.18) * U, 0.03 * U, 0.9, pick(e.pal.hot), pick(e.pal.cool), -0.5 * U, 1.4);
        }
      }
    }
  }

  // =========================================================================
  // 8b) Ultimate enerji zinciri (tek nesne): saldırganın elinden savunanın
  //     göğsüne gerilen akışkan ışın + zincir halkası kıvılcımları. Uç noktalar
  //     her karede api.seatAnchor'dan okunur, böylece çekirdek savunanı VS
  //     noktasına çekerken zincir onu izler.
  // =========================================================================
  const tetherMaterial = mat(new THREE.ShaderMaterial({
    uniforms: {uColorA: {value: new THREE.Color()}, uColorB: {value: new THREE.Color()}, uAlpha: {value: 0}, uTime: {value: 0}},
    vertexShader: UV_VERT, fragmentShader: TETHER_FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
  }));
  const tetherMesh = new THREE.Mesh(geo(new THREE.CylinderGeometry(1, 1, 1, 10, 1, true)), tetherMaterial);
  tetherMesh.name = 'arena3d-fx-tether';
  tetherMesh.visible = false;
  tetherMesh.frustumCulled = false;
  tetherMesh.renderOrder = 11;
  root.add(tetherMesh);
  const tether = {active: false, from: 1, to: 2, age: 0, life: TETHER_MAX_S, releaseAt: Infinity, acc: 0, pal: PAL.fire, blocked: false};

  function startTether(fromSeat, toSeat, palName, blocked) {
    Object.assign(tether, {active: true, from: fromSeat, to: toSeat, age: 0, acc: 0, pal: PAL[palName], blocked,
      life: blocked ? 0.25 : TETHER_MAX_S, releaseAt: Infinity});
    tetherMaterial.uniforms.uColorA.value.copy(blocked ? PAL.shield.cool[0] : PAL[palName].cool[0]);
    tetherMaterial.uniforms.uColorB.value.copy(blocked ? PAL.shield.hot[0] : PAL[palName].hot[0]);
  }

  /** Zinciri `delay` saniye sonra kopar (fırlatma anı). */
  function releaseTether(delay = 0) {
    if (tether.active) tether.releaseAt = Math.min(tether.releaseAt, tether.age + delay);
  }

  function snapTether(U) {
    // Kopma: ışın boyunca dağılan kısa kıvılcımlar.
    const a = tetherEnds.a, b = tetherEnds.b;
    for (let k = 0; k < 6; k++) {
      const f = k / 5;
      burst(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, a.z + (b.z - a.z) * f,
        {n: 4, speed: [0.6 * U, 2.2 * U], life: [0.12, 0.3], size: [0.05 * U, 0.1 * U], end: 0.1, grav: 3 * U, drag: 3,
          pal: tether.blocked ? PAL.shield : tether.pal});
    }
    tether.active = false;
    tetherMesh.visible = false;
  }

  const tetherEnds = {a: new THREE.Vector3(), b: new THREE.Vector3()};
  function updateTether(dt) {
    if (!tether.active) return;
    tether.age += dt;
    const from = seatInfo(tether.from), to = seatInfo(tether.to);
    const U = unitScale();
    if (!from || !to) { tether.active = false; tetherMesh.visible = false; return; }
    const a = tetherEnds.a.copy(from.anchor);
    a.x += from.facing * 0.45 * U; a.y += 0.1 * U;
    const b = tetherEnds.b.copy(to.anchor);
    if (tether.blocked) b.x -= from.facing * 0.55 * U; // kalkan yüzeyinde durur
    if (tether.age >= tether.releaseAt || tether.age >= tether.life) { snapTether(U); return; }
    tmpC.subVectors(b, a);
    const length = Math.max(1e-3, tmpC.length());
    tetherMesh.position.addVectors(a, b).multiplyScalar(0.5);
    tetherMesh.quaternion.setFromUnitVectors(AXIS_Y, tmpC.multiplyScalar(1 / length));
    const grab = Math.min(1, tether.age / 0.08); // ışın 80 ms'de hedefe uzanır
    const r = 0.05 * U * (1 + 0.25 * Math.sin(tether.age * 40));
    tetherMesh.scale.set(r, length * grab, r);
    tetherMesh.position.lerpVectors(a, tetherMesh.position, grab);
    tetherMaterial.uniforms.uTime.value += dt;
    tetherMaterial.uniforms.uAlpha.value = grab * (tether.blocked ? 0.6 : 1);
    tetherMesh.visible = true;
    // Zincir halkaları: hafif sarkan eğri boyunca titreyen kısa ömürlü kıvılcımlar.
    tether.acc += 420 * countScale() * dt;
    while (tether.acc >= 1) {
      tether.acc -= 1;
      const f = Math.random() * grab;
      const sag = -Math.sin(f * Math.PI) * 0.12 * U;
      const jitter = Math.sin(f * 30 + tether.age * 50) * 0.06 * U;
      spawn(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f + sag + jitter, a.z + (b.z - a.z) * f + rand(-0.04, 0.04) * U,
        0, 0, 0, rand(0.06, 0.12), rand(0.08, 0.14) * U, 0.03 * U, 1,
        pick(tether.blocked ? PAL.shield.hot : tether.pal.hot), pick(tether.blocked ? PAL.shield.cool : tether.pal.cool), 0, 0);
    }
  }

  // =========================================================================
  // 9) Bileşik efektler
  // =========================================================================

  /** Koltuk konumları + ölçek birimi. Koltuk geçersizse null. */
  function seatInfo(seat) {
    if (seat !== 1 && seat !== 2) return null;
    const anchor = api.seatAnchor?.(seat);
    if (!anchor) return null;
    const ground = api.seatGround?.(seat) ?? new THREE.Vector3(anchor.x, 0, anchor.z);
    return {anchor, ground, facing: facing(seat)};
  }

  /** U: iki dövüşçü arasındaki mesafenin beşte biri (ölçekten bağımsız efektler). */
  function unitScale() {
    // Koltuk evleri (varsa): ultimate çekişi sırasında dövüşçüler yaklaşınca efektler küçülmesin.
    const home = typeof api.seatHome === 'function';
    const a = home ? api.seatHome(1) : api.seatAnchor?.(1), b = home ? api.seatHome(2) : api.seatAnchor?.(2);
    if (!a || !b) return 1;
    const d = a.distanceTo(b);
    return Number.isFinite(d) && d > 1e-3 ? clamp(d / 5, 0.05, 50) : 1;
  }

  /** Hasar darbesi: kıvılcım patlaması + zemin şok dalgası + ışık + sarsıntı. */
  function impact(toSeat, fromSeat, palName, amount, counter) {
    const d = seatInfo(toSeat);
    if (!d) return;
    const U = unitScale();
    const k = clamp(amount / 105, 0.4, 3);
    const pal = counter ? PAL.parry : PAL[palName];
    const {anchor: c, ground: g} = d;
    // Parlak merkez patlaması.
    spawn(c.x, c.y, c.z, 0, 0, 0, 0.18, 1.1 * U * Math.sqrt(k), 0.2 * U, 1, pal.hot[0], pal.cool[0], 0, 0);
    // Kıvılcımlar: hızlı, yerçekimli.
    burst(c.x, c.y, c.z, {n: 36 * k, speed: [2.5 * U, 7 * U], life: [0.3, 0.65], size: [0.06 * U, 0.12 * U],
      end: 0.15, grav: 9 * U, drag: 2.2, up: 1.2 * U, pal});
    // Yavaş közler / kristal tozu.
    burst(c.x, c.y, c.z, {n: 12 * k, speed: [0.4 * U, 1.4 * U], life: [0.6, 1.1], size: [0.1 * U, 0.2 * U],
      end: 0.3, grav: palName === 'fire' ? -1 * U : 0.4 * U, drag: 1.5, alpha: 0.7, pal});
    spawnRing(g.x, g.y + 0.02 * U, g.z, 'floor', 'circle', pal.cool[0], 0.3 * U, (1.5 + 0.6 * k) * U, 0.5);
    flashLight(c.x, c.y, c.z, pal.light, 0.6 + 0.4 * k, 0.22, U);
    if (!api.impactManaged) shake(clamp(amount / 350, 0.12, 0.85), Math.round(120 + amount * 0.8));
  }

  /** Bloklanan isabet: kalkandan sekmiş birkaç camgöbeği kıvılcım. */
  function deflect(toSeat, fromSeat) {
    const d = seatInfo(toSeat);
    if (!d) return;
    const U = unitScale();
    const x = d.anchor.x + d.facing * 0.55 * U;
    burst(x, d.anchor.y, d.anchor.z, {n: 12, speed: [1.5 * U, 4 * U], life: [0.18, 0.35], size: [0.05 * U, 0.09 * U],
      end: 0.1, grav: 4 * U, drag: 3, pal: PAL.shield});
    shake(0.08, 90);
  }

  /** Camgöbeği altıgen kalkan parlaması (+ mükemmel blokta temiz halka darbesi). */
  function shieldFlare(seat, perfect) {
    const d = seatInfo(seat);
    if (!d) return;
    const U = unitScale();
    const x = d.anchor.x + d.facing * 0.55 * U, y = d.anchor.y, z = d.anchor.z;
    spawnRing(x, y, z, 'face', 'hex', PAL.shield.ring, 0.75 * U, 1.05 * U, 0.42, 1, 1.6);
    spawnRing(x, y, z, 'face', 'hex', PAL.shield.core, 0.5 * U, 0.7 * U, 0.3, 0.7, -2.4);
    // Kalkan yüzeyinde parlayan kıvılcımlar (dikey düzlemde dağılır).
    const n = Math.round(14 * countScale());
    for (let k = 0; k < n; k++) {
      const a = Math.random() * TAU, r = rand(0.3, 0.9) * U;
      spawn(x, y + Math.sin(a) * r, z + Math.cos(a) * r, d.facing * rand(0.5, 1.5) * U, 0, 0,
        rand(0.2, 0.4), rand(0.07, 0.13) * U, 0.02 * U, 0.9, pick(PAL.shield.hot), pick(PAL.shield.cool), 0, 3);
    }
    if (perfect) {
      spawnRing(x, y, z, 'face', 'thin', PAL.shield.core, 0.6 * U, 2.2 * U, 0.45, 1);
      flashLight(x, y, z, PAL.shield.light, 0.6, 0.2, U);
    }
  }

  /** Parry: beyaz/altın yıldız patlaması (8 ışın) + ekran flaşı. */
  function parryBurst(seat) {
    const d = seatInfo(seat);
    if (!d) return;
    const U = unitScale();
    const x = d.anchor.x + d.facing * 0.5 * U, y = d.anchor.y, z = d.anchor.z;
    const rays = 8, perRay = Math.max(2, Math.round(7 * countScale()));
    for (let r = 0; r < rays; r++) {
      const a = (r / rays) * TAU + Math.PI / 8;
      const dy = Math.sin(a), dz = Math.cos(a);
      for (let k = 0; k < perRay; k++) {
        const sp = (1.5 + k * 0.9) * U; // aynı ışında farklı hızlar = uzayan yıldız kolu
        spawn(x, y, z, d.facing * 0.4 * U, dy * sp, dz * sp, 0.32, (0.16 - k * 0.012) * U, 0.02 * U, 1,
          PAL.parry.hot[0], pick(PAL.parry.cool), 0, 2.5);
      }
    }
    spawn(x, y, z, 0, 0, 0, 0.2, 1.4 * U, 0.3 * U, 1, PAL.parry.hot[0], PAL.parry.cool[0], 0, 0);
    spawnRing(x, y, z, 'face', 'thin', PAL.parry.ring, 0.4 * U, 1.8 * U, 0.35, 1);
    flashLight(x, y, z, PAL.parry.light, 1, 0.25, U);
    flash(PALETTE_HEX.parry.flash, 0.45, 160);
  }

  /** Kalkan kırılması: düşen, dönen cam kıymıkları + kırık altıgen. */
  function shieldShatter(seat) {
    const d = seatInfo(seat);
    if (!d) return;
    const U = unitScale();
    const x = d.anchor.x + d.facing * 0.55 * U, y = d.anchor.y, z = d.anchor.z;
    const n = Math.round(40 * countScale());
    for (let k = 0; k < n; k++) {
      const a = Math.random() * TAU, r = rand(0, 0.8) * U;
      if (!spawnShard(x, y + Math.sin(a) * r, z + Math.cos(a) * r,
        d.facing * rand(0.5, 3) * U, rand(0.5, 3.5) * U, rand(-2, 2) * U,
        rand(0.06, 0.13) * U, rand(1.2, 1.9), d.ground.y + 0.03 * U, U)) break;
    }
    burst(x, y, z, {n: 20, speed: [1 * U, 3.5 * U], life: [0.2, 0.45], size: [0.06 * U, 0.12 * U],
      end: 0.1, grav: 3 * U, drag: 2.5, pal: PAL.shield});
    spawnRing(x, y, z, 'face', 'hex', PAL.shield.ring, 1.0 * U, 1.6 * U, 0.3, 1, 4);
    flashLight(x, y, z, PAL.shield.light, 0.8, 0.2, U);
    shake(0.3, 180);
  }

  /** Büyük patlama (ultimate faz 3 ve nakavt): kıvılcım + ateş topu + kalıcı közler. */
  function bigExplosion(palName, x, y, z, seat, U, power) {
    const pal = PAL[palName];
    const d = seatInfo(seat);
    const gy = d ? d.ground.y : y - 1.2 * U;
    spawn(x, y, z, 0, 0, 0, 0.28, 2.6 * U * power, 0.6 * U, 1, pal.hot[0], pal.cool[0], 0, 0);
    burst(x, y, z, {n: 110 * power, speed: [3 * U, 10 * U], life: [0.4, 0.9], size: [0.08 * U, 0.16 * U],
      end: 0.15, grav: 7 * U, drag: 1.8, up: 1.5 * U, pal});
    burst(x, y, z, {n: 40 * power, speed: [0.8 * U, 2.8 * U], life: [0.5, 0.9], size: [0.3 * U, 0.55 * U],
      end: 0.6, grav: -1.2 * U, drag: 1.8, alpha: 0.55, pal});
    // Kalıcı közler: yavaşça süzülür.
    burst(x, y + 0.8 * U, z, {n: 45 * power, speed: [0.5 * U, 2 * U], life: [1.8, 3], size: [0.06 * U, 0.11 * U],
      end: 0.4, grav: 0.35 * U, drag: 1.1, up: 1.4 * U, alpha: 0.85, pal});
    spawnRing(x, gy + 0.02 * U, z, 'floor', 'circle', pal.ring, 0.4 * U, 4 * U * power, 0.75, 1);
    spawnRing(x, gy + 0.03 * U, z, 'floor', 'thin', pal.core, 0.2 * U, 2.6 * U * power, 0.5, 1);
    flashLight(x, y, z, pal.light, 2 * power, 0.45, U);
  }

  // =========================================================================
  // 9b) İş 15 — karaktere özgü yetenek efektleri ("imza"):
  //     telegraf → ana efekt (mermi/girdap/dalga) → temas patlaması → zemin izi.
  //     Geometri/malzeme/doku burada BİR KEZ kurulur ve havuzlanır.
  // =========================================================================
  const AXIS_X = new THREE.Vector3(1, 0, 0);
  const SV = {a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), d: new THREE.Vector3(),
    hand: new THREE.Vector3(), chest: new THREE.Vector3(), q: new THREE.Quaternion()};
  const easeOut3 = t => 1 - (1 - t) * (1 - t) * (1 - t);
  const perfNow = () => (globalThis.performance?.now ? globalThis.performance.now() : Date.now());
  const fighterOf = seat => { try { return typeof api.fighterModel === 'function' ? api.fighterModel(seat) || null : null; } catch { return null; } };
  const sigCapScale = () => (qualityKey() === 'low' ? 0.5 : 1);
  const sigDoc = api.renderer?.domElement?.ownerDocument || globalThis.document;
  function canvasTex(w, h, draw, seed, srgb = false) {
    try {
      const c = sigDoc?.createElement?.('canvas');
      const ctx = c?.getContext?.('2d');
      if (!ctx) return null;
      c.width = w; c.height = h;
      draw(ctx, w, h, lcg(seed));
      const t = new THREE.CanvasTexture(c);
      if (srgb && THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
      return t;
    } catch { return null; }
  }
  const TEX = {};
  SIG_DECAL_TYPES.forEach((name, i) => { TEX[name] = canvasTex(256, 256, DECAL_DRAW[name], 11 + i * 97); });
  const glyphTex = canvasTex(512, 256, drawGlyphAtlas, 3);
  const breadTex = canvasTex(256, 128, drawBreadTexture, 29, true);

  const SG = {
    decal: geo(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)),
    wave: geo(new THREE.TorusGeometry(1, 0.075, 8, 56)),
    bread: geo(new THREE.SphereGeometry(1, 24, 12)),
    shaft: geo(new THREE.CylinderGeometry(0.022, 0.03, 1.25, 6).rotateZ(Math.PI / 2)),
    tip: geo(new THREE.ConeGeometry(0.075, 0.3, 6).rotateZ(-Math.PI / 2).translate(0.75, 0, 0)),
    blade: geo(new THREE.ConeGeometry(0.05, 0.5, 4).rotateZ(-Math.PI / 2)),
    ghost: geo(new THREE.CylinderGeometry(0.03, 0.05, 1.1, 5).rotateZ(Math.PI / 2)),
    chunk: geo(new THREE.BoxGeometry(1, 1, 1)),
  };
  const sigBasic = (hex, opacity = 1) => mat(new THREE.MeshBasicMaterial({color: hex, transparent: true, opacity,
    depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false}));
  const SM = {
    bread: mat(new THREE.MeshBasicMaterial({color: 0xffffff, map: breadTex})),
    siraEnergy: sigBasic(0xb06bff, 0.95), siraCore: sigBasic(0xf3e6ff, 1),
    nyxCore: sigBasic(0xe0fbff, 1), nyxRing: sigBasic(0x5ee3f5, 0.9),
    meteorCore: sigBasic(0xfff3e0, 1),
    konyaliGlow: glowMaterial('konyali'), siraGlow: glowMaterial('sira'), nyxGlow: glowMaterial('nyx'),
  };

  // --- (a) zemin izleri: 8 düzlem, her biri kalıcı malzemeli; doku havuzdaki desenler arasında değişir
  const decalTexList = SIG_DECAL_TYPES.map(n => TEX[n]);
  const decals = [];
  for (let k = 0; k < SIG_POOLS.decals; k++) {
    const m = mat(new THREE.MeshBasicMaterial({color: 0xffffff, map: decalTexList[k % decalTexList.length] || null,
      transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2}));
    const mesh = new THREE.Mesh(SG.decal, m);
    mesh.name = 'arena3d-fx-sig-decal'; mesh.visible = false; mesh.renderOrder = 8; mesh.frustumCulled = false;
    root.add(mesh);
    decals.push({mesh, m, active: false, age: 0, life: 1, s0: 1, s1: 1, a0: 1, spin: 0, seat: 0, name: ''});
  }
  function sigDecal(x, y, z, type, color, s0, s1, life, {a0 = 0.95, spin = 0, normal = false, seat = 0} = {}) {
    if (type === "crack" && !GROUND_DAMAGE_ON) return;
    let rec = null;
    for (const d of decals) { if (!d.active) { rec = d; break; } if (!rec || d.age / d.life > rec.age / rec.life) rec = d; }
    const tex = TEX[type] || null;
    if (rec.m.map !== tex) { rec.m.map = tex; }
    rec.m.blending = normal ? THREE.NormalBlending : THREE.AdditiveBlending;
    rec.m.color.copy(color);
    Object.assign(rec, {active: true, age: 0, life, s0, s1, a0, spin, seat, name: type});
    rec.mesh.position.set(x, y, z);
    rec.mesh.rotation.set(0, Math.random() * TAU, 0);
    rec.mesh.scale.setScalar(s0);
    rec.mesh.visible = true;
    return rec;
  }
  function updateDecals(dt) {
    for (const d of decals) {
      if (!d.active) continue;
      d.age += dt;
      const p = d.age / d.life;
      if (p >= 1) { d.active = false; d.mesh.visible = false; d.m.opacity = 0; continue; }
      d.mesh.scale.setScalar(d.s0 + (d.s1 - d.s0) * easeOut3(Math.min(1, p * 3.5)));
      if (d.spin) d.mesh.rotation.y += d.spin * dt;
      if (d.seat) { const g = api.seatGround?.(d.seat); if (g) { d.mesh.position.x = g.x; d.mesh.position.z = g.z; } }
      const fadeIn = Math.min(1, d.age / 0.06);
      d.m.opacity = d.a0 * fadeIn * (p < 0.6 ? 1 : 1 - (p - 0.6) / 0.4);
    }
  }

  // --- (a2) KESINYAP 21 — zemin hasarı: Q/W küçük çatlak/yanık (6 sn'de solar), R göçük/krater (maç sonuna dek).
  //     Koyu (normal karışım) desenler; tüm düzlemler/malzemeler/moloz örnekleri burada BİR KEZ kurulur.
  const scarTex = canvasTex(256, 256, (ctx, w, h, r) => {
    const cx = w / 2, cy = h / 2, g = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.42);
    g.addColorStop(0, 'rgba(18,10,6,0.85)'); g.addColorStop(0.45, 'rgba(34,20,12,0.55)'); g.addColorStop(1, 'rgba(30,20,14,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, w * 0.42, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(6,3,2,0.95)'; ctx.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      let a = (i / 7) * TAU + r() * 0.6, x = cx, y = cy; const len = w * (0.22 + r() * 0.18);
      ctx.lineWidth = 2 + r() * 3; ctx.beginPath(); ctx.moveTo(x, y);
      for (let s = 0; s < 5; s++) { a += (r() - 0.5) * 0.9; x += Math.cos(a) * len / 5; y += Math.sin(a) * len / 5; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,140,60,0.55)';
    for (let i = 0; i < 14; i++) { const a = r() * TAU, d = r() * w * 0.2; ctx.fillRect(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 2, 2); }
  }, 211);
  const craterTex = canvasTex(256, 256, (ctx, w, h, r) => {
    const cx = w / 2, cy = h / 2;
    const rim = ctx.createRadialGradient(cx, cy, w * 0.2, cx, cy, w * 0.48);
    rim.addColorStop(0, 'rgba(10,7,5,0.96)'); rim.addColorStop(0.45, 'rgba(58,42,30,0.95)'); rim.addColorStop(0.62, 'rgba(92,72,52,0.7)'); rim.addColorStop(1, 'rgba(60,46,34,0)');
    ctx.fillStyle = rim; ctx.beginPath(); ctx.arc(cx, cy, w * 0.48, 0, TAU); ctx.fill();
    const pit = ctx.createRadialGradient(cx - w * 0.03, cy - w * 0.03, 0, cx, cy, w * 0.26);
    pit.addColorStop(0, 'rgba(0,0,0,1)'); pit.addColorStop(0.7, 'rgba(8,5,3,0.98)'); pit.addColorStop(1, 'rgba(24,16,10,0.9)');
    ctx.fillStyle = pit; ctx.beginPath(); ctx.arc(cx, cy, w * 0.26, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(4,2,1,0.95)'; ctx.lineCap = 'round';
    for (let i = 0; i < 14; i++) { // radyal çatlaklar (çukurdan dışa)
      let a = (i / 14) * TAU + r() * 0.3, x = cx + Math.cos(a) * w * 0.22, y = cy + Math.sin(a) * w * 0.22;
      const len = w * (0.14 + r() * 0.14); ctx.lineWidth = 2.5 + r() * 3; ctx.beginPath(); ctx.moveTo(x, y);
      for (let s = 0; s < 4; s++) { a += (r() - 0.5) * 0.5; x += Math.cos(a) * len / 4; y += Math.sin(a) * len / 4; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    for (let i = 0; i < 46; i++) { // kenar molozu
      const a = r() * TAU, d = w * (0.3 + r() * 0.15), s = 2 + r() * 5;
      ctx.fillStyle = r() < 0.5 ? 'rgba(40,30,22,0.95)' : 'rgba(120,98,74,0.9)';
      ctx.fillRect(cx + Math.cos(a) * d, cy + Math.sin(a) * d, s, s * (0.6 + r() * 0.6));
    }
  }, 223);
  const groundMat = map => mat(new THREE.MeshBasicMaterial({color: 0xffffff, map, transparent: true, opacity: 0, depthWrite: false,
    toneMapped: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1}));
  const scars = [];
  for (let k = 0; k < GROUND_POOLS.scars; k++) {
    const m = groundMat(scarTex), mesh = new THREE.Mesh(SG.decal, m);
    mesh.name = 'arena3d-fx-ground-scar'; mesh.visible = false; mesh.renderOrder = 7; mesh.frustumCulled = false;
    root.add(mesh); scars.push({mesh, m, active: false, age: 0});
  }
  const craters = [];
  for (let k = 0; k < GROUND_POOLS.craters; k++) {
    const m = groundMat(craterTex), mesh = new THREE.Mesh(SG.decal, m);
    mesh.name = 'arena3d-fx-ground-crater'; mesh.visible = false; mesh.renderOrder = 6; mesh.frustumCulled = false;
    root.add(mesh); craters.push({mesh, m, active: false, fading: 0, age: 0, born: 0, size: 1, x: 0, y: 0, z: 0, U: 1});
  }
  const DEBRIS = GROUND_POOLS.craters * GROUND_POOLS.debris;
  const debrisMesh = new THREE.InstancedMesh(SG.chunk, mat(new THREE.MeshStandardMaterial({color: 0x5a4636, roughness: 0.95, metalness: 0, flatShading: true})), DEBRIS);
  debrisMesh.name = 'arena3d-fx-ground-debris'; debrisMesh.frustumCulled = false;
  const zeroM = new THREE.Matrix4().makeScale(0, 0, 0);
  const debrisTint = new THREE.Color(0xffffff);
  // örnek rengi baştan var → parça (chunk) ile aynı gölgelendirici programı; ilk kraterde derleme yok
  for (let k = 0; k < DEBRIS; k++) { debrisMesh.setMatrixAt(k, zeroM); debrisMesh.setColorAt(k, debrisTint); }
  if (!GROUND_DAMAGE_ON) debrisMesh.count = 0;
  root.add(debrisMesh);
  const groundTotals = {scars: 0, craters: 0, heals: 0};
  let craterSerial = 0;
  function groundScar(x, y, z, U, size) {
    let rec = null;
    for (const s of scars) { if (!s.active) { rec = s; break; } if (!rec || s.age > rec.age) rec = s; }
    Object.assign(rec, {active: true, age: 0});
    rec.mesh.position.set(x, y + 0.012 * U, z); rec.mesh.rotation.set(0, Math.random() * TAU, 0);
    rec.mesh.scale.setScalar(size * U); rec.mesh.visible = true; rec.m.opacity = 0.9;
    groundTotals.scars++;
  }
  function placeDebris(k, c, scale) {
    for (let i = 0; i < GROUND_POOLS.debris; i++) {
      const a = (i / GROUND_POOLS.debris) * TAU + (k * 0.7), dd = c.size * c.U * (0.36 + (i % 3) * 0.05), s = c.U * (0.07 + (i % 2) * 0.05) * scale;
      tmpE.set(i * 0.9, a, i * 0.5); tmpQ.setFromEuler(tmpE);
      tmpA.set(c.x + Math.cos(a) * dd, c.y + s * 0.4, c.z + Math.sin(a) * dd); tmpS.set(s * 1.3, s, s);
      tmpM.compose(tmpA, tmpQ, tmpS); debrisMesh.setMatrixAt(k * GROUND_POOLS.debris + i, tmpM);
    }
    debrisMesh.instanceMatrix.needsUpdate = true;
  }
  function groundCrater(x, y, z, U, size, pal) {
    const live = craters.filter(c => c.active && !c.fading);
    if (live.length >= GROUND_POOLS.maxCraters) { // en eski krater solar (yer açılır)
      const old = live.reduce((a, b) => (a.born <= b.born ? a : b));
      old.fading = 1.2;
    }
    let k = craters.findIndex(c => !c.active);
    if (k < 0) { k = craters.findIndex(c => c.fading); craters[k].active = false; }
    const c = craters[k];
    Object.assign(c, {active: true, fading: 0, age: 0, born: ++craterSerial, size, x, y: y + 0.008 * U, z, U});
    c.mesh.position.set(x, c.y, z); c.mesh.rotation.set(0, Math.random() * TAU, 0);
    c.mesh.scale.setScalar(0.3 * size * U); c.mesh.visible = true; c.m.opacity = 1;
    placeDebris(k, c, 1);
    // göçük anı: yerden fırlayan taş parçaları + toz
    for (let n = 0; n < Math.round(10 * countScale()); n++) {
      const a = Math.random() * TAU;
      sigChunk(x, y + 0.1 * U, z, Math.cos(a) * rand(1.2, 3) * U, rand(2.5, 5) * U, Math.sin(a) * rand(1.2, 3) * U,
        rand(0.06, 0.13) * U, rand(0.05, 0.1) * U, rand(0.06, 0.12) * U, PAL.crumb.cool[1], rand(0.9, 1.4), y, U);
    }
    burst(x, y + 0.15 * U, z, {n: 24, speed: [0.6 * U, 2.2 * U], life: [0.8, 1.3], size: [0.25 * U, 0.45 * U], end: 1.6,
      grav: -0.25 * U, drag: 2.6, alpha: 0.35, pal: PAL.flour});
    if (pal) spawnRing(x, y + 0.02 * U, z, 'floor', 'thin', pal.ring, 0.3 * U, size * 0.9 * U, 0.45, 1);
    groundTotals.craters++;
  }
  function resetCraters() {
    for (const c of craters) { c.active = false; c.fading = 0; c.mesh.visible = false; c.m.opacity = 0; }
    for (let k = 0; k < DEBRIS; k++) debrisMesh.setMatrixAt(k, zeroM);
    debrisMesh.instanceMatrix.needsUpdate = true;
  }
  function updateGround(dt) {
    const life = GROUND_POOLS.scarLife;
    for (const s of scars) {
      if (!s.active) continue;
      s.age += dt;
      if (s.age >= life) { s.active = false; s.mesh.visible = false; s.m.opacity = 0; continue; }
      s.m.opacity = 0.9 * (s.age < life - 2 ? 1 : (life - s.age) / 2);
    }
    craters.forEach((c, k) => {
      if (!c.active) return;
      c.age += dt;
      if (c.age < 0.25) c.mesh.scale.setScalar((0.3 + 0.7 * easeOut3(c.age / 0.25)) * c.size * c.U);
      else if (c.mesh.scale.x !== c.size * c.U && !c.fading) c.mesh.scale.setScalar(c.size * c.U);
      if (c.fading) {
        c.fading = Math.max(0, c.fading - dt);
        const t = c.fading / 1.2;
        c.m.opacity = t; placeDebris(k, c, t);
        if (c.fading <= 0) { c.active = false; c.mesh.visible = false; for (let i = 0; i < GROUND_POOLS.debris; i++) debrisMesh.setMatrixAt(k * GROUND_POOLS.debris + i, zeroM); debrisMesh.instanceMatrix.needsUpdate = true; }
      }
    });
  }
  /** Temas karesi: Q/W → küçük iz; R son faz → krater (savunanın ayağının altında). */
  function groundDamage(ev) {
    if (!GROUND_DAMAGE_ON) return; // 13 Kas: kullanici zemindeki yarik/krateri istemedi
    if (ev.blocked || !(Number(ev.amount) > 0)) return;
    const d = seatInfo(ev.toSeat);
    if (!d) return;
    const U = unitScale(), g = d.ground;
    if (ev.skill === 'r') {
      const last = Number(ev.totalPhases) || 3;
      if (Number(ev.phase) === last || !ev.phase) groundCrater(g.x, g.y, g.z, U, 2.6, PAL[SIG_CONFIG[fighterOf(ev.fromSeat)?.fighterId]?.pal] || null);
    } else if (ev.skill === 'q' || ev.skill === 'e') groundScar(g.x + (Math.random() - 0.5) * 0.3 * U, g.y, g.z + (Math.random() - 0.5) * 0.3 * U, U, ev.skill === 'e' ? 1.35 : 1.0);
  }
  /** E (kendine can): karakterin kendi çevresinde, her karakterde farklı biçim (buhar sarmalı, rün halkası, kızıl nabız, gölge sisi, kalkan parıltısı). */
  function onHeal(ev) {
    const seat = ev.seat ?? ev.fromSeat;
    const d = seatInfo(seat);
    if (!d) return;
    const id = fighterOf(seat)?.fighterId || ev.fighter;
    const motif = HEAL_MOTIF[id] || 'steam';
    const pal = PAL[{steam: 'healSteam', runes: 'healRunes', pulse: 'healPulse', mist: 'healMist', aegis: 'healAegis'}[motif]];
    const U = unitScale(), c = d.anchor, g = d.ground, f = d.facing;
    groundTotals.heals++;
    flashLight(c.x, c.y, c.z, pal.light, 0.9, 0.7, U);
    if (motif === 'steam') {
      // buharlı bardak: elin önünden yükselen buhar + bedeni saran yeşil-altın sarmal
      const hx = c.x + f * 0.35 * U, hy = c.y + 0.1 * U;
      burst(hx, hy, c.z, {n: 18, speed: [0.2 * U, 0.6 * U], life: [0.9, 1.4], size: [0.18 * U, 0.34 * U], end: 2.2, grav: -1.1 * U, drag: 2.4, alpha: 0.45, pal: PAL.flour});
      for (let n = 0; n < 34; n++) {
        const a = n * 0.5, r = 0.55 * U, t = n / 34;
        spawn(g.x + Math.cos(a) * r, g.y + (0.1 + t * 2.1) * U, g.z + Math.sin(a) * r, -Math.sin(a) * 0.9 * U, 0.7 * U, Math.cos(a) * 0.9 * U,
          rand(0.7, 1.1), rand(0.07, 0.11) * U, 0.02 * U, 1, n % 2 ? pal.hot[2] : pal.hot[1], n % 2 ? pal.cool[1] : pal.cool[0], -0.4 * U, 1.2);
      }
      sigDecal(g.x, g.y + 0.017 * U, g.z, 'seljuk', pal.ring, 0.5 * U, 1.7 * U, 1.3, {spin: 1.2, a0: 0.8});
    } else if (motif === 'runes') {
      sigDecal(g.x, g.y + 0.017 * U, g.z, 'rune', pal.ring, 0.6 * U, 2.0 * U, 1.5, {spin: 2.2, a0: 0.95});
      for (let n = 0; n < 8; n++) {
        const a = (n / 8) * TAU;
        sigGlyph(g.x + Math.cos(a) * 0.8 * U, g.y + 0.2 * U, g.z + Math.sin(a) * 0.8 * U, 0, rand(1.0, 1.6) * U, 0, n % 2 ? GLYPH.runeA : GLYPH.runeB,
          pal.ring, 0.26 * U, 1.1, {drag: 1.2, spin: rand(-2, 2)});
      }
      SV.a.set(g.x, g.y + 0.1 * U, g.z); SV.b.set(g.x, g.y + 2.2 * U, g.z);
      sigWave(SV.a, 0, 1, 0, pal.ring, 0.8 * U, 0.8 * U, 0.9, {to: SV.b, thick: 0.8});
    } else if (motif === 'pulse') {
      // kan-kızıl nabız: göğüsten üç dalga (kalp atışı), yere vuran halkalar
      SV.a.set(c.x, c.y, c.z);
      sigWave(SV.a, f, 0, 0, pal.ring, 0.2 * U, 1.3 * U, 0.45, {thick: 1.6});
      sigWave(SV.a, f, 0, 0, pal.core, 0.15 * U, 1.9 * U, 0.65, {thick: 1.1});
      sigWave(SV.a, 0, 1, 0, pal.ring, 0.3 * U, 2.4 * U, 0.85, {thick: 1.3, a0: 0.7});
      burst(c.x, c.y, c.z, {n: 26, speed: [0.5 * U, 1.6 * U], life: [0.6, 1.0], size: [0.06 * U, 0.12 * U], end: 0.3, grav: -1.4 * U, drag: 2, pal});
      sigDecal(g.x, g.y + 0.017 * U, g.z, 'ember', pal.ring, 0.5 * U, 1.6 * U, 1.0, {a0: 0.75});
    } else if (motif === 'mist') {
      // gölge sis: ayaklardan yükselen mor sis bulutu (normal karışım) + sis içinde yeşil kıvılcımlar
      burst(g.x, g.y + 0.3 * U, g.z, {n: 30, speed: [0.3 * U, 1.0 * U], life: [1.1, 1.7], size: [0.35 * U, 0.6 * U], end: 1.8, grav: -0.35 * U, drag: 2.2, alpha: 0.32, pal});
      burst(c.x, c.y, c.z, {n: 14, speed: [0.3 * U, 0.9 * U], life: [0.7, 1.1], size: [0.05 * U, 0.08 * U], end: 0.2, grav: -1 * U, drag: 1.5, pal: PAL.healSteam});
      sigDecal(g.x, g.y + 0.017 * U, g.z, 'shadow', pal.ring, 0.7 * U, 2.0 * U, 1.4, {a0: 0.85});
    } else {
      // kalkan parıltısı: göğüs önünde altıgen kalkan + ayaktan başa yükselen altın halka
      spawnRing(c.x + f * 0.4 * U, c.y, c.z, 'face', 'hex', pal.ring, 0.6 * U, 1.3 * U, 0.7, 1, 3);
      SV.a.set(g.x, g.y + 0.1 * U, g.z); SV.b.set(g.x, g.y + 2.3 * U, g.z);
      sigWave(SV.a, 0, 1, 0, pal.ring, 0.75 * U, 0.75 * U, 0.8, {to: SV.b, thick: 1.4});
      for (let n = 0; n < 10; n++) sigGlyph(c.x + rand(-0.5, 0.5) * U, c.y + rand(-0.6, 0.6) * U, c.z, 0, rand(0.5, 1) * U, 0, GLYPH.sparkle, pal.core, 0.2 * U, 0.9, {drag: 1.5});
    }
    spawnRing(g.x, g.y + 0.02 * U, g.z, 'floor', 'thin', pal.ring, 0.4 * U, 1.6 * U, 0.6, 0.8);
  }
  const hpSeen = new Map();
  /** Yeni maç sezgisi: can bir anda raund iyileşme tavanından fazla artarsa (ya da azami can değişirse) kraterler silinir. */
  function watchHp(ev) {
    for (const p of Array.isArray(ev.players) ? ev.players : []) {
      const prev = hpSeen.get(p.seat);
      if (prev && (p.maxHp !== prev.maxHp || p.hp - prev.hp > 450)) resetCraters();
      hpSeen.set(p.seat, {hp: p.hp, maxHp: p.maxHp});
    }
  }
  function groundStats() {
    return {scars: scars.filter(s => s.active).length, craters: craters.filter(c => c.active && !c.fading).length,
      cratersFading: craters.filter(c => c.fading).length, totals: {...groundTotals}};
  }

  // --- (b) kalın dalga halkaları (ses dalgası, sema halkası, şok halkası): 12 torus
  const waves = [];
  for (let k = 0; k < SIG_POOLS.waves; k++) {
    const m = sigBasic(0xffffff, 0);
    const mesh = new THREE.Mesh(SG.wave, m);
    mesh.name = 'arena3d-fx-sig-wave'; mesh.visible = false; mesh.renderOrder = 10; mesh.frustumCulled = false;
    root.add(mesh);
    waves.push({mesh, m, active: false, age: 0, life: 0.5, s0: 0.1, s1: 1, a0: 1, from: new THREE.Vector3(), to: new THREE.Vector3(), moving: false, thick: 1});
  }
  /** Dalga halkası: (dx,dy,dz) halkanın ekseni; to verilirse halka from→to ilerler (koni). */
  function sigWave(from, dx, dy, dz, color, s0, s1, life, {a0 = 0.95, to = null, thick = 1} = {}) {
    if (!BIG_WAVES_ON) return;
    let rec = null;
    for (const w of waves) { if (!w.active) { rec = w; break; } if (!rec || w.age / w.life > rec.age / rec.life) rec = w; }
    rec.from.copy(from); rec.moving = Boolean(to);
    if (to) rec.to.copy(to);
    Object.assign(rec, {active: true, age: 0, life, s0, s1, a0, thick});
    tmpC.set(dx, dy, dz);
    if (tmpC.lengthSq() < 1e-8) tmpC.set(0, 1, 0);
    rec.mesh.quaternion.setFromUnitVectors(AXIS_Z, tmpC.normalize());
    rec.mesh.position.copy(from);
    rec.mesh.scale.set(s0, s0, s0 * thick);
    rec.m.color.copy(color);
    rec.m.opacity = a0;
    rec.mesh.visible = true;
    return rec;
  }
  function updateWaves(dt) {
    for (const w of waves) {
      if (!w.active) continue;
      w.age += dt;
      const p = w.age / w.life;
      if (p >= 1) { w.active = false; w.mesh.visible = false; continue; }
      const e = easeOut3(p);
      const s = w.s0 + (w.s1 - w.s0) * e;
      w.mesh.scale.set(s, s, Math.max(0.3, s * w.thick));
      if (w.moving) w.mesh.position.lerpVectors(w.from, w.to, e);
      w.m.opacity = w.a0 * (p < 0.1 ? p / 0.1 : (1 - p) * (1 - p * 0.4));
    }
  }

  // --- (c) atlas glifleri (nota, rün, yıldız, kesik): tek InstancedMesh, kameraya dönük
  const GMAX = SIG_POOLS.glyphs;
  const GL = {count: 0, pos: new Float32Array(GMAX * 3), vel: new Float32Array(GMAX * 3), age: new Float32Array(GMAX),
    life: new Float32Array(GMAX), size: new Float32Array(GMAX), spin: new Float32Array(GMAX), grav: new Float32Array(GMAX),
    drag: new Float32Array(GMAX), wob: new Float32Array(GMAX), a0: new Float32Array(GMAX)};
  const gCell = new THREE.InstancedBufferAttribute(new Float32Array(GMAX), 1).setUsage(THREE.DynamicDrawUsage);
  const gAlpha = new THREE.InstancedBufferAttribute(new Float32Array(GMAX), 1).setUsage(THREE.DynamicDrawUsage);
  const gRot = new THREE.InstancedBufferAttribute(new Float32Array(GMAX), 1).setUsage(THREE.DynamicDrawUsage);
  const gColor = new THREE.InstancedBufferAttribute(new Float32Array(GMAX * 3), 3).setUsage(THREE.DynamicDrawUsage);
  const glyphGeo = geo(new THREE.PlaneGeometry(1, 1));
  glyphGeo.setAttribute('aCell', gCell); glyphGeo.setAttribute('aAlpha', gAlpha);
  glyphGeo.setAttribute('aRot', gRot); glyphGeo.setAttribute('aColor', gColor);
  const glyphMat = mat(new THREE.ShaderMaterial({
    uniforms: {uMap: {value: glyphTex}, uHasMap: {value: Boolean(glyphTex)}, uGrid: {value: new THREE.Vector2(4, 2)}},
    vertexShader: GLYPH_VERT, fragmentShader: GLYPH_FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  }));
  const glyphMesh = new THREE.InstancedMesh(glyphGeo, glyphMat, GMAX);
  glyphMesh.name = 'arena3d-fx-sig-glyphs'; glyphMesh.frustumCulled = false; glyphMesh.count = 0; glyphMesh.renderOrder = 11;
  glyphMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  root.add(glyphMesh);
  function sigGlyph(x, y, z, vx, vy, vz, cell, color, size, life, {grav = 0, drag = 1, spin = 0, wob = 0, a0 = 1} = {}) {
    if (GL.count >= Math.round(GMAX * sigCapScale())) { totals.dropped++; return false; }
    const i = GL.count++, i3 = i * 3;
    GL.pos[i3] = x; GL.pos[i3 + 1] = y; GL.pos[i3 + 2] = z;
    GL.vel[i3] = vx; GL.vel[i3 + 1] = vy; GL.vel[i3 + 2] = vz;
    GL.age[i] = 0; GL.life[i] = life; GL.size[i] = size; GL.spin[i] = spin; GL.grav[i] = grav; GL.drag[i] = drag; GL.wob[i] = wob; GL.a0[i] = a0;
    gCell.array[i] = cell; gRot.array[i] = Math.random() * 0.6 - 0.3;
    gColor.array[i3] = color.r; gColor.array[i3 + 1] = color.g; gColor.array[i3 + 2] = color.b;
    totals.spawned++;
    return true;
  }
  function killGlyph(i) {
    const last = --GL.count;
    if (i === last) return;
    const i3 = i * 3, l3 = last * 3;
    for (let k = 0; k < 3; k++) { GL.pos[i3 + k] = GL.pos[l3 + k]; GL.vel[i3 + k] = GL.vel[l3 + k]; gColor.array[i3 + k] = gColor.array[l3 + k]; }
    for (const key of ['age', 'life', 'size', 'spin', 'grav', 'drag', 'wob', 'a0']) GL[key][i] = GL[key][last];
    gCell.array[i] = gCell.array[last]; gRot.array[i] = gRot.array[last];
  }
  function updateGlyphs(dt) {
    let i = 0;
    while (i < GL.count) {
      const age = GL.age[i] + dt;
      if (age >= GL.life[i]) { killGlyph(i); continue; }
      GL.age[i] = age;
      const i3 = i * 3, damp = Math.exp(-GL.drag[i] * dt);
      GL.vel[i3] *= damp; GL.vel[i3 + 1] = (GL.vel[i3 + 1] - GL.grav[i] * dt) * damp; GL.vel[i3 + 2] *= damp;
      GL.pos[i3] += GL.vel[i3] * dt;
      GL.pos[i3 + 1] += GL.vel[i3 + 1] * dt + Math.cos(age * 11) * GL.wob[i] * dt;
      GL.pos[i3 + 2] += GL.vel[i3 + 2] * dt;
      gRot.array[i] += GL.spin[i] * dt;
      const p = age / GL.life[i];
      gAlpha.array[i] = GL.a0[i] * Math.min(1, p / 0.12) * (1 - p * p);
      const s = GL.size[i] * (0.7 + 0.3 * Math.min(1, p * 5));
      tmpA.set(GL.pos[i3], GL.pos[i3 + 1], GL.pos[i3 + 2]);
      tmpS.set(s, s, s);
      glyphMesh.setMatrixAt(i, tmpM.compose(tmpA, tmpQ.identity(), tmpS));
      i++;
    }
    glyphMesh.count = GL.count;
    glyphMesh.instanceMatrix.needsUpdate = true;
    gCell.needsUpdate = true; gAlpha.needsUpdate = true; gRot.needsUpdate = true; gColor.needsUpdate = true;
  }

  // --- (d) parçalar (ekmek parçası, sur taşı): tek InstancedMesh + örnek rengi
  const CMAX = SIG_POOLS.chunks;
  const CH = {count: 0, pos: new Float32Array(CMAX * 3), vel: new Float32Array(CMAX * 3), rot: new Float32Array(CMAX * 3),
    spin: new Float32Array(CMAX * 3), size: new Float32Array(CMAX * 3), age: new Float32Array(CMAX), life: new Float32Array(CMAX),
    floor: new Float32Array(CMAX), unit: new Float32Array(CMAX), col: new Float32Array(CMAX * 3)};
  const chunkMat = mat(new THREE.MeshStandardMaterial({color: 0xffffff, roughness: 0.85, metalness: 0.05, flatShading: true}));
  const chunkMesh = new THREE.InstancedMesh(SG.chunk, chunkMat, CMAX);
  chunkMesh.name = 'arena3d-fx-sig-chunks'; chunkMesh.frustumCulled = false;
  chunkMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const chunkTint = new THREE.Color(0xffffff);
  for (let k = 0; k < CMAX; k++) chunkMesh.setColorAt(k, chunkTint); // örnek rengi özniteliği baştan var → program değişmez
  chunkMesh.count = 0;
  root.add(chunkMesh);
  function sigChunk(x, y, z, vx, vy, vz, sx, sy, sz, color, life, floorY, U) {
    if (CH.count >= Math.round(CMAX * sigCapScale())) { totals.dropped++; return false; }
    const i = CH.count++, i3 = i * 3;
    CH.pos[i3] = x; CH.pos[i3 + 1] = y; CH.pos[i3 + 2] = z;
    CH.vel[i3] = vx; CH.vel[i3 + 1] = vy; CH.vel[i3 + 2] = vz;
    CH.rot[i3] = Math.random() * TAU; CH.rot[i3 + 1] = Math.random() * TAU; CH.rot[i3 + 2] = Math.random() * TAU;
    CH.spin[i3] = rand(-9, 9); CH.spin[i3 + 1] = rand(-9, 9); CH.spin[i3 + 2] = rand(-9, 9);
    CH.size[i3] = sx; CH.size[i3 + 1] = sy; CH.size[i3 + 2] = sz;
    CH.col[i3] = color.r; CH.col[i3 + 1] = color.g; CH.col[i3 + 2] = color.b;
    CH.age[i] = 0; CH.life[i] = life; CH.floor[i] = floorY; CH.unit[i] = U;
    totals.spawned++;
    return true;
  }
  function killChunk(i) {
    const last = --CH.count;
    if (i === last) return;
    const i3 = i * 3, l3 = last * 3;
    for (const key of ['pos', 'vel', 'rot', 'spin', 'size', 'col']) for (let k = 0; k < 3; k++) CH[key][i3 + k] = CH[key][l3 + k];
    CH.age[i] = CH.age[last]; CH.life[i] = CH.life[last]; CH.floor[i] = CH.floor[last]; CH.unit[i] = CH.unit[last];
  }
  function updateChunks(dt) {
    let i = 0;
    while (i < CH.count) {
      const age = CH.age[i] + dt;
      if (age >= CH.life[i]) { killChunk(i); continue; }
      CH.age[i] = age;
      const i3 = i * 3, U = CH.unit[i];
      CH.vel[i3 + 1] -= 9.8 * U * dt;
      CH.pos[i3] += CH.vel[i3] * dt; CH.pos[i3 + 1] += CH.vel[i3 + 1] * dt; CH.pos[i3 + 2] += CH.vel[i3 + 2] * dt;
      const half = CH.size[i3 + 1] * 0.5;
      if (CH.pos[i3 + 1] <= CH.floor[i] + half) {
        CH.pos[i3 + 1] = CH.floor[i] + half;
        CH.vel[i3 + 1] = Math.abs(CH.vel[i3 + 1]) * 0.22;
        CH.vel[i3] *= 0.55; CH.vel[i3 + 2] *= 0.55;
        CH.spin[i3] *= 0.4; CH.spin[i3 + 1] *= 0.4; CH.spin[i3 + 2] *= 0.4;
      }
      CH.rot[i3] += CH.spin[i3] * dt; CH.rot[i3 + 1] += CH.spin[i3 + 1] * dt; CH.rot[i3 + 2] += CH.spin[i3 + 2] * dt;
      const remain = CH.life[i] - age, k = remain < 0.3 ? remain / 0.3 : 1;
      tmpA.set(CH.pos[i3], CH.pos[i3 + 1], CH.pos[i3 + 2]);
      tmpQ.setFromEuler(tmpE.set(CH.rot[i3], CH.rot[i3 + 1], CH.rot[i3 + 2]));
      tmpS.set(CH.size[i3] * k, CH.size[i3 + 1] * k, CH.size[i3 + 2] * k);
      chunkMesh.setMatrixAt(i, tmpM.compose(tmpA, tmpQ, tmpS));
      chunkMesh.setColorAt(i, chunkTint.setRGB(CH.col[i3], CH.col[i3 + 1], CH.col[i3 + 2]));
      i++;
    }
    chunkMesh.count = CH.count;
    chunkMesh.instanceMatrix.needsUpdate = true;
    if (chunkMesh.instanceColor) chunkMesh.instanceColor.needsUpdate = true;
  }

  // --- (e) gölge izleri (Sira'nın mızrak/hançer art görüntüleri): 8 kalıcı mesh
  const ghosts = [];
  for (let k = 0; k < SIG_POOLS.ghosts; k++) {
    const m = sigBasic(0xa14dff, 0);
    const mesh = new THREE.Mesh(SG.ghost, m);
    mesh.name = 'arena3d-fx-sig-ghost'; mesh.visible = false; mesh.frustumCulled = false; mesh.renderOrder = 9;
    root.add(mesh);
    ghosts.push({mesh, m, active: false, age: 0, life: 0.2});
  }
  function sigGhost(pos, quat, scale, color, life) {
    let rec = null;
    for (const g of ghosts) { if (!g.active) { rec = g; break; } if (!rec || g.age > rec.age) rec = g; }
    Object.assign(rec, {active: true, age: 0, life});
    rec.mesh.position.copy(pos); rec.mesh.quaternion.copy(quat); rec.mesh.scale.setScalar(scale);
    rec.m.color.copy(color); rec.m.opacity = 0.55; rec.mesh.visible = true;
  }
  function updateGhosts(dt) {
    for (const g of ghosts) {
      if (!g.active) continue;
      g.age += dt;
      const p = g.age / g.life;
      if (p >= 1) { g.active = false; g.mesh.visible = false; continue; }
      g.m.opacity = 0.55 * (1 - p);
      g.mesh.scale.y = g.mesh.scale.z = g.mesh.scale.x * (1 + p * 1.5);
    }
  }

  // --- (f) silah izi şeritleri: kemik (el) + uç tahmini, 14 örnekli üçgen şeridi
  const RN = 14;
  const ribbons = [];
  for (let k = 0; k < SIG_POOLS.ribbons; k++) {
    const g = geo(new THREE.BufferGeometry());
    const pos = new Float32Array(RN * 2 * 3), fade = new Float32Array(RN * 2), side = new Float32Array(RN * 2), index = [];
    for (let i = 0; i < RN; i++) {
      fade[i * 2] = fade[i * 2 + 1] = 1 - i / (RN - 1);
      side[i * 2] = 0; side[i * 2 + 1] = 1;
      if (i < RN - 1) { const a = i * 2; index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const posAttr2 = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', posAttr2);
    g.setAttribute('aFade', new THREE.BufferAttribute(fade, 1));
    g.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
    g.setIndex(index);
    const m = mat(new THREE.ShaderMaterial({uniforms: {uColor: {value: new THREE.Color()}, uOpacity: {value: 0}},
      vertexShader: RIBBON_VERT, fragmentShader: RIBBON_FRAG, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide}));
    const mesh = new THREE.Mesh(g, m);
    mesh.name = 'arena3d-fx-sig-ribbon'; mesh.visible = false; mesh.frustumCulled = false; mesh.renderOrder = 10;
    root.add(mesh);
    ribbons.push({mesh, m, pos, attr: posAttr2, active: false, seat: 0, bone: 'handslot.r', len: 1, start: 0, end: 0, primed: false});
  }
  let sigClock = 0; // imza benzetim saati (sn; ağır çekim/hit-stop ile yavaşlar)
  function sigRibbon(seat, bone, len, color, startIn, dur) {
    let rec = ribbons.find(r => !r.active) || ribbons.reduce((a, b) => (a.end < b.end ? a : b));
    Object.assign(rec, {active: true, seat, bone, len, start: sigClock + startIn, end: sigClock + startIn + dur, primed: false});
    rec.m.uniforms.uColor.value.copy(color);
    rec.m.uniforms.uOpacity.value = 0;
    return rec;
  }
  function ribbonSample(rec, U) {
    const rig = fighterOf(rec.seat)?.rig;
    if (!rig?.boneWorld) return false;
    rig.boneWorld(rec.bone, SV.hand);
    rig.boneWorld('chest', SV.chest);
    tmpC.subVectors(SV.hand, SV.chest);
    if (tmpC.lengthSq() < 1e-8) tmpC.set(facing(rec.seat), 0.3, 0);
    tmpC.normalize();
    SV.a.copy(SV.hand).addScaledVector(tmpC, 0.08 * U);
    SV.b.copy(SV.hand).addScaledVector(tmpC, rec.len * U);
    return true;
  }
  function updateRibbons() {
    const U = unitScale();
    for (const r of ribbons) {
      if (!r.active) continue;
      if (sigClock < r.start) continue;
      const tail = sigClock - r.end;
      if (tail > 0.14) { r.active = false; r.mesh.visible = false; continue; }
      if (!ribbonSample(r, U)) { r.active = false; r.mesh.visible = false; continue; }
      if (!r.primed) {
        for (let i = 0; i < RN; i++) { SV.a.toArray(r.pos, i * 6); SV.b.toArray(r.pos, i * 6 + 3); }
        r.primed = true;
      } else {
        r.pos.copyWithin(6, 0, (RN - 1) * 6);
        SV.a.toArray(r.pos, 0); SV.b.toArray(r.pos, 3);
      }
      r.attr.needsUpdate = true;
      r.m.uniforms.uOpacity.value = 0.9 * (tail > 0 ? 1 - tail / 0.14 : Math.min(1, (sigClock - r.start) / 0.06));
      r.mesh.visible = true;
    }
  }

  // --- (g) ekran kenarı renk darbesi (kameraya bağlı tek dörtgen)
  const edgeMat = mat(new THREE.ShaderMaterial({uniforms: {uColor: {value: new THREE.Color()}, uOpacity: {value: 0}},
    vertexShader: EDGE_VERT, fragmentShader: EDGE_FRAG, transparent: true, depthTest: false, depthWrite: false,
    blending: THREE.AdditiveBlending}));
  const edgeQuad = new THREE.Mesh(geo(new THREE.PlaneGeometry(2, 2)), edgeMat);
  edgeQuad.name = 'arena3d-fx-sig-edge'; edgeQuad.frustumCulled = false; edgeQuad.renderOrder = 998; edgeQuad.visible = false;
  if (camera?.add) camera.add(edgeQuad); else root.add(edgeQuad);
  const edge = {age: 0, life: 0, peak: 0, count: 0};
  function edgePulse(hex, strength, ms) {
    edgeMat.uniforms.uColor.value.setHex(hex);
    Object.assign(edge, {age: 0, life: Math.max(0.05, ms / 1000), peak: clamp(strength, 0, 1)});
    edge.count++;
  }
  function updateEdge(dt) {
    if (edge.life <= 0) { edgeQuad.visible = false; return; }
    edge.age += dt;
    const p = edge.age / edge.life;
    if (p >= 1) { edge.life = 0; edgeQuad.visible = false; edgeMat.uniforms.uOpacity.value = 0; return; }
    // iki atımlı titreşim: hızlı açılış, kısa sönüm, ikinci küçük atım
    const pulse = p < 0.12 ? p / 0.12 : (1 - p) * (0.75 + 0.25 * Math.cos((p - 0.12) * 18));
    edgeMat.uniforms.uOpacity.value = edge.peak * pulse;
    edgeQuad.visible = true;
  }

  // --- (h) imza mermileri: 4 kayıt; her kayıtta tüm türlerin gövdesi (görünürlükle seçilir)
  const sigProjectiles = [];
  for (let k = 0; k < SIG_POOLS.projectiles; k++) {
    const group = new THREE.Group();
    group.name = 'arena3d-fx-sig-projectile'; group.visible = false;
    const body = new THREE.Group();
    group.add(body);
    const parts = {bread: new THREE.Group(), spear: new THREE.Group(), dagger: new THREE.Group(), rune: new THREE.Group(), meteor: new THREE.Group()};
    const bread = new THREE.Mesh(SG.bread, SM.bread); bread.scale.set(0.46, 0.06, 0.17); parts.bread.add(bread);
    parts.spear.add(new THREE.Mesh(SG.shaft, SM.siraEnergy), new THREE.Mesh(SG.tip, SM.siraCore));
    parts.dagger.add(new THREE.Mesh(SG.blade, SM.siraCore));
    const shard = new THREE.Mesh(G.octa, SM.nyxCore); shard.scale.set(0.1, 0.2, 0.1);
    const hex = new THREE.Mesh(G.ringHex, SM.nyxRing); hex.scale.setScalar(0.28); hex.rotation.y = Math.PI / 2;
    parts.rune.add(shard, hex);
    const met = new THREE.Mesh(G.sphere, SM.meteorCore); met.scale.setScalar(0.3); parts.meteor.add(met);
    for (const p of Object.values(parts)) { p.visible = false; body.add(p); }
    const glows = {konyali: new THREE.Mesh(G.plane, SM.konyaliGlow), sira: new THREE.Mesh(G.plane, SM.siraGlow), nyx: new THREE.Mesh(G.plane, SM.nyxGlow)};
    for (const gm of Object.values(glows)) { gm.visible = false; group.add(gm); }
    group.traverse(o => { o.frustumCulled = false; });
    root.add(group);
    sigProjectiles.push({group, body, parts, glows, active: false, kind: 'bread', id: '', age: 0, flight: 0.3, arc: 0,
      from: new THREE.Vector3(), to: new THREE.Vector3(), prev: new THREE.Vector3(), onArrive: null, unit: 1,
      acc: 0, ghostAcc: 0, spin: 0, glow: null, toSeat: 2});
  }
  function releaseSigProjectile(rec, arrive) {
    if (!rec.active) return;
    rec.active = false;
    rec.group.visible = false;
    if (arrive) { const fn = rec.onArrive; rec.onArrive = null; try { fn?.(); } catch { /* kozmetik */ } }
    rec.onArrive = null;
  }
  function sigProjectile(kind, id, from, to, flightS, U, onArrive, toSeat) {
    let rec = sigProjectiles.find(r => !r.active);
    if (!rec) { rec = sigProjectiles.reduce((a, b) => (a.age / a.flight > b.age / b.flight ? a : b)); releaseSigProjectile(rec, true); }
    Object.assign(rec, {active: true, kind, id, age: 0, flight: Math.max(0.05, flightS), unit: U, onArrive, acc: 0, ghostAcc: 0, spin: 0, toSeat, log: currentLog,
      arc: (kind === 'bread' ? 0.6 : kind === 'rune' ? 0.25 : kind === 'meteor' ? 0 : 0.15) * U});
    rec.from.copy(from); rec.to.copy(to);
    if (kind === 'meteor') rec.from.set(to.x - (to.x - from.x) * 0.35, to.y + 6.5 * U, to.z - 1.6 * U);
    rec.prev.copy(rec.from);
    for (const [k, p] of Object.entries(rec.parts)) p.visible = k === kind;
    const glowKey = kind === 'bread' ? 'konyali' : kind === 'spear' || kind === 'dagger' ? 'sira' : 'nyx';
    for (const [k, gm] of Object.entries(rec.glows)) gm.visible = k === glowKey;
    rec.glow = rec.glows[glowKey];
    rec.glow.scale.setScalar(kind === 'meteor' ? 2.2 : kind === 'bread' ? 0.9 : 0.7);
    rec.group.scale.setScalar(U * (kind === 'meteor' ? 1.6 : 1));
    rec.group.position.copy(rec.from);
    rec.body.quaternion.identity();
    rec.group.visible = true;
    return rec;
  }
  function updateSigProjectiles(dt) {
    const scale = countScale();
    for (const rec of sigProjectiles) {
      if (!rec.active) continue;
      const spawned0 = totals.spawned;
      rec.age += dt;
      const U = rec.unit, p = Math.min(1, rec.age / rec.flight);
      rec.prev.copy(rec.group.position);
      const pos = rec.group.position;
      if (rec.kind === 'meteor') pos.lerpVectors(rec.from, rec.to, p * p);
      else { pos.lerpVectors(rec.from, rec.to, easeOut3(p) * 0.15 + p * 0.85); pos.y += Math.sin(Math.PI * p) * rec.arc; }
      rec.glow.quaternion.copy(camQ);
      tmpC.subVectors(pos, rec.prev);
      const moved = tmpC.length();
      const vx = tmpC.x / Math.max(dt, 1e-4), vy = tmpC.y / Math.max(dt, 1e-4), vz = tmpC.z / Math.max(dt, 1e-4);
      if (rec.kind === 'bread') {
        // Havada dönerek (kendi düşey ekseninde hızlı, hafif yalpa) yay çizer.
        rec.spin += dt * 17;
        rec.body.rotation.set(0.35 + Math.sin(rec.age * 9) * 0.15, rec.spin, Math.sin(rec.age * 6) * 0.2);
      } else if (rec.kind === 'spear' || rec.kind === 'dagger') {
        if (moved > 1e-5) rec.body.quaternion.setFromUnitVectors(AXIS_X, tmpC.multiplyScalar(1 / moved));
        if (rec.kind === 'dagger') { rec.spin += dt * 30; rec.parts.dagger.rotation.x = rec.spin; }
        rec.ghostAcc += dt;
        if (rec.ghostAcc >= 0.03) { rec.ghostAcc = 0; rec.body.getWorldQuaternion(SV.q); sigGhost(pos, SV.q, U, PAL.sira.cool[0], 0.22); }
      } else {
        rec.spin += dt * (rec.kind === 'meteor' ? 5 : 14);
        rec.body.rotation.set(rec.spin * 0.5, rec.spin, 0.3);
      }
      // Uçuş izi
      rec.acc += (rec.kind === 'meteor' ? 260 : rec.kind === 'bread' ? 150 : 120) * scale * dt;
      while (rec.acc >= 1) {
        rec.acc -= 1;
        const f = Math.random();
        const px = rec.prev.x + (pos.x - rec.prev.x) * f, py = rec.prev.y + (pos.y - rec.prev.y) * f, pz = rec.prev.z + (pos.z - rec.prev.z) * f;
        if (rec.kind === 'bread') {
          if (Math.random() < 0.62) {
            // un tozu izi: beyaz, yavaş, havada asılı kalır
            spawn(px + rand(-0.06, 0.06) * U, py, pz + rand(-0.06, 0.06) * U, -vx * 0.05 + rand(-0.3, 0.3) * U, rand(-0.2, 0.3) * U, rand(-0.3, 0.3) * U,
              rand(0.45, 0.85), rand(0.07, 0.13) * U, rand(0.18, 0.3) * U, 0.45, pick(PAL.flour.hot), pick(PAL.flour.cool), 0.4 * U, 3.2);
          } else {
            // buhar: yükselip genişleyen sönük bulut
            spawn(px, py + 0.04 * U, pz, rand(-0.15, 0.15) * U, rand(0.6, 1.1) * U, rand(-0.15, 0.15) * U,
              rand(0.5, 0.8), rand(0.06, 0.1) * U, rand(0.25, 0.4) * U, 0.28, PAL.flour.hot[1], PAL.flour.cool[2], -0.5 * U, 2.2);
          }
        } else if (rec.kind === 'meteor') {
          spawn(px, py, pz, -vx * 0.1 + rand(-0.6, 0.6) * U, rand(-0.2, 0.8) * U, rand(-0.6, 0.6) * U,
            rand(0.3, 0.6), rand(0.12, 0.24) * U, 0.04 * U, 0.95, pick(PAL.nyx.hot), pick(PAL.fire.cool), -0.6 * U, 2);
        } else if (rec.kind === 'rune') {
          spawn(px, py, pz, rand(-0.4, 0.4) * U, rand(-0.4, 0.4) * U, rand(-0.4, 0.4) * U,
            rand(0.2, 0.42), rand(0.06, 0.12) * U, 0.01 * U, 0.9, pick(PAL.nyx.hot), pick(PAL.nyx.cool), 0, 3);
        } else {
          spawn(px, py, pz, -vx * 0.04, -vy * 0.04 + rand(-0.15, 0.15) * U, -vz * 0.04,
            rand(0.18, 0.3), rand(0.05, 0.09) * U, 0.01 * U, 0.9, pick(PAL.sira.hot), pick(PAL.sira.cool), 0, 4);
        }
      }
      if (rec.kind === 'rune' && Math.random() < dt * 14) {
        sigGlyph(pos.x, pos.y, pos.z, rand(-0.3, 0.3) * U, rand(0.1, 0.5) * U, rand(-0.2, 0.2) * U,
          Math.random() < 0.5 ? GLYPH.runeA : GLYPH.runeB, PAL.nyx.ring, 0.16 * U, 0.4, {drag: 2, spin: rand(-3, 3)});
      }
      if (p >= 1) projectileArrival(rec);
      if (rec.log) rec.log.particles += totals.spawned - spawned0;
      if (p >= 1) releaseSigProjectile(rec, true);
    }
  }
  /** Mermiye özgü varış: ekmek parçalanır (un bulutu + kırıntı + ekmek parçaları); rün/mızrak kıvılcımı. */
  function projectileArrival(rec) {
    const p = rec.group.position, U = rec.unit;
    const d = seatInfo(rec.toSeat);
    const gy = d ? d.ground.y : p.y - 1.2 * U;
    if (rec.kind === 'bread') {
      burst(p.x, p.y, p.z, {n: 30, speed: [0.8 * U, 2.6 * U], life: [0.6, 1.0], size: [0.16 * U, 0.3 * U], end: 2.2,
        grav: -0.2 * U, drag: 3.2, alpha: 0.42, pal: PAL.flour});
      burst(p.x, p.y, p.z, {n: 22, speed: [1.5 * U, 4.2 * U], life: [0.45, 0.8], size: [0.04 * U, 0.08 * U], end: 0.6,
        grav: 9 * U, drag: 1.2, up: 1.2 * U, pal: PAL.crumb});
      const n = Math.round(7 * countScale()) + 1;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * TAU + rand(-0.3, 0.3);
        sigChunk(p.x, p.y, p.z, Math.cos(a) * rand(1, 2.6) * U, rand(1, 3) * U, Math.sin(a) * rand(0.6, 1.6) * U,
          rand(0.08, 0.16) * U, 0.035 * U, rand(0.06, 0.1) * U, pick(PAL.crumb.hot), rand(0.8, 1.1), gy, U);
      }
    } else if (rec.kind === 'spear' || rec.kind === 'dagger') {
      const f = d ? -d.facing : 1;
      for (let k = 0; k < Math.round(14 * countScale()); k++) {
        spawn(p.x, p.y, p.z, f * rand(3, 8) * U, rand(-1, 1.5) * U, rand(-1.2, 1.2) * U,
          rand(0.15, 0.3), rand(0.05, 0.1) * U, 0.01 * U, 1, pick(PAL.sira.hot), pick(PAL.sira.cool), 2 * U, 3);
      }
    } else if (rec.kind === 'rune') {
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU;
        sigGlyph(p.x, p.y, p.z, Math.cos(a) * 1.4 * U, Math.sin(a) * 1.4 * U, 0, k % 2 ? GLYPH.runeA : GLYPH.runeB,
          PAL.nyx.ring, 0.2 * U, 0.5, {drag: 3, spin: rand(-4, 4)});
      }
    } else if (rec.kind === 'meteor') {
      bigExplosion('nyx', p.x, p.y + 0.2 * U, p.z, rec.toSeat, U, 0.8);
    }
  }

  // --- (i) imza yayıcıları: girdap (kasırga/sema), ney dalgası, toplanma, yıldız yağmuru, rün yükselişi
  const sigEmitters = [];
  for (let k = 0; k < SIG_POOLS.emitters; k++) sigEmitters.push({active: false, type: '', seat: 1, toSeat: 2, age: 0, life: 0, acc: 0, acc2: 0, rate: 0, pal: PAL.fire, U: 1, id: '', log: null});
  function sigEmitter(type, seat, toSeat, life, rate, pal, U, id) {
    let slot = null;
    for (const e of sigEmitters) { if (!e.active) { slot = e; break; } if (!slot || e.age / e.life > slot.age / slot.life) slot = e; }
    Object.assign(slot, {active: true, type, seat, toSeat, age: 0, life, acc: 0, acc2: 0, rate, pal, U, id, log: currentLog});
    return slot;
  }
  function neyTip(seat, U, out) {
    const rig = fighterOf(seat)?.rig;
    if (rig?.boneWorld) rig.boneWorld('head', out);
    else { const a = api.seatAnchor?.(seat); if (a) out.copy(a).setY(a.y + 0.45 * U); }
    out.x += facing(seat) * 0.45 * U; out.y -= 0.06 * U;
    return out;
  }
  function updateSigEmitters(dt) {
    const scale = countScale();
    for (const e of sigEmitters) {
      if (!e.active) continue;
      e.age += dt;
      if (e.age >= e.life) { e.active = false; continue; }
      const U = e.U, k = e.age / e.life;
      const anchor = api.seatAnchor?.(e.seat);
      if (!anchor) { e.active = false; continue; }
      const before = totals.spawned;
      e.acc += e.rate * scale * dt;
      e.acc2 += dt;
      if (e.type === 'vortex' || e.type === 'sema') {
        const g = api.seatGround?.(e.seat);
        const waist = anchor.y - (e.type === 'sema' ? 0.55 : 0.3) * U;
        while (e.acc >= 1) {
          e.acc -= 1;
          const a = Math.random() * TAU, R = rand(0.5, 0.85) * U;
          const tang = (e.type === 'sema' ? 6.5 : 5) * U;
          spawn(anchor.x + Math.cos(a) * R, waist + rand(-0.35, 0.45) * U, anchor.z + Math.sin(a) * R * 0.8,
            -Math.sin(a) * tang, rand(0.3, 1.2) * U, Math.cos(a) * tang * 0.8,
            e.type === 'sema' ? rand(0.25, 0.45) : rand(0.3, 0.55), (e.type === 'sema' ? rand(0.04, 0.08) : rand(0.08, 0.15)) * U, 0.01 * U,
            0.95, pick(e.pal.hot), pick(e.pal.cool), e.type === 'sema' ? 0 : -0.6 * U, e.type === 'sema' ? 0.6 : 1.6);
        }
        const every = e.type === 'sema' ? 0.12 : 0.16;
        if (e.acc2 >= every && g) {
          e.acc2 = 0;
          // genişleyen sıcak girdap halkası (sema: etek hizasında; kasırga: yerden göğse yükselen)
          const y = e.type === 'sema' ? anchor.y - 0.85 * U : g.y + rand(0.1, 0.9) * U;
          SV.a.set(anchor.x, y, anchor.z);
          SV.b.set(anchor.x, y + 0.25 * U, anchor.z);
          sigWave(SV.a, 0, 1, 0, Math.random() < 0.5 ? e.pal.ring : e.pal.cool[1], 0.45 * U, (e.type === 'sema' ? 1.9 : 1.4) * U, 0.5,
            {to: SV.b, thick: 1.4, a0: 0.85});
        }
      } else if (e.type === 'ney') {
        const tip = neyTip(e.seat, U, SV.c);
        const to = api.seatAnchor?.(e.toSeat);
        if (!to) continue;
        const dir = SV.d.subVectors(to, tip);
        if (e.acc2 >= 0.1) {
          e.acc2 = 0;
          // SES DALGASI: neyin ucundan çıkıp rakibe giderken genişleyen kalın halka (koni)
          sigWave(tip, dir.x, dir.y, dir.z, Math.random() < 0.6 ? e.pal.ring : e.pal.hot[1], 0.12 * U, 0.95 * U, 0.42,
            {to, thick: 2.2, a0: 1});
        }
        while (e.acc >= 1) {
          e.acc -= 1;
          const cell = Math.random() < 0.45 ? GLYPH.note : Math.random() < 0.7 ? GLYPH.notes : GLYPH.sparkle;
          sigGlyph(tip.x, tip.y + rand(-0.1, 0.1) * U, tip.z + rand(-0.15, 0.15) * U,
            dir.x * rand(1.4, 2.2), dir.y * 1.6 + rand(0.2, 0.8) * U, dir.z * 1.6 + rand(-0.4, 0.4) * U,
            cell, Math.random() < 0.5 ? e.pal.ring : e.pal.core, rand(0.14, 0.22) * U, rand(0.45, 0.7), {drag: 1.2, wob: 1.6 * U, spin: rand(-2, 2)});
          spawn(tip.x, tip.y, tip.z, dir.x * rand(1.5, 2.5), dir.y * 2 + rand(-0.3, 0.3) * U, dir.z * 2 + rand(-0.4, 0.4) * U,
            rand(0.3, 0.5), rand(0.05, 0.09) * U, 0.01 * U, 0.85, pick(e.pal.hot), pick(e.pal.cool), 0, 1.5);
        }
      } else if (e.type === 'gather') {
        const rig = fighterOf(e.seat)?.rig;
        if (rig?.boneWorld) rig.boneWorld('handslot.r', SV.d); else SV.d.copy(anchor);
        while (e.acc >= 1) {
          e.acc -= 1;
          const u = Math.random() * 2 - 1, th = Math.random() * TAU, r = Math.sqrt(1 - u * u), R = rand(0.6, 1.0) * U;
          const x = SV.d.x + r * Math.cos(th) * R, y = SV.d.y + u * R, z = SV.d.z + r * Math.sin(th) * R;
          spawn(x, y, z, (SV.d.x - x) * 3.6, (SV.d.y - y) * 3.6, (SV.d.z - z) * 3.6,
            0.26, rand(0.05, 0.1) * U, 0.12 * U, 0.95, pick(e.pal.hot), pick(e.pal.cool), 0, 0);
        }
      } else if (e.type === 'starfall') {
        const g = api.seatGround?.(e.toSeat);
        if (!g) continue;
        while (e.acc >= 1) {
          e.acc -= 1;
          spawn(g.x + rand(-1.5, 1.5) * U, g.y + rand(3, 4.5) * U, g.z + rand(-0.8, 0.8) * U,
            rand(-0.5, 0.5) * U, -rand(6, 9) * U, 0, rand(0.35, 0.55), rand(0.06, 0.12) * U, 0.02 * U, 1,
            pick(e.pal.hot), pick(e.pal.cool), 0, 0);
        }
        if (e.acc2 >= 0.09) {
          e.acc2 = 0;
          sigGlyph(g.x + rand(-1.3, 1.3) * U, g.y + rand(2.5, 3.5) * U, g.z, 0, -rand(4, 6) * U, 0, GLYPH.sparkle,
            e.pal.core, rand(0.18, 0.3) * U, 0.55, {spin: rand(-4, 4)});
        }
      } else if (e.type === 'rise') {
        const g = api.seatGround?.(e.toSeat);
        if (!g) continue;
        if (e.acc2 >= 0.06) {
          e.acc2 = 0;
          const a = Math.random() * TAU;
          sigGlyph(g.x + Math.cos(a) * 0.65 * U, g.y + rand(0.1, 0.6) * U, g.z + Math.sin(a) * 0.65 * U, 0, rand(1.6, 2.6) * U, 0,
            Math.random() < 0.5 ? GLYPH.runeA : GLYPH.runeB, e.pal.ring, rand(0.18, 0.26) * U, 0.7, {drag: 0.5, spin: rand(-1, 1)});
        }
        while (e.acc >= 1) {
          e.acc -= 1;
          const a = Math.random() * TAU;
          spawn(g.x + Math.cos(a) * 0.5 * U, g.y + 0.1 * U, g.z + Math.sin(a) * 0.5 * U, 0, rand(3, 5) * U, 0,
            rand(0.4, 0.7), rand(0.05, 0.1) * U, 0.01 * U, 0.9, pick(e.pal.hot), pick(e.pal.cool), 0, 0.5);
        }
      }
      void k;
      if (e.log) e.log.particles += totals.spawned - before;
    }
  }

  // --- (j) imza zamanlayıcıları (benzetim saatinde; şerit pencereleri, gecikmeli halkalar)
  const sigTimers = [];
  function sigAfter(sec, fn) { if (sigTimers.length < 24) sigTimers.push({at: sigClock + sec, fn}); }
  function updateSigTimers() {
    for (let i = sigTimers.length - 1; i >= 0; i--) {
      if (sigTimers[i].at <= sigClock) { const [t] = sigTimers.splice(i, 1); try { t.fn(); } catch { /* kozmetik */ } }
    }
  }

  // --- (k) hata ayıklama sayaçları: efekt adı, parçacık sayısı, yürütme süresi (ms)
  const sigLog = [];
  const sigCounts = {};
  let currentLog = null;
  function logSig(name) {
    const row = {name, particles: 0, ms: 0, t: Math.round(perfNow())};
    sigLog.push(row);
    if (sigLog.length > 96) sigLog.shift();
    sigCounts[name] = (sigCounts[name] || 0) + 1;
    return row;
  }

  // --- (l) aşamalar ------------------------------------------------------------
  function palFor(cfg, skill) { return PAL[(skill === 'r' && cfg.ultPal) || cfg.pal]; }

  /** Telegraf (hazırlık, ~350 ms): zeminde karakter deseni + elde toplanan enerji + silah izi pencereleri. */
  function sigCast(id, cfg, a) {
    const from = seatInfo(a.seat), to = seatInfo(a.def);
    if (!from || !to) return;
    const U = unitScale(), R = a.skill === 'r', pal = palFor(cfg, a.skill);
    const g = from.ground;
    sigDecal(g.x, g.y + 0.012 * U, g.z, cfg.castDecal, pal.ring, 0.5 * U, (R ? 2.6 : 1.6) * U, R ? 1.0 : 0.75,
      {spin: cfg.castDecal === 'seljuk' || cfg.castDecal === 'rune' ? (R ? 1.6 : 1.1) : 0, a0: R ? 1 : 0.85, seat: a.seat});
    sigEmitter('gather', a.seat, a.def, R ? 0.6 : 0.35, R ? 300 : 170, pal, U, id);
    tmpA.copy(from.anchor);
    flashLight(tmpA.x + from.facing * 0.3 * U, tmpA.y, tmpA.z, pal.light, R ? 0.9 : 0.45, R ? 0.5 : 0.32, U);
    if (R) {
      edgePulse(pal.flashHex, 0.22, 420);
      if (BIG_WAVES_ON) spawnRing(g.x, g.y + 0.02 * U, g.z, 'floor', 'thin', pal.ring, 2.4 * U, 0.4 * U, 0.55, 0.9);
    }
    if (id === 'nyx' && (a.skill === 'e' || R)) {
      // hedef telegrafı: rakibin altında açılan rün halkası
      sigDecal(to.ground.x, to.ground.y + 0.014 * U, to.ground.z, 'rune', pal.ring, 0.3 * U, (R ? 2.6 : 1.5) * U, R ? 1.4 : 1.0, {spin: -1.4, seat: a.def});
    }
    if (id === 'konyali' && a.skill === 'q') {
      const rig = fighterOf(a.seat)?.rig;
      if (rig?.boneWorld) rig.boneWorld('handslot.r', SV.d); else SV.d.copy(from.anchor);
      burst(SV.d.x, SV.d.y, SV.d.z, {n: 14, speed: [0.3 * U, 1 * U], life: [0.5, 0.8], size: [0.08 * U, 0.14 * U], end: 2.2,
        grav: -0.6 * U, drag: 2.5, alpha: 0.35, pal: PAL.flour});
    }
    if (id === 'konyali' && R) {
      neyTip(a.seat, U, SV.c);
      for (let k = 0; k < 5; k++) {
        sigGlyph(SV.c.x + rand(-0.5, 0.5) * U, SV.c.y + rand(0, 0.6) * U, SV.c.z, rand(-0.3, 0.3) * U, rand(0.4, 0.9) * U, 0,
          k % 2 ? GLYPH.note : GLYPH.notes, pal.ring, 0.2 * U, 0.8, {drag: 1, wob: 1.2 * U});
      }
    }
    if (id === 'vargr' && R) spawnPillar(g.x, g.y, g.z, 0.6 * U, 3.2 * U, 0.9, 'blood', 6);
    // Silah izi pencereleri: her temasın ~380 ms öncesinden 170 ms sonrasına.
    if (cfg.blade && cfg.blade.skills.includes(a.skill)) {
      const contacts = Array.isArray(a.contacts) && a.contacts.length ? a.contacts.slice(0, 3) : [Number(a.hitMs) || 500];
      if (id === 'vargr' && a.skill === 'e') sigRibbon(a.seat, cfg.blade.bone, cfg.blade.len, pal.ring, 0.1, Math.max(0.6, (contacts[contacts.length - 1] + 200) / 1000 - 0.1));
      else for (const c of contacts) {
        const ms = Math.max(0, Number(c) || 0);
        sigRibbon(a.seat, cfg.blade.bone, cfg.blade.len, pal.ring, Math.max(0, ms - 380) / 1000, (Math.min(ms, 380) + 170) / 1000);
      }
    }
  }

  /** Ana efekt: koreografi öğesi (mermi, girdap, sütun, ses dalgası, kalkan şoku). true → çekirdek kendi mermisini çizmez. */
  function sigLaunch(id, cfg, a) {
    const from = seatInfo(a.seat), to = seatInfo(a.def);
    if (!from || !to) return false;
    const U = unitScale(), pal = palFor(cfg, a.skill);
    const kind = a.kind;
    const flight = (Number(a.flight) || (kind === 'meteor' ? 500 : 260)) / 1000;
    if (kind === 'bread' || kind === 'spear' || kind === 'dagger' || kind === 'rune' || kind === 'meteor') {
      const start = a.from?.isVector3 ? a.from : from.anchor;
      const target = kind === 'meteor' ? to.ground : to.anchor;
      sigProjectile(kind, id, start, target, flight, U, a.onArrive || null, a.def);
      if (kind === 'meteor') {
        sigEmitter('starfall', a.seat, a.def, flight + 0.25, 70, PAL.nyx, U, id);
        sigDecal(to.ground.x, to.ground.y + 0.014 * U, to.ground.z, 'rune', PAL.nyx.ring, 1.2 * U, 2.8 * U, flight + 0.5, {spin: 2, seat: a.def});
      }
      return true;
    }
    if (kind === 'column') {
      const ms = Number(a.ms) || 900;
      spawnPillar(to.ground.x, to.ground.y, to.ground.z, 0.75 * U, 4.2 * U, ms / 1000, 'nyx', 5);
      sigEmitter('rise', a.seat, a.def, ms / 1000 * 0.8, 90, PAL.nyx, U, id);
      sigDecal(to.ground.x, to.ground.y + 0.014 * U, to.ground.z, 'rune', PAL.nyx.ring, 1.0 * U, 1.9 * U, ms / 1000, {spin: 2.2, seat: a.def});
      const cb = a.onArrive;
      sigAfter(0.22, () => { cb?.(); });
      return true;
    }
    if (kind === 'shockring') {
      sigEmitter('ney', a.seat, a.def, Math.min(0.5, (Number(a.ms) || 900) / 1000 * 0.5), 34, pal, U, id);
      if (BIG_WAVES_ON) spawnRing(from.ground.x, from.ground.y + 0.02 * U, from.ground.z, 'floor', 'circle', pal.ring, 0.4 * U, 2.6 * U, 0.6, 0.8);
      const cb = a.onArrive;
      sigAfter(0.08, () => { cb?.(); });
      return true;
    }
    if (kind === 'swirl') {
      const life = (Number(a.ms) || 700) / 1000;
      const sema = id === 'konyali';
      sigEmitter(sema ? 'sema' : 'vortex', a.seat, a.def, life, sema ? 150 : 170, pal, U, id);
      if (sema) sigDecal(from.ground.x, from.ground.y + 0.012 * U, from.ground.z, 'seljuk', pal.ring, 0.8 * U, 2.2 * U, life + 0.3, {spin: 4.5, seat: a.seat});
      else sigDecal(from.ground.x, from.ground.y + 0.012 * U, from.ground.z, 'ember', pal.ring, 0.8 * U, 2 * U, life + 0.2, {spin: 3, seat: a.seat});
      return true;
    }
    if (kind === 'shards') {
      // Kalkan Ezici: kalkandan rakibe ilerleyen üç kalın şok halkası + altın altıgen.
      tmpA.copy(from.anchor); tmpA.x += from.facing * 0.5 * U;
      tmpB.copy(to.anchor);
      for (let k = 0; k < 3; k++) {
        tmpC.subVectors(tmpB, tmpA);
        sigWave(tmpA, tmpC.x, tmpC.y, tmpC.z, k === 1 ? pal.core : pal.ring, (0.25 + k * 0.1) * U, (0.9 + k * 0.25) * U, 0.3 + k * 0.06, {to: tmpB, thick: 2});
      }
      spawnRing(to.anchor.x, to.anchor.y, to.anchor.z, 'face', 'hex', pal.ring, 0.5 * U, 1.6 * U, 0.4, 1, 3);
      return true;
    }
    return false;
  }

  /** Koreografinin yer darbesi (slam) karesi: karaktere özgü zemin/çarpma eki. */
  function sigSlam(id, cfg, a) {
    const to = seatInfo(a.def), from = seatInfo(a.seat);
    if (!to || !from) return;
    const U = unitScale(), pal = palFor(cfg, a.skill), g = to.ground;
    if (id === 'vargr') {
      burst(g.x, g.y + 0.1 * U, g.z, {n: 26, speed: [2 * U, 6 * U], life: [0.3, 0.6], size: [0.05 * U, 0.1 * U], end: 0.2,
        grav: 9 * U, drag: 1.5, up: 3 * U, pal});
      if (a.skill === 'r') {
        sigDecal(g.x, g.y + 0.015 * U, g.z, 'crack', pal.ring, 0.6 * U, 3.2 * U, 1.0, {a0: 1});
        sigWave(SV.a.set(g.x, g.y + 0.08 * U, g.z), 0, 1, 0, pal.ring, 0.4 * U, 4 * U, 0.6, {thick: 1.6});
      }
    } else if (id === 'sira') {
      for (const r of [-0.75, 0.75]) {
        const before = GL.count;
        sigGlyph(to.anchor.x, to.anchor.y, to.anchor.z + 0.05 * U, 0, 0, 0, GLYPH.slash, PAL.sira.core, 1.1 * U, 0.36, {});
        if (GL.count > before) gRot.array[GL.count - 1] = r;
      }
    } else if (id === 'doran') {
      if (a.skill === 'r') {
        // Sur çöküşü: rakibin üstüne düşen taş bloklar
        const n = Math.round(9 * countScale()) + 2;
        for (let k = 0; k < n; k++) {
          const s = rand(0.16, 0.3) * U;
          sigChunk(g.x + rand(-0.9, 0.9) * U, g.y + rand(1.6, 3.2) * U, g.z + rand(-0.6, 0.6) * U,
            rand(-0.6, 0.6) * U, -rand(2, 4) * U, rand(-0.4, 0.4) * U, s, s * rand(0.6, 0.9), s * rand(0.7, 1.1),
            pick([PAL.dust.hot[0], PAL.dust.hot[1], PAL.doran.cool[2]]), rand(1.1, 1.5), g.y, U);
        }
        sigDecal(g.x, g.y + 0.015 * U, g.z, 'crack', pal.ring, 0.6 * U, 3 * U, 1.0, {a0: 1});
        sigWave(SV.a.set(g.x, g.y + 0.08 * U, g.z), 0, 1, 0, pal.ring, 0.4 * U, 3.6 * U, 0.6, {thick: 1.6});
      } else {
        burst(g.x, g.y + 0.1 * U, g.z, {n: 18, speed: [1.5 * U, 5 * U], life: [0.3, 0.55], size: [0.05 * U, 0.09 * U], end: 0.2,
          grav: 9 * U, drag: 1.5, up: 2.5 * U, pal});
      }
    } else if (id === 'konyali') {
      if (a.skill === 'e') {
        // Sema halkası rakibe ulaşır ve temasta çakar.
        SV.a.set(from.anchor.x, from.anchor.y - 0.55 * U, from.anchor.z);
        SV.b.set(to.anchor.x, to.anchor.y - 0.4 * U, to.anchor.z);
        sigWave(SV.a, 0, 1, 0, pal.ring, 0.8 * U, 1.6 * U, 0.22, {to: SV.b, thick: 1.6});
        if (BIG_WAVES_ON) spawnRing(to.anchor.x, to.anchor.y, to.anchor.z, 'face', 'thin', pal.core, 0.3 * U, 2 * U, 0.35, 1);
      } else if (a.skill === 'r') {
        groundWave(g, pal, U, 1);
      }
    }
  }

  /** Zemin dalgası: geniş kalın halka + toz + çatlak (R son darbe). */
  function groundWave(g, pal, U, power) {
    if (!BIG_WAVES_ON) return;
    SV.a.set(g.x, g.y + 0.08 * U, g.z);
    sigWave(SV.a, 0, 1, 0, pal.ring, 0.4 * U, 4.6 * U * power, 0.7, {thick: 1.8});
    spawnRing(g.x, g.y + 0.03 * U, g.z, 'floor', 'circle', pal.core, 0.3 * U, 3.6 * U * power, 0.6, 0.9);
    const n = Math.round(30 * countScale());
    for (let k = 0; k < n; k++) {
      const a = Math.random() * TAU, sp = rand(1.5, 3.6) * U;
      if (!spawn(g.x + Math.cos(a) * 0.3 * U, g.y + rand(0.05, 0.25) * U, g.z + Math.sin(a) * 0.3 * U,
        Math.cos(a) * sp, rand(0.3, 1.2) * U, Math.sin(a) * sp * 0.6,
        rand(0.6, 1.0), rand(0.2, 0.36) * U, 0.6 * U, 0.38, pick(PAL.dust.hot), pick(PAL.dust.cool), 2.5 * U, 2.6)) break;
    }
  }

  /** Temas karesi (DAMAGE_APPLIED impactContact): karakter renginde patlama + zemin izi; R'de kenar darbesi + şok halkası. */
  function sigContact(id, cfg, ev) {
    const toSeat = ev.toSeat, fromSeat = ev.fromSeat ?? (toSeat === 1 ? 2 : 1);
    const amount = Number(ev.amount) || 0;
    if (ev.blocked || amount <= 0) return false;
    const d = seatInfo(toSeat);
    if (!d) return false;
    const U = unitScale(), skill = ev.skill, R = skill === 'r', pal = palFor(cfg, skill);
    const k = R ? 1.4 : skill === 'e' ? 1.15 : 1;
    const c = d.anchor, g = d.ground, f = -d.facing; // f: darbe yönü (saldırandan savunana)
    // beyaz-sıcak çekirdek + karakter kıvılcımları + yavaş közler
    spawn(c.x, c.y, c.z, 0, 0, 0, 0.16, 1.2 * U * Math.sqrt(k), 0.2 * U, 1, pal.core, pal.cool[0], 0, 0);
    burst(c.x, c.y, c.z, {n: 34 * k, speed: [2.5 * U, 7.5 * U], life: [0.3, 0.6], size: [0.06 * U, 0.12 * U], end: 0.15,
      grav: 8 * U, drag: 2.2, up: 1.2 * U, pal});
    burst(c.x, c.y, c.z, {n: 12 * k, speed: [0.4 * U, 1.4 * U], life: [0.6, 1.0], size: [0.1 * U, 0.2 * U], end: 0.3,
      grav: -0.8 * U, drag: 1.5, alpha: 0.7, pal});
    if (BIG_WAVES_ON) spawnRing(g.x, g.y + 0.02 * U, g.z, 'floor', 'circle', pal.ring, 0.3 * U, (1.5 + 0.5 * k) * U, 0.5);
    flashLight(c.x, c.y, c.z, pal.light, 0.7 + 0.4 * k, 0.24, U);
    const decalLife = R ? 1.0 : 0.75;
    if (id === 'vargr') {
      for (let n = 0; n < Math.round(16 * countScale()); n++) {
        spawn(c.x, c.y, c.z, f * rand(2, 6) * U, rand(1, 4) * U, rand(-2, 2) * U, rand(0.3, 0.55), rand(0.04, 0.07) * U, 0.01 * U, 1,
          PAL.vargr.hot[0], pick(pal.cool), 9 * U, 1.2);
      }
      sigDecal(g.x, g.y + 0.015 * U, g.z, skill === 'e' ? 'ember' : 'crack', pal.ring, 0.5 * U, (R ? 2.6 : 1.7) * U, decalLife);
    } else if (id === 'sira') {
      for (let n = 0; n < Math.round(18 * countScale()); n++) {
        spawn(c.x, c.y + rand(-0.2, 0.2) * U, c.z, f * rand(4, 9) * U, rand(-0.8, 0.8) * U, rand(-1, 1) * U, rand(0.15, 0.28),
          rand(0.04, 0.08) * U, 0.01 * U, 1, pick(PAL.sira.hot), pick(PAL.sira.cool), 0, 4);
      }
      const before = GL.count;
      sigGlyph(c.x, c.y, c.z + 0.05 * U, 0, 0, 0, GLYPH.slash, pal.core, (R ? 1.3 : 0.9) * U, 0.3, {});
      if (GL.count > before) gRot.array[GL.count - 1] = rand(-1, 1);
      sigDecal(g.x, g.y + 0.015 * U, g.z, 'shadow', pal.ring, 0.6 * U, 1.8 * U, decalLife);
    } else if (id === 'doran') {
      spawnRing(c.x, c.y, c.z, 'face', 'hex', pal.ring, 0.4 * U, 1.5 * U, 0.35, 1, 3);
      sigDecal(g.x, g.y + 0.015 * U, g.z, skill === 'e' ? 'rune' : 'crack', pal.ring, 0.5 * U, (R ? 2.6 : 1.7) * U, decalLife);
    } else if (id === 'nyx') {
      for (let n = 0; n < 6; n++) {
        const a = (n / 6) * TAU;
        sigGlyph(c.x, c.y, c.z, Math.cos(a) * 1.6 * U, Math.sin(a) * 1.6 * U, 0, n % 2 ? GLYPH.runeA : GLYPH.runeB,
          pal.ring, 0.22 * U, 0.55, {drag: 3, spin: rand(-4, 4)});
      }
      sigDecal(g.x, g.y + 0.015 * U, g.z, 'rune', pal.ring, 0.5 * U, (R ? 2.6 : 1.7) * U, decalLife, {spin: 1.5});
    } else if (id === 'konyali') {
      if (skill === 'q') {
        // Un bulutu patlaması + kırıntılar (ekmek parçaları varışta saçıldı)
        burst(c.x, c.y, c.z, {n: 26, speed: [0.8 * U, 2.8 * U], life: [0.7, 1.1], size: [0.2 * U, 0.36 * U], end: 2,
          grav: -0.3 * U, drag: 3, alpha: 0.4, pal: PAL.flour});
        burst(c.x, c.y, c.z, {n: 16, speed: [1.5 * U, 4 * U], life: [0.4, 0.7], size: [0.04 * U, 0.07 * U], end: 0.5,
          grav: 9 * U, drag: 1.2, up: 1.4 * U, pal: PAL.crumb});
        sigDecal(g.x, g.y + 0.015 * U, g.z, 'flour', PAL.flour.core, 0.6 * U, 2 * U, 1.0, {a0: 0.75, normal: true});
      } else if (skill === 'e') {
        if (BIG_WAVES_ON) spawnRing(c.x, c.y, c.z, 'face', 'thin', pal.core, 0.35 * U, 2.1 * U, 0.35, 1);
        SV.a.set(c.x, c.y - 0.3 * U, c.z);
        sigWave(SV.a, 0, 1, 0, pal.ring, 0.5 * U, 1.8 * U, 0.4, {thick: 1.5});
        sigDecal(g.x, g.y + 0.015 * U, g.z, 'seljuk', pal.ring, 0.6 * U, 1.9 * U, decalLife, {spin: -3});
      } else {
        for (let n = 0; n < 6; n++) {
          const a = (n / 6) * TAU;
          sigGlyph(c.x, c.y, c.z, Math.cos(a) * 1.8 * U, Math.sin(a) * 1.8 * U + 0.4 * U, 0, n % 2 ? GLYPH.note : GLYPH.notes,
            pal.ring, 0.24 * U, 0.6, {drag: 2.5, wob: U});
        }
      }
    }
    if (R) {
      const phase = Number(ev.phase) || 0;
      edgePulse(pal.flashHex, phase === 2 ? 0.62 : 0.46, 380);
      // rakibin çevresinde şok halkası
      SV.a.set(c.x, c.y - 0.1 * U, c.z);
      sigWave(SV.a, 0, 1, 0, pal.ring, 0.3 * U, 2.3 * U, 0.45, {thick: 1.8});
      if (id === 'konyali') sigWave(SV.a, 1, 0, 0, pal.core, 0.25 * U, 1.7 * U, 0.4, {thick: 2.2});
      if (phase === 3 || phase === 0) {
        groundWave(g, pal, U, 1);
        sigDecal(g.x, g.y + 0.016 * U, g.z, cfg.decal === 'flour' ? 'crack' : cfg.decal, pal.ring, 0.8 * U, 3.2 * U, 1.0, {a0: 1});
      }
    }
    return true;
  }

  /**
   * İş 15 — dış giriş: {stage:'cast'|'launch'|'slam'|'contact', seat, def, skill, fighterId?, kind?, flight?, ms?,
   * from?, onArrive?, contacts?, event?}. Model yoksa ya da azaltılmış harekette false (çekirdek eski yolu kullanır).
   */
  function signature(a) {
    if (dead || !a || reduced() || pluginApi.sigOff) return false; // sigOff: yalnız A/B ölçümü (vfxprobe)
    const ev = a.event || null;
    const seat = ev ? (ev.fromSeat ?? (ev.toSeat === 1 ? 2 : 1)) : a.seat;
    const id = a.fighterId || fighterOf(seat)?.fighterId;
    const cfg = SIG_CONFIG[id];
    if (!cfg) return false;
    const skill = ev ? ev.skill : a.skill;
    const name = `${id}.${skill || '-'}.${a.stage}${a.kind ? `.${a.kind}` : ''}${ev?.phase ? `.p${ev.phase}` : ''}`;
    // ön ısıtma (maç başı provası) sayaçlara girmez
    const row = a.warm || ev?.warm ? {name, particles: 0, ms: 0, t: 0} : logSig(name);
    const t0 = perfNow(), p0 = totals.spawned;
    const prev = currentLog;
    currentLog = row;
    let handled = false;
    try {
      if (a.stage === 'cast') { sigCast(id, cfg, {...a, seat}); handled = true; }
      else if (a.stage === 'launch') handled = sigLaunch(id, cfg, {...a, seat});
      else if (a.stage === 'slam') { sigSlam(id, cfg, {...a, seat}); handled = true; }
      else if (a.stage === 'contact' && ev) handled = sigContact(id, cfg, ev);
    } finally {
      currentLog = prev;
      row.particles += totals.spawned - p0;
      row.ms = Math.round((perfNow() - t0) * 1000) / 1000;
    }
    totals.signature = (totals.signature || 0) + 1;
    return handled;
  }

  function updateSignature(dt) {
    sigClock += dt;
    updateSigTimers();
    updateSigProjectiles(dt);
    updateSigEmitters(dt);
    updateDecals(dt);
    updateGround(dt);
    updateWaves(dt);
    updateGlyphs(dt);
    updateChunks(dt);
    updateGhosts(dt);
    updateRibbons();
    updateEdge(dt);
  }

  function clearSignature() {
    sigTimers.length = 0;
    for (const r of sigProjectiles) releaseSigProjectile(r, false);
    for (const e of sigEmitters) e.active = false;
    for (const d of decals) { d.active = false; d.mesh.visible = false; }
    for (const s of scars) { s.active = false; s.mesh.visible = false; } // kraterler raund geçişinde KALIR (maç sonuna dek)
    for (const w of waves) { w.active = false; w.mesh.visible = false; }
    for (const g of ghosts) { g.active = false; g.mesh.visible = false; }
    for (const r of ribbons) { r.active = false; r.mesh.visible = false; }
    GL.count = 0; glyphMesh.count = 0;
    CH.count = 0; chunkMesh.count = 0;
    edge.life = 0; edgeQuad.visible = false; edgeMat.uniforms.uOpacity.value = 0;
  }

  function signatureStats() {
    const n = arr => arr.reduce((s, x) => s + (x.active ? 1 : 0), 0);
    return {projectiles: n(sigProjectiles), emitters: n(sigEmitters), decals: n(decals), waves: n(waves), ghosts: n(ghosts),
      ribbons: n(ribbons), glyphs: GL.count, chunks: CH.count, edge: edge.life > 0 ? 1 : 0, edgePulses: edge.count,
      counts: {...sigCounts}, log: sigLog.slice(-24)};
  }

  // =========================================================================
  // 10) Olay yöneticileri
  // =========================================================================

  function onSkillCast(ev) {
    const skill = ev.skill;
    if (skill !== 'q' && skill !== 'e' && skill !== 'r') return;
    const from = seatInfo(ev.fromSeat);
    const toSeat = ev.toSeat ?? (ev.fromSeat === 1 ? 2 : 1);
    const to = seatInfo(toSeat);
    if (!from || !to) return;
    const U = unitScale();
    const kind = characterOf(ev.fromSeat, ev.character);
    if ((ev.resolve === true || ev.arena === true) && (ev.defenderAction === 'brace' || ev.arena === true) && resolveBeats.length < 8) {
      resolveBeats.push({kind: 'brace', seat: toSeat, remaining: 0.155});
    }
    // Paket 32: karaktere özel efekt (mızrak, rün oku, girdap, meteor…) çekirdekte çizilir;
    // arketip halkası/mermisi üst üste binmesin. Model yoksa (düzlem yedek) eski efekt aynen.
    if (hasCharacterModel(ev.fromSeat)) {
      totals.characterSkills++;
      return;
    }
    if (skill === 'r') {
      // R mermi atmaz: saldırgan enerji toplar, ULTIMATE_PHASE zinciri savunanı çeker.
      startEmitter('spiral', from.anchor.x, from.anchor.y, from.anchor.z, from.ground.y, U, 0.55, 200, PAL[kind]);
      spawnRing(from.ground.x, from.ground.y + 0.02 * U, from.ground.z, 'floor', 'thin', PAL[kind].ring, 2.2 * U, 0.4 * U, 0.55, 0.9);
      flashLight(from.anchor.x, from.anchor.y, from.anchor.z, PAL[kind].light, 0.6, 0.45, U);
      // Fire coils into a storm; rune closes a crystal seal around the caster.
      spawnRing(from.anchor.x, from.anchor.y, from.anchor.z, 'face', kind === 'fire' ? 'circle' : 'hex', PAL[kind].ring, 0.35 * U, 1.55 * U, 0.55, 0.9, kind === 'fire' ? 5 : -2);
      return;
    }
    if (skill === 'e') {
      spawnRing(from.ground.x, from.ground.y + 0.03 * U, from.ground.z, 'floor', kind === 'fire' ? 'thin' : 'hex', PAL[kind].ring, 0.25 * U, 2.4 * U, 0.38);
    } else {
      spawnRing(from.anchor.x + from.facing * 0.5 * U, from.anchor.y, from.anchor.z, 'face', kind === 'fire' ? 'thin' : 'hex', PAL[kind].core, 0.14 * U, 0.8 * U, 0.22);
    }
    tmpA.copy(from.anchor); tmpA.x += from.facing * 0.45 * U; tmpA.y += 0.05 * U;
    tmpB.copy(to.anchor); tmpB.x -= from.facing * 0.2 * U;
    launch(kind, skill, tmpA, tmpB, U, 'puff', {toSeat, amount: ev.amount});
    // Ağız alevi / rün kıvılcımı.
    burst(tmpA.x, tmpA.y, tmpA.z, {n: skill === 'q' ? 8 : skill === 'e' ? 14 : 22, speed: [0.6 * U, 2 * U],
      life: [0.12, 0.3], size: [0.06 * U, 0.12 * U], end: 0.2, grav: 0, drag: 4, pal: PAL[kind]});
  }

  function onCounter(ev) {
    const from = seatInfo(ev.fromSeat);
    const toSeat = ev.toSeat ?? (ev.fromSeat === 1 ? 2 : 1);
    const to = seatInfo(toSeat);
    if (!from || !to) return;
    const U = unitScale();
    const kind = characterOf(ev.fromSeat, ev.character);
    tmpA.copy(from.anchor); tmpA.x += from.facing * 0.45 * U;
    tmpB.copy(to.anchor); tmpB.x -= from.facing * 0.2 * U;
    launch(kind, 'counter', tmpA, tmpB, U, 'puff', {toSeat, amount: ev.amount});
    burst(tmpA.x, tmpA.y, tmpA.z, {n: 10, speed: [1 * U, 2.5 * U], life: [0.12, 0.25],
      size: [0.06 * U, 0.1 * U], end: 0.2, grav: 0, drag: 4, pal: PAL.parry});
  }

  function onUltimatePhase(ev) {
    const phase = Number(ev.phase);
    const from = seatInfo(ev.fromSeat);
    const toSeat = ev.toSeat ?? (ev.fromSeat === 1 ? 2 : 1);
    const to = seatInfo(toSeat);
    if (!from || !to) return;
    const U = unitScale();
    const kind = characterOf(ev.fromSeat, ev.character);
    const pal = PAL[kind];
    const blocked = Boolean(ev.blocked);
    if (phase === 1 || (phase === 2 && !tether.active && !blocked)) {
      // Enerji zinciri savunanı yakalar (faz 1 kaçtıysa faz 2'de başlar).
      startTether(ev.fromSeat, toSeat, kind, blocked);
      spawnRing(to.anchor.x, to.anchor.y, to.anchor.z, 'face', 'hex', blocked ? PAL.shield.ring : pal.ring, 0.9 * U, 0.45 * U, 0.35, 1, 3);
      flashLight(from.anchor.x, from.anchor.y, from.anchor.z, pal.light, 0.7, 0.5, U);
      shake(0.15, 200);
    }
    if (phase === 2) {
      // VS noktasında ağır darbe: savunan şu an merkezde (çekirdek taşıdı).
      const c = to.anchor;
      if (!blocked) {
        bigExplosion(kind, c.x, c.y, c.z, toSeat, U, 0.55);
        spawnRing(c.x, c.y, c.z, 'face', 'thin', pal.core, 0.4 * U, 2.4 * U, 0.4, 1);
        spawnPillar(to.ground.x, to.ground.y, to.ground.z, 0.7 * U, 4 * U, 0.5, kind, 4);
      } else {
        deflect(toSeat, ev.fromSeat);
      }
      shake(0.35, 260);
    } else if (phase === 3) {
      // Fırlatma: zincir kopar, savunan alevli/rün izli bir yayla evine uçar.
      releaseTether(0.08);
      if (!blocked) {
        const e = startEmitter('follow', to.anchor.x, to.anchor.y, to.anchor.z, to.ground.y, U, 0.6, 160, pal);
        if (e) e.seat = toSeat;
        flash(pal.flashHex, 0.35, 200);
      }
      shake(0.5, 240);
    }
  }

  /** Fırlatılan savunan kendi yerinde zemine çakılır: krater, toz, köz, büyük sarsıntı. */
  function onSlam(ev) {
    const seat = ev.seat;
    if (seat !== 1 && seat !== 2) return;
    const U = unitScale();
    const kind = characterOf(ev.fromSeat, ev.character);
    const pal = PAL[kind];
    const power = clamp(Number(ev.power) || 1, 0.3, 1.5);
    const d = seatInfo(seat);
    const x = Number.isFinite(ev.x) ? ev.x : d?.ground.x ?? 0;
    const z = Number.isFinite(ev.z) ? ev.z : d?.ground.z ?? 0;
    const gy = d ? d.ground.y : 0;
    bigExplosion(kind, x, gy + 0.35 * U, z, seat, U, 0.8 * power);
    // Krater: geniş altıgen + taş tozu halkası.
    spawnRing(x, gy + 0.025 * U, z, 'floor', 'hex', PAL.dust.ring, 0.6 * U, 2.2 * U * power, 0.9, 0.9, 0.6);
    // Yana savrulan toz bulutu (alçak, ağır) ve sıçrayan taş kıvılcımları.
    const n = Math.round(46 * power * countScale());
    for (let k = 0; k < n; k++) {
      const a = Math.random() * TAU, sp = rand(1.2, 3.4) * U;
      if (!spawn(x + Math.cos(a) * 0.3 * U, gy + rand(0.05, 0.3) * U, z + Math.sin(a) * 0.3 * U,
        Math.cos(a) * sp, rand(0.3, 1.4) * U, Math.sin(a) * sp * 0.6,
        rand(0.6, 1.2), rand(0.25, 0.45) * U, 0.7 * U, 0.4, pick(PAL.dust.hot), pick(PAL.dust.cool), 2.5 * U, 2.6)) break;
    }
    if (kind === 'rune') spawnPillar(x, gy, z, 0.35 * U, 9 * U, 0.55, 'rune', 6);
    shake(1, 600);
    flash(pal.flashHex, ev.knockout ? 0.6 : 0.45, 240);
  }

  function onKnockout(ev) {
    const d = seatInfo(ev.seat);
    if (!d) return;
    const U = unitScale();
    const pal = characterOf(ev.seat, ev.character);
    const c = d.anchor;
    bigExplosion(pal, c.x, c.y, c.z, ev.seat, U, 1.3);
    // Yavaşça yağan közler: geniş alana yukarıdan serpilir.
    const n = Math.round(80 * countScale());
    for (let k = 0; k < n; k++) {
      if (!spawn(c.x + rand(-3, 3) * U, c.y + rand(1, 4) * U, c.z + rand(-1.5, 1.5) * U,
        rand(-0.2, 0.2) * U, rand(-0.6, -0.2) * U, rand(-0.2, 0.2) * U,
        rand(2.5, 4), rand(0.06, 0.12) * U, 0.03 * U, 0.85, pick(PAL[pal].hot), pick(PAL[pal].cool), 0.05 * U, 0.4)) break;
    }
    shake(0.8, 600);
    flash(0xffffff, 0.7, 320);
  }

  /**
   * Süper donması (çekirdeğin SUPER_FREEZE istemci olayı, paket 29): saldıranın
   * gövdesini saran, onu izleyen renkli aura + zeminde açılan ince halka.
   * Aynı koltuk için tekrar gelirse yeni yayıcı açılmaz, mevcut aura uzar.
   */
  function onSuperFreeze(ev) {
    const seat = ev.seat;
    const d = seatInfo(seat);
    if (!d) return;
    const U = unitScale();
    const kind = characterOf(seat, ev.character);
    const life = clamp((Number(ev.ms) || 450) / 1000 + 0.35, 0.3, 2.5);
    const existing = emitters.find((e) => e.active && e.type === 'aura' && e.seat === seat);
    if (existing) {
      existing.life = Math.max(existing.life, existing.age + life);
      return;
    }
    const e = startEmitter('aura', d.anchor.x, d.anchor.y, d.anchor.z, d.ground.y, U, life, 150, PAL[kind]);
    if (e) e.seat = seat;
    spawnRing(d.ground.x, d.ground.y + 0.02 * U, d.ground.z, 'floor', 'thin', PAL[kind].ring, 0.4 * U, 2.1 * U, 0.5, 0.8);
    flashLight(d.anchor.x, d.anchor.y, d.anchor.z, PAL[kind].light, 0.55, Math.min(life, 0.8), U);
  }

  /** Azaltılmış hareket: yalnızca minik, kısa bir flaş (ve sadece önemli olaylarda). */
  function reducedFlash(ev) {
    switch (ev.type) {
      case 'DAMAGE_APPLIED': if (!ev.blocked && ev.amount > 0) flash(PALETTE_HEX[characterOf(ev.fromSeat, ev.character)].flash, 0.12, 90); break;
      case 'PARRY_TRIGGERED': flash(PALETTE_HEX.parry.flash, 0.12, 90); break;
      case 'ULTIMATE_PHASE': if (Number(ev.phase) === 3) flash(PALETTE_HEX[characterOf(ev.fromSeat, ev.character)].flash, 0.15, 110); break;
      case 'KNOCKOUT': flash(0xffffff, 0.15, 120); break;
      default: break;
    }
  }

  // =========================================================================
  // 11) Dış API
  // =========================================================================

  function handle(event) {
    if (dead || !event || typeof event.type !== 'string') return;
    totals.events++;
    if (event.type === 'HP_SYNC') watchHp(event);
    if (reduced()) { reducedFlash(event); return; }
    switch (event.type) {
      case 'HEAL_APPLIED': if (Number(event.amount) > 0 || event.base) onHeal(event); break; // KESINYAP 21
      case 'SKILL_CAST': onSkillCast(event); break;
      case 'COUNTERATTACK_CAST': onCounter(event); break;
      case 'ULTIMATE_PHASE': onUltimatePhase(event); break;
      case 'DAMAGE_APPLIED': {
        if (event.impactContact) groundDamage(event); // KESINYAP 21: zemin hasarı temas karesinde
        if (!event.impactContact && (event.resolve === true || event.arena === true) && resolveBeats.length < 8) {
          resolveBeats.push({event, remaining: 0.235});
          break;
        }
        applyDamageFx(event);
        break;
      }
      case 'SHIELD_TRIGGERED': shieldFlare(event.seat, event.kind === 'PERFECT_BLOCK'); break;
      case 'PARRY_TRIGGERED': parryBurst(event.seat); break;
      case 'SHIELD_BROKEN': shieldShatter(event.seat); break;
      case 'KNOCKOUT': onKnockout(event); break;
      case 'ARENA_SLAM': onSlam(event); break; // çekirdeğin ürettiği istemci olayı
      case 'SUPER_FREEZE': onSuperFreeze(event); break; // çekirdeğin api.superFreeze'i (paket 29)
      default: break; // MATCH_PAUSED vb. görsel olmayan olaylar yok sayılır
    }
  }

  function applyDamageFx(event) {
        const toSeat = event.toSeat;
        const fromSeat = event.fromSeat ?? (toSeat === 1 ? 2 : 1);
        const amount = Number(event.amount) || 0;
        // İş 15: model varsa temas karesi karaktere özgü (aynı kare: impactContact = ses/hasar sayısı karesi).
        if (!event.blocked && amount > 0 && event.impactContact && hasCharacterModel(fromSeat)
          && signature({stage: 'contact', event})) return;
        if (event.blocked) deflect(toSeat, fromSeat);
        else if (amount > 0) impact(toSeat, fromSeat, characterOf(fromSeat, event.character), amount, Boolean(event.counter));
  }

  /** dt saniye cinsindendir; >2 gelirse milisaniye kabul edilip çevrilir. */
  function update(dt) {
    if (dead) return;
    let step = Number(dt);
    if (!Number.isFinite(step) || step <= 0) return;
    if (step > 2) step /= 1000;
    // İş 15: imza mermileri çekirdeğin eski efekt saatiyle aynı (≤ 0,1 sn × zaman ölçeği) → varış = temas karesi.
    const sigStep = Math.min(step, 0.1) * simScale();
    step = Math.min(step, MAX_STEP_S);
    for (let i = resolveBeats.length - 1; i >= 0; i--) {
      const beat = resolveBeats[i];
      beat.remaining -= step;
      if (beat.remaining <= 0) {
        resolveBeats.splice(i, 1);
        if (!reduced()) {
          if (beat.kind === 'brace') {
            const d = seatInfo(beat.seat), U = unitScale();
            if (d) spawnRing(d.anchor.x + d.facing * 0.35 * U, d.anchor.y, d.anchor.z, 'face', 'hex', PAL.shield.ring, 0.55 * U, 0.9 * U, 0.27, 0.45);
          } else applyDamageFx(beat.event);
        }
      }
    }
    if (camera) camera.getWorldQuaternion(camQ);
    // Piksel ölçeği: tampon yüksekliği / (2·tan(fov/2)) → aSize dünya biriminde kalır.
    const h = api.renderer?.domElement?.height || 720;
    const fov = camera?.isPerspectiveCamera ? camera.fov : 50;
    pMaterial.uniforms.uScale.value = h / (2 * Math.tan((fov * Math.PI) / 360));
    // Ağır çekim (paket 29): benzetim adımı çekirdeğin zaman ölçeğiyle yavaşlar;
    // yukarıdaki resolveBeats sunucu ritmine bağlı olduğu için gerçek zamanda kalır.
    const sim = step * simScale();
    if (sigStep > 0) updateSignature(sigStep);
    if (sim <= 0) return;
    updateProjectiles(sim);
    updateTether(sim);
    updateEmitters(sim);
    updateParticles(sim);
    updateRings(sim);
    updateLights(sim);
    updateShards(sim);
    updatePillars(sim);
  }

  /** Çekirdeğin zaman ölçeği (api.timeScale, slowMo sırasında < 1); yoksa 1. */
  function simScale() {
    if (typeof api.timeScale !== 'function') return 1;
    const s = Number(api.timeScale());
    return Number.isFinite(s) ? clamp(s, 0, 1) : 1;
  }

  function clear() {
    resolveBeats.length = 0;
    P.count = 0;
    pGeometry.setDrawRange(0, 0);
    for (const r of projectiles) releaseProjectile(r);
    for (const r of rings) { r.active = false; r.mesh.visible = false; }
    for (const l of lights) { l.life = 0; l.light.intensity = 0; }
    for (const e of emitters) e.active = false;
    for (const p of pillars) { p.active = false; p.mesh.visible = false; }
    S.count = 0;
    shardMesh.count = 0;
    tether.active = false;
    tetherMesh.visible = false;
    clearSignature();
  }

  function dispose() {
    if (dead) return;
    clear();
    dead = true;
    if (edgeQuad.parent) edgeQuad.parent.remove(edgeQuad);
    ownedGeometries.add(edgeQuad.geometry);
    ownedMaterials.add(edgeMat);
    for (const t of [...Object.values(TEX), glyphTex, breadTex, scarTex, craterTex]) t?.dispose?.();
    glyphMesh.dispose?.();
    chunkMesh.dispose?.();
    debrisMesh.dispose?.();
    // Ağaçta bulunan her geometri/malzemeyi de topla (havuzdan sonradan eklenenler dahil).
    root.traverse((o) => {
      if (o.geometry) ownedGeometries.add(o.geometry);
      if (o.material) for (const m of [].concat(o.material)) ownedMaterials.add(m);
    });
    if (root.parent) root.parent.remove(root);
    for (const l of lights) l.light.dispose?.();
    shardMesh.dispose?.();
    for (const m of ownedMaterials) {
      // Malzemelere bağlı dokular (şu an yok ama gelecekte eklenirse) da serbest kalsın.
      for (const v of Object.values(m.uniforms || {})) if (v?.value?.isTexture) v.value.dispose();
      if (m.map?.isTexture) m.map.dispose();
      m.dispose();
    }
    for (const g of ownedGeometries) g.dispose();
    root.clear();
    projectiles.length = 0; rings.length = 0; pillars.length = 0;
  }

  function stats() {
    let proj = 0, ringCount = 0, lightCount = 0, emitterCount = 0, pillarCount = 0;
    for (const r of projectiles) if (r.active) proj++;
    for (const r of rings) if (r.active) ringCount++;
    for (const l of lights) if (l.life > 0) lightCount++;
    for (const e of emitters) if (e.active) emitterCount++;
    for (const p of pillars) if (p.active) pillarCount++;
    return {
      particles: P.count, projectiles: proj, rings: ringCount, shards: S.count,
      lights: lightCount, emitters: emitterCount, pillars: pillarCount, tethers: tether.active ? 1 : 0,
      quality: qualityKey(), reduced: reduced(), disposed: dead,
      caps: {...caps()}, totals: {...totals}, signature: signatureStats(), ground: groundStats()
    };
  }

  const pluginApi = {handle, update, clear, dispose, stats, root, signature, sigOff: false};
  // Ölçüm kancası (varsayılan KAPALI; ?vfxprobe=1): imza efekt sayaçları.
  try {
    if (/(?:^|[?&])vfxprobe=1(?=&|$)/.test(String(globalThis.location?.search || ''))) globalThis.__tuslabVfx = pluginApi;
  } catch { /* yok */ }
  return pluginApi;
}
