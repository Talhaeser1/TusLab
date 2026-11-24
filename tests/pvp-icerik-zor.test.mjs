import test from 'node:test';
import assert from 'node:assert/strict';
import {OSMANLICA,OSMANLICA_VERSION} from '../pvp/shared/content-osmanlica.js';
import {ATASOZLERI,ATASOZU_VERSION} from '../pvp/shared/content-atasozu.js';
import {contentWords} from '../pvp/shared/content-modes.js';
import {createMatch,submitWord,advanceMatch,ROUND_WORD_PLAN} from '../pvp/shared/match.js';

// Kullanıcı: "atasözlerini ve osmanlıca kelimeleri zorlaştır" (15 Kas 2026).
const players=[{playerId:'a',seat:1,character:'fire',name:'A'},{playerId:'b',seat:2,character:'rune',name:'B'}];
const avg=w=>w.reduce((a,x)=>a+x.length,0)/w.length;

test('osmanlıca: ≥250 kelime, 5 harften kısa yok, tekrar yok, ipucu dolu, yalnız küçük Türkçe harf',()=>{
  assert.ok(OSMANLICA_VERSION>=2);
  assert.ok(OSMANLICA.length>=250,`osmanlıca ${OSMANLICA.length}`);
  for(const e of OSMANLICA){
    assert.ok(e.kelime.length>=5,`kısa: ${e.kelime}`);
    assert.match(e.kelime,/^[a-zçğıöşü]+$/u,`harf: ${e.kelime}`);
    assert.ok(e.anlam&&e.anlam.trim().length>0,`ipucu boş: ${e.kelime}`);
  }
  assert.equal(new Set(OSMANLICA.map(e=>e.kelime)).size,OSMANLICA.length,'tekrar var');
  for(const w of ['şehir','zaman','sabah','bahar','vatan','zafer'])assert.ok(!OSMANLICA.some(e=>e.kelime===w),`günlük kelime: ${w}`);
});

test('atasözü: ≥200, 4 kelimeden kısa yok, 28 karakterden kısa yok, tekrar yok (noktalama/büyük harf dahil)',()=>{
  assert.ok(ATASOZU_VERSION>=2);
  assert.ok(ATASOZLERI.length>=200,`atasözü ${ATASOZLERI.length}`);
  for(const s of ATASOZLERI){
    assert.ok(s.split(/\s+/u).length>=4,`kısa: ${s}`);
    assert.ok(s.length>=28,`kısa: ${s}`);
    assert.match(s,/^\p{Lu}/u,`büyük harfle başlamalı: ${s}`);
  }
  const norm=s=>s.toLocaleLowerCase('tr').replace(/[^\p{L}\s]/gu,'').replace(/\s+/gu,' ').trim();
  assert.equal(new Set(ATASOZLERI.map(norm)).size,ATASOZLERI.length,'tekrar var');
  assert.ok(ATASOZLERI.filter(s=>s.split(/\s+/u).length>=7).length>=30,'uzun atasözü az');
});

test('osmanlıca seçim: 1. raund orta zorlukta (ort. ≥ 7 harf), son raund daha uzun, maçta tekrar yok',()=>{
  for(const seed of ['s','a','b','z9']){
    const used=[],avgs=[];
    ROUND_WORD_PLAN.forEach((count,i)=>{
      const r=contentWords('osmanlica',{seed,round:i+1,total:ROUND_WORD_PLAN.length,count,exclude:used});
      assert.equal(r.words.length,count);used.push(...r.words);avgs.push(avg(r.words));
    });
    assert.ok(avgs[0]>=7,`${seed}: 1. raund ort. ${avgs[0]}`);
    assert.ok(avgs.at(-1)>avgs[0],`${seed}: son raund ${avgs.at(-1)} ≤ 1. raund ${avgs[0]}`);
    assert.equal(new Set(used).size,used.length,`${seed}: maçta tekrar`);
  }
});

test('osmanlıca maç (motor, kelime raundu): 7 raundun hiçbirinde kelime tekrarlanmaz',()=>{
  let m=createMatch(players,1000,'m1',{rounds:7,roundStyle:'counted',seed:'zor',content:'osmanlica',resolveAtEnd:true});
  m.participants[1].hp=1e9;
  const all=[];
  for(let k=0;k<ROUND_WORD_PLAN.length&&m.status==='running';k++){
    const words=[...m.round.words];all.push(...words);
    let at=m.round.startedAt;const base=m.participants[0].wordIndex;
    for(let i=0;i<words.length;i++){const out=submitWord(m,{matchId:'m1',wordIndex:base+i,round:k+1,text:words[i],playerId:'a'},at+=300);assert.ok(!out.error,out.error);m=out.match;}
    m=advanceMatch(m,m.round.endsAt+30_000,()=>0.99).match;
    if(m.status==='running')m=advanceMatch(m,m.round.nextRoundAt,()=>0.99).match;
  }
  assert.ok(all.length>=40,`yalnız ${all.length} kelime`);
  assert.equal(new Set(all).size,all.length,'maçta tekrar');
  assert.ok(avg(all.slice(0,5))>=7,`ilk raund ort. ${avg(all.slice(0,5))}`);
});
