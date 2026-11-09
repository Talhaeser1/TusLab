import test from 'node:test';
import assert from 'node:assert/strict';
import {createArenaMatch,submitArenaPick,submitArenaWord,advanceArenaMatch,nextArenaDeadline,
  arenaPublicMatch,arenaMatchResult,surrenderArenaMatch,ARENA_MATCH_HP,ARENA_ROUND_WORDS,ARENA_SERVER_ONLY_EVENTS,
  ARENA_ROUND_DURATION_MS,ARENA_PREP_DURATION_MS} from '../pvp/shared/arena.js';
import {ARENA_FREEZE_MS,ARENA_TIME_THIEF_MS} from '../pvp/shared/arena-skills.js';
const R=ARENA_ROUND_DURATION_MS,FROZEN_END=R+ARENA_FREEZE_MS-ARENA_TIME_THIEF_MS;

const players=[{seat:1,playerId:'a',name:'Ada',character:'fire'},{seat:2,playerId:'b',name:'Bora',character:'rune'}];
const vocab=Array.from({length:80},(_,i)=>`kelime${i}`);
const pickWords=({count,exclude=[]})=>vocab.filter(w=>!exclude.includes(w)).slice(0,count);
const fresh=()=>createArenaMatch(players,0,'arena-test',{seed:42,pickWords});
function pick(m,seat,skill=null,item=null,at=0){
  const out=submitArenaPick(m,{playerId:seat===1?'a':'b',skill,item},at);
  assert.ok(out.match,out.error);return out.match;
}
function start(m,skill1=null,skill2=null){m=pick(m,1,skill1);m=pick(m,2,skill2);return advanceArenaMatch(m,0,()=>0).match;}
function word(m,seat,at,correct=true){
  const p=m.participants.find(x=>x.seat===seat),text=correct?p.roundWords[p.roundWordIndex]:'yanlis';
  return submitArenaWord(m,{playerId:p.playerId,matchId:m.id,wordIndex:p.roundWordIndex,text,round:m.round.index},at);
}
function drive(m,seen=[]){
  let steps=0;while(m.status==='running'&&steps++<500){
    const deadline=nextArenaDeadline(m);assert.ok(Number.isFinite(deadline));
    const out=advanceArenaMatch(m,deadline,()=>0);assert.notEqual(out.match,m);
    seen.push(...out.roundEvents.map(e=>e.type),...out.events.map(e=>e.type));m=out.match;
  }
  assert.ok(steps<500);return m;
}

test('prep, early lock, round, resolve, summary, next prep',()=>{
  let m=fresh();assert.equal(m.round.phase,'prep');assert.equal(nextArenaDeadline(m),ARENA_PREP_DURATION_MS);
  m=start(m);assert.equal(m.round.phase,'round');assert.equal(m.participants[0].roundWords.length,5);
  m=advanceArenaMatch(m,R).match;assert.equal(m.round.phase,'summary');
  m=advanceArenaMatch(m,nextArenaDeadline(m)).match;
  assert.equal(m.round.phase,'prep');assert.equal(m.round.index,2);
});

test('submit guards, normalization and immutable attempts',()=>{
  let m=fresh();assert.equal(word(m,1,0).error,'ROUND_NOT_ACTIVE');m=start(m);
  assert.equal(submitArenaWord(m,{playerId:'a',matchId:'bad',wordIndex:0,text:'x'},0).error,'MATCH_ID_MISMATCH');
  assert.equal(submitArenaWord(m,{playerId:'a',matchId:m.id,wordIndex:1,text:'x'},0).error,'WORD_INDEX_MISMATCH');
  assert.equal(submitArenaWord(m,{playerId:'a',matchId:m.id,wordIndex:0,text:'two words'},0).error,'INVALID_WORD');
  const out=word(m,1,100);assert.equal(out.result.correct,true);assert.equal(m.participants[0].attempts.length,0);
  m=out.match;assert.equal(word(m,1,154).error,'WORD_BURST_LIMIT');
  assert.deepEqual(Object.keys(m.participants[0].attempts[0]),['index','submitted','expected','correct','at']);
});

test('first finisher closes immediately; overtime supplies five seconds',()=>{
  for(const overtime of [false,true]){
    let m=start(fresh(),null,overtime?'overtime':null);
    for(let i=0;i<5;i++)m=word(m,1,100+i*60).match;
    assert.equal(m.round.endsAt,overtime?5340:340);
    assert.equal(nextArenaDeadline(m),overtime?5340:340);
    assert.equal(word(m,1,400).error,'ROUND_COMPLETE');
    if(!overtime)assert.equal(word(m,2,400).error,'ROUND_NOT_ACTIVE');
    else assert.ok(word(m,2,400).match);
  }
});

test('personal deadlines: freeze and time thief',()=>{
  let m=start(fresh(),'freeze','timethief');
  assert.equal(m.participants[0].personalEndsAt,FROZEN_END);
  assert.equal(m.participants[1].personalEndsAt,R);
  assert.equal(nextArenaDeadline(m),R);
  // Bitiş anı kapsayıcı: FROZEN_END'de kabul, FROZEN_END+1'de red.
  assert.ok(word(m,1,FROZEN_END).match);
  assert.equal(word(m,1,FROZEN_END+1).error,'ROUND_NOT_ACTIVE');
  assert.ok(word(m,2,FROZEN_END).match);
  m=start(fresh(),'timethief','freeze');
  assert.equal(m.participants[0].personalEndsAt,R);
  assert.equal(m.participants[1].personalEndsAt,FROZEN_END);
});

test('blind clock and private picks',()=>{
  let m=fresh();m=pick(m,1,'blindclock','aegis');
  const prep=arenaPublicMatch(m,2);assert.equal(prep.opponent.picks,undefined);
  assert.equal(prep.round.words.length,0);
  m=pick(m,2);m=advanceArenaMatch(m,0).match;
  // Seat 1 seçti → kurban seat 2: kendi ve rakip süresi gizli; seçen taraf her şeyi görür.
  assert.equal(arenaPublicMatch(m,2).opponent.remainingMs,null);
  assert.equal(arenaPublicMatch(m,2).me.remainingMs,null);
  assert.equal(arenaPublicMatch(m,2).me.blindClock,true);
  // Sızıntı yok: kurbanın görüntüsünde mutlak bitiş zamanları da gizli.
  assert.equal(arenaPublicMatch(m,2).endsAt,null);
  assert.equal(arenaPublicMatch(m,2).round.endsAt,null);
  assert.ok(Number.isFinite(arenaPublicMatch(m,1).round.endsAt));
  assert.equal(arenaPublicMatch(m,1).opponent.remainingMs,R);
  assert.equal(arenaPublicMatch(m,1).me.remainingMs,R);
  assert.equal(arenaPublicMatch(m,1).me.picks.skill,'blindclock');
});

test('both picks stay private until typing closes, then reach round end and history',()=>{
  let m=fresh();m=pick(m,1,'freeze','combostone');
  assert.equal(arenaPublicMatch(m,2).lastRoundPicks,undefined);
  assert.equal(arenaPublicMatch(m,2).opponent.picks,undefined);
  m=pick(m,2,null,null);m=advanceArenaMatch(m,0).match;
  assert.equal(arenaPublicMatch(m,2).lastRoundPicks,undefined);
  assert.equal(arenaPublicMatch(m,2).opponent.picks,undefined);
  const expected=[{seat:1,skill:'freeze',item:'combostone'},{seat:2,skill:null,item:null}];
  const closed=advanceArenaMatch(m,nextArenaDeadline(m));
  assert.deepEqual(closed.roundEvents.find(e=>e.type==='ARENA_ROUND_END').payload.picks,expected);
  m=closed.match;
  assert.deepEqual(arenaPublicMatch(m,2).lastRoundPicks,{round:1,picks:expected});
  assert.deepEqual(m.roundHistory[0].picks,expected);
  const ended=surrenderArenaMatch(m,2,nextArenaDeadline(m));
  assert.deepEqual(arenaMatchResult(ended).rounds[0].picks,expected);
});

test('scramble changes victim expected text only',()=>{
  let m=start(fresh(),'scramble');
  const a=m.participants[0],b=m.participants[1];
  assert.notDeepEqual(a.roundWords,b.roundWords);
  assert.equal(arenaPublicMatch(m,2).round.words[0],b.roundWords[0]);
  const out=submitArenaWord(m,{playerId:'b',matchId:m.id,wordIndex:0,text:a.roundWords[0]},100);
  assert.equal(out.result.correct,false);assert.equal(out.match.participants[1].attempts[0].expected,b.roundWords[0]);
});

test('resolve orders hits by alternating seats and KO cancels queued hits',()=>{
  let m=start(fresh());
  m=word(m,2,100).match;m=word(m,1,120).match;
  m=advanceArenaMatch(m,R).match;assert.equal(m.round.phase,'resolve');
  let step=advanceArenaMatch(m,nextArenaDeadline(m));
  assert.equal(step.events[0].fromSeat,1);m=step.match;
  step=advanceArenaMatch(m,nextArenaDeadline(m));assert.equal(step.events[0].fromSeat,2);
  m=step.match;assert.equal(m.participants[0].hp,ARENA_MATCH_HP-step.events[0].amount);
  m.participants[1].hp=1;
  let n=start(fresh());n=word(n,1,100).match;n=word(n,2,160).match;
  n.participants[1].hp=1;n=advanceArenaMatch(n,R).match;
  step=advanceArenaMatch(n,nextArenaDeadline(n));
  assert.equal(step.match.status,'ended');assert.equal(step.match.endReason,'KNOCKOUT');
  assert.equal(step.match.pendingAttacks.length,0);
  assert.deepEqual(arenaMatchResult(step.match).rounds[0].picks,[
    {seat:1,skill:null,item:null},{seat:2,skill:null,item:null}]);
});

test('deadline loop completes all six rounds and emits final result',()=>{
  const seen=[];let m=drive(fresh(),seen);assert.equal(m.round.index,6);assert.equal(m.status,'ended');
  assert.equal(m.endReason,'ARENA_DRAW');assert.equal(m.roundHistory.length,6);
  assert.ok(seen.includes('ARENA_MATCH_END'));
  assert.equal(arenaMatchResult(m).rounds.length,6);
  assert.ok(ARENA_SERVER_ONLY_EVENTS.has('ARENA_ATTACK'));
});

test('end tie breaks by correct words then damage',()=>{
  let m=drive(fresh());m.participants[0].correctWords=2;m.participants[1].correctWords=1;
  // Re-run the final transition from a live summary with adjusted totals.
  let live=fresh();live.round.index=6;live.round.phase='summary';live.round.summaryEndsAt=10;
  live.participants[0].correctWords=2;live.participants[1].correctWords=1;
  let ended=advanceArenaMatch(live,10).match;assert.equal(ended.winnerSeat,1);
  live.participants[1].correctWords=2;live.participants[1].combatStats.damageDealt=10;
  ended=advanceArenaMatch(live,10).match;assert.equal(ended.winnerSeat,2);
});

test('surrender ends with the other seat winning',()=>{
  const m=surrenderArenaMatch(fresh(),1,123);
  assert.equal(m.winnerSeat,2);assert.equal(m.endReason,'SURRENDER');
  assert.equal(m.round.phase,'ended');assert.equal(nextArenaDeadline(m),null);
});

test('same-millisecond double finish: the second finisher keeps their last word',()=>{
  let m=createArenaMatch([{playerId:'a',name:'A',character:'fire',seat:1},{playerId:'b',name:'B',character:'rune',seat:2}],0,'same-ms',{seed:9});
  m=submitArenaPick(m,{playerId:'a'},10).match;m=submitArenaPick(m,{playerId:'b'},10).match;m=advanceArenaMatch(m,20).match;
  let t=100;
  for(let i=0;i<5;i++){for(const id of ['a','b']){
    const p=m.participants.find(x=>x.playerId===id);
    m=advanceArenaMatch(m,t-1).match;
    const r=submitArenaWord(m,{playerId:id,matchId:m.id,wordIndex:p.roundWordIndex,text:p.roundWords[p.roundWordIndex],round:m.round.index},t);
    assert.equal(r.error,undefined,`${id} kelime ${i}: ${r.error}`);m=r.match;
  }t+=100;}
  assert.deepEqual(m.participants.map(p=>p.attempts.length),[5,5]);
});
