import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolveBannerText, resolveSummaryText, attachResolveUi} from '../pvp/resolve-ui.js';

function fakeDom() {
  const listeners = {};
  const makeEl = () => {
    const cls = new Set();
    return {
      dataset: {}, hidden: false, textContent: '', isConnected: true, parentNode: null, attrs: {},
      classList: {add: c => cls.add(c), remove: (...c) => c.forEach(x => cls.delete(x)), toggle: (c, on) => (on ? cls.add(c) : cls.delete(c)), contains: c => cls.has(c)},
      setAttribute(k, v) { this.attrs[k] = v; }, appendChild(c) { c.parentNode = this; this.child = c; }, remove() { this.isConnected = false; }
    };
  };
  const duel = makeEl();
  const sides = [makeEl(), makeEl()]; sides[0].dataset.seat = '1'; sides[1].dataset.seat = '2';
  const root = {
    ownerDocument: {createElement: () => makeEl()},
    querySelector: s => (s === '.pvp2-duel' ? duel : null),
    querySelectorAll: s => (s === '.pvp2-side[data-seat]' ? sides : []),
    addEventListener: (t, f) => { listeners[t] = f; }, removeEventListener: t => { delete listeners[t]; },
    emit: (t, detail) => listeners[t]?.({detail})
  };
  const timers = new Map(); let id = 0;
  const scheduler = {setTimeout: (f, ms) => { timers.set(++id, f); return id; }, clearTimeout: k => timers.delete(k), flush() { for (const [k, f] of [...timers]) { timers.delete(k); f(); } }};
  return {root, duel, sides, scheduler, listeners};
}

test('resolve ui: banner and summary texts', () => {
  assert.equal(resolveBannerText({turn: 3, total: 8}), 'SALDIRI SIRASI · 3/8');
  assert.equal(resolveBannerText({}), 'SALDIRI SIRASI');
  assert.equal(resolveSummaryText({label: 'PENCERE', index: 2, mine: 340, theirs: 210}), 'PENCERE 2 SONU · Sen 340 · Rakip 210');
});

test('resolve ui: counts turns, marks attacker/defender, sums damage and shows the window summary', () => {
  const d = fakeDom();
  const ui = attachResolveUi({root: d.root, getSeat: () => 1, scheduler: d.scheduler});
  d.root.emit('tuslab:pvp-round', {type: 'EXCHANGE_RESOLVE', payload: {index: 2, turns: 2}});
  const banner = d.duel.child;
  assert.equal(banner.textContent, 'SALDIRI SIRASI · 0/2');
  d.root.emit('tuslab:pvp-combat', {type: 'DAMAGE_APPLIED', resolve: true, turn: 1, fromSeat: 1, toSeat: 2, amount: 105});
  assert.equal(banner.textContent, 'SALDIRI SIRASI · 1/2');
  assert.ok(d.sides[0].classList.contains('rsv-attacker'));
  assert.ok(d.sides[1].classList.contains('rsv-defender'));
  d.root.emit('tuslab:pvp-combat', {type: 'DAMAGE_APPLIED', resolve: true, turn: 2, fromSeat: 2, toSeat: 1, amount: 95});
  d.root.emit('tuslab:pvp-combat', {type: 'DAMAGE_APPLIED', resolve: true, turn: 2, fromSeat: 2, toSeat: 1, amount: 50, blocked: true});
  d.root.emit('tuslab:pvp-round', {type: 'EXCHANGE_START', payload: {index: 3}});
  assert.equal(banner.textContent, 'PENCERE 2 SONU · Sen 105 · Rakip 95');
  assert.equal(banner.dataset.mode, 'sum');
  assert.ok(!d.sides[0].classList.contains('rsv-attacker'));
  d.scheduler.flush();
  assert.equal(banner.hidden, true);
  ui.destroy();
  assert.equal(Object.keys(d.listeners).length, 0);
});

test('resolve ui: ignores realtime and arena events (arena has its own resolve screen)', () => {
  const d = fakeDom();
  attachResolveUi({root: d.root, scheduler: d.scheduler});
  d.root.emit('tuslab:pvp-combat', {type: 'DAMAGE_APPLIED', fromSeat: 1, toSeat: 2, amount: 100});
  d.root.emit('tuslab:pvp-combat', {type: 'ARENA_ATTACK', turn: 1, fromSeat: 1, toSeat: 2, amount: 100});
  assert.equal(d.duel.child, undefined);
});

test('resolve ui: pencere/çözüm geçişlerinde attack-turn sesi bir kez çalınır', () => {
  const d = fakeDom();
  const cues = [];
  const ui = attachResolveUi({root: d.root, getSeat: () => 1, scheduler: d.scheduler, sfx: (name, gain) => cues.push({name, gain})});
  d.root.emit('tuslab:pvp-round', {type: 'EXCHANGE_RESOLVE', payload: {index: 1, turns: 1}});
  d.root.emit('tuslab:pvp-combat', {type: 'SKILL_CAST', resolve: true, turn: 1, fromSeat: 1, toSeat: 2});
  d.root.emit('tuslab:pvp-combat', {type: 'DAMAGE_APPLIED', resolve: true, turn: 1, fromSeat: 1, toSeat: 2, amount: 90});
  let hits = cues.filter(c => c.name === 'attack-turn');
  assert.equal(hits.length, 1, 'çözüm başlarken bir kez');
  assert.ok(hits[0].gain > 0 && hits[0].gain <= 1, 'gain 0-1 arası');
  d.root.emit('tuslab:pvp-round', {type: 'EXCHANGE_START', payload: {index: 2}});
  hits = cues.filter(c => c.name === 'attack-turn');
  assert.equal(hits.length, 2, 'özet gösterilirken (geçişte) bir kez');
  // Gerçek zamanlı yazma vuruşları ve arena akışı ses çıkarmaz; destroy sonrası da çıkmaz.
  d.root.emit('tuslab:pvp-combat', {type: 'DAMAGE_APPLIED', fromSeat: 1, toSeat: 2, amount: 30});
  d.root.emit('tuslab:pvp-combat', {type: 'ARENA_ATTACK', turn: 1, fromSeat: 1, toSeat: 2, amount: 40});
  assert.equal(cues.filter(c => c.name === 'attack-turn').length, 2);
  ui.destroy();
  d.root.emit('tuslab:pvp-round', {type: 'EXCHANGE_RESOLVE', payload: {index: 3, turns: 1}});
  assert.equal(cues.filter(c => c.name === 'attack-turn').length, 2, 'destroy sonrası ses yok');
});

test('resolve ui: css uses no infinite animation and honors reduced motion', async () => {
  const css = await readFile(new URL('../pvp/resolve-ui.css', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /infinite/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /pvp4-reduced/);
});

test('resolve ui: arena odağı ile yazma paneli arasında yer değişince eski etiket kaldırılır (iki etiket olmaz)', () => {
  const removed = [];
  const mk = () => ({dataset: {}, hidden: false, textContent: '', isConnected: true, parentNode: null,
    classList: {add() {}, remove() {}, toggle() {}, contains: () => false},
    setAttribute() {}, appendChild(c) { c.parentNode = this; }, remove() { this.isConnected = false; removed.push(this); }});
  const duel = mk(), tt = mk(); let focus = true; const listeners = {};
  const root = {ownerDocument: {createElement: mk}, classList: {contains: c => c === 'stage-focus' && focus},
    querySelector: s => (s === '.pvp2-duel' ? duel : s === '.tt-type' ? tt : null), querySelectorAll: () => [],
    addEventListener: (t, f) => { listeners[t] = f; }, removeEventListener() {}};
  const timers = {setTimeout: () => 1, clearTimeout() {}};
  attachResolveUi({root, getSeat: () => 1, scheduler: timers});
  listeners['tuslab:pvp-round']({detail: {type: 'EXCHANGE_RESOLVE', payload: {index: 1, turns: 2}}});
  focus = false;
  listeners['tuslab:pvp-round']({detail: {type: 'EXCHANGE_START', payload: {index: 2}}});
  assert.equal(removed.length, 1, 'arenadaki eski etiket kaldırıldı');
  assert.equal(removed[0].parentNode, duel);
});
