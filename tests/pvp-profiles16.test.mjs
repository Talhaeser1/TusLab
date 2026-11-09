import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../cloudflare/src/index.js';
import {PvPRoom} from '../cloudflare/src/room.js';
import {PvPProfiles,ratingAfter,startOfWeek,leaderboard,newProfile,updateProfile} from '../cloudflare/src/profiles.js';
import {profilePanelHTML,profileView,boardView} from '../pvp/phase16-ui.js';
import {createMatch,surrenderMatch} from '../cloudflare/src/match.js';

const tokenA='a'.repeat(64),tokenB='b'.repeat(64);
const hashed=async token=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),b=>b.toString(16).padStart(2,'0')).join('');
const memory=()=>{
 const store=new Map();
 return {get:async key=>structuredClone(store.get(key)),put:async(key,value)=>{
   if(key instanceof Map){for(const [k,v] of key)store.set(k,structuredClone(v));}
   else if(typeof key==='object'&&key!==null&&value===undefined){for(const [k,v] of Object.entries(key))store.set(k,structuredClone(v));}
   else store.set(key,structuredClone(value));
 },setAlarm:async()=>{},deleteAll:async()=>store.clear()};
};
const ctx=()=>({storage:memory(),getWebSockets:()=>[],setWebSocketAutoResponse:()=>{},acceptWebSocket:()=>{}});
const result=(id='x1',end=Date.UTC(2026,9,31))=>({matchId:id,endedAt:end,startedAt:end-90000,endReason:'KNOCKOUT',winnerSeat:1,players:[
 {seat:1,playerId:'p1',name:'Alev',character:'fire',wpm:64,accuracy:97,correctWords:26,wrongWords:1,maxCombo:9,damageDealt:1000,defense:{perfectBlocks:2,parries:1}},
 {seat:2,playerId:'p2',name:'Rün',character:'rune',wpm:47,accuracy:91,correctWords:20,wrongWords:2,maxCombo:4,damageDealt:200,defense:{perfectBlocks:0,parries:0}}]});
test('guest profile and public board persist, have no duplicate awards',async()=>{
 const store=ctx(),profiles=new PvPProfiles(store),a=await hashed(tokenA),b=await hashed(tokenB);
 const request=()=>new Request('https://profile.internal/record',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({result:result(),profileIds:[a,b],ranked:false})});
 assert.equal((await profiles.fetch(request())).status,200);
 const again=await (await profiles.fetch(request())).json();assert.equal(again.duplicate,true);
 const p=await (await profiles.fetch(new Request('https://profile.internal/profile?id='+a))).json();
 assert.equal(p.profile.wins,1);assert.equal(p.profile.matches,1);assert.equal(p.profile.totalDamage,1000);
 assert.equal(p.profile.rating,1000);assert.equal(p.profile.rankedGames,0);
 assert.equal(p.profile.history.length,1);
 const board=await (await profiles.fetch(new Request('https://profile.internal/leaderboard?metric=wins&range=all'))).json();
 assert.equal(board.entries.length,2);assert.equal(board.entries[0].name,'Alev');
 const ranked=await (await profiles.fetch(new Request('https://profile.internal/leaderboard?metric=rating&range=all'))).json();
 assert.equal(ranked.entries.length,0);
});
test('completed match updates weekly aggregate even with >20 total matches',()=>{
 const p=newProfile('f'.repeat(64),'Alev');
 let next=p;
 for(let n=0;n<26;n++)next=updateProfile(next,{result:result('x'+n),player:result().players[0],matchId:'x'+n});
 assert.equal(next.matches,26);assert.equal(next.history.length,20);
 const table=leaderboard([next],'wins','week',Date.UTC(2026,9,31));
 assert.equal(table[0].wins,26);assert.equal(table[0].avgWpm,64);
 assert.equal(startOfWeek(Date.UTC(2026,9,31)),Date.UTC(2026,9,26));
});
test('cancelled games do not increase match or win totals',()=>{
 const r=result();r.endReason='BOTH_DISCONNECTED';r.winnerSeat=null;
 const p=updateProfile(newProfile('f'.repeat(64)),{result:r,player:r.players[0],matchId:r.matchId});
 assert.equal(p.cancelled,1);assert.equal(p.matches,0);
});
test('Elo accounts for draw, victory, defeat but casual rooms never count as ranked',()=>{
 assert.equal(ratingAfter(1000,1000,1),1012);
 assert.equal(ratingAfter(1000,1000,0),988);
 assert.equal(ratingAfter(1000,1000,.5),1000);
});
test('profile UI safely escapes server display names and exposes working controls',()=>{
 const html=profileView({...newProfile('d'.repeat(64),'<img src=x onerror=alert(1)>'),matches:1,history:[]});
 assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img'));
 assert.ok(profilePanelHTML().includes('data-pvp16-action="view-board"'));
 assert.ok(boardView([{rank:1,name:'<script>',wins:2,matches:2}],'wins').includes('&lt;script&gt;'));
});
test('public API never provides a score-write route or accepts guest secret in URL',async()=>{
 const profiles=new PvPProfiles(ctx());const env={PVP_PROFILES:{idFromName:()=> 'global',get:()=>({fetch:(request,options)=>profiles.fetch(typeof request==='string'?new Request(request,options):request)})}};
 assert.equal((await worker.fetch(new Request('https://tuslab.test/api/pvp/scores',{method:'POST'}),env)).status,404);
 let response=await worker.fetch(new Request('https://tuslab.test/api/pvp/profile',{method:'POST',body:JSON.stringify({guestToken:tokenA}),headers:{'content-type':'application/json'}}),env);
 assert.equal(response.status,200);assert.equal((await response.json()).profile,null);
 response=await worker.fetch(new Request('https://tuslab.test/api/pvp/leaderboard?metric=rating&range=week'),env);
 assert.equal(response.status,200);
 response=await worker.fetch(new Request('https://tuslab.test/api/pvp/leaderboard?metric=__proto__'),env);
 assert.equal(response.status,400);
});
test('server room result sends trusted unranked result once to global profiles DO',async()=>{
 const profileStore=ctx(),profiles=new PvPProfiles(profileStore),lobbyCtx=ctx();
 const env={PVP_PROFILES:{idFromName:()=> 'global',get:()=>({fetch:(request,options)=>profiles.fetch(typeof request==='string'?new Request(request,options):request)})}};
 const previous=globalThis.WebSocketRequestResponsePair;globalThis.WebSocketRequestResponsePair=class {};
 const room=new PvPRoom(lobbyCtx,env);globalThis.WebSocketRequestResponsePair=previous;const a=await hashed(tokenA),b=await hashed(tokenB);
 await room.save({phase:'started',startAt:null,players:[
 {playerId:'p1',seat:1,name:'Alev',character:'fire',profileId:a,ready:true},
 {playerId:'p2',seat:2,name:'Rün',character:'rune',profileId:b,ready:true}]});
 const match=surrenderMatch(createMatch([{playerId:'p1',seat:1,name:'Alev',character:'fire'},{playerId:'p2',seat:2,name:'Rün',character:'rune'}],1000),1,2000);
 await room.recordResult(match);await room.recordResult(match);
 const p=await (await profiles.fetch(new Request('https://x/profile?id='+b))).json();
 assert.equal(p.profile.wins,1);assert.equal(p.profile.rankedGames,0);
 assert.equal((await lobbyCtx.storage.get('results')).length,1);
});
test('duplicate guest identity within one match rejected',async()=>{
 const profiles=new PvPProfiles(ctx());const a=await hashed(tokenA);
 const response=await profiles.fetch(new Request('https://x/record',{method:'POST',body:JSON.stringify({result:result(),profileIds:[a,a]})}));
 assert.equal(response.status,400);
});
