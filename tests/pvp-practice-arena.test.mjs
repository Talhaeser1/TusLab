import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPracticeSession,HUMAN_ID,BOT_ID,PRACTICE_REMATCH_DELAY_MS} from '../pvp/practice.js';

function clock(){
  let at=1_700_000_000_000,id=0;const timers=new Map();
  const add=(fn,ms,repeat)=>{const key=++id;timers.set(key,{fn,at:at+ms,ms,repeat});return key;};
  return {now:()=>at,active:()=>timers.size,
    scheduler:{setTimeout:(fn,ms)=>add(fn,ms,false),clearTimeout:key=>timers.delete(key),
      setInterval:(fn,ms)=>add(fn,ms,true),clearInterval:key=>timers.delete(key)},
    advance(ms){const end=at+ms;for(;;){
      let selected=null;
      for(const [key,t] of timers)if(t.at<=end&&(!selected||t.at<selected.t.at||t.at===selected.t.at&&key<selected.key))selected={key,t};
      if(!selected)break;
      at=selected.t.at;
      if(selected.t.repeat)selected.t.at+=selected.t.ms;else timers.delete(selected.key);
      selected.t.fn();
    }at=end;}
  };
}
function setup(options={}){
  const time=clock(),packets=[],combat=[];let id=0;
  const session=createPracticeSession({mode:'arena',now:time.now,scheduler:time.scheduler,
    rng:()=>.5,createId:()=>`arena-practice-${++id}`,onPacket:p=>packets.push(p),onCombat:e=>combat.push(e),...options});
  return {time,packets,combat,session};
}
const packet=(ctx,type)=>ctx.packets.filter(p=>p.type===type);

test('arena practice completes a match with personal packets and ordered combat',()=>{
  const ctx=setup({difficulty:'zor'});ctx.session.start();
  ctx.time.advance(400_000);
  assert.equal(ctx.session.snapshot().status,'ended');
  assert.equal(ctx.session.snapshot().mode,'arena');
  assert.equal(packet(ctx,'ARENA_MATCH_END').length,1);
  assert.equal(packet(ctx,'MATCH_END').length,1);
  assert.ok(packet(ctx,'ARENA_ATTACK').length>0);
  const types=ctx.packets.map(p=>p.type);
  for(const round of packet(ctx,'ARENA_ROUND_END')){
    const n=types.indexOf('ARENA_ROUND_END',ctx.packets.indexOf(round));
    const start=ctx.packets.findIndex(p=>p.type==='ARENA_ROUND_START'&&p.payload.round===round.payload.round);
    const prep=ctx.packets.findIndex(p=>p.type==='ARENA_PREP_START'&&p.payload.round===round.payload.round);
    assert.ok(prep<start&&start<n);
    const nextPrep=ctx.packets.findIndex((p,i)=>i>n&&p.type==='ARENA_PREP_START');
    const attacks=ctx.packets.map((p,i)=>p.type==='ARENA_ATTACK'&&i>n&&(nextPrep<0||i<nextPrep)?i:-1).filter(i=>i>=0);
    if(nextPrep>=0)assert.ok(nextPrep>n);
    if(attacks.length)assert.ok(attacks[0]>n&&attacks.every(i=>nextPrep<0||i<nextPrep));
  }
  for(const p of ctx.packets){
    assert.equal(p.payload.match.mode,'arena');
    assert.equal(p.payload.serverTime,p.serverTime);
    assert.equal(p.payload.match.matchId,p.matchId);
    assert.equal(p.payload.match.me.seat,ctx.session.humanSeat);
  }
  assert.deepEqual(ctx.combat.map(e=>e.id),packet(ctx,'ARENA_ATTACK').map(p=>p.payload.event.id));
  assert.ok(ctx.combat.every((e,i)=>i===0||e.id>ctx.combat[i-1].id));
  assert.equal(ctx.session.activeTimers,0);
});

test('arena prep hides bot pick; scramble requires the human personal word',()=>{
  // .0 picks scramble as the first skill; .5 chooses the middle skill, so force
  // bot's first skill while leaving word generation deterministic.
  let draws=0;const ctx=setup({rng:()=>[0,0,.5,0,0][draws++]??0});ctx.session.start();
  ctx.time.advance(400);
  const prep=ctx.session.snapshot();
  assert.equal(ctx.session.match.participants.find(p=>p.playerId===BOT_ID).roundSkill,'scramble');
  assert.equal(prep.opponent.roundSkill,undefined);
  assert.deepEqual(prep.round.words,[]);
  ctx.session.send('ARENA_PICK',{skill:null,item:null});
  const start=packet(ctx,'ARENA_ROUND_START')[0];
  assert.ok(start);
  assert.equal(packet(ctx,'ARENA_PICK_ACK').length,1);
  assert.deepEqual(start.payload.words,ctx.session.snapshot().round.words);
  assert.notDeepEqual(start.payload.words,ctx.session.match.round.words);
  const original=ctx.session.match.round.words[0];
  ctx.session.send('WORD_SUBMIT',{matchId:ctx.session.match.id,round:1,wordIndex:0,text:original});
  assert.equal(packet(ctx,'WORD_RESULT').at(-1).payload.correct,false);
  const expected=start.payload.words[1];
  ctx.time.advance(60);
  ctx.session.send('WORD_SUBMIT',{matchId:ctx.session.match.id,round:1,wordIndex:1,text:expected});
  assert.equal(packet(ctx,'WORD_RESULT').at(-1).payload.correct,true);
  ctx.session.dispose();
});

test('arena bot speed differs and typing stays within round phase',()=>{
  const first={};
  for(const difficulty of ['kolay','orta','zor']){
    const ctx=setup({difficulty});ctx.session.start();
    while(ctx.session.match.round.phase==='prep')ctx.time.advance(50);
    const started=ctx.time.now();
    while(ctx.session.match.participants.find(p=>p.playerId===BOT_ID).roundWordIndex===0)ctx.time.advance(50);
    first[difficulty]=ctx.time.now()-started;
    while(ctx.session.match.round.phase==='round')ctx.time.advance(50);
    const before=ctx.session.match.participants.find(p=>p.playerId===BOT_ID).roundWordIndex;
    ctx.time.advance(2_000);
    assert.equal(ctx.session.match.participants.find(p=>p.playerId===BOT_ID).roundWordIndex,before);
    ctx.session.dispose();assert.equal(ctx.time.active(),0);
  }
  assert.ok(first.kolay>first.orta&&first.orta>first.zor,JSON.stringify(first));
});

test('arena rematch uses new words, same mode; dispose removes every timer',()=>{
  const ctx=setup();ctx.session.start();const words=ctx.session.match.round.words;
  ctx.session.send('SURRENDER');
  assert.equal(packet(ctx,'ARENA_MATCH_END').length,1);
  ctx.session.send('REMATCH_VOTE',{accept:true});
  ctx.time.advance(PRACTICE_REMATCH_DELAY_MS);
  assert.equal(ctx.session.snapshot().mode,'arena');
  assert.notDeepEqual(ctx.session.match.round.words,words);
  assert.equal(packet(ctx,'MATCH_START').at(-1).payload.rematch,true);
  ctx.session.dispose();assert.equal(ctx.session.activeTimers,0);assert.equal(ctx.time.active(),0);
  const n=ctx.packets.length;ctx.time.advance(100_000);assert.equal(ctx.packets.length,n);
  const other=setup();other.session.start();other.session.send('LEAVE');assert.equal(other.time.active(),0);
});

test('arena practice performs no network or API calls',()=>{
  const source=readFileSync(new URL('../pvp/practice.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/fetch\(|\/api\/|WebSocket|localStorage/);
});
