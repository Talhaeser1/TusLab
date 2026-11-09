import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('tur arası: sonuç ve süre becerisi tek panelde (.rui-inter), yazma panelinin yerine oturur', () => {
  const js = read('pvp/rounds-ui.js');
  assert.match(js, /h\('div',\{cls:'rui-inter',rui:'inter',hidden:true\},summary,picker\)/);
  assert.match(js, /el\.append\(bar,strip,clash,flash,intro,inter,reveal,live\)/);
  assert.match(js, /querySelector\('\.tt'\)/, 'panel yazma panelinin kutusunu ölçer');
  assert.match(js, /height:`\$\{Math\.round\(r\.height\)\}px`/, 'yükseklik yazma paneliyle aynı → aşağı taşmaz');
  const css = read('pvp/rounds-ui.css');
  assert.match(css, /#pvp-root\.rui-inter-open \.tt-type\{visibility:hidden\}/, 'yazma paneli gizlenir ama yer tutar');
  assert.match(css, /\.rui-skill-picker \.aui-cards\.rui-skill-cards\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)\}/, '3 kart 3 sütun');
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
