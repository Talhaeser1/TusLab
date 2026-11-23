// KESINYAP 19: "süre doluyor" uyarısı hiçbir modda çalmaz/görünmez. Kural süreleri değişmez; ses dosyası durur, yalnız tetikleme kapalı.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {roundsViewModel} from '../pvp/rounds-ui.js';

const src = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const view = (style, now, words = 7) => ({mode: 'rounds', status: 'running', matchId: 'x', totalRounds: 7, blindClock: false,
  round: {index: 2, total: 7, suddenDeath: false, phase: 'round', words: Array(words).fill('kelime'), wordCount: words, startedAt: 1000, endsAt: style === 'timed' ? 31_000 : 121_000, style},
  players: [{seat: 1, playerId: 'me', name: 'A', roundWordIndex: 1, roundEndsAt: style === 'timed' ? 31_000 : 121_000}, {seat: 2, playerId: 'op', name: 'B', roundWordIndex: 1, roundEndsAt: style === 'timed' ? 31_000 : 121_000}]});

test('süre doluyor: zamana karşı ve kelime raundunda hiçbir saniyede rozet/yazı yok', () => {
  for (const style of ['timed', 'counted']) {
    const end = style === 'timed' ? 31_000 : 121_000;
    for (let t = 1500; t <= end; t += 500) {
      const vm = roundsViewModel(view(style, t), 'me', t);
      assert.equal(vm.lastCall.active, false, `${style} ${t}`);
      assert.equal(vm.lastCall.text, '');
    }
  }
});

test('süre doluyor: sayaç görünür kalır, son 5 sn yalnız renk (urgent) değişir', () => {
  const vm = roundsViewModel(view('timed', 27_000), 'me', 27_000);
  assert.equal(vm.timer.seconds, 4); assert.equal(vm.timer.urgent, true); assert.equal(vm.timer.hidden, false);
});

test('süre doluyor: anons tetikleme noktaları kapalı, ses dosyası/adı duruyor', () => {
  assert.ok(!/announce\?\.\('spiker-sure'/.test(src('pvp/pvp-main.js')), 'index.js spiker-sure çağırmamalı');
  assert.ok(!/saniye kaldı/.test(src('pvp/arena-ui.js')), 'arena ekran okuyucu "N saniye kaldı" kalktı');
  assert.ok(/name==='spiker-sure'\)return false/.test(src('pvp/sound.js')), 'sound.announce spiker-sure sessiz');
  assert.ok(/spiker-sure/.test(src('pvp/sound.js')), 'ses adı silinmedi');
  const css = src('pvp/fight-hud.css');
  assert.ok(!/tt-clock-urgent[^{]*\{[^}]*animation:\s*tt-clock-urgent/.test(css), 'sayaç yanıp sönmez');
  assert.ok(!/Raund kapanıyor'/.test(src('pvp/rounds-ui.js').replace(/\/\/.*$/gm, '')), 'rounds-ui "Raund kapanıyor" metni yok');
});
