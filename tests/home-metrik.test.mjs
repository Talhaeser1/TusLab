// Metrik paneli (11. iş, 24 Kas 2026): Merkez solundaki mini pano + Performans görünümü + ilk tuş düzeltmesi.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const js = read('home/home.js');
const css = read('home/home.css');
const { matchStartKey } = await import('../home/typing.js');

test('ilk tuş: beklenen harfle büyük/küçük harf duyarsız eşleşirse beklenen harf, yoksa boş', () => {
  assert.equal(matchStartKey('a', 'A'), 'A');
  assert.equal(matchStartKey('A', 'A'), 'A');
  assert.equal(matchStartKey('b', 'A'), '');
  // Türkçe i/İ ve ı/I
  assert.equal(matchStartKey('i', 'İ'), 'İ');
  assert.equal(matchStartKey('ı', 'I'), 'I');
  assert.equal(matchStartKey('i', 'I'), '');
  assert.equal(matchStartKey('ı', 'İ'), '');
  assert.equal(matchStartKey('ş', 'Ş'), 'Ş');
  assert.equal(matchStartKey('', 'A'), '');
  assert.equal(matchStartKey('a', ''), '');
});

test('Merkez\'den başlatan harf yazıcıya yalnız eşleşirse aktarılır (hata yazılmaz)', () => {
  assert.match(js, /const first = matchStartFn \? matchStartFn\(keys\[0\], arenaCtl && arenaCtl\.expected\) : keys\[0\];\s*if \(!first\) return;/);
  assert.match(js, /matchStartFn = typing\.matchStartKey/);
  assert.match(read('home/typing.js'), /get expected\(\) \{\s*return finished \|\| destroyed \? '' : chars\[pos\] \|\| '';/);
});

test('mini pano: tek geçişte hesap, önbellekli çizim, elle SVG (kütüphane yok)', () => {
  assert.match(js, /function computeMetrics\(d = data, n = 12\)/);
  assert.match(js, /if \(html !== metHtml\) \{ metHtml = html; metEl\.innerHTML = html; \}/);
  assert.match(js, /<svg viewBox="0 0 100 100" preserveAspectRatio="none"/);
  assert.match(js, /vector-effect="non-scaling-stroke"/);
  assert.doesNotMatch(js, /renderSpark|Chart\.js|d3\./);
  // boş durum davetkâr ve gerçek bir düğme; ort./en iyi çizgileri
  assert.match(js, /class="tlh-btn tlh-btn--primary tlh-ch-cta" data-tlh="write"/);
  assert.match(js, /refs: n > 1 \? \[\{ v: m\.avgW, cls: 'is-avg' \}, \{ v: m\.maxW, cls: 'is-best' \}\] : \[\]/);
});

test('haftalık etkinlik seriyle tutarlı; günlük sayaç 60 günle sınırlı', () => {
  assert.match(js, /run\.add\(dayKey\(new Date\(y, mo - 1, da - i\)\)\)/);
  assert.match(js, /on: c > 0 \|\| run\.has\(k\)/);
  assert.match(js, /days\[today\(\)\] = num\(days\[today\(\)\]\) \+ 1;/);
  assert.match(js, /cut\.setDate\(cut\.getDate\(\) - 60\)/);
});

test('görevler: Merkez\'de adı + ilerlemesi; bitmeyen görev o işi açan düğme', () => {
  assert.match(js, /<ul class="tlh-mq" data-s-mq><\/ul>/);
  assert.match(js, /data-quest="\$\{id\}"/);
  assert.match(js, /if \(t\.dataset\.quest\) \{ startQuest\(t\.dataset\.quest\); return; \}/);
  assert.match(js, /function startQuest\(id\)/);
});

test('Merkez Performans kartı: hız eğrisinin küçük hâli sabit yükseklikte; görünen yazı ≥ 12 px', () => {
  const rm = js.slice(js.indexOf('function renderMetrics('), js.indexOf('/* ---------- Yazma önizlemesi'));
  assert.match(rm, /speedHTML\(m, false\)/);
  assert.doesNotMatch(rm, /weekHTML|accHTML|weakHTML/);   // 7 gün, doğruluk, zayıf tuşlar Performans görünümünde
  assert.match(css, /#tl-home \.tlh-met-slot \{[^}]*height: clamp\(/);
  // görünen yazı ≥ 12 px
  for (const m of css.matchAll(/font-size: (\d+(?:\.\d+)?)px/g)) assert.ok(Number(m[1]) >= 12, 'font-size ' + m[1]);
});

test('Performans: aynı bileşenlerin geniş hâli', () => {
  const perf = js.slice(js.indexOf('function mountPerf('), js.indexOf('/* ---------- bölümler ---------- */'));
  assert.match(perf, /computeMetrics\(d, 20\)/);
  assert.match(perf, /speedHTML\(m, true\)/);
  assert.match(perf, /accHTML\(m, true\)/);
  assert.match(perf, /weekHTML\(m\)/);
  assert.match(perf, /weakHTML\(m, true\)/);
  assert.match(perf, /tlh-quest-list tlh-mq tlh-mq--big/);
});
