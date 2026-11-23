// Ana sayfa "Merkez" (23 Kas 2026): 3B sahne yok, PvP lobiye gider, dört bölüm + Yazma görünümü, kesintisiz akış bağlı.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const js = read('home/home.js');
const css = read('home/home.css');

test('3B sahne yüklenmez/kurulmaz, WebGL tuvali yok', () => {
  assert.doesNotMatch(js, /scene3d/);
  assert.doesNotMatch(js, /mountScene|getContext\(['"]webgl/);
  assert.doesNotMatch(css, /tlh-scene|tlh-shade|tlh-side|tlh-player/);
});

test('PvP sekmesi ve kartı ?pvp=lobby adresine gider', () => {
  assert.match(js, /href="\?pvp=lobby" data-nav="pvp"/);
  assert.match(js, /href="\?pvp=lobby" data-card="pvp"/);
  assert.doesNotMatch(js, /\?pvp=practice/);
});

test('üst menüde beş bölüm; dört bölüm görünümü kayıtlı; logo Merkez', () => {
  for (const [id, label] of [['yazma', 'Yazma'], ['egitim', 'Klavye Dersleri'], ['edebiyat', 'Şiir & Atasözü'], ['pvp', 'PvP Düello'], ['performans', 'Performans']]) {
    assert.match(js, new RegExp(`\\{ id: '${id}', icon: '[^']+', label: '${label}' \\}`));
  }
  assert.match(js, /const VIEW_IDS = \['yazma', 'egitim', 'edebiyat', 'performans'\];/);
  for (const v of ['yazma', 'egitim', 'edebiyat', 'performans']) assert.match(js, new RegExp(`\\n    ${v}: \\{ title:`));
  assert.match(js, /class="tlh-logo"[^>]*data-nav="hub"[^>]*aria-current="page"/);
  // kokpit (24 Kas): Merkez beş panel — metrikler, Yazma, tür şeridi, dersler, PvP
  for (const c of ['tlh-k-met', 'tlh-k-write', 'tlh-k-lit', 'tlh-k-edu', 'tlh-k-pvp']) assert.match(js, new RegExp(`class="tlh-k ${c}"`));
});

test('Yazma kesintisiz akışa bağlı: stream/onChunk/nextChunk, Kelime tek metin', () => {
  assert.match(js, /text: arenaMod\.isStreamMode\?\.\(current\.mode\) \? '' : current\.text/);
  assert.match(js, /stream: arenaMod\.isStreamMode\?\.\(current\.mode\) \? \(\) => takeFirst\(\) \|\| arenaMod\.nextChunk\(current\.mode\) : null/);
  assert.match(js, /onChunk\(c\) \{/);
  assert.match(js, /current = arenaMod\.isStreamMode\?\.\(mode\) \? \{ text: '', source: '', mode \} : Object\.assign\(pk \|\| arenaMod\.pickText\(mode\), \{ mode \}\)/);
});

test('satır içi olay işleyicisi ve satır içi betik yok (CSP)', () => {
  assert.doesNotMatch(js, /\son[a-z]+\s*=\s*["'`]/i);
  assert.doesNotMatch(js, /<script/i);
  assert.doesNotMatch(js, /\beval\(|new Function\(/);
});

test('eski site koruması ve PvP dönüş gözcüsü korunur', () => {
  assert.match(js, /classList\.add\('tlh-app-off'\)/);
  assert.match(js, /function watchPvp\(\)/);
  assert.match(js, /function showHome\(\)/);
  assert.match(js, /function hideHome\(\)/);
  assert.match(js, /location\.replace\(location\.pathname\)/);
});

test('CSS: azaltılmış hareket ve görünür odak halkası', () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /:focus-visible \{\s*outline: 3px solid/);
  assert.match(css, /url\("\.\.\/assets\/home\/pvp-kart\.webp"\)/);   // lobi afişinin kart boyu kopyası (Tuşçu)
});
