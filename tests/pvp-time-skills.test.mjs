import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,pickRoundSkill,advanceMatch,submitWord,publicMatch,roundStartPayload,nextDeadline,
  roundDurationMs,ROUND_LAST_CALL_MS,ROUND_SUMMARY_MS,ROUND_INTRO_MS} from '../pvp/shared/match.js';
// KESINYAP mekanik: sayılı raund süresi kelime sayısına bağlı; testlerde "varsayılan raund süresi" = varsayılan sayılı raund (10 kelime → 60 sn).
const ROUND_DURATION_MS=roundDurationMs({roundStyle:'counted',roundWords:5}); // 5 kelime → 40 sn (eski zaman çizelgesi)
import {ARENA_TIME_THIEF_MS,ARENA_FREEZE_MS} from '../pvp/shared/arena-skills.js';
import {PvPRoom} from '../cloudflare/src/room.js';
import {createPracticeSession,HUMAN_ID,BOT_ID} from '../pvp/practice.js';
import {MessageType,makeEnvelope} from '../pvp/contracts.js';

const T=1_700_000_000_000;
const players=[{seat:1,playerId:'one',character:'fire'},{seat:2,playerId:'two',character:'rune'}];
const create=()=>createMatch(players,T,'time-skills',{rounds:5,seed:42,roundStyle:'counted',roundWords:5});
const intermission=m=>advanceMatch(m,m.round.endsAt+1).match;
const next=m=>advanceMatch(m,m.round.nextRoundAt).match;
const pick=(m,seat,skill)=>pickRoundSkill(m,{playerId:players[seat-1].playerId,skill},m.round.endedAt+1);

test('skill pick validates phase, ids, one choice, null lock, and two uses per skill',()=>{
  let m=create();
  assert.equal(pickRoundSkill(m,{playerId:'one',skill:'freeze'},T+1).error,'ROUND_SKILL_NOT_INTERMISSION');
  m=intermission(m);
  assert.equal(pick(m,1,'scramble').error,'INVALID_ROUND_SKILL');
  assert.equal(pick(m,1,undefined).error,'INVALID_ROUND_SKILL');
  assert.equal(pick(m,1,'freeze').result.usesLeft.freeze,1);
  m=pick(m,1,null).match;
  assert.equal(pick(m,1,'freeze').error,'ROUND_SKILL_LOCKED');
  m=next(m);m=intermission(m);m=pick(m,1,'freeze').match;
  m=next(m);m=intermission(m);m=pick(m,1,'freeze').match;
  m=next(m);m=intermission(m);
  assert.equal(pick(m,1,'freeze').error,'ROUND_SKILL_EXHAUSTED');
  assert.equal(pick(m,1,'blindclock').error,undefined);
  assert.equal(pickRoundSkill(m,{playerId:'stranger',skill:null},m.round.endedAt+1).error,'NOT_MATCH_PARTICIPANT');
});

test('picks remain private through intermission and are announced at ROUND_START',()=>{
  let m=intermission(create());
  m=pick(m,1,'timethief').match;
  const victim=publicMatch(m,2),owner=publicMatch(m,1);
  assert.equal(victim.roundSkillPick,null);
  assert.equal(victim.roundSkillPickLocked,false);
  assert.equal(owner.roundSkillPick,'timethief');
  assert.equal(owner.roundSkillPickLocked,true);
  assert.deepEqual(victim.round.skills,{1:null,2:null});
  m=next(m);
  assert.deepEqual(roundStartPayload(m).skills,{1:'timethief',2:null});
  assert.deepEqual(publicMatch(m,2).round.skills,{1:'timethief',2:null});
});

test('personal deadlines, combined picks, submission cutoff and round close',()=>{
  // Süreler motordan gelir (paket 30: ROUND_DURATION_MS 30 → 40 sn); burada yalnız beceri deltaları sabittir.
  const cases=[
    ['timethief',null,ROUND_DURATION_MS,ROUND_DURATION_MS-ARENA_TIME_THIEF_MS],
    [null,'freeze',ROUND_DURATION_MS,ROUND_DURATION_MS+ARENA_FREEZE_MS],
    ['timethief','timethief',ROUND_DURATION_MS-ARENA_TIME_THIEF_MS,ROUND_DURATION_MS-ARENA_TIME_THIEF_MS],
    ['timethief','freeze',ROUND_DURATION_MS,ROUND_DURATION_MS-ARENA_TIME_THIEF_MS+ARENA_FREEZE_MS]
  ];
  for(const [a,b,one,two] of cases){
    let m=intermission(create());
    if(a)m=pick(m,1,a).match;
    if(b)m=pick(m,2,b).match;
    m=next(m);
    const start=m.round.startedAt;
    assert.equal(m.participants[0].roundEndsAt,start+one);
    assert.equal(m.participants[1].roundEndsAt,start+two);
    assert.equal(m.round.endsAt,start+Math.max(one,two));
    assert.equal(nextDeadline(m),m.round.endsAt);
    const early=two<one?2:1;
    const p=m.participants.find(x=>x.seat===early);
    const rejected=submitWord(m,{playerId:p.playerId,matchId:m.id,wordIndex:p.wordIndex,text:p.currentWord,round:m.round.index},p.roundEndsAt);
    assert.equal(rejected.error,'ROUND_NOT_ACTIVE');
    assert.equal(advanceMatch(m,m.round.endsAt-1).match.round.phase,'round');
    assert.equal(advanceMatch(m,m.round.endsAt).match.round.phase,'intermission');
  }
});

test('last call shortens only the unfinished player and respects an earlier stolen deadline',()=>{
  const stolen=ROUND_DURATION_MS-ARENA_TIME_THIEF_MS; // hırsız kurbanının kişisel bitişi
  let m=intermission(create());m=pick(m,1,'timethief').match;m=next(m);
  const start=m.round.startedAt;
  const one=m.participants[0];
  one.roundWordIndex=9;one.wordIndex=9;one.currentWord=m.round.words[9];
  const finishAt=start+stolen-6_000;
  const shortened=Math.min(start+stolen,finishAt+ROUND_LAST_CALL_MS);
  const outcome=submitWord(m,{playerId:one.playerId,matchId:m.id,wordIndex:9,text:'yanlis',round:m.round.index},finishAt);
  assert.equal(outcome.result.roundEvents[0].type,'ROUND_LAST_CALL');
  assert.equal(outcome.match.participants[1].roundEndsAt,shortened);
  assert.equal(outcome.match.round.endsAt,shortened);
  assert.equal(outcome.result.roundEvents[0].payload.endsAt,shortened);
  // An already shortened deadline is never extended by last call.
  m=intermission(create());m=pick(m,1,'timethief').match;m=next(m);
  const p=m.participants[0];p.roundWordIndex=9;p.wordIndex=9;p.currentWord=m.round.words[9];
  const lateAt=m.round.startedAt+stolen-1_000;
  const late=submitWord(m,{playerId:p.playerId,matchId:m.id,wordIndex:9,text:'yanlis',round:m.round.index},lateAt);
  assert.equal(late.match.participants[1].roundEndsAt,m.round.startedAt+stolen);
  assert.equal(late.match.round.endsAt,m.round.startedAt+stolen);
});

test('blindclock hides both deadlines only for the victim during the active round',()=>{
  let m=intermission(create());m=pick(m,1,'blindclock').match;m=next(m);
  const blind=publicMatch(m,2),clear=publicMatch(m,1),legacy=publicMatch(m);
  assert.equal(blind.blindClock,true);
  assert.equal(blind.round.endsAt,null);
  assert.equal(blind.round.personalEndsAt,null);
  assert.equal(blind.round.startedAt,null);
  assert.equal(blind.endsAt,null);
  assert.ok(blind.players.every(p=>p.roundEndsAt===null));
  assert.equal(clear.blindClock,false);
  assert.equal(clear.round.endsAt,m.round.endsAt);
  assert.equal(legacy.round.endsAt,m.round.endsAt);
  assert.equal(Object.hasOwn(legacy.round,'personalEndsAt'),false);
  m=intermission(m);
  assert.equal(publicMatch(m,2).blindClock,false);
});

class Sock{constructor(){this.readyState=1;this.messages=[];this.attachment=null;}
  send(s){this.messages.push(JSON.parse(s));}serializeAttachment(a){this.attachment=structuredClone(a);}
  deserializeAttachment(){return structuredClone(this.attachment);}close(){this.readyState=3;}}
class Pair{constructor(){this.client=new Sock();this.server=new Sock();Pair.last=this.server;}}
const saved={Response:globalThis.Response,WebSocketPair:globalThis.WebSocketPair,WebSocketRequestResponsePair:globalThis.WebSocketRequestResponsePair};
const token=i=>`${String(i).repeat(8)}-1234-4123-8123-${String(i).repeat(12)}-12345678-1234-4123-8123-${String(i).repeat(12)}`;
const sent=(s,type)=>s.messages.filter(x=>x.type===type);
const request=(room,ws,type,payload={})=>room.webSocketMessage(ws,JSON.stringify({version:1,type,payload}));

test('room sends private ACK, hidden picks, and a victim-only blind clock snapshot',async()=>{
  globalThis.Response=class{constructor(_,p={}){this.status=p.status??200;this.webSocket=p.webSocket;this.headers=new Headers(p.headers);}};
  globalThis.WebSocketPair=Pair;globalThis.WebSocketRequestResponsePair=class{};
  try{
    const sockets=[],data=new Map(),ctx={getWebSockets:()=>sockets.filter(s=>s.readyState===1),acceptWebSocket:s=>sockets.push(s),setWebSocketAutoResponse(){},
      storage:{get:async k=>structuredClone(data.get(k)),put:async(k,v)=>data.set(k,structuredClone(v)),setAlarm:async()=>{},deleteAll:async()=>data.clear()}};
    const room=new PvPRoom(ctx,{});
    await room.fetch(new Request('https://local/initialize',{method:'POST'}));
    const join=async i=>{await room.fetch(new Request('https://local/connect',{headers:{Upgrade:'websocket'}}));const ws=Pair.last;
      await request(room,ws,'JOIN',{name:`Player ${i}`,character:i===1?'fire':'rune',resumeToken:token(i)});return ws;};
    const a=await join(1),b=await join(2);
    await request(room,a,'READY_SET',{ready:true});await request(room,b,'READY_SET',{ready:true});
    const lobby=await room.roster();lobby.startAt=Date.now()-1;await room.save(lobby);await room.alarm();
    await request(room,a,'ROUND_SKILL_PICK',{skill:'freeze'});
    assert.equal(sent(a,'ERROR').at(-1).payload.code,'ROUND_SKILL_NOT_INTERMISSION');
    let m=await ctx.storage.get('match');m.round.endsAt=Date.now()-1;m.endsAt=m.round.endsAt;
    for(const p of m.participants)p.roundEndsAt=m.round.endsAt;
    await ctx.storage.put('match',m);await room.alarm();
    await request(room,a,'ROUND_SKILL_PICK',{skill:'blindclock'});
    assert.equal(sent(a,'ROUND_SKILL_ACK').length,1);
    assert.equal(sent(b,'ROUND_SKILL_ACK').length,0);
    assert.equal(sent(b,'STATE_UPDATE').at(-1).payload.match.roundSkillPick,null);
    m=await ctx.storage.get('match');m.round.nextRoundAt=Date.now()-1;await ctx.storage.put('match',m);await room.alarm();
    const first=sent(a,'ROUND_START').at(-1).payload,second=sent(b,'ROUND_START').at(-1).payload;
    assert.deepEqual(first.skills,{1:'blindclock',2:null});
    assert.equal(second.match.blindClock,true);
    assert.equal(second.match.round.endsAt,null);
    assert.equal(second.endsAt,null);
    assert.notEqual(first.match.round.endsAt,null);
  }finally{Object.assign(globalThis,saved);}
});

test('practice human pick, bot pick and packets use the same round contract',()=>{
  let time=T,serial=0;const timers=new Map(),packets=[];
  const scheduler={setTimeout:(fn,ms)=>{const id=++serial;timers.set(id,{fn,at:time+ms});return id;},clearTimeout:id=>timers.delete(id),
    setInterval:(fn,ms)=>{const id=++serial;timers.set(id,{fn,at:time+ms,ms});return id;},clearInterval:id=>timers.delete(id)};
  const advance=ms=>{const end=time+ms;for(;;){let found=null;for(const [id,x] of timers)if(x.at<=end&&(!found||x.at<found.x.at))found={id,x};
    if(!found)break;time=found.x.at;if(found.x.ms)found.x.at+=found.x.ms;else timers.delete(found.id);found.x.fn();}time=end;};
  const session=createPracticeSession({now:()=>time,scheduler,rng:()=>.1,difficulty:'zor',createId:()=> 'practice-time',onPacket:p=>packets.push(p)});
  session.start();while(!packets.some(p=>p.type==='ROUND_END'))advance(50);
  assert.equal(session.match.round.phase,'intermission');
  assert.equal(session.match.participants.find(p=>p.playerId===BOT_ID).roundSkillUses.timethief,1);
  assert.equal(session.send('ROUND_SKILL_PICK',{skill:'freeze'}),true);
  const ack=packets.find(p=>p.type==='ROUND_SKILL_ACK');
  assert.equal(ack.payload.skill,'freeze');
  assert.equal(ack.payload.match.roundSkillPick,'freeze');
  assert.equal(ack.payload.match.roundSkillUsesLeft.freeze,1);
  advance(ROUND_SUMMARY_MS+ROUND_INTRO_MS);
  const start=packets.filter(p=>p.type==='ROUND_START').at(-1);
  assert.deepEqual(start.payload.skills,{1:'freeze',2:'timethief'});
  assert.equal(start.payload.match.round.personalEndsAt[1],start.payload.startedAt+ROUND_DURATION_MS+ARENA_FREEZE_MS-ARENA_TIME_THIEF_MS);
  assert.equal(MessageType.ROUND_SKILL_PICK,'ROUND_SKILL_PICK');
  assert.deepEqual(makeEnvelope('ROUND_SKILL_PICK',{skill:null}).payload,{skill:null});
  assert.equal(session.match.participants.find(p=>p.playerId===HUMAN_ID).roundSkillUses.freeze,1);
  session.dispose();
});
