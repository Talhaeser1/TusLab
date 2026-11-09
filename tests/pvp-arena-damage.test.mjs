import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ARENA_WRONG_FACTORS,ARENA_PENALTY_CAP,ARENA_ROUND_BASE_DAMAGE,ARENA_COMBO_RULES,
  ARENA_ITEMS,ARENA_ITEM_IDS,wrongPenalty,comboMultiplier,wordDamage,
  defenderReduction,resolveRoundAttacks
} from '../pvp/shared/arena-damage.js';
import {validateItemId} from '../pvp/shared/arena-skills.js';

// Spec §2 raund kelime sayıları — hasar tabloları bunlara göre üretilir.
const ROUND_WORDS=[5,10,15,15,15,20];

// Belirli doğruluk desenleri (deterministik, tekrarlayan 5'li bloklar):
// %80 → 4 doğru 1 yanlış, %60 → 3 doğru 2 yanlış.
const pattern=(n,pat)=>Array.from({length:n},(_,i)=>({index:i,correct:pat[i%pat.length]!=='Y',at:1000+i*600}));
const P80='DDDDY',P60='DDDYY';
const total=attacks=>attacks.reduce((sum,x)=>sum+x.amount,0);

// Kusursuz raund toplamları (sözleşme §10: R1=650, R6≈2738) ve sabitlenmiş
// %80 / %60 tabloları — motor davranışı değişirse burada görünür.
const PERFECT_TOTALS=[650,1485,2120,2120,2120,2738];
const TOTALS_80=[450,801,1064,1064,1064,1331];
const TOTALS_60=[300,518,680,680,680,843];

test('spec §5 constants are pinned exactly',()=>{
  assert.deepEqual(ARENA_WRONG_FACTORS,[0.10,0.15,0.23,0.30]);
  assert.equal(ARENA_PENALTY_CAP,0.75);
  assert.deepEqual(ARENA_ROUND_BASE_DAMAGE,[100,90,80,80,80,75]);
  assert.equal(ARENA_COMBO_RULES.comboAt,4);
  assert.equal(ARENA_COMBO_RULES.finalAt,5);
  assert.deepEqual(ARENA_COMBO_RULES.combostone,{combo:1.75,final:2.4});
  assert.equal(ARENA_COMBO_RULES.combo,1.5);
  assert.equal(ARENA_COMBO_RULES.final,2.0);
});

test('item catalogue matches spec §5.4 and the arena-skills id mirror',()=>{
  assert.deepEqual(ARENA_ITEM_IDS,['combostone','cleanse','gauntlet','aegis']);
  for(const id of ARENA_ITEM_IDS){
    const item=ARENA_ITEMS[id];
    assert.equal(item.id,id);
    assert.ok(item.name&&item.icon&&item.effect);
    // arena-skills.js aynı kimlikleri tanıyor olmalı (çift tanım yok).
    assert.equal(validateItemId(id),true,id+' arena-skills.js tarafından geçersiz');
  }
  assert.deepEqual(ARENA_ITEMS.gauntlet.effect,{type:'baseBoost',baseMultiplier:1.1});
  assert.deepEqual(ARENA_ITEMS.combostone.effect,{type:'comboBoost',combo:1.75,final:2.4});
  assert.deepEqual(ARENA_ITEMS.cleanse.effect,{type:'cleanse'});
  assert.deepEqual(ARENA_ITEMS.aegis.effect,{type:'defend',reduction:0.20});
  assert.equal(validateItemId('mega-hammer'),false);
});

test('wrongPenalty is additive and capped at 0.75 (spec §5.2)',()=>{
  assert.equal(wrongPenalty(0),0);
  assert.equal(wrongPenalty(1),0.10);
  assert.equal(wrongPenalty(2),0.25);          // 0.10+0.15
  assert.equal(wrongPenalty(3),0.48);          // 0.10+0.15+0.23
  assert.equal(wrongPenalty(4),0.75);          // 0.78 → tavan
  assert.equal(wrongPenalty(5),0.75);
  assert.equal(wrongPenalty(12),0.75);
  // cleanse: o raund yanlış çarpanı hiç uygulanmaz.
  for(let n=0;n<=8;n++)assert.equal(wrongPenalty(n,'cleanse'),0);
  // bilinmeyen eşya "eşya yok" gibi davranır.
  assert.equal(wrongPenalty(3,'mega-hammer'),0.48);
  assert.equal(wrongPenalty(3,null),0.48);
});

test('wrongPenalty survives invalid input without NaN',()=>{
  for(const bad of [-1,-7,NaN,Infinity,'3',null,undefined,2.9]){
    const p=wrongPenalty(bad);
    assert.ok(Number.isFinite(p)&&p>=0&&p<=0.75,`wrongPenalty(${bad}) → ${p}`);
  }
  assert.equal(wrongPenalty(-3),0);
  assert.equal(wrongPenalty(NaN),0);
  assert.equal(wrongPenalty(2.9),0.25);        // kesirli → 2 yanlış
});

test('comboMultiplier follows §5.3 thresholds incl. combostone',()=>{
  assert.equal(comboMultiplier(1),1.0);
  assert.equal(comboMultiplier(2),1.0);
  assert.equal(comboMultiplier(3),1.0);
  assert.equal(comboMultiplier(4),1.5);
  assert.equal(comboMultiplier(5),2.0);
  assert.equal(comboMultiplier(6),2.0);
  assert.equal(comboMultiplier(20),2.0);       // sayaç 4'te taşmaz, FİNAL sürer
  assert.equal(comboMultiplier(1,'combostone'),1.0);
  assert.equal(comboMultiplier(3,'combostone'),1.0);
  assert.equal(comboMultiplier(4,'combostone'),1.75);
  assert.equal(comboMultiplier(5,'combostone'),2.4);
  assert.equal(comboMultiplier(9,'combostone'),2.4);
  // güvenli davranış: 0 / negatif / NaN / kesirli → 1.0 (kesirli aşağı yuvarlanır)
  for(const bad of [0,-2,NaN,3.9])assert.equal(comboMultiplier(bad,'combostone'),1.0);
  assert.equal(comboMultiplier(4,'mega-hammer'),1.5);  // bilinmeyen eşya etkisiz
});

test('wordDamage basic hit: R1 first word deals full base damage',()=>{
  assert.deepEqual(wordDamage({roundIndex:0,streakBefore:0,consecutiveWrong:0}),
    {amount:100,multiplier:1,penalty:0,tags:[],base:100});
});

test('spec §5.2 contract example D Y Y Y D: word 5 hits ×0.52',()=>{
  // 1. kelime tam hasar (R1: 100)…
  const first=wordDamage({roundIndex:0,streakBefore:0,consecutiveWrong:0});
  assert.equal(first.amount,100);
  // …5. kelime ×(1 − 0.10 − 0.15 − 0.23) = ×0.52 → 52.
  const fifth=wordDamage({roundIndex:0,streakBefore:0,consecutiveWrong:3});
  assert.equal(fifth.penalty,0.48);
  assert.equal(fifth.multiplier,1);
  assert.equal(fifth.amount,52);
  assert.equal(fifth.base,100);
  assert.deepEqual(fifth.tags,[]);
  // HUD gösterimi: −%48.
  assert.equal(Math.round(fifth.penalty*100),48);
});

test('KOMBO at 4th and FİNAL at 5th+ consecutive correct (spec §5.3)',()=>{
  const combo=wordDamage({roundIndex:0,streakBefore:3,consecutiveWrong:0});
  assert.deepEqual(combo,{amount:150,multiplier:1.5,penalty:0,tags:['KOMBO'],base:100});
  const fin=wordDamage({roundIndex:0,streakBefore:4,consecutiveWrong:0});
  assert.deepEqual(fin,{amount:200,multiplier:2,penalty:0,tags:['FİNAL'],base:100});
  // 6. ve sonrası kelimelerde FİNAL ×2.0 devam eder.
  for(let before=5;before<=9;before++){
    const hit=wordDamage({roundIndex:0,streakBefore:before,consecutiveWrong:0});
    assert.equal(hit.multiplier,2.0);
    assert.deepEqual(hit.tags,['FİNAL']);
    assert.equal(hit.amount,200);
  }
});

test('combostone upgrades KOMBO ×1.75 and FİNAL ×2.4',()=>{
  assert.deepEqual(wordDamage({roundIndex:0,streakBefore:3,item:'combostone'}),
    {amount:175,multiplier:1.75,penalty:0,tags:['KOMBO'],base:100});
  assert.deepEqual(wordDamage({roundIndex:0,streakBefore:4,item:'combostone'}),
    {amount:240,multiplier:2.4,penalty:0,tags:['FİNAL'],base:100});
  // R6 tabanıyla: 75 × 1.75 = 131.25 → 131, 75 × 2.4 = 180.
  assert.equal(wordDamage({roundIndex:5,streakBefore:3,item:'combostone'}).amount,131);
  assert.equal(wordDamage({roundIndex:5,streakBefore:4,item:'combostone'}).amount,180);
});

test('cleanse zeroes the wrong penalty and tags the hit ARINMA',()=>{
  const hit=wordDamage({roundIndex:0,streakBefore:0,consecutiveWrong:3,item:'cleanse'});
  assert.equal(hit.penalty,0);
  assert.equal(hit.amount,100);                // ceza tamamen kalkar
  assert.deepEqual(hit.tags,['ARINMA']);
  // gerçekten silinecek ceza yoksa etiket de yok.
  const clean=wordDamage({roundIndex:0,streakBefore:0,consecutiveWrong:0,item:'cleanse'});
  assert.deepEqual(clean,{amount:100,multiplier:1,penalty:0,tags:[],base:100});
});

test('gauntlet raises base by +10% and tags AĞIR',()=>{
  assert.deepEqual(wordDamage({roundIndex:0,streakBefore:0,item:'gauntlet'}),
    {amount:110,multiplier:1,penalty:0,tags:['AĞIR'],base:110});
  // Tabanlar: 100→110, 90→99, 80→88, 75→83.
  assert.equal(wordDamage({roundIndex:1,streakBefore:0,item:'gauntlet'}).base,99);
  assert.equal(wordDamage({roundIndex:2,streakBefore:0,item:'gauntlet'}).base,88);
  assert.equal(wordDamage({roundIndex:5,streakBefore:0,item:'gauntlet'}).base,83);
  // Gauntlet + ceza aynı kelimede birleşir: 110 × 0.52 = 57.2 → 57.
  assert.equal(wordDamage({roundIndex:0,consecutiveWrong:3,item:'gauntlet'}).amount,57);
});

test('defenderReduction: only aegis shields (−20%)',()=>{
  assert.equal(defenderReduction('aegis'),0.20);
  assert.equal(defenderReduction(null),0);
  assert.equal(defenderReduction(undefined),0);
  assert.equal(defenderReduction('combostone'),0);
  assert.equal(defenderReduction('mega-hammer'),0);
});

test('wordDamage clamps invalid roundIndex and unknown items safely',()=>{
  assert.equal(wordDamage({roundIndex:-3}).base,100);        // negatif → R1
  assert.equal(wordDamage({roundIndex:99}).base,75);         // taşma → son raund
  assert.equal(wordDamage({roundIndex:NaN}).base,100);       // NaN → R1
  assert.equal(wordDamage({roundIndex:2.7}).base,80);        // kesirli → R3
  // bilinmeyen eşya = eşyasız vuruş.
  assert.deepEqual(wordDamage({roundIndex:0,item:'mega-hammer'}),
    {amount:100,multiplier:1,penalty:0,tags:[],base:100});
  // NaN sayaçlar hasarı boşaltmaz.
  const nanHit=wordDamage({roundIndex:0,streakBefore:NaN,consecutiveWrong:NaN});
  assert.deepEqual(nanHit,{amount:100,multiplier:1,penalty:0,tags:[],base:100});
});

test('wordDamage always returns an integer amount within bounds',()=>{
  const items=[null,'combostone','cleanse','gauntlet','aegis','mega-hammer'];
  for(let r=0;r<ARENA_ROUND_BASE_DAMAGE.length;r++)
    for(let streak=0;streak<=7;streak++)
      for(let wrong=0;wrong<=6;wrong++)
        for(const item of items){
          const hit=wordDamage({roundIndex:r,streakBefore:streak,consecutiveWrong:wrong,item});
          assert.ok(Number.isInteger(hit.amount),'amount tam sayı olmalı');
          assert.ok(hit.amount>0,'hasar pozitif olmalı (taban %25 garanti)');
          assert.ok(hit.multiplier>=1&&hit.multiplier<=2.4);
          assert.ok(hit.penalty>=0&&hit.penalty<=0.75);
        }
});

test('resolveRoundAttacks: D Y Y Y D produces exactly two hits (100 then 52)',()=>{
  const attacks=resolveRoundAttacks({roundIndex:0,attempts:[
    {index:0,correct:true,at:1},{index:1,correct:false,at:2},
    {index:2,correct:false,at:3},{index:3,correct:false,at:4},
    {index:4,correct:true,at:5}]});
  assert.equal(attacks.length,2);
  assert.deepEqual(attacks[0],{wordIndex:0,amount:100,multiplier:1,penalty:0,tags:[],base:100});
  assert.deepEqual(attacks[1],{wordIndex:4,amount:52,multiplier:1,penalty:0.48,tags:[],base:100});
});

test('resolveRoundAttacks: perfect R1 = 650 (100+100+100+150+200)',()=>{
  const attacks=resolveRoundAttacks({roundIndex:0,attempts:pattern(5,'D')});
  assert.deepEqual(attacks.map(a=>a.amount),[100,100,100,150,200]);
  assert.deepEqual(attacks.map(a=>a.tags),[[],[],[],['KOMBO'],['FİNAL']]);
  assert.equal(total(attacks),650);
});

test('resolveRoundAttacks: FİNAL continues on 6th+ words of a round',()=>{
  const attacks=resolveRoundAttacks({roundIndex:0,attempts:pattern(8,'D')});
  assert.deepEqual(attacks.map(a=>a.amount),[100,100,100,150,200,200,200,200]);
  assert.deepEqual(attacks.at(-1).tags,['FİNAL']);
});

test('resolveRoundAttacks: wrongs reset the streak, corrects reset the penalty counter',()=>{
  // D Y D → üçüncü kelime streak 1'den başlar (kombo sıfırlanır).
  const a=resolveRoundAttacks({roundIndex:0,attempts:pattern(3,'DYD')});
  assert.deepEqual(a.map(x=>x.amount),[100,90]);
  // D D Y D → dördüncü kelime 1 yanlış cezası alır (×0.9), kombo 2'dedir.
  const b=resolveRoundAttacks({roundIndex:0,attempts:pattern(4,'DDYD')});
  assert.deepEqual(b.map(x=>x.amount),[100,100,90]);
  // D Y D D D D → kombo YANLIŞTAN sonra yeniden 4'e ulaşır (150) ve ceza sıfırdır.
  const c=resolveRoundAttacks({roundIndex:0,attempts:pattern(6,'DYDDDD')});
  assert.deepEqual(c.map(x=>x.amount),[100,90,100,100,150]);
});

test('resolveRoundAttacks: penalty caps at 0.75 → hit keeps at least 25% base',()=>{
  // 5 yanlış üst üste, sonra bir doğru: ×(1 − 0.75) = ×0.25.
  const attacks=resolveRoundAttacks({roundIndex:0,attempts:pattern(6,'YYYYYD')});
  assert.equal(attacks.length,1);
  assert.equal(attacks[0].penalty,0.75);
  assert.equal(attacks[0].amount,25);
});

test('resolveRoundAttacks runs every item end-to-end',()=>{
  // combostone kusursuz R1: 100+100+100+175+240.
  assert.deepEqual(resolveRoundAttacks({roundIndex:0,attempts:pattern(5,'D'),item:'combostone'})
    .map(a=>a.amount),[100,100,100,175,240]);
  // gauntlet kusursuz R1: 110+110+110+165+220.
  assert.deepEqual(resolveRoundAttacks({roundIndex:0,attempts:pattern(5,'D'),item:'gauntlet'})
    .map(a=>a.amount),[110,110,110,165,220]);
  // cleanse D Y Y Y D: beşinci kelime cezasız 100 + ARINMA.
  const cleansed=resolveRoundAttacks({roundIndex:0,attempts:pattern(5,'DYYYD'),item:'cleanse'});
  assert.deepEqual(cleansed.map(a=>a.amount),[100,100]);
  assert.deepEqual(cleansed[1].tags,['ARINMA']);
  // aegis saldırganda bir şey değiştirmez (yalnız savunma eşyası).
  assert.deepEqual(resolveRoundAttacks({roundIndex:0,attempts:pattern(5,'D'),item:'aegis'})
    .map(a=>a.amount),[100,100,100,150,200]);
  // bilinmeyen eşya etkisiz.
  assert.equal(total(resolveRoundAttacks({roundIndex:0,attempts:pattern(5,'D'),item:'mega-hammer'})),650);
});

test('resolveRoundAttacks applies the defender aegis to amount only',()=>{
  const attempts=pattern(5,'DYYYD');
  const shielded=resolveRoundAttacks({roundIndex:0,attempts,defenderItem:'aegis'});
  assert.deepEqual(shielded.map(a=>a.amount),[80,42]);        // 100→80, 52→41.6→42
  // çarpan / ceza / etiket / taban saldırgana aittir, değişmez.
  assert.equal(shielded[1].multiplier,1);
  assert.equal(shielded[1].penalty,0.48);
  assert.deepEqual(shielded[1].tags,[]);
  assert.equal(shielded[1].base,100);
  // kusursuz R1'e karşı aegis: 80+80+80+120+160 = 520.
  assert.deepEqual(resolveRoundAttacks({roundIndex:0,attempts:pattern(5,'D'),defenderItem:'aegis'})
    .map(a=>a.amount),[80,80,80,120,160]);
  // saldırgan combostone + savunan aegis bir arada: 175→140, 240→192.
  assert.deepEqual(resolveRoundAttacks({roundIndex:0,attempts:pattern(5,'D'),item:'combostone',defenderItem:'aegis'})
    .map(a=>a.amount),[80,80,80,140,192]);
});

test('resolveRoundAttacks is pure and safe on malformed input',()=>{
  assert.deepEqual(resolveRoundAttacks({roundIndex:0,attempts:null}),[]);
  assert.deepEqual(resolveRoundAttacks({roundIndex:0}),[]);
  assert.deepEqual(resolveRoundAttacks({}),[]);
  assert.deepEqual(resolveRoundAttacks({roundIndex:0,attempts:{}}),[]);
  assert.deepEqual(resolveRoundAttacks({roundIndex:0,attempts:'DDDDD'}),[]);
  assert.deepEqual(resolveRoundAttacks({roundIndex:0,attempts:[]}),[]);
  // tamamen yanlış raund → vuruş yok.
  assert.deepEqual(resolveRoundAttacks({roundIndex:0,attempts:pattern(5,'Y')}),[]);
  // bozuk kayıtlar atlanır, girdi mutasyona uğramaz.
  const attempts=[null,{index:0,correct:true,at:1},undefined,{correct:true,at:2},{index:2,correct:false,at:3}];
  const copy=structuredClone(attempts);
  const attacks=resolveRoundAttacks({roundIndex:0,attempts});
  assert.deepEqual(attacks.map(a=>a.wordIndex),[0,undefined]);
  assert.deepEqual(attempts,copy);
});

test('perfect-round damage table for every round size (5,10,15,15,15,20)',()=>{
  for(let r=0;r<6;r++){
    const attacks=resolveRoundAttacks({roundIndex:r,attempts:pattern(ROUND_WORDS[r],'D')});
    assert.equal(attacks.length,ROUND_WORDS[r],`R${r+1} kelime sayısı`);
    assert.equal(total(attacks),PERFECT_TOTALS[r],`R${r+1} kusursuz toplam`);
  }
  // Sözleşme §10 örnekleri birebir: R1 = 650; R6 = 3×75 + 113 + 16×150 = 2738.
  const r6=resolveRoundAttacks({roundIndex:5,attempts:pattern(20,'D')});
  assert.deepEqual(r6.slice(0,5).map(a=>a.amount),[75,75,75,113,150]);
  assert.equal(r6.filter(a=>a.tags[0]==='FİNAL').length,16);
  assert.equal(total(r6),2738);
});

test('pinned accuracy tables: %80 (DDDDY) and %60 (DDDYY) per round',()=>{
  for(let r=0;r<6;r++){
    assert.equal(total(resolveRoundAttacks({roundIndex:r,attempts:pattern(ROUND_WORDS[r],P80)})),TOTALS_80[r],`R${r+1} %80`);
    assert.equal(total(resolveRoundAttacks({roundIndex:r,attempts:pattern(ROUND_WORDS[r],P60)})),TOTALS_60[r],`R${r+1} %60`);
  }
});

test('full-round scenario: mixed fight with items on both sides',()=>{
  // R3, %80 desen (DDDDY ×3): saldırgan gauntlet (taban 80→88), savunan aegis (−%20).
  // Blok vuruşları: 70,70,70,106 | 63,70,70,106 | 63,70,70,106 → toplam 934.
  const attacks=resolveRoundAttacks({roundIndex:2,attempts:pattern(15,P80),item:'gauntlet',defenderItem:'aegis'});
  assert.equal(attacks.length,12);                            // 15 kelimenin 12'si doğru
  assert.deepEqual(attacks.map(a=>a.amount),[70,70,70,106,63,70,70,106,63,70,70,106]);
  assert.equal(total(attacks),934);
});
