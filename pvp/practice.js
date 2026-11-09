/** TuşLab PvP — offline "Bota Karşı Antrenman" (practice vs bot).
 *
 * Runs the REAL match engine (pvp/shared/match.js, the same module the
 * Cloudflare Durable Object uses) inside the browser and mirrors what
 * cloudflare/src/room.js does on the server:
 *
 *   - createMatch() for a human and a bot seat,
 *   - a tick loop that calls advanceMatch() at each engine deadline,
 *   - WORD_SUBMIT handling exactly like PvPRoom.wordSubmit(),
 *   - SURRENDER / REMATCH_VOTE / LEAVE / STATE_REQUEST messages,
 *   - outgoing packets in the exact server envelope
 *     {version, type, payload, serverTime, matchId, sequence, eventId}.
 *
 * Because the packets are identical, pvp/network.js feeds them into its normal
 * `receive()` path and every HUD / FX / result listener keeps working.
 *
 * Nothing here touches the network, /api endpoints, profiles or Elo.
 * All time, randomness and timers are injectable so tests are deterministic.
 */
import {createMatch,submitWord,advanceMatch,nextDeadline,roundStartPayload,pickRoundSkill,ROUND_TIME_SKILLS,normalizeRounds as engineNormalizeRounds,surrenderMatch,publicMatch} from './shared/match.js';
import {normalizeTyping} from './shared/typing-rules.js';
import {createArenaMatch,submitArenaPick,submitArenaWord,advanceArenaMatch,nextArenaDeadline,arenaPublicMatch,surrenderArenaMatch} from './shared/arena.js';
import {ARENA_SKILL_IDS} from './shared/arena-skills.js';
import {ARENA_ITEM_IDS} from './shared/arena-damage.js';

/** Protocol version used by the real server envelope (room.js VERSION). */
const VERSION=1;
/** Combat event types the server broadcasts one-by-one (room.broadcastCombat). */
const COMBAT_TYPES=new Set(['SKILL_CAST','SHIELD_TRIGGERED','PARRY_TRIGGERED','COUNTERATTACK_CAST','SHIELD_BROKEN','ULTIMATE_PHASE','DAMAGE_APPLIED','RUNE_TRIGGERED','WORD_CLASH']);
/** Snapshot carrying message types (forwarded to onMatch). */
const MATCH_TYPES=new Set(['MATCH_START','STATE_UPDATE','MATCH_END']);

export const HUMAN_ID='practice-human';
export const BOT_ID='practice-bot';
/** Rematch countdown, identical to the server's 3-2-1. */
export const PRACTICE_REMATCH_DELAY_MS=3000;

/** Bot typing profiles.
 *  wpm     – target speed (5 chars = 1 word, the space counts as a char)
 *  jitter  – ± relative randomness of each word's typing time
 *  typo    – chance that a submitted word is wrong (resets the bot's combo)
 *  pause   – chance of a short "thinking" hesitation and its range in ms
 */
export const BOT_DIFFICULTIES=Object.freeze({
  kolay:Object.freeze({id:'kolay',label:'Kolay',wpm:25,jitter:.35,typo:.10,pause:.15,pauseMs:[500,1400],startDelayMs:[900,1500]}),
  orta: Object.freeze({id:'orta', label:'Orta', wpm:45,jitter:.25,typo:.06,pause:.10,pauseMs:[300,900],startDelayMs:[600,1100]}),
  zor:  Object.freeze({id:'zor',  label:'Zor',  wpm:70,jitter:.18,typo:.03,pause:.06,pauseMs:[200,600],startDelayMs:[400,800]})
});
export const normalizeDifficulty=value=>Object.hasOwn(BOT_DIFFICULTIES,String(value||'').toLowerCase())?String(value).toLowerCase():'orta';
export const normalizeRounds=engineNormalizeRounds;

/** Default timer implementation (browser / Node globals). */
const defaultScheduler={
  setTimeout:(fn,ms)=>globalThis.setTimeout(fn,ms),
  clearTimeout:id=>globalThis.clearTimeout(id),
  setInterval:(fn,ms)=>globalThis.setInterval(fn,ms),
  clearInterval:id=>globalThis.clearInterval(id)
};
const defaultId=()=>globalThis.crypto?.randomUUID?.()??`practice-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

/** Time (ms) a bot with `profile` needs to type `word` + the space after it. */
export function botWordDelay(word,profile,rng=Math.random){
  const chars=[...String(word)].length+1;
  const base=chars*60_000/(profile.wpm*5);
  let delay=base*(1+profile.jitter*(rng()*2-1));
  if(rng()<profile.pause){const [lo,hi]=profile.pauseMs;delay+=lo+rng()*(hi-lo);}
  // The engine rejects submissions < 55 ms apart (WORD_BURST_LIMIT).
  return Math.max(80,Math.round(delay));
}
/** Produce a plausible typo that is guaranteed to differ from `word`. */
export function makeTypo(word,rng=Math.random){
  const chars=[...word];
  if(chars.length<2)return word+'x';
  const i=Math.floor(rng()*(chars.length-1));
  const kind=rng();
  if(kind<.4){[chars[i],chars[i+1]]=[chars[i+1],chars[i]];}          // swapped letters
  else if(kind<.7){chars.splice(i,1);}                                // dropped letter
  else{chars[i]=chars[i]==='a'?'s':'a';}                              // wrong key
  const typo=chars.join('');
  return typo===word||!typo?word+'x':typo;
}

/**
 * Create an offline practice session.
 * @param {object} o
 * @param {(packet:object)=>void} [o.onPacket]   every outgoing packet, server envelope shape
 * @param {(event:object)=>void}  [o.onCombat]   each combat event (once, increasing id)
 * @param {(msg:{type,match,serverTime})=>void} [o.onMatch] MATCH_START / STATE_UPDATE / MATCH_END snapshots
 * @param {(result:object)=>void} [o.onWordResult] WORD_RESULT for the human's submissions
 * @param {'kolay'|'orta'|'zor'} [o.difficulty='orta']
 * @param {5|7|10} [o.rounds=5] number of rounds, also kept for rematches
 * @param {'fire'|'rune'} [o.character='fire'] human fighter; fire = seat 1 (left), rune = seat 2 (right)
 * @param {string} [o.rune='none'] human rune; the bot always plays classic
 * @param {string} [o.name='Savaşçı']
 * @param {()=>number} [o.rng=Math.random]
 * @param {()=>number} [o.now=Date.now]
 * @param {{setTimeout,clearTimeout,setInterval,clearInterval}} [o.scheduler]
 * @param {number} [o.tickMs=50] attack resolution / time limit check period
 * @param {()=>string} [o.createId] match id factory (UUID by default)
 */
export function createPracticeSession(o={}){
  if(o.mode==='arena')return createArenaPracticeSession(o);
  const classic=o.mode==='classic';
  const rng=o.rng||Math.random;
  const now=o.now||(()=>Date.now());
  const scheduler=o.scheduler||defaultScheduler;
  const tickMs=Math.max(10,o.tickMs||50);
  const createId=o.createId||defaultId;
  const difficulty=normalizeDifficulty(o.difficulty);
  const profile=BOT_DIFFICULTIES[difficulty];
  const rounds=normalizeRounds(o.rounds);
  const typing=normalizeTyping(o.typing); // paket 30: büyük/küçük harf + noktalama kuralları
  const character=o.character==='rune'?'rune':'fire';
  // The arena paints seat 1 on the fire (left) side and seat 2 on the rune
  // (right) side, so the human's seat follows the chosen fighter.
  const humanSeat=character==='fire'?1:2;
  const botSeat=humanSeat===1?2:1;
  const players=[
    {playerId:HUMAN_ID,seat:humanSeat,name:String(o.name||'Savaşçı').slice(0,20),character,rune:o.rune||'none'},
    {playerId:BOT_ID,seat:botSeat,name:`Bot · ${profile.label}`,character:character==='fire'?'rune':'fire',rune:'none'}
  ].sort((a,b)=>a.seat-b.seat);

  let match=null;                // authoritative internal state (like DO storage 'match')
  let tickTimer=null,botTimer=null,rematchTimer=null;
  let disposed=false;
  let lastEmittedCombatId=0;
  let rematchVotes=[];
  let rematchRevision=0;          // REMATCH_* paketleri için benzersiz eventId revizyonu
  const history=[];

  // ---- output: same envelope as room.js `wrap()` -------------------------
  function emit(type,payload={}){
    if(disposed)return;
    const at=now();
    const m=payload.match;
    const suffix=(type.startsWith('ROUND_')&&Number.isInteger(payload.round)?`:r${payload.round}`:'')+(type.startsWith('REMATCH_')?`:v${++rematchRevision}`:'');
    const meta=m?.matchId?{matchId:m.matchId,sequence:m.sequence,eventId:`${m.matchId}:${m.sequence}:${type}${suffix}`}:{};
    const packet={version:VERSION,type,payload,serverTime:at,...meta};
    o.onPacket?.(packet);
    if(MATCH_TYPES.has(type))o.onMatch?.({type,match:m,serverTime:at});
    else if(type==='WORD_RESULT')o.onWordResult?.(payload);
  }
  /** room.broadcastCombat — one packet per event, ids strictly increasing. */
  function broadcastCombat(events){
    for(const event of events){
      if(event.id<=lastEmittedCombatId)continue;
      lastEmittedCombatId=event.id;
      emit(event.type,{event});
      if(!disposed&&COMBAT_TYPES.has(event.type))o.onCombat?.(event);
    }
  }
  /** room.broadcastRound uses one public snapshot for every event in a step. */
  function broadcastRound(roundEvents,at){
    const pub=snapshot();
    for(const {type,payload} of roundEvents)emit(type,{...payload,...(pub.blindClock?{
      ...(Object.hasOwn(payload,'endsAt')?{endsAt:null}:{}),
      ...(Object.hasOwn(payload,'startedAt')?{startedAt:null}:{})}:{}),match:pub,serverTime:at});
  }
  const snapshot=()=>publicMatch(match,humanSeat);
  function stopTimers(){
    if(tickTimer!==null){scheduler.clearInterval(tickTimer);tickTimer=null;}
    if(botTimer!==null){scheduler.clearTimeout(botTimer);botTimer=null;}
    if(rematchTimer!==null){scheduler.clearTimeout(rematchTimer);rematchTimer=null;}
  }
  /** room.publishEnd — final snapshot, local history, bot instantly wants a rematch. */
  function publishEnd(at){
    stopTimers();
    const pub=snapshot();
    if(pub.result&&!history.some(r=>r.matchId===pub.result.matchId))history.unshift(pub.result);
    emit('MATCH_END',{match:pub,serverTime:at});
    emit('STATE_UPDATE',{match:pub,serverTime:at});
    emit('MATCH_HISTORY',{results:history.slice(0,20)});
    rematchVotes=[BOT_ID];
    emit('REMATCH_STATUS',{votes:[...rematchVotes],startAt:null});
  }

  // ---- match life-cycle ---------------------------------------------------
  function startMatch(rematch=false){
    stopTimers();
    const at=now();
    const id=createId();
    // Local seed comes from the injected RNG and fresh id, so tests can replay
    // a duel exactly while each rematch still receives different words.
    match=classic?createMatch(players,at,id,{exchangeMs:10000,typing}):createMatch(players,at,id,{rounds,seed:`${id}:${Math.floor(rng()*0x100000000)}`,resolveAtEnd:true,typing});
    lastEmittedCombatId=0;rematchVotes=[];
    emit('MATCH_START',{match:snapshot(),serverTime:at,...(rematch?{rematch:true}:{})});
    if(!classic)broadcastRound([{type:'ROUND_START',payload:roundStartPayload(match)}],at);
    emit('STATE_UPDATE',{match:snapshot(),serverTime:at});
    if(classic)emit('EXCHANGE_START',{index:match.exchange.index,endsAt:match.exchange.endsAt,serverTime:at});
    if(disposed)return;
    tickTimer=scheduler.setInterval(tick,tickMs);
    startBotRound();
  }
  /** Mirrors room.applyAdvance: combat, round packets, then the terminal snapshot. */
  function applyAdvance(previous,step,at){
    if(step.match===previous)return;
    match=step.match;
    if(step.events.length)broadcastCombat(step.events);
    if(step.roundEvents.length)broadcastRound(step.roundEvents,at);
    if(step.roundEvents.some(e=>e.type==='ROUND_END'))clearBotTimer();
    if(!classic&&match.status==='running'&&step.roundEvents.some(e=>e.type==='ROUND_END'))botPickRoundSkill();
    if(match.status==='ended'&&previous.status!=='ended')publishEnd(at);
    else emit('STATE_UPDATE',{match:snapshot(),serverTime:at});
    if(match.status==='running'&&step.roundEvents.some(e=>e.type==='ROUND_START'))startBotRound();
  }
  /** Tick is the local equivalent of the DO alarm; nextDeadline avoids empty steps. */
  function tick(){
    if(disposed||match?.status!=='running')return;
    const at=now();
    if((nextDeadline(match)??Infinity)>at)return;
    const previous=match;
    applyAdvance(previous,advanceMatch(previous,at,rng),at);
  }
  /** Mirrors PvPRoom.wordSubmit(); returns the engine outcome. */
  function wordSubmit(playerId,payload){
    if(!match)return {error:'MATCH_NOT_ACTIVE'};
    const at=now();
    const previous=match;
    applyAdvance(previous,advanceMatch(previous,at,rng),at);
    if(match.status!=='running')return {error:'MATCH_NOT_ACTIVE'};
    const outcome=submitWord(match,{matchId:payload?.matchId,wordIndex:payload?.wordIndex,text:payload?.text,round:payload?.round,playerId},at);
    if(outcome.error){
      if(playerId===HUMAN_ID)emit('WORD_RESULT',{accepted:false,code:outcome.error,expectedIndex:outcome.expectedIndex??null,matchId:match.id,
        ...(outcome.round!==undefined?{round:outcome.round}:{})});
      return outcome;
    }
    match=outcome.match;
    // WORD_RESULT goes only to the submitting socket, i.e. only for the human.
    const {roundEvents=[],...result}=outcome.result;
    if(playerId===HUMAN_ID)emit('WORD_RESULT',{...result,match:snapshot(),serverTime:at});
    if(outcome.result.cast)broadcastCombat([outcome.result.cast]);
    if(roundEvents.length)broadcastRound(roundEvents,at);
    const submitted=match;
    const step=advanceMatch(submitted,at,rng);
    if(step.match===submitted)emit('STATE_UPDATE',{match:snapshot(),serverTime:at});
    else applyAdvance(submitted,step,at);
    return outcome;
  }

  // ---- bot ----------------------------------------------------------------
  const botState=()=>match?.participants.find(p=>p.playerId===BOT_ID);
  function botPickRoundSkill(){
    const chance={kolay:.2,orta:.45,zor:.7}[difficulty];
    if(rng()>=chance)return;
    const available=ROUND_TIME_SKILLS.filter(id=>(botState()?.roundSkillUses?.[id]||0)<2);
    if(!available.length)return;
    const skill=available[Math.floor(rng()*available.length)];
    const outcome=pickRoundSkill(match,{playerId:BOT_ID,skill},now());
    if(!outcome.error)match=outcome.match;
  }
  function clearBotTimer(){if(botTimer!==null){scheduler.clearTimeout(botTimer);botTimer=null;}}
  function botCanType(){return match?.status==='running'&&(classic?now()<match.endsAt:match.round?.phase==='round'&&!botState()?.roundDone);}
  function scheduleBot(delay){
    if(disposed||!botCanType())return;
    clearBotTimer();
    botTimer=scheduler.setTimeout(botType,delay);
  }
  function startBotRound(){
    if(!botCanType())return;
    const [lo,hi]=profile.startDelayMs;
    scheduleBot(lo+rng()*(hi-lo)+botWordDelay(botState().currentWord,profile,rng));
  }
  /** The bot finished "typing" its current word: submit it (maybe with a typo). */
  function botType(){
    botTimer=null;
    if(disposed||!botCanType())return;
    const me=botState();
    const round=classic?null:match.round.index;
    const word=me.currentWord;
    const text=rng()<profile.typo?makeTypo(word,rng):word;
    wordSubmit(BOT_ID,{matchId:match.id,wordIndex:me.wordIndex,...(classic?{}:{round}),text});
    if(botCanType()&&(classic||match.round.index===round))scheduleBot(botWordDelay(botState().currentWord,profile,rng));
  }

  // ---- inbound messages (what network.send() would put on the socket) -----
  function send(type,payload={}){
    if(disposed)return false;
    if(type==='ROUND_SKILL_PICK'){
      const at=now();
      if(!match)return true;
      const previous=match;applyAdvance(previous,advanceMatch(previous,at,rng),at);
      if(Object.keys(payload).length!==1||!Object.hasOwn(payload,'skill')){emit('ERROR',{code:'INVALID_ROUND_SKILL'});return true;}
      const outcome=pickRoundSkill(match,{playerId:HUMAN_ID,skill:payload.skill},at);
      if(outcome.error)emit('ERROR',{code:outcome.error});
      else{match=outcome.match;emit('ROUND_SKILL_ACK',{...outcome.result,match:snapshot(),serverTime:at});}
      return true;
    }
    if(type==='WORD_SUBMIT'){wordSubmit(HUMAN_ID,payload);return true;}
    if(type==='STATE_REQUEST'){if(match)emit('STATE_UPDATE',{match:snapshot(),serverTime:now()});return true;}
    if(type==='SURRENDER'){
      if(!match||!['running','paused'].includes(match.status))return true;
      const at=now();match=surrenderMatch(match,humanSeat,at);publishEnd(at);return true;
    }
    if(type==='REMATCH_VOTE'){
      if(match?.status!=='ended')return true;
      if(payload.accept===true&&rematchTimer===null){
        // Bot always accepts → both votes in → 3-2-1 → fresh match.
        rematchVotes=[BOT_ID,HUMAN_ID];
        const startAt=now()+PRACTICE_REMATCH_DELAY_MS;
        emit('REMATCH_COUNTDOWN',{startAt});
        emit('REMATCH_STATUS',{votes:[...rematchVotes],startAt});
        rematchTimer=scheduler.setTimeout(()=>{rematchTimer=null;if(!disposed)startMatch(true);},PRACTICE_REMATCH_DELAY_MS);
      }else if(payload.accept===false){
        if(rematchTimer!==null){scheduler.clearTimeout(rematchTimer);rematchTimer=null;emit('REMATCH_CANCELLED',{reason:'Rövanş isteği geri çekildi'});}
        rematchVotes=[BOT_ID];
        emit('REMATCH_STATUS',{votes:[...rematchVotes],startAt:null});
      }
      return true;
    }
    if(type==='LEAVE'){dispose();return true;}
    // PING, READY_SET, CHARACTER_SELECT, HOST_* … have no meaning offline.
    return false;
  }
  function dispose(){
    if(disposed)return;
    stopTimers();disposed=true;
  }

  return {
    start(){if(!disposed&&!match)startMatch(false);return this;},
    send,dispose,
    /** Public snapshot exactly as the server would send it. */
    snapshot(){return match?snapshot():null;},
    /** Internal engine state (tests / debugging only). */
    get match(){return match;},
    get disposed(){return disposed;},
    get history(){return history.slice();},
    get rematchVotes(){return rematchVotes.slice();},
    /** Number of live timers owned by this session (0 after dispose). */
    get activeTimers(){return [tickTimer,botTimer,rematchTimer].filter(x=>x!==null).length;},
    humanId:HUMAN_ID,botId:BOT_ID,humanSeat,botSeat,difficulty,profile,character,rounds,typing,mode:classic?'classic':'rounds'
  };
}

/** Offline Arena uses the same engine transitions and the human seat's public view. */
function createArenaPracticeSession(o){
  const rng=o.rng||Math.random,now=o.now||(()=>Date.now()),scheduler=o.scheduler||defaultScheduler;
  const createId=o.createId||defaultId,tickMs=Math.max(10,o.tickMs||50);
  const difficulty=normalizeDifficulty(o.difficulty),profile=BOT_DIFFICULTIES[difficulty];
  const character=o.character==='rune'?'rune':'fire',humanSeat=character==='fire'?1:2,botSeat=humanSeat===1?2:1;
  const players=[
    {playerId:HUMAN_ID,seat:humanSeat,name:String(o.name||'Savaşçı').slice(0,20),character,rune:o.rune||'none'},
    {playerId:BOT_ID,seat:botSeat,name:`Bot · ${profile.label}`,character:character==='fire'?'rune':'fire',rune:'none'}
  ].sort((a,b)=>a.seat-b.seat);
  let match=null,tickTimer=null,botTimer=null,rematchTimer=null,disposed=false,lastCombatId=0,rematchVotes=[],rematchRevision=0;
  const history=[];
  const snapshot=()=>arenaPublicMatch(match,humanSeat);
  const bot=()=>match?.participants.find(p=>p.playerId===BOT_ID);
  function emit(type,fields={},at=now()){
    if(disposed)return;
    const pub=snapshot(),payload={...fields,match:pub,serverTime:at};
    // Rövanş oyları motor dizisini değiştirmez: her duruma ayrı revizyon ver ki eventId tekrarlanmasın.
    const suffix=(type.startsWith('ARENA_')&&Number.isInteger(fields.round)?`:r${fields.round}`:'')+(type.startsWith('REMATCH_')?`:v${++rematchRevision}`:'');
    const packet={version:VERSION,type,payload,serverTime:at,matchId:pub.matchId,sequence:pub.sequence,
      eventId:`${pub.matchId}:${pub.sequence}:${type}${suffix}`};
    o.onPacket?.(packet);
    if(MATCH_TYPES.has(type)||type==='ARENA_MATCH_END')o.onMatch?.({type,match:pub,serverTime:at});
    if(type==='WORD_RESULT')o.onWordResult?.(payload);
  }
  function clearBot(){if(botTimer!==null){scheduler.clearTimeout(botTimer);botTimer=null;}}
  function stopTimers(){
    if(tickTimer!==null){scheduler.clearInterval(tickTimer);tickTimer=null;}
    clearBot();
    if(rematchTimer!==null){scheduler.clearTimeout(rematchTimer);rematchTimer=null;}
  }
  function end(at){
    stopTimers();
    const result=snapshot().result;
    if(result&&!history.some(x=>x.matchId===result.matchId))history.unshift(result);
    emit('MATCH_END',{},at);
    emit('STATE_UPDATE',{},at);
    emit('MATCH_HISTORY',{results:history.slice(0,20)},at);
    rematchVotes=[BOT_ID];
    emit('REMATCH_STATUS',{votes:[...rematchVotes],startAt:null},at);
  }
  function botCanType(){return match?.status==='running'&&match.round.phase==='round'&&!bot()?.roundDone;}
  function scheduleBot(delay,fn){clearBot();if(!disposed)botTimer=scheduler.setTimeout(()=>{botTimer=null;fn();},Math.max(0,Math.round(delay)));}
  function choose(ids,uses){
    if(rng()<.22)return null;
    const allowed=ids.filter(id=>(uses[id]||0)<2);
    return allowed.length?allowed[Math.min(allowed.length-1,Math.floor(rng()*allowed.length))]:null;
  }
  function botPick(){
    if(disposed||match?.status!=='running'||match.round.phase!=='prep'||bot().pickLocked)return;
    const p=bot(),at=now();
    const outcome=submitArenaPick(match,{playerId:BOT_ID,skill:choose(ARENA_SKILL_IDS,p.skillUses),
      item:choose(ARENA_ITEM_IDS,p.itemUses)},at);
    if(outcome.error)return;
    match=outcome.match;
    const previous=match,step=advanceArenaMatch(previous,at,rng);
    if(step.match===previous)emit('STATE_UPDATE',{},at);else applyAdvance(previous,step,at);
  }
  function botType(){
    if(!botCanType())return;
    const p=bot(),round=match.round.index,word=p.currentWord;
    const submitted=rng()<profile.typo?makeTypo(word,rng):word;
    wordSubmit(BOT_ID,{matchId:match.id,round,wordIndex:p.roundWordIndex,text:submitted});
    if(botCanType()&&match.round.index===round)scheduleBot(botWordDelay(bot().currentWord,profile,rng),botType);
  }
  function phaseTimer(){
    clearBot();
    if(match?.status!=='running')return;
    if(match.round.phase==='prep')scheduleBot(350+rng()*650,botPick);
    else if(botCanType()){
      const [lo,hi]=profile.startDelayMs;
      scheduleBot(lo+rng()*(hi-lo)+botWordDelay(bot().currentWord,profile,rng),botType);
    }
  }
  function applyAdvance(previous,step,at){
    if(step.match===previous)return;
    const oldPhase=previous.round.phase,oldRound=previous.round.index;
    match=step.match;
    for(const event of step.events){
      if(event.type!=='ARENA_ATTACK'||event.id<=lastCombatId)continue;
      lastCombatId=event.id;emit('ARENA_ATTACK',{event},at);o.onCombat?.(event);
    }
    for(const event of step.roundEvents){
      if(event.seat&&event.seat!==humanSeat)continue;
      emit(event.type,event.payload,at);
    }
    if(match.status==='ended'&&previous.status!=='ended')end(at);
    else emit('STATE_UPDATE',{},at);
    if(match.status==='running'&&(match.round.phase!==oldPhase||match.round.index!==oldRound))phaseTimer();
  }
  function advance(at){
    if(match?.status!=='running')return;
    const previous=match;
    applyAdvance(previous,advanceArenaMatch(previous,at,rng),at);
  }
  function tick(){
    if(disposed||match?.status!=='running'||(nextArenaDeadline(match)??Infinity)>now())return;
    advance(now());
  }
  function wordSubmit(playerId,payload){
    if(!match)return {error:'MATCH_NOT_ACTIVE'};
    const at=now();advance(at-1); // bitiş anı yazmaya açık (sunucuyla aynı kural)
    if(match.status!=='running')return {error:'MATCH_NOT_ACTIVE'};
    const outcome=submitArenaWord(match,{playerId,matchId:payload?.matchId,wordIndex:payload?.wordIndex,
      text:payload?.text,round:payload?.round},at);
    if(outcome.error){
      if(playerId===HUMAN_ID)emit('WORD_RESULT',{accepted:false,code:outcome.error,
        expectedIndex:outcome.expectedIndex??null,matchId:match.id,
        ...(outcome.round!==undefined?{round:outcome.round}:{})},at);
      return outcome;
    }
    match=outcome.match;
    if(playerId===HUMAN_ID)emit('WORD_RESULT',outcome.result,at);
    const previous=match,step=advanceArenaMatch(previous,at,rng);
    if(step.match===previous)emit('STATE_UPDATE',{},at);else applyAdvance(previous,step,at);
    return outcome;
  }
  function pick(payload){
    if(!match)return {error:'MATCH_NOT_ACTIVE'};
    const at=now();advance(at);
    if(match.status!=='running')return {error:'MATCH_NOT_ACTIVE'};
    const outcome=submitArenaPick(match,{playerId:HUMAN_ID,skill:payload?.skill??null,item:payload?.item??null},at);
    if(outcome.error){emit('ERROR',{code:outcome.error},at);return outcome;}
    match=outcome.match;
    emit('ARENA_PICK_ACK',{seat:outcome.result.seat,skill:outcome.result.skill,item:outcome.result.item},at);
    const previous=match,step=advanceArenaMatch(previous,at,rng);
    if(step.match===previous)emit('STATE_UPDATE',{},at);else applyAdvance(previous,step,at);
    return outcome;
  }
  function startMatch(rematch=false){
    stopTimers();
    const at=now(),id=createId();
    match=createArenaMatch(players,at,id,{seed:`${id}:${Math.floor(rng()*0x100000000)}`,typing:normalizeTyping(o.typing)});
    lastCombatId=0;rematchVotes=[];
    emit('MATCH_START',{...(rematch?{rematch:true}:{})},at);
    emit('ARENA_PREP_START',{round:1,endsAt:match.round.endsAt},at);
    emit('STATE_UPDATE',{},at);
    if(disposed)return;
    tickTimer=scheduler.setInterval(tick,tickMs);
    phaseTimer();
  }
  function send(type,payload={}){
    if(disposed)return false;
    if(type==='ARENA_PICK'){pick(payload);return true;}
    if(type==='WORD_SUBMIT'){wordSubmit(HUMAN_ID,payload);return true;}
    if(type==='STATE_REQUEST'){if(match)emit('STATE_UPDATE');return true;}
    if(type==='SURRENDER'){
      if(match?.status==='running'){
        const at=now();match=surrenderArenaMatch(match,humanSeat,at);
        emit('ARENA_MATCH_END',{result:snapshot().result},at);end(at);
      }
      return true;
    }
    if(type==='REMATCH_VOTE'){
      if(match?.status!=='ended')return true;
      if(payload.accept===true&&rematchTimer===null){
        rematchVotes=[BOT_ID,HUMAN_ID];const startAt=now()+PRACTICE_REMATCH_DELAY_MS;
        emit('REMATCH_COUNTDOWN',{startAt});emit('REMATCH_STATUS',{votes:[...rematchVotes],startAt});
        rematchTimer=scheduler.setTimeout(()=>{rematchTimer=null;if(!disposed)startMatch(true);},PRACTICE_REMATCH_DELAY_MS);
      }else if(payload.accept===false){
        if(rematchTimer!==null){scheduler.clearTimeout(rematchTimer);rematchTimer=null;emit('REMATCH_CANCELLED',{reason:'Rövanş isteği geri çekildi'});}
        rematchVotes=[BOT_ID];emit('REMATCH_STATUS',{votes:[...rematchVotes],startAt:null});
      }
      return true;
    }
    if(type==='LEAVE'){dispose();return true;}
    return false;
  }
  function dispose(){if(disposed)return;stopTimers();disposed=true;}
  return {
    start(){if(!disposed&&!match)startMatch();return this;},send,dispose,snapshot:()=>match?snapshot():null,
    get match(){return match;},get disposed(){return disposed;},get history(){return history.slice();},
    get rematchVotes(){return rematchVotes.slice();},
    get activeTimers(){return [tickTimer,botTimer,rematchTimer].filter(x=>x!==null).length;},
    humanId:HUMAN_ID,botId:BOT_ID,humanSeat,botSeat,difficulty,profile,character,rounds:6,typing:normalizeTyping(o.typing),mode:'arena'
  };
}

/** Load pvp/practice.css once (index.html does not need to link it). */
export function ensurePracticeStyles(doc=globalThis.document){
  if(!doc?.head||doc.querySelector('link[data-practice-css]'))return;
  const link=doc.createElement('link');
  link.rel='stylesheet';link.href=new URL('./practice.css',import.meta.url).href;link.dataset.practiceCss='';
  doc.head.appendChild(link);
}
