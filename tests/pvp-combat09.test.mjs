import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,publicMatch,submitWord,resolveDueAttacks,MATCH_HP,ROUND_HP,DAMAGE,SHIELD_WINDOW_MS,COOLDOWNS,SHIELD_PROBABILITY,SERVER_ONLY_EVENTS} from '../cloudflare/src/match.js';
import {PvPRoom} from '../cloudflare/src/room.js';
if(!globalThis.WebSocketRequestResponsePair)globalThis.WebSocketRequestResponsePair=class{};
const players=[{playerId:'f',seat:1,character:'fire'},{playerId:'r',seat:2,character:'rune'}];
const begin=()=>createMatch(players,1000,'combat09');
function word(m,seat,at,typed){const p=m.participants[seat-1];const x=submitWord(m,{playerId:p.playerId,matchId:m.id,wordIndex:p.wordIndex,text:typed??p.currentWord},at);assert.ok(x.match,x.error);return x;}
function castAt(m,seat=1,startAt=2000){for(let i=0;i<2;i++)m=word(m,seat,startAt+i*100).match;return m;}

test('2 words cast Q, no damage before 250ms, then exactly one server damage',()=>{
  const start=begin();const m=castAt(start);assert.equal(m.pendingAttacks.length,1);
  assert.equal(m.combatEvents[0].type,'SKILL_CAST');
  assert.deepEqual(start.participants.map(p=>p.hp),[MATCH_HP,MATCH_HP]);
  const premature=resolveDueAttacks(m,2349);assert.equal(premature.match,m);
  const decided=resolveDueAttacks(m,2350,()=>0.99);
  assert.equal(decided.events.length,1);assert.equal(decided.events[0].type,'DAMAGE_APPLIED');
  assert.equal(decided.match.participants[1].hp,MATCH_HP-DAMAGE.fire.q);
  assert.equal(decided.match.pendingAttacks.length,0);
  assert.equal(resolveDueAttacks(decided.match,3000).events.length,0);
});
test('Q/E/R spells are auto-cast once at each cycle threshold with character-specific damage',()=>{
  let m=begin();const skills=[];
  for(let i=0;i<10;i++){const o=word(m,1,2000+i*1000);m=o.match;if(o.result.cast)skills.push(o.result.cast.skill);}
  assert.deepEqual(skills,['q','e','r','q','e','r']);
  assert.deepEqual(m.participants[0].skillCharge,{q:0,e:0,s:0,r:0});
  const all=resolveDueAttacks(m,15000,()=>1);
  assert.equal(all.match.participants[1].hp,2000-2*(DAMAGE.fire.q+DAMAGE.fire.e+DAMAGE.fire.r));
});
test('cooldown suppresses a skill if typing faster than cooldown',()=>{
  let m=begin();let spells=[];
  for(let i=0;i<8;i++){const o=word(m,1,2000+i*100);m=o.match;if(o.result.cast)spells.push(o.result.cast.skill);}
  assert.deepEqual(spells,['q','e','r']); // Q at combo 7 suppressed by 1300ms cooldown
});
test('perfect block if defender writes within ±250ms and RNG passes; HP is unchanged',()=>{
  let m=castAt(begin(),1,2000);
  m=word(m,2,2160).match;
  const draws=[0.01,0.99];const result=resolveDueAttacks(m,2350,()=>draws.shift());
  assert.deepEqual(result.events.map(e=>e.type),['SHIELD_TRIGGERED','DAMAGE_APPLIED']);
  assert.equal(result.events[1].blocked,true);
  assert.equal(result.match.participants[1].hp,2000);
  assert.ok(result.match.participants[1].shieldUntil>2100);
  assert.ok(result.match.participants[1].cooldownUntil.s>2100);
  assert.equal(SHIELD_PROBABILITY,0.30);
});
test('same typing window with unsuccessful chance deals damage; no shield',()=>{
  let m=castAt(begin(),1,2000);m=word(m,2,2110).match;
  const o=resolveDueAttacks(m,2350,()=>0.9);
  assert.equal(o.events.length,1);
  assert.equal(o.match.participants[1].hp,2000-DAMAGE.fire.q);
});
test('nearby word outside window or wrong answer never grants reactive shield',()=>{
  let m=castAt(begin(),1,2000);m=word(m,2,2400).match;
  assert.equal(resolveDueAttacks(m,2450,()=>0).events[0].blocked,false);
  m=castAt(begin(),1,2000);m=word(m,2,2110,'YANLIS').match;
  assert.equal(resolveDueAttacks(m,2350,()=>0).events[0].blocked,false);
  assert.equal(SHIELD_WINDOW_MS,250);
});
test('shield holds for shortly following projectile but not indefinitely',()=>{
  let m=castAt(begin(),1,2000);m=word(m,2,2150).match;
  {const draws=[0,0.99];m=resolveDueAttacks(m,2350,()=>draws.shift()).match;}
  const a=m.participants[1].hp;
  m.pendingAttacks.push({fromSeat:1,toSeat:2,skill:'e',character:'fire',amount:175,issuedAt:2700,resolveAt:2950});
  assert.equal(resolveDueAttacks(m,2950,()=>0.99).match.participants[1].hp,a+0-Math.round(175*0.4));
  m.pendingAttacks[0].issuedAt=3500;m.pendingAttacks[0].resolveAt=3750;
  assert.equal(resolveDueAttacks(m,3750,()=>0.99).match.participants[1].hp,a-175);
});
test('attack at 0 HP ends match and clears queued attacks, cannot score after KO',()=>{
  let m=castAt(begin());m.participants[1].hp=30;
  const ended=resolveDueAttacks(m,2350,()=>1).match;
  assert.equal(ended.status,'ended');assert.equal(ended.winnerSeat,1);assert.equal(ended.endReason,'KNOCKOUT');
  assert.equal(ended.participants[1].hp,0);assert.equal(ended.pendingAttacks.length,0);
  assert.equal(submitWord(ended,{playerId:'f',matchId:m.id,wordIndex:2,text:'hi'},2400).error,'MATCH_NOT_ACTIVE');
});
test('invalid/replayed words and forged skills cannot modify match state',()=>{
  const m=begin();for(const params of [{playerId:'wrong',matchId:m.id,wordIndex:0,text:'Güçlü'},
    {playerId:'f',matchId:'other',wordIndex:0,text:'Güçlü'},
    {playerId:'f',matchId:m.id,wordIndex:1,text:'Güçlü'},
    {playerId:'f',matchId:m.id,wordIndex:0,text:' '},])assert.ok(submitWord(m,params,2000).error);
  assert.equal(m.pendingAttacks.length,0);assert.equal(m.combatEvents.length,0);
  assert.ok(SERVER_ONLY_EVENTS.has('SHIELD_TRIGGERED'));
  const view=publicMatch(m);view.players[0].hp=5;view.combatEvents.push({id:99});assert.equal(m.participants[0].hp,2000);
});
test('server chamber alarm resolves persistent attack and broadcasts HP to both sockets',async()=>{
  class WS{constructor(id,seat){this.readyState=1;this.messages=[];this.att={verified:true,playerId:id,seat,windowAt:0,count:0};}
    send(data){this.messages.push(JSON.parse(data));}deserializeAttachment(){return structuredClone(this.att);}serializeAttachment(x){this.att=structuredClone(x);}}
  const ws1=new WS('f',1),ws2=new WS('r',2);const memory=new Map();let alarmTime;
  const ctx={storage:{get:async x=>structuredClone(memory.get(x)),put:async(x,v)=>memory.set(x,structuredClone(v)),setAlarm:async t=>{alarmTime=t;},deleteAll:async()=>memory.clear()},getWebSockets:()=>[ws1,ws2],setWebSocketAutoResponse:()=>{}};
  const room=new PvPRoom(ctx,{});
  // Round mode (the room's only mode): Q is cast on the third correct word in a row.
  const initial=createMatch(players,Date.now()-8000,'realroom',{rounds:5});
  await ctx.storage.put('match',initial);await ctx.storage.put('lobby',{phase:'started',players:players.map(p=>({...p,ready:true})),startAt:null});
  async function submit(seat){const ws=seat===1?ws1:ws2;const current=await ctx.storage.get('match');const p=current.participants[seat-1];
    return room.webSocketMessage(ws,JSON.stringify({version:1,type:'WORD_SUBMIT',payload:{matchId:current.id,wordIndex:p.wordIndex,text:p.currentWord}}));}
  await submit(1);await new Promise(resolve=>setTimeout(resolve,62));await submit(1);
  await new Promise(resolve=>setTimeout(resolve,62));await submit(1);
  const before=await ctx.storage.get('match');assert.equal(before.participants[1].hp,ROUND_HP);
  assert.equal(ws2.messages.filter(m=>m.type==='SKILL_CAST').length,1);
  assert.equal(alarmTime,before.pendingAttacks[0].resolveAt);
  before.pendingAttacks[0].resolveAt=Date.now()-1;
  await ctx.storage.put('match',before);
  await room.alarm();
  const after=await ctx.storage.get('match');
  assert.equal(after.participants[1].hp,ROUND_HP-100); // raund modu: ROUND_DAMAGE.q = 100 (iki arketip eşit)
  assert.equal(ws1.messages.filter(m=>m.type==='DAMAGE_APPLIED').length,1);
  assert.equal(ws2.messages.filter(m=>m.type==='DAMAGE_APPLIED').length,1);
  await room.alarm();assert.equal(ws2.messages.filter(m=>m.type==='DAMAGE_APPLIED').length,1);
});
