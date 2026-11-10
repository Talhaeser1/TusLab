/** TuşLab 09/20 — authoritative match life-cycle on Durable Objects.
 * Stage 09 additionally resolves authoritative skill damage and probabilistic shields.
 */
import {createMatch,publicMatch,submitWord,advanceMatch,nextDeadline,roundStartPayload,ROUND_OPTIONS,SERVER_ONLY_EVENTS,pauseMatch,resumeMatch,endDisconnectedMatch,surrenderMatch,matchResult,validateRune} from './match.js';
import {pickRoundSkill} from '../../pvp/shared/match.js';
import {normalizeTyping,isTypingPayload} from '../../pvp/shared/typing-rules.js';
import {normalizeAssist,isAssistPayload} from '../../pvp/shared/assist-rules.js';
import {normalizeStageChoice,isStageChoicePayload,pickStage} from '../../pvp/shared/stages.js';
import {FIGHTERS,isFighterId,normalizeFighter} from '../../pvp/shared/fighters.js';
import {createArenaMatch,submitArenaPick,submitArenaWord,advanceArenaMatch,nextArenaDeadline,arenaPublicMatch,arenaMatchResult,surrenderArenaMatch,ARENA_SERVER_ONLY_EVENTS} from './match.js';
const VERSION=1;
const MAX_BYTES=4096;
const MAX_EVENTS=30;
const MAX_RAW_EVENTS=45;
const WINDOW=5000;
const ROOM_TTL=15*60*1000;
export const REJOIN_GRACE=20*1000;
const CHARACTERS=new Set(['fire','rune']);
const GUEST_TOKEN=/^[a-f0-9]{64}$/;
const DEFAULT_ROUNDS=5;
const roomRounds=data=>ROUND_OPTIONS.includes(data?.rounds)?data.rounds:DEFAULT_ROUNDS;
const roomMode=data=>data?.mode==='arena'?'arena':data?.mode==='classic'?'classic':'rounds';
const snapshot=(match,seat)=>match?.mode==='arena'?arenaPublicMatch(match,seat):publicMatch(match,match?.mode==='rounds'?seat:undefined);
const wrap=(type,payload={})=>{
  const match=payload.match;
  // Several ROUND_* packets may share one snapshot sequence (late alarm); the round number keeps ids unique.
  const suffix=(type.startsWith('ROUND_')||type.startsWith('ARENA_'))&&Number.isInteger(payload.round)?`:r${payload.round}`:'';
  const meta=match?.matchId?{matchId:match.matchId,sequence:match.sequence,eventId:`${match.matchId}:${match.sequence}:${type}${suffix}`} : {};
  return JSON.stringify({version:VERSION,type,payload,serverTime:Date.now(),...meta});
};
const apiError=(code,status)=>new Response(JSON.stringify({error:code}),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
const active=ctx=>ctx.getWebSockets().filter(ws=>ws.readyState===1);
const authenticated=ctx=>active(ctx).map(ws=>({ws,session:ws.deserializeAttachment()})).filter(x=>x.session?.playerId && x.session.verified);
const normalizeName=v=>typeof v==='string'?Array.from(v.trim().replace(/\s+/g,' ').replace(/[^\p{L}\p{N} _.\-]/gu,'')).slice(0,20).join(''):'';
const encode=async value=>{
  const buffer=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buffer),x=>x.toString(16).padStart(2,'0')).join('');
};
const validTicket=t=>typeof t==='string'&&/^[a-f0-9-]{36,80}$/.test(t);
const safeSend=(ws,type,payload)=>{try{ws.send(wrap(type,payload));}catch{/* disconnected */}};

export class PvPRoom {
  constructor(ctx,env){
    this.ctx=ctx;this.env=env;
    // Serialize overlapping JOIN / READY messages to avoid a two-seat race.
    this.serial=Promise.resolve();
    this.ctx.setWebSocketAutoResponse?.(new WebSocketRequestResponsePair('ping','pong'));
  }
  enqueue(fn){const next=this.serial.then(fn,fn);this.serial=next.catch(()=>{});return next;}
  async roster(){return await this.ctx.storage.get('lobby')||{phase:'waiting',players:[],startAt:null};}
  async save(data){await this.ctx.storage.put('lobby',data);}
  async schedule(data){
    const match=data.phase==='started'?await this.ctx.storage.get('match'):null;
    const pending=match?.pendingAttacks?.map(a=>a.resolveAt)||[];
    const disconnected=data.players.filter(p=>p.reservedUntil>0).map(p=>p.reservedUntil);
    const waitingSync=match?.status==='ended'&&this.env.PVP_PROFILES&&!await this.ctx.storage.get('globalSynced:'+match.id);
    const next=['countdown','rematch_countdown'].includes(data.phase) ? data.startAt
      : match?.status==='paused' ? (disconnected.length?Math.min(...disconnected):Date.now()+250)
      : match?.status==='running' ? (match.mode==='arena'?nextArenaDeadline(match):nextDeadline(match)??Math.min(match.endsAt,...pending))
      : match?.status==='ended' ? (waitingSync?Math.min(match.endedAt+ROOM_TTL,Date.now()+30000):Math.max(Date.now()+100,match.endedAt+ROOM_TTL)) : Date.now()+ROOM_TTL;
    await this.ctx.storage.setAlarm?.(next);
  }
  connectedIds(){return new Set(authenticated(this.ctx).map(({session})=>session.playerId));}
  summary(data){
    const online=this.connectedIds();
    const connected=data.players.filter(p=>online.has(p.playerId)).map(({playerId,seat})=>({playerId,seat}));
    return {phase:data.phase,startAt:data.startAt,capacity:2,connected,mode:roomMode(data),rounds:roomRounds(data),typing:normalizeTyping(data.typing),assist:normalizeAssist(data.assist),stage:normalizeStageChoice(data.stage),hostPlayerId:data.hostPlayerId||data.players[0]?.playerId||null,
      players:data.players.map(({playerId,seat,name,character,fighter,rune,ready,reservedUntil})=>({playerId,seat,name,character,fighter:normalizeFighter(fighter,character),rune:rune||'none',ready,online:online.has(playerId),reconnectUntil:online.has(playerId)?null:reservedUntil||null}))};
  }
  broadcast(type,payload){for(const {ws} of authenticated(this.ctx))safeSend(ws,type,payload);}
  sendMatch(ws,type,payload,match,seat){safeSend(ws,type,{...payload,match:snapshot(match,seat)});}
  broadcastMatch(type,payload,match){for(const {ws,session} of authenticated(this.ctx))this.sendMatch(ws,type,payload,match,session.seat);}
  broadcastArenaRounds(roundEvents,match,now){for(const event of roundEvents){
    const payload={...event.payload,serverTime:now};
    if(event.seat){for(const {ws,session} of authenticated(this.ctx))if(session.seat===event.seat)this.sendMatch(ws,event.type,payload,match,session.seat);}
    else this.broadcastMatch(event.type,payload,match);
  }}
  async publish(data){this.broadcast('ROOM_STATE',this.summary(data));}
  prune(data){const online=this.connectedIds();const stamp=Date.now();data.players=data.players.filter(p=>online.has(p.playerId)||((p.reservedUntil||0)>stamp));if(!data.players.some(p=>p.playerId===data.hostPlayerId))data.hostPlayerId=data.players[0]?.playerId||null;}
  async fetch(request){
    const path=new URL(request.url).pathname;
    if(path==='/initialize'&&request.method==='POST'){
      if(await this.ctx.storage.get('createdAt'))return apiError('ALREADY_EXISTS',409);
      await this.ctx.storage.put('createdAt',Date.now());await this.save({phase:'waiting',startAt:null,players:[]});
      await this.ctx.storage.setAlarm?.(Date.now()+ROOM_TTL);
      return new Response(null,{status:204});
    }
    if(!await this.ctx.storage.get('createdAt'))return apiError('ROOM_NOT_FOUND',404);
    if(path==='/verify-inviter'&&request.method==='GET'){
      const id=new URL(request.url).searchParams.get('profileId');
      const data=await this.roster();const connected=this.connectedIds();
      const exists=['waiting','countdown'].includes(data.phase)&&data.players.some(p=>p.profileId===id&&connected.has(p.playerId));
      return new Response(null,{status:exists?204:403});
    }
    if(path==='/status'&&request.method==='GET')return new Response(JSON.stringify(this.summary(await this.roster())),{headers:{'content-type':'application/json','cache-control':'no-store'}});
    if(path!=='/connect')return apiError('NOT_FOUND',404);
    if((request.headers.get('Upgrade')||'').toLowerCase()!=='websocket')return apiError('UPGRADE_REQUIRED',426);
    // Allow two authenticated sockets and at most two pending JOIN handshakes.
    if(active(this.ctx).length>=4)return apiError('ROOM_BUSY',429);
    const pair=new WebSocketPair();const [client,server]=Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({verified:false,connectedAt:Date.now(),count:0,windowAt:Date.now()});
    safeSend(server,'HELLO',{message:'JOIN gerekli',protocol:VERSION});
    return new Response(null,{status:101,webSocket:client});
  }
  async join(ws,payload,session){
    const name=normalizeName(payload.name);
    const token=payload.resumeToken;
    const hash=validTicket(token)?await encode(token):null;
    const guestHash=GUEST_TOKEN.test(payload.guestToken||'')?await encode(payload.guestToken):hash;
    if(name.length<2||!hash||!CHARACTERS.has(payload.character)){safeSend(ws,'ERROR',{code:'INVALID_JOIN'});ws.close(1008,'Invalid join');return;}
    const data=await this.roster();this.prune(data);
    const old=data.players.find(p=>p.tokenHash===hash);
    if(['started','rematch_countdown'].includes(data.phase)&&!old){safeSend(ws,'ERROR',{code:'MATCH_ALREADY_STARTED'});ws.close(1008,'Match underway');return;}
    let player=old;
    if(!player){
      if(data.players.length>=2){safeSend(ws,'ERROR',{code:'ROOM_FULL'});ws.close(1008,'Room full');return;}
      const seat=data.players.some(p=>p.seat===1)?2:1;
      player={playerId:crypto.randomUUID(),seat,name,character:payload.character,fighter:normalizeFighter(isFighterId(payload.fighter)?payload.fighter:null,payload.character),rune:'none',ready:false,tokenHash:hash,profileId:guestHash,reservedUntil:0};
      data.players.push(player);if(!data.hostPlayerId)data.hostPlayerId=player.playerId;
    }
    // Reclaim the same seat; disconnect a stale socket if one is still alive.
    for(const x of authenticated(this.ctx))if(x.session.playerId===player.playerId&&x.ws!==ws){
      x.ws.serializeAttachment({...x.session,verified:false});
      try{x.ws.close(4001,'Session resumed elsewhere');}catch{}
    }
    player.name=name;
    if(!player.profileId)player.profileId=guestHash; // legacy room seat: stable across rejoin
    // Preserve the player's chosen fighter when reclaiming a previous seat.
    player.reservedUntil=0;
    ws.serializeAttachment({...session,verified:true,playerId:player.playerId,seat:player.seat});
    await this.save(data);
    let match=['started','rematch_countdown'].includes(data.phase)?await this.ctx.storage.get('match'):null;
    if(match?.status==='paused'&&match.mode!=='arena'){
      const offline=data.players.filter(p=>!this.connectedIds().has(p.playerId)).map(p=>p.seat);
      const changed=offline.length===0?resumeMatch(match,Date.now()):pauseMatch(match,Date.now(),offline);
      if(changed!==match){match=changed;await this.ctx.storage.put('match',match);}
    }
    await this.schedule(data);
    safeSend(ws,'CONNECTED',{playerId:player.playerId,seat:player.seat,capacity:2,resumed:Boolean(old)});
    await this.publish(data);
    if(data.phase==='countdown'&&data.startAt)safeSend(ws,'COUNTDOWN',{startAt:data.startAt});
    if(data.phase==='rematch_countdown'&&data.startAt)safeSend(ws,'REMATCH_COUNTDOWN',{startAt:data.startAt});
    if(['started','rematch_countdown'].includes(data.phase)){
      match=match||await this.ctx.storage.get('match');
      if(match){
        if(match.status!=='ended')this.sendMatch(ws,'MATCH_START',{serverTime:Date.now(),resumed:true},match,player.seat);
        // Both clients need the same pause/resume status and exact clocks.
        this.broadcastMatch(match.status==='running'?'MATCH_RESUMED':match.status==='ended'?'MATCH_END':'MATCH_PAUSED',
          {serverTime:Date.now(),graceMs:REJOIN_GRACE},match);
        this.broadcastMatch('STATE_UPDATE',{serverTime:Date.now()},match);
        if(match.status==='ended')await this.recordResult(match);
        safeSend(ws,'MATCH_HISTORY',{results:await this.ctx.storage.get('results')||[]});
        this.broadcast('REMATCH_STATUS',{votes:data.rematchVotes||[],startAt:data.startAt});
      }
    }
  }
  async readyOrSelect(ws,type,payload,session){
    const data=await this.roster();const player=data.players.find(p=>p.playerId===session.playerId);
    if(!player)return safeSend(ws,'ERROR',{code:'UNKNOWN_PLAYER'});
    if(!['waiting','countdown'].includes(data.phase))return safeSend(ws,'ERROR',{code:'MATCH_STARTED'});
    if(type==='RUNE_SELECT'){
      if(!validateRune(payload.rune))return safeSend(ws,'ERROR',{code:'INVALID_RUNE'});
      player.rune=payload.rune;player.ready=false;
    }else if(type==='CHARACTER_SELECT'){
      if(!CHARACTERS.has(payload.character))return safeSend(ws,'ERROR',{code:'INVALID_CHARACTER'});
      player.character=payload.character;player.fighter=normalizeFighter(player.fighter,player.character);player.ready=false;
    }else if(type==='FIGHTER_SELECT'){
      // Paket 32: karakter seçimi arketipi (character) de belirler; yalnız kadro kimlikleri kabul edilir.
      if(!isFighterId(payload.fighter))return safeSend(ws,'ERROR',{code:'INVALID_FIGHTER'});
      player.fighter=payload.fighter;player.character=FIGHTERS[payload.fighter].archetype;player.ready=false;
    }else{
      if(typeof payload.ready!=='boolean')return safeSend(ws,'ERROR',{code:'INVALID_READY'});
      player.ready=payload.ready;
    }
    const online=this.connectedIds();
    const go=data.players.length===2&&data.players.every(p=>p.ready&&online.has(p.playerId));
    if(go&&data.phase!=='countdown'){
      data.phase='countdown';data.startAt=Date.now()+3000;
      await this.save(data);await this.schedule(data);
      await this.publish(data);this.broadcast('COUNTDOWN',{startAt:data.startAt});return;
    }
    if(!go&&data.phase==='countdown'){
      data.phase='waiting';data.startAt=null;
      this.broadcast('COUNTDOWN_CANCELLED',{reason:'Hazır durumu değişti'});
    }
    await this.save(data);await this.schedule(data);await this.publish(data);
  }
  async stateRequest(ws,session){
    const data=await this.roster();
    const match=await this.ctx.storage.get('match');
    if(!['started','rematch_countdown'].includes(data.phase)||!match)return safeSend(ws,'ERROR',{code:'MATCH_NOT_ACTIVE'});
    if(!match.participants.some(p=>p.playerId===session.playerId))return safeSend(ws,'ERROR',{code:'NOT_MATCH_PARTICIPANT'});
    // The client cannot mutate state. A snapshot is an idempotent operation.
    this.sendMatch(ws,'STATE_UPDATE',{serverTime:Date.now()},match,session.seat);
  }
  async recordResult(match){
    if(match?.status!=='ended')return;
    const previous=await this.ctx.storage.get('results')||[];
    const result=match.mode==='arena'?arenaMatchResult(match):matchResult(match);
    if(!previous.some(r=>r.matchId===match.id)){
      previous.unshift(result);
      await this.ctx.storage.put('results',previous.slice(0,20));
    }
    // Best-effort global sync is retried on later ended-state reads/alarms.
    // Never trust results provided by a WebSocket client.
    if(!this.env.PVP_PROFILES||await this.ctx.storage.get('globalSynced:'+match.id))return;
    const lobby=await this.roster();
    const profileIds=result.players.map(p=>lobby.players.find(x=>x.playerId===p.playerId)?.profileId);
    if(profileIds.some(id=>typeof id!=='string'||!/^[a-f0-9]{64}$/.test(id)))return;
    try{
      const stub=this.env.PVP_PROFILES.get(this.env.PVP_PROFILES.idFromName('tuslab-global-v1'));
      const res=await stub.fetch('https://profiles.internal/record',{method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({result,profileIds,ranked:false,trustedMatchmaking:false})});
      if(res.ok)await this.ctx.storage.put('globalSynced:'+match.id,true);
    }catch{/* preserve room result; retry on reconnect/alarms */}
  }
  async publishEnd(match,at=Date.now()){
    await this.recordResult(match);
    if(match.mode==='arena')this.broadcastMatch('ARENA_MATCH_END',{result:arenaMatchResult(match),serverTime:at},match);
    this.broadcastMatch('MATCH_END',{serverTime:at},match);
    this.broadcastMatch('STATE_UPDATE',{serverTime:at},match);
  }
  async rematchVote(ws,payload,session){
    const data=await this.roster();const match=await this.ctx.storage.get('match');
    if(!match||match.status!=='ended'||!['started','rematch_countdown'].includes(data.phase))
      return safeSend(ws,'ERROR',{code:'REMATCH_NOT_AVAILABLE'});
    if(!data.players.some(p=>p.playerId===session.playerId)||typeof payload.accept!=='boolean')
      return safeSend(ws,'ERROR',{code:'INVALID_REMATCH_VOTE'});
    const current=new Set(data.rematchVotes||[]);
    if(payload.accept)current.add(session.playerId);else current.delete(session.playerId);
    data.rematchVotes=[...current];
    const allReady=data.players.length===2&&data.players.every(p=>current.has(p.playerId)&&this.connectedIds().has(p.playerId));
    if(allReady&&data.phase!=='rematch_countdown'){
      data.phase='rematch_countdown';data.startAt=Date.now()+3000;
      this.broadcast('REMATCH_COUNTDOWN',{startAt:data.startAt});
    }else if(!allReady&&data.phase==='rematch_countdown'){
      data.phase='started';data.startAt=null;
      this.broadcast('REMATCH_CANCELLED',{reason:'Rövanş hazır durumu değişti'});
    }
    await this.save(data);await this.schedule(data);
    this.broadcast('REMATCH_STATUS',{votes:data.rematchVotes,startAt:data.startAt});
    await this.publish(data);
  }
  async surrender(ws,session){
    const lobby=await this.roster();const match=await this.ctx.storage.get('match');
    if(lobby.phase!=='started'||!match||!['running','paused'].includes(match.status))
      return safeSend(ws,'ERROR',{code:'MATCH_NOT_ACTIVE'});
    const player=match.participants.find(p=>p.playerId===session.playerId);
    if(!player)return safeSend(ws,'ERROR',{code:'NOT_MATCH_PARTICIPANT'});
    const ended=match.mode==='arena'?surrenderArenaMatch(match,player.seat,Date.now()):surrenderMatch(match,player.seat,Date.now());
    await this.ctx.storage.put('match',ended);await this.publishEnd(ended);await this.schedule(lobby);
  }
  broadcastCombat(events){
    for(const event of events){this.broadcast(event.type,{event});}
  }
  broadcastRound(roundEvents,match,now){
    for(const {type,payload} of roundEvents)for(const {ws,session} of authenticated(this.ctx)){
      const view=snapshot(match,session.seat);
      this.sendMatch(ws,type,{...payload,...(view.blindClock?{
        ...(Object.hasOwn(payload,'endsAt')?{endsAt:null}:{}),
        ...(Object.hasOwn(payload,'startedAt')?{startedAt:null}:{})}:{}),serverTime:now},match,session.seat);
    }
  }
  /** Persists and broadcasts one advanceMatch step. Returns the (possibly unchanged) match. */
  async applyAdvance(previous,step,now,{stateUpdate=true}={}){
    if(step.match===previous)return previous;
    await this.ctx.storage.put('match',step.match);
    if(step.events.length)this.broadcastCombat(step.events);
    if(step.roundEvents.length)this.broadcastRound(step.roundEvents,step.match,now);
    if(step.match.status==='ended'&&previous.status!=='ended')await this.publishEnd(step.match,now);
    else if(stateUpdate)this.broadcastMatch('STATE_UPDATE',{serverTime:now},step.match);
    return step.match;
  }
  async applyArenaAdvance(previous,step,now,{stateUpdate=true}={}){
    if(step.match===previous)return previous;
    await this.ctx.storage.put('match',step.match);
    for(const event of step.events)if(event.type==='ARENA_ATTACK')this.broadcast(event.type,{event});
    if(step.roundEvents.length)this.broadcastArenaRounds(step.roundEvents.filter(e=>e.type!=='ARENA_MATCH_END'),step.match,now);
    if(step.match.status==='ended'&&previous.status!=='ended')await this.publishEnd(step.match,now);
    else if(stateUpdate)this.broadcastMatch('STATE_UPDATE',{serverTime:now},step.match);
    return step.match;
  }
  async arenaPick(ws,payload,session){
    const lobby=await this.roster();let match=await this.ctx.storage.get('match');
    if(lobby.phase!=='started'||match?.mode!=='arena')return safeSend(ws,'ERROR',{code:'MATCH_NOT_ACTIVE'});
    const now=Date.now();match=await this.applyArenaAdvance(match,advanceArenaMatch(match,now),now);
    if(Object.keys(payload).length!==2||!Object.hasOwn(payload,'skill')||!Object.hasOwn(payload,'item')||
      (payload.skill!==null&&typeof payload.skill!=='string')||
      (payload.item!==null&&typeof payload.item!=='string'))return safeSend(ws,'ERROR',{code:'INVALID_ARENA_PICK'});
    const outcome=submitArenaPick(match,{playerId:session.playerId,skill:payload.skill??null,item:payload.item??null},now);
    if(outcome.error)return safeSend(ws,'ERROR',{code:outcome.error});
    await this.ctx.storage.put('match',outcome.match);
    this.sendMatch(ws,'ARENA_PICK_ACK',{seat:outcome.result.seat,skill:outcome.result.skill,item:outcome.result.item,serverTime:now},outcome.match,session.seat);
    const step=advanceArenaMatch(outcome.match,now);
    if(step.match===outcome.match)this.broadcastMatch('STATE_UPDATE',{serverTime:now},outcome.match);
    else await this.applyArenaAdvance(outcome.match,step,now);
    await this.schedule(lobby);
  }
  async roundSkillPick(ws,payload,session){
    const lobby=await this.roster();let match=await this.ctx.storage.get('match');
    if(lobby.phase!=='started'||match?.mode!=='rounds')return safeSend(ws,'ERROR',{code:'MATCH_NOT_ACTIVE'});
    const now=Date.now();match=await this.applyAdvance(match,advanceMatch(match,now),now);
    if(Object.keys(payload).length!==1||!Object.hasOwn(payload,'skill'))return safeSend(ws,'ERROR',{code:'INVALID_ROUND_SKILL'});
    const outcome=pickRoundSkill(match,{playerId:session.playerId,skill:payload.skill},now);
    if(outcome.error)return safeSend(ws,'ERROR',{code:outcome.error});
    await this.ctx.storage.put('match',outcome.match);
    this.sendMatch(ws,'ROUND_SKILL_ACK',{...outcome.result,serverTime:now},outcome.match,session.seat);
    await this.schedule(lobby);
  }
  async arenaWordSubmit(ws,payload,session,lobby,match){
    // Önceki ilerletme 1 ms geriden: raundun tam bitiş anında gelen kelime (aynı ms'de çifte bitiş) kabul edilir.
    const now=Date.now();match=await this.applyArenaAdvance(match,advanceArenaMatch(match,now-1),now);
    if(match.status!=='running'){await this.schedule(lobby);return safeSend(ws,'ERROR',{code:'MATCH_NOT_ACTIVE'});}
    const outcome=submitArenaWord(match,{matchId:payload.matchId,wordIndex:payload.wordIndex,text:payload.text,round:payload.round,playerId:session.playerId},now);
    if(outcome.error){safeSend(ws,'WORD_RESULT',{accepted:false,code:outcome.error,expectedIndex:outcome.expectedIndex??null,matchId:match.id,
      ...(outcome.round!==undefined?{round:outcome.round}:{})});await this.schedule(lobby);return;}
    await this.ctx.storage.put('match',outcome.match);
    this.sendMatch(ws,'WORD_RESULT',{...outcome.result,serverTime:now},outcome.match,session.seat);
    const step=advanceArenaMatch(outcome.match,now);
    if(step.match===outcome.match)this.broadcastMatch('STATE_UPDATE',{serverTime:now},outcome.match);
    else await this.applyArenaAdvance(outcome.match,step,now);
    await this.schedule(lobby);
  }
  async wordSubmit(ws,payload,session){
    const lobby=await this.roster();
    let match=await this.ctx.storage.get('match');
    if(lobby.phase!=='started'||!match)return safeSend(ws,'ERROR',{code:'MATCH_NOT_ACTIVE'});
    if(match.mode==='arena')return this.arenaWordSubmit(ws,payload,session,lobby,match);
    // All message handlers are queued by the room; never mutate outside this queue.
    if(match.status==='paused')return safeSend(ws,'ERROR',{code:'MATCH_PAUSED'});
    const now=Date.now();
    // Apply every overdue transition first (late word after the round/match closed is rejected below).
    match=await this.applyAdvance(match,advanceMatch(match,now),now);
    if(match.status!=='running'){await this.schedule(lobby);return safeSend(ws,'ERROR',{code:'MATCH_NOT_ACTIVE'});}
    const outcome=submitWord(match,{matchId:payload.matchId,wordIndex:payload.wordIndex,text:payload.text,round:payload.round,playerId:session.playerId},now);
    if(outcome.error){
      safeSend(ws,'WORD_RESULT',{accepted:false,code:outcome.error,expectedIndex:outcome.expectedIndex??null,matchId:match.id,
        ...(outcome.round!==undefined?{round:outcome.round}:{})});
      await this.schedule(lobby);return;
    }
    await this.ctx.storage.put('match',outcome.match);
    const {roundEvents=[],...result}=outcome.result;
    this.sendMatch(ws,'WORD_RESULT',{...result,serverTime:now},outcome.match,session.seat);
    if(outcome.result.cast)this.broadcastCombat([outcome.result.cast]);
    if(outcome.result.assistCast)this.broadcastCombat([outcome.result.assistCast]);
    if(roundEvents.length)this.broadcastRound(roundEvents,outcome.match,now);
    // Both players finished → the round closes immediately (ALL_DONE) when nothing is in flight.
    const step=advanceMatch(outcome.match,now);
    if(step.match===outcome.match)this.broadcastMatch('STATE_UPDATE',{serverTime:now},outcome.match);
    else await this.applyAdvance(outcome.match,step,now);
    await this.schedule(lobby);
  }
  async matchConfig(ws,session,payload){
    const data=await this.roster();
    if(!['waiting','countdown'].includes(data.phase))return safeSend(ws,'ERROR',{code:'MATCH_STARTED'});
    if((data.hostPlayerId||data.players[0]?.playerId)!==session.playerId)return safeSend(ws,'ERROR',{code:'HOST_ONLY'});
    const keys=Object.keys(payload);
    if(keys.length===1&&keys[0]==='typing'){
      // Paket 30: yazma kuralları (büyük/küçük harf, noktalama). Yalnız iki boolean kabul edilir.
      if(!isTypingPayload(payload.typing))return safeSend(ws,'ERROR',{code:'INVALID_MATCH_CONFIG'});
      data.typing=normalizeTyping({...normalizeTyping(data.typing),...payload.typing});
    }else if(keys.length===1&&keys[0]==='assist'){
      // Paket 31: partner desteği açık/kapalı. Yalnız boolean kabul edilir; bar ve tetikleme istemciden gelmez.
      if(!isAssistPayload(payload.assist))return safeSend(ws,'ERROR',{code:'INVALID_MATCH_CONFIG'});
      data.assist=payload.assist;
    }else if(keys.length===1&&keys[0]==='stage'){
      // Paket 33: sahne seçimi. Yalnız bilinen sahne kimliği ya da 'random' kabul edilir; 'random' maç başında çözülür.
      if(!isStageChoicePayload(payload.stage))return safeSend(ws,'ERROR',{code:'INVALID_MATCH_CONFIG'});
      data.stage=payload.stage;
    }else if(payload.mode===undefined){
      if(keys.length!==1||!ROUND_OPTIONS.includes(payload.rounds))return safeSend(ws,'ERROR',{code:'INVALID_ROUNDS'});
      data.mode='rounds';data.rounds=payload.rounds;
    }else if(payload.mode==='rounds'){
      if(!keys.every(k=>['mode','rounds'].includes(k))||!ROUND_OPTIONS.includes(payload.rounds))return safeSend(ws,'ERROR',{code:'INVALID_ROUNDS'});
      data.mode='rounds';data.rounds=payload.rounds;
    }else if(payload.mode==='arena'||payload.mode==='classic'){
      if(keys.length!==1)return safeSend(ws,'ERROR',{code:'INVALID_MATCH_CONFIG'});
      data.mode=payload.mode;
    }else return safeSend(ws,'ERROR',{code:'INVALID_MATCH_CONFIG'});
    for(const p of data.players)p.ready=false;
    if(data.phase==='countdown'){
      data.phase='waiting';data.startAt=null;
      this.broadcast('COUNTDOWN_CANCELLED',{reason:'Maç ayarı değişti'});
    }
    await this.save(data);await this.schedule(data);await this.publish(data);
  }
  startMatch(data,now,extra={}){
    const typing=normalizeTyping(data.typing);
    const assist=normalizeAssist(data.assist); // paket 31: yalnız klasik + tur modunda; arenada kapalı
    const stage=pickStage(normalizeStageChoice(data.stage)); // paket 33: 'random' her maç başında somut sahneye çözülür
    const match=roomMode(data)==='arena'?createArenaMatch(data.players,now,undefined,{typing,stage}):
      createMatch(data.players,now,undefined,roomMode(data)==='classic'?{exchangeMs:10000,typing,assist,stage}:{rounds:roomRounds(data),resolveAtEnd:true,typing,assist,stage});
    return {match,announce:()=>{
      this.broadcastMatch('MATCH_START',{serverTime:now,...extra},match);
      if(match.mode==='arena'){
        this.broadcastArenaRounds([{type:'ARENA_PREP_START',payload:{round:1,endsAt:match.round.endsAt}}],match,now);
        return;
      }
      const round=roundStartPayload(match);
      if(round)this.broadcastMatch('ROUND_START',{...round,serverTime:now},match);
      else if(match.exchange)this.broadcastMatch('EXCHANGE_START',{index:match.exchange.index,endsAt:match.exchange.endsAt,serverTime:now},match);
    }};
  }
  async leave(ws,session,explicit){
    const data=await this.roster();const p=data.players.find(p=>p.playerId===session.playerId);
    if(!p)return;
    const now=Date.now();
    const match=data.phase==='started'?await this.ctx.storage.get('match'):null;
    if(match?.status==='running'||match?.status==='paused'){
      p.ready=false;
      p.reservedUntil=now+REJOIN_GRACE;
      // Deliberately leaving an active duel is an immediate surrender, not a reconnect timeout.
      let next;
      if(match.mode==='arena'){
        next=explicit?surrenderArenaMatch(match,p.seat,now):match;
      }else if(explicit){
        const offline=[p.seat,...data.players.filter(x=>x.playerId!==p.playerId&&!this.connectedIds().has(x.playerId)).map(x=>x.seat)];
        next=endDisconnectedMatch(pauseMatch(match,now,offline),now,offline.length===2?null:p.seat);
      }else{
        const offline=data.players.filter(x=>!this.connectedIds().has(x.playerId)).map(x=>x.seat);
        next=pauseMatch(match,now,offline);
      }
      await this.ctx.storage.put('match',next);
      if(next.status==='ended')await this.recordResult(next);
      await this.save(data);await this.schedule(data);
      await this.publish(data);
      if(match.mode==='arena'){
        if(next.status==='ended')await this.publishEnd(next,now);
        else this.broadcastMatch('STATE_UPDATE',{serverTime:now,graceMs:REJOIN_GRACE},next);
      }else{
        this.broadcastMatch(next.status==='ended'?'MATCH_END':'MATCH_PAUSED',{serverTime:now,graceMs:REJOIN_GRACE},next);
        this.broadcastMatch('STATE_UPDATE',{serverTime:now},next);
      }
      return;
    }
    if(explicit){data.players=data.players.filter(x=>x.playerId!==p.playerId);if(data.hostPlayerId===p.playerId)data.hostPlayerId=data.players[0]?.playerId||null;}
    else{p.ready=false;p.reservedUntil=now+REJOIN_GRACE;}
    if(data.phase==='rematch_countdown'){data.phase='started';data.startAt=null;data.rematchVotes=[];
      this.broadcast('REMATCH_CANCELLED',{reason:'Oyuncu ayrıldı'});}
    if(data.phase==='countdown'){
      data.phase='waiting';data.startAt=null;
      this.broadcast('COUNTDOWN_CANCELLED',{reason:'Oyuncu ayrıldı'});
    }
    await this.save(data);await this.schedule(data);await this.publish(data);
  }
  async hostAction(ws,session,type,payload){
    const data=await this.roster();
    if(!['waiting','countdown'].includes(data.phase))return safeSend(ws,'ERROR',{code:'MATCH_STARTED'});
    if((data.hostPlayerId||data.players[0]?.playerId)!==session.playerId)return safeSend(ws,'ERROR',{code:'HOST_ONLY'});
    if(type==='HOST_KICK'){
      const target=data.players.find(p=>p.playerId===payload.playerId&&p.playerId!==session.playerId);
      if(!target)return safeSend(ws,'ERROR',{code:'INVALID_TARGET'});
      data.players=data.players.filter(p=>p.playerId!==target.playerId);
      if(data.phase==='countdown'){
        data.phase='waiting';data.startAt=null;
        this.broadcast('COUNTDOWN_CANCELLED',{reason:'Oyuncu çıkarıldı'});
      }
      for(const {ws:peer,session:s} of authenticated(this.ctx))if(s.playerId===target.playerId){
        safeSend(peer,'ROOM_KICKED',{reason:'Oda yöneticisi seni çıkardı'});
        peer.serializeAttachment({...s,verified:false});
        try{peer.close(4003,'Kicked by host');}catch{}
      }
      await this.save(data);await this.publish(data);await this.schedule(data);
    }else if(type==='HOST_CLOSE'){
      this.broadcast('ROOM_CLOSED',{reason:'Oda sahibi odayı kapattı'});
      for(const {ws:peer,session:s} of authenticated(this.ctx)){
        peer.serializeAttachment({...s,verified:false});
        try{peer.close(4004,'Room closed');}catch{}
      }
      await this.ctx.storage.deleteAll();
    }
  }
  async webSocketMessage(ws,message){
    const session=ws.deserializeAttachment();if(!session)return ws.close(1008,'Unknown session');
    if(typeof message!=='string'||new TextEncoder().encode(message).length>MAX_BYTES)return ws.close(1009,'Message too large');
    // All frames, including invalid pings, consume an aggregate abuse budget.
    const frameNow=Date.now();
    if(!session.rawWindowAt||frameNow-session.rawWindowAt>WINDOW){session.rawWindowAt=frameNow;session.rawCount=0;}
    session.rawCount=(session.rawCount||0)+1;
    ws.serializeAttachment(session);
    if(session.rawCount>MAX_RAW_EVENTS){
      safeSend(ws,'ERROR',{code:'RATE_LIMIT'});
      try{ws.close(1008,'Rate limit');}catch{}
      return;
    }
    let data;try{data=JSON.parse(message);}catch{return safeSend(ws,'ERROR',{code:'INVALID_JSON'});}
    if(!data||data.version!==VERSION||typeof data.type!=='string'||!data.payload||typeof data.payload!=='object'||Array.isArray(data.payload))return safeSend(ws,'ERROR',{code:'INVALID_ENVELOPE'});
    if(data.type==='PING'){
      const now=Date.now();
      if(typeof data.payload.nonce!=='string'||!/^[a-zA-Z0-9-]{8,40}$/.test(data.payload.nonce))
        return safeSend(ws,'ERROR',{code:'INVALID_PROBE'});
      // Application probes are intentionally exempt from the word-message limiter,
      // but throttled separately to prevent unlimited PONG amplification.
      if(session.lastProbeAt&&now-session.lastProbeAt<400)return;
      session.lastProbeAt=now;ws.serializeAttachment(session);
      const receiveTime=now;
      return safeSend(ws,'PONG',{nonce:data.payload.nonce,receivedAt:receiveTime,sentAt:Date.now()});
    }
    const now=Date.now();if(now-session.windowAt>WINDOW){session.windowAt=now;session.count=0;}
    session.count++;ws.serializeAttachment(session);
    if(session.count>MAX_EVENTS)return safeSend(ws,'ERROR',{code:'RATE_LIMIT'});
    if(!session.verified){if(data.type!=='JOIN')return safeSend(ws,'ERROR',{code:'JOIN_REQUIRED'});return this.enqueue(()=>this.join(ws,data.payload,session));}
    if(data.type==='HOST_KICK'||data.type==='HOST_CLOSE')return this.enqueue(()=>this.hostAction(ws,session,data.type,data.payload));
    if(data.type==='MATCH_CONFIG')return this.enqueue(()=>this.matchConfig(ws,session,data.payload));
    if(data.type==='READY_SET'||data.type==='CHARACTER_SELECT'||data.type==='FIGHTER_SELECT'||data.type==='RUNE_SELECT')return this.enqueue(()=>this.readyOrSelect(ws,data.type,data.payload,session));
    if(data.type==='STATE_REQUEST')return this.enqueue(()=>this.stateRequest(ws,session));
    if(data.type==='ARENA_PICK')return this.enqueue(()=>this.arenaPick(ws,data.payload,session));
    if(data.type==='ROUND_SKILL_PICK')return this.enqueue(()=>this.roundSkillPick(ws,data.payload,session));
    if(data.type==='WORD_SUBMIT')return this.enqueue(()=>this.wordSubmit(ws,data.payload,session));
    if(data.type==='REMATCH_VOTE')return this.enqueue(()=>this.rematchVote(ws,data.payload,session));
    if(data.type==='SURRENDER')return this.enqueue(()=>this.surrender(ws,session));
    if(SERVER_ONLY_EVENTS.has(data.type)||ARENA_SERVER_ONLY_EVENTS.has(data.type))return safeSend(ws,'ERROR',{code:'SERVER_ONLY_EVENT'});
    if(data.type==='LEAVE'){
      ws.serializeAttachment({...session,verified:false});
      await this.enqueue(()=>this.leave(ws,session,true));ws.close(1000,'Left lobby');return;
    }
    if(data.type==='PEER_MESSAGE'){
      const text=data.payload.text;
      if(typeof text!=='string'||!text.trim()||text.length>140)return safeSend(ws,'ERROR',{code:'INVALID_PEER_MESSAGE'});
      let delivered=0;
      for(const x of authenticated(this.ctx))if(x.ws!==ws){safeSend(x.ws,'PEER_MESSAGE',{from:session.playerId,seat:session.seat,text});delivered++;}
      safeSend(ws,'PEER_ACK',{deliveredTo:delivered});return;
    }
    safeSend(ws,'ERROR',{code:'UNSUPPORTED_MESSAGE',type:data.type.slice(0,40)});
  }
  async webSocketClose(ws){
    const s=ws.deserializeAttachment();
    if(s?.verified)ws.serializeAttachment({...s,verified:false});
    try{ws.close(1000,'Closed');}catch{}
    if(s?.verified)await this.enqueue(()=>this.leave(ws,s,false));
  }
  async webSocketError(ws){
    const s=ws.deserializeAttachment();
    if(s?.verified)ws.serializeAttachment({...s,verified:false});
    try{ws.close(1011,'Socket error');}catch{}
    if(s?.verified)await this.enqueue(()=>this.leave(ws,s,false));
  }
  async alarm(){return this.enqueue(()=>this.runAlarm());}
  async runAlarm(){
    const data=await this.roster();if(data.phase!=='started')this.prune(data);
    if(data.phase==='rematch_countdown'){
      const online=this.connectedIds(),votes=new Set(data.rematchVotes||[]);
      if(data.players.length===2&&data.players.every(p=>votes.has(p.playerId)&&online.has(p.playerId))&&Date.now()>=data.startAt){
        const old=await this.ctx.storage.get('match');
        if(old?.status!=='ended'){data.phase='started';data.startAt=null;await this.save(data);}
        else{
          await this.recordResult(old);
          // Rematch: new id and seed (new words), same round count.
          const fresh=this.startMatch(data,Date.now(),{rematch:true});
          await this.ctx.storage.put('match',fresh.match);
          data.phase='started';data.startAt=null;data.rematchVotes=[];
          await this.save(data);fresh.announce();
          await this.publish(data);
        }
      }else if(Date.now()<data.startAt&&data.players.every(p=>online.has(p.playerId))){await this.schedule(data);return;}
      else{data.phase='started';data.startAt=null;data.rematchVotes=[];await this.save(data);
        this.broadcast('REMATCH_CANCELLED',{reason:'Oyuncu ayrıldı veya onay iptal edildi'});await this.publish(data);}
    }else if(data.phase==='countdown'){
      const online=this.connectedIds();
      if(data.players.length===2&&data.players.every(p=>p.ready&&online.has(p.playerId))&&Date.now()>=data.startAt){
        data.phase='started';data.startAt=null;
        // Exactly one match is created by the serialized, at-least-once alarm.
        let match=await this.ctx.storage.get('match');
        let announce;
        if(!match){const fresh=this.startMatch(data,Date.now());match=fresh.match;announce=fresh.announce;await this.ctx.storage.put('match',match);}
        await this.save(data);
        if(announce)announce();
        else{
          const now=Date.now();this.broadcastMatch('MATCH_START',{serverTime:now},match);
          if(match.mode==='arena')this.broadcastArenaRounds([{type:'ARENA_PREP_START',payload:{round:match.round.index,endsAt:match.round.endsAt}}],match,now);
          else{
            const round=match.status==='running'&&match.round?.phase==='round'?roundStartPayload(match):null;
            if(round)this.broadcastMatch('ROUND_START',{...round,serverTime:now},match);
            else if(match.exchange)this.broadcastMatch('EXCHANGE_START',{index:match.exchange.index,endsAt:match.exchange.endsAt,serverTime:now},match);
          }
        }
        await this.publish(data);
      } else if(Date.now()<data.startAt){await this.schedule(data);return;}
      else {data.phase='waiting';data.startAt=null;await this.save(data);await this.publish(data);}
    } else if(data.phase==='started'){
      const stored=await this.ctx.storage.get('match');
      if(stored?.status==='paused'){
        const now=Date.now();const online=this.connectedIds();
        const offline=data.players.filter(p=>!online.has(p.playerId));
        let updated=stored;
        if(!offline.length)updated=resumeMatch(stored,now);
        else if(offline.some(p=>p.reservedUntil>0&&p.reservedUntil<=now)){
          updated=endDisconnectedMatch(stored,now,offline.length===2?null:offline[0].seat);
        }
        if(updated!==stored){
          await this.ctx.storage.put('match',updated);
          if(updated.status==='ended')await this.publishEnd(updated,now);
          else{this.broadcastMatch('MATCH_RESUMED',{serverTime:now,graceMs:REJOIN_GRACE},updated);
            this.broadcastMatch('STATE_UPDATE',{serverTime:now},updated);}
        }
      }else if(stored?.status==='running'){
        // Deferred attacks and round transitions always run from persisted state, including after hibernation.
        const now=Date.now();
        if(stored.mode==='arena')await this.applyArenaAdvance(stored,advanceArenaMatch(stored,now),now);
        else await this.applyAdvance(stored,advanceMatch(stored,now),now);
      }
    } else await this.save(data);
    const latest=data.phase==='started'?await this.ctx.storage.get('match'):null;
    if(latest?.status==='ended')await this.recordResult(latest);
    if(latest?.status==='ended'&&!active(this.ctx).length&&Date.now()>=latest.endedAt+ROOM_TTL){
      await this.ctx.storage.deleteAll();return;
    }
    if(active(this.ctx).length||data.players.length)await this.schedule(data);
    else await this.ctx.storage.deleteAll();
  }
}
export {normalizeName};
