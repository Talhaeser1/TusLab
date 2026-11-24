import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SKILL_THRESHOLDS,SKILL_INFO,skillCardHTML,readSkillState,skillMeter,skillStatusText,skillCharge,skillRowNote} from '../pvp/skillbar.js';

const css=readFileSync(new URL('../pvp/skillbar.css',import.meta.url),'utf8');
const indexJs=readFileSync(new URL('../pvp/pvp-main.js',import.meta.url),'utf8');

test('eşikler: klasik 2/4/5, tur modu 3/5/7/10, S eşiksiz',()=>{
  // KESINYAP 21 (dört yetenek, ulti yalnız 10 seride): klasik kural aynı (W = eski E kartı, 4); rounds Q3 W5 E7 R10.
  assert.deepEqual(SKILL_THRESHOLDS.classic,{Q:2,W:4,E:4,S:0,R:5});
  assert.deepEqual(SKILL_THRESHOLDS.rounds,{Q:3,W:5,E:7,S:0,R:10});
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

test('S kartı tek parçalı ölçerle çizilir; maç yokken "Hazır" DEĞİL (idle, boş ölçer)',()=>{
  const html=skillCardHTML('rune','S','Mavi Mühür',0);
  assert.match(html,/--sk-seg:1/);
  assert.match(html,/data-sk-state="idle"/);assert.match(html,/--sk-fill:0;/);assert.doesNotMatch(html,/Hazır/i);
  assert.match(html,/Maçta açılır/);
});

test('klasik canlı durum: enerji skillCharge, bekleme cooldownUntil',()=>{
  const player={combo:1,skillCharge:{q:1,e:1,r:1},cooldownUntil:{q:0,e:5000,s:0,r:0},shieldUntil:null,combatStats:{casts:{q:2,e:1,r:0}}};
  const q=readSkillState(player,'Q',{rounds:false,now:4000});
  assert.deepEqual({energy:q.energy,threshold:q.threshold,cooldownMs:q.cooldownMs,casts:q.casts},{energy:1,threshold:2,cooldownMs:0,casts:2});
  const e=readSkillState(player,'E',{rounds:false,now:4000});
  assert.equal(e.cooldownMs,1000);
  assert.equal(skillMeter(e).state,'cooldown');
  assert.equal(skillMeter(q).state,'charging');
  assert.equal(skillMeter(q).fill,0.5);
});

test('tur modu: enerji seri (streak) ile, eşik 10 R, 7 E (can) için',()=>{
  // KESINYAP 21: R eşiği 7 → 10; E kartı rounds'ta can (motor 'h') sayar, W kartı motor 'e'.
  const player={streak:9,combo:9,skillCharge:{},cooldownUntil:{},combatStats:{casts:{h:2,e:1}}};
  const r=readSkillState(player,'R',{rounds:true,now:0});
  assert.equal(r.threshold,10);assert.equal(r.energy,9);
  assert.deepEqual(skillMeter(r),{state:'charging',fill:0.9});
  const e=readSkillState(player,'E',{rounds:true,now:0});assert.equal(e.threshold,7);assert.equal(e.casts,2);
  const w=readSkillState(player,'W',{rounds:true,now:0});assert.equal(w.threshold,5);assert.equal(w.casts,1);
});

test('S: kalkan aktif / bekleme / hazır',()=>{
  const base={skillCharge:{},combatStats:{}};
  assert.equal(skillMeter(readSkillState({...base,cooldownUntil:{s:0},shieldUntil:900},'S',{now:500})).state,'active');
  assert.equal(skillMeter(readSkillState({...base,cooldownUntil:{s:2000},shieldUntil:100},'S',{now:500})).state,'cooldown');
  assert.equal(skillMeter(readSkillState({...base,cooldownUntil:{s:0},shieldUntil:null},'S',{now:500})).state,'ready');
});

test('durum metni pasif olduğunu söyler',()=>{
  assert.equal(skillStatusText({key:'Q',energy:1,threshold:2,cooldownMs:0,shieldActive:false}),'1/2 kelime');
  // RAPOR-BECERI-SATIRI: eşikte beceri kendiliğinden atılır → "HAZIR"/"Kullanıldı" yerine yanık "ATILDI ✓".
  assert.equal(skillStatusText({key:'Q',energy:2,threshold:2,cooldownMs:0,shieldActive:false}),'ATILDI ✓');
  assert.equal(skillStatusText({key:'Q',energy:0,threshold:2,cooldownMs:0,shieldActive:false,used:true}),'ATILDI ✓');
  assert.equal(skillStatusText({key:'Q',energy:1,threshold:3,cooldownMs:0,shieldActive:false},{compact:true}),'1/3');
  assert.equal(skillStatusText({key:'S',energy:0,threshold:0,cooldownMs:0,shieldActive:false,idle:true}),'Maçta açılır');
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

// RAPOR-PVP-MEKANIK §1.1 — kart doğru kelimeyle n/N dolar, tam eşikte HAZIR (o kelimede atılır), sonra "kullanıldı";
// yeni çevrimde / seri düşüp eşik yeniden geçilince yeniden dolar. Önceden: Q eşikten sonra hep "Hazır" kalıyordu,
// klasikte R hiç 5/5 göstermiyordu (combo%5 → 0), S maç yokken dolu "Hazır" çiziliyordu.
test('skillCharge klasik: Q 0 → 1/2 → 2/2 ATILDI (çevrim sonuna dek yanık) → yeni çevrimde 1/2; R 5. kelimede ATILDI',()=>{
  const st=(key,combo)=>{const c=skillCharge(key,combo);return skillMeter({key,...c,cooldownMs:0}).state+':'+c.energy+'/'+c.threshold;};
  assert.deepEqual([0,1,2,3,4,5,6,7].map(n=>st('Q',n)),['charging:0/2','charging:1/2','cast:2/2','cast:0/2','cast:0/2','cast:0/2','charging:1/2','cast:2/2']);
  assert.deepEqual([3,4,5,6].map(n=>st('E',n)),['charging:3/4','cast:4/4','cast:0/4','charging:1/4']);
  assert.deepEqual([4,5,6,10].map(n=>st('R',n)),['charging:4/5','cast:5/5','charging:1/5','cast:5/5']);
  // atılmış kart dolu halka gösterir (sönük/boş değil)
  assert.equal(skillMeter({key:'Q',...skillCharge('Q',4),cooldownMs:0}).fill,1);
});
test('skillCharge rounds: 3 Q · 5 W · 7 E · 10 R; eşikte ATILDI ve seri düşene dek yanık; 10 sonrası Q zinciri 1/3 → 2/3 → ATILDI (13), sonra 1/8 … (21)',()=>{
  const st=(key,s)=>{const c=skillCharge(key,s,{rounds:true});return skillMeter({key,...c,cooldownMs:0}).state+':'+c.energy+'/'+c.threshold;};
  assert.deepEqual([2,3,4,10,11,12,13,14,20,21,22].map(s=>st('Q',s)),['charging:2/3','cast:3/3','cast:0/3','cast:0/3','charging:1/3','charging:2/3','cast:3/3','charging:1/8','charging:7/8','cast:8/8','charging:1/8']);
  assert.deepEqual([6,7,8].map(s=>st('E',s)),['charging:6/7','cast:7/7','cast:0/7']);
  assert.deepEqual([9,10,11].map(s=>st('R',s)),['charging:9/10','cast:10/10','cast:0/10']);
  // Yanlış kelime seriyi yarıya indirir (8 → 4): W (5) yeniden dolar, Q atılmış kalır (3'ün altına inmedi).
  assert.equal(st('W',4),'charging:4/5');assert.equal(st('Q',4),'cast:0/3');
  // 10'dan sonra Q kartı zincir sayacıdır
  assert.equal(skillCharge('Q',12,{rounds:true}).chain,true);assert.equal(skillCharge('Q',9,{rounds:true}).chain,undefined);
});
test('readSkillState: rounds S kartı "Yalnız klasik" (off), canlı klasik S hazır kalır; motor sırası gerçek maçla aynı',async()=>{
  const {createMatch,submitWord}=await import('../pvp/shared/match.js');
  const S=readSkillState({cooldownUntil:{s:0},shieldUntil:null},'S',{rounds:true,now:0});
  assert.equal(skillMeter(S).state,'off');assert.equal(skillStatusText(S),'Yalnız klasik');
  // Gerçek motor: Q kartı rounds'ta her kelimede ilerler ve Q'nun atıldığı kelimede HAZIR olur.
  let m=createMatch([{playerId:'a',seat:1,character:'fire'},{playerId:'b',seat:2,character:'rune'}],1000,'sk',{rounds:7,roundStyle:'timed',seed:'sk',resolveAtEnd:true});
  const seen=[];
  for(let i=1;i<=4;i++){
    const p=m.participants[0];const out=submitWord(m,{playerId:'a',matchId:m.id,wordIndex:p.wordIndex,text:m.round.words[p.roundWordIndex],round:1},1000+i*300);m=out.match;
    const view=m.participants[0];const q=readSkillState({streak:view.combo,combatStats:view.combatStats,cooldownUntil:view.cooldownUntil},'Q',{rounds:true,now:0});
    seen.push(skillMeter(q).state+':'+q.energy);
  }
  assert.deepEqual(seen,['charging:1','charging:2','cast:3','cast:0']);
});

// RAPOR-BECERI-SATIRI — seri → dört kart (her kart kendi eşiğine; HAZIR hiç yok)
test('seri → kartlar tablosu (rounds, kompakt alt yazı)',()=>{
  const row=s=>['Q','W','E','R'].map(k=>k+' '+skillStatusText(readSkillState({streak:s,fighter:'sira'},k,{rounds:true,now:0}),{compact:true})).join(' · ');
  assert.equal(row(0),'Q 0/3 · W 0/5 · E 0/7 · R 0/10');
  assert.equal(row(2),'Q 2/3 · W 2/5 · E 2/7 · R 2/10');
  assert.equal(row(4),'Q ATILDI ✓ · W 4/5 · E 4/7 · R 4/10');
  assert.equal(row(7),'Q ATILDI ✓ · W ATILDI ✓ · E ATILDI ✓ · R 7/10');
  assert.equal(row(11),'Q 1/3 · W ATILDI ✓ · E ATILDI ✓ · R ATILDI ✓');
  assert.equal(row(13),'Q ATILDI ✓ · W ATILDI ✓ · E ATILDI ✓ · R ATILDI ✓');
  for(const s of [0,2,3,5,7,10,13,21])assert.doesNotMatch(row(s),/HAZIR|ullanıldı/);
});
test('E savunma: can doluyken BEKLİYOR, uygulanınca +N can; kalkan KALKAN N',()=>{
  const e=extra=>readSkillState({streak:8,fighter:'vargr',...extra},'E',{rounds:true,now:0});
  assert.equal(skillMeter(e({healBank:300})).state,'pending');assert.equal(skillStatusText(e({healBank:300})),'BEKLİYOR');
  assert.equal(skillMeter(e({healBank:0,roundHeal:300})).state,'cast');assert.equal(skillStatusText(e({roundHeal:300})),'+300 can');
  assert.equal(skillStatusText(e({roundHeal:0})),'ATILDI ✓','sınır dolduysa yalnız atıldı');
  const sh=readSkillState({streak:7,fighter:'sira',shieldHp:330,roundHeal:330},'E',{rounds:true,now:0});
  assert.equal(sh.defense,'shield');assert.equal(skillStatusText(sh),'KALKAN 330');
  // eşik altında bekleyen can yok sayılır (önceki atım yarıya inen seride)
  assert.equal(skillMeter(readSkillState({streak:3,fighter:'vargr',healBank:300},'E',{rounds:true,now:0})).state,'charging');
});
test('yardım satırı doğru eşikleri ve yarıya inmeyi söyler',()=>{
  assert.equal(skillRowNote(7,{rounds:true}),"Seri 7 · seri 3 / 5 / 7 / 10'da kendiliğinden atılır · yanlış kelime seriyi yarıya indirir");
  assert.match(skillRowNote(2,{rounds:false}),/^Seri 2 · 2 \/ 4 \/ 5 doğru kelimede/);
  assert.match(skillRowNote(8,{rounds:true,pending:300}),/E bekliyor: ilk yediğin darbeden sonra \+300 can/);
});
test('kalkan hasarı emip bittiyse KIRILDI (sönük değil, durum söylenir)',()=>{
  const sh=readSkillState({streak:9,fighter:'doran',shieldHp:0,roundHeal:330},'E',{rounds:true,now:0});
  assert.equal(skillStatusText(sh),'KIRILDI');assert.equal(skillMeter(sh).state,'cast');
});
