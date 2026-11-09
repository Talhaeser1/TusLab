// Ortak üst yazma paneli ve %80 yakınlaştırma okunaklılığı (Ajan 4a).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');

test('typing panel: one shared box above the duel, wired to the existing input handler',()=>{
  const js=read('pvp/index.js');
  const top=js.indexOf('data-typetop'),duel=js.indexOf('<div class="pvp2-duel"');
  assert.ok(top>0&&top<duel,'panel arenadan önce (üstte)');
  assert.equal((js.match(/data-tt-input/g)||[]).length>=1,true);
  assert.match(js,/data-input="fire" data-tt-input/);
  assert.match(js,/typeTopRender\(id,/);
  assert.match(js,/aria-live="polite"/);
});
test('typing panel: readable sizes (target ≥20px, input ≥44px) and old per-side boxes hidden',()=>{
  const css=read('pvp/typing-top.css');
  assert.match(css,/\.tt-target\{[^}]*font:\d00 clamp\((?:2[4-9]|[3-9]\d)px/);
  assert.match(css,/\.tt-input\{[^}]*min-height:(?:4[4-9]|[5-9]\d)px/);
  assert.match(css,/\.pvp2-side \.pvp2-typebox\{display:none\}/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  for(const m of css.matchAll(/font-size:(\d+(?:\.\d+)?)px/g))assert.ok(Number(m[1])>=12,`12px altı metin: ${m[0]}`);
  const arena=read('pvp/arena-ui.css');
  for(const m of arena.matchAll(/font(?:-size)?:[^;}]*?(\d+(?:\.\d+)?)px/g))assert.ok(Number(m[1])>=12,`12px altı metin: ${m[0]}`);
});
test('toolbar: settings grouped in a popover with an icon button; surrender only during a match',()=>{
  const js=read('pvp/index.js');
  assert.match(js,/<details class="pvp4-settings" data-pvp-settings><summary class="pvp4-icon-btn" aria-label="Ayarları aç/);
  for(const action of ['music','sound','effects','arena3d'])assert.ok(js.lastIndexOf(`data-pvp-action="${action}"`)>js.indexOf('data-pvp-settings'),action);
  assert.match(js,/data-pvp15-action="surrender" hidden/);
  assert.match(js,/settings\.open=false/,'Esc önce ayarları kapatır');
});
