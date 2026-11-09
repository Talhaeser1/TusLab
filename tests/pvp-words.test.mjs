import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,publicMatch,submitWord,finishMatch,MATCH_WORDS,MATCH_HP,ROUND_HP} from '../cloudflare/src/match.js';
import {PvPRoom} from '../cloudflare/src/room.js';
if(!globalThis.WebSocketRequestResponsePair)globalThis.WebSocketRequestResponsePair=class{constructor(a,b){this.a=a;this.b=b;}};
const both=[{playerId:'fire-id',seat:1,character:'fire'},{playerId:'rune-id',seat:2,character:'rune'}];
const original=()=>createMatch(both,1000,'match-8');
const sendWord=(m,seat=1,text,at=2000)=>submitWord(m,{
  playerId:both[seat-1].playerId,matchId:m.id,wordIndex:m.participants[seat-1].wordIndex,
  text:text??m.participants[seat-1].currentWord},at);

test('expected first word and text belong to each seat, no token leaked',()=>{
  const m=original();
  assert.equal(m.participants[0].currentWord,'Güçlü');
  assert.equal(m.participants[1].currentWord,'Rünler');
  assert.ok(!JSON.stringify(publicMatch(m)).includes('tokenHash'));
});
test('valid first word increments only sender combo, charge and sequence, never HP',()=>{
  const m=original();const outcome=sendWord(m);
  assert.equal(outcome.result.accepted,true);assert.equal(outcome.result.correct,true);
  assert.equal(outcome.match.participants[0].wordIndex,1);
  assert.equal(outcome.match.participants[0].currentWord,'savaşçı,');
  assert.equal(outcome.match.participants[0].combo,1);
  assert.equal(outcome.match.participants[1].wordIndex,0);
  assert.equal(outcome.match.sequence,2);
  assert.equal(outcome.match.participants[0].hp,MATCH_HP);
  assert.equal(m.participants[0].wordIndex,0);
});
test('wrong word is accepted as an attempt, breaks combo, penalizes accuracy',()=>{
  let m=sendWord(original()).match;
  const result=sendWord(m,1,'yanlış',2100);
  assert.equal(result.result.correct,false);
  assert.equal(result.match.participants[0].combo,0);
  assert.equal(result.match.participants[0].wrongWords,1);
  assert.ok(result.match.participants[0].accuracy<100);
  assert.equal(result.match.participants[0].wordIndex,2);
});
test('consecutive 2/4/5 correct words auto-cast Q/E/R and restart charge after R',()=>{
  let m=original();
  for(let i=1;i<=5;i++){
    m=sendWord(m,1,undefined,1000+i*500).match;
    const p=m.participants[0];
    const step=i%5;
    assert.deepEqual(p.skillCharge,{q:Math.min(2,step),e:Math.min(4,step),s:0,r:step});
    assert.equal(p.hp,MATCH_HP); // queued projectiles settle after 250 ms on the server
    if([2,4,5].includes(i))assert.equal(m.pendingAttacks.length,[2,4,5].indexOf(i)+1);
  }
  const next=sendWord(m,1,'not-the-correct-word',5000).match;
  assert.deepEqual(next.participants[0].skillCharge,{q:0,e:0,s:0,r:0});
});
test('rounds change active phrase automatically after sentence ends',()=>{
  let m=original();const n=MATCH_WORDS[0].split(/\s+/).length;
  for(let i=0;i<n;i++)m=sendWord(m,1,undefined,2000+i*100).match;
  assert.equal(m.participants[0].activeText,MATCH_WORDS[1]);
  assert.equal(m.participants[0].currentWord,'Rünler');
  assert.equal(m.participants[0].wordIndex,n);
});
test('Unicode NFC accepts composition-equivalent Turkish word, not case-insensitive',()=>{
  let m=original();
  // E.g. 'Güçlü' => decomposed ü
  const res=sendWord(m,1,'Gu\u0308çlu\u0308');assert.equal(res.result.correct,true);
  m=res.match;assert.equal(sendWord(m,1,'SAVAŞÇI,',2100).result.correct,false);
});
test('replayed index, wrong identity, huge value and invalid match cannot mutate',()=>{
  const m=original();
  const r=sendWord(m).match;
  for(const v of [
    {playerId:'fire-id',matchId:m.id,wordIndex:0,text:'Güçlü'},
    {playerId:'hacker',matchId:m.id,wordIndex:1,text:'savaşçı,'},
    {playerId:'fire-id',matchId:'forged',wordIndex:1,text:'savaşçı,'},
    {playerId:'fire-id',matchId:m.id,wordIndex:1,text:'A'.repeat(100)},
  ]){
    const outcome=submitWord(r,v,4000);
    assert.ok(outcome.error);
    assert.equal(r.sequence,2);
  }
});
test('expired match rejects even the correct word',()=>{
  const m=original();const result=sendWord(m,1,'Güçlü',m.endsAt+1);
  assert.equal(result.error,'MATCH_NOT_ACTIVE');
  const ended=finishMatch(m,m.endsAt);
  assert.equal(submitWord(ended,{playerId:'fire-id',matchId:m.id,wordIndex:0,text:'Güçlü'},m.endsAt+2).error,'MATCH_NOT_ACTIVE');
});
test('two players can submit at same time without changing each other scores',()=>{
  const a=sendWord(original(),1).match;
  const b=sendWord(a,2).match;
  assert.deepEqual(b.participants.map(p=>p.correctWords),[1,1]);
  assert.deepEqual(b.participants.map(p=>p.wordIndex),[1,1]);
  assert.equal(b.sequence,3);
});
class Socket{
  constructor(id,seat){this.readyState=1;this.messages=[];this.a={verified:true,playerId:id,seat,windowAt:0,count:0};}
  send(raw){this.messages.push(JSON.parse(raw));}
  serializeAttachment(a){this.a=structuredClone(a);}
  deserializeAttachment(){return structuredClone(this.a);}
  close(){this.readyState=3;}
}
async function roomWithPlayers(){
  const memory=new Map();const a=new Socket('fire-id',1),b=new Socket('rune-id',2);
  const ctx={storage:{get:async k=>structuredClone(memory.get(k)),put:async(k,v)=>memory.set(k,structuredClone(v)),setAlarm:async()=>{},deleteAll:async()=>memory.clear()},getWebSockets:()=>[a,b],setWebSocketAutoResponse:()=>{}};
  // The room always runs round mode: words come from match.round.words.
  const room=new PvPRoom(ctx,{});const m=createMatch(both,Date.now(),undefined,{rounds:5});
  await ctx.storage.put('lobby',{phase:'started',players:both.map(x=>({...x,ready:true})),startAt:null});
  await ctx.storage.put('match',m);return {room,ctx,m,a,b};
}
const socketSend=(room,ws,type,payload)=>room.webSocketMessage(ws,JSON.stringify({version:1,type,payload}));
test('server broadcasts accepted words to both clients, never accepts fake HP, ignores spoofed playerId',async()=>{
  const {room,ctx,m,a,b}=await roomWithPlayers();
  await socketSend(room,a,'WORD_SUBMIT',{matchId:m.id,wordIndex:0,text:m.round.words[0],playerId:'rune-id',hp:0,combo:1000,damage:9999});
  const ack=a.messages.find(x=>x.type==='WORD_RESULT');
  assert.equal(ack.payload.correct,true);
  assert.equal(ack.payload.seat,1);
  assert.equal(a.messages.filter(x=>x.type==='STATE_UPDATE').length,1);
  assert.equal(b.messages.filter(x=>x.type==='STATE_UPDATE').length,1);
  let stored=await ctx.storage.get('match');
  assert.deepEqual(stored.participants.map(x=>x.wordIndex),[1,0]);
  assert.deepEqual(stored.participants.map(x=>x.hp),[ROUND_HP,ROUND_HP]);
  assert.deepEqual(stored.participants.map(x=>x.roundWordIndex),[1,0]);
  await socketSend(room,a,'WORD_SUBMIT',{matchId:m.id,wordIndex:0,text:m.round.words[0]});
  const rejected=a.messages.filter(x=>x.type==='WORD_RESULT').at(-1);
  assert.equal(rejected.payload.accepted,false);
  assert.equal(rejected.payload.code,'WORD_INDEX_MISMATCH');
  stored=await ctx.storage.get('match');assert.equal(stored.sequence,2);
});
test('parallel WebSocket submissions serialized and single match sequence',async()=>{
  const {room,ctx,m,a,b}=await roomWithPlayers();
  await Promise.all([socketSend(room,a,'WORD_SUBMIT',{matchId:m.id,wordIndex:0,text:m.round.words[0]}),
    socketSend(room,b,'WORD_SUBMIT',{matchId:m.id,wordIndex:0,text:m.round.words[0]})]);
  const stored=await ctx.storage.get('match');
  assert.equal(stored.sequence,3);
  assert.deepEqual(stored.participants.map(p=>p.correctWords),[1,1]);
  assert.equal(a.messages.filter(x=>x.type==='STATE_UPDATE').length,2);
});
