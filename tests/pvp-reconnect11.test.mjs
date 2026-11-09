import test,{beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {PvPRoom,REJOIN_GRACE} from '../cloudflare/src/room.js';
import {createMatch,publicMatch,pauseMatch,resumeMatch,endDisconnectedMatch,submitWord,MATCH_DURATION_MS} from '../cloudflare/src/match.js';
const original={Response:globalThis.Response,WebSocketPair:globalThis.WebSocketPair,WebSocketRequestResponsePair:globalThis.WebSocketRequestResponsePair};
let newest;
class Socket {
  constructor(){this.readyState=1;this.attachment=null;this.messages=[];}
  send(s){this.messages.push(JSON.parse(s));}
  deserializeAttachment(){return structuredClone(this.attachment);}
  serializeAttachment(s){this.attachment=structuredClone(s);}
  close(code=1000){this.readyState=3;this.code=code;}
}
class Pair {constructor(){this.client=new Socket();this.server=new Socket();newest=this.server;}}
class FakeResponse{constructor(body,opts={}){this.body=body;this.status=opts.status??200;this.webSocket=opts.webSocket;this.headers=new Headers(opts.headers);}}
beforeEach(()=>{globalThis.Response=FakeResponse;globalThis.WebSocketPair=Pair;globalThis.WebSocketRequestResponsePair=class {};});
afterEach(()=>{Object.assign(globalThis,original);});
function env(){let alarmAt=0;const sockets=[],db=new Map();const ctx={
  getWebSockets:()=>sockets.filter(ws=>ws.readyState===1),acceptWebSocket:ws=>sockets.push(ws),setWebSocketAutoResponse(){},
  get alarmAt(){return alarmAt;},storage:{get:async k=>structuredClone(db.get(k)),put:async(k,v)=>db.set(k,structuredClone(v)),
    setAlarm:async t=>{alarmAt=t;},deleteAll:async()=>db.clear()},db};
  return {ctx,room:new PvPRoom(ctx,{})};
}
const packet=(room,sock,type,payload={})=>room.webSocketMessage(sock,JSON.stringify({version:1,type,payload}));
const token=id=>`${String(id).repeat(8)}-1234-4123-8123-${String(id).repeat(12)}-12345678-1234-4123-8123-${String(id).repeat(12)}`;
const messages=(socket,type)=>socket.messages.filter(p=>p.type===type);
async function connect(room,id){const response=await room.fetch(new Request('https://tuslab.test/connect',{headers:{Upgrade:'websocket'}}));assert.equal(response.status,101);
  const sock=newest;await packet(room,sock,'JOIN',{name:`Oyuncu ${id}`,character:id===1?'fire':'rune',resumeToken:token(id)});return sock;}
async function playing(){const e=env();await e.room.fetch(new Request('https://tuslab.test/initialize',{method:'POST'}));
  const a=await connect(e.room,1),b=await connect(e.room,2);
  await packet(e.room,a,'READY_SET',{ready:true});await packet(e.room,b,'READY_SET',{ready:true});
  const lobby=await e.room.roster();lobby.startAt=Date.now()-1;await e.room.save(lobby);await e.room.alarm();
  assert.equal((await e.ctx.storage.get('match')).status,'running');return {...e,a,b};
}

test('pause/resume freezes match clock, cooldown, attack deadlines, and WPM origin',()=>{
  const m=createMatch([{playerId:'a',seat:1,character:'fire'},{playerId:'b',seat:2,character:'rune'}],1000,'m');
  m.pendingAttacks.push({issuedAt:1500,resolveAt:1750});m.participants[0].cooldownUntil.q=3000;m.participants[0].lastWordAt=1700;
  const paused=pauseMatch(m,2000,[2]);assert.equal(paused.status,'paused');assert.equal(paused.endsAt,1000+MATCH_DURATION_MS);
  assert.equal(pauseMatch(paused,2200,[1,2]).pausedAt,2000);
  const resumed=resumeMatch(paused,8000);assert.equal(resumed.status,'running');assert.equal(resumed.endsAt,1000+MATCH_DURATION_MS+6000);
  assert.equal(resumed.startedAt,7000);assert.equal(resumed.participants[0].cooldownUntil.q,9000);
  assert.equal(resumed.participants[0].lastWordAt,7700);assert.equal(resumed.pendingAttacks[0].resolveAt,7750);
  assert.equal(publicMatch(paused).pausedAt,2000);
  assert.equal(endDisconnectedMatch(paused,5000,1).winnerSeat,2);
  assert.equal(endDisconnectedMatch(paused,5000).endReason,'BOTH_DISCONNECTED');
});
test('one dropped websocket pauses authoritative match and preserves combat state',async()=>{
  const {room,ctx,a,b}=await playing();const before=await ctx.storage.get('match');
  const p=before.participants[0];const o=submitWord(before,{playerId:p.playerId,matchId:before.id,wordIndex:p.wordIndex,text:p.currentWord},Date.now());
  await ctx.storage.put('match',o.match);
  await room.webSocketClose(a);
  const paused=await ctx.storage.get('match');assert.equal(paused.status,'paused');assert.equal(paused.participants[0].wordIndex,1);
  assert.deepEqual(paused.offlineSeats,[1]);assert.equal(messages(b,'MATCH_PAUSED').length,1);
  const lobby=await room.roster();assert.ok(lobby.players[0].reservedUntil>Date.now());
  assert.ok(lobby.players[0].reservedUntil<=Date.now()+REJOIN_GRACE);
  assert.equal((await room.roster()).players.length,2);
});
test('resuming on the same verified token restores seat and preserved HP/word index, even after hibernation',async()=>{
  const {room,ctx,a,b}=await playing();const prev=await ctx.storage.get('match');prev.participants[0].hp=1480;
  prev.participants[0].wordIndex=7;prev.participants[0].combo=4;prev.participants[0].skillCharge.e=4;
  prev.pendingAttacks=[{fromSeat:2,toSeat:1,skill:'q',character:'rune',amount:95,issuedAt:Date.now(),resolveAt:Date.now()+180}];
  await ctx.storage.put('match',prev);
  await room.webSocketClose(a);
  const sleeping=new PvPRoom(ctx,{});const recovered=await connect(sleeping,1);
  const after=await ctx.storage.get('match');
  assert.equal(messages(recovered,'CONNECTED')[0].payload.resumed,true);
  assert.equal(messages(recovered,'MATCH_START').at(-1).payload.match.players[0].hp,1480);
  assert.equal(after.participants[0].wordIndex,7);assert.equal(after.participants[0].combo,4);
  assert.equal(after.participants[0].skillCharge.e,4);
  assert.equal(after.status,'running');assert.ok(after.pendingAttacks[0].resolveAt>prev.pendingAttacks[0].resolveAt);
  // Round mode: the round clock is shifted by exactly the paused time, like the attack deadlines.
  const shift=after.pendingAttacks[0].resolveAt-prev.pendingAttacks[0].resolveAt;
  assert.equal(after.round.endsAt-prev.round.endsAt,shift);assert.equal(after.round.startedAt-prev.round.startedAt,shift);
  assert.equal(after.endsAt,after.round.endsAt);
  assert.equal(messages(b,'MATCH_RESUMED').length,1);
});
test('word requests cannot mutate a paused duel and fake resume events are server-only',async()=>{
  const {room,ctx,a,b}=await playing();await room.webSocketClose(a);
  const before=await ctx.storage.get('match');const p=before.participants[1];
  await packet(room,b,'WORD_SUBMIT',{matchId:before.id,wordIndex:p.wordIndex,text:p.currentWord});
  assert.equal(messages(b,'ERROR').at(-1).payload.code,'MATCH_PAUSED');
  await packet(room,b,'MATCH_RESUMED',{match:before});
  assert.equal(messages(b,'ERROR').at(-1).payload.code,'SERVER_ONLY_EVENT');
  assert.deepEqual(await ctx.storage.get('match'),before);
});
test('only one player offline at deadline -> forfeit awarded once to connected opponent',async()=>{
  const {room,ctx,a,b}=await playing();await room.webSocketClose(a);
  const roster=await room.roster();roster.players[0].reservedUntil=Date.now()-100;await room.save(roster);
  await room.alarm();const match=await ctx.storage.get('match');
  assert.equal(match.status,'ended');assert.equal(match.winnerSeat,2);
  assert.equal(match.endReason,'DISCONNECT_FORFEIT');assert.equal(messages(b,'MATCH_END').length,1);
  await room.alarm();assert.equal(messages(b,'MATCH_END').length,1);
});
test('both players disconnect -> cancellation instead of a free win',async()=>{
  const {room,ctx,a,b}=await playing();await room.webSocketClose(a);await room.webSocketClose(b);
  const roster=await room.roster();roster.players[0].reservedUntil=Date.now()-100;await room.save(roster);
  await room.alarm();const match=await ctx.storage.get('match');
  assert.equal(match.status,'ended');assert.equal(match.winnerSeat,null);assert.equal(match.endReason,'BOTH_DISCONNECTED');
});
test('explicit leave during active duel is immediate surrender',async()=>{
  const {room,ctx,a,b}=await playing();await packet(room,a,'LEAVE',{});
  const match=await ctx.storage.get('match');assert.equal(match.status,'ended');
  assert.equal(match.winnerSeat,2);assert.equal(match.endReason,'DISCONNECT_FORFEIT');
  assert.equal(messages(b,'MATCH_END').length,1);
});
test('duplicate close notifications do not restart the grace deadline',async()=>{
  const {room,ctx,a}=await playing();await room.webSocketClose(a);
  const until=(await room.roster()).players[0].reservedUntil;
  await room.webSocketClose(a);assert.equal((await room.roster()).players[0].reservedUntil,until);
  assert.equal((await ctx.storage.get('match')).status,'paused');
});
