// RAPOR-PVP-MEKANIK (23 Kas 2026): raund tavanı yok · ulti en çok ×2 · E savunma = kalkan YA can · Şerbet çalışır ·
// çözüm sırası hıza göre (1. koltuk kayırılmaz) · karakter başına tohumlu bot zekâsı.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '../pvp/shared/match.js';
import * as server from '../cloudflare/src/match.js';
import {FIGHTERS,BASE_FIGHTER_IDS as FIGHTER_IDS,fighterDefense} from '../pvp/shared/fighters.js';
import {decideBotPlan,botContext,personaOf,pickBotTimeSkill,applyPlan,BOT_PERSONAS,BOT_PLANS} from '../pvp/shared/bot-ai.js';
import {createRng} from '../pvp/shared/words.js';
import {createPracticeSession,BOT_DIFFICULTIES} from '../pvp/practice.js';
const {createMatch,submitWord,advanceMatch,nextDeadline,publicMatch,roundStartPayload,ROUND_HP,DEFENSE_AMOUNT,SHIELD_AMOUNT,ROUND_HEAL_CAP,ULTIMATE_MULTIPLIER_CAP}=engine;

const T0=50_000;
const make=(f1,f2,o={})=>createMatch([{playerId:'a',seat:1,character:FIGHTERS[f1].archetype,fighter:f1},{playerId:'b',seat:2,character:FIGHTERS[f2].archetype,fighter:f2}],T0,'ms',{rounds:7,roundStyle:'timed',seed:'ms',resolveAtEnd:true,...o});
const seat=(m,s)=>m.participants.find(p=>p.seat===s);
function type(m,s,at,wrong=false){
  const p=seat(m,s);const w=m.round.words[p.roundWordIndex];
  const out=submitWord(m,{playerId:p.playerId,matchId:m.id,wordIndex:p.wordIndex,text:wrong?w+'x':w,round:m.round.index},at);
  assert.ok(out.match,out.error);return out;
}
function finishRound(m){
  const idx=m.round.index,events=[];
  for(let k=0;k<2000&&m.status==='running'&&m.round.index===idx;k++){
    const at=Math.max(nextDeadline(m)??m.round.endsAt,m.round.endsAt);
    const step=advanceMatch(m,at+1,()=>0.99);m=step.match;events.push(...step.events);
  }
  return {m,events};
}

test('madde 3: ROUND_DAMAGE_CAP kalktı (motor, sunucu, anlık görüntü); 1300 üstü raund hasarı geçer',()=>{
  assert.equal('ROUND_DAMAGE_CAP' in engine,false);assert.equal('ROUND_DAMAGE_CAP' in server,false);
  let m=make('vargr','doran');
  for(let i=0;i<40;i++)m=type(m,1,T0+200+i*500).match;
  assert.equal('damageCap' in publicMatch(m,1),false);assert.equal('damageCap' in roundStartPayload(m),false);
  ({m}=finishRound(m));
  assert.ok(m.roundHistory[0].scores[0].damageDealt>1300,`raund hasarı ${m.roundHistory[0].scores[0].damageDealt}`);
});

test('madde 4: tek sıradan vuruş canın %4ünü geçmez; aynı hızdaki iki kusursuz oyuncu 1. raundda nakavt olmaz',()=>{
  let m=make('sira','nyx');const hits=[];
  for(let r=0;r<2&&m.status==='running';r++){
    const start=m.round.startedAt;
    for(let i=0;i<45;i++){const at=start+300+i*640;if(at>=m.round.endsAt)break;m=type(m,1,at).match;m=type(m,2,at+7).match;}
    const out=finishRound(m);m=out.m;hits.push(...out.events.filter(e=>e.type==='DAMAGE_APPLIED'));
    if(r===0)assert.ok(m.participants.every(p=>p.hp>ROUND_HP/2),'1. raund sonunda iki taraf da canının yarısından fazlasında');
  }
  const single=hits.filter(e=>!e.ultimateId);
  assert.ok(single.length>10);
  for(const e of single)assert.ok(e.amount+(e.absorbed||0)<=ROUND_HP*0.04,`${e.skill} ${e.amount}`);
});

test('madde 4: çözüm sırası koltuktan değil hızdan — ilk becerisini önce yazan önce vurur (destek sayılmaz)',()=>{
  let m=make('vargr','doran');
  for(let i=1;i<=3;i++)m=type(m,2,T0+100+i*200).match; // 2. koltuk Q'yu önce yazdı
  for(let i=1;i<=3;i++)m=type(m,1,T0+2000+i*200).match;
  const step=advanceMatch(m,m.round.endsAt+1,()=>0.99);
  const order=step.match.pendingAttacks.concat().sort((a,b)=>a.turn-b.turn).map(a=>a.fromSeat);
  assert.equal(order[0],2);
  // Tersi: 1. koltuk önce yazarsa 1. koltuk başlar.
  let n=make('vargr','doran');
  for(let i=1;i<=3;i++)n=type(n,1,T0+100+i*200).match;
  for(let i=1;i<=3;i++)n=type(n,2,T0+2000+i*200).match;
  assert.equal(advanceMatch(n,n.round.endsAt+1,()=>0.99).match.pendingAttacks.concat().sort((a,b)=>a.turn-b.turn)[0].fromSeat,1);
});

test('madde 2: ulti (R) çarpanı en çok ×2; tüm R atışlarında multiplier ≤ ULTIMATE_MULTIPLIER_CAP',()=>{
  assert.equal(ULTIMATE_MULTIPLIER_CAP,2);
  let m=make('vargr','doran');let t=T0;const rs=[];
  const w=wrong=>{t+=260;const out=type(m,1,t,wrong);m=out.match;};
  for(let k=0;k<3;k++){for(let i=0;i<14;i++)w();w(true);}
  for(const a of m.pendingAttacks.filter(a=>a.skill==='r'))rs.push(a.multiplier);
  assert.ok(rs.length>=2);assert.ok(rs.every(x=>x<=2),String(rs));
  assert.ok(engine.streakMultiplier(30)<=2);
});

test('madde 5: her karakterin E savunması YA kalkan YA can; tablo',()=>{
  const table=Object.fromEntries(FIGHTER_IDS.map(id=>[id,fighterDefense(id)]));
  assert.deepEqual(table,{vargr:'heal',sira:'shield',doran:'shield',nyx:'heal',konyali:'heal'});
  for(const id of FIGHTER_IDS){const e=FIGHTERS[id].skills.e;assert.ok(Boolean(e.heal)!==Boolean(e.shield),`${id}: tam biri`);}
  assert.equal(fighterDefense('yok'),'heal');
});

test('madde 5: Doran kalkanı 330 hasar emer (RAPOR-PVP-KALANLAR: 300 → 330), biterse SHIELD_BROKEN; HUD için shieldHp yayınlanır; raund sonunda söner',()=>{
  let m=make('vargr','doran');let shieldCast=null;
  for(let i=1;i<=7;i++){const out=type(m,2,T0+i*300);m=out.match;if(out.result.cast?.type==='HEAL_APPLIED')shieldCast=out.result.cast;}
  assert.equal(shieldCast.kind,'shield');assert.equal(shieldCast.amount,0);assert.equal(SHIELD_AMOUNT,330);assert.equal(shieldCast.shield,SHIELD_AMOUNT);assert.equal(shieldCast.shieldAdded,330);
  assert.equal(seat(m,2).hp,ROUND_HP);assert.equal(publicMatch(m,1).players[1].shieldHp,330);
  for(let i=1;i<=10;i++)m=type(m,1,T0+40+i*300).match; // Q 100 · W 180 · R 458
  const {m:after,events}=finishRound(m);
  const dmg=events.filter(e=>e.type==='DAMAGE_APPLIED'&&e.toSeat===2);
  assert.equal(dmg.reduce((s,e)=>s+(e.absorbed||0),0),330);
  assert.equal(seat(after,2).hp,ROUND_HP-(100+180+458-330));
  assert.ok(events.some(e=>e.type==='SHIELD_BROKEN'&&e.seat===2&&e.kind==='e-shield'));
  assert.equal(seat(after,2).shieldHp,0);
});

test('madde 6: Hacı Usta (konyali) Şerbet Molası canı artırır, azami canda durur; 1. raundda boşa gitmez',()=>{
  // Kök neden (eski motor): resolveAtEnd'de hasar raund sonunda iner → 1. raundda E atıldığında can hep doluydu → amount 0.
  let m=make('vargr','konyali');let heal=null;
  for(let i=1;i<=3;i++)m=type(m,1,T0+i*300).match;
  for(let i=1;i<=7;i++){const out=type(m,2,T0+50+i*300);m=out.match;if(out.result.cast?.type==='HEAL_APPLIED')heal=out.result.cast;}
  assert.equal(heal.kind,'heal');assert.equal(heal.banked,300);
  const {m:a,events}=finishRound(m);
  assert.equal(seat(a,2).hp,ROUND_HP,'Q 100 vurdu, şerbet 100 geri verdi, azami canı aşmadı');
  assert.ok(events.some(e=>e.type==='HEAL_APPLIED'&&e.seat===2&&e.banked&&e.amount===100));
  // Yaralıyken anında ve azami canla sınırlı.
  let w=make('vargr','konyali');seat(w,2).hp=ROUND_HP-120;
  for(let i=1;i<=7;i++)w=type(w,2,T0+i*300).match;
  assert.equal(seat(w,2).hp,ROUND_HP);assert.ok(seat(w,2).hp<=seat(w,2).maxHp);
  let x=make('vargr','konyali');seat(x,2).hp=1000;
  for(let i=1;i<=7;i++)x=type(x,2,T0+i*300).match;
  assert.equal(seat(x,2).hp,1300);assert.ok(seat(x,2).roundHeal<=ROUND_HEAL_CAP);
});

test('madde 7: bot zekâsı saf ve tohumla deterministik; karakter ağırlıkları farklı',()=>{
  const ctx={rounds:true,hp:2000,maxHp:6000,foeHp:5000,foeMaxHp:6000,streak:3,foeStreak:8,defenseUsed:false,foeLastDamage:1400,timeLeft:0.6};
  const run=seed=>{const r=createRng(seed);return Array.from({length:20},()=>decideBotPlan(ctx,personaOf('doran'),r,'shield').plan);};
  assert.deepEqual(run('s1'),run('s1'));
  assert.notDeepEqual(new Set(FIGHTER_IDS.map(id=>JSON.stringify(BOT_PERSONAS[id]))).size,1);
  for(const id of FIGHTER_IDS)for(const k of ['aggro','guard','sustain','burst','noise'])assert.ok(BOT_PERSONAS[id][k]>=0&&BOT_PERSONAS[id][k]<=1,`${id}.${k}`);
  // Planlar yalnız hız/hata çarpanı; typo en çok 0,5.
  assert.deepEqual(Object.keys(BOT_PLANS).sort(),['careful','push','steady']);
  assert.ok(applyPlan(BOT_DIFFICULTIES.kolay,'push').typo<=0.5);
});

test('madde 7: tepkisel savunma — rakip ultiye yakınken kalkanlı Doran, düşük canda canlı Hacı Usta E için dikkatli yazar',()=>{
  const none=()=>0.5; // gürültü 0
  const base={rounds:true,hp:6000,maxHp:6000,foeHp:6000,foeMaxHp:6000,streak:2,foeStreak:2,defenseUsed:false,foeLastDamage:0,timeLeft:0.9};
  assert.equal(decideBotPlan({...base,foeStreak:8},personaOf('doran'),none,'shield').goal,'h');
  assert.equal(decideBotPlan({...base,hp:1500,foeLastDamage:1500},personaOf('konyali'),none,'heal').goal,'h');
  assert.equal(decideBotPlan({...base,hp:1500,foeLastDamage:1500},personaOf('konyali'),none,'heal').plan,'careful');
  // E bu raund kullanıldıysa savunma hedefi yok.
  assert.notEqual(decideBotPlan({...base,foeStreak:8,defenseUsed:true},personaOf('doran'),none,'shield').goal,'h');
  // Rakip bitmek üzere: saldırgan Vargr hızlanır.
  assert.equal(decideBotPlan({...base,foeHp:500,streak:1},personaOf('vargr'),none,'heal').plan,'push');
  // R'ye yakın Nyx seriyi korur.
  assert.equal(decideBotPlan({...base,streak:8},personaOf('nyx'),none,'heal').goal,'r');
  // Süre becerisi: yalnız listeden, şans tutmazsa null.
  assert.equal(pickBotTimeSkill(base,personaOf('vargr'),()=>0.99,{available:['freeze'],chance:0.5}),null);
  assert.ok(['timethief','freeze','blindclock'].includes(pickBotTimeSkill(base,personaOf('vargr'),()=>0.1,{available:['timethief','freeze','blindclock'],chance:0.5})));
});

test('madde 7: botContext motor durumundan doğru girdileri çıkarır',()=>{
  let m=make('vargr','doran');
  for(let i=1;i<=4;i++)m=type(m,2,T0+i*300).match;
  const c=botContext(m,2,T0+2000);
  assert.equal(c.rounds,true);assert.equal(c.streak,4);assert.equal(c.foeStreak,0);assert.equal(c.hp,ROUND_HP);assert.ok(c.timeLeft>0&&c.timeLeft<=1);
});

test('madde 7: antrenman botu aynı tohumla aynı maçı oynar ve plan seçer (botAi:false eski davranış)',()=>{
  const runOnce=botAi=>{
    let t=1_000_000;const timers=[];let id=0;
    const scheduler={setTimeout:(fn,ms)=>{const h=++id;timers.push({h,at:t+ms,fn});return h;},clearTimeout:h=>{const i=timers.findIndex(x=>x.h===h);if(i>=0)timers.splice(i,1);},
      setInterval:(fn,ms)=>{const h=++id;const tick={h,at:t+ms,fn:()=>{tick.at=t+ms;timers.push(tick);fn();},every:ms};timers.push(tick);return h;},clearInterval:h=>{const i=timers.findIndex(x=>x.h===h);if(i>=0)timers.splice(i,1);}};
    const rng=createRng('prac');
    const s=createPracticeSession({mode:'rounds',fighter:'vargr',botFighter:'konyali',difficulty:'orta',rng,now:()=>t,scheduler,createId:()=>'pm',botAi});
    s.start();
    for(let k=0;k<4000&&timers.length&&s.match?.status==='running'&&t<1_000_000+120_000;k++){timers.sort((a,b)=>a.at-b.at);const x=timers.shift();t=Math.max(t,x.at);x.fn();}
    const plan=s.botPlan;const bot=s.match.participants.find(p=>p.playerId==='practice-bot');const out={words:bot.wordIndex,hp:s.match.participants.map(p=>p.hp),plan:plan?.plan??null};
    s.dispose();return out;
  };
  const a=runOnce(true),b=runOnce(true),off=runOnce(false);
  assert.deepEqual(a,b,'aynı tohum → aynı sonuç');
  assert.ok(a.words>5);assert.ok(['push','steady','careful'].includes(a.plan));
  assert.equal(off.plan,null,'botAi:false → plan yok');
});
