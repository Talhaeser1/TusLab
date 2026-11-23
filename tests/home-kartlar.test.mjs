// Ana ekran görselleri (5. iş, kokpit düzeninde güncellendi 24 Kas): vektör görseller yerel, güvenli ve CSS'e bağlı.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';

const css = readFileSync(new URL('../home/home.css', import.meta.url), 'utf8');
const ARTS = { yazma: 'kart-yazma.svg', egitim: 'kart-dersler.svg', edebiyat: 'kart-edebiyat.svg' };
// Kokpit: görseller bölüm panellerinin soluk arka katmanı. (kart-yazma.svg şu an kullanılmıyor, dosya yerinde duruyor.)
const USED = { edu: 'kart-dersler.svg', lit: 'kart-edebiyat.svg' };

test('kart görselleri: dosyalar var, küçük, betik/dış kaynak yok', () => {
  for (const file of Object.values(ARTS)) {
    const url = new URL(`../assets/home/${file}`, import.meta.url);
    assert.ok(existsSync(url), `${file} yok`);
    assert.ok(statSync(url).size < 16 * 1024, `${file} 16 KB'tan büyük`);
    const svg = readFileSync(url, 'utf8');
    assert.match(svg, /^<svg[^>]+viewBox="0 0 400 280"/);
    assert.doesNotMatch(svg, /<script|on\w+=|https?:\/\/(?!www\.w3\.org\/2000\/svg)|<image|@import|<foreignObject/i);
  }
});

test('panel görselleri: dersler ve edebiyat paneli kendi görseline bağlı, PvP afişi ayrı kalır', () => {
  for (const [id, file] of Object.entries(USED)) {
    assert.ok(css.includes(`.tlh-k-${id} { --art: url("../assets/home/${file}"); }`), `${id} → ${file} bağlı değil`);
  }
  assert.match(css, /\.tlh-k-lit::before, #tl-home \.tlh-k-edu::before \{[^}]*background: var\(--art\)/);
  assert.match(css, /mask-image: linear-gradient\(180deg/);
  assert.match(css, /lobi-afis\.webp/);
});

test('çipler ve PvP girişi: klavye odağı görünür, azaltılmış harekette dönüşüm yok', () => {
  assert.match(css, /#tl-home \.tlh-lit-chip:focus-visible \{ outline: 3px solid var\(--acc\)/);
  assert.match(css, /#tl-home \.tlh-k-pvp:focus-visible \{ outline: 3px solid/);
  const rm = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
  assert.match(rm, /\.tlh-quest-strip:hover \.tlh-quest-strip-go \{ transform: none; \}/);
  assert.match(rm, /\.tlh-k-pvp:hover \.tlh-pvp-go/);
  assert.match(css, /html\.reduced-motion #tl-home \.tlh-lit-chip:hover/);
});
