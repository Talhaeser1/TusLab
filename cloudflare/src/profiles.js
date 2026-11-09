import {PROFILE_ID as SOCIAL_ID,FRIEND_CODE,friendCode,initialSocial,cleanInvites,updateSocialPair,ROOM_CODE} from './social.js';
/** Phase 16 — globally indexed, room-authoritative guest profiles.
 * No public POST to /record: only an authorized worker binding to this DO.
 * Guest identity is a hash of a random local token, not a verified account.
 */
export const DEFAULT_RATING=1000;
export const PROFILE_ID=/^[a-f0-9]{64}$/;
export const GUEST_TOKEN=/^[a-f0-9]{64}$/;
const MAX_HISTORY=20;
const json=(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
export const ratingAfter=(own,other,score,k=24)=>Math.round(own+k*(score-1/(1+10**((other-own)/400))));
export const startOfWeek=at=>{const d=new Date(at);const day=(d.getUTCDay()+6)%7;return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()-day);};
export function newProfile(id,name='Savaşçı') {return {id,name,createdAt:Date.now(),updatedAt:Date.now(),rating:DEFAULT_RATING,
  rankedGames:0,rankedWins:0,wins:0,losses:0,draws:0,cancelled:0,matches:0,totalDamage:0,totalCorrectWords:0,
  totalSubmittedWords:0,highestCombo:0,wpmSum:0,accuracySum:0,characters:{fire:0,rune:0},
  defense:{perfectBlocks:0,parries:0},weeks:{},history:[]};}
export function updateProfile(p,entry,ranked=false) {
  const next=structuredClone(p);const {result,player,matchId}=entry;
  if(next.history.some(x=>x.matchId===matchId))return next;
  const cancelled=result.endReason==='BOTH_DISCONNECTED';
  next.name=String(player.name||next.name).slice(0,20);next.updatedAt=result.endedAt||Date.now();
  next.history.unshift({matchId,endedAt:result.endedAt,endReason:result.endReason,seat:player.seat,
    outcome:cancelled?'cancelled':result.winnerSeat===null?'draw':result.winnerSeat===player.seat?'win':'loss',
    opponent:result.players.find(x=>x.seat!==player.seat)?.name||'Rakip',wpm:player.wpm,accuracy:player.accuracy,
    damageDealt:player.damageDealt,character:player.character,ranked});
  next.history=next.history.slice(0,MAX_HISTORY);
  if(cancelled){next.cancelled++;return next;}
  next.matches++;if(result.winnerSeat===null)next.draws++;
  else if(result.winnerSeat===player.seat)next.wins++;else next.losses++;
  next.totalDamage+=player.damageDealt||0;
  next.totalCorrectWords+=player.correctWords||0;next.totalSubmittedWords+=(player.correctWords||0)+(player.wrongWords||0);
  next.wpmSum+=player.wpm||0;next.accuracySum+=player.accuracy||0;
  next.highestCombo=Math.max(next.highestCombo,player.maxCombo||0);
  if(player.character==='rune'||player.character==='fire')next.characters[player.character]++;
  next.defense.perfectBlocks+=player.defense?.perfectBlocks||0;
  next.defense.parries+=player.defense?.parries||0;
  const wk=String(startOfWeek(result.endedAt||Date.now()));
  next.weeks??={};
  const agg=next.weeks[wk]||{matches:0,wins:0,wpmSum:0,accuracySum:0};
  agg.matches++;agg.wins+=result.winnerSeat===player.seat?1:0;
  agg.wpmSum+=player.wpm||0;agg.accuracySum+=player.accuracy||0;
  next.weeks[wk]=agg;
  if(ranked)next.rankedGames++;
  return next;
}
export const publicProfile=p=>p?({id:p.id,name:p.name,rating:p.rating,rankedGames:p.rankedGames,
  matches:p.matches,wins:p.wins,losses:p.losses,draws:p.draws,cancelled:p.cancelled,
  avgWpm:p.matches?Math.round(p.wpmSum/p.matches):0,
  avgAccuracy:p.matches?Math.round(p.accuracySum/p.matches):0,
  highestCombo:p.highestCombo,totalDamage:p.totalDamage,characters:p.characters,defense:p.defense,
  history:p.history}):null;
export function leaderboard(profiles,metric='wins',range='all',now=Date.now()){
  if(!['wins','wpm','accuracy','rating'].includes(metric))metric='wins';
  if(!['all','week'].includes(range))range='all';
  const week=startOfWeek(now);
  return profiles.map(p=>{
    const agg=p.weeks?.[String(week)];
    const matches=range==='all'?p.matches:(agg?.matches||0);
    const wins=range==='all'?p.wins:(agg?.wins||0);
    const avgWpm=matches?Math.round((range==='all'?p.wpmSum:(agg?.wpmSum||0))/matches):0;
    const avgAccuracy=matches?Math.round((range==='all'?p.accuracySum:(agg?.accuracySum||0))/matches):0;
    return {id:p.id,name:p.name,matches,wins,avgWpm,avgAccuracy,rating:p.rating,rankedGames:p.rankedGames};
  }).filter(p=>p.matches>0 && (metric!=='rating'||p.rankedGames>0))
    .sort((a,b)=>{
      const field=metric==='wpm'?'avgWpm':metric==='accuracy'?'avgAccuracy':metric;
      return b[field]-a[field] || b.wins-a.wins || a.name.localeCompare(b.name,'tr');
    }).slice(0,30).map((p,i)=>({rank:i+1,...p}));
}
export class PvPProfiles{
  constructor(ctx){this.ctx=ctx;this.serial=Promise.resolve();}
  enqueue(fn){const p=this.serial.then(fn,fn);this.serial=p.catch(()=>{});return p;}
  async fetch(req){const url=new URL(req.url);
    if(req.method==='POST'&&url.pathname==='/record')return this.enqueue(async()=>{
      const body=await req.json().catch(()=>null);
      const result=body?.result;const ids=body?.profileIds;
      if(!result||typeof result.matchId!=='string'||!Array.isArray(result.players)||result.players.length!==2||!Array.isArray(ids)||ids.length!==2||ids.some(x=>!PROFILE_ID.test(x)))return json({error:'INVALID_RECORD'},400);
      // Idempotent across alarm retries, DO restarts and two-end races.
      const key='done:'+result.matchId;
      if(await this.ctx.storage.get(key))return json({ok:true,duplicate:true});
      if(ids[0]===ids[1])return json({error:'SAME_GUEST'},400);
      const existing=await Promise.all(ids.map(id=>this.ctx.storage.get('profile:'+id)));
      const profiles=ids.map((id,i)=>existing[i]||newProfile(id,result.players[i].name));
      const ranked=body.ranked===true && body.trustedMatchmaking===true; // friend rooms NEVER ranked
      const outcome=profiles.map((p,i)=>updateProfile(p,{result,player:result.players[i],matchId:result.matchId},ranked));
      // Recent opponents are derived only from server-confirmed results.
      outcome.forEach((p,i)=>{const h=p.history.find(x=>x.matchId===result.matchId);if(h)h.opponentId=ids[1-i];});
      if(ranked){const scores=result.players.map(p=>result.winnerSeat===null?.5:p.seat===result.winnerSeat?1:0);
        const ratings=profiles.map(p=>p.rating);
        outcome.forEach((p,i)=>{p.rating=ratingAfter(ratings[i],ratings[1-i],scores[i]);if(scores[i]===1)p.rankedWins++;});
      }
      // Cloudflare storage.put(entries) expects a plain object, not a Map.
      // Persist results, idempotency marker and registry together in one write.
      const registry=await this.ctx.storage.get('profileIds')||[];
      // Make recently encountered opponents findable by friend code even if they never opened Social UI.
      for(const id of ids){const current=await this.ctx.storage.get('code:'+friendCode(id));if(current&&current!==id)return json({error:'FRIEND_CODE_COLLISION'},409);}
      const entries=Object.fromEntries(outcome.map((p,i)=>['profile:'+ids[i],p]));
      ids.forEach(id=>{entries['code:'+friendCode(id)]=id;});
      entries[key]=true;entries.profileIds=[...new Set([...registry,...ids])];
      await this.ctx.storage.put(entries);
      return json({ok:true,ranked});
    });
    if(req.method==='POST'&&url.pathname==='/social')return this.enqueue(async()=>{
      const body=await req.json().catch(()=>null);const id=body?.profileId;
      if(!SOCIAL_ID.test(id||''))return json({error:'INVALID_GUEST'},400);
      const action=body?.action||'read',now=Date.now();
      const key=i=>'social:'+i;
      const read=async i=>cleanInvites(await this.ctx.storage.get(key(i))||initialSocial(),now);
      let actor=await read(id);
      const profile=await this.ctx.storage.get('profile:'+id)||newProfile(id,String(body?.name||'Savaşçı').slice(0,20));
      // Public friend-code collisions are rejected instead of resolving to an arbitrary person.
      const code=friendCode(id),owner=await this.ctx.storage.get('code:'+code);
      if(owner&&owner!==id)return json({error:'FRIEND_CODE_COLLISION'},409);
      if(!owner)await this.ctx.storage.put('code:'+code,id);
      if(!await this.ctx.storage.get('profile:'+id)){
        const registry=await this.ctx.storage.get('profileIds')||[];
        await this.ctx.storage.put({['profile:'+id]:profile,profileIds:[...new Set([...registry,id])]});
      }
      if(action!=='read'){
        if(action==='dismiss'){
          if(!/^[a-f0-9-]{36,80}$/.test(body.inviteId||''))return json({error:'INVALID_INVITE'},400);
          actor.invites=actor.invites.filter(i=>i.id!==body.inviteId);
          await this.ctx.storage.put(key(id),actor);
        }else{
          if(!FRIEND_CODE.test(body.targetCode||''))return json({error:'INVALID_FRIEND_CODE'},400);
          const targetId=await this.ctx.storage.get('code:'+body.targetCode);
          if(!targetId||targetId===id)return json({error:targetId===id?'SELF_TARGET':'FRIEND_NOT_FOUND'},404);
          let target=await read(targetId);
          if(action==='block'){
            if(!actor.blocked.includes(targetId))actor.blocked.push(targetId);
            for(const field of ['friends','outgoing','incoming']){actor[field]=actor[field].filter(x=>x!==targetId);target[field]=target[field].filter(x=>x!==id);}
            actor.invites=actor.invites.filter(x=>x.fromId!==targetId);
            target.invites=target.invites.filter(x=>x.fromId!==id);
          }else if(action==='unblock')actor.blocked=actor.blocked.filter(x=>x!==targetId);
          else if(action==='invite'){
            if(!actor.friends.includes(targetId)||target.blocked.includes(id))return json({error:'NOT_FRIENDS'},403);
            if(!ROOM_CODE.test(body.roomCode||''))return json({error:'INVALID_ROOM'},400);
            if(target.invites.some(i=>i.fromId===id&&i.roomCode===body.roomCode&&i.expiresAt>now))return json({error:'INVITE_ALREADY_SENT'},409);
            target.invites=target.invites.filter(i=>i.expiresAt>now);
            if(target.invites.length>=12)return json({error:'INVITE_LIMIT'},429);
            target.invites.push({id:crypto.randomUUID(),fromId:id,roomCode:body.roomCode,createdAt:now,expiresAt:now+15*60*1000});
          }else{
            const pair=updateSocialPair(action,actor,target,id,targetId,now);
            if(pair.error)return json({error:pair.error},pair.status);
            actor=pair.a;target=pair.b;
          }
          await this.ctx.storage.put({[key(id)]:actor,[key(targetId)]:target});
        }
      }
      const referenced=[...new Set([...actor.friends,...actor.incoming,...actor.outgoing,...actor.blocked,...actor.invites.map(i=>i.fromId),...profile.history.map(h=>h.opponentId).filter(Boolean)])];
      const profiles=await Promise.all(referenced.map(i=>this.ctx.storage.get('profile:'+i)));
      const names=Object.fromEntries(referenced.map((pid,i)=>[pid,{code:friendCode(pid),name:profiles[i]?.name||'Oyuncu'}]));
      const view=ids=>ids.map(i=>({code:names[i]?.code,name:names[i]?.name})).filter(x=>x.code);
      const recent=profile.history.filter(h=>h.opponentId&&!actor.blocked.includes(h.opponentId));
      return json({code,name:profile.name,friends:view(actor.friends),incoming:view(actor.incoming),outgoing:view(actor.outgoing),blocked:view(actor.blocked),
        invites:actor.invites.map(i=>({...i,from:names[i.fromId]})),recent:view([...new Set(recent.map(h=>h.opponentId))]).slice(0,10),
        updatedAt:now});
    });
    if(req.method==='GET'&&url.pathname==='/leaderboard'){
      const ids=await this.ctx.storage.get('profileIds')||[];
      const profiles=(await Promise.all(ids.map(id=>this.ctx.storage.get('profile:'+id)))).filter(Boolean);
      return json({metric:url.searchParams.get('metric')||'wins',range:url.searchParams.get('range')||'all',
        entries:leaderboard(profiles,url.searchParams.get('metric')||'wins',url.searchParams.get('range')||'all')});
    }
    if(req.method==='GET'&&url.pathname==='/profile'){
      const id=url.searchParams.get('id');if(!PROFILE_ID.test(id||''))return json({error:'INVALID_ID'},400);
      return json({profile:publicProfile(await this.ctx.storage.get('profile:'+id))});
    }
    return json({error:'NOT_FOUND'},404);
  }
}
