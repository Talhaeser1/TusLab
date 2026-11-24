// Ana ekran görselleri (5. iş; kokpit, sonra Sahne düzeninde güncellendi 24 Kas): vektör görseller yerel, güvenli ve CSS'e bağlı.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';

const css = readFileSync(new URL('../home/home.css', import.meta.url), 'utf8');
const js = readFileSync(new URL('../home/home.js', import.meta.url), 'utf8');
// kart-yazma.svg / kart-edebiyat.svg Merkez'de kullanılmıyordu: _to_delete/terazi-home/ altına taşındı (Terazi, 24 Kas)
const ARTS = { egitim: 'kart-dersler.svg' };

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
  // kart-edebiyat.svg / kart-yazma.svg içindeki "Damlaya damlaya…" yazısı sözle çakışıyordu: Merkez'de kullanılmaz (dosyalar _to_delete/'te)
  assert.doesNotMatch(css, /kart-edebiyat\.svg"|kart-yazma\.svg"/);
  assert.match(js, /class="tlh-cw-kb" viewBox=/);
  assert.match(css, /url\("\.\.\/assets\/home\/pvp-kart\.webp"\)/);   // lobi afişinin kart boyu kopyası (Tuşçu)
});

test('çipler ve kartlar: klavye odağı görünür, azaltılmış harekette dönüşüm yok', () => {
  assert.match(css, /#tl-home \.tlh-lit-chip:focus-visible \{ outline: 3px solid var\(--acc\)/);
  assert.match(css, /#tl-home \.tlh-chip:focus-visible \{ outline: 3px solid var\(--acc\)/);
  assert.match(css, /#tl-home \.tlh-c-pvp:focus-visible \{ outline: 3px solid var\(--acc\)/);
  // Yazma kartı artık bölüm: içindeki düğmeler (tür çipleri, "Yazmaya başla") kendi odak halkasını taşır
  assert.match(css, /#tl-home \.tlh-cw-tag:focus-visible \{ outline: 3px solid var\(--tl-cyan\)/);
  assert.match(css, /#tl-home \.tlh-c-write \.tlh-c-go:focus-visible \{ outline: 3px solid var\(--tl-cyan\)/);
  const rm = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
  assert.match(rm, /#tl-home \.tlh-c:hover, #tl-home \.tlh-c:focus-visible/);
  assert.match(rm, /\.tlh-c:hover \.tlh-c-go span/);
  assert.match(css, /html\.reduced-motion #tl-home \.tlh-lit-chip:hover/);
  assert.match(css, /html\.reduced-motion #tl-home \.tlh-c:hover/);
});
