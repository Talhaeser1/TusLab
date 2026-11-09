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

/** Yumuşak yuvarlak sprite: dış hale + parlak çekirdek; doku gerekmez. */
const PARTICLE_FRAG = /* glsl */`
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float d = dot(p, p);
  if (d > 1.0) discard;
  float soft = 1.0 - d;
  soft *= soft;
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
  for (const [name, p] of Object.entries(PALETTE_HEX)) {
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
  const totals = {spawned: 0, dropped: 0, projectilesResolved: 0, events: 0};
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
  const pMaterial = mat(new THREE.ShaderMaterial({
    uniforms: {uScale: {value: 600}},
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
      group.add(rec.shard, rec.ring, rec.glow);
      for (let k = 0; k < 3; k++) {
        const o = new THREE.Mesh(G.octa, M.runeOrbiter);
        o.scale.setScalar(0.035);
        rec.orbiters.push(o);
        group.add(o);
      }
    }
    root.add(group);
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
  acquireRing();
  acquirePillar();

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
    shake(clamp(amount / 350, 0.12, 0.85), Math.round(120 + amount * 0.8));
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
    if (reduced()) { reducedFlash(event); return; }
    switch (event.type) {
      case 'SKILL_CAST': onSkillCast(event); break;
      case 'COUNTERATTACK_CAST': onCounter(event); break;
      case 'ULTIMATE_PHASE': onUltimatePhase(event); break;
      case 'DAMAGE_APPLIED': {
        if ((event.resolve === true || event.arena === true) && resolveBeats.length < 8) {
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
        if (event.blocked) deflect(toSeat, fromSeat);
        else if (amount > 0) impact(toSeat, fromSeat, characterOf(fromSeat, event.character), amount, Boolean(event.counter));
  }

  /** dt saniye cinsindendir; >2 gelirse milisaniye kabul edilip çevrilir. */
  function update(dt) {
    if (dead) return;
    let step = Number(dt);
    if (!Number.isFinite(step) || step <= 0) return;
    if (step > 2) step /= 1000;
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
  }

  function dispose() {
    if (dead) return;
    clear();
    dead = true;
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
      caps: {...caps()}, totals: {...totals}
    };
  }

  return {handle, update, clear, dispose, stats, root};
}
