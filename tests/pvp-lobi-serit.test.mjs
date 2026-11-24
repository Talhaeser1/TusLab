// Rapor 8 — PvP lobisi dövüşçü seçim şeridi: kısa adlar, seçili altın halka, yatay kayma + kenar solması,
// dar pencerede bilgi kartının şeride binmemesi. Padişahlar kaldırıldı (docs/14-pvp-denetim.md): şerit 5 dövüşçü, tek grup.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {fighterDockHTML, fighterInfoHTML} from '../pvp/network.js';
import {FIGHTER_IDS, PADISAH_IDS, BASE_FIGHTER_IDS, FIGHTERS, fighterBody, fighterQuote} from '../pvp/shared/fighters.js';
import {DOCK_NAMES, dockName, dockMedallionUrl, PORTRAITS} from '../pvp/portraits.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = f => readFileSync(resolve(ROOT, f), 'utf8');

test('Şerit: 5 dövüşçü tek grupta, padişah grubu/başlığı yok, sıra korunur', () => {
  assert.deepEqual([...FIGHTER_IDS], ['vargr', 'sira', 'doran', 'nyx', 'konyali']);
  assert.deepEqual([...BASE_FIGHTER_IDS], [...FIGHTER_IDS]);
  assert.deepEqual([...PADISAH_IDS], []);
  const dock = fighterDockHTML('nyx');
  const ids = [...dock.matchAll(/data-fighter="(\w+)" data-side/g)].map(m => m[1]);
  assert.deepEqual(ids, [...FIGHTER_IDS]);
  assert.doesNotMatch(dock, /data-dock-group="padisah"|Padişahlar/);
  assert.equal((dock.match(/role="radiogroup"/g) || []).length, 1);
  assert.equal((dock.match(/aria-checked="true"/g) || []).length, 1);
  assert.match(dock, /aria-checked="true" tabindex="0" class="lb3-fighter rune" data-lobby-action="fighter" data-fighter="nyx"/);
});

test('Şerit: madalyon altında ad, tam ad aria-label içinde; bilgi kartında padişah satırı/söz yok', () => {
  assert.deepEqual(Object.keys(DOCK_NAMES), []);
  const dock = fighterDockHTML();
  for (const id of FIGHTER_IDS) {
    assert.equal(dockName(id), FIGHTERS[id].name);
    const btn = dock.match(new RegExp(`<button[^>]*data-fighter="${id}"[^>]*>[\\s\\S]*?</button>`))[0];
    assert.match(btn, new RegExp(`<b class="lb3-f-name" aria-hidden="true">${dockName(id)}</b>`), `${id} kısa ad`);
    assert.ok(btn.includes(`aria-label="${FIGHTERS[id].name} · `), `${id} tam ad aria-label`);
    const info = fighterInfoHTML(id);
    assert.doesNotMatch(info, /padişah|j2-reign|j2-soz/, `${id} bilgi kartı`);
    assert.equal(fighterBody(id), id);
    assert.equal(fighterQuote(id, 'soz'), '');
    assert.equal(dockMedallionUrl(id), null);
  }
});

test('Padişah kalıntısı yok: portre eşlemesi, CSS kuralları ve taşınan dosyalar', () => {
  assert.deepEqual(Object.keys(PORTRAITS).sort(), [...FIGHTER_IDS].sort());
  const css = read('pvp/lobby-v3.css');
  assert.doesNotMatch(css, /assets\/padisah\//);
  assert.ok(!existsSync(resolve(ROOT, 'pvp/shared/padisahlar.js')), 'padisahlar.js _to_delete altına taşındı');
  // _to_delete/ depoya girmez (.gitignore): temiz kopyada klasör yoktur, o zaman bu denetim atlanır.
  if (existsSync(resolve(ROOT, '_to_delete'))) assert.ok(existsSync(resolve(ROOT, '_to_delete/padisah-pvp/pvp/shared/padisahlar.js')));
  assert.doesNotMatch(read('pvp/shared/fighters.js'), /padisahlar\.js/);
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
