// Düzeltme turu 2 / D: durum rozeti ([data-status]) ve kombo sayacı DOM'da görünür.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createAttackCallout} from '../pvp/attack-callout.js';
import {createComboCounter} from '../pvp/combo-counter.js';

function fakeEl(tag, doc) {
  const el = {tagName: tag, ownerDocument: doc, children: [], attrs: {}, className: '', hidden: false, _text: '', parentNode: null,
    set textContent(v) { el._text = String(v); }, get textContent() { return el._text; },
    setAttribute(k, v) { el.attrs[k] = String(v); }, removeAttribute(k) { delete el.attrs[k]; },
    append(...n) { n.forEach(c => { c.parentNode = el; el.children.push(c); }); },
    remove() { if (el.parentNode) el.parentNode.children = el.parentNode.children.filter(c => c !== el); el.parentNode = null; },
    offsetWidth: 1, listeners: {}, addEventListener(t, fn) { el.listeners[t] = fn; }, removeEventListener(t) { delete el.listeners[t]; }};
  el.classList = {add(c) { el.className = `${el.className} ${c}`.trim(); }, remove(c) { el.className = el.className.split(/\s+/).filter(x => x && x !== c).join(' '); }};
  return el;
}
function setup() {
  const doc = {createElement: t => fakeEl(t, doc)};
  const root = fakeEl('section', doc);
  const stages = {1: fakeEl('div', doc), 2: fakeEl('div', doc)};
  root.querySelector = sel => { const m = /data-seat="(\d)"\] \.pvp2-stage/.exec(sel); return m ? stages[m[1]] : null; };
  const timers = [];
  const setTimer = (fn, ms) => timers.push({fn, ms}) - 1;
  return {root, stages, timers, setTimer, clearTimer() {}};
}

test('durum rozeti: blok → hedef sahnesinde [data-status] + rozet; süre dolunca kalkar', () => {
  const {root, stages, timers, setTimer, clearTimer} = setup();
  const callout = createAttackCallout({root, setTimer, clearTimer, getFighterId: s => (s === 1 ? 'vargr' : 'nyx')});
  callout.show({fromSeat: 1, toSeat: 2, skill: 'q', amount: 20, blocked: true});
  assert.equal(stages[2].attrs['data-status'], 'block');
  assert.ok(stages[2].children.some(c => 'data-status-badge' in c.attrs && c.textContent === 'BLOK'));
  assert.match(callout.el.textContent, /^VARGR → NYX · .+ · BLOK −20$/);
  timers.forEach(t => t.fn());
  assert.equal(stages[2].attrs['data-status'], undefined);
});

test('durum rozeti: tuslab:pvp-status olayı (KALKAN KIRIK) rozet çıkarır', () => {
  const {root, stages, setTimer, clearTimer} = setup();
  createAttackCallout({root, setTimer, clearTimer});
  root.listeners['tuslab:pvp-status']({detail: {seat: 1, text: 'KALKAN KIRIK', tone: 'break'}});
  assert.equal(stages[1].attrs['data-status'], 'break');
  assert.equal(stages[1].children[0].textContent, 'KALKAN KIRIK');
});

test('kombo sayacı: 2. vuruşta "2 KOMBO!", 3.de "3 KOMBO!"; 1. vuruşta görünmez; bitişte 600 ms sonra kalkar', () => {
  const {root, timers, setTimer, clearTimer} = setup();
  const counter = createComboCounter({root, setTimer, clearTimer});
  const strike = i => root.listeners['tuslab:pvp-strike']({detail: {seat: 1, index: i}});
  strike(0);
  assert.equal(counter.el.hidden, true);
  strike(1);
  assert.equal(counter.el.hidden, false);
  assert.equal(counter.el.textContent, '2 KOMBO!');
  strike(2);
  assert.equal(counter.el.textContent, '3 KOMBO!');
  assert.ok('data-combo-counter' in counter.el.attrs);
  root.listeners['tuslab:pvp-combo-end']({});
  assert.equal(timers.at(-1).ms, 600);
  timers.at(-1).fn();
  assert.equal(counter.el.hidden, true);
});
