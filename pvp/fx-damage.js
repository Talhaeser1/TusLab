// TuşLab Neon Arena — hasar / vuruş yazıları (damage numbers).
//
// Paket 33: every number / label is a real text node styled as bold, outlined,
// fighting-game lettering (pvp/fx-damage.css). The browser rasterises it at the
// device pixel ratio, so it stays sharp at every zoom level. No external fonts.
//
// Public API:
//   const dmg = createDamageNumbers({ root, isReduced, now, scheduler, random });
//   dmg.handle(combatEvent)  -> true if something was drawn, false if ignored
//   dmg.clear()              -> remove every live number / ticker, cancel timers
//   dmg.destroy()            -> clear() and make further handle() calls no-ops
//   dmg.liveCount(seat)      -> number of live floating numbers on a side (tests/debug)
//
// Events consumed (server-authoritative `tuslab:pvp-combat` details):
//   DAMAGE_APPLIED  {toSeat, fromSeat, amount, skill, blocked, blockKind,
//                    counter, shieldBreak, bonusTags[], phase?, totalPhases?}
//   SHIELD_BROKEN   {seat}
// Other combat events (SKILL_CAST, ULTIMATE_PHASE, SHIELD_TRIGGERED,
// PARRY_TRIGGERED, COUNTERATTACK_CAST) are intentionally ignored: the matching
// DAMAGE_APPLIED already carries the amount, block kind, counter flag and the
// ultimate phase, so reacting to both would draw every hit twice.

/** Every fixed label this module can draw. */
export const LABELS = Object.freeze({
  block: 'BLOK',
  parry: 'PARRY!',
  perfect: 'PERFECT!',
  crit: 'KRİTİK',
  counter: 'KONTRA',
  combo: 'KOMBO',
  assist: 'DESTEK',
  shieldBreak: 'KALKAN KIRIK!',
});

// ---------------------------------------------------------------------------
// Palettes ("style by meaning")
// ---------------------------------------------------------------------------

// fill: main ink, top: highlight (upper half of the glyphs), line: outline,
// shadow: hard drop shadow under the outline. Exposed to CSS as custom properties.
export const PALETTES = Object.freeze({
  // KESINYAP 14: Q beyaz-sarı · E turuncu/camgöbeği · R altın (ultimate).
  fire:    { fill: '#fff3b4', top: '#ffffff', line: '#ffb020', shadow: '#2a0a06' },
  rune:    { fill: '#fff6c8', top: '#ffffff', line: '#ffc23a', shadow: '#120a2e' },
  skillFire: { fill: '#ffa650', top: '#ffe2bd', line: '#ff5a00', shadow: '#2a0500' },
  skillRune: { fill: '#8defff', top: '#e6fcff', line: '#00b7ff', shadow: '#0a0630' },
  ultimate: { fill: '#ffc93c', top: '#fff7b8', line: '#7a2c00', shadow: '#1a0800' },
  counter: { fill: '#9ffcff', top: '#ffffff', line: '#007c91', shadow: '#00151c' },
  block:   { fill: '#bfefff', top: '#ffffff', line: '#1f5fa8', shadow: '#06142b' },
  parry:   { fill: '#ffffff', top: '#ffffff', line: '#00b7ff', shadow: '#001a2b' },
  perfect: { fill: '#fff3a0', top: '#ffffff', line: '#b07800', shadow: '#241600' },
  crit:    { fill: '#ffd45a', top: '#fff7b8', line: '#b07800', shadow: '#000000' },
  shatter: { fill: '#ff6b81', top: '#ffd0d8', line: '#4a0012', shadow: '#000000' },
  combo:   { fill: '#ffe08a', top: '#fffbe0', line: '#3b2400', shadow: '#000000' },
  phase:   { fill: '#fff7b8', top: '#ffffff', line: '#7a2c00', shadow: '#000000' },
});

/**
 * Paket 33: net vektör tipografi. Önceki küçük bitmap font yerine DOM metni kullanılır.
 * Artık her satır gerçek bir metin düğümü: tarayıcı onu devicePixelRatio'da, hedef boyutta çizer
 * (keskin kenar; dış hat + gölge CSS'te). Boyutlar CSS pikseli; ≤720 px ekranda --pxd-scale ile küçülür
 * (en küçük etiket yine ≥ 12 px).
 */
export const FONT_SIZE = Object.freeze({ normal: 34, skill: 42, ultimate: 46, label: 18, labelHot: 18, tag: 18, combo: 18 });

/**
 * Eski sabit şeritler (geriye uyumluluk ve testler için dışa aktarılıyor). Nişancı (docs/27): yerleşim artık
 * `placeNumber` ile ölçüye göre yapılır; sabit şeritler geniş sayılarda ("-200" yanında "-10") üst üste biniyordu.
 */
export const LANES = Object.freeze([
  Object.freeze({ x: 0, y: 0 }),
  Object.freeze({ x: -96, y: 44 }),
  Object.freeze({ x: 96, y: -30 }),
  Object.freeze({ x: 0, y: -92 }),
  Object.freeze({ x: -96, y: -92 }),
  Object.freeze({ x: 96, y: -92 }),
]);
/** busy: şu an kullanılan şerit numaraları (eskiden yeniye). Saf; test edilir. */
export function pickLane(busy = []) {
  for (let i = 0; i < LANES.length; i++) if (!busy.includes(i)) return i;
  return busy.length ? busy[0] : 0;
}

/** Yükselme animasyonunun toplam boyu (fx-damage.css --pxd-rise ile aynı) ve kutular arası boşluk. */
export const RISE_PX = 60;
export const SLOT_GAP = 10;
const DRIFT_PAD = 8; // yatay kayma payı (iki komşu zıt yöne kayabilir; tahmindeki fazla genişlik de pay sayılır)

/**
 * Bir sayının yaklaşık kutusu (CSS pikseli). Ölçüm yerine tahmin: toplu temasta ~25 sayı aynı karede
 * doğuyor, her birinde zorunlu yerleşim kareyi uzatıyordu (İş 12). Rakamlar tabular, kalın; 0.58em + dış hat (1440 px'te ölçülen "-200": 158 px, tahmin 166 px).
 */
export function estimateBox(lines, viewportWidth = 1280, { ultimate = false, impact = 1 } = {}) {
  const vw = Number(viewportWidth) > 0 ? Number(viewportWidth) : 1280;
  const numFs = (ultimate ? Math.min(58, Math.max(34, vw * 0.038)) : Math.min(46, Math.max(28, vw * 0.03))) * impact;
  let w = 0, h = 0;
  for (const line of lines || []) {
    const cls = String(line.cls || '');
    const text = String(line.text ?? '');
    let fs, em;
    if (cls.includes('pxd-tag')) { fs = 14; em = 0.78; }
    else if (cls.includes('pxd-label')) { fs = Math.min(18, Math.max(15, vw * 0.015)); em = 0.74; }
    else { fs = numFs; em = 0.58; }
    w = Math.max(w, text.length * fs * em + 6);
    h += fs + 4;
  }
  return { w: Math.round(w || 40), h: Math.round(h || 30) };
}

/**
 * Nişancı (docs/27): çakışmasız yuva seçimi. Saf; test edilir.
 * box: {w,h} yeni sayı · base: {x,y} isteğin kendi kayması (ulti evresi vb.)
 * others: canlı sayılar [{cx, cy, w, h, rise}] — cx/cy MERKEZ (çapa noktasına göre), rise: o ana kadar
 *   yükseldiği px. Yeni sayı daha geç doğduğu için yükselirken eskiye en çok `rise` kadar yaklaşır; bu yüzden
 *   eskinin kutusu yukarı doğru `rise` kadar uzatılmış sayılır → ömür boyu çakışma olmaz.
 * bounds: {left,right,up,down} çapadan izinli uzaklıklar (merkez için).
 * Dönüş: {dx, dy} (çapaya göre ek kayma) ya da yer yoksa null.
 */
export function placeNumber(box, others = [], { base = { x: 0, y: 0 }, bounds = { left: 300, right: 300, up: 140, down: 40 }, gap = SLOT_GAP } = {}) {
  const bx = Number(base?.x) || 0, by = Number(base?.y) || 0;
  // scale: doğuştaki büyüme (pxd-pop 1.4→1, 120 ms); tahmin zaten gerçek genişlikten ~%12 geniş, 1.25 yeterli.
  const ks = Number(box.scale) || 1;
  const hw = box.w * ks / 2 + DRIFT_PAD / 2, hh = box.h * ks / 2;
  const rects = others.map(o => {
    const k = Number(o.scale) || 1;
    return {
      l: o.cx - o.w * k / 2 - DRIFT_PAD / 2, r: o.cx + o.w * k / 2 + DRIFT_PAD / 2,
      t: o.cy - o.h * k / 2 - Math.max(0, o.rise || 0) - 6, b: o.cy + o.h * k / 2,
    };
  });
  // Çapanın kendisi (isteğin kendi kaymasıyla) her zaman geçerli: büyük kutu dar sahnede de en az bir yer bulur.
  const L = Math.max(bounds.left, hw - bx), R = Math.max(bounds.right, hw + bx);
  const U = Math.max(bounds.up, hh - by), D = Math.max(bounds.down, hh + by);
  const fits = (x, y) => x - hw >= -L - 0.5 && x + hw <= R + 0.5 && y - hh >= -U - 0.5 && y + hh <= D + 0.5;
  const hits = (x, y) => rects.filter(q => x - hw < q.r + gap && x + hw > q.l - gap && y - hh < q.b + gap && y + hh > q.t - gap);
  // Yatay kaçış dikeyden ucuz: aynı karede gelenler tek satırda yan yana dizilir, satır dolarsa bir üst satır.
  const cost = (dx, dy) => Math.abs(dx) + Math.abs(dy) * 2 + (dy > 0 ? 80 : 0);
  const seen = new Set();
  const queue = [{ dx: 0, dy: 0, c: 0 }];
  for (let guard = 0; queue.length && guard < 80; guard++) {
    queue.sort((a, b) => a.c - b.c);
    const { dx, dy } = queue.shift();
    const key = `${Math.round(dx / 4)},${Math.round(dy / 4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const x = bx + dx, y = by + dy;
    if (!fits(x, y)) continue;
    const blockers = hits(x, y);
    if (!blockers.length) return { dx: Math.round(dx), dy: Math.round(dy) };
    for (const q of blockers) {
      const next = [
        { dx: q.r + gap + hw - bx, dy },
        { dx: q.l - gap - hw - bx, dy },
        { dx, dy: q.t - gap - hh - by },
        { dx: 0, dy: q.t - gap - hh - by },
        { dx, dy: q.b + gap + hh - by },
      ];
      for (const n of next) queue.push({ ...n, c: cost(n.dx, n.dy) });
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

export const MAX_LIVE_PER_SIDE = 6;
export const COMBO_WINDOW_MS = 1200;
export const HEAVY_DAMAGE = 150;
const REDUCED_DURATION_MS = 360;
/** Yuvalar dolunca en eski sayının hızlı solma süresi (fx-damage.css .pxd-leaving). */
export const LEAVE_MS = 140;
/** Doğuş büyümesi (pxd-pop 1.4→1, 120 ms, hızlı inen eğri): aynı karede doğan komşular büyürken de birleşmesin
 *  diye yeni ve 160 ms'den genç sayıların kutusu ×1.2 sayılır. */
const POP_SCALE = 1.2, POP_MS = 160;
const DURATIONS = { normal: 820, skill: 900, ultimate: 900, label: 900, counter: 900 };
const SIZE = FONT_SIZE;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createDamageNumbers({
  root,
  isReduced = () => false,
  now = () => (globalThis.performance?.now?.() ?? Date.now()),
  scheduler = { setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms), clearTimeout: id => globalThis.clearTimeout(id) },
  random = Math.random,
} = {}) {
  const doc = root?.ownerDocument || globalThis.document || null;
  /** seat -> array of {el, timer} (oldest first) */
  const live = new Map([[1, []], [2, []]]);
  /** seat -> {count, total, lastAt, el, timer} */
  const combos = new Map();
  let destroyed = false;

  const reduced = () => {
    if (root?.classList?.contains?.('pvp4-reduced')) return true;
    try { if (doc?.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return true; } catch {}
    try { return Boolean(isReduced()); } catch { return false; }
  };

  /** Find the effects layer of a seat; tolerant of missing markup. */
  function layerFor(seat) {
    if (!root?.querySelector) return null;
    const kind = seat === 2 ? 'rune' : 'fire';
    const stage = root.querySelector(`.pvp2-side[data-seat="${seat}"] .pvp2-stage`)
      || root.querySelector(`.pvp2-side[data-player="${kind}"] .pvp2-stage`);
    if (!stage) return null;
    return stage.querySelector?.('.pvp4-effects') || stage;
  }

  /** One crisp text line: textContent (never HTML) + palette/size as CSS custom properties. */
  function makeLine(text, palette, size, extraClass) {
    const line = doc.createElement('span');
    line.className = `pxd-line ${extraClass}${extraClass.includes('pxd-tag') ? ' pxd-label' : ''}`;
    line.textContent = String(text);
    const p = palette || PALETTES.fire;
    line.style.setProperty?.('--pxd-fs', `${size}px`);
    line.style.setProperty?.('--pxd-fill', p.fill);
    line.style.setProperty?.('--pxd-top', p.top);
    line.style.setProperty?.('--pxd-line', p.line);
    line.style.setProperty?.('--pxd-shadow', p.shadow);
    return line;
  }

  /** 375 px gibi dar ekranda yazı kenardan taşmasın: CSS `translate` (transform animasyonundan bağımsız) ile ekrana kıstır. */
  function measureClamp(el, vw, pad) {
    const r = el.getBoundingClientRect?.();
    if (!vw || !r || !r.width) return 0;
    const half = Math.max(r.width, el.scrollWidth || 0) / 2 * 1.12, c = r.left + r.width / 2;
    if (c - half < pad) return pad - (c - half);
    if (c + half > vw - pad) return (vw - pad) - (c + half);
    return 0;
  }
  // İş 12: toplu temasta ~25 sayı aynı karede doğuyor; her biri yaz→oku (zorunlu yerleşim) yapınca kare 300 ms sürüyordu.
  // rAF varsa ölçümler tek karede önce HEPSİ okunur, sonra yazılır (tek yerleşim).
  const clampQueue = [];
  function flushClamp() {
    const vw = doc.documentElement?.clientWidth || globalThis.innerWidth || 0;
    const items = clampQueue.splice(0).filter(el => el.isConnected !== false);
    const dxs = items.map(el => { try { return measureClamp(el, vw, 14); } catch { return 0; } });
    items.forEach((el, i) => { if (dxs[i]) el.style.translate = `${Math.round(dxs[i])}px 0`; });
  }
  function clampIntoView(el, pad = 14) {
    try {
      el.style.translate = '';
      const raf = globalThis.requestAnimationFrame;
      if (typeof raf === 'function' && pad === 14) {
        if (clampQueue.push(el) === 1) raf(flushClamp);
        return;
      }
      const dx = measureClamp(el, doc.documentElement?.clientWidth || globalThis.innerWidth || 0, pad);
      if (dx) el.style.translate = `${Math.round(dx)}px 0`;
    } catch { /* yalnız yerleşim iyileştirmesi */ }
  }

  /** Remove one live entry and cancel its timer. fast: kısa solma ile çıkar (yuvalar dolunca en eski). */
  const leaving = new Set();
  function dropEntry(entry, fast = false) {
    if (entry.timer != null) scheduler.clearTimeout(entry.timer);
    entry.timer = null;
    if (!fast || entry.reduced) { entry.el.remove?.(); return; }
    entry.el.classList?.add?.('pxd-leaving');
    if (!entry.el.classList && typeof entry.el.className === 'string') entry.el.className += ' pxd-leaving';
    leaving.add(entry);
    entry.timer = scheduler.setTimeout(() => { entry.timer = null; leaving.delete(entry); entry.el.remove?.(); }, LEAVE_MS);
  }

  /** Katmanın çapa noktasından (50% / 34%) izinli uzaklıklar; ölçüm 1 sn önbellekte (toplu temasta tek okuma). */
  const boundsCache = new Map();
  function boundsFor(layer) {
    const t = now();
    const hit = boundsCache.get(layer);
    if (hit && t - hit.at < 1000) return hit.b;
    let b = { left: 340, right: 340, up: 160, down: 160 };
    try {
      const r = layer.getBoundingClientRect?.();
      if (r && r.width > 0 && r.height > 0) {
        const vw = doc.documentElement?.clientWidth || globalThis.innerWidth || r.left + r.width;
        const cx = r.left + r.width / 2;
        b = {
          left: Math.max(60, Math.min(r.width / 2, cx - 10)) - 4,
          right: Math.max(60, Math.min(r.width / 2, vw - 10 - cx)) - 4,
          // Üstte yükselme payı kalsın (katman taşanı keser); altta dövüşçünün gövdesini çok örtmesin.
          up: Math.max(60, r.height * 0.34 - RISE_PX - 4),
          down: Math.max(30, Math.min(160, r.height * 0.32)),
        };
      }
    } catch { /* varsayılan sınırlar */ }
    boundsCache.set(layer, { at: t, b });
    return b;
  }

  /** Canlı bir sayının şu ana kadarki yükselişi (px): CSS'teki 120 ms gecikmeli ease-out drift ile aynı eğri. */
  function riseOf(entry, t) {
    if (entry.reduced) return 0;
    const p = Math.min(1, Math.max(0, (t - entry.born - 120) / Math.max(1, entry.duration - 120)));
    return RISE_PX * (1 - (1 - p) * (1 - p));
  }

  /**
   * Spawn one floating number on `seat`.
   * spec: {lines:[{text, palette, px, cls}], kind, duration, heavy, x, y, ariaText}
   * Nişancı (docs/27): yer `placeNumber` ile seçilir — aynı karede gelenler yan yana, satır dolunca bir üst satır;
   * hiç yer yoksa en eski sayı hızla solar ve yeri boşalır. Zamanlama ve değerler değişmez; yalnız konum.
   */
  function spawn(seat, spec) {
    const layer = layerFor(seat);
    if (!layer || !doc?.createElement) return false;
    const list = live.get(seat);
    // Recycle the oldest numbers so a side never shows more than the cap.
    while (list.length >= MAX_LIVE_PER_SIDE) dropEntry(list.shift(), true);

    const isRed = reduced();
    const duration = isRed ? REDUCED_DURATION_MS : spec.heavy && spec.amount ? 1100 : spec.duration;
    const impact = Math.min(1.6, 1 + (spec.amount || 0) / 400 + (spec.heavy ? .18 : 0));
    const el = doc.createElement('div');
    el.className = ['pxd-float', `pxd-${spec.kind}`, `pxd-seat-${seat}`,
      spec.heavy ? 'pxd-heavy' : '', isRed ? 'pxd-reduced' : 'pxd-animate'].filter(Boolean).join(' ');
    el.setAttribute?.('aria-hidden', 'true');
    if (el.dataset) el.dataset.text = spec.ariaText;
    // Per-number randomness lives in CSS custom properties (transform only).
    // Küçük rastgele kayma: yuvadan taşmasın diye ±10 px.
    const drift = isRed ? 0 : Math.round((random() * 2 - 1) * 10);
    const x = spec.x ?? Math.round((random() * 2 - 1) * 6);
    const y = spec.y ?? 0;
    const vw = doc.documentElement?.clientWidth || globalThis.innerWidth || 1280;
    const box = estimateBox(spec.lines, vw, { ultimate: spec.kind === 'ultimate', impact });
    const bounds = boundsFor(layer);
    const t = now();
    let place = null;
    for (;;) {
      // Solmakta olan (ömrünün %80'ini geçmiş) sayılar yer tutmaz; azaltılmış kipte hepsi tutar.
      const others = list.filter(e => e.reduced || t - e.born < e.duration * 0.8)
        .map(e => ({ cx: e.x, cy: e.y, w: e.w, h: e.h, rise: riseOf(e, t), scale: !e.reduced && t - e.born < POP_MS ? POP_SCALE : 1 }));
      place = placeNumber(isRed ? box : { ...box, scale: POP_SCALE }, others, { base: { x, y }, bounds });
      if (place || !list.length) break;
      dropEntry(list.shift(), true);
    }
    if (!place) place = { dx: 0, dy: 0 };
    const slot = list.length;
    el.style.setProperty?.('--pxd-impact-scale', String(impact));
    el.style.setProperty?.('--pxd-x', `${x}px`);
    el.style.setProperty?.('--pxd-y', `${y}px`);
    el.style.setProperty?.('--pxd-lx', `${place.dx}px`);
    el.style.setProperty?.('--pxd-ly', `${place.dy}px`);
    if (el.dataset) el.dataset.lane = String(slot);
    el.style.setProperty?.('--pxd-drift', `${drift}px`);
    el.style.setProperty?.('--pxd-dur', `${duration}ms`);

    const body = doc.createElement('div');
    body.className = 'pxd-body';
    for (const line of spec.lines) body.appendChild(makeLine(line.text, line.palette, line.px, line.cls));
    el.appendChild(body);
    layer.appendChild(el);
    clampIntoView(el);

    const entry = { el, timer: null, lane: slot, x: place.dx + x, y: place.dy + y, w: box.w, h: box.h,
      born: t, duration, reduced: isRed };
    entry.timer = scheduler.setTimeout(() => {
      entry.timer = null;
      el.remove?.();
      const idx = list.indexOf(entry);
      if (idx >= 0) list.splice(idx, 1);
    }, duration);
    list.push(entry);
    return true;
  }

  /** Update the per-side "KOMBO xN · toplam" ticker after a landed hit. */
  function bumpCombo(seat, amount) {
    const t = now();
    let combo = combos.get(seat);
    if (!combo || t - combo.lastAt > COMBO_WINDOW_MS) {
      if (combo) hideCombo(seat);
      combo = { count: 0, total: 0, lastAt: t, el: null, timer: null, flip: false };
      combos.set(seat, combo);
    }
    combo.count += 1;
    combo.total += amount;
    combo.lastAt = t;
    if (combo.count < 2) return;

    const layer = layerFor(seat);
    if (!layer || !doc?.createElement) return;
    if (!combo.el) {
      combo.el = doc.createElement('div');
      combo.el.setAttribute?.('aria-hidden', 'true');
      layer.appendChild(combo.el);
    }
    // Alternate two classes so the CSS bump animation restarts on each hit.
    combo.flip = !combo.flip;
    combo.el.className = ['pxd-combo', `pxd-seat-${seat}`,
      reduced() ? 'pxd-reduced' : combo.flip ? 'pxd-bump-a' : 'pxd-bump-b'].join(' ');
    while (combo.el.firstChild) combo.el.removeChild(combo.el.firstChild);
    combo.el.appendChild(makeLine(`${LABELS.combo} x${combo.count} · ${combo.total}`,
      PALETTES.combo, SIZE.combo, 'pxd-combo-line'));
    clampIntoView(combo.el);
    if (combo.timer != null) scheduler.clearTimeout(combo.timer);
    combo.timer = scheduler.setTimeout(() => { combo.timer = null; hideCombo(seat); }, COMBO_WINDOW_MS);
  }

  function hideCombo(seat) {
    const combo = combos.get(seat);
    if (!combo) return;
    if (combo.timer != null) scheduler.clearTimeout(combo.timer);
    combo.el?.remove?.();
    combos.delete(seat);
  }

  /** Blocked hits and shield breaks end the attacker's streak on that side. */
  function resetCombo(seat) { hideCombo(seat); }

  /** Build the spawn spec for a DAMAGE_APPLIED event. */
  function damageSpec(event) {
    const attacker = event.fromSeat === 2 ? 'rune' : 'fire';
    const amount = Math.max(0, Math.round(Number(event.amount) || 0));

    if (event.blocked) {
      const kind = event.blockKind === 'PARRY' ? 'parry' : event.blockKind === 'PERFECT_BLOCK' ? 'perfect' : 'block';
      const text = kind === 'parry' ? LABELS.parry : kind === 'perfect' ? LABELS.perfect : LABELS.block;
      return { kind, duration: DURATIONS.label, heavy: kind !== 'block', ariaText: text,
        lines: [{ text, palette: PALETTES[kind], px: kind === 'block' ? SIZE.label : SIZE.labelHot, cls: 'pxd-main pxd-label' }] };
    }

    const lines = [];
    const isUltimate = event.skill === 'r' && Number.isInteger(event.phase);
    const total = Number.isInteger(event.totalPhases) ? event.totalPhases : 3;
    let kind = 'normal';
    let palette = PALETTES[attacker];
    let px = SIZE.normal;
    let duration = DURATIONS.normal;
    let y = 0;

    if (isUltimate) {
      kind = 'ultimate'; palette = PALETTES.ultimate; px = SIZE.ultimate; duration = DURATIONS.ultimate;
      // Stack phases: later phases float higher so 1/3, 2/3, 3/3 read as a column.
      y = -(Math.max(1, event.phase) - 1) * 26;
      lines.push({ text: `${event.phase}/${total}`, palette: PALETTES.phase, px: SIZE.tag, cls: 'pxd-tag' });
    } else if (event.counter) {
      kind = 'counter'; palette = PALETTES.counter; px = SIZE.skill; duration = DURATIONS.counter;
      lines.push({ text: LABELS.counter, palette: PALETTES.counter, px: SIZE.tag, cls: 'pxd-tag' });
    } else if (event.assist === true || event.skill === 'assist') {
      // Paket 31: partner desteği vuruşu — küçük "DESTEK" etiketiyle.
      palette = PALETTES[event.partner === 'fire' ? 'fire' : event.partner === 'rune' ? 'rune' : attacker];
      lines.push({ text: LABELS.assist, palette, px: SIZE.tag, cls: 'pxd-tag' });
    } else if (event.skill === 'e') {
      kind = 'skill'; palette = attacker === 'rune' ? PALETTES.skillRune : PALETTES.skillFire;
      px = SIZE.skill; duration = DURATIONS.skill;
    }
    if (event.arena) {
      // Arena (raund sonu çözüm): motorun etiketleri — KOMBO (4.), FİNAL (5.+) çarpanıyla, yanlış cezası yüzdeyle.
      const tags = Array.isArray(event.tags) ? event.tags : [];
      const mult = Number(event.multiplier) || 1;
      const multText = `x${Math.round(mult * 100) / 100}`;
      if (tags.includes('FİNAL')) lines.push({ text: `FİNAL ${multText}`, palette: PALETTES.crit, px: SIZE.tag, cls: 'pxd-tag pxd-crit' });
      else if (tags.includes('KOMBO')) lines.push({ text: `KOMBO ${multText}`, palette: PALETTES.combo, px: SIZE.tag, cls: 'pxd-tag' });
      const pen = Number(event.penalty) || 0;
      if (pen > 0) lines.push({ text: `-%${Math.round(pen * 100)}`, palette: PALETTES.shatter, px: SIZE.tag, cls: 'pxd-tag pxd-penalty' });
      else if (tags.includes('ARINMA')) lines.push({ text: 'ARINMA', palette: PALETTES.counter, px: SIZE.tag, cls: 'pxd-tag' });
    } else if (Array.isArray(event.bonusTags) && event.bonusTags.length) {
      // Server-side empowered hits (rune/talent bonus) are shown as KRİTİK.
      lines.push({ text: LABELS.crit, palette: PALETTES.crit, px: SIZE.tag, cls: 'pxd-tag pxd-crit' });
    }
    lines.push({ text: `-${amount}`, palette, px, cls: 'pxd-main pxd-num' });

    const heavy = amount >= HEAVY_DAMAGE || (isUltimate && event.phase === total);
    return { kind, duration, heavy, y, lines, ariaText: `-${amount}`, amount };
  }

  function handle(event) {
    if (destroyed || !event || typeof event !== 'object') return false;
    try {
      if (event.type === 'DAMAGE_APPLIED') {
        const seat = event.toSeat === 2 ? 2 : event.toSeat === 1 ? 1 : null;
        if (!seat) return false;
        const spec = damageSpec(event);
        const drawn = spawn(seat, spec);
        // Arena vuruşlarında kendi kombo kuralı (maks 4) etiketlerde gösterilir; ayrı 'KOMBO xN · toplam' sayacı kapalı.
        if (event.arena) resetCombo(seat);
        else if (event.blocked || !spec.amount) resetCombo(seat);
        else bumpCombo(seat, spec.amount);
        return drawn;
      }
      if (event.type === 'SHIELD_BROKEN') {
        const seat = event.seat === 2 ? 2 : event.seat === 1 ? 1 : null;
        if (!seat) return false;
        return spawn(seat, { kind: 'shatter', duration: DURATIONS.label, heavy: true, y: -34,
          ariaText: LABELS.shieldBreak,
          lines: [{ text: LABELS.shieldBreak, palette: PALETTES.shatter, px: SIZE.label, cls: 'pxd-main pxd-label' }] });
      }
    } catch {
      // Visual sugar must never break the combat listener.
      return false;
    }
    return false;
  }

  function clear() {
    for (const list of live.values()) {
      while (list.length) dropEntry(list.shift());
    }
    for (const entry of [...leaving]) { leaving.delete(entry); dropEntry(entry); }
    for (const seat of [...combos.keys()]) hideCombo(seat);
  }

  function destroy() {
    clear();
    destroyed = true;
  }

  function liveCount(seat) {
    return live.get(seat)?.length ?? 0;
  }

  return { handle, clear, destroy, liveCount };
}
