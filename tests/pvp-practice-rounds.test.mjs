import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPracticeSession,normalizeRounds,BOT_DIFFICULTIES,HUMAN_ID,BOT_ID,PRACTICE_REMATCH_DELAY_MS} from '../pvp/practice.js';
import {ROUND_SUMMARY_MS,ROUND_INTRO_MS} from '../pvp/shared/match.js';

// A virtual clock runs timeouts and intervals in the same order as a browser event loop.
function clock(){
  let time=1_700_000_000_000,serial=0;
  const timers=new Map();
  const add=(fn,ms,repeat)=>{const id=++serial;timers.set(id,{fn,at:time+ms,ms,repeat});return id;};
  return {
    now:()=>time,active:()=>timers.size,
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
function setup(options={}){
  const time=clock(),packets=[];
  let id=0;
  const session=createPracticeSession({roundStyle:'counted',now:time.now,scheduler:time.scheduler,rng:()=>.99,createId:()=>`round-practice-${++id}`,
    onPacket:p=>packets.push(p),...options});
  return {time,packets,session};
}

test('practice rounds: five complete rounds end in a round-mode result and ordered packets',()=>{
  const ctx=setup({rounds:5,difficulty:'zor'});
  // Human wins the first two rounds; bot wins the remaining three. This prevents
  // early clinching and exercises every intermission and the fifth round.
  ctx.time.scheduler.setInterval(()=>{
    const m=ctx.session.match;
    if(m?.status!=='running'||m.round.phase!=='round'||m.round.index>2)return;
    const me=m.participants.find(p=>p.playerId===HUMAN_ID);
    if(me.roundDone)return;
    ctx.session.send('WORD_SUBMIT',{matchId:m.id,round:m.round.index,wordIndex:me.wordIndex,text:me.currentWord});
  },180);
  ctx.session.start();
  ctx.time.advance(200_000);
  const result=ctx.session.snapshot().result;
  assert.equal(ctx.session.snapshot().status,'ended');
  assert.equal(result.mode,'rounds');
  assert.equal(result.totalRounds,5);
  assert.equal(result.rounds.length,5);
  assert.equal(ctx.packets.filter(p=>p.type==='ROUND_START').length,5);
  assert.equal(ctx.packets.filter(p=>p.type==='ROUND_END').length,5);
  assert.equal(ctx.packets.filter(p=>p.type==='MATCH_END').length,1);
  const ordered=ctx.packets.filter(p=>['MATCH_START','ROUND_START','ROUND_END','MATCH_END'].includes(p.type));
  assert.deepEqual(ordered.map(p=>p.type),['MATCH_START',...Array.from({length:5},()=>['ROUND_START','ROUND_END']).flat(),'MATCH_END']);
  for(const p of ordered.filter(p=>p.type.startsWith('ROUND_'))){
    assert.equal(p.eventId,`${p.matchId}:${p.sequence}:${p.type}:r${p.payload.round}`);
    assert.equal(p.payload.serverTime,p.serverTime);
    assert.equal(p.payload.match.matchId,p.matchId);
  }
  const eventIds=ordered.map(p=>p.eventId);
  assert.equal(new Set(eventIds).size,eventIds.length);
  assert.equal(ctx.session.activeTimers,0);
});

test('practice rounds: shared words, per-round bot limits, no intermission submits',()=>{
  const {time,session,packets}=setup({difficulty:'zor'});
  session.start();
  const first=session.match.round.words;
  assert.equal(first.length,10);
  assert.deepEqual(session.snapshot().round.words,first);
  assert.equal(session.match.participants[0].currentWord,first[0]);
  assert.equal(session.match.participants[1].currentWord,first[0]);
  while(!packets.some(p=>p.type==='ROUND_END'))time.advance(50);
  const ended=packets.find(p=>p.type==='ROUND_END');
  assert.ok(ended);
  const before=session.match.participants.find(p=>p.playerId===BOT_ID).wordIndex;
  assert.equal(session.match.round.phase,'intermission');
  time.advance(2_000);
  assert.equal(session.match.participants.find(p=>p.playerId===BOT_ID).wordIndex,before);
  assert.equal(session.match.round.phase,'intermission');
  const human=session.match.participants.find(p=>p.playerId===HUMAN_ID);
  session.send('WORD_SUBMIT',{matchId:session.match.id,wordIndex:human.wordIndex,text:first[0],round:1});
  assert.equal(packets.at(-1).payload.code,'ROUND_NOT_ACTIVE');
  time.advance(ROUND_SUMMARY_MS+ROUND_INTRO_MS-2_000);
  assert.equal(session.match.round.index,2);
  assert.equal(session.match.participants.find(p=>p.playerId===BOT_ID).roundWordIndex,0);
  assert.notDeepEqual(session.match.round.words,first);
  session.dispose();
});

test('practice rounds: difficulty affects first reaction and typing pace',()=>{
  const samples={};
  for(const difficulty of ['kolay','orta','zor']){
    const {time,session}=setup({difficulty});session.start();
    const start=time.now();
    while(session.match.participants.find(p=>p.playerId===BOT_ID).wordIndex===0)time.advance(50);
    samples[difficulty]=time.now()-start;
    session.dispose();
  }
  assert.ok(samples.kolay>samples.orta&&samples.orta>samples.zor,JSON.stringify(samples));
  assert.deepEqual(BOT_DIFFICULTIES.kolay.startDelayMs,[900,1500]);
  assert.deepEqual(BOT_DIFFICULTIES.orta.startDelayMs,[600,1100]);
  assert.deepEqual(BOT_DIFFICULTIES.zor.startDelayMs,[400,800]);
  assert.equal(normalizeRounds(7),7);assert.equal(normalizeRounds(10),10);assert.equal(normalizeRounds(99),5);
});

test('practice rounds: rematch keeps rounds, changes words, and dispose clears timers',()=>{
  const {time,session,packets}=setup({rounds:7});session.start();
  const initial=session.match.round.words;
  session.send('SURRENDER');
  session.send('REMATCH_VOTE',{accept:true});
  time.advance(PRACTICE_REMATCH_DELAY_MS);
  assert.equal(session.snapshot().totalRounds,7);
  assert.equal(session.snapshot().round.index,1);
  assert.notDeepEqual(session.match.round.words,initial);
  assert.deepEqual(packets.filter(p=>p.type==='MATCH_START').map(p=>p.payload.match.totalRounds),[7,7]);
  session.dispose();
  assert.equal(session.activeTimers,0);assert.equal(time.active(),0);
  const other=setup();other.session.start();other.session.send('LEAVE');
  assert.equal(other.time.active(),0);
});

test('practice rounds: offline module has no fetch or API path',()=>{
  const source=readFileSync(new URL('../pvp/practice.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/fetch\(|\/api\/|WebSocket|localStorage/);
});
