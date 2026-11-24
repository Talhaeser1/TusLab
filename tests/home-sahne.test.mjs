// Ana ekran "Sahne" (19. iş, 24 Kas 2026; tasarım docs/18): solda kahraman alanı + canlı satır, sağda 5 kartlık bento.
// Kokpit testlerinin (home-kokpit) hâlâ geçerli olanları buraya taşındı: harfle başlama, tür çipleri, ders yolu, girişler.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const js = read('home/home.js');
const css = read('home/home.css');
const lit = read('home/literature.js');
const tpl = js.slice(js.indexOf('<div class="tlh-menu">'), js.indexOf('<section class="tlh-view tlh-write"'));

test('düzen: sol sahne + 12 sütunluk bento (Yazma 7×2, Dersler 5×2, altta Edebiyat · PvP · Performans)', () => {
  assert.match(css, /\.tlh-hub \{[^}]*grid-template-columns: minmax\(0, 40fr\) minmax\(0, 60fr\);/);
  assert.match(css, /\.tlh-hub \{[^}]*max-width: 1560px; margin: 0 auto;/);
  assert.match(css, /\.tlh-bento \{[^}]*grid-template-columns: repeat\(12, minmax\(0, 1fr\)\); grid-template-rows: minmax\(0, 1fr\) minmax\(0, 1fr\) auto;/);
  assert.match(css, /\.tlh-c-write \{ grid-column: 1 \/ 8; grid-row: 1 \/ 3;/);
  assert.match(css, /\.tlh-c-edu \{ grid-column: 8 \/ 13; grid-row: 1 \/ 3;/);
  for (const c of ['lit', 'pvp', 'perf']) assert.match(css, new RegExp(`\\.tlh-c-${c} \\{ grid-column: \\d+ \\/ \\d+; grid-row: 3;`));
  // DOM sırası = telefon sırası: sahne → Yazma → Dersler → Edebiyat → PvP → Performans
  const order = ['tlh-stage', 'tlh-c-write', 'tlh-c-edu', 'tlh-c-lit', 'tlh-c-pvp', 'tlh-c-perf'].map((c) => tpl.indexOf(c));
  assert.ok(order.every((v, i) => v > 0 && (i === 0 || v > order[i - 1])), 'sıra: ' + order);
  // ≤1180 iki katman (bento 2 sütun), ≤860 tek sütun; Merkez yalnız dikey kayar
  assert.match(css, /@media \(max-width: 1180px\) \{[^@]*\.tlh-bento \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(css, /@media \(max-width: 860px\) \{[^@]*\.tlh-bento \{ grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(css, /\.tlh-menu \{[^}]*overflow-x: hidden; overflow-y: auto;/);
});

test('kahraman alanı: degrade başlık, iki düğme, canlı satır, tek satırda 4 sayı', () => {
  assert.match(tpl, /<h1 id="tlh-hub-h" class="tlh-stage-h">Parmakların <span>ışık hızında<\/span><\/h1>/);
  assert.match(tpl, /class="tlh-btn tlh-btn--primary tlh-btn--lg" data-tlh="write"/);
  assert.match(tpl, /data-tlh="resume"><span aria-hidden="true">🎓<\/span><span class="tlh-resume-t" data-s="resume">İlk derse başla/);
  assert.match(js, /`Kaldığın ders: \$\{li\.idx \+ 1\}`/);
  assert.match(tpl, /<button type="button" class="tlh-live" data-tlh="write"/);
  for (const k of ['wpm', 'acc', 'stars', 'starmax', 'streak']) assert.match(tpl, new RegExp(`data-s="${k}"`));
  assert.match(css, /\.tlh-hs \{[^}]*border-left: 1px solid/);
  assert.match(tpl, /<div class="tlh-stage-deco" aria-hidden="true">/);
});

test('canlı satır: önizleme parçası ≈14 harf/sn yazılır, 3 sn bekler, yalnız Merkez görünürken; azaltılmış harekette hazır', () => {
  const live = js.slice(js.indexOf('function liveRun('), js.indexOf("document.addEventListener('visibilitychange'"));
  assert.match(live, /if \(!arenaMod \|\| view \|\| root\.hidden \|\| document\.hidden\) return;/);
  assert.match(live, /const p = ensurePeek\(\);/);                       // harfe basınca yazılan satırla aynı (takePeek)
  assert.match(live, /if \(reduced\(\)\) \{ liveI = liveChars\.length; livePaint\(\); return; \}/);
  assert.match(live, /52 \+ Math\.random\(\) \* 38/);                       // ort. ≈71 ms → ≈14 harf/sn
  assert.match(live, /, 3000\);/);
  assert.match(live, /if \(peek && peek\.chunk === liveChunk\) peek = null;/);
  assert.match(js, /el\.firstChild\.data = v/);                             // metin düğümü verisi (ucuz)
  assert.match(js, /liveRun\(\);\n  \}\n\n  \/\* ---------- Canlı satır/);   // renderPreview → liveRun
  assert.match(js, /root\.focus\(\{ preventScroll: true \}\);\n    liveRun\(\);/);   // showHome
  // düzen kayması yok: satır sabit yükseklik, imleç tek sonsuz animasyon
  assert.match(css, /\.tlh-live-text \{[^}]*height: 2\.9em;/);
  assert.match(css, /\.tlh-live-caret \{[^}]*animation: tlh-blink 1\.05s steps\(1\) infinite;/);
  assert.equal((css.match(/infinite/g) || []).length, 2, 'sonsuz animasyon: imleç + yükleniyor dönmesi');
});

test('harfle başlama: gösterilen satır yazılır, ilk harf kaybolmaz; Ctrl/Alt/Meta/Tab/boşluk başlatmaz', () => {
  assert.match(js, /function ensurePeek\(\)/);
  assert.match(js, /const pk = takePeek\(mode\);/);
  assert.match(js, /if \(!view\) \{ e\.preventDefault\(\); pendingKeys = e\.key; openView\('yazma'\); return true; \}/);
  assert.match(js, /ta\.dispatchEvent\(new Event\('input'\)\)/);
  assert.match(js, /e\.ctrlKey \|\| e\.metaKey \|\| e\.altKey \|\| e\.isComposing/);
  assert.match(js, /e\.key\.length !== 1 \|\| isField\(e\.target\)/);   // Tab ("Tab".length > 1) ve form alanları
  assert.match(js, /if \(space && \(!view \|\| /);
});

test('Şiir & Atasözü kartı: günün sözü, 5 tür çipi o türü açar, kartın geri kalanı tür menüsünü açar', () => {
  for (const id of ['atasozu', 'deyim', 'siir', 'tekerleme', 'ozdeyis']) assert.match(js, new RegExp(`\\{ id: '${id}', label: '[^']+', short: '[^']+', unit: '[^']+' \\}`));
  assert.match(js, /class="tlh-chip tlh-lit--\$\{c\.id\}" data-lit="\$\{c\.id\}"/);
  assert.match(js, /openView\('edebiyat', \{ intent: \{ cat: t\.dataset\.lit \} \}\)/);
  assert.match(tpl, /<section class="tlh-c tlh-c-lit" data-tlh="lit-all"/);
  assert.match(js, /if \(act === 'lit-all'\) \{ openView\('edebiyat'\); return; \}/);
  assert.match(tpl, /<blockquote data-s="quote">/);
  assert.match(js, /out\.quote = dq \|\| \(pick\.length \?/);
  assert.match(lit, /ctx\.intent && typeof ctx\.intent\.cat === 'string'/);
});

test('Dersler kartı: halka + sıradaki 3 ders; kart → kaldığın ders, "Ders haritası" → harita', () => {
  assert.match(js, /function renderPath\(li\)/);
  assert.match(js, /LESSONS\.slice\(start, start \+ 3\)/);
  assert.match(js, /data-lesson="\$\{i\}"/);
  assert.match(tpl, /<section class="tlh-c tlh-c-edu" data-tlh="resume"/);
  assert.match(tpl, /data-tlh="lessons">Ders haritası/);
  assert.match(tpl, /<circle class="tlh-ring-fg" data-s-ring/);
  assert.match(js, /ring\.style\.strokeDasharray = /);
  assert.match(css, /\.tlh-path \{[^}]*min-height: calc\(3 \* /);
  // Dersler önden yükleme (lessons.js açılışta inmez)
  assert.match(js, /t\.closest\('\.tlh-c-edu,\[data-tlh="resume"\],\[data-nav="egitim"\],\[data-quest="lesson"\]'\)/);
});

test('Yazma kartı (eğik SVG klavye, üzerine gelince bir tur parlar), PvP lobisi, Performans (mini eğri + görevler)', () => {
  assert.match(tpl, /<section class="tlh-c tlh-c-write" data-tlh="write"/);
  assert.match(tpl, /<button type="button" class="tlh-c-go" data-tlh="write"/);
  assert.match(js, /const KB_SVG = /);
  assert.match(css, /\.tlh-c-write:hover \.tlh-kk rect:first-child, #tl-home \.tlh-c-write:has\(:focus-visible\) \.tlh-kk rect:first-child \{ animation: tlh-key \.62s ease calc\(var\(--i\) \* 45ms\) 1 both; \}/);
  assert.match(js, /href="\?pvp=lobby" data-card="pvp"/);
  assert.match(tpl, /<section class="tlh-c tlh-c-perf" data-tlh="perf"/);
  assert.match(tpl, /data-slot="metrik-grafik"/);
  assert.match(tpl, /<ul class="tlh-mq" data-s-mq><\/ul>/);
  assert.match(tpl, /data-s="qcount"/);
  assert.match(js, /if \(act === 'quests' \|\| act === 'perf'\) \{ openView\('performans'\); return; \}/);
});

test('giriş hareketi tek sefer ve kısa: sahne soldan, kartlar 60 ms arayla (< 600 ms)', () => {
  assert.match(css, /\.tlh-stage \{[^}]*animation: tlh-in-left \.45s/);
  assert.match(css, /\.tlh-c \{[^}]*animation: tlh-rise \.32s/);
  const delays = [...css.matchAll(/\.tlh-c-(?:write|edu|lit|pvp|perf) \{[^}]*animation-delay: ([\d.]+)s/g)].map((m) => Number(m[1]));
  assert.equal(delays.length, 5);
  assert.ok(Math.max(...delays) + 0.32 < 0.6, 'toplam ' + (Math.max(...delays) + 0.32));
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*#tl-home \*, #tl-home \*::before, #tl-home \*::after, #tl-home-fab \{ animation: none !important;/);
});

test('Dersler ve Performans görünümlerinde atasözü/deyim içerik girişi yok; eski kokpit sınıfları kalmadı', () => {
  const lessons = read('home/lessons.js');
  assert.doesNotMatch(lessons, /data-lit|mountLiterature|literature\.js|openView\('edebiyat'/);
  const perf = js.slice(js.indexOf('function mountPerf('), js.indexOf('/* ---------- bölümler ---------- */'));
  assert.doesNotMatch(perf, /data-lit|data-nav="edebiyat"|edebiyat'\)/);
  assert.doesNotMatch(js + css, /tlh-k-(?:met|write|lit|edu|pvp)|tlh-pw-|tlh-quest-strip|tlh-met-perf|tlh-lit-chips/);
});
