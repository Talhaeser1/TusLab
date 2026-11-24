// Derleyici (24 Kas 2026, docs/26): Şiir & Atasözü tür menüsü (bento), "Ana Sayfa" adı, ortak ses anahtarı, Günün sözü kaynağı.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const js = read('home/home.js');
const css = read('home/home.css');
const lit = read('home/literature.js');
const lessons = read('home/lessons.js');
const sfx = read('home/sfx.js');

test('tür menüsü: üstte Günün sözü, 2 büyük + 3 orta kart, altta Son yazdıkların ya da ipucu', () => {
  assert.match(lit, /class: 'tl-litm' \}/);
  assert.match(lit, /'tl-litm-quote tlh-lit--'/);
  assert.match(lit, /\(i < 2 \? ' is-big' : ''\)/);
  assert.match(lit, /'Günün sözü'/);
  assert.match(lit, /'Son yazdıkların'/);
  assert.match(lit, /tl-litm-foot tl-litm-tip/);
  // kartta: örnek satır, sayı, ilerleme, en iyi hız, Başla
  assert.match(lit, /class: 'tl-litm-ex'/);
  assert.match(lit, /class: 'tl-litm-n' \}, n \+ ' ' \+ c\.unit/);
  assert.match(lit, /' metin yazdın'/);
  assert.match(lit, /' en iyi hız'/);
  assert.match(lit, /class: 'tlh-lit-go' \}, 'Başla '/);
  // 6 sütunlu bento, iki sütun (≤900) ve tek sütun (≤600)
  assert.match(css, /\.tl-litm-grid \{\s*display: grid; grid-template-columns: repeat\(6, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.tl-litm-card\.is-big \{ grid-column: span 3; \}/);
  assert.match(css, /@media \(max-width: 900px\), \(max-height: 599px\) \{[\s\S]*?repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 600px\) \{\s*#tl-home \.tl-litm-grid \{ grid-template-columns: minmax\(0, 1fr\); \}/);
});

test('tür menüsü: ok tuşları ve Home/End kartlar arasında gezinir, Enter başlatır (düğme), odak halkası tür renginde', () => {
  assert.match(lit, /Arrow\(Up\|Down\|Left\|Right\)\|Home\|End/);
  assert.match(lit, /function menuMove\(key\)/);
  assert.match(lit, /want\.focus\(\{ preventScroll: true \}\)/);
  assert.match(css, /#tl-home \.tlh-lit-chip:focus-visible \{ outline: 3px solid var\(--acc\)/);
  assert.match(css, /#tl-home \.tl-litm-rec:focus-visible \{ outline: 3px solid var\(--acc\)/);
});

test('Son yazdıkların: oturum özeti zaman ve bitirilen son metinleri kaydeder', () => {
  assert.match(lit, /r\.last = \{ wpm: st\.wpm, acc: st\.acc, ms: st\.elapsedMs, n: st\.chunks \|\| 0, t: Date\.now\(\) \}/);
  assert.match(lit, /r\.recent = recentTexts\.slice\(0, 3\)/);
});

test('Günün sözü: ana ekran kartı ve tür menüsü aynı gün aynı söz (gün içinde sabit, var olan içerikten)', async () => {
  const { dailyQuote, itemsFor } = await import('../home/arena.js');
  const d = new Date(2026, 10, 24, 9);
  const a = dailyQuote(d);
  const b = dailyQuote(new Date(2026, 10, 24, 23));
  assert.ok(a && a.text);
  assert.deepEqual(a, b);
  assert.ok(['atasozu', 'ozdeyis'].includes(a.mode));
  assert.ok(itemsFor(a.mode).some((it) => it.text === a.text), 'söz içerikte yok');
  assert.match(js, /am\.dailyQuote\(\)/);
  assert.match(lit, /q = dailyQuote\(\)/);
});

test('adlandırma: kullanıcıya görünen metinde "Merkez" yok, her yerde "← Ana Sayfa"', () => {
  const visible = (src) => src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).map((l) => l.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, ''));
  for (const [name, src] of [['home.js', js], ['literature.js', lit], ['lessons.js', lessons]]) {
    const bad = visible(src).filter((l) => /['">`]\s*←?\s*Merkez|Merkeze dön|Esc:? Merkez|— Merkez/.test(l));
    assert.deepEqual(bad, [], name);
  }
  assert.match(js, /aria-label="Ana Sayfaya dön">← Ana Sayfa<\/button>/);
  assert.match(js, /aria-label="TuşLab — Ana Sayfa"/);
  assert.match(lit, /'Enter: devam · Esc: Ana Sayfa'/);
  assert.match(lessons, /' Ana Sayfa'\)\)\);/);
});

test('ortak ses: tuslab-ses = on|off, önce okunur, eski anahtardan taşınır, aç/kapa yazar, storage/visibility/pageshow yeniden okur', () => {
  assert.match(js, /const SES_KEY = 'tuslab-ses';/);
  assert.match(js, /if \(v === 'on' \|\| v === 'off'\) return v === 'on';/);
  assert.match(js, /const on = readStore\(\)\.sound !== false;\s*try \{ localStorage\.setItem\(SES_KEY, on \? 'on' : 'off'\); \}/);
  assert.match(js, /localStorage\.setItem\(SES_KEY, on \? 'on' : 'off'\); \} catch \{ \/\* kota \/ gizli sekme \*\/ \}\s*update\(d => \{ d\.sound = on; \}\);/);
  assert.match(js, /window\.addEventListener\('storage', \(e\) => \{ if \(e\.key === SES_KEY \|\| e\.key === null\) syncSes\(\); \}\);/);
  assert.match(js, /document\.addEventListener\('visibilitychange', \(\) => \{ if \(!document\.hidden\) syncSes\(\); \}\);/);
  assert.match(js, /window\.addEventListener\('pageshow', syncSes\);/);
  assert.match(sfx, /localStorage\.getItem\('tuslab-ses'\)/);
  // PvP'ye özgü alt ayarlara dokunulmaz
  assert.doesNotMatch(js + sfx, /tuslab-pvp-(sfx|music)-muted/);
});

test('Günün sözü kaynağı sığmazsa üç nokta yerine ikinci satıra iner', () => {
  assert.match(css, /#tl-home \.tlh-quote figcaption \{ display: flex; flex-wrap: wrap;/);
});
