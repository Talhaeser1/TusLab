// TuşLab Neon Arena — piksel hasar sayıları (pixel-art damage numbers).
//
// Every number / label is rasterised from a tiny built-in bitmap font into a
// small <canvas>, which CSS then scales up with `image-rendering: pixelated`.
// No external fonts or libraries are used.
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

// ---------------------------------------------------------------------------
// Bitmap font
// ---------------------------------------------------------------------------

/** Glyph height in pixels. Row 0 is reserved for accents (the dot of "İ"). */
export const GLYPH_HEIGHT = 8;
/** Empty columns between two glyphs. */
const LETTER_SPACING = 1;

// Glyphs are written as rows of '#' (ink) and '.' (empty). Glyphs with 7 rows
// get an empty accent row prepended automatically; 8-row glyphs use row 0.
const RAW_FONT = {
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  '-': ['....', '....', '....', '####', '....', '....', '....'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '!': ['##', '##', '##', '##', '##', '..', '##'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  '/': ['....#', '...#.', '...#.', '..#..', '.#...', '.#...', '#....'],
  '%': ['##..#', '##..#', '...#.', '..#..', '.#...', '#..##', '#..##'],
  '.': ['.', '.', '.', '.', '.', '#', '#'],
  '·': ['..', '..', '..', '##', '##', '..', '..'],
  'x': ['.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  ' ': ['...', '...', '...', '...', '...', '...', '...'],
  'A': ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  'B': ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  'C': ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  'D': ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  'E': ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  'F': ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  'H': ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  'I': ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  // Turkish dotted capital I: the dot lives in the accent row.
  'İ': ['.#.', '...', '##.', '.#.', '.#.', '.#.', '.#.', '###'],
  'K': ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  'L': ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  'M': ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  'N': ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  'O': ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  'P': ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  'R': ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  'S': ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  'T': ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  'U': ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  'Y': ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
};

/** Normalised font: every glyph has exactly GLYPH_HEIGHT rows of equal width. */
export const FONT = Object.freeze(Object.fromEntries(
  Object.entries(RAW_FONT).map(([ch, rows]) => {
    const width = rows[0].length;
    const full = rows.length === GLYPH_HEIGHT ? rows : ['.'.repeat(width), ...rows];
    return [ch, Object.freeze({ width, rows: Object.freeze(full) })];
  }),
));

/** Every fixed label this module can draw (numbers are built from digits). */
export const LABELS = Object.freeze({
  block: 'BLOK',
  parry: 'PARRY!',
  perfect: 'PERFECT!',
  crit: 'KRİTİK',
  counter: 'COUNTER',
  combo: 'KOMBO',
  shieldBreak: 'KALKAN KIRIK!',
});

/** True when every character of `text` exists in the bitmap font. */
export function isTextSupported(text) {
  return [...String(text)].every(ch => Object.hasOwn(FONT, ch));
}

/**
 * Rasterise `text` into a 1-bit mask.
 * Unknown characters fall back to "?" so a bad label never throws.
 * @returns {{width:number, height:number, mask:Uint8Array}}
 */
export function rasterize(text) {
  const glyphs = [...String(text)].map(ch => FONT[ch] || FONT['?']);
  const width = Math.max(1, glyphs.reduce((sum, g) => sum + g.width, 0)
    + LETTER_SPACING * Math.max(0, glyphs.length - 1));
  const height = GLYPH_HEIGHT;
  const mask = new Uint8Array(width * height);
  let penX = 0;
  for (const glyph of glyphs) {
    for (let y = 0; y < height; y++) {
      const row = glyph.rows[y];
      for (let x = 0; x < glyph.width; x++) {
        if (row[x] === '#') mask[y * width + penX + x] = 1;
      }
    }
    penX += glyph.width + LETTER_SPACING;
  }
  return { width, height, mask };
}

// ---------------------------------------------------------------------------
// Palettes ("style by meaning")
// ---------------------------------------------------------------------------

// fill: main ink, top: highlight for the upper rows, line: 1px outline,
// shadow: 1px drop shadow under the outline.
const PALETTES = {
  fire:    { fill: '#ffffff', top: '#ffffff', line: '#ff5a1f', shadow: '#2a0a06' },
  rune:    { fill: '#ffffff', top: '#ffffff', line: '#8b5cff', shadow: '#120a2e' },
  skillFire: { fill: '#fff1c2', top: '#ffffff', line: '#ff3d00', shadow: '#2a0500' },
  skillRune: { fill: '#e6f9ff', top: '#ffffff', line: '#6a3dff', shadow: '#0a0630' },
  ultimate: { fill: '#ffc93c', top: '#fff7b8', line: '#7a2c00', shadow: '#1a0800' },
  counter: { fill: '#9ffcff', top: '#ffffff', line: '#007c91', shadow: '#00151c' },
  block:   { fill: '#bfefff', top: '#ffffff', line: '#1f5fa8', shadow: '#06142b' },
  parry:   { fill: '#ffffff', top: '#ffffff', line: '#00b7ff', shadow: '#001a2b' },
  perfect: { fill: '#fff3a0', top: '#ffffff', line: '#b07800', shadow: '#241600' },
  crit:    { fill: '#ff4b4b', top: '#ffb0a0', line: '#3a0000', shadow: '#000000' },
  shatter: { fill: '#ff6b81', top: '#ffd0d8', line: '#4a0012', shadow: '#000000' },
  combo:   { fill: '#ffe08a', top: '#fffbe0', line: '#3b2400', shadow: '#000000' },
  phase:   { fill: '#fff7b8', top: '#ffffff', line: '#7a2c00', shadow: '#000000' },
};

/**
 * Paint a rasterised mask onto a canvas: shadow, then outline, then fill.
 * Canvas is mask + 1px outline on every side + 1px shadow at the bottom.
 * Works without a 2D context (e.g. in tests) — it then only sizes the canvas.
 */
function paintCanvas(canvas, raster, palette, pixelSize) {
  const pad = 1;
  const w = raster.width + pad * 2;
  const h = raster.height + pad * 2 + 1;
  canvas.width = w;
  canvas.height = h;
  // Displayed size = logical pixels × CSS pixel size (overridable via --pxd-px).
  canvas.style.width = `calc(${w}px * var(--pxd-px, ${pixelSize}))`;
  canvas.style.height = `calc(${h}px * var(--pxd-px, ${pixelSize}))`;
  const ctx = typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null;
  if (!ctx) return;
  const ink = (x, y) => x >= 0 && y >= 0 && x < raster.width && y < raster.height
    && raster.mask[y * raster.width + x] === 1;
  // Collect outline pixels (8-neighbourhood of ink that is not ink itself).
  const outline = [];
  for (let y = -1; y <= raster.height; y++) {
    for (let x = -1; x <= raster.width; x++) {
      if (ink(x, y)) continue;
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++) {
        for (let dx = -1; dx <= 1; dx++) if (ink(x + dx, y + dy)) { near = true; break; }
      }
      if (near) outline.push([x + pad, y + pad]);
    }
  }
  ctx.clearRect?.(0, 0, w, h);
  ctx.fillStyle = palette.shadow;
  for (const [x, y] of outline) ctx.fillRect(x, y + 1, 1, 1);
  ctx.fillStyle = palette.line;
  for (const [x, y] of outline) ctx.fillRect(x, y, 1, 1);
  // Fill with a two-tone vertical ramp: highlight on the top rows.
  for (let y = 0; y < raster.height; y++) {
    ctx.fillStyle = y <= 3 ? palette.top : palette.fill;
    for (let x = 0; x < raster.width; x++) if (ink(x, y)) ctx.fillRect(x + pad, y + pad, 1, 1);
  }
}

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

export const MAX_LIVE_PER_SIDE = 6;
export const COMBO_WINDOW_MS = 1200;
export const HEAVY_DAMAGE = 150;
const REDUCED_DURATION_MS = 360;
const DURATIONS = { normal: 800, skill: 950, ultimate: 1100, label: 900, counter: 900 };
const PIXEL_SIZE = { normal: 4, skill: 5, ultimate: 6, label: 3, tag: 3, combo: 3 };

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

  const reduced = () => { try { return Boolean(isReduced()); } catch { return false; } };

  /** Find the effects layer of a seat; tolerant of missing markup. */
  function layerFor(seat) {
    if (!root?.querySelector) return null;
    const kind = seat === 2 ? 'rune' : 'fire';
    const stage = root.querySelector(`.pvp2-side[data-seat="${seat}"] .pvp2-stage`)
      || root.querySelector(`.pvp2-side[data-player="${kind}"] .pvp2-stage`);
    if (!stage) return null;
    return stage.querySelector?.('.pvp4-effects') || stage;
  }

  /** Create a canvas element with `text` painted in `palette`. */
  function makeCanvas(text, palette, pixelSize, extraClass) {
    const canvas = doc.createElement('canvas');
    canvas.className = `pxd-line ${extraClass}`;
    paintCanvas(canvas, rasterize(text), palette, pixelSize);
    return canvas;
  }

  /** Remove one live entry and cancel its timer. */
  function dropEntry(entry) {
    if (entry.timer != null) scheduler.clearTimeout(entry.timer);
    entry.timer = null;
    entry.el.remove?.();
  }

  /**
   * Spawn one floating number on `seat`.
   * spec: {lines:[{text, palette, px, cls}], kind, duration, heavy, x, y, ariaText}
   */
  function spawn(seat, spec) {
    const layer = layerFor(seat);
    if (!layer || !doc?.createElement) return false;
    const list = live.get(seat);
    // Recycle the oldest numbers so a side never shows more than the cap.
    while (list.length >= MAX_LIVE_PER_SIDE) dropEntry(list.shift());

    const isRed = reduced();
    const duration = isRed ? REDUCED_DURATION_MS : spec.duration;
    const el = doc.createElement('div');
    el.className = ['pxd-num', `pxd-${spec.kind}`, `pxd-seat-${seat}`,
      spec.heavy ? 'pxd-heavy' : '', isRed ? 'pxd-reduced' : ''].filter(Boolean).join(' ');
    el.setAttribute?.('aria-hidden', 'true');
    if (el.dataset) el.dataset.text = spec.ariaText;
    // Per-number randomness lives in CSS custom properties (transform only).
    const drift = isRed ? 0 : Math.round((random() * 2 - 1) * 26);
    el.style.setProperty?.('--pxd-x', `${spec.x ?? Math.round((random() * 2 - 1) * 14)}px`);
    el.style.setProperty?.('--pxd-y', `${spec.y ?? 0}px`);
    el.style.setProperty?.('--pxd-drift', `${drift}px`);
    el.style.setProperty?.('--pxd-dur', `${duration}ms`);

    const body = doc.createElement('div');
    body.className = 'pxd-body';
    for (const line of spec.lines) body.appendChild(makeCanvas(line.text, line.palette, line.px, line.cls));
    el.appendChild(body);
    layer.appendChild(el);

    const entry = { el, timer: null };
    entry.timer = scheduler.setTimeout(() => {
      entry.timer = null;
      el.remove?.();
      const idx = list.indexOf(entry);
      if (idx >= 0) list.splice(idx, 1);
    }, duration + 40);
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
    combo.el.className = ['pxd-combo', `pxd-seat-${seat}`, combo.flip ? 'pxd-bump-a' : 'pxd-bump-b',
      reduced() ? 'pxd-reduced' : ''].filter(Boolean).join(' ');
    // Replace the old canvas with a freshly painted one.
    while (combo.el.firstChild) combo.el.removeChild(combo.el.firstChild);
    combo.el.appendChild(makeCanvas(`${LABELS.combo} x${combo.count} · ${combo.total}`,
      PALETTES.combo, PIXEL_SIZE.combo, 'pxd-combo-line'));
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
        lines: [{ text, palette: PALETTES[kind], px: PIXEL_SIZE.label + (kind === 'block' ? 0 : 1), cls: 'pxd-main' }] };
    }

    const lines = [];
    const isUltimate = event.skill === 'r' && Number.isInteger(event.phase);
    const total = Number.isInteger(event.totalPhases) ? event.totalPhases : 3;
    let kind = 'normal';
    let palette = PALETTES[attacker];
    let px = PIXEL_SIZE.normal;
    let duration = DURATIONS.normal;
    let y = 0;

    if (isUltimate) {
      kind = 'ultimate'; palette = PALETTES.ultimate; px = PIXEL_SIZE.ultimate; duration = DURATIONS.ultimate;
      // Stack phases: later phases float higher so 1/3, 2/3, 3/3 read as a column.
      y = -(Math.max(1, event.phase) - 1) * 26;
      lines.push({ text: `${event.phase}/${total}`, palette: PALETTES.phase, px: PIXEL_SIZE.tag, cls: 'pxd-tag' });
    } else if (event.counter) {
      kind = 'counter'; palette = PALETTES.counter; px = PIXEL_SIZE.skill; duration = DURATIONS.counter;
      lines.push({ text: LABELS.counter, palette: PALETTES.counter, px: PIXEL_SIZE.tag, cls: 'pxd-tag' });
    } else if (event.skill === 'e') {
      kind = 'skill'; palette = attacker === 'rune' ? PALETTES.skillRune : PALETTES.skillFire;
      px = PIXEL_SIZE.skill; duration = DURATIONS.skill;
    }
    if (event.arena) {
      // Arena (raund sonu çözüm): motorun etiketleri — KOMBO (4.), FİNAL (5.+) çarpanıyla, yanlış cezası yüzdeyle.
      const tags = Array.isArray(event.tags) ? event.tags : [];
      const mult = Number(event.multiplier) || 1;
      const multText = `x${Math.round(mult * 100) / 100}`;
      if (tags.includes('FİNAL')) lines.push({ text: `FİNAL ${multText}`, palette: PALETTES.crit, px: PIXEL_SIZE.tag, cls: 'pxd-tag pxd-crit' });
      else if (tags.includes('KOMBO')) lines.push({ text: `KOMBO ${multText}`, palette: PALETTES.combo, px: PIXEL_SIZE.tag, cls: 'pxd-tag' });
      const pen = Number(event.penalty) || 0;
      if (pen > 0) lines.push({ text: `-%${Math.round(pen * 100)}`, palette: PALETTES.shatter, px: PIXEL_SIZE.tag, cls: 'pxd-tag pxd-penalty' });
      else if (tags.includes('ARINMA')) lines.push({ text: 'ARINMA', palette: PALETTES.counter, px: PIXEL_SIZE.tag, cls: 'pxd-tag' });
    } else if (Array.isArray(event.bonusTags) && event.bonusTags.length) {
      // Server-side empowered hits (rune/talent bonus) are shown as KRİTİK.
      lines.push({ text: LABELS.crit, palette: PALETTES.crit, px: PIXEL_SIZE.tag, cls: 'pxd-tag pxd-crit' });
    }
    lines.push({ text: `-${amount}`, palette, px, cls: 'pxd-main' });

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
          lines: [{ text: LABELS.shieldBreak, palette: PALETTES.shatter, px: PIXEL_SIZE.label, cls: 'pxd-main' }] });
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
