import test from 'node:test';
import assert from 'node:assert/strict';
import {contentWords,contentStreamLength} from '../pvp/shared/content-modes.js';
import {createMatch,submitWord,publicMatch,advanceMatch,ROUND_WORD_PLAN} from '../pvp/shared/match.js';
import {createPracticeSession} from '../pvp/practice.js';

const players=[{playerId:'a',seat:1,character:'fire',name:'A'},{playerId:'b',seat:2,character:'rune',name:'B'}];
const mk=(o)=>createMatch(players,1000,'m1',{rounds:5,resolveAtEnd:true,...o});
const stub={setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){}};

test('tohum: iki farklı tohum farklı başlar, aynı tohum aynı içeriği verir (tüm içerikler)',()=>{
  for(const content of ['kelime','atasozu','siir','osmanlica']){
    const a=mk({content,roundStyle:'counted',seed:'tohum-A'}),a2=mk({content,roundStyle:'counted',seed:'tohum-A'});
    assert.deepEqual(a.round.words,a2.round.words,`${content}: aynı tohum aynı`);
    const starts=new Set();
    for(let i=0;i<12;i++)starts.add(mk({content,roundStyle:'counted',seed:`s${i}`}).round.words.slice(0,5).join(' '));
    assert.ok(starts.size>=10,`${content}: 12 tohumdan ${starts.size} farklı başlangıç`);
  }
});

test('atasözü/şiir: parça içinde sıralı, hangi parçanın geleceği karışık, tur bitince yeniden karışır',()=>{
  for(const content of ['atasozu','siir']){
    const n=contentStreamLength(content);
    const e0=contentWords(content,{seed:'x',start:0,count:n,round:1,total:5}).words;
    const e1=contentWords(content,{seed:'x',start:n,count:n,round:1,total:5}).words;
    assert.equal(e0.length,n);assert.notDeepEqual(e0,e1,`${content}: ikinci tur farklı sırada`);
    assert.deepEqual([...e0].sort(),[...e1].sort(),`${content}: aynı kelime kümesi`);
    assert.notDeepEqual(e0.slice(0,12),contentWords(content,{seed:'y',start:0,count:12,round:1,total:5}).words);
    // art arda parçalar (start rastgele) bitişik okunur
    const win=contentWords(content,{seed:'x',start:7,count:20,round:1,total:5}).words;
    assert.deepEqual(win,e0.slice(7,27));
  }
});

test('counted: oyuncu başına raund planı kadar kelime (5-7-9-10-10-10-15), sonuncudan sonra oyuncu biter',()=>{
  // KESINYAP 11: roundWords seçeneği kalktı; kelime raundu planı sabit.
  let m=mk({roundStyle:'counted',roundWords:15,seed:'c'});
  m.participants[1].hp=1e9; // 7 raund boyunca nakavt olmasın (can taşınır)
  for(const [k,n] of ROUND_WORD_PLAN.entries()){
    assert.equal(m.round.index,k+1);
    const words=[...m.round.words];assert.equal(words.length,n);assert.equal(new Set(words).size,n);
    let at=m.round.startedAt;const base=m.participants[0].wordIndex;
    for(let i=0;i<n;i++){
      const out=submitWord(m,{matchId:'m1',wordIndex:base+i,round:k+1,text:words[i],playerId:'a'},at+=300);
      assert.ok(!out.error,out.error);m=out.match;
    }
    const me=m.participants.find(p=>p.playerId==='a');
    assert.equal(me.roundCorrect,n);assert.equal(me.roundDone,true);
    assert.equal(m.round.words.length,n);
    m=advanceMatch(m,m.round.endsAt+30_000,()=>0.99).match;
    if(m.status==='running')m=advanceMatch(m,m.round.nextRoundAt,()=>0.99).match;
  }
});

test('timed: süre bitene kadar kelime gelir, hiçbiri tekrarlanmaz (maç boyunca)',()=>{
  for(const content of ['kelime','atasozu','siir','osmanlica']){
    let m=mk({content,roundStyle:'timed',seed:`t-${content}`});let at=2000;
    for(let i=0;i<95;i++){ // KESINYAP 11: zamana karşı raund 30 sn → 95 kelime × 300 ms süre içinde
      const w=m.round.words[i];assert.ok(w,`${content}: ${i}. kelime yok`);
      const out=submitWord(m,{matchId:'m1',wordIndex:i,round:1,text:w,playerId:'a'},at+=300);
      assert.ok(!out.error,`${content} ${i}: ${out.error}`);m=out.match;
      assert.equal(m.participants[0].roundDone,false,`${content}: süre dolmadan bitti`);
      assert.ok(publicMatch(m,1).round.words[i+1],`${content}: sonraki kelime görünmüyor`);
    }
    if(content==='kelime'||content==='osmanlica')assert.equal(new Set(m.round.words).size,m.round.words.length,`${content}: raund içinde tekrar`);
  }
});

test('bot antrenmanı: art arda maçlar (rövanş dahil) aynı içerikle başlamaz',()=>{
  for(const content of ['kelime','atasozu','siir','osmanlica']){
    const seen=new Set();
    for(let i=0;i<4;i++){
      const s=createPracticeSession({mode:'rounds',content,rounds:5,roundStyle:'counted',scheduler:stub}).start();
      seen.add(s.snapshot().round.words.slice(0,5).join(' '));s.dispose();
    }
    assert.ok(seen.size>=3,`${content}: 4 maçta ${seen.size} farklı başlangıç`);
  }
  const seen=new Set();
  for(let i=0;i<4;i++){
    const s=createPracticeSession({mode:'classic',scheduler:stub}).start();
    seen.add(s.match.participants[0].activeText);s.dispose();
  }
  assert.ok(seen.size>=3,`klasik: ${seen.size}`);
});

test('klasik: cümleler tohumdan, oyuncular farklı, cümle bitince yenisi (tekrarsız)',()=>{
  const cm=seed=>createMatch(players,1000,'m1',{exchangeMs:10000,seed});
  const a=cm('k1'),b=cm('k2');
  assert.deepEqual(cm('k1').participants.map(p=>p.activeText),a.participants.map(p=>p.activeText));
  assert.notEqual(a.participants[0].activeText,b.participants[0].activeText);
  assert.notEqual(a.participants[0].activeText,a.participants[1].activeText);
  let m=a;let at=2000;const phrases=new Set([m.participants[0].activeText]);
  for(let i=0;i<60;i++){
    const me=m.participants[0];
    const out=submitWord(m,{matchId:'m1',wordIndex:me.wordIndex,text:me.currentWord,playerId:'a'},at+=300);
    if(out.error)break;m=out.match;phrases.add(m.participants[0].activeText);
  }
  assert.ok(phrases.size>=5,`cümle sayısı ${phrases.size}`);
});
