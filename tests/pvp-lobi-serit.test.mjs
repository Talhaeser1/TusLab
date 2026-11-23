// Rapor 8 — PvP lobisi dövüşçü seçim şeridi: iki grup (Dövüşçüler · Padişahlar), kısa adlar, yazısız küçük padişah madalyonu,
// seçili altın halka, yatay kayma + kenar solması, dar pencerede bilgi kartının şeride binmemesi.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {fighterDockHTML} from '../pvp/network.js';
import {FIGHTER_IDS, PADISAH_IDS, BASE_FIGHTER_IDS, FIGHTERS} from '../pvp/shared/fighters.js';
import {PADISAH_DEFS} from '../pvp/shared/padisahlar.js';
import {DOCK_NAMES, dockName, dockMedallionUrl} from '../pvp/portraits.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = f => readFileSync(resolve(ROOT, f), 'utf8');

test('Şerit: 15 madalyon iki grupta (5 temel + 10 padişah), sıra korunur, gruplara küçük başlık', () => {
  const dock = fighterDockHTML('fatih');
  const ids = [...dock.matchAll(/data-fighter="(\w+)" data-side/g)].map(m => m[1]);
  assert.deepEqual(ids, [...FIGHTER_IDS]);
  assert.equal(ids.length, 15);
  const [base, pad] = dock.split('data-dock-group="padisah"');
  assert.match(base, /data-dock-group="base"[\s\S]*>Dövüşçüler</);
  assert.match(pad, />Padişahlar</);
  for (const id of BASE_FIGHTER_IDS) assert.ok(base.includes(`data-fighter="${id}"`), `${id} temel grupta`);
  for (const id of PADISAH_IDS) assert.ok(pad.includes(`data-fighter="${id}"`), `${id} padişah grubunda`);
  // Tek radiogroup; yalnız seçili madalyon tabindex=0 (ok tuşları gruplar arasında kesintisiz gezer).
  assert.equal((dock.match(/role="radiogroup"/g) || []).length, 1);
  assert.equal((dock.match(/aria-checked="true"/g) || []).length, 1);
  assert.match(dock, /aria-checked="true" tabindex="0" class="lb3-fighter rune" data-lobby-action="fighter" data-fighter="fatih"/);
});

test('Şerit: madalyon altında kısa ad (padişahlar kısaltılmış), tam ad aria-label\'da', () => {
  assert.deepEqual(PADISAH_IDS.map(dockName),
    ['Osman', 'Orhan', 'I. Murad', 'Yıldırım', 'Çelebi', 'II. Murad', 'Fatih', 'II. Bayezid', 'Yavuz', 'Kanuni']);
  assert.deepEqual(Object.keys(DOCK_NAMES).sort(), [...PADISAH_IDS].sort());
  for (const id of BASE_FIGHTER_IDS) assert.equal(dockName(id), FIGHTERS[id].name);
  const dock = fighterDockHTML();
  for (const id of FIGHTER_IDS) {
    const btn = dock.match(new RegExp(`<button[^>]*data-fighter="${id}"[^>]*>[\\s\\S]*?</button>`))[0];
    assert.match(btn, new RegExp(`<b class="lb3-f-name" aria-hidden="true">${dockName(id)}</b>`), `${id} kısa ad`);
    assert.ok(btn.includes(`aria-label="${FIGHTERS[id].name} · `), `${id} tam ad aria-label`);
  }
});

test('Şerit: padişahın yazısız küçük madalyonu var ve şerit onu kullanır; büyük kart/yüz büyük SVG\'de kalır', async () => {
  const css = read('pvp/lobby-v3.css');
  for (const id of PADISAH_IDS) {
    const f = `assets/padisah/${id}-kucuk.svg`;
    assert.ok(existsSync(resolve(ROOT, f)), f);
    assert.equal(dockMedallionUrl(id), `./${f}`);
    const svg = read(f);
    const d = PADISAH_DEFS.find(x => x[0] === id)[2];
    assert.ok(svg.includes(d.palette.main) && svg.includes(d.palette.accent), `${id} rengi`);
    assert.doesNotMatch(svg, new RegExp(d.title.toLocaleUpperCase('tr-TR')), `${id} küçük madalyonda unvan yok`);
    assert.ok(!svg.includes(d.reign), `${id} küçük madalyonda yıl yok`);
    assert.match(css, new RegExp(`\\.j2-chars \\.lb3-fighter\\[data-fighter\\] \\.lb3-f-art\\[data-fighter-portrait="${id}"\\]\\{background-image:url\\('\\.\\./assets/padisah/${id}-kucuk\\.svg'\\)`));
    assert.match(css, new RegExp(`\\.sc-face\\[data-face="${id}"\\]\\{background-image:url\\('\\.\\./assets/padisah/${id}\\.svg'\\)`), `${id} büyük yüz`);
  }
  for (const id of BASE_FIGHTER_IDS) assert.equal(dockMedallionUrl(id), null);
  // Üretici küçük sürümü deterministik üretir (dosya ile birebir).
  const {smallMedallion} = await import(pathToFileURL(resolve(ROOT, 'scripts/padisah-madalyon.mjs')).href + '?test');
  for (const [id, , d] of PADISAH_DEFS) assert.equal(read(`assets/padisah/${id}-kucuk.svg`).replace(/\r\n/g, '\n'), smallMedallion(d), `${id} üretici ile aynı`);
});

test('Şerit CSS: seçili altın halka + parlama, hover/focus-visible, yatay kayma + kenar solması, azaltılmış hareket', () => {
  const css = read('pvp/lobby-v3.css');
  const strip = css.slice(css.indexOf('KARAKTER ŞERİDİ (rapor 8)'));
  assert.match(strip, /button\.lb3-fighter\{--ring:var\(--sc-gold\)/);
  assert.match(strip, /button\.lb3-fighter\[aria-checked="true"\] \.lb3-f-art\{[^}]*box-shadow:0 0 0 3px var\(--ring\),[^}]*#ffb02e66/);
  assert.match(strip, /button\.lb3-fighter\[aria-checked="true"\] \.lb3-f-name\{color:var\(--sc-gold\)/);
  assert.match(strip, /button\.lb3-fighter:hover \.lb3-f-art\{opacity:1/);
  assert.match(strip, /button\.lb3-fighter:focus-visible \.lb3-f-art\{[^}]*outline:3px solid var\(--lb3-focus\)/);
  assert.match(strip, /\.j2-chars\{display:flex;[^}]*overflow-x:auto;overflow-y:hidden[^}]*mask-image:linear-gradient\(90deg,transparent 0/);
  assert.match(strip, /\.lb3-dock-grp:first-child\{margin-left:auto\}/, 'sığınca ortalı, sığmayınca sol uç erişilebilir');
  assert.match(strip, /\.lb3-dock-grp\+\.lb3-dock-grp\{[^}]*border-left:1px solid/, 'gruplar arası ince ayırıcı');
  assert.match(strip, /@media \(prefers-reduced-motion:reduce\)\{\s*#pvp-root \.lb3\.sc \.j2-chars button\.lb3-fighter:hover \.lb3-f-art\{transform:none\}/);
  for (const m of strip.matchAll(/font-size:(\d+(?:\.\d+)?)px/g)) assert.ok(Number(m[1]) >= 12, `yazı ≥ 12 px: ${m[0]}`);
  // Bilgi kartı şeride binmez: kendi kutusunda kayar; dar pencerede sekmeler sağ düğmelerin altına girmez.
  assert.match(css, /\.lb3\.sc \.j2-info\{max-height:100%;overflow-y:auto/);
  assert.match(css, /@media \(min-width:761px\) and \(max-width:1279\.98px\)\{\s*#pvp-root \.lb3\.sc \.sc-top\{padding-right:calc\(var\(--sc-pad\) \+ 262px\)\}/);
  // Eski küçültme/osman boşluğu kaldırıldı (madalyonlar 40 px'e inmiyor).
  assert.doesNotMatch(css, /--sc-med:clamp\(40px,3vw,62px\)/);
});

test('Şerit JS: tekerlek şeridi yatay kaydırır; seçili madalyon görünür alana getirilir', () => {
  const net = read('pvp/network.js');
  assert.match(net, /closest\?\.\('\[data-fighter-group="lobby"\]'\);\s*if\(dock&&dock\.scrollWidth>dock\.clientWidth/);
  assert.match(net, /dock\.dataset\.shownSel!==shownFighter/);
});
