// İş 1 (KESINYAP) — dövüş temposu: saldıran değişiminde ara, sıra kilidi, kuyruk sıkıştırma, boşaltma.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createVisualTimeline, turnGapMs, TURN, VISUAL_QUEUE} from '../pvp/visual-timeline.js';
import {chainTiming, chainProgress, COMBO} from '../pvp/fighters3d.js';

const scene = (seat, ms, log) => ({seat, estimateMs: ms, keep: true, // arena saldırı sahneleri gibi düşürülmez
  start: () => { log.push(`start${seat}`); return {contacts: [{ms: Math.round(ms / 3), fn: () => log.push(`hit${seat}`)}], durationMs: ms}; },
  onEnd: ({forced, cancelled}) => log.push(`${cancelled ? 'cancel' : forced ? 'forced' : 'end'}${seat}`)});

test('turnGapMs: varsayılan ~1,2 sn; baskıda orantılı kısalır ama 0,6 sn altına inmez; boşaltmada en kısa', () => {
  assert.equal(turnGapMs(0), TURN.breathMs);
  assert.ok(TURN.breathMs >= 1000 && TURN.breathMs <= 2000);
  assert.equal(turnGapMs(VISUAL_QUEUE.maxBacklogMs), TURN.breathMs);
  const mid = turnGapMs(VISUAL_QUEUE.maxBacklogMs * 1.5);
  assert.ok(mid < TURN.breathMs && mid >= TURN.minMs, `orantılı: ${mid}`);
  assert.equal(turnGapMs(1e9), TURN.minMs);
  assert.equal(turnGapMs(0, {draining: true}), TURN.minMs);
  assert.ok(TURN.minMs >= 600);
  assert.equal(turnGapMs(0, {base: 0}), 0, 'kapalı');
});

test('sıra kilidi: saldıran değişince ara, iki taraf YERLEŞİK olmadan sayılmaz; aynı koltuk kısa pay', () => {
  const log = []; let settled = false;
  const q = createVisualTimeline({breathMs: TURN.breathMs, isSettled: () => settled});
  q.enqueue(scene(1, 900, log)); q.enqueue(scene(2, 900, log)); q.enqueue(scene(2, 900, log));
  q.tick(900);
  assert.deepEqual(log, ['start1', 'hit1', 'end1']);
  q.tick(500); // savunan hâlâ tepkide: ara sayılmaz
  assert.equal(log.includes('start2'), false);
  assert.ok(q.snapshot().gapLeftMs > 0);
  settled = true;
  q.tick(TURN.breathMs - 20);
  assert.equal(log.includes('start2'), false, 'ara dolmadan ikinci koltuk başlamaz');
  q.tick(40);
  assert.equal(log.filter(x => x === 'start2').length, 1);
  q.tick(900); // 2. koltuğun ilk sahnesi bitti; aynı koltuğun yeni yaklaşması yalnız kısa pay bekler
  q.tick(TURN.sameSeatMs + 20);
  assert.equal(log.filter(x => x === 'start2').length, 2);
});

test('sıra kilidi: yerleşme hiç gelmezse tavan (settleCapMs) sonra ara yine sayılır — kilitlenme yok', () => {
  const log = [];
  const q = createVisualTimeline({breathMs: TURN.breathMs, isSettled: () => false});
  q.enqueue(scene(1, 600, log)); q.enqueue(scene(2, 600, log));
  q.tick(600);
  for (let t = 0; t < TURN.settleCapMs + TURN.breathMs + 50; t += 16) q.tick(16);
  assert.ok(log.includes('start2'));
  assert.ok(TURN.settleCapMs + TURN.breathMs <= TURN.maxMs, 'en kötü ara ≤ 2 sn');
});

test('gecikme: kuyruk boş beklediyse yeni saldırı (öbür koltuk bile olsa) aynı karede başlar', () => {
  const log = [];
  const q = createVisualTimeline({breathMs: TURN.breathMs});
  q.enqueue(scene(1, 600, log));
  q.tick(600);
  for (let t = 0; t < TURN.breathMs + 100; t += 16) q.tick(16);
  q.enqueue(scene(2, 600, log));
  assert.equal(log.at(-1), 'start2', 'enqueue anında başladı (0 ms)');
});

test('asla iki sahne aynı anda değil: yoğun karışık kuyrukta her an en fazla bir aktif koltuk', () => {
  const log = []; const q = createVisualTimeline({breathMs: TURN.breathMs});
  for (let i = 0; i < 8; i++) q.enqueue({...scene((i % 2) + 1, 700, log), keep: true});
  let active = 0, maxActive = 0;
  const live = new Set();
  for (let t = 0; t < 20000; t += 16) {
    const before = log.length; q.tick(16);
    for (const e of log.slice(before)) { if (e.startsWith('start')) live.add(e); if (/^(end|forced)/.test(e)) live.clear(); }
    active = live.size; maxActive = Math.max(maxActive, active);
  }
  assert.equal(maxActive, 1);
  assert.equal(q.stats.forced, 0);
});

test('boşaltma: süre dolunca başlamamış girdiler biter ama OYNAYAN sahne kesilmez; iptal sessizdir', () => {
  const log = []; const q = createVisualTimeline({breathMs: TURN.breathMs});
  q.enqueue(scene(1, 1500, log));
  const h = q.enqueue(scene(2, 900, log));
  const h3 = q.enqueue(scene(1, 900, log));
  assert.equal(h3.cancel(), true);
  assert.ok(log.includes('cancel1') && !log.includes('forced1'), 'iptal: zorla bitirme yok');
  q.tick(100);
  q.drain(300);
  q.tick(300); // süre doldu
  assert.ok(log.includes('forced2'), 'başlamamış girdi bitti');
  assert.equal(log.includes('forced1'), false, 'oynayan sahne kesilmedi');
  q.tick(1100);
  assert.ok(log.includes('end1'));
  assert.equal(q.isBusy(), false);
  assert.equal(h.cancel(), false, 'bitmiş girdi iptal edilmez');
});

test('flush (raund geçişi) sonrası yeni sahne ara beklemez', () => {
  const log = []; const q = createVisualTimeline({breathMs: TURN.breathMs});
  q.enqueue(scene(1, 900, log)); q.tick(100); q.flush();
  q.enqueue(scene(2, 900, log));
  assert.equal(log.at(-1), 'start2');
});

test('yürüyüş: yaklaşma/dönüş 60 fps karede ≤ 0,35 birim (≈3,6 birimlik mesafe), sıkıştırmada da', () => {
  const dist = 3.6;
  for (const compress of [false, true]) {
    for (const ranged of [false, true]) {
      const t = chainTiming(3, {compress, ranged});
      const o = {travelMs: t.lead, returnStart: t.returnStart, returnMs: t.returnMs};
      const d = ranged ? dist * COMBO.rangedStop : dist;
      let prev = chainProgress(0, o), max = 0;
      for (let ms = 1000 / 60; ms <= t.totalMs + 20; ms += 1000 / 60) { const v = chainProgress(ms, o); max = Math.max(max, Math.abs(v - prev) * d); prev = v; }
      assert.ok(max <= 0.35, `compress=${compress} ranged=${ranged}: ${max.toFixed(3)} birim/kare`);
      assert.ok(Math.abs(chainProgress(t.totalMs, o)) < 1e-6, 'yerine döner (snap yok)');
    }
  }
});
