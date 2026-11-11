import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,advanceMatch,submitWord,pickRoundSkill,publicMatch,surrenderMatch,nextDeadline} from '../pvp/shared/match.js';
import {createArenaMatch,advanceArenaMatch,submitArenaPick,submitArenaWord,arenaPublicMatch,surrenderArenaMatch,nextArenaDeadline} from '../pvp/shared/arena.js';
import {roundInputLock,roundsViewModel} from '../pvp/rounds-ui.js';
import {arenaInputLock} from '../pvp/arena-ui.js';
import {createPracticeSession} from '../pvp/practice.js';

const players=[{playerId:'a',seat:1,name:'Sira',fighter:'sira',character:'fire'},{playerId:'b',seat:2,name:'Nyx',fighter:'nyx',character:'rune'}];
const fresh=(options={})=>createMatch(players,1000,'modes33',{rounds:5,seed:33,roundStyle:'counted',...options});
function secondRound(skillA,skillB){
  let m=fresh({resolveAtEnd:true});m=advanceMatch(m,41000).match;
  for(const [playerId,skill] of [['a',skillA],['b',skillB]])if(skill)m=pickRoundSkill(m,{playerId,skill},41001).match;
  return advanceMatch(m,m.round.nextRoundAt).match;
}
function arena(skillA=null,skillB=null){
  let m=createArenaMatch(players,1000,'arena33',{seed:33});
  for(const [playerId,skill] of [['a',skillA],['b',skillB]])m=submitArenaPick(m,{playerId,skill},1100).match;
  return advanceArenaMatch(m,1200).match;
}
const submit=(m,p,at,text=p.currentWord)=>submitWord(m,{playerId:p.playerId,matchId:m.id,wordIndex:p.wordIndex,round:m.round.index,text},at);

test('modes33: rounds time thief and freeze combine, reject expired words and keep source immutable',()=>{
  const m=secondRound('timethief','freeze'),start=m.round.startedAt;
  assert.equal(m.participants[0].roundEndsAt,start+40000);
  assert.equal(m.participants[1].roundEndsAt,start+38000);
  assert.equal(submit(m,m.participants[1],start+38000).error,'ROUND_NOT_ACTIVE');
  const before=structuredClone(m);assert.equal(submit(m,m.participants[0],start+37000).result.accepted,true);assert.deepEqual(m,before);
});
test('modes33: blind clock conceals deadlines from the victim only in both engines',()=>{
  for(const [m,pub] of [[secondRound('blindclock',null),publicMatch],[arena('blindclock',null),arenaPublicMatch]]){
    const victim=pub(m,2),caster=pub(m,1);
    assert.equal(victim.endsAt,null);assert.equal(victim.round.endsAt,null);
    assert.ok(Number.isFinite(caster.round.endsAt));
    if(m.mode==='arena'){assert.equal(victim.me.remainingMs,null);assert.equal(victim.opponent.remainingMs,null);}
    else assert.ok(victim.players.every(p=>p.roundEndsAt===null));
  }
});
test('modes33: arena freeze adds three seconds and time thief subtracts five without changing opponent',()=>{
  const m=arena('freeze','timethief');
  assert.equal(m.participants[0].personalEndsAt,39200);
  assert.equal(m.participants[1].personalEndsAt,41200);
  assert.equal(arenaPublicMatch(m,1).me.frozen,true);
  assert.equal(m.participants[0].frozenUntil,4200);
});
test('modes33: last call gives unfinished rounds player five seconds and never extends a stolen deadline',()=>{
  for(const late of [false,true]){
    let m=secondRound('timethief',null);const start=m.round.startedAt;
    const began=start+(late?34000:1000);let packet;
    for(let i=0;i<10;i++){packet=submit(m,m.participants[0],began+i*60,'yanlis');m=packet.match;}
    assert.equal(packet.result.roundEvents[0].type,'ROUND_LAST_CALL');
    assert.equal(m.participants[1].roundEndsAt,late?start+35000:start+6540);
    assert.equal(advanceMatch(m,m.round.endsAt).match.round.phase,'intermission');
  }
});
test('modes33: tied planned rounds enter sudden death and three tied extra rounds finish as a draw',()=>{
  let m=fresh({resolveAtEnd:true});let safety=0;
  while(m.round.index<=5&&safety++<20)m=advanceMatch(m,nextDeadline(m)).match;
  assert.equal(m.round.index,6);assert.equal(m.round.suddenDeath,true);assert.equal(m.status,'running');
  while(m.status==='running'&&safety++<40)m=advanceMatch(m,nextDeadline(m)).match;
  assert.equal(m.status,'ended');assert.equal(m.winnerSeat,null);assert.equal(m.endReason,'ROUNDS_DRAW');assert.equal(m.roundHistory.length,8);
});
test('modes33: a sudden death score wins immediately',()=>{
  let m=fresh({resolveAtEnd:true});while(m.round.index<6)m=advanceMatch(m,nextDeadline(m)).match;
  m=submit(m,m.participants[0],m.round.startedAt+100).match;
  m=advanceMatch(m,m.round.endsAt).match;
  assert.equal(m.status,'ended');assert.equal(m.winnerSeat,1);assert.equal(m.endReason,'ROUNDS');
});
test('modes33: six empty arena rounds end in a draw with a complete history',()=>{
  let m=createArenaMatch(players,1000,'arena-draw',{seed:33});let safety=0;
  while(m.status==='running'&&safety++<40)m=advanceArenaMatch(m,nextArenaDeadline(m)).match;
  assert.equal(m.status,'ended');assert.equal(m.endReason,'ARENA_DRAW');assert.equal(m.winnerSeat,null);assert.equal(m.roundHistory.length,6);
});
test('modes33: surrender terminates combat, awards the other seat and cannot change an ended match',()=>{
  for(const [m,surrender] of [[fresh(),surrenderMatch],[createMatch(players,1000,'classic'),surrenderMatch],[arena(),surrenderArenaMatch]]){
    const original=structuredClone(m),ended=surrender(m,1,2000);
    assert.equal(ended.status,'ended');assert.equal(ended.winnerSeat,2);assert.equal(ended.endReason,'SURRENDER');assert.deepEqual(ended.pendingAttacks,[]);
    assert.deepEqual(m,original);assert.equal(surrender(ended,2,3000),ended);
  }
});
test('modes33: resolving rounds and classic exchanges require clearing input, unlock starts a new input window',()=>{
  for(const mode of ['rounds','classic']){
    const m=mode==='rounds'?publicMatch(fresh(),1):publicMatch(createMatch(players,1000,'classic',{exchangeMs:10000}),1);
    if(mode==='rounds')m.round.phase='resolve';else m.exchange.phase='resolve';
    const lock=roundInputLock(m,'a',2000);assert.equal(lock.locked,true);assert.equal(lock.clearInput,true);
    if(mode==='rounds')m.round.phase='round';else m.exchange.phase='typing';
    assert.equal(roundInputLock(m,'a',2000).locked,false);
  }
});
test('modes33: all locked arena phases and personal expiry explicitly clear input',()=>{
  const m=arenaPublicMatch(arena(),1);
  for(const phase of ['prep','resolve','summary']){
    m.round.phase=phase;assert.equal(arenaInputLock(m,'a',2000).clearInput,true);
  }
  m.round.phase='round';assert.equal(arenaInputLock(m,'a',42000,41000).clearInput,true);
  assert.equal(arenaInputLock(m,'a',2000).locked,false);
});
test('modes33: a fresh forty-second round starts with a full UI clock',()=>{
  const vm=roundsViewModel(publicMatch(fresh(),1),'a',1000);
  assert.equal(vm.timer.seconds,40);assert.equal(vm.timer.fraction,1);
  assert.equal(roundsViewModel(publicMatch(fresh(),1),'a',21000).timer.fraction,0.5);
});
test('modes33: practice rematch retains stage, typing and assist preferences in every mode',()=>{
  for(const mode of ['classic','rounds','arena'])for(const assist of [true,false]){
    let time=1000,id=0;const jobs=new Map();
    const scheduler={setTimeout:(fn,ms)=>{jobs.set(++id,{fn,ms});return id;},clearTimeout:id=>jobs.delete(id),setInterval:()=>++id,clearInterval(){}};
    const s=createPracticeSession({mode,stage:'harbor',typing:{caseSensitive:false,punctuation:false},assist,now:()=>time,rng:()=>0.5,scheduler,createId:()=>`rematch-${++id}`});
    s.start();const before=s.snapshot();s.send('SURRENDER');s.send('REMATCH_VOTE',{accept:true});
    const timer=[...jobs.values()].find(j=>j.ms===3000);assert.ok(timer);time+=3000;timer.fn();
    const after=s.snapshot();assert.notEqual(after.matchId,before.matchId);assert.equal(after.stage,'harbor');assert.deepEqual(after.typing,{caseSensitive:false,punctuation:false});
    assert.equal(after.assistEnabled,mode!=='arena'&&assist);assert.equal(after.status,'running');s.dispose();
  }
});
test('modes33: arena summary snapshot recovers per-round scores after reconnect',()=>{
  let m=arena();m=submitArenaWord(m,{playerId:'a',matchId:m.id,wordIndex:0,round:1,text:m.participants[0].currentWord},1500).match;
  m=advanceArenaMatch(m,41200).match;
  while(m.round.phase==='resolve')m=advanceArenaMatch(m,nextArenaDeadline(m)).match;
  const pub=arenaPublicMatch(m,1);
  assert.equal(pub.roundSummary.scores[0].correct,1);assert.ok(pub.roundSummary.scores[0].damageDealt>0);
  assert.deepEqual(pub.roundResults,[{round:1,winnerSeat:1}]);
});
