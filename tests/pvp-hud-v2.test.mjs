import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {seriesModel, railModel, fmtMult} from '../pvp/hud-v2.js';
import {resultHighlights, resultCardHTML} from '../pvp/phase15-results.js';

const P = (extra = {}) => ({seat: 1, fighter: 'vargr', character: 'fire', hp: 4000, maxHp: 4000, ...extra});

test('KESINYAP 14: rounds seri modeli — 7 pip, Q/E/R eşikleri 3/5/7, çarpan 7. seriden', () => {
  const m = seriesModel({mode: 'rounds'}, P({streak: 2}));
  assert.equal(m.total, 7); assert.equal(m.lit, 2); assert.equal(m.mult, null);
  assert.deepEqual(m.marks, {3: 'Q', 5: 'E', 7: 'R'});
  assert.deepEqual(m.next, {key: 'Q', steps: 1});
  const hi = seriesModel({mode: 'rounds'}, P({streak: 8}));
  assert.equal(hi.mult, 1.8); assert.equal(fmtMult(hi.mult), '×1,8');
});

test('KESINYAP 14: classic seri modeli sıradaki yeteneğe kalan adımı verir', () => {
  const m = seriesModel({mode: 'classic'}, P({streak: 3}));
  assert.equal(m.mult, null); assert.ok(m.next && m.next.steps >= 1);
});

test('KESINYAP 14: yetenek rayı — rounds Q/E/R, classic Q/E/S/R, arena boş', () => {
  assert.deepEqual(railModel({mode: 'rounds'}, P({streak: 0})).map(r => r.key), ['Q', 'E', 'R']);
  assert.deepEqual(railModel({mode: 'classic'}, P()).map(r => r.key), ['Q', 'E', 'S', 'R']);
  assert.deepEqual(railModel({mode: 'arena'}, P()), []);
  const q = railModel({mode: 'rounds'}, P({streak: 2})).find(r => r.key === 'Q');
  assert.ok(q.fill > 0 && q.fill < 1, 'halka seriyle dolar');
  assert.equal(q.threshold, 3);
});

test('KESINYAP 16: sonuç özeti — raund şeridi + en iyi an; veri yoksa boş', () => {
  const r = resultHighlights({
    players: [{seat: 1, name: 'Savaşçı', maxCombo: 6}, {seat: 2, name: 'Bot · Orta', maxCombo: 9}],
    rounds: [{round: 1, scores: [{seat: 1, damageDealt: 300}, {seat: 2, damageDealt: 120}]}, {round: 2, reason: 'KO', scores: [{seat: 1, damageDealt: 900}, {seat: 2, damageDealt: 0}]}],
  });
  assert.equal(r.cols.length, 2); assert.equal(r.cols[1].ko, true);
  assert.match(r.best, /En yüksek seri: Bot · Orta 9/); assert.match(r.best, /Savaşçı · Raund 2 · 900/);
  assert.deepEqual(resultHighlights({}), {cols: [], best: ''});
});

test('KESINYAP 16: oyuncu kartında blok/savuşturma/karşı saldırı satırı ve emoji yok', () => {
  const html = resultCardHTML({seat: 1, name: 'Savaşçı', fighter: 'vargr', character: 'fire', wpm: 40, accuracy: 90, damageDealt: 500, correctWords: 10, wrongWords: 1, maxCombo: 5, skillCasts: {q: 2, e: 1, r: 0}, defense: {normalBlocks: 3, parries: 2, counters: 1, shieldBreaks: 1}}, 1, 1);
  assert.doesNotMatch(html, /blok|savuşturma|karşı saldırı|kalkan kırma/i);
  assert.doesNotMatch(html, /[🔥🛡⚔⌨]/u);
  assert.match(html, /En yüksek seri: 5/);
});

test('KESINYAP 14: HUD v2 CSS — hayalet can gecikmeli erir, reduced-motion animasyonu kapatır, 12 px altı yazı yok', () => {
  const css = readFileSync(new URL('../pvp/fight-hud.css', import.meta.url), 'utf8');
  assert.match(css, /\.fhud2-ghost\{[^}]*transition:transform 440ms ease-out 400ms/);
  assert.match(css, /prefers-reduced-motion:reduce\)\{\s*\.fhud2 \*\{transition:none!important;animation:none!important\}/);
  const hud = css.slice(css.indexOf('HUD v2'));
  for (const m of hud.matchAll(/font:[^;{}]*?(\d+(?:\.\d+)?)px/g)) assert.ok(Number(m[1]) >= 12, `font ${m[0]}`);
});
