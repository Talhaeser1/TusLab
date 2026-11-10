import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createDamageNumbers} from '../pvp/fx-damage.js';
import * as typing from '../pvp/typing-top-model.js';
import {createFightHud, HUD_TIMES} from '../pvp/fight-hud.js';
import {attachCinematic, vsModel, CIN_TIMES} from '../pvp/cinematic.js';
import {attachStageFocus} from '../pvp/stage-focus.js';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const descendants = el => el.children.flatMap(c => [c, ...descendants(c)]);

// Only browser boundaries are doubled; real factories create and retire every node.
function environment({reduced = false, mediaReduced = false} = {}) {
  let now = 0, serial = 0;
  const pending = new Map(), listeners = new Map();
  const doc = {defaultView: {matchMedia: () => ({matches: mediaReduced})}};
  function element(tag) {
    const props = {}, attrs = {};
    const node = {tagName: tag.toUpperCase(), ownerDocument: doc, children: [], parentNode: null,
      className: '', dataset: {}, hidden: false, props, attrs, _text: '',
      style: {setProperty: (k, v) => { props[k] = v; }},
      get firstChild() { return this.children[0] || null; },
      get textContent() { return this._text + this.children.map(c => c.textContent).join(''); },
      set textContent(v) { this._text = String(v); this.replaceChildren(); },
      get isConnected() { return Boolean(this.parentNode); },
      setAttribute(k, v) { attrs[k] = String(v); },
      appendChild(child) { child.remove(); child.parentNode = this; this.children.push(child); return child; },
      append(...nodes) { nodes.forEach(n => this.appendChild(n)); },
      removeChild(child) { this.children.splice(this.children.indexOf(child), 1); child.parentNode = null; },
      replaceChildren(...nodes) { [...this.children].forEach(c => c.remove()); this.append(...nodes); },
      remove() { this.parentNode?.removeChild(this); },
      querySelector() { return null; },
      getBoundingClientRect() { return {top: 200, bottom: 600, left: 0, width: 800, height: 400}; },
      addEventListener(type, fn) { const set = listeners.get(type) || new Set(); set.add(fn); listeners.set(type, set); },
      removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
      emit(type, detail) { listeners.get(type)?.forEach(fn => fn({detail})); },
    };
    const classes = () => new Set(node.className.split(/\s+/).filter(Boolean));
    node.classList = {
      contains: c => classes().has(c),
      add(...cs) { const s = classes(); cs.forEach(c => s.add(c)); node.className = [...s].join(' '); },
      remove(...cs) { const s = classes(); cs.forEach(c => s.delete(c)); node.className = [...s].join(' '); },
      toggle(c, on) { const s = classes(); on = on ?? !s.has(c); on ? s.add(c) : s.delete(c); node.className = [...s].join(' '); },
    };
    return node;
  }
  doc.createElement = element;
  doc.addEventListener = () => {};
  doc.removeEventListener = () => {};
  const root = element('section'), stages = {1: element('div'), 2: element('div')}, duel = element('div');
  if (reduced) root.classList.add('pvp4-reduced');
  root.querySelector = selector => selector === '.pvp2-duel' ? duel : stages[/data-seat="([12])"/.exec(selector)?.[1]] || null;
  const scheduler = {
    setTimeout(fn, ms) { pending.set(++serial, {fn, at: now + ms}); return serial; },
    clearTimeout(id) { pending.delete(id); },
  };
  function advance(ms) {
    const until = now + ms;
    while (true) {
      const next = [...pending].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > until) break;
      pending.delete(next[0]); now = next[1].at; next[1].fn();
    }
    now = until;
  }
  return {root, stages, doc, scheduler, advance, pending, now: () => now};
}
const hit = extra => ({type: 'DAMAGE_APPLIED', fromSeat: 1, toSeat: 2, amount: 175, skill: 'q', ...extra});
function damage(options) {
  const e = environment(options);
  return {...e, fx: createDamageNumbers({root: e.root, scheduler: e.scheduler, now: e.now, random: () => .5})};
}

test('D1/D2: damage uses a numeric span and Turkish outlined DOM labels without canvas', () => {
  const {fx, stages} = damage();
  for (const event of [hit({counter: true}), hit({bonusTags: ['bonus']}), hit({assist: true, partner: 'rune'}),
    hit({blocked: true, blockKind: 'PARRY'}), {type: 'SHIELD_BROKEN', seat: 2}]) fx.handle(event);
  const nodes = descendants(stages[2]);
  assert.ok(nodes.some(n => n.tagName === 'SPAN' && n.classList.contains('pxd-num') && n.textContent === '-175'));
  for (const text of ['KONTRA', 'KRİTİK', 'DESTEK', 'PARRY!', 'KALKAN KIRIK!']) {
    assert.ok(nodes.some(n => n.tagName === 'SPAN' && n.classList.contains('pxd-label') && n.textContent === text), text);
  }
  assert.ok(nodes.every(n => n.tagName !== 'CANVAS'));
  assert.doesNotMatch(read('pvp/fx-damage.css'), /image-rendering/);
});

test('D3: all six live hits stay at least 34px apart, including mixed ultimate phases and recycling', () => {
  const {fx, stages} = damage();
  for (let i = 0; i < 12; i++) {
    fx.handle(hit(i % 2 ? {skill: 'r', phase: i % 3 + 1} : {}));
    const floats = stages[2].children.filter(n => n.dataset.lane !== undefined);
    assert.equal(floats.length, Math.min(i + 1, 6));
    for (let a = 0; a < floats.length; a++) for (let b = a + 1; b < floats.length; b++) {
      const pos = n => [parseFloat(n.props['--pxd-lx']) + parseFloat(n.props['--pxd-x']),
        parseFloat(n.props['--pxd-ly']) + parseFloat(n.props['--pxd-y'])];
      const [ax, ay] = pos(floats[a]), [bx, by] = pos(floats[b]);
      assert.ok(Math.abs(ax - bx) >= 34 || Math.abs(ay - by) >= 34, `${a}/${b}: ${ax},${ay} vs ${bx},${by}`);
    }
  }
});

test('D1: ordinary/skill text retires by 900ms, heavy text by 1100ms', () => {
  for (const [event, limit] of [[hit({amount: 100, skill: 'e'}), 900], [hit({amount: 175}), 1100]]) {
    const {fx, advance} = damage(); fx.handle(event);
    assert.equal(fx.liveCount(2), 1); advance(limit);
    assert.equal(fx.liveCount(2), 0);
  }
});

test('D7: root and OS reduced modes generate no damage animation or combo bump classes', () => {
  for (const options of [{reduced: true}, {mediaReduced: true}]) {
    const {fx, stages, advance, pending} = damage(options);
    fx.handle(hit()); fx.handle(hit());
    const nodes = descendants(stages[2]);
    assert.ok(nodes.some(n => n.classList.contains('pxd-reduced')));
    assert.ok(nodes.every(n => !/pxd-animate|pxd-bump-[ab]/.test(n.className)));
    advance(1300); assert.equal(pending.size, 0);
  }
});

test('D4: last added Unicode letter flashes for 120ms, deletion and stale input do not flash', () => {
  const input = {typed: 'şö', previousTyped: 'ş', lastInputAt: 1000, now: 1119};
  assert.equal(typing.ttAnimationState(input).letterClass, 'tt-letter-hit');
  assert.equal(typing.ttAnimationState(input).letterIndex, 1);
  assert.equal(typing.ttAnimationState({...input, now: 1120}).letterClass, '');
  assert.equal(typing.ttAnimationState({...input, typed: '', previousTyped: 'ş'}).letterClass, '');
  assert.equal(typing.ttAnimationState({...input, lastInputAt: null}).letterClass, '');
  assert.equal(typing.ttAnimationState({...input, now: 999}).letterClass, '');
});

test('D4: accepted/rejected words expose independent 180ms/260ms feedback windows', () => {
  for (const [correct, cls, duration] of [[true, 'tt-word-pop', 180], [false, 'tt-word-miss', 260]]) {
    const input = {correct, submittedAt: 1000, now: 1000 + duration - 1};
    assert.equal(typing.ttAnimationState(input).wordClass, cls);
    assert.equal(typing.ttAnimationState({...input, now: 1000 + duration}).wordClass, '');
  }
  assert.equal(typing.ttAnimationState({correct: true}).wordClass, '');
});

test('D4: combo thresholds 2/4/6/8 and last five seconds expose the expected classes', () => {
  for (const [combo, cls] of [[0, ''], [1, ''], [2, 'tt-combo-1'], [3, 'tt-combo-1'],
    [4, 'tt-combo-2'], [6, 'tt-combo-3'], [8, 'tt-combo-4'], [100, 'tt-combo-4']]) {
    assert.equal(typing.ttAnimationState({combo}).comboClass, cls);
  }
  for (const [secondsLeft, cls] of [[6, ''], [5, 'tt-clock-urgent'], [.1, 'tt-clock-urgent'], [0, ''], [-1, ''], [null, '']]) {
    assert.equal(typing.ttAnimationState({secondsLeft}).clockClass, cls);
  }
});

test('D7: reduced typing feedback preserves semantic state without animation classes', () => {
  const state = typing.ttAnimationState({typed: 'a', previousTyped: '', lastInputAt: 1000,
    correct: false, submittedAt: 1000, combo: 8, secondsLeft: 2, now: 1001, reduced: true});
  for (const key of ['letterClass', 'wordClass', 'comboClass', 'clockClass']) assert.equal(state[key], '');
  assert.equal(state.outcome, 'miss'); assert.equal(state.comboLevel, 4); assert.equal(state.urgent, true);
});

const roster = [{seat: 1, name: 'Oyuncu', fighter: 'sira', character: 'fire', playerId: 'me'},
  {seat: 2, name: 'Rakip', fighter: 'nyx', character: 'rune', playerId: 'peer'}];
const hudLayers = root => root.children.filter(n => n.classList.contains('fhud-layer'));

test('D5: announcements have two opposing bands, fighter accent, bounded queue and <=900ms lifetime', () => {
  const e = environment(), hud = createFightHud({root: e.root, scheduler: e.scheduler});
  hud.update({players: roster, status: 'running', stage: 'harbor'}, 'me');
  hud.handle({type: 'SKILL_CAST', skill: 'r', fromSeat: 1});
  const layer = hudLayers(e.root)[0];
  assert.ok(layer.textContent.includes('GÖLGE YAĞMURU!'));
  assert.equal(layer.props['--fhud-accent'], '#3ee0c8');
  assert.equal(descendants(layer).filter(n => n.classList.contains('fhud-band')).length, 2);
  for (const event of [{type: 'PARRY_TRIGGERED', seat: 2}, {type: 'COUNTERATTACK_CAST', fromSeat: 1},
    {type: 'SHIELD_BROKEN', seat: 1}]) hud.handle(event);
  e.advance(700); assert.equal(hudLayers(e.root).length, 1);
  e.advance(1400); assert.equal(hudLayers(e.root).length, 0);
  hud.matchEnd({winnerSeat: 1, reason: 'KNOCKOUT'});
  assert.match(hudLayers(e.root)[0].textContent, /NAKAVT!ZAFER/);
  e.advance(900); assert.equal(hudLayers(e.root).length, 0);
  assert.ok(HUD_TIMES.final <= 900);
  hud.destroy(); assert.equal(e.pending.size, 0);
});

test('D5/D6: HUD intro includes stage and fighters, never overlaps queued announcements, ends by 2200ms', () => {
  const e = environment(), hud = createFightHud({root: e.root, scheduler: e.scheduler});
  hud.matchStart({players: roster, stage: 'harbor'}); e.advance(60);
  const text = hudLayers(e.root)[0].textContent;
  for (const value of ['Sira', 'Gölge Mızrak', 'Nyx', 'Rün Kâhini', 'ARENA: Fırtına Limanı']) assert.ok(text.includes(value), value);
  hud.handle({type: 'PARRY_TRIGGERED', seat: 2});
  assert.equal(hudLayers(e.root).length, 1);
  e.advance(2050);
  assert.equal(hudLayers(e.root).length, 1);
  assert.equal(hudLayers(e.root)[0].textContent, 'PARRY!');
  e.advance(900); assert.equal(hudLayers(e.root).length, 0);
  hud.destroy(); assert.equal(e.pending.size, 0);
});

test('D6: cinematic VS uses shared fighter names/titles and stage with safe fallback', () => {
  const [a, b] = vsModel({players: roster, stage: 'harbor'});
  assert.equal(a.character, 'Sira'); assert.equal(a.title, 'Gölge Mızrak');
  assert.equal(b.character, 'Nyx'); assert.equal(b.title, 'Rün Kâhini');
  assert.equal(a.arena, 'ARENA: Fırtına Limanı');
  assert.equal(vsModel({stage: '__proto__'})[0].arena, 'ARENA: Neon Kolezyum');
  const e = environment(), cin = attachCinematic({...e});
  cin.play.vs({players: roster, stage: 'harbor'});
  const layer = e.root.children[0];
  for (const value of ['Sira', 'Gölge Mızrak', 'Nyx', 'Rün Kâhini', 'ARENA: Fırtına Limanı']) assert.ok(layer.textContent.includes(value), value);
  e.advance(2200); assert.equal(layer.hidden, true);
  assert.ok(CIN_TIMES.vs <= 2200 && CIN_TIMES.banner <= 900);
  cin.destroy();
});

test('D7: OS/app reduced cinematic and HUD feedback suppresses impacts, bands and arena choreography', () => {
  for (const opts of [{reduced: true}, {mediaReduced: true}]) {
    const e = environment(opts), calls = [];
    const hud = createFightHud({root: e.root, scheduler: e.scheduler,
      getArenaApi: () => ({superFreeze: () => calls.push('freeze'), slowMo: () => calls.push('slow')})});
    hud.handle({type: 'SKILL_CAST', skill: 'r', fromSeat: 1});
    hud.handle({type: 'KNOCKOUT'});
    assert.equal(calls.length, 0);
    assert.ok(hudLayers(e.root)[0].classList.contains('fhud-reduced'));
    assert.ok(descendants(hudLayers(e.root)[0]).every(n => !n.classList.contains('fhud-band')));
    hud.destroy();
    const cin = attachCinematic({...e}); cin.play.vs({players: roster, stage: 'harbor'});
    const layer = e.root.children[0];
    assert.ok(layer.classList.contains('cin-still'));
    assert.ok(descendants(layer).every(n => !n.classList.contains('cin-impact')));
    cin.destroy();
  }
});

function focusEnvironment(options) {
  const e = environment(options), animations = [];
  const duel = e.root.querySelector('.pvp2-duel');
  duel.getBoundingClientRect = () => ({top: e.root.classList.contains('stage-focus') ? 100 : 350});
  duel.animate = (frames, opts) => {
    const animation = {frames, opts, cancelled: false, finishedCalled: false,
      cancel() { this.cancelled = true; }, finish() { this.finishedCalled = true; }};
    animations.push(animation); return animation;
  };
  return {...e, animations, focus: attachStageFocus({root: e.root, scheduler: e.scheduler, observe: null})};
}

test('D5: focus retains FLIP and 700ms fallback, destroy cancels unfinished movement', () => {
  const e = focusEnvironment(); e.focus.set(true); e.focus.set(false);
  const animation = e.animations.at(-1);
  assert.equal(animation.frames[0].transform, 'translateY(-250px)');
  assert.equal(animation.opts.duration, 420);
  assert.ok(e.root.classList.contains('stage-focus-out'));
  e.advance(699); assert.ok(e.root.classList.contains('stage-focus-out'));
  e.advance(1); assert.ok(!e.root.classList.contains('stage-focus-out')); assert.equal(animation.finishedCalled, true);
  e.focus.set(true); const last = e.animations.at(-1); e.focus.destroy();
  assert.equal(last.cancelled, true); assert.equal(e.pending.size, 0);
});

test('D7: stage focus honors app and OS reduced motion without WAAPI panel movement', () => {
  for (const opts of [{reduced: true}, {mediaReduced: true}]) {
    const e = focusEnvironment(opts); e.focus.set(true); e.focus.set(false);
    assert.equal(e.animations.length, 0); assert.ok(!e.root.classList.contains('stage-focus-out'));
    e.focus.destroy(); assert.equal(e.pending.size, 0);
  }
});

test('D6: a new match cannot inherit missing players from the previous VS card', () => {
  const e = environment(), hud = createFightHud({root: e.root, scheduler: e.scheduler});
  hud.matchStart({players: roster, stage: 'harbor'}); e.advance(60);
  hud.matchStart({players: [roster[0]]}); e.advance(60);
  const text = hudLayers(e.root)[0].textContent;
  assert.doesNotMatch(text, /Rakip|Nyx|Fırtına Limanı/);
  assert.match(text, /Oyuncu 2/); hud.destroy();
});

test('D7: destroying cinematic cancels even its pending portrait preload timer', () => {
  const e = environment(), cin = attachCinematic({...e});
  cin.play.vs({players: roster}); cin.destroy();
  assert.equal(e.pending.size, 0);
});
