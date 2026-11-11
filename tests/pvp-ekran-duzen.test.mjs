import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('tur arası: RAUND yazısı ardından sonuç ve süre becerisi kompakt alt panelde', () => {
  const js = read('pvp/rounds-ui.js');
  assert.match(js, /h\('div',\{cls:'rui-inter',rui:'inter',hidden:true\},summary,picker\)/);
  assert.match(js, /el\.append\(bar,strip,clash,flash,banner,intro,inter,reveal,live\)/);
  assert.match(js, /inter\.classList\.toggle\('is-dock',open\)/);
  const css = read('pvp/rounds-ui.css');
  assert.match(css, /#pvp-root\.rui-inter-open \.tt-type\{visibility:hidden\}/, 'yazma paneli gizlenir ama yer tutar');
  assert.match(css, /#pvp-root \.rui-inter\.is-dock\{position:fixed/);
  assert.match(css, /max-height:calc\(44dvh - var\(--rui-dock-bottom,64px\)\)/);
  assert.match(css, /\.rui-skill-picker \.aui-cards\.rui-skill-cards\{grid-template-columns:repeat\(auto-fit,minmax\(min\(100%,240px\),1fr\)\)/);
});

test('hazırlık kartları: okunur genişlik, bütün kelime, iki satır açıklama ve ayrılmış rozet alanı',()=>{
  const arena=read('pvp/arena-ui.css'),rounds=read('pvp/rounds-ui.css');
  assert.match(arena,/\.aui-cards\{display:grid;grid-template-columns:repeat\(auto-fit,minmax\(min\(100%,240px\),1fr\)\)/);
  assert.match(arena,/\.aui-card\{[^}]*min-width:min\(100%,240px\)/s);
  assert.match(arena,/\.aui-card-copy strong\{[^}]*white-space:nowrap;[^}]*overflow-wrap:normal;[^}]*word-break:keep-all;[^}]*hyphens:none/s);
  assert.match(arena,/\.aui-card-copy small\{[^}]*-webkit-line-clamp:2;[^}]*overflow-wrap:normal;[^}]*hyphens:none/s);
  assert.match(arena,/\.aui-card-copy\{[^}]*padding-right:40px/s);
  assert.match(arena,/\.aui-uses\{position:absolute;top:8px;right:8px;/);
  assert.match(rounds,/\.rui-skill-cards \.aui-card-copy strong,[^}]*overflow-wrap:normal;word-break:keep-all;hyphens:none/s);
  assert.match(rounds,/#pvp-root \.rui-inter\.is-dock \.rui-skill-picker \.aui-cards\.rui-skill-cards\{grid-template-columns:repeat\(auto-fit,minmax\(min\(100%,240px\),1fr\)\)/);
  assert.match(arena,/#pvp-root \.aui-stage\.me-2 \.aui-prep \.aui-card\[aria-pressed="true"\]/);
  assert.match(rounds,/#pvp-root \.me-2 \.rui-skill-picker \.aui-card\[aria-pressed="true"\]/);
  assert.match(arena,/#pvp-root \.aui-prep \.aui-card\.is-empty/);
  assert.match(rounds,/#pvp-root \.rui-skill-picker\.is-locked \.aui-card:not\(\.is-empty\)/);
});

test('saldırı sırası etiketi: yazma paneli açıksa onda, arena odağında arenanın üst ortasında', () => {
  const js = read('pvp/resolve-ui.js');
  assert.match(js, /if \(tt && !root\.classList\?\.contains\?\.\('stage-focus'\)\) return tt;/);
  assert.match(read('pvp/cinematic.css'), /#pvp-root\.stage-focus \.pvp2-duel>\.rsv-banner\{top:/);
});

test('arena odağı: saldırı sırasında yazma paneli katlanır; odak modülü etiket modülünden önce bağlanır', () => {
  const css = read('pvp/cinematic.css');
  assert.match(css, /#pvp-root\.stage-focus \.tt\{display:none\}/);
  assert.match(css, /#pvp-root\.rui-inter-open \.rui-words\{display:none\}/);
  const idx = read('pvp/index.js');
  assert.ok(idx.indexOf('attachStageFocus({root') < idx.indexOf('attachResolveUi({root'));
});

test('kısa ekran ve %80 yakınlaştırma stilleri en son yüklenir', () => {
  const html = read('index.html');
  const links = [...html.matchAll(/href="([^"]+\.css)"/g)].map(m => m[1]);
  assert.equal(links.at(-1), './pvp/compact-height.css');
  const css = read('pvp/compact-height.css');
  assert.match(css, /@media \(max-height:1000px\)/);
  assert.match(css, /@media \(max-height:760px\)/);
  assert.match(css, /@media \(min-width:2200px\)/);
  assert.doesNotMatch(css, /infinite|backdrop-filter/);
});

test('ekran denetim betiği yayına gitmez ve kontrol kuralları dosyası var', () => {
  const build = read('cloudflare/build-assets.mjs');
  assert.doesNotMatch(build, /'scripts'/);
  assert.match(read('docs/EKRAN-KONTROL-KURALLARI.md'), /Bitirme ölçütü/);
  assert.match(read('scripts/ekran-denetim.mjs'), /export function denetle/);
});
