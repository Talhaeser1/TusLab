// İş Paketi 2 — Round Arenası Motoru: klasik "rounds" modunda sabit 6 roundluk kota yapısı.
// Spec: ROUND_WORD_PLAN=[5,10,15,15,15,20], her roundda oyuncuya o roundun kelime sayısı
// kadar giriş hakkı (doğru VEYA yanlış her tamamlanan kelime bir hak tüketir),
// ilk bitiren ROUND_LAST_CALL_MS=5000 son çağrı penceresini açar, 6. round kapanışında
// maç biter (3-3: kümülatif round RP → toplam doğru → ROUNDS_DRAW). Ani ölüm yok.
// Not (Paket F uyumu): raund biçimi timed/counted ayrımı İP2'den SONRA eklendi; kota
// mekaniği counted moduna aittir (timed'da kelimeler süre bitene kadar akar). Bu yüzden
// kota/plan testleri roundStyle:'counted'ı açıkça seçer — varsayılan stilden bağımsızdır.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '../pvp/shared/match.js';
import {createMatch,submitWord,advanceMatch,
  ROUND_DURATION_MS,ROUND_LAST_CALL_MS,ROUND_SETTLE_MS,ROUND_SUMMARY_MS,ROUND_INTRO_MS,ROUND_HP} from '../pvp/shared/match.js';
import {createPracticeSession,HUMAN_ID} from '../pvp/practice.js';
import {roundsViewModel,streakModel} from '../pvp/rounds-ui.js';

const T0=10_000;
const R=ROUND_DURATION_MS;
const INTER=ROUND_SUMMARY_MS+ROUND_INTRO_MS;
const players=()=>[
  {playerId:'a',seat:1,character:'fire',name:'A'},{playerId:'b',seat:2,character:'rune',name:'B'}];
const make=(opts={})=>createMatch(players(),T0,'plan6',{roundStyle:'counted',rounds:6,seed:123,...opts});
const seatOf=(m,seat)=>m.participants.find(p=>p.seat===seat);
const NO_BLOCK=()=>0.99;
function type(m,seat,at,{wrong=false}={}){
  const p=seatOf(m,seat);const word=m.round.words[p.roundWordIndex];
  const out=submitWord(m,{playerId:p.playerId,matchId:m.id,wordIndex:p.wordIndex,text:wrong?word+'x':word,round:m.round.index},at);
  assert.ok(out.match,'submit failed: '+out.error);return out;
}
/** Bir turu `seat` için `script` ('c'=doğru, 'w'=yanlış) ile oynar ve sonraki tura geçer. */
function playRoundScript(m,seat,script){
  const start=m.round.startedAt;
  script.forEach((s,i)=>{m=type(m,seat,start+100+i*100,{wrong:s==='w'}).match;});
  const ended=advanceMatch(m,m.round.endsAt,NO_BLOCK);m=ended.match;
  if(m.status==='ended')return {m,events:ended.roundEvents};
  const next=advanceMatch(m,m.round.nextRoundAt,NO_BLOCK);
  return {m:next.match,events:[...ended.roundEvents,...next.roundEvents]};
}

// ── sabitler ve plan ───────────────────────────────────────────────────────

test('plan6: constants — single 6-round option with the fixed word plan',()=>{
  assert.deepEqual([...engine.ROUND_OPTIONS],[6]);
  assert.equal(engine.TOTAL_ROUNDS,6);
  assert.deepEqual([...engine.ROUND_WORD_PLAN],[5,10,15,15,15,20]);
  assert.equal(engine.normalizeRounds(6),6);
  // Bilinçli spec değişikliği: eski 5/7/10 seçenekleri ve diğer tüm değerler 6'ya düşer.
  for(const bad of [3,5,7,10,'6',0,-1,11,null,undefined,1.5])assert.equal(engine.normalizeRounds(bad),6,String(bad));
  // Son çağrı penceresi ve temel tur sabitleri KORUNUR (değişmezler).
  assert.equal(ROUND_LAST_CALL_MS,5_000);assert.equal(ROUND_HP,1200);assert.equal(R,40_000);
});

test('plan6: the match plans exactly six rounds with the per-round word counts',()=>{
  const m=make();
  assert.equal(m.mode,'rounds');
  assert.equal(m.totalRounds,6);
  assert.equal(m.roundPlan.length,6,'ani ölüm roundları planlanmaz');
  assert.deepEqual(m.roundPlan.map(w=>w.length),[5,10,15,15,15,20]);
  assert.equal(m.round.index,1);assert.equal(m.round.words.length,5);
  assert.equal(m.round.suddenDeath,false);
  assert.equal(m.endsAt,T0+ROUND_DURATION_MS);
  // Eski seçenek değerleri yeni şemada 6 rounda düşer (eski oda/istemci verisi bozulmaz).
  for(const old of [5,7,10])assert.equal(make({rounds:old}).totalRounds,6,`rounds:${old}`);
});

test('plan6: word difficulty ramps easy/easy/normal/normal/hard/hard over six rounds',()=>{
  let m=make({seed:77});
  // pickWords zorluk penceresiyle kesişimden sonra etkin uzunluk aralıkları
  // (arena.js RULES referansı: kolay/kolay/normal/normal/zor/zor).
  const windows=[[3,6],[4,6],[4,8],[5,9],[6,9],[6,10]];
  for(let r=1;r<=6;r++){
    const [lo,hi]=windows[r-1];
    assert.equal(m.round.words.length,[5,10,15,15,15,20][r-1],`r${r} kelime sayısı`);
    for(const w of m.round.words){
      const len=[...w].length;
      assert.ok(len>=lo&&len<=hi,`r${r} "${w}" uzunluk ${len} ∉ [${lo},${hi}]`);
    }
    const played=playRoundScript(m,undefined,[]);m=played.m; // kimse yazmaz → TIME
  }
  assert.equal(m.status,'ended');
});

// ── kota: her giriş hak tüketir ────────────────────────────────────────────

test('plan6: quota equals the round word count; correct AND wrong attempts both consume it',()=>{
  let m=make();
  m=type(m,1,T0+1000).match;                      // doğru
  m=type(m,1,T0+2000,{wrong:true}).match;          // yanlış — hak yine tükenir
  m=type(m,1,T0+3000).match;
  const out=type(m,1,T0+4000,{wrong:true});m=out.match;
  const p=seatOf(m,1);
  assert.equal(p.roundCorrect,2);assert.equal(p.roundWrong,2);
  assert.equal(p.roundWordIndex,4);assert.equal(p.roundDone,false);
  const last=type(m,1,T0+5000);m=last.match;
  assert.equal(seatOf(m,1).roundDone,true);
  assert.equal(last.result.roundWordIndex,5);
  assert.equal(last.result.roundDone,true);
  const again=submitWord(m,{playerId:'a',matchId:m.id,wordIndex:seatOf(m,1).wordIndex,text:'x'},T0+6000);
  assert.equal(again.error,'ROUND_COMPLETE');
});

test('plan6: round 2 grants ten attempts, round 6 grants twenty',()=>{
  let m=make();
  m=playRoundScript(m,undefined,[]).m;                       // → tur 2 (10 kelime)
  assert.equal(m.round.index,2);assert.equal(m.round.words.length,10);
  for(let i=1;i<=10;i++)m=type(m,1,m.round.startedAt+i*1000).match;
  assert.equal(seatOf(m,1).roundDone,true);
  assert.equal(seatOf(m,1).roundCorrect,10);
  for(let i=0;i<4;i++)m=playRoundScript(m,undefined,[]).m;    // turlar 2-5 kapanır → tur 6 (20 kelime)
  assert.equal(m.round.index,6);assert.equal(m.round.words.length,20);
  for(let i=1;i<=20;i++)m=type(m,1,m.round.startedAt+i*100,{wrong:i%2===0}).match;
  const p=seatOf(m,1);
  assert.equal(p.roundDone,true);assert.equal(p.roundCorrect,10);assert.equal(p.roundWrong,10);
});

// ── son çağrı penceresi ve kapanış kayıtları ──────────────────────────────

test('plan6: first finisher opens the 5 s last-call window; close keeps both players\' records',()=>{
  let m=make();
  for(let i=1;i<=5;i++)m=type(m,1,T0+i*300,{wrong:i%2===0}).match; // 3 doğru, 2 yanlış
  const p1=seatOf(m,1);
  assert.equal(p1.roundDone,true);
  assert.equal(m.round.endsAt,T0+1500+ROUND_LAST_CALL_MS,'son çağrı penceresi korunur');
  // Rakip pencere içinde 2 kelime yazar (1 doğru, 1 yanlış) ama kotayı dolduramaz.
  m=type(m,2,T0+2000).match;
  m=type(m,2,T0+2500,{wrong:true}).match;
  assert.equal(seatOf(m,2).roundDone,false);
  const adv=advanceMatch(m,m.round.endsAt,NO_BLOCK);m=adv.match;
  const end=adv.roundEvents.find(e=>e.type==='ROUND_END').payload;
  assert.equal(end.reason,'TIME');
  const s1=end.scores.find(s=>s.seat===1),s2=end.scores.find(s=>s.seat===2);
  assert.deepEqual([s1.correct,s1.wrong],[3,2]);
  assert.deepEqual([s2.correct,s2.wrong],[1,1]);
  assert.equal(end.winnerSeat,1);
  assert.deepEqual(end.roundsWon,{1:1,2:0});
});

test('plan6: both players finishing on the same tick closes the round at once (ALL_DONE)',()=>{
  let m=make();
  for(let i=1;i<=4;i++){
    m=type(m,1,T0+i*200).match;
    m=type(m,2,T0+i*200+100,{wrong:true}).match;
  }
  const a=type(m,1,T0+1000);m=a.match;               // 5. kelime — aynı milisaniye
  assert.deepEqual(a.result.roundEvents.map(e=>e.type),['ROUND_LAST_CALL']);
  const b=type(m,2,T0+1000,{wrong:true});m=b.match;   // rakip de aynı tick'te bitirir
  assert.equal(b.result.roundEvents.length,0,'ikinci bitiren yeni son çağrı üretmez');
  assert.equal(m.round.allDone,true);
  assert.equal(m.round.endsAt,T0+1000);
  const adv=advanceMatch(m,T0+1000+ROUND_SETTLE_MS+500,NO_BLOCK);
  const end=adv.roundEvents.find(e=>e.type==='ROUND_END').payload;
  assert.equal(end.reason,'ALL_DONE');
  const s1=end.scores.find(s=>s.seat===1),s2=end.scores.find(s=>s.seat===2);
  assert.equal(s1.correct,5);assert.equal(s2.wrong,5);
  assert.equal(end.winnerSeat,1);
  assert.equal(adv.match.status,'running');
});

// ── maç bitişi ve 3-3 tie-break ───────────────────────────────────────────

test('plan6: the match runs all six rounds — no early clinch, no sudden death',()=>{
  let m=make({seed:5});
  for(let i=0;i<3;i++)m=playRoundScript(m,1,['c']).m;   // 3-0
  assert.equal(m.status,'running','erken kesinleşme kaldırıldı');
  assert.equal(m.round.index,4);
  for(let i=0;i<2;i++)m=playRoundScript(m,2,['c']).m;   // 3-2
  assert.equal(m.status,'running');
  m=playRoundScript(m,2,['c']).m;                       // 3-3 → tur 6 kapandı
  assert.equal(m.status,'ended');
  assert.equal(m.roundHistory.length,6);
  const lastEnd=m.roundHistory.at(-1);
  assert.equal(lastEnd.round,6);assert.equal(lastEnd.matchOver,true);
  assert.equal(lastEnd.nextRoundAt,null);
});

test('plan6: 3-3 after six rounds → tie-break by cumulative round RP',()=>{
  let m=make({seed:5});
  // Koltuk 1: 3 galibiyet × (2 doğru + 1 yanlış, seri 1 → RP 250) = 750 RP, 6 doğru.
  for(let i=0;i<3;i++)m=playRoundScript(m,1,['c','w','c']).m;
  assert.deepEqual(m.roundsWon,{1:3,2:0});
  // Koltuk 2: 3 galibiyet × (1 doğru → RP 150) = 450 RP, 3 doğru.
  for(let i=0;i<3;i++)m=playRoundScript(m,2,['c']).m;
  assert.deepEqual(m.roundsWon,{1:3,2:3});
  assert.equal(m.status,'ended');
  assert.equal(m.winnerSeat,1,'RP 750 > 450');
  assert.equal(m.endReason,'ROUNDS');
  assert.equal(engine.matchResult(m).winnerSeat,1);
});

test('plan6: equal RP at 3-3 → tie-break by total correct words',()=>{
  let m=make({seed:5});
  // Koltuk 1: 3 × (doğru, yanlış, doğru → c=2, s=1, RP 250) = 750 RP / 6 doğru.
  for(let i=0;i<3;i++)m=playRoundScript(m,1,['c','w','c']).m;
  // Koltuk 2: 2 × (doğru, doğru → c=2, s=2, RP 300) + 1 × (doğru → RP 150) = 750 RP / 5 doğru.
  m=playRoundScript(m,2,['c','c']).m;
  m=playRoundScript(m,2,['c','c']).m;
  m=playRoundScript(m,2,['c']).m;
  assert.deepEqual(m.roundsWon,{1:3,2:3});
  assert.equal(m.status,'ended');
  assert.equal(m.winnerSeat,1,'RP 750 = 750, doğru 6 > 5');
  assert.equal(m.endReason,'ROUNDS');
});

test('plan6: fully symmetric 3-3 records end as ROUNDS_DRAW',()=>{
  let m=make({seed:5});
  for(let i=0;i<3;i++){
    m=playRoundScript(m,1,['c','w','c']).m;   // koltuk 1 alır (250-0)
    m=playRoundScript(m,2,['c','w','c']).m;   // koltuk 2 alır (0-250)
  }
  assert.deepEqual(m.roundsWon,{1:3,2:3});
  assert.equal(m.status,'ended');
  assert.equal(m.winnerSeat,null);
  assert.equal(m.endReason,'ROUNDS_DRAW');
  const result=engine.matchResult(m);
  assert.equal(result.endReason,'ROUNDS_DRAW');assert.equal(result.winnerSeat,null);
});

test('plan6: a decisive 4-2 scoreline ends the match at the sixth round close',()=>{
  let m=make({seed:5});
  for(let i=0;i<4;i++)m=playRoundScript(m,1,['c']).m;
  for(let i=0;i<2;i++)m=playRoundScript(m,2,['c']).m;
  assert.equal(m.status,'ended');
  assert.deepEqual(m.roundsWon,{1:4,2:2});
  assert.equal(m.winnerSeat,1);assert.equal(m.endReason,'ROUNDS');
});

// ── eski format uyumluluğu ────────────────────────────────────────────────

test('plan6: a legacy ten-word round still closes under the dynamic quota',()=>{
  let m=make();
  // Eski Durable Object depolamasındaki 10 kelimelik tur: kota artık round.words.length
  // üzerinden sayıldığı için eski maç yeni kodla kapanabilir.
  const legacyWords=m.roundPlan[1];                       // 10 kelimelik plan
  m=structuredClone(m);
  m.round.words=[...legacyWords];m.roundPlan[0]=[...legacyWords];
  for(const p of m.participants){p.activeText=legacyWords.join(' ');p.currentWord=legacyWords[0];}
  for(let i=1;i<=9;i++)m=type(m,1,T0+i*1000).match;
  const p=seatOf(m,1);
  assert.equal(p.roundWordIndex,9);assert.equal(p.roundDone,false);
  const last=type(m,1,T0+10_000);m=last.match;
  assert.equal(seatOf(m,1).roundDone,true);
  assert.equal(last.result.roundWordIndex,10);
  assert.deepEqual(last.result.roundEvents.map(e=>e.type),['ROUND_LAST_CALL']);
  assert.equal(m.round.endsAt,T0+10_000+ROUND_LAST_CALL_MS);
});

// ── bot antrenmanı + klasik exchange regresyonu ───────────────────────────

function clock(){
  let time=1_700_000_000_000,serial=0;
  const timers=new Map();
  const add=(fn,ms,repeat)=>{const id=++serial;timers.set(id,{fn,at:time+ms,ms,repeat});return id;};
  return {
    now:()=>time,
    scheduler:{setTimeout:(fn,ms)=>add(fn,ms,false),clearTimeout:id=>timers.delete(id),
      setInterval:(fn,ms)=>add(fn,ms,true),clearInterval:id=>timers.delete(id)},
    advance(ms){
      const end=time+ms;
      for(;;){
        let chosen=null;
        for(const [id,timer] of timers)if(timer.at<=end&&(!chosen||timer.at<chosen.timer.at||timer.at===chosen.timer.at&&id<chosen.id))chosen={id,timer};
        if(!chosen)break;
        time=chosen.timer.at;
        if(chosen.timer.repeat)chosen.timer.at+=chosen.timer.ms;else timers.delete(chosen.id);
        chosen.timer.fn();
      }
      time=end;
    }
  };
}

test('plan6: practice (bot) rounds mode uses the six-round plan; classic exchange is unchanged',()=>{
  const time=clock();const packets=[];
  const session=createPracticeSession({roundStyle:'counted',now:time.now,scheduler:time.scheduler,rng:()=>.99,
    createId:()=>'plan6-practice',onPacket:p=>packets.push(p)});
  session.start();
  assert.equal(session.mode,'rounds');
  assert.equal(session.rounds,6);
  assert.equal(session.match.totalRounds,6);
  assert.deepEqual(session.match.roundPlan.map(w=>w.length),[5,10,15,15,15,20]);
  assert.equal(session.match.round.words.length,5);
  assert.ok(packets.some(p=>p.type==='ROUND_START'&&p.payload.round===1));
  let safety=0;
  while(!packets.some(p=>p.type==='ROUND_END')&&safety++<4000)time.advance(50);
  assert.ok(packets.some(p=>p.type==='ROUND_END'),'ilk tur kapanır');
  time.advance(ROUND_SUMMARY_MS+ROUND_INTRO_MS);
  assert.equal(session.match.round.index,2);
  assert.equal(session.match.round.words.length,10);
  const me=session.match.participants.find(p=>p.playerId===HUMAN_ID);
  assert.equal(me.currentWord,session.match.round.words[0]);
  session.dispose();
  // Klasik exchange modu regresyona uğramaz.
  const time2=clock();
  const classic=createPracticeSession({mode:'classic',now:time2.now,scheduler:time2.scheduler,
    rng:()=>.5,createId:()=>'plan6-classic'});
  classic.start();
  assert.equal(classic.mode,'classic');
  assert.equal(classic.match.round,undefined);
  assert.equal(classic.match.exchange.phase,'typing');
  classic.dispose();
});

// ── rounds-ui veri bağlama (yalnız dinamik sayılar; görsel tasarım değişmez) ──

function uiMatch(index,words,meIdx,oppIdx){
  return {matchId:'ui6',sequence:1,status:'running',mode:'rounds',totalRounds:6,roundsWon:{1:0,2:0},
    round:{index,total:6,suddenDeath:false,phase:'round',words,startedAt:0,endsAt:40_000,settleUntil:null,nextRoundAt:null},
    roundHistory:[],
    players:[
      {playerId:'me',seat:1,name:'A',character:'fire',hp:1,maxHp:1,combo:2,streak:2,multiplier:1,nextSkill:null,
        roundWordIndex:meIdx,roundCorrect:meIdx,roundWrong:0,roundBestStreak:2,roundDamage:0,roundDone:false,finishedAt:null,
        wordIndex:meIdx,currentWord:words[meIdx]},
      {playerId:'op',seat:2,name:'B',character:'rune',hp:1,maxHp:1,combo:0,streak:0,multiplier:1,nextSkill:null,
        roundWordIndex:oppIdx,roundCorrect:oppIdx,roundWrong:0,roundBestStreak:0,roundDamage:0,roundDone:false,finishedAt:null,
        wordIndex:oppIdx,currentWord:words[oppIdx]}]};
}
const words=n=>Array.from({length:n},(_,i)=>`kelime${i}`);

test('plan6 UI: strip, counter and streak meter follow the round word count',()=>{
  const twenty=roundsViewModel(uiMatch(6,words(20),7,3),'me',1000,new Map());
  assert.equal(twenty.words.length,20);
  assert.equal(twenty.sides[0].progress,'Kelime 7/20');
  assert.equal(twenty.sides[1].progress,'Kelime 3/20');
  assert.equal(twenty.sides[0].streak.cells,20);
  const five=roundsViewModel(uiMatch(1,words(5),3,2),'me',1000,new Map());
  assert.equal(five.words.length,5);
  assert.equal(five.sides[0].progress,'Kelime 3/5');
  assert.equal(five.sides[0].streak.cells,5);
  assert.equal(streakModel(2,null,5).cells,5);
  assert.equal(streakModel(2,null,20).filled,2);
});
