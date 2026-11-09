/**
 * TuşLab — Fight Motion (dövüş animasyonları)
 *
 * Cosmetic-only "weight" layer for the duel: wind-up + lunge for the attacker,
 * knockback + hit-flash for the defender, braces, staggers, arena shake and a
 * knockout finish. It never computes HP, damage or hit success; it only reacts
 * to authoritative server events (`tuslab:pvp-combat` details).
 *
 * Conflict-free layering
 * ----------------------
 * Existing CSS already animates `transform` on `.pvp3-rig` (breathe + translateX(-50%)),
 * on `.pvp3-model` (hit / fall / victory), on the PNG pieces and on `.pvp2-stage`
 * (camera jolt). To never fight those rules this module animates ONLY the
 * individual transform properties `translate`, `rotate` and `scale` (they compose
 * with `transform` instead of replacing it), plus `filter` / `opacity` for short
 * flashes. Shake is applied to `.pvp2-duel`, which nothing else transforms.
 *
 * All motion is WAAPI (`element.animate`) — compositor friendly, no layout work —
 * grouped in "channels" (one body channel per seat, one flash channel per seat,
 * one wobble channel per seat, one arena channel). A new animation on a channel
 * cancels the previous one, and a global cap bounds the total.
 */

export const FIGHT_MOTION_LIMITS = Object.freeze({maxActive: 14, koSlowMs: 1300});

/**
 * Vuruş koreografisi (ms = toplam süre, strike = vuruş anının oranı, reach = rig genişliğinin %'si kadar ileri,
 * lift = havaya kalkma %, crouch = hazırlıkta ölçek, wind/swing = silahın geri ve ileri açısı).
 * Rakibin geri savrulması strike anına (ms × strike) denk getirilir.
 */
/**
 * Her becerinin KENDİ hamlesi (karakter:beceri). pattern = hamle kalıbı, react = rakibin tepkisi.
 * ms = toplam süre, strike = vuruş anının oranı, reach = rig genişliğinin %'si kadar ileri (sahnedeki boşlukla sınırlanır),
 * lift = havaya kalkma (%), wind/swing = silahın geri/ileri açısı.
 */
export const FIGHT_SKILLS = Object.freeze({
  'fire:q':  Object.freeze({name: 'Alev Kesişi',       pattern: 'dash',     react: 'knock',  ms: 760,  strike: 0.46, reach: 42, lift: 0,   wind: -48,  swing: 72}),
  'fire:e':  Object.freeze({name: 'Yer Yaran Darbe',   pattern: 'slam',     react: 'squash', ms: 1050, strike: 0.58, reach: 46, lift: -28, wind: -115, swing: 45}),
  'fire:r1': Object.freeze({name: 'Kızıl Fırtına I',   pattern: 'spin',     react: 'knock',  ms: 900,  strike: 0.55, reach: 34, lift: 0,   wind: -40,  swing: 360}),
  'fire:r2': Object.freeze({name: 'Kızıl Fırtına II',  pattern: 'slam',     react: 'squash', ms: 1000, strike: 0.58, reach: 48, lift: -32, wind: -120, swing: 50}),
  'fire:r3': Object.freeze({name: 'Kızıl Fırtına III', pattern: 'slam',     react: 'launch', ms: 1200, strike: 0.6,  reach: 60, lift: -40, wind: -135, swing: 60}),
  'rune:q':  Object.freeze({name: 'Rün Kesişi',        pattern: 'thrust',   react: 'slide',  ms: 720,  strike: 0.34, reach: 56, lift: 0,   wind: -12,  swing: 88}),
  'rune:e':  Object.freeze({name: 'Sarsıcı Darbe',     pattern: 'uppercut', react: 'launch', ms: 1000, strike: 0.55, reach: 46, lift: -20, wind: 40,   swing: -75}),
  'rune:r1': Object.freeze({name: 'Sonsuz Mühür I',    pattern: 'blink',    react: 'slide',  ms: 950,  strike: 0.5,  reach: 50, lift: 0,   wind: -60,  swing: 70}),
  'rune:r2': Object.freeze({name: 'Sonsuz Mühür II',   pattern: 'uppercut', react: 'launch', ms: 1000, strike: 0.55, reach: 48, lift: -24, wind: 45,   swing: -80}),
  'rune:r3': Object.freeze({name: 'Sonsuz Mühür III',  pattern: 'slam',     react: 'launch', ms: 1200, strike: 0.6,  reach: 60, lift: -40, wind: -135, swing: 60}),
  'any:counter': Object.freeze({name: 'Karşı Saldırı',  pattern: 'thrust',   react: 'slide',  ms: 640,  strike: 0.34, reach: 40, lift: 0,   wind: -10,  swing: 80})
});
/** Geriye uyum: karaktersiz tablo (ateş). */
export const FIGHT_MOVES = Object.freeze({
  q: FIGHT_SKILLS['fire:q'], e: FIGHT_SKILLS['fire:e'], counter: FIGHT_SKILLS['any:counter'],
  r1: FIGHT_SKILLS['fire:r1'], r2: FIGHT_SKILLS['fire:r2'], r3: FIGHT_SKILLS['fire:r3']
});
export const skillSpec = (kind, character = 'fire') =>
  FIGHT_SKILLS[kind === 'counter' ? 'any:counter' : `${character === 'rune' ? 'rune' : 'fire'}:${kind}`] || FIGHT_SKILLS['fire:q'];
/** Bir hamlenin vuruş anı (ms): savunanın tepkisi buna göre zamanlanır. */
export const strikeAt = (kind, character = 'fire') => { const m = skillSpec(kind, character); return Math.round(m.ms * m.strike); };

/** Reference damage used to normalise knockback / shake (R phase 3 ≈ 140). */
const HEAVY_DAMAGE = 140;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const isSeat = seat => seat === 1 || seat === 2;
/** Seat 1 (fire) stands left and faces right (+x); seat 2 (rune) faces left. */
const facing = seat => (seat === 2 ? -1 : 1);
const pct = (x, y = 0) => `${x.toFixed(2)}% ${y.toFixed(2)}%`;
const deg = value => `${value.toFixed(2)}deg`;
const px = (x, y = 0) => `${x.toFixed(1)}px ${y.toFixed(1)}px`;

export function createFightMotion({root, isReduced = () => false, scheduler = globalThis} = {}) {
  let dead = false;
  const channels = new Map();   // channel key -> Animation
  const active = new Set();     // every live Animation (insertion order = age)
  const timers = new Set();
  let dropped = 0;

  // ---------------------------------------------------------------- helpers

  const reduced = () => {
    try {
      return Boolean(isReduced()) || Boolean(root?.classList?.contains?.('pvp4-reduced'));
    } catch {
      return false;
    }
  };

  const query = selector => {
    try {
      return root?.querySelector?.(selector) || null;
    } catch {
      return null;
    }
  };

  const sideOf = seat => query(`.pvp2-side[data-seat="${seat}"]`);
  const rigOf = seat => sideOf(seat)?.querySelector?.('.pvp3-rig') || null;
  const modelOf = seat => rigOf(seat)?.querySelector?.('.pvp3-model') || null;
  const arena = () => query('.pvp2-duel');

  function later(fn, ms) {
    if (dead || typeof scheduler?.setTimeout !== 'function') return null;
    const handle = scheduler.setTimeout(() => {
      timers.delete(handle);
      if (!dead) fn();
    }, ms);
    timers.add(handle);
    return handle;
  }

  function forget(animation) {
    active.delete(animation);
    for (const [key, value] of channels) if (value === animation) channels.delete(key);
  }

  /**
   * Start one WAAPI animation on `channel`. Replaces whatever that channel was
   * playing and evicts the oldest animation once the global cap is reached.
   * Returns the Animation or null (missing element / no WAAPI / destroyed).
   */
  function play(channel, element, keyframes, options) {
    if (dead || !element || typeof element.animate !== 'function') return null;
    const previous = channels.get(channel);
    if (previous) {
      forget(previous);
      try { previous.cancel(); } catch { /* already gone */ }
    }
    while (active.size >= FIGHT_MOTION_LIMITS.maxActive) {
      const oldest = active.values().next().value;
      forget(oldest);
      dropped++;
      try { oldest.cancel(); } catch { /* already gone */ }
    }
    let animation;
    try {
      animation = element.animate(keyframes, {fill: 'none', ...options});
    } catch {
      return null;
    }
    if (!animation) return null;
    channels.set(channel, animation);
    active.add(animation);
    const done = () => {
      // `fill: forwards` animations (KO pose) stay tracked so clear() can undo them.
      if (options?.fill !== 'forwards') forget(animation);
    };
    if (typeof animation.addEventListener === 'function') {
      animation.addEventListener('finish', done);
      animation.addEventListener('cancel', () => forget(animation));
    } else {
      animation.onfinish = done;
    }
    return animation;
  }

  // ------------------------------------------------------------ primitives

  /** Tiny opacity blink — the only motion allowed in reduced mode. */
  function blink(seat) {
    return play(`flash:${seat}`, modelOf(seat), [
      {opacity: 1}, {opacity: 0.72}, {opacity: 1}
    ], {duration: 160, easing: 'ease-out'});
  }

  /** White hit-flash on the model (filter only; rig keeps its drop-shadow). */
  function hitFlash(seat, strength) {
    const peak = 1.6 + strength * 1.4;
    return play(`flash:${seat}`, modelOf(seat), [
      {filter: `brightness(${peak.toFixed(2)}) saturate(0.35)`, offset: 0},
      {filter: `brightness(${(peak * 0.8).toFixed(2)}) saturate(0.5)`, offset: 0.25},
      {filter: 'brightness(1) saturate(1)', offset: 1}
    ], {duration: 140 + strength * 120, easing: 'ease-out'});
  }

  /** Arena shake on `.pvp2-duel`, magnitude in px. */
  function shake(magnitude, duration) {
    if (reduced() || magnitude <= 0) return null;
    const m = clamp(magnitude, 0, 14);
    const frames = [];
    const steps = 7;
    for (let i = 0; i <= steps; i++) {
      const decay = 1 - i / steps;
      const sign = i % 2 === 0 ? 1 : -1;
      frames.push({translate: i === 0 || i === steps ? '0px 0px' : px(sign * m * decay, (i % 3 - 1) * m * 0.45 * decay)});
    }
    return play('arena', arena(), frames, {duration, easing: 'linear'});
  }

  /**
   * Dövüş hareketi v2 — tek parça "dönme" yerine okunur bir vuruş:
   *   hazırlık (geri çekil + çömel, silah geri) → atılış (rakibe doğru belirgin hamle, hız çizgileri, toz)
   *   → vuruş (silah geniş yay, temas) → kısa donma → sıçrayarak yerine dönüş.
   * Gövde = .pvp3-rig (translate/scale/rotate), silah = .pvp3-weapon (yalnız rotate, ayrı kanal).
   * Süreler oyun içeriğidir (UI değil): okunabilirlik için 0,6–1,2 sn.
   */
  const characterOf = seat => {
    const id = rigOf(seat)?.dataset?.rig;
    return id === 'rune' || id === 'fire' ? id : (seat === 2 ? 'rune' : 'fire');
  };
  const variantN = {1: 0, 2: 0};
  const VARIATION = [1, 0.88, 1.1];
  const lastMove = {1: null, 2: null};

  /** Hamle kalıpları: her biri gövde (rig) ve silah için ayrı kare dizisi üretir. */
  function moveFrames(m, d, reach, k) {
    const s = m.strike, L = m.lift * k, W = m.wind, S = m.swing * (m.pattern === 'spin' ? 1 : k);
    const e = (o, t, sc, r, ease) => ({offset: o, translate: t, scale: sc, rotate: r, easing: ease || 'ease-in-out'});
    const hold = x => Math.min(0.9, x);
    switch (m.pattern) {
      case 'slam': return { // sıçra -> tepeden yere vur -> iniş ezilmesi
        body: [e(0, pct(0), '1 1', '0deg', 'ease-out'), e(s * 0.3, pct(-3 * d, 3), '1.12 0.86', deg(-4 * d), 'cubic-bezier(.3,0,.6,1)'),
          e(s * 0.72, pct(reach * 0.62 * d, L), '0.92 1.1', deg(8 * d), 'cubic-bezier(.5,0,.9,.6)'), e(s, pct(reach * d, 2), '1.18 0.82', deg(2 * d), 'ease-out'),
          e(hold(s + 0.12), pct(reach * 0.97 * d, 0), '1 1', deg(1 * d)), e(0.92, pct(5 * d, 0), '1 1', '0deg'), e(1, pct(0), '1 1', '0deg')],
        weapon: [{offset: 0, rotate: '0deg'}, {offset: s * 0.3, rotate: deg(-40 * d)}, {offset: s * 0.72, rotate: deg(W * d), easing: 'cubic-bezier(.7,0,1,.5)'},
          {offset: s, rotate: deg(S * d)}, {offset: hold(s + 0.12), rotate: deg(S * 0.85 * d)}, {offset: 0.92, rotate: deg(8 * d)}, {offset: 1, rotate: '0deg'}]};
      case 'thrust': return { // geri çekilmeden doğrudan uzun dürtme, yavaş geri çekme
        body: [e(0, pct(0), '1 1', '0deg', 'ease-out'), e(s * 0.35, pct(2 * d, 1), '1.03 0.97', deg(2 * d), 'cubic-bezier(.6,0,1,.6)'),
          e(s, pct(reach * d, 0), '0.95 1.04', deg(4 * d), 'linear'), e(Math.min(0.85, s + 0.18), pct(reach * 0.98 * d, 0), '1 1', deg(3 * d), 'ease-in-out'),
          e(0.9, pct(reach * 0.2 * d, 0), '1 1', deg(1 * d)), e(1, pct(0), '1 1', '0deg')],
        weapon: [{offset: 0, rotate: '0deg'}, {offset: s * 0.35, rotate: deg(W * d), easing: 'cubic-bezier(.6,0,1,.6)'}, {offset: s, rotate: deg(S * d)},
          {offset: Math.min(0.85, s + 0.18), rotate: deg(S * 0.96 * d)}, {offset: 0.92, rotate: deg(6 * d)}, {offset: 1, rotate: '0deg'}]};
      case 'uppercut': return { // çömel -> alçaktan atıl -> yukarı doğru vur
        body: [e(0, pct(0), '1 1', '0deg', 'ease-out'), e(s * 0.42, pct(-2 * d, 5), '1.14 0.84', deg(-5 * d), 'cubic-bezier(.6,0,.9,.5)'),
          e(s * 0.8, pct(reach * 0.85 * d, 3), '1.04 0.96', deg(2 * d), 'ease-out'), e(s, pct(reach * d, L), '0.9 1.12', deg(-6 * d), 'ease-out'),
          e(Math.min(0.88, s + 0.16), pct(reach * 0.9 * d, L * 0.3), '1 1', deg(-2 * d)), e(0.92, pct(4 * d, 0), '1 1', '0deg'), e(1, pct(0), '1 1', '0deg')],
        weapon: [{offset: 0, rotate: '0deg'}, {offset: s * 0.42, rotate: deg(W * d)}, {offset: s * 0.8, rotate: deg(W * 1.4 * d), easing: 'cubic-bezier(.7,0,1,.5)'},
          {offset: s, rotate: deg(S * d)}, {offset: Math.min(0.88, s + 0.16), rotate: deg(S * 0.8 * d)}, {offset: 0.94, rotate: deg(-8 * d)}, {offset: 1, rotate: '0deg'}]};
      case 'spin': return { // asayı çevirerek ileri kay (çoklu vuruş hissi)
        body: [e(0, pct(0), '1 1', '0deg', 'ease-out'), e(s * 0.3, pct(-2 * d, 2), '1.06 0.94', deg(-3 * d)),
          e(s, pct(reach * d, 0), '1 1', deg(5 * d), 'linear'), e(Math.min(0.86, s + 0.2), pct(reach * 1.05 * d, 0), '1 1', deg(-4 * d)),
          e(0.92, pct(4 * d, 0), '1 1', '0deg'), e(1, pct(0), '1 1', '0deg')],
        // 360 derece sonunda görüntü başlangıçla aynı: geri sarılma görünmez.
        weapon: [{offset: 0, rotate: '0deg'}, {offset: s * 0.3, rotate: deg(W * d), easing: 'linear'}, {offset: Math.min(0.86, s + 0.2), rotate: deg((360 + 40) * d)},
          {offset: 1, rotate: deg(360 * d)}]};
      case 'blink': return { // kaybol -> rakibin önünde belir -> vur -> yürüyerek dön
        body: [{offset: 0, translate: pct(0), opacity: 1, scale: '1 1'}, {offset: 0.18, translate: pct(0), opacity: 0, scale: '0.9 1.08'},
          {offset: 0.26, translate: pct(reach * d, 0), opacity: 0, scale: '0.9 1.08'}, {offset: 0.34, translate: pct(reach * d, 0), opacity: 1, scale: '1.04 0.97'},
          {offset: s, translate: pct(reach * 1.0 * d, 0), opacity: 1, scale: '1 1'}, {offset: Math.min(0.85, s + 0.16), translate: pct(reach * 0.98 * d, 0), opacity: 1, scale: '1 1'},
          {offset: 0.92, translate: pct(5 * d, 0), opacity: 1, scale: '1 1'}, {offset: 1, translate: pct(0), opacity: 1, scale: '1 1'}],
        weapon: [{offset: 0, rotate: '0deg'}, {offset: 0.34, rotate: deg(W * d), easing: 'cubic-bezier(.7,0,1,.6)'}, {offset: s, rotate: deg(S * d)},
          {offset: Math.min(0.85, s + 0.16), rotate: deg(S * 0.9 * d)}, {offset: 1, rotate: '0deg'}]};
      case 'dash': default: return { // geri çekil -> atıl -> yatay kesik -> sıçrayarak dön
        body: [e(0, pct(0), '1 1', '0deg', 'cubic-bezier(.2,.8,.3,1)'), e(s * 0.42, pct(-9 * d, 2), '1.07 0.93', deg(-6 * d), 'cubic-bezier(.6,0,.9,.5)'),
          e(s * 0.88, pct(reach * 0.86 * d, L), '0.93 1.08', deg(7 * d), 'ease-out'), e(s, pct(reach * d, L * 0.35), '1.05 0.96', deg(4 * d), 'linear'),
          e(hold(s + 0.1), pct(reach * 0.97 * d, 0), '1 1', deg(3 * d), 'cubic-bezier(.3,0,.5,1)'), e(Math.max(hold(s + 0.1) + 0.02, 0.84), pct(7 * d, -5), '1 1', deg(-2 * d), 'cubic-bezier(.4,0,.6,1)'),
          e(1, pct(0), '1 1', '0deg')],
        weapon: [{offset: 0, rotate: '0deg', easing: 'ease-out'}, {offset: s * 0.42, rotate: deg(W * d), easing: 'ease-in'},
          {offset: s * 0.82, rotate: deg(W * 0.7 * d), easing: 'cubic-bezier(.7,0,1,.6)'}, {offset: s, rotate: deg(S * d)},
          {offset: hold(s + 0.1), rotate: deg(S * 0.9 * d), easing: 'ease-in-out'}, {offset: Math.max(hold(s + 0.1) + 0.02, 0.86), rotate: deg(12 * d), easing: 'ease-out'}, {offset: 1, rotate: '0deg'}]};
    }
  }

  /**
   * Dövüş hareketi v3: her beceri kendi hamlesini oynar (FIGHT_SKILLS); aynı beceri art arda gelince
   * mesafe/açı biraz değişir (tıpatıp aynı görünmesin). Gövde = .pvp3-rig, silah = .pvp3-weapon (ayrı kanal).
   */
  function lunge(seat, kind) {
    const rig = rigOf(seat);
    if (!rig) return null;
    const m = skillSpec(kind, characterOf(seat));
    const d = facing(seat);
    const k = VARIATION[variantN[seat]];
    variantN[seat] = (variantN[seat] + 1) % VARIATION.length; // ilk vuruş tam değerle
    // Atılış mesafesi sahnede kalan boş alanla sınırlı: taşanı sahne kestiği için kol/silah kenarda kesilmesin.
    let reach = m.reach * k;
    try {
      const clipBox = rig.closest?.('.pvp2-stage') || sideOf(seat);
      const rr = rig.getBoundingClientRect?.(), sr = clipBox?.getBoundingClientRect?.();
      if (rr && sr && rr.width > 0) {
        const free = d > 0 ? sr.right - rr.right : rr.left - sr.left;
        reach = clamp(((free - 4) / rr.width) * 100, 0, reach);
      }
    } catch { /* ölçülemezse tablo değeri */ }
    lastMove[seat] = m;
    // CSS'teki eski kısa silah savurmasıyla üst üste binmesin (açı katlanmasın).
    rig.classList?.add?.('pvpfm-acting');
    later(() => rig.classList?.remove?.('pvpfm-acting'), m.ms + 40);
    const f = moveFrames(m, d, reach, k);
    const body = play(`body:${seat}`, rig, f.body, {duration: m.ms, easing: 'linear'});
    play(`weapon:${seat}`, rig.querySelector?.('.pvp3-weapon'), f.weapon, {duration: m.ms, easing: 'linear'});
    if (m.pattern !== 'blink') dashFx(seat, m);
    if (m.pattern === 'slam') later(() => shake(4 + Math.abs(m.lift) / 8, 260), Math.round(m.ms * m.strike));
    return body;
  }

  /** Hız çizgileri (atılış) ve toz (kalkış + iniş): rig içinde, modelin arkasında; tek seferlik. */
  function dashFx(seat, m) {
    const rig = rigOf(seat);
    const doc = rig?.ownerDocument;
    if (!rig || !doc?.createElement) return;
    const ensure = cls => {
      let el = rig.querySelector?.(`.${cls}`);
      if (!el) { el = doc.createElement('i'); el.className = cls; el.setAttribute?.('aria-hidden', 'true'); rig.appendChild?.(el); }
      return el;
    };
    const streaks = ensure('pvpfm-streaks');
    const dust = ensure('pvpfm-dust');
    const d = facing(seat);
    const s = m.strike;
    play(`streaks:${seat}`, streaks, [
      {offset: 0, opacity: 0, scale: `0.3 1`, translate: pct(0)},
      {offset: s * 0.5, opacity: 0, scale: `0.3 1`, translate: pct(0)},
      {offset: s * 0.9, opacity: 0.85, scale: `1 1`, translate: pct(-10 * d)},
      {offset: Math.min(0.95, s + 0.12), opacity: 0, scale: `1.3 1`, translate: pct(-24 * d)},
      {offset: 1, opacity: 0}
    ], {duration: m.ms, easing: 'linear'});
    play(`dust:${seat}`, dust, [
      {offset: 0, opacity: 0, scale: '0.4 0.4'},
      {offset: s * 0.45, opacity: 0.75, scale: '0.8 0.6'},
      {offset: s * 0.8, opacity: 0, scale: '1.5 0.9'},
      {offset: 0.86, opacity: 0.55, scale: '0.7 0.5'},
      {offset: 1, opacity: 0, scale: '1.4 0.8'}
    ], {duration: m.ms, easing: 'ease-out'});
  }

  /** Rakibin tepkisi hamleye göre: knock (geri savrul), slide (geriye kay), squash (ez + sek), launch (havaya fırla, düş). */
  function react(seat, strength, style) {
    const d = -facing(seat);
    const rig = rigOf(seat);
    switch (style) {
      case 'slide': return play(`body:${seat}`, rig, [
        {offset: 0, translate: pct(0), scale: '1 1', rotate: '0deg'}, {offset: 0.12, translate: pct(3 * d, 1), scale: '1.06 0.95', rotate: deg(-3 * d)},
        {offset: 0.5, translate: pct((9 + strength * 9) * d, 1), scale: '1.04 0.97', rotate: deg(-4 * d)}, {offset: 0.75, translate: pct((7 + strength * 6) * d, 0), scale: '1 1', rotate: deg(-1 * d)},
        {offset: 1, translate: pct(0), scale: '1 1', rotate: '0deg'}], {duration: 620 + strength * 300, easing: 'ease-out'});
      case 'squash': return play(`body:${seat}`, rig, [
        {offset: 0, translate: pct(0), scale: '1 1', rotate: '0deg'}, {offset: 0.12, translate: pct(3 * d, 3), scale: '1.18 0.8', rotate: deg(-2 * d)},
        {offset: 0.38, translate: pct(6 * d, -8), scale: '0.94 1.06', rotate: deg(-6 * d)}, {offset: 0.6, translate: pct(8 * d, 2), scale: '1.1 0.9', rotate: deg(-2 * d)},
        {offset: 1, translate: pct(0), scale: '1 1', rotate: '0deg'}], {duration: 760 + strength * 300, easing: 'ease-out'});
      case 'launch': return play(`body:${seat}`, rig, [
        {offset: 0, translate: pct(0), scale: '1 1', rotate: '0deg'}, {offset: 0.1, translate: pct(3 * d, 0), scale: '1.05 0.95', rotate: deg(-4 * d)},
        {offset: 0.4, translate: pct((10 + strength * 8) * d, -(16 + strength * 14)), scale: '0.96 1.04', rotate: deg(-(10 + strength * 10) * d), easing: 'cubic-bezier(.4,0,1,1)'},
        {offset: 0.62, translate: pct((14 + strength * 8) * d, 3), scale: '1.14 0.86', rotate: deg(-3 * d)}, {offset: 0.78, translate: pct((12 + strength * 6) * d, 0), scale: '1 1', rotate: '0deg'},
        {offset: 1, translate: pct(0), scale: '1 1', rotate: '0deg'}], {duration: 900 + strength * 360, easing: 'ease-out'});
      default: return knockback(seat, strength);
    }
  }

  /** Unblocked damage: knockback scaled by strength (0..1) with a hit-stop hold. */
  function knockback(seat, strength) {
    const d = -facing(seat); // pushed away from the opponent
    const push = 5 + strength * 15;
    const tilt = 3 + strength * 9;
    return play(`body:${seat}`, rigOf(seat), [
      {translate: pct(0), rotate: '0deg', offset: 0},
      {translate: pct(push * 0.35 * d), rotate: deg(-tilt * 0.4 * d), offset: 0.08},   // impact
      {translate: pct(push * 0.4 * d), rotate: deg(-tilt * 0.45 * d), offset: 0.2},    // hit-stop hold
      {translate: pct(push * d, strength * 2), rotate: deg(-tilt * d), offset: 0.45},  // fly back
      {translate: pct(push * 0.3 * d), rotate: deg(tilt * 0.25 * d), offset: 0.72},    // recoil
      {translate: pct(0), rotate: '0deg', offset: 1}
    ], {duration: 520 + strength * 380, easing: 'cubic-bezier(.2,.7,.35,1)'});
  }

  /** Low HP: one-shot unsteady wobble on the model (separate channel). */
  function wobble(seat) {
    const d = facing(seat);
    return play(`wobble:${seat}`, modelOf(seat), [
      {rotate: '0deg'}, {rotate: deg(-3 * d)}, {rotate: deg(2 * d)}, {rotate: deg(-1.5 * d)}, {rotate: '0deg'}
    ], {duration: 900, delay: 320, easing: 'ease-in-out'});
  }

  /** Block: brace and slide back a little. */
  function brace(seat, strength = 0.4) {
    const d = -facing(seat);
    const slide = 3 + strength * 4;
    return play(`body:${seat}`, rigOf(seat), [
      {translate: pct(0), scale: '1 1', offset: 0},
      {translate: pct(slide * d, 1), scale: '1.05 0.95', offset: 0.3},
      {translate: pct(slide * 0.8 * d, 1), scale: '1.04 0.96', offset: 0.55},
      {translate: pct(0), scale: '1 1', offset: 1}
    ], {duration: 360, easing: 'ease-out'});
  }

  /** Parried attacker / broken shield: stumble backwards with a wobble. */
  function stagger(seat, big = false) {
    const d = -facing(seat);
    const k = big ? 1.5 : 1;
    return play(`body:${seat}`, rigOf(seat), [
      {translate: pct(0), rotate: '0deg', offset: 0},
      {translate: pct(8 * k * d, 1), rotate: deg(-7 * k * d), offset: 0.22},
      {translate: pct(10 * k * d, 2), rotate: deg(5 * k * d), offset: 0.45},
      {translate: pct(7 * k * d, 1), rotate: deg(-3 * k * d), offset: 0.65},
      {translate: pct(0), rotate: '0deg', offset: 1}
    ], {duration: big ? 720 : 560, easing: 'ease-out'});
  }

  // ------------------------------------------------------------ public API

  /**
   * Map one server combat event to motion. Returns true when something was
   * (or, in reduced mode, minimally) animated; false for ignored events.
   */
  function handle(event) {
    if (dead || !event || typeof event !== 'object') return false;
    const low = reduced();
    switch (event.type) {
      case 'SKILL_CAST': {
        const seat = event.fromSeat;
        if (!isSeat(seat)) return false;
        // A resolved turn arrives as a cast/damage pair. Give the attacker the
        // first beat, then let the defender visibly meet the incoming effect.
        if ((event.resolve === true || event.arena === true) && (event.defenderAction === 'brace' || event.arena === true) && isSeat(event.toSeat) && !low) {
          later(() => brace(event.toSeat, 0.25), Math.max(120, strikeAt(event.skill === 'e' ? 'e' : event.skill === 'r' ? 'r1' : 'q', characterOf(seat)) - 120));
        }
        if (event.skill === 'q' || event.skill === 'e') return Boolean(low ? blink(seat) : lunge(seat, event.skill));
        // R is driven per ULTIMATE_PHASE; the cast itself is only a charge-up.
        if (event.skill === 'r') return Boolean(low ? blink(seat) : lunge(seat, 'r1'));
        return false;
      }
      case 'ULTIMATE_PHASE': {
        const seat = event.fromSeat;
        const phase = clamp(Number(event.phase) || 1, 1, 3);
        if (!isSeat(seat)) return false;
        if (low) return Boolean(blink(seat));
        const ok = lunge(seat, `r${phase}`);
        if (phase === 3) shake(10, 520);
        return Boolean(ok);
      }
      case 'COUNTERATTACK_CAST': {
        const seat = event.fromSeat;
        if (!isSeat(seat)) return false;
        return Boolean(low ? blink(seat) : lunge(seat, 'counter'));
      }
      case 'SHIELD_TRIGGERED': {
        if (!isSeat(event.seat)) return false;
        if (low) return Boolean(blink(event.seat));
        return Boolean(brace(event.seat, event.kind === 'PERFECT_BLOCK' ? 0.2 : 0.5));
      }
      case 'PARRY_TRIGGERED': {
        if (!isSeat(event.seat)) return false;
        if (low) return Boolean(blink(event.seat));
        brace(event.seat, 0.15);
        const attacker = isSeat(event.againstSeat) ? event.againstSeat : 3 - event.seat;
        stagger(attacker, false);
        shake(3, 220);
        return true;
      }
      case 'SHIELD_BROKEN': {
        if (!isSeat(event.seat)) return false;
        if (low) return Boolean(blink(event.seat));
        stagger(event.seat, true);
        hitFlash(event.seat, 0.5);
        shake(5, 320);
        return true;
      }
      case 'DAMAGE_APPLIED': {
        const seat = event.toSeat;
        if (!isSeat(seat)) return false;
        if ((event.resolve === true || event.arena === true) && !event._motionBeat) {
          // Savunanın tepkisi saldıranın VURUŞ anına denk gelsin (hamle süresinin strike oranı).
          const kind = event.skill === 'r' ? `r${clamp(Number(event.phase) || 1, 1, 3)}` : event.skill === 'e' ? 'e' : event.counter ? 'counter' : 'q';
          const attacker = isSeat(event.fromSeat) ? event.fromSeat : 3 - seat;
          later(() => handle({...event, _motionBeat: true}), strikeAt(kind, characterOf(attacker)));
          return true;
        }
        if (low) return Boolean(blink(seat));
        const amount = Math.max(0, Number(event.amount) || 0);
        const isUltFinisher = event.skill === 'r' && Number(event.phase) === 3;
        let strength = clamp(amount / HEAVY_DAMAGE, 0.15, 1);
        if (isUltFinisher) strength = 1;
        if (event.blocked) {
          brace(seat, 0.3);
          shake(1.5 + strength * 2, 200);
          return true;
        }
        // Tepki saldıranın hamlesine göre (her beceri farklı vurur -> farklı savrulur).
        const attackerSeat = isSeat(event.fromSeat) ? event.fromSeat : 3 - seat;
        const kindNow = event.skill === 'r' ? `r${clamp(Number(event.phase) || 1, 1, 3)}` : event.skill === 'e' ? 'e' : event.counter ? 'counter' : 'q';
        react(seat, strength, skillSpec(kindNow, characterOf(attackerSeat)).react);
        hitFlash(seat, strength);
        shake(2 + strength * (isUltFinisher ? 10 : 6), 200 + strength * 260);
        const maxHp = Number(event.maxHp) > 0 ? Number(event.maxHp) : 2000;
        const hpAfter = Number(event.hpAfter);
        if (Number.isFinite(hpAfter) && hpAfter > 0 && hpAfter / maxHp < 0.3) wobble(seat);
        return true;
      }
      default:
        return false;
    }
  }

  /**
   * Knockout finish: a slow-motion beat on the arena, loser collapses and stays
   * down (fill: forwards until clear()), winner does a victory hop.
   * winnerSeat null/undefined (draw) -> only the slow beat.
   */
  function onMatchEnd({winnerSeat} = {}) {
    if (dead) return false;
    const winner = isSeat(winnerSeat) ? winnerSeat : null;
    const loser = winner ? 3 - winner : null;
    if (reduced()) {
      if (winner) blink(winner);
      return true;
    }
    const slow = FIGHT_MOTION_LIMITS.koSlowMs;
    const field = arena();
    // Slow-motion feel: a long, heavily eased push-in + desaturate on the arena.
    play('arena', field, [
      {scale: '1', filter: 'saturate(1) brightness(1)', offset: 0},
      {scale: '1.025', filter: 'saturate(0.55) brightness(1.12)', offset: 0.12},
      {scale: '1.03', filter: 'saturate(0.6) brightness(1)', offset: 0.7},
      {scale: '1', filter: 'saturate(1) brightness(1)', offset: 1}
    ], {duration: slow, easing: 'cubic-bezier(.1,.9,.2,1)'});
    field?.classList?.add?.('pvpfm-ko');
    later(() => field?.classList?.remove?.('pvpfm-ko'), slow);

    if (loser) {
      const d = -facing(loser);
      play(`body:${loser}`, rigOf(loser), [
        {translate: pct(0), rotate: '0deg', scale: '1 1', opacity: 1, offset: 0},
        {translate: pct(6 * d, -3), rotate: deg(-6 * d), scale: '1 1', opacity: 1, offset: 0.18},   // last reel
        {translate: pct(10 * d, 2), rotate: deg(6 * d), scale: '1.03 0.97', opacity: 1, offset: 0.55},
        {translate: pct(12 * d, 7), rotate: deg(9 * d), scale: '1.06 0.92', opacity: 0.82, offset: 1} // collapsed
      ], {duration: slow, easing: 'cubic-bezier(.3,.05,.5,1)', fill: 'forwards'});
    }
    if (winner) {
      // Hop starts once the loser has visibly begun to fall.
      later(() => {
        play(`body:${winner}`, rigOf(winner), [
          {translate: pct(0), scale: '1 1', offset: 0},
          {translate: pct(0, 2), scale: '1.07 0.93', offset: 0.15},
          {translate: pct(0, -12), scale: '0.95 1.06', offset: 0.42},
          {translate: pct(0, 1), scale: '1.05 0.95', offset: 0.66},
          {translate: pct(0, -4), scale: '1 1', offset: 0.82},
          {translate: pct(0), scale: '1 1', offset: 1}
        ], {duration: 820, easing: 'ease-out'});
      }, Math.round(slow * 0.35));
    }
    return true;
  }

  /** Cancel every animation and pending timer (e.g. new match / view closed). */
  function clear() {
    for (const handleId of timers) scheduler?.clearTimeout?.(handleId);
    timers.clear();
    for (const animation of [...active]) {
      forget(animation);
      try { animation.cancel(); } catch { /* ignore */ }
    }
    active.clear();
    channels.clear();
    arena()?.classList?.remove?.('pvpfm-ko');
  }

  function destroy() {
    if (dead) return;
    clear();
    dead = true;
  }

  const stats = () => ({active: active.size, timers: timers.size, dropped, destroyed: dead});

  return {handle, onMatchEnd, clear, destroy, stats};
}
