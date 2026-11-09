import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{PvPGuard,readJsonLimited,enforceEdgeRate} from '../cloudflare/src/index.js';
import {PvPRoom} from '../cloudflare/src/room.js';
import {createMatch,submitWord} from '../cloudflare/src/match.js';

function guardContext(){const memory=new Map();return {memory,storage:{get:async k=>structuredClone(memory.get(k)),put:async(k,v)=>memory.set(k,structuredClone(v))}};}
function guardEnvironment(){const actors=new Map();const keys=[];
  return {keys,PVP_GUARD:{idFromName:id=>id,get(id){keys.push(id);if(!actors.has(id))actors.set(id,new PvPGuard(guardContext()));return {fetch:(r,options)=>actors.get(id).fetch(r instanceof Request?r:new Request(r,options))};}},
    PVP_ROOMS:{idFromName:id=>id,get(){return {fetch:async()=>new Response(null,{status:204})};}},
    ASSETS:{fetch:async()=>new Response('ok')}};}
const request=(path,options={})=>new Request('https://tuslab.test'+path,options);
const post=(path,body,ip='203.0.113.1')=>request(path,{method:'POST',headers:{'origin':'https://tuslab.test','cf-connecting-ip':ip,'content-type':'application/json'},body:JSON.stringify(body)});

test('guard rate counts atomically, per route, and retains state across actor instances',async()=>{
  const ctx=guardContext();let actor=new PvPGuard(ctx);
  const policy={scope:'/api/pvp/rooms',max:2,seconds:60};
  const ask=()=>actor.fetch(request('/check',{method:'POST',body:JSON.stringify(policy)}));
  assert.equal((await ask()).status,204);
  actor=new PvPGuard(ctx);assert.equal((await ask()).status,204);
  assert.equal((await ask()).status,429);
  assert.equal(ctx.memory.get('rate:/api/pvp/rooms').count,3);
});
test('edge room creation restricts one network client, while other client can create',async()=>{
  const env=guardEnvironment();
  for(let i=0;i<6;i++)assert.equal((await worker.fetch(post('/api/pvp/rooms',{}),env)).status,201);
  const banned=await worker.fetch(post('/api/pvp/rooms',{}),env);
  assert.equal(banned.status,429);assert.equal((await banned.json()).error,'RATE_LIMIT');
  assert.equal((await worker.fetch(post('/api/pvp/rooms',{},'198.51.100.7'),env)).status,201);
  assert.ok(env.keys.every(x=>/^edge:[a-f0-9]{64}$/.test(x)),'raw IP addresses must not be stored as actor names');
});
test('edge limiter fails safely when bound security service is unavailable',async()=>{
  const env={PVP_GUARD:{idFromName:()=>1,get(){throw Error('Unavailable');}}};
  const res=await enforceEdgeRate(post('/api/pvp/rooms',{}),env,'/api/pvp/rooms');
  assert.equal(res.status,503);assert.equal((await res.json()).error,'SECURITY_SERVICE_UNAVAILABLE');
});
test('JSON reader limits bytes even when Content-Length is absent',async()=>{
  const huge=request('/api/pvp/social',{method:'POST',body:new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('x'.repeat(1600)));c.close();}}),duplex:'half'});
  const parsed=await readJsonLimited(huge,1400);assert.equal(parsed.error,'TOO_LARGE');
  const env=guardEnvironment();
  const response=await worker.fetch(post('/api/pvp/social',{guestToken:'A'.repeat(1700)}),env);
  assert.equal(response.status,413);assert.equal((await response.json()).error,'TOO_LARGE');
});
test('JSON body parser distinguishes invalid syntax from oversized payload',async()=>{
  const bad=await readJsonLimited(request('/api/pvp/social',{method:'POST',body:'{oops'}),1400);
  assert.equal(bad.error,'INVALID_JSON');
  const good=await readJsonLimited(request('/api/pvp/social',{method:'POST',body:'{"ok":true}'}),1400);
  assert.deepEqual(good.value,{ok:true});
});
test('cross-origin socket handshake cannot access rooms',async()=>{
  const env=guardEnvironment();
  const res=await worker.fetch(request('/api/pvp/rooms/ABCDEFGHJKLMNPQR/ws',{headers:{Upgrade:'websocket',Origin:'https://attacker.example'}}),env);
  assert.equal(res.status,403);assert.equal((await res.json()).error,'CROSS_ORIGIN');
});
test('1000+ WPM burst is rejected using server time and state remains unchanged',()=>{
  const m=createMatch([{playerId:'f',seat:1,character:'fire'},{playerId:'r',seat:2,character:'rune'}],1000,'match-sec');
  const send=(source,time,idx,text)=>submitWord(source,{playerId:'f',matchId:m.id,wordIndex:idx,text},time);
  const first=send(m,2000,0,'Güçlü');assert.equal(first.result.accepted,true);
  const before=first.match;
  const quick=send(before,2010,1,'savaşçı,');
  assert.equal(quick.error,'WORD_BURST_LIMIT');assert.equal(before.participants[0].wordIndex,1);
  assert.equal(before.participants[1].hp,2000);
  const genuine=send(before,2100,1,'savaşçı,');assert.equal(genuine.result.accepted,true);
  const replay=send(genuine.match,2200,1,'savaşçı,');assert.equal(replay.error,'WORD_INDEX_MISMATCH');
});
test('bulk invalid ping frames are throttled even before JOIN',async()=>{
  globalThis.WebSocketRequestResponsePair??=class{constructor(){}};
  const room=new PvPRoom({setWebSocketAutoResponse(){}},{});
  const sent=[];let attachment={verified:false,windowAt:Date.now(),count:0};let closeCode=0;
  const ws={deserializeAttachment:()=>structuredClone(attachment),serializeAttachment:s=>{attachment=structuredClone(s);},send:raw=>sent.push(JSON.parse(raw)),close:code=>{closeCode=code;}};
  for(let i=0;i<46;i++)await room.webSocketMessage(ws,JSON.stringify({version:1,type:'PING',payload:{nonce:'bad'}}));
  assert.equal(closeCode,1008);assert.ok(sent.some(x=>x.payload?.code==='RATE_LIMIT'));
});
test('invalid JSON spam has the same raw frame cap as valid envelopes',async()=>{
  globalThis.WebSocketRequestResponsePair??=class{constructor(){}};
  const room=new PvPRoom({setWebSocketAutoResponse(){}},{});
  const sent=[];let attachment={verified:false,windowAt:Date.now(),count:0};let closeCode=0;
  const ws={deserializeAttachment:()=>structuredClone(attachment),serializeAttachment:s=>{attachment=structuredClone(s);},send:raw=>sent.push(JSON.parse(raw)),close:code=>{closeCode=code;}};
  for(let i=0;i<46;i++)await room.webSocketMessage(ws,'{invalid');
  assert.equal(closeCode,1008);assert.equal(sent.at(-1).payload.code,'RATE_LIMIT');
});
test('fake HP/skill/terminal event packets are never accepted from clients',async()=>{
  globalThis.WebSocketRequestResponsePair??=class{constructor(){}};
  const room=new PvPRoom({setWebSocketAutoResponse(){}},{});
  const sent=[];let attachment={verified:true,playerId:'player1',seat:1,windowAt:Date.now(),count:0};
  const ws={deserializeAttachment:()=>structuredClone(attachment),serializeAttachment:s=>{attachment=structuredClone(s);},send:raw=>sent.push(JSON.parse(raw)),close(){}};
  for(const type of ['DAMAGE_APPLIED','MATCH_END','SKILL_CAST','SHIELD_TRIGGERED']){
    await room.webSocketMessage(ws,JSON.stringify({version:1,type,payload:{amount:999999,win:true}}));
  }
  assert.equal(sent.filter(x=>x.payload?.code==='SERVER_ONLY_EVENT').length,4);
});
