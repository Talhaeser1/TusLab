// KESINYAP 21 — dört yetenek (Q W E R) raund modunda: 3 Q · 5 W · 7 E (savunma: kalkan YA can) · 10 R; sonra her 3. doğru Q.
// RAPOR-PVP-MEKANIK: raund tavanı yok, can 6000, E = 300 (kalkan ya da can), raund başına en çok 500.
// Motor anahtarları: q, e (= W yakın vuruş), h (= E can), r. Kullanıcı kuralı: "ulti sadece 10 tane üst üste yazarsa atılacak".
import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,submitWord,advanceMatch,nextDeadline,matchResult,publicMatch,streakSkill,healAmount,
  ROUND_HEAL_CAP,ROUND_HP,DAMAGE,STREAK_SKILLS,DEFENSE_AMOUNT} from '../pvp/shared/match.js';
import * as server from '../cloudflare/src/match.js';
import {FIGHTERS,BASE_FIGHTER_IDS as FIGHTER_IDS,SKILL_KEY,fighterSkill} from '../pvp/shared/fighters.js';

const T0=10_000;
const players=(c1='fire',c2='rune')=>[{playerId:'a',seat:1,character:c1,rune:'none',name:'A'},{playerId:'b',seat:2,character:c2,rune:'none',name:'B'}];
const make=(o={})=>createMatch(players(),T0,'dy',{rounds:7,seed:'dy',roundStyle:'timed',resolveAtEnd:true,...o});
const seat=(m,s)=>m.participants.find(p=>p.seat===s);
function type(m,s,at,wrong=false){
  const p=seat(m,s);const w=m.round.words[p.roundWordIndex];
  const out=submitWord(m,{playerId:p.playerId,matchId:m.id,wordIndex:p.wordIndex,text:wrong?w+'x':w,round:m.round.index},at);
  assert.ok(out.match,out.error);return out;
}
/** Raundu kapatır ve bir sonraki raund açılana (ya da maç bitene) dek ilerletir. */
function finishRound(m){
  const idx=m.round.index;
  for(let k=0;k<2000&&m.status==='running'&&m.round.index===idx;k++){
    const at=Math.max(nextDeadline(m)??m.round.endsAt,m.round.endsAt);
    m=advanceMatch(m,at+1,()=>0.99).match;
  }
  return m;
}

test('eşik tablosu: 3 Q · 5 W · 7 E · 10 R, sonra 13 ve her 8. kelime Q; tuş eşlemesi',()=>{
  assert.deepEqual({...STREAK_SKILLS},{3:'q',5:'e',7:'h',10:'r'});
  const table=Array.from({length:22},(_,i)=>streakSkill(i+1));
  // RAPOR-PVP-KALANLAR: 13'ten sonra zincir seyrek (CHAIN_EVERY_LONG=8 → 21, 29 …); önceden 16, 19 da Q'ydu.
  assert.deepEqual(table,[null,null,'q',null,'e',null,'h',null,null,'r',null,null,'q',null,null,null,null,null,null,null,'q',null]);
  assert.deepEqual(['q','e','h','r'].map(k=>SKILL_KEY[k]),['Q','W','E','R']);
});

test('maçta sıra: seri 3/5/7/10 → SKILL_CAST q, e, HEAL_APPLIED, r (R yalnız 10. seride)',()=>{
  let m=make();const got=[];
  for(let i=1;i<=13;i++){const out=type(m,1,T0+i*500);m=out.match;if(out.result.cast)got.push([i,out.result.cast.type,out.result.cast.skill]);}
  // resolveAtEnd: saldırılar raund sonunda; E hemen. Bekleyen saldırılar sıralı.
  assert.deepEqual(got,[[7,'HEAL_APPLIED','h']]);
  assert.deepEqual(m.pendingAttacks.filter(a=>!a.assist).map(a=>[a.streak,a.skill]),[[3,'q'],[5,'e'],[10,'r'],[13,'q']]);
  assert.equal(m.pendingAttacks.filter(a=>a.skill==='r').length,1);
});

test('E (can, Vargr): 300 can, çarpansız; azami canı ve raund sınırını (500) aşmaz; can doluyken bekletilir',()=>{
  assert.equal(healAmount(),DEFENSE_AMOUNT);assert.equal(DEFENSE_AMOUNT,300);assert.equal(ROUND_HEAL_CAP,500);
  // Tam canda (1. raund; hasar raund sonunda iner) E boşa GİTMEZ: bekletilir, ilk yenen darbeden sonra uygulanır.
  let m=make();let first=null;
  for(let i=1;i<=7;i++){const out=type(m,1,T0+i*400);m=out.match;if(out.result.cast?.type==='HEAL_APPLIED')first=out.result.cast;}
  assert.equal(first.kind,'heal');assert.equal(first.amount,0);assert.equal(first.banked,300);
  assert.equal(seat(m,1).hp,ROUND_HP);assert.equal(seat(m,1).healBank,300);assert.equal(seat(m,1).combatStats.casts.h,1);
  for(let i=1;i<=3;i++)m=type(m,2,T0+i*400+50).match; // rakip Q (100)
  m=finishRound(m);
  assert.equal(seat(m,1).hp,ROUND_HP,'100 hasar yendi, bekleyen candan 100 geri geldi');
  assert.equal(seat(m,1).combatStats.healDone,100);assert.equal(seat(m,1).healBank,0,'yeni raundda bekleyen can sıfır');
  // Yaralıyken: üç kez 7'ye çıkılırsa (yanlışta seri yarıya iner 7→3) 300 + 200 (sınır 500) + 0.
  m=make();seat(m,1).hp=2000;let t=T0;const heals=[];
  const word=(wrong)=>{t+=300;const out=type(m,1,t,wrong);m=out.match;if(out.result.cast?.type==='HEAL_APPLIED')heals.push(out.result.cast);};
  for(let i=0;i<7;i++)word();          // 7 → E
  for(let r=0;r<2;r++){word(true);for(let i=0;i<4;i++)word();} // 7→3, 3→7 → E (iki kez)
  assert.deepEqual(heals.map(h=>h.amount),[300,200,0]);
  assert.equal(heals[1].capped,true);assert.equal(heals[2].capped,true);
  assert.equal(seat(m,1).hp,2500);assert.equal(seat(m,1).roundHeal,ROUND_HEAL_CAP);
  assert.equal(publicMatch(m,1).players[0].roundHeal,500);
  // Yeni raundda sınır sıfırlanır.
  m=finishRound(m);assert.equal(m.round.index,2);assert.equal(seat(m,1).roundHeal,0);
});

test('R yalnız seri 10da; yarıya inen seri 10a yeniden çıkınca R yeniden atılır',()=>{
  let m=make();let t=T0;const w=wrong=>{t+=250;m=type(m,1,t,wrong).match;};
  for(let i=0;i<9;i++)w();
  assert.equal(m.pendingAttacks.filter(a=>a.skill==='r').length,0,'9. seride R yok');
  w(true); // 9 → 4
  for(let i=0;i<5;i++)w(); // 4 → 9
  assert.equal(m.pendingAttacks.filter(a=>a.skill==='r').length,0);
  w(); // 10 → R
  assert.equal(m.pendingAttacks.filter(a=>a.skill==='r').length,1);
  w(true); // 10 → 5 (W eşiği yeniden geçilmeli)
  for(let i=0;i<5;i++)w(); // 5 → 10: 7'de E, 10'da R
  const rs=m.pendingAttacks.filter(a=>a.skill==='r');
  assert.equal(rs.length,2);assert.ok(rs.every(a=>a.streak===10));
  assert.equal(seat(m,1).combatStats.casts.h,3,'7 eşiği üç kez geçildi (1→9, 4→9, 5→10)');
});

test('mükemmel oyun (iki taraf da kusursuz ~140 WPM): raund tavanı yok, yine de tek raundda nakavt yok',()=>{
  let m=make();const hpAfter=[];
  while(m.status==='running'&&m.round.index<=7){
    const start=m.round.startedAt;
    for(let i=0;i<65&&m.round.phase==='round';i++){const at=start+200+i*420;if(at>=m.round.endsAt)break;m=type(m,1,at).match;m=type(m,2,at+5).match;}
    m=finishRound(m);
    hpAfter.push(m.participants.map(p=>p.hp));
  }
  assert.equal(m.endReason,'KNOCKOUT');
  assert.ok(m.roundHistory[0].scores.every(s=>s.damageDealt>1300),'1300 tavanı yok');
  assert.ok(hpAfter[0].every(h=>h>0),'1. raundda nakavt yok');
  assert.ok(m.roundHistory.length>=2);
  const r=matchResult(m);
  for(const p of r.players)assert.ok(p.skillCasts.h>=1&&p.skillCasts.r>=1);
  assert.ok(r.players[0].healDone>0,'Vargr (can) iyileşti');
});

test('kelime raundu (5-7-9-10-10-10-15): kusursuz oyuncu pasif rakibe 7 raundda ~4000 vurur; nakavt yok, canı fazla olan kazanır',()=>{
  let m=make({roundStyle:'counted'});
  while(m.status==='running'&&m.round.index<=7){
    const start=m.round.startedAt;let i=0;
    while(m.status==='running'&&m.round.phase==='round'&&!seat(m,1).roundDone){m=type(m,1,start+200+(i++)*300).match;}
    m=finishRound(m);
  }
  assert.equal(m.endReason,'ROUNDS');assert.equal(m.winnerSeat,1);
  assert.deepEqual(m.roundHistory.map(r=>r.scores[0].damageDealt),[280,280,280,738,738,738,938],'tavan yok; 15 kelimede 13. kelime zincir Q');
  assert.equal(seat(m,2).hp,ROUND_HP-3992);
});

test('klasik değişmedi: döngü 2 Q · 4 E(yakın) · 5 R; can (h) yok',()=>{
  let m=createMatch(players(),T0,'cl',{exchangeMs:10000,seed:'cl'});const skills=[];
  for(let i=1;i<=10;i++){
    const p=seat(m,1);const out=submitWord(m,{playerId:'a',matchId:m.id,wordIndex:p.wordIndex,text:p.currentWord},T0+i*700);
    m=out.match;if(out.result.cast)skills.push(out.result.cast.skill);
  }
  for(const p of m.pendingAttacks)if(!p.assist&&p.fromSeat===1)skills.push(p.skill);
  assert.ok(!skills.includes('h'));assert.ok(skills.includes('q')&&skills.includes('e')&&skills.includes('r'));
  assert.equal(seat(m,1).hp,2000);
});

test('fighters.js: beş karakterde dört yetenek alanı (Q menzilli, W yakın, E can, R ulti) dolu; motor eşlemesi',()=>{
  assert.equal(FIGHTER_IDS.length,5);
  const motifs=new Set();
  for(const id of FIGHTER_IDS){
    const k=FIGHTERS[id].skills;
    for(const key of ['q','w','e','r'])assert.ok(k[key]?.name&&k[key]?.desc&&k[key]?.fx,`${id}.${key}`);
    assert.ok(k.w.clip&&k.q.clip&&k.r.clip);assert.ok(['heal','shield'].includes(k.e.defense));motifs.add(k.e.motif);
    assert.equal(fighterSkill(id,'e'),k.w,'motor e → W');assert.equal(fighterSkill(id,'h'),k.e,'motor h → E');
  }
  assert.equal(motifs.size,5,'her karakterin can efekti farklı motif');
  assert.equal(FIGHTERS.konyali.skills.e.name,'Şerbet Molası');
});

test('sunucu–istemci aynı can kuralı (cloudflare yeniden ihraç)',()=>{
  for(const k of ['healAmount','ROUND_HEAL_CAP','DEFENSE_AMOUNT','streakSkill','STREAK_SKILLS'])assert.equal(server[k],k in server?server[k]:undefined,k);
  assert.equal(server.healAmount,healAmount);assert.equal(server.ROUND_HEAL_CAP,ROUND_HEAL_CAP);assert.equal(server.streakSkill,streakSkill);
});
