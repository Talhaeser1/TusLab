import test,{beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import worker,{codeOK,generateRoomCode,sameOrigin} from '../cloudflare/src/index.js';
import {PvPRoom} from '../cloudflare/src/room.js';
import {PvPNetworkConsole,inviteLink,invitedRoom,errorText} from '../pvp/network.js';
import {RELEASE_STAGE} from '../pvp/release.js';

const saved={Response:globalThis.Response,WebSocketPair:globalThis.WebSocketPair,WebSocketRequestResponsePair:globalThis.WebSocketRequestResponsePair};
let pair;
class Socket {
  constructor(){this.readyState=1;this.messages=[];this.attachment=null;}
  send(value){this.messages.push(JSON.parse(value));}
  serializeAttachment(v){this.attachment=structuredClone(v);}
  deserializeAttachment(){return structuredClone(this.attachment);}
  close(code=1000){this.readyState=3;this.code=code;}
}
class Pair {constructor(){this.client=new Socket();this.server=new Socket();pair=this;}}
class FakeResponse {
  constructor(body,options={}){this.body=body;this.status=options.status??200;this.headers=new Headers(options.headers||{});this.webSocket=options.webSocket;this.ok=this.status>=200&&this.status<300;}
  async json(){return JSON.parse(this.body);}
}
beforeEach(()=>{globalThis.Response=FakeResponse;globalThis.WebSocketPair=Pair;globalThis.WebSocketRequestResponsePair=class {constructor(a,b){this.a=a;this.b=b;}};});
afterEach(()=>{Object.assign(globalThis,saved);});
function context(){const sockets=[];const memory=new Map();let alarmAt=null;
  return {sockets,memory,get alarmAt(){return alarmAt;},getWebSockets(){return sockets.filter(s=>s.readyState===1);},acceptWebSocket(ws){sockets.push(ws);},setWebSocketAutoResponse(){},storage:{async get(k){return memory.get(k);},async put(k,v){memory.set(k,structuredClone(v));},async setAlarm(v){alarmAt=v;},async deleteAll(){memory.clear();}}};
}
const req=(path,options={})=>new Request('https://tuslab.test'+path,options);
const sent=(sock,type)=>sock.messages.filter(x=>x.type===type);
const msg=(room,sock,type,payload={})=>room.webSocketMessage(sock,JSON.stringify({version:1,type,payload}));
const token=i=>`12345678-1234-4123-8123-1234567890${String(i).padStart(2,'0')}-12345678-1234-4123-8123-1234567890${String(i).padStart(2,'0')}`;
async function makeRoom(){const ctx=context();const room=new PvPRoom(ctx,{});await room.fetch(req('/initialize',{method:'POST'}));return {ctx,room};}
async function connect(room,i,name=`Savaşçı ${i}`,character=i===1?'fire':'rune',secret=token(i)){
  const result=await room.fetch(req('/connect',{headers:{Upgrade:'websocket'}}));
  assert.equal(result.status,101);
  const ws=pair.server;
  assert.ok(sent(ws,'HELLO').length);
  await msg(room,ws,'JOIN',{name,character,resumeToken:secret});
  return ws;
}
test('room ids, origin checks and invitation URL',()=>{
  const codes=new Set(Array.from({length:100},generateRoomCode));assert.equal(codes.size,100);
  for(const c of codes)assert.ok(codeOK(c));
  assert.equal(codeOK('X'.repeat(17)),false);
  assert.equal(sameOrigin(req('/api/pvp/rooms',{headers:{Origin:'https://tuslab.test'}})),true);
  assert.equal(sameOrigin(req('/api/pvp/rooms',{headers:{Origin:'https://evil.test'}})),false);
  const url=inviteLink('https://example.workers.dev/index.html?a=b','ABCDEFGHJKLMNPQR');
  assert.equal(invitedRoom(url),'ABCDEFGHJKLMNPQR');
  assert.equal(new URL(url).pathname,'/');
  assert.equal(invitedRoom('https://example.test/?pvpRoom=bad'),null);
});

test('expired invitation is rejected in Turkish before opening a reconnecting socket',async()=>{
  const originalFetch=globalThis.fetch;
  const calls=[];globalThis.fetch=async url=>{calls.push(url);return {ok:false,status:404,json:async()=>({error:'ROOM_NOT_FOUND'})};};
  const view={readName:()=> 'Oyuncu B',disconnect:()=>calls.push('disconnect'),connect:()=>calls.push('connect'),log:message=>calls.push(message),render:()=>{}};
  try{await PvPNetworkConsole.prototype.join.call(view,'ABCDEFGHJKLMNPQR');}
  finally{globalThis.fetch=originalFetch;}
  assert.equal(calls.some(x=>x==='connect'),false);
  assert.match(view.status,/Oda bulunamadı/);
  assert.equal(calls[0],'/api/pvp/rooms/ABCDEFGHJKLMNPQR');
});

test('room protocol errors shown to players never expose raw server codes',()=>{
  for(const code of ['RATE_LIMIT','MATCH_PAUSED','MATCH_ID_MISMATCH','INVALID_WORD','INVALID_READY','REMATCH_NOT_AVAILABLE','SECURITY_SERVICE_UNAVAILABLE']){
    assert.notEqual(errorText(code),code);
    assert.match(errorText(code),/[çğıöşüÇĞİÖŞÜa-z]/);
  }
  assert.notEqual(errorText('FUTURE_SERVER_ERROR'),'FUTURE_SERVER_ERROR');
});
test('HTTP endpoints handle health, room creation, status and malformed IDs',async()=>{
  const {room}=await makeRoom();
  const env={PVP_ROOMS:{idFromName:c=>c,get:()=>({fetch:(v,options)=>room.fetch(v instanceof Request?v:new Request(v,options))})},ASSETS:{fetch:()=>null}};
  const health=await worker.fetch(req('/api/health'),env);assert.equal((await health.json()).stage,RELEASE_STAGE);
  assert.equal((await worker.fetch(req('/api/missing'),env)).status,404);
  const created=await worker.fetch(req('/api/pvp/rooms',{method:'POST',headers:{Origin:'https://tuslab.test'}}),{
    ...env,PVP_ROOMS:{idFromName:c=>c,get:()=>({fetch:async()=>new FakeResponse(null,{status:204})})}
  });
  assert.equal(created.status,201);const data=await created.json();assert.ok(codeOK(data.roomCode));
  assert.equal((await worker.fetch(req('/api/pvp/rooms/INVALID'),env)).status,400);
  assert.equal((await worker.fetch(req('/api/pvp/rooms/ABCDEFGHJKLMNPQR'),env)).status,200);
  assert.equal((await worker.fetch(req('/api/pvp/rooms',{method:'POST',headers:{Origin:'https://evil.test'}}),env)).status,403);
});
test('two authenticated players join with names and separate seats',async()=>{
  const {room}=await makeRoom();
  const a=await connect(room,1,'Alev Oyuncusu');const b=await connect(room,2,'Rün Oyuncusu');
  assert.equal(sent(a,'CONNECTED')[0].payload.seat,1);
  assert.equal(sent(b,'CONNECTED')[0].payload.seat,2);
  const state=sent(a,'ROOM_STATE').at(-1).payload;
  assert.equal(state.players.length,2);
  assert.deepEqual(state.players.map(p=>p.name),['Alev Oyuncusu','Rün Oyuncusu']);
  assert.ok(state.players.every(p=>p.online));
  assert.equal(state.connected.length,2);
});
test('third player cannot join, including after temporary disconnect inside grace',async()=>{
  const {room}=await makeRoom();const a=await connect(room,1);await connect(room,2);
  const c=await connect(room,3);
  assert.equal(sent(c,'ERROR').at(-1).payload.code,'ROOM_FULL');
  await room.webSocketClose(a);
  const d=await connect(room,4);assert.equal(sent(d,'ERROR').at(-1).payload.code,'ROOM_FULL');
});
test('both players must be ready before countdown and can cancel it',async()=>{
  const {room,ctx}=await makeRoom();const a=await connect(room,1);const b=await connect(room,2);
  await msg(room,a,'READY_SET',{ready:true});
  assert.equal((await room.roster()).phase,'waiting');
  await msg(room,b,'READY_SET',{ready:true});
  assert.equal((await room.roster()).phase,'countdown');
  assert.ok(ctx.alarmAt>Date.now());assert.equal(sent(a,'COUNTDOWN').length,1);
  await msg(room,b,'READY_SET',{ready:false});
  assert.equal((await room.roster()).phase,'waiting');
  assert.equal(sent(a,'COUNTDOWN_CANCELLED').length,1);
});
test('countdown alarm produces authoritative initial match with fixed HP',async()=>{
  const {room,ctx}=await makeRoom();const a=await connect(room,1);const b=await connect(room,2);
  await msg(room,a,'READY_SET',{ready:true});await msg(room,b,'READY_SET',{ready:true});
  const data=await room.roster();data.startAt=Date.now()-1;await room.save(data);
  await room.alarm();
  assert.equal((await room.roster()).phase,'started');
  assert.equal(sent(a,'MATCH_START').length,1);
  assert.equal(sent(b,'MATCH_START')[0].payload.match.status,'running');
  assert.deepEqual(sent(a,'MATCH_START')[0].payload.match.players.map(p=>p.hp),[6000,6000]); // round mode: ROUND_HP (6000 taşınan can, RAPOR-PVP-MEKANIK)
  assert.equal(JSON.stringify(await room.roster()).includes('hp'),false); // lobby does not store fake HP
  assert.equal((await ctx.storage.get('match')).sequence,1);
});
test('a player can select a new character but it clears ready status',async()=>{
  const {room}=await makeRoom();const a=await connect(room,1);await connect(room,2);
  await msg(room,a,'READY_SET',{ready:true});
  await msg(room,a,'CHARACTER_SELECT',{character:'rune'});
  const p=(await room.roster()).players[0];assert.equal(p.character,'rune');assert.equal(p.ready,false);
  await msg(room,a,'CHARACTER_SELECT',{character:'unknown'});
  assert.equal(sent(a,'ERROR').at(-1).payload.code,'INVALID_CHARACTER');
});
test('resume token reclaims same seat after reload, without exposing token to peer',async()=>{
  const {room,ctx}=await makeRoom();const a=await connect(room,1,'Talha');const b=await connect(room,2,'Dost');
  const orig=sent(a,'CONNECTED')[0].payload.playerId;
  await room.webSocketClose(a);
  const reawoken=new PvPRoom(ctx,{});
  const renewed=await connect(reawoken,1,'Talha');
  assert.equal(sent(renewed,'CONNECTED')[0].payload.playerId,orig);
  assert.equal(sent(renewed,'CONNECTED')[0].payload.resumed,true);
  assert.equal(sent(renewed,'CONNECTED')[0].payload.seat,1);
  assert.ok(!JSON.stringify(sent(b,'ROOM_STATE')).includes('tokenHash'));
});
test('intentional leave frees a seat for the next friend',async()=>{
  const {room}=await makeRoom();const a=await connect(room,1);const b=await connect(room,2);
  await msg(room,a,'LEAVE',{});
  assert.equal((await room.roster()).players.length,1);
  assert.equal(a.readyState,3);
  const newcomer=await connect(room,3);
  assert.equal(sent(newcomer,'CONNECTED')[0].payload.seat,1);
  assert.equal(sent(b,'ROOM_STATE').at(-1).payload.connected.length,2);
});
test('invalid envelope, rate limits and untrusted damage are rejected',async()=>{
  const {room}=await makeRoom();const a=await connect(room,1);
  await room.webSocketMessage(a,'oops');
  assert.equal(sent(a,'ERROR').at(-1).payload.code,'INVALID_JSON');
  await msg(room,a,'DAMAGE_APPLIED',{amount:999999});
  assert.equal(sent(a,'ERROR').at(-1).payload.code,'SERVER_ONLY_EVENT');
  for(let i=0;i<32;i++)await msg(room,a,'PING',{}); // PING is intentionally allowed independent of rate limit
  for(let i=0;i<32;i++)await msg(room,a,'PEER_MESSAGE',{text:'hi'});
  assert.equal(sent(a,'ERROR').at(-1).payload.code,'RATE_LIMIT');
  const {room:other}=await makeRoom();const u=await connect(other,11);
  await other.webSocketMessage(u,'x'.repeat(4097));assert.equal(u.code,1009);
});
test('WebSocket must JOIN before setting ready or accessing other player data',async()=>{
  const {room}=await makeRoom();
  const resp=await room.fetch(req('/connect',{headers:{Upgrade:'websocket'}}));assert.equal(resp.status,101);const pending=pair.server;
  await msg(room,pending,'READY_SET',{ready:true});
  assert.equal(sent(pending,'ERROR').at(-1).payload.code,'JOIN_REQUIRED');
  await msg(room,pending,'JOIN',{name:'a',character:'fire',resumeToken:'not-a-token'});
  assert.equal(sent(pending,'ERROR').at(-1).payload.code,'INVALID_JOIN');
});
test('alarm removes fully empty rooms and retains active room state',async()=>{
  const {room,ctx}=await makeRoom();assert.ok(ctx.memory.has('createdAt'));
  await room.alarm();assert.equal(ctx.memory.size,0);
  const second=await makeRoom();const sock=await connect(second.room,1);
  await second.room.alarm();assert.ok(second.ctx.memory.has('createdAt'));
  sock.close();await second.room.webSocketClose(sock);await second.room.alarm();assert.ok(second.ctx.memory.has('createdAt')); // 45-second reserved seat
});
test('parallel JOIN messages are serialized and cannot steal the same seat',async()=>{
  const {room}=await makeRoom();
  const sockets=[];
  for(let i=1;i<=3;i++){
    await room.fetch(req('/connect',{headers:{Upgrade:'websocket'}}));sockets.push(pair.server);
  }
  await Promise.all(sockets.map((s,i)=>msg(room,s,'JOIN',{name:'Oyuncu '+i,character:'fire',resumeToken:token(i+20)})));
  assert.equal((await room.roster()).players.length,2);
  assert.deepEqual((await room.roster()).players.map(x=>x.seat).sort(),[1,2]);
  assert.equal(sent(sockets[2],'ERROR').at(-1).payload.code,'ROOM_FULL');
});
