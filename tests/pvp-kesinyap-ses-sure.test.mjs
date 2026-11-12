import test from 'node:test';
import assert from 'node:assert/strict';
import {createVoiceQueue,VOICE_QUEUE} from '../pvp/voice-queue.js';
import {createStreakTracker,streakFrequency,streakStep,STREAK_THRESHOLDS,STREAK_ANNOUNCE,STREAK_BASE_HZ} from '../pvp/streak-sound.js';
import {endVoicePlan} from '../pvp/end-voice.js';
import {ANNOUNCE_NAMES} from '../pvp/sound.js';
import {createMatch,surrenderMatch,roundDurationMs,advanceMatch,ROUND_DURATION_MS} from '../pvp/shared/match.js';
import {roundsViewModel} from '../pvp/rounds-ui.js';
import {publicMatch} from '../pvp/shared/match.js';
import * as cf from '../cloudflare/src/match.js';

// ── İŞ 4: seri perdesi ──
test('iş 4: doğru sayısı arttıkça perde yükselir (1..8), 8+ son basamakta kalır', () => {
  const hz = [1, 2, 3, 4, 5, 6, 7, 8, 9, 20].map(streakFrequency);
  for (let i = 1; i < 8; i++) assert.ok(hz[i] > hz[i - 1], `basamak ${i + 1} daha ince olmalı`);
  assert.equal(hz[0], STREAK_BASE_HZ);
  assert.equal(hz[8], hz[7]); assert.equal(hz[9], hz[7]);
  assert.equal(streakStep(0), 1); assert.equal(streakStep(99), 8);
});
test('iş 4: yanlışta seri sıfırlanır, perde başa döner; eşikler 5/10/15 bildirilir', () => {
  const t = createStreakTracker();
  const seen = [];
  for (let i = 0; i < 6; i++) seen.push(t.hit());
  assert.deepEqual(seen.map(s => s.threshold), [null, null, null, null, 5, null]);
  assert.ok(seen[5].hz > seen[0].hz);
  t.reset();
  assert.equal(t.count, 0);
  const first = t.hit();
  assert.equal(first.hz, STREAK_BASE_HZ); assert.equal(first.n, 1); assert.equal(first.step, 1);
  for (let i = 0; i < 14; i++) t.hit();
  assert.deepEqual([...STREAK_THRESHOLDS], [5, 10, 15]);
  // anons yalnız dosyası olan eşikte (seri-5); dosya adı mevcut anons listesinde olmalı
  for (const name of Object.values(STREAK_ANNOUNCE)) assert.ok(ANNOUNCE_NAMES.includes(name));
});

// ── İŞ 5: tek kuyruk ──
function harness(opts = {}) {
  let t = 0; const started = [], dones = [];
  const q = createVoiceQueue({now: () => t, start: (item, done) => { started.push(item.key); dones.push(done); return true; }, ...opts});
  return {q, started, dones, at: v => { t = v; }};
}
test('iş 5: aynı anda tek konuşma; kuyruk en çok 2 öğe, en düşük öncelik atılır', () => {
  const h = harness();
  h.q.push({key: 'a', priority: 1});
  h.q.push({key: 'b', priority: 2}); h.q.push({key: 'c', priority: 3}); h.q.push({key: 'd', priority: 1});
  assert.deepEqual(h.started, ['a']); assert.equal(h.q.state().queued.length, 2);
  assert.deepEqual(h.q.state().queued, ['c', 'b']);
  h.dones[0](); assert.deepEqual(h.started, ['a', 'c']);
  h.dones[1](); assert.deepEqual(h.started, ['a', 'c', 'b']); // asla iki konuşma birden başlamaz
});
test('iş 5: bayat (>2,5 sn bekleyen) anons düşer; ttlMs 6000 verilse bile üst sınır 2,5 sn', () => {
  assert.equal(VOICE_QUEUE.staleMs, 2500);
  const h = harness();
  h.q.push({key: 'uzun'}); h.q.push({key: 'bekleyen', ttlMs: 6000});
  h.at(2600); h.dones[0]();
  assert.deepEqual(h.started, ['uzun']);
  const g = harness();
  g.q.push({key: 'x'}); g.q.push({key: 'y'});
  g.at(2400); g.dones[0](); assert.deepEqual(g.started, ['x', 'y']);
});
test('iş 5: aynı anons cooldown içinde tekrarlanmaz, kuyrukta çift girmez', () => {
  const h = harness();
  assert.equal(h.q.push({key: 'spiker-sure', cooldownMs: 4000}), true);
  h.dones[0]();
  h.at(1000); assert.equal(h.q.push({key: 'spiker-sure', cooldownMs: 4000}), false);
  h.at(4100); assert.equal(h.q.push({key: 'spiker-sure', cooldownMs: 4000}), true);
  const g = harness();
  g.q.push({key: 'a'}); g.q.push({key: 'b'});
  assert.equal(g.q.push({key: 'b'}), false); assert.equal(g.q.push({key: 'a'}), false);
});

// ── İŞ 6: zafer repliği yalnız kazanan yerel oyuncu ──
test('iş 6: teslim eden oyuncu zafer repliği çalmaz (rakip kazanır); gerçek motorla sabitlendi', () => {
  const players = [{playerId: 'a', seat: 1, name: 'A', fighter: 'vargr', character: 'fire'}, {playerId: 'b', seat: 2, name: 'B', fighter: 'nyx', character: 'rune'}];
  for (const loser of [1, 2]) {
    const m = surrenderMatch(createMatch(players, 1000, 'tsl', {rounds: 5, seed: 1}), loser, 5000);
    assert.equal(m.winnerSeat, loser === 1 ? 2 : 1); assert.equal(m.endReason, 'SURRENDER');
    const mine = endVoicePlan({winnerSeat: m.winnerSeat, mySeat: loser});   // teslim eden
    assert.equal(mine.zaferSeat, null); assert.equal(mine.jingle, 'defeat'); assert.equal(mine.announce, 'spiker-yenilgi');
    const other = endVoicePlan({winnerSeat: m.winnerSeat, mySeat: m.winnerSeat});
    assert.equal(other.zaferSeat, m.winnerSeat); assert.equal(other.jingle, 'victory'); assert.equal(other.announce, 'spiker-zafer');
  }
});
test('iş 6: berabere / iptal / izleyici durumunda kimse zafer demez', () => {
  for (const args of [{winnerSeat: null, mySeat: 1}, {winnerSeat: undefined, mySeat: 2}, {winnerSeat: 1, mySeat: null}, {winnerSeat: 3, mySeat: 3}]) {
    const p = endVoicePlan(args); assert.equal(p.zaferSeat, null);
  }
  assert.equal(endVoicePlan({winnerSeat: null, mySeat: 1}).announce, null);
});

// ── MEKANİK: sayılı raund süresi ──
test('mekanik: sayılı raund süresi = max(40 sn, kelime × 6 sn); timed 40 sn kalır', () => {
  const c = n => roundDurationMs({roundStyle: 'counted', roundWords: n});
  assert.equal(c(5), 40_000); assert.equal(c(7), 42_000); assert.equal(c(10), 60_000); assert.equal(c(15), 90_000); assert.equal(c(20), 120_000);
  assert.equal(roundDurationMs({roundStyle: 'timed', roundWords: 15}), 40_000);
  assert.equal(roundDurationMs({}), 40_000); // varsayılan stil timed
  assert.equal(ROUND_DURATION_MS, 40_000);
  assert.equal(cf.roundDurationMs, roundDurationMs); // sunucu tarafı aynı yardımcıyı yeniden dışa aktarır
});
test('mekanik: motor raund bitişini ve kişisel bitişi yardımcıdan alır; arayüz sayacı aynı toplamı kullanır', () => {
  const players = [{playerId: 'a', seat: 1, name: 'A', fighter: 'sira', character: 'fire'}, {playerId: 'b', seat: 2, name: 'B', fighter: 'nyx', character: 'rune'}];
  for (const [style, words, expected] of [['counted', 5, 40_000], ['counted', 10, 60_000], ['counted', 15, 90_000], ['timed', 15, 40_000]]) {
    const m = createMatch(players, 1000, 'dur', {rounds: 5, seed: 9, roundStyle: style, roundWords: words});
    assert.equal(m.round.endsAt - m.round.startedAt, expected, `${style}/${words}`);
    assert.ok(m.participants.every(p => p.roundEndsAt === m.round.endsAt));
    const vm = roundsViewModel(publicMatch(m, 1), 'a', m.round.startedAt);
    assert.equal(vm.timer.fraction, 1); assert.equal(vm.timer.seconds, expected / 1000);
    assert.equal(roundsViewModel(publicMatch(m, 1), 'a', m.round.startedAt + expected / 2).timer.fraction, 0.5);
    assert.equal(advanceMatch(m, m.round.endsAt - 1).match.round.phase, 'round');
  }
});
