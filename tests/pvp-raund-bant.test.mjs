import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {summaryModel} from '../pvp/rounds-ui.js';

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const match = {matchId: 'm', mode: 'rounds', round: {index: 4, total: 7, style: 'timed'}, players: [
  {seat: 1, playerId: 'rival', name: 'Rakip', fighter: 'sira'}, {seat: 2, playerId: 'me', name: 'Ben', fighter: 'vargr'}]};
const end = {round: 4, scores: [
  {seat: 1, damageDealt: 927, correct: 18, wrong: 3, bestStreak: 8}, {seat: 2, damageDealt: 1300, correct: 25, wrong: 2, bestStreak: 11}], next: {round: 5, style: 'timed', seconds: 30}};

test('raund arası bandı: solda rakip, sağda sen; tavan rozeti yalnız tavanda; kalan can yazılmaz', () => {
  const m = summaryModel(end, match, 'me');
  assert.deepEqual(m.duel.map(d => [d.label, d.damage, d.capped]), [['Rakip vurdu', '927', false], ['Sen vurdun', '1.300', true]]);
  assert.equal(m.duel[0].detail, '18 doğru · 3 yanlış · seri 8');
  assert.equal(m.duel[1].detail, '25 doğru · 2 yanlış · seri 11');
  assert.equal(m.countText, 'Raund 5 başlıyor');
  assert.deepEqual([m.progress.filled, m.progress.total], [4, 7]);
  // koltuk 1'deki oyuncu için de rakip solda, sen sağda
  const m1 = summaryModel(end, match, 'rival');
  assert.deepEqual(m1.duel.map(d => d.label), ['Rakip vurdu', 'Sen vurdun']);
  assert.equal(m1.duel[1].damage, '927');
});

test('raund arası bandı CSS: sayılar tek satır, ortadaki ayrı sayım kutusu gizli, beceriler tek satırda 3 sütun', () => {
  const css = read('pvp/rounds-ui.css');
  assert.match(css, /\.m33-dmg\{[^}]*white-space:nowrap/);
  assert.match(css, /#pvp-root\.rui-inter-open \.rui-intro\{display:none!important\}/);
  assert.match(css, /\.rui-skill-cards\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css, /width:min\(960px,var\(--rui-band-w,960px\),calc\(100vw - 16px\)\)/);
  assert.match(css, /\.m33-result\.m33-band \.m33-who\{[^}]*word-break:normal/);
  assert.match(read('pvp/arena-ui.css'), /aui-summary:has\(\.m33-band\)/);
  assert.match(read('pvp/resolve-ui.css'), /\.tt-type \.rsv-banner\{[^}]*height:24px/);
});
