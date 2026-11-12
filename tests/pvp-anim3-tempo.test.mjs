// İş 1, 3. tur (KESINYAP) — okunur dövüş temposu: saf sahne çizelgesi, ışınlanmasız konum eğrisi, dönüşte yön,
// sahne karesine bağlı ses tetikleme, maç sonu konuşma sırası.
import test from 'node:test';
import assert from 'node:assert/strict';
import {SCENE, sceneTiming, sceneProgress, sceneTurn, locoTimeScale} from '../pvp/fighters3d.js';
import {turnGapMs, TURN} from '../pvp/visual-timeline.js';
import {MAX_FWD_STEP, MAX_WORLD_SPEED} from '../pvp/arena3d.js';
import {createSceneCues} from '../pvp/sound.js';
import {createVoiceQueue} from '../pvp/voice-queue.js';
import {endVoicePlan, endVoiceSteps} from '../pvp/end-voice.js';

const VARGR_Q = {peakMs: 1060, clipMs: 2800, ranged: false};
const NYX_Q = {peakMs: 900, clipMs: 2270, ranged: true};

test('yakın sahne evreleri: telegraf ~350, gidiş ≥ 800, vuruş doğal hızda, dönüş ≥ 900, toplam 3,5–4,6 sn', () => {
  const T = sceneTiming([VARGR_Q]);
  assert.equal(T.telegraphMs, 350);
  assert.ok(T.arrive - T.telegraphMs >= 800 && T.arrive - T.telegraphMs <= 1100, 'gidiş');
  const s = T.strikes[0];
  assert.equal(s.speed, 1, 'hızlandırma yok');
  assert.equal(s.offsetMs, 1060 - 750, 'hazırlık penceresi 750 ms');
  assert.ok(s.contact - s.start === 750, 'temas = klip zirvesi');
  assert.ok(T.returnStart >= s.contact + 700, 'takip (follow-through) görünür');
  assert.ok(T.homeAt - T.moveStart >= 900, 'dönüş ≥ 900 ms');
  assert.ok(T.totalMs - T.homeAt >= 200, 'yerine varınca rakibe dönüş');
  assert.ok(T.totalMs >= 3500 && T.totalMs <= 4600, `toplam ${T.totalMs}`);
});

test('baskıda hız en çok 1,25 (klip ve evreler orantılı), zincirde vuruşlar art arda', () => {
  const T = sceneTiming([VARGR_Q, VARGR_Q, VARGR_Q], {compress: true});
  assert.ok(T.strikes.every(s => s.speed <= SCENE.speedMax && s.speed >= 0.9));
  assert.equal(T.contacts.length, 3);
  for (let i = 1; i < 3; i++) assert.ok(T.contacts[i] > T.contacts[i - 1] + 400, 'her vuruş kendi temas karesinde');
  assert.equal(sceneTiming([VARGR_Q, VARGR_Q, VARGR_Q, VARGR_Q]).contacts.length, SCENE.maxStrikes, 'en çok 3 vuruş');
  assert.ok(sceneTiming([VARGR_Q], {compress: true}).totalMs * SCENE.speedMax >= sceneTiming([VARGR_Q]).totalMs - 1);
});

test('menzilli: yerinde kalır; temas = el bırakma + görünür mermi uçuşu (500–700 ms)', () => {
  const T = sceneTiming([NYX_Q]);
  assert.equal(T.moveIn, 0);
  const s = T.strikes[0];
  assert.ok(s.contact - s.release >= 500 && s.contact - s.release <= 700);
  for (let ms = 0; ms <= T.totalMs; ms += 50) assert.equal(sceneProgress(ms, T), 0, 'kayma yok');
});

test('konum eğrisi: telegrafta 0, sürekli; ölçülen en uzun yolda (3,17 → 3,2 birim) 60 fps kare başına ≤ 0,12; eve döner', () => {
  const dist = 3.2;
  const T = sceneTiming([VARGR_Q, VARGR_Q]);
  let prev = 0, max = 0;
  for (let ms = 0; ms <= T.totalMs + 50; ms += 1000 / 60) {
    const v = sceneProgress(ms, T);
    if (ms <= T.telegraphMs) assert.equal(v, 0);
    max = Math.max(max, Math.abs(v - prev) * dist); prev = v;
  }
  assert.ok(max <= MAX_FWD_STEP, `${max.toFixed(3)} birim/kare`);
  assert.equal(sceneProgress(T.arrive + 10, T), 1);
  assert.ok(Math.abs(sceneProgress(T.totalMs, T)) < 1e-9, 'yerine döner');
  assert.ok(MAX_FWD_STEP <= 0.12 && MAX_WORLD_SPEED <= 0.12 * 60);
});

test('dönüş yönü: gidiş/vuruşta rakibe, dönüşte eve, varınca yine rakibe bakar', () => {
  const T = sceneTiming([VARGR_Q]);
  assert.equal(sceneTurn(T.arrive, T), 0);
  assert.equal(sceneTurn(T.strikes[0].contact, T), 0);
  assert.equal(sceneTurn((T.moveStart + T.homeAt) / 2, T), 1, 'koşarak dönerken yüz eve');
  assert.equal(sceneTurn(T.homeAt + T.turnMs, T), 0, 'yerinde rakibe döndü');
});

test('koşu klibi hızı yol hızına oranlanır, sınırlı', () => {
  assert.equal(locoTimeScale(0), SCENE.locoTsMin);
  assert.equal(locoTimeScale(1e6), SCENE.locoTsMax);
  assert.ok(Math.abs(locoTimeScale(SCENE.runRefSpeed * 0.8) - 0.8) < 1e-9);
});

test('saldıran değişimi arası 1,0–2,0 sn (baskıda/boşaltmada da ≥ 1 sn)', () => {
  assert.ok(TURN.breathMs >= 1200 && TURN.breathMs <= 1600);
  assert.ok(turnGapMs(1e9) >= 1000);
  assert.ok(turnGapMs(0, {draining: true}) >= 1000);
});

test('sahne sesleri: olay anında değil sahne karesinde; aynı ad bir kez; bayat olan atılır', () => {
  let t = 0; const played = [];
  const cues = createSceneCues({play: (n, o) => played.push([n, o?.gain]), now: () => t, maxAgeMs: 5000});
  cues.wait('cast', 1, 'attack-turn', {gain: .6});
  cues.wait('cast', 1, 'attack-turn', {gain: .6});
  cues.wait('cast', null, 'clash', {gain: .78});
  cues.wait('hitTo', 2, 'shield', {gain: 1});
  assert.deepEqual(played, [], 'sunucu olayı anında ses yok');
  cues.fire('cast', 2);
  assert.deepEqual(played, [['clash', .78]], 'koltuksuz (clash) ilk sahne karesinde');
  cues.fire('cast', 1);
  assert.deepEqual(played.at(-1), ['attack-turn', .6]);
  assert.equal(played.filter(p => p[0] === 'attack-turn').length, 1, 'yığılmış aynı ses tek');
  t = 6000; cues.fire('hitTo', 2);
  assert.equal(played.some(p => p[0] === 'shield'), false, 'sahnesi oynamayan eski ses çalmaz');
});

test('maç sonu: bekleyen replikler atılır → zafer repliği → bitiş spikeri (bayatlıktan muaf)', () => {
  const steps = endVoiceSteps(endVoicePlan({winnerSeat: 1, mySeat: 1}));
  assert.deepEqual(steps.map(s => s.kind), ['drop', 'speak', 'announce']);
  assert.equal(steps[1].key, 'zafer');
  assert.ok(steps[1].opts.priority > steps[2].opts.priority, 'zafer önce');
  assert.equal(steps[2].opts.noStale, true);
  assert.deepEqual(endVoiceSteps(endVoicePlan({winnerSeat: 2, mySeat: 1})).map(s => s.kind), ['drop', 'announce'], 'kaybeden zafer demez');

  let t = 0; const order = []; let finish = null;
  const q = createVoiceQueue({now: () => t, start: (item, done) => { order.push(item.key); finish = done; return true; }});
  q.push({key: 'replik-a', priority: 1});      // çalıyor
  q.push({key: 'replik-b', priority: 1});      // bekliyor (düşük öncelik)
  q.dropQueued();
  q.push({key: 'zafer', priority: 4, ttlMs: 2500});
  q.push({key: 'anons/spiker-zafer', priority: 3, ttlMs: 12000, noStale: true});
  t = 4000; finish();                          // uzun replik bitti → zafer bayat (atılır), spiker muaf
  finish();
  assert.deepEqual(order, ['replik-a', 'anons/spiker-zafer']);
  t = 0; order.length = 0;
  const q2 = createVoiceQueue({now: () => t, start: (item, done) => { order.push(item.key); finish = done; return true; }});
  q2.push({key: 'x', priority: 1}); q2.push({key: 'zafer', priority: 4}); q2.push({key: 'anons/spiker-zafer', priority: 3, ttlMs: 12000, noStale: true});
  t = 1000; finish(); t = 4500; finish();
  assert.deepEqual(order, ['x', 'zafer', 'anons/spiker-zafer'], 'sıra: zafer → spiker; spiker 2,5 sn sonra da çalar');
});
