import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {seriesModel, railModel, fmtMult} from '../pvp/hud-v2.js';
import {resultHighlights, resultCardHTML} from '../pvp/phase15-results.js';

const P = (extra = {}) => ({seat: 1, fighter: 'vargr', character: 'fire', hp: 4000, maxHp: 4000, ...extra});

test('KESINYAP 14/21: rounds seri modeli — 10 pip, Q/W/E/R eşikleri 3/5/7/10, çarpan 10. seriden', () => {
  // KESINYAP 21 (kullanıcı kuralı: dört yetenek, ulti yalnız 10 seride): 7 pip → 10, eşikler 3/5/7 → 3/5/7/10.
  const m = seriesModel({mode: 'rounds'}, P({streak: 2}));
  assert.equal(m.total, 10); assert.equal(m.lit, 2); assert.equal(m.mult, null);
  assert.deepEqual(m.marks, {3: 'Q', 5: 'W', 7: 'E', 10: 'R'});
  assert.deepEqual(m.next, {key: 'Q', steps: 1});
  assert.deepEqual(seriesModel({mode: 'rounds'}, P({streak: 6})).next, {key: 'E', steps: 1});
  assert.deepEqual(seriesModel({mode: 'rounds'}, P({streak: 7})).next, {key: 'R', steps: 3});
  const hi = seriesModel({mode: 'rounds'}, P({streak: 11}));
  assert.equal(hi.mult, 1.8); assert.equal(fmtMult(hi.mult), '×1,8');
});

test('KESINYAP 14: classic seri modeli sıradaki yeteneğe kalan adımı verir', () => {
  const m = seriesModel({mode: 'classic'}, P({streak: 3}));
  assert.equal(m.mult, null); assert.ok(m.next && m.next.steps >= 1);
});

test('KESINYAP 14/21: yetenek rayı — rounds Q/W/E/R, classic Q/W/S/R, arena boş', () => {
  // KESINYAP 21 (kullanıcı kuralı: dört yetenek, ulti yalnız 10 seride): rounds dört ikon; klasikte eski E vuruşu W adıyla (kural aynı).
  assert.deepEqual(railModel({mode: 'rounds'}, P({streak: 0})).map(r => r.key), ['Q', 'W', 'E', 'R']);
  assert.deepEqual(railModel({mode: 'rounds'}, P({streak: 0})).map(r => r.threshold), [3, 5, 7, 10]);
  assert.deepEqual(railModel({mode: 'classic'}, P()).map(r => r.key), ['Q', 'W', 'S', 'R']);
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

// RAPOR-BECERI-SATIRI — ray: her kart kendi eşiğine; atılınca ATILDI ✓ (yanık), E bekliyorsa BEKLİYOR; 10 sonrası Q zinciri
test('ray: seri 2 → Q 2/3 · W 2/5 · E 2/7 · R 2/10; seri 7 → atıldı; E bekliyor; zincir etiketi; HAZIR yok', () => {
  const subs = (extra) => railModel({mode: 'rounds'}, P(extra)).map(r => `${r.key}:${r.state}:${r.sub}`);
  assert.deepEqual(subs({streak: 2}), ['Q:charging:2/3', 'W:charging:2/5', 'E:charging:2/7', 'R:charging:2/10']);
  assert.deepEqual(subs({streak: 7, healBank: 300}), ['Q:cast:ATILDI ✓', 'W:cast:ATILDI ✓', 'E:pending:BEKLİYOR', 'R:charging:7/10']);
  assert.deepEqual(subs({streak: 7, roundHeal: 300}).slice(2, 3), ['E:cast:+300 can']);
  const chain = railModel({mode: 'rounds'}, P({streak: 12})).find(r => r.key === 'Q');
  assert.equal(chain.chain, true); assert.equal(chain.sub, '2/3');
  for (const s of [0, 3, 5, 7, 10, 13]) for (const r of railModel({mode: 'rounds'}, P({streak: s}))) assert.doesNotMatch(r.sub, /HAZIR|ullanıldı/);
  // klasik satır çalışmaya devam eder (Q/W/S/R)
  assert.deepEqual(railModel({mode: 'classic'}, P({combo: 2})).map(r => `${r.key}:${r.state}`), ['Q:cast', 'W:charging', 'S:ready', 'R:charging']);
});
test('ray kaynağı: aynı model iki koltuk için; seri düşünce sarsıntı; bekletilen can önce darbe sonra yükseliş', () => {
  const src = readFileSync(new URL('../pvp/hud-v2.js', import.meta.url), 'utf8');
  assert.match(src, /for \(const seat of \[1, 2\]\)[^]*railModel\(match, p, now\)/);
  assert.match(src, /pct < c\.fill/);
  assert.match(src, /function combat\(event\)[^]*event\.banked[^]*after - amount/);
  const fh = readFileSync(new URL('../pvp/fight-hud.js', import.meta.url), 'utf8');
  assert.match(fh, /hud2\?\.combat\?\.\(event\)/);
  assert.match(fh, /CAN BEKLİYOR/);
});
