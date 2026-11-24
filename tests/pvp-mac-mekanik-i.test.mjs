// Görev I — kazanan (nakavt sayılır), kelime akışı (timed/counted), zorlaşma, skill→hasar→can→raund→maç uçtan uca.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,submitWord,advanceMatch,pickRoundSkill,publicMatch,matchResult,
  roundDurationMs,ROUND_SUMMARY_MS,ROUND_INTRO_MS,ROUND_WORDS,ROUND_HP} from '../pvp/shared/match.js';
// KESINYAP mekanik: sayılı raund süresi kelime sayısına bağlı; testlerde "varsayılan raund süresi" = varsayılan sayılı raund (10 kelime → 60 sn).
const ROUND_DURATION_MS=roundDurationMs({roundStyle:'counted',roundWords:10}); // sayılı raund, 10 kelime → 60 sn
import {createArenaMatch,submitArenaPick,submitArenaWord,advanceArenaMatch,nextArenaDeadline,arenaMatchResult,
  ARENA_ROUND_DURATION_MS} from '../pvp/shared/arena.js';
import {arenaSummaryModel} from '../pvp/arena-ui.js';
import {roundsResultModel} from '../pvp/rounds-ui.js';
import {ARENA_FREEZE_MS} from '../pvp/shared/arena-skills.js';

const T0=10_000,R=ROUND_DURATION_MS,INTER=ROUND_SUMMARY_MS+ROUND_INTRO_MS;
const NO_BLOCK=()=>0.99;
const players=(c1='fire',c2='rune')=>[{playerId:'a',seat:1,character:c1,name:'Ada'},{playerId:'b',seat:2,character:c2,name:'Bora'}];
const seatOf=(m,s)=>m.participants.find(p=>p.seat===s);
const make=(opts={})=>createMatch(players(),T0,'m-i',{rounds:5,seed:123,roundStyle:'counted',...opts});
function type(m,seat,at,wrong=false){
  const p=seatOf(m,seat),word=m.round.words[p.roundWordIndex];
  const out=submitWord(m,{playerId:p.playerId,matchId:m.id,wordIndex:p.wordIndex,text:wrong?word+'x':word,round:m.round.index},at);
  assert.ok(out.match,'submit: '+out.error);return out.match;
}
/** `seat` yazarak üç doğru kelime (Q) atar; saldırı çözülür. */
function qHit(m,seat,at){
  for(let i=0;i<3;i++)m=type(m,seat,at+i*100);
  return advanceMatch(m,at+3*100+400,NO_BLOCK).match;
}

// ───────────────────────── I1: kazanan ─────────────────────────
test('I1 classic: rakibin canını 0\'a indiren maçı kazanır (KNOCKOUT)',()=>{
  let m=createMatch(players(),T0,'c-ko');
  seatOf(m,2).hp=1;
  for(let i=0;i<2;i++){
    const p=seatOf(m,1),word=p.currentWord;
    m=submitWord(m,{playerId:'a',matchId:m.id,wordIndex:p.wordIndex,text:word},T0+500+i*200).match;
  }
  m=advanceMatch(m,T0+2000,NO_BLOCK).match;
  assert.equal(m.status,'ended');assert.equal(m.endReason,'KNOCKOUT');assert.equal(m.winnerSeat,1);
  assert.equal(publicMatch(m,1).result.winnerSeat,1);
});

test('I1 rounds: nakavt eden maçı alır (can taşınır); hasar/RP geride olsa bile; sonuç kalan canı gösterir',()=>{
  // KESINYAP 11: raund galibiyeti yok; can 0'a inen maçı kaybeder (NAKAVT).
  let m=make();
  // Ada raund boyunca yanlış yazar (RP düşük), Bora çok doğru yazar → RP Bora'da; ama Ada nakavt eder.
  seatOf(m,2).hp=ROUND_HP;seatOf(m,1).hp=ROUND_HP;
  for(let i=0;i<4;i++)m=type(m,2,T0+100+i*100);
  seatOf(m,1).hp=ROUND_HP;seatOf(m,2).hp=5;
  m=qHit(m,1,T0+1000);
  const hist=m.roundHistory.at(-1);
  assert.equal(hist.reason,'KO');assert.equal(hist.winnerSeat,1);assert.equal(m.roundsWon,undefined);
  assert.equal(m.status,'ended');assert.equal(m.endReason,'KNOCKOUT');assert.equal(m.winnerSeat,1);
  assert.equal(roundsResultModel(publicMatch(m,1).result,'a').scoreline,`${seatOf(m,1).hp.toLocaleString('tr-TR')} – 0 · NAKAVT`);
});

test('I1 rounds: 7 raund sonunda canı fazla olan kazanır; sonuç ekranı kalan canı ve raund hasarlarını verir',()=>{
  // KESINYAP 11: '3 – 0' raund skoru yerine kalan can; her raundda Ada Q vurur, Bora vurmaz.
  let m=make();let rounds=0;
  while(m.status==='running'&&rounds++<8){
    m=qHit(m,1,m.round.startedAt+500);
    m=advanceMatch(m,m.round.endsAt+5000,NO_BLOCK).match;
    if(m.status==='running')m=advanceMatch(m,m.round.nextRoundAt,NO_BLOCK).match;
  }
  assert.equal(m.status,'ended');assert.equal(m.winnerSeat,1);assert.equal(m.endReason,'ROUNDS');assert.equal(m.roundHistory.length,7);
  const view=publicMatch(m,1),model=roundsResultModel(view.result,'a');
  const hp2=seatOf(m,2).hp;assert.ok(hp2<ROUND_HP);
  assert.equal(model.scoreline,`${ROUND_HP.toLocaleString('tr-TR')} – ${hp2.toLocaleString('tr-TR')} · 7 raund`);assert.equal(model.mySeat,1);
  assert.ok(model.rows.every(r=>/^\d+ – 0$/.test(r.damage)));
});

const vocab=Array.from({length:80},(_,i)=>`kelime${i}`);
const pickWords=({count,exclude=[]})=>vocab.filter(w=>!exclude.includes(w)).slice(0,count);
const arenaPlayers=[{seat:1,playerId:'a',name:'Ada',character:'fire'},{seat:2,playerId:'b',name:'Bora',character:'rune'}];
function arenaStart(){
  let m=createArenaMatch(arenaPlayers,0,'ar-i',{seed:42,pickWords});
  for(const [id,seat] of [['a',1],['b',2]])m=submitArenaPick(m,{playerId:id},0).match;
  return advanceArenaMatch(m,0,()=>0).match;
}
const aword=(m,seat,at)=>{const p=m.participants.find(x=>x.seat===seat);
  return submitArenaWord(m,{playerId:p.playerId,matchId:m.id,wordIndex:p.roundWordIndex,text:p.roundWords[p.roundWordIndex],round:m.round.index},at).match;};

test('I1 arena: nakavtla biten raundun kazananı nakavt eden oyuncudur (hasar sayısına bakılmaz)',()=>{
  // Bora daha çok kelime yazar → hasarda önde başlar; Ada son vuruşla nakavt eder.
  let m=arenaStart();
  m=aword(m,2,100);m=aword(m,2,200);m=aword(m,2,300);m=aword(m,1,400);
  seatOf(m,1).hp=1; // Ada'nın canı 1; Bora ilk vurur ama nakavt EDEN taraf Bora olacak
  seatOf(m,2).hp=1;
  m=advanceArenaMatch(m,ARENA_ROUND_DURATION_MS).match;
  let guard=0;while(m.status==='running'&&guard++<20)m=advanceArenaMatch(m,nextArenaDeadline(m),()=>0).match;
  assert.equal(m.status,'ended');assert.equal(m.endReason,'KNOCKOUT');
  const last=m.roundHistory.at(-1);
  assert.equal(last.reason,'KO');
  assert.equal(last.winnerSeat,m.winnerSeat,'raund kaydı nakavt edeni göstermeli');
  assert.equal(arenaMatchResult(m).rounds.at(-1).winnerSeat,m.winnerSeat);
});

test('I1 arena: damage\'ı az olan oyuncu nakavt ettiyse özet ve kayıt onu kazanan yazar',()=>{
  let m=arenaStart();
  // Ada tek kelime (hasar az), Bora 3 kelime (hasar çok). Ada'nın vuruşu önce gelir ve Bora'nın canı 1.
  m=aword(m,1,100);m=aword(m,2,200);m=aword(m,2,300);m=aword(m,2,400);
  seatOf(m,2).hp=1;
  m=advanceArenaMatch(m,ARENA_ROUND_DURATION_MS).match;
  let guard=0;while(m.status==='running'&&guard++<20)m=advanceArenaMatch(m,nextArenaDeadline(m),()=>0).match;
  assert.equal(m.status,'ended');assert.equal(m.winnerSeat,1);
  assert.equal(m.roundHistory.at(-1).winnerSeat,1);
  const view={matchId:m.id,round:{index:1,total:6,phase:'summary',words:[]},players:m.participants,roundResults:[]};
  const model=arenaSummaryModel(m.roundHistory.at(-1),view,'a',{damage:{1:10,2:500}});
  assert.equal(model.winnerSeat,1,'ekrandaki raund kazananı sunucu kaydı olmalı (damage değil)');
});

// ───────────────────────── I3: kelime akışı ─────────────────────────
test('I3 timed: süre bitene kadar kelime gelmeye devam eder; liste bitince oyuncu beklemez',()=>{
  let m=make({roundStyle:'timed'});
  assert.equal(m.roundStyle,'timed');
  seatOf(m,2).hp=1e9; // 60 doğru kelimelik Q/E/R yağmuru raundu nakavtla bitirmesin
  for(let i=0;i<60;i++){
    m=type(m,1,T0+200+i*100);
    assert.equal(seatOf(m,1).roundDone,false,`kelime ${i+1} sonrası bitmiş sayılmamalı`);
    assert.ok(m.round.words.length>seatOf(m,1).roundWordIndex,'sıradaki kelime hazır olmalı');
    assert.ok(seatOf(m,1).currentWord);
  }
  assert.ok(m.round.words.length>ROUND_WORDS);
  // Rakip hiç yazmadı: raund yine de süre dolunca biter (erken bitmez).
  const RT=roundDurationMs(m); // timed: 40 sn
  const early=advanceMatch(m,T0+RT-1,NO_BLOCK).match;assert.equal(early.round.phase,'round');
  const end=advanceMatch(m,T0+RT,NO_BLOCK).match;assert.notEqual(end.round.phase,'round');
});

test('I3 counted: kelime raundu planı (1. raund 5); son kelimede oyuncu tamamlar',()=>{
  // KESINYAP 11: plan [5,7,9,10,10,10,15].
  let m=make();
  assert.equal(m.roundStyle,'counted');assert.equal(m.round.words.length,5);
  for(let i=0;i<5;i++)m=type(m,1,T0+200+i*100);
  assert.equal(seatOf(m,1).roundDone,true);assert.equal(seatOf(m,1).roundWordIndex,5);
  const next=advanceMatch(m,m.round.endsAt,NO_BLOCK).match;
  assert.equal(next.round.phase==='round',false);
});

test('I3 zorlaşma: raund ilerledikçe kelime uzunluğu aralığı yükselir (timed uzatmalar dahil)',()=>{
  const lens=style=>{let m=createMatch(players(),T0,'z',{rounds:5,seed:77,roundStyle:style});const out=[];
    for(let r=1;r<=5;r++){
      if(style==='timed'){ // raundu tek oyuncu yazarak uzatır; galibiyet dönüşümlü olsun ki maç erken bitmesin
        const seat=r%2?1:2;seatOf(m,3-seat).hp=1e9;for(let i=0;i<14;i++)m=type(m,seat,m.round.startedAt+200+i*100);}
      const w=m.round.words.filter(Boolean);out.push({min:Math.min(...w.map(x=>x.length)),avg:w.reduce((s,x)=>s+x.length,0)/w.length});
      m=advanceMatch(m,m.round.endsAt,NO_BLOCK).match;if(m.status!=='running')break;m=advanceMatch(m,m.round.nextRoundAt,NO_BLOCK).match;}
    return out;};
  for(const style of ['counted','timed']){
    const l=lens(style);
    // KESINYAP 11: 7 raund → ilk 4 raund kolay (3–7), 5. raunddan itibaren normal (4–9).
    assert.ok(l.length>=5,style);
    assert.ok(l[0].min>=3,`${style} r1 min`);assert.ok(l[4].min>=4,`${style} r5 min>=4 (normal)`);
    assert.ok(l.at(-1).avg>=l[0].avg,`${style}: son raund ortalaması ilkinden kısa olmamalı`);
  }
});

// ─────────── skill → etki → hasar → can → raund sonu → sonraki raund → maç sonu ───────────
test('I3 uçtan uca: Donmuş An seçilir, süre +3 sn uygulanır, Q hasarı canı düşürür, KO raundu bitirir, maç biter',()=>{
  let m=make({roundStyle:'timed'}); // süre becerileri yalnız ZAMANA KARŞI'da geçerli (kelime raundunda etkisiz)
  // Raund 1: Ada üç doğru kelime → Q; Bora'nın canı düşer; süre dolar, Ada kazanır.
  m=qHit(m,1,T0+300);
  const dmg=ROUND_HP-seatOf(m,2).hp;
  assert.ok(dmg>0,'Q hasarı canı düşürmeli');
  assert.equal(seatOf(m,1).hp,ROUND_HP);
  m=advanceMatch(m,m.round.endsAt,NO_BLOCK).match;
  assert.equal(m.round.phase,'intermission');assert.equal(m.roundHistory.at(-1).winnerSeat,1); // KESINYAP 11: bilgi amaçlı (daha çok hasar)
  const R=roundDurationMs({roundStyle:'timed'}); // 30 sn
  // Ara: Bora Donmuş An seçer.
  const pick=pickRoundSkill(m,{playerId:'b',skill:'freeze'},m.round.endedAt+100);
  assert.ok(pick.match,pick.error);m=pick.match;
  m=advanceMatch(m,m.round.nextRoundAt,NO_BLOCK).match;
  assert.equal(m.round.index,2);
  assert.equal(ROUND_HP-seatOf(m,2).hp,dmg,'can 2. raunda taşındı');
  const startedAt=m.round.startedAt;
  assert.equal(seatOf(m,2).roundEndsAt,startedAt+R+ARENA_FREEZE_MS,'Donmuş An: yalnız seçenin süresi +3 sn');
  assert.equal(seatOf(m,1).roundEndsAt,startedAt+R);
  assert.equal(m.round.endsAt,startedAt+R+ARENA_FREEZE_MS,'raund en uzun kişisel süreyle biter');
  assert.equal(publicMatch(m,2).round.skills[2],'freeze');
  // Ada'nın süresi doldu ama Bora hâlâ yazabilir (+3 sn); Ada reddedilir.
  const late=startedAt+R+1000;
  assert.equal(submitWord(m,{playerId:'a',matchId:m.id,wordIndex:seatOf(m,1).wordIndex,text:m.round.words[0],round:2},late).error,'ROUND_NOT_ACTIVE');
  seatOf(m,1).hp=5; // Bora, ekstra sürede nakavt eder
  const bp=seatOf(m,2);
  for(let i=0;i<3;i++){const p=seatOf(m,2);m=submitWord(m,{playerId:'b',matchId:m.id,wordIndex:p.wordIndex,text:m.round.words[p.roundWordIndex],round:2},late+i*100).match;}
  void bp;
  m=advanceMatch(m,late+2000,NO_BLOCK).match;
  assert.equal(m.roundHistory.at(-1).reason,'KO');assert.equal(m.roundHistory.at(-1).winnerSeat,2);
  // KESINYAP 11: can taşındığı için nakavt maçı bitirir.
  assert.equal(m.status,'ended');assert.equal(m.winnerSeat,2);assert.equal(m.endReason,'KNOCKOUT');
  const res=matchResult(m);assert.equal(res.winnerSeat,2);assert.equal(res.finalHp[1],0);
});

test('I3 HUD: freezeSeats yalnız raund fazında Donmuş An kullananı verir',async()=>{
  const {freezeSeats}=await import('../pvp/match-info.js');
  const m={mode:'rounds',round:{phase:'round',skills:{1:null,2:'freeze'}},players:[]};
  assert.deepEqual(freezeSeats(m,'a'),[2]);
  assert.deepEqual(freezeSeats({...m,round:{...m.round,phase:'intermission'}},'a'),[]);
  const ar={mode:'arena',round:{phase:'round'},me:{picks:{skill:'freeze'}},players:[{seat:1,playerId:'a'},{seat:2,playerId:'b'}]};
  assert.deepEqual(freezeSeats(ar,'b'),[2]);
});
