/**
 * TuşLab PvP / paket 32 — 3B rig'li dövüşçüler (karakter motoru).
 * ================================================================
 *
 * arena3d.js'in düz (2.5D) rig düzlemlerinin yerine, assets/models/<id>/<id>.glb'deki
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
import {createAnimState, fadeMs as animFadeMs, clampAttackSpeed} from './anim-state.js';

export const FIGHTER_MODEL_BASE = './assets/models/';
export const modelUrl = fighterId => `${FIGHTER_MODEL_BASE}${fighterId}/${fighterId}.glb`;

// ------------------------------------------------------------------ model varyantları (paket 23)

/**
 * Karakter başına model tablosu (paket 23 → 3B: dört karakterin TEK modeli Meshy).
 * Yalnız 'meshy' varyantı var: Meshy AI üretimi GLB (assets/models/<id>/<id>.glb).
 * Eski KayKit modelleri assets/_eski/characters/ arşivindedir; koda dönüş yolu YOKTUR.
 * Tablo klip eşlemesini ve ölçülen vuruş karelerini (peakMs) tutar; CHOREOGRAPHY'nin
 * hitMs/motion/fx sabitleri DEĞİŞMEZ.
 */
export const MODEL_VARIANTS = Object.freeze({
  vargr: Object.freeze({
    meshy: Object.freeze({
      url: './assets/models/vargr/vargr.glb',
      /** Durum klipleri (STATE_CLIPS karşılığı; global tabloya dokunulmaz). */
      clips: Object.freeze({
        idle: 'Combat_Stance',
        idleHeavy: 'Combat_Stance',
        block: 'Two_Handed_Parry',
        blockHit: 'Two_Handed_Parry',
        hit: Object.freeze(['Hit_Reaction']),
        ko: 'Knock_Down',
        win: 'Victory_Cheer',
        // Şerit H: yolculuk klipleri (vargr.glb'ye scripts/merge-vargr-clips.py ekler).
        run: 'Run_Charge',
        walkBack: 'Walk_Back',
      }),
      /** Ölçülen el hızı zirveleri (peakMs); klipler baştan sona oynatılır. */
      skills: Object.freeze({
        // Şerit H: q/e klibi BAŞTAN, timeScale 1,1 ile oynar (offset yok); temas = yolculuk + peakMs/speed.
        // recoverMs: temastan sonra klibin toparlanma süresi (gerçek ms) — sonra Walk_Back ile geri yürüyüş.
        q: Object.freeze({clip: 'Attack', peakMs: 1060, speed: 1.1, recoverMs: 380}),
        e: Object.freeze({clip: 'Axe_Spin_Attack', peakMs: 900, speed: 1.1, recoverMs: 360}),
        r: Object.freeze({clip: 'Charged_Axe_Chop', peakMs: 4375}),
      }),
    }),
  }),
  sira: Object.freeze({meshy: Object.freeze({
    url: modelUrl('sira'),
    clips: Object.freeze({idle:'Combat_Stance',idleHeavy:'Combat_Stance',run:'Standard_Forward_Charge_inplace',walkBack:'Standard_Forward_Charge_inplace',block:'Sword_Parry',blockHit:'Sword_Parry',hit:Object.freeze(['Hit_Reaction']),ko:'Knock_Down',win:'Victory_Cheer'}),
    skills: Object.freeze({q:Object.freeze({clip:'Thrust_Slash',peakMs:1200,speed:1.1,recoverMs:380}),e:Object.freeze({clip:'Double_Blade_Spin',peakMs:2550,speed:1.1,recoverMs:360}),r:Object.freeze({clip:'Triple_Combo_Attack',peakMs:2450})}),
  })}),
  doran: Object.freeze({meshy: Object.freeze({
    url: modelUrl('doran'),
    clips: Object.freeze({idle:'Combat_Stance',idleHeavy:'Combat_Stance',run:'Standard_Forward_Charge_inplace',walkBack:'Standard_Forward_Charge_inplace',block:'Block1',blockHit:'Block1',hit:Object.freeze(['Hit_Reaction_1']),ko:'Knock_Down_1',win:'Victory_Fist_Pump'}),
    skills: Object.freeze({q:Object.freeze({clip:'Right_Hand_Sword_Slash',peakMs:600,speed:1.1,recoverMs:380}),e:Object.freeze({clip:'Shield_Push_Left',peakMs:1065,speed:1.1,recoverMs:360}),r:Object.freeze({clip:'Sword_Judgment',peakMs:2450})}),
  })}),
  nyx: Object.freeze({meshy: Object.freeze({
    url: modelUrl('nyx'),
    clips: Object.freeze({idle:'Combat_Stance',idleHeavy:'Combat_Stance',run:'Standard_Forward_Charge_inplace',walkBack:'Standard_Forward_Charge_inplace',block:'Block3',blockHit:'Block3',hit:Object.freeze(['Hit_Reaction']),ko:'dying_backwards',win:'victory'}),
    skills: Object.freeze({q:Object.freeze({clip:'mage_soell_cast',peakMs:900}),e:Object.freeze({clip:'Charged_Spell_Cast',peakMs:1200}),r:Object.freeze({clip:'Charged_Ground_Slam',peakMs:1700})}),
  })}),
});

/**
 * Tek model kuralı (3B): her karakterin yayındaki tek GLB'si Meshy üretimidir
 * (assets/models/<id>/<id>.glb). Eski KayKit modellerine dönüş yolu, bayrağı ya da
 * yedek yüklemesi YOKTUR; loadFighterModel hata verirse arena düzlem siluetini gösterir.
 */
const variantSpecOf = fighterId => MODEL_VARIANTS[fighterId]?.meshy || null;

/** Varyant seçimi: saf fonksiyon (localStorage/location yoksa hata vermez, test edilebilir).
 *  Dört karakterin de tek varyantı 'meshy'dir; eski ?vargr=eski / localStorage bayrakları yok sayılır. */
export function fighterModelVariant(fighterId) { return variantSpecOf(fighterId) ? 'meshy' : null; }

/** Karakterin model URL'si: ./assets/models/<id>/<id>.glb (bilinmeyen kimlikte null). */
export function fighterModelUrl(fighterId) { return variantSpecOf(fighterId)?.url || null; }

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

/**
 * Karakterin Meshy modelini yükler (paket 23 → 3B). GLB yüklenemez ya da beklenen
 * klipleri içermiyorsa HATA FIRLATIR (eski modele dönüş yok): arena3d bu durumda
 * düzlem yükleme siluetini göstermeye devam eder.
 */
export async function loadFighterModel(THREE, fighterId, {loader = null} = {}) {
  const spec = variantSpecOf(fighterId);
  if (!spec) throw new Error(`bilinmeyen dövüşçü: ${fighterId}`);
  const asset = await loadFighterAsset(THREE, spec.url, {loader});
  const missing = variantMissingClips(asset?.clips, spec);
  if (missing.length) throw new Error(`eksik klipler: ${missing.join(', ')}`);
  asset.variant = 'meshy';
  return asset;
}

/** Görünüm: koltuk yönüne bakan yarı profil; kameraya hafif dönük. */
export const MODEL_VIEW = Object.freeze({
  yawToCamera: 0.5,   // rad: tam profilden (π/2) kameraya doğru dönüş
  heightUnits: 2.68,  // hedef GÖVDE boyu (head_end kemiği – en alçak ayak kemiği), dört modelde aynı
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
  // Şerit H: KayKit'te ayrı koşu klibi yok → Dodge_Forward (atılma) / Dodge_Backward (geri çekilme).
  run: 'Dodge_Forward',
  walkBack: 'Dodge_Backward',
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
  if (spec.totalMs) ends.push(spec.totalMs);
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

// ------------------------------------------------------------ temas / dash / kadraj (saf)

/** Savunanın gövdesi: silah ucunun değeceği yüzey, saldıran ucundan bu kadar içeride (gövde birimi). */
export const BODY_HALF_DEPTH = 0.3;
export const DEFAULT_REACH = 0.95;

/** Model ölçeğinden (z derinliği = rakibe uzanan yön, silah dahil) saldıranın öne uzanımı. */
export function reachFromDepth(depth) {
  const d = Number(depth);
  return Number.isFinite(d) && d > 0 ? clamp(d / 2, 0.8, 1.6) : DEFAULT_REACH;
}

/** Temasta kat edilecek mesafe: aradaki boşluk − (saldıran uzanımı + savunan gövde yarı derinliği). */
export function contactDistance(gap, reach = DEFAULT_REACH, bodyHalf = BODY_HALF_DEPTH) {
  return Math.max(0, (Number(gap) || 0) - (Number(reach) || 0) - (Number(bodyHalf) || 0));
}

/**
 * Dash eğrisi (0..1): saldırı başından hızlı ease-out ileri, temas karesinden leadMs önce varış,
 * temas sonrası holdMs bekleyip ease-in geri dönüş (returnMs).
 */
export function dashProgress(elapsedMs, hitMs, {leadMs = 90, holdMs = 100, startFrac = 0.15, returnMs = 320} = {}) {
  const hit = Math.max(1, hitMs);
  const start = hit * startFrac;
  const arrive = Math.max(start + 40, hit - clamp(leadMs, 60, 120));
  const out = easeOutCubic(clamp((elapsedMs - start) / (arrive - start), 0, 1));
  const back = clamp((elapsedMs - hit - holdMs) / Math.max(1, returnMs), 0, 1);
  return out * (1 - back * back);
}

// ------------------------------------------------------------ yolculuk (Şerit H)

/**
 * Saldırı yolculuğu: rakibe koşu 300–500 ms, yumuşak hızlanma + sonda hafif fren; temasta kısa
 * bekleyiş (toparlanma, holdMs); sonra geri yürüyüş returnMs. Işınlanma yok: eğri sürekli.
 */
export const TRAVEL = Object.freeze({
  travelMs: 400, minMs: 300, maxMs: 500,
  returnMs: 420, fastReturnMs: 240,
  fastTravelMs: 400,   // kuyruk baskısında da yolculuk görünür kalır
  holdMs: 200,         // KayKit için temas sonrası bekleyiş (Meshy: spec.recoverMs)
});

// ------------------------------------------------------------ kombo (Görev 4)

/**
 * Kombo zinciri: TEK yaklaşma → N vuruş (her biri kendi temas karesinde) → TEK dönüş.
 * maxStrikes: bir zincirde en fazla vuruş (sonrası yeni girdiye geçer — süre tavanı).
 * lead: yaklaşma + ilk vuruş hazırlığı; gap: vuruşlar arası; hold: son vuruş → dönüş.
 */
export const COMBO = Object.freeze({
  maxStrikes: 4,
  leadMs: 340, leadFastMs: 300,
  gapMs: 260, gapFastMs: 210,
  holdMs: 300, holdFastMs: 220,
  returnMs: 240, returnFastMs: 180,
  rangedHoldMs: 120, rangedReturnMs: 200,
  flurryMs: 90,        // alt sınır: vuruşlar arası en kısa süre (ms)
  rangedStop: 0.5,       // menzilli vuruşta yaklaşma oranı (yarım mesafe)
});

/** Saf: N vuruşlu zincirin temas anları + dönüş başlangıcı (ms). */
export function chainTiming(count, {compress = false, ranged = false} = {}) {
  const n = clamp(Math.round(Number(count) || 1), 1, COMBO.maxStrikes);
  const lead = compress ? COMBO.leadFastMs : COMBO.leadMs;
  const gap = Math.max(COMBO.flurryMs, compress ? COMBO.gapFastMs : COMBO.gapMs);
  // Menzilli zincir: mermi çıktıktan sonra uzun bekleyiş gereksiz → kısa hold/dönüş.
  const hold = ranged ? COMBO.rangedHoldMs : compress ? COMBO.holdFastMs : COMBO.holdMs;
  const returnMs = ranged ? COMBO.rangedReturnMs : compress ? COMBO.returnFastMs : COMBO.returnMs;
  const contacts = [];
  for (let i = 0; i < n; i++) contacts.push(lead + i * gap);
  const returnStart = contacts[n - 1] + hold;
  return {count: n, lead, gap, hold, returnMs, returnStart, totalMs: returnStart + returnMs, contacts};
}
const easeInOutCubicK = k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
/** 0..1: ease-in-out + sonda ek fren (başlangıç eğimi küçük, bitiş yumuşak). */
export const travelEase = k => { const x = clamp(k, 0, 1); return 0.65 * easeInOutCubicK(x) + 0.35 * easeOutCubic(x); };
/**
 * Yolculuk ilerlemesi (0 = ev, 1 = temas noktası); from = başlangıçta taşınan ilerleme (0..1; atlanan dönüş).
 * hitMs sonrası holdMs bekler, sonra returnMs'de eve döner (returnMs 0 → temas noktasında kalır).
 */
export function travelProgress(elapsedMs, {travelMs = TRAVEL.travelMs, hitMs = TRAVEL.travelMs, holdMs = TRAVEL.holdMs, returnMs = TRAVEL.returnMs, from = 0} = {}) {
  const out = from + (1 - from) * travelEase(elapsedMs / Math.max(1, travelMs));
  if (!returnMs) return out;
  const back = easeInOutSine(window01(elapsedMs, hitMs + holdMs, returnMs));
  return out * (1 - back);
}

/**
 * Görev 4 — kombo ilerlemesi (0 = ev, 1 = temas bandı). Tek yaklaşma (travelEase),
 * vuruş bandında sabit duruş, dönüşte (returnStart..+returnMs) ease-in-out geri yürüyüş.
 * Eğri sürekli: kare başına kök konum sıçraması olmaz (ışınlanma yok).
 */
export function chainProgress(elapsedMs, {travelMs = COMBO.leadMs, returnStart = travelMs, returnMs = COMBO.returnMs, from = 0} = {}) {
  const out = from + (1 - from) * travelEase((Number(elapsedMs) || 0) / Math.max(1, travelMs));
  if (!returnMs) return out;
  const back = easeInOutSine(window01(Number(elapsedMs) || 0, returnStart, returnMs));
  return out * (1 - back);
}

/** q/e menzilli (mermi/rün/sütun/meteor) değilse yakın dövüştür → yolculuk uygulanır. */
const RANGED_FX = ['spear', 'dagger', 'rune', 'meteor', 'column'];
export const isMeleeSkill = (skill, spec) => skill !== 'r' && !(spec?.fx || []).some(f => RANGED_FX.includes(f.kind));

/** Koreografiyi yolculuk kadar kaydır (adım/efekt/hareket zamanları + hitMs). Girdiyi bozmaz. */
export function applyTravel(spec, {travelMs = TRAVEL.travelMs, holdMs = TRAVEL.holdMs, returnMs = TRAVEL.returnMs} = {}) {
  const m = {...spec.motion};
  for (const key of ['dashAt', 'backAt', 'jumpAt', 'spinAt']) if (m[key] !== undefined) m[key] += travelMs;
  const hitMs = (spec.hitMs || 0) + travelMs;
  return {
    ...spec, steps: spec.steps.map(s => ({...s, at: (s.at || 0) + travelMs, speed: s.speed ? clampAttackSpeed(s.speed) : s.speed})),
    motion: m, fx: spec.fx.map(f => ({...f, at: (f.at || 0) + travelMs})),
    hitMs, travelMs, holdMs, returnMs, totalMs: hitMs + holdMs + returnMs,
  };
}

/** İki dövüşçüyü kadrajda tut: orta noktayı izle, mesafe azaldıkça hafif yaklaş. x: dünya birimi. */
export function frameFighters(xA, xB, {follow = 0.35, nearZoom = 0.45, farGap = 6, nearGap = 1.6} = {}) {
  const gap = Math.abs((Number(xA) || 0) - (Number(xB) || 0));
  const mid = ((Number(xA) || 0) + (Number(xB) || 0)) / 2;
  const t = clamp((farGap - gap) / Math.max(0.01, farGap - nearGap), 0, 1);
  return {centerX: mid * follow, zoom: nearZoom * t, gap};
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
  const variantSpec = variantName === 'meshy' ? variantSpecOf(fighterId) : null;
  if (variantName === 'meshy' && variantMissingClips(asset.clips, variantSpec).length) throw new Error(`eksik Meshy klipleri: ${fighterId}`);
  const variantReady = variantSpec;
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
  let footY = null;
  try {
    let headY = null;
    const feet = [];
    model.updateMatrixWorld?.(true);
    model.traverse(o => {
      if (!o.getWorldPosition || typeof o.name !== 'string') return;
      const name = o.name.toLowerCase();
      if (name === 'head_end') headY = o.getWorldPosition(new THREE.Vector3()).y;
      if (name === 'leftfoot' || name === 'rightfoot') feet.push(o.getWorldPosition(new THREE.Vector3()).y);
    });
    const box = new THREE.Box3().setFromObject(model);
    if (Number.isFinite(box.min.y)) minY = box.min.y;
    if (feet.length && Number.isFinite(headY)) {
      // Ayak kemiği bilektedir (ham ~0,15 yukarıda); taban = bbox tabanı, ama silah/asa ucu
      // tabandan aşağı sarkıyorsa en fazla bilek − 0,2'ye kadar güvenilir. Boy = baş üstü − taban.
      const ankleY = Math.min(...feet);
      footY = Number.isFinite(minY) && minY <= ankleY ? Math.max(minY, ankleY - 0.2) : ankleY;
      height = headY - footY;
    } else if (Number.isFinite(box.max.y - box.min.y) && box.max.y - box.min.y > 0.05) {
      height = box.max.y - box.min.y;
    }
  } catch { /* sahte THREE */ }
  const scale = view.heightUnits / height;
  const object = new THREE.Group();
  object.name = `pvp32-fighter-${seat}`;
  const yawGroup = new THREE.Group(); // kendi ekseninde dönüş (vargr E) burada
  object.add(yawGroup);
  yawGroup.add(model);
  model.scale.setScalar(scale);
  // Zemin: kutu yolu bbox tabanını (minY) y=0'a taşır; varyant yolu animasyon kaynaklı
  // sistematik zemine gömülmeyi (meshy duruşu -0,058) kalibre offset ile düzeltir.
  model.position.y = -(footY ?? minY) * scale;
  // Öne uzanım (silah dahil): yaw uygulanmadan önce modelin z derinliğinden; sahte THREE'de varsayılan.
  let reach = DEFAULT_REACH;
  try {
    const box = new THREE.Box3().setFromObject(model);
    reach = reachFromDepth(box.max.z - box.min.z);
  } catch { /* sahte THREE */ }
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
    chain: [], chainStrikes: 0, chainPlan: null,
  };

  /** Varyant saldırıları tam klip, sıfır başlangıç ofseti ve doğal hız kullanır. */
  const variantSteps = {};
  if (variantReady) {
    for (const skill of SKILLS) {
      const spec = variantReady.skills?.[skill];
      if (!spec || !clipByName.has(spec.clip)) continue;
      const durationMs = (clipByName.get(spec.clip)?.duration || 0) * 1000;
      variantSteps[skill] = [{
        clip: spec.clip, at: 0, speed: clampAttackSpeed(spec.speed || 1),
        offset: 0, endMs: durationMs,
      }];
    }
  }

  /**
   * Şerit H: yakın dövüş q/e planı. Yolculuk (koşu klibi) → saldırı klibi BAŞTAN (offset yok,
   * hız ≤ 1,2) → temasta (hitMs) vuruş → toparlanma → geri yürüyüş. Planlar önceden hesaplanır:
   *   plan(skill, {compress, skipReturn}) → {steps, hitMs, travelMs, holdMs, returnMs, totalMs, speed}
   * compress (görsel kuyruk baskısı): hız en fazla 1,2; yolculuk ve dönüş korunur.
   */
  const stateRun = stateClips.run || STATE_CLIPS.run;
  const stateWalkBack = stateClips.walkBack || STATE_CLIPS.walkBack;
  const clipMs = name => (clipByName.get(name)?.duration || 0) * 1000;
  const baseChoreo = {};
  const planCache = new Map();
  const meleeSkills = SKILLS.filter(skill => isMeleeSkill(skill, choreo[skill]));
  for (const skill of meleeSkills) baseChoreo[skill] = choreo[skill];
  function buildPlan(skill, {compress = false, skipReturn = false} = {}) {
    const base = baseChoreo[skill];
    const vs = variantReady?.skills?.[skill];
    const travelMs = TRAVEL.travelMs;
    const returnMs = TRAVEL.returnMs;
    const walkSpeed = clamp(clipMs(stateWalkBack) / Math.max(1, returnMs || 1), 0.8, 1.2);
    const walkStep = returnMs && clipByName.has(stateWalkBack) ? {clip: stateWalkBack, speed: walkSpeed, endMs: returnMs * walkSpeed} : null;
    const runStep = clipByName.has(stateRun) ? {clip: stateRun, at: 0, speed: 1, endMs: 0} : null;
    let steps, hitMs, holdMs, speed;
    if (vs && clipByName.has(vs.clip)) {
      speed = clampAttackSpeed(compress ? Math.max(vs.speed || 1, 1.2) : vs.speed || 1);
      // The return starts only after the full source clip has played.  A short
      // fixed recovery window used to cut off over half of Vargr's attack.
      holdMs = Math.max(vs.recoverMs ?? TRAVEL.holdMs,
        (clipMs(vs.clip) - vs.peakMs) / speed);
      hitMs = travelMs + vs.peakMs / speed;
      steps = [{clip: vs.clip, at: travelMs, speed, offset: 0, endMs: clipMs(vs.clip)}];
    } else {
      const shifted = applyTravel(base, {travelMs, holdMs: TRAVEL.holdMs, returnMs});
      steps = shifted.steps; hitMs = shifted.hitMs; holdMs = TRAVEL.holdMs;
      speed = steps[0]?.speed || 1;
    }
    if (runStep) steps.unshift(runStep);
    if (walkStep) steps.push({...walkStep, at: hitMs + holdMs});
    return {skill, steps, hitMs, travelMs, holdMs, returnMs, totalMs: hitMs + holdMs + returnMs, speed, compress, skipReturn};
  }
  function plan(skill, opts = {}) {
    if (!baseChoreo[skill]) return null;
    const key = `${skill}|${opts.compress ? 1 : 0}|${opts.skipReturn ? 1 : 0}`;
    if (!planCache.has(key)) planCache.set(key, buildPlan(skill, opts));
    return planCache.get(key);
  }
  function sceneDuration(skill) {
    const spec = choreo[skill];
    if (!spec) return 0;
    return Math.max(skillDuration(spec), ...spec.steps.map(step =>
      (step.at || 0) + clipMs(step.clip) / clampAttackSpeed(step.speed || 1)));
  }

  /**
   * Görev 4 — zincir vuruşu özeti: bir skill'in saldırı klibi + ölçülen temas anı.
   * Varyantlı modelde Meshy peakMs'i, düz yolda tablo hitMs'i kullanılır (yolculuk YOK:
   * zincir kendi yaklaşmasını tek başına ekler, travel iki kez eklenmez).
   */
  function strikeSpec(skill) {
    if (typeof skill !== 'string') return null;
    const melee = Boolean(baseChoreo[skill]);
    if (melee) {
      const vs = variantReady?.skills?.[skill];
      if (vs && clipByName.has(vs.clip)) {
        return {skill, melee: true, ranged: false, clip: vs.clip,
          peakMs: vs.peakMs || clipMs(vs.clip) / 2, speed: vs.speed || 1, fx: baseChoreo[skill].fx || []};
      }
      const b = baseChoreo[skill];
      const step = b.steps && b.steps[0];
      if (!step || !clipByName.has(step.clip)) return null;
      return {skill, melee: true, ranged: false, clip: step.clip,
        peakMs: b.hitMs || clipMs(step.clip) / 2, speed: step.speed || 1, fx: b.fx || []};
    }
    const spec = choreo[skill];
    const step = spec && spec.steps && spec.steps[0];
    if (!spec || !step || !clipByName.has(step.clip)) return null;
    return {skill, melee: false, ranged: true, clip: step.clip,
      peakMs: spec.hitMs || clipMs(step.clip) / 2, speed: step.speed || 1, fx: spec.fx || []};
  }

  /**
   * Zincir planı (saf, oynatılmaz): tek koşu adımı + vuruş başına bir klip adımı
   * (ofset = peak − hazırlık, böylece peak tam temas anına gelir) + tek geri yürüyüş.
   * compress: kuyruk baskısı — hız en fazla 1,2, boşluklar kısalır, yolculuk/dönüş korunur.
   */
  function chainPlan(skills, {compress = false} = {}) {
    const list = (Array.isArray(skills) ? skills : [skills]).filter(s => typeof s === 'string');
    if (!list.length) return null;
    const specs = list.slice(0, COMBO.maxStrikes).map(strikeSpec);
    if (specs.some(s => !s)) return null;
    const timing = chainTiming(specs.length, {compress, ranged: specs.every(s => s.ranged)});
    const gap = timing.gap;
    const steps = [];
    // Menzilli ilk vuruş: atıcı yerinde durur (koşu klibi yok), yalnız yarım mesafe yaklaşır.
    if (!specs[0].ranged && clipByName.has(stateRun)) steps.push({clip: stateRun, at: 0, speed: 1, endMs: 0});
    const contacts = [];
    const fx = [];
    for (let i = 0; i < specs.length; i++) {
      const spec = specs[i];
      if (spec.ranged) {
        // Menzilli: klip BAŞTAN (ofset yok), temas = tablo hitMs'i (el bırakma + mermi uçuşu).
        const speed = clampAttackSpeed(spec.speed || 1);
        const startMs = i === 0 ? 0 : contacts[i - 1].ms;
        steps.push({clip: spec.clip, at: startMs, speed, offset: 0, endMs: 0});
        contacts.push({ms: Math.round(startMs + spec.peakMs), skill: spec.skill, prepMs: 0, speed, startMs, peakMs: spec.peakMs});
        for (const item of spec.fx || []) fx.push({...item, at: startMs + (item.at || 0), skill: spec.skill, index: i});
        continue;
      }
      const contact = i === 0 ? timing.lead : contacts[i - 1].ms + gap;
      // Aynı klip art arda gelirse hafif hız varyasyonu (0,9–1,2 aralığında kalır).
      const vary = i > 0 && specs[i - 1].clip === spec.clip ? [1, 0.92, 1.1, 0.96][i % 4] : 1;
      const speed = clampAttackSpeed((compress ? Math.max(spec.speed || 1, 1.2) : spec.speed || 1) * vary);
      const prepMs = Math.min(220, Math.max(120, spec.peakMs * 0.25));
      const startAt = Math.max(0, contact - prepMs / speed);
      steps.push({clip: spec.clip, at: startAt, speed, offset: Math.max(0, (spec.peakMs - prepMs) / 1000), endMs: 0});
      contacts.push({ms: Math.round(contact), skill: spec.skill, prepMs, speed, startMs: startAt, peakMs: spec.peakMs});
      for (const item of spec.fx || []) fx.push({...item, at: Math.round(contact), skill: spec.skill, index: i});
    }
    const last = contacts[contacts.length - 1].ms;
    const returnStart = last + timing.hold;
    const totalMs = returnStart + timing.returnMs;
    if (clipByName.has(stateWalkBack)) {
      const walkSpeed = clamp(clipMs(stateWalkBack) / Math.max(1, timing.returnMs || 1), 0.8, 1.2);
      steps.push({clip: stateWalkBack, at: returnStart, speed: walkSpeed, endMs: timing.returnMs * walkSpeed});
    }
    return {skills: specs.map(s => s.skill), steps, contacts, fx,
      travelMs: contacts[0].ms, holdMs: timing.hold, returnStart, returnMs: timing.returnMs, totalMs,
      speed: Math.max(1, ...specs.map(s => clampAttackSpeed(s.speed || 1))),
      moveIn: specs.every(s => s.ranged) ? COMBO.rangedStop : 1, compress};
  }
  // Varsayılan plan koreografiye yansır (skillDuration / hitMs / fx zamanları tutarlı olsun).
  for (const skill of meleeSkills) {
    const p = plan(skill);
    const shifted = applyTravel(baseChoreo[skill], {travelMs: p.travelMs, holdMs: p.holdMs, returnMs: p.returnMs});
    const fx = shifted.fx.map(f => (f.kind === 'slam' ? {...f, at: p.hitMs} : f));
    choreo[skill] = {...shifted, steps: p.steps, hitMs: p.hitMs, fx, totalMs: p.totalMs};
  }

  const anim = createAnimState();
  let pendingBlock = null; // hit sırasında gelen block: hit bitince oynar
  const fading = []; // {action, left(ms)}: fade bitince stop() edilir
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
    if (prev && prev !== next) {
      // Önceki fade'de kalan eski action'lar hemen kesilir: iki klipten fazlası karışıp yarım poz vermesin.
      for (let i = 0; i < fading.length; i++) {
        const f = fading[i];
        if (f.action && f.action !== prev && f.action !== next) { f.action.stop?.(); f.action = null; }
      }
      prev.crossFadeTo?.(next, fade / 1000, false);
      let slot = fading.find(x => !x.action);
      if (!slot) { slot = {action: null, left: 0}; fading.push(slot); }
      slot.action = prev; slot.left = fade + 30;
    }
    state.current = next;
    state.clip = name;
    return true;
  }

  function goIdle(fade) {
    state.name = 'idle';
    state.queue.length = 0;
    state.chain = [];
    state.chainStrikes = 0;
    state.chainPlan = null;
    fadeTo(idleClip, {loop: true, fade});
  }

  /** Klip bitti → idle ya da kuyruktaki tek saldırı (anim durum makinesi karar verir). */
  function finishToIdle(fade) {
    if (pendingBlock) {
      const b = pendingBlock; pendingBlock = null;
      anim.finish(); // hit bitti → idle; sonra block
      if (anim.request(b, {}).action === 'play') { playNow(b, {fade: animFadeMs('hit', b)}); return; }
    }
    const queued = anim.finish();
    if (queued) { playNow(queued, {fade: animFadeMs('idle', queued)}); return; }
    goIdle(fade);
  }

  /**
   * Durum oynat: 'idle' | 'q' | 'e' | 'r' | 'block' | 'blockHit' | 'hit' | 'ko' | 'win'.
   * Saldırılar LoopOnce + clampWhenFinished, bitince Idle; ko/win kalıcı.
   */
  function play(next, opts = {}) {
    if (state.disposed) return false;
    const melee = baseChoreo[next] ? plan(next, opts) : null;
    const contactMs = SKILLS.includes(next) ? (melee?.hitMs || variantReady?.skills?.[next]?.contactMs || choreo[next]?.hitMs || 0) : 0;
    const d = anim.request(next, {contactMs, force: opts.force});
    if (d.action === 'drop') {
      // Hit sırasında gelen block düşmez: hit bitince oynar (kuyruk, en fazla 1).
      if ((next === 'block' || next === 'blockHit') && anim.state.kind === 'hit') { pendingBlock = next; return true; }
      return false; // öncelik / kilit (ko, zafer) reddetti
    }
    if (d.action === 'queue') return true; // temas karesinden önce yeni saldırı: 1 kuyruk
    return playNow(next, {...opts, fade: d.fade});
  }

  function playNow(next, opts = {}) {
    pendingBlock = null;
    state.plays++;
    state.elapsed = 0;
    state.queue.length = 0;
    state.chain = [];
    state.chainStrikes = 0;
    state.chainPlan = null;
    if (next === 'idle') { goIdle(opts.fade); return true; }
    if (SKILLS.includes(next)) {
      const spec = choreo[next];
      state.name = next;
      const melee = baseChoreo[next] ? plan(next, opts) : null;
      state.queue = (melee?.steps || variantSteps[next] || spec.steps).map(s => ({...s}));
      state.fade = opts.fade;
      advanceQueue();
      return true;
    }
    state.name = next;
    if (next === 'ko') return fadeTo(stateClips.ko, {loop: false, clamp: true, fade: opts.fade});
    if (next === 'win') return fadeTo(stateClips.win, {loop: true, fade: opts.fade});
    if (next === 'block') return fadeTo(stateClips.block, {loop: false, speed: 1.4, fade: opts.fade});
    if (next === 'blockHit') return fadeTo(stateClips.blockHit, {loop: false, speed: 1.2, fade: opts.fade});
    if (next === 'hit') {
      state.hits++;
      const list = Array.isArray(stateClips.hit) ? stateClips.hit : [stateClips.hit];
      const clip = list[Math.min(opts.heavy ? 1 : state.hits % list.length, list.length - 1)];
      return fadeTo(clip, {loop: false, speed: 1.15, fade: opts.fade});
    }
    goIdle();
    return false;
  }

  function advanceQueue() {
    while (state.queue.length && state.queue[0].at <= state.elapsed) {
      const step = state.queue.shift();
      fadeTo(step.clip, {
        loop: false, speed: clampAttackSpeed(step.speed || 1), fade: step.at ? 110 : (state.fade ?? view.fadeMs),
        offset: step.offset || 0, endMs: step.endMs || 0,
      });
    }
  }

  /**
   * Görev 4 — kombo zincirini oynat: tek yaklaşma + N vuruş + tek dönüş.
   * state.name İLK skill olur (tekli saldırıyla aynı sözleşme); chain bilgisi stats'ta.
   */
  function playChain(skills, opts = {}) {
    if (state.disposed) return null;
    const plan = chainPlan(skills, opts);
    if (!plan || !plan.contacts.length) return null;
    if (anim.state.kind === 'hit' || anim.state.kind === 'block') anim.request('idle');
    const head = anim.request(plan.skills[0], {contactMs: plan.contacts[0].ms});
    if (head.action === 'drop') return null;
    if (head.action === 'queue' && anim.state.kind === 'attack') {
      // Aktif saldırı varken zincir gelirse (kuyruklama katmanı yok): temas anında kes.
      anim.request(plan.skills[0], {contactMs: plan.contacts[0].ms, force: true});
    }
    pendingBlock = null;
    state.plays++;
    state.elapsed = 0;
    state.name = plan.skills[0];
    state.chain = plan.skills.slice();
    state.chainStrikes = plan.contacts.length;
    state.chainPlan = plan;
    state.queue = plan.steps.map(s => ({...s}));
    state.fade = opts.fade ?? head.fade;
    advanceQueue();
    return plan;
  }

  /**
   * Görev 4 — aktif zincire yeni vuruş(lar) ekle: yeniden başlamaz, kuyruğun
   * gelecekteki adımları yeni planla kurulur (başlamış adımlar korunur), geri
   * yürüyüş taşınır. Dönen planın contacts[] listesinde TÜM temaslar vardır;
   * çağıran yalnız yeni eklenen indisleri timeline'a bağlar.
   */
  function extendChain(skills, {compress = false} = {}) {
    const cur = state.chainPlan;
    if (state.disposed || !cur || !state.chain.length || state.name === 'idle') return null;
    const extra = (Array.isArray(skills) ? skills : [skills]).filter(s => typeof s === 'string');
    const merged = [...state.chain, ...extra].slice(0, COMBO.maxStrikes);
    if (merged.length <= state.chain.length || !extra.length) return cur;
    const next = chainPlan(merged, {compress});
    if (!next) return cur;
    const activeAt = state.elapsed - 8; // bu karede başlamış adımlar yerinde kalır
    state.queue = state.queue.filter(step => (step.at || 0) > activeAt);
    for (const step of next.steps) {
      if ((step.at || 0) <= activeAt) continue;
      if (state.queue.some(s => s.clip === step.clip && Math.abs((s.at || 0) - step.at) < 1)) continue;
      state.queue.push({...step});
    }
    state.queue.sort((a, b) => (a.at || 0) - (b.at || 0));
    state.chain = next.skills.slice();
    state.chainStrikes = next.contacts.length;
    state.chainPlan = next;
    state.endMs = 0;
    advanceQueue();
    return next;
  }

  /** dt saniye (gerçek zaman); timeScale/paused uygulanır. */
  function update(dt) {
    if (state.disposed) return;
    const step = state.paused ? 0 : Math.max(0, Number(dt) || 0) * state.timeScale;
    state.elapsed += step * 1000;
    anim.tick(step * 1000);
    if (state.queue.length) advanceQueue();
    mixer.update(step);
    // Tek seferlik klip bitti → Idle (ko/win hariç; adım kuyruğu bitmiş olmalı).
    // Varyant kliplerinde endMs: klibin yalnız o pencereyi oynatır (r'nin uzun kuyruğu).
    const cur = state.current;
    if (cur && state.name !== 'idle' && state.name !== 'ko' && state.name !== 'win' && !state.queue.length) {
      const clip = cur.getClip?.();
      const endMs = state.endMs || (clip ? clip.duration * 1000 : 0);
      const reactionCap = anim.state.kind === 'hit' || anim.state.kind === 'block' ? 900 : Infinity;
      const beforeContact = anim.state.kind === 'attack' && state.elapsed < anim.state.contactMs;
      // Kombo zinciri: toplam süre dolmadan idle'a düşme (son kare tutulur, dönüş yürüyüşü planlıdır).
      const inChain = Boolean(state.chainPlan) && state.elapsed < state.chainPlan.totalMs && anim.state.kind === 'attack';
      const done = clip && !beforeContact && !inChain && (cur.time * 1000 >= endMs - 1 || !cur.isRunning?.() || state.elapsed >= reactionCap);
      if (done) finishToIdle(animFadeMs('attack', 'idle'));
    }
    for (let i = 0; i < fading.length; i++) {
      const fd = fading[i];
      if (!fd.action) continue;
      fd.left -= step * 1000;
      if (fd.left <= 0) { fd.action.stop?.(); fd.action = null; }
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
    state.disposed || (mixer.stopAllAction(), state.current = null, anim.reset(), fading.forEach(x => { x.action = null; }), goIdle(0));
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
    fighterId, seat, face, palette, choreo, reach, object, model, mixer, actions, bones, materials, height, scale,
    variant: variantReady ? variantName : null, stateClips,
    ultimatePeakMs: variantReady?.skills?.r?.peakMs || null,
    ultimateDurationMs: variantReady?.skills?.r ? clipMs(variantReady.skills.r.clip) : null,
    anim, play, plan, sceneDuration, update, setTimeScale, setPaused, setYaw, setTint, setOpacity, boneWorld, reset, dispose,
    /** Görev 4: kombo zinciri — plan(skills,{compress}) / oynat / aktif zincire ekleme. */
    playChain, extendChain, chainPlan: (skills, opts) => chainPlan(skills, opts),
    skillDuration: skill => (choreo[skill] ? skillDuration(choreo[skill]) : 0),
    stats: () => ({
      fighter: fighterId, state: state.name, clip: state.clip, clipTime: state.current?.time ?? 0, timeScale: state.timeScale, paused: state.paused,
      yaw: state.yaw, queued: state.queue.length, plays: state.plays, disposed: state.disposed,
      materials: materials.length, variant: variantReady ? variantName : null, height: height * scale,
      chain: state.chain.slice(), chainStrikes: state.chainStrikes,
      chainContacts: state.chainPlan ? state.chainPlan.contacts.map(c => c.ms) : [],
      chainTotalMs: state.chainPlan?.totalMs ?? 0,
      chainReturnStart: state.chainPlan?.returnStart ?? 0,
      chainMoveIn: state.chainPlan?.moveIn ?? 1,
      chainCompress: Boolean(state.chainPlan?.compress),
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

/**
 * Karaktere özel parçacık profilleri (yalnız kodla; doku CanvasTexture ile üretilir).
 * burst: [{color, n, speed, up, g (yerçekimi, + yukarı), life ms}]; trail: uçuş sırasında kare başına tek parçacık.
 */
export const SKILL_PROFILES = Object.freeze({
  vargr: Object.freeze({color: 0xff7a1a, accent: 0xfff0dc, // turuncu kor + beyaz kar
    burst: Object.freeze([{color: 0xff7a1a, n: 10, speed: 2.6, up: 1.4, g: -1.0, life: 640}, {color: 0xffffff, n: 7, speed: 1.3, up: 0.4, g: -1.5, life: 950}]),
    trail: Object.freeze({color: 0xffa24a, speed: 0.5, up: 0.6, g: 0.6, life: 420})}),
  sira: Object.freeze({color: 0xa14dff, accent: 0xe8d0ff, // mor ince iz + keskin kesik
    burst: Object.freeze([{color: 0xc58cff, n: 9, speed: 4.6, up: 0.3, g: -0.3, life: 300}, {color: 0xffffff, n: 3, speed: 6.5, up: 0, g: 0, life: 200}]),
    trail: Object.freeze({color: 0xb06bff, speed: 0.15, up: 0, g: 0, life: 520})}),
  doran: Object.freeze({color: 0xffc93c, accent: 0xfff3c4, // altın ışık sütunu + kalkan halkası
    burst: Object.freeze([{color: 0xffd35a, n: 10, speed: 1.7, up: 2.4, g: 0.5, life: 760}, {color: 0xfff3c4, n: 5, speed: 2.8, up: 0.2, g: 0, life: 420}]),
    trail: Object.freeze({color: 0xffd35a, speed: 0.3, up: 0.8, g: 0.5, life: 480})}),
  nyx: Object.freeze({color: 0x22d6e8, accent: 0xa56bff, // camgöbeği-mor rün + meteor kıvılcımı
    burst: Object.freeze([{color: 0x22d6e8, n: 7, speed: 3.2, up: 1.6, g: -2.2, life: 560}, {color: 0xa56bff, n: 7, speed: 2.4, up: 1.0, g: -1.8, life: 620}]),
    trail: Object.freeze({color: 0x9bf6ff, speed: 0.4, up: -0.3, g: -1.2, life: 360})}),
});
export const PARTICLE_POOL = Object.freeze({high: 128, low: 48});

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

  // ---- karakter parçacık havuzu: sabit tamponlar, kare başına tahsis yok
  const POOL = PARTICLE_POOL.high;
  let activeCap = POOL;         // düşük cihazda azalır (setLowQuality)
  const pPos = new Float32Array(POOL * 3);
  const pCol = new Float32Array(POOL * 3);
  const pVel = new Float32Array(POOL * 3);
  const pLife = new Float32Array(POOL);   // kalan ms
  const pMax = new Float32Array(POOL);
  const pG = new Float32Array(POOL);
  const pBase = new Float32Array(POOL * 3);
  let pCursor = 0;
  let pointsReady = false;
  let points = null;
  const tmpColor = new THREE.Color();
  if (THREE.Points && THREE.BufferGeometry && THREE.PointsMaterial) {
    const geo = g(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
    let map = null;
    try {
      if (typeof document !== 'undefined' && THREE.CanvasTexture) {
        const c = document.createElement('canvas'); c.width = c.height = 32;
        const ctx = c.getContext('2d');
        const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
        grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad; ctx.fillRect(0, 0, 32, 32);
        map = new THREE.CanvasTexture(c);
      }
    } catch { map = null; }
    const pm = new THREE.PointsMaterial({size: 0.16, map, vertexColors: true, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false, sizeAttenuation: true});
    mats.push(pm);
    if (map) geos.push({dispose: () => map.dispose()});
    points = new THREE.Points(geo, pm);
    points.name = 'pvp-char-particles';
    points.frustumCulled = false;
    points.renderOrder = 10;
    for (let i = 0; i < POOL; i++) pPos[i * 3 + 1] = -999;
    scene.add(points);
    pointsReady = true;
  }
  function emit(x, y, z, hex, vx, vy, vz, grav, life) {
    if (!pointsReady) return;
    const i = pCursor; pCursor = (pCursor + 1) % activeCap;
    pPos[i * 3] = x; pPos[i * 3 + 1] = y; pPos[i * 3 + 2] = z;
    pVel[i * 3] = vx; pVel[i * 3 + 1] = vy; pVel[i * 3 + 2] = vz;
    tmpColor.setHex(hex);
    pBase[i * 3] = tmpColor.r; pBase[i * 3 + 1] = tmpColor.g; pBase[i * 3 + 2] = tmpColor.b;
    pG[i] = grav; pLife[i] = pMax[i] = life;
  }
  /** Temas/varış patlaması: profil parçacıkları (düşük cihazda sayı x0,4). */
  function burst(profileId, pos, scale = 1) {
    const prof = SKILL_PROFILES[profileId];
    if (!prof || !pointsReady || !pos) return 0;
    const k = activeCap < POOL ? 0.4 : 1;
    let n = 0;
    for (const b of prof.burst) {
      const count = Math.max(1, Math.round(b.n * k));
      for (let j = 0; j < count; j++) {
        const a = (j / count) * Math.PI * 2 + b.speed * 0.37;
        const sp = b.speed * scale * (0.6 + 0.4 * ((j * 7) % 5) / 4);
        emit(pos.x, pos.y, pos.z, b.color, Math.cos(a) * sp, b.up * scale + Math.abs(Math.sin(a * 2)) * 0.6, Math.sin(a) * sp * 0.5, b.g * scale, b.life);
        n++;
      }
    }
    return n;
  }
  function updateParticles(dtMs) {
    if (!pointsReady) return;
    const dt = dtMs / 1000;
    let dirty = false;
    for (let i = 0; i < POOL; i++) {
      if (pLife[i] <= 0) continue;
      pLife[i] -= dtMs;
      dirty = true;
      if (pLife[i] <= 0) { pPos[i * 3 + 1] = -999; pCol[i * 3] = pCol[i * 3 + 1] = pCol[i * 3 + 2] = 0; continue; }
      pVel[i * 3 + 1] += pG[i] * dt;
      pPos[i * 3] += pVel[i * 3] * dt; pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt; pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
      const f = pLife[i] / pMax[i];
      pCol[i * 3] = pBase[i * 3] * f; pCol[i * 3 + 1] = pBase[i * 3 + 1] * f; pCol[i * 3 + 2] = pBase[i * 3 + 2] * f;
    }
    if (dirty && points) {
      points.geometry.attributes.position.needsUpdate = true;
      points.geometry.attributes.color.needsUpdate = true;
    }
  }
  function setLowQuality(low) { activeCap = low ? PARTICLE_POOL.low : POOL; if (pCursor >= activeCap) pCursor = 0; }

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

  function spawn({kind, from, to, color = 0xffffff, accent = 0xffffff, flight = 300, ms = 600, onArrive = null, follow = null, scale = 1, profile = null}) {
    if (!kind) return null;
    const prof = profile ? SKILL_PROFILES[profile] : null;
    if (prof) { color = prof.color; accent = prof.accent; }
    while (live.length >= MAX_FX) kill(live[0]);
    const {group, own} = make(kind, color, accent);
    group.scale.setScalar(scale);
    const item = {
      kind, group, own, age: 0, arrived: false, onArrive, follow, profile: prof ? profile : null,
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
    if (item.profile) burst(item.profile, item.to, item.group.scale.x || 1);
    try { item.onArrive?.(item.to.clone()); } catch { /* kozmetik */ }
  }

  function update(dt) {
    const step = Math.max(0, Math.min(0.1, Number(dt) || 0)) * 1000;
    time.value = (time.value + step / 1000) % 1000;
    updateParticles(step);
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
        if (item.profile && p < 1) {
          const tr = SKILL_PROFILES[item.profile].trail;
          emit(v.x, v.y, v.z, tr.color, tr.speed * Math.sin(k * 0.05), tr.up, tr.speed * Math.cos(k * 0.07), tr.g, tr.life);
        }
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
    if (points) { scene.remove(points); points = null; pointsReady = false; }
    for (const geometry of geos) geometry.dispose();
    for (const m of mats) m.dispose();
    geos.length = 0;
    mats.length = 0;
  }

  return {spawn, burst, update, clear, dispose, setLowQuality,
    stats: () => ({live: live.length, kinds: live.map(i => i.kind), particles: pLife.reduce((a, l) => a + (l > 0 ? 1 : 0), 0), cap: activeCap})};
}
