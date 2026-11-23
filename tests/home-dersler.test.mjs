// Klavye dersleri: veri sözleşmesi (home/data/lessons.js), buildDrill ve derecelendirme (home/lessons.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as LD from '../home/data/lessons.js';
import { WORDS } from '../home/data/words.js';
import { rate, lessonUnlocked, intentLessonIndex } from '../home/lessons.js';
import { PROVERBS } from '../home/data/texts.js';

const { LESSONS, UNITS, FINGERS, KEY_ROWS } = LD;
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}
const lowTr = (s) => s.replace(/I/g, 'ı').replace(/İ/g, 'i').toLowerCase();

test('LESSONS: 47 ders, kimlikler sabit (L01..L47), sözleşme alanları geçerli', () => {
  assert.equal(LESSONS.length, 47);
  const unitIds = new Set(UNITS.map((u) => u.id));
  LESSONS.forEach((L, i) => {
    assert.equal(L.id, 'L' + String(i + 1).padStart(2, '0'));
    assert.ok(unitIds.has(L.unit), L.id);
    assert.ok(L.title && L.desc, L.id);
    assert.ok(['keys', 'combo', 'words', 'text'].includes(L.kind), L.id);
    assert.ok(Array.isArray(L.keys) && Array.isArray(L.newKeys), L.id);
    L.newKeys.forEach((k) => assert.ok(L.keys.includes(k), L.id + ' yeni tuş keys içinde değil: ' + k));
    L.keys.forEach((k) => assert.ok(FINGERS[k], L.id + ' parmak yok: ' + k));
    if (i > 0) LESSONS[i - 1].keys.forEach((k) => assert.ok(L.keys.includes(k), L.id + ' birikimli değil: ' + k));
    if (L.kind === 'combo') assert.ok((L.combos && L.combos.length) || (L.must && L.must.length), L.id);
    // Orta zorluk: doğruluk %94–96, gerçekçi hız, yeterli uzunluk.
    assert.ok(L.goalAcc >= 94 && L.goalAcc <= 96, L.id + ' goalAcc ' + L.goalAcc);
    assert.ok(L.goalWpm >= 8 && L.goalWpm <= 40, L.id + ' goalWpm ' + L.goalWpm);
    assert.ok(L.length >= 160 && L.length <= 420, L.id + ' length ' + L.length);
  });
  assert.equal(new Set(LESSONS.map((l) => l.id)).size, 47);
  assert.ok(KEY_ROWS.length === 4);
});

test('LESSONS: hız hedefi üniteler boyunca artar (ünite ortalaması)', () => {
  const avg = UNITS.map((u) => {
    const ls = LESSONS.filter((l) => l.unit === u.id);
    return ls.reduce((n, l) => n + l.goalWpm, 0) / ls.length;
  });
  // Büyük harf ünitesi Shift yüzünden kombinasyonlardan biraz yavaş olabilir; temel < üst < alt < özel ≤ büyük < hız.
  const by = Object.fromEntries(UNITS.map((u, i) => [u.id, avg[i]]));
  assert.ok(by.temel < by.ust && by.ust < by.alt && by.alt < by.ozel && by.ozel <= by.buyuk && by.kombi < by.hiz && by.buyuk < by.hiz);
  assert.ok(by.hiz >= 30 && by.ustalik >= 26);
  assert.ok(LESSONS[0].goalWpm < LESSONS[46].goalWpm);
});

test('buildDrill: uzunluk, yalnız izinli tuşlar, üçlü tekrar ve art arda aynı kelime yok', () => {
  for (const L of LESSONS) {
    for (const seed of [1, 2, 3, 4, 5]) {
      const d = LD.buildDrill(L, WORDS, seeded(seed * 97 + L.length));
      assert.ok(d.length >= L.length * 0.8 && d.length <= L.length * 1.25, `${L.id} uzunluk ${d.length}/${L.length}`);
      assert.equal(d, d.replace(/\s+/g, ' ').trim());
      if (L.kind !== 'text') {
        const ok = new Set(L.keys.concat([' ']));
        for (const ch of lowTr(d)) assert.ok(ok.has(ch), `${L.id} izinsiz karakter "${ch}"`);
        assert.doesNotMatch(d, /(\p{L})\1\1/u, `${L.id} aynı harf üç kez art arda`);
      }
      const toks = d.split(' ');
      if (L.kind !== 'text') for (let i = 1; i < toks.length; i++) assert.notEqual(toks[i], toks[i - 1], `${L.id} art arda aynı: ${toks[i]}`);
    }
  }
});

test('buildDrill keys: ritim grupları yeni tuşla başlar, karışık tekrarla biter, ilk ders tek tip değil', () => {
  for (const L of LESSONS.filter((l) => l.kind === 'keys')) {
    const d = LD.buildDrill(L, WORDS, seeded(9));
    const toks = d.split(' ');
    const letters = L.newKeys.filter((k) => /\p{L}/u.test(k));
    if (letters.length) {
      const intro = toks.slice(0, Math.max(3, Math.floor(toks.length * 0.2)));
      intro.forEach((t) => assert.ok(letters.some((k) => t.includes(k)), `${L.id} giriş grubu yeni tuşsuz: ${t}`));
    }
    const lens = new Set(toks.map((t) => t.length));
    assert.ok(lens.size >= 3, `${L.id} grup uzunlukları tek düze`);
    // Son çeyrekte en az bir grup yeni tuş içermez (önceki tuşların tekrarı) — ilk ders hariç.
    if (L.id !== 'L01' && L.id !== 'L13' && L.id !== 'L19') {
      const tail = toks.slice(Math.floor(toks.length * 0.8));
      assert.ok(tail.some((t) => !letters.some((k) => t.includes(k))), `${L.id} karışık tekrar yok`);
    }
  }
  const first = LD.buildDrill(LESSONS[0], WORDS, seeded(1)).split(' ');
  assert.ok(first.some((t) => t.length >= 4), 'L01 yalnız iki harfli gruplardan oluşmamalı');
  assert.ok(first.length >= 25);
});

test('buildDrill: ≥ 4 harften sonra gerçek kelimeler; noktalama/büyük harf derslerinde gerçek cümleler', () => {
  const W = new Set(WORDS);
  const L07 = LESSONS.find((l) => l.id === 'L07');
  const toks = LD.buildDrill(L07, WORDS, seeded(4)).split(' ');
  // Ana sıra harfleriyle yalnız ~30 gerçek kelime var; hepsi kullanılır, kalan yer sözde-kelimeyle dolar.
  assert.ok(toks.filter((t) => W.has(t)).length >= 25, 'L07 gerçek kelimelerin hepsini kullanmalı');
  const L10 = LESSONS.find((l) => l.id === 'L10');
  const t10 = LD.buildDrill(L10, WORDS, seeded(4)).split(' ');
  assert.ok(t10.filter((t) => W.has(t)).length >= 8, 'L10 gerçek kelime içermeli');
  for (const id of ['L34', 'L35', 'L36', 'L37']) {
    const d = LD.buildDrill(LESSONS.find((l) => l.id === id), WORDS, seeded(6));
    assert.ok(/[.]/.test(d), id + ' cümle yok');
    assert.ok(PROVERBS.some((p) => d.includes(p.text)), id + ' gerçek Türkçe cümle (atasözü) içermeli');
  }
  const d36 = LD.buildDrill(LESSONS.find((l) => l.id === 'L36'), WORDS, seeded(8));
  assert.ok((d36.match(/,/g) || []).length >= 3, 'virgül dersi virgül içermeli');
});

test('combo dersleri: kelimelerin çoğu hedef kalıbı içerir', () => {
  for (const L of LESSONS.filter((l) => l.kind === 'combo')) {
    const d = LD.buildDrill(L, WORDS, seeded(12));
    const toks = d.split(' ');
    const has = (w) => ((L.combos || []).length ? L.combos.some((c) => w.includes(c)) : true) && (L.must || []).every((c) => w.includes(c));
    const share = toks.filter(has).length / toks.length;
    assert.ok(share >= 0.6 && share <= 0.95, `${L.id} kalıp payı ${share.toFixed(2)}`);
  }
});

test('rate: orta zorlukta yıldız eşikleri', () => {
  const L = { goalWpm: 20, goalAcc: 95 };
  assert.deepEqual(rate(L, { wpm: 19, acc: 99 }), { pass: false, stars: 0 });
  assert.deepEqual(rate(L, { wpm: 25, acc: 94.9 }), { pass: false, stars: 0 });
  assert.deepEqual(rate(L, { wpm: 20, acc: 95 }), { pass: true, stars: 1 });
  assert.deepEqual(rate(L, { wpm: 26, acc: 96 }), { pass: true, stars: 1 });
  assert.deepEqual(rate(L, { wpm: 26, acc: 97 }), { pass: true, stars: 2 });
  assert.deepEqual(rate(L, { wpm: 31, acc: 98.5 }), { pass: true, stars: 2 });
  assert.deepEqual(rate(L, { wpm: 32, acc: 99 }), { pass: true, stars: 3 });
});

test('lessonUnlocked: kayıtlı ilerleme korunur, kimse kilitlenmez', () => {
  assert.equal(lessonUnlocked({}, 0), true);
  assert.equal(lessonUnlocked({}, 1), false);
  assert.equal(lessonUnlocked({ lessons: { L01: { stars: 1 } } }, 1), true);
  // Eski kayıt: L05 daha önce oynanmış ama L04 yıldızsız -> yine açık kalır.
  assert.equal(lessonUnlocked({ lessons: { L05: { stars: 0, bestWpm: 14 } } }, 4), true);
  assert.equal(lessonUnlocked({ lessons: { L05: { stars: 2, bestWpm: 30 } } }, 5), true);
  assert.equal(lessonUnlocked({ lessons: { L05: { stars: 2 } } }, 6), false);
});

test('intentLessonIndex: "Kaldığın ders" niyeti açık dersi doğrudan açar, geçersiz/kilitli niyet haritaya düşer', () => {
  const all = { lessons: { L01: { stars: 2, bestWpm: 20, bestAcc: 97 } } };
  // Kimlikle: L02 açık (L01 yıldızlı) → sıra 1.
  assert.equal(intentLessonIndex({ lesson: 'L02', index: 1 }, all), 1);
  // Kimlik sıradan önce gelir; kimlik yoksa sıra kullanılır.
  assert.equal(intentLessonIndex({ lesson: 'L01', index: 1 }, all), 0);
  assert.equal(intentLessonIndex({ index: 1 }, all), 1);
  // Hiç ilerleme yokken ilk ders.
  assert.equal(intentLessonIndex({ lesson: 'L01', index: 0 }, {}), 0);
  // Kilitli ders, bilinmeyen kimlik, bozuk niyet → harita (-1).
  assert.equal(intentLessonIndex({ lesson: 'L09', index: 8 }, all), -1);
  assert.equal(intentLessonIndex({ lesson: 'YOK' }, all), -1);
  assert.equal(intentLessonIndex({ index: 999 }, all), -1);
  assert.equal(intentLessonIndex({ index: '1' }, all), -1);
  assert.equal(intentLessonIndex(null, all), -1);
  assert.equal(intentLessonIndex(undefined, undefined), -1);
});

test('mountLessons: niyet render öncesi görünüme uygulanır (kaynak sözleşmesi)', async () => {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(new URL('../home/lessons.js', import.meta.url), 'utf8');
  const i = src.indexOf('intentLessonIndex(ctx && ctx.intent');
  assert.ok(i > 0, 'mountLessons ctx.intent okumuyor');
  const tail = src.slice(i, i + 400);
  assert.match(tail, /name: 'lesson'/);
  assert.match(tail, /render\(false\)/);
});
