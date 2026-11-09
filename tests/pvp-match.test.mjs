import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,publicMatch,finishMatch,MATCH_DURATION_MS,MATCH_HP,ROUND_HP,SERVER_ONLY_EVENTS} from '../cloudflare/src/match.js';
import {PvPRoom} from '../cloudflare/src/room.js';
if(!globalThis.WebSocketRequestResponsePair)globalThis.WebSocketRequestResponsePair=class{constructor(a,b){this.a=a;this.b=b;}};

const players=[{playerId:'fire-id',seat:1,character:'fire'},{playerId:'rune-id',seat:2,character:'rune'}];
test('initial match has independent, server-owned stats and a monotonic identity',()=>{
  const m=createMatch(players,1000,'match-1');
  assert.equal(m.endsAt,1000+MATCH_DURATION_MS);
  assert.equal(m.status,'running');
  assert.equal(m.sequence,1);
  assert.deepEqual(m.participants.map(x=>x.hp),[MATCH_HP,MATCH_HP]);
  assert.deepEqual(m.participants.map(x=>x.wordIndex),[0,0]);
  assert.equal(m.participants[0].combo,0);
  assert.equal(m.participants[1].skillCharge.r,0);
  assert.notEqual(m.participants[0].skillCharge,m.participants[1].skillCharge);
});
test('invalid players and duplicate seats cannot start',()=>{
  assert.throws(()=>createMatch(players.slice(0,1)));
  assert.throws(()=>createMatch([players[0],{...players[1],seat:1}]));
  assert.throws(()=>createMatch([players[0],{...players[1],character:'hacker'}]));
});
test('client snapshots are detached copies and cannot change authority',()=>{
  const m=createMatch(players,100,'test');
  const view=publicMatch(m);view.players[0].hp=0;view.players[0].skillCharge.q=999;
  assert.equal(m.participants[0].hp,MATCH_HP);
  assert.equal(m.participants[0].skillCharge.q,0);
  assert.equal(view.matchId,'test');
});
test('match timeout is idempotent and a tie is explicit',()=>{
  const m=createMatch(players,10,'test');
  assert.equal(finishMatch(m,m.endsAt-1),m);
  const ended=finishMatch(m,m.endsAt);
  assert.equal(ended.status,'ended');assert.equal(ended.sequence,2);
  assert.equal(ended.winnerSeat,null);assert.equal(ended.endReason,'TIME_LIMIT');
  assert.equal(finishMatch(ended,m.endsAt+100),ended);
  assert.equal(m.status,'running');
});
test('time limit adjudicates based on server HP rather than client claims',()=>{
  const m=createMatch(players,10,'test');m.participants[0].hp=1500;
  const ended=finishMatch(m,m.endsAt);assert.equal(ended.winnerSeat,2);
  assert.equal(ended.participants[0].hp,1500);
});
test('all gameplay result events are server-only',()=>{
  for(const name of ['MATCH_START','STATE_UPDATE','MATCH_END','SKILL_CAST','DAMAGE_APPLIED','WORD_RESULT'])
    assert.ok(SERVER_ONLY_EVENTS.has(name));
});

class Socket {
  constructor(){this.readyState=1;this.messages=[];}
  send(data){this.messages.push(JSON.parse(data));}
  serializeAttachment(a){this.a=structuredClone(a);}
  deserializeAttachment(){return structuredClone(this.a);}
  close(){this.readyState=3;}
}
const sent=(ws,type)=>ws.messages.filter(x=>x.type===type);
const request=(type,payload={})=>JSON.stringify({version:1,type,payload});
function fakeCtx(){
  const mem=new Map(),ws1=new Socket(),ws2=new Socket();
  const ctx={storage:{get:async k=>structuredClone(mem.get(k)),put:async(k,v)=>mem.set(k,structuredClone(v)),setAlarm:async time=>ctx.nextAlarm=time,deleteAll:async()=>mem.clear()},
    getWebSockets:()=>[ws1,ws2].filter(x=>x.readyState===1),setWebSocketAutoResponse(){}};
  ws1.serializeAttachment({verified:true,playerId:'fire-id',seat:1,windowAt:0,count:0});
  ws2.serializeAttachment({verified:true,playerId:'rune-id',seat:2,windowAt:0,count:0});
  return {ctx,mem,ws1,ws2};
}
async function startedRoom(){
  const {ctx,mem,ws1,ws2}=fakeCtx();
  const room=new PvPRoom(ctx,{});
  const roster={phase:'countdown',startAt:Date.now()-5,players:players.map(x=>({...x,name:x.character,ready:true,tokenHash:x.playerId,reservedUntil:0}))};
  await ctx.storage.put('lobby',roster);
  await room.alarm();
  return {room,ctx,mem,ws1,ws2};
}
test('two players receive same match id; duplicate alarm never creates a second match',async()=>{
  const {room,ctx,ws1,ws2}=await startedRoom();
  const a=sent(ws1,'MATCH_START')[0].payload.match,b=sent(ws2,'MATCH_START')[0].payload.match;
  assert.equal(a.matchId,b.matchId);assert.deepEqual(a.players,b.players);
  assert.equal(sent(ws1,'MATCH_START')[0].eventId,`${a.matchId}:1:MATCH_START`);
  assert.equal(sent(ws2,'MATCH_START')[0].sequence,1);
  assert.equal(ctx.nextAlarm,a.endsAt);
  await room.alarm(); // premature duplicate alarm should not reset match
  assert.equal((await ctx.storage.get('match')).id,a.matchId);
  assert.equal(sent(ws1,'MATCH_START').length,1);
});
test('state requests are identical for two clients and idempotent',async()=>{
  const {room,ctx,ws1,ws2}=await startedRoom();
  await Promise.all([room.webSocketMessage(ws1,request('STATE_REQUEST')),room.webSocketMessage(ws2,request('STATE_REQUEST'))]);
  assert.deepEqual(sent(ws1,'STATE_UPDATE')[0].payload.match,sent(ws2,'STATE_UPDATE')[0].payload.match);
  assert.equal((await ctx.storage.get('match')).sequence,1);
  await room.webSocketMessage(ws1,request('STATE_REQUEST',{hp:9999,combo:999}));
  assert.equal((await ctx.storage.get('match')).participants[0].hp,ROUND_HP);
});
test('injected damage, match result and skills cannot alter HP',async()=>{
  const {room,ctx,ws1}=await startedRoom();
  for(const [type,payload,reason] of [
    ['DAMAGE_APPLIED',{amount:9999},'SERVER_ONLY_EVENT'],
    ['MATCH_END',{winnerSeat:1},'SERVER_ONLY_EVENT'],
    ['STATE_UPDATE',{hp:1},'SERVER_ONLY_EVENT'],
    ['SKILL_CAST',{skill:'R',damage:777},'SERVER_ONLY_EVENT'],
  ]){
    await room.webSocketMessage(ws1,request(type,payload));
    assert.equal(sent(ws1,'ERROR').at(-1).payload.code,reason);
  }
  assert.equal((await ctx.storage.get('match')).participants[1].hp,ROUND_HP);
});
test('both players receive terminal snapshot exactly once when the last round expires',async()=>{
  const {room,ctx,ws1,ws2}=await startedRoom();
  // Round mode: final regulation round, 2-2, seat 1 is ahead on round points when time runs out.
  const match=await ctx.storage.get('match');
  match.round.index=match.totalRounds;match.roundsWon={1:2,2:2};match.participants[0].roundCorrect=1;
  match.round.endsAt=Date.now()-1;match.endsAt=match.round.endsAt;
  await ctx.storage.put('match',match);
  await room.alarm();
  assert.equal(sent(ws1,'MATCH_END').length,1);assert.equal(sent(ws1,'ROUND_END').length,1);
  assert.equal(sent(ws2,'STATE_UPDATE').at(-1).payload.match.status,'ended');
  const ended=await ctx.storage.get('match');
  assert.equal(ended.endReason,'ROUNDS');assert.equal(ended.winnerSeat,1);assert.ok(ended.sequence>match.sequence);
  await room.alarm();
  assert.equal(sent(ws2,'MATCH_END').length,1);assert.equal(sent(ws2,'ROUND_END').length,1);
});
test('hibernation constructor restores snapshots from storage',async()=>{
  const {ctx,ws1,room}=await startedRoom();
  const restart=new PvPRoom(ctx,{});
  await restart.webSocketMessage(ws1,request('STATE_REQUEST'));
  const snapshot=sent(ws1,'STATE_UPDATE').at(-1).payload.match;
  assert.equal(snapshot.status,'running');
  assert.equal(snapshot.players.length,2);
});
