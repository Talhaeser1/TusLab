import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, statSync, existsSync} from 'node:fs';
import {attachTypingFeel, FEEL_MS} from '../pvp/typing-top.js';

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

function fakeRoot() {
  const cls = new Set(['tt', 'tt-type']);
  const tt = {classList: {add: c => cls.add(c), remove: (...c) => c.forEach(x => cls.delete(x)), contains: c => cls.has(c)}, querySelector: () => null};
  const listeners = {};
  const root = {addEventListener: (t, fn) => { listeners[t] = fn; }, removeEventListener: t => { delete listeners[t]; }, querySelector: s => (s === '.pvp2-shell>.tt' ? tt : null)};
  const timers = [];
  const later = (fn, ms) => { timers.push({fn, ms}); return timers.length; };
  const send = detail => listeners['tuslab:pvp-word-result']?.({detail});
  return {root, cls, listeners, timers, later, send};
}

test('yazma hissi: doğru kelime is-hit, yanlış kelime is-miss; zamanlayıcıyla kalkar', () => {
  const f = fakeRoot();
  const off = attachTypingFeel({root: f.root, later: f.later, cancel: () => {}, frame: fn => fn()});
  f.send({accepted: true, correct: true});
  assert.ok(f.cls.has('is-hit') && !f.cls.has('is-miss'));
  assert.ok(f.timers.at(-1).ms <= FEEL_MS.hit + 40);
  f.timers.at(-1).fn();
  assert.ok(!f.cls.has('is-hit'));
  f.send({accepted: true, correct: false});
  assert.ok(f.cls.has('is-miss') && !f.cls.has('is-hit'));
  f.send({accepted: true, correct: true}); // yanlıştan hemen sonra doğru: miss kalkar
  assert.ok(f.cls.has('is-hit') && !f.cls.has('is-miss'));
  f.timers.at(-1).fn();
  f.send({accepted: false, code: 'WINDOW_CLOSED'}); // reddedilen gönderim: his yok
  assert.ok(!f.cls.has('is-hit') && !f.cls.has('is-miss'));
  off();
  assert.equal(f.listeners['tuslab:pvp-word-result'], undefined);
});

test('yazma hissi: azaltılmış harekette sınıf eklenmez; süreler sınırda', () => {
  const f = fakeRoot();
  attachTypingFeel({root: f.root, reduced: () => true, later: f.later, cancel: () => {}});
  f.send({accepted: true, correct: false});
  assert.ok(!f.cls.has('is-miss'));
  assert.ok(FEEL_MS.hit <= 180 && FEEL_MS.miss <= 160);
  assert.match(read('pvp/hud-v2.js'), /attachTypingFeel\(\{root, reduced, later, cancel\}\)/);
});

test('yazma paneli CSS: çerçeve görseli, is-hit/is-miss animasyonu, eski harf tetikleyicileri yok', () => {
  const css = read('pvp/fight-hud.css');
  const block = css.slice(css.indexOf('/* ===== YAZMA PANELI · CERCEVE'));
  assert.ok(block.length > 1000, 'blok var');
  assert.ok(!css.includes('YAZMA PANELI · FANTASTIK'), 'eski blok değişti');
  assert.match(block, /border-image:url\('\.\.\/assets\/higgsfield\/final\/yazma-cerceve\.webp'\) 75 150 93 150 fill/);
  assert.match(block, /\.tt\.is-hit \.tt-word::after\{animation:yp-hit \.17s/);
  assert.match(block, /\.tt\.is-miss \.tt-word\{animation:yp-miss \.15s/);
  assert.doesNotMatch(block, /mark\.pvp2-char-next:first-child::after|yp-shake|pvp2-char-bad[^{]*\{[^}]*animation/);
  assert.match(block, /prefers-reduced-motion:reduce[\s\S]*\.tt-word::after\{animation:none!important\}/);
  assert.match(block, /pvp4-reduced[^{]*\.tt-word::after\{animation:none!important\}/);
  for (const m of block.matchAll(/@keyframes yp-[a-z-]+\{([^@]*?)\}\}/g)) assert.doesNotMatch(m[1], /(left|top|width|height|margin)\s*:/, 'yalnız transform/opacity');
  for (const m of block.matchAll(/font:[^;{}]*?(\d+(?:\.\d+)?)px/g)) assert.ok(Number(m[1]) >= 12, m[0]);
  assert.match(block, /width:min\(680px/);
});

test('beceri bandı CSS: seçim zemini ve üç resimli kart; görseller var ve boyut sınırında', () => {
  const css = read('pvp/rounds-ui.css');
  const block = css.slice(css.indexOf('/* ===== BANT · RESIMLI KARTLAR'));
  assert.ok(block.length > 1000, 'blok sonda');
  assert.ok(css.indexOf('BANT · TILSIM GORSELLERI') < css.indexOf('BANT · RESIMLI KARTLAR'), 'önceki bloklar silinmedi, yeni blok sonra');
  const names = [...block.matchAll(/higgsfield\/final\/([a-z-]+)\.webp/g)].map(m => m[1]);
  for (const n of ['secim-zemin', 'kart-zaman-hirsizi', 'kart-karanlik-saat', 'kart-donmus-an']) assert.ok(names.includes(n), n);
  for (const n of [...names, 'yazma-cerceve']) {
    const f = new URL(`../assets/higgsfield/final/${n}.webp`, import.meta.url);
    assert.ok(existsSync(f), `${n}.webp var`);
    assert.ok(statSync(f).size <= 300 * 1024, `${n} ≤ 300 KB`);
  }
  for (const k of ['timethief', 'blindclock', 'freeze']) assert.match(block, new RegExp(`data-round-skill="${k}"\\]\\{[^}]*--art:url`));
  assert.match(block, /\.rui-pick-lock\{min-height:44px/);
  assert.match(block, /\.aui-card\.is-empty::after\{filter:grayscale\(1\)/);
  for (const m of block.matchAll(/font:[^;{}]*?(\d+(?:\.\d+)?)px/g)) assert.ok(Number(m[1]) >= 12, m[0]);
});
