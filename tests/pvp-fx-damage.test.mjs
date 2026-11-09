import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDamageNumbers, rasterize, isTextSupported, FONT, LABELS, GLYPH_HEIGHT,
  MAX_LIVE_PER_SIDE, COMBO_WINDOW_MS,
} from '../pvp/fx-damage.js';

// ---- Minimal fake DOM ------------------------------------------------------
function fakeCtx() {
  const ctx = { pixels: 0, fillStyle: '', fillRect() { ctx.pixels++; }, clearRect() {} };
  return ctx;
}
function fakeEl(tag, doc) {
  const el = {
    tagName: tag.toUpperCase(), ownerDocument: doc, parentNode: null, children: [], className: '',
    dataset: {}, attrs: {}, props: {}, width: 0, height: 0,
    style: { setProperty(k, v) { el.props[k] = v; } },
    get firstChild() { return el.children[0] || null; },
    setAttribute(k, v) { el.attrs[k] = String(v); },
    appendChild(child) { child.parentNode?.removeChild(child); child.parentNode = el; el.children.push(child); return child; },
    removeChild(child) { el.children = el.children.filter(c => c !== child); child.parentNode = null; return child; },
    remove() { el.parentNode?.removeChild(el); },
    querySelector() { return null; },
  };
  if (tag === 'canvas') { el.ctx = fakeCtx(); el.getContext = () => el.ctx; }
  return el;
}
function fakeArena({ withStage = true } = {}) {
  const doc = { createElement: tag => fakeEl(tag, doc) };
  const effects = { 1: fakeEl('div', doc), 2: fakeEl('div', doc) };
  const root = fakeEl('section', doc);
  root.querySelector = sel => {
    if (!withStage) return null;
    const m = /data-seat="(\d)"/.exec(sel);
    if (!m) return null;
    const stage = fakeEl('div', doc);
    stage.querySelector = s => (s === '.pvp4-effects' ? effects[m[1]] : null);
    return stage;
  };
  return { doc, root, effects };
}
function fakeScheduler() {
  let now = 0, next = 1; const pending = new Map();
  const scheduler = {
    setTimeout(fn, ms) { const id = next++; pending.set(id, { fn, at: now + ms }); return id; },
    clearTimeout(id) { pending.delete(id); },
  };
  function runTo(ms) {
    while (true) {
      const item = [...pending.entries()].sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!item || item[1].at > ms) break;
      pending.delete(item[0]); now = item[1].at; item[1].fn();
    }
    now = ms;
  }
  return { scheduler, pending, runTo, now: () => now };
}
function setup(opts = {}) {
  const arena = fakeArena(opts);
  const clock = fakeScheduler();
  const fx = createDamageNumbers({ root: arena.root, scheduler: clock.scheduler, now: clock.now,
    random: () => 0.5, isReduced: opts.isReduced });
  return { ...arena, clock, fx };
}
const hit = (extra = {}) => ({ type: 'DAMAGE_APPLIED', fromSeat: 1, toSeat: 2, skill: 'q', amount: 105,
  blocked: false, blockKind: null, counter: false, bonusTags: [], ...extra });
const nums = layer => layer.children.filter(c => c.className.includes('pxd-num'));

// ---- Font ------------------------------------------------------------------
test('bitmap font covers every label and every number glyph used', () => {
  for (const text of Object.values(LABELS)) assert.ok(isTextSupported(text), text);
  for (const text of ['-0123456789', '+', '1/3', '2/3', '3/3', 'KOMBO x12 · 1450']) assert.ok(isTextSupported(text), text);
  for (const [ch, g] of Object.entries(FONT)) {
    assert.equal(g.rows.length, GLYPH_HEIGHT, ch);
    for (const row of g.rows) assert.equal(row.length, g.width, ch);
  }
});

test('rasterize produces ink pixels and falls back for unknown glyphs', () => {
  const r = rasterize('-105');
  assert.equal(r.height, GLYPH_HEIGHT);
  assert.equal(r.width, 4 + 5 + 5 + 5 + 3);
  assert.ok(r.mask.some(Boolean));
  assert.doesNotThrow(() => rasterize('ß€'));
});

// ---- Factory ---------------------------------------------------------------
test('DAMAGE_APPLIED draws a pixel canvas on the defender side', () => {
  const { fx, effects } = setup();
  assert.equal(fx.handle(hit()), true);
  const [num] = nums(effects[2]);
  assert.ok(num.className.includes('pxd-normal'));
  assert.equal(nums(effects[1]).length, 0);
  const canvas = num.children[0].children.at(-1);
  assert.equal(canvas.tagName, 'CANVAS');
  assert.ok(canvas.ctx.pixels > 0);
  assert.equal(num.dataset.text, '-105');
  assert.match(canvas.style.width, /var\(--pxd-px, 4\)/);
});

test('style by meaning: skill E, ultimate phases, counter, crit, blocks, shield break', () => {
  const { fx, effects } = setup();
  fx.handle(hit({ skill: 'e', amount: 175 }));
  fx.handle(hit({ skill: 'r', amount: 140, phase: 3, totalPhases: 3, toSeat: 1, fromSeat: 2 }));
  fx.handle(hit({ skill: 'counter', counter: true, amount: 65, toSeat: 1 }));
  fx.handle(hit({ bonusTags: ['Q→E'] }));
  const s2 = nums(effects[2]), s1 = nums(effects[1]);
  assert.ok(s2[0].className.includes('pxd-skill') && s2[0].className.includes('pxd-heavy'));
  assert.ok(s1[0].className.includes('pxd-ultimate') && s1[0].className.includes('pxd-heavy'));
  assert.equal(s1[0].props['--pxd-y'], '-52px');
  assert.ok(s1[1].className.includes('pxd-counter'));
  assert.ok(s2[1].children[0].children.some(c => c.className.includes('pxd-crit')));

  const { fx: fx2, effects: e2 } = setup();
  fx2.handle(hit({ blocked: true, amount: 0, blockKind: 'NORMAL_BLOCK' }));
  fx2.handle(hit({ blocked: true, amount: 0, blockKind: 'PARRY' }));
  fx2.handle(hit({ blocked: true, amount: 0, blockKind: 'PERFECT_BLOCK' }));
  fx2.handle({ type: 'SHIELD_BROKEN', seat: 2, bySeat: 1 });
  assert.deepEqual(nums(e2[2]).map(n => n.dataset.text), [LABELS.block, LABELS.parry, LABELS.perfect, LABELS.shieldBreak]);
});

test('per-side cap recycles the oldest numbers and timers are cleaned', () => {
  const { fx, effects, clock } = setup();
  for (let i = 0; i < MAX_LIVE_PER_SIDE + 4; i++) fx.handle(hit({ amount: 10 + i }));
  assert.equal(nums(effects[2]).length, MAX_LIVE_PER_SIDE);
  assert.equal(fx.liveCount(2), MAX_LIVE_PER_SIDE);
  assert.equal(nums(effects[2])[0].dataset.text, '-14');
  clock.runTo(5000);
  assert.equal(nums(effects[2]).length, 0);
  assert.equal(fx.liveCount(2), 0);
  assert.equal(clock.pending.size, 0);
});

test('combo ticker accumulates within the window and resets after it', () => {
  const { fx, effects, clock } = setup();
  fx.handle(hit({ amount: 100 }));
  clock.runTo(300); fx.handle(hit({ amount: 50 }));
  clock.runTo(600); fx.handle(hit({ amount: 25 }));
  const combo = effects[2].children.find(c => c.className.includes('pxd-combo'));
  assert.ok(combo);
  // "KOMBO x3 · 175" — width check via rasterize of the expected text.
  assert.equal(combo.children[0].width, rasterize('KOMBO x3 · 175').width + 2);
  clock.runTo(600 + COMBO_WINDOW_MS + 1);
  assert.equal(effects[2].children.some(c => c.className.includes('pxd-combo')), false);
  fx.handle(hit({ amount: 10 }));
  assert.equal(effects[2].children.some(c => c.className.includes('pxd-combo')), false);
});

test('reduced mode: no drift, reduced class, short lifetime', () => {
  const { fx, effects, clock } = setup({ isReduced: () => true });
  fx.handle(hit({ skill: 'r', phase: 1, totalPhases: 3, amount: 65 }));
  const [num] = nums(effects[2]);
  assert.ok(num.className.includes('pxd-reduced'));
  assert.equal(num.props['--pxd-drift'], '0px');
  assert.ok(parseInt(num.props['--pxd-dur'], 10) <= 400);
  clock.runTo(500);
  assert.equal(nums(effects[2]).length, 0);
});

test('unknown / malformed events are ignored and missing stage never throws', () => {
  const { fx, effects } = setup();
  for (const ev of [null, undefined, 42, {}, { type: 'SKILL_CAST', fromSeat: 1, skill: 'q' },
    { type: 'ULTIMATE_PHASE', phase: 1 }, { type: 'PARRY_TRIGGERED', seat: 1 }, { type: 'NOPE' },
    { type: 'DAMAGE_APPLIED', toSeat: 7, amount: 5 }]) {
    assert.equal(fx.handle(ev), false);
  }
  assert.equal(effects[1].children.length + effects[2].children.length, 0);

  const bare = setup({ withStage: false });
  assert.equal(bare.fx.handle(hit()), false);
  assert.equal(bare.fx.handle({ type: 'SHIELD_BROKEN', seat: 1 }), false);
  const noRoot = createDamageNumbers({});
  assert.doesNotThrow(() => { noRoot.handle(hit()); noRoot.clear(); noRoot.destroy(); });
});

test('clear and destroy remove everything and cancel all timers', () => {
  const { fx, effects, clock } = setup();
  fx.handle(hit()); fx.handle(hit()); fx.handle(hit({ toSeat: 1 }));
  assert.ok(clock.pending.size > 0);
  fx.clear();
  assert.equal(clock.pending.size, 0);
  assert.equal(effects[1].children.length + effects[2].children.length, 0);
  fx.handle(hit());
  fx.destroy();
  assert.equal(clock.pending.size, 0);
  assert.equal(fx.handle(hit()), false);
  assert.equal(effects[2].children.length, 0);
});

test('arena hits show engine tags (KOMBO/FİNAL/penalty) and never start the classic combo ticker', async () => {
  const mod = await import('../pvp/fx-damage.js');
  for (const t of ['KOMBO x1.5', 'FİNAL x2', '-%48', 'ARINMA']) assert.equal(mod.isTextSupported(t), true, t);
  const src = (await import('node:fs')).readFileSync(new URL('../pvp/fx-damage.js', import.meta.url), 'utf8');
  assert.match(src, /if \(event\.arena\) resetCombo\(seat\);/);
});
