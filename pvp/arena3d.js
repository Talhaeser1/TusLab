import {createVisualTimeline, TURN} from './visual-timeline.js';
import {createImpactDirector, stepImpact, addTrauma, beginHitstop, restoreHitstop, hitReaction} from './impact-feel.js';
import {createArenaBloom} from './arena3d-bloom.js';
import {budgetRatio, createFrameGovernor, PIXEL_BUDGETS} from './perf-governor.js';
import {buildStage} from './stages3d.js';
import {DEFAULT_STAGE, normalizeStage} from './shared/stages.js';
import {
  createFighterRig, createSkillFx, contactDistance as contactGap, dashProgress, travelProgress, chainProgress, frameFighters, isKnownFighter, loadFighterModel, fighterModelUrl, rootMotionAt, skillDuration, COMBO,
  sceneProgress, sceneTurn, SCENE,
  MODEL_VIEW, FIGHTER_MODEL_BASE,
} from './fighters3d.js';

/**
 * TuşLab Neon Arena — 3D arena çekirdeği (Paket 26)
 * ===================================================
 *
 * A WebGL (three.js r160) stage that replaces the two flat DOM character rigs
 * with a single, continuous neon arena behind the existing duel UI.
 *
 * Cosmetic only: it never computes HP, damage or hit success. It reacts to the
 * authoritative combat events that `pvp/index.js` already receives
 * (`tuslab:pvp-combat` details) and to the match end.
 *
 * Layering
 * --------
 * ONE `<canvas class="pvp26-canvas">` is inserted as the FIRST child of
 * `.pvp2-duel` (position:absolute, z-index:0). With side-by-side stages it
 * covers the whole duel area (colosseum visible behind the name/HP rows and
 * the VS gap); with stacked stages (narrow screens) only the stage band.
 * While the arena is active the root gets the class `pvp26-3d`; `arena3d.css`
 * then makes side/stage backgrounds transparent and hides `.pvp3-rig`, so the
 * 3D characters show through while every other DOM layer (labels, HUD,
 * `.pvp4-effects`, `.pvp24-particles` z:7, VS midline z:4) stays above.
 *
 * Character placement
 * -------------------
 * Characters are positioned so that they PROJECT onto their DOM stages: the
 * screen point (stage centre x, 90% of stage height) is unprojected onto the
 * floor plane (y = 0) through a "base" camera that ignores drift/shake/dolly.
 * DOM overlays (damage numbers, labels) therefore line up with the fighters.
 *
 * Plugins
 * -------
 * `registerPlugin({handle?, update?, dispose?, clear?})` — plugins receive EVERY
 * event passed to handle() (after the core reacted), including the client-only
 * `{type:'KNOCKOUT', seat:loserSeat}` that index.js sends before onMatchEnd().
 * update(dt seconds, t seconds) runs every frame; clear()/dispose() are called
 * from arena.clear()/destroy(). The scene itself is never transformed (only the
 * camera and child groups move), so plugins can work in world coordinates.
 * `api` (see createApi) is the stable surface for plugins (e.g. arena3d-fx.js).
 * Additive since paket 27: api.seatHome(seat), api.cheer(intensity), and the
 * client-only plugin event `{type:'ARENA_SLAM', seat, fromSeat, character, x, y, z,
 * power, knockout}` emitted when an ultimate-thrown defender hits the floor.
 * Additive since paket 29 (FGC cinematics, HUD-driven): api.superFreeze(seat, ms),
 * api.slowMo(scale, ms), api.introSweep(ms), api.timeScale(); plugin event
 * `{type:'SUPER_FREEZE', seat, ms, character}`; client cue event
 * `{type:'ARENA_CUE', cue:'superFreeze'|'slowMo'|'introSweep', seat?, ms?, scale?}`.
 * The dynamic fight camera frames the fighters' live positions but equals the
 * layout camera while both stand at home (DOM overlays stay aligned).
 *
 * Ultimate choreography (ULTIMATE_PHASE 1..3): pull → hit → throw back; see
 * ULTIMATE_TIMING. The fighter group (root) moves, DOM overlays stay at the seat.
 */

// ------------------------------------------------------------------ constants

const SEATS = Object.freeze([1, 2]);
const CHARACTER_OF_SEAT = Object.freeze({1: 'fire', 2: 'rune'});

/** Colour identity: seat 1 fire = orange/red, seat 2 rune = violet/cyan. */
const PALETTE = Object.freeze({
  fire: Object.freeze({main: 0xff6a2a, accent: 0xffb347, shield: 0xff8a3c}),
  rune: Object.freeze({main: 0x9a5bff, accent: 0x38e0ff, shield: 0x6fd8ff}),
});

/**
 * Rig PNGs are 1024×1536 full-frame layers (see characters.js rigMarkup), all
 * drawn at the same rect. Values below are in UV (0..1 from the top-left).
 */
const RIG = Object.freeze({
  planeW: 2,
  planeH: 3,
  feetV: 0.92,   // feet line inside the PNG
  crownV: 0.03,  // top of the crown
  chestV: 0.36,  // chest (projectile anchor)
  layerZ: Object.freeze({core: 0, guard: 0.035, weapon: 0.07}), // parallax depth offsets
  // Shoulder pivots, mirrored from character-motion.css transform-origins.
  pivots: Object.freeze({
    fire: Object.freeze({weapon: [0.71, 0.27], guard: [0.32, 0.27]}),
    rune: Object.freeze({weapon: [0.28, 0.27], guard: [0.73, 0.28]}),
  }),
});

/** Body-local height of the waist (spin pivot during ultimate travel). */
const WAIST_Y = (RIG.feetV - 0.5) * RIG.planeH;

const LAYOUT = Object.freeze({
  feetFrac: 0.9,    // feet at 90% of the stage height
  heightFrac: 0.8,  // visible figure ≈ 80% of the stage height
  camY: 1.3,        // low camera → slight low angle on the fighters
  camZ: 5.6,
  fov: 42,        // wide enough to show the colosseum tiers above the fighters
});

/** Reference damage used to normalise knockback (R phase 3 ≈ 140). */
const HEAVY_DAMAGE = 140;

/**
 * Colosseum budget per quality level. Everything is pre-built at the 'high'
 * size; 'low' only lowers draw counts (no shader recompiles except the two
 * brazier PointLights, which are hidden on low).
 */
export const ARENA_ENV_CAPS = Object.freeze({
  high: Object.freeze({crowd: 360, braziers: 8, lights: 2, banners: 8, spotlights: 4, embers: 160}),
  low: Object.freeze({crowd: 140, braziers: 4, lights: 0, banners: 4, spotlights: 2, embers: 60}),
});

/**
 * Ultimate "pull → hit → throw back" choreography (ms).
 * Server timing (pvp/shared/match.js): SKILL_CAST r at t0, ULTIMATE_PHASE n at
 * t0 + SHIELD_WINDOW_MS(250) + offset → fire 250/430/670, rune 250/510/790.
 * Each phase starts a tween FROM the current pose, so late, bunched or missing
 * phases never snap; a watchdog throws the defender home if phases stop.
 */
/** İş 1 (3. tur): model dünya konumunun kare başına en büyük değişimi (ışınlanma koruması; 60 fps'te 0,12). */
export const MAX_FWD_STEP = 0.12;
/** Aynı korumanın hız sınırı (dünya birimi/sn): uzun karede adım dt ile sınırlanır. */
export const MAX_WORLD_SPEED = MAX_FWD_STEP * 60;
/** Konum sınırında sayılan en uzun kare (ms): 20 fps'e kadar hız korunur, daha uzun karede adım ≤ 0,36. */
export const MAX_POSE_DT_MS = 50;
/** Eve dönerken gövde yönü: rakibe bakan yarım profilden eve bakan yarım profile (kameradan geçerek). */
const TURN_YAW = -(Math.PI - 2 * MODEL_VIEW.yawToCamera);
/** KO/maç sonu: bekleyen sahnelerin sıralı oynaması için üst süre (sunum; kural süresi değil). */
export const KO_DRAIN_MS = 6000;

export const ULTIMATE_TIMING = Object.freeze({
  pullMs: 340,        // phase 1: tether yanks the defender to the VS centre (ease-out)
  dashMs: 260,        // phase 1: attacker dashes toward the centre
  hitStopMs: 70,      // phase 2: frozen tremble before the knock (hit-stop)
  hitMs: 230,         // phase 2: knock up + tumble at the centre
  strikeMs: 160,      // phase 2: attacker step-in strike
  throwMs: 700,       // phase 3: arc flight back to the defender's seat (İş 1: ≤ 0,35 birim/kare)
  bounceMs: 220,      // landing bounce after the slam
  returnDelayMs: 120, // phase 3: attacker waits, then hops home
  returnMs: 1000,     // İş 1, 3. tur: saldıran eve koşu klibiyle döner (0,12 birim/kare sınırının altında)
  minGapMs: 150,      // bunched phases are spread at least this far apart
  watchdogMs: 700,    // no next phase within this after a segment → auto throw-back
});
const TAU = Math.PI * 2;

/** Colosseum shape. Lathe phi: x = sin φ·r, z = cos φ·r; φ = π is straight back. */
const ARENA_ARC = Object.freeze({start: Math.PI * 0.2, length: Math.PI * 1.6});
/** The whole colosseum is lowered so its tiers fall inside the low-angle camera view. */
const ARENA_SINK = -1.6;
/** Spotlight pools land on the platform top (y = 0 world) — colosseum-local y. */
const POOL_Y = 0.012 - ARENA_SINK;
const ARENA_TIERS = Object.freeze({count: 6, r0: 9.6, y0: 1.2, rise: 0.75, tread: 1.05, podiumR: 8.9, floorY: -0.6});
/**
 * Auto quality (performans ajanı): kademeli düşüş, tek yönlü.
 *   0 → yüksek: bloom açık, oran = min(devicePixelRatio, 2)
 *   1 → bloom kapalı (ilk ve en ucuz kazanç: tam ekran ara hedef + birleştirme geçişi yok)
 *   2 → çözünürlük düşük: ≤ 1.4 MP, oran ≤ 1.25
 *   3 → düşük kalite: oran = 1, kalabalık/ışık/parçacık azaltılır
 * 40 karelik pencerenin ortalaması 20 ms'yi aşarsa bir kademe inilir; ısınma
 * (45 kare) ve 250 ms'den uzun duraklamalar (shader derleme, sekme dönüşü) ölçülmez.
 */
export const AUTO_QUALITY = Object.freeze({slowMs: 20, warmupFrames: 45, windowFrames: 40, ignoreAboveMs: 250, lowStep: 3});

/**
 * Sinematik katman (paket 29): süper donması, KO ağır çekimi, maç başı kamera
 * süpürmesi ve dinamik dövüş kamerası. Süreler ms.
 */
export const CINEMATIC = Object.freeze({
  superDim: 0.65,        // süper anında çevre/kolezyum parlaklığı → 1 - 0.65 ≈ %35
  superInMs: 90,         // kararma girişi
  superOutFrac: 0.35,    // sürenin son %35'inde yumuşak dönüş
  superMinMs: 120,
  superMaxMs: 2000,
  slowMinScale: 0.05,
  slowInMs: 120,
  slowOutFrac: 0.3,
  slowMaxMs: 4000,
  sweepMinMs: 300,
  sweepMaxMs: 6000,
  frameSmooth: 0.22,     // dinamik kamera: kritik sönümlü takip süresi (s)
});

/** Zemin parlaması havuzu: 2 koltuk halkası + 2 isabet dalgası, TEK çizim çağrısı. */
const FLOOR_GLOW_SLOTS = 4;
const FLOOR_GLOW_Y = 0.01;

// -------------------------------------------------------------------- helpers

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, k) => a + (b - a) * k;
const isSeat = seat => seat === 1 || seat === 2;
const otherSeat = seat => (seat === 1 ? 2 : 1);
const facingOf = seat => (seat === 2 ? -1 : 1);
const easeOutCubic = k => 1 - Math.pow(1 - k, 3);
const easeInOutSine = k => -(Math.cos(Math.PI * k) - 1) / 2;
const easeInQuad = k => k * k;
const bump = k => Math.sin(Math.PI * clamp(k, 0, 1)); // 0 → 1 → 0

/** Tiny deterministic RNG so the drawn arena looks identical on every load. */
function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function safeCall(fn, ...args) {
  try {
    return fn(...args);
  } catch {
    return undefined;
  }
}

function rectOf(element) {
  try {
    const r = element?.getBoundingClientRect?.();
    if (!r || !Number.isFinite(r.left) || !Number.isFinite(r.top)) return null;
    const width = Number(r.width ?? r.right - r.left) || 0;
    const height = Number(r.height ?? r.bottom - r.top) || 0;
    return {left: r.left, top: r.top, width, height, right: r.left + width, bottom: r.top + height};
  } catch {
    return null;
  }
}

// ------------------------------------------------------------- shader sources

const SKY_VERTEX = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

const SKY_FRAGMENT = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uLeft;
  uniform vec3 uRight;
  uniform vec3 uHorizon;
  varying vec3 vDir;
  void main() {
    vec3 d = normalize(vDir);
    float h = clamp(d.y * 1.4 + 0.12, 0.0, 1.0);
    vec3 side = mix(uLeft, uRight, smoothstep(-0.7, 0.7, d.x));
    vec3 col = mix(side, uTop, pow(h, 0.65));
    col += uHorizon * exp(-abs(d.y - 0.02) * 10.0) * 0.55;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }`;

/** Fresnel shield bubble: bright rim, nearly clear centre, slow scan bands. */
const SHIELD_VERTEX = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vViewW;
  varying float vY;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewW = normalize(cameraPosition - world.xyz);
    vY = position.y;
    gl_Position = projectionMatrix * viewMatrix * world;
  }`;

const SHIELD_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uTime;
  varying vec3 vNormalW;
  varying vec3 vViewW;
  varying float vY;
  void main() {
    float f = pow(1.0 - abs(dot(normalize(vNormalW), normalize(vViewW))), 2.4);
    float bands = 0.5 + 0.5 * sin(vY * 26.0 - uTime * 5.0);
    float alpha = (f * 0.95 + 0.05 + bands * f * 0.25) * uOpacity;
    gl_FragColor = vec4(uColor * (0.55 + f * 1.6), alpha);
    #include <colorspace_fragment>
  }`;

/** Full-screen additive flash quad (ignores the camera transform). */
const FLASH_VERTEX = /* glsl */ `
  void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const FLASH_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  void main() {
    gl_FragColor = vec4(uColor, uOpacity);
    #include <colorspace_fragment>
  }`;

// --- Colosseum shaders (no textures needed → identical in every browser) -----

/** Instanced, camera-facing brazier flame (billboard in view space). */
const FLAME_VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uBoost;
  varying vec2 vUv;
  varying float vSeed;
  varying float vSide;
  void main() {
    vUv = uv;
    vec4 c = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    vSeed = fract(sin(dot(c.xz, vec2(12.9898, 78.233))) * 43758.5453);
    vSide = step(0.0, c.x);
    float s = length(instanceMatrix[0].xyz);
    float flick = 1.0 + 0.14 * sin(uTime * 11.0 + vSeed * 40.0) + 0.08 * sin(uTime * 23.0 + vSeed * 13.0);
    vec4 mv = viewMatrix * c;
    mv.xy += vec2(position.x, position.y * flick * (1.0 + 0.35 * uBoost)) * s;
    gl_Position = projectionMatrix * mv;
  }`;

const FLAME_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform vec3 uFire;
  uniform vec3 uRune;
  varying vec2 vUv;
  varying float vSeed;
  varying float vSide;
  void main() {
    float y = vUv.y;
    float wob = sin(y * 9.0 - uTime * 8.0 + vSeed * 30.0) * 0.12 * y;
    float width = (1.0 - y) * 0.9 + 0.08;
    float dx = (vUv.x * 2.0 - 1.0 + wob) / width;
    float body = clamp(1.0 - dx * dx, 0.0, 1.0) * smoothstep(0.0, 0.12, y) * (1.0 - smoothstep(0.5, 1.0, y));
    float core = body * body * body * (1.0 - y);
    vec3 col = mix(uFire, uRune, vSide) * body * 1.6 + vec3(1.0, 0.9, 0.72) * core * 1.5;
    gl_FragColor = vec4(col, body);
    #include <colorspace_fragment>
  }`;

/** Instanced hanging banner with a slow cloth wave and a procedural sigil. */
const BANNER_VERTEX = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying float vSide;
  varying float vShade;
  void main() {
    vUv = uv;
    vec4 c = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    vSide = step(0.0, (modelMatrix * c).x);
    float seed = fract(sin(c.x * 12.9898 + c.z * 78.233) * 43758.5453);
    vec3 p = position;
    float hang = 1.0 - uv.y;
    float wave = uTime * 1.6 + seed * 6.2831 + p.y * 1.8;
    p.z += sin(wave) * 0.12 * hang;
    p.x += sin(uTime * 1.1 + seed * 4.0) * 0.04 * hang;
    vShade = 0.78 + 0.22 * cos(wave);
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
  }`;

const BANNER_FRAGMENT = /* glsl */ `
  uniform vec3 uFire;
  uniform vec3 uRune;
  uniform vec3 uTrim;
  varying vec2 vUv;
  varying float vSide;
  varying float vShade;
  void main() {
    float tail = 0.12 * (1.0 - abs(vUv.x - 0.5) * 2.0);
    if (vUv.y < tail) discard;
    vec3 base = mix(uFire, uRune, vSide);
    vec2 q = vUv - vec2(0.5, 0.6);
    float d = abs(q.x) * 1.4 + abs(q.y);
    float ring = 1.0 - smoothstep(0.0, 0.022, abs(d - 0.17));
    float dot2 = 1.0 - smoothstep(0.03, 0.06, length(q * vec2(1.0, 0.8)));
    float edge = clamp(step(0.43, abs(vUv.x - 0.5)) + step(0.95, vUv.y), 0.0, 1.0);
    vec3 col = base * (0.35 + 0.55 * vUv.y) * vShade;
    col = mix(col, uTrim * 0.8, edge * 0.85);
    col += uTrim * (ring + dot2) * 0.85;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }`;

/** Fake volumetric spotlight cone (apex at origin, base at y = -1). */
const SPOT_VERTEX = /* glsl */ `
  varying float vAlong;
  varying float vEdge;
  void main() {
    vAlong = clamp(-position.y, 0.0, 1.0);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * normal);
    vEdge = abs(dot(n, normalize(-mv.xyz)));
    gl_Position = projectionMatrix * mv;
  }`;

const SPOT_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAlong;
  varying float vEdge;
  void main() {
    float a = pow(vEdge, 1.6) * (1.0 - vAlong * 0.8) * uOpacity;
    gl_FragColor = vec4(uColor, a);
    #include <colorspace_fragment>
  }`;

/** Soft radial glow on a quad (light pools, moon halo). */
const GLOW_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

const GLOW_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float a = pow(max(0.0, 1.0 - d), 1.6) * uOpacity;
    gl_FragColor = vec4(uColor, a);
    #include <colorspace_fragment>
  }`;

/** GPU-only rising embers: positions are a pure function of time. */
const EMBER_VERTEX = /* glsl */ `
  attribute vec3 aSeed;
  uniform float uTime;
  uniform float uScale;
  uniform float uHeight;
  varying float vFade;
  varying float vSide;
  void main() {
    float life = fract(aSeed.x + uTime * aSeed.y);
    vec3 p = position;
    p.y += life * uHeight;
    p.x += sin(uTime * 0.7 + aSeed.x * 20.0) * aSeed.z;
    p.z += cos(uTime * 0.5 + aSeed.x * 13.0) * aSeed.z;
    vFade = sin(life * 3.14159);
    vSide = step(0.0, position.x);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = clamp(0.09 * uScale / max(-mv.z, 0.1), 1.0, 8.0);
    gl_Position = projectionMatrix * mv;
  }`;

const EMBER_FRAGMENT = /* glsl */ `
  uniform vec3 uFire;
  uniform vec3 uRune;
  varying float vFade;
  varying float vSide;
  void main() {
    vec2 c = gl_PointCoord * 2.0 - 1.0;
    float d = dot(c, c);
    if (d > 1.0) discard;
    gl_FragColor = vec4(mix(uFire, uRune, vSide), (1.0 - d) * vFade * 0.9);
    #include <colorspace_fragment>
  }`;

/**
 * Instanced floor glow (paket 29). aParam = (alpha, ring radius 0..1, ring
 * width, core fill). Seat rings and hit shockwaves share one draw call.
 */
const FLOOR_GLOW_VERTEX = /* glsl */ `
  attribute vec4 aParam;
  varying vec2 vUv;
  varying vec4 vParam;
  varying vec3 vColor;
  void main() {
    vUv = uv;
    vParam = aParam;
    #ifdef USE_INSTANCING_COLOR
      vColor = instanceColor;
    #else
      vColor = vec3(1.0);
    #endif
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }`;

const FLOOR_GLOW_FRAGMENT = /* glsl */ `
  varying vec2 vUv;
  varying vec4 vParam;
  varying vec3 vColor;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    if (d > 1.0 || vParam.x <= 0.001) discard;
    float ring = exp(-pow((d - vParam.y) / max(vParam.z, 0.002), 2.0));
    float core = pow(1.0 - d, 2.2) * vParam.w;
    float a = (ring + core) * vParam.x * (1.0 - smoothstep(0.86, 1.0, d));
    gl_FragColor = vec4(vColor, a);
    #include <colorspace_fragment>
  }`;

// =============================================================================
//  Factory
// =============================================================================

/**
 * @param {object} options
 * @param {Element} options.root            `#pvp-root` (must contain `.pvp2-duel`)
 * @param {() => boolean} [options.isReduced] reduced-effects predicate
 * @param {object} [options.THREE]           injected three.js namespace (tests)
 * @param {object} [options.env]             window-like environment (tests)
 * @param {Function} [options.createRenderer] ({THREE, canvas}) => renderer (tests)
 * @param {Function} [options.loadTexture]    (url) => Promise<THREE.Texture>
 * @param {string} [options.assetBase]        rig PNG folder (document relative)
 * @returns {Promise<object|null>} Arena3D, or null when 3D is unavailable.
 */
export async function createArena3D({
  root,
  isReduced = () => false,
  onImpact = () => {},
  THREE = null,
  env = globalThis,
  createRenderer = null,
  loadTexture = null,
  assetBase = './assets/rig/',
  // Paket 32: 3B rig'li karakter modelleri. loadModel(url) → {gltf, clips}; cloneModel = SkeletonUtils.clone.
  // Varsayılanlar vendor GLTFLoader/SkeletonUtils'i tembel yükler; model yoksa düzlem dövüşçü kalır.
  loadModel = null,
  cloneModel = null,
  modelBase = FIGHTER_MODEL_BASE,
} = {}) {
  // ---------------------------------------------------------------- guards
  const duel = safeCall(() => root?.querySelector?.('.pvp2-duel')) || null;
  const doc = root?.ownerDocument || env?.document || null;
  if (!root || !duel || !doc || typeof doc.createElement !== 'function') return null;

  if (!THREE) {
    try {
      THREE = await import('./vendor/three.module.min.js');
    } catch {
      return null;
    }
  }
  if (!THREE?.Scene || !THREE?.PerspectiveCamera) return null;

  let canvas;
  try {
    canvas = doc.createElement('canvas');
  } catch {
    return null;
  }
  if (!canvas || typeof canvas.getContext !== 'function') return null;

  // Renderer creation is the WebGL availability probe.
  let renderer = null;
  try {
    renderer = createRenderer
      ? createRenderer({THREE, canvas})
      : new THREE.WebGLRenderer({canvas, antialias: true, alpha: false, powerPreference: 'high-performance'});
  } catch {
    renderer = null;
  }
  if (!renderer || typeof renderer.render !== 'function') {
    safeCall(() => renderer?.dispose?.());
    return null;
  }

  // ------------------------------------------------------------- bookkeeping
  const now = () => {
    const perf = env?.performance;
    return typeof perf?.now === 'function' ? perf.now() : Date.now();
  };
  const motionPreference = safeCall(() => env?.matchMedia?.('(prefers-reduced-motion: reduce)'));
  const reduced = () => {
    try {
      return Boolean(isReduced() || root?.classList?.contains?.('pvp4-reduced') || motionPreference?.matches);
    } catch {
      return false;
    }
  };
  const owned = {geometries: new Set(), materials: new Set(), textures: new Set()};
  const geo = g => (owned.geometries.add(g), g);
  const mat = m => (owned.materials.add(m), m);
  const tex = t => (t && owned.textures.add(t), t);

  let destroyed = false;
  let qualityMode = 'auto';   // 'high' | 'low' | 'auto'
  const governor = createFrameGovernor({...AUTO_QUALITY, maxStep: AUTO_QUALITY.lowStep});
  const softwareRenderer = safeCall(() => {
    const gl = renderer.getContext?.();
    const ext = gl?.getExtension?.('WEBGL_debug_renderer_info');
    const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl?.getParameter?.(gl.RENDERER);
    return /swiftshader|llvmpipe|softpipe/i.test(String(name || ''));
  }) || false;
  if (softwareRenderer) governor.setStep(AUTO_QUALITY.lowStep);
  const autoStep = () => (qualityMode === 'auto' ? governor.step : 0);
  const startTime = now();
  let lastTime = startTime;
  let rafHandle = null;
  let contextLost = false;
  const plugins = [];
  const frameSubs = new Set();
  const cues = [];            // timed callbacks processed inside tick()
  const effectiveQuality = () => (qualityMode === 'auto'
    ? (governor.step >= AUTO_QUALITY.lowStep ? 'low' : 'high')
    : qualityMode);

  // --------------------------------------------------------- renderer setup
  safeCall(() => {
    if ('outputColorSpace' in renderer && THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
    if ('toneMapping' in renderer && THREE.ACESFilmicToneMapping) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
    }
    renderer.setClearColor?.(0x0b0620, 1);
  });
  const bloom = safeCall(() => createArenaBloom({THREE, renderer})) || null;
  let bloomEnabled = Boolean(bloom);

  canvas.className = 'pvp26-canvas';
  safeCall(() => canvas.setAttribute?.('aria-hidden', 'true'));
  if (canvas.style) {
    // Inline fallbacks so the layer never blocks input even without the CSS file.
    canvas.style.position = 'absolute';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '0';
  }

  // ------------------------------------------------------------------ scene
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x150a2c, 14, 44); // colosseum stands sit 10–22 units away

  const camera = new THREE.PerspectiveCamera(LAYOUT.fov, 3, 0.1, 120);
  const baseCamera = new THREE.PerspectiveCamera(LAYOUT.fov, 3, 0.1, 120); // layout-only camera
  const baseTarget = new THREE.Vector3(0, 1.4, 0);
  camera.position.set(0, LAYOUT.camY, LAYOUT.camZ);
  baseCamera.position.copy(camera.position);
  scene.add(camera); // camera children (flash quad) must be part of the scene graph

  let bubbleGeometry = null; // shared lazily-created geometries
  let blobGeometry = null;
  const fighterBlobTexture = drawBlob(); // shared by fighters across environment changes
  let env3d = buildEnvironment();
  const fighters = new Map(SEATS.map(seat => [seat, buildFighter(seat)]));
  const flashQuad = buildFlashQuad();
  const dimQuad = buildDimQuad();
  const floorGlow = buildFloorGlow();
  const FOG_BASE = scene.fog.color.clone();
  const HORIZON_BASE = env3d.sky.material.uniforms.uHorizon.value.clone();
  let stageId = DEFAULT_STAGE;
  let activeStage = wrapColosseum();
  let stageTime = 0;

  // ------------------------------------------------------------ cinematics (paket 29)
  // superFreeze / slowMo / introSweep state + dynamic fight-camera springs.
  const superState = {seat: null, start: 0, until: 0, light: false};
  const slowState = {scale: 1, start: 0, until: 0};
  const sweepState = {start: 0, until: 0};
  const fogPulse = {value: 0, color: new THREE.Color()};
  const framing = {
    cam: new THREE.Vector3(), look: new THREE.Vector3(),
    camVel: new THREE.Vector3(), lookVel: new THREE.Vector3(),
    camGoal: new THREE.Vector3(), lookGoal: new THREE.Vector3(),
  };
  /** Per-frame cinematic snapshot (computed at the top of tick()). */
  const cine = {superK: 0, superSeat: null, superLight: false, timeScale: 1, sweepK: 0};

  // ------------------------------------------------------------ camera FX
  const shakes = [];   // {start, dur, amp}
  const kicks = [];    // directional camera punches {start, dur, x, y}
  const flashes = [];  // {start, dur, color, intensity}
  // Hit-stop (paket 28): fighter tracks pause for a few frames on impact so the
  // hit "lands"; the defender trembles in place. Ultimates keep their own stop.
  const hitStop = {until: 0, start: 0, seat: null, amp: 0, last: 0};
  const dollyState = {track: null, k: 0, seat: null};

  // ================================================================ ENVIRONMENT

  function makeCanvas2D(w, h) {
    try {
      const c = doc.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext?.('2d');
      return ctx ? {c, ctx} : null;
    } catch {
      return null;
    }
  }

  function canvasTexture(drawn) {
    if (!drawn) return null;
    const t = tex(new THREE.CanvasTexture(drawn.c));
    if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }

  /** Original rune/hex floor sigil, warm on the fire side, cool on the rune side. */
  function drawRuneFloor() {
    const size = 1024;
    const drawn = makeCanvas2D(size, size);
    if (!drawn) return null;
    const {ctx} = drawn;
    const c = size / 2;
    const rand = seededRandom(26);
    try {
      const bg = ctx.createRadialGradient(c, c, 40, c, c, c);
      bg.addColorStop(0, '#1d1238');
      bg.addColorStop(0.7, '#0f0820');
      bg.addColorStop(1, '#07040f');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, size, size);

      // Horizontal warm → violet → cyan stroke gradient (u = world x).
      const ink = ctx.createLinearGradient(0, 0, size, 0);
      ink.addColorStop(0, '#ff7a2e');
      ink.addColorStop(0.42, '#ff4d6d');
      ink.addColorStop(0.58, '#9a5bff');
      ink.addColorStop(1, '#3fdcff');

      // Faint hex lattice clipped to the disc.
      ctx.save();
      ctx.beginPath();
      ctx.arc(c, c, c * 0.8, 0, Math.PI * 2);
      ctx.clip();
      ctx.globalAlpha = 0.16;
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2;
      const r = 34;
      const hx = r * Math.sqrt(3);
      for (let row = -1; row * r * 1.5 < size + r; row++) {
        for (let col = -1; col * hx < size + hx; col++) {
          const x = col * hx + (row % 2 ? hx / 2 : 0);
          const y = row * r * 1.5;
          ctx.beginPath();
          for (let k = 0; k < 6; k++) {
            const a = Math.PI / 6 + (k * Math.PI) / 3;
            const px = x + r * Math.cos(a);
            const py = y + r * Math.sin(a);
            if (k === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.stroke();
        }
      }
      ctx.restore();

      // Concentric rings with glow.
      ctx.strokeStyle = ink;
      ctx.shadowColor = '#ffffff';
      const rings = [[0.97, 7, 0.95], [0.9, 2, 0.7], [0.8, 4, 0.85], [0.52, 3, 0.75], [0.3, 2, 0.6], [0.14, 3, 0.9]];
      for (const [fr, width, alpha] of rings) {
        ctx.globalAlpha = alpha;
        ctx.lineWidth = width;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(c, c, c * fr, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Glyph band between the 0.8 and 0.9 rings: little procedural runes.
      const glyphs = 40;
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.9;
      for (let i = 0; i < glyphs; i++) {
        const a = (i / glyphs) * Math.PI * 2;
        ctx.save();
        ctx.translate(c + Math.cos(a) * c * 0.85, c + Math.sin(a) * c * 0.85);
        ctx.rotate(a + Math.PI / 2);
        ctx.beginPath();
        const strokes = 2 + Math.floor(rand() * 3);
        for (let s = 0; s < strokes; s++) {
          const x1 = (rand() - 0.5) * 22;
          const y1 = (rand() - 0.5) * 26;
          ctx.moveTo(x1, y1);
          ctx.lineTo(x1 + (rand() - 0.5) * 22, y1 + (rand() - 0.5) * 26);
        }
        ctx.stroke();
        ctx.restore();
      }

      // Spokes between the inner rings.
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 2;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(c + Math.cos(a) * c * 0.3, c + Math.sin(a) * c * 0.3);
        ctx.lineTo(c + Math.cos(a) * c * 0.52, c + Math.sin(a) * c * 0.52);
        ctx.stroke();
      }

      // Central hexagram sigil.
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 4;
      for (const offset of [0, Math.PI]) {
        ctx.beginPath();
        for (let k = 0; k < 3; k++) {
          const a = offset - Math.PI / 2 + (k * Math.PI * 2) / 3;
          const px = c + Math.cos(a) * c * 0.28;
          const py = c + Math.sin(a) * c * 0.28;
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    } catch {
      /* partial drawing is fine */
    }
    return canvasTexture(drawn);
  }

  /** Soft radial blob used as a fake contact shadow. */
  function drawBlob() {
    const drawn = makeCanvas2D(128, 128);
    if (!drawn) return null;
    try {
      const g = drawn.ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
      g.addColorStop(0, 'rgba(0,0,0,0.75)');
      g.addColorStop(0.55, 'rgba(0,0,0,0.35)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      drawn.ctx.fillStyle = g;
      drawn.ctx.fillRect(0, 0, 128, 128);
    } catch {
      /* ignore */
    }
    return canvasTexture(drawn);
  }

  function buildEnvironment() {
    const group = new THREE.Group();
    group.name = 'pvp26-environment';
    scene.add(group);
    const hq = []; // objects hidden on low quality

    // --- Sky dome (gradient) -------------------------------------------------
    const sky = new THREE.Mesh(
      geo(new THREE.SphereGeometry(60, 32, 16)),
      mat(new THREE.ShaderMaterial({
        vertexShader: SKY_VERTEX,
        fragmentShader: SKY_FRAGMENT,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          // Night sky over an open-air arena: deep zenith, warm/cool haze, arena glow on the rim.
          uTop: {value: new THREE.Color(0x03020b)},
          uLeft: {value: new THREE.Color(0x24091a)},
          uRight: {value: new THREE.Color(0x0d0a33)},
          uHorizon: {value: new THREE.Color(0x6a2462)},
        },
      })),
    );
    sky.renderOrder = -10;
    sky.frustumCulled = false;
    group.add(sky);

    // --- Stars ------------------------------------------------------------------
    const rand = seededRandom(1907);
    const starCount = 420;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    const tint = new THREE.Color();
    for (let i = 0; i < starCount; i++) {
      const theta = rand() * Math.PI * 2;
      const y = 0.08 + rand() * 0.92;           // upper hemisphere only
      const rr = Math.sqrt(1 - y * y);
      positions[i * 3] = Math.cos(theta) * rr * 50;
      positions[i * 3 + 1] = y * 50;
      positions[i * 3 + 2] = Math.sin(theta) * rr * 50;
      tint.setHSL(rand() < 0.5 ? 0.07 : 0.72, 0.6, 0.65 + rand() * 0.3);
      colors[i * 3] = tint.r;
      colors[i * 3 + 1] = tint.g;
      colors[i * 3 + 2] = tint.b;
    }
    const starGeo = geo(new THREE.BufferGeometry());
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const stars = new THREE.Points(starGeo, mat(new THREE.PointsMaterial({
      size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true,
      opacity: 0.85, depthWrite: false, fog: false,
    })));
    stars.renderOrder = -9;
    stars.frustumCulled = false;
    group.add(stars);

    // --- Platform ----------------------------------------------------------------
    const platformBody = new THREE.Mesh(
      geo(new THREE.CylinderGeometry(4.25, 4.7, 0.6, 72, 1, false)),
      mat(new THREE.MeshStandardMaterial({color: 0x1a1230, roughness: 0.55, metalness: 0.45})),
    );
    platformBody.position.y = -0.3;
    group.add(platformBody);

    const runeTexture = drawRuneFloor();
    const floorMaterial = mat(new THREE.MeshStandardMaterial({
      color: runeTexture ? 0xffffff : 0x231a3d,
      map: runeTexture,
      emissive: runeTexture ? 0xffffff : 0x2a1450,
      emissiveMap: runeTexture,
      emissiveIntensity: 0.85,
      roughness: 0.42,
      metalness: 0.35,
    }));
    const floor = new THREE.Mesh(geo(new THREE.CircleGeometry(4.24, 72)), floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.002;
    group.add(floor);

    // Glowing rim: vertex colours run warm (fire side, -x) → cool (rune side, +x).
    const rimGeo = geo(new THREE.TorusGeometry(4.26, 0.045, 8, 160));
    const rimColors = [];
    const warm = new THREE.Color(PALETTE.fire.main);
    const cool = new THREE.Color(PALETTE.rune.accent);
    const mid = new THREE.Color(PALETTE.rune.main);
    const rimPos = rimGeo.getAttribute('position');
    for (let i = 0; i < rimPos.count; i++) {
      const k = clamp((rimPos.getX(i) / 4.26 + 1) / 2, 0, 1);
      const col = k < 0.5 ? warm.clone().lerp(mid, k * 2) : mid.clone().lerp(cool, (k - 0.5) * 2);
      rimColors.push(col.r, col.g, col.b);
    }
    rimGeo.setAttribute('color', new THREE.Float32BufferAttribute(rimColors, 3));
    const rim = new THREE.Mesh(rimGeo, mat(new THREE.MeshBasicMaterial({vertexColors: true, toneMapped: false})));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.02;
    group.add(rim);

    const halo = new THREE.Mesh(
      geo(new THREE.TorusGeometry(4.3, 0.16, 8, 120)),
      mat(new THREE.MeshBasicMaterial({
        color: 0xb06cff, transparent: true, opacity: 0.18,
        blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
      })),
    );
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 0.03;
    group.add(halo);
    hq.push(halo);

    // --- Floating pillars & crystals (behind the platform) ------------------------
    const pillarGeo = geo(new THREE.CylinderGeometry(0.26, 0.34, 1, 6));
    const bandGeo = geo(new THREE.TorusGeometry(0.36, 0.03, 6, 24));
    const stoneMat = mat(new THREE.MeshStandardMaterial({color: 0x3a2d5c, emissive: 0x1c1036, emissiveIntensity: 1, roughness: 0.6, metalness: 0.3, flatShading: true}));
    const floaters = [];
    // Two obelisks on the arena sand (the old outer pillars would cut through the stands).
    const pillarDefs = [
      {x: -6.6, z: -5.4, h: 3.2, color: PALETTE.fire.main, hq: false},
      {x: 6.7, z: -5.2, h: 3.4, color: PALETTE.rune.accent, hq: false},
    ];
    const pillarBands = []; // ulti kamerasında gizlenir (aşağıda: can barı sanılıyordu)
    for (const [i, def] of pillarDefs.entries()) {
      const pillar = new THREE.Group();
      const stone = new THREE.Mesh(pillarGeo, stoneMat);
      stone.scale.y = def.h;
      stone.position.y = def.h / 2;
      pillar.add(stone);
      const bandMat = mat(new THREE.MeshBasicMaterial({color: def.color, toneMapped: false}));
      for (const fr of [0.25, 0.8]) {
        const band = new THREE.Mesh(bandGeo, bandMat);
        band.rotation.x = Math.PI / 2;
        band.position.y = def.h * fr;
        band.name = 'pvp-pillar-band';
        pillarBands.push(band);
        pillar.add(band);
      }
      pillar.position.set(def.x, 0.2, def.z);
      pillar.rotation.z = (i % 2 ? 1 : -1) * 0.05;
      group.add(pillar);
      floaters.push({object: pillar, baseY: 0.2, amp: 0.12, speed: 0.5 + i * 0.13, phase: i * 1.7, spin: 0});
      if (def.hq) hq.push(pillar);
    }

    // Yüzen arka plan kristalleri (6 oktahedron) KALDIRILDI: ölçümde (1366×768) hepsi ya can çubuğu/oyuncu satırının
    // altında ya da dövüşçü kafasının yanında (ör. ekran 998,152 ≈ Nyx'in 40 px yanı) duruyordu; anlamsız "turkuaz kristal".

    // --- Lights ---------------------------------------------------------------------
    const hemi = new THREE.HemisphereLight(0x8a74ff, 0x1a0710, 0.75);
    group.add(hemi);
    const key = new THREE.DirectionalLight(0xfff0e6, 1.5);
    key.position.set(1.5, 6, 7);
    group.add(key);
    const backRim = new THREE.DirectionalLight(0x6b5cff, 0.5); // cool edge on the platform
    backRim.position.set(0, 3, -8);
    group.add(backRim);

    const blobTexture = fighterBlobTexture;
    const colosseum = buildColosseum(group);
    // Ambient lights dimmed by the super freeze (base intensities kept here).
    const ambient = [hemi, key, backRim].map(light => ({light, base: light.intensity}));
    return {group, hq, floaters, pillarBands, stars, floorMaterial, halo, blobTexture, starCount, colosseum, sky, ambient};
  }

  function wrapColosseum() {
    const environment = env3d;
    return buildStage(THREE, {id: DEFAULT_STAGE, parent: scene, quality: effectiveQuality(), isReduced: reduced,
      legacy: {
        group: environment.group, fog: scene.fog, ambient: environment.ambient,
        applyQuality(level) {
          const high = level === 'high';
          for (const object of environment.hq) object.visible = high;
          environment.stars.geometry.setDrawRange(0, high ? environment.starCount : Math.round(environment.starCount * 0.4));
          applyColosseumQuality(environment.colosseum, level);
        },
        update(dt, t, quiet) {
          updateColosseum(environment.colosseum, t, dt, quiet);
          environment.colosseum.embers.visible = !quiet;
          for (const f of environment.floaters) {
            f.object.position.y = f.baseY + (quiet ? 0 : Math.sin(t * f.speed + f.phase) * f.amp);
            if (f.spin) f.object.rotation.y = quiet ? 0 : t * f.spin;
          }
          environment.floorMaterial.emissiveIntensity = quiet ? 0.8 : 0.8 + 0.12 * Math.sin(t * 1.3);
          environment.stars.rotation.y = quiet ? 0 : t * 0.004;
        },
        dispose(resources) {
          for (const kind of ['geometries', 'materials', 'textures']) {
            for (const item of resources[kind]) owned[kind].delete(item);
          }
        },
      },
    });
  }

  function setStage(id) {
    if (destroyed) return;
    const next = normalizeStage(id);
    if (next === stageId) return;
    activeStage.dispose();
    env3d = null;
    stageId = next;
    stageTime = 0;
    if (next === DEFAULT_STAGE) {
      scene.fog = new THREE.Fog(0x150a2c, 14, 44);
      env3d = buildEnvironment();
      activeStage = wrapColosseum();
    } else {
      activeStage = buildStage(THREE, {id: next, quality: effectiveQuality(), parent: scene, isReduced: reduced, document: doc});
    }
    FOG_BASE.copy(scene.fog.color);
    fogPulse.value = 0;
    activeStage.applyQuality(effectiveQuality());
    layout(true);
    queueWarmup();
  }

  // ================================================================ COLOSSEUM
  //
  // Circular open-air arena around the platform: sand floor, podium wall,
  // six stone tiers with neon edge lines, an instanced crowd that bobs and
  // cheers, instanced braziers (2 real flicker lights on high, emissive flames
  // elsewhere), cloth banners (fire-orange left / rune-violet right), fake
  // volumetric sweeping spotlights, GPU embers and a moon. Only the back
  // 288° arc is built: the camera sits inside the front gap.

  function neonArc(radius, y, tube, parent) {
    // Torus arc lying flat, centred on the back (−z), vertex-coloured warm (−x) → cool (+x).
    const g = geo(new THREE.TorusGeometry(radius, tube, 6, 160, ARENA_ARC.length));
    g.rotateZ(-Math.PI / 2 - ARENA_ARC.length / 2);
    g.rotateX(Math.PI / 2);
    const warm = new THREE.Color(PALETTE.fire.main);
    const mid = new THREE.Color(0xff4d6d);
    const cool = new THREE.Color(PALETTE.rune.main);
    const pos = g.getAttribute('position');
    const colors = [];
    for (let i = 0; i < pos.count; i++) {
      const k = clamp((pos.getX(i) / radius + 1) / 2, 0, 1);
      const col = k < 0.5 ? warm.clone().lerp(mid, k * 2) : mid.clone().lerp(cool, (k - 0.5) * 2);
      colors.push(col.r, col.g, col.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const mesh = new THREE.Mesh(g, mat(new THREE.MeshBasicMaterial({vertexColors: true, toneMapped: false, fog: false})));
    mesh.position.y = y;
    parent.add(mesh);
    return mesh;
  }

  function crowdGeometry() {
    const body = new THREE.Shape();
    body.moveTo(-0.24, 0);
    body.lineTo(0.24, 0);
    body.lineTo(0.22, 0.5);
    body.quadraticCurveTo(0.2, 0.62, 0.08, 0.64);
    body.lineTo(-0.08, 0.64);
    body.quadraticCurveTo(-0.2, 0.62, -0.22, 0.5);
    body.closePath();
    const head = new THREE.Shape();
    head.absarc(0, 0.78, 0.11, 0, TAU, false);
    return geo(new THREE.ShapeGeometry([body, head], 4));
  }

  function buildColosseum(parent) {
    const group = new THREE.Group();
    group.name = 'pvp26-colosseum';
    group.position.y = ARENA_SINK; // sunken bowl: the platform floats above the arena pit, tiers sit in view
    parent.add(group);
    const T = ARENA_TIERS;
    const rand = seededRandom(2026);
    const caps = ARENA_ENV_CAPS.high;
    const tmpM = new THREE.Matrix4();
    const tmpQ = new THREE.Quaternion();
    const tmpP = new THREE.Vector3();
    const tmpS = new THREE.Vector3();
    const UP = new THREE.Vector3(0, 1, 0);
    const polar = (phi, r, y, out = new THREE.Vector3()) => out.set(Math.sin(phi) * r, y, Math.cos(phi) * r);
    const faceCentre = phi => tmpQ.setFromAxisAngle(UP, phi + Math.PI);

    // --- Sand floor and the stepped stands (one lathe mesh) -------------------
    const ground = new THREE.Mesh(
      geo(new THREE.CircleGeometry(T.podiumR, 72).rotateX(-Math.PI / 2)),
      mat(new THREE.MeshLambertMaterial({color: 0x161021})),
    );
    ground.position.y = T.floorY;
    group.add(ground);

    const profile = [new THREE.Vector2(T.podiumR, T.floorY), new THREE.Vector2(T.podiumR, T.y0), new THREE.Vector2(T.r0, T.y0)];
    for (let i = 0; i < T.count; i++) {
      const r = T.r0 + i * T.tread;
      const y = T.y0 + (i + 1) * T.rise;
      profile.push(new THREE.Vector2(r, y), new THREE.Vector2(r + T.tread, y));
    }
    const backR = T.r0 + T.count * T.tread;
    profile.push(new THREE.Vector2(backR, 7.6), new THREE.Vector2(backR + 0.5, 7.6), new THREE.Vector2(backR + 0.5, 6.8));
    const stands = new THREE.Mesh(
      geo(new THREE.LatheGeometry(profile, 72, ARENA_ARC.start, ARENA_ARC.length)),
      mat(new THREE.MeshLambertMaterial({color: 0x2a2042, emissive: 0x0b0716, flatShading: true, side: THREE.DoubleSide})),
    );
    stands.name = 'pvp26-stands';
    group.add(stands);

    // Neon edge lines: podium lip, a mid tier, the top parapet.
    neonArc(T.podiumR + 0.02, T.y0 + 0.02, 0.035, group);
    neonArc(T.r0 + 3 * T.tread, T.y0 + 4 * T.rise + 0.02, 0.025, group);
    neonArc(backR + 0.5, 7.62, 0.04, group);

    // --- Crowd: instanced silhouettes on the treads ---------------------------
    const slots = [];
    const radii = Array.from({length: T.count}, (_, i) => T.r0 + i * T.tread + 0.55);
    const radiusSum = radii.reduce((a, b) => a + b, 0);
    const crowdArc = 1.8; // ±rad around the back that the camera can actually see
    for (let row = 0; row < T.count; row++) {
      const n = row === T.count - 1 ? caps.crowd - slots.length : Math.round((caps.crowd * radii[row]) / radiusSum);
      for (let k = 0; k < n; k++) {
        const phi = Math.PI - crowdArc + ((k + 0.5 + (rand() - 0.5) * 0.6) / n) * crowdArc * 2;
        slots.push({phi, r: radii[row] + (rand() - 0.5) * 0.3, y: T.y0 + (row + 1) * T.rise, s: 0.85 + rand() * 0.3});
      }
    }
    // Deterministic shuffle: the 'low' prefix is spread evenly over all tiers.
    for (let i = slots.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [slots[i], slots[j]] = [slots[j], slots[i]];
    }
    const crowd = new THREE.InstancedMesh(crowdGeometry(), mat(new THREE.MeshBasicMaterial({color: 0x1c1226})), caps.crowd);
    crowd.name = 'pvp26-crowd';
    crowd.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    crowd.frustumCulled = false;
    const crowdBase = new Float32Array(caps.crowd * 3); // baseY, scale, phase
    const tint = new THREE.Color();
    slots.forEach((slot, i) => {
      polar(slot.phi, slot.r, slot.y, tmpP);
      tmpS.setScalar(slot.s);
      crowd.setMatrixAt(i, tmpM.compose(tmpP, faceCentre(slot.phi), tmpS));
      // Dark base colour × per-instance tint: warm faces on the fire side, cool on the rune side.
      tint.setHSL(tmpP.x < 0 ? 0.03 + rand() * 0.04 : 0.72 + rand() * 0.06, 0.5, 0.55 + rand() * 0.3);
      crowd.setColorAt(i, tint);
      crowdBase[i * 3] = slot.y;
      crowdBase[i * 3 + 1] = slot.s;
      crowdBase[i * 3 + 2] = rand() * TAU;
    });
    group.add(crowd);

    // --- Braziers on the arena sand, in front of the podium wall ---------------
    const brazierOffsets = [0.42, -0.42, 0.95, -0.95, 1.45, -1.45, 1.9, -1.9]; // +δ → x < 0 (fire side)
    const brazierR = T.podiumR - 0.5;
    const metal = mat(new THREE.MeshLambertMaterial({color: 0x2c2234, emissive: 0x2a0e08, side: THREE.DoubleSide}));
    const posts = new THREE.InstancedMesh(geo(new THREE.CylinderGeometry(0.1, 0.16, 1.5, 8).translate(0, 0.75, 0)), metal, caps.braziers);
    const bowls = new THREE.InstancedMesh(geo(new THREE.CylinderGeometry(0.42, 0.2, 0.32, 14, 1, true).translate(0, 1.66, 0)), metal, caps.braziers);
    const flameMaterial = mat(new THREE.ShaderMaterial({
      vertexShader: FLAME_VERTEX,
      fragmentShader: FLAME_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
      uniforms: {
        uTime: {value: 0},
        uBoost: {value: 0},
        uFire: {value: new THREE.Color(0xff6a1f)},
        uRune: {value: new THREE.Color(0x8b5cf6)},
      },
    }));
    const flames = new THREE.InstancedMesh(geo(new THREE.PlaneGeometry(0.9, 1.5).translate(0, 0.75, 0)), flameMaterial, caps.braziers);
    flames.frustumCulled = false;
    flames.renderOrder = 4;
    posts.name = 'pvp26-brazier-posts';
    bowls.name = 'pvp26-brazier-bowls';
    flames.name = 'pvp26-brazier-flames';
    const brazierPositions = [];
    brazierOffsets.forEach((offset, i) => {
      const phi = Math.PI + offset;
      polar(phi, brazierR, T.floorY, tmpP);
      brazierPositions.push(tmpP.clone());
      tmpS.setScalar(1);
      tmpM.compose(tmpP, faceCentre(phi), tmpS);
      posts.setMatrixAt(i, tmpM);
      bowls.setMatrixAt(i, tmpM);
      tmpP.y = T.floorY + 1.72;
      flames.setMatrixAt(i, tmpM.compose(tmpP, tmpQ.identity(), tmpS));
    });
    group.add(posts, bowls, flames);

    // Real flicker lights (high only) on the two braziers behind the fighters.
    const brazierLights = [];
    for (let i = 0; i < caps.lights; i++) {
      const p = brazierPositions[i];
      const light = new THREE.PointLight(p.x < 0 ? 0xff7a2a : 0x9a5bff, 14, 12, 1.6);
      light.position.set(p.x, T.floorY + 2.2, p.z);
      light.name = 'pvp26-brazier-light';
      group.add(light);
      brazierLights.push({light, base: 14, phase: i * 2.3});
    }

    // --- Banners hanging from the parapet --------------------------------------
    const bannerMaterial = mat(new THREE.ShaderMaterial({
      vertexShader: BANNER_VERTEX,
      fragmentShader: BANNER_FRAGMENT,
      side: THREE.DoubleSide,
      fog: false,
      uniforms: {
        uTime: {value: 0},
        uFire: {value: new THREE.Color(0xb8380c)},
        uRune: {value: new THREE.Color(0x5b21b6)},
        uTrim: {value: new THREE.Color(0xffc46b)},
      },
    }));
    const banners = new THREE.InstancedMesh(geo(new THREE.PlaneGeometry(1.15, 2.8, 1, 12)), bannerMaterial, caps.banners);
    banners.name = 'pvp26-banners';
    banners.frustumCulled = false;
    [0.22, -0.22, 0.62, -0.62, 1.02, -1.02, 1.42, -1.42].forEach((offset, i) => {
      const phi = Math.PI + offset;
      polar(phi, backR - 0.1, 6.15, tmpP);
      tmpS.setScalar(1);
      banners.setMatrixAt(i, tmpM.compose(tmpP, faceCentre(phi), tmpS));
    });
    group.add(banners);

    // --- Sweeping spotlights: additive cones + floor light pools ---------------
    const coneGeo = geo(new THREE.ConeGeometry(1, 1, 24, 1, true).translate(0, -0.5, 0));
    const poolGeo = geo(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2));
    const spotDefs = [
      {offset: 0.5, color: 0xffb27a}, {offset: -0.5, color: 0xb59bff},
      {offset: 1.2, color: 0xff8a4c}, {offset: -1.2, color: 0x7fd8ff},
    ];
    const spots = spotDefs.map((def, i) => {
      const coneMaterial = mat(new THREE.ShaderMaterial({
        vertexShader: SPOT_VERTEX, fragmentShader: SPOT_FRAGMENT,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
        uniforms: {uColor: {value: new THREE.Color(def.color)}, uOpacity: {value: 0.12}},
      }));
      const poolMaterial = mat(new THREE.ShaderMaterial({
        vertexShader: GLOW_VERTEX, fragmentShader: GLOW_FRAGMENT,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
        uniforms: {uColor: {value: new THREE.Color(def.color)}, uOpacity: {value: 0.22}},
      }));
      const cone = new THREE.Mesh(coneGeo, coneMaterial);
      cone.name = 'pvp26-spot';
      cone.frustumCulled = false;
      cone.renderOrder = 6;
      cone.position.copy(polar(Math.PI + def.offset, backR, 9.4));
      const pool = new THREE.Mesh(poolGeo, poolMaterial);
      pool.name = 'pvp26-spot-pool';
      pool.renderOrder = 2;
      group.add(cone, pool);
      return {cone, pool, coneMaterial, poolMaterial, phase: i * 1.9, target: new THREE.Vector3(), dir: new THREE.Vector3()};
    });

    // --- Embers rising over the stands (GPU-animated, no CPU work per frame) --
    const emberPos = new Float32Array(caps.embers * 3);
    const emberSeed = new Float32Array(caps.embers * 3);
    for (let i = 0; i < caps.embers; i++) {
      const phi = Math.PI + (rand() - 0.5) * 3.4;
      const r = 6 + rand() * 9;
      emberPos[i * 3] = Math.sin(phi) * r;
      emberPos[i * 3 + 1] = T.floorY + rand() * 1.5;
      emberPos[i * 3 + 2] = Math.cos(phi) * r;
      emberSeed[i * 3] = rand();
      emberSeed[i * 3 + 1] = 0.04 + rand() * 0.08;
      emberSeed[i * 3 + 2] = 0.2 + rand() * 0.6;
    }
    const emberGeo = geo(new THREE.BufferGeometry());
    emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
    emberGeo.setAttribute('aSeed', new THREE.BufferAttribute(emberSeed, 3));
    const emberMaterial = mat(new THREE.ShaderMaterial({
      vertexShader: EMBER_VERTEX, fragmentShader: EMBER_FRAGMENT,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      uniforms: {
        uTime: {value: 0}, uScale: {value: 600}, uHeight: {value: 9},
        uFire: {value: new THREE.Color(0xffa040)}, uRune: {value: new THREE.Color(0xa78bfa)},
      },
    }));
    const embers = new THREE.Points(emberGeo, emberMaterial);
    embers.name = 'pvp26-embers';
    embers.frustumCulled = false;
    embers.renderOrder = 3;
    group.add(embers);

    // --- Moon with a soft halo ---------------------------------------------------
    const moon = new THREE.Mesh(geo(new THREE.CircleGeometry(2.2, 40)), mat(new THREE.MeshBasicMaterial({color: 0xe7e2ff, fog: false, toneMapped: false})));
    moon.position.set(-17, 23, -46);
    moon.lookAt(0, LAYOUT.camY, LAYOUT.camZ);
    moon.renderOrder = -8;
    const moonHalo = new THREE.Mesh(geo(new THREE.PlaneGeometry(16, 16)), mat(new THREE.ShaderMaterial({
      vertexShader: GLOW_VERTEX, fragmentShader: GLOW_FRAGMENT,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      uniforms: {uColor: {value: new THREE.Color(0x7c6cff)}, uOpacity: {value: 0.32}},
    })));
    moonHalo.position.copy(moon.position);
    moonHalo.quaternion.copy(moon.quaternion);
    moonHalo.renderOrder = -8;
    group.add(moon, moonHalo);

    return {
      group, crowd, crowdBase, posts, bowls, flames, flameMaterial, brazierLights,
      banners, bannerMaterial, spots, embers, emberMaterial,
      excite: 0, focusSeat: null, frame: 0, level: 'high',
    };
  }

  /** Apply draw counts for a quality level ('low' → fewer instances, no extra lights). */
  function applyColosseumQuality(c, level) {
    const caps = ARENA_ENV_CAPS[level] || ARENA_ENV_CAPS.high;
    c.level = level;
    c.crowd.count = caps.crowd;
    c.posts.count = caps.braziers;
    c.bowls.count = caps.braziers;
    c.flames.count = caps.braziers;
    c.banners.count = caps.banners;
    c.spots.forEach((s, i) => {
      s.cone.visible = i < caps.spotlights;
      s.pool.visible = i < caps.spotlights;
    });
    // İş 12 (kasma): ışık SAYISI sabit — gizlemek yerine şiddet 0 (sayı değişince sahnedeki tüm programlar yeniden derleniyordu).
    c.brazierLights.forEach((b, i) => { b.on = i < caps.lights; b.light.visible = true; if (!b.on) b.light.intensity = 0; });
    safeCall(() => c.embers.geometry.setDrawRange(0, caps.embers));
  }

  /** Per-frame colosseum motion: crowd bob/cheer, flame flicker, banner wave, spot sweep. */
  function updateColosseum(c, t, dt, quiet) {
    c.excite = Math.max(anyKnockedOut() ? 0.3 : 0, c.excite * Math.exp(-dt * 1.2));
    if (c.excite < 1e-4) c.excite = 0;
    const excite = quiet ? 0 : c.excite;
    const motion = quiet ? 0 : 1;
    c.flameMaterial.uniforms.uTime.value = quiet ? 0 : t;
    c.flameMaterial.uniforms.uBoost.value = excite;
    c.bannerMaterial.uniforms.uTime.value = t * motion;
    c.emberMaterial.uniforms.uTime.value = quiet ? 0 : t;

    // Crowd: write translation-y / scale-y straight into the instance matrices
    // (rotation is about Y only, so element 5 is the pure Y scale). Low quality
    // updates every other frame.
    c.frame++;
    if (c.level === 'high' || c.frame % 2 === 0) {
      const arr = c.crowd.instanceMatrix.array;
      const base = c.crowdBase;
      for (let i = 0; i < c.crowd.count; i++) {
        const ph = base[i * 3 + 2];
        const idle = 0.015 * Math.sin(t * 1.7 + ph) * motion;
        const jump = excite * 0.16 * Math.max(0, Math.sin(t * 9 + ph * 3));
        arr[i * 16 + 13] = base[i * 3] + idle + jump;
        arr[i * 16 + 5] = base[i * 3 + 1] * (1 + excite * 0.12 * (0.5 + 0.5 * Math.sin(t * 7 + ph)));
      }
      c.crowd.instanceMatrix.needsUpdate = true;
    }

    for (const b of c.brazierLights) {
      if (b.on === false) continue;
      b.light.intensity = b.base * (quiet ? 0.88 : 0.82 + 0.12 * Math.sin(t * 13 + b.phase) + 0.06 * Math.sin(t * 29 + b.phase * 3) + excite * 0.4);
    }

    const speed = (1 + excite * 2) * motion;
    for (const s of c.spots) {
      if (!s.cone.visible) continue;
      s.target.set(Math.sin(t * 0.31 * speed + s.phase) * 2.8, POOL_Y, -0.5 + Math.cos(t * 0.23 * speed + s.phase * 1.3) * 1.4);
      const home = isSeat(c.focusSeat) ? fighters.get(c.focusSeat)?.home : null;
      if (home) s.target.set(home.x + (quiet ? 0 : Math.sin(t * 0.8 + s.phase) * 0.35), POOL_Y,
        home.z + (quiet ? 0 : Math.cos(t * 0.6 + s.phase) * 0.25));
      s.dir.subVectors(s.target, s.cone.position);
      const length = s.dir.length() || 1;
      s.cone.quaternion.setFromUnitVectors(DOWN, s.dir.multiplyScalar(1 / length));
      s.cone.scale.set(1.15, length, 1.15);
      s.pool.position.copy(s.target);
      s.coneMaterial.uniforms.uOpacity.value = 0.1 + 0.06 * excite;
      s.poolMaterial.uniforms.uOpacity.value = 0.2 + 0.15 * excite;
    }
  }

  function anyKnockedOut() {
    for (const fighter of fighters?.values?.() || []) if (fighter.ko) return true;
    return false;
  }

  /** Crowd reaction 0..1 (max-combined, decays over ~2 s). */
  function cheer(value) {
    const c = env3d?.colosseum;
    if (!c) return;
    c.excite = clamp(Math.max(c.excite, Number(value) || 0), 0, 1);
  }

  // ================================================================== FIGHTERS

  /** Loads one rig PNG; resolves to a texture or rejects. */
  function loadRigTexture(url) {
    if (typeof loadTexture === 'function') return Promise.resolve().then(() => loadTexture(url));
    return new Promise((resolve, reject) => {
      try {
        new THREE.TextureLoader().load(url, resolve, undefined, reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  function buildFighter(seat) {
    const id = CHARACTER_OF_SEAT[seat];
    const face = facingOf(seat);
    const palette = PALETTE[id];
    const W = RIG.planeW;
    const H = RIG.planeH;
    // Body-local y of a UV row (feet line = y 0).
    const yOf = v => (RIG.feetV - v) * H;
    const xOf = u => (u - 0.5) * W;
    const planeCenterY = yOf(0.5);

    const root3d = new THREE.Group();     // floor position, layout scale, yaw
    root3d.name = `pvp26-fighter-${seat}`;
    root3d.rotation.y = face * 0.2;      // turn slightly toward the opponent
    const actor = new THREE.Group();      // pose: lunge, lift, tilt (pivot at the feet)
    root3d.add(actor);
    scene.add(root3d);

    const planeGeo = geo(new THREE.PlaneGeometry(W, H));
    const materials = [];
    const makeLayer = (name, parent, offsetX, offsetY) => {
      const material = mat(new THREE.MeshStandardMaterial({
        color: 0xffffff,
        transparent: false,
        alphaTest: 0.4,
        side: THREE.DoubleSide,
        roughness: 0.78,
        metalness: 0.05,
        emissive: 0xffffff,
        emissiveIntensity: 0.38,
      }));
      materials.push(material);
      const mesh = new THREE.Mesh(planeGeo, material);
      mesh.name = `${id}-${name}`;
      mesh.position.set(offsetX, offsetY, RIG.layerZ[name]);
      parent.add(mesh);
      return {mesh, material, name};
    };

    const core = makeLayer('core', actor, 0, planeCenterY);
    const pivotOf = (name) => {
      const [u, v] = RIG.pivots[id][name];
      const pivot = new THREE.Group();
      pivot.position.set(xOf(u), yOf(v), 0);
      actor.add(pivot);
      const layer = makeLayer(name, pivot, -xOf(u), planeCenterY - yOf(v));
      return {pivot, layer};
    };
    const guard = pivotOf('guard');
    const weapon = pivotOf('weapon');

    // Chest anchor (used by api.seatAnchor).
    const chest = new THREE.Object3D();
    chest.position.set(0, yOf(RIG.chestV), 0.1);
    actor.add(chest);

    // Shield bubble around the body.
    const bubbleMaterial = mat(new THREE.ShaderMaterial({
      vertexShader: SHIELD_VERTEX,
      fragmentShader: SHIELD_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uColor: {value: new THREE.Color(palette.shield)},
        uOpacity: {value: 0},
        uTime: {value: 0},
      },
    }));
    const bubble = new THREE.Mesh(sharedBubbleGeometry(), bubbleMaterial);
    bubble.position.set(0, yOf(0.5), 0.15);
    bubble.scale.set(1.05, 1.5, 0.75);
    bubble.visible = false;
    bubble.renderOrder = 5;
    actor.add(bubble);

    // Blob shadow (stays on the floor, follows the lunge offset).
    const shadow = new THREE.Mesh(
      sharedBlobGeometry(),
      mat(new THREE.MeshBasicMaterial({
        color: 0x000000,
        map: env3d.blobTexture,
        transparent: true,
        opacity: env3d.blobTexture ? 0.9 : 0.35,
        depthWrite: false,
      })),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.012;
    shadow.renderOrder = 1;
    root3d.add(shadow);

    // Coloured point light tied to the fighter.
    const light = new THREE.PointLight(palette.main, 10, 7, 1.6);
    light.position.set(0, 1.9, 1.3);
    scene.add(light);
    const accentLight = new THREE.PointLight(palette.accent, 4, 5, 1.8);
    accentLight.position.set(0, 0.4, 0.6);
    scene.add(accentLight);

    // Hidden until the PNG layers are ready (avoids black/empty quads).
    actor.visible = false;

    return {
      seat, id, face, palette, root: root3d, actor, chest, core, guard, weapon,
      materials, bubble, bubbleMaterial, shadow, light, accentLight,
      baseLight: 10,
      // Animation state
      tracks: [],          // timed pose contributions
      bubblePulses: [],    // {start, dur, strength}
      shatter: null,       // {start, dur}
      ko: null,            // {start, dur}
      victory: null,       // {start}
      lastPose: null,
      phase: seat * 1.37,  // desync idle loops
      clock: 0,            // idle clock (s): slowed by slowMo, stopped while super-frozen
      // Travel (ultimate pull / throw): root.position = home + offset (world units).
      home: new THREE.Vector3(),
      offset: new THREE.Vector3(),
      seg: null,           // active travel tween, see startSeg()
      spin: 0,             // extra body roll (rad, + = backward like tilt), pivoting at the waist
      // Paket 32: 3B model (null → düzlem dövüşçü). fighterId istenen karakter; modelToken yarışları keser.
      fighterId: null,
      model: null,
      modelToken: 0,
      modelJob: null,
      modelFailed: false,
      modelAsset: null,
      modelClock: 0,       // model simülasyon saati (ms): slowMo/hitStop ile birlikte ilerler
      fxQueue: [],         // zamanlı beceri efektleri {at, fn}
      lastCast: null,      // {at, hitMs}: rakibin isabet tepkisi vuruş anına ertelenir
      carry: 0,            // Şerit H: atlanan dönüşten kalan ileri ofset (gövde birimi); sonraki saldırı oradan başlar
      carryT: 0,
      castQueue: [],       // görsel kuyruk girdileri (hasar olayı sırayla bunlara bağlanır)
    };
  }

  function sharedBubbleGeometry() {
    if (!bubbleGeometry) bubbleGeometry = geo(new THREE.SphereGeometry(1, 32, 20));
    return bubbleGeometry;
  }
  function sharedBlobGeometry() {
    if (!blobGeometry) blobGeometry = geo(new THREE.CircleGeometry(0.85, 32));
    return blobGeometry;
  }

  function buildFlashQuad() {
    const material = mat(new THREE.ShaderMaterial({
      vertexShader: FLASH_VERTEX,
      fragmentShader: FLASH_FRAGMENT,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {uColor: {value: new THREE.Color(0xffffff)}, uOpacity: {value: 0}},
    }));
    const quad = new THREE.Mesh(geo(new THREE.PlaneGeometry(2, 2)), material);
    quad.frustumCulled = false;
    quad.renderOrder = 999;
    quad.visible = false;
    camera.add(quad);
    return {quad, material};
  }

  /**
   * Super-freeze darkening: a black camera-facing quad placed just BEHIND the
   * attacker. Depth-tested, so everything farther (colosseum, sky, back floor)
   * darkens while the fighters in front stay bright. Drawn after the colosseum's
   * additive layers (renderOrder 7) but before the fx plugin (9–11).
   */
  function buildDimQuad() {
    const material = mat(new THREE.MeshBasicMaterial({
      color: 0x000000, transparent: true, opacity: 0, depthWrite: false, depthTest: true, fog: false, toneMapped: false,
    }));
    const quad = new THREE.Mesh(geo(new THREE.PlaneGeometry(1, 1)), material);
    quad.name = 'pvp29-super-dim';
    quad.frustumCulled = false;
    quad.renderOrder = 7;
    quad.visible = false;
    camera.add(quad);
    return {quad, material};
  }

  /** Seat-coloured floor rings + hit shockwaves (one InstancedMesh, one draw call). */
  function buildFloorGlow() {
    const g = geo(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2));
    const params = new THREE.InstancedBufferAttribute(new Float32Array(FLOOR_GLOW_SLOTS * 4), 4);
    params.setUsage?.(THREE.DynamicDrawUsage);
    g.setAttribute('aParam', params);
    const material = mat(new THREE.ShaderMaterial({
      vertexShader: FLOOR_GLOW_VERTEX,
      fragmentShader: FLOOR_GLOW_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    }));
    const mesh = new THREE.InstancedMesh(g, material, FLOOR_GLOW_SLOTS);
    mesh.name = 'pvp29-floor-glow';
    mesh.frustumCulled = false;
    mesh.renderOrder = 2;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const hidden = new THREE.Matrix4().makeScale(1e-4, 1e-4, 1e-4);
    const color = new THREE.Color();
    for (let i = 0; i < FLOOR_GLOW_SLOTS; i++) {
      mesh.setMatrixAt(i, hidden);
      mesh.setColorAt(i, color.setHex(i < 2 ? PALETTE[CHARACTER_OF_SEAT[i + 1]].main : 0xffffff));
    }
    scene.add(mesh);
    const waves = [0, 1].map(() => ({active: false, start: 0, dur: 450, x: 0, z: 0, size: 1, strength: 1}));
    return {mesh, params, waves, hidden, matrix: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(), color};
  }

  // ======================================================== TEXTURE LOADING

  let readyResolve;
  const ready = new Promise(resolve => { readyResolve = resolve; });
  let readyState = 'loading'; // 'loading' | 'ready' | 'failed'

  (async () => {
    const jobs = [];
    for (const fighter of fighters.values()) {
      for (const layer of [fighter.core, fighter.guard.layer, fighter.weapon.layer]) {
        const url = `${assetBase}${fighter.id}-${layer.name}.webp`;
        jobs.push(loadRigTexture(url).then(texture => ({layer, texture})));
      }
    }
    let results;
    let timeoutHandle = null;
    const setTimer = env?.setTimeout ?? globalThis.setTimeout;
    const clearTimer = env?.clearTimeout ?? globalThis.clearTimeout;
    try {
      // Hard timeout so a stalled request cannot hide both fighters forever.
      results = await Promise.race([
        Promise.all(jobs),
        new Promise((_, reject) => {
          timeoutHandle = setTimer(() => reject(new Error('timeout')), 8000);
        }),
      ]);
    } catch {
      results = null;
    }
    safeCall(() => clearTimer(timeoutHandle));
    if (destroyed) {
      for (const result of results || []) safeCall(() => result.texture?.dispose?.());
      readyResolve(false);
      return;
    }
    if (!results || results.some(r => !r.texture || !r.texture.isTexture)) {
      // Graceful fallback: keep the DOM rigs (class never added → canvas stays
      // behind the opaque stage backgrounds). Paket 32: modeller hazırsa sahne yine açılır.
      if (readyState !== 'ready') readyState = 'failed';
      readyResolve(false);
      return;
    }
    for (const {layer, texture} of results) {
      tex(texture);
      if (THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;
      layer.material.map = texture;
      layer.material.emissiveMap = texture;
      layer.material.needsUpdate = true;
    }
    // Maça girişte 2B düzlem siluetinin parlaması olmasın: modeli yüklenmekte olan savaşçı gizli kalır (model gelince attachModel açar);
    // düzlem yalnız model yüklenemezse (modelFailed) ya da hiç model istenmediyse yedek olarak görünür.
    for (const fighter of fighters.values()) fighter.actor.visible = !fighter.fighterId || Boolean(fighter.model) || fighter.modelFailed;
    readyState = 'ready';
    safeCall(() => root.classList?.add?.('pvp26-3d'));
    layout(true);
    // Doku eklenince savaşçı malzemeleri yeni program ister (USE_MAP): tüm
    // kademe düzenleri için şimdi ön-derle, savaş ortasında değil.
    safeCall(() => queueWarmup());
    readyResolve(true);
  })();

  // ================================================================ 3D MODELS (paket 32)
  //
  // setFighters({1:'vargr', 2:'doran'}) yalnız seçili iki karakterin GLB'sini tembel yükler
  // (aynı karakter iki koltukta → aynı varlıktan iki SkeletonUtils klonu). Model gelince
  // düzlem katmanları gizlenir, model aynı actor grubuna girer: poz izleri (fwd/lift/tilt)
  // kök hareketi olarak uygulanmaya devam eder, gövdeyi klip animasyonu taşır.
  // Meshy yüklenirken veya hata verdiğinde mevcut düzlem yükleme silueti kalır.

  let skillFx = null;
  let cloneFn = typeof cloneModel === 'function' ? cloneModel : null;
  async function getClone() {
    if (cloneFn) return cloneFn;
    try {
      cloneFn = (await import('./vendor/SkeletonUtils.js')).clone;
    } catch {
      cloneFn = null;
    }
    return cloneFn;
  }
  function fetchModel(id) {
    // Dört karakterin tek yayın modeli Meshy GLB'dir.
    if (typeof loadModel === 'function') return Promise.resolve().then(() => loadModel(fighterModelUrl(id, env), id));
    return loadFighterModel(THREE, id, {env, base: modelBase});
  }
  /** WebGL sınırı: 41 kemikli iskelet ≈ 41×4 vec4 vertex uniform ister. */
  function modelsBlocked() {
    const max = Number(renderer?.capabilities?.maxVertexUniforms);
    return Number.isFinite(max) && max > 0 && max < 200;
  }
  function setPlaneVisible(fighter, visible) {
    fighter.core.mesh.visible = visible;
    fighter.guard.pivot.visible = visible;
    fighter.weapon.pivot.visible = visible;
  }
  function detachModel(fighter) {
    if (!fighter.model) return;
    safeCall(() => fighter.model.dispose());
    fighter.model = null;
    fighter.modelAsset = null;
    fighter.fxQueue = [];
    setPlaneVisible(fighter, true);
    fighter.actor.visible = true;
  }
  function attachModel(fighter, rig, asset) {
    detachModel(fighter);
    fighter.model = rig;
    fighter.modelAsset = asset;
    fighter.modelClock = 0;
    fighter.fxQueue = [];
    fighter.actor.add(rig.object);
    setPlaneVisible(fighter, false);
    fighter.actor.visible = true;
    if (!skillFx) {
      skillFx = safeCall(() => createSkillFx(THREE, scene)) || null;
      safeCall(() => skillFx?.setLowQuality(effectiveQuality() !== 'high'));
    }
    if (fighter.ko) rig.play('ko');
    else if (fighter.victory) rig.play('win');
    if (readyState !== 'ready' && [...fighters.values()].every(f => f.model)) {
      readyState = 'ready';
      safeCall(() => root.classList?.add?.('pvp26-3d'));
      layout(true);
    }
    safeCall(() => ensureCritBackdrop()); // İş 1: KRİTİK düzlemi de ön-ısıtmaya girsin
    safeCall(() => warmGhost(fighter)); // İş 12: destek siluetinin (kemikli + dokulu MeshBasic) programı da şimdi
    safeCall(() => queueWarmup()); // kemikli malzeme programları savaş ortasında değil şimdi derlensin
  }

  /**
   * İş 12 (kasma): destek vuruşu ilk geldiğinde partner silueti (createFighterGhost) ve düz destek düzlemi
   * yeni program istiyordu (dövüş ortasında ~1–2 sn donma). Aynı malzeme düzenleri gizli olarak sahnede
   * tutulur; ön-ısıtma (compile + warmDraw) derler, programlar maç boyunca paylaşılır.
   */
  const warmGhosts = new Map();
  let warmAssistPlane = null;
  function warmGhost(fighter) {
    if (!fighter?.model || !fighter.modelAsset || warmGhosts.get(fighter.seat)?.id === fighter.fighterId) return;
    const old = warmGhosts.get(fighter.seat);
    if (old) { scene.remove(old.rig.object); safeCall(() => old.rig.dispose?.()); }
    const rig = createFighterRig(THREE, fighter.modelAsset, {fighterId: fighter.fighterId, seat: fighter.seat, clone: cloneFn, ghost: {color: 0xffffff, opacity: 0.4}});
    if (!rig?.object) return;
    rig.object.visible = false;
    rig.object.scale.setScalar(1e-4);
    scene.add(rig.object);
    warmGhosts.set(fighter.seat, {id: fighter.fighterId, rig});
    if (!warmAssistPlane) {
      warmAssistPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.01, 0.01), new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0, alphaTest: 0.02, side: THREE.DoubleSide, depthWrite: false, toneMapped: false}));
      warmAssistPlane.visible = false; warmAssistPlane.frustumCulled = false;
      scene.add(warmAssistPlane);
    }
  }

  /** Koltuk → karakter kimliği; bilinmeyen kimlikler yok sayılır. Döner: Promise<boolean> (hepsi yüklendi mi). */
  function setFighters(map = {}) {
    if (destroyed) return Promise.resolve(false);
    if (modelsBlocked()) return Promise.resolve(false);
    const jobs = [];
    for (const seat of SEATS) {
      const id = map?.[seat];
      if (!isKnownFighter(id)) continue;
      const fighter = fighters.get(seat);
      if (fighter.fighterId === id && (fighter.model || fighter.modelJob)) {
        jobs.push(fighter.modelJob || Promise.resolve(true));
        continue;
      }
      fighter.fighterId = id;
      fighter.modelFailed = false;
      const token = ++fighter.modelToken;
      detachModel(fighter);
      setPlaneVisible(fighter, false); fighter.actor.visible = false; // yükleme sırasında eski 2B silüet/önceki model parlamaz
      const job = (async () => {
        try {
          const [asset, clone] = await Promise.all([fetchModel(id), getClone()]);
          if (destroyed || token !== fighter.modelToken) return false;
          const rig = createFighterRig(THREE, asset, {fighterId: id, seat, clone});
          attachModel(fighter, rig, asset);
          return true;
        } catch (error) {
          if (token === fighter.modelToken) {
            fighter.modelFailed = true;
            setPlaneVisible(fighter, true); // yalnız hata: yedek düzlem silüet (doku hazırsa hemen, değilse doku yüklenince açılır)
            if (readyState === 'ready') fighter.actor.visible = true;
          }
          safeCall(() => env?.console?.warn?.(`[arena3d] ${id} Meshy modeli yüklenemedi; yükleme silueti gösteriliyor.`, error?.message || error));
          return false;
        } finally {
          if (token === fighter.modelToken) fighter.modelJob = null;
        }
      })();
      fighter.modelJob = job;
      jobs.push(job);
    }
    return Promise.all(jobs).then(results => results.length > 0 && results.every(Boolean));
  }

  // One contact owns damage feedback across the existing render adapters.
  const impactFeel = createImpactDirector({now, isReduced: reduced,
    contact(event, spec) {
      if (!reduced() && !event.blocked) {
        const t = now();
        const travelling = ult && ult.def === event.toSeat && fighters.get(event.toSeat)?.seg;
        // Plane fallback retains the existing ultimate's timed travel beats.
        if (travelling && !fighters.get(event.fromSeat)?.model) {
          impactFeel.state.stopUntil = 0;
          impactFeel.state.slowUntil = 0;
        } else {
          Object.assign(hitStop, {start:t, last:t, until:t + spec.hitstopMs, seat:event.toSeat, amp:0});
          const id = impactFeel.state.stopId;
          env.setTimeout?.(() => restoreHitstop(impactFeel.state, id, now()), spec.hitstopMs);
        }
        kicks.push({start:t, dur:240});
      }
      // contact() zaten temas karesidir (kombo vuruşu ya da ulti fazı): tepki/blok klibi ŞİMDİ oynar.
      // (Önceden yalnız kombo-bağlı olaylar sayılıyordu; ulti/blok tepkisi kuyruk meşgulken bastırılıyordu.)
      reactNow = true;
      try { handleCore(event); } finally { reactNow = false; }
      // Damage plugins share this exact contact; no second resolve delay.
      forwardToPlugins({...event, impactContact: true});
      if (!event.blocked && event.amount > 0) {
        const f = fighters.get(event.toSeat);
        // Üst üste vuruşlarda (toplu çözüm) çakma sürekli yenilenip karakteri beyaz tutuyordu: 260 ms'de en çok bir çakma.
        if (f && !(f.lastImpactFlashAt > now() - 260)) { f.lastImpactFlashAt = now(); f.impactFlash = {at: now(), whiteMs: spec.flashMs}; }
      }
    },
    deliver: (event, scene) => safeCall(() => onImpact(event, scene)),
  });
  let impactFrame = {shakeX:0, shakeY:0, punch:0, zoom:0, timeScale:1};
  let reactNow = false;
  let pendingBinding = null; // Görev 4: temas anındaki hasarın bağlı olduğu {entry, strike}
  const boundEvents = new WeakMap(); // Görev 4: event → {entry, strike} (kombo temas sırası)
  const lastReactionAt = new Map();  // Görev 4: seat → son tepki anı (trace penceresi)
  let deferredHpSync = null;
  let replayingUlt = false; // bekletilen ulti olayları girdi başlarken yeniden işleniyor
  // İş 1, 3. tur: okunur tempoda tek vuruşlu yakın sahne ~4,5 sn; aynı yaklaşmada en çok 3 vuruş zincirlenir.
  const COMBO_SCENE_MAX_MS = 7800; // tek kombo sahnesinin (yaklaşma + vuruşlar + dönüş) tavanı

  // ---- Şerit H / Görev 4: görsel zaman çizelgesi (sunucu olayları sıraya alınır, temas karesinde gösterilir)
  // Aynı anda tek koltuk; saldıran değişince iki taraf yerleşikken TURN.breathMs (~1,2 sn) ara.
  // Yerleşik = klip idle, kök hareketi/yolculuk/geri sekme bitmiş (darbe/blok tepkisi de bitti).
  const fighterSettled = f => {
    if (!f || f.ko || f.victory) return true;
    if (f.seg) return false;
    const kind = f.model?.anim?.state?.kind;
    if (kind && kind !== 'idle') return false;
    return Math.abs(f.actor?.position?.x || 0) < 0.05;
  };
  const timeline = createVisualTimeline({now, isReduced: reduced, breathMs: TURN.breathMs,
    isSettled: () => fighterSettled(fighters.get(1)) && fighterSettled(fighters.get(2)),
    setTimer: (fn, ms) => env?.setTimeout?.(fn, ms), clearTimer: id => env?.clearTimeout?.(id)});
  const probe = (() => {
    try { return /(?:^|[?&])animprobe=1(?=&|$)/.test(String(env?.location?.search || '')); } catch { return false; }
  })();
  // Hata ayıklama kancası (varsayılan KAPALI; ?animprobe=1): kare başına saldıran/savunan izi + olay zamanları.
  const animProbe = probe ? {frames: [], events: [], max: 6000, on: false,
    start() { this.frames.length = 0; this.events.length = 0; this.on = true; },
    stop() { this.on = false; return {frames: this.frames, events: this.events}; },
    mark(type, data) { if (this.on) this.events.push({t: now(), type, ...data}); }} : null;
  const probeMark = (type, data) => { if (animProbe) animProbe.mark(type, data); };
  /** Sahnesiz hasar teslimi (yalnız sayı/can) — ölçüm için nedeniyle işaretlenir. */
  const silentDamage = (event, why) => { probeMark('silent', {seat: event?.fromSeat, skill: `${event?.skill}:${why}`}); impactFeel.silent(event); };
  if (probe) safeCall(() => { env.__tuslabAnimProbe = animProbe; });

  /** Karaktere özel beceri: klip adımları + kök hareketi izi + zamanlı efektler. false → model yok. */
  function playModelSkill(seat, skill, {fx = true, compress = false, skipReturn = false, entry = null} = {}) {
    const fighter = fighters.get(seat);
    const rig = fighter?.model;
    if (!rig || fighter.ko) return false;
    const spec = rig.choreo[skill];
    if (!spec) return false;
    // Görev 4 — q/e kombo zinciri: tek yaklaşma + N vuruş + tek dönüş (plan kendisi kurar).
    const comboSkills = entry && (skill === 'q' || skill === 'e') && entry.strikes?.length
      ? entry.strikes.map(s => s.skill) : null;
    let chain = comboSkills && rig.playChain ? rig.playChain(comboSkills, {compress}) : null;
    if (comboSkills && !chain) return false;
    // Yakın dövüş q/e için yolculuk planı; menzilli q/e için klip süresi.
    const plan = !chain && entry ? rig.plan?.(skill, {compress, skipReturn}) || null : null;
    if (entry && !chain && (rig.anim.state.kind === 'hit' || rig.anim.state.kind === 'block')) rig.play('idle');
    if (!chain) rig.play(skill, plan ? {compress, skipReturn} : undefined);
    const hitMs = chain ? chain.contacts[0].ms : plan ? plan.hitMs : skill === 'r' && rig.ultimatePeakMs ? rig.ultimatePeakMs : spec.hitMs || 0;
    fighter.lastCast = {at: now(), hitMs, skill,
      clock: fighter.modelClock, arrived: false,
      ranged: (spec.fx || []).some(x => ['spear','dagger','rune','meteor','column','bread'].includes(x.kind))};
    const cast = fighter.lastCast;
    if (entry) entry.cast = cast;
    if (entry && chain) {
      for (let i = 0; i < entry.strikes.length && i < chain.contacts.length; i++) {
        entry.strikes[i].cast = {at: now(), hitMs: chain.contacts[i].ms, skill: entry.strikes[i].skill, clock: fighter.modelClock,
          arrived: false, ranged: fighter.lastCast.ranged};
      }
    }
    probeMark('cast', {seat, skill, hitMs, chain: chain ? {strikes: chain.contacts.length, totalMs: chain.totalMs} : null,
      plan: plan ? {travelMs: plan.travelMs, speed: plan.speed, compress, skipReturn} : null});
    emitDom('tuslab:pvp-cast', {seat, skill}); // ses: sahnenin cast anı (replik)
    const opponent = fighters.get(otherSeat(seat));
    const scale = fighter.root.scale.x || 1;
    // Dinamik temas mesafesi: model ölçeğinden (Box3 derinliği) saldıranın silah uzanımı + savunan gövdesi.
    const contactDistance = contactGap(Math.abs(opponent.root.position.x - fighter.root.position.x) / scale, rig.reach);
    const dur = chain ? chain.totalMs : plan ? plan.totalMs : skill === 'r' && rig.ultimatePeakMs
      ? Math.max(skillDuration(spec), rig.ultimateDurationMs || rig.ultimatePeakMs)
      : rig.sceneDuration?.(skill) || skillDuration(spec);
    const spinOk = !reduced();
    // İş 15: telegraf (hazırlık) imza efekti — zemin deseni, elde toplanan enerji, silah izi pencereleri.
    if (fx && !reduced()) sigFx({stage: 'cast', seat, def: otherSeat(seat), skill, fighterId: rig.fighterId, hitMs,
      contacts: chain ? chain.contacts.map(c => c.ms) : [hitMs], durationMs: dur});
    const carry0 = Math.min(fighter.carry || 0, contactDistance);
    const from = contactDistance > 0.001 ? carry0 / contactDistance : 0;
    const track = addTrack(fighter, dur, (p, o, m) => {
      const elapsed = p * Math.max(1, chain ? chain.totalMs : dur);
      // Kombo zincirinde kök hareket (dönüş/sıçrama) tüm koreografiyi zincir süresine oturtur:
      // tur zincir bitmeden tamamlanır, iz silinirken yaw sıçraması olmaz.
      const r = rootMotionAt(spec, p * (chain ? skillDuration(spec) : dur));
      const T = chain?.timing || plan?.timing || null;
      if (T) {
        // İş 1, 3. tur — telegraf (yerinde hafif eğilme) → koşu → vuruş(lar) → yön çevirip koşarak dönüş.
        const prog = sceneProgress(elapsed, T, from);
        o.fwd += (contactDistance * prog - carry0) * m;
        const tele = elapsed < T.telegraphMs ? Math.sin(Math.PI * elapsed / Math.max(1, T.telegraphMs)) : 0;
        o.tilt += -0.1 * tele * m;
        o.squash += 0.05 * tele * m;
        o.turn = Math.max(o.turn, sceneTurn(elapsed, T));
        // Kök dönüş/sıçrama klibin kendisinde: koreografi spin'i koşu/dönüş boyunca yayılmasın.
        o.glow += 0.3 * Math.sin(Math.PI * p);
        return;
      } else if (chain) {
        // Görev 4 — kombo izi: TEK yaklaşma, vuruş bandında duruş, son vuruştan sonra TEK dönüş.
        const prog = chainProgress(elapsed, {travelMs: chain.travelMs, returnStart: chain.returnStart, returnMs: chain.returnMs, from});
        o.fwd += (contactDistance * chain.moveIn * prog - carry0) * m;
      } else if (plan) {
        // Yumuşak ivmelenme + sonda fren, temasta toparlanma, sonra geri yürüyüş; sürekli eğri (ışınlanma yok).
        const prog = travelProgress(elapsed, {travelMs: plan.travelMs, hitMs: plan.hitMs, holdMs: plan.holdMs, returnMs: plan.returnMs, from});
        o.fwd += (contactDistance * prog - carry0) * m;
      } else if (!cast.ranged && skill !== 'r') {
        // Hızlı ease-out ileri (temastan ~90 ms önce varış), temas sonrası ease-in geri dönüş.
        const hit = Math.max(1, cast.hitMs);
        o.fwd += contactDistance * dashProgress(elapsed, hit, {returnMs: Math.max(200, dur - hit - 100)}) * m;
      } else o.fwd += r.fwd * m;
      o.lift += r.lift * m;
      if (spinOk) o.yaw += r.yaw; // azaltılmış harekette kendi ekseninde dönüş yok
      o.glow += skill === 'r' ? 1.1 * (1 - p) : 0.3 * Math.sin(Math.PI * p);
    });
    if (entry) {
      entry.track = track;
      entry.contactDistance = contactDistance;
      entry.plan = plan;
      entry.chain = chain;
      entry.scenePlan = chain
        ? {contacts: chain.contacts.map(c => c.ms), durationMs: chain.totalMs, moveIn: chain.moveIn, compress}
        : {hitMs, durationMs: dur};
    }
    if (fx) {
      const def = otherSeat(seat);
      const items = chain ? chain.fx : (spec.fx || []);
      for (const item of items) {
        const at = !chain && skill === 'r' && rig.ultimatePeakMs && item.kind === 'slam' ? rig.ultimatePeakMs : item.at || 0;
        fighter.fxQueue.push({at: fighter.modelClock + at, fn: () => spawnSkillFx(seat, def, item, cast)});
      }
      if (fighter.fxQueue.length > 12) fighter.fxQueue.splice(0, fighter.fxQueue.length - 12);
    }
    return true;
  }

  /** Bir efekt örneği: mermi/rün oku/meteor/sütun/kalkan kırıkları/girdap/yer darbesi. */
  function spawnSkillFx(seat, def, item, cast = fighterCast(seat)) {
    const fighter = fighters.get(seat);
    const rig = fighter?.model;
    if (!rig || destroyed) return;
    const color = rig.palette.main;
    const accent = rig.palette.accent;
    const s = fighter.root.scale.x || 1;
    const quiet = reduced();
    const impact = power => {
      if (cast) { cast.arrived = true; cast.contact = true; }
      impactFeel.flush();
      // The contact director owns damage flashes/camera; this cue only lights the floor.
      api.flash(color, 0.04, 100);
      spawnFloorWave(def, seat, 0.4 + 0.6 * power);
      if (power >= 0.8) { pulseFog(color, 0.5 * power); cheer(0.4 * power); }
    };
    // İş 15: karaktere özgü imza efekti (havuzlu, arena3d-fx). Üstlenirse eski skillFx gövdesi çizilmez;
    // varış geri çağrısı (impact → temas) aynı benzetim saatinde kalır.
    const sig = extra => !quiet && sigFx({stage: 'launch', seat, def, skill: item.skill ?? cast?.skill, fighterId: rig.fighterId, kind: item.kind,
      flight: item.flight, ms: item.ms, power: item.power, ...extra});
    if (item.kind === 'slam') {
      impact(item.power ?? 0.7);
      if (!quiet && skillFx) safeCall(() => skillFx.burst(rig.fighterId, api.seatAnchor(def), 0.8 + 0.4 * (item.power ?? 0.7)));
      if (!quiet) sigFx({stage: 'slam', seat, def, skill: item.skill ?? cast?.skill, fighterId: rig.fighterId, power: item.power});
      return;
    }
    if (quiet || !skillFx) {
      api.flash(color, 0.12, 160);
      if (item.kind === 'shards') shatterBubble(def);
      return;
    }
    const anchor = api.seatAnchor(def);
    const ground = api.seatGround(def);
    if (item.kind === 'spear' || item.kind === 'dagger' || item.kind === 'rune' || item.kind === 'bread') {
      const from = rig.boneWorld(item.from || 'handslot.r');
      const onArrive = () => impact(item.kind === 'spear' ? 0.45 : item.kind === 'bread' ? 0.4 : 0.3);
      if (!sig({from, onArrive})) skillFx.spawn({kind: item.kind, from, to: anchor, color, accent, flight: item.flight || 260, scale: s, profile: rig.fighterId, onArrive});
    } else if (item.kind === 'meteor') {
      const onArrive = () => impact(1.2);
      if (!sig({from: api.seatAnchor(seat), flight: item.flight || 500, onArrive})) {
        skillFx.spawn({kind: 'meteor', from: api.seatAnchor(seat), to: ground, color, accent, flight: item.flight || 500, scale: s * 1.2, profile: rig.fighterId, onArrive});
      }
    } else if (item.kind === 'column') {
      const onArrive = () => impact(0.6);
      if (!sig({onArrive})) skillFx.spawn({kind: 'column', to: ground, color, accent, ms: item.ms || 900, scale: s, profile: rig.fighterId, onArrive});
    } else if (item.kind === 'shockring') {
      // Ney Feryadı: neyin ucundan rakibe giden ses dalgası halkaları + nota parçacıkları (imza); yedekte zemin halkası.
      const onArrive = () => { impact(1); api.flash(color, 0.1, 220); };
      if (!sig({onArrive})) skillFx.spawn({kind: 'shockring', to: api.seatGround(seat), color, accent, ms: item.ms || 900, scale: s, profile: rig.fighterId, onArrive});
    } else if (item.kind === 'shards') {
      shatterBubble(def);
      if (!sig({})) skillFx.spawn({kind: 'shards', to: anchor, color: fighters.get(def)?.palette.shield ?? 0xffffff, accent, ms: 650, scale: s});
      impact(0.7);
    } else if (item.kind === 'swirl' && sig({})) {
      /* imza girdabı (kasırga / sema) çizildi */
    } else if (item.kind === 'swirl') {
      skillFx.spawn({kind: 'swirl', to: api.seatGround(seat), color, accent, ms: item.ms || 700, scale: s, profile: rig.fighterId,
        follow: out => {
          const g = api.seatGround(seat);
          out.set(g.x, 0.75 * s + (fighter.lastPose ? Math.max(0, fighter.lastPose.lift) * s : 0), g.z);
        }});
    }
  }

  function fighterCast(seat) { return fighters.get(seat)?.lastCast; }

  /** İş 15: imza efekt eklentisine (arena3d-fx.signature) ilet; üstlenen olursa true. */
  function sigFx(args) {
    for (const plugin of plugins) {
      if (typeof plugin?.signature !== 'function') continue;
      try { if (plugin.signature(args)) return true; } catch (error) { reportPluginError(plugin, error); }
    }
    return false;
  }

  /**
   * Görev 4 / madde 11 — KRİTİK yazısı karakterlerin ARKASINDA: sahnede iki dövüşçünün gerisinde
   * derinlik testli saydam düzlem (modeller önünde kalır, görüşü kapatmaz). DOM'daki kopyası 3B modda
   * gizlenir (arena3d.css). Temas karesinde açılır; reduced-motion'da büyüme animasyonu yok.
   */
  const CRIT_BACKDROP = Object.freeze({ms: 950, opacity: 0.9, behind: 1.6, text: 'KRİTİK!'});
  let critBackdrop = null; // {mesh, drawn, texture, start, seat, color}
  const hexCss = n => `#${(Number(n) >>> 0).toString(16).padStart(6, '0').slice(-6)}`;
  function showCritBackdrop(seat) {
    const color = fighters.get(seat)?.palette?.main ?? 0xffffff;
    if (!ensureCritBackdrop()) return false;
    return paintCritBackdrop(seat, color);
  }
  /** İş 1 — kasma: düzlem ön-ısıtmadan ÖNCE yaratılır (ilk kritikte malzeme derleme/tahsis yok). */
  function ensureCritBackdrop() {
    if (!critBackdrop) {
      const drawn = makeCanvas2D(1024, 256);
      const texture = canvasTexture(drawn);
      if (!drawn || !texture) return false;
      const material = new THREE.MeshBasicMaterial({map: texture, transparent: true, depthWrite: false, depthTest: true, opacity: 0, toneMapped: false});
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), material);
      mesh.name = 'pvp4-crit-backdrop';
      mesh.renderOrder = 1;
      mesh.frustumCulled = false;
      mesh.visible = false;
      scene.add(mesh);
      critBackdrop = {mesh, drawn, texture, start: -Infinity, seat: null, color: null};
    }
    return true;
  }
  function paintCritBackdrop(seat, color) {
    const b = critBackdrop;
    if (b.color !== color) {
      const {c, ctx} = b.drawn;
      safeCall(() => {
        ctx.clearRect(0, 0, c.width, c.height);
        ctx.font = '900 168px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.shadowColor = hexCss(color);
        ctx.shadowBlur = 36;
        ctx.lineWidth = 14;
        ctx.strokeStyle = 'rgba(8,4,20,0.85)';
        ctx.strokeText(CRIT_BACKDROP.text, c.width / 2, c.height / 2);
        ctx.fillStyle = hexCss(color);
        ctx.fillText(CRIT_BACKDROP.text, c.width / 2, c.height / 2);
      });
      b.texture.needsUpdate = true;
      b.color = color;
    }
    b.seat = seat;
    b.start = now();
    b.mesh.visible = true;
    probeMark('crit', {seat});
    return true;
  }
  function updateCritBackdrop(tNow) {
    const b = critBackdrop;
    if (!b || !b.mesh.visible) return;
    const p = (tNow - b.start) / CRIT_BACKDROP.ms;
    if (!(p >= 0 && p < 1)) { b.mesh.visible = false; b.mesh.material.opacity = 0; return; }
    const a1 = api.seatAnchor(1), a2 = api.seatAnchor(2);
    const s = fighters.get(1)?.root.scale.x || 1;
    const width = Math.max(2.4 * s, Math.abs(a1.x - a2.x) * 1.25);
    const pop = reduced() ? 1 : 0.9 + 0.1 * Math.min(1, p / 0.18);
    b.mesh.scale.set(width / 4 * pop, width / 4 * pop, 1);
    // Göğüs hizasının biraz üstü, iki dövüşçünün gerisinde (kamera +z'de).
    b.mesh.position.set((a1.x + a2.x) / 2, Math.max(a1.y, a2.y) + 0.35 * s, Math.min(a1.z, a2.z) - CRIT_BACKDROP.behind * s);
    b.mesh.material.opacity = CRIT_BACKDROP.opacity * (p < 0.12 ? p / 0.12 : p > 0.65 ? (1 - p) / 0.35 : 1);
  }

  /**
   * Şerit H — ulti sinematiği: 250–400 ms yavaş çekim (yalnız görsel; api.slowMo 0,42), kamera
   * önce saldırana yaklaşır (ultimatePhase 2'de temas noktasına geçer). Reduced-motion'da yok.
   */
  // İş 15: R kamera hareketi kısa — yavaş yaklaşma + ≤ 600 ms içinde genel plana dönüş (iki dövüşçü kadrajda).
  const ULTI_INTRO = Object.freeze({slowScale: 0.42, slowMs: 340, dollyMs: 600});
  function ultimateIntro(seat) {
    if (reduced()) return;
    api.slowMo(ULTI_INTRO.slowScale, ULTI_INTRO.slowMs);
    dollyTo(seat, ULTI_INTRO.dollyMs, false);
    probeMark('ultiIntro', {seat, slowScale: ULTI_INTRO.slowScale, slowMs: ULTI_INTRO.slowMs});
  }

  /**
   * Görev 4 — kombo teması: i. vuruş kendi karesinde temas sayılır, bağlı hasarlar
   * o anda gösterilir (impactFeel.flush). Son vuruş `finisher` işaretlenir.
   */
  function strikeContact(entry, index) {
    if (entry.dead) return;
    const strike = entry.strikes[index];
    if (!strike || strike.contact) return;
    strike.contact = true;
    entry.contact = true;
    if (strike.cast) { strike.cast.contact = true; strike.cast.arrived = true; }
    const last = index >= entry.strikes.length - 1;
    for (const event of strike.events) event.finisher = last && !entry.ultimate;
    if (!entry.ultimate) impactFeel.flush();
    // Girdi açık kalır: dönüş başlayana dek yeni saldırı aynı yaklaşmada zincire eklenir (extendMeleeEntry).
    probeMark('contact', {seat: entry.seat, skill: strike.skill, index, finisher: last, forced: false});
    emitDom('tuslab:pvp-strike', {seat: entry.seat, index, skill: strike.skill, finisher: last});
  }

  /** DOM katmanları (kombo sayacı vb.) için kozmetik olay; kök yoksa / hata verirse sessiz. */
  function emitDom(name, detail) {
    try { root.dispatchEvent?.(new env.CustomEvent(name, {bubbles: true, detail})); } catch { /* yalnız süs */ }
  }

  /**
   * Görev 4 — aktif/bekleyen kombo girdisine yeni vuruş ekle (yeniden başlatmadan).
   * Başlamışsa rig.extendChain + timeline addContact; hâlâ sıradaysa sadece strikes büyür.
   */
  function extendMeleeEntry(entry, skill) {
    const fighter = fighters.get(entry.seat);
    const rig = fighter?.model;
    if (!rig || entry.dead || entry.ultimate) return false;
    if (entry.strikes.length >= SCENE.maxStrikes) return false; // süre tavanı: yeni girdi
    // İş 1, 3. tur: menzilli (yerinde atış) ile yakın (koşarak) vuruş aynı sahnede karışmaz — menzilli yerinde kalır.
    const rangedOf = s => rig.chainPlan?.([s])?.moveIn === 0;
    // KESINYAP 21: istisna "karma zincir" — sahne henüz başlamadıysa menzilli vuruş(lar)ın ARDINA yakın vuruş eklenir
    // (evde atış → koşu → yakın vuruş → tek dönüş; sceneTiming prefix). Ayrı yaklaşmadan ~5 sn kısa.
    const mixOk = !entry.started && !rangedOf(skill) && entry.strikes.every(s => rangedOf(s.skill));
    if (rangedOf(skill) !== rangedOf(entry.strikes[0].skill) && !mixOk) return false;
    // Sahne tavanı (~3 sn): uzatılmış zincir bunu aşacaksa zincir kapanır; saldırı katlanır ya da yeni girdi açar.
    const skills = [...entry.strikes.map(s => s.skill), skill];
    const probe = entry.started && entry.chain
      ? rig.chainPlan?.(skills, {compress: entry.compress || false, fixed: entry.chain.contacts.map(c => c.ms), notBefore: entry.handle?.elapsed || 0})
      : rig.chainPlan?.(skills, {compress: entry.compress || false});
    if (probe && probe.totalMs > COMBO_SCENE_MAX_MS) { entry.open = false; return false; }
    const prevContacts = entry.chain ? entry.chain.contacts.length : 0;
    let plan = null;
    if (entry.started) {
      // Dönüş başladıysa zincir kapanmıştır: yeni saldırı yeni girdiye (yeni yaklaşma) gider.
      plan = rig.extendChain?.([skill], {compress: entry.compress || false});
      if (!plan || !plan.contacts) { entry.open = false; return false; }
    }
    entry.strikes.push({skill, bound: false, contact: false, cast: null, events: []});
    entry.open = true;
    if (!entry.started) {
      // Henüz sırada: start tüm strikes ile plan kurar; tahmini süre güncellenir.
      const rough = rig.chainPlan?.(entry.strikes.map(s => s.skill));
      if (rough) entry.handle?.reestimate?.(rough.totalMs);
      return true;
    }
    for (let i = prevContacts; i < plan.contacts.length; i++) {
      const idx = i; // kapanak: temas fn'si eklendiği andaki indisi görür
      entry.handle?.addContact?.({ms: plan.contacts[idx].ms, fn: () => strikeContact(entry, idx)});
    }
    entry.chain = plan;
    if (entry.strikes.length <= plan.contacts.length) {
      for (let i = prevContacts; i < entry.strikes.length && i < plan.contacts.length; i++) {
        if (!entry.strikes[i].cast) entry.strikes[i].cast = {at: now(), hitMs: plan.contacts[i].ms,
          clock: fighter.modelClock, arrived: false, ranged: false};
      }
    }
    // İş 15: zincire SONRADAN katılan vuruşun yetenek efektleri (önceden hiç kuyruğa girmiyordu) + silah izi penceresi.
    if (!reduced() && entry.cast && Number.isFinite(entry.cast.clock)) {
      const def = otherSeat(entry.seat);
      for (const item of plan.fx || []) {
        if ((item.index ?? 0) < prevContacts) continue;
        const strikeCast = entry.strikes[item.index]?.cast || entry.cast;
        fighter.fxQueue.push({at: entry.cast.clock + (item.at || 0), fn: () => spawnSkillFx(entry.seat, def, item, strikeCast)});
      }
      if (fighter.fxQueue.length > 12) fighter.fxQueue.splice(0, fighter.fxQueue.length - 12);
      const elapsed = fighter.modelClock - entry.cast.clock;
      const later = plan.contacts.slice(prevContacts).map(c => Math.max(0, c.ms - elapsed));
      if (later.length) sigFx({stage: 'cast', seat: entry.seat, def, skill, fighterId: rig.fighterId, contacts: later});
    }
    if (entry.scenePlan) {
      entry.scenePlan.contacts = plan.contacts.map(c => c.ms);
      entry.scenePlan.durationMs = plan.totalMs;
    }
    entry.handle?.reestimate?.(plan.totalMs);
    if (entry.handle) { entry.handle.durationMs = plan.totalMs; entry.handle.returnStartMs = plan.returnStart; }
    if (entry.track) entry.track.dur = Math.max(entry.track.dur, plan.totalMs);
    probeMark('extend', {seat: entry.seat, strikes: entry.strikes.length, totalMs: plan.totalMs});
    return true;
  }

  /**
   * q/e/r görsel kuyruğa girer. q/e: tek yaklaşma + N vuruş (kombo) + tek dönüş.
   * r (ulti): ULTIMATE_PHASE koreografisi korunur; girdi başlayana kadar faz olayları
   * bekletilir ki ulti başka bir saldırıyla üst üste binmesin (ulti korunumu).
   * Döner: true = kuyruğa alındı (çağıran ayrıca oynatmaz). Modelsiz/azaltılmış harekette false.
   */
  function enqueueMeleeSkill(seat, skill, {fx = true, ultimate = false, join = false, fold = false, pre = []} = {}) {
    if (reduced() || (skill !== 'q' && skill !== 'e' && !ultimate)) return false;
    const fighter = fighters.get(seat);
    const rig = fighter?.model;
    if (!rig || fighter.ko || !rig.choreo?.[skill]) return false;
    // KESINYAP 21 — her yetenek kendi klibiyle görünür: katlanacak/eklenecek vuruşun becerisi koltuğun sahnesinde
    // henüz yoksa önce zincire eklenir; menzil türü uyuşmuyorsa (Hacı Usta: menzilli Q + yakın W) katlanmaz, kendi
    // sahnesini açar (görsel birikim tavanı altındaysa). Eskiden W, Q'nun temasına katlanıp hiç oynamıyordu.
    const rangedSkill = s => rig.chainPlan?.([s])?.moveIn === 0;
    const ownClip = target => !ultimate && target && !target.entry.strikes.some(s => s.skill === skill)
      && (target.entry.open && extendMeleeEntry(target.entry, skill) ? 'chained'
        : rangedSkill(skill) !== rangedSkill(target.entry.strikes[0].skill)
          && timeline.remainingMs() <= timeline.VISUAL_QUEUE.maxBacklogMs ? 'own' : null);
    // İş 12: toplu vuruş sahnesi — hasar koltuğun açık sahnesinin son vuruşunda (tek temas karesi) gösterilir.
    if (fold) {
      const target = foldTarget(seat);
      const how = target ? ownClip(target) : null;
      if (how === 'chained') return true;
      if (target && how !== 'own') { probeMark('fold', {seat, skill}); return true; }
    }
    // Aynı koltuğun açık kombo girdisi varsa: yeni saldırı ZİNCİRE EKLENİR (yaklaşma tek kalır).
    if (!ultimate) {
      const open = fighter.castQueue.find(e => e.open && !e.dead && !e.ultimate);
      if (open && extendMeleeEntry(open, skill)) return true;
      // Motor bu vuruşu açık sahneye yerleştirdi: zincir doluysa yeni sahne açmak yerine katlanır (menzil uyuşmazlığı hariç).
      const target = join ? foldTarget(seat) : null;
      if (target && !(rangedSkill(skill) !== rangedSkill(target.entry.strikes[0].skill) && !target.entry.strikes.some(s => s.skill === skill)
        && timeline.remainingMs() <= timeline.VISUAL_QUEUE.maxBacklogMs)) { probeMark('fold', {seat, skill, join: true}); return true; }
      // Süre tavanı (madde 6): kuyruk tavanı aşmışsa yeni sahne AÇILMAZ; bu saldırının hasarı koltuğun
      // henüz temas etmemiş son vuruşunda toplu gösterilir (bindCastEntry yedeği). Işınlanma/hızlandırma yok.
      if (timeline.remainingMs() > timeline.VISUAL_QUEUE.maxBacklogMs && foldTarget(seat)) return true;
    }
    const entry = {seat, skill, ultimate, strikes: [{skill, bound: false, contact: false, cast: null, events: []}],
      cast: null, contact: false, bound: false, dead: false, open: true, started: false, compress: false,
      track: null, plan: null, chain: null, contactDistance: 0, skipReturn: false, events: [], handle: null, scenePlan: null};
    const eventsOf = () => {
      const list = [];
      for (const strike of entry.strikes) for (const event of strike.events) list.push(event);
      for (const event of entry.events) list.push(event);
      return list;
    };
    const finishEntry = forced => {
      entry.dead = true;
      entry.open = false;
      if (entry.strikes.length > 1) emitDom('tuslab:pvp-combo-end', {seat, forced: Boolean(forced)});
      const i = fighter.castQueue.indexOf(entry);
      if (i >= 0) fighter.castQueue.splice(i, 1);
      if (entry.track) { const j = fighter.tracks.indexOf(entry.track); if (j >= 0) fighter.tracks.splice(j, 1); }
      if (forced) {
        for (const event of eventsOf()) silentDamage(event, 'forced');
        // Zorla bitirilen girdide kök sıçraması yok: iz o anki ilerlemeye eşitlenir (carry).
        const handle = entry.handle;
        const elapsed = handle && Number.isFinite(handle.elapsed) ? handle.elapsed : entry.chain?.totalMs || 0;
        if (entry.chain?.timing && entry.contactDistance > 0) {
          fighter.carry = sceneProgress(elapsed, entry.chain.timing) * entry.contactDistance;
        } else if (entry.chain && entry.contactDistance > 0) {
          fighter.carry = chainProgress(elapsed, {travelMs: entry.chain.travelMs,
            returnStart: entry.chain.returnStart, returnMs: entry.chain.returnMs}) * entry.contactDistance * entry.chain.moveIn;
        } else fighter.carry = 0;
        // Yalnız OYNAYAN girdi idle'a döner: sırada bekleyen girdinin düşmesi aynı koltuğun
        // o an oynayan (ör. ulti) klibini kesmemeli.
        if (entry.started && fighter.model && !fighter.ko) safeCall(() => fighter.model.play('idle'));
      }
    };
    // Ulti, aynı koltuğun bekleyen kombosunu kapatır: sonraki q/e ultiden ÖNCE oynamaz (sıra korunur).
    if (ultimate) for (const e of fighter.castQueue) e.open = false;
    fighter.castQueue.push(entry);
    if (fighter.castQueue.length > 8) {
      const old = fighter.castQueue.shift(); old.dead = true; old.open = false;
      for (const strike of old.strikes || []) for (const event of strike.events) silentDamage(event, 'overflow');
      for (const event of old.events) silentDamage(event, 'overflow');
    }
    // KESINYAP 21: aynı sahnenin tamponlanmış sonraki yuvaları (pre) girdi BAŞLAMADAN zincire eklenir (karma zincir
    // dahil); eklenen olaylar __inScene ile işaretlenir, handleCore onları ikinci kez sıraya koymaz.
    if (!ultimate) for (const ev of pre) { if (!extendMeleeEntry(entry, ev.skill)) break; ev.__inScene = true; }
    const estimate = ultimate
      ? (rig.ultimateDurationMs || Math.max(rig.sceneDuration?.(skill) || 0, rig.ultimatePeakMs || 0))
      : rig.chainPlan?.(entry.strikes.map(s => s.skill))?.totalMs || rig.plan?.(skill)?.totalMs || rig.sceneDuration(skill);
    // keep: saldırı sahnesi birikim yüzünden DÜŞÜRÜLMEZ (düşen sahnenin hasarı sahnesiz görünürdü);
    // birikim, zaman çizelgesinin sıkıştırması (ctx.compress) ve aynı koltuk zincirlemesiyle emilir.
    entry.handle = timeline.enqueue({
      seat, estimateMs: estimate, keep: true, meta: {skill, ultimate},
      start: ctx => {
        entry.started = true;
        entry.compress = ctx.compress;
        if (fighter.ko || fighter.model !== rig) { entry.dead = true; return {contactMs: 0, durationMs: 0}; }
        playModelSkill(seat, skill, {fx, compress: ctx.compress, skipReturn: ctx.skipReturn, entry});
        entry.skipReturn = ctx.skipReturn;
        const p = entry.scenePlan;
        if (!p) return {contactMs: 0, durationMs: 0};
        if (ultimate) {
          // Ulti: ULTIMATE_PHASE/DAMAGE olayları girdi başlayınca sırayla işlenir.
          api.flash(fighters.get(seat).palette.main, 0.14, 260);
          ultimateIntro(seat);
          const pending = fighter.pendingUltEvents ? fighter.pendingUltEvents.splice(0) : [];
          // İş 1, 3. tur: faz olayları hasardan ÖNCE işlenir (aksi hâlde ulti henüz kurulmadan gelen hasar
          // "bağsız" sayılıp sahnesiz teslim ediliyordu — raund sonu ölçümünde 3 sayı).
          pending.sort((a, b) => (a.type === 'ULTIMATE_PHASE' ? 0 : 1) - (b.type === 'ULTIMATE_PHASE' ? 0 : 1));
          replayingUlt = true;
          try { for (const event of pending) handle(event); } finally { replayingUlt = false; }
          // Girdi süresi = ulti koreografisi (zirve → fırlatma). Klibin toparlanma kuyruğu beklenmez
          // (boş bekleme yok; sahne ~3 sn tavanında), ama fırlatma bitmeden sıradaki saldırı başlamaz.
          const T = ULTIMATE_TIMING;
          // Saldıranın koşarak eve dönüşü de sahnenin içinde (sıradaki saldırı o yerine varmadan başlamaz).
          return {contactMs: p.hitMs, durationMs: p.hitMs + T.strikeMs + Math.max(T.throwMs, T.returnDelayMs + T.returnMs)};
        }
        return {
          contacts: p.contacts.map((ms, i) => ({ms, fn: () => strikeContact(entry, i)})),
          contactMs: p.contacts[0], durationMs: p.durationMs, returnStartMs: entry.chain?.returnStart,
        };
      },
      onContact: ultimate ? ({forced}) => {
        entry.contact = !forced;
        if (entry.cast) { entry.cast.contact = true; entry.cast.arrived = true; }
        if (!forced) impactFeel.flush();
        probeMark('contact', {seat, skill, forced: Boolean(forced)});
      } : undefined,
      onEnd: ({forced, cancelled}) => {
        if (cancelled) {
          // Boşaltma sıkıştırması: hiç başlamadı, olayları başka girdiye katlandı (sessiz hasar YOK).
          entry.dead = true; entry.open = false;
          const i = fighter.castQueue.indexOf(entry);
          if (i >= 0) fighter.castQueue.splice(i, 1);
          probeMark('end', {seat, skill, cancelled: true});
          return;
        }
        // Atlanan dönüş: kalan ofset taşınır (iz silinirken poz sıçramasın diye carry = varış noktası).
        if (!forced) fighter.carry = entry.skipReturn ? entry.contactDistance * (entry.chain?.moveIn || 1) : 0;
        if (ultimate && fighter.pendingUltEvents) {
          // Sahnesi hiç başlamayan ulti: bekletilen hasar kaybolmaz, sahnesiz (yalnız sayı/can) teslim edilir.
          for (const ev of fighter.pendingUltEvents.splice(0)) if (ev.type === 'DAMAGE_APPLIED') silentDamage(ev, 'ult-unstarted');
        }
        finishEntry(forced);
        probeMark('end', {seat, skill, forced: Boolean(forced)});
      },
    });
    return true;
  }

  /**
   * Bu koltuğun henüz hasara bağlanmamış en eski kuyruk girdisi/vuruşu (hasar olayı sırayla eşlenir).
   * Görev 4: kombo hasarı KENDİ vuruşunun temas karesine bağlanır → {entry, strike}.
   */
  /** Katlama hedefi: koltuğun son vuruşu henüz temas etmemiş (canlı, ulti olmayan) en son girdisi. */
  function foldTarget(seat) {
    const queue = fighters.get(seat)?.castQueue || [];
    for (let i = queue.length - 1; i >= 0; i--) {
      const e = queue[i];
      if (e.dead || e.ultimate) continue;
      const last = e.strikes[e.strikes.length - 1];
      if (last && !last.contact) return {entry: e, strike: last};
    }
    return null;
  }

  /**
   * İş 1 — raund sonu/KO boşaltması: koltuk başına henüz başlamamış q/e girdileri TEK sahnede
   * toplanır (ilki kalır; diğerlerinin hasar olayları onun son vuruşuna katlanır, girdileri sessizce
   * sıradan çıkar). Böylece bekleyen sahneler süre tavanında SIRALI oynar; animasyonsuz hasar olmaz.
   */
  function compactForDrain() {
    for (const seat of SEATS) {
      const queue = fighters.get(seat)?.castQueue || [];
      const pending = queue.filter(e => !e.dead && !e.started && !e.ultimate);
      if (pending.length < 2) continue;
      const keep = pending[0];
      const last = keep.strikes[keep.strikes.length - 1];
      for (const e of pending.slice(1)) {
        for (const s of e.strikes) for (const ev of s.events) { last.events.push(ev); boundEvents.set(ev, {entry: keep, strike: last}); }
        for (const ev of e.events) keep.events.push(ev);
        for (const s of e.strikes) s.events = [];
        e.events = [];
        if (e.strikes.some(s => !s.bound)) last.bound = false; // gelecek hasar olayları da buraya bağlanır
        if (!e.handle?.cancel?.()) { e.dead = true; e.open = false; }
      }
      keep.open = false;
      probeMark('compact', {seat, folded: pending.length - 1});
    }
  }
  function drainVisual(ms) {
    safeCall(compactForDrain);
    timeline.drain(ms);
  }

  function bindCastEntry(seat) {
    const queue = fighters.get(seat)?.castQueue;
    if (!queue) return null;
    const entry = queue.find(e => !e.dead && (e.strikes || []).some(s => !s.bound));
    if (!entry) return foldTarget(seat); // katlanan saldırı: hasar son vuruşta toplu
    const strike = entry.strikes.find(s => !s.bound) || entry.strikes[entry.strikes.length - 1];
    if (strike) strike.bound = true;
    entry.bound = true;
    return strike ? {entry, strike} : null;
  }

  /** Mixer + efekt kuyruğu (tick içinde, poz güncellemesinden sonra). */
  function updateModels(dt, timeScale, frozenFighter, stopped) {
    for (const fighter of fighters.values()) {
      const rig = fighter.model;
      if (!rig) continue;
      const paused = stopped || fighter.seat === frozenFighter;
      rig.setTimeScale(timeScale);
      rig.setPaused(paused);
      rig.update(dt);
      if (!paused) fighter.modelClock += dt * timeScale * 1000;
      if (fighter.fxQueue.length) {
        for (let i = 0; i < fighter.fxQueue.length; i++) {
          const job = fighter.fxQueue[i];
          if (job.at > fighter.modelClock) continue;
          fighter.fxQueue.splice(i--, 1);
          safeCall(job.fn);
        }
      }
    }
    if (skillFx) safeCall(() => skillFx.update(dt * timeScale));
  }

  /**
   * Model durum geçişi (yoksa no-op). İsabet/savunma tepkisi, rakibin az önce başlattığı
   * becerinin görsel vuruş anına (hitMs) ertelenir: sunucu hasarı beceriyle aynı anda yollar,
   * ama kafa sallanması baltanın inişiyle olmalı.
   */
  function modelPlay(seat, state, opts) {
    const rig = fighters.get(seat)?.model;
    if (!rig) return;
    const reactive = state === 'hit' || state === 'block' || state === 'blockHit';
    if (reactive && timeline.isBusy() && !reactNow) return;
    const cast = reactive ? fighters.get(otherSeat(seat))?.lastCast : null;
    const wait = cast && !cast.contact && !reactNow ? cast.at + cast.hitMs - now() : 0;
    if (wait > 16 && wait < 2000) {
      cue(wait, () => { if (fighters.get(seat)?.model === rig && !fighters.get(seat).ko) safeCall(() => rig.play(state, opts)); });
      return;
    }
    safeCall(() => rig.play(state, opts));
  }

  // ===================================================================== LAYOUT

  const layoutState = {width: 0, height: 0, signature: '', lastCheck: 0, seats: new Map()};
  const raycaster = new THREE.Raycaster();
  const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const backPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

  const stageOf = seat => safeCall(() => duel.querySelector(`.pvp2-side[data-seat="${seat}"] .pvp2-stage`)) || null;

  /**
   * Explicit high preserves device resolution; low uses one pixel per CSS pixel.
   * Only the FPS governor may reduce automatic resolution after slow frames.
   */
  function pixelRatio(width = 0, height = 0) {
    const dpr = Number(env?.devicePixelRatio) || 1;
    if (softwareRenderer && qualityMode === 'auto') return budgetRatio(width, height, dpr, {maxRatio: 0.5, minRatio: 0.3, budget: 0.12e6});
    if (effectiveQuality() === 'low') return 1;
    if (autoStep() >= 2) return budgetRatio(width, height, dpr, {maxRatio: 1.25, budget: PIXEL_BUDGETS.arenaMedium});
    return Math.min(dpr, 2);
  }
  /** Bloom yalnızca en üst kademede (otomatik modda ilk kapanan şey). */
  const bloomActive = () => bloomEnabled && effectiveQuality() === 'high' && autoStep() === 0 && !reduced();

  /**
   * Measure the DOM, size the canvas to the stage band and pin the fighters to
   * their stage centres. Cheap when nothing changed (signature compare).
   */
  function layout(force = false) {
    if (destroyed) return false;
    const duelRect = rectOf(duel);
    let r1 = rectOf(stageOf(1));
    let r2 = rectOf(stageOf(2));
    if (!duelRect || !r1 || !r2) return false;
    // Detect a vertical stack, independently of horizontal intersection.
    const stacked = r2.top >= r1.bottom - 4;
    const sideBySide = Math.abs(r1.top - r2.top) < 8 && Math.abs(r1.height - r2.height) < 8
      && (r1.right <= r2.left + 2 || r2.right <= r1.left + 2);
    let left, right, top, bottom;
    if (sideBySide || stacked) {
      const cl = Number(duel.clientLeft) || 0;
      const ct = Number(duel.clientTop) || 0;
      left = duelRect.left + cl;
      top = duelRect.top + ct;
      right = left + (Number(duel.clientWidth) || duelRect.width - 2 * cl);
      bottom = top + (Number(duel.clientHeight) || duelRect.height - 2 * ct);
    } else {
      left = Math.min(r1.left, r2.left);
      right = Math.max(r1.right, r2.right);
      top = Math.min(r1.top, r2.top);
      bottom = Math.max(r1.bottom, r2.bottom);
    }
    const width = Math.round(right - left);
    const height = Math.round(bottom - top);
    if (width < 2 || height < 2) return false;
    if (stacked) {
      const stageH = (r1.height + r2.height) / 2;
      const stageTop = top + (height - stageH) / 2;
      r1 = {left, top: stageTop, width: width / 2, height: stageH};
      r2 = {left: left + width / 2, top: stageTop, width: width / 2, height: stageH};
    }

    const offsetX = left - duelRect.left - (Number(duel.clientLeft) || 0);
    const offsetY = top - duelRect.top - (Number(duel.clientTop) || 0);
    const ratio = pixelRatio(width, height);
    const signature = [offsetX, offsetY, width, height, r1.left - left, r1.top - top, r1.width, r1.height,
      r2.left - left, r2.top - top, r2.width, r2.height, ratio * 100].map(v => Math.round(v)).join('|');
    if (!force && signature === layoutState.signature) return true;
    layoutState.signature = signature;
    layoutState.width = width;
    layoutState.height = height;

    if (canvas.style) {
      canvas.style.left = `${Math.round(offsetX)}px`;
      canvas.style.top = `${Math.round(offsetY)}px`;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }
    safeCall(() => renderer.setPixelRatio?.(ratio));
    safeCall(() => renderer.setSize?.(width, height, false));
    safeCall(() => bloom?.setSize(width, height, ratio));
    const emberUniforms = env3d?.colosseum?.emberMaterial?.uniforms;
    if (emberUniforms) emberUniforms.uScale.value = (height * ratio) / (2 * Math.tan(THREE.MathUtils.degToRad(LAYOUT.fov / 2)));

    const aspect = width / height;
    camera.aspect = aspect;
    baseCamera.aspect = aspect;

    // Stage-local screen targets (canvas pixels).
    const targets = new Map();
    for (const [seat, r] of [[1, r1], [2, r2]]) {
      targets.set(seat, {
        x: r.left - left + r.width / 2,
        feetY: r.top - top + r.height * LAYOUT.feetFrac,
        stageH: r.height,
      });
    }

    // Base camera: low position, pitched so that the feet row hits the floor at z ≈ 0.
    const ndcFeet = [...targets.values()].reduce((sum, t) => sum + (1 - (2 * t.feetY) / height), 0) / targets.size;
    const halfFov = THREE.MathUtils.degToRad(LAYOUT.fov / 2);
    const alpha = Math.atan2(LAYOUT.camY, LAYOUT.camZ);        // angle to the origin below horizontal
    const beta = Math.atan(-ndcFeet * Math.tan(halfFov));       // feet ray angle below the view axis
    const pitch = alpha - beta;
    baseCamera.position.set(0, LAYOUT.camY, LAYOUT.camZ);
    baseTarget.set(0, LAYOUT.camY - LAYOUT.camZ * Math.tan(pitch), 0);
    baseCamera.lookAt(baseTarget);
    baseCamera.updateProjectionMatrix();
    baseCamera.updateMatrixWorld(true);
    camera.updateProjectionMatrix();

    // Unproject each feet point onto the floor.
    const hit = new THREE.Vector3();
    const ndc = new THREE.Vector2();
    const viewDir = new THREE.Vector3();
    baseCamera.getWorldDirection(viewDir);
    const visibleFigure = RIG.planeH * (RIG.feetV - RIG.crownV);
    for (const [seat, t] of targets) {
      ndc.set((2 * t.x) / width - 1, 1 - (2 * t.feetY) / height);
      raycaster.setFromCamera(ndc, baseCamera);
      let point = raycaster.ray.intersectPlane(floorPlane, hit);
      if (!point) point = raycaster.ray.intersectPlane(backPlane, hit);
      if (!point) point = hit.set(facingOf(seat) * -2.5, 0, 0);
      point.y = 0;
      point.z = clamp(point.z, -4, 3);
      // World units per pixel at the fighter's depth → scale figure to the stage.
      const depth = Math.max(0.5, point.clone().sub(baseCamera.position).dot(viewDir));
      const worldPerPx = (2 * depth * Math.tan(halfFov)) / height;
      const scale = clamp((t.stageH * LAYOUT.heightFrac * worldPerPx) / visibleFigure, 0.3, 3);
      layoutState.seats.set(seat, {position: point.clone(), scale});
      const fighter = fighters.get(seat);
      if (fighter) {
        fighter.home.copy(point);
        fighter.root.position.copy(point).add(fighter.offset);
        fighter.root.scale.setScalar(scale);
      }
    }
    scene.updateMatrixWorld(true);
    return true;
  }

  // ================================================================ ANIMATION

  /** Pose accumulator; every track adds into it. */
  const emptyPose = () => ({fwd: 0, lift: 0, tilt: 0, squash: 0, weapon: 0, guard: 0, flash: 0, glow: 0, dark: 0, yaw: 0, koTilt: 0, turn: 0});

  /** Amplitude for gameplay motion (reduced mode keeps a small hint only). */
  const amp = () => (reduced() ? 0 : 1);

  function addTrack(fighter, dur, fn, {replace = true} = {}) {
    if (!fighter || fighter.ko) return; // downed fighters stay down
    if (replace) fighter.tracks.length = 0;
    const track = {start: now(), dur: Math.max(1, reduced() ? Math.min(dur, 360) : dur), fn, amp: amp()};
    fighter.tracks.push(track);
    if (fighter.tracks.length > 4) fighter.tracks.shift();
    return track;
  }

  function cue(atMs, fn) {
    cues.push({at: now() + atMs, fn});
    if (cues.length > 32) cues.shift();
  }

  /** Wind-up → lunge → recovery. dist/lift in body units (before layout scale). */
  function lungeTrack({wind, strike, recover, dist, lift = 0, squash = 0.06, swing = 1, glow = 0}) {
    const total = wind + strike + recover;
    const a = wind / total;
    const b = (wind + strike) / total;
    const fn = (p, o, m) => {
      if (p < a) {
        const k = easeOutCubic(p / a);
        o.fwd += -0.18 * dist * k * m;
        o.tilt += 0.12 * k * m;
        o.squash += squash * k * m;
        o.weapon += -0.55 * swing * k * m;
        o.glow += glow * k;
      } else if (p < b) {
        const k = easeOutCubic((p - a) / (b - a));
        o.fwd += lerp(-0.18 * dist, dist, k) * m;
        o.tilt += lerp(0.12, -0.2, k) * m;
        o.squash += lerp(squash, -squash * 0.5, k) * m;
        o.weapon += lerp(-0.55, 1.15, k) * swing * m;
        o.lift += bump(k) * lift * m;
        o.glow += glow;
      } else {
        const k = easeInOutSine((p - b) / (1 - b));
        o.fwd += dist * (1 - k) * m;
        o.tilt += -0.2 * (1 - k) * m;
        o.weapon += 1.15 * swing * (1 - k) * m;
        o.glow += glow * (1 - k);
      }
    };
    return {dur: total, fn};
  }

  function playLunge(seat, spec) {
    const fighter = fighters.get(seat);
    const {dur, fn} = lungeTrack(spec);
    addTrack(fighter, dur, fn);
  }

  function playHit(seat, amount) {
    const fighter = fighters.get(seat);
    const a = clamp((Number(amount) || 0) / HEAVY_DAMAGE, 0.08, 1);
    modelPlay(seat, 'hit', {heavy: a > 0.6});
    // İş 1, 3. tur: 3B modelde geri itilme okunur ve sıçramasız (ilk karede %18 sıçrama + 110 ms'de 1,2 birim
    // ışınlanma sınırını aşıyor, sonra model idle pozunda geri kayıyordu). Düz siluette eski sert zarf.
    const soft = Boolean(fighter?.model);
    const dist = soft ? 0.2 + 0.5 * a : 0.25 + 0.95 * a;
    addTrack(fighter, soft ? 650 + 300 * a : 420 + 260 * a, (p, o, m) => {
      const env = soft ? (p < .3 ? easeInOutSine(p / .3) : 1 - easeInOutSine((p - .3) / .7))
        : p < .18 ? .18 + easeOutCubic(p / .18) * .94
        : Math.exp(-5 * (p - .18)) * Math.cos((p - .18) * 5.8) * (1 - p) / .82;
      o.fwd += -dist * env * m;
      o.tilt += (0.18 + 0.32 * a) * env * m;
      o.squash += 0.05 * env * m;
      o.weapon += -0.4 * env * m;
      o.guard += 0.3 * env * m;
    });
  }

  function playBrace(seat, strength = 1) {
    modelPlay(seat, strength >= 1.1 ? 'blockHit' : 'block');
    addTrack(fighters.get(seat), 560, (p, o, m) => {
      const env = bump(p);
      o.fwd += -0.22 * strength * env * m;
      o.squash += 0.08 * env * m;
      o.tilt += 0.06 * env * m;
      o.guard += 1.0 * env * m;
    });
    pulseBubble(seat, strength);
  }

  function playStagger(seat) {
    modelPlay(seat, 'hit', {heavy: true});
    addTrack(fighters.get(seat), 700, (p, o, m) => {
      const env = bump(p);
      o.fwd += -0.5 * env * m;
      o.tilt += (0.12 * env + 0.16 * Math.sin(p * Math.PI * 4) * (1 - p)) * m;
      o.weapon += -0.6 * env * m;
      o.flash += Math.max(0, 0.5 - p * 2);
    });
  }

  function playStumble(seat) {
    modelPlay(seat, 'hit', {heavy: true});
    addTrack(fighters.get(seat), 820, (p, o, m) => {
      const env = p < 0.25 ? easeOutCubic(p / 0.25) : 1 - easeInOutSine((p - 0.25) / 0.75);
      o.fwd += -0.7 * env * m;
      o.tilt += (0.3 * env + 0.1 * Math.sin(p * Math.PI * 5) * (1 - p)) * m;
      o.squash += 0.08 * env * m;
      o.guard += -0.5 * env * m;
      o.flash += Math.max(0, 0.7 - p * 2.5);
    });
  }

  function pulseBubble(seat, strength = 1) {
    const fighter = fighters.get(seat);
    if (!fighter || fighter.ko) return;
    fighter.shatter = null;
    fighter.bubblePulses.push({start: now(), dur: 650, strength: clamp(strength, 0.3, 1.6)});
    if (fighter.bubblePulses.length > 3) fighter.bubblePulses.shift();
  }

  function shatterBubble(seat) {
    const fighter = fighters.get(seat);
    if (!fighter) return;
    fighter.bubblePulses.length = 0;
    fighter.shatter = {start: now(), dur: 300};
  }

  // ============================================================ ULTIMATE TRAVEL
  //
  //   phase 1  tether: defender is yanked along a curve to the VS centre (raised),
  //            attacker dashes in.
  //   phase 2  hit-stop tremble → knock-up + tumble at the centre, attacker strikes.
  //   phase 3  throw: defender flies an arc back to its own seat, backflips,
  //            slams the floor (ARENA_SLAM → plugins), bounces; attacker hops home.
  //
  // Every segment tweens FROM the current offset, so late / bunched / missing
  // phases blend instead of snapping. Targets are resolved every frame from the
  // live seat homes, so a resize mid-ultimate stays correct.

  let ult = null;              // active choreography (see ultimatePhase)
  const finishedUlts = [];     // recently finished ultimate keys (late duplicates are ignored)
  const tmpTarget = new THREE.Vector3();
  const tmpDir = new THREE.Vector3();

  function ultGeometry(atk, def, out) {
    const a = fighters.get(atk).home;
    const d = fighters.get(def).home;
    tmpDir.subVectors(d, a);
    tmpDir.y = 0;
    const span = Math.max(0.5, tmpDir.length());
    tmpDir.multiplyScalar(1 / span);
    out.addVectors(a, d).multiplyScalar(0.5);
    out.y = 0;
    return span;
  }

  /** Offset (relative to the fighter's home) for a named travel target. */
  function targetOffset(fighter, seg, out) {
    if (seg.target === 'home' || !isSeat(seg.atk) || !isSeat(seg.def)) return out.set(0, 0, 0);
    const span = ultGeometry(seg.atk, seg.def, out);   // out = centre, tmpDir = attacker → defender
    const along = {defCentre: 0.17, defHit: 0.24, atkCentre: -0.2, atkStrike: -0.12, atkBlocked: -0.3}[seg.target] ?? 0;
    const lift = {defCentre: 0.08, defHit: 0.16}[seg.target] ?? 0;
    out.addScaledVector(tmpDir, along * span);
    out.y = lift * span;
    return out.sub(fighter.home);
  }

  /** Start a travel tween for one fighter (from its current offset). */
  function startSeg(fighter, spec) {
    if (!fighter) return;
    fighter.seg = {
      target: 'home', atk: null, def: null, delay: 0, dur: 300, arc: 0, bulge: 0, jitter: 0,
      ease: easeInOutSine, spinTo: null, onEnd: null,
      ...spec,
      from: fighter.offset.clone(),
      spinFrom: fighter.spin,
      start: now(),
    };
    if (fighter.seg.spinTo === null) fighter.seg.spinTo = fighter.spin;
  }

  const normaliseSpin = s => {
    let v = ((s % TAU) + TAU) % TAU;
    if (v > Math.PI) v -= TAU;
    return Math.abs(v) < 1e-6 ? 0 : v;
  };

  function resetTravel(fighter) {
    fighter.seg = null;
    fighter.offset.set(0, 0, 0);
    fighter.spin = 0;
    fighter.root.position.copy(fighter.home);
  }

  function updateTravel(fighter, tNow) {
    if (reduced()) {
      if (fighter.seg || fighter.spin || fighter.offset.lengthSq()) resetTravel(fighter);
      return;
    }
    const seg = fighter.seg;
    if (seg) {
      const local = tNow - seg.start - seg.delay;
      const k = clamp(local / seg.dur, 0, 1);
      const e = seg.ease(k);
      const target = targetOffset(fighter, seg, tmpTarget);
      fighter.offset.lerpVectors(seg.from, target, e);
      fighter.offset.y += seg.arc * bump(k);
      fighter.offset.z += seg.bulge * bump(k);
      fighter.spin = lerp(seg.spinFrom, seg.spinTo, e);
      if (local < 0 && seg.jitter) {
        // Hit-stop: frozen in place with a tight tremble.
        fighter.offset.x += Math.sin(tNow * 1.9) * seg.jitter;
        fighter.offset.y += Math.sin(tNow * 2.7 + 1) * seg.jitter * 0.5;
      }
      if (k >= 1) {
        fighter.offset.copy(target);
        fighter.spin = normaliseSpin(seg.spinTo);
        fighter.seg = null;
        safeCall(() => seg.onEnd?.());
      }
    }
    fighter.root.position.copy(fighter.home).add(fighter.offset);
  }

  function ultKey(atk, id) {
    return `${atk}:${id ?? '-'}`;
  }

  /** ULTIMATE_PHASE entry point (non-reduced). */
  function ultimatePhase(event) {
    const atk = event.fromSeat;
    const def = isSeat(event.toSeat) ? event.toSeat : otherSeat(atk);
    const n = clamp(Math.round(Number(event.phase) || 1), 1, 3);
    const id = event.ultimateId ?? null;
    const key = ultKey(atk, id);
    if (id !== null && finishedUlts.includes(key)) { probeMark('ultSkip', {seat: atk, skill: `dup${n}`}); return; } // late duplicate of a finished ultimate
    if (ult && ult.key !== key) ult = null;               // a new ultimate takes over (tweens blend)
    if (!ult) {
      if (fighters.get(def)?.ko || fighters.get(atk)?.ko) { probeMark('ultSkip', {seat: atk, skill: `ko${n}`}); return; }
      ult = {key, atk, def, contacts: new Set(), blocked: false, shown: 0, queue: [], nextAt: 0, watchdogAt: Infinity, ending: false, knockout: false};
      // First phase seen is late (1 lost): still show the pull/hit before a throw.
      if (n === 3) ult.queue.push(2);
      api.dolly(atk, 1800);
    }
    if (n <= ult.shown || ult.queue.includes(n) || ult.ending) return;
    if (event.blocked) ult.blocked = true;
    ult.queue.push(n);
    ult.queue.sort((a, b) => a - b);
    processUltimate(now());
  }

  function processUltimate(tNow) {
    if (!ult) return;
    const caster=fighters.get(ult.atk);
    const cast=caster?.lastCast;
    // Meshy ultimate's windup is long. Keep queued server phases cosmetic until
    // the full clip reaches its measured strike frame (network timing is untouched).
    // Klipli ulti: faz 1 (çekiş) ve faz 2 (vuruş) klibin vuruş karesine hizalanır → faz 2 teması = klip zirvesi
    // (önceden yalnız >2000 ms klipler bekletiliyordu; 1700 ms'lik klipte hasar klipten ~1,2 sn önce düşüyordu).
    const T = ULTIMATE_TIMING;
    const clipMs = caster?.model && cast ? caster.modelClock - cast.clock : Infinity;
    if (ult.queue[0] === 1 && cast?.hitMs > T.pullMs + T.strikeMs && clipMs < cast.hitMs - T.pullMs - T.strikeMs) return;
    if (ult.queue[0] === 2 && cast?.hitMs > T.strikeMs && clipMs < cast.hitMs - T.strikeMs) return;
    if (ult.queue.length && tNow >= ult.nextAt) {
      const n = ult.queue.shift();
      runPhase(n);
      if (n === 2 && !reduced() && fighters.get(ult.atk)?.model) dollyTo(ult.def, 600, false); // temas noktasına odak (İş 15: ≤ 600 ms)
      ult.shown = n;
      ult.nextAt = tNow + (fighters.get(ult.atk)?.model && n < 3
        ? (n === 1 ? ULTIMATE_TIMING.pullMs : ULTIMATE_TIMING.strikeMs) : ULTIMATE_TIMING.minGapMs);
      const segMs = n === 1 ? ULTIMATE_TIMING.pullMs : ULTIMATE_TIMING.hitStopMs + ULTIMATE_TIMING.hitMs;
      ult.watchdogAt = tNow + segMs + ULTIMATE_TIMING.watchdogMs;
    }
    if (!ult.ending && !ult.queue.length && tNow >= ult.watchdogAt) runPhase(3, {auto: true});
    if (ult.ending && !fighters.get(ult.atk).seg && !fighters.get(ult.def).seg) finishUltimate();
  }

  function finishUltimate() {
    if (!ult) return;
    finishedUlts.push(ult.key);
    if (finishedUlts.length > 8) finishedUlts.shift();
    ult = null;
  }

  function runPhase(n, {auto = false} = {}) {
    const {atk, def, blocked} = ult;
    const attacker = fighters.get(atk);
    const defender = fighters.get(def);
    const T = ULTIMATE_TIMING;
    const span = ultGeometry(atk, def, tmpTarget);
    const roles = {atk, def};
    const sequence = ult;
    const markContact = () => { sequence.contacts.add(n); impactFeel.flush(); probeMark('impact', {seat: atk, skill: `r${n}`}); };
    if (n === 1) {
      startSeg(attacker, {...roles, target: blocked ? 'atkBlocked' : 'atkCentre', dur: T.dashMs, ease: easeOutCubic, arc: 0.04 * span, onEnd: markContact});
      addTrack(attacker, 520, (p, o, m) => {           // raised weapon, energy glow
        o.weapon += -1.1 * bump(Math.min(1, p * 1.4)) * m;
        o.glow += 1.2 * (1 - p * 0.5);
        o.tilt += -0.12 * bump(p) * m;
      });
      if (!blocked) {
        startSeg(defender, {...roles, target: 'defCentre', dur: T.pullMs, ease: easeOutCubic, bulge: 0.12 * span, spinTo: -0.25});
        api.shake(0.22, 220);
      }
      api.flash(attacker.palette.main, 0.16, 220);
      cheer(0.35);
    } else if (n === 2) {
      startSeg(attacker, {...roles, target: blocked ? 'atkBlocked' : 'atkStrike', dur: T.strikeMs, ease: easeOutCubic, onEnd: markContact});
      if (!attacker.model) playLunge(atk, {wind: 40, strike: 120, recover: 200, dist: 0.25, swing: 1.4, glow: 1});
      if (!blocked) {
        startSeg(defender, {
          ...roles, target: 'defHit', delay: T.hitStopMs, dur: T.hitMs, ease: easeOutCubic,
          arc: 0.05 * span, jitter: 0.02 * span, spinTo: 0.75,
        });
        api.shake(0.65, 320);
        api.flash(0xffffff, 0.35, 140);
        cheer(0.6);
      }
    } else {
      ult.ending = true;
      ult.queue.length = 0;
      startSeg(attacker, {target: 'home', delay: T.returnDelayMs, dur: T.returnMs, arc: 0.06 * span});
      if (!blocked) {
        const spinFrom = defender.spin;
        startSeg(defender, {
          target: 'home', dur: T.throwMs, ease: easeInOutSine, arc: 0.32 * span,
          spinTo: TAU * (Math.floor(spinFrom / TAU) + 1),  // one full backflip, lands upright
          onEnd: () => { markContact(); landSlam(def, atk, {auto}); },
        });
        api.shake(auto ? 0.25 : 0.45, 260);
      } else if (defender.offset.lengthSq() || defender.spin) {
        startSeg(defender, {target: 'home', dur: 260});
      }
    }
  }

  /** Throw landing: crater/dust FX via plugins, big shake, bounce, recovery. */
  function landSlam(seat, fromSeat, {auto = false} = {}) {
    const fighter = fighters.get(seat);
    if (!fighter || destroyed) return;
    const span = ultGeometry(seat, otherSeat(seat), tmpTarget);
    const knockout = Boolean(fighter.ko);
    const power = auto ? 0.6 : knockout ? 1.3 : 1;
    api.shake(Math.min(1, 0.7 * power + 0.2), 560);
    api.flash(fighters.get(fromSeat)?.palette.main ?? 0xffffff, 0.28 * power, 260);
    cheer(knockout ? 1 : 0.85 * power);
    spawnFloorWave(seat, fromSeat, 1.2 * power);
    pulseFog(fighters.get(fromSeat)?.palette.main ?? 0xffffff, 0.8 * power);
    forwardToPlugins({
      type: 'ARENA_SLAM', seat, fromSeat, character: CHARACTER_OF_SEAT[fromSeat],
      x: fighter.home.x, y: 0, z: fighter.home.z, power, knockout, client: true,
    });
    startSeg(fighter, {target: 'home', dur: ULTIMATE_TIMING.bounceMs, arc: (knockout ? 0.025 : 0.05) * span});
    addTrack(fighter, 520, (p, o, m) => {
      const k = 1 - easeOutCubic(p);
      o.squash += 0.22 * k * m;
      o.tilt += 0.25 * k * m;
      o.flash += Math.max(0, 0.6 - p * 2.4);
    });
  }

  /** Reduced effects: no travel, a short flash on the defender only. */
  function ultimateFlashOnly(event) {
    const def = isSeat(event.toSeat) ? event.toSeat : otherSeat(event.fromSeat);
    addTrack(fighters.get(def), 220, (p, o) => { o.flash += 0.8 * (1 - p); }, {replace: false});
    api.flash(fighters.get(event.fromSeat).palette.main, 0.2, 120);
  }

  function startKnockout(seat) {
    const fighter = fighters.get(seat);
    if (!fighter || fighter.ko) return; // idempotent (KNOCKOUT event + onMatchEnd)
    fighter.tracks.length = 0;
    fighter.bubblePulses.length = 0;
    fighter.victory = null;
    fighter.ko = {start: now(), dur: reduced() ? 300 : 950};
    if (fighter.model) {
      fighter.fxQueue = [];
      safeCall(() => fighter.model.play('ko'));
    }
    cue(reduced() ? 300 : 620, () => api.shake(0.45, 380));
    cheer(1);
    // Knockout in the middle of an ultimate (phase 1/2 was lethal): throw the
    // loser home now; the landing keeps the KO pose. Attacker KO'd: both go home.
    if (ult && !ult.ending) {
      if (ult.def === seat) runPhase(3);
      else if (ult.atk === seat) {
        ult.ending = true;
        ult.queue.length = 0;
        for (const f of fighters.values()) startSeg(f, {target: 'home', dur: 320});
      }
    }
  }

  function startVictory(seat) {
    const fighter = fighters.get(seat);
    if (!fighter || fighter.ko) return;
    fighter.tracks.length = 0;
    fighter.victory = {start: now()};
    modelPlay(seat, 'win');
  }

  /** Compute the pose of one fighter for this frame and apply it to the scene graph. */
  function updateFighter(fighter, t, tNow) {
    const o = emptyPose();
    const quiet = reduced();
    const idleAmp = quiet ? 0 : 1;

    // Idle: breathing bob and a gentle sway (never while downed).
    if (!fighter.ko) {
      const breathe = Math.sin((t * Math.PI * 2) / 3.6 + fighter.phase);
      o.squash += -0.014 * breathe * idleAmp;
      o.lift += 0.012 * (breathe + 1) * idleAmp;
      o.tilt += 0.014 * Math.sin((t * Math.PI * 2) / 5.1 + fighter.phase) * idleAmp;
      o.weapon += 0.05 * Math.sin((t * Math.PI * 2) / 3.5 + fighter.phase) * idleAmp;
      o.guard += 0.035 * Math.sin((t * Math.PI * 2) / 4.1 + fighter.phase * 2) * idleAmp;
    }

    // Hit-stop tremble on the struck fighter (tracks are paused in tick()).
    if (tNow < hitStop.until && hitStop.seat === fighter.seat && !fighter.ko) {
      const k = 1 - (tNow - hitStop.start) / Math.max(1, hitStop.until - hitStop.start);
      o.flash += 0.35 * hitStop.amp * k;
    }

    // Super freeze: the attacker blazes in its colour, the opponent is frozen and dimmed.
    const superHere = cine.superK > 0 && isSeat(cine.superSeat);
    if (superHere) {
      if (fighter.seat === cine.superSeat) o.glow += 0.75 * cine.superK;
      else o.dark += (cine.superLight ? 0.15 : 0.35) * cine.superK;
    }

    // Şerit H: atlanan dönüşten kalan ofset (iz yokken yumuşakça eve döner; ışınlanma yok).
    if (fighter.carry) {
      if (!fighter.tracks.length) {
        fighter.carry *= Math.exp(-clamp(tNow - (fighter.carryT || tNow), 0, 100) / 150);
        if (fighter.carry < 1e-3) fighter.carry = 0;
      }
      fighter.carryT = tNow;
      o.fwd += fighter.carry;
    }

    // Timed tracks.
    for (let i = fighter.tracks.length - 1; i >= 0; i--) {
      const track = fighter.tracks[i];
      const p = (tNow - track.start) / track.dur;
      if (p >= 1) {
        fighter.tracks.splice(i, 1);
        continue;
      }
      track.fn(clamp(p, 0, 1), o, track.amp);
    }

    // Persistent victory: a few hops, raised weapon, pulsing glow.
    if (fighter.victory) {
      const vt = (tNow - fighter.victory.start) / 1000;
      const hops = quiet ? 0 : Math.max(0, 1 - vt / 2.4);
      o.lift += Math.abs(Math.sin(vt * Math.PI * 1.6)) * 0.35 * hops;
      o.weapon += -1.1 * easeOutCubic(clamp(vt / 0.5, 0, 1));
      o.glow += 0.35 + 0.25 * Math.sin(vt * 3);
    }

    // Persistent knockout: fall backward onto the floor and stay there.
    if (fighter.ko) {
      const k = clamp((tNow - fighter.ko.start) / fighter.ko.dur, 0, 1);
      const fall = k < 0.8 ? easeInQuad(k / 0.8) : 1 - Math.sin(((k - 0.8) / 0.2) * Math.PI) * 0.06;
      o.tilt += 1.42 * fall;
      o.koTilt += 1.42 * fall;   // model: Death_A klibi düşüşü kendisi oynatır
      o.fwd += -0.35 * (fighter.model ? 0.3 : 1) * fall;
      o.weapon += 0.6 * fall;
      o.guard += -0.4 * fall;
      o.dark += 0.55 * k;
    }

    // İş 1 — ışınlanma koruması: gövdenin ileri ofseti kare başına en fazla MAX_FWD_STEP (dünya birimi)
    // değişir. İz silinmesi / zorla bitirme / saat kayması ofseti sıçratsa bile model hedefe kayarak
    // gider (normal koşu/dönüş 60 fps'de bu sınırın altında kalır). Raund sıfırlaması (snapPose) ve
    // azaltılmış hareket anında oturur.
    fighter.lastPose = o;
    const face = fighter.face;
    // Travel spin pivots around the waist (≈ body centre), tilt around the feet.
    const spin = face * fighter.spin;
    const waist = WAIST_Y;
    fighter.actor.position.set(face * o.fwd + waist * Math.sin(spin), Math.max(0, o.lift) + waist * (1 - Math.cos(spin)), 0);
    // İş 1, 3. tur — IŞINLANMA SIFIR: modelin DÜNYA konumu (kök + gövde) kare başına en çok MAX_FWD_STEP
    // ve MAX_WORLD_SPEED×dt kadar değişir: iz silinmesi, zorla bitirme, raund geçişi, KO, ulti çekişi dahil
    // hiçbir durumda tek karede sıçramaz (uzun karede dt ile sınırlı, sonra yetişir). Yalnız ilk yerleşim
    // (maç başı) ve azaltılmış hareket anında oturur.
    const rs = fighter.root.scale.x || 1;
    const wantX = fighter.root.position.x + fighter.actor.position.x * rs;
    const wantZ = fighter.root.position.z;
    const dtPose = clamp(tNow - (fighter.poseT ?? tNow), 0, 1000);
    fighter.poseT = tNow;
    if (quiet || !fighter.shown) { fighter.shown = {x: wantX, z: wantZ}; fighter.speed = 0; }
    else {
      // KESINYAP 22: sınır HIZ tabanlı (60 fps'te kare başına 0,12, eskisiyle aynı); düşük kare hızında (zayıf GPU) kare
      // başı 0,12 sınırı dövüşçüyü planlı dönüşün gerisinde bırakıyor, sahne bitince eve sırtı dönük yürüyordu.
      // Uzun kare (sekme/takılma) en çok MAX_POSE_DT_MS sayılır → tek karede ışınlanma yine yok (≤ 0,36).
      const cap = MAX_WORLD_SPEED * Math.min(dtPose, MAX_POSE_DT_MS) / 1000;
      const dx = wantX - fighter.shown.x, dz = wantZ - fighter.shown.z, d = Math.hypot(dx, dz);
      const k = d > cap ? cap / d : 1;
      fighter.shown.x += dx * k;
      fighter.shown.z += dz * k;
      const v = dtPose > 0 ? (d * k) / (dtPose / 1000) / rs : 0; // gövde birimi/sn
      fighter.speed = fighter.speed * 0.6 + v * 0.4;
      fighter.awayFromFoe = dx * k * face < -1e-4;
    }
    fighter.actor.position.x = (fighter.shown.x - fighter.root.position.x) / rs;
    fighter.actor.position.z = (fighter.shown.z - fighter.root.position.z) / rs;
    // Hareket varsa koşu klibi (idle pozunda kayma yok); eve doğru giderken yüzü eve döner, varınca rakibe.
    if (fighter.model && !fighter.ko && !fighter.victory) {
      const rig = fighter.model;
      safeCall(() => rig.setLocoSpeed?.(fighter.speed));
      const moving = fighter.speed > (rig.isLocomoting?.() ? 0.35 : 0.8);
      safeCall(() => rig.autoLocomote?.(moving && !quiet));
      const autoHome = rig.isAutoLocomoting?.() && fighter.awayFromFoe ? 1 : 0;
      const target = quiet ? 0 : Math.max(clamp(o.turn, 0, 1), autoHome);
      const rate = dtPose / Math.max(1, SCENE.turnMs);
      fighter.turnK = (fighter.turnK || 0) + clamp(target - (fighter.turnK || 0), -rate, rate);
    } else fighter.turnK = 0;
    const hitFlash = fighter.impactFlash;
    const age = hitFlash ? tNow - hitFlash.at : Infinity;
    const white = hitFlash && age < hitFlash.whiteMs ? (quiet ? .15 : 1) : 0;
    const red = hitFlash && age >= hitFlash.whiteMs ? Math.max(0, 1 - (age - hitFlash.whiteMs) / 110) * (quiet ? .12 : .65) : 0;
    if (age > (hitFlash?.whiteMs || 0) + 110) fighter.impactFlash = null;
    const flash = clamp(o.flash + white, 0, 1);
    o.flash = flash;
    const glow = clamp(o.glow, 0, 1.5);
    if (fighter.model) {
      // Paket 32: klip baskın — düzlem eğimi/ezilmesi modele kısık uygulanır, dönüş (yaw) koreografiden.
      fighter.actor.rotation.z = face * (o.tilt - o.koTilt) * MODEL_VIEW.tiltScale + spin;
      const sq = o.squash * MODEL_VIEW.squashScale;
      fighter.actor.scale.set(1 + sq * 0.5, 1 - sq, 1);
      fighter.model.setYaw(o.yaw + TURN_YAW * (fighter.turnK || 0));
      fighter.model.setTint({flash, red, glow, dark: o.dark});
    } else {
      fighter.actor.rotation.z = face * o.tilt + spin;
      fighter.actor.scale.set(1 + o.squash * 0.5, 1 - o.squash, 1);
    }
    fighter.weapon.pivot.rotation.z = -face * o.weapon;
    fighter.guard.pivot.rotation.z = -face * o.guard * 0.8;

    // Materials: emissive = base white (keeps the art readable) + glow + hit flash.
    const base = 0.38;
    const pr = ((fighter.palette.main >> 16) & 255) / 255;
    const pg = ((fighter.palette.main >> 8) & 255) / 255;
    const pb = (fighter.palette.main & 255) / 255;
    const shade = 1 - o.dark;
    if (!fighter.model) for (const material of fighter.materials) {
      material.emissive.setRGB(
        (base + flash * 2.4 + glow * pr * 0.9) * shade,
        (base + flash * 2.4 + glow * pg * 0.9) * shade,
        (base + flash * 2.4 + glow * pb * 0.9) * shade,
      );
      material.emissiveIntensity = 1;
      material.color.setScalar(shade);
    }

    // Shadow: follows the lunge, shrinks while airborne, stretches when down.
    const rootScale = fighter.root.scale.x || 1;
    const air = clamp(o.lift + fighter.offset.y / rootScale, 0, 1.5);
    fighter.shadow.position.y = 0.012 - fighter.offset.y / rootScale; // stays on the floor while thrown
    fighter.shadow.position.x = fighter.actor.position.x - waist * Math.sin(spin) + (fighter.ko ? -face * 1.1 * clamp(o.tilt / 1.42, 0, 1) : 0);
    fighter.shadow.scale.set((1 - air * 0.35) * (fighter.ko ? 1.9 : 1), (1 - air * 0.35) * 0.55, 1);

    // Bubble: sum of pulses, or the shatter burst.
    let opacity = 0;
    let bubbleScale = 1;
    for (let i = fighter.bubblePulses.length - 1; i >= 0; i--) {
      const pulse = fighter.bubblePulses[i];
      const p = (tNow - pulse.start) / pulse.dur;
      if (p >= 1) {
        fighter.bubblePulses.splice(i, 1);
        continue;
      }
      const env = p < 0.15 ? p / 0.15 : 1 - easeInOutSine((p - 0.15) / 0.85);
      opacity = Math.max(opacity, env * 0.85 * pulse.strength);
      bubbleScale = Math.max(bubbleScale, 1 + 0.12 * bump(p) * (quiet ? 0.3 : 1));
    }
    const bubbleColor = fighter.bubbleMaterial.uniforms.uColor.value;
    if (fighter.shatter) {
      const p = (tNow - fighter.shatter.start) / fighter.shatter.dur;
      if (p >= 1) {
        fighter.shatter = null;
        bubbleColor.setHex(fighter.palette.shield);
      } else {
        opacity = Math.max(opacity, (1 - p) * 1.2);
        bubbleScale = 1 + (quiet ? 0.1 : 0.5) * easeOutCubic(p);
        bubbleColor.setHex(0xffffff);
      }
    }
    fighter.bubbleMaterial.uniforms.uOpacity.value = opacity;
    fighter.bubbleMaterial.uniforms.uTime.value = t;
    fighter.bubble.visible = opacity > 0.01;
    fighter.bubble.scale.set(1.05 * bubbleScale, 1.5 * bubbleScale, 0.75 * bubbleScale);

    // Lights follow the fighter; victory pulses, KO dims.
    const world = fighter.root.position;
    const scale = fighter.root.scale.x;
    fighter.light.position.set(world.x + face * (o.fwd + 0.5) * scale, world.y + 1.9 * scale, world.z + 1.3 * scale);
    fighter.accentLight.position.set(world.x + face * o.fwd * scale, world.y + 0.35 * scale, world.z + 0.7 * scale);
    let intensity = fighter.baseLight * (1 + glow * 0.6 + flash * 0.5);
    if (fighter.victory) intensity *= 1.4 + 0.6 * Math.sin((tNow - fighter.victory.start) / 160);
    if (fighter.ko) intensity *= 0.45;
    if (superHere) intensity *= fighter.seat === cine.superSeat ? 1 + 0.8 * cine.superK : 1 - 0.5 * cine.superK;
    fighter.light.intensity = intensity;
  }

  // ================================================================ FLOOR GLOW

  /** Short light wave across the floor under a struck fighter (pool of 2). */
  function spawnFloorWave(seat, fromSeat, power = 1) {
    if (destroyed || reduced() || !floorGlow.mesh.visible) return;
    const fighter = fighters.get(seat);
    if (!fighter) return;
    const waves = floorGlow.waves;
    let slot = waves.find(w => !w.active);
    if (!slot) slot = waves.reduce((a, b) => (a.start <= b.start ? a : b));
    const index = waves.indexOf(slot);
    const s = fighter.root.scale.x || 1;
    Object.assign(slot, {
      active: true, start: now(), dur: 380 + 220 * clamp(power, 0, 1.5),
      x: fighter.root.position.x, z: fighter.root.position.z,
      size: (1.6 + 1.2 * clamp(power, 0, 1.5)) * s, strength: clamp(0.55 + 0.45 * power, 0.3, 1.2),
    });
    const attacker = fighters.get(fromSeat);
    floorGlow.mesh.setColorAt(2 + index, floorGlow.color.setHex(attacker ? attacker.palette.accent : 0xffffff));
    if (floorGlow.mesh.instanceColor) floorGlow.mesh.instanceColor.needsUpdate = true;
  }

  function updateFloorGlow(tNow, quiet) {
    const g = floorGlow;
    if (!g.mesh.visible) return;
    const arr = g.params.array;
    for (const seat of SEATS) {
      const f = fighters.get(seat);
      const i = seat - 1;
      const s = f.root.scale.x || 1;
      const air = clamp(f.offset.y / s, 0, 1);
      let alpha = (quiet ? 0.5 : 0.5 + 0.1 * Math.sin(f.clock * 2.4 + f.phase)) * (1 - 0.75 * air);
      if (f.ko) alpha *= 0.3;
      if (cine.superK > 0 && isSeat(cine.superSeat)) alpha *= seat === cine.superSeat ? 1 + 1.1 * cine.superK : 1 - 0.6 * cine.superK;
      if (!f.actor.visible) alpha = 0;
      const fwd = f.lastPose ? f.face * f.lastPose.fwd * s : 0;
      g.p.set(f.root.position.x + fwd, FLOOR_GLOW_Y, f.root.position.z);
      g.s.set(1.2 * s, 1, 1.2 * s);
      g.mesh.setMatrixAt(i, g.matrix.compose(g.p, g.q, g.s));
      arr[i * 4] = alpha;
      arr[i * 4 + 1] = 0.6;
      arr[i * 4 + 2] = 0.07;
      arr[i * 4 + 3] = 0.42;
    }
    g.waves.forEach((w, k) => {
      const i = 2 + k;
      const p = w.active ? (tNow - w.start) / w.dur : 1;
      if (p >= 1 || p < 0 || quiet) {
        if (w.active && p >= 1) w.active = false;
        if (quiet) w.active = false;
        g.mesh.setMatrixAt(i, g.hidden);
        arr[i * 4] = 0;
        return;
      }
      const e = easeOutCubic(p);
      g.p.set(w.x, FLOOR_GLOW_Y + 0.002, w.z);
      g.s.set(w.size, 1, w.size);
      g.mesh.setMatrixAt(i, g.matrix.compose(g.p, g.q, g.s));
      arr[i * 4] = w.strength * Math.pow(1 - p, 1.4);
      arr[i * 4 + 1] = 0.12 + 0.8 * e;
      arr[i * 4 + 2] = 0.05 + 0.05 * (1 - p);
      arr[i * 4 + 3] = 0.25 * (1 - e);
    });
    g.mesh.instanceMatrix.needsUpdate = true;
    g.params.needsUpdate = true;
  }

  // ================================================================ ATMOSPHERE

  /** Depth-fog pulse on hits + super-freeze dimming of ambient lights, floor and fog. */
  function updateAtmosphere(dt, quiet) {
    const low = effectiveQuality() === 'low';
    fogPulse.value = quiet || low ? 0 : fogPulse.value * Math.exp(-dt * 2.6);
    if (fogPulse.value < 1e-3) fogPulse.value = 0;
    const dim = 1 - CINEMATIC.superDim * (cine.superLight ? 0.45 : 1) * cine.superK;
    scene.fog.color.copy(FOG_BASE).lerp(fogPulse.color, fogPulse.value * 0.45).multiplyScalar(dim);
    env3d?.sky.material.uniforms.uHorizon.value.copy(HORIZON_BASE).lerp(fogPulse.color, fogPulse.value * 0.5);
    for (const a of activeStage.ambient) a.light.intensity = a.base * dim;
    if (dim < 1 && env3d) {
      env3d.floorMaterial.emissiveIntensity *= dim;
      for (const b of env3d.colosseum?.brazierLights || []) b.light.intensity *= dim;
    }
  }

  function pulseFog(colorHex, strength) {
    if (destroyed || reduced() || effectiveQuality() === 'low') return;
    const value = clamp(Number(strength) || 0, 0, 1);
    if (value <= fogPulse.value) return;
    fogPulse.value = value;
    fogPulse.color.setHex(colorHex);
  }

  // ================================================================ CINEMATICS

  /** Super-freeze envelope 0..1: quick dim in, hold, soft return over the last 35 %. */
  function superEnvelope(tNow) {
    if (!isSeat(superState.seat) || tNow >= superState.until || tNow < superState.start) return 0;
    const dur = Math.max(1, superState.until - superState.start);
    const p = (tNow - superState.start) / dur;
    const kin = easeOutCubic(clamp((tNow - superState.start) / CINEMATIC.superInMs, 0, 1));
    const out = p > 1 - CINEMATIC.superOutFrac ? 1 - easeInOutSine((p - (1 - CINEMATIC.superOutFrac)) / CINEMATIC.superOutFrac) : 1;
    return kin * out;
  }

  /** Current simulation time scale (slowMo): eases to `scale`, holds, eases back to 1. */
  function timeScaleAt(tNow) {
    if (tNow >= slowState.until || tNow < slowState.start) return 1;
    const dur = Math.max(1, slowState.until - slowState.start);
    const p = (tNow - slowState.start) / dur;
    const kin = easeInOutSine(clamp((tNow - slowState.start) / CINEMATIC.slowInMs, 0, 1));
    let s = lerp(1, slowState.scale, kin);
    if (p > 1 - CINEMATIC.slowOutFrac) s = lerp(s, 1, easeInOutSine((p - (1 - CINEMATIC.slowOutFrac)) / CINEMATIC.slowOutFrac));
    return clamp(s, CINEMATIC.slowMinScale, 1);
  }

  /** Intro sweep amount 1 → 0 (1 = wide establishing shot). */
  function sweepAmount(tNow) {
    if (tNow >= sweepState.until || tNow < sweepState.start) return 0;
    const p = (tNow - sweepState.start) / Math.max(1, sweepState.until - sweepState.start);
    return 1 - (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2); // easeInOutCubic
  }

  /** The fighter currently frozen by a super (the attacker's opponent), or null. */
  function frozenSeat(tNow) {
    if (superState.light || !isSeat(superState.seat) || tNow >= superState.until) return null;
    return otherSeat(superState.seat);
  }

  function resetCinematics() {
    superState.seat = null;
    superState.until = 0;
    superState.light = false;
    slowState.until = 0;
    slowState.scale = 1;
    sweepState.until = 0;
    fogPulse.value = 0;
    for (const w of floorGlow.waves) w.active = false;
    for (const v of [framing.cam, framing.look, framing.camVel, framing.lookVel, framing.camGoal, framing.lookGoal]) v.set(0, 0, 0);
    Object.assign(cine, {superK: 0, superSeat: null, superLight: false, timeScale: 1, sweepK: 0});
    dimQuad.quad.visible = false;
    dimQuad.material.opacity = 0;
    scene.fog.color.copy(FOG_BASE);
    env3d?.sky.material.uniforms.uHorizon.value.copy(HORIZON_BASE);
    for (const a of activeStage.ambient) a.light.intensity = a.base;
    if (camera.fov !== LAYOUT.fov) {
      camera.fov = LAYOUT.fov;
      camera.updateProjectionMatrix();
    }
  }

  /** Critically damped smoothing (stable for any dt), per vector component. */
  function smoothDamp(current, goal, velocity, smoothTime, dt) {
    const omega = 2 / Math.max(1e-4, smoothTime);
    const x = omega * dt;
    const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    for (const axis of ['x', 'y', 'z']) {
      const change = current[axis] - goal[axis];
      const temp = (velocity[axis] + omega * change) * dt;
      velocity[axis] = (velocity[axis] - omega * temp) * decay;
      current[axis] = goal[axis] + (change + temp) * decay;
      if (Math.abs(current[axis] - goal[axis]) < 1e-6 && Math.abs(velocity[axis]) < 1e-6) {
        current[axis] = goal[axis];
        velocity[axis] = 0;
      }
    }
  }

  /**
   * Dynamic fight camera: frames both fighters' CURRENT positions (ultimate
   * travel included). At home the goal is exactly zero, so the render camera
   * equals the layout (base) camera and DOM overlays stay aligned.
   */
  function updateFraming(dt, quiet) {
    if (quiet) {
      for (const v of [framing.cam, framing.look, framing.camVel, framing.lookVel]) v.set(0, 0, 0);
      return;
    }
    const f1 = fighters.get(1);
    const f2 = fighters.get(2);
    const p1 = f1.root.position;
    const p2 = f2.root.position;
    const dx = (p1.x + p2.x - f1.home.x - f2.home.x) / 2;
    const dz = (p1.z + p2.z - f1.home.z - f2.home.z) / 2;
    const homeSpan = Math.max(0.5, Math.abs(f2.home.x - f1.home.x));
    const span = Math.abs(p2.x - p1.x);
    // Gentle: the ultimate already dollies in, so distance-zoom stays light.
    const close = clamp((homeSpan - span) / homeSpan, -0.5, 0.6);
    const air = Math.max(0, f1.offset.y, f2.offset.y);
    framing.camGoal.set(dx * 0.55, air * 0.12 + close * 0.12, -close * 0.9 + dz * 0.5);
    framing.lookGoal.set(dx * 0.75, air * 0.35 + close * 0.08, dz * 0.6);
    smoothDamp(framing.cam, framing.camGoal, framing.camVel, CINEMATIC.frameSmooth, dt);
    smoothDamp(framing.look, framing.lookGoal, framing.lookVel, CINEMATIC.frameSmooth, dt);
  }

  // =================================================================== CAMERA

  const cameraOffset = new THREE.Vector3();
  const lookOffset = new THREE.Vector3();
  const DOWN = new THREE.Vector3(0, -1, 0);
  const UP_AXIS = new THREE.Vector3(0, 1, 0);
  const lookPoint = new THREE.Vector3();
  const orbit = new THREE.Vector3();
  const viewDir = new THREE.Vector3();

  function updateCamera(t, tNow, dt = 0) {
    const quiet = reduced();
    cameraOffset.set(0, 0, 0);
    lookOffset.set(0, 0, 0);

    // Dynamic framing (zero while both fighters are home).
    updateFraming(dt, quiet);
    cameraOffset.add(framing.cam);
    lookOffset.add(framing.look);

    // Super freeze: a slight push-in toward the attacker.
    if (cine.superK > 0 && !cine.superLight && isSeat(cine.superSeat)) {
      const k = cine.superK;
      const ax = fighters.get(cine.superSeat).root.position.x;
      cameraOffset.x += ax * 0.22 * k;
      cameraOffset.y += 0.06 * k;
      cameraOffset.z += -0.85 * k;
      lookOffset.x += ax * 0.38 * k;
      lookOffset.y += 0.12 * k;
    }

    // Gentle idle drift (tiny in reduced mode).
    const drift = quiet ? 0 : 1;
    cameraOffset.x += Math.sin(t * 0.21) * 0.12 * drift;
    cameraOffset.y += Math.sin(t * 0.33 + 1.1) * 0.05 * drift;
    lookOffset.x += Math.sin(t * 0.17 + 0.4) * 0.05 * drift;

    // Dolly: ease toward a fighter and back (or hold for the match end).
    const d = dollyState;
    if (d.track) {
      const p = clamp((tNow - d.track.start) / d.track.dur, 0, 1);
      if (d.track.release) d.k = d.track.from * (1 - easeInOutSine(p));
      else if (d.track.hold) d.k = lerp(d.track.from, 1, easeInOutSine(p));
      else if (p < 0.35) d.k = lerp(d.track.from, 1, easeInOutSine(p / 0.35));
      else if (p < 0.7) d.k = 1;
      else d.k = 1 - easeInOutSine((p - 0.7) / 0.3);
      if (p >= 1 && !d.track.hold) {
        d.track = null;
        if (!d.k || d.k < 0.001) d.k = 0;
      }
    }
    if (d.k > 0 && isSeat(d.seat)) {
      const s = layoutState.seats.get(d.seat);
      // KESINYAP 22: dolly koltuğun EVİNE değil, iki dövüşçünün o anki ortasıyla koltuk arasına (½) yaklaşır →
      // R sırasında saldıran (menzilli ulti evinde kalır) kadraj dışına düşmez.
      const fa = fighters.get(1), fb = fighters.get(2);
      const mid = fa && fb ? ((fa.root.position.x + fa.actor.position.x * (fa.root.scale.x || 1)) + (fb.root.position.x + fb.actor.position.x * (fb.root.scale.x || 1))) / 2 : 0;
      const sx = ((s ? s.position.x : -facingOf(d.seat) * 2.5) + mid) / 2;
      cameraOffset.x += sx * 0.32 * d.k;
      cameraOffset.y += 0.15 * d.k;
      cameraOffset.z += -1.25 * d.k;
      lookOffset.x += sx * 0.45 * d.k;
      lookOffset.y += 0.1 * d.k;
    }

    // Yan görünüm kadrajı: iki dövüşçünün orta noktasını izle, yakınlaştıkça hafif yaklaş.
    if (!quiet) {
      const fa = fighters.get(1), fb = fighters.get(2);
      if (fa && fb) {
        const fr = frameFighters(fa.root.position.x + fa.actor.position.x * (fa.root.scale.x || 1),
          fb.root.position.x + fb.actor.position.x * (fb.root.scale.x || 1));
        cameraOffset.x += fr.centerX * 0.5;
        lookOffset.x += fr.centerX * 0.5;
        cameraOffset.z -= fr.zoom * 0.35;
      }
    }

    // Add after framing: trauma and punch never affect layout/HUD measurements.
    for (let i = shakes.length - 1; i >= 0; i--) {
      if (tNow - shakes[i].start >= shakes[i].dur) shakes.splice(i, 1);
    }
    for (let i = kicks.length - 1; i >= 0; i--) {
      if (tNow - kicks[i].start >= kicks[i].dur) kicks.splice(i, 1);
    }
    cameraOffset.x += impactFrame.shakeX + impactFrame.punch;
    cameraOffset.y += impactFrame.shakeY;
    cameraOffset.z -= impactFrame.zoom;
    if (ult && !quiet) cameraOffset.z += 2.5;
    // Kullanıcı: "ulti atarken sahne büyüyor ama can barları çıkıyor": ulti kamerasında sütun gövdesi karanlıkta
    // kayboluyor, turuncu/mavi ışık halkaları dövüşçülerin üstünde asılı can barı gibi okunuyordu → ulti boyunca gizli.
    const bandsOn = !ult;
    if (env3d?.pillarBands && env3d.pillarBandsOn !== bandsOn) { env3d.pillarBandsOn = bandsOn; for (const band of env3d.pillarBands) band.visible = bandsOn; }

    // An ultimate can throw one fighter above the normal two-person frame.
    // Widen around the midpoint immediately; damped tracking alone lags that arc.
    const ultimateAir = ult && !quiet ? Math.max(0, ...[...fighters.values()].map(f => f.offset.y)) : 0;
    if (ultimateAir > 0.2) {
      cameraOffset.y += ultimateAir * 0.28;
      lookOffset.y += ultimateAir * 0.28;
      cameraOffset.z += ultimateAir * 4;
    }

    camera.position.copy(baseCamera.position).add(cameraOffset);
    lookPoint.copy(baseTarget).add(lookOffset);

    // Intro sweep: start wide, high and swung to the side, glide into the side view.
    const sweepK = cine.sweepK;
    if (sweepK > 0) {
      orbit.copy(camera.position).sub(lookPoint).applyAxisAngle(UP_AXIS, -0.62 * sweepK).multiplyScalar(1 + 0.75 * sweepK);
      orbit.y += 1.7 * sweepK;
      camera.position.copy(lookPoint).add(orbit);
      lookPoint.y += 0.45 * sweepK;
    }
    const fov = LAYOUT.fov + 8 * sweepK - impactFrame.zoom * 3;
    if (sweepK > 0 ? Math.abs(camera.fov - fov) > 1e-4 : camera.fov !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    camera.lookAt(lookPoint);

    // Super-freeze darkening quad, parked just behind the attacker.
    const dimValue = cine.superLight ? 0 : CINEMATIC.superDim * cine.superK;
    dimQuad.quad.visible = dimValue > 0.003;
    if (dimQuad.quad.visible) {
      const attacker = fighters.get(cine.superSeat);
      camera.updateMatrixWorld(true);
      camera.getWorldDirection(viewDir);
      const s = attacker.root.scale.x || 1;
      const depth = clamp(orbit.copy(attacker.root.position).sub(camera.position).dot(viewDir) + 1.2 * s, 1, 60);
      const h = 2 * depth * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.2;
      dimQuad.quad.position.set(0, 0, -depth);
      dimQuad.quad.scale.set(h * (camera.aspect || 1), h, 1);
      dimQuad.material.opacity = dimValue;
    }

    // Full-screen flash.
    let best = null;
    let bestValue = 0;
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i];
      const p = (tNow - f.start) / f.dur;
      if (p >= 1) {
        flashes.splice(i, 1);
        continue;
      }
      const env = p < 0.12 ? p / 0.12 : Math.pow(1 - (p - 0.12) / 0.88, 2);
      const value = env * f.intensity;
      if (value > bestValue) {
        bestValue = value;
        best = f;
      }
    }
    flashQuad.quad.visible = bestValue > 0.003;
    if (best) {
      flashQuad.material.uniforms.uColor.value.setHex(best.color);
      flashQuad.material.uniforms.uOpacity.value = bestValue;
    }
  }

  // ====================================================================== API

  const api = {
    THREE,
    scene,
    camera,
    renderer,
    /** World position of the character's chest (new vector each call). */
    seatAnchor(seat) {
      const fighter = fighters.get(seat);
      if (!fighter) return new THREE.Vector3();
      const pose = fighter.lastPose;
      const s = fighter.root.scale.x;
      const out = new THREE.Vector3(0, (RIG.feetV - RIG.chestV) * RIG.planeH * s, 0.1 * s);
      out.add(fighter.root.position);
      if (pose) {
        out.x += fighter.face * pose.fwd * s;
        out.y += Math.max(0, pose.lift) * s;
      }
      return out;
    },
    /** KESINYAP 21: karakterin başının üstünün ekran (client px) konumu — HUD'daki "+120" can sayısı için; yoksa null. */
    seatScreen(seat) {
      const fighter = fighters.get(seat);
      const el = renderer?.domElement;
      if (!fighter || !el?.getBoundingClientRect) return null;
      const p = api.seatAnchor(seat);
      p.y += 0.95 * (fighter.root.scale.x || 1);
      p.project(camera);
      const r = el.getBoundingClientRect();
      if (!(r.width > 0) || p.z > 1) return null;
      return {x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height};
    },
    /** World position on the floor under the character (new vector each call). */
    seatGround(seat) {
      const fighter = fighters.get(seat);
      if (!fighter) return new THREE.Vector3();
      const out = fighter.root.position.clone();
      out.y = 0;
      if (fighter.lastPose) out.x += fighter.face * fighter.lastPose.fwd * fighter.root.scale.x;
      return out;
    },
    /** Floor point of the character's own seat, ignoring ultimate travel (new vector). */
    seatHome(seat) {
      const fighter = fighters.get(seat);
      return fighter ? fighter.home.clone().setY(0) : new THREE.Vector3();
    },
    /** World distance the fighter's body is displaced from its seat by ultimate travel (0 at home). */
    travelOffset(seat) {
      const fighter = fighters.get(seat);
      return fighter ? fighter.offset.length() : 0;
    },
    /** +1 when the character faces +x (seat 1 / fire), -1 otherwise. */
    facing(seat) {
      return facingOf(seat);
    },
    /**
     * Paket 31: the seat's body (core) rig texture, or null until the rigs are loaded.
     * Owned by the core — plugins may sample it but must never dispose it.
     */
    rigTexture(seat) {
      return fighters.get(seat)?.core?.material?.map || null;
    },
    /** Paket 32: koltuğun 3B modeli {fighterId, rig} ya da null (düzlem yedek). */
    fighterModel(seat) {
      const fighter = fighters.get(seat);
      return fighter?.model ? {fighterId: fighter.fighterId, rig: fighter.model} : null;
    },
    /**
     * Paket 32: koltuğun karakterinden yarı saydam, tek renk siluet (partner desteği).
     * Çağıran sahneye ekler ve dispose eder; model yüklü değilse null.
     */
    createFighterGhost(seat, {color, opacity = 0.55, asSeat = seat} = {}) {
      const fighter = fighters.get(seat);
      if (destroyed || !fighter?.model || !fighter.modelAsset) return null;
      return safeCall(() => createFighterRig(THREE, fighter.modelAsset, {
        fighterId: fighter.fighterId, seat: asSeat, clone: cloneFn, ghost: {color, opacity},
      })) || null;
    },
    /** Make the crowd cheer, intensity 0..1 (decays by itself). */
    cheer(intensity = 0.6) {
      if (!destroyed) cheer(intensity);
    },
    /** Subscribe to the render loop: fn(dtSeconds, tSeconds). Returns unsubscribe. */
    onFrame(fn) {
      if (typeof fn !== 'function') return () => {};
      frameSubs.add(fn);
      return () => frameSubs.delete(fn);
    },
    impactManaged: true,
    /** Camera shake, intensity 0..1 for `ms`. No-op in reduced mode. */
    shake(intensity = 0.5, ms = 300) {
      if (destroyed || reduced()) return;
      const value = clamp(Number(intensity) || 0, 0, 1);
      if (!value) return;
      addTrauma(impactFeel.state, value);
      shakes.push({start: now(), dur: clamp(Number(ms) || 300, 30, 3000), amp: value});
      if (shakes.length > 6) shakes.shift();
    },
    /**
     * Hit-stop: freeze fighter poses for `ms` (clamped 0..160) while `seat`
     * trembles. Overlapping calls extend, never shorten. No-op in reduced mode.
     */
    hitStop(ms = 80, seat = null, intensity = 1) {
      if (destroyed || reduced()) return;
      const dur = clamp(Number(ms) || 0, 0, 160);
      if (!dur) return;
      const t = now();
      if (t + dur <= hitStop.until) return;
      const id = beginHitstop(impactFeel.state, t, dur);
      // Real-time safety release: stale callbacks cannot restore a newer stop.
      env.setTimeout?.(() => restoreHitstop(impactFeel.state, id, now()), dur);
      if (t >= hitStop.until) {
        hitStop.start = t;
        hitStop.last = t;
      }
      hitStop.until = t + dur;
      hitStop.seat = isSeat(seat) ? seat : null;
      hitStop.amp = clamp(Number(intensity) || 0, 0, 1.5);
    },
    /** Directional camera punch toward `dirX` (-1 left / +1 right), 0..1. No-op in reduced mode. */
    kick(dirX = 0, intensity = 0.5, ms = 220) {
      if (destroyed || reduced()) return;
      const value = clamp(Number(intensity) || 0, 0, 1);
      if (!value) return;
      const dx = Math.sign(Number(dirX) || 0);
      impactFeel.state.punch = clamp(impactFeel.state.punch + dx * .16 * value, -.4, .4);
      kicks.push({start: now(), dur: clamp(Number(ms) || 220, 60, 1000), x: dx * 0.16 * value, y: -0.05 * value});
      if (kicks.length > 4) kicks.shift();
    },
    /** Additive full-screen colour flash. Toned down in reduced mode. */
    flash(colorHex = 0xffffff, intensity = 0.4, ms = 200) {
      if (destroyed) return;
      const value = clamp(Number(intensity) || 0, 0, 1) * (reduced() ? 0.35 : 1);
      if (!value) return;
      flashes.push({start: now(), dur: clamp(Number(ms) || 200, 30, 3000), color: Number(colorHex) >>> 0 & 0xffffff, intensity: value});
      if (flashes.length > 6) flashes.shift();
    },
    /** Camera dolly toward a seat (eases in, holds, eases back) or back to centre (null). */
    dolly(seat, ms = 1200) {
      dollyTo(seat, ms, false);
    },
    /**
     * İş 12: genel plana yumuşak dönüş (raund sonu kartı, geri sayım, yeni raund başı). Yakın çekim (dolly)
     * ≤ ms içinde bırakılır; maç sonu tutuşuna (hold) dokunulmaz. Dinamik kadraj zaten iki dövüşçüyü izler.
     */
    settleCamera(ms = 500) {
      if (destroyed || dollyState.track?.hold) return;
      if (dollyState.k > 0.001) dollyTo(null, Math.min(600, ms));
      else { dollyState.track = null; dollyState.k = 0; }
    },
    quality() {
      return effectiveQuality();
    },
    stage() {
      return stageId;
    },
    isReduced() {
      return reduced();
    },
    /**
     * Super/ultimate start (paket 29): the scene darkens (ambient light and the
     * colosseum ≈ 35 %), the attacker stays bright and the camera pushes in
     * slightly, the opponent's pose freezes; soft return over the last third.
     * Reduced mode: a light dim only (no freeze, no camera move). Plugins get
     * `{type:'SUPER_FREEZE', seat, ms}`.
     */
    superFreeze(seat, ms = 450) {
      if (destroyed || !isSeat(seat)) return;
      const dur = clamp(Number(ms) || 450, CINEMATIC.superMinMs, CINEMATIC.superMaxMs);
      const t = now();
      const light = reduced();
      if (superState.seat === seat && t < superState.until && superState.light === light) {
        superState.until = Math.max(superState.until, t + dur); // extend, never restart the fade-in
      } else {
        Object.assign(superState, {seat, start: t, until: t + dur, light});
      }
      if (!light) forwardToPlugins({type: 'SUPER_FREEZE', seat, ms: dur, character: CHARACTER_OF_SEAT[seat], client: true});
    },
    /**
     * Knockout slow motion: fighter tracks, ultimate travel tweens and the fx
     * plugin's simulation run at `scale` for `ms` (real time), easing back to 1.
     * Timed cues and server events stay in real time. No-op in reduced mode.
     */
    slowMo(scale = 0.25, ms = 900) {
      if (destroyed || reduced()) return;
      const s = clamp(Number(scale), CINEMATIC.slowMinScale, 1);
      if (!Number.isFinite(s) || s >= 1) return;
      const dur = clamp(Number(ms) || 900, 100, CINEMATIC.slowMaxMs);
      const t = now();
      if (t < slowState.until) {
        slowState.scale = Math.min(slowState.scale, s);
        slowState.until = Math.max(slowState.until, t + dur);
      } else {
        Object.assign(slowState, {scale: s, start: t, until: t + dur});
      }
    },
    /** Match-start camera: a wide establishing shot sweeping into the side view. No-op in reduced mode. */
    introSweep(ms = 1800) {
      if (destroyed || reduced()) return;
      const dur = clamp(Number(ms) || 1800, CINEMATIC.sweepMinMs, CINEMATIC.sweepMaxMs);
      const t = now();
      Object.assign(sweepState, {start: t, until: t + dur});
    },
    /** Current simulation time scale (1 normally, < 1 during slowMo). Plugins scale their dt by it. */
    timeScale() {
      return destroyed ? 1 : cine.timeScale;
    },
  };

  function dollyTo(seat, ms, hold) {
    if (destroyed) return;
    const dur = clamp(Number(ms) || 1200, 50, 8000);
    if (reduced()) {
      dollyState.track = null;
      dollyState.k = 0;
      return;
    }
    if (!isSeat(seat)) {
      dollyState.track = {start: now(), dur, from: dollyState.k, release: true, hold: false};
      return;
    }
    // Switching seats mid-dolly restarts from 0 to avoid a sideways jump.
    const from = dollyState.seat === seat ? dollyState.k : 0;
    dollyState.seat = seat;
    dollyState.k = from;
    dollyState.track = {start: now(), dur, from, release: false, hold: Boolean(hold)};
  }

  // =================================================================== EVENTS

  /** Görev 4 — bu hasar olayının tepkisi (trace penceresi: koltuk başına son tepki anı). */
  function reactionFor(event) {
    return hitReaction(event, {lastAt: lastReactionAt.get(event.toSeat) ?? -Infinity, now: now()});
  }

  function handleCore(event) {
    const type = event.type;
    if (type === 'SKILL_CAST') {
      const seat = event.fromSeat;
      if (!isSeat(seat)) return;
      // İş 12: motor planındaki sahne yuvası — yuva > 0 yeni sahne AÇMAZ (aynı yaklaşmaya eklenir ya da son vuruşa katlanır).
      const join = event.skill !== 'r' && (Number(event.sceneSlot) > 0 || event.fold === true);
      if (event.__inScene) return; // tampondan girdinin zincirine önceden eklendi (holdSceneEvent)
      if (enqueueMeleeSkill(seat, event.skill, {ultimate: event.skill === 'r', join, fold: event.fold === true, pre: event.__pre || []})) {
        /* görsel kuyruk: sırası gelince oynar (q/e kombo zinciri; r ulti girdisi) */
      } else if (playModelSkill(seat, event.skill)) {
        if (event.skill === 'r') {
          api.flash(fighters.get(seat).palette.main, 0.14, 260);
          ultimateIntro(seat);
        }
      } else if (event.skill === 'q') playLunge(seat, {wind: 120, strike: 170, recover: 240, dist: 0.85, swing: 1});
      else if (event.skill === 'e') playLunge(seat, {wind: 230, strike: 260, recover: 380, dist: 1.35, lift: 0.18, squash: 0.12, swing: 1.3});
      else if (event.skill === 'r') {
        // Charge-up: the ULTIMATE_PHASE events (+250 ms) do the travelling.
        addTrack(fighters.get(seat), 640, (p, o, m) => {
          const k = easeOutCubic(Math.min(1, p * 2.2));
          o.squash += 0.12 * k * (1 - p) * m;
          o.fwd += -0.18 * k * m;
          o.weapon += -1.0 * k * m;
          o.glow += 1.2 * k;
        });
        api.flash(fighters.get(seat).palette.main, 0.14, 260);
      }
    } else if (type === 'HEAL_APPLIED') {
      // KESINYAP 21 — E (kendine can): yazma anında, yerinde; sahne kuyruğuna girmez (vuruş sırası değişmez).
      const seat = isSeat(event.seat) ? event.seat : event.fromSeat;
      if (isSeat(seat) && !reduced()) {
        const f = fighters.get(seat);
        addTrack(f, 760, (p, o, m) => { o.glow += 0.9 * bump(p); o.squash -= 0.05 * bump(p) * m; }, {replace: false});
        // Karakterin kendi "kendine can" klibi (clips.heal): yalnız boştayken, sırada sahnesi yokken (sahne kesilmez).
        if (f?.model && !f.ko && !f.victory && !f.castQueue.some(e => !e.dead)) safeCall(() => f.model.play('heal'));
      }
    } else if (type === 'ASSIST_CAST' && event.resolve && Number(event.sceneSlot) === 0) {
      // İş 12: yalnız destek vuruşu olan sahne — sahnesiz hasar kalmasın diye koltuk kendi q sahnesini oynar.
      if (isSeat(event.fromSeat)) enqueueMeleeSkill(event.fromSeat, 'q', {fx: false});
    } else if (type === 'COUNTERATTACK_CAST') {
      if (isSeat(event.fromSeat) && !enqueueMeleeSkill(event.fromSeat, 'q', {fx: false}) && !playModelSkill(event.fromSeat, 'q', {fx: false})) playLunge(event.fromSeat, {wind: 70, strike: 140, recover: 220, dist: 1.0, swing: 1.1, glow: 0.4});
    } else if (type === 'ULTIMATE_PHASE') {
      if (!isSeat(event.fromSeat)) return;
      if (reduced()) ultimateFlashOnly(event);
      else ultimatePhase(event);
    } else if (type === 'DAMAGE_APPLIED') {
      const seat = event.toSeat;
      if (!isSeat(seat)) return;
      // The camera punches the way the defender is knocked (away from the attacker).
      const away = -facingOf(seat);
      // Görev 4 — tepki politikası: knockdown | heavy | hit | trace (hitReaction saf fonksiyonu).
      const reaction = hitReaction(event, {lastAt: lastReactionAt.get(seat) ?? -Infinity, now: now()});
      lastReactionAt.set(seat, now());
      const defender = fighters.get(seat);
      if (defender) defender.lastReaction = reaction;
      if (event.blocked) {
        const parry = event.blockKind === 'PARRY';
        playBrace(seat, parry ? 1.3 : event.blockKind === 'PERFECT_BLOCK' ? 1.1 : 0.9);
        if (parry) {
          if (now() - impactFeel.state.lastStopAt >= 400) {
            impactFeel.state.lastStopAt = now(); api.hitStop(110, seat, 0.6);
          }
          api.kick(-away, 0.55, 260); // parry pushes back toward the attacker
        } else {
          if (now() - impactFeel.state.lastStopAt >= 400) {
            impactFeel.state.lastStopAt = now(); api.hitStop(45, seat, 0.3);
          }
        }
      } else if ((Number(event.amount) || 0) > 0) {
        const inUltTravel = Boolean(ult && ult.def === seat && fighters.get(seat).seg);
        // During an ultimate pull/throw the travel tween owns the defender's body.
        if (reaction === 'knockdown') {
          // Can 0: sarsıntı + devrilme (KNOCKOUT olayı geldiğinde startKnockout idempotent).
          if (!inUltTravel) playHit(seat, event.amount);
          startKnockout(seat);
        } else if (reaction === 'trace') {
          // 180 ms içinde ikinci darbe: yeni tepki klibi yok, kısa titreme izi.
          addTrack(fighters.get(seat), 200, (p, o, m) => {
            o.flash += Math.max(0, 0.5 - p * 2) * m;
            o.fwd += -0.08 * bump(p) * m;
          }, {replace: false});
        } else if (!inUltTravel) {
          playHit(seat, reaction === 'heavy' ? Math.max(Number(event.amount) || 0, HEAVY_DAMAGE) : event.amount);
          if (reaction === 'heavy' && !reduced()) api.slowMo(0.6, 160);
        } else {
          addTrack(fighters.get(seat), 260, (p, o) => { o.flash += Math.max(0, 1 - p * 3); }, {replace: false});
          modelPlay(seat, 'hit', {heavy: true});
        }
        const a = clamp((Number(event.amount) || 0) / HEAVY_DAMAGE, 0, 1);
        const crit = event.arena ? (Array.isArray(event.tags) && event.tags.includes('FİNAL'))
          : Array.isArray(event.bonusTags) && event.bonusTags.length > 0;
        if (crit) showCritBackdrop(isSeat(event.fromSeat) ? event.fromSeat : otherSeat(seat));
        // Contact policy already applied the tier's stop, trauma and camera punch.
        if (a >= 0.7) cheer(0.35 + a * 0.4);
        // Floor light wave + depth-fog pulse in the attacker's colour.
        const from = isSeat(event.fromSeat) ? event.fromSeat : otherSeat(seat);
        spawnFloorWave(seat, from, 0.35 + a + (crit ? 0.2 : 0));
        pulseFog(fighters.get(from).palette.main, 0.35 + 0.65 * a);
      }
    } else if ((type === 'SHIELD_TRIGGERED' || type === 'PARRY_TRIGGERED') && timeline.isBusy() && !reduced()) {
      // Sahne oynarken savunma, bloklanan hasarın TEMAS karesinde gösterilir (DAMAGE_APPLIED blocked → playBrace);
      // burada erken kalkan/sendeleme yok (saldırı henüz ulaşmadı).
    } else if (type === 'SHIELD_TRIGGERED') {
      if (isSeat(event.seat)) playBrace(event.seat, event.kind === 'PERFECT_BLOCK' ? 1.15 : 0.95);
    } else if (type === 'PARRY_TRIGGERED') {
      if (isSeat(event.seat)) playBrace(event.seat, 1.35);
      const attacker = isSeat(event.againstSeat) ? event.againstSeat : isSeat(event.seat) ? otherSeat(event.seat) : null;
      if (attacker) playStagger(attacker);
      cheer(0.45);
    } else if (type === 'KNOCKOUT') {
      // Client-only event sent by index.js right before onMatchEnd(); seat = loser.
      // İş 1, 3. tur: bekleyenler koltuk başına tek sahnede, SIRALI ve animasyonlu oynar (en geç KO_DRAIN_MS);
      // yenilen ancak son darbe ekranda indikten sonra düşer (öldürücü vuruş sahnesiz kalmaz).
      drainVisual(KO_DRAIN_MS);
      if (isSeat(event.seat)) {
        const seat = event.seat;
        if (!timeline.isBusy()) startKnockout(seat);
        else timeline.whenIdle(KO_DRAIN_MS + 500).then(() => { if (!destroyed) startKnockout(seat); });
      }
    } else if (type === 'SHIELD_BROKEN') {
      if (!isSeat(event.seat)) return;
      shatterBubble(event.seat);
      playStumble(event.seat);
      api.flash(0xffffff, 0.22, 160);
      api.shake(0.35, 260);
      cheer(0.4);
    } else if (type === 'ARENA_CUE') {
      // Client-only cinematic cue (same as calling the api directly; handy for
      // tuslab:pvp-combat debugging): {type:'ARENA_CUE', cue, seat?, ms?, scale?}
      if (event.cue === 'superFreeze') api.superFreeze(event.seat, event.ms);
      else if (event.cue === 'slowMo') api.slowMo(event.scale ?? 0.25, event.ms);
      else if (event.cue === 'introSweep') api.introSweep(event.ms);
    }
  }

  function forwardToPlugins(event) {
    for (const plugin of plugins.slice()) {
      if (typeof plugin.handle !== 'function') continue;
      try {
        plugin.handle(event);
      } catch (error) {
        reportPluginError(plugin, error);
      }
    }
  }

  const reportedPlugins = new WeakSet();
  function reportPluginError(plugin, error) {
    if (reportedPlugins.has(plugin)) return;
    reportedPlugins.add(plugin);
    safeCall(() => env?.console?.warn?.('[arena3d] eklenti hatası', error));
  }

  /** Bu koltuğun başlamamış ulti girdisi varsa olayı ona bekletir (true = bekletildi). */
  function deferUltEvent(event) {
    if (replayingUlt || reduced() || !isSeat(event.fromSeat)) return false;
    const fighter = fighters.get(event.fromSeat);
    if (!fighter?.castQueue?.some(e => e.ultimate && !e.dead && !e.started)) return false;
    (fighter.pendingUltEvents ||= []).push(event);
    return true;
  }

  // KESINYAP 21: motor bir sahnenin tüm vuruşlarını ~aynı anda (yuva başına +1 ms) yollar. Görsel kuyruk boştayken
  // ilk vuruş (yuva 0) anında başlarsa sonraki yuva (ör. menzilli Q'nun ardındaki yakın W) karma zincire katılamaz.
  // Bu yüzden boş kuyrukta sahne olayları koltuk başına SCENE_HOLD_MS tamponlanıp sırayla işlenir (göze görünmez).
  const SCENE_HOLD_MS = 40;
  const sceneHold = new Map(); // seat -> olay listesi
  function holdSceneEvent(event) {
    if (reduced() || event.resolve !== true || event.skill === 'r' || typeof env?.setTimeout !== 'function') return false;
    if (event.type !== 'SKILL_CAST' && event.type !== 'DAMAGE_APPLIED') return false;
    const seat = event.fromSeat;
    const held = sceneHold.get(seat);
    if (held) { held.push(event); return true; }
    if (event.type !== 'SKILL_CAST' || Number(event.sceneSlot) !== 0 || timeline.isBusy() || !isSeat(seat)) return false;
    sceneHold.set(seat, [event]);
    env?.setTimeout?.(() => {
      const list = sceneHold.get(seat) || [];
      sceneHold.delete(seat);
      const casts = list.filter(e => e.type === 'SKILL_CAST' && (e.skill === 'q' || e.skill === 'e'));
      if (casts.length > 1) casts[0].__pre = casts.slice(1);
      for (const e of list) handle(e, true);
    }, SCENE_HOLD_MS);
    return true;
  }

  function handle(event, released = false) {
    if (destroyed || !event || typeof event !== 'object' || typeof event.type !== 'string') return;
    if (!released && holdSceneEvent(event)) return;
    try {
      if (event.type === 'HP_SYNC' && timeline.isBusy() && !reduced()) {
        // Authoritative snapshots may arrive ahead of the queued cosmetic hit.
        // Contact events update the bars in order; the newest snapshot reconciles at idle.
        deferredHpSync = event;
        return;
      }
      // Ulti sırası: sahnesi kuyrukta bekleyen ultinin faz/hasar olayları girdi BAŞLAYINCA işlenir
      // (aksi hâlde ulti koreografisi başka koltuğun saldırısının ortasında başlıyordu).
      if ((event.type === 'ULTIMATE_PHASE' || (event.type === 'DAMAGE_APPLIED' && event.skill === 'r')) && deferUltEvent(event)) return;
      if (event.type === 'DAMAGE_APPLIED' && isSeat(event.toSeat)) {
        const attacker = fighters.get(event.fromSeat);
        const cast = attacker?.lastCast;
        let entry = null;
        if (cast && event.skill === 'r' && event.phase && !reduced() && ult) {
          const sequence = ult;
          // İş 12: faz segmenti sonraki fazca kesilirse (temas işaretlenmez) hasar zaman aşımına kalıp kart
          // açıkken düşüyordu (ölçüm: "2/3" sahne bitiminden 1,8 sn sonra). Sonraki fazın teması ya da ultinin
          // bitişi de bu fazın hasarını o karede gösterir (sıra korunur).
          // İş 12: menzilli ultide cast.arrived ulti başındaki efektle erken true oluyordu (1/3 sayısı temastan ~0,9 sn önce);
          // 1. faz da kendi temas karesine (markContact) bağlanır.
          impactFeel.queue(event, () => sequence.contacts.has(event.phase)
            || [...sequence.contacts].some(p => p > event.phase) || ult !== sequence);
        } else if (event.skill !== 'r' && !reduced() && (entry = bindCastEntry(event.fromSeat)
          // İş 12 güvenlik ağı: bağlanacak sahne yoksa (destek/katlanan vuruş sahnesi önceden bitti/düştü) sahnesiz
          // göstermek yerine saldıranın kendi q sahnesi açılır ve hasar onun temas karesinde gösterilir.
          || (isSeat(event.fromSeat) && enqueueMeleeSkill(event.fromSeat, 'q', {fx: false}) && bindCastEntry(event.fromSeat)))) {
          // Görsel kuyruğa bağlı hasar: gösterim (efekt/sarsıntı/sayı/tepki) klibin gerçek temas karesinde.
          // Görev 4: hasar KENDİ vuruşunun (strike) temas karesine bağlanır.
          entry.strike.events.push(event);
          boundEvents.set(event, entry);
          // Bağ dinamik: boşaltma sıkıştırması olayı başka sahneye taşıyabilir (compactForDrain).
          impactFeel.queue(event, () => { const b = boundEvents.get(event) || entry; return b.strike.contact && !b.entry.dead; }, 9000);
        } else if (reduced()) impactFeel.hit(event);
        else silentDamage(event, event.skill === 'r'
          ? `unbound-u${ult ? 1 : 0}c${cast ? 1 : 0}p${event.phase ?? '-'}q${attacker?.castQueue?.map(e => `${e.ultimate ? 'r' : e.skill}${e.started ? 's' : ''}${e.dead ? 'd' : ''}`).join('') ?? '-'}`
          : 'unbound');
        return;
      }
      handleCore(event);
    } catch {
      /* cosmetic layer: never break the combat listener */
    }
    forwardToPlugins(event);
  }

  function onMatchEnd({winnerSeat} = {}) {
    if (destroyed) return;
    clear(false); // End cinematics retain the plugins' existing lifecycle.
    if (!isSeat(winnerSeat)) {
      for (const fighter of fighters.values()) fighter.tracks.length = 0;
      return;
    }
    const loser = otherSeat(winnerSeat);
    try {
      startKnockout(loser);
      startVictory(winnerSeat);
      if (env3d?.colosseum) env3d.colosseum.focusSeat = winnerSeat; // spotlights find the winner
      if (!reduced()) {
        dollyTo(winnerSeat, 2600, false); // bounded finish, then return to the layout camera
      }
      api.flash(fighters.get(winnerSeat).palette.main, 0.2, 500);
    } catch {
      /* ignore */
    }
    // Plugins get the KNOCKOUT event through handle(); index.js sends it itself.
  }

  function clear(notifyPlugins = true) {
    if (destroyed) return;
    timeline.flush();      // raund geçişi: kuyruk bitmediyse son durumu anında uygula
    impactFeel.flush();    // bekleyen hasar gösterimleri teslim edilir (kayıp yok)
    if (deferredHpSync) { forwardToPlugins(deferredHpSync); deferredHpSync = null; }
    impactFeel.clear();
    for (const fighter of fighters.values()) {
      // İş 1, 3. tur: raund geçişinde anında oturtma YOK — kesilen sahnenin modeli dünya konumu sınırlayıcısıyla
      // (≤ 0,12/kare, koşu klibiyle) yerine yürür; poz idle'a crossFade ile döner (rig.reset).
      fighter.carry = 0;
      fighter.castQueue.length = 0;
      fighter.tracks.length = 0;
      fighter.bubblePulses.length = 0;
      fighter.shatter = null;
      fighter.ko = null;
      fighter.victory = null;
      fighter.bubbleMaterial.uniforms.uColor.value.setHex(fighter.palette.shield);
      resetTravel(fighter);
      fighter.lastCast = null;
      fighter.impactFlash = null;
      if (fighter.model) {
        fighter.fxQueue = [];
        fighter.modelClock = 0;
        safeCall(() => fighter.model.reset());
      }
    }
    safeCall(() => skillFx?.clear());
    ult = null;
    finishedUlts.length = 0;
    if (env3d?.colosseum) {
      env3d.colosseum.excite = 0;
      env3d.colosseum.focusSeat = null;
    }
    shakes.length = 0;
    kicks.length = 0;
    hitStop.until = 0;
    hitStop.last = 0;
    flashes.length = 0;
    cues.length = 0;
    dollyState.track = null;
    dollyState.k = 0;
    dollyState.seat = null;
    resetCinematics();
    impactFrame = stepImpact(impactFeel.state, 0, now(), reduced());
    for (const fighter of fighters.values()) fighter.clock = 0;
    for (const plugin of notifyPlugins ? plugins.slice() : []) {
      if (typeof plugin.clear === 'function') {
        try {
          plugin.clear();
        } catch (error) {
          reportPluginError(plugin, error);
        }
      }
    }
    for (const fighter of fighters.values()) updateFighter(fighter, 0, now());
    updateCamera(0, now(), 0);
    renderFrame(); // show the reset pose immediately (also while paused)
  }

  function registerPlugin(plugin) {
    if (destroyed || !plugin || typeof plugin !== 'object') return () => {};
    if (!plugins.includes(plugin)) plugins.push(plugin);
    queueWarmup(); // eklentinin (efektler) malzemeleri de önceden derlensin
    return () => {
      const index = plugins.indexOf(plugin);
      if (index < 0) return;
      plugins.splice(index, 1);
      try {
        plugin.dispose?.();
      } catch (error) {
        reportPluginError(plugin, error);
      }
    };
  }

  // ================================================================== QUALITY

  function applyQuality() {
    const high = effectiveQuality() === 'high';
    safeCall(() => skillFx?.setLowQuality(!high));
    activeStage.applyQuality(effectiveQuality());
    keepLightCount();
    for (const fighter of fighters.values()) fighter.accentLight.intensity = high ? 4 : 0; // görünür kalır (ışık sayısı sabit)
    floorGlow.mesh.visible = high; // scene polish is the first thing 'low' drops
    if (!high) for (const w of floorGlow.waves) w.active = false;
    layout(true);
  }

  /** İş 12: sahne modülünün kalite için gizlediği nokta/spot ışıkları görünür kalır, şiddeti 0 olur (program yeniden derlenmez). */
  function keepLightCount() {
    safeCall(() => activeStage.group?.traverse?.(o => {
      if (!(o.isPointLight || o.isSpotLight)) return;
      if (o.userData.pvpBase === undefined) o.userData.pvpBase = o.intensity;
      if (o.visible) o.intensity = o.userData.pvpBase;
      else { o.intensity = 0; o.visible = true; }
    }));
  }

  function setQuality(mode) {
    if (destroyed || !['high', 'low', 'auto'].includes(mode)) return;
    qualityMode = mode;
    if (mode === 'auto') governor.setStep(softwareRenderer ? AUTO_QUALITY.lowStep : 0);
    applyQuality();
  }

  function monitorFrame(dtMs) {
    if (qualityMode !== 'auto') return;
    governor.setPaused(readyState !== 'ready' || warmQueue.length > 0 || pendingCompiles > 0 || [...fighters.values()].some(f => f.modelJob));
    // Tek yönlü kademe: bloom kapat → çözünürlük düşür → düşük kalite. Titreme yok.
    if (governor.sample(dtMs)) applyQuality();
  }

  /**
   * Shader ön-derleme. three.js programı ışık sayısı ve çıktı hedefine göre
   * seçer: kalite kademesi değişince (ışık gizleme, bloom kapatma) ilk karede
   * ~30 program yeniden bağlanıyordu → savaş ortasında 0.5–1 sn donma (ölçüldü).
   * Üç olası düzen (yüksek+bloom hedefi, yüksek+ekran, düşük+ekran) baştan,
   * kare başına bir düzen olacak şekilde derlenir; sonra geçişler bedavadır.
   */
  const warmQueue = [];
  let pendingCompiles = 0;
  function queueWarmup() {
    if (typeof renderer.compile !== 'function') return;
    warmQueue.length = 0;
    if (!softwareRenderer && bloom) warmQueue.push({level: 'high', target: bloom.target});
    if (!softwareRenderer) warmQueue.push({level: 'high', target: null});
    warmQueue.push({level: 'low', target: null});
    if (readyState === 'ready' && !reduced()) warmQueue.push({rehearse: true});
    warmQueue.push({draw: true});
  }
  function whenWarm(timeoutMs = 60000) {
    const deadline = now() + timeoutMs;
    return new Promise(resolve => {
      const check = () => {
        if (destroyed || readyState === 'failed') return resolve(false);
        if (readyState === 'ready' && !warmQueue.length && !pendingCompiles &&
            [...fighters.values()].every(f => !f.modelJob)) return resolve(true);
        if (now() >= deadline) return resolve(false);
        env.setTimeout(check, 50);
      };
      check();
    });
  }

  /**
   * İş 12 (kasma): havuzdaki/tembel efekt nesneleri (mermi, halka, sütun, kıvılcım…) sahneye ancak ilk
   * vuruşta girdiği için ön-ısıtmaya hiç girmiyordu; ANGLE ilk çizimde gölgelendirici varyantı üretip
   * 1–2 sn donuyordu. Maç başında (VS/geri sayım) her efekt türü bir kez GÖRÜNMEZ biçimde kurulur, aynı
   * tick'te çizilir (normal kare üstüne çizildiği için ekranda görünmez) ve hemen temizlenir. Kamera/flaş
   * çağrıları prova boyunca etkisizdir; hasar/can olayı gönderilmez (HUD'a dokunulmaz).
   */
  const rehearsed = new Set();
  function rehearseFx() {
    const key = SEATS.map(s => fighters.get(s)?.fighterId || '').join('|');
    if (rehearsed.has(key)) return;
    rehearsed.add(key);
    const quietApi = ['flash', 'shake', 'kick', 'hitStop', 'slowMo', 'superFreeze', 'introSweep', 'cheer'];
    const saved = {};
    for (const k of quietApi) if (typeof api[k] === 'function') { saved[k] = api[k]; api[k] = () => {}; }
    const fxPlugins = plugins.filter(p => p && p.root && typeof p.handle === 'function'); // 3B efekt eklentileri (DOM/HUD değil)
    try {
      const at = new THREE.Vector3(0, -50, 0);
      if (skillFx) {
        for (const seat of SEATS) {
          const id = fighters.get(seat)?.fighterId;
          for (const kind of ['spear', 'dagger', 'rune', 'bread', 'meteor', 'column', 'shockring', 'shards', 'swirl']) {
            safeCall(() => skillFx.spawn({kind, from: at.clone(), to: at.clone(), color: 0xffffff, accent: 0xffffff, flight: 300, ms: 300, scale: 1,
              profile: id, onArrive: () => {}, follow: out => out.copy(at)}));
          }
          safeCall(() => skillFx.burst(id, at.clone(), 1));
        }
      }
      for (const seat of SEATS) {
        const to = otherSeat(seat);
        const events = [
          ...['q', 'e', 'r'].map(skill => ({type: 'SKILL_CAST', fromSeat: seat, toSeat: to, skill, warm: true})),
          ...[1, 2, 3].map(phase => ({type: 'ULTIMATE_PHASE', fromSeat: seat, toSeat: to, skill: 'r', phase, totalPhases: 3, warm: true})),
          {type: 'COUNTERATTACK_CAST', fromSeat: seat, toSeat: to, skill: 'counter', warm: true},
          {type: 'SHIELD_TRIGGERED', seat, kind: 'PERFECT_BLOCK', warm: true},
          {type: 'PARRY_TRIGGERED', seat, againstSeat: to, warm: true},
          {type: 'SHIELD_BROKEN', seat, warm: true},
        ];
        for (const plugin of fxPlugins) for (const ev of events) safeCall(() => plugin.handle(ev));
        // İş 15: imza efektlerinin her aşaması bir kez (görünmez) — kod yolları ve havuzlar ısınır.
        const fighterId = fighters.get(seat)?.fighterId;
        for (const plugin of fxPlugins) {
          if (typeof plugin.signature !== 'function' || !fighterId) continue;
          for (const skill of ['q', 'e', 'r']) {
            safeCall(() => plugin.signature({stage: 'cast', seat, def: to, skill, fighterId, hitMs: 400, contacts: [400], warm: true}));
            safeCall(() => plugin.signature({stage: 'slam', seat, def: to, skill, fighterId, warm: true}));
            for (const phase of skill === 'r' ? [1, 2, 3] : [0]) {
              safeCall(() => plugin.signature({stage: 'contact', event: {type: 'DAMAGE_APPLIED', fromSeat: seat, toSeat: to, skill, phase, amount: 100, impactContact: true, warm: true}}));
            }
          }
          for (const kind of ['bread', 'spear', 'dagger', 'rune', 'meteor', 'column', 'shockring', 'swirl', 'shards']) {
            safeCall(() => plugin.signature({stage: 'launch', seat, def: to, skill: 'q', fighterId, kind, from: at.clone(), flight: 100, ms: 200, onArrive: () => {}, warm: true}));
          }
        }
      }
      for (let i = 0; i < 3; i++) {
        if (skillFx) safeCall(() => skillFx.update(0.05));
        for (const plugin of fxPlugins) safeCall(() => plugin.update?.(0.05, 0));
      }
      warmDraw();
    } finally {
      for (const k of Object.keys(saved)) api[k] = saved[k];
      safeCall(() => skillFx?.clear?.());
      for (const plugin of fxPlugins) safeCall(() => plugin.clear?.());
    }
  }
  /**
   * ANGLE (Windows/D3D11) program bağlandıktan sonra bile ilk ÇİZİMDE sürücü
   * tarafı gölgelendirici varyantı üretir: gizli efekt nesneleri ilk göründüğünde
   * kare 0.7–1.3 sn donuyordu (Intel UHD'de ölçüldü, betik/bağlama yok). Gizli
   * nesneler bir kez görünür yapılıp çizilir; aynı tick'te normal kare üstüne
   * çizildiği için ekranda görünmez.
   */
  function warmDraw() {
    const restore = [];
    scene.traverse(object => {
      if (!object.visible) { restore.push(() => { object.visible = false; }); object.visible = true; }
      if (object.isInstancedMesh && object.count === 0) {
        restore.push(() => { object.count = 0; });
        object.count = 1;
      }
      const range = object.geometry?.drawRange;
      if (range && range.count === 0) {
        restore.push(() => { range.count = 0; });
        range.count = Infinity;
      }
    });
    const previousTarget = safeCall(() => renderer.getRenderTarget?.()) ?? null;
    try {
      if (bloom && !softwareRenderer) {
        renderer.setRenderTarget?.(bloom.target);
        renderer.render(scene, camera);
      }
      renderer.setRenderTarget?.(null);
      renderer.render(scene, camera);
    } finally {
      safeCall(() => renderer.setRenderTarget?.(previousTarget));
      for (const undo of restore) undo();
    }
  }
  function setLightLevel(level) {
    // İş 12: ışık sayısı kademeden bağımsız (hepsi görünür); ön-derleme yalnız çıktı hedeflerini dolaşır.
    void level;
  }
  function warmStep() {
    const job = warmQueue.shift();
    if (!job || destroyed || contextLost) return;
    if (job.draw) {
      try { warmDraw(); } catch { /* kozmetik */ }
      return;
    }
    if (job.rehearse) {
      try { rehearseFx(); } catch { /* kozmetik */ }
      return;
    }
    const current = effectiveQuality();
    const previousTarget = safeCall(() => renderer.getRenderTarget?.()) ?? null;
    try {
      setLightLevel(job.level);
      safeCall(() => renderer.setRenderTarget?.(job.target));
      if (!softwareRenderer && typeof renderer.compileAsync === 'function') {
        const compilation = renderer.compileAsync(scene, camera);
        pendingCompiles++;
        Promise.resolve(compilation).catch(() => {}).finally(() => { pendingCompiles--; });
      }
      else renderer.compile(scene, camera);
    } catch {
      /* ön-derleme kozmetiktir */
    } finally {
      safeCall(() => renderer.setRenderTarget?.(previousTarget));
      setLightLevel(current);
    }
  }

  // ===================================================================== LOOP

  function renderFrame() {
    if (destroyed || contextLost) return;
    try {
      if (bloomActive()) {
        try {
          bloom.render(scene, camera);
          flushGpu();
          return;
        } catch {
          // A post-process shader or target failure must not black out the arena.
          bloomEnabled = false;
          safeCall(() => bloom.dispose());
        }
      }
      renderer.render(scene, camera);
      flushGpu();
    } catch {
      /* lost context etc. */
    }
  }
  /**
   * İş 12 (kasma kök nedeni): Chrome/ANGLE(D3D11) WebGL komutlarını kare sonunda tek paket olarak
   * GPU sürecine yolluyordu; paket GPU iş parçacığında DOM rasterıyla aynı kuyrukta 1,2–2,6 sn
   * tıkanıyordu (izleme: GpuChannel::ExecuteDeferredRequest › WebGL flush; boş WebGL sayfasında yok,
   * her çizimden sonra flush/finish ile 0). Kare sonunda açık flush — engellemeyen, ucuz.
   */
  function flushGpu() {
    try { renderer.getContext().flush(); } catch { /* yok */ }
  }

  function tick(tNow = now()) {
    if (destroyed) return;
    const rawDt = tNow - lastTime;
    const dtMs = clamp(rawDt, 0, 100);
    lastTime = tNow;
    const dt = dtMs / 1000;
    const t = (tNow - startTime) / 1000;
    if (rawDt > 0) monitorFrame(rawDt); // ham süre: valiye uzun duraklamaları ayırt ettirir
    if (warmQueue.length) warmStep();

    // Re-measure occasionally to catch layout changes ResizeObserver misses.
    if (tNow - layoutState.lastCheck > 500) {
      layoutState.lastCheck = tNow;
      layout(false);
    }

    // Due cues (scheduled reactions such as the ultimate slam impact).
    for (let i = cues.length - 1; i >= 0; i--) {
      if (cues[i].at <= tNow) {
        const [due] = cues.splice(i, 1);
        safeCall(due.fn);
      }
    }

    // Cinematic snapshot for this frame (paket 29).
    impactFeel.flush();
    impactFrame = stepImpact(impactFeel.state, Math.max(0, rawDt) / 1000, tNow, reduced());
    const timeScale = Math.min(timeScaleAt(tNow), impactFrame.timeScale);
    cine.timeScale = timeScale;
    cine.superK = superEnvelope(tNow);
    cine.superSeat = cine.superK > 0 ? superState.seat : null;
    cine.superLight = superState.light;
    cine.sweepK = reduced() ? 0 : sweepAmount(tNow);
    // slow motion: time the simulation does NOT advance. Görev 4: uzun kare (sekme/GPU takılması, dt 100 ms'ye
    // kırpılır) da kayıp sayılır → izler gerçek zamanla sona sıçramaz (ışınlanma yok); kuyruk/mikser ile aynı saat.
    const lostMs = dtMs * (1 - timeScale) + Math.max(0, rawDt - dtMs);
    const frozenFighter = frozenSeat(tNow);

    // Hit-stop: shift every running track forward by the frozen time so poses
    // hold at the impact frame, then resume exactly where they were.
    let frozen = 0;
    if (hitStop.until > hitStop.last) {
      const from = Math.max(hitStop.last, hitStop.start);
      frozen = Math.max(0, Math.min(tNow, hitStop.until) - from);
      hitStop.last = Math.min(tNow, hitStop.until);
    }
    for (const fighter of fighters.values()) {
      // Tracks: hit-stop, slow motion and the super freeze never stack past one frame.
      const shift = fighter.seat === frozenFighter ? dtMs : Math.max(frozen, lostMs);
      if (shift > 0) for (const track of fighter.tracks) track.start += shift;
      if (lostMs > 0) {
        if (fighter.seg) fighter.seg.start += lostMs;
        if (fighter.ko) fighter.ko.start += lostMs;
        if (fighter.victory) fighter.victory.start += lostMs;
        if (fighter.shatter) fighter.shatter.start += lostMs;
        for (const pulse of fighter.bubblePulses) pulse.start += lostMs;
      }
      fighter.clock += fighter.seat === frozenFighter ? 0 : dt * timeScale;
    }
    if (lostMs > 0) {
      if (ult) {
        ult.nextAt += lostMs;
        ult.watchdogAt += lostMs;
      }
      for (const w of floorGlow.waves) if (w.active) w.start += lostMs;
    }

    // Şerit H: görsel kuyruk rig ile AYNI simülasyon dt'sini kullanır (hitstop'ta durur) → temas klip zirvesiyle hizalı.
    timeline.tick(tNow < hitStop.until ? 0 : dtMs * timeScale);
    processUltimate(tNow);
    for (const fighter of fighters.values()) {
      updateTravel(fighter, tNow);
      updateFighter(fighter, fighter.clock, tNow);
    }
    processUltimate(tNow); // segments that just ended may finish the choreography
    updateCritBackdrop(tNow);
    // Paket 32: mixer — slowMo'da yavaşlar, hitStop'ta ve süper donmasında durur.
    updateModels(dt, timeScale, frozenFighter, tNow < hitStop.until);
    // Deliver the queued damage on the same frame that the mixer reaches contact.
    impactFeel.flush();
    if (!timeline.isBusy() && deferredHpSync) {
      forwardToPlugins(deferredHpSync);
      deferredHpSync = null;
    }
    if (animProbe?.on && animProbe.frames.length < animProbe.max) {
      const row = {t: tNow, ts: timeScale, hs: tNow < hitStop.until ? 1 : 0};
      for (const f of fighters.values()) {
        const rg = f.model, st = rg?.stats?.();
        row[`x${f.seat}`] = f.root.position.x + f.actor.position.x * (f.root.scale.x || 1);
        row[`c${f.seat}`] = st?.clip ?? null;
        row[`ct${f.seat}`] = rg?.mixer && rg.anim ? (rg.actions?.[st?.clip]?.time ?? null) : null;
        row[`s${f.seat}`] = st?.state ?? null;
        row[`ats${f.seat}`] = rg?.actions?.[st?.clip]?.getEffectiveTimeScale?.() ?? st?.timeScale ?? null;
      }
      animProbe.frames.push(row);
    }

    // Stage simulation follows the same slow-motion clock as the fighters.
    const quiet = reduced();
    stageTime += dt * api.timeScale();
    activeStage.update(dt * api.timeScale(), stageTime);
    updateAtmosphere(dt, quiet);
    updateFloorGlow(tNow, quiet);

    updateCamera(t, tNow, dt);
    scene.updateMatrixWorld();

    for (const plugin of plugins.slice()) {
      if (typeof plugin.update !== 'function') continue;
      try {
        plugin.update(dt, t);
      } catch (error) {
        reportPluginError(plugin, error);
      }
    }
    for (const fn of [...frameSubs]) {
      try {
        fn(dt, t);
      } catch {
        /* subscriber errors are isolated */
      }
    }
    renderFrame();
  }

  const raf = typeof env?.requestAnimationFrame === 'function' ? env.requestAnimationFrame.bind(env) : null;
  const caf = typeof env?.cancelAnimationFrame === 'function' ? env.cancelAnimationFrame.bind(env) : () => {};

  function loop(timestamp) {
    rafHandle = null;
    if (destroyed) return;
    tick(now());
    schedule();
  }

  function schedule() {
    if (destroyed || !raf || rafHandle !== null || doc.hidden) return;
    rafHandle = raf(loop);
  }

  function stopLoop() {
    if (rafHandle !== null) safeCall(() => caf(rafHandle));
    rafHandle = null;
  }

  const onVisibility = () => {
    if (doc.hidden) { clear(); stopLoop(); }
    else {
      lastTime = now(); // no giant dt after a hidden tab
      governor.reset(); // sekme dönüşündeki takılmalar kaliteyi düşürmesin
      schedule();
    }
  };
  const onResize = () => layout(false);
  const onContextLost = event => {
    safeCall(() => event.preventDefault());
    contextLost = true;
    stopLoop();
    // Kayıp WebGL canvas'ı boş/siyah görünür: geri gelene kadar DOM (2B) arenayı göster.
    safeCall(() => root.classList?.remove?.('pvp26-3d'));
  };
  const onContextRestored = () => {
    contextLost = false;
    safeCall(() => root.classList?.add?.('pvp26-3d'));
    queueWarmup(); // geri gelen bağlamda programlar yeniden derlenir
    layout(true);
    schedule();
  };

  // ============================================================ MOUNT / DESTROY

  let resizeObserver = null;
  function mount() {
    duel.insertBefore?.(canvas, duel.firstChild || null);
    safeCall(() => doc.addEventListener?.('visibilitychange', onVisibility));
    safeCall(() => env?.addEventListener?.('resize', onResize));
    safeCall(() => canvas.addEventListener?.('webglcontextlost', onContextLost));
    safeCall(() => canvas.addEventListener?.('webglcontextrestored', onContextRestored));
    if (typeof env?.ResizeObserver === 'function') {
      try {
        resizeObserver = new env.ResizeObserver(() => layout(false));
        resizeObserver.observe(duel);
        for (const seat of SEATS) {
          const stage = stageOf(seat);
          if (stage) resizeObserver.observe(stage);
        }
      } catch {
        resizeObserver = null;
      }
    }
    applyQuality();
    layout(true);
    scene.updateMatrixWorld(true);
    queueWarmup();
    schedule();
  }

  function destroy() {
    if (destroyed) return;
    timeline.flush();
    impactFeel.clear();
    stopLoop();
    safeCall(() => { if (env?.__tuslabVisualQueue === visualQueueApi) delete env.__tuslabVisualQueue; });
    safeCall(() => { if (env?.__tuslabAnimProbe === animProbe) delete env.__tuslabAnimProbe; });
    for (const plugin of plugins.splice(0)) {
      try {
        plugin.dispose?.();
      } catch {
        /* ignore */
      }
    }
    frameSubs.clear();
    for (const fighter of fighters.values()) {
      fighter.modelToken++;
      detachModel(fighter);
    }
    safeCall(() => skillFx?.dispose());
    skillFx = null;
    if (critBackdrop) safeCall(() => { scene.remove(critBackdrop.mesh); critBackdrop.mesh.geometry.dispose(); critBackdrop.mesh.material.dispose(); });
    critBackdrop = null;
    activeStage.dispose();
    destroyed = true;
    safeCall(() => resizeObserver?.disconnect());
    safeCall(() => doc.removeEventListener?.('visibilitychange', onVisibility));
    safeCall(() => env?.removeEventListener?.('resize', onResize));
    safeCall(() => canvas.removeEventListener?.('webglcontextlost', onContextLost));
    safeCall(() => canvas.removeEventListener?.('webglcontextrestored', onContextRestored));

    // Dispose everything we created, plus anything plugins left in the scene.
    safeCall(() => scene.traverse(object => {
      if (object.isInstancedMesh) safeCall(() => object.dispose()); // instance buffers (crowd, braziers, banners)
      if (object.geometry) owned.geometries.add(object.geometry);
      const list = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
      for (const m of list) owned.materials.add(m);
    }));
    for (const m of owned.materials) {
      for (const key of ['map', 'emissiveMap', 'alphaMap']) if (m[key]?.isTexture) owned.textures.add(m[key]);
    }
    for (const g of owned.geometries) safeCall(() => g.dispose());
    for (const m of owned.materials) safeCall(() => m.dispose());
    for (const t of owned.textures) safeCall(() => t.dispose());
    safeCall(() => bloom?.dispose());
    owned.geometries.clear();
    owned.materials.clear();
    owned.textures.clear();
    safeCall(() => scene.clear());
    safeCall(() => renderer.dispose?.());
    safeCall(() => renderer.forceContextLoss?.());
    safeCall(() => canvas.remove?.() ?? canvas.parentNode?.removeChild?.(canvas));
    safeCall(() => root.classList?.remove?.('pvp26-3d'));
  }

  // Şerit H: görsel kuyruk okuma API'si (raund özeti "kuyruk bitince" açılabilsin).
  //   window.__tuslabVisualQueue.isBusy() / remainingMs() / whenIdle(maxWaitMs) / drain(ms) / snapshot()
  const visualQueueApi = Object.freeze({
    isBusy: () => timeline.isBusy(),
    remainingMs: () => timeline.remainingMs(),
    whenIdle: maxWaitMs => timeline.whenIdle(maxWaitMs),
    drain: ms => drainVisual(ms),
    snapshot: () => timeline.snapshot(),
  });
  safeCall(() => { env.__tuslabVisualQueue = visualQueueApi; });

  // ------------------------------------------------------------- public object
  const arena = {
    available: true,
    canvas,
    handle,
    onMatchEnd,
    resize: () => layout(true),
    setQuality,
    setStage,
    clear,
    destroy,
    registerPlugin,
    api,
    /** Şerit H: görsel kuyruk (isBusy / remainingMs / whenIdle / drain / snapshot). */
    visualQueue: visualQueueApi,
    /** Paket 32: koltuklara karakter ata ({1:'vargr', 2:'doran'}); GLB tembel yüklenir. */
    setFighters,
    /** Resolves true once the rig textures are on the GPU (false on fallback). */
    ready,
    whenWarm,
    /** Test/debug hooks (not part of the plugin contract). */
    _debug: {
      tick,
      layout: () => layout(true),
      fighter: seat => {
        const f = fighters.get(seat);
        const xyz = v => ({x: v.x, y: v.y, z: v.z});
        return f ? {
          tracks: f.tracks.length, ko: Boolean(f.ko), victory: Boolean(f.victory),
          bubble: f.bubble.visible || f.bubblePulses.length > 0 || Boolean(f.shatter),
          pose: f.lastPose && {...f.lastPose},
          home: xyz(f.home), position: xyz(f.root.position), offset: xyz(f.offset),
          spin: f.spin, traveling: Boolean(f.seg),
        } : null;
      },
      ultimate: () => (ult ? {attacker: ult.atk, defender: ult.def, phase: ult.shown, queued: ult.queue.slice(), ending: ult.ending} : null),
      /** KRİTİK arka plan düzlemi: görünür mü, opaklık, dövüşçülerin gerisinde mi (z farkı > 0). */
      crit: () => {
        const b = critBackdrop;
        if (!b || b.seat === null) return null; // ön-ısıtma için yaratıldı ama hiç gösterilmedi
        const zMin = Math.min(...[...fighters.values()].map(f => f.root.position.z));
        return {visible: b.mesh.visible, opacity: b.mesh.material.opacity, seat: b.seat, behind: zMin - b.mesh.position.z, renderOrder: b.mesh.renderOrder, depthTest: b.mesh.material.depthTest};
      },
      showCrit: seat => showCritBackdrop(seat),
      /** Ölçüm: yüzen nesnelerin ve dövüşçülerin ekran (CSS px) konumu. */
      screen: () => {
        if (!renderer || !env3d) return null;
        const r = renderer.domElement.getBoundingClientRect();
        camera.updateMatrixWorld();
        const proj = (v, dy = 0) => {
          const p = v.clone(); p.y += dy; p.project(camera);
          return {x: Math.round(r.left + (p.x + 1) / 2 * r.width), y: Math.round(r.top + (1 - p.y) / 2 * r.height)};
        };
        return {
          floaters: env3d.floaters.map(f => ({...proj(f.object.position), world: [f.object.position.x, f.object.position.y, f.object.position.z].map(n => Math.round(n * 10) / 10)})),
          fighters: [...fighters.entries()].map(([seat, f]) => ({seat, head: proj(f.root.position, 2.2), feet: proj(f.root.position, 0)})),
          // İş 12: modelin ekran kutusu (dünya AABB'sinin 8 köşesinin izdüşümü; CSS px).
          boxes: [...fighters.entries()].filter(([, f]) => f.model?.object).map(([seat, f]) => {
            const box = new THREE.Box3().setFromObject(f.model.object);
            let l = Infinity, t = Infinity, rr = -Infinity, b = -Infinity;
            for (let i = 0; i < 8; i++) {
              const p = new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(camera);
              const x = r.left + (p.x + 1) / 2 * r.width, y = r.top + (1 - p.y) / 2 * r.height;
              l = Math.min(l, x); rr = Math.max(rr, x); t = Math.min(t, y); b = Math.max(b, y);
            }
            return {seat, l: Math.round(l), t: Math.round(t), r: Math.round(rr), b: Math.round(b)};
          }),
        };
      },
      environment: () => {
        const c = env3d?.colosseum;
        if (!c) return {stage: stageId, crowd: 0, braziers: 0, banners: 0, spotlights: 0, lights: 0, embers: 0, excite: 0};
        return {
          crowd: c.crowd.count,
          braziers: c.flames.count,
          banners: c.banners.count,
          spotlights: c.spots.filter(s => s.cone.visible).length,
          lights: c.brazierLights.filter(b => b.on !== false).length,
          embers: c.embers.geometry.drawRange.count,
          excite: c.excite,
        };
      },
      camera: () => ({shakes: shakes.length, kicks: kicks.length, flashes: flashes.length, dolly: dollyState.k, dollySeat: dollyState.seat}),
      hitStop: () => ({...hitStop}),
      impact: () => ({...impactFeel.state}),
      cinematic: () => ({
        superK: cine.superK, superSeat: cine.superSeat, superLight: cine.superLight,
        timeScale: cine.timeScale, sweepK: cine.sweepK,
        frozenSeat: frozenSeat(now()),
        dim: dimQuad.quad.visible ? dimQuad.material.opacity : 0,
        ambient: activeStage.ambient.map(a => a.light.intensity / (a.base || 1)),
        framing: {cam: framing.cam.toArray(), look: framing.look.toArray()},
        waves: floorGlow.waves.filter(w => w.active).length,
        floorGlow: floorGlow.mesh.visible,
        fogPulse: fogPulse.value,
        fov: camera.fov,
      }),
      readyState: () => readyState,
      /** Tanı: ekranda görünen ağların ekran kutuları (ad, x, y, g, y) — "bu şerit ne?" sorusu için. */
      screenMeshes: () => { const out = []; const box = new THREE.Box3(), v = new THREE.Vector3();
        scene.traverse(o => { if (!o.isMesh || !o.visible || !o.geometry) return; let p = o, vis = true; while (p) { if (!p.visible) { vis = false; break; } p = p.parent; } if (!vis) return;
          if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); box.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
          let x0 = 9, x1 = -9, y0 = 9, y1 = -9; for (let i = 0; i < 8; i++) { v.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(camera); if (v.z > 1) return; x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
          const W = layoutState.width, H = layoutState.height; out.push([o.name || o.parent?.name || o.geometry.type, Math.round((x0 + 1) / 2 * W), Math.round((1 - y1) / 2 * H), Math.round((x1 - x0) / 2 * W), Math.round((y1 - y0) / 2 * H), o.material?.color?.getHexString?.() || '', o.material?.opacity ?? 1]); });
        return out; },
      warmup: () => ({queued:warmQueue.length,pendingCompiles,models:[...fighters.values()].map(f=>Boolean(f.modelJob))}),
      models: () => Object.fromEntries(SEATS.map(seat => {
        const f = fighters.get(seat);
        return [seat, {
          fighter: f.fighterId, loaded: Boolean(f.model), loading: Boolean(f.modelJob), failed: Boolean(f.modelFailed),
          variant: f.model?.variant || (f.fighterId ? 'meshy' : null), height: f.model ? f.model.height * f.model.scale : null,
          planeVisible: f.core.mesh.visible, fxQueued: f.fxQueue?.length || 0,
          ...(f.model ? f.model.stats() : {}),
          x: f.root.position.x + f.actor.position.x * (f.root.scale.x || 1),
          z: f.root.position.z + f.actor.position.z * (f.root.scale.z || 1),
          homeX: f.home.x,
        }];
      })),
      skillFx: () => (skillFx ? skillFx.stats() : {live: 0, kinds: []}),
      /** KESINYAP 22 ölçüm: iki dövüşçünün gövde ortası ekranda mı (NDC x,y; |x|≤1 kadrajda). */
      onScreen: () => SEATS.map(seat => { const v = new THREE.Vector3(); fighters.get(seat).actor.getWorldPosition(v); v.y += 1.2; v.project(camera); return [Math.round(v.x * 100) / 100, Math.round(v.y * 100) / 100]; }),
      /** Ölçüm (kasma tanısı): kalite kademesi + çizim yükü. */
      perf: () => ({gov: governor.last, step: autoStep(), quality: effectiveQuality(), bloom: bloomActive(), ratio: safeCall(() => renderer.getPixelRatio?.()) ?? null,
        w: layoutState.width, h: layoutState.height, calls: renderer.info?.render?.calls ?? null, tris: renderer.info?.render?.triangles ?? null,
        programs: renderer.info?.programs?.length ?? null, textures: renderer.info?.memory?.textures ?? null, geometries: renderer.info?.memory?.geometries ?? null}),
      /** İş 12 (kasma tanısı): görünür ışık sayıları (sayı değişirse tüm programlar yeniden derlenir) + sis. */
      lights: () => { const c = {}; scene.traverseVisible(o => { if (o.isLight) c[o.type] = (c[o.type] || 0) + 1; }); return `${Object.entries(c).map(([k, v]) => k.replace('Light', '') + v).join(' ')} fog${scene.fog ? 1 : 0}`; },
      /** İş 12 (kasma tanısı): bağlı programların adları — dövüş ortasında yeni program derlenip derlenmediği. */
      programs: (full = false) => (renderer.info?.programs || []).map(p => full ? String(p.cacheKey || '') : `${p.name || '?'}#${String(p.cacheKey || '').length}:${String(p.cacheKey || '').slice(0, 60)}`),
      /** Zincir planı tanısı (oynatmaz): koltuğun rig'i bu becerilerden kombo kurabiliyor mu? */
      chainPlan: (seat, skills) => fighters.get(seat)?.model?.chainPlan?.(skills) || null,
      plugins: () => plugins.length,
    },
  };

  mount();
  return arena;
}
