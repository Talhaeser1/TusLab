import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../cloudflare/src/index.js';
import {PvPProfiles} from '../cloudflare/src/profiles.js';
import {friendCode,initialSocial,updateSocialPair} from '../cloudflare/src/social.js';
import {friendPanelHTML,renderSocial} from '../pvp/phase17-social.js';
import {PvPRoom} from '../cloudflare/src/room.js';

const aToken='a'.repeat(64),bToken='b'.repeat(64),cToken='c'.repeat(64);
const digest=async token=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),n=>n.toString(16).padStart(2,'0')).join('');
function storage(){const map=new Map();return {get:async k=>structuredClone(map.get(k)),put:async(k,v)=>{if(typeof k==='object'&&k!==null){for(const [key,val] of Object.entries(k))map.set(key,structuredClone(val));}else map.set(k,structuredClone(v));},deleteAll:async()=>map.clear(),setAlarm:async()=>{},inspect:map};}
function setup(){const st=storage(),ctx={storage:st,getWebSockets:()=>[],setWebSocketAutoResponse:()=>{},acceptWebSocket:()=>{}},db=new PvPProfiles(ctx);
 const env={PVP_PROFILES:{idFromName:()=> 'global',get:()=>({fetch:(url,options)=>db.fetch(typeof url==='string'?new Request(url,options):url)})}};
 const req=(token,action='read',other={})=>worker.fetch(new Request('https://game.test/api/pvp/social',{method:'POST',headers:{'content-type':'application/json','origin':'https://game.test'},body:JSON.stringify({guestToken:token,action,name:token===aToken?'Alev':'Rün',...other})}),env);
 return {st,ctx,db,env,req};}
const json=async response=>{const data=await response.json();return {status:response.status,...data};};

test('new guest gets unique friend code and empty social lists',async()=>{
 const {req}=setup();const a=await json(await req(aToken)),b=await json(await req(bToken));
 assert.match(a.code,/^[A-F0-9]{12}$/);assert.notEqual(a.code,b.code);assert.deepEqual(a.friends,[]);assert.equal(a.name,'Alev');
});
test('friend request -> accept is symmetric and does not trust display names',async()=>{
 const {req}=setup();const a=await json(await req(aToken)),b=await json(await req(bToken));
 const sent=await json(await req(aToken,'request',{targetCode:b.code}));assert.equal(sent.status,200);
 assert.equal(sent.outgoing.length,1);
 assert.equal((await json(await req(bToken))).incoming[0].code,a.code);
 const accepted=await json(await req(bToken,'accept',{targetCode:a.code}));assert.equal(accepted.friends.length,1);
 assert.equal((await json(await req(aToken))).friends[0].code,b.code);
 const duplicate=await json(await req(aToken,'request',{targetCode:b.code}));assert.equal(duplicate.error,'ALREADY_FRIENDS');
});
test('reject/cancel/remove are symmetric; strangers cannot accept',async()=>{
 const {req}=setup(),a=await json(await req(aToken)),b=await json(await req(bToken));
 assert.equal((await json(await req(bToken,'accept',{targetCode:a.code}))).status,404);
 await req(aToken,'request',{targetCode:b.code});await req(aToken,'cancel',{targetCode:b.code});
 assert.equal((await json(await req(bToken))).incoming.length,0);
 await req(aToken,'request',{targetCode:b.code});await req(bToken,'reject',{targetCode:a.code});
 assert.equal((await json(await req(aToken))).outgoing.length,0);
 await req(aToken,'request',{targetCode:b.code});await req(bToken,'accept',{targetCode:a.code});
 await req(aToken,'remove',{targetCode:b.code});assert.equal((await json(await req(bToken))).friends.length,0);
});
test('blocking deletes pending and friends and prevents further contacts',async()=>{
 const {req}=setup(),a=await json(await req(aToken)),b=await json(await req(bToken));
 await req(aToken,'request',{targetCode:b.code});await req(bToken,'block',{targetCode:a.code});
 assert.equal((await json(await req(bToken))).blocked[0].code,a.code);
 assert.equal((await json(await req(aToken))).outgoing.length,0);
 assert.equal((await json(await req(aToken,'request',{targetCode:b.code}))).status,403);
 await req(bToken,'unblock',{targetCode:a.code});assert.equal((await json(await req(aToken,'request',{targetCode:b.code}))).status,200);
});
test('no self-friending, invalid identities or unrestricted request flood',async()=>{
 const {req}=setup(),a=await json(await req(aToken)),b=await json(await req(bToken));
 assert.equal((await json(await req(aToken,'request',{targetCode:a.code}))).status,404);
 assert.equal((await json(await req(aToken,'request',{targetCode:'123'}))).status,400);
 const many=await Promise.all(Array.from({length:3},()=>req(aToken,'request',{targetCode:b.code})));
 assert.deepEqual(many.map(r=>r.status).sort(),[200,409,409]);
 assert.equal((await json(await req('bad'))).status,400);
});
test('invite from a real room member only, to accepted friend, with dismissal',async()=>{
 const {req,env}=setup(),a=await json(await req(aToken)),b=await json(await req(bToken));
 await req(aToken,'request',{targetCode:b.code});await req(bToken,'accept',{targetCode:a.code});
 const room='ABCDEFGHJKLMNPQR';env.PVP_ROOMS={idFromName:x=>x,get:()=>({fetch:async()=>new Response(null,{status:204})})};
 let sent=await json(await req(aToken,'invite',{targetCode:b.code,roomCode:room}));assert.equal(sent.status,200);
 let inbox=await json(await req(bToken));assert.equal(inbox.invites[0].roomCode,room);
 assert.ok(inbox.invites[0].expiresAt>Date.now());
 assert.equal((await json(await req(aToken,'invite',{targetCode:b.code,roomCode:room}))).status,409);
 await req(bToken,'dismiss',{inviteId:inbox.invites[0].id});inbox=await json(await req(bToken));assert.equal(inbox.invites.length,0);
 const deny=setup();const one=await json(await deny.req(aToken));const two=await json(await deny.req(bToken));
 await deny.req(aToken,'request',{targetCode:two.code});await deny.req(bToken,'accept',{targetCode:one.code});
 deny.env.PVP_ROOMS={idFromName:x=>x,get:()=>({fetch:async()=>new Response(null,{status:403})})};
 assert.equal((await json(await deny.req(aToken,'invite',{targetCode:two.code,roomCode:room}))).status,403);
});
test('social view escapes untrusted player and invite names',()=>{
 const html=renderSocial({incoming:[{name:'<img src=x onerror=alert(1)>',code:'ABCDEF012345'}],friends:[],outgoing:[],blocked:[],recent:[],invites:[]});
 assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img'));assert.ok(friendPanelHTML().includes('data-social-action="toggle"')===false);
});
test('pure social state refuses blocked users, self code is not a secret',()=>{
 const a=initialSocial(),b=initialSocial(),idA='a'.repeat(64),idB='b'.repeat(64);
 assert.equal(friendCode(idA),'AAAAAAAAAAAA');
 const result=updateSocialPair('request',a,b,idA,idB,Date.now());assert.equal(result.a.outgoing[0],idB);
 b.blocked=[idA];assert.equal(updateSocialPair('request',a,b,idA,idB).error,'BLOCKED');
});
test('room owner authorization: non-host cannot kick or close; host can kick',async()=>{
 const st=storage();let sent=[];const ctx={storage:st,setWebSocketAutoResponse:()=>{},getWebSockets:()=>[],acceptWebSocket:()=>{}};
 const old=globalThis.WebSocketRequestResponsePair;globalThis.WebSocketRequestResponsePair=class {};
 const room=new PvPRoom(ctx,{});globalThis.WebSocketRequestResponsePair=old;
 await room.save({phase:'waiting',startAt:null,hostPlayerId:'a',players:[{playerId:'a',seat:1,ready:false},{playerId:'b',seat:2,ready:false}]});
 const ws={send:value=>sent.push(JSON.parse(value))};
 await room.hostAction(ws,{playerId:'b'},'HOST_KICK',{playerId:'a'});
 assert.equal(sent.at(-1).payload.code,'HOST_ONLY');
 await room.hostAction(ws,{playerId:'a'},'HOST_KICK',{playerId:'b'});
 assert.equal((await room.roster()).players.length,1);
 assert.equal((await room.roster()).hostPlayerId,'a');
});
test('verify-inviter denies unknown or offline guests',async()=>{
 const st=storage(),ctx={storage:st,setWebSocketAutoResponse:()=>{},getWebSockets:()=>[],acceptWebSocket:()=>{}},old=globalThis.WebSocketRequestResponsePair;
 globalThis.WebSocketRequestResponsePair=class {};const room=new PvPRoom(ctx,{});globalThis.WebSocketRequestResponsePair=old;
 await st.put('createdAt',Date.now());await room.save({phase:'waiting',players:[{playerId:'a',profileId:'a'.repeat(64)}]});
 const status=await room.fetch(new Request('https://room.internal/verify-inviter?profileId='+ 'a'.repeat(64)));
 assert.equal(status.status,403);
});
