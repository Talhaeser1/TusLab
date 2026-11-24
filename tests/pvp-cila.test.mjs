// Cilacı (docs/22): PvP kutu cilası — kural özeti maddeleri, kutu ailesi değişkenleri, kullanılmayan CSS.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {ruleHintHTML,roundStylePickerHTML,DAMAGE_RULE_HINT,STREAK_TICKS} from '../pvp/rounds-ui.js';

const read=p=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');

test('kural özeti: tam cümle title içinde, seri merdiveni Q3 W5 E7 R10, maddeler aynı sayıları taşır',()=>{
  const html=ruleHintHTML();
  assert.match(html,/data-damage-rules/);
  assert.ok(html.includes(`title="7 raund · 6.000 can (raundlar arası taşınır) · ${DAMAGE_RULE_HINT}"`));
  for(const t of STREAK_TICKS)assert.ok(html.includes(`<kbd>${t.key}</kbd><span>${t.at}</span>`),t.key);
  const items=[...html.matchAll(/<li>(?!<kbd>)(.*?)<\/li>/g)].map(m=>m[1].replace(/<[^>]+>/g,''));
  assert.equal(items.length,7);
  const all=items.join(' | ');
  for(const s of ['7 raund','6.000 can','kalkan 330','can 300','×2','13. ve her 8. doğru','yarıya','500 kalkan/can'])assert.ok(all.includes(s),s);
  assert.doesNotMatch(html,/[<]small class="rui-rule-hint"/);
});

test('raund biçimi seçicisi kural özetini içerir (lobi ve oda)',()=>{
  for(const s of ['practice','room']){
    const h=roundStylePickerHTML(s);
    assert.ok(h.includes(ruleHintHTML()));
    assert.ok(h.includes(DAMAGE_RULE_HINT));
  }
});

test('kutu ailesi: tek ölçek, bulanıklık ve sonsuz animasyon yok, sonuç düğmesinde içe odak halkası',()=>{
  const css=read('pvp/compact-height.css');
  const i=css.indexOf('CİLACI (docs/22');
  assert.ok(i>0,'Cilacı bölümü var');
  const block=css.slice(i);
  for(const v of ['--cl-r-lg:18px','--cl-r:12px','--cl-r-sm:10px','--cl-gold-soft','--cl-focus:#7fd7ff'])assert.ok(block.includes(v),v);
  assert.doesNotMatch(block,/backdrop-filter|infinite|will-change/);
  assert.match(block,/\.pvp15-buttons button:focus-visible\{box-shadow:inset 0 0 0 3px #7fd7ff/);
  assert.match(block,/\.j2-info\{align-content:safe center\}/);
  // yazı ≥ 12 px
  for(const m of block.matchAll(/font-size:(\d+)px/g))assert.ok(Number(m[1])>=12,m[0]);
  for(const m of block.matchAll(/font:\d+ (\d+)px/g))assert.ok(Number(m[1])>=12,m[0]);
});

test('kullanılmayan page-*.css dosyaları pvp/ dışında, index.html onlara bağlanmıyor',()=>{
  const html=read('index.html');
  for(const f of ['page-adventures','page-boss','page-command','page-lobby','page-social','page-topnav']){
    assert.equal(existsSync(new URL(`../pvp/${f}.css`,import.meta.url)),false,f);
    assert.ok(!html.includes(`${f}.css`),f);
  }
});
