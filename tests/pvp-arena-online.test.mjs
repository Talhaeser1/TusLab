import test,{beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {PvPRoom} from '../cloudflare/src/room.js';
import {nextArenaDeadline,ARENA_SERVER_ONLY_EVENTS} from '../cloudflare/src/match.js';
import {MessageType} from '../pvp/contracts.js';

const original={Response:globalThis.Response,WebSocketPair:globalThis.WebSocketPair,WebSocketRequestResponsePair:globalThis.WebSocketRequestResponsePair};
let last;
class Sock{constructor(){this.readyState=1;this.messages=[];this.attachment=null;}
  send(x){this.messages.push(JSON.parse(x));}serializeAttachment(a){this.attachment=structuredClone(a);}
  deserializeAttachment(){return structuredClone(this.attachment);}close(){this.readyState=3;}}
class Pair{constructor(){this.client=new Sock();this.server=new Sock();last=this.server;}}
class FakeResponse{constructor(_,p={}){this.status=p.status??200;this.webSocket=p.webSocket;this.headers=new Headers(p.headers);}}
beforeEach(()=>{globalThis.Response=FakeResponse;globalThis.WebSocketPair=Pair;globalThis.WebSocketRequestResponsePair=class {};});
afterEach(()=>Object.assign(globalThis,original));
function fixture(){const sockets=[],store=new Map(),f={alarm:null};const ctx={getWebSockets:()=>sockets.filter(s=>s.readyState===1),
  acceptWebSocket:s=>sockets.push(s),setWebSocketAutoResponse(){},storage:{get:async k=>structuredClone(store.get(k)),
  put:async(k,v)=>store.set(k,structuredClone(v)),setAlarm:async t=>{f.alarm=t;},deleteAll:async()=>store.clear()}};
  return Object.assign(f,{ctx,room:new PvPRoom(ctx,{})});}
const token=i=>`${String(i).repeat(8)}-1234-4123-8123-${String(i).repeat(12)}`;
const send=(f,ws,type,payload={})=>f.room.webSocketMessage(ws,JSON.stringify({version:1,type,payload}));
const got=(ws,type)=>ws.messages.filter(p=>p.type===type);
const latest=(ws,type)=>got(ws,type).at(-1);
async function join(f,i){await f.room.fetch(new Request('https://local.test/connect',{headers:{Upgrade:'websocket'}}));const ws=last;
  await send(f,ws,'JOIN',{name:`Oyuncu ${i}`,character:i===1?'fire':'rune',resumeToken:token(i)});return ws;}
async function lobby(){const f=fixture();await f.room.fetch(new Request('https://local.test/initialize',{method:'POST'}));
  f.a=await join(f,1);f.b=await join(f,2);return f;}
async function start(f){await send(f,f.a,'MATCH_CONFIG',{mode:'arena'});await send(f,f.a,'READY_SET',{ready:true});
  await send(f,f.b,'READY_SET',{ready:true});const l=await f.room.roster();l.startAt=Date.now()-1;await f.room.save(l);await f.room.alarm();
  return await f.ctx.storage.get('match');}
test('arena config is host only, strict, and classic and rounds remain available',async()=>{
  const f=await lobby();assert.equal(latest(f.a,'ROOM_STATE').payload.mode,'rounds');
  await send(f,f.b,'MATCH_CONFIG',{mode:'arena'});assert.equal(latest(f.b,'ERROR').payload.code,'HOST_ONLY');
  for(const payload of [{mode:'arena',rounds:5},{mode:'unknown'},{mode:'rounds',rounds:6},{mode:'classic',rounds:5}]){
    await send(f,f.a,'MATCH_CONFIG',payload);assert.ok(['INVALID_MATCH_CONFIG','INVALID_ROUNDS'].includes(latest(f.a,'ERROR').payload.code));}
  await send(f,f.a,'MATCH_CONFIG',{mode:'classic'});assert.equal(latest(f.b,'ROOM_STATE').payload.mode,'classic');
  await send(f,f.a,'MATCH_CONFIG',{mode:'rounds',rounds:7});assert.equal(latest(f.b,'ROOM_STATE').payload.rounds,7);
  await send(f,f.a,'MATCH_CONFIG',{mode:'arena'});assert.equal(latest(f.b,'ROOM_STATE').payload.mode,'arena');
  const m=await start(f);assert.equal(m.mode,'arena');assert.equal(f.alarm,nextArenaDeadline(m));
  assert.equal(latest(f.a,'MATCH_START').payload.match.round.words.length,0);
  assert.equal(got(f.a,'ARENA_PREP_START').length,1);
  assert.ok(!JSON.stringify(f.a.messages).includes('roundPlan'));
});

test('arena picks stay private; scramble and blind clock are personal in every snapshot and reconnect',async()=>{
  const f=await lobby();let m=await start(f);
  await send(f,f.a,'ARENA_PICK',{skill:'scramble',item:null});
  assert.equal(got(f.a,'ARENA_PICK_ACK').length,1);assert.equal(got(f.b,'ARENA_PICK_ACK').length,0);
  assert.equal(latest(f.b,'STATE_UPDATE').payload.match.opponent.roundSkill,undefined);
  await send(f,f.b,'ARENA_PICK',{skill:'blindclock',item:null});
  m=await f.ctx.storage.get('match');assert.equal(m.round.phase,'round');assert.equal(f.alarm,nextArenaDeadline(m));
  const a=latest(f.a,'ARENA_ROUND_START'),b=latest(f.b,'ARENA_ROUND_START');
  assert.deepEqual(a.payload.words,m.participants[0].roundWords);assert.deepEqual(b.payload.words,m.participants[1].roundWords);
  assert.notDeepEqual(a.payload.words,b.payload.words);assert.deepEqual(a.payload.words,m.round.words);
  assert.deepEqual(a.payload.match.round.words,a.payload.words);assert.deepEqual(b.payload.match.round.words,b.payload.words);
  assert.equal(a.payload.match.opponent.remainingMs,null);assert.ok(Number.isFinite(b.payload.match.opponent.remainingMs));
  assert.equal(got(f.a,'ARENA_ROUND_START').length,1);assert.equal(got(f.b,'ARENA_ROUND_START').length,1);
  await send(f,f.a,'STATE_REQUEST');await send(f,f.b,'STATE_REQUEST');
  assert.equal(latest(f.a,'STATE_UPDATE').payload.match.opponent.remainingMs,null);
  assert.ok(Number.isFinite(latest(f.b,'STATE_UPDATE').payload.match.opponent.remainingMs));
  f.a.close();await f.room.webSocketClose(f.a);f.a=await join(f,1);
  assert.deepEqual(latest(f.a,'MATCH_START').payload.match.round.words,a.payload.words);
  assert.equal(latest(f.a,'STATE_UPDATE').payload.match.opponent.remainingMs,null);
  assert.ok(latest(f.b,'STATE_UPDATE').payload.match.opponent.remainingMs!==null);
  assert.equal(got(f.a,'ARENA_ROUND_START').length,0);
});

test('opponent pick reaches each player only after the round closes',async()=>{
  const f=await lobby();await start(f);
  await send(f,f.a,'ARENA_PICK',{skill:'freeze',item:'combostone'});
  assert.equal(latest(f.b,'STATE_UPDATE').payload.match.opponent.picks,undefined);
  assert.equal(latest(f.b,'STATE_UPDATE').payload.match.lastRoundPicks,undefined);
  await send(f,f.b,'ARENA_PICK',{skill:'scramble',item:'aegis'});
  for(const ws of [f.a,f.b]){
    assert.equal(latest(ws,'ARENA_ROUND_START').payload.picks,undefined);
    assert.equal(latest(ws,'ARENA_ROUND_START').payload.match.lastRoundPicks,undefined);
    assert.equal(latest(ws,'STATE_UPDATE').payload.match.lastRoundPicks,undefined);
    assert.equal(latest(ws,'STATE_UPDATE').payload.match.opponent.picks,undefined);
  }
  let m=await f.ctx.storage.get('match');m.round.endsAt=Date.now()-1;
  await f.ctx.storage.put('match',m);await f.room.alarm();
  const picks=[{seat:1,skill:'freeze',item:'combostone'},{seat:2,skill:'scramble',item:'aegis'}];
  for(const ws of [f.a,f.b]){
    assert.deepEqual(latest(ws,'ARENA_ROUND_END').payload.picks,picks);
    assert.deepEqual(latest(ws,'ARENA_ROUND_END').payload.match.lastRoundPicks,{round:1,picks});
  }
  await send(f,f.b,'STATE_REQUEST');
  assert.deepEqual(latest(f.b,'STATE_UPDATE').payload.match.lastRoundPicks,{round:1,picks});
});

test('arena word submission closes on first finisher, resolves attacks, summarizes, and opens next prep',async()=>{
  const f=await lobby();let m=await start(f);
  await send(f,f.a,'ARENA_PICK',{skill:null,item:null});await send(f,f.b,'ARENA_PICK',{skill:null,item:null});
  m=await f.ctx.storage.get('match');
  for(let i=0;i<5;i++){
    // Engine enforces 55 ms between words; preserve the authoritative state while advancing the test clock.
    if(i)await new Promise(r=>setTimeout(r,56));
    await send(f,f.a,'WORD_SUBMIT',{matchId:m.id,round:1,wordIndex:i,text:m.participants[0].roundWords[i]});
  }
  assert.equal(got(f.a,'WORD_RESULT').length,5);assert.equal(got(f.b,'WORD_RESULT').length,0);
  assert.equal(latest(f.a,'WORD_RESULT').payload.roundDone,true);
  m=await f.ctx.storage.get('match');assert.equal(m.round.phase,'resolve');
  assert.equal(got(f.b,'ARENA_ROUND_END').length,1);
  assert.equal(f.alarm,nextArenaDeadline(m));
  const attackCount=m.pendingAttacks.length;assert.ok(attackCount>0);
  // Deliver one attack at a time by moving its deadline to the current clock.
  for(let i=0;i<attackCount;i++){
    m=await f.ctx.storage.get('match');m.pendingAttacks[0].resolveAt=Date.now()-1;
    await f.ctx.storage.put('match',m);await f.room.alarm();
  }
  assert.equal(got(f.a,'ARENA_ATTACK').length,attackCount);
  assert.equal(got(f.b,'ARENA_ATTACK').length,attackCount);
  // İş 12: özet, çözüm planı (son sahne + yerleşme) bitince açılır.
  m=await f.ctx.storage.get('match');assert.equal(m.round.phase,'resolve');assert.ok(Number.isFinite(m.round.resolveUntil));
  m.round.resolveUntil=Date.now()-1;await f.ctx.storage.put('match',m);await f.room.alarm();
  m=await f.ctx.storage.get('match');assert.equal(m.round.phase,'summary');
  m.round.summaryEndsAt=Date.now()-1;await f.ctx.storage.put('match',m);await f.room.alarm();
  m=await f.ctx.storage.get('match');assert.equal(m.round.phase,'prep');assert.equal(m.round.index,2);
  assert.equal(latest(f.a,'ARENA_PREP_START').payload.round,2);
});

test('arena surrender and rematch preserve mode and deal a fresh seed',async()=>{
  const f=await lobby();const first=await start(f);
  await send(f,f.a,'SURRENDER');let m=await f.ctx.storage.get('match');
  assert.equal(m.endReason,'SURRENDER');assert.equal(m.winnerSeat,2);
  assert.equal(latest(f.a,'MATCH_END').payload.match.result.mode,'arena');
  assert.equal(got(f.a,'ARENA_MATCH_END').length,1);assert.equal(got(f.b,'ARENA_MATCH_END').length,1);
  assert.equal((await f.ctx.storage.get('results')).length,1);
  await send(f,f.a,'REMATCH_VOTE',{accept:true});await send(f,f.b,'REMATCH_VOTE',{accept:true});
  const l=await f.room.roster();l.startAt=Date.now()-1;await f.room.save(l);await f.room.alarm();
  m=await f.ctx.storage.get('match');assert.equal(m.mode,'arena');assert.notEqual(m.id,first.id);
  assert.notEqual(m.seed,first.seed);assert.notDeepEqual(m.round.words,first.round.words);
  assert.equal(latest(f.b,'MATCH_START').payload.rematch,true);
  assert.equal(latest(f.b,'ROOM_STATE').payload.mode,'arena');
});

test('arena server events cannot be forged',async()=>{
  const f=await lobby();await start(f);
  for(const type of ARENA_SERVER_ONLY_EVENTS){await send(f,f.a,type,{round:1});
    assert.equal(latest(f.a,'ERROR').payload.code,'SERVER_ONLY_EVENT');}
  for(const type of ['ARENA_PICK','ARENA_PICK_ACK','ARENA_ROUND_START','ARENA_ATTACK','ARENA_MATCH_END'])assert.equal(MessageType[type],type);
});
