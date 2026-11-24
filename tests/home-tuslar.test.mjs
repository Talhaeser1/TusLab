// Tuşçu (24 Kas 2026): ana ekran düğme/tuş denetimi ve optimizasyon düzeltmelerinin kalıcı kontrolleri.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const js = read('home/home.js');
const css = read('home/home.css');
const edu = read('home/egitim.css');
const typing = read('home/typing.js');
const arena = read('home/arena.js');
const lessons = read('home/lessons.js');
const kilit = read('home/ders-kilit.js');

test('setText: yalnız değişince ve metin düğümünün verisini değiştirerek yazar', async () => {
  const { setText } = await import('../home/typing.js');
  let writes = 0;
  const node = { nodeType: 3, nextSibling: null, _d: '5', get data() { return this._d; }, set data(v) { writes++; this._d = v; } };
  const el = { firstChild: node, set textContent(v) { throw new Error('textContent kullanılmamalı: ' + v); } };
  setText(el, '5');
  assert.equal(writes, 0, 'aynı değer yeniden yazılmamalı');
  setText(el, 6);
  assert.equal(node.data, '6');
  assert.equal(writes, 1);
  // boş öğede textContent'e düşer
  const empty = { firstChild: null, textContent: '' };
  setText(empty, 'a');
  assert.equal(empty.textContent, 'a');
});

test('yazıcı: sayaçlar setText ile, ilerleme çubuğu transform ile (her tuşta düzen/stil hesabı yok)', () => {
  const paint = typing.slice(typing.indexOf('function paintStats('), typing.indexOf('function tick('));
  assert.doesNotMatch(paint, /textContent\s*=/);
  assert.match(paint, /setText\(stEls\.wpm/);
  assert.match(paint, /scaleX\(/);
  assert.doesNotMatch(paint, /style\.width/);
  assert.match(edu, /\.tl-typer-progress i \{[^}]*transform: scaleX\(0\);[^}]*transition: transform/);
  assert.doesNotMatch(edu, /\.tl-typer-progress i \{[^}]*transition: width/);
  // kombo: değişmedikçe DOM'a yazılmaz, metin düğümü verisi güncellenir
  const combo = js.slice(js.indexOf('function setCombo('), js.indexOf('let firstChunk'));
  assert.match(combo, /if \(n === combo && comboB\.firstChild\) return;/);
  assert.match(combo, /firstChild\.data = t/);
});

test('kelime havuzu (data/words.js) açılışta inmez: arena.js dinamik yükler, home.js Kelime kipinde bekler', async () => {
  assert.doesNotMatch(arena, /^import .*words\.js/m);
  assert.match(arena, /import\('\.\/data\/words\.js'\)/);
  assert.match(js, /function needWords\(m, fn\)/);
  assert.match(js, /if \(needWords\(mode, renderPreview\)\) return null;/);
  const A = await import('../home/arena.js');
  assert.equal(A.wordsReady(), false);
  assert.equal(A.pickText('kelime').text, '', 'havuz yüklenmeden kelime metni boş (home.js beklemeden kurmaz)');
  await A.loadWords();
  assert.ok(A.pickText('kelime').text.split(' ').length >= 20);
});

test('ders kilidi ayrı modülde: ana ekran açılışta lessons.js (ve kelime havuzunu) yüklemez', async () => {
  assert.doesNotMatch(kilit, /^import .*(words|typing)\.js/m);
  assert.match(js, /loadMod\('ders-kilit\.js'\)/);
  assert.doesNotMatch(js, /Promise\.all\(\[loadMod\('data\/lessons\.js'\), loadMod\('lessons\.js'\)\]\)/);
  assert.match(lessons, /from '\.\/ders-kilit\.js'/);
  const K = await import('../home/ders-kilit.js');
  const L = await import('../home/lessons.js');
  assert.equal(L.lessonUnlocked, K.lessonUnlocked);
  assert.equal(L.intentLessonIndex, K.intentLessonIndex);
  assert.equal(K.lessonUnlocked({}, 0), true);
  assert.equal(K.lessonUnlocked({}, 1), false);
});

test('ders ekranı: notsuz denemede "null" yazısı çıkmaz', () => {
  const at = lessons.slice(lessons.indexOf('function startAttempt('), lessons.indexOf('function statGrid('));
  assert.doesNotMatch(at, /replaceChildren\([^)]*: null/);
  assert.match(at, /else stage\.replaceChildren\(tHost\);/);
});

test('odak yazma alanından çıkınca basılan harf açık yazıcıya gider; boşluk düğmeyi çalıştırır', () => {
  const t = js.slice(js.indexOf('function typeToStart('), js.indexOf("root.addEventListener('keydown'"));
  assert.match(t, /textarea\.tl-typer-input/);
  assert.match(t, /!ta\.readOnly && document\.activeElement !== ta/);
  assert.match(t, /closest\('button,a,\[role="button"\],\[role="radio"\],summary'\)/);
  assert.match(t, /e\.ctrlKey \|\| e\.metaKey \|\| e\.altKey/);
});

test('görünmeyen katmanlar boyanmaz/animasyonu durur; dokunmatikte 44 px hedef', () => {
  assert.match(css, /html\.tlh-app-off #app, html\.tlh-app-off #app \* \{ animation-play-state: paused !important;/);
  assert.match(css, /#tl-home \.tlh-menu\[aria-hidden="true"\] \{ visibility: hidden; \}/);
  assert.doesNotMatch(css, /tlh-drift/);   // Sahne: arka plan bulutları durağan (sonsuz animasyon yalnız canlı satır imlecinde)
  assert.match(js, /root\.classList\.add\('tlh-in-view'\)/);
  assert.match(js, /root\.classList\.remove\('tlh-in-view'\)/);
  assert.match(css, /@media \(pointer: coarse\) \{[^}]*\}[^@]*#tl-home \.tlh-sound \{ min-width: 44px; min-height: 44px; \}/);
});

test('egitim.css: kullanılmayan eski liste/sekme stilleri yok', () => {
  for (const c of ['tl-tabs', 'tl-tab', 'tl-filter', 'tl-marathon', 'tl-lit-grid', 'tl-item', 'tl-meaning', 'tl-seq-', 'tl-lit-cat-ic', 'tl-lit-cat-meta']) {
    assert.ok(!edu.includes('.' + c + ' ') && !edu.includes('.' + c + ':') && !edu.includes('.' + c + '.') && !(c.endsWith('-') && edu.includes('.' + c)), c + ' hâlâ var');
  }
});

test('PvP kartı küçük görseli kullanır, dosya yerinde', () => {
  assert.match(css, /url\("\.\.\/assets\/home\/pvp-kart\.webp"\)/);
  const buf = readFileSync(new URL('../assets/home/pvp-kart.webp', import.meta.url));
  assert.equal(buf.slice(8, 12).toString('ascii'), 'WEBP');
  assert.ok(buf.length < 60 * 1024, 'kart görseli 60 KB altında olmalı');
});

test('geçmiş: adresle açılan bölümden başka bölüme geçip "← Ana Sayfa"/Esc → ana sayfa (önceki bölüme değil)', () => {
  const ov = js.slice(js.indexOf('async function openView('), js.indexOf('function closeView('));
  assert.match(ov, /if \(switching && \(VIEW_IDS\.includes\(cur\) \|\| \(history\.state && history\.state\.tlh\)\)\)/);
  assert.match(ov, /history\.pushState\(\{ tlh: id, pushed: true \}/);
  const cv = js.slice(js.indexOf('function closeView('), js.indexOf('function clearHash('));
  assert.match(cv, /history\.state\.tlh && history\.state\.pushed\) history\.back\(\);/);
});

test('görünmeyen eski site açılışta lobi afişini (137 KB) indirmez', () => {
  assert.match(css, /html body #app \.home-pvp-entry\.lb3-home \{ background-image: none !important; \}/);
});
