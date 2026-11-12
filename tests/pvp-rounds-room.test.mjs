import test,{beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {PvPRoom} from '../cloudflare/src/room.js';
import {ROUND_HP,ROUND_WORDS,SERVER_ONLY_EVENTS,advanceMatch,nextDeadline} from '../cloudflare/src/match.js';
import {MessageType,makeEnvelope} from '../pvp/contracts.js';

const original={Response:globalThis.Response,WebSocketPair:globalThis.WebSocketPair,WebSocketRequestResponsePair:globalThis.WebSocketRequestResponsePair};
let last;
class Sock{constructor(){this.readyState=1;this.messages=[];this.attachment=null;}
 send(x){this.messages.push(JSON.parse(x));}serializeAttachment(a){this.attachment=structuredClone(a);}deserializeAttachment(){return structuredClone(this.attachment);}
 close(code=1000){this.readyState=3;this.code=code;}}
class Pair{constructor(){this.client=new Sock();this.server=new Sock();last=this.server;}}
class FakeResponse{constructor(_,p={}){this.status=p.status??200;this.webSocket=p.webSocket;this.headers=new Headers(p.headers);}}
beforeEach(()=>{globalThis.Response=FakeResponse;globalThis.WebSocketPair=Pair;globalThis.WebSocketRequestResponsePair=class {};});
afterEach(()=>Object.assign(globalThis,original));
function fixture(){const sockets=[],store=new Map();const f={alarm:null};
 const ctx={getWebSockets:()=>sockets.filter(s=>s.readyState===1),acceptWebSocket:s=>sockets.push(s),setWebSocketAutoResponse(){},
  storage:{get:async k=>structuredClone(store.get(k)),put:async(k,v)=>store.set(k,structuredClone(v)),setAlarm:async t=>{f.alarm=t;},deleteAll:async()=>store.clear()}};
 return Object.assign(f,{ctx,room:new PvPRoom(ctx,{})});
}
const token=i=>`${String(i).repeat(8)}-1234-4123-8123-${String(i).repeat(12)}-12345678-1234-4123-8123-${String(i).repeat(12)}`;
const request=(room,ws,type,payload={})=>room.webSocketMessage(ws,JSON.stringify({version:1,type,payload}));
const received=(ws,type)=>ws.messages.filter(m=>m.type===type);
async function join(room,i){await room.fetch(new Request('https://local.test/connect',{headers:{Upgrade:'websocket'}}));const ws=last;
 await request(room,ws,'JOIN',{name:`Oyuncu ${i}`,character:i===1?'fire':'rune',resumeToken:token(i)});return ws;}
async function lobby(){const f=fixture();await f.room.fetch(new Request('https://local.test/initialize',{method:'POST'}));
 const a=await join(f.room,1),b=await join(f.room,2);await request(f.room,a,'MATCH_CONFIG',{roundStyle:'counted'});return Object.assign(f,{a,b});}
async function start(f){
 await request(f.room,f.a,'READY_SET',{ready:true});await request(f.room,f.b,'READY_SET',{ready:true});
 const l=await f.room.roster();l.startAt=Date.now()-5;await f.room.save(l);await f.room.alarm();
 return f;
}
/** Forces the stored match clock so that the current phase deadline has already passed. */
async function expire(f,field='endsAt'){
 const m=await f.ctx.storage.get('match');const shift=m.round[field]-Date.now()+1;
 for(const k of ['startedAt','endsAt','settleUntil','nextRoundAt'])if(m.round[k]!==null)m.round[k]-=shift;
 m.endsAt=m.round.endsAt;await f.ctx.storage.put('match',m);await f.room.alarm();
}

test('room rounds: MATCH_CONFIG is host-only, validated, resets ready and is shown in ROOM_STATE',async()=>{
 const f=await lobby();
 // KESINYAP 11: rounds maçı her zaman 7; eski 5/10 ve roundWords ayarı reddedilir.
 assert.equal(received(f.a,'ROOM_STATE').at(-1).payload.rounds,7);
 await request(f.room,f.b,'MATCH_CONFIG',{rounds:7});
 assert.equal(received(f.b,'ERROR').at(-1).payload.code,'HOST_ONLY');
 await request(f.room,f.a,'MATCH_CONFIG',{rounds:6});
 assert.equal(received(f.a,'ERROR').at(-1).payload.code,'INVALID_ROUNDS');
 await request(f.room,f.a,'MATCH_CONFIG',{rounds:5});
 assert.equal(received(f.a,'ERROR').at(-1).payload.code,'INVALID_ROUNDS');
 await request(f.room,f.a,'MATCH_CONFIG',{roundWords:15});
 assert.equal(received(f.a,'ERROR').at(-1).payload.code,'INVALID_ROUNDS');
 await request(f.room,f.a,'MATCH_CONFIG',{rounds:'7'});
 assert.equal(received(f.a,'ERROR').at(-1).payload.code,'INVALID_ROUNDS');
 await request(f.room,f.a,'READY_SET',{ready:true});await request(f.room,f.b,'READY_SET',{ready:true});
 assert.equal((await f.room.roster()).phase,'countdown');
 await request(f.room,f.a,'MATCH_CONFIG',{rounds:7});
 const data=await f.room.roster();
 assert.equal(data.rounds,7);assert.equal(data.phase,'waiting');assert.ok(data.players.every(p=>p.ready===false));
 assert.equal(received(f.b,'COUNTDOWN_CANCELLED').length,1);
 assert.equal(received(f.b,'ROOM_STATE').at(-1).payload.rounds,7);
 await start(f);
 const m=await f.ctx.storage.get('match');assert.equal(m.mode,'rounds');assert.equal(m.totalRounds,7);
 await request(f.room,f.a,'MATCH_CONFIG',{rounds:5});
 assert.equal(received(f.a,'ERROR').at(-1).payload.code,'MATCH_STARTED');
});

test('room rounds: both sockets receive the same ROUND_START words after MATCH_START; alarm follows nextDeadline',async()=>{
 const f=await start(await lobby());
 const [ra,rb]=[received(f.a,'ROUND_START'),received(f.b,'ROUND_START')];
 assert.equal(ra.length,1);assert.equal(rb.length,1);
 assert.equal(ra[0].payload.words.length,5);assert.deepEqual(ra[0].payload.words,rb[0].payload.words); // KESINYAP 11: kelime raundu 1. raund 5 kelime
 assert.equal(ra[0].payload.wordCount,5);assert.equal(ra[0].payload.style,'counted');
 assert.equal(ra[0].payload.round,1);assert.equal(ra[0].payload.roundHp,ROUND_HP);
 assert.deepEqual(ra[0].payload.match.round.words,ra[0].payload.words);
 const order=f.a.messages.map(m=>m.type);assert.ok(order.indexOf('MATCH_START')<order.indexOf('ROUND_START'));
 assert.notEqual(ra[0].eventId,received(f.a,'MATCH_START')[0].eventId);
 const m=await f.ctx.storage.get('match');assert.equal(f.alarm,nextDeadline(m));
 assert.ok(!JSON.stringify(f.a.messages).includes('"seed"'));
});

test('room rounds: words go through round.words; ROUND_END and MATCH_END are delivered exactly once',async()=>{
 const f=await start(await lobby());
 let m=await f.ctx.storage.get('match');
 await request(f.room,f.a,'WORD_SUBMIT',{matchId:m.id,wordIndex:0,text:m.round.words[0],round:1});
 const ack=received(f.a,'WORD_RESULT').at(-1).payload;
 assert.equal(ack.correct,true);assert.equal(ack.streak,1);assert.equal(ack.roundWordIndex,1);
 await request(f.room,f.b,'WORD_SUBMIT',{matchId:m.id,wordIndex:0,text:m.round.words[0],round:2});
 assert.equal(received(f.b,'WORD_RESULT').at(-1).payload.code,'ROUND_MISMATCH');
 // KESINYAP 11: 7. raundda canı fazla olan maçı alır (raund galibiyeti yok). Seat 1 can üstünlüğüyle son raunda gelir.
 m=await f.ctx.storage.get('match');m.round.index=7;m.participants.find(p=>p.seat===2).hp=3000;await f.ctx.storage.put('match',m);
 await expire(f);
 assert.equal(received(f.a,'ROUND_END').length,1);assert.equal(received(f.b,'ROUND_END').length,1);
 const end=received(f.b,'ROUND_END')[0].payload;
 assert.equal(end.round,7);assert.equal(end.reason,'TIME');assert.equal(end.matchOver,true);assert.deepEqual(end.hp,{1:4000,2:3000});
 assert.equal(received(f.a,'MATCH_END').length,1);assert.equal(received(f.b,'MATCH_END').length,1);
 const stored=await f.ctx.storage.get('match');
 assert.equal(stored.status,'ended');assert.equal(stored.endReason,'ROUNDS');assert.equal(stored.winnerSeat,1);
 assert.equal(received(f.a,'MATCH_END')[0].payload.match.result.mode,'rounds');
 assert.equal((await f.ctx.storage.get('results')).length,1);
 await f.room.alarm();await f.room.alarm();
 assert.equal(received(f.a,'ROUND_END').length,1);assert.equal(received(f.a,'MATCH_END').length,1);
 await request(f.room,f.a,'WORD_SUBMIT',{matchId:m.id,wordIndex:1,text:'x'});
 assert.equal(received(f.a,'ERROR').at(-1).payload.code,'MATCH_NOT_ACTIVE');
});

test('room rounds: intermission → next round broadcast; late word is rejected as ROUND_NOT_ACTIVE',async()=>{
 const f=await start(await lobby());
 await expire(f);
 assert.equal(received(f.a,'ROUND_END').length,1);assert.equal(received(f.a,'ROUND_END')[0].payload.winnerSeat,null);
 let m=await f.ctx.storage.get('match');assert.equal(m.round.phase,'intermission');assert.equal(f.alarm,m.round.nextRoundAt);
 await request(f.room,f.a,'WORD_SUBMIT',{matchId:m.id,wordIndex:0,text:m.round.words[0]});
 assert.equal(received(f.a,'WORD_RESULT').at(-1).payload.code,'ROUND_NOT_ACTIVE');
 await expire(f,'nextRoundAt');
 const starts=received(f.b,'ROUND_START');assert.equal(starts.length,2);assert.equal(starts[1].payload.round,2);
 assert.notDeepEqual(starts[1].payload.words,starts[0].payload.words);
 assert.notEqual(starts[0].eventId,starts[1].eventId);
});

test('room rounds: the first finisher ends the round at once (ALL_DONE) inside the word handler; the rival cannot type the rest',async()=>{
 const f=await start(await lobby());
 let m=await f.ctx.storage.get('match');
 const last=m.round.words.length-1; // KESINYAP 11: 1. kelime raundu 5 kelime → son indeks 4
 for(const p of m.participants){p.roundWordIndex=last;p.wordIndex=last;p.currentWord=m.round.words[last];}
 await f.ctx.storage.put('match',m);
 await request(f.room,f.a,'WORD_SUBMIT',{matchId:m.id,wordIndex:last,text:m.round.words[last]});
 assert.equal(received(f.b,'ROUND_LAST_CALL').length,0,'son çağrı yok: ilk bitiren raundu kapatır');
 const end=received(f.a,'ROUND_END');assert.equal(end.length,1);assert.equal(end[0].payload.reason,'ALL_DONE');
 await new Promise(r=>setTimeout(r,60));
 await request(f.room,f.b,'WORD_SUBMIT',{matchId:m.id,wordIndex:last,text:'yanlis'});
 assert.equal(received(f.a,'ROUND_END').length,1,'rakibin geç kelimesi ikinci bitiş üretmez');
});

test('room rounds: rematch keeps the round count and deals new words with full ROUND_HP',async()=>{
 // KESINYAP 11: rövanş da 7 raund, tam 4000 can, yeni kelimeler (raund galibiyeti alanı yok).
 const f=await lobby();await request(f.room,f.a,'MATCH_CONFIG',{rounds:7});await start(f);
 const first=await f.ctx.storage.get('match');
 await request(f.room,f.a,'SURRENDER',{});
 await request(f.room,f.a,'REMATCH_VOTE',{accept:true});await request(f.room,f.b,'REMATCH_VOTE',{accept:true});
 const data=await f.room.roster();data.startAt=Date.now()-1;await f.room.save(data);await f.room.alarm();
 const next=await f.ctx.storage.get('match');
 assert.notEqual(next.id,first.id);assert.equal(next.totalRounds,7);assert.equal(next.roundsWon,undefined);
 assert.notDeepEqual(next.round.words,first.round.words);
 assert.deepEqual(next.participants.map(p=>p.hp),[ROUND_HP,ROUND_HP]);
 assert.equal(received(f.a,'ROUND_START').length,2);
 assert.equal(received(f.a,'ROOM_STATE').at(-1).payload.rounds,7);
});

test('room rounds: forged round events from a client are SERVER_ONLY_EVENT',async()=>{
 const f=await start(await lobby());
 for(const type of ['ROUND_START','ROUND_END','ROUND_LAST_CALL','WORD_CLASH']){
  assert.ok(SERVER_ONLY_EVENTS.has(type));
  await request(f.room,f.a,type,{round:9,winnerSeat:1});
  assert.equal(received(f.a,'ERROR').at(-1).payload.code,'SERVER_ONLY_EVENT');
 }
 assert.deepEqual((await f.ctx.storage.get('match')).roundHistory,[]); // KESINYAP 11: roundsWon yok; sahte olay geçmişe yazılmaz
 for(const t of ['MATCH_CONFIG','ROUND_START','ROUND_LAST_CALL','ROUND_END','WORD_CLASH','ULTIMATE_PHASE'])assert.equal(MessageType[t],t);
 assert.deepEqual(makeEnvelope(MessageType.MATCH_CONFIG,{rounds:7}).payload,{rounds:7});
 assert.equal(typeof advanceMatch,'function');
});
