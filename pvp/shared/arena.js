/** Server-owned Arena match transitions. All public mutations clone their input. */
import {pickWords as bankPickWords,createSeed,createRng} from './words.js';
import {normalizeFighter} from './fighters.js';
import {normalizeStage,pickStage} from './stages.js';
import {normalizeTyping,wordsMatch,charScore} from './typing-rules.js';
import {resolveRoundAttacks,ARENA_ITEMS} from './arena-damage.js';
import {validatePick,scrambleWord,ARENA_OVERTIME_MS,ARENA_FREEZE_MS,ARENA_TIME_THIEF_MS,ARENA_SKILL_IDS,ARENA_MAX_USES} from './arena-skills.js';

export const ARENA_ROUND_WORDS=Object.freeze([5,10,15,15,15,20]);
export const ARENA_TOTAL_ROUNDS=6;
export const ARENA_MATCH_HP=3000; // Hasar denetçisi önerisi: 5000'de %60/%60 maçların %99,5'i 6. raunda gidiyordu
export const ARENA_ROUND_DURATION_MS=40_000; // paket 30: 30 → 40 sn
export const ARENA_PREP_DURATION_MS=15_000;  // paket 30: hazırlık 10 → 15 sn
// Vuruşlar sıra sıra: aralık vuruş sayısına göre 450–1100 ms, toplam çözüm ~12 sn ile sınırlı.
export const ARENA_RESOLVE_STEP_MS=1100;
export const ARENA_RESOLVE_MIN_STEP_MS=450;
export const ARENA_RESOLVE_BUDGET_MS=12000;
export const arenaResolveStep=count=>Math.max(ARENA_RESOLVE_MIN_STEP_MS,Math.min(ARENA_RESOLVE_STEP_MS,Math.floor(ARENA_RESOLVE_BUDGET_MS/Math.max(1,count))));
export const ARENA_SUMMARY_MS=7_000;        // paket 30: raund sonucu 4 → 7 sn
export const ARENA_SERVER_ONLY_EVENTS=new Set(['ARENA_PREP_START','ARENA_PICK_ACK','ARENA_ROUND_START','WORD_RESULT','ARENA_ROUND_END','ARENA_ATTACK','ARENA_MATCH_END']);
const RULES=[{minLen:3,maxLen:6,difficulty:'easy'},{minLen:4,maxLen:7,difficulty:'easy'},
  {minLen:4,maxLen:8,difficulty:'normal'},{minLen:5,maxLen:9,difficulty:'normal'},
  {minLen:5,maxLen:9,difficulty:'hard'},{minLen:5,maxLen:10,difficulty:'hard'}];
const other=seat=>seat===1?2:1;
const bySeat=(m,seat)=>m.participants.find(p=>p.seat===seat);
function event(m,type,fields){
  const e={id:m.nextCombatId++,type,...fields};
  m.combatEvents.push(e);
  if(m.combatEvents.length>24)m.combatEvents.splice(0,m.combatEvents.length-24);
  return e;
}
function roundEvent(m,list,type,payload){m.sequence++;list.push({type,payload,sequence:m.sequence});}
function cleanWords(list){return Array.from(list||[],w=>String(w).trim().normalize('NFC')).filter(w=>w&&!/\s/u.test(w));}
function planWords(pick,seed){
  const used=new Set(),plan=[];
  for(let i=0;i<ARENA_TOTAL_ROUNDS;i++){
    const count=ARENA_ROUND_WORDS[i],rule=RULES[i],words=[];
    const add=xs=>{for(const word of cleanWords(xs))if(words.length<count&&!used.has(word)&&!words.includes(word))words.push(word);};
    add(pick({seed:`${seed}:arena:${i+1}`,count,...rule,exclude:[...used]}));
    if(words.length<count)add(bankPickWords({seed:`${seed}:arena:${i+1}:fill`,count:count*3,...rule,exclude:[...used,...words]}));
    if(words.length<count)throw new RangeError('Arena kelime havuzu yetersiz');
    words.forEach(w=>used.add(w));plan.push(words);
  }
  return plan;
}
function openPrep(m,index,at,list){
  m.round={index,total:ARENA_TOTAL_ROUNDS,phase:'prep',words:[...m.roundPlan[index-1]],
    startedAt:null,endsAt:at+ARENA_PREP_DURATION_MS,prepEndsAt:at+ARENA_PREP_DURATION_MS,
    resolveAt:null,summaryEndsAt:null,finishedSeat:null,endedAt:null};
  m.endsAt=m.round.endsAt;m.pendingAttacks=[];
  for(const p of m.participants)Object.assign(p,{roundWordIndex:0,attempts:[],roundWords:[],roundSkill:null,roundItem:null,
    pickLocked:false,personalEndsAt:null,frozenUntil:null,overtimeUntil:null,roundDone:false,finishedAt:null,
    roundCorrect:0,roundWrong:0,roundDamage:0,roundBestStreak:0,combo:0,currentWord:''});
  roundEvent(m,list,'ARENA_PREP_START',{round:index,endsAt:m.round.endsAt});
}
export function createArenaMatch(players,at=Date.now(),id=crypto.randomUUID(),options={}){
  if(!Array.isArray(players)||players.length!==2||new Set(players.map(p=>p.seat)).size!==2||!players.every(p=>[1,2].includes(p.seat)&&typeof p.playerId==='string'))
    throw new TypeError('Arena iki geçerli oyuncu gerektirir');
  const seed=options.seed??createSeed(),pick=options.pickWords||bankPickWords;
  const m={id,version:1,mode:'arena',sequence:0,status:'running',startedAt:at,clockAt:at,endsAt:null,endedAt:null,
    winnerSeat:null,endReason:null,seed,totalRounds:ARENA_TOTAL_ROUNDS,roundPlan:planWords(pick,seed),
    typing:normalizeTyping(options.typing),stage:normalizeStage(pickStage(options.stage,options.rng||Math.random)),roundHistory:[],nextCombatId:1,pendingAttacks:[],combatEvents:[],participants:players.map(p=>({
      playerId:p.playerId,seat:p.seat,name:p.name||`Oyuncu ${p.seat}`,character:p.character||'fire',fighter:normalizeFighter(p.fighter,p.character||'fire'),rune:p.rune||'none',
      hp:ARENA_MATCH_HP,maxHp:ARENA_MATCH_HP,wordIndex:0,correctWords:0,wrongWords:0,correctChars:0,submittedChars:0,
      wpm:0,accuracy:100,maxCombo:0,lastWordAt:null,lastSubmittedAt:null,combatStats:{damageDealt:0,damageTaken:0},
      skillUses:{},itemUses:{}}))};
  openPrep(m,1,at,[]);event(m,'ARENA_PREP_START',{round:1,endsAt:m.round.endsAt});return m;
}
export function submitArenaPick(match,{playerId,skill=null,item=null}={},at=Date.now()){
  if(!match||match.status!=='running')return {error:'MATCH_NOT_ACTIVE'};
  const p=match.participants.find(x=>x.playerId===playerId);
  if(!p)return {error:'NOT_MATCH_PARTICIPANT'};
  if(match.round.phase!=='prep'||at>=match.round.prepEndsAt)return {error:'ARENA_PICK_NOT_PREP'};
  if(p.pickLocked)return {error:'ARENA_PICK_LOCKED'};
  const valid=validatePick(match,p.seat,{skill,item});if(!valid.ok)return {error:valid.error};
  const m=structuredClone(match),mine=bySeat(m,p.seat);
  mine.roundSkill=skill;mine.roundItem=item;mine.pickLocked=true;
  if(skill)mine.skillUses[skill]=(mine.skillUses[skill]||0)+1;
  if(item)mine.itemUses[item]=(mine.itemUses[item]||0)+1;
  m.sequence++;m.clockAt=at;
  return {match:m,result:{type:'ARENA_PICK_ACK',seat:mine.seat,skill,item}};
}
function personalEnd(m,p){return p.roundDone?p.finishedAt:p.personalEndsAt;}
function roundCloseAt(m){
  const [a,b]=m.participants;
  return Math.max(personalEnd(m,a),personalEnd(m,b));
}
function startRound(m,at,list){
  const r=m.round;r.phase='round';r.startedAt=at;
  for(const p of m.participants){
    p.roundWords=[...r.words];
    if(bySeat(m,other(p.seat)).roundSkill==='scramble')p.roundWords=r.words.map((word,i)=>
      scrambleWord(word,createRng(typeof m.seed==='number'?m.seed+r.index+i:`${m.seed}:${r.index}:${i}`)));
    p.currentWord=p.roundWords[0];
    p.personalEndsAt=at+ARENA_ROUND_DURATION_MS+(p.roundSkill==='freeze'?ARENA_FREEZE_MS:0)
      -(bySeat(m,other(p.seat)).roundSkill==='timethief'?ARENA_TIME_THIEF_MS:0);
    p.frozenUntil=p.roundSkill==='freeze'?at+ARENA_FREEZE_MS:null;
  }
  r.endsAt=roundCloseAt(m);m.endsAt=r.endsAt;m.clockAt=at;
  for(const p of m.participants){
    m.sequence++;
    list.push({type:'ARENA_ROUND_START',seat:p.seat,
      // Karanlık Saat kurbanına bitiş zamanı gönderilmez (geri sayım hesaplanamasın).
      payload:{round:r.index,totalRounds:ARENA_TOTAL_ROUNDS,words:[...p.roundWords],
        endsAt:m.participants.find(o=>o.seat!==p.seat)?.roundSkill==='blindclock'?null:p.personalEndsAt,
        blindClock:m.participants.find(o=>o.seat!==p.seat)?.roundSkill==='blindclock'},sequence:m.sequence});
  }
}
function scores(m){return [...m.participants].sort((a,b)=>a.seat-b.seat).map(p=>({seat:p.seat,correct:p.roundCorrect,wrong:p.roundWrong,
  bestStreak:p.roundBestStreak,damageDealt:p.roundDamage,hpLeft:p.hp}));}
function roundPicks(m){return [...m.participants].sort((a,b)=>a.seat-b.seat).map(p=>({seat:p.seat,skill:p.roundSkill,item:p.roundItem}));}
function recordRoundHistory(m){
  if(m.roundHistory.some(h=>h.round===m.round.index))return;
  const currentScores=scores(m),winnerSeat=currentScores[0].damageDealt===currentScores[1].damageDealt?null:
    (currentScores[0].damageDealt>currentScores[1].damageDealt?currentScores[0].seat:currentScores[1].seat);
  m.roundHistory.push({round:m.round.index,scores:currentScores,winnerSeat,picks:roundPicks(m)});
}
function closeTyping(m,at,list){
  const r=m.round;r.phase='resolve';r.endedAt=at;
  const attacks=[];
  for(const p of m.participants){
    const defender=bySeat(m,other(p.seat));
    for(const hit of resolveRoundAttacks({roundIndex:r.index-1,attempts:p.attempts,item:p.roundItem,defenderItem:defender.roundItem})){
      const attempt=p.attempts.find(a=>a.index===hit.wordIndex);
      attacks.push({...hit,fromSeat:p.seat,toSeat:defender.seat,submittedAt:attempt?.at??at});
    }
  }
  const [one,two]=[bySeat(m,1),bySeat(m,2)];
  const first=one.roundDone!==two.roundDone?(one.roundDone?1:2)
    :one.roundDone&&two.roundDone&&one.finishedAt!==two.finishedAt?(one.finishedAt<two.finishedAt?1:2)
    :one.roundCorrect!==two.roundCorrect?(one.roundCorrect>two.roundCorrect?1:2):1;
  const queues={1:attacks.filter(a=>a.fromSeat===1).sort((a,b)=>a.wordIndex-b.wordIndex),
    2:attacks.filter(a=>a.fromSeat===2).sort((a,b)=>a.wordIndex-b.wordIndex)};
  const ordered=[];while(queues[1].length||queues[2].length){
    for(const seat of [first,other(first)])if(queues[seat].length)ordered.push(queues[seat].shift());
  }
  const step=arenaResolveStep(ordered.length);
  m.pendingAttacks=ordered.map((a,i)=>({...a,turn:i+1,resolveAt:at+(i+1)*step}));
  r.resolveAt=m.pendingAttacks[0]?.resolveAt??at;
  const roundsWon={1:0,2:0};
  for(const h of m.roundHistory)if(h.winnerSeat)roundsWon[h.winnerSeat]++;
  roundEvent(m,list,'ARENA_ROUND_END',{round:r.index,scores:scores(m),roundsWon,picks:roundPicks(m)});
}
function finish(m,at,reason,list){
  if(m.round.endedAt!==null)recordRoundHistory(m);
  m.status='ended';m.round.phase='ended';m.endedAt=at;m.endsAt=at;m.endReason=reason;m.pendingAttacks=[];
  if(reason!=='SURRENDER'&&reason!=='KNOCKOUT'){
    const [a,b]=[...m.participants].sort((x,y)=>x.seat-y.seat);
    for(const key of ['hp','correctWords'])if(a[key]!==b[key]){m.winnerSeat=a[key]>b[key]?a.seat:b.seat;break;}
    if(m.winnerSeat===null){const da=a.combatStats.damageDealt,db=b.combatStats.damageDealt;
      m.winnerSeat=da===db?null:(da>db?a.seat:b.seat);}
    m.endReason=m.winnerSeat===null?'ARENA_DRAW':'ROUNDS';
  }
  const result=arenaMatchResult(m);
  event(m,'ARENA_MATCH_END',{result});
  roundEvent(m,list,'ARENA_MATCH_END',{result});
}
export function submitArenaWord(match,{playerId,matchId,wordIndex,text,round}={},at=Date.now()){
  if(!match||match.status!=='running')return {error:'MATCH_NOT_ACTIVE'};
  if(matchId!==match.id)return {error:'MATCH_ID_MISMATCH'};
  const p=match.participants.find(x=>x.playerId===playerId);if(!p)return {error:'NOT_MATCH_PARTICIPANT'};
  if(match.round.phase!=='round')return {error:'ROUND_NOT_ACTIVE'};
  if(round!==undefined&&round!==null&&round!==match.round.index)return {error:'ROUND_MISMATCH',round:match.round.index};
  if(p.roundDone)return {error:'ROUND_COMPLETE'};
  // Bitiş anı KAPSAYICI: tam bitiş milisaniyesinde gelen gönderim kabul edilir (aynı ms'de çifte bitiş adil olsun).
  if(at>p.personalEndsAt||at>match.round.endsAt)return {error:'ROUND_NOT_ACTIVE'};
  if(!Number.isSafeInteger(wordIndex)||wordIndex!==p.roundWordIndex)return {error:'WORD_INDEX_MISMATCH',expectedIndex:p.roundWordIndex};
  if(typeof text!=='string'||!text.trim()||text.length>80||/\s/u.test(text.trim()))return {error:'INVALID_WORD'};
  const submitted=text.trim().normalize('NFC');if(submitted.length>80)return {error:'INVALID_WORD'};
  if(Number.isFinite(p.lastSubmittedAt)&&at-p.lastSubmittedAt<55)return {error:'WORD_BURST_LIMIT'};
  const m=structuredClone(match),mine=bySeat(m,p.seat),expected=mine.roundWords[wordIndex],correct=wordsMatch(submitted,expected,m.typing);
  const score=charScore(submitted,expected,m.typing);
  mine.correctChars+=score.correct;mine.submittedChars+=score.total;
  mine.correctWords+=Number(correct);mine.wrongWords+=Number(!correct);
  mine.roundCorrect+=Number(correct);mine.roundWrong+=Number(!correct);
  mine.combo=correct?mine.combo+1:0;mine.maxCombo=Math.max(mine.maxCombo,mine.combo);
  mine.roundBestStreak=Math.max(mine.roundBestStreak,mine.combo);
  mine.lastSubmittedAt=at;mine.lastWordAt=correct?at:null;
  mine.accuracy=Math.round(mine.correctChars/Math.max(1,mine.submittedChars)*100);
  mine.wpm=Math.round(mine.correctChars/5/Math.max((at-m.startedAt)/60_000,1/60));
  mine.attempts.push({index:wordIndex,submitted,expected,correct,at});mine.roundWordIndex++;mine.wordIndex++;
  mine.currentWord=mine.roundWords[mine.roundWordIndex]??'';
  if(mine.roundWordIndex>=mine.roundWords.length){
    mine.roundDone=true;mine.finishedAt=at;
    if(!m.round.finishedSeat){
      m.round.finishedSeat=mine.seat;
      const opponent=bySeat(m,other(mine.seat));
      opponent.overtimeUntil=opponent.roundSkill==='overtime'?at+ARENA_OVERTIME_MS:null;
      if(!opponent.roundDone)opponent.personalEndsAt=opponent.overtimeUntil??at;
    }
  }
  m.round.endsAt=roundCloseAt(m);m.endsAt=m.round.endsAt;m.sequence++;m.clockAt=at;
  return {match:m,result:{accepted:true,matchId:m.id,wordIndex,expected,submitted,correct,round:m.round.index,
    roundWordIndex:mine.roundWordIndex,roundDone:mine.roundDone,correctWords:mine.correctWords,wrongWords:mine.wrongWords,
    combo:mine.combo,wpm:mine.wpm,accuracy:mine.accuracy}};
}
export function nextArenaDeadline(match){
  if(!match||match.status!=='running')return null;
  const r=match.round;
  if(r.phase==='prep')return r.prepEndsAt;
  if(r.phase==='round')return r.endsAt;
  if(r.phase==='resolve')return match.pendingAttacks[0]?.resolveAt??r.endedAt;
  if(r.phase==='summary')return r.summaryEndsAt;
  return null;
}
export function advanceArenaMatch(match,at=Date.now(),rng=Math.random){
  if(!match||match.status!=='running')return {match,events:[],roundEvents:[]};
  let m=match;const events=[],roundEvents=[];
  for(let guard=0;guard<256&&m.status==='running';guard++){
    const r=m.round;
    if(r.phase==='prep'&&(at>=r.prepEndsAt||m.participants.every(p=>p.pickLocked))){
      m=structuredClone(m);startRound(m,m.participants.every(p=>p.pickLocked)?Math.min(at,r.prepEndsAt):r.prepEndsAt,roundEvents);continue;
    }
    if(r.phase==='round'&&at>=r.endsAt){m=structuredClone(m);closeTyping(m,r.endsAt,roundEvents);continue;}
    if(r.phase==='resolve'){
      const attack=m.pendingAttacks[0];
      if(attack&&at>=attack.resolveAt){
        m=structuredClone(m);const hit=m.pendingAttacks.shift(),defender=bySeat(m,hit.toSeat),attacker=bySeat(m,hit.fromSeat);
        defender.hp=Math.max(0,defender.hp-hit.amount);defender.combatStats.damageTaken+=hit.amount;
        attacker.combatStats.damageDealt+=hit.amount;attacker.roundDamage+=hit.amount;
        const e=event(m,'ARENA_ATTACK',{fromSeat:hit.fromSeat,toSeat:hit.toSeat,wordIndex:hit.wordIndex,turn:hit.turn,defenderAction:'brace',
          amount:hit.amount,multiplier:hit.multiplier,penalty:hit.penalty,tags:hit.tags,hpAfter:defender.hp});
        events.push(e);m.sequence++;m.clockAt=hit.resolveAt;m.round.resolveLastAt=hit.resolveAt;
        if(defender.hp===0){m.winnerSeat=attacker.seat;finish(m,hit.resolveAt,'KNOCKOUT',roundEvents);continue;}
        continue;
      }
      if(!attack){
        m=structuredClone(m);m.round.phase='summary';
        m.round.summaryEndsAt=(m.round.resolveLastAt??m.round.endedAt)+ARENA_SUMMARY_MS;
        recordRoundHistory(m);m.sequence++;continue;
      }
    }
    if(r.phase==='summary'&&at>=r.summaryEndsAt){
      m=structuredClone(m);
      if(r.index>=ARENA_TOTAL_ROUNDS)finish(m,r.summaryEndsAt,'ROUNDS',roundEvents);
      else openPrep(m,r.index+1,r.summaryEndsAt,roundEvents);
      continue;
    }
    break;
  }
  return {match:m,events,roundEvents};
}
export function arenaMatchResult(match){
  if(!match||match.status!=='ended')return null;
  const players=match.participants.map(p=>({seat:p.seat,playerId:p.playerId,name:p.name,character:p.character,fighter:normalizeFighter(p.fighter,p.character),
    hp:p.hp,maxHp:p.maxHp,wpm:p.wpm,accuracy:p.accuracy,combo:p.combo,maxCombo:p.maxCombo,
    correctWords:p.correctWords,wrongWords:p.wrongWords,damageDealt:p.combatStats.damageDealt,
    damageTaken:p.combatStats.damageTaken}));
  const max=Math.max(...players.map(p=>p.damageDealt));const top=players.filter(p=>p.damageDealt===max);
  return {matchId:match.id,mode:'arena',winnerSeat:match.winnerSeat,endReason:match.endReason,
    startedAt:match.startedAt,endedAt:match.endedAt,durationMs:Math.max(0,match.endedAt-match.startedAt),
    totalRounds:ARENA_TOTAL_ROUNDS,mvpSeat:max>0?(top.length===1?top[0].seat:(top.find(p=>p.seat===match.winnerSeat)?.seat??null)):null,
    players,rounds:structuredClone(match.roundHistory)};
}
export function arenaPublicMatch(match,viewerSeat){
  if(!match)return null;
  const r=match.round,me=bySeat(match,viewerSeat),opponent=bySeat(match,other(viewerSeat));
  // Karanlık Saat: rakibi bu beceriyi seçtiyse KURBAN o raund ne kendi ne rakibin kalan süresini görür.
  const hidden=opponent?.roundSkill==='blindclock'&&r.phase==='round';
  const view=p=>({playerId:p.playerId,seat:p.seat,name:p.name,character:p.character,fighter:normalizeFighter(p.fighter,p.character),hp:p.hp,maxHp:p.maxHp,
    wordIndex:p.wordIndex,roundWordIndex:p.roundWordIndex,roundDone:p.roundDone,correctWords:p.correctWords,
    wrongWords:p.wrongWords,wpm:p.wpm,accuracy:p.accuracy,combo:p.combo,maxCombo:p.maxCombo,
    combatStats:{...p.combatStats}});
  return {matchId:match.id,version:match.version,sequence:match.sequence,status:match.status,mode:'arena',phase:r.phase,stage:normalizeStage(match.stage),typing:normalizeTyping(match.typing),assistEnabled:false,
    startedAt:match.startedAt,endsAt:hidden?null:match.endsAt,endedAt:match.endedAt,winnerSeat:match.winnerSeat,endReason:match.endReason,
    round:{index:r.index,total:ARENA_TOTAL_ROUNDS,phase:r.phase,words:me?[...me.roundWords]:[],
      startedAt:r.startedAt,endsAt:hidden?null:r.endsAt,summaryEndsAt:r.summaryEndsAt},
    me:me?{...view(me),remainingMs:hidden?null:(r.phase==='round'?Math.max(0,me.personalEndsAt-match.clockAt):0),blindClock:hidden,
      frozen:r.phase==='round'&&me.frozenUntil>match.clockAt,picks:{skill:me.roundSkill,item:me.roundItem},
      usesLeft:{skills:Object.fromEntries(ARENA_SKILL_IDS.map(id=>[id,ARENA_MAX_USES-(me.skillUses[id]||0)])),
        items:Object.fromEntries(Object.keys(ARENA_ITEMS).map(id=>[id,ARENA_MAX_USES-(me.itemUses[id]||0)]))}}:null,
    opponent:opponent?{...view(opponent),remainingMs:hidden?null:(r.phase==='round'?Math.max(0,opponent.personalEndsAt-match.clockAt):0)}:null,
    ...(r.phase==='resolve'||r.phase==='summary'?{lastRoundPicks:{round:r.index,picks:roundPicks(match)}}:{}),
    ...(r.phase==='summary'?{roundSummary:structuredClone(match.roundHistory.at(-1)),
      roundResults:match.roundHistory.map(h=>({round:h.round,winnerSeat:h.winnerSeat}))}:{}),
    players:match.participants.map(view),combatEvents:structuredClone(match.combatEvents),
    result:match.status==='ended'?arenaMatchResult(match):null};
}
export function surrenderArenaMatch(match,loserSeat,at=Date.now()){
  if(!match||match.status!=='running'||![1,2].includes(loserSeat))return match;
  const m=structuredClone(match);m.winnerSeat=other(loserSeat);finish(m,at,'SURRENDER',[]);return m;
}
