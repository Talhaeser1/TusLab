import test from 'node:test';
import assert from 'node:assert/strict';
import {createArenaMatch,submitArenaPick,submitArenaWord,advanceArenaMatch,nextArenaDeadline} from '../pvp/shared/arena.js';

const players=[{seat:1,playerId:'a',character:'fire'},{seat:2,playerId:'b',character:'rune'}];
const pickWords=({count})=>Array.from({length:count},(_,i)=>`kelime${i}`);
test('arena begins with the first finisher and alternates while both have attacks',()=>{
  let m=createArenaMatch(players,0,'arena',{seed:1,pickWords});
  for(const playerId of ['a','b'])m=submitArenaPick(m,{playerId,skill:null,item:null},0).match;
  m=advanceArenaMatch(m,0).match;
  for(const [seat,count] of [[1,2],[2,5]])for(let i=0;i<count;i++){
    const p=m.participants.find(x=>x.seat===seat);
    m=submitArenaWord(m,{playerId:p.playerId,matchId:m.id,wordIndex:p.roundWordIndex,
      text:p.currentWord,round:m.round.index},100+i*100+seat*10).match;
  }
  m=advanceArenaMatch(m,m.round.endsAt).match;
  const seen=[];while(m.round.phase==='resolve'&&m.pendingAttacks.length){
    const step=advanceArenaMatch(m,nextArenaDeadline(m));seen.push(...step.events);m=step.match;
  }
  assert.deepEqual(seen.slice(0,4).map(e=>e.fromSeat),[2,1,2,1]);
  assert.deepEqual(seen.map(e=>e.turn),seen.map((_,i)=>i+1));
  assert.ok(seen.every(e=>e.defenderAction==='brace'));
});
