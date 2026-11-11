// Paket 32 — karakter kadrosu: sözleşme, motor yayını, oda FIGHTER_SELECT, bot karakteri, lobi işaretlemesi, maç içi adlar.
import test,{beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {FIGHTERS,FIGHTER_IDS,normalizeFighter,defaultFighter,fighterSide,isFighterId} from '../pvp/shared/fighters.js';
import {createMatch,publicMatch,matchResult,surrenderMatch} from '../pvp/shared/match.js';
import {createArenaMatch,arenaPublicMatch} from '../pvp/shared/arena.js';
import {createPracticeSession,practiceFighters} from '../pvp/practice.js';
import {PvPRoom} from '../cloudflare/src/room.js';
import {networkConsoleHTML,fighterRosterHTML} from '../pvp/network.js';
import {fighterSkillLabels,applyFighterNames} from '../pvp/skillbar.js';
import {callFor,ultimateCall,CALLS} from '../pvp/fight-hud.js';
import {HOWTO_TABS} from '../pvp/howto.js';

test('kadro sözleşmesi: 4 karakter, arketip, varsayılanlar ve normalizeFighter',()=>{
  assert.deepEqual(FIGHTER_IDS,['vargr','sira','doran','nyx']);
  assert.deepEqual(FIGHTER_IDS.map(id=>FIGHTERS[id].archetype),['fire','fire','rune','rune']);
  assert.deepEqual(FIGHTER_IDS.map(id=>FIGHTERS[id].source),['Barbarian','Rogue','Knight','Mage']);
  for(const id of FIGHTER_IDS){
    const f=FIGHTERS[id];
    assert.equal(f.model,`./assets/models/${id}/${id}.glb`);
    assert.match(f.palette.main,/^#[0-9a-f]{6}$/);assert.equal(typeof f.palette.hex,'number');
    assert.ok(f.blurb.length>20);
    for(const k of ['q','e','r','s']){assert.ok(f.skills[k].name&&f.skills[k].desc&&f.skills[k].clip&&f.skills[k].fx,`${id}.${k}`);}
    assert.ok(Object.isFrozen(f)&&Object.isFrozen(f.skills.q));
  }
  assert.equal(FIGHTERS.sira.skills.q.name,'Mızrak Atışı');assert.equal(FIGHTERS.sira.skills.q.clip,'Throw');
  assert.equal(defaultFighter('fire'),'vargr');assert.equal(defaultFighter('rune'),'doran');assert.equal(defaultFighter('x'),'vargr');
  assert.equal(normalizeFighter('nyx','rune'),'nyx');
  assert.equal(normalizeFighter('nyx','fire'),'vargr','arketiple çelişen karakter arketipin varsayılanına düşer');
  assert.equal(normalizeFighter('hacker','rune'),'doran');
  assert.equal(normalizeFighter(undefined,'fire'),'vargr');
  assert.equal(normalizeFighter('sira'),'sira');
  assert.equal(normalizeFighter('__proto__'),'vargr');
  assert.equal(fighterSide('nyx'),'rune');assert.equal(isFighterId('toString'),false);
});

const P=(seat,character,fighter)=>({playerId:`p${seat}`,seat,name:`O${seat}`,character,...(fighter?{fighter}:{})});
test('motor: createMatch/publicMatch/matchResult fighter taşır; eski oyuncular varsayılanı alır',()=>{
  const m=createMatch([P(1,'fire','sira'),P(2,'rune')],1000,'m1');
  assert.deepEqual(m.participants.map(p=>p.fighter),['sira','doran']);
  assert.deepEqual(publicMatch(m,1).players.map(p=>p.fighter),['sira','doran']);
  const bad=createMatch([P(1,'fire','nyx'),P(2,'rune','hacker')],1000,'m2');
  assert.deepEqual(publicMatch(bad,1).players.map(p=>p.fighter),['vargr','doran']);
  const ended=surrenderMatch(m,2,2000);
  assert.deepEqual(matchResult(ended.match||ended).players.map(p=>p.fighter),['sira','doran']);
  const r=createMatch([P(1,'fire','vargr'),P(2,'rune','nyx')],1000,'m3',{rounds:5,seed:7});
  assert.deepEqual(publicMatch(r,2).players.map(p=>p.fighter),['vargr','nyx']);
});
test('motor: hasar/denge karakterden bağımsız (aynı arketip → aynı durum)',()=>{
  const a=createMatch([P(1,'fire','vargr'),P(2,'rune','doran')],1000,'same');
  const b=createMatch([P(1,'fire','sira'),P(2,'rune','nyx')],1000,'same');
  const strip=m=>JSON.stringify(m,(k,v)=>k==='fighter'?undefined:v);
  assert.equal(strip(a),strip(b));
});
test('arena: createArenaMatch/arenaPublicMatch fighter taşır',()=>{
  const m=createArenaMatch([P(1,'fire','sira'),P(2,'rune','nyx')],1000,'a1',{seed:3});
  assert.deepEqual(arenaPublicMatch(m,1).players.map(p=>p.fighter),['sira','nyx']);
});

test('bot maçı: insan karakteri arketipi belirler; bot karşı arketipten karakter alır; motor rng tüketilmez',()=>{
  const nyx=practiceFighters({fighter:'nyx'});
  assert.deepEqual([nyx.character,nyx.fighter,nyx.botCharacter],['rune','nyx','fire']);
  assert.equal(practiceFighters({fighter:'nyx',rng:()=>0.7}).botFighter,'vargr','deterministik oturumda bot karakteri sabit');
  assert.ok(['vargr','sira'].includes(practiceFighters({fighter:'nyx'}).botFighter));
  assert.equal(practiceFighters({fighter:'sira',fighterRng:()=>0.99}).botFighter,'nyx');
  assert.equal(practiceFighters({fighter:'sira',fighterRng:()=>0}).botFighter,'doran');
  assert.equal(practiceFighters({fighter:'sira',botFighter:'nyx'}).botFighter,'nyx');
  assert.equal(practiceFighters({fighter:'sira',botFighter:'vargr'}).botFighter!=='vargr',true,'bot aynı arketipi alamaz');
  assert.deepEqual(practiceFighters({character:'rune'}).fighter,'doran');
  const timers=[];const scheduler={setTimeout:(f,ms)=>{timers.push(f);return timers.length;},clearTimeout(){},setInterval:()=>1,clearInterval(){}};
  let rngCalls=0;
  const s=createPracticeSession({mode:'classic',fighter:'nyx',botFighter:'sira',scheduler,now:()=>5000,rng:()=>{rngCalls++;return 0.5;},createId:()=>'pf'});
  assert.equal(s.character,'rune');assert.equal(s.humanSeat,2);assert.equal(s.fighter,'nyx');assert.equal(s.botFighter,'sira');
  const before=rngCalls;s.start();
  const pub=s.snapshot?.()||publicMatch(s.match,2);
  assert.deepEqual(pub.players.map(p=>p.fighter),['sira','nyx']);
  assert.ok(rngCalls>=before);s.dispose();
  const ar=createPracticeSession({mode:'arena',fighter:'vargr',botFighter:'doran',scheduler,now:()=>5000,createId:()=>'pa'});
  assert.equal(ar.fighter,'vargr');assert.equal(ar.botFighter,'doran');ar.dispose();
});

// ---- Oda (Durable Object) -----------------------------------------------
const saved={Response:globalThis.Response,WebSocketPair:globalThis.WebSocketPair,WebSocketRequestResponsePair:globalThis.WebSocketRequestResponsePair};
let pair;
class Socket{constructor(){this.readyState=1;this.messages=[];this.attachment=null;}send(v){this.messages.push(JSON.parse(v));}
  serializeAttachment(v){this.attachment=structuredClone(v);}deserializeAttachment(){return structuredClone(this.attachment);}close(c=1000){this.readyState=3;this.code=c;}}
class Pair{constructor(){this.client=new Socket();this.server=new Socket();pair=this;}}
class FakeResponse{constructor(body,o={}){this.body=body;this.status=o.status??200;this.headers=new Headers(o.headers||{});this.webSocket=o.webSocket;}}
beforeEach(()=>{globalThis.Response=FakeResponse;globalThis.WebSocketPair=Pair;globalThis.WebSocketRequestResponsePair=class{};});
afterEach(()=>{Object.assign(globalThis,saved);});
function context(){const sockets=[];const memory=new Map();
  return {sockets,memory,getWebSockets(){return sockets.filter(s=>s.readyState===1);},acceptWebSocket(ws){sockets.push(ws);},setWebSocketAutoResponse(){},
    storage:{async get(k){return memory.get(k);},async put(k,v){memory.set(k,structuredClone(v));},async setAlarm(){},async deleteAll(){memory.clear();}}};}
const req=(path,o={})=>new Request('https://tuslab.test'+path,o);
const sent=(s,t)=>s.messages.filter(x=>x.type===t);
const msg=(room,s,type,payload={})=>room.webSocketMessage(s,JSON.stringify({version:1,type,payload}));
const token=i=>`12345678-1234-4123-8123-1234567890${String(i).padStart(2,'0')}-12345678-1234-4123-8123-1234567890${String(i).padStart(2,'0')}`;
async function makeRoom(){const room=new PvPRoom(context(),{});await room.fetch(req('/initialize',{method:'POST'}));return room;}
async function connect(room,i,extra={}){
  await room.fetch(req('/connect',{headers:{Upgrade:'websocket'}}));const ws=pair.server;
  await msg(room,ws,'JOIN',{name:`Savaşçı ${i}`,character:i===1?'fire':'rune',resumeToken:token(i),...extra});return ws;
}
test('oda: JOIN fighter alır, FIGHTER_SELECT arketipi ayarlar ve hazırı sıfırlar, ROOM_STATE fighter yayınlar',async()=>{
  const room=await makeRoom();const a=await connect(room,1,{fighter:'sira'});const b=await connect(room,2);
  let data=await room.roster();
  assert.deepEqual(data.players.map(p=>p.fighter),['sira','doran']);
  assert.deepEqual(sent(b,'ROOM_STATE').at(-1).payload.players.map(p=>p.fighter),['sira','doran']);
  await msg(room,a,'READY_SET',{ready:true});
  await msg(room,a,'FIGHTER_SELECT',{fighter:'nyx'});
  data=await room.roster();
  assert.equal(data.players[0].fighter,'nyx');assert.equal(data.players[0].character,'rune');assert.equal(data.players[0].ready,false);
  assert.equal(sent(b,'ROOM_STATE').at(-1).payload.players[0].fighter,'nyx','rakip kartında karakter görünür');
  // İki oyuncu aynı karakteri seçebilir (eski CHARACTER_SELECT kuralı gibi benzersizlik yok).
  await msg(room,b,'FIGHTER_SELECT',{fighter:'nyx'});
  assert.deepEqual((await room.roster()).players.map(p=>p.fighter),['nyx','nyx']);
  // CHARACTER_SELECT eski istemci: fighter arketiple uyumlu kalır.
  await msg(room,a,'CHARACTER_SELECT',{character:'fire'});
  assert.equal((await room.roster()).players[0].fighter,'vargr');
});
test('oda: geçersiz FIGHTER_SELECT ve maç başladıktan sonra seçim reddedilir; JOIN geçersiz fighter varsayılana düşer',async()=>{
  const room=await makeRoom();const a=await connect(room,1,{fighter:'<script>'});const b=await connect(room,2,{fighter:'vargr'});
  assert.deepEqual((await room.roster()).players.map(p=>p.fighter),['vargr','doran'],'rune JOIN + fire karakteri → doran');
  for(const bad of ['hacker','__proto__',42,null,{id:'nyx'}]){
    await msg(room,a,'FIGHTER_SELECT',{fighter:bad});
    assert.equal(sent(a,'ERROR').at(-1).payload.code,'INVALID_FIGHTER');
  }
  assert.equal((await room.roster()).players[0].fighter,'vargr');
  await msg(room,a,'FIGHTER_SELECT',{fighter:'sira'});
  await msg(room,a,'READY_SET',{ready:true});await msg(room,b,'READY_SET',{ready:true});
  const data=await room.roster();data.startAt=Date.now()-1;await room.save(data);await room.alarm();
  assert.equal((await room.roster()).phase,'started');
  const start=sent(a,'MATCH_START').at(-1).payload.match;
  assert.deepEqual(start.players.map(p=>p.fighter),['sira','doran']);
  await msg(room,a,'FIGHTER_SELECT',{fighter:'nyx'});
  assert.equal(sent(a,'ERROR').at(-1).payload.code,'MATCH_STARTED');
  assert.equal((await room.roster()).players[0].fighter,'sira');
  // Paket boyutu: fighter alanı snapshot'ı 4096 bayt sınırına yaklaştırmaz.
  assert.ok(JSON.stringify(sent(a,'ROOM_STATE').at(-1)).length<1500);
});

test('lobi işaretlemesi: 4 karakter kartı, radyo grubu, rozet, hikâye, Q/E/R adları, portre yeri',()=>{
  const html=networkConsoleHTML();
  const cards=html.match(/class="lb3-fighter (fire|rune)"/g)||[];
  assert.equal(cards.length,4);
  assert.match(html,/role="radiogroup" aria-labelledby="lb3-hero-title"/);
  assert.equal((html.match(/data-fighter-portrait="/g)||[]).length,4);
  assert.equal((html.match(/role="radio" aria-checked="true"/g)||[]).length,2,'lobi + oda içi grupta birer seçili');
  for(const id of FIGHTER_IDS){
    const f=FIGHTERS[id];
    for(const t of [f.name,f.title,f.skills.q.name,f.skills.e.name,f.skills.r.name])assert.ok(html.includes(t),`${id}: ${t}`);
  }
  assert.ok(html.includes('>ATEŞ<')&&html.includes('>RÜN<'));
  assert.equal((fighterRosterHTML('nyx').match(/tabindex="0"/g)||[]).length,1);
  assert.match(fighterRosterHTML('nyx'),/aria-checked="true" tabindex="0" class="lb3-fighter rune" data-lobby-action="fighter" data-fighter="nyx"/);
  assert.ok(!html.includes('data-lobby-action="hero"'),'eski 2 karakterli vitrin kalktı');
});

test('maç içi adlar: beceri kartları, ULTİ anonsu ve Nasıl oynanır',()=>{
  assert.deepEqual(fighterSkillLabels('sira').Q,{name:'Mızrak Atışı',effect:FIGHTERS.sira.skills.q.short});
  assert.equal(fighterSkillLabels('yok'),null);
  const nodes={};const card=key=>{const strong={textContent:'eski'},fx={textContent:'eski'};nodes[key]={strong,fx};
    return {querySelector:s=>s==='.sk-copy strong'?strong:s==='.sk-fx'?fx:null};};
  const section={dataset:{},querySelector:s=>card(s.match(/"(\w)"/)[1])};
  applyFighterNames(section,'vargr');
  assert.equal(nodes.R.strong.textContent,'Kan Fırtınası');assert.equal(nodes.Q.strong.textContent,'Balta Savuruşu');
  assert.equal(section.dataset.skFighter,'vargr');
  assert.equal(ultimateCall('vargr'),'KAN FIRTINASI!');assert.equal(ultimateCall('nyx'),'YILDIZ ÇÖKÜŞÜ!');
  assert.equal(ultimateCall(null),CALLS.ultimate);
  assert.deepEqual(callFor({type:'SKILL_CAST',skill:'r',fromSeat:1},seat=>seat===1?'sira':null),{text:'GÖLGE YAĞMURU!',seat:1});
  assert.deepEqual(callFor({type:'SKILL_CAST',skill:'r',fromSeat:2}),{text:CALLS.ultimate,seat:2});
  const tab=HOWTO_TABS.find(t=>t.id==='karakterler');
  assert.ok(tab);assert.equal(tab.items.filter(([t])=>FIGHTER_IDS.some(id=>t.startsWith(FIGHTERS[id].name))).length,4);
  assert.ok(JSON.stringify(tab).includes('Rün Sütunu'));
});
