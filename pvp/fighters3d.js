/**
 * TuşLab PvP / paket 32 — 3B rig'li dövüşçüler (karakter motoru).
 * ================================================================
 *
 * arena3d.js'in düz (2.5D) rig düzlemlerinin yerine, assets/characters/<id>.glb'deki
 * kemikli, animasyonlu modeli koyar. Tamamen kozmetiktir (HP/hasar sunucudadır).
 *
 *   const asset = await loadFighterAsset(THREE, url);           // GLTFLoader, url başına önbellekli
 *   const rig = createFighterRig(THREE, asset, {fighterId, seat, clone}); // SkeletonUtils.clone
 *   actor.add(rig.object); rig.play('q'); rig.update(dt);
 *   // kısayol (brief sözleşmesi): loadFighter(THREE, url) → {scene, mixer, actions, bones}
 *
 * Koreografi tablosu (CHOREOGRAPHY) her savaşçının Q/E/R becerisi için: klip adımları,
 * kök hareketi (ileri atılma / geri sekme / zıplama / kendi ekseninde dönüş), vuruş anı (ms)
 * ve efekti (mermi, sütun, meteor, kalkan kırılması, girdap) tanımlar. Klip adları
 * pvp/shared/fighters.js'teki skills.clip/clips alanlarından okunur; yoksa tablo varsayılanı.
 *
 * Bağımlılık: yalnız enjekte edilen THREE (testlerde sahte THREE kullanılabilir). Vendor
 * GLTFLoader / SkeletonUtils dinamik import edilir (CSP: yalnız 'self').
 */
import {FIGHTERS, FIGHTER_IDS, SHARED_CLIPS} from './shared/fighters.js';

export const FIGHTER_MODEL_BASE = './assets/characters/';
export const modelUrl = (fighterId, base = FIGHTER_MODEL_BASE) => `${base}${fighterId}.glb`;

// ------------------------------------------------------------------ model varyantları (paket 23)

/**
 * Karakter başına model varyantları. Yalnız Vargr'un ikinci modeli var:
 *   'eski'  → KayKit GLB (assets/characters/vargr.glb; diğer karakterlerin tek yolu)
 *   'meshy' → Meshy AI üretimi model (assets/models/vargr/vargr.glb) — varsayılan
 * Varyant tablosu klip eşlemesini, kemik adlarını ve ölçülen vuruş karelerini
 * (peakMs) tutar; CHOREOGRAPHY'nin hitMs/motion/fx sabitleri DEĞİŞMEZ.
 */
export const MODEL_VARIANTS = Object.freeze({
  vargr: Object.freeze({
    meshy: Object.freeze({
      url: './assets/models/vargr/vargr.glb',
      /**
       * Ölçek kalibrasyonu (paket 23). KayKit iskeletinde baş kemiği boyun hizasında
       * ve bind bbox (kalkan/balta dahil) ≈ baş × 1,93 olduğu için genel katsayı
       * headToHeight 1,95 KayKit'te görünen boyu 2,68'e taşır. Meshy iskeletinde
       * 'Head' kemiği yine boyun hizasında ama bind bbox yalnız baş × 1,244
       * (1,80 ham birim; ayaklar 0, tepe 1,80): aynı 1,95 katsayısı modeli %36
       * küçük gösterirdi (1,71 birim). Kalibrasyon: İKİ modelin de KENDİ idle
       * klibindeki skinned-mesh görünür yüksekliği eşitlendi —
       *   KayKit 2H_Melee_Idle: ham 2,358 × ölçek 1,1071 = 2,610 görünür birim
       *   Meshy Combat_Stance: ham 1,678 × ölçek 1,5560 = 2,610 görünür birim
       * → headToHeight = 2,68 / (1,5560 × baş 1,4470) = 1,19.
       */
      headToHeight: 1.19,
      /**
       * Zemin ofseti (ham birim): Meshy Combat_Stance/parry/isabet pozlarında mesh
       * alt kenarı -0,058'e gömülür (animasyon yazarı zemini bind zemininin ~6 cm
       * altına koymuş). +0,058 kaydırma idle ayağını tam y=0'a oturtur; şarj
       * çömelmesi/KO yatışı gibi derin pozlar oransal olarak aynı görece derinlikte
       * kalır (yerçekimi/yere gömülme etkisi oyunlarda alışıldık).
       */
      groundOffsetY: 0.058,
      /** Durum klipleri (STATE_CLIPS karşılığı; global tabloya dokunulmaz). */
      clips: Object.freeze({
        idle: 'Combat_Stance',
        idleHeavy: 'Combat_Stance',
        block: 'Two_Handed_Parry',
        blockHit: 'Two_Handed_Parry',
        hit: Object.freeze(['Hit_Reaction']),
        ko: 'Knock_Down',
        win: 'Victory_Cheer',
      }),
      /**
       * Saldırı klipleri + ölçülen vuruş karesi (peakMs): her saldırı klibinde
       * RightHand kemiğinin dünya hızının zirve yaptığı an (ham GLB üzerinden
       * 120 Hz örneklem; three.js FK analizi). Oynatmada klibin başlangıç ofseti
       * öyle seçilir ki peakMs, koreografinin hitMs anına denk gelsin:
       *   q Attack           peak 1060 ms ← hitMs 650                → ofset 410 ms
       *   e Axe_Spin_Attack  peak  900 ms ← hitMs 520                → ofset 380 ms
       *   r Charged_Axe_Chop peak 4375 ms ← ulti 3. evre teması 1310 → ofset 3065 ms
       * r.contactMs türetimi (görsel hizalama notu): sunucu evre ofsetleri
       * (fire 250/430/670 — pvp/shared/match.js ULTIMATE_PHASES + SHIELD_WINDOW_MS)
       * ve arena3d ULTIMATE_TIMING zinciri (pull 340 + strike 160 + throw 560)
       * → 3. evre (son/büyük) teması ≈ 250+340+160+560 = 1310 ms. r.endMs: iniş
       * sonrası kısa toparlanma; klip 7,67 s'nin gerisi donuk bekleyiştir.
       */
      skills: Object.freeze({
        q: Object.freeze({clip: 'Attack', peakMs: 1060}),
        e: Object.freeze({clip: 'Axe_Spin_Attack', peakMs: 900}),
        r: Object.freeze({clip: 'Charged_Axe_Chop', peakMs: 4375, contactMs: 1310, endMs: 5400}),
      }),
    }),
  }),
});

/** Varyant seçimi: saf fonksiyon (localStorage/location yoksa hata vermez, test edilebilir).
 *  Vargr varsayılan 'meshy'; ?vargr=eski URL'yi ya da localStorage['tuslab:vargr-model']==='eski'
 *  eski KayKit modeline döndürür. Diğer karakterler etkilenmez ('eski'). */
export function fighterModelVariant(fighterId, env = globalThis) {
  if (fighterId !== 'vargr' || !MODEL_VARIANTS.vargr?.meshy) return 'eski';
  try {
    const search = String(env?.location?.search || '');
    if (/(?:^|[?&])vargr=eski(?=&|$)/.test(search)) return 'eski';
  } catch { /* location erişimi yok */ }
  try {
    if (env?.localStorage?.getItem?.('tuslab:vargr-model') === 'eski') return 'eski';
  } catch { /* localStorage erişimi yok */ }
  return 'meshy';
}

/** Varyantın model URL'si: meshy → assets/models/vargr/vargr.glb, diğerleri modelUrl(). */
export function fighterModelUrl(fighterId, env = globalThis, base = FIGHTER_MODEL_BASE) {
  const variant = fighterModelVariant(fighterId, env);
  return MODEL_VARIANTS[fighterId]?.[variant]?.url || modelUrl(fighterId, base);
}

/** Varyant tablosunun beklediği kliplerden asset'te eksik olanlar (boşsa varyant kullanılabilir). */
export function variantMissingClips(clips, variant) {
  const names = new Set((clips || []).map(c => c?.name).filter(Boolean));
  const want = [];
  for (const value of Object.values(variant?.clips || {})) {
    if (Array.isArray(value)) want.push(...value);
    else if (typeof value === 'string') want.push(value);
  }
  for (const s of Object.values(variant?.skills || {})) if (typeof s?.clip === 'string') want.push(s.clip);
  return [...new Set(want)].filter(name => !names.has(name));
}

const variantFallbackWarned = new Set();

/**
 * Karakterin modelini varyantına göre yükler (paket 23). Meshy GLB yüklenemez ya
 * da beklenen klipleri içermiyorsa OTOMATİK eski KayKit modeline düşer (konsola
 * karakter+varyant başına tek uyarı). Diğer karakterler için modelUrl() ile aynı.
 */
export async function loadFighterModel(THREE, fighterId, {env = globalThis, base = FIGHTER_MODEL_BASE, loader = null} = {}) {
  const variant = fighterModelVariant(fighterId, env);
  const spec = MODEL_VARIANTS[fighterId]?.[variant] || null;
  if (spec) {
    try {
      const asset = await loadFighterAsset(THREE, spec.url, {loader});
      const missing = variantMissingClips(asset?.clips, spec);
      if (missing.length) throw new Error(`eksik klipler: ${missing.join(', ')}`);
      asset.variant = variant;
      return asset;
    } catch (error) {
      const key = `${fighterId}:${variant}`;
      if (!variantFallbackWarned.has(key)) {
        variantFallbackWarned.add(key);
        try { globalThis.console?.warn?.(`[fighters3d] ${fighterId} "${variant}" modeli yüklenemedi (${error?.message || error}); eski modele dönülüyor.`); } catch { /* konsol yok */ }
      }
    }
  }
  return loadFighterAsset(THREE, modelUrl(fighterId, base), {loader});
}

/** Görünüm: koltuk yönüne bakan yarı profil; kameraya hafif dönük. */
export const MODEL_VIEW = Object.freeze({
  yawToCamera: 0.5,   // rad: tam profilden (π/2) kameraya doğru dönüş
  heightUnits: 2.68,  // gövde-yerel hedef boy = rig düzleminin görünen boyu (≈ 2.67), şapkasız
  headToHeight: 1.95, // KayKit iskeleti: baş kemiği y × 1.95 ≈ şapkasız boy
  // Uzun şapkalı karakter (nyx) HP satırına yaklaşmasın: şapka ucu dahil boy ≈ diğerleri.
  fighterScale: Object.freeze({nyx: 0.93}),
  tiltScale: 0.3,     // düzlem pozunun eğimi modele bu oranda uygulanır (klip baskın)
  squashScale: 0.25,
  fadeMs: 140,        // klip geçişi (crossFade)
  emissive: 0.16,     // karanlık arenada okunurluk için doku emisyonu
});

/** Ortak durum klipleri (KO/zafer/isabet/savunma/bekleme). */
export const STATE_CLIPS = Object.freeze({
  idle: 'Idle',
  idleHeavy: '2H_Melee_Idle',
  block: SHARED_CLIPS?.block || 'Blocking',
  blockHit: SHARED_CLIPS?.blockHit || 'Block_Hit',
  hit: Object.freeze(['Hit_A', 'Hit_B']),
  ko: SHARED_CLIPS?.ko || 'Death_A',
  win: SHARED_CLIPS?.win || 'Cheer',
});

/** Palet (shared/fighters.js yoksa): ana ve vurgu rengi. */
const PALETTE_FALLBACK = Object.freeze({
  vargr: {main: 0xff5a24, accent: 0xffb347},
  sira: {main: 0x9a4dff, accent: 0xd9a6ff},
  doran: {main: 0x4f8fd6, accent: 0xcfe3ff},
  nyx: {main: 0x22d6e8, accent: 0x9bf6ff},
});

/**
 * Koreografi tablosu (zaman ms, mesafe gövde birimi; + ileri = rakibe doğru).
 *   steps:  [{clip, at, speed?}]   — aynı beceri içinde art arda klipler
 *   motion: {dash, dashAt, dashMs, back, backAt, backMs, jump, jumpAt, jumpMs, spins, spinAt, spinMs}
 *   hitMs:  görsel vuruş anı (efekt/mermi varışı)
 *   fx:     [{kind, at, flight?, from?}] — 'spear'|'dagger'|'rune'|'meteor'|'column'|'shards'|'swirl'|'slam'
 */
export const CHOREOGRAPHY = Object.freeze({
  vargr: Object.freeze({
    idle: '2H_Melee_Idle',
    q: {steps: [{clip: '2H_Melee_Attack_Chop', at: 0, speed: 1.15}], hitMs: 650,
      motion: {dash: 1.0, dashAt: 120, dashMs: 420, back: 1.0, backAt: 820, backMs: 380},
      fx: [{kind: 'slam', at: 650}]},
    e: {steps: [{clip: '2H_Melee_Attack_Spin', at: 0, speed: 1.0}], hitMs: 520,
      motion: {dash: 1.3, dashAt: 40, dashMs: 420, spins: 2, spinAt: 120, spinMs: 760, back: 1.3, backAt: 900, backMs: 380},
      fx: [{kind: 'swirl', at: 120, ms: 780}]},
    r: {steps: [{clip: 'Jump_Start', at: 0, speed: 1.2}, {clip: '2H_Melee_Attack_Spinning', at: 240}, {clip: 'Jump_Land', at: 1050}], hitMs: 700,
      motion: {jump: 0.9, jumpAt: 120, jumpMs: 900, spins: 3, spinAt: 260, spinMs: 820},
      fx: [{kind: 'swirl', at: 240, ms: 820}, {kind: 'slam', at: 1050}]},
  }),
  sira: Object.freeze({
    idle: 'Idle',
    // Throw klibi: sağ el 0.6–0.7 sn'de tepede (bırakma anı) → hız 1.1 ile ≈ 620 ms.
    q: {steps: [{clip: 'Throw', at: 0, speed: 1.1}], hitMs: 880,
      motion: {back: -0.25, backAt: 0, backMs: 260},
      fx: [{kind: 'spear', at: 620, flight: 260, from: 'handslot.r'}]},
    e: {steps: [{clip: 'Dodge_Forward', at: 0, speed: 1.3}, {clip: 'Dualwield_Melee_Attack_Stab', at: 300, speed: 1.15}], hitMs: 700,
      motion: {dash: 1.7, dashAt: 0, dashMs: 320, back: 1.7, backAt: 1050, backMs: 420},
      fx: [{kind: 'slam', at: 700, power: 0.5}]},
    r: {steps: [{clip: 'Dodge_Left', at: 0, speed: 1.3}, {clip: 'Throw', at: 220, speed: 2}, {clip: 'Throw', at: 600, speed: 2}, {clip: 'Throw', at: 980, speed: 2}], hitMs: 790,
      motion: {back: -0.6, backAt: 0, backMs: 240},
      fx: [
        {kind: 'dagger', at: 570, flight: 220, from: 'handslot.r'},
        {kind: 'dagger', at: 950, flight: 220, from: 'handslot.r'},
        {kind: 'spear', at: 1330, flight: 220, from: 'handslot.r'},
      ]},
  }),
  doran: Object.freeze({
    idle: 'Idle',
    q: {steps: [{clip: '1H_Melee_Attack_Chop', at: 0, speed: 1.1}], hitMs: 550,
      motion: {dash: 0.8, dashAt: 80, dashMs: 380, back: 0.8, backAt: 760, backMs: 340},
      fx: [{kind: 'slam', at: 550, power: 0.45}]},
    // Block_Attack: kalkan 0.4–0.5 sn'de en önde → ≈ 480 ms'de rakibin kalkanı kırılır.
    e: {steps: [{clip: 'Block_Attack', at: 0, speed: 1.05}], hitMs: 480,
      motion: {dash: 1.4, dashAt: 160, dashMs: 300, back: 1.4, backAt: 860, backMs: 380},
      fx: [{kind: 'shards', at: 480, target: true}]},
    r: {steps: [{clip: 'Jump_Start', at: 0, speed: 1.2}, {clip: 'Jump_Land', at: 520}, {clip: '1H_Melee_Attack_Slice_Horizontal', at: 760, speed: 1.15}], hitMs: 560,
      motion: {jump: 1.2, jumpAt: 80, jumpMs: 480, dash: 0.8, dashAt: 80, dashMs: 460, back: 0.8, backAt: 1250, backMs: 380},
      fx: [{kind: 'slam', at: 560}]},
  }),
  nyx: Object.freeze({
    idle: 'Idle',
    q: {steps: [{clip: 'Spellcast_Shoot', at: 0, speed: 1.1}], hitMs: 540,
      motion: {back: -0.15, backAt: 0, backMs: 200},
      fx: [{kind: 'rune', at: 240, flight: 300, from: 'handslot.r'}]},
    e: {steps: [{clip: 'Spellcast_Raise', at: 0, speed: 1.05}], hitMs: 560,
      motion: {},
      fx: [{kind: 'column', at: 420, target: true, ms: 900}]},
    r: {steps: [{clip: 'Spellcast_Long', at: 0, speed: 1.15}], hitMs: 900,
      motion: {jump: 0.25, jumpAt: 200, jumpMs: 700},
      fx: [{kind: 'meteor', at: 380, flight: 520, target: true}]},
  }),
});

const SKILLS = ['q', 'e', 'r'];

/**
 * Bir savaşçının çözümlenmiş koreografisi: tablo + shared/fighters.js klip adları.
 * shared'de `clips` (çok adımlı) varsa adımların klipleri sırayla onlardan alınır,
 * yoksa `clip` tek/son adımın klibi olur.
 */
export function resolveChoreography(fighterId, roster = FIGHTERS) {
  const base = CHOREOGRAPHY[fighterId] || CHOREOGRAPHY.vargr;
  const data = roster?.[fighterId];
  const out = {idle: base.idle};
  for (const skill of SKILLS) {
    const spec = base[skill];
    const steps = spec.steps.map(s => ({...s}));
    const shared = data?.skills?.[skill];
    if (Array.isArray(shared?.clips) && shared.clips.length === steps.length) {
      shared.clips.forEach((clip, i) => { if (typeof clip === 'string') steps[i].clip = clip; });
    } else if (typeof shared?.clip === 'string' && steps.length === 1) {
      steps[0].clip = shared.clip;
    }
    out[skill] = {...spec, steps, motion: {...spec.motion}, fx: spec.fx.map(f => ({...f}))};
  }
  return out;
}

/** Palet: shared/fighters.js palette{main,accent} (sayı ya da '#rrggbb'), yoksa yedek. */
export function fighterPalette(fighterId, roster = FIGHTERS) {
  const toHex = v => (typeof v === 'number' ? v : typeof v === 'string' && /^#?[0-9a-f]{6}$/i.test(v) ? parseInt(v.replace('#', ''), 16) : null);
  const p = roster?.[fighterId]?.palette;
  const fb = PALETTE_FALLBACK[fighterId] || PALETTE_FALLBACK.vargr;
  return {main: toHex(p?.main) ?? fb.main, accent: toHex(p?.accent) ?? fb.accent};
}

export const KNOWN_FIGHTERS = Object.freeze([...(FIGHTER_IDS?.length ? FIGHTER_IDS : Object.keys(CHOREOGRAPHY))]);
export const isKnownFighter = id => typeof id === 'string' && KNOWN_FIGHTERS.includes(id) && Boolean(CHOREOGRAPHY[id]);

// ------------------------------------------------------------------ root motion

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const easeOutCubic = k => 1 - Math.pow(1 - k, 3);
const easeInOutSine = k => -(Math.cos(Math.PI * k) - 1) / 2;
const window01 = (ms, at, dur) => clamp((ms - (at || 0)) / Math.max(1, dur || 1), 0, 1);

/** Beceri süresi (ms): son adım + kök hareketi + efekt sonu, en az 700. */
export function skillDuration(spec) {
  const m = spec.motion || {};
  const ends = [700, (spec.hitMs || 0) + 300];
  for (const s of spec.steps) ends.push((s.at || 0) + 600);
  if (m.dashMs) ends.push((m.dashAt || 0) + m.dashMs);
  if (m.backMs) ends.push((m.backAt || 0) + m.backMs);
  if (m.jumpMs) ends.push((m.jumpAt || 0) + m.jumpMs);
  if (m.spinMs) ends.push((m.spinAt || 0) + m.spinMs);
  for (const f of spec.fx || []) ends.push((f.at || 0) + (f.flight || 0) + 100);
  return Math.max(...ends);
}

/**
 * Kök hareketi (ms → {fwd, lift, yaw}). fwd gövde birimi (+ rakibe doğru), lift gövde birimi,
 * yaw radyan (kendi ekseninde dönüş, savaşçının yönüne göre işaretlenir).
 *   dash: ileri atılma (dash > 0) — back: geri dönüş (back > 0 → atılmanın geri alınması;
 *   back < 0 → yerinden geri sekme, sonra kendiliğinden toparlanma).
 */
export function rootMotionAt(spec, ms) {
  const m = spec?.motion || {};
  let fwd = 0, lift = 0, yaw = 0;
  if (m.dash) fwd += m.dash * easeOutCubic(window01(ms, m.dashAt, m.dashMs));
  if (m.back > 0) fwd -= m.back * easeInOutSine(window01(ms, m.backAt, m.backMs));
  else if (m.back < 0) {
    const out = easeOutCubic(window01(ms, m.backAt, m.backMs));
    const recover = easeInOutSine(window01(ms, (m.backAt || 0) + (m.backMs || 0) + 250, 420));
    fwd += m.back * out * (1 - recover);
  }
  if (m.jump) lift += m.jump * Math.sin(Math.PI * window01(ms, m.jumpAt, m.jumpMs));
  if (m.spins) yaw += Math.PI * 2 * m.spins * easeInOutSine(window01(ms, m.spinAt, m.spinMs));
  return {fwd, lift, yaw};
}

// ------------------------------------------------------------------ loading

const assetCache = new Map(); // url → Promise<{gltf, clips}>

/** GLB'yi yükler (url başına bir kez). loader: {loadAsync(url)} enjekte edilebilir. */
/** Paket 33 (netlik): atlas dokuları eğik açılarda bulanıklaşmasın (anizotropik + trilinear mipmap). */
export const MODEL_ANISOTROPY = 8;
export function sharpenTextures(THREE, root) {
  root?.traverse?.(o => {
    const list = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of list) {
      for (const key of ['map', 'emissiveMap']) {
        const t = m?.[key];
        if (!t?.isTexture) continue;
        t.anisotropy = Math.max(t.anisotropy || 1, MODEL_ANISOTROPY); // renderer donanım sınırına kırpar
        if (THREE?.LinearMipmapLinearFilter) t.minFilter = THREE.LinearMipmapLinearFilter;
        if (THREE?.LinearFilter) t.magFilter = THREE.LinearFilter;
        t.needsUpdate = true;
      }
    }
  });
}

export function loadFighterAsset(THREE, url, {loader = null} = {}) {
  if (!loader && assetCache.has(url)) return assetCache.get(url);
  const job = (async () => {
    let l = loader;
    if (!l) {
      const {GLTFLoader} = await import('./vendor/GLTFLoader.js');
      l = new GLTFLoader();
    }
    const gltf = await l.loadAsync(url);
    if (!gltf?.scene) throw new Error('model yok');
    sharpenTextures(THREE, gltf.scene);
    return {gltf, clips: gltf.animations || [], url};
  })();
  if (!loader) {
    assetCache.set(url, job);
    job.catch(() => assetCache.delete(url)); // başarısız yük tekrar denenebilsin
  }
  return job;
}

/** Önbelleği boşalt (test/temizlik). Paylaşılan geometri/dokular yalnız açıkça istenirse dispose edilir. */
export async function clearFighterAssetCache({dispose = false} = {}) {
  const jobs = [...assetCache.values()];
  assetCache.clear();
  if (!dispose) return;
  for (const job of jobs) {
    try {
      const {gltf} = await job;
      gltf.scene.traverse(o => {
        o.geometry?.dispose?.();
        const list = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        for (const m of list) { m.map?.dispose?.(); m.dispose?.(); }
      });
    } catch { /* başarısız yük */ }
  }
}

let skeletonClone = null;
async function defaultClone() {
  if (!skeletonClone) skeletonClone = (await import('./vendor/SkeletonUtils.js')).clone;
  return skeletonClone;
}

/** Brief sözleşmesi: yükle + klonla → {scene, mixer, actions, bones, rig}. */
export async function loadFighter(THREE, url, {fighterId = 'vargr', seat = 1, loader = null, clone = null} = {}) {
  const asset = await loadFighterAsset(THREE, url, {loader});
  const rig = createFighterRig(THREE, asset, {fighterId, seat, clone: clone || await defaultClone()});
  return {scene: rig.model, mixer: rig.mixer, actions: rig.actions, bones: rig.bones, rig};
}

// --------------------------------------------------------------------- rig

/**
 * Mantıksal kemik adları → adaylar. KayKit ('handslot.r', 'head'...) ve Meshy
 * ('RightHand', 'Head', 'Spine01') iskeletlerini aynı anahtarlarla çözer:
 * projektil/efekt çıkış noktası (handslot.r) ve boy ölçümü (head) bozulmaz.
 */
const BONE_ALIASES = Object.freeze({
  'handslot.r': Object.freeze(['handslot.r', 'hand.r', 'RightHand']),
  'handslot.l': Object.freeze(['handslot.l', 'hand.l', 'LeftHand']),
  head: Object.freeze(['head', 'Head']),
  chest: Object.freeze(['chest', 'Spine01', 'Spine']),
  hips: Object.freeze(['hips', 'Hips']),
  root: Object.freeze(['root']),
});

/**
 * Bir savaşçı modeli örneği. object = yön/ölçek grubu (actor'a eklenir), model = klon.
 * opts.ghost: {color, opacity} → yarı saydam, tek renk siluet (partner desteği).
 */
export function createFighterRig(THREE, asset, {
  fighterId = 'vargr', seat = 1, clone = null, ghost = null, roster = FIGHTERS, view = MODEL_VIEW, variant = null,
} = {}) {
  if (!asset?.gltf?.scene) throw new TypeError('fighters3d: asset.gltf.scene gerekli');
  const face = seat === 2 ? -1 : 1;
  const choreo = resolveChoreography(fighterId, roster);
  const palette = fighterPalette(fighterId, roster);
  // Model varyantı (paket 23): asset'e etiketlenmiş (loadFighterModel) ya da açıkça
  // seçilmiş varyant. Beklenen klipler asset'te yoksa sessizce varsayılan tabloya
  // dön (yükleyici enjeksiyonu testlerde KayKit varlığı döndürebilir).
  const variantName = typeof variant === 'string' ? variant : asset?.variant;
  const variantSpec = variantName && MODEL_VARIANTS[fighterId]?.[variantName] || null;
  const variantReady = variantSpec && variantMissingClips(asset.clips, variantSpec).length === 0 ? variantSpec : null;
  const stateClips = variantReady?.clips || STATE_CLIPS;
  const source = asset.gltf.scene;
  const model = typeof clone === 'function' ? clone(source) : source.clone(true);
  model.name = `pvp32-model-${fighterId}-${seat}${ghost ? '-ghost' : ''}`;

  // Malzemeler örnek başına kopyalanır (koltuk tonu/flaş bağımsız); geometri/doku paylaşılır.
  const materials = [];
  const ownMaterials = new Set();
  model.traverse(o => {
    if (!o.isMesh && !o.isSkinnedMesh) return;
    o.frustumCulled = false; // iskelet animasyonu bind-pose kutusunun dışına taşar
    const list = Array.isArray(o.material) ? o.material : [o.material];
    const next = list.map(m => {
      let copy;
      if (ghost) {
        copy = new THREE.MeshBasicMaterial({
          color: ghost.color ?? palette.main, transparent: true, opacity: ghost.opacity ?? 0.55,
          depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
        });
        if (m?.map) copy.map = m.map;
      } else {
        copy = m?.clone ? m.clone() : new THREE.MeshStandardMaterial();
        if (copy.map && 'emissiveMap' in copy) {
          copy.emissiveMap = copy.map;
          copy.emissive?.setRGB?.(1, 1, 1);
          copy.emissiveIntensity = view.emissive;
        }
        if ('roughness' in copy) copy.roughness = 0.62;
      }
      ownMaterials.add(copy);
      materials.push(copy);
      return copy;
    });
    o.material = Array.isArray(o.material) ? next : next[0];
    if (!ghost) { o.castShadow = false; o.receiveShadow = false; }
  });

  // Ölçek: dört karakter AYNI iskeleti paylaşır → gövde ölçüsü baş kemiği yüksekliğinden
  // (şapka/miğfer boyu değiştirmesin). Baş kemiği yoksa kutu yüksekliği; ayaklar y=0.
  // 'Head' (Meshy) da tanınır: dünya matrisleri güncellendikten sonra ölçülür, kök
  // Armature'in 0,01 ölçeği dünya konumunda zaten içindedir. Varyant katsayısı
  // (meshy headToHeight 1,19) model başına kalibre edilir: genel 1,95 KayKit iskeletine
  // göre ayarlanmıştır, meshy'de modeli %36 küçük gösterirdi (MODEL_VARIANTS notuna bak).
  let height = 1;
  let minY = 0;
  try {
    let headY = 0;
    model.updateMatrixWorld?.(true);
    model.traverse(o => { if (typeof o.name === 'string' && o.name.toLowerCase() === 'head' && !headY && o.getWorldPosition) headY = o.getWorldPosition(new THREE.Vector3()).y; });
    if (headY > 0.1) height = headY * (variantReady?.headToHeight ?? view.headToHeight);
    else {
      const box = new THREE.Box3().setFromObject(model);
      if (Number.isFinite(box.max.y - box.min.y) && box.max.y - box.min.y > 0.05) {
        height = box.max.y - box.min.y;
        minY = box.min.y;
      }
    }
  } catch { /* sahte THREE */ }
  const scale = (view.heightUnits / height) * (view.fighterScale?.[fighterId] ?? 1);
  const object = new THREE.Group();
  object.name = `pvp32-fighter-${seat}`;
  const yawGroup = new THREE.Group(); // kendi ekseninde dönüş (vargr E) burada
  object.add(yawGroup);
  yawGroup.add(model);
  model.scale.setScalar(scale);
  // Zemin: kutu yolu bbox tabanını (minY) y=0'a taşır; varyant yolu animasyon kaynaklı
  // sistematik zemine gömülmeyi (meshy duruşu -0,058) kalibre offset ile düzeltir.
  model.position.y = ((variantReady?.groundOffsetY) ?? -minY) * scale;
  const baseYaw = face * (Math.PI / 2 - view.yawToCamera);
  yawGroup.rotation.y = baseYaw;

  const bones = {};
  // GLTFLoader düğüm adlarını temizler ('handslot.r' → 'handslotr'); büyük/küçük
  // harf duyarsız eşleştirme Meshy adlarını (RightHand/Head/Spine01) da çözer.
  const boneKey = name => String(name).replace(/[[\].:/]/g, '').toLowerCase();
  model.traverse(o => {
    if (typeof o.name !== 'string' || !o.name) return;
    const key = boneKey(o.name);
    for (const [logical, candidates] of Object.entries(BONE_ALIASES)) {
      if (bones[logical]) continue;
      if (candidates.some(c => boneKey(c) === key)) bones[logical] = o;
    }
  });

  const mixer = new THREE.AnimationMixer(model);
  const clipByName = new Map((asset.clips || []).map(c => [c.name, c]));
  const actions = {};
  const action = name => {
    if (actions[name]) return actions[name];
    const clip = clipByName.get(name);
    if (!clip) return null;
    actions[name] = mixer.clipAction(clip);
    return actions[name];
  };

  const idleName = variantReady?.clips?.idle || choreo.idle;
  const idleClip = clipByName.has(idleName) ? idleName : clipByName.has('Idle') ? 'Idle' : [...clipByName.keys()][0];
  const state = {
    name: 'idle', clip: null, current: null, queue: [], elapsed: 0, timeScale: 1, paused: false,
    yaw: 0, hits: 0, disposed: false, plays: 0, endMs: 0,
  };

  /**
   * Varyant saldırı adımları (paket 23): tek klip + temas hizalaması. Klibin
   * ölçülen vuruş karesi (peakMs), koreografinin hitMs anına (ulti r'de 3. evre
   * temasına, contactMs) denk gelsin:
   *   peakMs hedeften geçse → klibi içeriden başlat (ofset = peakMs − hedef),
   *   peakMs hedeften erkense → timeScale'i düşür (peak tam hedef anında).
   * Böylece impact-feel hitstop/sarsıntısı tam vuruş karesinde olur; oyunun
   * zamanlama sabitleri (hitMs/motion/fx) değişmez.
   */
  const variantSteps = {};
  if (variantReady) {
    for (const skill of SKILLS) {
      const spec = variantReady.skills?.[skill];
      if (!spec || !clipByName.has(spec.clip)) continue;
      const target = spec.contactMs || choreo[skill].hitMs || 0;
      const peak = Math.max(0, Number(spec.peakMs) || 0);
      const durationMs = (clipByName.get(spec.clip)?.duration || 0) * 1000;
      let offsetMs = peak - target;
      let speed = 1;
      if (offsetMs < 0) {
        speed = clamp(peak / Math.max(1, target), 0.5, 1);
        offsetMs = 0;
      }
      variantSteps[skill] = [{
        clip: spec.clip, at: 0, speed,
        offset: clamp(offsetMs / 1000, 0, Math.max(0, durationMs / 1000 - 0.05)),
        endMs: Math.min(spec.endMs || durationMs, durationMs),
      }];
    }
  }

  function fadeTo(name, {loop = false, speed = 1, clamp: clampEnd = !loop, fade = view.fadeMs, offset = 0, endMs = 0} = {}) {
    const next = action(name);
    if (!next) return false;
    const prev = state.current;
    next.enabled = true;
    next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    next.clampWhenFinished = clampEnd;
    next.setEffectiveTimeScale?.(speed);
    next.setEffectiveWeight?.(1);
    next.reset();
    next.play();
    if (offset > 0) next.time = Math.min(offset, Math.max(0, (next.getClip?.()?.duration || 0) - 1e-3));
    state.endMs = endMs || 0;
    if (prev && prev !== next) prev.crossFadeTo?.(next, fade / 1000, false);
    state.current = next;
    state.clip = name;
    return true;
  }

  function goIdle(fade) {
    state.name = 'idle';
    state.queue.length = 0;
    fadeTo(idleClip, {loop: true, fade});
  }

  /**
   * Durum oynat: 'idle' | 'q' | 'e' | 'r' | 'block' | 'blockHit' | 'hit' | 'ko' | 'win'.
   * Saldırılar LoopOnce + clampWhenFinished, bitince Idle; ko/win kalıcı.
   */
  function play(next, opts = {}) {
    if (state.disposed) return false;
    if (state.name === 'ko' && next !== 'idle' && !opts.force) return false; // yere düşen kalkmaz
    state.plays++;
    state.elapsed = 0;
    state.queue.length = 0;
    if (next === 'idle') { goIdle(); return true; }
    if (SKILLS.includes(next)) {
      const spec = choreo[next];
      state.name = next;
      state.queue = (variantSteps[next] || spec.steps).map(s => ({...s}));
      advanceQueue();
      return true;
    }
    state.name = next;
    if (next === 'ko') return fadeTo(stateClips.ko, {loop: false, clamp: true, fade: 90});
    if (next === 'win') return fadeTo(stateClips.win, {loop: true});
    if (next === 'block') return fadeTo(stateClips.block, {loop: false, speed: 1.4, fade: 80});
    if (next === 'blockHit') return fadeTo(stateClips.blockHit, {loop: false, speed: 1.2, fade: 60});
    if (next === 'hit') {
      state.hits++;
      const list = Array.isArray(stateClips.hit) ? stateClips.hit : [stateClips.hit];
      const clip = list[Math.min(opts.heavy ? 1 : state.hits % list.length, list.length - 1)];
      return fadeTo(clip, {loop: false, speed: 1.15, fade: 60});
    }
    goIdle();
    return false;
  }

  function advanceQueue() {
    while (state.queue.length && state.queue[0].at <= state.elapsed) {
      const step = state.queue.shift();
      fadeTo(step.clip, {
        loop: false, speed: step.speed || 1, fade: step.at ? 110 : view.fadeMs,
        offset: step.offset || 0, endMs: step.endMs || 0,
      });
    }
  }

  /** dt saniye (gerçek zaman); timeScale/paused uygulanır. */
  function update(dt) {
    if (state.disposed) return;
    const step = state.paused ? 0 : Math.max(0, Number(dt) || 0) * state.timeScale;
    state.elapsed += step * 1000;
    if (state.queue.length) advanceQueue();
    mixer.update(step);
    // Tek seferlik klip bitti → Idle (ko/win hariç; adım kuyruğu bitmiş olmalı).
    // Varyant kliplerinde endMs: klibin yalnız o pencereyi oynatır (r'nin uzun kuyruğu).
    const cur = state.current;
    if (cur && state.name !== 'idle' && state.name !== 'ko' && state.name !== 'win' && !state.queue.length) {
      const clip = cur.getClip?.();
      const endMs = state.endMs || (clip ? clip.duration * 1000 : 0);
      const done = clip && (cur.time * 1000 >= endMs - 1 || !cur.isRunning?.());
      if (done) goIdle(180);
    }
    yawGroup.rotation.y = baseYaw + face * state.yaw;
  }

  /** slowMo: mixer de yavaşlar. */
  function setTimeScale(scale) {
    state.timeScale = clamp(Number(scale) || 0, 0, 4);
  }
  /** hitStop / süper donması: mixer durur. */
  function setPaused(paused) {
    state.paused = Boolean(paused);
  }
  /** Kendi ekseninde ek dönüş (rad); koreografi kök hareketinden gelir. */
  function setYaw(rad) {
    state.yaw = Number(rad) || 0;
  }

  // Capture each cloned material's actual rest values, once (never snapshot a flash).
  const restMaterials = materials.map(m => ({color:m.color?.clone?.(),
    emissive:m.emissive?.clone?.(), intensity:m.emissiveIntensity}));
  /** Flaş/parıltı/karartma (arena pozundan). */
  function setTint({flash = 0, red = 0, glow = 0, dark = 0} = {}) {
    if (ghost) return;
    const shade = 1 - clamp(dark, 0, 1);
    materials.forEach((m, i) => {
      const rest = restMaterials[i];
      if (rest.color && m.color?.copy) {
        m.color.copy(rest.color).multiplyScalar(shade);
        if (flash) m.color.lerp(new THREE.Color(0xffffff), flash * .8);
        if (red) m.color.lerp(new THREE.Color(0xff3028), red);
      }
      if (rest.emissive && m.emissive?.copy) {
        m.emissive.copy(rest.emissive);
        m.emissive.r += flash * 3 + red * 2 + glow * ((palette.main >> 16) & 255) / 255;
        m.emissive.g += flash * 3 + glow * ((palette.main >> 8) & 255) / 255;
        m.emissive.b += flash * 3 + glow * (palette.main & 255) / 255;
        m.emissive.multiplyScalar(shade);
        m.emissiveIntensity = rest.intensity;
      }
    });
  }

  function setOpacity(value) {
    for (const m of materials) m.opacity = clamp(value, 0, 1);
  }

  const tmp = new THREE.Vector3();
  /** Kemiğin dünya konumu (out'a yazılır). Kemik yoksa modelin göğüs yüksekliği. */
  function boneWorld(name, out = new THREE.Vector3()) {
    const bone = bones[name] || bones.chest || null;
    if (bone?.getWorldPosition) {
      object.updateWorldMatrix?.(true, true);
      return bone.getWorldPosition(out);
    }
    object.getWorldPosition?.(tmp);
    return out.copy ? out.copy(tmp) : out;
  }

  function reset() {
    state.disposed || (mixer.stopAllAction(), state.current = null, goIdle(0));
    setTint();
    state.yaw = 0;
    state.paused = false;
    state.timeScale = 1;
  }

  function dispose() {
    if (state.disposed) return;
    state.disposed = true;
    try { mixer.stopAllAction(); } catch { /* yok */ }
    try { mixer.uncacheRoot?.(model); } catch { /* yok */ }
    object.parent?.remove?.(object);
    for (const m of ownMaterials) {
      // Doku paylaşılan varlığa aittir: yalnız bağlantı kesilir.
      m.map = null;
      if ('emissiveMap' in m) m.emissiveMap = null;
      m.dispose?.();
    }
    ownMaterials.clear();
    materials.length = 0;
    for (const key of Object.keys(actions)) delete actions[key];
  }

  goIdle(0);

  return {
    fighterId, seat, face, palette, choreo, object, model, mixer, actions, bones, materials, height, scale,
    variant: variantReady ? variantName : null, stateClips,
    play, update, setTimeScale, setPaused, setYaw, setTint, setOpacity, boneWorld, reset, dispose,
    skillDuration: skill => (choreo[skill] ? skillDuration(choreo[skill]) : 0),
    stats: () => ({
      fighter: fighterId, state: state.name, clip: state.clip, timeScale: state.timeScale, paused: state.paused,
      yaw: state.yaw, queued: state.queue.length, plays: state.plays, disposed: state.disposed,
      materials: materials.length, variant: variantReady ? variantName : null,
    }),
  };
}

// ---------------------------------------------------------------- skill FX

/**
 * Karaktere özel beceri efektleri (mermi, rün oku, meteor, sütun, kalkan kırıkları, girdap).
 * Geometri/malzemeler bir kez kurulur, en fazla MAX_FX eşzamanlı örnek.
 *   fx.spawn({kind, from, to, color, flight, ms, onArrive}); fx.update(dtSeconds); fx.clear(); fx.dispose()
 */
export const MAX_FX = 12;

const ENERGY_VERTEX = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vViewW;
  varying vec2 vUv;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewW = cameraPosition - world.xyz;
    vUv = uv;
    gl_Position = projectionMatrix * viewMatrix * world;
  }`;

/** uMode 0 = mermi/halka/küre (fresnel enerji), 1 = sütun (akan çizgiler + yumuşak tepe). */
const ENERGY_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uTime;
  uniform float uMode;
  varying vec3 vNormalW;
  varying vec3 vViewW;
  varying vec2 vUv;
  void main() {
    float ndv = abs(dot(normalize(vNormalW), normalize(vViewW)));
    float rim = pow(1.0 - ndv, 2.0);
    float core = ndv * ndv * ndv;
    float flow = 0.5 + 0.5 * sin(vUv.y * 16.0 - uTime * 10.0 + sin(vUv.x * 25.13) * 1.6);
    float streak = mix(1.0, 0.45 + 0.55 * flow, uMode);
    float fade = mix(1.0, (1.0 - smoothstep(0.55, 1.0, vUv.y)) * smoothstep(0.0, 0.06, vUv.y), uMode);
    vec3 hot = mix(uColor, vec3(1.0), core * 0.6);
    float a = clamp((rim * 1.2 + core * 0.5 + 0.1) * streak * fade, 0.0, 1.0) * uOpacity;
    gl_FragColor = vec4(hot * (1.0 + rim * 0.8), a);
    #include <colorspace_fragment>
  }`;

export function createSkillFx(THREE, scene) {
  const geos = [];
  const mats = [];
  const g = x => (geos.push(x), x);
  const time = {value: 0};
  /**
   * Paket 33 (netlik): düz renkli katı additive gövde yerine enerji gölgelendiricisi —
   * renkli fresnel kenar + beyaz-sıcak çekirdek; sütunlarda akan çizgiler ve tepe sönümü.
   * `material.opacity` uOpacity'ye bağlıdır (eski API aynen çalışır).
   */
  const additive = (color, mode = 0) => {
    const uniforms = {
      uColor: {value: new THREE.Color(color)}, uOpacity: {value: 1}, uTime: time, uMode: {value: mode},
    };
    const m = THREE.ShaderMaterial
      ? new THREE.ShaderMaterial({
        name: 'pvp33-energy', uniforms, vertexShader: ENERGY_VERTEX, fragmentShader: ENERGY_FRAGMENT,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      })
      : new THREE.MeshBasicMaterial({color, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide});
    if (m.isShaderMaterial) {
      Object.defineProperty(m, 'opacity', {
        configurable: true, enumerable: true,
        get: () => uniforms.uOpacity.value,
        set: v => { uniforms.uOpacity.value = Number(v) || 0; },
      });
    }
    mats.push(m);
    return m;
  };
  const shapes = {
    shaft: g(new THREE.CylinderGeometry(0.055, 0.055, 1.6, 6).rotateZ(Math.PI / 2)),
    tip: g(new THREE.ConeGeometry(0.15, 0.45, 6).rotateZ(-Math.PI / 2).translate(1.0, 0, 0)),
    blade: g(new THREE.ConeGeometry(0.1, 0.7, 4).rotateZ(-Math.PI / 2)),
    rune: g(new THREE.OctahedronGeometry(0.22, 0)),
    ring: g(new THREE.TorusGeometry(0.34, 0.035, 6, 24)),
    orb: g(new THREE.IcosahedronGeometry(0.45, 1)),
    halo: g(new THREE.SphereGeometry(0.62, 12, 8)),
    column: g(new THREE.CylinderGeometry(0.55, 0.7, 1, 18, 1, true).translate(0, 0.5, 0)),
    shard: g(new THREE.TetrahedronGeometry(0.13, 0)),
    swirl: g(new THREE.TorusGeometry(1.1, 0.06, 6, 40).rotateX(Math.PI / 2)),
  };
  const live = [];
  const v = new THREE.Vector3();
  const prevPos = new THREE.Vector3();

  function make(kind, color, accent) {
    const group = new THREE.Group();
    group.name = `pvp32-fx-${kind}`;
    const own = [];
    const add = (geometry, c) => {
      const m = additive(c, kind === 'column' ? 1 : 0);
      own.push(m);
      const mesh = new THREE.Mesh(geometry, m);
      mesh.frustumCulled = false;
      mesh.renderOrder = 9;
      group.add(mesh);
      return mesh;
    };
    if (kind === 'spear') { add(shapes.shaft, accent); add(shapes.tip, color); }
    else if (kind === 'dagger') { add(shapes.blade, color); }
    else if (kind === 'rune') { add(shapes.rune, accent); add(shapes.ring, color); }
    else if (kind === 'meteor') { add(shapes.orb, accent); const h = add(shapes.halo, color); h.material.opacity = 0.35; }
    else if (kind === 'column') { add(shapes.column, color); }
    else if (kind === 'swirl') { add(shapes.swirl, color); const s2 = add(shapes.swirl, accent); s2.scale.setScalar(0.75); s2.position.y = 0.4; }
    else if (kind === 'shards') {
      for (let i = 0; i < 9; i++) {
        const s = add(shapes.shard, i % 2 ? color : accent);
        const a = (i / 9) * Math.PI * 2;
        s.userData.vel = new THREE.Vector3(Math.cos(a) * 2.4, 1.6 + (i % 3) * 0.9, Math.sin(a) * 1.4);
      }
    }
    if (['spear', 'dagger', 'rune', 'meteor'].includes(kind)) {
      const coreMaterial = new THREE.MeshBasicMaterial({color: accent, opacity: 0.98, transparent: true, toneMapped: false});
      own.push(coreMaterial);
      const core = new THREE.Mesh(kind === 'spear' ? shapes.shaft : kind === 'dagger' ? shapes.blade : shapes.orb, coreMaterial);
      core.name = 'pvp33-projectile-core';
      core.scale.setScalar(kind === 'spear' || kind === 'dagger' ? 0.6 : kind === 'rune' ? 0.25 : 0.55);
      group.add(core);
    }
    return {group, own};
  }

  function spawn({kind, from, to, color = 0xffffff, accent = 0xffffff, flight = 300, ms = 600, onArrive = null, follow = null, scale = 1}) {
    if (!kind) return null;
    while (live.length >= MAX_FX) kill(live[0]);
    const {group, own} = make(kind, color, accent);
    group.scale.setScalar(scale);
    const item = {
      kind, group, own, age: 0, arrived: false, onArrive, follow,
      from: from?.clone ? from.clone() : new THREE.Vector3(), to: to?.clone ? to.clone() : new THREE.Vector3(),
      flight: Math.max(1, flight), ms: Math.max(1, ms),
    };
    if (kind === 'meteor') item.from = item.to.clone().add(new THREE.Vector3(-(item.to.x - item.from.x) * 0.35, 7, -2));
    group.position.copy(kind === 'column' || kind === 'shards' || kind === 'swirl' ? item.to : item.from);
    if (['spear', 'dagger', 'rune', 'meteor'].includes(kind)) {
      const positions = new Float32Array(25 * 3);
      for (let i = 0; i < 25; i++) group.position.toArray(positions, i * 3);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
      const material = new THREE.LineBasicMaterial({color, transparent: true, opacity: 0.7,
        depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false});
      item.trail = new THREE.Line(geometry, material);
      item.trail.name = `pvp33-trail-${kind}`;
      item.trail.frustumCulled = false;
      scene.add(item.trail);
    }
    scene.add(group);
    live.push(item);
    return item;
  }

  function kill(item) {
    const i = live.indexOf(item);
    if (i >= 0) live.splice(i, 1);
    scene.remove(item.group);
    if (item.trail) {
      scene.remove(item.trail);
      item.trail.geometry.dispose();
      item.trail.material.dispose();
    }
    for (const m of item.own) {
      const j = mats.indexOf(m);
      if (j >= 0) mats.splice(j, 1);
      m.dispose();
    }
  }

  function arrive(item) {
    if (item.arrived) return;
    item.arrived = true;
    try { item.onArrive?.(item.to.clone()); } catch { /* kozmetik */ }
  }

  function update(dt) {
    const step = Math.max(0, Math.min(0.1, Number(dt) || 0)) * 1000;
    time.value = (time.value + step / 1000) % 1000;
    for (const item of live.slice()) {
      item.age += step;
      const k = item.age;
      const grp = item.group;
      if (item.kind === 'spear' || item.kind === 'dagger' || item.kind === 'rune' || item.kind === 'meteor') {
        const p = clamp(k / item.flight, 0, 1);
        prevPos.copy(grp.position);
        v.lerpVectors(item.from, item.to, item.kind === 'meteor' ? p * p : easeOutCubic(p) * 0.15 + p * 0.85);
        if (item.kind !== 'meteor') v.y += Math.sin(Math.PI * p) * 0.35;
        grp.position.copy(v);
        if (item.trail) {
          const attr = item.trail.geometry.getAttribute('position');
          attr.array.copyWithin(3, 0, 72);
          grp.position.toArray(attr.array, 0);
          attr.needsUpdate = true;
          item.trail.material.opacity = 0.7 * (1 - p * 0.6);
        }
        if (item.kind === 'rune') { grp.rotation.x += step * 0.012; grp.rotation.y += step * 0.02; }
        else if (item.kind === 'meteor') { grp.rotation.x += step * 0.006; grp.rotation.z += step * 0.004; }
        else {
          const dx = v.x - prevPos.x, dy = v.y - prevPos.y;
          if (Math.abs(dx) + Math.abs(dy) > 1e-5) grp.rotation.z = Math.atan2(dy, dx);
          if (item.kind === 'dagger') grp.rotation.x += step * 0.03;
        }
        if (p >= 1) {
          arrive(item);
          // kısa sönüş
          const fade = clamp((k - item.flight) / 140, 0, 1);
          for (const m of item.own) m.opacity = 1 - fade;
          grp.scale.setScalar((grp.scale.x || 1) * (1 + step * 0.004));
          if (fade >= 1) kill(item);
        }
      } else if (item.kind === 'column') {
        const p = clamp(k / item.ms, 0, 1);
        const rise = easeOutCubic(clamp(k / 220, 0, 1));
        grp.scale.set(1 + 0.25 * Math.sin(k * 0.02), 0.05 + 3.6 * rise, 1 + 0.25 * Math.sin(k * 0.02));
        grp.rotation.y += step * 0.004;
        if (k >= 220) arrive(item);
        for (const m of item.own) m.opacity = p < 0.6 ? 0.85 : 0.85 * (1 - (p - 0.6) / 0.4);
        if (p >= 1) kill(item);
      } else if (item.kind === 'shards') {
        const t = k / 1000;
        if (!item.arrived) arrive(item);
        for (const mesh of grp.children) {
          const vel = mesh.userData.vel;
          mesh.position.set(vel.x * t, vel.y * t - 4.9 * t * t, vel.z * t);
          mesh.rotation.x += step * 0.02;
          mesh.rotation.y += step * 0.015;
        }
        const p = clamp(k / item.ms, 0, 1);
        for (const m of item.own) m.opacity = 1 - p;
        if (p >= 1) kill(item);
      } else if (item.kind === 'swirl') {
        const p = clamp(k / item.ms, 0, 1);
        if (item.follow) { try { item.follow(grp.position); } catch { /* yok */ } }
        grp.rotation.y += step * 0.025;
        grp.scale.setScalar(0.6 + 0.5 * easeOutCubic(Math.min(1, p * 3)));
        for (const m of item.own) m.opacity = (p < 0.15 ? p / 0.15 : 1 - Math.max(0, (p - 0.7) / 0.3)) * 0.8;
        if (k >= item.ms * 0.5) arrive(item);
        if (p >= 1) kill(item);
      } else {
        kill(item);
      }
    }
  }

  function clear() {
    for (const item of live.slice()) kill(item);
  }

  function dispose() {
    clear();
    for (const geometry of geos) geometry.dispose();
    for (const m of mats) m.dispose();
    geos.length = 0;
    mats.length = 0;
  }

  return {spawn, update, clear, dispose, stats: () => ({live: live.length, kinds: live.map(i => i.kind)})};
}
