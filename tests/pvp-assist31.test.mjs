// Paket 31 — Partner / Destek (assist) sistemi: motor, oda ayarı, bot maçı, HUD ve 3B eklenti.
import test,{beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../pvp/vendor/three.module.min.js';
import {createMatch,publicMatch,submitWord,advanceMatch,resolveDueAttacks,pauseMatch,resumeMatch,
  MATCH_HP,ROUND_HP,RUNE_IDS,DEFENSE_RULES,SERVER_ONLY_EVENTS} from '../pvp/shared/match.js';
import {createArenaMatch,arenaPublicMatch} from '../pvp/shared/arena.js';
import {ASSIST_RULES,normalizeAssist,isAssistPayload,assistPartner,partnerName,assistDamage,assistGainFromDamage} from '../pvp/shared/assist-rules.js';
import {PvPRoom} from '../cloudflare/src/room.js';
import {createPracticeSession} from '../pvp/practice.js';
import {assistValue,callFor,CALLS} from '../pvp/fight-hud.js';
import {createArena3DAssist,ASSIST_FX} from '../pvp/arena3d-assist.js';

const T0=100_000;
const NO_BLOCK=()=>0.99;
const players=(c1='fire',c2='rune',r1='none')=>[
  {playerId:'a',seat:1,character:c1,rune:r1,name:'A'},{playerId:'b',seat:2,character:c2,rune:'none',name:'B'}];
const seat=(m,s)=>m.participants.find(p=>p.seat===s);
const classic=(opts={assist:true})=>createMatch(players(),T0,'m31',opts);
/** Klasik (anında çözümlü) motor: koltuğun sıradaki kelimesini yazar. */
function type(m,s,at,wrong=false){
  const p=seat(m,s);const word=m.mode==='rounds'?m.round.words[p.roundWordIndex]:p.currentWord;
  const out=submitWord(m,{playerId:p.playerId,matchId:m.id,wordIndex:p.wordIndex,text:wrong?word+'x':word},at);
  assert.ok(out.match,'submit failed: '+out.error);return out;
}
/** Koltuk 1 n doğru kelime yazar (saniyede bir); her kelimeden sonra vuruşlar çözülür. */
function typeMany(m,n,start=1){
  for(let i=start;i<start+n;i++){m=type(m,1,T0+i*1000).match;m=advanceMatch(m,T0+i*1000+900,NO_BLOCK).match;}
  return m;
}
const ready=(m,s=1)=>{const c=structuredClone(m);seat(c,s).assist.meter=ASSIST_RULES.max;return c;};

// ---------------------------------------------------------------- kurallar

test('assist rules: constants, partner mapping and payload validation',()=>{
  assert.deepEqual({...ASSIST_RULES},{max:100,correct:12,wrong:10,damageDiv:20,damageCap:8,damage:70,baseHp:2000,cooldownMs:6000});
  assert.equal(assistPartner('fire'),'rune');assert.equal(assistPartner('rune'),'fire');
  assert.equal(partnerName('fire'),'Rün Muhafızı');assert.equal(partnerName('rune'),'Alev Celladı');
  assert.equal(normalizeAssist(undefined),true);assert.equal(normalizeAssist(true),true);assert.equal(normalizeAssist(false),false);
  for(const bad of [0,1,'true','off',null,undefined,{},[],{assist:true}])assert.equal(isAssistPayload(bad),false,String(bad));
  assert.equal(isAssistPayload(true),true);assert.equal(isAssistPayload(false),true);
  assert.equal(assistDamage(MATCH_HP),70);assert.equal(assistDamage(ROUND_HP),42);
  assert.deepEqual([0,19,20,105,160,400].map(assistGainFromDamage),[0,0,1,5,8,8]);
  assert.ok(SERVER_ONLY_EVENTS.has('ASSIST_CAST'));
});

// ------------------------------------------------------------------- motor

test('assist engine: off unless requested — no meter, no events, no public fields',()=>{
  for(const opts of [undefined,{},{assist:false},{assist:'yes'},{assist:1}]){
    let m=createMatch(players(),T0,'off',opts);
    assert.equal(m.assistEnabled,undefined);assert.equal(seat(m,1).assist,undefined);
    const pub=publicMatch(m);
    assert.equal(pub.assistEnabled,false);assert.ok(pub.players.every(p=>!('assist' in p)));
    let casts=0;
    for(let i=1;i<=12;i++){const out=type(m,1,T0+i*1000);casts+=Number(Boolean(out.result.assistCast));
      assert.equal('assist' in out.result,false);m=advanceMatch(out.match,T0+i*1000+900,NO_BLOCK).match;if(m.status!=='running')break;}
    assert.equal(casts,0);assert.ok(!m.combatEvents.some(e=>e.type==='ASSIST_CAST'||e.skill==='assist'));
  }
});

test('assist engine: meter fills +12 per correct word, −10 per wrong word, clamps to 0..100',()=>{
  let m=classic();
  assert.deepEqual(seat(m,1).assist,{meter:0,cooldownUntil:0});
  m=type(m,1,T0+1000,true).match;assert.equal(seat(m,1).assist.meter,0,'never below zero');
  m=type(m,1,T0+2000).match;m=type(m,1,T0+3000).match;assert.equal(seat(m,1).assist.meter,24);
  m=type(m,1,T0+4000,true).match;assert.equal(seat(m,1).assist.meter,14);
  let out;
  for(let i=5;i<=11;i++){out=type(m,1,T0+i*1000);m=out.match;}
  assert.equal(seat(m,1).assist.meter,98);assert.equal(out.result.assist.ready,false);
  out=type(m,1,T0+12_000);m=out.match;
  assert.equal(seat(m,1).assist.meter,100,'capped');assert.equal(out.result.assistCast,null,'the filling word does not trigger');
  assert.deepEqual(out.result.assist,{meter:100,ready:true,cooldownUntil:0,partner:'rune'});
  assert.equal(seat(m,2).assist.meter>=0,true);
});

test('assist engine: nine clean words make it ready; the next CORRECT word triggers the partner attack',()=>{
  let m=typeMany(classic(),9);
  assert.equal(seat(m,1).assist.meter,100);
  // Bar doluyken yanlış kelime tetiklemez, barı düşürür.
  const wrong=type(m,1,T0+10_000,true);
  assert.equal(wrong.result.assistCast,null);assert.equal(seat(wrong.match,1).assist.meter,90);
  const out=type(m,1,T0+10_000);m=out.match;
  const cast=out.result.assistCast;
  assert.equal(cast.type,'ASSIST_CAST');
  assert.deepEqual([cast.fromSeat,cast.toSeat,cast.partner,cast.skill,cast.amount],[1,2,'rune','assist',70]);
  assert.deepEqual(seat(m,1).assist,{meter:0,cooldownUntil:T0+10_000+ASSIST_RULES.cooldownMs});
  assert.equal(m.pendingAttacks.filter(a=>a.assist).length,1);
  const hpBefore=seat(m,2).hp;
  const step=resolveDueAttacks(m,T0+10_000+250,NO_BLOCK);
  const hit=step.events.find(e=>e.type==='DAMAGE_APPLIED'&&e.skill==='assist');
  assert.ok(hit,'assist damage event');
  assert.deepEqual([hit.fromSeat,hit.toSeat,hit.amount,hit.blocked,hit.assist,hit.partner,hit.counter],[1,2,70,false,true,'rune',false]);
  const others=step.events.filter(e=>e.type==='DAMAGE_APPLIED'&&e.skill!=='assist').reduce((n,e)=>n+e.amount,0);
  assert.equal(hpBefore-seat(step.match,2).hp,70+others);
  // Rün oynayanın partneri ateştir.
  let r=ready(classic(),2);const rc=type(r,2,T0+500).result.assistCast;
  assert.deepEqual([rc.fromSeat,rc.toSeat,rc.partner],[2,1,'fire']);
});

test('assist engine: 6 s cooldown and stagger hold a full meter without spending it',()=>{
  let m=ready(classic());
  m=type(m,1,T0+1000).match;
  assert.equal(seat(m,1).assist.cooldownUntil,T0+7000);
  m=ready(m);
  let out=type(m,1,T0+2000);
  assert.equal(out.result.assistCast,null,'still cooling down');assert.equal(seat(out.match,1).assist.meter,100);
  out=type(out.match,1,T0+6900);assert.equal(out.result.assistCast,null);
  out=type(out.match,1,T0+7000);assert.equal(out.result.assistCast.type,'ASSIST_CAST');
  let s=ready(classic());seat(s,1).staggerUntil=T0+5000;
  out=type(s,1,T0+1000);
  assert.equal(out.result.assistCast,null,'staggered fighters cannot call the partner');assert.equal(seat(out.match,1).assist.meter,100);
  out=type(out.match,1,T0+5000);assert.equal(out.result.assistCast.type,'ASSIST_CAST');
});

test('assist engine: shield and parry rules apply exactly like a normal attack',()=>{
  // Açık kalkan: tamamen bloklanır (ağır delme yalnız E/R içindir).
  let m=ready(classic());seat(m,2).shieldUntil=T0+5000;
  m=type(m,1,T0+1000).match;
  let step=resolveDueAttacks(m,T0+1250,NO_BLOCK);
  let hit=step.events.find(e=>e.type==='DAMAGE_APPLIED'&&e.skill==='assist');
  assert.deepEqual([hit.blocked,hit.amount,hit.blockKind,hit.shieldBreak],[true,0,'NORMAL_BLOCK',false]);
  assert.equal(seat(step.match,2).hp,MATCH_HP);
  assert.ok(!step.events.some(e=>e.type==='SHIELD_BROKEN'));
  // Zamanında yazılmış kelime + şans: parry → kontra saldırısı, saldıran sersemler.
  m=ready(classic());seat(m,2).lastWordAt=T0+1000;
  m=type(m,1,T0+1000).match;
  step=resolveDueAttacks(m,T0+1250,()=>0);
  assert.ok(step.events.some(e=>e.type==='PARRY_TRIGGERED'&&e.seat===2&&e.skill==='assist'));
  hit=step.events.find(e=>e.type==='DAMAGE_APPLIED'&&e.skill==='assist');
  assert.deepEqual([hit.blocked,hit.blockKind,hit.amount],[true,'PARRY',0]);
  assert.equal(seat(step.match,1).staggerUntil,T0+1000+DEFENSE_RULES.staggerMs);
  const counter=resolveDueAttacks(step.match,T0+1250+DEFENSE_RULES.counterDelayMs,NO_BLOCK);
  assert.equal(seat(counter.match,1).hp,MATCH_HP-DEFENSE_RULES.counterDamage);
  // Kalkan yok, şans yok: 70 hasar.
  m=ready(classic());m=type(m,1,T0+1000).match;
  step=resolveDueAttacks(m,T0+1250,NO_BLOCK);
  assert.equal(seat(step.match,2).hp,MATCH_HP-70);
});

test('assist engine: damage taken adds a small comeback fill (damage/20, max +8 per hit)',()=>{
  let m=classic();
  m=type(m,1,T0+1000).match;m=type(m,1,T0+2000).match; // 2. doğru: Q (105)
  assert.equal(seat(m,2).assist.meter,0);
  m=resolveDueAttacks(m,T0+2250,NO_BLOCK).match;
  assert.equal(seat(m,2).hp,MATCH_HP-105);
  assert.equal(seat(m,2).assist.meter,5);assert.equal(seat(m,1).assist.meter,24);
  m=type(m,1,T0+3000).match;m=type(m,1,T0+4000).match; // 4. doğru: E (175) → +8 tavan
  m=resolveDueAttacks(m,T0+4250,NO_BLOCK).match;
  assert.equal(seat(m,2).assist.meter,13);
  // Bloklanan vuruş bar doldurmaz.
  let b=classic();seat(b,2).shieldUntil=T0+9000;
  b=type(b,1,T0+1000).match;b=type(b,1,T0+2000).match;b=resolveDueAttacks(b,T0+2250,NO_BLOCK).match;
  assert.equal(seat(b,2).assist.meter,0);
});

test('assist engine: classic exchange windows queue the assist and announce it at resolve time',()=>{
  let m=ready(createMatch(players(),T0,'x31',{exchangeMs:10_000,assist:true}));
  const out=type(m,1,T0+1000);m=out.match;
  assert.equal(out.result.assistCast,null,'deferred: nothing is broadcast while typing');
  assert.equal(out.result.assist.meter,0);
  assert.equal(m.pendingAttacks.filter(a=>a.assist&&a.resolveAt===Infinity).length,1);
  assert.ok(!m.combatEvents.some(e=>e.type==='ASSIST_CAST'));
  const step=advanceMatch(m,T0+10_000+1300,NO_BLOCK);
  const cast=step.events.find(e=>e.type==='ASSIST_CAST');
  assert.deepEqual([cast.fromSeat,cast.toSeat,cast.partner,cast.resolve,cast.turn],[1,2,'rune',true,1]);
  const hit=step.events.find(e=>e.type==='DAMAGE_APPLIED'&&e.skill==='assist');
  assert.equal(hit.amount,70);assert.equal(hit.resolve,true);
  assert.ok(!step.events.some(e=>e.type==='SKILL_CAST'&&e.skill==='assist'),'never announced as a normal skill');
  assert.equal(seat(step.match,2).hp,MATCH_HP-70);
});

test('assist engine: round mode scales damage to round HP, keeps the meter between rounds',()=>{
  const make=()=>createMatch(players(),T0,'r31',{rounds:5,seed:7,assist:true});
  let m=ready(make());
  const out=type(m,1,T0+1000);m=out.match;
  const cast=out.result.assistCast;
  assert.deepEqual([cast.amount,cast.round,cast.roundWordIndex,cast.partner],[42,1,0,'rune']);
  m=advanceMatch(m,T0+1900,NO_BLOCK).match;
  assert.equal(seat(m,2).hp,ROUND_HP-42);
  // Bar tur arasında korunur.
  m=make();
  for(let i=1;i<=3;i++)m=type(m,1,T0+i*1000).match;
  assert.equal(seat(m,1).assist.meter,36);
  m=advanceMatch(m,m.round.endsAt+5000,NO_BLOCK).match;
  assert.equal(m.round.phase,'intermission');
  m=advanceMatch(m,m.round.nextRoundAt,NO_BLOCK).match;
  assert.equal(m.round.index,2);assert.equal(seat(m,1).combo,0);
  assert.equal(seat(m,1).assist.meter,36,'meter survives the round reset');
  // Tur sonu çözümlü (yayındaki) tur modu: destek de sıraya girer.
  let d=ready(createMatch(players(),T0,'d31',{rounds:5,seed:7,assist:true,resolveAtEnd:true}));
  const dout=type(d,1,T0+1000);d=dout.match;
  assert.equal(dout.result.assistCast,null);
  const res=advanceMatch(d,d.round.endsAt+1300,NO_BLOCK);
  assert.ok(res.roundEvents.some(e=>e.type==='ROUND_RESOLVE'));
  assert.ok(res.events.some(e=>e.type==='ASSIST_CAST'&&e.resolve===true));
  assert.equal(res.events.find(e=>e.type==='DAMAGE_APPLIED'&&e.skill==='assist').amount,42);
});

test('assist engine: balance — even with a pre-charged assist no character × rune can KO before the 9th correct word',()=>{
  for(const character of ['fire','rune'])for(const rune of RUNE_IDS)for(const qOffset of [0,1,2]){
    let m=createMatch(players(character,'fire',rune),T0,'bal31',{rounds:5,seed:7,assist:true});
    seat(m,1).combatStats.casts.q=qOffset;seat(m,1).assist.meter=ASSIST_RULES.max;
    let koAt=null,assists=0;
    for(let i=1;i<=10;i++){
      const at=T0+i*1000;
      const out=type(m,1,at);assists+=Number(Boolean(out.result.assistCast));
      m=advanceMatch(out.match,at+900,NO_BLOCK).match;
      if(m.roundHistory.at(-1)?.reason==='KO'){koAt=i;break;}
    }
    assert.ok(koAt===null||koAt>=9,`${character}+${rune}+${qOffset}: KO at ${koAt}`);
    assert.equal(assists,1,'a perfect round against a passive defender fits exactly one assist');
  }
});

test('assist engine: pause/resume shifts the cooldown; publicMatch exposes meter, ready, cooldown and partner',()=>{
  let m=ready(classic());
  m=type(m,1,T0+1000).match;
  let pub=publicMatch(m);
  assert.equal(pub.assistEnabled,true);
  assert.deepEqual(pub.players.map(p=>p.assist),[
    {meter:0,ready:false,cooldownUntil:T0+7000,partner:'rune'},{meter:0,ready:false,cooldownUntil:0,partner:'fire'}]);
  assert.deepEqual(publicMatch(ready(m,2)).players[1].assist,{meter:100,ready:true,cooldownUntil:0,partner:'fire'});
  m=resumeMatch(pauseMatch(m,T0+2000,[2]),T0+5000);
  assert.equal(seat(m,1).assist.cooldownUntil,T0+10_000);assert.equal(seat(m,2).assist.cooldownUntil,0);
  // Tur modu görünümünde de aynı alanlar.
  const r=publicMatch(createMatch(players(),T0,'rp',{rounds:5,seed:1,assist:true}),1);
  assert.equal(r.assistEnabled,true);assert.deepEqual(r.players[0].assist,{meter:0,ready:false,cooldownUntil:0,partner:'rune'});
  // Anlık görüntü şişmez: iki oyuncu için eklenen alanlar küçük kalır.
  const extra=JSON.stringify(pub).length-JSON.stringify(publicMatch(createMatch(players(),T0,'m31'))).length;
  assert.ok(extra<700,`assist adds ${extra} bytes`);
});

test('assist engine: arena mode never has assists, even when asked',()=>{
  const m=createArenaMatch(players(),T0,'ar31',{seed:1,assist:true});
  assert.ok(!m.assistEnabled);assert.ok(m.participants.every(p=>p.assist===undefined));
  const pub=arenaPublicMatch(m,1);
  assert.equal(pub.assistEnabled,false);
  assert.ok(!JSON.stringify(pub).includes('"assist"'));
});

// ---------------------------------------------------------------------- oda

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
const request=(room,ws,kind,payload={})=>room.webSocketMessage(ws,JSON.stringify({version:1,type:kind,payload}));
const received=(ws,kind)=>ws.messages.filter(m=>m.type===kind);
async function join(room,i){await room.fetch(new Request('https://local.test/connect',{headers:{Upgrade:'websocket'}}));const ws=last;
  await request(room,ws,'JOIN',{name:`Oyuncu ${i}`,character:i===1?'fire':'rune',resumeToken:token(i)});return ws;}
async function lobby(){const f=fixture();await f.room.fetch(new Request('https://local.test/initialize',{method:'POST'}));
  const a=await join(f.room,1),b=await join(f.room,2);return Object.assign(f,{a,b});}
async function start(f){
  await request(f.room,f.a,'READY_SET',{ready:true});await request(f.room,f.b,'READY_SET',{ready:true});
  const l=await f.room.roster();l.startAt=Date.now()-5;await f.room.save(l);await f.room.alarm();
  return f.ctx.storage.get('match');
}

test('assist room: MATCH_CONFIG {assist} is host-only, boolean-only, resets ready and shows in ROOM_STATE',async()=>{
  const f=await lobby();
  assert.equal(received(f.a,'ROOM_STATE').at(-1).payload.assist,true,'default ON');
  await request(f.room,f.b,'MATCH_CONFIG',{assist:false});
  assert.equal(received(f.b,'ERROR').at(-1).payload.code,'HOST_ONLY');
  for(const bad of [{assist:'false'},{assist:0},{assist:null},{assist:{on:false}},{assist:[false]},
    {assist:false,meter:100},{assist:true,ready:true},{assist:false,typing:{punctuation:false}}]){
    const before=received(f.a,'ERROR').length;
    await request(f.room,f.a,'MATCH_CONFIG',bad);
    assert.equal(received(f.a,'ERROR').length,before+1,JSON.stringify(bad));
    assert.ok(['INVALID_MATCH_CONFIG','INVALID_ROUNDS'].includes(received(f.a,'ERROR').at(-1).payload.code));
    assert.notEqual((await f.room.roster()).assist,false);
  }
  await request(f.room,f.a,'READY_SET',{ready:true});await request(f.room,f.b,'READY_SET',{ready:true});
  assert.equal((await f.room.roster()).phase,'countdown');
  await request(f.room,f.a,'MATCH_CONFIG',{assist:false});
  const data=await f.room.roster();
  assert.equal(data.assist,false);assert.equal(data.phase,'waiting');assert.ok(data.players.every(p=>p.ready===false));
  assert.equal(received(f.b,'ROOM_STATE').at(-1).payload.assist,false);
  const match=await start(f);
  assert.ok(!match.assistEnabled);
  const snap=received(f.b,'MATCH_START').at(-1).payload.match;
  assert.equal(snap.assistEnabled,false);assert.ok(snap.players.every(p=>!('assist' in p)));
  await request(f.room,f.a,'MATCH_CONFIG',{assist:true});
  assert.equal(received(f.a,'ERROR').at(-1).payload.code,'MATCH_STARTED');
});

test('assist room: default match carries assist state; clients can neither cast nor set the meter',async()=>{
  const f=await lobby();
  const match=await start(f);
  assert.equal(match.assistEnabled,true);
  const snap=received(f.a,'MATCH_START').at(-1).payload.match;
  assert.equal(snap.assistEnabled,true);
  assert.deepEqual(snap.players.map(p=>p.assist),[
    {meter:0,ready:false,cooldownUntil:0,partner:'rune'},{meter:0,ready:false,cooldownUntil:0,partner:'fire'}]);
  await request(f.room,f.a,'ASSIST_CAST',{fromSeat:1,toSeat:2,partner:'rune'});
  assert.equal(received(f.a,'ERROR').at(-1).payload.code,'SERVER_ONLY_EVENT');
  // Kelime paketine eklenen sahte alanlar yok sayılır: bar yalnız +12 dolar.
  const me=match.participants.find(p=>p.seat===1);
  await request(f.room,f.a,'WORD_SUBMIT',{matchId:match.id,round:match.round.index,wordIndex:me.wordIndex,text:match.round.words[0],
    assist:{meter:100,ready:true},meter:100,assistCast:true});
  const result=received(f.a,'WORD_RESULT').at(-1).payload;
  assert.equal(result.accepted,true);assert.equal(result.assistCast,null);
  assert.deepEqual(result.assist,{meter:12,ready:false,cooldownUntil:0,partner:'rune'});
  const stored=await f.ctx.storage.get('match');
  assert.equal(stored.participants.find(p=>p.seat===1).assist.meter,12);
  assert.ok(!stored.pendingAttacks.some(a=>a.assist));
  // Klasik oda da aynı ayarı taşır; arena odasında destek yoktur.
  const c=await lobby();await request(c.room,c.a,'MATCH_CONFIG',{mode:'classic'});
  assert.equal((await start(c)).assistEnabled,true);
  const a=await lobby();await request(a.room,a.a,'MATCH_CONFIG',{mode:'arena'});
  const arena=await start(a);
  assert.equal(arena.mode,'arena');assert.ok(!arena.assistEnabled);
  assert.equal(received(a.a,'MATCH_START').at(-1).payload.match.assistEnabled,false);
});

// ----------------------------------------------------------------- bot maçı

function practice(opts){
  const tasks=new Map();let seq=0;const at=1_700_000_000_000;
  const scheduler={setInterval:(fn,ms)=>{const id=++seq;tasks.set(id,{fn,ms});return id;},clearInterval:id=>tasks.delete(id),
    setTimeout:(fn,ms)=>{const id=++seq;tasks.set(id,{fn,ms});return id;},clearTimeout:id=>tasks.delete(id)};
  const session=createPracticeSession({now:()=>at,scheduler,rng:()=>0.5,createId:()=>'p31',...opts});
  session.start();return session;
}
test('assist practice: on by default in classic and rounds, switchable, always off in arena',()=>{
  for(const mode of ['classic','rounds']){
    const on=practice({mode});
    assert.equal(on.assist,true);assert.equal(on.snapshot().assistEnabled,true);
    assert.equal(on.snapshot().players.find(p=>p.playerId===on.humanId).assist.partner,'rune');
    on.dispose();
    const off=practice({mode,assist:false});
    assert.equal(off.assist,false);assert.equal(off.snapshot().assistEnabled,false);off.dispose();
  }
  const rune=practice({mode:'classic',character:'rune'});
  assert.equal(rune.snapshot().players.find(p=>p.playerId===rune.humanId).assist.partner,'fire');rune.dispose();
  const arena=practice({mode:'arena',assist:true});
  assert.equal(arena.assist,false);assert.equal(arena.snapshot().assistEnabled,false);arena.dispose();
});

test('assist practice: a full meter makes the next correct word queue the partner; ASSIST_CAST reaches onCombat',()=>{
  const combat=[];let clock=1_700_000_000_000;
  const tasks=new Map();let seq=0;
  const scheduler={setInterval:(fn,ms)=>{const id=++seq;tasks.set(id,{fn,ms});return id;},clearInterval:id=>tasks.delete(id),
    setTimeout:(fn,ms)=>{const id=++seq;tasks.set(id,{fn,ms});return id;},clearTimeout:id=>tasks.delete(id)};
  const session=createPracticeSession({mode:'classic',now:()=>clock,scheduler,rng:()=>0.99,createId:()=>'p31c',onCombat:e=>combat.push(e)});
  session.start();
  session.match.participants.find(p=>p.playerId===session.humanId).assist.meter=ASSIST_RULES.max;
  clock+=1000;
  const me=session.snapshot().players.find(p=>p.playerId===session.humanId);
  session.send('WORD_SUBMIT',{matchId:session.match.id,wordIndex:me.wordIndex,text:me.currentWord});
  assert.equal(session.snapshot().players.find(p=>p.playerId===session.humanId).assist.meter,0);
  assert.equal(session.match.pendingAttacks.filter(a=>a.assist).length,1);
  clock+=11_000; // pencere bitti + ilk çözüm adımı
  for(const task of [...tasks.values()])if(task.ms<=60)task.fn(); // tick
  const cast=combat.find(e=>e.type==='ASSIST_CAST');
  assert.ok(cast,'ASSIST_CAST forwarded');assert.equal(cast.fromSeat,session.humanSeat);
  assert.ok(combat.some(e=>e.type==='DAMAGE_APPLIED'&&e.skill==='assist'));
  session.dispose();
});

// ---------------------------------------------------------------------- HUD

test('assist hud: assistValue is null unless enabled; ASSIST_CAST announces "DESTEK!"',()=>{
  const p={character:'fire',assist:{meter:48,ready:false,cooldownUntil:0,partner:'rune'}};
  assert.equal(assistValue(null,p),null);
  assert.equal(assistValue({mode:'classic',assistEnabled:false},p),null);
  assert.equal(assistValue({mode:'arena',assistEnabled:true},p),null);
  assert.equal(assistValue({mode:'classic',assistEnabled:true},{character:'fire'}),null);
  assert.deepEqual(assistValue({mode:'classic',assistEnabled:true},p),{value:0.48,ready:false,partner:'rune'});
  assert.deepEqual(assistValue({mode:'rounds',assistEnabled:true},{character:'rune',assist:{meter:140,ready:true}}),{value:1,ready:true,partner:'fire'});
  assert.equal(CALLS.assist,'DESTEK!');
  assert.deepEqual(callFor({type:'ASSIST_CAST',fromSeat:2,toSeat:1,partner:'fire'}),{text:'DESTEK!',seat:2});
});

// ------------------------------------------------------------- 3B eklentisi

function fakeApi({quiet=()=>false,texture=new THREE.Texture()}={}){
  const scene=new THREE.Scene();const flashes=[];
  const home=s=>new THREE.Vector3(s===1?-2.5:2.5,0,0);
  return {scene,flashes,texture,api:{THREE,scene,isReduced:quiet,rigTexture:()=>texture,facing:s=>(s===2?-1:1),
    seatHome:home,seatGround:home,seatAnchor:s=>home(s).setY(1.68),flash:(...args)=>flashes.push(args)}};
}
test('assist 3d: the partner silhouette enters behind the attacker, reaches the rival, strikes and leaves in ~700 ms',()=>{
  const {api,scene,flashes,texture}=fakeApi();
  let textureDisposed=false;texture.addEventListener('dispose',()=>{textureDisposed=true;});
  const fx=createArena3DAssist(api);
  assert.equal(scene.children.length,0,'nothing is drawn until the first assist');
  fx.handle({type:'SKILL_CAST',fromSeat:1,toSeat:2,skill:'q'});
  assert.equal(fx.stats().casts,0);
  fx.handle({type:'ASSIST_CAST',fromSeat:1,toSeat:2,partner:'rune'});
  let s=fx.stats();
  assert.equal(s.active,1);assert.equal(s.seats[1].visible,true);
  assert.ok(s.seats[1].x<-2.5,'starts behind the attacker');
  const mesh=scene.children[0];
  assert.equal(mesh.material.map,texture,'reuses the core rig texture');
  assert.equal(mesh.material.transparent,true);assert.ok(mesh.scale.x<0,'mirrored to face the rival');
  for(let t=0;t<ASSIST_FX.totalMs*ASSIST_FX.dashEnd+20;t+=16)fx.update(0.016);
  s=fx.stats();
  assert.ok(s.seats[1].x>0.5&&s.seats[1].x<2.5,`in front of the rival at impact (${s.seats[1].x})`);
  assert.ok(s.seats[1].opacity>0.5&&s.seats[1].opacity<1,'semi-transparent');
  assert.equal(flashes.length,1,'one impact flash');
  for(let t=0;t<ASSIST_FX.totalMs;t+=16)fx.update(0.016);
  s=fx.stats();
  assert.equal(s.active,0);assert.equal(s.seats[1].visible,false);
  // İki koltuk aynı anda: en fazla iki geçici çizim.
  fx.handle({type:'ASSIST_CAST',fromSeat:1,toSeat:2,partner:'rune'});
  fx.handle({type:'ASSIST_CAST',fromSeat:2,toSeat:1,partner:'fire'});
  fx.handle({type:'ASSIST_CAST',fromSeat:2,toSeat:1,partner:'fire'});
  assert.equal(fx.stats().meshes,2);assert.equal(scene.children.length,2);
  fx.clear();
  assert.equal(fx.stats().active,0);assert.ok(scene.children.every(m=>!m.visible));
  fx.dispose();
  assert.equal(scene.children.length,0);assert.equal(textureDisposed,false,'the core texture is never disposed here');
  fx.handle({type:'ASSIST_CAST',fromSeat:1,toSeat:2,partner:'rune'});
  assert.equal(scene.children.length,0,'inert after dispose');
});

test('assist 3d: reduced motion (or missing rig texture) shows only a short flash',()=>{
  const quiet=fakeApi({quiet:()=>true});
  const fx=createArena3DAssist(quiet.api);
  fx.handle({type:'ASSIST_CAST',fromSeat:2,toSeat:1,partner:'fire'});
  assert.equal(quiet.scene.children.length,0);assert.equal(quiet.flashes.length,1);
  assert.ok(quiet.flashes[0][2]<=120,'short');
  fx.dispose();
  const bare=fakeApi({texture:null});
  const fx2=createArena3DAssist(bare.api);
  fx2.handle({type:'ASSIST_CAST',fromSeat:1,toSeat:2,partner:'rune'});
  assert.equal(bare.scene.children.length,0);assert.equal(bare.flashes.length,1);
  fx2.dispose();
  assert.throws(()=>createArena3DAssist({}),TypeError);
});
