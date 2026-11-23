// Ana ekran "kokpit" (10. iş, 24 Kas 2026): solda metrikler, ortada Yazma önizlemesi + tür şeridi, sağda dersler + PvP.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const js = read('home/home.js');
const css = read('home/home.css');
const lit = read('home/literature.js');

test('masaüstü üç sütun; dar ekranda iki sütun; telefonda sıra Yazma → tür → Eğitim → Metrik → PvP', () => {
  assert.match(css, /grid-template-areas: "met write edu" "met lit pvp";/);
  assert.match(css, /@media \(max-width: 1180px\) \{[^@]*grid-template-areas: "write write" "lit lit" "edu met" "pvp met";/);
  assert.match(css, /grid-template-areas: "write" "lit" "edu" "met" "pvp";/);
  assert.match(css, /\.tlh-menu \{[^}]*overflow-x: hidden; overflow-y: auto;/);
});

test('tür şeridi: beş tür kartı (özdeyiş dahil) Şiir & Atasözü akışını o türle açar', () => {
  for (const id of ['atasozu', 'deyim', 'siir', 'tekerleme', 'ozdeyis']) assert.match(js, new RegExp(`\\{ id: '${id}', label: '[^']+', unit: '[^']+' \\}`));
  assert.match(js, /openView\('edebiyat', \{ intent: \{ cat: t\.dataset\.lit \} \}\)/);
  assert.match(lit, /ctx\.intent && typeof ctx\.intent\.cat === 'string'/);
  assert.match(lit, /if \(CATEGORIES\.some\(\(c\) => c\.id === startCat\)\) startSession\(startCat\);\s*else renderMenu\(\);/);
});

test('Yazma önizlemesi: gösterilen satır yazılır, Merkez\'de basılan harf kaybolmaz', () => {
  assert.match(js, /function ensurePeek\(\)/);
  assert.match(js, /const pk = takePeek\(mode\);/);
  assert.match(js, /if \(!view\) \{ e\.preventDefault\(\); pendingKeys = e\.key; openView\('yazma'\); return true; \}/);
  assert.match(js, /ta\.dispatchEvent\(new Event\('input'\)\)/);
  // değiştirici tuşlar, boşluk ve form alanları yazmayı başlatmaz
  assert.match(js, /e\.ctrlKey \|\| e\.metaKey \|\| e\.altKey \|\| e\.isComposing/);
  assert.match(js, /e\.key\.length !== 1 \|\| e\.key === ' ' \|\| isField\(e\.target\)/);
});

test('ders yolu ve metrik yuvası; Performans ve dersler girişleri', () => {
  assert.match(js, /function renderPath\(li\)/);
  assert.match(js, /data-lesson="\$\{i\}"/);
  assert.match(js, /data-slot="metrik-grafik"/);
  assert.match(js, /data-tlh="perf"/);
  assert.match(js, /data-tlh="lessons"/);
  assert.match(js, /data-tlh="resume"/);
  assert.match(js, /href="\?pvp=lobby" data-card="pvp"/);
});

test('Dersler ve Performans görünümlerinde atasözü/deyim içerik girişi yok', () => {
  const lessons = read('home/lessons.js');
  assert.doesNotMatch(lessons, /data-lit|mountLiterature|literature\.js|openView\('edebiyat'/);
  const perf = js.slice(js.indexOf('function mountPerf('), js.indexOf('/* ---------- bölümler ---------- */'));
  assert.doesNotMatch(perf, /data-lit|data-nav="edebiyat"|edebiyat'\)/);
});

test('düzen kayması yok: önizleme ve ders yolu yer ayırır; azaltılmış harekette imleç yanıp sönmez', () => {
  assert.match(css, /\.tlh-pw-text \{[^}]*min-height: 4\.5em;/);
  assert.match(css, /\.tlh-path \{[^}]*min-height: calc\(4 \* 40px \+ 18px\);/);
  assert.match(css, /@keyframes tlh-blink/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*#tl-home \*, #tl-home \*::before, #tl-home \*::after, #tl-home-fab \{ animation: none !important;/);
});
