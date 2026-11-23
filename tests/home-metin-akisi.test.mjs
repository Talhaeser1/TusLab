// Ana sayfa metin akışı (home/arena.js) ve metin verisi (home/data/texts.js) testleri.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as A from '../home/arena.js';
import * as T from '../home/data/texts.js';

function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

test('akış: her kategori için bir turda aynı öğe ve aynı atasözü parçası iki kez gelmez', () => {
  for (const mode of A.STREAM_MODES) {
    for (const seed of [1, 7, 42]) {
      const st = A.createStream(mode, { rng: seeded(seed) });
      assert.ok(st.size >= 20, mode + ' havuzu küçük: ' + st.size);
      const ids = new Set();
      const parts = new Set();
      let it = st.next();
      const round = it.round;
      while (it && it.round === round) {
        assert.ok(!ids.has(it.id), mode + ' tekrar: ' + it.id);
        ids.add(it.id);
        for (const p of it.parts) {
          assert.ok(!parts.has(p), mode + ' parça tekrarı: ' + p);
          parts.add(p);
        }
        assert.ok(it.text && it.text.length >= 8);
        it = st.next();
      }
      // Turda bütün içerik yazılır: zincire giren tek atasözleri zincirin içinde gelmiş sayılır.
      const allParts = new Set(A.itemsFor(mode).flatMap((x) => x.parts));
      assert.ok(parts.size >= allParts.size * 0.9, mode + ': turda içeriğin çoğu gelmedi (' + parts.size + '/' + allParts.size + ')');
    }
  }
});

test('akış: havuz bitince yeniden karışır, sınırda aynı öğe art arda gelmez', () => {
  for (const mode of A.STREAM_MODES) {
    const st = A.createStream(mode, { rng: seeded(3) });
    let prev = null;
    for (let i = 0; i < st.size * 3; i++) {
      const it = st.next();
      assert.ok(it, mode + ' akış tükendi');
      if (prev) assert.notEqual(it.id, prev.id, mode + ' art arda aynı öğe');
      prev = it;
    }
    assert.ok(st.round >= 2);
  }
});

test('akış: zor olanlar önce (atasözü seviye 3–4, diğerleri en zor üçte bir)', () => {
  const pv = A.createStream('atasozu', { rng: seeded(11) });
  const hard = A.itemsFor('atasozu').filter((x) => x.level >= 3).length;
  for (let i = 0; i < 40; i++) assert.ok(pv.next().level >= 3, 'ilk 40 atasözünde kolay atasözü çıktı');
  assert.ok(hard >= 60);
  for (const mode of ['deyim', 'tekerleme', 'ozdeyis', 'siir']) {
    const items = A.itemsFor(mode);
    const top = items.filter((x) => x.tier === 0);
    const st = A.createStream(mode, { rng: seeded(5) });
    const first = Array.from({ length: Math.min(5, top.length) }, () => st.next());
    first.forEach((x) => assert.equal(x.tier, 0, mode + ': ilk öğeler en zor dilimden olmalı'));
    const minTop = Math.min(...top.map((x) => x.score));
    const maxLow = Math.max(...items.filter((x) => x.tier === 2).map((x) => x.score));
    assert.ok(minTop >= maxLow, mode + ': dilimler zorluk sırasına uymuyor');
  }
});

test('akış: kaynak satırı (şiir yazar — başlık, özdeyiş yazar, deyim anlamı metinde)', () => {
  const p = A.itemsFor('siir')[0];
  assert.match(p.source, / — /);
  A.itemsFor('ozdeyis').forEach((q) => assert.ok(q.source && q.source !== 'Özdeyiş', 'yazarsız özdeyiş: ' + q.text));
  A.itemsFor('deyim').forEach((d) => assert.match(d.text, /: /));
});

test('ana ekran arabirimi: nextChunk / pickText / isStreamMode', async () => {
  assert.deepEqual(A.STREAM_MODES.slice().sort(), ['atasozu', 'deyim', 'ozdeyis', 'siir', 'tekerleme']);
  assert.equal(A.isStreamMode('kelime'), false);
  const a = A.nextChunk('atasozu');
  const b = A.nextChunk('atasozu');
  assert.ok(a.text && b.text && a.text !== b.text);
  // kelime havuzu açılışta yüklenmez (Tuşçu): önce loadWords()
  assert.equal(typeof A.loadWords, 'function');
  await A.loadWords();
  assert.equal(A.wordsReady(), true);
  const k = A.pickText('kelime');
  assert.ok(k.text.split(' ').length >= 20);
  const t = A.pickText('atasozu');
  assert.ok(t.text.length >= 100);
  assert.ok(A.MODES.every((m) => m.id && m.label));
});

test('metin verisi: biçim, tekrar yok, yazılabilir harfler', () => {
  const low = (s) => s.toLocaleLowerCase('tr').replace(/[.!?]+$/, '').trim();
  const uniq = (arr, name) => {
    const s = new Set();
    arr.forEach((x) => {
      assert.ok(!s.has(low(x)), name + ' tekrar: ' + x);
      s.add(low(x));
    });
  };
  uniq(T.PROVERBS.map((x) => x.text), 'atasözü');
  uniq(T.IDIOMS.map((x) => x.text), 'deyim');
  uniq(T.TWISTERS, 'tekerleme');
  uniq(T.QUOTES.map((x) => x.text), 'özdeyiş');
  const all = [...T.PROVERBS.map((x) => x.text), ...T.IDIOMS.flatMap((x) => [x.text, x.meaning]), ...T.TWISTERS,
    ...T.QUOTES.map((x) => x.text), ...T.POEMS.flatMap((p) => p.lines)];
  all.forEach((s) => assert.doesNotMatch(s, /[âîûÂÎÛ]/, 'şapkalı harf: ' + s));
  T.PROVERBS.forEach((p) => {
    assert.ok([1, 2, 3, 4].includes(p.level), p.text);
    if (p.level === 4) assert.match(p.text, /;/, 'seviye 4 zincir olmalı: ' + p.text);
    if (p.level === 1) assert.ok(p.text.length <= 26, 'seviye 1 uzun: ' + p.text);
  });
  const lv = (n) => T.PROVERBS.filter((p) => p.level === n).length;
  assert.ok(lv(3) + lv(4) >= 80);
  // Deyim olan kalıplar atasözü listesinde olmamalı.
  assert.ok(!T.PROVERBS.some((p) => /^(Saman altından|Kaş yapayım|Gözünü budaktan|Yağmurdan kaçarken)/.test(p.text)));
  T.IDIOMS.forEach((d) => assert.ok(d.meaning, d.text));
  T.QUOTES.forEach((q) => assert.ok(q.author, q.text));
  T.POEMS.forEach((p) => assert.ok(p.id && p.title && p.author && p.lines.length >= 2, p.id));
  assert.equal(new Set(T.POEMS.map((p) => p.id)).size, T.POEMS.length);
});
