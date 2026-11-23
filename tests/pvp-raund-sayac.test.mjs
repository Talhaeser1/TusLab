// Raund sayacı madalyonu (docs/7-raund-sayaci.md): görsel dosyalar, CSS bağları ve korunan durumlar.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';

const css = readFileSync(new URL('../pvp/rounds-ui.css', import.meta.url), 'utf8');
const js = readFileSync(new URL('../pvp/rounds-ui.js', import.meta.url), 'utf8');
const svgPath = new URL('../assets/pvp/raund-sayac.svg', import.meta.url);
const seritPath = new URL('../assets/pvp/raund-sayac-serit.svg', import.meta.url);
const block = css.slice(css.indexOf('Raund sayacı madalyonu'));

test('raund sayacı: madalyon ve şerit SVG dosyaları var, elle yazılmış, betiksiz ve dış bağlantısız', () => {
  for (const p of [svgPath, seritPath]) {
    assert.ok(existsSync(p), String(p));
    const s = readFileSync(p, 'utf8');
    assert.match(s, /^<svg[^>]+viewBox="0 0 \d+ \d+"/);
    assert.doesNotMatch(s, /<script|on\w+=|href="(https?:|\/\/)|<image/i, 'SVG içinde betik/dış kaynak olmamalı');
  }
  const svg = readFileSync(svgPath, 'utf8');
  // Halka ve saniye CSS'te merkez (100,84) çekirdeğine oturur; SVG geometrisi bununla eşleşmeli.
  assert.match(svg, /viewBox="0 0 200 140"/);
  assert.match(svg, /<circle cx="100" cy="84" r="45"/);
  assert.ok(Buffer.byteLength(svg) < 8000, 'madalyon SVG küçük kalmalı');
});

test('raund sayacı: CSS madalyonu ve şeridi göreli yolla bağlar, iki kimlikli seçiciyle sırası bağımsız kazanır', () => {
  assert.ok(block.length > 0 && block.length < css.length, 'madalyon bloğu rounds-ui.css içinde');
  assert.match(block, /url\("\.\.\/assets\/pvp\/raund-sayac\.svg"\)/);
  assert.match(block, /url\("\.\.\/assets\/pvp\/raund-sayac-serit\.svg"\)/);
  assert.match(block, /#pvp-root#pvp-root\[data-layout="fullscreen"\] \[data-rounds-ui\] \.rui-medal\{/);
  // Saniye büyük (≥ 38 px tabanda) ve görünen yazılar ≥ 12 px.
  assert.match(block, /\.rui-secs\{[^}]*calc\(38px \* var\(--rs,1\)\)/);
  assert.match(block, /max\(12px,calc\(13px \* var\(--rs,1\)\)\)/);
});

test('raund sayacı: durumlar korunur (acil tek sefer, donmuş, sonuç, ani ölüm, son çağrı)', () => {
  assert.match(block, /\.rui-medal\.is-urgent \.rui-ring-fill\{stroke:var\(--rui-danger\)\}/);
  const urgentSecs = block.match(/\.rui-medal\.is-urgent \.rui-secs\{[^}]*\}/)[0];
  assert.match(urgentSecs, /animation:rui-pulse \S+ \S+ 1\}/, 'acil animasyon tek seferlik');
  assert.doesNotMatch(block, /infinite/, 'sonsuz yanıp sönme yok');
  assert.match(block, /\.rui-medal\.is-frozen \.rui-ring-fill\{stroke:#9b93c6\}/);
  assert.match(block, /\.rui-medal\.is-result::before\{opacity:0\}/);
  assert.match(block, /\[data-rounds-ui\]\.is-sudden \.rui-medal \.rui-ring-fill\{stroke:var\(--rui-danger\)\}/);
  // Taban kurallar (bu dosyanın üst kısmı) korunur: sonuçta saat gizli, son çağrı görünürken başlık gizli.
  assert.match(css, /\.rui-medal\.is-result \.rui-clock\{visibility:hidden\}/);
  assert.match(css, /\.rui-medal:has\(\.rui-lastcall:not\(\[hidden\]\)\) \.rui-title\{visibility:hidden\}/);
  assert.match(css, /\[data-rounds-ui\] \[hidden\]\{display:none!important\}/, 'gizli son çağrı display:grid ile açılmaz');
});

test('raund sayacı: sonuç anında üst karartmada şerit kadar pencere kalır (şerit soluk kalmaz)', () => {
  assert.match(block, /\.rui-medal\) > \.fhud2::before\{\s*--rs-rx:118px/);
  assert.match(block, /\.rui-medal\.is-result\) > \.fhud2::before\{--rs-rx:130px;--rs-ry:30px;--rs-cy:52px\}/);
});

test('raund sayacı: telefon ve alçak ekran ölçekleri, azaltılmış hareket', () => {
  assert.match(block, /@media \(max-width:600px\)\{[^]*?--rs:\.72;top:240px/);
  assert.match(block, /@media \(max-height:500px\)\{[^]*?--rs:\.62;top:4px/);
  const reduced = block.match(/@media \(prefers-reduced-motion:reduce\)\{[^]*?\n\}/)[0];
  assert.match(reduced, /\.rui-medal::before\{transition:none\}/);
  assert.match(reduced, /\.rui-medal\.is-urgent \.rui-secs\{animation:none\}/);
  assert.match(block, /#pvp-root\.pvp4-reduced\[data-layout="fullscreen"\] \[data-rounds-ui\] \.rui-medal::before\{transition:none\}/);
});

test('raund sayacı: JS’in güncellediği öğeler ve sınıflar yerinde', () => {
  for (const cls of ['rui-medal', 'rui-title', 'rui-secs', 'rui-secs-unit', 'rui-lastcall', 'rui-ring-fill', 'rui-ring-track', 'rui-clock']) {
    assert.ok(js.includes(`'${cls}'`), cls);
  }
  assert.match(js, /setFlag\(medal,'is-urgent',tm\.urgent\)/);
  assert.match(js, /setFlag\(medal,'is-frozen',tm\.frozen\)/);
  assert.match(js, /setFlag\(medal,'is-result',/);
  assert.match(js, /setFlag\(el,'is-sudden',/);
  assert.match(js, /stroke-dashoffset/);
});
