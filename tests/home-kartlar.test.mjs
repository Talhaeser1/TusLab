// Ana ekran görselleri (5. iş; kokpit, sonra Sahne düzeninde güncellendi 24 Kas): vektör görseller yerel, güvenli ve CSS'e bağlı.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';

const css = readFileSync(new URL('../home/home.css', import.meta.url), 'utf8');
const js = readFileSync(new URL('../home/home.js', import.meta.url), 'utf8');
const ARTS = { yazma: 'kart-yazma.svg', egitim: 'kart-dersler.svg', edebiyat: 'kart-edebiyat.svg' };

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

test('kart görselleri: Dersler kartı kendi görseline bağlı, Yazma kartı elle SVG klavye, PvP afişi ayrı kalır', () => {
  assert.match(css, /\.tlh-c-edu::after \{[^}]*background: url\("\.\.\/assets\/home\/kart-dersler\.svg"\)/);
  assert.match(css, /mask-image: linear-gradient\(200deg/);
  // kart-edebiyat.svg / kart-yazma.svg içindeki "Damlaya damlaya…" yazısı sözle çakışır: Merkez'de kullanılmaz (dosyalar yerinde)
  assert.doesNotMatch(css, /kart-edebiyat\.svg"|kart-yazma\.svg"/);
  assert.match(js, /class="tlh-cw-kb" viewBox=/);
  assert.match(css, /url\("\.\.\/assets\/home\/pvp-kart\.webp"\)/);   // lobi afişinin kart boyu kopyası (Tuşçu)
});

test('çipler ve kartlar: klavye odağı görünür, azaltılmış harekette dönüşüm yok', () => {
  assert.match(css, /#tl-home \.tlh-lit-chip:focus-visible \{ outline: 3px solid var\(--acc\)/);
  assert.match(css, /#tl-home \.tlh-chip:focus-visible \{ outline: 3px solid var\(--acc\)/);
  assert.match(css, /#tl-home \.tlh-c-write:focus-visible, #tl-home \.tlh-c-pvp:focus-visible \{ outline: 3px solid var\(--acc\)/);
  const rm = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
  assert.match(rm, /#tl-home \.tlh-c:hover, #tl-home \.tlh-c:focus-visible/);
  assert.match(rm, /\.tlh-c:hover \.tlh-c-go span/);
  assert.match(css, /html\.reduced-motion #tl-home \.tlh-lit-chip:hover/);
  assert.match(css, /html\.reduced-motion #tl-home \.tlh-c:hover/);
});
