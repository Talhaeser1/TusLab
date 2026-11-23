// Osmanlı padişahları yazma içeriği (home/data/sultans.js + home/arena.js 'padisah' modu).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as A from '../home/arena.js';
import { SULTANS } from '../home/data/sultans.js';

const NAMES = ['Osman Gazi', 'Orhan Gazi', 'I. Murad', 'I. Bayezid', 'I. Mehmed', 'II. Murad', 'II. Mehmed', 'II. Bayezid', 'I. Selim', 'I. Süleyman'];

test('padişahlar: baştan ilk 10, sıra numaralı, saltanat yıllı', () => {
  assert.equal(SULTANS.length, 10);
  SULTANS.forEach((s, i) => {
    assert.equal(s.no, i + 1);
    assert.ok(s.name.startsWith(NAMES[i]), s.name);
    assert.match(s.reign, /\d{4}–\d{4}/);
    assert.ok(s.facts.length >= 3, s.name);
    s.facts.forEach((f) => assert.doesNotMatch(f, /[âîûÂÎÛ–—]/, 'yazılamaz harf: ' + f));
  });
  assert.equal(new Set(SULTANS.map((s) => s.id)).size, 10);
  // Bilinen saltanat uçları
  assert.equal(SULTANS[1].reign, '1324–1362');
  assert.equal(SULTANS[6].reign, '1444–1446, 1451–1481');
  assert.equal(SULTANS[9].reign, '1520–1566');
});

test('padişah modu: menüde, akışta ve Osman Gazi ile başlayıp sırayla gelir', () => {
  assert.ok(A.MODES.some((m) => m.id === 'padisah'));
  assert.ok(A.isStreamMode('padisah'));
  const items = A.itemsFor('padisah');
  assert.equal(items.length, 30);
  const st = A.createStream('padisah', { rng: () => 0.5 });
  const got = Array.from({ length: 30 }, () => st.next());
  assert.deepEqual(got.map((x) => x.sultan), items.map((x) => x.sultan));
  assert.ok(got[0].text.startsWith('Osman Gazi'));
  assert.match(got[0].source, /^1\. padişah · Osman Gazi/);
  assert.match(got[29].source, /^10\. padişah · I\. Süleyman \(Kanuni\)/);
  // Tur bitince yine baştan
  assert.equal(st.next().sultan, 1);
});
