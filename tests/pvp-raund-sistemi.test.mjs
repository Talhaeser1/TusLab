// KESINYAP 11: raund sistemi — zamana karşı 30 sn / kelime raundu 5-7-9-10-10-10-15; 6000 taşınan can (RAPOR-PVP-MEKANIK);
// raund hasar tavanı YOK (kaldırıldı); rounds'ta rastgele blok yok.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as shared from '../pvp/shared/match.js';
import * as server from '../cloudflare/src/match.js';
import {createMatch,publicMatch,submitWord,advanceMatch,matchResult,roundStartPayload,
  ROUND_TOTAL,ROUND_WORD_PLAN,ROUND_HP,ROUND_DURATION_MS,SUDDEN_DEATH_MAX,roundWordsFor,streakSkill} from '../pvp/shared/match.js';
import {roundsResultModel,summaryModel,roundDamageText,roundsViewModel,roundStylePickerHTML,roundsPickerHTML,DAMAGE_RULE_HINT} from '../pvp/rounds-ui.js';
import {ttModeLabel} from '../pvp/typing-top-model.js';
import {createPracticeSession} from '../pvp/practice.js';

const T0=50_000;
const players=()=>[{playerId:'a',seat:1,character:'fire',rune:'none',name:'A'},{playerId:'b',seat:2,character:'rune',rune:'none',name:'B'}];
const make=(opts={})=>createMatch(players(),T0,'m',{rounds:5,roundWords:15,seed:'kesin11',...opts}); // eski seçenekler yok sayılmalı
const seat=(m,s)=>m.participants.find(p=>p.seat===s);
function type(m,s,at,wrong=false){
  const p=seat(m,s);const word=m.round.words[p.roundWordIndex];
  const out=submitWord(m,{playerId:p.playerId,matchId:m.id,wordIndex:p.wordIndex,text:wrong?`${word}x`:word,round:m.round.index},at);
  assert.ok(out.match,`gönderim reddedildi: ${out.error}`);return out.match;
}
/** Raundu bitirir ve (maç sürüyorsa) sonraki raundu başlatır. */
function finishRound(m,rng=()=>0.99){
  m=advanceMatch(m,m.round.endsAt+30_000,rng).match;
  if(m.status==='running'&&m.round.phase==='intermission')m=advanceMatch(m,m.round.nextRoundAt,rng).match;
  return m;
}

test('kelime raundu planı [5,7,9,10,10,10,15]; iki oyuncuya aynı kelimeler; kelime başına süre yok (gizli 120 sn sınır)', () => {
  assert.deepEqual([...ROUND_WORD_PLAN],[5,7,9,10,10,10,15]);
  assert.equal(ROUND_TOTAL,7);
  let m=make({roundStyle:'counted'});
  assert.equal(m.totalRounds,7,'eski rounds:5 seçeneği yok sayılır');
  for(let r=1;r<=7;r++){
    assert.equal(m.round.index,r);
    assert.equal(m.round.words.length,ROUND_WORD_PLAN[r-1],`raund ${r}`);
    assert.equal(m.round.endsAt-m.round.startedAt,120_000,'kelime × 6 sn yok: yalnız gizli 120 sn üst sınır');
    assert.deepEqual(publicMatch(m,1).round.words,publicMatch(m,2).round.words);
    assert.equal(publicMatch(m,1).round.wordCount,ROUND_WORD_PLAN[r-1]);
    m=finishRound(m);
  }
  assert.equal(roundWordsFor(8),10,'ani ölüm 10 kelime');
});

test('kelime raundu: plan kadar kelimeden sonra oyuncu biter; içerik modları da planla çalışır', () => {
  let m=make({roundStyle:'counted'});
  for(let i=0;i<5;i++)m=type(m,1,T0+500+i*300);
  assert.equal(seat(m,1).roundDone,true);
  for(const content of ['atasozu','siir','osmanlica']){
    let c=make({roundStyle:'counted',content});
    assert.equal(c.round.words.length,5,content);
    c=finishRound(c);
    assert.equal(c.round.words.length,7,`${content} raund 2`);
  }
});

test('zamana karşı: raund 30 sn ve kelime tükenmez', () => {
  assert.equal(ROUND_DURATION_MS,30_000);
  let m=make({roundStyle:'timed'});
  assert.equal(m.round.endsAt-m.round.startedAt,30_000);
  for(let i=0;i<60;i++){m=type(m,1,T0+200+i*450,i%7===6);assert.ok(seat(m,1).currentWord,`kelime ${i+1} sonrası boş kaldı`);}
  assert.equal(seat(m,1).roundDone,false);
  assert.equal(publicMatch(m,1).round.wordCount,undefined);
});

test('can 6000 ile başlar ve raundlar arasında taşınır', () => {
  let m=make({roundStyle:'counted'});
  assert.equal(seat(m,2).hp,ROUND_HP);assert.equal(ROUND_HP,6000);
  for(let i=0;i<3;i++)m=type(m,1,T0+500+i*300); // seri 3 → Q
  m=finishRound(m);
  const hp=seat(m,2).hp;
  assert.ok(hp<ROUND_HP,'Q hasarı uygulandı');
  assert.equal(m.round.index,2);
  assert.equal(seat(m,2).maxHp,ROUND_HP);
  assert.equal(seat(m,2).hp,hp,'2. raundda can sıfırlanmadı');
  assert.equal(roundStartPayload(m).hp[2],hp);
  assert.equal('roundsWon' in publicMatch(m,1),false,'raund galibiyeti/pip yok');
});

// KESINYAP 21 (kullanıcı kuralı "ulti yalnız 10 üst üste"): 3 Q, 5 W (motor 'e'), 7 E (savunma, motor 'h'), 10 R;
// RAPOR-PVP-MEKANIK: 10'dan sonra her 3. doğru kelime Q (13, 16, 19 …; önceden her kelime).
// RAPOR-PVP-KALANLAR: 13'ten sonra her 8. kelime (21, 29 …) — zor–zor 3 raund yerine ~4,7 raund.
test('seri → beceri: 3 Q, 5 W, 7 E (savunma), 10 R, sonra 13 ve her 8. doğru kelime Q', () => {
  assert.deepEqual([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,19,20,21,29].map(streakSkill),[null,null,'q',null,'e',null,'h',null,null,'r',null,null,'q',null,null,null,null,null,'q','q']);
});

function perfectMatch({resolveAtEnd}){
  let m=make({roundStyle:'timed',...(resolveAtEnd?{resolveAtEnd:true}:{})});
  const perRound=[];
  while(m.status==='running'&&m.round.index<=7){
    const start=m.round.startedAt;
    for(let i=0;i<65&&m.status==='running'&&!m.round.koSeat;i++){
      const at=start+200+i*420;
      if(!resolveAtEnd)m=advanceMatch(m,at,()=>0).match; // olabildiğince blok zarı ver: rounds'ta etkisiz olmalı
      if(m.status!=='running'||m.round.phase!=='round')break;
      m=type(m,1,at);
    }
    m=finishRound(m,()=>0);
    perRound.push(m.roundHistory.at(-1));
  }
  return {m,perRound};
}
for(const resolveAtEnd of [false,true]){
  test(`mükemmel oyun (~140 WPM, rakip pasif): tavan yok ama tek raundda nakavt yok (resolveAtEnd=${resolveAtEnd})`, () => {
    const {m,perRound}=perfectMatch({resolveAtEnd});
    assert.equal(m.status,'ended');
    assert.equal(m.endReason,'KNOCKOUT');
    assert.equal(m.winnerSeat,1);
    // RAPOR-PVP-KALANLAR: seyrek zincir (13, 21, 29 …) → kusursuz ~140 WPM oyuncu bile nakavtı 3. raundda yapar (önceden 2.).
    assert.equal(perRound.length,3,'raund hasarı < 3000 → nakavt en erken 3. raundda');
    assert.ok(perRound[0].scores[0].damageDealt>1300,'tavan kalktı: 1300 üstü hasar verilebilir');
    assert.ok(perRound[0].scores[0].damageDealt<ROUND_HP);
    assert.equal(seat(m,2).hp,0);
    const res=roundsResultModel(matchResult(m),'a');
    assert.match(res.scoreline,/^6\.000 – 0 · NAKAVT$/);
    assert.equal(res.rows.length,3);
    assert.equal(roundDamageText(1300),'1300');
  });
}

test('7. raund sonunda canı fazla olan kazanır; sonuç ekranı kalan canı gösterir', () => {
  let m=make({roundStyle:'counted'});
  for(let i=0;i<3;i++)m=type(m,1,T0+500+i*300);
  while(m.status==='running')m=finishRound(m);
  assert.equal(m.roundHistory.length,7);
  assert.equal(m.winnerSeat,1);assert.equal(m.endReason,'ROUNDS');
  const r=matchResult(m);
  assert.equal(r.finalHp[1],ROUND_HP);assert.ok(r.finalHp[2]<ROUND_HP);
  assert.equal(roundsResultModel(r,'a').scoreline,`6.000 – ${(r.finalHp[2]).toLocaleString('tr-TR')} · 7 raund`);
});

test('7 raund sonunda can eşitse ani ölüm; üç berabere ani ölüm → ROUNDS_DRAW', () => {
  let m=make({roundStyle:'counted'});
  for(let r=1;r<=7;r++)m=finishRound(m);
  assert.equal(m.status,'running');assert.equal(m.round.index,8);assert.equal(m.round.suddenDeath,true);
  for(let k=0;k<SUDDEN_DEATH_MAX;k++)m=finishRound(m);
  assert.equal(m.status,'ended');assert.equal(m.endReason,'ROUNDS_DRAW');
});

test('ani ölümde hasar veren kazanır', () => {
  let m=make({roundStyle:'counted'});
  for(let r=1;r<=7;r++)m=finishRound(m);
  for(let i=0;i<3;i++)m=type(m,2,m.round.startedAt+400+i*300);
  m=finishRound(m);
  assert.equal(m.status,'ended');assert.equal(m.winnerSeat,2);
});

test('rounds modunda rastgele blok/parry yok: zar çağrılmaz, hasar her zaman uygulanır', () => {
  for(const resolveAtEnd of [false,true]){
    let m=make({roundStyle:'timed',...(resolveAtEnd?{resolveAtEnd:true}:{})});
    let calls=0;const rng=()=>{calls++;return 0;};
    const events=[];
    for(let i=0;i<8;i++){
      const at=T0+300+i*400;
      m=type(m,1,at);m=type(m,2,at); // aynı kelimede iki taraf: çarpışma
      const out=advanceMatch(m,at+1,rng);m=out.match;events.push(...out.events);
    }
    const out=advanceMatch(m,m.round.endsAt+20_000,rng);events.push(...out.events);
    assert.equal(calls,0,`resolveAtEnd=${resolveAtEnd}: zar atılmamalı`);
    assert.equal(events.filter(e=>['SHIELD_TRIGGERED','PARRY_TRIGGERED','COUNTERATTACK_CAST'].includes(e.type)).length,0);
    const hits=events.filter(e=>e.type==='DAMAGE_APPLIED');
    assert.ok(hits.length>0);assert.ok(hits.every(e=>e.blocked===false));
  }
});

test('sunucu ve istemci aynı motoru ve sabitleri kullanır; aynı tohum + aynı yazım → aynı sonuç', () => {
  for(const k of ['createMatch','submitWord','advanceMatch','ROUND_HP','ROUND_WORD_PLAN','ROUND_TOTAL','roundWordsFor','streakSkill'])
    assert.equal(server[k],shared[k],k);
  const run=engine=>{
    let m=engine.createMatch(players(),T0,'x',{rounds:7,roundStyle:'counted',seed:'ayni',resolveAtEnd:true});
    for(let i=0;i<5;i++){const p=m.participants[0];m=engine.submitWord(m,{playerId:'a',matchId:'x',wordIndex:p.wordIndex,text:m.round.words[p.roundWordIndex]},T0+400+i*300).match;}
    return engine.advanceMatch(m,m.round.endsAt+30_000,()=>0.5).match;
  };
  assert.deepEqual(run(server),run(shared));
});

test('bot antrenmanı yeni kurallarla: 7 raund, 6000 can, kelime raundu 5 kelime ile başlar', () => {
  const s=createPracticeSession({mode:'rounds',roundStyle:'counted',rounds:10,roundWords:15,scheduler:{setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){}},now:()=>T0,rng:()=>0.5});
  s.start();
  const m=s.match;
  assert.equal(m.totalRounds,7);assert.equal(m.round.words.length,5);assert.equal(m.participants[0].maxHp,6000);
  assert.equal(s.rounds,7);
  s.dispose?.();
});

test('arayüz: üst etiket, raund arası kartı ve lobi kural ipucu', () => {
  let m=make({roundStyle:'counted'});
  m=finishRound(m);
  const pub=publicMatch(m,1);
  assert.equal(ttModeLabel(pub),'KELİME RAUNDU · RAUND 2/7 · 7 kelime');
  const t=make({roundStyle:'timed'});
  assert.equal(ttModeLabel(publicMatch(t,1)),'ZAMANA KARŞI · RAUND 1/7');
  const vm=roundsViewModel(pub,'a',m.round.startedAt+1000,new Map());
  assert.equal(vm.headline,'KELİME RAUNDU · RAUND 2/7 · 7 kelime');
  assert.deepEqual([vm.sides[0].pips.filled,vm.sides[0].pips.total],[1,7]);
  assert.equal(vm.sides[1].hpText,'Can 6.000/6.000');
  const end=summaryModel({round:1,reason:'TIME',winnerSeat:1,hp:{1:3590,2:3360},next:{round:2,style:'counted',words:7},nextRoundAt:1,
    scores:[{seat:1,damageDealt:640,hpLeft:3590},{seat:2,damageDealt:410,hpLeft:3360}]},pub,'a');
  assert.equal(end.damageLine,'Bu raund: Sen 640 hasar · Rakip 410 hasar');
  assert.equal(end.hpLine,'Kalan can: Sen 3.590 · Rakip 3.360');
  assert.equal(end.nextText,'Sıradaki: RAUND 2 · 7 kelime');
  const timedEnd=summaryModel({round:2,reason:'TIME',scores:[],next:{round:3,style:'timed',seconds:30},nextRoundAt:1},publicMatch(t,1),'a');
  assert.equal(timedEnd.nextText,'Sıradaki: RAUND 3 · 30 sn');
  const html=roundStylePickerHTML('practice');
  assert.match(html,/Zamana karşı/);assert.match(html,/Kelime raundu/);assert.doesNotMatch(html,/data-round-words/);
  assert.ok(html.includes(DAMAGE_RULE_HINT));
  // KESINYAP 21 + RAPOR-PVP-MEKANIK: lobi ipucu dört yetenek eşiğini, kalkan/can miktarını ve çarpan tavanını söyler; hasar tavanı yok.
  assert.match(DAMAGE_RULE_HINT,/Seri 3 → Q · 5 → W · 7 → E \(kalkan 330 ya da can 300\) · 10 → R \(en çok ×2\) · sonra 13\. ve her 8\. doğru kelime Q · 10\. seriden sonra hasar çarpanı artar \(en çok ×2\) · yanlış kelime serinin yarısını götürür · raund başına en çok 500 kalkan\/can/);
  assert.doesNotMatch(DAMAGE_RULE_HINT,/1300|tavan/i);
  assert.equal(roundsPickerHTML('practice'),'');
});
