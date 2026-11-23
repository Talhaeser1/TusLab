// docs/14-pvp-denetim.md — Denetçi turunda bulunan ve düzeltilen PvP hatalarının bekçi testleri.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {ARENA_SNAP_DIST, MAX_FWD_STEP} from '../pvp/arena3d.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = f => readFileSync(resolve(ROOT, f), 'utf8');

test('Teslim ol / maçtan çık: window.confirm yok, oyun içi onay kutusu var (gömülü tarayıcıda confirm sessizce false döner)', () => {
  const main = read('pvp/pvp-main.js');
  assert.doesNotMatch(main, /window\.confirm\(/);
  assert.match(main, /import \{askConfirm,confirmHandleKey\} from '\.\/confirm-dialog\.js'/);
  assert.match(main, /askConfirm\(root,\{title:'Teslim ol\?'[^}]*\}\)\s*\.then\(ok=>\{\s*if\(ok&&\['running','paused'\]\.includes\(network\.match\?\.status\)\)\{network\.send\('SURRENDER',\{\}\);return;\}/);
  const dlg = read('pvp/confirm-dialog.js');
  assert.match(dlg, /createElement\('dialog'\)/);
  assert.match(dlg, /showModal\(\)/);
  assert.match(dlg, /\.pvp-confirm-no'\)\?\.focus/, 'varsayılan odak Vazgeç: Enter ile yanlışlıkla teslim olunmaz');
  assert.match(read('pvp/phase15-results.css'), /#pvp-root dialog\.pvp-confirm\{/);
});

test('Raund madalyonu: karartma penceresi araç çubuğu kaydırmasını hesaba katar; telefon yatayda çubuğun altında', () => {
  const css = read('pvp/rounds-ui.css');
  assert.match(css, /at 50% calc\(var\(--rs-cy\) - var\(--fs-toolbar,40px\)\)/);
  assert.match(css, /@media \(max-height:500px\)\{[^]*?--rs:\.62;top:42px/);
});

test('Telefon: kalkan rozeti adı dikey kırmaz (üst satır sarar); telefon yatayda panel altta, raylar ekranda', () => {
  const css = read('pvp/fight-hud.css');
  assert.match(css, /#pvp-root \.fhud2 \.fhud2-top\{flex-wrap:wrap;row-gap:0\}/);
  const land = css.slice(css.indexOf('@media (orientation:landscape) and (max-height:500px) and (min-width:600px){'));
  assert.match(land, /\.pvp2-shell>\.tt\{--yf-k:\.3;[^}]*bottom:4px/);
  assert.match(land, /\.fhud2 \.fhud2-rail\{bottom:4px;transform:scale\(\.55\)/);
  assert.match(land, /\.fhud2-rail :is\(\.fhud2-skname,\.fhud2-sksub,\.fhud2-key,\.fhud2-tag\)\{display:none\}/, 'ölçekli rayda 12 px altı yazı yok');
  assert.match(land, /--fs-bottom:24px/);
});

test('3B: bozuk ilk konum (sahne dışı) hızla yürümez, anında oturur; derleme yoklaması atılmış malzemede çökmez', () => {
  assert.ok(ARENA_SNAP_DIST > MAX_FWD_STEP * 60, 'eşik olağan saniyelik yürüyüşün üstünde');
  assert.ok(ARENA_SNAP_DIST >= 10 && ARENA_SNAP_DIST <= 30);
  const src = read('pvp/arena3d.js');
  assert.match(src, /Math\.abs\(wantX - fighter\.shown\.x\) > ARENA_SNAP_DIST/);
  assert.match(src, /const compilation = safeCompileAsync\(\);/);
  assert.match(src, /renderer\.properties\?\.get\(material\)\?\.currentProgram\?\.isReady\?\.\(\) !== false/);
  assert.doesNotMatch(src, /renderer\.compileAsync\(scene, camera\)/);
});

test('Lobi: alçak pencerede arena satırı ezilmez; dar pencerede seçili mod sekmesi görünür alana kayar; boyutlanınca şerit ortalanır', () => {
  const css = read('pvp/lobby-v3.css');
  assert.match(css, /@media \(min-width:761px\) and \(max-height:620px\)\{\s*#pvp-root \.lb3\.sc \.sc-stage\{grid-template-rows:auto minmax\(0,1fr\) auto\}/);
  assert.match(css, /@media \(max-width:440px\)\{[^}]*--sc-fade:10px/);
  assert.match(read('pvp/arena-ui.js'), /if\(pressed==='true'\)revealInSeg\(b\);/);
  assert.match(read('pvp/network.js'), /addEventListener\?\.\('resize',/);
});
