import test from 'node:test';
import assert from 'node:assert/strict';
import {createPracticeSession} from '../pvp/practice.js';
import {MATCH_DURATION_MS,MATCH_WORDS} from '../pvp/shared/match.js';

test('klasik bot orijinal createMatch akışını ve 90 saniyelik maçı kullanır',()=>{
  const packets=[];const tasks=new Map();let seq=0;const at=1_700_000_000_000;
  const scheduler={setInterval:(fn,ms)=>{const id=++seq;tasks.set(id,{fn,ms});return id;},clearInterval:id=>tasks.delete(id),
    setTimeout:(fn,ms)=>{const id=++seq;tasks.set(id,{fn,ms});return id;},clearTimeout:id=>tasks.delete(id)};
  const session=createPracticeSession({mode:'classic',now:()=>at,scheduler,rng:()=>0.5,createId:()=> 'classic-bot',onPacket:p=>packets.push(p)});
  session.start();
  const m=session.snapshot();
  assert.equal(m.mode,'classic');assert.equal(m.round,null);assert.equal(m.endsAt-at,MATCH_DURATION_MS);
  assert.equal(session.mode,'classic');assert.equal(session.match.participants[0].activeText,MATCH_WORDS[0]);
  assert.deepEqual(packets.slice(0,2).map(p=>p.type),['MATCH_START','STATE_UPDATE']);
  assert.equal(packets.some(p=>p.type==='ROUND_START'),false);
  const me=m.players.find(p=>p.playerId===session.humanId);
  session.send('WORD_SUBMIT',{matchId:m.matchId,wordIndex:me.wordIndex,text:me.currentWord});
  assert.equal(packets.some(p=>p.type==='WORD_RESULT'),true);
  session.dispose();assert.equal(tasks.size,0);
});
