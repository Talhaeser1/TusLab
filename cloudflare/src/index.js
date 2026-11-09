import { PvPRoom } from './room.js';
import { PvPGuard } from './guard.js';
import { PvPProfiles, GUEST_TOKEN } from './profiles.js';
import { RELEASE_STAGE } from '../../pvp/release.js';
export { PvPRoom, PvPProfiles, PvPGuard };
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const codeOK=code=>/^[A-Z2-9]{16}$/.test(code);
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateRoomCode(){const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);return Array.from(bytes,b=>alphabet[b%alphabet.length]).join('');}
function sameOrigin(request){const origin=request.headers.get('Origin');if(!origin)return true;try{const a=new URL(origin),b=new URL(request.url);return a.origin===b.origin;}catch{return false;}}
const internalStub=(env,code)=>env.PVP_ROOMS.get(env.PVP_ROOMS.idFromName(code));
// Never assume Content-Length is present or honest; cap bytes while streaming.
export async function readJsonLimited(request,maxBytes){
  const advertised=Number(request.headers.get('content-length')||0);
  if(Number.isFinite(advertised)&&advertised>maxBytes)return {error:'TOO_LARGE'};
  if(!request.body)return {value:null};
  const reader=request.body.getReader(); const chunks=[];let size=0;
  try{for(;;){const {value,done}=await reader.read();if(done)break;
    size+=value.byteLength;if(size>maxBytes){await reader.cancel().catch(()=>{});return {error:'TOO_LARGE'};}
    chunks.push(value);
  }}catch{return {error:'INVALID_JSON'};}finally{reader.releaseLock();}
  const data=new Uint8Array(size);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}
  try{return {value:JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(data))};}
  catch{return {error:'INVALID_JSON'};}
}
const rateRules={
  '/api/pvp/rooms':{max:6,seconds:60},
  '/api/pvp/social':{max:40,seconds:60},
  '/api/pvp/profile':{max:40,seconds:60},
  '/api/pvp/leaderboard':{max:80,seconds:60},
  'websocket':{max:30,seconds:60},
  'status':{max:90,seconds:60}
};
export async function enforceEdgeRate(request,env,rule){
  if(!env.PVP_GUARD)return null; // Local simulation may omit binding; production config includes it.
  const remote=request.headers.get('cf-connecting-ip')||'unidentified';
  const raw=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(remote));
  const key=Array.from(new Uint8Array(raw),v=>v.toString(16).padStart(2,'0')).join('');
  const policy=rateRules[rule];if(!policy)return null;
  try{
    const stub=env.PVP_GUARD.get(env.PVP_GUARD.idFromName('edge:'+key));
    const r=await stub.fetch('https://guard.internal/check',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({scope:rule,max:policy.max,seconds:policy.seconds})});
    if(!r.ok)return reply({error:'RATE_LIMIT'},429);
  }catch{return reply({error:'SECURITY_SERVICE_UNAVAILABLE'},503);}
  return null;
}

export default {async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname==='/api/health'&&request.method==='GET')return reply({ok:true,service:'tuslab-pvp',stage:RELEASE_STAGE,protocol:1,time:new Date().toISOString()});
  if(url.pathname.startsWith('/api/')){
    if(!sameOrigin(request))return reply({error:'CROSS_ORIGIN'},403);
    const isSocket=/^\/api\/pvp\/rooms\/[^/]+\/ws$/.test(url.pathname);
    const isRoomStatus=/^\/api\/pvp\/rooms\/[^/]+$/.test(url.pathname);
    const rule=isSocket?'websocket':isRoomStatus?'status':rateRules[url.pathname]?url.pathname:null;
    if(rule){const denied=await enforceEdgeRate(request,env,rule);if(denied)return denied;}

    if(url.pathname==='/api/pvp/social'&&request.method==='POST'){
      const parsed=await readJsonLimited(request,1400);if(parsed.error)return reply({error:parsed.error},parsed.error==='TOO_LARGE'?413:400);
      const body=parsed.value;
      if(!GUEST_TOKEN.test(body?.guestToken||''))return reply({error:'INVALID_GUEST'},400);
      const allowed=['read','request','accept','reject','cancel','remove','block','unblock','invite','dismiss'];
      if(!allowed.includes(body.action||'read'))return reply({error:'INVALID_ACTION'},400);
      const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body.guestToken));
      const profileId=Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('');
      if(body.action==='invite'){
        const code=String(body.roomCode||'');
        if(!codeOK(code))return reply({error:'INVALID_ROOM'},400);
        // Invitations must originate from a player who is actually in this waiting room.
        const valid=await internalStub(env,code).fetch('https://room.internal/verify-inviter?profileId='+profileId);
        if(!valid.ok)return reply({error:'NOT_ROOM_MEMBER'},403);
      }
      const stub=env.PVP_PROFILES.get(env.PVP_PROFILES.idFromName('tuslab-global-v1'));
      return stub.fetch('https://profiles.internal/social',{method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({action:body.action||'read',targetCode:body.targetCode,roomCode:body.roomCode,inviteId:body.inviteId,profileId,name:body.name})});
    }
    if(url.pathname==='/api/pvp/leaderboard'&&request.method==='GET'){
      const metric=url.searchParams.get('metric')||'wins';const range=url.searchParams.get('range')||'all';
      if(!['wins','wpm','accuracy','rating'].includes(metric)||!['week','all'].includes(range))return reply({error:'INVALID_FILTER'},400);
      const stub=env.PVP_PROFILES.get(env.PVP_PROFILES.idFromName('tuslab-global-v1'));
      return stub.fetch('https://profiles.internal/leaderboard?'+new URLSearchParams({metric,range}));
    }
    if(url.pathname==='/api/pvp/profile'&&request.method==='POST'){
      const parsed=await readJsonLimited(request,256);if(parsed.error)return reply({error:parsed.error},parsed.error==='TOO_LARGE'?413:400);
      const body=parsed.value;if(!GUEST_TOKEN.test(body?.guestToken||''))return reply({error:'INVALID_GUEST'},400);
      const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body.guestToken));
      const id=Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('');
      const stub=env.PVP_PROFILES.get(env.PVP_PROFILES.idFromName('tuslab-global-v1'));
      return stub.fetch('https://profiles.internal/profile?id='+id);
    }
    if(url.pathname==='/api/pvp/rooms'&&request.method==='POST'){
      const parsed=await readJsonLimited(request,1000);if(parsed.error)return reply({error:parsed.error},parsed.error==='TOO_LARGE'?413:400);
      const roomCode=generateRoomCode();
      await internalStub(env,roomCode).fetch('https://room.internal/initialize',{method:'POST'});
      return reply({roomCode,websocketPath:`/api/pvp/rooms/${roomCode}/ws`,protocol:1,invitePath:`/?pvpRoom=${roomCode}`},201);
    }
    const match=url.pathname.match(/^\/api\/pvp\/rooms\/([^/]+)(\/ws)?$/);
    if(match){
      const code=match[1].toUpperCase();if(!codeOK(code))return reply({error:'INVALID_ROOM_CODE'},400);
      const stub=internalStub(env,code);
      if(match[2]&&request.method==='GET'){
        if((request.headers.get('Upgrade')||'').toLowerCase()!=='websocket')return reply({error:'UPGRADE_REQUIRED'},426);
        return stub.fetch('https://room.internal/connect',{headers:{Upgrade:'websocket'}});
      }
      if(!match[2]&&request.method==='GET')return stub.fetch('https://room.internal/status');
    }
    return reply({error:'NOT_FOUND'},404);
  }
  return env.ASSETS.fetch(request);
}};
export {generateRoomCode,codeOK,sameOrigin};
