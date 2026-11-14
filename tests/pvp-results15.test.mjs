import test,{beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,submitWord,resolveDueAttacks,finishMatch,surrenderMatch,matchResult,publicMatch,MATCH_DURATION_MS} from '../cloudflare/src/match.js';
import {PvPRoom} from '../cloudflare/src/room.js';
import {END_LABELS,resultCardHTML,resultPanelHTML} from '../pvp/phase15-results.js';
const fighters=[{playerId:'p1',seat:1,name:'Alev Oyuncusu',character:'fire'},{playerId:'p2',seat:2,name:'Rün Oyuncusu',character:'rune'}];
const fixed=()=>createMatch(fighters,1000,'match-phase15');
function word(match,seat,at){const p=match.participants[seat-1];const out=submitWord(match,{playerId:p.playerId,matchId:match.id,wordIndex:p.wordIndex,text:p.currentWord},at);assert.ok(out.match);return out.match;}
test('server-only scoreboard counts three Q/E/R skill casts, damage, accurate WPM and length',()=>{
 let m=fixed();for(let i=0;i<5;i++)m=word(m,1,2000+i*1000);
 m=resolveDueAttacks(m,9500,()=>.99).match;
 assert.equal(m.participants[0].combatStats.damageDealt,585);
 assert.deepEqual(m.participants[0].combatStats.casts,{q:1,e:1,r:1});
 m=finishMatch(m,m.endsAt);const result=matchResult(m);
 assert.equal(result.winnerSeat,1);assert.equal(result.endReason,'TIME_LIMIT');
 assert.equal(result.players[0].damageDealt,585);assert.equal(result.players[1].damageTaken,585);
 assert.equal(result.players[0].skillCasts.r,1);assert.equal(result.mvpSeat,1);
 assert.equal(publicMatch(m).result.players[0].name,'Alev Oyuncusu');
 assert.equal(result.durationMs,MATCH_DURATION_MS);
});
test('equal HP on time produces draw; surrender handles running and paused only',()=>{
 const m=fixed();const tied=finishMatch(m,m.endsAt);
 assert.equal(tied.winnerSeat,null);assert.equal(tied.endReason,'TIME_LIMIT');
 assert.equal(matchResult(tied).mvpSeat,null);
 const s=surrenderMatch(m,1,2000);assert.equal(s.winnerSeat,2);assert.equal(s.endReason,'SURRENDER');
 assert.equal(s.pendingAttacks.length,0);assert.equal(surrenderMatch(s,2,3000),s);
 assert.equal(surrenderMatch(m,4,3000),m);
});
test('HTML scorecard escapes server-sourced player name and never exposes injected markup',()=>{
 const html=resultCardHTML({seat:1,name:'<script>alert(1)</script>',character:'fire',wpm:60,accuracy:98,damageDealt:650,skillCasts:{q:1,e:2,r:3},defense:{}},1,1);
 assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));
 assert.ok(resultPanelHTML().includes('data-pvp15-action="rematch"'));
 assert.equal(END_LABELS.KNOCKOUT,'NAKAVT');
});
test('sonuç ekranı v3: kartlar akışta (taşıp başlığı örtmez), eşit yapılı, taraf rengi, kısa giriş hareketi',async()=>{
 const {readFileSync}=await import('node:fs');
 const css=readFileSync(new URL('../pvp/results-v2.css',import.meta.url),'utf8');
 const at=css.indexOf('/* ===== SONUC EKRANI v3 ===== */');assert.ok(at>0,'v3 bloğu results-v2.css içinde');
 const v3=css.slice(at);
 assert.match(v3,/\.pvp15-scorecards\{flex:none;display:grid;grid-template-columns:repeat\(2,/,'iki kart aynı satırda, esnemeyen blok');
 assert.match(v3,/\.pvp15-card>\*\{flex:none/,'hiçbir blok kalan alanı doldurup taşmaz');
 assert.match(v3,/\.pvp15-card\{justify-content:safe center/,'sığmazsa üstten kesilmez');
 assert.match(v3,/\.pvp15-portrait\{[^}]*height:var\(--r3-ph\)/,'portre bütçeli sabit boy');
 assert.match(v3,/:not\(\.pvp15-winner\)\{opacity:\.88;filter:none\}/,'kaybeden okunur (≥ .85)');
 assert.match(v3,/\.pvp15-figures strong\{[^}]*white-space:nowrap;font-variant-numeric:tabular-nums/,'sayılar tek satır');
 assert.match(v3,/@media\(prefers-reduced-motion:reduce\)\{[^}]*animation:none/);
 assert.match(v3,/#pvp-root\.pvp4-reduced \.pvp15-scene \.pvp15-card>\*\{animation:none!important\}/);
 const durs=[...v3.matchAll(/pvp15-r3-in (\d+)ms/g)].map(m=>+m[1]);assert.ok(durs.length&&durs.every(d=>d<=400));
 assert.doesNotMatch(v3,/infinite|backdrop-filter|blur\(/,'sonsuz animasyon / bulanıklık yok');
 assert.match(resultCardHTML({seat:2,name:'B',character:'rune',fighter:'nyx',wpm:1,accuracy:100,damageDealt:5},2,2),/data-seat="2"/);
});
const original={Response:globalThis.Response,WebSocketPair:globalThis.WebSocketPair,WebSocketRequestResponsePair:globalThis.WebSocketRequestResponsePair};
let last;
class Sock{constructor(){this.readyState=1;this.messages=[];this.attachment=null;}
 send(x){this.messages.push(JSON.parse(x));}serializeAttachment(a){this.attachment=structuredClone(a);}deserializeAttachment(){return structuredClone(this.attachment);}
 close(code=1000){this.readyState=3;this.code=code;}}
class Pair{constructor(){this.client=new Sock();this.server=new Sock();last=this.server;}}
class FakeResponse{constructor(_,p={}){this.status=p.status??200;this.webSocket=p.webSocket;this.headers=new Headers(p.headers);}}
beforeEach(()=>{globalThis.Response=FakeResponse;globalThis.WebSocketPair=Pair;globalThis.WebSocketRequestResponsePair=class {};});
afterEach(()=>Object.assign(globalThis,original));
function fixture(){const sockets=[],store=new Map();let alarm;
 const ctx={getWebSockets:()=>sockets.filter(s=>s.readyState===1),acceptWebSocket:s=>sockets.push(s),setWebSocketAutoResponse(){},storage:{get:async k=>structuredClone(store.get(k)),put:async(k,v)=>store.set(k,structuredClone(v)),setAlarm:async t=>{alarm=t;},deleteAll:async()=>store.clear()}};
 return {ctx,room:new PvPRoom(ctx,{}),get alarm(){return alarm;}};
}
const token=i=>`${String(i).repeat(8)}-1234-4123-8123-${String(i).repeat(12)}-12345678-1234-4123-8123-${String(i).repeat(12)}`;
const request=(room,ws,type,payload={})=>room.webSocketMessage(ws,JSON.stringify({version:1,type,payload}));
const received=(ws,type)=>ws.messages.filter(m=>m.type===type);
async function join(room,i){await room.fetch(new Request('https://local.test/connect',{headers:{Upgrade:'websocket'}}));const ws=last;
 await request(room,ws,'JOIN',{name:`Oyuncu ${i}`,character:i===1?'fire':'rune',resumeToken:token(i)});return ws;}
async function started(){const f=fixture();await f.room.fetch(new Request('https://local.test/initialize',{method:'POST'}));
 const a=await join(f.room,1),b=await join(f.room,2);
 await request(f.room,a,'READY_SET',{ready:true});await request(f.room,b,'READY_SET',{ready:true});
 const l=await f.room.roster();l.startAt=Date.now()-5;await f.room.save(l);await f.room.alarm();
 return {...f,a,b};}
test('surrender yields one authoritative MATCH_END and one archived result; no repeat awards',async()=>{
 const {room,ctx,a,b}=await started();await request(room,a,'SURRENDER',{});
 const m=await ctx.storage.get('match');assert.equal(m.status,'ended');assert.equal(m.endReason,'SURRENDER');assert.equal(m.winnerSeat,2);
 assert.equal(received(a,'MATCH_END').length,1);assert.equal(received(b,'MATCH_END').length,1);
 assert.equal((await ctx.storage.get('results')).length,1);
 await request(room,a,'SURRENDER',{});assert.equal(received(a,'ERROR').at(-1).payload.code,'MATCH_NOT_ACTIVE');
 assert.equal((await ctx.storage.get('results')).length,1);
});
test('rematch takes two approvals and generates fresh match id, full ROUND_HP and cleared stats',async()=>{
 const {room,ctx,a,b}=await started();const old=await ctx.storage.get('match');old.participants[0].hp=500;old.participants[0].combo=12;
 await ctx.storage.put('match',old);await request(room,a,'SURRENDER',{});
 const ended=await ctx.storage.get('match');
 await request(room,a,'REMATCH_VOTE',{accept:true});assert.equal((await room.roster()).phase,'started');
 assert.equal(received(a,'REMATCH_COUNTDOWN').length,0);
 await request(room,b,'REMATCH_VOTE',{accept:true});assert.equal((await room.roster()).phase,'rematch_countdown');
 assert.equal(received(b,'REMATCH_COUNTDOWN').length,1);
 const data=await room.roster();data.startAt=Date.now()-1;await room.save(data);await room.alarm();
 const next=await ctx.storage.get('match');assert.notEqual(next.id,ended.id);assert.equal(next.status,'running');
 assert.deepEqual(next.participants.map(p=>p.hp),[4000,4000]); // KESINYAP 11: ROUND_HP 4000assert.equal(next.participants[0].combo,0);
 assert.equal(next.mode,'rounds');assert.equal(next.round.index,1);
 assert.equal(matchResult(ended).mode,'rounds');
 assert.equal(next.participants[0].combatStats.damageDealt,0);
 assert.equal((await ctx.storage.get('results')).length,1);assert.equal((await room.roster()).phase,'started');
 assert.equal(received(a,'MATCH_START').length,2);
});
test('rematch cancellation prevents unexpected new match',async()=>{
 const {room,ctx,a,b}=await started();await request(room,a,'SURRENDER',{});
 const originalMatch=(await ctx.storage.get('match')).id;
 await request(room,a,'REMATCH_VOTE',{accept:true});await request(room,b,'REMATCH_VOTE',{accept:true});
 await request(room,a,'REMATCH_VOTE',{accept:false});
 assert.equal((await room.roster()).phase,'started');assert.equal(received(b,'REMATCH_CANCELLED').length,1);
 await room.alarm();assert.equal((await ctx.storage.get('match')).id,originalMatch);
});
test('cannot start a new match via forged MATCH_START, MATCH_END, or from an unauthenticated seat',async()=>{
 const {room,ctx,a,b}=await started();await request(room,a,'SURRENDER',{});
 await request(room,a,'MATCH_START',{hp:9999});assert.equal(received(a,'ERROR').at(-1).payload.code,'SERVER_ONLY_EVENT');
 await request(room,b,'REMATCH_VOTE',{accept:'yes'});assert.equal(received(b,'ERROR').at(-1).payload.code,'INVALID_REMATCH_VOTE');
 assert.equal((await ctx.storage.get('match')).status,'ended');
});
