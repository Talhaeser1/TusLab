import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,publicMatch,submitWord,advanceMatch,nextDeadline,roundScore,streakMultiplier,roundStartPayload,
  pauseMatch,resumeMatch,surrenderMatch,matchResult,finishMatch,
  ROUND_OPTIONS,ROUND_WORDS,ROUND_DURATION_MS,ROUND_LAST_CALL_MS,ROUND_SETTLE_MS,ROUND_SUMMARY_MS,ROUND_INTRO_MS,
  ROUND_HP,SUDDEN_DEATH_MAX,STREAK_SKILLS,MULTIPLIER_START,MULTIPLIER_STEP,MULTIPLIER_CAP,ROUND_SCORE,
  RUNE_IDS,MATCH_DURATION_MS,MATCH_HP,SERVER_ONLY_EVENTS} from '../pvp/shared/match.js';

const T0=10_000;
const R=ROUND_DURATION_MS;                     // tur yazma süresi
const INTER=ROUND_SUMMARY_MS+ROUND_INTRO_MS;    // tur kapanışı → sonraki tur başlangıcı
const players=(c1='fire',c2='rune',r1='none',r2='none')=>[
  {playerId:'a',seat:1,character:c1,rune:r1,name:'A'},{playerId:'b',seat:2,character:c2,rune:r2,name:'B'}];
const make=(opts={},chars=[])=>createMatch(players(...chars),T0,'m1',{rounds:5,seed:123,...opts});
const seatOf=(m,seat)=>m.participants.find(p=>p.seat===seat);
function type(m,seat,at,{wrong=false,round}={}){
  const p=seatOf(m,seat);const word=m.round.words[p.roundWordIndex];
  const out=submitWord(m,{playerId:p.playerId,matchId:m.id,wordIndex:p.wordIndex,text:wrong?word+'x':word,round},at);
  assert.ok(out.match,'submit failed: '+out.error);return out;
}
const NO_BLOCK=()=>0.99;
/** Plays a full round: `winner` types one correct word, nobody else types; ends at nextRoundAt. */
function playRound(m,winner){
  const start=m.round.startedAt;
  if(winner)m=type(m,winner,start+100).match;
  const ended=advanceMatch(m,m.round.endsAt,NO_BLOCK);m=ended.match;
  if(m.status==='ended')return {m,events:ended.roundEvents};
  const next=advanceMatch(m,m.round.nextRoundAt,NO_BLOCK);
  return {m:next.match,events:[...ended.roundEvents,...next.roundEvents]};
}
/** Perfect round for seat 1 against a passive defender; returns damage after each word and KO word. */
function perfectRound(character,rune,qOffset=0){
  let m=createMatch(players(character,'fire',rune,'none'),T0,'bal',{rounds:5,seed:7});
  seatOf(m,1).combatStats.casts.q=qOffset;
  const dealt=[];let koAt=null;
  for(let i=1;i<=10;i++){
    const at=T0+i*1000;
    m=type(m,1,at).match;
    m=advanceMatch(m,at+900,NO_BLOCK).match;
    const last=m.roundHistory.at(-1);
    if(last&&last.reason==='KO'){koAt=i;dealt.push(ROUND_HP);break;}
    dealt.push(ROUND_HP-seatOf(m,2).hp);
  }
  return {dealt,koAt};
}

test('rounds: constants match the specification',()=>{
  assert.deepEqual([...ROUND_OPTIONS],[5,7,10]);
  assert.equal(ROUND_WORDS,10);assert.equal(ROUND_DURATION_MS,40_000);assert.equal(ROUND_LAST_CALL_MS,5_000);
  assert.equal(ROUND_SETTLE_MS,1_000);assert.equal(ROUND_SUMMARY_MS,6_000);assert.equal(ROUND_INTRO_MS,3_000);
  assert.equal(ROUND_HP,1200);assert.equal(SUDDEN_DEATH_MAX,3);
  assert.deepEqual({...STREAK_SKILLS},{3:'q',5:'e',7:'r',8:'q',9:'q',10:'q'});
  assert.equal(MULTIPLIER_START,7);assert.equal(MULTIPLIER_STEP,1.2);assert.equal(MULTIPLIER_CAP,2.5);
  assert.deepEqual({...ROUND_SCORE},{correct:100,bestStreak:50,damageDiv:10});
  for(const t of ['ROUND_START','ROUND_LAST_CALL','ROUND_END','WORD_CLASH'])assert.ok(SERVER_ONLY_EVENTS.has(t),t);
});

test('rounds: createMatch without options stays classic',()=>{
  const m=createMatch(players(),T0,'c');
  assert.equal(m.endsAt,T0+MATCH_DURATION_MS);assert.equal(m.participants[0].hp,MATCH_HP);
  assert.equal(m.mode,undefined);assert.equal(m.round,undefined);
  const view=publicMatch(m);assert.equal(view.mode,'classic');assert.equal(view.round,null);
  assert.equal(view.players[0].streak,undefined);
  assert.equal(nextDeadline(m),m.endsAt);
});

test('rounds: 5/7/10 accepted, anything else falls back to 5',()=>{
  for(const n of [5,7,10])assert.equal(make({rounds:n}).totalRounds,n);
  for(const bad of [3,6,'7',0,-5,11,null,1.5])assert.equal(make({rounds:bad}).totalRounds,5,String(bad));
  const m=make();
  assert.equal(m.mode,'rounds');assert.equal(m.round.index,1);assert.equal(m.round.phase,'round');
  assert.equal(m.round.endsAt,T0+ROUND_DURATION_MS);assert.equal(m.endsAt,m.round.endsAt);
  assert.deepEqual(m.participants.map(p=>p.hp),[ROUND_HP,ROUND_HP]);
});

test('rounds: both players get the same 10 words; same seed → same words; no repeats between rounds',()=>{
  const a=make({seed:999}),b=make({seed:999}),c=make({seed:1000});
  assert.equal(a.round.words.length,ROUND_WORDS);
  assert.deepEqual(a.round.words,b.round.words);
  assert.notDeepEqual(a.round.words,c.round.words);
  const view=publicMatch(a);
  assert.deepEqual(view.players[0].currentWord,a.round.words[0]);assert.equal(view.players[1].currentWord,a.round.words[0]);
  assert.equal(view.players[0].activeText,a.round.words.join(' '));
  let m=a;const seen=new Set(m.round.words);
  for(let r=2;r<=5;r++){
    m=playRound(m,null).m;assert.equal(m.round.index,r);
    for(const w of m.round.words){assert.ok(!seen.has(w),'repeat '+w);seen.add(w);}
    assert.equal(new Set(m.round.words).size,ROUND_WORDS);
  }
  assert.equal(seen.size,50);
});

test('rounds: word length ramps with round number',()=>{
  let m=make({rounds:5});
  const lengths=[];
  for(let r=1;r<=8&&m.status==='running';r++){lengths.push({r,sd:m.round.suddenDeath,w:m.round.words});m=playRound(m,null).m;}
  for(const {r,sd,w} of lengths){
    const [lo,hi]=sd?[5,10]:r<=3?[3,7]:[4,9];
    for(const word of w)assert.ok([...word].length>=lo&&[...word].length<=hi,`r${r} ${word}`);
  }
  assert.equal(lengths.filter(x=>x.sd).length,3);
});

test('rounds: injected pickWords receives string seeds and the exclusion list',()=>{
  const calls=[];let n=0;
  const pickWords=args=>{calls.push(structuredClone(args));return Array.from({length:args.count},()=>`k${n++}`);};
  const m=make({seed:42,pickWords});
  assert.equal(calls[0].seed,'42:r1');assert.equal(calls[0].count,10);assert.deepEqual(calls[0].exclude,[]);
  assert.equal(calls[1].seed,'42:r2');assert.deepEqual(calls[1].exclude,m.round.words);
  assert.deepEqual(m.round.words,['k0','k1','k2','k3','k4','k5','k6','k7','k8','k9']);
  structuredClone(m); // must stay storable (no functions inside)
});

test('rounds: publicMatch never leaks the seed or future words',()=>{
  const m=make({seed:4242424});
  const view=publicMatch(m);
  for(const key of ['seed','usedWords','roundPlan'])assert.equal(key in view,false,key);
  const json=JSON.stringify(view);
  assert.ok(!json.includes('4242424'));
  assert.ok(!m.roundPlan[1].some(w=>view.round.words.includes(w)));
  assert.deepEqual(Object.keys(view.round).sort(),['endsAt','index','nextRoundAt','phase','settleUntil','startedAt','suddenDeath','total','words']);
  assert.equal(view.mode,'rounds');assert.equal(view.totalRounds,5);assert.deepEqual(view.roundsWon,{1:0,2:0});
  assert.deepEqual(view.roundHistory,[]);
  for(const k of ['streak','multiplier','nextSkill','roundWordIndex','roundCorrect','roundWrong','roundBestStreak','roundDamage','roundDone','finishedAt'])
    assert.ok(k in view.players[0],k);
  assert.equal(view.players[0].nextSkill,null);assert.equal(view.players[0].multiplier,1);
});

test('rounds: a wrong word consumes the attempt and resets the streak',()=>{
  let m=make();
  m=type(m,1,T0+1000).match;m=type(m,1,T0+2000).match;
  const out=type(m,1,T0+3000,{wrong:true});m=out.match;
  const p=seatOf(m,1);
  assert.equal(out.result.correct,false);assert.equal(p.combo,0);assert.equal(out.result.streak,0);
  assert.equal(p.roundWordIndex,3);assert.equal(p.roundWrong,1);assert.equal(p.roundCorrect,2);assert.equal(p.roundBestStreak,2);
  assert.equal(p.currentWord,m.round.words[3]);
  assert.equal(out.result.roundWordIndex,3);assert.equal(out.result.nextSkill,null);
  assert.equal(m.pendingAttacks.length,0);
});

test('rounds: streak → skill mapping, chain flags and the §4 damage table (fire and rune)',()=>{
  const fire=perfectRound('fire','none'),rune=perfectRound('rune','none');
  assert.deepEqual(fire.dealt,[0,0,105,105,280,280,738,927,1154,1200]);assert.equal(fire.koAt,10);
  assert.deepEqual(rune.dealt,[0,0,95,95,280,280,738,909,1114,1200]);assert.equal(rune.koAt,10);
  let m=make();const casts=[];
  for(let i=1;i<=10;i++){
    const out=type(m,1,T0+i*1000);m=advanceMatch(out.match,T0+i*1000+900,NO_BLOCK).match;
    if(out.result.cast)casts.push(out.result.cast);
    assert.equal(out.result.streak,i);
    assert.equal(out.result.nextSkill,STREAK_SKILLS[i+1]||null);
    if(m.status!=='running'||m.round.index!==1)break;
  }
  assert.deepEqual(casts.map(c=>[c.streak,c.skill,c.chain,c.multiplier,c.roundWordIndex]),
    [[3,'q',false,1,2],[5,'e',false,1,4],[7,'r',false,1.5,6],[8,'q',true,1.8,7],[9,'q',true,2.16,8],[10,'q',true,2.5,9]]);
});

test('rounds: multiplier curve caps at 2.5',()=>{
  assert.deepEqual([0,1,3,6,7,8,9,10,11,25].map(streakMultiplier),[1,1,1,1,1.5,1.8,2.16,2.5,2.5,2.5]);
});

test('rounds: balance — no character × rune combination can KO before the 9th correct word',()=>{
  for(const character of ['fire','rune'])for(const rune of RUNE_IDS)for(const qOffset of [0,1,2]){
    const {koAt,dealt}=perfectRound(character,rune,qOffset);
    assert.ok(koAt===null||koAt>=9,`${character}+${rune}+${qOffset}: KO at ${koAt} ${dealt}`);
    if(rune==='none')assert.equal(koAt,10,`${character} without rune must KO exactly on word 10`);
  }
  assert.equal(perfectRound('fire','rhythm').koAt,9);
});

test('rounds: ULTIMATE_PHASE carries motion, multiplier and returnAt',()=>{
  let m=make();const phases=[];
  for(let i=1;i<=7;i++){m=type(m,1,T0+i*1000).match;const adv=advanceMatch(m,T0+i*1000+900,NO_BLOCK);m=adv.match;phases.push(...adv.events.filter(e=>e.type==='ULTIMATE_PHASE'));}
  assert.deepEqual(phases.map(p=>p.motion),['pull','strike','return']);
  assert.ok(phases.every(p=>p.multiplier===1.5));
  const third=phases[2];assert.ok(phases.every(p=>p.returnAt===third.at+400));
  assert.deepEqual(phases.map(p=>p.amount),[98,150,210]);
});

test('rounds: the 10th attempt locks input, emits ROUND_LAST_CALL and clamps endsAt',()=>{
  let m=make();let last;
  for(let i=1;i<=10;i++){last=type(m,1,T0+i*300,{wrong:i%2===0});m=last.match;}
  const p=seatOf(m,1);assert.equal(p.roundDone,true);assert.equal(p.finishedAt,T0+3000);
  assert.equal(last.result.roundDone,true);
  assert.deepEqual(last.result.roundEvents.map(({type,payload})=>({type,payload})),[{type:'ROUND_LAST_CALL',payload:{round:1,finishedSeat:1,endsAt:T0+3000+ROUND_LAST_CALL_MS}}]);
  assert.equal(last.result.roundEvents[0].sequence,m.sequence);
  assert.equal(m.round.endsAt,T0+3000+ROUND_LAST_CALL_MS);assert.equal(m.endsAt,m.round.endsAt);
  const again=submitWord(m,{playerId:'a',matchId:m.id,wordIndex:p.wordIndex,text:'x'},T0+4000);
  assert.equal(again.error,'ROUND_COMPLETE');
  // A late finisher never extends the deadline.
  let late=make();for(let i=1;i<=10;i++)late=type(late,1,T0+R-2_000+i*100).match;
  assert.equal(late.round.endsAt,T0+ROUND_DURATION_MS);
});

test('rounds: both players finishing ends the round with ALL_DONE',()=>{
  let m=make();
  for(let i=1;i<=10;i++){m=type(m,1,T0+i*300,{wrong:true}).match;m=type(m,2,T0+i*300+10,{wrong:i!==10}).match;}
  assert.equal(m.round.endsAt,T0+3010);
  const adv=advanceMatch(m,T0+3010,NO_BLOCK);
  const end=adv.roundEvents.find(e=>e.type==='ROUND_END');
  assert.equal(end.payload.reason,'ALL_DONE');assert.equal(end.payload.winnerSeat,2);
  assert.equal(end.payload.nextRoundAt,T0+3010+ROUND_SUMMARY_MS+ROUND_INTRO_MS);
  assert.equal(adv.match.round.phase,'intermission');
});

test('rounds: time → settling → an in-flight ultimate completes → round end',()=>{
  let m=make();
  for(let i=1;i<=6;i++){m=type(m,1,T0+i*1000).match;m=advanceMatch(m,T0+i*1000+900,NO_BLOCK).match;}
  m=type(m,1,T0+R-100).match;
  assert.equal(submitWord(m,{playerId:'b',matchId:m.id,wordIndex:0,text:m.round.words[0]},T0+R).error,'ROUND_NOT_ACTIVE');
  let adv=advanceMatch(m,T0+R,NO_BLOCK);m=adv.match;
  assert.equal(m.round.phase,'settling');assert.equal(m.round.settleUntil,T0+R+ROUND_SETTLE_MS);
  assert.equal(adv.roundEvents.length,0);assert.equal(nextDeadline(m),T0+R-100+250);
  adv=advanceMatch(m,T0+R+700,NO_BLOCK);m=adv.match;
  assert.equal(adv.events.filter(e=>e.type==='ULTIMATE_PHASE').length,3);
  const end=adv.roundEvents.at(-1);
  assert.equal(end.type,'ROUND_END');assert.equal(end.payload.reason,'TIME');assert.equal(end.payload.winnerSeat,1);
  assert.equal(seatOf(m,2).hp,ROUND_HP-738);
  assert.equal(end.payload.nextRoundAt,T0+R-100+250+420+ROUND_SUMMARY_MS+ROUND_INTRO_MS);
  const s1=end.payload.scores.find(s=>s.seat===1);
  assert.deepEqual(s1,{seat:1,correct:7,wrong:0,bestStreak:7,damageDealt:738,hpLeft:ROUND_HP,rp:700+350+73,lastCorrectAt:T0+R-100});
});

test('rounds: settling drops attacks that would land after settleUntil',()=>{
  let m=make();
  m.pendingAttacks.push({fromSeat:2,toSeat:1,skill:'q',character:'rune',amount:95,issuedAt:T0+R-10,resolveAt:T0+R+2_000,round:1});
  const adv=advanceMatch(m,T0+R+10_000,NO_BLOCK);
  const end=adv.roundEvents.find(e=>e.type==='ROUND_END');
  assert.equal(end.payload.nextRoundAt,T0+R+ROUND_SETTLE_MS+INTER);
  assert.equal(adv.match.pendingAttacks.length,0);
});

test('rounds: a KO ends the round immediately and clears pending attacks',()=>{
  let m=make();seatOf(m,2).hp=50;
  for(let i=1;i<=3;i++)m=type(m,1,T0+i*1000).match;
  m.pendingAttacks.push({fromSeat:2,toSeat:1,skill:'counter',character:'rune',amount:65,issuedAt:T0+3000,resolveAt:T0+3300,unblockable:true,counter:true,round:1});
  const adv=advanceMatch(m,T0+3260,NO_BLOCK);m=adv.match;
  const end=adv.roundEvents.find(e=>e.type==='ROUND_END');
  assert.equal(end.payload.reason,'KO');assert.equal(end.payload.winnerSeat,1);assert.deepEqual(end.payload.roundsWon,{1:1,2:0});
  assert.equal(m.pendingAttacks.length,0);assert.equal(m.status,'running');assert.equal(m.round.phase,'intermission');
  assert.equal(end.payload.nextRoundAt,T0+3250+INTER);
  m=advanceMatch(m,T0+3400,NO_BLOCK).match;assert.equal(seatOf(m,1).hp,ROUND_HP);
});

test('rounds: RP formula',()=>{
  assert.equal(roundScore({roundCorrect:8,roundBestStreak:4,roundDamage:210}),1021);
  assert.equal(roundScore({roundCorrect:7,roundBestStreak:7,roundDamage:738}),1123);
  assert.equal(roundScore({correct:2,bestStreak:1,damageDealt:19}),251);
});

function closeWith(setup){
  const m=make();setup(seatOf(m,1),seatOf(m,2));
  return advanceMatch(m,m.round.endsAt,NO_BLOCK).roundEvents.find(e=>e.type==='ROUND_END').payload;
}
test('rounds: tie-breaks — more correct, fewer wrong, earlier last correct, then a draw',()=>{
  // equal RP 350: 3 correct/streak 1 vs 2 correct/streak 3
  assert.equal(closeWith((a,b)=>{Object.assign(a,{roundCorrect:2,roundBestStreak:3,lastCorrectAt:T0+5});Object.assign(b,{roundCorrect:3,roundBestStreak:1,lastCorrectAt:T0+9});}).winnerSeat,2);
  assert.equal(closeWith((a,b)=>{Object.assign(a,{roundCorrect:3,roundWrong:2,roundBestStreak:1,lastCorrectAt:T0+5});Object.assign(b,{roundCorrect:3,roundWrong:1,roundBestStreak:1,lastCorrectAt:T0+9});}).winnerSeat,2);
  assert.equal(closeWith((a,b)=>{Object.assign(a,{roundCorrect:3,roundBestStreak:1,lastCorrectAt:T0+5});Object.assign(b,{roundCorrect:3,roundBestStreak:1,lastCorrectAt:T0+9});}).winnerSeat,1);
  const draw=closeWith((a,b)=>{Object.assign(a,{roundCorrect:3,roundBestStreak:1,lastCorrectAt:T0+5});Object.assign(b,{roundCorrect:3,roundBestStreak:1,lastCorrectAt:T0+5});});
  assert.equal(draw.winnerSeat,null);assert.deepEqual(draw.roundsWon,{1:0,2:0});
  const zero=closeWith((a,b)=>{a.roundWrong=4;b.roundWrong=4;});
  assert.equal(zero.winnerSeat,null);
  assert.equal(closeWith((a,b)=>{a.roundWrong=4;b.roundWrong=5;}).winnerSeat,1);
});

test('rounds: the match ends early once mathematically decided (3-0 in a best of 5)',()=>{
  let m=make();const all=[];
  for(let i=0;i<3;i++){const r=playRound(m,1);m=r.m;all.push(...r.events);}
  assert.equal(m.status,'ended');assert.equal(m.endReason,'ROUNDS');assert.equal(m.winnerSeat,1);
  const ends=all.filter(e=>e.type==='ROUND_END');
  assert.equal(ends.length,3);assert.equal(ends[2].payload.matchOver,true);assert.equal(ends[2].payload.nextRoundAt,null);
  assert.equal(ends[0].payload.matchOver,false);
  const result=matchResult(m);
  assert.equal(result.mode,'rounds');assert.equal(result.totalRounds,5);assert.deepEqual(result.roundsWon,{1:3,2:0});
  assert.equal(result.rounds.length,3);assert.deepEqual(result.rounds[0],ends[0].payload);
  assert.equal(publicMatch(m).result.endReason,'ROUNDS');
  assert.equal(nextDeadline(m),null);
  assert.equal(advanceMatch(m,m.endedAt+99_999).match,m);
});

test('rounds: 5-5 after ten rounds → sudden death; three drawn sudden deaths → ROUNDS_DRAW',()=>{
  let m=make({rounds:10});
  for(let i=0;i<10;i++)m=playRound(m,i%2?2:1).m;
  assert.equal(m.status,'running');assert.equal(m.round.index,11);assert.equal(m.round.suddenDeath,true);
  assert.deepEqual(m.roundsWon,{1:5,2:5});
  for(let i=0;i<3;i++)m=playRound(m,null).m;
  assert.equal(m.status,'ended');assert.equal(m.endReason,'ROUNDS_DRAW');assert.equal(m.winnerSeat,null);
  assert.equal(m.roundHistory.length,13);
  // A drawn round inside regulation also leads to sudden death; the first sudden-death win decides.
  let n=make({rounds:5});
  for(const w of [1,2,null,1,2])n=playRound(n,w).m;
  assert.equal(n.round.suddenDeath,true);assert.equal(n.round.index,6);
  const sd=playRound(n,2);
  assert.equal(sd.m.status,'ended');assert.equal(sd.m.endReason,'ROUNDS');assert.equal(sd.m.winnerSeat,2);
});

test('rounds: one-sided same-word shield needs the same round word index',()=>{
  const build=()=>{let m=make();
    m=type(m,1,T0+1000).match;m=type(m,1,T0+2000).match;
    m=type(m,2,T0+1100,{wrong:true}).match;m=type(m,2,T0+2100).match;return m;};
  // Same index (2): B's correct word 100 ms after A's Q → reactive shield with p=0.30.
  let m=build();m=type(m,1,T0+3000).match;m=type(m,2,T0+3100,{}).match;
  let adv=advanceMatch(m,T0+3300,()=>0.1);
  assert.ok(adv.events.some(e=>e.type==='SHIELD_TRIGGERED'&&e.seat===2));
  assert.equal(seatOf(adv.match,2).hp,ROUND_HP);
  // Different index: B is one word ahead, still inside 250 ms → no block even with rng 0.
  m=build();m=type(m,2,T0+2950,{wrong:true}).match;m=type(m,1,T0+3000).match;m=type(m,2,T0+3100,{wrong:false}).match;
  assert.equal(seatOf(m,2).lastCorrectRoundIndex,3);
  adv=advanceMatch(m,T0+3300,()=>0);
  assert.ok(!adv.events.some(e=>e.type==='SHIELD_TRIGGERED'));
  assert.equal(seatOf(adv.match,2).hp,ROUND_HP-105);
});

function clashSetup(){
  let m=make();
  m=type(m,1,T0+1000).match;m=type(m,2,T0+1010).match;
  m=type(m,1,T0+2000).match;m=type(m,2,T0+2010).match;
  m=type(m,1,T0+3000).match;m=type(m,2,T0+3100).match;
  return m;
}
test('rounds: clash — one die roll, only the earlier submitter blocks',()=>{
  const m=clashSetup();
  const [x,y]=m.pendingAttacks;assert.ok(x.clashId);assert.equal(x.clashId,y.clashId);
  let calls=0;const adv=advanceMatch(m,T0+3400,()=>{calls++;return 0.1;});
  assert.equal(calls,1);
  const clash=adv.events.filter(e=>e.type==='WORD_CLASH');
  assert.equal(clash.length,1);
  assert.deepEqual({...clash[0],id:0},{id:0,type:'WORD_CLASH',clashId:x.clashId,seats:[1,2],roundWordIndex:2,word:m.round.words[2],
    blockerSeat:1,blockKind:'PERFECT_BLOCK',at:T0+3250});
  assert.equal(seatOf(adv.match,1).hp,ROUND_HP);assert.equal(seatOf(adv.match,2).hp,ROUND_HP-105);
  assert.deepEqual(adv.match.clashes[x.clashId],{blockerSeat:1,blockKind:'PERFECT_BLOCK'});
  assert.ok(adv.match.combatEvents.some(e=>e.type==='WORD_CLASH'));
});
test('rounds: failed clash roll — both attacks land, no further rolls',()=>{
  const m=clashSetup();let calls=0;
  const adv=advanceMatch(m,T0+3400,()=>{calls++;return 0.9;});
  assert.equal(calls,1);
  const clash=adv.events.find(e=>e.type==='WORD_CLASH');
  assert.equal(clash.blockerSeat,null);assert.equal(clash.blockKind,null);
  assert.equal(seatOf(adv.match,1).hp,ROUND_HP-95);assert.equal(seatOf(adv.match,2).hp,ROUND_HP-105);
});

test('rounds: pause/resume shifts every round clock',()=>{
  let m=make();m=type(m,1,T0+1000).match;
  const r=resumeMatch(pauseMatch(m,T0+5000,[2]),T0+8000);
  assert.equal(r.round.startedAt,T0+3000);assert.equal(r.round.endsAt,T0+ROUND_DURATION_MS+3000);assert.equal(r.endsAt,r.round.endsAt);
  assert.equal(seatOf(r,1).lastCorrectAt,T0+4000);
  const i=advanceMatch(make(),T0+R).match;
  const at=i.round.nextRoundAt;const shifted=resumeMatch(pauseMatch(i,T0+R+1_000,[1]),T0+R+2_000);
  assert.equal(shifted.round.nextRoundAt,at+1000);assert.equal(shifted.round.settleUntil,i.round.settleUntil+1000);
  let done=make();for(let k=1;k<=10;k++)done=type(done,1,T0+k*100).match;
  const moved=resumeMatch(pauseMatch(done,T0+2000,[1]),T0+2500);assert.equal(seatOf(moved,1).finishedAt,T0+1500);
  assert.equal(advanceMatch(pauseMatch(m,T0+5000,[2]),T0+3*(R+INTER)).roundEvents.length,0);
});

test('rounds: submissions during intermission are rejected; ROUND_MISMATCH guard',()=>{
  let m=advanceMatch(make(),T0+ROUND_DURATION_MS).match;
  assert.equal(m.round.phase,'intermission');
  assert.equal(submitWord(m,{playerId:'a',matchId:m.id,wordIndex:0,text:m.round.words[0]},T0+R+1_000).error,'ROUND_NOT_ACTIVE');
  const fresh=make();
  assert.equal(submitWord(fresh,{playerId:'a',matchId:fresh.id,wordIndex:0,text:fresh.round.words[0],round:2},T0+500).error,'ROUND_MISMATCH');
  assert.ok(submitWord(fresh,{playerId:'a',matchId:fresh.id,wordIndex:0,text:fresh.round.words[0],round:1},T0+500).match);
});

test('rounds: a new round resets HP, streak, shield and runes but keeps match totals',()=>{
  let m=createMatch(players('fire','rune','ember','laststand'),T0,'reset',{rounds:5,seed:5});
  for(let i=1;i<=4;i++){m=type(m,1,T0+i*1000).match;m=advanceMatch(m,T0+i*1000+900,NO_BLOCK).match;}
  Object.assign(seatOf(m,1),{shieldUntil:T0+9000,staggerUntil:T0+9000,parryCharge:true});seatOf(m,2).lastStandUsed=true;
  seatOf(m,1).cooldownUntil.s=T0+9000;
  const start=advanceMatch(m,T0+R+INTER,NO_BLOCK);m=start.match;
  assert.equal(m.round.index,2);
  const a=seatOf(m,1),b=seatOf(m,2);
  assert.deepEqual([a.hp,b.hp,a.maxHp],[ROUND_HP,ROUND_HP,ROUND_HP]);
  assert.equal(a.combo,0);assert.equal(a.runeEnergy,0);assert.equal(a.shieldUntil,null);assert.equal(a.staggerUntil,0);
  assert.equal(a.parryCharge,false);assert.equal(b.lastStandUsed,false);assert.deepEqual(a.cooldownUntil,{q:0,e:0,s:0,r:0});
  assert.equal(a.roundWordIndex,0);assert.equal(a.roundCorrect,0);assert.equal(a.roundDamage,0);assert.equal(a.roundDone,false);
  assert.equal(a.correctWords,4);assert.equal(a.maxCombo,4);assert.equal(a.combatStats.damageDealt,105+7+8);
  assert.equal(a.wordIndex,4);
  assert.equal(a.currentWord,m.round.words[0]);
  const rs=start.roundEvents.find(e=>e.type==='ROUND_START').payload;
  assert.deepEqual(rs,roundStartPayload(m));
  assert.deepEqual(rs,{round:2,totalRounds:5,suddenDeath:false,words:m.round.words,startedAt:T0+R+INTER,endsAt:T0+2*R+INTER,roundHp:ROUND_HP,skills:{1:null,2:null}});
});

test('rounds: a late alarm replays every overdue transition in order',()=>{
  const m=make();
  const adv=advanceMatch(m,T0+R+INTER+R+INTER+10,NO_BLOCK);
  assert.deepEqual(adv.roundEvents.map(e=>[e.type,e.payload.round]),[['ROUND_END',1],['ROUND_START',2],['ROUND_END',2],['ROUND_START',3]]);
  assert.equal(adv.roundEvents[1].payload.startedAt,T0+R+INTER);
  assert.equal(adv.match.round.startedAt,T0+2*(R+INTER));
  const seqs=adv.roundEvents.map(e=>e.sequence);assert.deepEqual(seqs,[...seqs].sort((a,b)=>a-b));
  assert.equal(new Set(seqs).size,seqs.length);
});

test('rounds: nextDeadline follows the phase',()=>{
  let m=make();assert.equal(nextDeadline(m),T0+ROUND_DURATION_MS);
  m=type(m,1,T0+100).match;m=type(m,1,T0+200).match;m=type(m,1,T0+300).match;
  assert.equal(nextDeadline(m),T0+300+250);
  m=advanceMatch(make(),T0+ROUND_DURATION_MS).match;assert.equal(nextDeadline(m),m.round.nextRoundAt);
  assert.equal(nextDeadline(pauseMatch(m,T0+R+1_000,[1])),null);
});

test('rounds: surrender ends the match in any phase and keeps history; finishMatch is inert in round mode',()=>{
  let m=playRound(make(),1).m;
  assert.equal(finishMatch(m,m.round.endsAt+1),m);
  const s=surrenderMatch(m,1,m.round.startedAt+10);
  assert.equal(s.endReason,'SURRENDER');assert.equal(s.winnerSeat,2);assert.equal(s.roundHistory.length,1);
  const r=matchResult(s);assert.equal(r.mode,'rounds');assert.equal(r.rounds.length,1);assert.deepEqual(r.roundsWon,{1:1,2:0});
  assert.equal(matchResult(createMatch(players(),T0,'cl')),null);
});

test('rounds: WPM counts only played round time',()=>{
  let m=playRound(make(),null).m;
  const word=m.round.words[0];
  m=type(m,1,m.round.startedAt+6000).match;
  const chars=[...word].length;
  assert.equal(seatOf(m,1).wpm,Math.round(chars/5/((R+6000)/60_000)));
});
