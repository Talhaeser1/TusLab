import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('tur arası: RAUND yazısı ardından sonuç ve süre becerisi kompakt alt panelde', () => {
  const js = read('pvp/rounds-ui.js');
  assert.match(js, /h\('div',\{cls:'rui-inter rui-band',rui:'inter',hidden:true\},summary,picker\)/);
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
  assert.match(arena,/\.aui-card-copy\{[^}]*padding-right:44px/s);
  assert.match(arena,/\.aui-uses\{position:absolute;top:8px;right:8px;/);
  assert.match(rounds,/\.rui-skill-cards \.aui-card-copy strong,[^}]*overflow-wrap:normal;word-break:keep-all;hyphens:none/s);
  assert.match(rounds,/#pvp-root \.rui-inter\.is-dock \.rui-skill-picker \.aui-cards\.rui-skill-cards\{grid-template-columns:repeat\(auto-fit,minmax\(min\(100%,240px\),1fr\)\)/);
  assert.match(arena,/#pvp-root \.aui-stage\.me-2 \.aui-prep \.aui-card\[aria-pressed="true"\]/);
  assert.match(rounds,/#pvp-root \.me-2 \.rui-skill-picker \.aui-card\[aria-pressed="true"\]/);
  assert.match(arena,/#pvp-root \.aui-prep \.aui-card\.is-empty/);
  assert.match(rounds,/#pvp-root \.rui-skill-picker\.is-locked \.aui-card:not\(\.is-empty\)/);
});

test('kart ızgarası: grid-area bağlama, 40px ikon, metin minmax(0,1fr), rozet sağ üst (B1 kusur 1)',()=>{
  const arena=read('pvp/arena-ui.css'),rounds=read('pvp/rounds-ui.css'),modes33=read('pvp/modes33.css');
  assert.match(arena,/\.aui-card\{[^}]*grid-template-columns:40px minmax\(0,1fr\)[^}]*grid-template-areas:"icon copy"/s);
  assert.match(arena,/\.aui-icon,\.aui-card-icon\{grid-area:icon;width:40px/);
  assert.match(arena,/\.aui-card-copy\{grid-area:copy;[^}]*min-width:0/s);
  assert.match(arena,/\.aui-card-copy strong\{[^}]*white-space:nowrap;[^}]*overflow:hidden;text-overflow:ellipsis/s);
  assert.match(rounds,/\.rui-skill-picker \.rui-skill-cards \.aui-card\{grid-template-columns:40px minmax\(0,1fr\)/);
  assert.match(rounds,/#pvp-root \.rui-inter\.is-dock \.rui-skill-picker \.rui-skill-cards \.aui-card\{[^}]*grid-template-columns:40px minmax\(0,1fr\)/s);
  assert.doesNotMatch(modes33,/\.aui-uses\{position:static/,'rui-inter "2/2" rozeti akış içinde kalmamalı');
});

test('özet/sonuç açıkken alt yazma paneli ve ARENA · RAUND etiketi tamamen gizli (üç mod)',()=>{
  const rounds=read('pvp/rounds-ui.css');
  const idx=read('pvp/pvp-main.js');
  assert.match(rounds,/#pvp-root\.rui-inter-open:not\(\.cin-round-end\) \.tt,/);
  assert.match(rounds,/#pvp-root\.aui-summary-open \.tt,/);
  assert.match(rounds,/#pvp-root\.pvp15-results-open \.tt\{display:none\}/);
  assert.match(idx,/data-type-label/,'etiket .tt içinde üretilir; .tt gizlenince etiket de gizlenir');
});

test('rol etiketi dar ekranda kesilmez: kelime sınırında sarılır, bölünmez (B3b)',()=>{
  const arena=read('pvp/arena-ui.css');
  assert.match(arena,/#pvp-root \.pvp2-role\{[^}]*max-width:calc\(100% - 16px\)[^}]*white-space:normal[^}]*overflow-wrap:break-word;word-break:keep-all;hyphens:none/s);
  assert.match(arena,/@media \(max-width:900px\)\{[^}]*#pvp-root \.pvp2-role\{font-size:12px[^}]*\}/s);
  const pvp=read('pvp/pvp.css');
  assert.match(pvp,/\.pvp2-role\{position:absolute/,'temel kural pvp.css (salt okunur); arena-ui.css ezer');
});

test('üst bar: maç durumu yazısı ve ANTRENMAN yongası görsel olarak sr-only; DURAKLADI görünür (B2A)',()=>{
  const net=read('pvp/network.js'),css=read('pvp/network.css'),topbar=read('pvp/topbar.css');
  assert.match(net,/writeAttr\(banner,"data-paused",String\(match\?\.status==='paused'\)\)/,'banner duraklatma işareti JS ile yazılır');
  assert.match(css,/\.pvp-status-group \[data-match-status\]:not\(\[data-paused="true"\]\)\{/,'duraklatma dışında sr-only');
  assert.match(css,/clip-path:inset\(50%\)/,'sr-only kırpma');
  assert.match(css,/\.pvp-status-group \[data-match-status\]:not\(\[data-paused="true"\]\) \+ \[data-pvp12-ping\]\{border-left:0\}/,'banner gizliyken ping bölme çizgisi kalkar');
  assert.match(css,/\.pvp-status-group \[data-practice-chip\]\{/,'ANTRENMAN yongası sr-only');
  assert.match(topbar,/:has\(\[data-practice-chip\]:not\(\[hidden\]\)\)/,'topbar.css :has kuralı çalışmaya devam eder');
  assert.match(net,/chip\.hidden=!this\.practice/,'yonganın hidden mantığı değişmez');
});

test('lobi kadrosu: kesik köşeli neon çerçeve, portreler, afiş zemini, SEÇİLDİ vurgusu (B2B)',()=>{
  const css=read('pvp/lobby-v3.css'),net=read('pvp/network.js');
  for(const id of ['vargr','sira','doran','nyx'])
    assert.match(css,new RegExp(`\\.lb3-f-art\\[data-fighter-portrait="${id}"\\]\\{background-image:url\\('\\.\\./assets/higgsfield/final/portre-${id}\\.webp'\\)\\}`));
  assert.match(css,/\.lb3-showcase\.lb3-roster\{[^}]*lobi-afis\.webp/s,'vitrin zemini lobi afişi');
  assert.match(css,/\.pvp6-slot \.lb3-slot-art\{background-image:url\('\.\.\/assets\/higgsfield\/final\/arena-neon-kolezyum\.webp'\)\}/,'oda slotları neon kolezyum');
  assert.doesNotMatch(css,/arena-king\.webp|rune-preview\.webp/,'eski oda slot görselleri kalktı');
  assert.match(css,/button\.lb3-fighter\{[^}]*clip-path:polygon\(var\(--f-cut\)/s,'kesik köşe');
  assert.match(css,/button\.lb3-fighter::before\{[^}]*inset:2px;z-index:-1/s,'iç panel çerçeveyi ~2px bırakır');
  assert.match(css,/button\.lb3-fighter\[aria-checked="true"\]\{[^}]*transform:scale\(1\.02\)/s,'seçili kart ≤1.04 ölçek');
  assert.match(css,/button\.lb3-fighter\[aria-checked="true"\]::after\{[^}]*content:'✓ SEÇİLDİ'/s,'SEÇİLDİ damgası');
  assert.match(css,/button\.lb3-fighter\[aria-checked="true"\]::before\{[^}]*inset 0 0 34px/s,'seçili kart iç parıltı');
  assert.match(css,/button\.lb3-fighter:focus-visible\{[^}]*outline:none/s,'clip-path outline keser → odak çerçeveyle verilir');
  assert.match(css,/button\.lb3-fighter:focus-visible::before\{[^}]*inset 0 0 0 2px var\(--lb3-focus\)/s,'odak iç halkası');
  assert.match(css,/\.lb3-fighter \.lb3-f-emblem\{display:none\}/,'portre gelince amblem gizlenir');
  assert.doesNotMatch(css,/\.lb3-fighter\[aria-checked="true"\] \.lb3-f-name::after/,'eski ✓ işareti kalktı');
  // Davranış değişmez: role=radio, aria-checked, data-lobby-action, ok tuşları network.js'te kalır.
  assert.match(net,/role="radio" aria-checked="\$\{on\}" tabindex="\$\{on\?0:-1\}" class="lb3-fighter \$\{f\.archetype\}" data-lobby-action="fighter"/);
  assert.match(net,/data-fighter-group="lobby"/);
  assert.match(net,/ArrowRight/);assert.match(net,/ArrowLeft/);
});

test('yerel sunucu ve yayına önbellek politikası: serve.py no-cache,must-revalidate; 304 ve PORT env (B3c)',()=>{
  const py=read('scripts/serve.py'),pkg=JSON.parse(read('package.json')),headers=read('_headers');
  assert.equal(pkg.scripts.serve,'python scripts/serve.py','yalnız "serve" betiği değişti');
  assert.match(py,/send_header\("Cache-Control", "no-cache, must-revalidate"\)/);
  assert.match(py,/os\.environ\.get\("PORT", "5176"\)/,'PORT ortam değişkeni');
  assert.match(py,/\("127\.0\.0\.1", port\)/,'yalnız yerel arabirim');
  assert.match(py,/class NoCacheHandler\(http\.server\.SimpleHTTPRequestHandler\)/,'http.server tabanlı → koşullu istek/304 korunur');
  assert.match(headers,/\/\*[\s\S]*?Cache-Control: no-cache[\s\S]*?Content-Security-Policy/,'kök _headers /* bloğunda Cache-Control');
});

test('sunum tipografisi: display yığını, italik, neon, raund özeti 28–44px, final 48–96px, sayılar ≥18px tabular (B1 kusur 2)',()=>{
  const arena=read('pvp/arena-ui.css'),rounds=read('pvp/rounds-ui.css'),p15=read('pvp/phase15-results.css');
  const stack="Impact,Haettenschweiler,'Arial Narrow Bold',system-ui";
  for(const [name,css] of [['arena',arena],['rounds',rounds],['phase15',p15]])
    assert.ok(css.includes(stack),`display yığını ${name} dosyasında eksik`);
  assert.match(arena,/\.aui-sum-winner\{[^}]*clamp\(28px,3vw,44px\)/s);
  assert.match(rounds,/\.rui-sum-winner\{[^}]*clamp\(28px,3vw,44px\)/s);
  assert.match(rounds,/\.rui-res-line\{[^}]*clamp\(28px,4vw,44px\)[^}]*font-variant-numeric:tabular-nums/s);
  assert.match(p15,/\.pvp15-title\{[^}]*clamp\(48px,6vw,96px\)/s);
  assert.match(p15,/#pvp-root \.pvp15-figures strong\{font-size:clamp\(18px,2vw,28px\)/);
  assert.match(p15,/#pvp-root \.pvp15-figures strong,#pvp-root \.pvp15-scorecards\{font-variant-numeric:tabular-nums\}/);
  assert.match(p15,/\.pvp15-detail\{[^}]*font-size:13px/s);
  assert.match(arena,/\.aui-sum-winner\.is-seat-1\{[^}]*text-shadow/s);
  assert.match(arena,/\.aui-sum-winner\.is-seat-2\{[^}]*text-shadow/s);
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
  const idx = read('pvp/pvp-main.js');
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
