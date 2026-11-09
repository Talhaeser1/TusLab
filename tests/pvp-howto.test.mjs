import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {HOWTO_TABS, howtoButtonHTML, attachHowto} from '../pvp/howto.js';
import {ARENA_MATCH_HP} from '../pvp/shared/arena.js';

test('howto: tabs cover modes, damage, items, skills, controls', () => {
  assert.deepEqual(HOWTO_TABS.map(t => t.id), ['modlar', 'hasar', 'esya', 'beceri', 'kontrol']);
  const text = JSON.stringify(HOWTO_TABS);
  assert.match(text, new RegExp(`${ARENA_MATCH_HP} HP`), 'arena HP motorla aynı');
  assert.match(text, /5 · 10 · 15 · 15 · 15 · 20/);
  assert.match(text, /Ağır Eldiven/);
});

test('howto: toolbar button is an accessible icon button', () => {
  const html = howtoButtonHTML();
  assert.match(html, /data-howto-open/);
  assert.match(html, /aria-label="Nasıl oynanır"/);
});

test('howto: Esc closes only the panel and stops other Esc handlers', () => {
  const listeners = [];
  const doc = {activeElement: null, addEventListener: (t, f, c) => listeners.push({t, f, c}), removeEventListener() {}, createElement: () => ({})};
  // Panel açık değilken olaya dokunmaz.
  attachHowto({root: {addEventListener() {}, removeEventListener() {}}, doc});
  const key = listeners.find(l => l.t === 'keydown');
  assert.equal(key.c, true, 'capture');
  let stopped = false;
  key.f({key: 'Escape', preventDefault() {}, stopImmediatePropagation() { stopped = true; }});
  assert.equal(stopped, false);
});

test('howto: wired in index.js and css linked; css has no infinite animation', async () => {
  const [js, html, css] = await Promise.all([
    readFile(new URL('../pvp/index.js', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../pvp/howto.css', import.meta.url), 'utf8')
  ]);
  assert.match(js, /\$\{howtoButtonHTML\(\)\}<details class="pvp4-settings"/);
  assert.match(js, /attachHowto\(\{root\}\)/);
  assert.match(html, /pvp\/howto\.css/);
  assert.doesNotMatch(css, /infinite|backdrop-filter/);
  assert.match(css, /prefers-reduced-motion/);
});
