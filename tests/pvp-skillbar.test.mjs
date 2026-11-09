import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SKILL_THRESHOLDS,SKILL_INFO,skillCardHTML,readSkillState,skillMeter,skillStatusText} from '../pvp/skillbar.js';

const css=readFileSync(new URL('../pvp/skillbar.css',import.meta.url),'utf8');
const indexJs=readFileSync(new URL('../pvp/index.js',import.meta.url),'utf8');

test('eşikler: klasik 2/4/5, tur modu 3/5/7, S eşiksiz',()=>{
  assert.deepEqual(SKILL_THRESHOLDS.classic,{Q:2,E:4,S:0,R:5});
  assert.deepEqual(SKILL_THRESHOLDS.rounds,{Q:3,E:5,S:0,R:7});
});

test('her iki karakter için dört yetenek adı ve kısa etkisi var',()=>{
  assert.equal(SKILL_INFO.fire.Q.name,'Alev Kesişi');
  assert.equal(SKILL_INFO.fire.E.name,'Yer Yaran Darbe');
  assert.equal(SKILL_INFO.fire.R.name,'Kızıl Fırtına');
  assert.equal(SKILL_INFO.rune.S.name,'Mavi Mühür');
  for(const kind of ['fire','rune'])for(const key of ['Q','E','S','R']){
    assert.ok(SKILL_INFO[kind][key].effect.length>3,`${kind} ${key} etkisi`);
    assert.match(SKILL_INFO[kind][key].icon,/^<svg[^>]*aria-hidden="true"/,`${kind} ${key} ikonu`);
  }
});

test('kart: tuş rozeti, ikon, ad, etki, segmentli ölçer; ilk <small> durum satırıdır',()=>{
  const html=skillCardHTML('fire','Q','Alev Kesişi',2);
  assert.match(html,/data-skill="Q"/);
  assert.match(html,/data-demo-action="q"/);
  assert.match(html,/class="pvp2-skill-key[^"]*"[^>]*>Q</);
  assert.match(html,/<svg/);
  assert.match(html,/Alev Kesişi/);
  assert.match(html,/Hızlı/);
  assert.match(html,/--sk-seg:2/);
  assert.match(html,/data-sk-state="charging"/);
  assert.ok(html.indexOf('<small')<html.indexOf('sk-fx'),'network.js ilk small içine durum yazar');
  assert.ok(!/\stitle=/.test(html),'title tooltip değildir');
  assert.match(html,/aria-label="Q Alev Kesişi[^"]*2 doğru kelime/);
});

test('S kartı tek parçalı ölçer ve savunma metniyle çizilir',()=>{
  const html=skillCardHTML('rune','S','Mavi Mühür',0);
  assert.match(html,/--sk-seg:1/);
  assert.match(html,/data-sk-state="ready"/);
});

test('klasik canlı durum: enerji skillCharge, bekleme cooldownUntil',()=>{
  const player={skillCharge:{q:1,e:1,r:1},cooldownUntil:{q:0,e:5000,s:0,r:0},shieldUntil:null,combatStats:{casts:{q:2,e:1,r:0}}};
  const q=readSkillState(player,'Q',{rounds:false,now:4000});
  assert.deepEqual({energy:q.energy,threshold:q.threshold,cooldownMs:q.cooldownMs,casts:q.casts},{energy:1,threshold:2,cooldownMs:0,casts:2});
  const e=readSkillState(player,'E',{rounds:false,now:4000});
  assert.equal(e.cooldownMs,1000);
  assert.equal(skillMeter(e).state,'cooldown');
  assert.equal(skillMeter(q).state,'charging');
  assert.equal(skillMeter(q).fill,0.5);
});

test('tur modu: enerji seri (streak) ile, eşik 7 R için',()=>{
  const player={streak:9,combo:9,skillCharge:{},cooldownUntil:{},combatStats:{casts:{}}};
  const r=readSkillState(player,'R',{rounds:true,now:0});
  assert.equal(r.threshold,7);assert.equal(r.energy,7);
  assert.deepEqual(skillMeter(r),{state:'ready',fill:1});
});

test('S: kalkan aktif / bekleme / hazır',()=>{
  const base={skillCharge:{},combatStats:{}};
  assert.equal(skillMeter(readSkillState({...base,cooldownUntil:{s:0},shieldUntil:900},'S',{now:500})).state,'active');
  assert.equal(skillMeter(readSkillState({...base,cooldownUntil:{s:2000},shieldUntil:100},'S',{now:500})).state,'cooldown');
  assert.equal(skillMeter(readSkillState({...base,cooldownUntil:{s:0},shieldUntil:null},'S',{now:500})).state,'ready');
});

test('durum metni pasif olduğunu söyler',()=>{
  assert.equal(skillStatusText({key:'Q',energy:1,threshold:2,cooldownMs:0,shieldActive:false}),'1/2 kelime');
  assert.equal(skillStatusText({key:'Q',energy:2,threshold:2,cooldownMs:0,shieldActive:false}),'Hazır');
  assert.equal(skillStatusText({key:'E',energy:4,threshold:4,cooldownMs:1200,shieldActive:false}),'Bekle 2 sn');
});

test('index.js yetenek kartlarını skillbar.js üzerinden üretir ve canlı durumu uygular',()=>{
  assert.match(indexJs,/from '\.\/skillbar\.js'/);
  assert.match(indexJs,/function ability\([^)]*\)\s*\{\s*return skillCardHTML\(/);
  assert.match(indexJs,/applySkillRow\(/);
  assert.match(indexJs,/addEventListener\('tuslab:pvp-match',skillRowSync\)/);
});

test('CSS: sonsuz animasyon yok, yalnız transform/opacity geçişi, 12px altı yazı yok',()=>{
  assert.ok(!/infinite/.test(css));
  for(const m of css.matchAll(/transition:([^;}]+)/g))
    for(const part of m[1].split(/,(?![^(]*\))/))assert.match(part.trim(),/^(transform|opacity|none)/,part);
  for(const m of css.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g))assert.ok(Number(m[1])>=12,m[0]);
  assert.match(css,/prefers-reduced-motion:\s*reduce/);
  assert.match(css,/\.pvp4-reduced/);
  assert.ok(!/backdrop-filter|filter:\s*blur/.test(css));
});
