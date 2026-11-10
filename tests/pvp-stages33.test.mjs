// Paket 33 — sahne (arena) seçimi: paylaşılan sözleşme, motor, sunucu odası, bot maçı ve lobi şeridi.
import test,{beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {STAGES,STAGE_IDS,DEFAULT_STAGE,RANDOM_STAGE,normalizeStage,normalizeStageChoice,pickStage,getStage,isStageChoicePayload} from '../pvp/shared/stages.js';
import {createMatch,publicMatch} from '../pvp/shared/match.js';
import {createArenaMatch,arenaPublicMatch} from '../pvp/shared/arena.js';
import {PvPRoom} from '../cloudflare/src/room.js';
import {createPracticeSession} from '../pvp/practice.js';
import {stagePickerHTML,PvPNetworkConsole} from '../pvp/network.js';

const read=p=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const original={Response:globalThis.Response,WebSocketPair:globalThis.WebSocketPair,WebSocketRequestResponsePair:globalThis.WebSocketRequestResponsePair};
const PLAYERS=[{playerId:'a',seat:1,character:'fire'},{playerId:'b',seat:2,character:'rune'}];

test('stages: four original stages, default colosseum, random resolves to a real stage',()=>{
  assert.deepEqual(STAGE_IDS,['colosseum','skyforge','runegarden','harbor']);
  assert.equal(DEFAULT_STAGE,'colosseum');
  for(const s of STAGES){
    assert.ok(s.name&&s.blurb,s.id);
    for(const k of ['sky','fog','floor','accent','rim'])assert.match(s.palette[k],/^#[0-9a-f]{6}$/,`${s.id}.${k}`);
  }
  assert.equal(normalizeStage('harbor'),'harbor');
  for(const bad of ['random','__proto__','toString','',null,undefined,3,{}])assert.equal(normalizeStage(bad),DEFAULT_STAGE);
  assert.equal(normalizeStageChoice('random'),RANDOM_STAGE);
  assert.equal(normalizeStageChoice('nope'),DEFAULT_STAGE);
  assert.equal(pickStage('skyforge',()=>0.99),'skyforge');
  assert.equal(pickStage('random',()=>0),'colosseum');
  assert.equal(pickStage('random',()=>0.999),'harbor');
  assert.equal(pickStage('random',()=>NaN),'colosseum');
  assert.equal(getStage('nope').id,'colosseum');
  // Kablo doğrulaması: yalnız bilinen kimlik ya da 'random' (string).
  for(const ok of [...STAGE_IDS,'random'])assert.equal(isStageChoicePayload(ok),true,ok);
  for(const bad of ['', 'Harbor','__proto__',null,1,true,['harbor'],{id:'harbor'}])assert.equal(isStageChoicePayload(bad),false,String(bad));
});

test('stages: engines keep match.stage and expose it in every public snapshot',()=>{
  const plain=createMatch(PLAYERS,1000,'m1');
  assert.equal(plain.stage,DEFAULT_STAGE,'eski çağrı varsayılan sahneyi alır');
  assert.equal(publicMatch(plain,1).stage,DEFAULT_STAGE);
  const classic=createMatch(PLAYERS,1000,'m2',{exchangeMs:10000,stage:'harbor'});
  assert.equal(classic.stage,'harbor');assert.equal(publicMatch(classic,2).stage,'harbor');
  const rounds=createMatch(PLAYERS,1000,'m3',{rounds:5,seed:'s',stage:'runegarden'});
  assert.equal(publicMatch(rounds,1).stage,'runegarden');
  assert.equal(createMatch(PLAYERS,1000,'m4',{rounds:5,seed:'s',stage:'evil<script>'}).stage,DEFAULT_STAGE);
  const arena=createArenaMatch(PLAYERS,1000,'m5',{seed:'s',stage:'skyforge'});
  assert.equal(arena.stage,'skyforge');assert.equal(arenaPublicMatch(arena,1).stage,'skyforge');
  assert.equal(arenaPublicMatch(createArenaMatch(PLAYERS,1000,'m6',{seed:'s'}),1).stage,DEFAULT_STAGE);
});

test('stages: direct engine random choice uses the injected RNG without changing combat',()=>{
  for(const create of [createMatch,createArenaMatch]){
    const options={seed:'stage-rng',stage:'random',rng:()=>0.6};
    const m=create(PLAYERS,1000,'random-stage',options);
    assert.equal(m.stage,'runegarden');
    assert.equal((create===createMatch?publicMatch:arenaPublicMatch)(m,1).stage,'runegarden');
    const fixed=create(PLAYERS,1000,'random-stage',{...options,stage:'runegarden'});
    assert.deepEqual(m,fixed,'sahne seçimi dengeyi veya kelimeleri değiştirmez');
  }
});

// ----------------------------------------------------------------- sunucu odası
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

test('stage room: MATCH_CONFIG {stage} is host-only, validated, resets ready and reaches ROOM_STATE + match',async()=>{
  const f=await lobby();
  assert.equal(received(f.a,'ROOM_STATE').at(-1).payload.stage,DEFAULT_STAGE,'varsayılan sahne');
  await request(f.room,f.b,'MATCH_CONFIG',{stage:'harbor'});
  assert.equal(received(f.b,'ERROR').at(-1).payload.code,'HOST_ONLY');
  for(const bad of [{stage:'lava'},{stage:''},{stage:null},{stage:1},{stage:['harbor']},{stage:'__proto__'},
    {stage:'harbor',mode:'arena'},{stage:'harbor',assist:false}]){
    const before=received(f.a,'ERROR').length;
    await request(f.room,f.a,'MATCH_CONFIG',bad);
    assert.equal(received(f.a,'ERROR').length,before+1,JSON.stringify(bad));
    if(Object.keys(bad).length===1)assert.equal(received(f.a,'ERROR').at(-1).payload.code,'INVALID_MATCH_CONFIG');
    assert.notEqual((await f.room.roster()).stage,'harbor');
  }
  await request(f.room,f.a,'READY_SET',{ready:true});await request(f.room,f.b,'READY_SET',{ready:true});
  assert.equal((await f.room.roster()).phase,'countdown');
  await request(f.room,f.a,'MATCH_CONFIG',{stage:'harbor'});
  const data=await f.room.roster();
  assert.equal(data.stage,'harbor');assert.equal(data.phase,'waiting');assert.ok(data.players.every(p=>p.ready===false));
  assert.equal(received(f.b,'ROOM_STATE').at(-1).payload.stage,'harbor');
  const match=await start(f);
  assert.equal(match.stage,'harbor');
  assert.equal(received(f.b,'MATCH_START').at(-1).payload.match.stage,'harbor');
  await request(f.room,f.a,'MATCH_CONFIG',{stage:'skyforge'});
  assert.equal(received(f.a,'ERROR').at(-1).payload.code,'MATCH_STARTED');
});

test('stage room: random is kept as the room choice and resolved to a concrete stage at match start (all modes)',async()=>{
  for(const mode of ['rounds','classic','arena']){
    const f=await lobby();
    if(mode!=='rounds')await request(f.room,f.a,'MATCH_CONFIG',{mode});
    await request(f.room,f.a,'MATCH_CONFIG',{stage:'random'});
    assert.equal(received(f.a,'ROOM_STATE').at(-1).payload.stage,'random');
    const match=await start(f);
    assert.ok(STAGE_IDS.includes(match.stage),`${mode}: ${match.stage}`);
    assert.equal(received(f.a,'MATCH_START').at(-1).payload.match.stage,match.stage);
  }
});

// ----------------------------------------------------------------- bot maçı
function practice(opts){
  const tasks=new Map();let seq=0;const at=1_700_000_000_000;
  const scheduler={setInterval:(fn,ms)=>{const id=++seq;tasks.set(id,{fn,ms});return id;},clearInterval:id=>tasks.delete(id),
    setTimeout:(fn,ms)=>{const id=++seq;tasks.set(id,{fn,ms});return id;},clearTimeout:id=>tasks.delete(id)};
  const session=createPracticeSession({now:()=>at,scheduler,rng:()=>0.5,createId:()=>'p33',...opts});
  session.start();return session;
}
test('stage practice: o.stage reaches the snapshot in all modes; random picks a concrete stage; junk falls back',()=>{
  for(const mode of ['classic','rounds','arena']){
    const s=practice({mode,stage:'runegarden'});
    assert.equal(s.snapshot().stage,'runegarden',mode);assert.equal(s.stage,'runegarden');s.dispose();
    const r=practice({mode,stage:'random'});
    assert.ok(STAGE_IDS.includes(r.snapshot().stage),mode);r.dispose();
    const d=practice({mode,stage:'x'});assert.equal(d.snapshot().stage,DEFAULT_STAGE);d.dispose();
  }
});

// ----------------------------------------------------------------- lobi şeridi
test('stage lobby: network.js renders a keyboard-operable stage strip and sends MATCH_CONFIG {stage}',()=>{
  const js=read('pvp/network.js');
  assert.match(js,/from '\.\/shared\/stages\.js'/);
  assert.match(js,/role="radiogroup"[^>]*aria-label="Sahne seçimi"/);
  assert.match(js,/data-stage-pick/);
  assert.match(js,/send\('MATCH_CONFIG',\{stage/);
  assert.match(js,/ArrowRight/);assert.match(js,/ArrowLeft/);
  const css=read('pvp/lobby-v3.css');
  assert.match(css,/\.lb3-stage-strip/);
  assert.match(css,/\.lb3-stage-card:focus-visible/);
  assert.match(css,/prefers-reduced-motion/);
});

test('stage lobby: each scope has five labelled radio cards with descriptions and one tab stop',()=>{
  for(const scope of ['practice','room']){
    const html=stagePickerHTML(scope,'harbor');
    assert.equal((html.match(/role="radio"/g)||[]).length,5);
    assert.equal((html.match(/tabindex="0"/g)||[]).length,1);
    assert.match(html,/>Arena seç</);
    for(const stage of STAGES)assert.ok(html.includes(`>${stage.blurb}</small>`));
    assert.match(html,/aria-checked="true" data-stage-pick="harbor"/);
  }
});

test('stage lobby: arrows wrap selection, Home/End focus, guest and active match cannot send settings',()=>{
  const net=Object.create(PvPNetworkConsole.prototype),sent=[];
  Object.assign(net,{myId:'host',hostPlayerId:'host',phase:'waiting',roomStage:'colosseum',render(){},log(){},send:(type,payload)=>sent.push({type,payload})});
  const cards=[...STAGE_IDS,'random'].map(id=>({disabled:false,dataset:{stagePick:id},matches:()=>true,focus(){this.focused=true;}}));
  const group={dataset:{stageGroup:'room'},querySelectorAll:()=>cards,querySelector:s=>cards.find(c=>s.includes(`"${c.dataset.stagePick}"`))};
  cards.forEach(c=>c.closest=()=>group);
  const key=(target,k)=>net.stageKey({target,key:k,preventDefault(){}});
  key(cards[0],'ArrowLeft');assert.deepEqual(sent.at(-1),{type:'MATCH_CONFIG',payload:{stage:'random'}});assert.ok(cards[4].focused);
  key(cards[4],'Home');assert.equal(net.roomStage,'colosseum');assert.ok(cards[0].focused);
  key(cards[0],'End');assert.equal(net.roomStage,'random');
  const count=sent.length;net.myId='guest';net.selectStage('room','harbor');assert.equal(sent.length,count);
  net.myId='host';net.phase='started';net.selectStage('room','harbor');assert.equal(sent.length,count);
  cards.forEach(c=>c.disabled=true);key(cards[0],'ArrowRight');assert.equal(sent.length,count);
});

test('stage lobby: render synchronizes the room choice and disables all five guest cards with an explanatory note',()=>{
  const cards=[...STAGE_IDS,'random'].map(id=>({dataset:{stagePick:id},setAttribute(k,v){this[k]=v;}}));
  const note={textContent:''};
  const panel={dataset:{},querySelector:s=>s==='[data-stage-blurb="room"]'?note:null,
    querySelectorAll:s=>s==='[data-stage-scope="room"]'?cards:[]};
  const net=Object.create(PvPNetworkConsole.prototype);
  Object.assign(net,{root:{querySelector:()=>null},panel:()=>panel,renderConnection(){},updateArena(){},
    myId:'guest',hostPlayerId:'host',phase:'waiting',roomStage:'harbor',practiceStage:'colosseum',
    players:[],entries:[],character:'fire',fighter:'sira'});
  net.render();assert.ok(cards.every(c=>c.disabled));
  assert.equal(cards[3]['aria-checked'],'true');assert.equal(cards[3].tabIndex,0);
  assert.match(note.textContent,/oda sahibi/);
  net.myId='host';net.render();assert.ok(cards.every(c=>!c.disabled));
  net.roomStage='skyforge';net.render();assert.equal(cards[1]['aria-checked'],'true');assert.equal(cards[3]['aria-checked'],'false');
});

test('stage room: real rematch retains stage, typing and assist in all three modes',async()=>{
  for(const mode of ['classic','rounds','arena']){
    const f=await lobby();
    if(mode!=='rounds')await request(f.room,f.a,'MATCH_CONFIG',{mode});
    await request(f.room,f.a,'MATCH_CONFIG',{stage:'harbor'});
    await request(f.room,f.a,'MATCH_CONFIG',{typing:{caseSensitive:false,punctuation:false}});
    await request(f.room,f.a,'MATCH_CONFIG',{assist:false});
    const before=await start(f);await request(f.room,f.a,'SURRENDER');
    await request(f.room,f.a,'REMATCH_VOTE',{accept:true});await request(f.room,f.b,'REMATCH_VOTE',{accept:true});
    const data=await f.room.roster();data.startAt=Date.now()-1;await f.room.save(data);await f.room.alarm();
    const after=await f.ctx.storage.get('match');
    assert.notEqual(after.id,before.id);assert.equal(after.stage,'harbor');
    assert.deepEqual(after.typing,{caseSensitive:false,punctuation:false});
    const snapshot=received(f.a,'MATCH_START').at(-1).payload.match;
    assert.equal(snapshot.assistEnabled,false);assert.equal(snapshot.status,'running');
  }
});

test('stage lobby: bot stage choice persists locally and startPractice uses it',()=>{
  const previous=globalThis.localStorage,values=new Map();
  globalThis.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v))};
  const net=Object.create(PvPNetworkConsole.prototype);
  Object.assign(net,{render(){},disconnect(){},readName:()=>'Oyuncu',log(){},receive(){},practiceMode:'classic',practiceRounds:5,
    fighter:'sira',character:'fire',practiceStage:'colosseum'});
  try{
    net.selectStage('practice','runegarden');assert.equal(values.get('tuslab-pvp-stage'),'runegarden');
    net.startPractice();assert.equal(net.practice.snapshot().stage,'runegarden');
  }finally{net.practice?.dispose();if(previous===undefined)delete globalThis.localStorage;else globalThis.localStorage=previous;}
});
