/** Shared TuşLab PvP match engine (pure ES module; only imports the shared word bank).
 * Used by the Cloudflare Durable Object (via cloudflare/src/match.js re-export)
 * and by the offline browser practice mode (pvp/practice.js). Keep it free of
 * Node/Worker-only APIs: only structuredClone and crypto.randomUUID are used.
 *
 * PvP phase 09: server-owned attack scheduling, damage, shield and terminal state.
 * Deterministic state transitions and injected RNG make combat reproducible in tests.
 *
 * Round mode (docs/TUR-SISTEMI.md): createMatch(players,at,id,{rounds,seed?,pickWords?}).
 * Without options the classic 90 s match is unchanged.
 */
import {pickWords as bankPickWords,pickSentence as bankSentence,createSeed} from './words.js';
import {planResolve,RESOLVE_SCENE} from './resolve-timing.js';
export {planResolve,resolveDurationMs,RESOLVE_SCENE} from './resolve-timing.js';
import {normalizeTyping,wordsMatch,charScore} from './typing-rules.js';
import {normalizeContent,contentWords,DEFAULT_CONTENT} from './content-modes.js';
import {ARENA_SKILLS,ARENA_MAX_USES} from './arena-skills.js';
import {ASSIST_RULES,assistPartner,assistDamage,assistGainFromDamage} from './assist-rules.js';
import {normalizeFighter} from './fighters.js';
import {normalizeStage,pickStage} from './stages.js';
// Phase 22 — intentionally opt-in. Legacy / unselected matches remain unchanged.
export const RUNES=Object.freeze({
 none:Object.freeze({name:'Klasik Dövüş',detail:'Dengesiz güç artırımı yok'}),
 ember:Object.freeze({name:'Alev Mührü',detail:'Q vuruşuna +8 hasar'}),
 crystal:Object.freeze({name:'Kristal Kalkan',detail:'S bekleme süresi 200 ms azalır'}),
 rhythm:Object.freeze({name:'Savaş Ritimcisi',detail:'E ve R vuruşuna +6 hasar'}),
 laststand:Object.freeze({name:'Son Direniş',detail:'%30 HP altında ilk darbede %20 azaltım'}),
 reflex:Object.freeze({name:'Keskin Refleks',detail:'Perfect Block penceresi +25 ms'}),
 lightning:Object.freeze({name:'Yıldırım Kesişi',detail:'Her üçüncü Q saldırısına +18 hasar'})
});
export const RUNE_IDS=Object.freeze(Object.keys(RUNES));
export const TALENT_RULES=Object.freeze({fireCombo:3,fireMultiplier:1.07,runeEnergyEvery:1,runeEmpoweredE:16,
  comboWindowMs:12000,comboQtoE:15,comboEtoR:25,parryToQ:20});
export function validateRune(id){return typeof id==='string'&&Object.hasOwn(RUNES,id);}
export function computeSkillBonus(p,skill,at){
 if(!p||p.rune==='none'||!validateRune(p.rune))return {bonus:0,tags:[]};
 let bonus=0;const tags=[];
 if(p.character==='fire'&&p.combo>=TALENT_RULES.fireCombo){bonus+=Math.round(DAMAGE.fire[skill]*.07);tags.push('Kızıl Öfke');}
 if(p.character==='rune'&&skill==='e'&&p.runeEnergy>=4){bonus+=TALENT_RULES.runeEmpoweredE;tags.push('Mühür Birikimi');}
 if(p.rune==='ember'&&skill==='q'){bonus+=8;tags.push('Alev Mührü');}
 if(p.rune==='rhythm'&&['e','r'].includes(skill)){bonus+=6;tags.push('Savaş Ritimcisi');}
 if(p.rune==='lightning'&&skill==='q'&&(p.combatStats?.casts?.q||0)%3===0){bonus+=18;tags.push('Yıldırım Kesişi');}
 const prev=p.lastSkill;
 if(prev&&at-prev.at<=TALENT_RULES.comboWindowMs){
  if(prev.skill==='q'&&skill==='e'){bonus+=15;tags.push('Q→E');}
  if(prev.skill==='e'&&skill==='r'){bonus+=25;tags.push('E→R');}
 }
 if(p.parryCharge&&skill==='q'){bonus+=20;tags.push('Parry→Q');}
 return {bonus,tags};
}
export const MATCH_DURATION_MS=120_000; // paket 30: 90 → 120 sn
export const MATCH_HP=2000;
export const SHIELD_WINDOW_MS=250;
export const SHIELD_PROBABILITY=0.30;
export const SHIELD_DURATION_MS=650;
// Package 13: all defensive randomness stays on the server. Parry requires a
// successful timed block and a second independent random draw.
export const DEFENSE_RULES=Object.freeze({
  perfectWindowMs:150,parryWindowMs:90,parryChance:0.45,
  counterDelayMs:180,counterDamage:65,staggerMs:350,
  heavyPenetration:Object.freeze({e:0.4,r:0.7})
});
export const COOLDOWNS=Object.freeze({q:1300,e:2500,r:4500,s:2500});
export const DAMAGE=Object.freeze({fire:Object.freeze({q:105,e:175,r:305}),rune:Object.freeze({q:95,e:185,r:305})});
// Phase 14: ultimates have three actual server-side impact events, not just a GIF.
// The combined R damage equals the original 305, preserving both fighters' 585/5-word cycle.
export const ULTIMATE_PHASES=Object.freeze({
 fire:Object.freeze([
  Object.freeze({name:'Kızıl Hamle',offset:0,damage:65,effect:'blade'}),
  Object.freeze({name:'Alev Çemberi',offset:180,damage:100,effect:'spin'}),
  Object.freeze({name:'Kızıl İnfaz',offset:420,damage:140,effect:'finisher'})]),
 rune:Object.freeze([
  Object.freeze({name:'Mühür Çatlağı',offset:0,damage:75,effect:'rune'}),
  Object.freeze({name:'Yankı Dalgası',offset:260,damage:90,effect:'shockwave'}),
  Object.freeze({name:'Sonsuz Mühür',offset:540,damage:140,effect:'finisher'})])
});
export const CYCLE_DAMAGE=Object.freeze(Object.fromEntries(Object.entries(DAMAGE).map(([key,v])=>[key,v.q+v.e+v.r])));
for(const [character,phases] of Object.entries(ULTIMATE_PHASES)){
 if(phases.length!==3||phases.reduce((sum,phase)=>sum+phase.damage,0)!==DAMAGE[character].r)
  throw new Error('Unbalanced ultimate phase configuration: '+character);
}

export const MATCH_WORDS=Object.freeze([
  'Güçlü savaşçı, her doğru kelimeyle yeni bir güç kazanır.',
  'Rünler ışıldarken kalkanın gücü artar.',
  'Şatoda yankılanan adımlar düellonun başladığını haber verir.',
  'Cesaret, hız ve dikkat aynı arenada buluşur.',
]);
const wordsOf=text=>text.trim().split(/\s+/u);

// ── Round mode constants (docs/TUR-SISTEMI.md §1) ─────────────────────────
// KESINYAP 11 (12 Kasım 2026): maç her zaman 7 raund; can (ROUND_HP) raundlar arasında TAŞINIR.
export const ROUND_TOTAL=7;
export const ROUND_OPTIONS=Object.freeze([ROUND_TOTAL]);
/** Kelime raundu (counted) planı: iki oyuncuya aynı, raund başına sabit kelime sayısı. */
export const ROUND_WORD_PLAN=Object.freeze([5,7,9,10,10,10,15]);
export const ROUND_WORDS=10; // ani ölüm raundunun kelime sayısı (plan dışı raund)
export const roundWordsFor=index=>ROUND_WORD_PLAN[(Math.trunc(Number(index))||1)-1]??ROUND_WORDS;
// Raund biçimi: counted = kelime raundu (plan kadar kelime); timed = zamana karşı (süre dolana kadar kelime akar).
export const ROUND_STYLES=Object.freeze(['counted','timed']);
export const DEFAULT_ROUND_STYLE='timed';
export const ROUND_VIEW_AHEAD=4;   // timed: anlık görüntüye mevcut kelime + 4 ileri
export const ROUND_VIEW_BEHIND=2;  // timed: tamamlanan son 2 kelime (HUD işaretleri için)
const ROUND_EXTEND_CHUNK=8;
export const normalizeRoundStyle=v=>ROUND_STYLES.includes(v)?v:DEFAULT_ROUND_STYLE;
export const ROUND_DURATION_MS=30_000;   // zamana karşı raund: 30 sn
export const ROUND_COUNTED_CAP_MS=120_000; // kelime raundu: süre sınırı YOK; yalnız GİZLİ güvenlik üst sınırı (kimse bitirmezse)
export const ROUND_CAP_WARN_MS=10_000;     // kelime raundu: yalnız son 10 sn'de küçük 'raund kapanıyor' uyarısı
/** Raund yazma süresi: timed → 30 sn; counted → gizli 120 sn üst sınırı (kelime başına süre yok; ilk bitiren raundu bitirir). Arena etkilenmez. */
export const roundDurationMs=m=>normalizeRoundStyle(m?.roundStyle)==='timed'?ROUND_DURATION_MS:ROUND_COUNTED_CAP_MS;
export const ROUND_LAST_CALL_MS=5_000;
export const ROUND_SETTLE_MS=1_000;
export const ROUND_SUMMARY_MS=6_000;     // paket 30: tur arası özeti 3 → 6 sn
export const ROUND_INTRO_MS=3_000;       // paket 30: 2 → 3 sn
// Saldırılar sıra sıra: her vuruş (hazırlık+atılış+vuruş+dönüş ~0,76–1 sn) ve savunanın geri savrulması görünsün.
export const RESOLVE_STEP_MS=1300;
// Çözüm fazı ~RESOLVE_BUDGET_MS'i geçmesin: saldırı sayısı arttıkça aralık RESOLVE_MIN_STEP_MS'e kadar kısalır.
export const RESOLVE_MIN_STEP_MS=350;
export const RESOLVE_BUDGET_MS=6000;
export function resolveStepMs(count,extraMs=0){
  const n=Math.max(1,Math.trunc(Number(count))||1);
  const room=Math.max(0,RESOLVE_BUDGET_MS-Math.max(0,Number(extraMs)||0));
  return Math.max(RESOLVE_MIN_STEP_MS,Math.min(RESOLVE_STEP_MS,Math.floor(room/n)));
}
// Ultiden sonra kısa toparlanma: ulti sinematiği bitmeden rakibin vuruşu araya girmesin.
export const ULTIMATE_RECOVERY_MS=800;
export const ROUND_HP=4000;          // maç canı: 4000, raundlar arasında sıfırlanmaz
export const ROUND_DAMAGE_CAP=1300;  // tek raundda verilebilecek en çok hasar: 3×1300 < 4000 → nakavt en erken 4. raundda
export const SUDDEN_DEATH_MAX=3;
// KESINYAP 21 — dört yetenek (rounds). MOTOR ANAHTARLARI: q = Q (menzilli), e = W (yakın dövüş; klasikteki eski E vuruşu,
// görsel/ses hattı bu anahtarla çalışır), h = E (kendine can), r = R (ulti). Tuş ↔ motor eşlemesi: shared/fighters.js SKILL_KEY.
export const STREAK_SKILLS=Object.freeze({3:'q',5:'e',7:'h',10:'r'});
/** Seri → beceri: 3 Q, 5 W, 7 E (can), 10 R; 11 ve sonrası her doğru kelime Q. */
export const streakSkill=streak=>STREAK_SKILLS[streak]||(streak>10?'q':null);
export const MULTIPLIER_START=10;
export const MULTIPLIER_STEP=1.2;
export const MULTIPLIER_CAP=2.5;
/** E (kendine can): eski E temel hasarının %80'i, çarpansız; can azami cana kadar, raund başına en çok ROUND_HEAL_CAP. */
export const HEAL_RATIO=0.8;
export const ROUND_HEAL_CAP=400;
export const healAmount=character=>Math.round(DAMAGE[character==='rune'?'rune':'fire'].e*HEAL_RATIO);
// Yetenek eşikleri tek kaynak: rounds eşikleri STREAK_SKILLS'ten türetilir; skillbar.js buradan okur (anahtarlar TUŞ harfidir).
const firstStreakAt=k=>Number(Object.entries(STREAK_SKILLS).find(([,v])=>v===k)[0]);
export const SKILL_THRESHOLDS=Object.freeze({
  classic:Object.freeze({Q:2,W:4,E:4,S:0,R:5}), // klasik kural aynı: 4. doğru = yakın vuruş (W; eski kart 'E')
  rounds:Object.freeze({Q:firstStreakAt('q'),W:firstStreakAt('e'),E:firstStreakAt('h'),S:0,R:firstStreakAt('r')})
});
export const ROUND_SCORE=Object.freeze({correct:100,bestStreak:50,damageDiv:10});
export const ROUND_TIME_SKILLS=Object.freeze(['timethief','blindclock','freeze']);
const timeSkillMs=id=>ARENA_SKILLS[id].effect.ms||0;
/** Süre becerisinin etkisi (ms): HUD halka toplamını doğru hesaplamak için istemci de kullanır. */
export const roundSkillMs=id=>ROUND_TIME_SKILLS.includes(id)?timeSkillMs(id):0;
const roundPlayer=(m,seat)=>m.participants.find(p=>p.seat===seat);
const roundEnds=m=>Math.max(...m.participants.map(p=>p.roundDone?p.finishedAt:p.roundEndsAt));
function syncRoundEnds(m){
  m.round.endsAt=roundEnds(m);m.endsAt=m.round.endsAt;
}
const ULTIMATE_MOTIONS=Object.freeze(['pull','strike','return']);
export const ULTIMATE_RETURN_MS=400;
/** Maç uzunluğu seçeneği kaldırıldı: her rounds maçı 7 raund (eski 5/10 tercihleri sessizce yok sayılır). */
export function normalizeRounds(){return ROUND_TOTAL;}
/** M(streak) = streak<10 ? 1 : min(2.5, 1.5 x 1.2^(streak-10)), rounded to 2 decimals. */
export function streakMultiplier(streak){
  if(!Number.isFinite(streak)||streak<MULTIPLIER_START)return 1;
  return Math.min(MULTIPLIER_CAP,Math.round(1.5*MULTIPLIER_STEP**(streak-MULTIPLIER_START)*100)/100);
}
/** RP = 100 x correct + 50 x bestStreak + floor(damage / 10). Accepts a participant or a score row. */
export function roundScore(p){
  const correct=p?.roundCorrect??p?.correct??0,best=p?.roundBestStreak??p?.bestStreak??0,damage=p?.roundDamage??p?.damageDealt??0;
  return ROUND_SCORE.correct*correct+ROUND_SCORE.bestStreak*best+Math.floor(damage/ROUND_SCORE.damageDiv);
}
const nextSkillOf=p=>p.roundDone?null:streakSkill(p.combo+1);
function randomSeed(){
  const source=globalThis.crypto?.getRandomValues?()=>globalThis.crypto.getRandomValues(new Uint32Array(1))[0]/4294967296:Math.random;
  return createSeed(source);
}
function wordRule(r,total){
  if(r>total)return {minLen:5,maxLen:10,difficulty:'hard'};
  return r<=Math.ceil(total/2)?{minLen:3,maxLen:7,difficulty:'easy'}:{minLen:4,maxLen:9,difficulty:'normal'};
}
const isContentMatch=m=>Boolean(m?.content)&&m.content!==DEFAULT_CONTENT;
const cleanWords=list=>Array.from(list||[],w=>String(w).trim().normalize('NFC')).filter(w=>w&&!/\s/u.test(w));
function dealWords(pick,seed,r,total,used,count=ROUND_WORDS){
  const rule=wordRule(r,total);
  const words=[];const taken=new Set(used);
  const add=list=>{for(const w of cleanWords(list))if(words.length<count&&!taken.has(w)){taken.add(w);words.push(w);}};
  add(pick({seed:`${seed}:r${r}`,count,...rule,exclude:[...used]}));
  if(words.length<count){ // exhausted pool: allow words from earlier rounds rather than a short list
    for(const w of used)taken.delete(w);
    add(pick({seed:`${seed}:r${r}:fill`,count:count*3,...rule,exclude:[]}));
  }
  for(let i=0;words.length<count&&i<count;i++)words.push(words[i%Math.max(1,words.length)]||'tuşlab');
  return words;
}
/** timed: kuyruk `needed` kelimeden kısaysa aynı tohumdan deterministik yeni kelimeler ekler (sunucu ve practice aynı sonucu üretir). */
function ensureRoundWords(match,needed){
  const r=match.round;
  if(match.roundStyle!=='timed')return;
  while(r.words.length<needed){
    const k=(r.extended||0)+1;r.extended=k;
    if(isContentMatch(match)){ // atasözü/şiir: kaldığı yerden sıra; Osmanlıca: aynı dilimden yeni kelimeler
      const more=contentWords(match.content,{start:(r.contentStart||0)+r.words.length,seed:match.seed,salt:`x${k}`,round:r.index,total:match.totalRounds,count:ROUND_EXTEND_CHUNK,exclude:[...(match.usedWords||[]),...r.words]});
      r.words.push(...more.words);r.hints.push(...more.hints);match.usedWords.push(...more.words);continue;
    }
    const rule=wordRule(r.index,match.totalRounds);
    // Maçta kullanılmış ve sonraki raundlara ayrılmış kelimeler tekrar gelmez; havuz yetmezse yalnız son kelimeler hariç tutulur.
    const reserved=[...(match.usedWords||[]),...r.words,...(match.roundPlan||[]).flat()];
    let more=cleanWords(bankPickWords({seed:`${match.seed}:r${r.index}:x${k}`,count:ROUND_EXTEND_CHUNK,...rule,exclude:reserved}));
    if(more.length<ROUND_EXTEND_CHUNK)more=cleanWords([...more,...bankPickWords({seed:`${match.seed}:r${r.index}:x${k}:f`,count:ROUND_EXTEND_CHUNK-more.length,...rule,exclude:[...r.words.slice(-ROUND_EXTEND_CHUNK*3),...more]})]);
    if(!more.length)more=r.words.slice(0,ROUND_EXTEND_CHUNK);
    r.words.push(...(more.length?more:['tuşlab']));match.usedWords.push(...more);
  }
}
function resetForRound(p,words,first){
  // Can yalnız 1. raundda 4000'e kurulur; sonraki raundlara TAŞINIR.
  if(first)Object.assign(p,{hp:ROUND_HP,maxHp:ROUND_HP});
  Object.assign(p,{combo:0,runeEnergy:0,lastSkill:null,parryCharge:false,lastStandUsed:false,
    skillCharge:{q:0,e:0,h:0,s:0,r:0},cooldownUntil:{q:0,e:0,s:0,r:0},shieldUntil:null,staggerUntil:0,lastWordAt:null,
    lastCorrectAt:null,lastCorrectRoundIndex:null,roundWordIndex:0,roundCorrect:0,roundWrong:0,roundBestStreak:0,
    roundDamage:0,roundHeal:0,roundDone:false,finishedAt:null,activeText:words.join(' '),currentWord:words[0]});
}
/** Mutates `match`: opens the next round at `at`. */
function startRound(match,at){
  const index=(match.round?.index||0)+1;
  let words,extra={};
  if(isContentMatch(match)){
    // Sıralı içerik bir önceki raundun en çok yazılan kelimesinden devam eder (sunucu ve bot aynı sonucu görür).
    const prev=match.round;
    const typed=prev?Math.min(prev.words.length,Math.max(0,...match.participants.map(p=>p.roundWordIndex||0))):0;
    const contentStart=prev?(prev.contentStart||0)+typed:0;
    const c=contentWords(match.content,{start:contentStart,seed:match.seed,round:index,total:match.totalRounds,count:roundWordsFor(index),exclude:match.usedWords});
    words=[...c.words];extra={hints:[...c.hints],contentStart};
  }else words=[...(match.roundPlan[index-1]||match.roundPlan.at(-1))];
  const durationMs=roundDurationMs({roundStyle:match.roundStyle,roundWords:roundWordsFor(index)});
  match.round={index,total:match.totalRounds,suddenDeath:index>match.totalRounds,phase:'round',words,...extra,
    ...(match.roundStyle==='timed'?{}:{wordCount:words.length}),
    startedAt:at,endsAt:at+durationMs,settleUntil:null,nextRoundAt:null,
    koSeat:null,koAt:null,allDone:false,lastResolvedAt:null,endedAt:null};
  match.usedWords.push(...words);
  ensureRoundWords(match,ROUND_VIEW_AHEAD+1);
  match.endsAt=match.round.endsAt;match.pendingAttacks=[];
  for(const p of match.participants){
    resetForRound(p,words,index===1);
    p.roundSkill=match.roundStyle==='timed'?match.roundSkillPicks?.[p.seat]??null:null; // süre becerileri kelime raundunda etkisiz
    p.roundEndsAt=at+durationMs+(p.roundSkill==='freeze'?timeSkillMs('freeze'):0);
  }
  for(const p of match.participants){
    const rival=roundPlayer(match,p.seat===1?2:1);
    if(rival.roundSkill==='timethief')p.roundEndsAt-=timeSkillMs('timethief');
  }
  syncRoundEnds(match);match.roundSkillPicks={1:null,2:null};match.roundSkillPickLocked={1:false,2:false};
}
/** ROUND_START payload for the current round (room/practice send it after MATCH_START for round 1). */
export function roundStartPayload(match){
  const r=match?.round;if(!r)return null;
  return {round:r.index,totalRounds:match.totalRounds,suddenDeath:r.suddenDeath,words:[...r.words],
    ...(isContentMatch(match)?{content:match.content,...(match.content!=='atasozu'?{hints:[...r.hints]}:{})}:{}),
    startedAt:r.startedAt,endsAt:r.endsAt,roundHp:ROUND_HP,style:normalizeRoundStyle(match.roundStyle),
    ...(match.roundStyle==='timed'?{}:{wordCount:r.words.length}),damageCap:ROUND_DAMAGE_CAP,
    hp:Object.fromEntries(match.participants.map(p=>[p.seat,p.hp])),
    skills:Object.fromEntries(match.participants.map(p=>[p.seat,p.roundSkill]))};
}
function setupRounds(match,options,at){
  const total=ROUND_TOTAL; // eski options.rounds/roundWords yok sayılır
  const seed=Number.isFinite(options.seed)?Math.trunc(options.seed)>>>0
    :(typeof options.seed==='string'&&options.seed?options.seed:randomSeed());
  const pick=typeof options.pickWords==='function'?options.pickWords:bankPickWords;
  const roundStyle=normalizeRoundStyle(options.roundStyle);
  const content=normalizeContent(options.content);
  const plan=[],used=[];
  if(content===DEFAULT_CONTENT)for(let r=1;r<=total+SUDDEN_DEATH_MAX;r++){const words=dealWords(pick,seed,r,total,used,roundWordsFor(r));plan.push(words);used.push(...words);}
  Object.assign(match,{mode:'rounds',totalRounds:total,roundStyle,seed,roundPlan:plan,...(content===DEFAULT_CONTENT?{}:{content}),usedWords:[],
    roundHistory:[],clashes:{},activeMs:0,round:null,roundSkillPicks:{1:null,2:null},roundSkillPickLocked:{1:false,2:false}});
  if(options.resolveAtEnd===true)match.resolveAtEnd=true;
  for(const p of match.participants)p.roundSkillUses={timethief:0,blindclock:0,freeze:0};
  startRound(match,at);
  return match;
}
function initialPhrase(seat){return (seat-1)%MATCH_WORDS.length;}
export function createMatch(players,at=Date.now(),id=crypto.randomUUID(),options) {
  if(!Array.isArray(players)||players.length!==2||new Set(players.map(p=>p.seat)).size!==2||!players.every(p=>p.seat===1||p.seat===2))
    throw new TypeError('A match requires seats 1 and 2');
  if(players.some(p=>typeof p.playerId!=='string'||!['fire','rune'].includes(p.character)))
    throw new TypeError('Invalid player for match');
  const match={id,version:1,sequence:1,status:'running',startedAt:at,endsAt:at+MATCH_DURATION_MS,
    endedAt:null,winnerSeat:null,endReason:null,nextCombatId:1,pendingAttacks:[],combatEvents:[],
    participants:players.map(p=>{
      const phraseIndex=initialPhrase(p.seat);
      return {playerId:p.playerId,seat:p.seat,name:p.name||`Oyuncu ${p.seat}`,character:p.character,fighter:normalizeFighter(p.fighter,p.character),
        hp:MATCH_HP,maxHp:MATCH_HP,rune:validateRune(p.rune)?p.rune:'none',runeEnergy:0,lastSkill:null,parryCharge:false,lastStandUsed:false,combo:0,maxCombo:0,wordIndex:0,phraseIndex,phraseWordIndex:0,
        correctWords:0,wrongWords:0,correctChars:0,submittedChars:0,wpm:0,accuracy:100,lastWordAt:null,lastSubmittedAt:null,
        activeText:MATCH_WORDS[phraseIndex],currentWord:wordsOf(MATCH_WORDS[phraseIndex])[0],
        skillCharge:{q:0,e:0,s:0,r:0},cooldownUntil:{q:0,e:0,s:0,r:0},shieldUntil:null,
        staggerUntil:0,combatStats:{damageDealt:0,damageTaken:0,casts:{q:0,e:0,r:0},counterDamage:0},defenseStats:{normalBlocks:0,perfectBlocks:0,parries:0,shieldBreaks:0,counters:0}};
    })};
  match.typing=normalizeTyping(options?.typing);
  match.stage=normalizeStage(pickStage(options?.stage,options?.rng||Math.random)); // sahne dengeyi değiştirmez
  // Paket 31: partner desteği yalnız açıkça istenirse açılır (oda ve bot maçı varsayılan olarak ister);
  // seçeneksiz/eski maçlar değişmez. Bar tur aralarında sıfırlanmaz.
  if(options?.assist===true){match.assistEnabled=true;for(const p of match.participants)p.assist={meter:0,cooldownUntil:0};}
  if(options?.exchangeMs>0&&options.rounds===undefined){
    const duration=Math.max(1,Math.trunc(options.exchangeMs));
    match.exchange={index:1,startedAt:at,endsAt:Math.min(at+duration,match.endsAt),phase:'typing',duration};
    // Klasik: tohum verilirse her oyuncunun cümleleri tohumdan üretilir (her maç farklı, sunucu durumundan deterministik).
    if(options.seed!==undefined&&options.seed!==null){
      match.phraseSeed=typeof options.seed==='string'||Number.isFinite(options.seed)?options.seed:randomSeed();
      for(const p of match.participants){p.phraseNo=0;setPhrase(match,p);}
    }
    return match;
  }
  if(!options||typeof options!=='object'||options.rounds===undefined)return match;
  return setupRounds(match,options,at);
}
export function pickRoundSkill(match,{playerId,skill},at=Date.now()){
  if(!match||match.mode!=='rounds'||match.status!=='running')return {error:'MATCH_NOT_ACTIVE'};
  const p=match.participants.find(x=>x.playerId===playerId);
  if(!p)return {error:'NOT_MATCH_PARTICIPANT'};
  if(match.roundStyle!=='timed')return {error:'ROUND_SKILL_NOT_TIMED'}; // kelime raundunda süre becerisi yok
  if(match.round.phase!=='intermission'||at>=match.round.nextRoundAt)return {error:'ROUND_SKILL_NOT_INTERMISSION'};
  if(skill!==null&&!ROUND_TIME_SKILLS.includes(skill))return {error:'INVALID_ROUND_SKILL'};
  if(match.roundSkillPickLocked?.[p.seat])return {error:'ROUND_SKILL_LOCKED'};
  if(skill&&(p.roundSkillUses?.[skill]||0)>=ARENA_MAX_USES)return {error:'ROUND_SKILL_EXHAUSTED'};
  const m=structuredClone(match),mine=roundPlayer(m,p.seat);
  m.roundSkillPicks[p.seat]=skill;
  m.roundSkillPickLocked[p.seat]=true;
  if(skill)mine.roundSkillUses[skill]=(mine.roundSkillUses[skill]||0)+1;
  m.sequence++;
  return {match:m,result:{seat:p.seat,skill,round:m.round.index+1,
    usesLeft:Object.fromEntries(ROUND_TIME_SKILLS.map(id=>[id,ARENA_MAX_USES-(mine.roundSkillUses[id]||0)]))}};
}
/** counted: tüm kelimeler (en çok 20). timed: yalnız görünen pencere; pencere öncesi indeksler '' ile doldurulur,
 * böylece words[roundWordIndex] her istemci kodunda doğru kelimeyi verir ve anlık görüntü küçük kalır (geçmiş kelime metni gitmez). */
function publicWords(match,viewer){
  const r=match.round,hinted=isContentMatch(match)&&match.content!=='atasozu'; // atasözünde ipucu yok (bayt tasarrufu)
  if(match.roundStyle!=='timed')return {words:[...r.words],...(hinted?{hints:[...r.hints]}:{})};
  const idx=Math.max(0,viewer?.roundWordIndex||0);
  const from=Math.max(0,idx-ROUND_VIEW_BEHIND);
  return {words:[...Array(from).fill(''),...r.words.slice(from,idx+ROUND_VIEW_AHEAD+1)],
    ...(hinted?{hints:[...Array(from).fill(''),...r.hints.slice(from,idx+ROUND_VIEW_AHEAD+1)]}:{})};
}
/** Çözüm fazının biteceği an: planın bitişi (son sahne + yerleşme; İş 12) ya da bekleyen son saldırı; yoksa null. */
function resolveEndsAt(match){
  const t=(match.pendingAttacks||[]).map(a=>a.resolveAt).filter(Number.isFinite);
  const until=match.round?.resolveUntil;
  if(Number.isFinite(until))t.push(until);
  return t.length?Math.max(...t):null;
}
export function publicMatch(match,viewerSeat){
  if(!match)return null;
  const {id,version,sequence,status,startedAt,endsAt,endedAt,winnerSeat,endReason}=match;
  const rounds=match.mode==='rounds';
  const r=match.round;
  const viewer=rounds&&[1,2].includes(viewerSeat)?roundPlayer(match,viewerSeat):null;
  const victim=viewer&&r?.phase==='round'&&roundPlayer(match,viewerSeat===1?2:1)?.roundSkill==='blindclock';
  return {matchId:id,version,sequence,status,startedAt,endsAt,endedAt,winnerSeat,endReason,
    mode:rounds?'rounds':'classic',...(rounds&&isContentMatch(match)?{content:match.content}:{}),stage:normalizeStage(match.stage),typing:normalizeTyping(match.typing),assistEnabled:match.assistEnabled===true,
    ...(match.exchange?{exchange:{index:match.exchange.index,endsAt:match.exchange.endsAt,phase:match.exchange.phase}}:{}),
    round:rounds&&r?{index:r.index,total:r.total,suddenDeath:r.suddenDeath,phase:r.phase,...publicWords(match,viewer),
      style:normalizeRoundStyle(match.roundStyle),...(Number.isInteger(r.wordCount)?{wordCount:r.wordCount}:{}),
      startedAt:victim?null:r.startedAt,endsAt:victim?null:r.endsAt,settleUntil:r.settleUntil,nextRoundAt:r.nextRoundAt,
      ...(r.phase==='resolve'||r.phase==='settling'?{resolveEndsAt:resolveEndsAt(match)}:{}),
      ...(viewer?{personalEndsAt:victim?null:Object.fromEntries(match.participants.map(p=>[p.seat,p.roundEndsAt])),
        skills:Object.fromEntries(match.participants.map(p=>[p.seat,p.roundSkill]))}:{})}:null,
    ...(rounds&&viewer?{blindClock:!!victim,
      ...(viewer?{roundSkillUsesLeft:Object.fromEntries(ROUND_TIME_SKILLS.map(id=>[id,ARENA_MAX_USES-(viewer.roundSkillUses?.[id]||0)])),
        roundSkillPick:r.phase==='intermission'?match.roundSkillPicks?.[viewerSeat]??null:null,
        roundSkillPickLocked:r.phase==='intermission'?!!match.roundSkillPickLocked?.[viewerSeat]:false}:{}),
      ...(victim?{endsAt:null}:{})}:{}),
    ...(rounds?{totalRounds:match.totalRounds,damageCap:ROUND_DAMAGE_CAP,roundHistory:structuredClone(match.roundHistory||[])}:{}),
    result: status==='ended'?matchResult(match):null,
    pausedAt:match.pausedAt??null,offlineSeats:match.offlineSeats||[],
    pendingAttackCount:match.pendingAttacks?.length||0,
    combatEvents:(match.combatEvents||[]).map(e=>({...e})),
    players:match.participants.map(p=>({playerId:p.playerId,seat:p.seat,name:p.name||`Oyuncu ${p.seat}`,character:p.character,fighter:normalizeFighter(p.fighter,p.character),
      hp:p.hp,maxHp:p.maxHp,rune:p.rune||'none',runeEnergy:p.runeEnergy||0,activeBonuses:p.rune!=='none'?[(p.character==='fire'?'Kızıl Öfke':'Mühür Birikimi')]:[],combo:p.combo,maxCombo:p.maxCombo||0,wordIndex:p.wordIndex,correctWords:p.correctWords,
      wrongWords:p.wrongWords,correctChars:p.correctChars,submittedChars:p.submittedChars,
      wpm:p.wpm,accuracy:p.accuracy,activeText:p.activeText,currentWord:p.currentWord,
      skillCharge:{...p.skillCharge},cooldownUntil:{...p.cooldownUntil},shieldUntil:p.shieldUntil,
      staggerUntil:p.staggerUntil||0,combatStats:{...(p.combatStats||{})},defenseStats:{...(p.defenseStats||{})},
      ...(match.assistEnabled===true?{assist:publicAssist(p)}:{}),
      ...(rounds?{streak:p.combo,multiplier:streakMultiplier(p.combo),nextSkill:nextSkillOf(p),roundWordIndex:p.roundWordIndex,
        roundCorrect:p.roundCorrect,roundWrong:p.roundWrong,roundBestStreak:p.roundBestStreak,roundDamage:p.roundDamage,roundHeal:p.roundHeal||0,
        roundDone:p.roundDone,finishedAt:p.finishedAt,...(viewer?{roundEndsAt:victim?null:p.roundEndsAt}:{})}:{})}))};
}
/** Tohumlu klasik maç: oyuncunun sıradaki cümlesi (iki oyuncu farklı, hiçbir cümle tekrarlanmaz). */
function setPhrase(match,p){
  const no=p.phraseNo=(p.phraseNo||0)+1;
  p.activeText=bankSentence({seed:`${match.phraseSeed}:c${p.seat}:${no}`,words:6+(no%3)});
  p.phraseWordIndex=0;p.currentWord=wordsOf(p.activeText)[0];
}
function nextWord(p,match){
  const phrase=wordsOf(p.activeText);p.phraseWordIndex++;
  if(match?.phraseSeed!==undefined&&p.phraseWordIndex>=phrase.length){setPhrase(match,p);return;}
  if(p.phraseWordIndex>=phrase.length){p.phraseIndex=(p.phraseIndex+1)%MATCH_WORDS.length;
    p.activeText=MATCH_WORDS[p.phraseIndex];p.phraseWordIndex=0;}
  p.currentWord=wordsOf(p.activeText)[p.phraseWordIndex];
}
function addEvent(match,type,fields){
  const event={id:match.nextCombatId++,type,...fields,...(match.activeTurn?{resolve:true,turn:match.activeTurn,at:match.activeResolveAt}: {})};
  match.combatEvents.push(event);
  if(match.combatEvents.length>24)match.combatEvents.splice(0,match.combatEvents.length-24);
  return event;
}
const cyclicProgress=combo=>combo%5;
/** Paket 31 — destek barı adımı (her kabul edilen kelimede). Bar doluyken gelen doğru kelime partner
 * saldırısını döndürür (bar sıfırlanır, bekleme başlar); aksi halde barı doldurur/azaltır ve null döner.
 * İstemciden hiçbir değer okunmaz. */
function assistStep(match,mine,target,correct,at,extra){
  const a=match.assistEnabled?mine.assist:null;
  if(!a)return null;
  if(!correct){a.meter=Math.max(0,a.meter-ASSIST_RULES.wrong);return null;}
  if(a.meter<ASSIST_RULES.max){a.meter=Math.min(ASSIST_RULES.max,a.meter+ASSIST_RULES.correct);return null;}
  if(at<a.cooldownUntil||at<(mine.staggerUntil||0))return null;
  a.meter=0;a.cooldownUntil=at+ASSIST_RULES.cooldownMs;
  const partner=assistPartner(mine.character);
  return {fromSeat:mine.seat,toSeat:target.seat,skill:'assist',assist:true,partner,character:partner,
    amount:assistDamage(target.maxHp),bonus:0,bonusTags:[],issuedAt:at,resolveAt:at+SHIELD_WINDOW_MS,...extra};
}
const publicAssist=p=>({meter:p.assist?.meter||0,ready:(p.assist?.meter||0)>=ASSIST_RULES.max,
  cooldownUntil:p.assist?.cooldownUntil||0,partner:assistPartner(p.character)});
/** Each cycle of five correct words awards Q at 2, E at 4, R at 5.
 * No physical Q/E/S/R key is intercepted. Cooldowns are server enforced. */
export function submitWord(match,{playerId,matchId,wordIndex,text,round},at=Date.now()){
  const rounds=match?.mode==='rounds';
  if(!match||match.status!=='running'||(!rounds&&at>=match.endsAt))return {error:'MATCH_NOT_ACTIVE'};
  if(match.exchange?.phase==='resolve')return {error:'EXCHANGE_NOT_ACTIVE'};
  if(matchId!==match.id)return {error:'MATCH_ID_MISMATCH'};
  const p=match.participants.find(x=>x.playerId===playerId);
  if(!p)return {error:'NOT_MATCH_PARTICIPANT'};
  if(rounds){
    if(match.round.phase!=='round'||at>=p.roundEndsAt||match.round.koSeat)return {error:'ROUND_NOT_ACTIVE'};
    if(round!==undefined&&round!==null&&round!==match.round.index)return {error:'ROUND_MISMATCH',round:match.round.index};
    if(p.roundDone)return {error:'ROUND_COMPLETE'};
  }
  if(!Number.isSafeInteger(wordIndex)||wordIndex!==p.wordIndex)return {error:'WORD_INDEX_MISMATCH',expectedIndex:p.wordIndex};
  if(typeof text!=='string'||!text.trim()||text.length>80||/\s/u.test(text.trim()))return {error:'INVALID_WORD'};
  const attempt=text.trim().normalize('NFC');if(attempt.length>80)return {error:'INVALID_WORD'};
  // Submissions arriving less than 55 ms apart cannot represent freshly typed words.
  // Compare only server timestamps; browser-supplied timestamps are ignored.
  if(Number.isFinite(p.lastSubmittedAt)&&at-p.lastSubmittedAt<55)return {error:'WORD_BURST_LIMIT'};
  if(rounds)return submitRoundWord(match,playerId,wordIndex,attempt,at);
  const next=structuredClone(match);
  const mine=next.participants.find(x=>x.playerId===playerId);
  mine.lastSubmittedAt=at;
  const expected=mine.currentWord;const correct=wordsMatch(attempt,expected,next.typing);
  const score=charScore(attempt,expected,next.typing);
  mine.correctChars+=score.correct;mine.submittedChars+=score.total;
  mine.correctWords+=Number(correct);mine.wrongWords+=Number(!correct);
  mine.combo=correct?mine.combo+1:0;if(mine.rune!=='none')mine.runeEnergy=correct?Math.min(5,(mine.runeEnergy||0)+1):0;mine.maxCombo=Math.max(mine.maxCombo||0,mine.combo);
  const progress=cyclicProgress(mine.combo);
  mine.skillCharge.q=Math.min(2,progress);mine.skillCharge.e=Math.min(4,progress);mine.skillCharge.r=Math.min(5,progress);
  // The R threshold is reached at combo=5. The new five-word cycle starts at zero.
  mine.accuracy=Math.round(mine.correctChars/Math.max(1,mine.submittedChars)*100);
  const elapsedMinutes=Math.max((at-next.startedAt)/60_000,1/60);
  mine.wpm=Math.round(mine.correctChars/5/elapsedMinutes);
  mine.wordIndex++;mine.lastWordAt=correct?at:null;
  nextWord(mine,next);
  let cast=null;
  if(correct){
    const step=mine.combo%5;
    const skill=step===2?'q':step===4?'e':step===0?'r':null;
    if(skill&&at>=mine.cooldownUntil[skill]&&at>=(mine.staggerUntil||0)){
      mine.cooldownUntil[skill]=at+COOLDOWNS[skill];
      mine.combatStats??={damageDealt:0,damageTaken:0,casts:{q:0,e:0,r:0},counterDamage:0};
      mine.combatStats.casts[skill]++;
      const empowered=computeSkillBonus(mine,skill,at);
      if(skill==='q'&&mine.parryCharge)mine.parryCharge=false;
      if(skill==='e'&&mine.character==='rune'&&mine.rune!=='none'&&mine.runeEnergy>=4)mine.runeEnergy=0;
      mine.lastSkill={skill,at};
      const target=next.participants.find(x=>x.seat!==mine.seat);
      const attack={fromSeat:mine.seat,toSeat:target.seat,skill,character:mine.character,
        amount:DAMAGE[mine.character][skill]+empowered.bonus,
        bonus:empowered.bonus,bonusTags:empowered.tags,issuedAt:at,resolveAt:at+SHIELD_WINDOW_MS,
        // İş 12: pencere modunda yazarken olay üretilmez → kimlik burada tüketilir (iki ulti aynı kimliği almasın).
        ...(skill==='r'?{ultimateId:next.exchange?next.nextCombatId++:next.nextCombatId,phaseIndex:0}: {})};
      if(next.exchange)attack.resolveAt=Infinity;
      next.pendingAttacks.push(attack);
      if(!next.exchange)cast=addEvent(next,'SKILL_CAST',{...attack,at});
    }
  }
  let assistCast=null;
  const support=assistStep(next,mine,next.participants.find(x=>x.seat!==mine.seat),correct,at);
  if(support){
    if(next.exchange)support.resolveAt=Infinity;
    next.pendingAttacks.push(support);
    if(!next.exchange)assistCast=addEvent(next,'ASSIST_CAST',{...support,at});
  }
  next.sequence++;
  return {match:next,result:{accepted:true,correct,seat:mine.seat,wordIndex,submitted:attempt,
    expected,combo:mine.combo,correctWords:mine.correctWords,wrongWords:mine.wrongWords,
    accuracy:mine.accuracy,wpm:mine.wpm,nextIndex:mine.wordIndex,
    nextWord:mine.currentWord,skillCharge:{...mine.skillCharge},cast,
    ...(next.assistEnabled?{assistCast,assist:publicAssist(mine)}:{})}};
}
function ultimateTotal(character,bonus,multiplier){
  const phases=ULTIMATE_PHASES[character];
  return phases.reduce((sum,phase,i)=>sum+Math.round((phase.damage+(i===phases.length-1?bonus:0))*multiplier),0);
}
function scheduleAlternating(match,at){
  const queues={1:[],2:[]};
  for(const attack of match.pendingAttacks)queues[attack.fromSeat].push(attack);
  for(const seat of [1,2])queues[seat].sort((a,b)=>a.issuedAt-b.issuedAt||a.roundWordIndex-b.roundWordIndex);
  const ordered=[];
  while(queues[1].length||queues[2].length)for(const seat of [1,2])if(queues[seat].length)ordered.push(queues[seat].shift());
  // KESINYAP iş 12: çözüm süresi bekleyen vuruşlardan SAF planla (pvp/shared/resolve-timing.js; görsel kuyrukla aynı sabitler).
  // Sahnedeki vuruşlar sahne başında (1 ms arayla, sıra korunur) çözülür; görsel katman temas karesinde gösterir.
  const plan=planResolve(ordered,{maxMs:match.exchange?RESOLVE_SCENE.exchangeMaxMs:RESOLVE_SCENE.maxMs});
  match.pendingAttacks=ordered.map((attack,i)=>{
    const slot=plan.slots.get(attack);
    return {...attack,turn:i+1,resolve:true,resolveAt:at+slot.startMs+slot.slot,scene:slot.scene+1,sceneSlot:slot.slot,...(slot.fold?{fold:true}:{})};
  });
  const until=at+plan.totalMs;
  if(match.exchange)match.exchange.resolveUntil=until;
  else if(match.round)match.round.resolveUntil=until;
  return ordered.length;
}
/** Rounds yanlış kelime: seri yarıya iner (aşağı yuvarlanır). */
export const wrongStreak=streak=>Math.floor(Math.max(0,Number(streak)||0)/2);
/** Round mode: every attempt consumes the word; absolute streak thresholds cast Q/E/R (no Q/E/R cooldowns). */
function submitRoundWord(match,playerId,wordIndex,attempt,at){
  const next=structuredClone(match);const round=next.round;
  const mine=next.participants.find(x=>x.playerId===playerId);
  const target=next.participants.find(x=>x.seat!==mine.seat);
  mine.lastSubmittedAt=at;
  const index=mine.roundWordIndex;const expected=round.words[index];const correct=wordsMatch(attempt,expected,next.typing);
  const score=charScore(attempt,expected,next.typing);
  mine.correctChars+=score.correct;mine.submittedChars+=score.total;
  mine.correctWords+=Number(correct);mine.wrongWords+=Number(!correct);
  mine.roundCorrect+=Number(correct);mine.roundWrong+=Number(!correct);
  // İş 13: rounds'ta yanlış kelime seriyi sıfırlamaz, YARIYA indirir (aşağı yuvarlanır: 8→4, 7→3, 5→2, 3→1, 1→0).
  const streakBefore=mine.combo;
  mine.combo=correct?mine.combo+1:wrongStreak(mine.combo);if(mine.rune!=='none')mine.runeEnergy=correct?Math.min(5,(mine.runeEnergy||0)+1):0;
  mine.maxCombo=Math.max(mine.maxCombo||0,mine.combo);mine.roundBestStreak=Math.max(mine.roundBestStreak||0,mine.combo);
  mine.skillCharge.q=Math.min(3,mine.combo);mine.skillCharge.e=Math.min(5,mine.combo);mine.skillCharge.h=Math.min(7,mine.combo);mine.skillCharge.r=Math.min(10,mine.combo);
  mine.accuracy=Math.round(mine.correctChars/Math.max(1,mine.submittedChars)*100);
  const activeMinutes=Math.max(((next.activeMs||0)+Math.max(0,at-round.startedAt))/60_000,1/60);
  mine.wpm=Math.round(mine.correctChars/5/activeMinutes);
  mine.wordIndex++;mine.lastWordAt=correct?at:null;
  if(correct){mine.lastCorrectAt=at;mine.lastCorrectRoundIndex=index;}
  mine.roundWordIndex++;
  if(next.roundStyle==='timed')ensureRoundWords(next,mine.roundWordIndex+ROUND_VIEW_AHEAD+1);
  mine.currentWord=round.words[mine.roundWordIndex]??'';
  let cast=null;
  const skill=correct?streakSkill(mine.combo):null;
  if(skill==='h'){
    // E (kendine can): hemen uygulanır (sahne kuyruğuna girmez; vuruş sırası/çözüm planı değişmez). Çarpan yok;
    // can azami canı ve raund iyileşme tavanını (ROUND_HEAL_CAP) aşamaz → hasar tavanı/4. raund nakavt sınırı korunur.
    mine.combatStats??={damageDealt:0,damageTaken:0,casts:{q:0,e:0,h:0,r:0},counterDamage:0};
    mine.combatStats.casts.h=(mine.combatStats.casts.h||0)+1;
    const base=healAmount(mine.character);
    const room=Math.max(0,Math.min((mine.maxHp||ROUND_HP)-mine.hp,ROUND_HEAL_CAP-(mine.roundHeal||0)));
    const amount=mine.hp>0?Math.min(base,room):0;
    mine.hp+=amount;mine.roundHeal=(mine.roundHeal||0)+amount;
    mine.combatStats.healDone=(mine.combatStats.healDone||0)+amount;
    cast=addEvent(next,'HEAL_APPLIED',{seat:mine.seat,fromSeat:mine.seat,toSeat:mine.seat,skill:'h',character:mine.character,
      fighter:mine.fighter,amount,base,capped:amount<base,hpAfter:mine.hp,round:round.index,streak:mine.combo,at});
  }else if(skill&&at>=(mine.staggerUntil||0)){
    mine.combatStats??={damageDealt:0,damageTaken:0,casts:{q:0,e:0,h:0,r:0},counterDamage:0};
    mine.combatStats.casts[skill]=(mine.combatStats.casts[skill]||0)+1;
    const empowered=computeSkillBonus(mine,skill,at);
    if(skill==='q'&&mine.parryCharge)mine.parryCharge=false;
    if(skill==='e'&&mine.character==='rune'&&mine.rune!=='none'&&mine.runeEnergy>=4)mine.runeEnergy=0;
    mine.lastSkill={skill,at};
    const multiplier=streakMultiplier(mine.combo);
    const amount=skill==='r'?ultimateTotal(mine.character,empowered.bonus,multiplier)
      :Math.round((DAMAGE[mine.character][skill]+empowered.bonus)*multiplier);
    const attack={fromSeat:mine.seat,toSeat:target.seat,skill,character:mine.character,amount,
      bonus:empowered.bonus,bonusTags:empowered.tags,issuedAt:at,resolveAt:at+SHIELD_WINDOW_MS,
      multiplier,streak:mine.combo,round:round.index,roundWordIndex:index,chain:mine.combo>10,
      // İş 12: resolveAtEnd'de yazarken olay üretilmez → nextCombatId artmaz → aynı raunttaki iki ulti aynı kimliği alıyordu;
      // istemci ikincisini "bitmiş ultinin kopyası" sayıp atlıyor, hasarı sahnesiz düşüyordu. Kimlik burada tüketilir (yalnız kimlik).
      ...(skill==='r'?{ultimateId:next.resolveAtEnd?next.nextCombatId++:next.nextCombatId,phaseIndex:0}: {})};
    // Clash (spec 5): the opponent already cast on the very same word within the shield window.
    const partner=next.pendingAttacks.find(a=>a.fromSeat===target.seat&&a.toSeat===mine.seat&&!a.counter&&!a.assist&&!a.clashId
      &&a.round===round.index&&a.roundWordIndex===index&&(a.phaseIndex===undefined||a.phaseIndex===0)
      &&Math.abs(a.issuedAt-at)<=SHIELD_WINDOW_MS);
    if(partner){
      const clashId=`r${round.index}:w${index}`;
      const blocker=partner.issuedAt<at?partner.fromSeat:partner.issuedAt>at?mine.seat
        :(partner.streak>mine.combo?partner.fromSeat:mine.combo>partner.streak?mine.seat:1);
      for(const a of [partner,attack])Object.assign(a,{clashId,clashBlockerSeat:blocker,clashInterval:Math.abs(at-partner.issuedAt)});
    }
    if(next.resolveAtEnd)attack.resolveAt=Infinity;
    next.pendingAttacks.push(attack);
    if(!next.resolveAtEnd)cast=addEvent(next,'SKILL_CAST',{...attack,at});
  }
  let assistCast=null;
  const support=assistStep(next,mine,target,correct,at,{round:round.index,roundWordIndex:index});
  if(support){
    if(next.resolveAtEnd)support.resolveAt=Infinity;
    next.pendingAttacks.push(support);
    if(!next.resolveAtEnd)assistCast=addEvent(next,'ASSIST_CAST',{...support,at});
  }
  next.sequence++;
  const roundEvents=[];
  if(next.roundStyle!=='timed'&&mine.roundWordIndex>=round.words.length){
    mine.roundDone=true;mine.finishedAt=at;
    // KELİME RAUNDU: ilk bitiren raundu bitirir; rakibin o ana kadar yazdıkları sayılır, kalanı yazamaz (roundEndsAt=at → ROUND_NOT_ACTIVE).
    round.allDone=true;
    target.roundEndsAt=Math.min(target.roundEndsAt,at);
    syncRoundEnds(next);
  }
  return {match:next,result:{accepted:true,correct,seat:mine.seat,wordIndex,submitted:attempt,
    expected,combo:mine.combo,correctWords:mine.correctWords,wrongWords:mine.wrongWords,
    accuracy:mine.accuracy,wpm:mine.wpm,nextIndex:mine.wordIndex,
    nextWord:mine.currentWord,skillCharge:{...mine.skillCharge},cast,
    ...(next.assistEnabled?{assistCast,assist:publicAssist(mine)}:{}),
    round:round.index,streak:mine.combo,streakBefore,multiplier:streakMultiplier(mine.combo),nextSkill:nextSkillOf(mine),
    roundWordIndex:mine.roundWordIndex,roundDone:mine.roundDone,roundEvents}};
}
/** Resolve server-authorized combat, including reactive blocks and queued counters.
 * Every random decision is made here, never from an attacker-supplied packet.
 * Counter strikes cannot be parried or reflected, preventing infinite loops.
 */
export function resolveDueAttacks(match,at=Date.now(),rng=Math.random){
  if(!match||match.status!=='running'||!match.pendingAttacks?.some(a=>a.resolveAt<=at))
    return {match,events:[]};
  const next=structuredClone(match);const events=[];
  const rounds=next.mode==='rounds';
  next.pendingAttacks.sort((a,b)=>a.resolveAt-b.resolveAt||a.issuedAt-b.issuedAt||a.fromSeat-b.fromSeat);
  while(next.pendingAttacks.length&&next.pendingAttacks[0].resolveAt<=at&&next.status==='running'&&!(rounds&&next.round.koSeat)){
    const attack=next.pendingAttacks.shift();
    if(attack.resolve){next.activeTurn=attack.turn;next.activeResolveAt=attack.resolveAt;
      if(!attack.counter&&(!Number.isInteger(attack.phaseIndex)||attack.phaseIndex===0))
        events.push(addEvent(next,attack.assist?'ASSIST_CAST':'SKILL_CAST',{...attack,at:attack.resolveAt}));}
    if(rounds)next.round.lastResolvedAt=Math.max(next.round.lastResolvedAt??-Infinity,attack.resolveAt);
    const defender=next.participants.find(x=>x.seat===attack.toSeat);
    const attacker=next.participants.find(x=>x.seat===attack.fromSeat);
    if(!defender||!attacker)continue;
    const stats=defender.defenseStats||(defender.defenseStats={normalBlocks:0,perfectBlocks:0,parries:0,shieldBreaks:0,counters:0});
    const guarded=!attack.unblockable&&Boolean(defender.shieldUntil&&defender.shieldUntil>=(attack.resolve?attack.resolveAt:attack.issuedAt));
    const interval=defender.lastWordAt===null?Infinity:Math.abs(defender.lastWordAt-attack.issuedAt);
    const remembered=attack.skill==='r'&&attack.ultimateDefense;
    let reactive,perfect,parried;
    if(rounds&&attack.clashId&&!attack.resolve&&!remembered&&!attack.unblockable){
      // Spec 5: one roll per clash; only the earlier submitter may block. The partner attack reuses the verdict.
      let verdict=next.clashes[attack.clashId];
      if(!verdict){
        const blocker=next.participants.find(x=>x.seat===attack.clashBlockerSeat);
        let blockerSeat=null,blockKind=null;
        // KESINYAP 11: rounds'ta rastgele blok yok; çarpışma yalnız gösterilir (ikisi de vurur).
        if(!rounds&&blocker&&attack.issuedAt>=(blocker.cooldownUntil.s||0)&&rng()<SHIELD_PROBABILITY){
          const gap=attack.clashInterval;
          const isPerfect=gap<=DEFENSE_RULES.perfectWindowMs+(blocker.rune==='reflex'?25:0);
          const isParry=isPerfect&&gap<=DEFENSE_RULES.parryWindowMs&&rng()<DEFENSE_RULES.parryChance;
          blockerSeat=blocker.seat;blockKind=isParry?'PARRY':isPerfect?'PERFECT_BLOCK':'NORMAL_BLOCK';
        }
        verdict=next.clashes[attack.clashId]={blockerSeat,blockKind};
        events.push(addEvent(next,'WORD_CLASH',{clashId:attack.clashId,seats:[1,2],roundWordIndex:attack.roundWordIndex,
          word:next.round.words[attack.roundWordIndex]??null,blockerSeat,blockKind,at:attack.resolveAt}));
      }
      reactive=verdict.blockerSeat===defender.seat;
      perfect=reactive&&verdict.blockKind!=='NORMAL_BLOCK';
      parried=reactive&&verdict.blockKind==='PARRY';
    }else{
      // Round mode: a one-sided reactive shield also needs the defender's correct word on the same list index.
      const sameWord=!rounds||(attack.roundWordIndex!==undefined&&defender.lastCorrectRoundIndex===attack.roundWordIndex);
      const canReact=(attack.resolve||sameWord)&&!remembered&&!attack.unblockable&&
        (attack.resolve||interval<=SHIELD_WINDOW_MS)&&(attack.resolve?attack.resolveAt:attack.issuedAt)>=(defender.cooldownUntil.s||0);
      // KESINYAP 11: rounds modunda rastgele kalkan/parry hasarı etkilemez (zar atılmaz); klasik aynen.
      reactive=!rounds&&canReact&&rng()<SHIELD_PROBABILITY;
      perfect=reactive&&(attack.resolve||interval<=DEFENSE_RULES.perfectWindowMs+(defender.rune==='reflex'?25:0));
      parried=perfect&&(attack.resolve||interval<=DEFENSE_RULES.parryWindowMs)&&rng()<DEFENSE_RULES.parryChance;
    }
    const timedBlock=reactive;
    const shieldBreak=guarded&&!timedBlock&&Object.hasOwn(DEFENSE_RULES.heavyPenetration,attack.skill);
    const ultimate=attack.skill==='r'&&Number.isInteger(attack.phaseIndex)&&attack.ultimateId;
    const phases=ultimate?ULTIMATE_PHASES[attack.character]:null;
    let amount=ultimate?phases[attack.phaseIndex].damage+(attack.phaseIndex===phases.length-1?(attack.bonus||0):0):attack.amount;
    // Round-mode streak multiplier: each ultimate phase is rounded separately (spec 4).
    if(ultimate&&Number.isFinite(attack.multiplier))amount=Math.round(amount*attack.multiplier);
    let blocked=false,blockKind=null,capped=false;
    // Subsequent hits of one ultimate reuse the FIRST hit's defense verdict.
    // Otherwise one five-word R could roll three unrelated 30% parries.
    if(remembered){
      amount=remembered.blocked?0:Math.round(amount*remembered.multiplier);
      blocked=remembered.blocked;blockKind=remembered.blockKind;
    }else{

    if(shieldBreak){
      defender.shieldUntil=null;
      amount=Math.round(amount*DEFENSE_RULES.heavyPenetration[attack.skill]);
      stats.shieldBreaks++;
      events.push(addEvent(next,'SHIELD_BROKEN',{seat:defender.seat,bySeat:attacker.seat,skill:attack.skill,at:attack.issuedAt}));
    }else if(guarded||timedBlock){
      amount=0;blocked=true;
      blockKind=parried?'PARRY':perfect?'PERFECT_BLOCK':'NORMAL_BLOCK';
      if(timedBlock){
        const defenseAt=attack.resolve?attack.resolveAt:attack.issuedAt;
        defender.shieldUntil=defenseAt+SHIELD_DURATION_MS;
        defender.cooldownUntil.s=defenseAt+COOLDOWNS.s-(defender.rune==='crystal'?200:0);
        if(parried){
          stats.parries++;if(defender.rune&&defender.rune!=='none'){defender.parryCharge=true;defender.runeEnergy=Math.min(5,(defender.runeEnergy||0)+1);}
          attacker.staggerUntil=Math.max(attacker.staggerUntil||0,attack.issuedAt+DEFENSE_RULES.staggerMs);
          events.push(addEvent(next,'PARRY_TRIGGERED',{seat:defender.seat,againstSeat:attacker.seat,skill:attack.skill,at:attack.issuedAt}));
          const counter={fromSeat:defender.seat,toSeat:attacker.seat,skill:'counter',character:defender.character,
            amount:DEFENSE_RULES.counterDamage,issuedAt:attack.resolveAt,resolveAt:attack.resolveAt+DEFENSE_RULES.counterDelayMs,
            unblockable:true,counter:true,...(attack.resolve?{resolve:true,turn:attack.turn}: {})};
          // İş 12: karşı saldırı kendi sahnesinde oynar → sıradaki sahneler (ve çözüm bitişi) onun kadar kayar.
          if(attack.resolve&&attack.scene){
            // Yalnız SONRAKİ sahneler kayar: aynı sahnenin kalan vuruşları (ve ulti fazları) o sahnenin yaklaşmasında kalır;
            // önceden onlar da 6,1 sn kayıyor, sahne bitmiş olduğundan hasar sahnesiz düşüyordu (classic ölçümü: 3 destek).
            for(const p of next.pendingAttacks)if(p.resolve&&p.scene>attack.scene)p.resolveAt+=RESOLVE_SCENE.counterMs;
            if(next.exchange?.resolveUntil)next.exchange.resolveUntil+=RESOLVE_SCENE.counterMs;
            if(next.round?.resolveUntil)next.round.resolveUntil+=RESOLVE_SCENE.counterMs;
          }
          next.pendingAttacks.push(counter);
          stats.counters++;
          events.push(addEvent(next,'COUNTERATTACK_CAST',{...counter,at:attack.resolveAt}));
        }else{
          if(perfect)stats.perfectBlocks++;else stats.normalBlocks++;
          events.push(addEvent(next,'SHIELD_TRIGGERED',{seat:defender.seat,againstSeat:attacker.seat,skill:'s',
            at:attack.issuedAt,kind:blockKind}));
        }
      }else stats.normalBlocks++;
    }
    }
    if(ultimate&&!remembered){
      attack.ultimateDefense={blocked,blockKind,multiplier:shieldBreak?DEFENSE_RULES.heavyPenetration.r:1};
    }
    if(!blocked){
      if(defender.rune==='laststand'&&!defender.lastStandUsed&&defender.hp<=Math.round(defender.maxHp*.3)){
        amount=Math.round(amount*.8);defender.lastStandUsed=true;
        events.push(addEvent(next,'RUNE_TRIGGERED',{seat:defender.seat,rune:'laststand',at:attack.resolveAt}));
      }
      // Raund hasar tavanı: bir oyuncu tek raundda en çok ROUND_DAMAGE_CAP verir; fazlası verilmez.
      if(rounds){const room=Math.max(0,ROUND_DAMAGE_CAP-(attacker.roundDamage||0));if(amount>room){amount=room;capped=true;}}
      const before=defender.hp;
      defender.hp=Math.max(0,before-amount);
      const dealt=before-defender.hp;
      attacker.combatStats??={damageDealt:0,damageTaken:0,casts:{q:0,e:0,r:0},counterDamage:0};
      defender.combatStats??={damageDealt:0,damageTaken:0,casts:{q:0,e:0,r:0},counterDamage:0};
      attacker.combatStats.damageDealt+=dealt;
      if(attack.counter)attacker.combatStats.counterDamage+=dealt;
      defender.combatStats.damageTaken+=dealt;
      if(rounds)attacker.roundDamage=(attacker.roundDamage||0)+dealt;
      // Paket 31: yenen hasar destek barına küçük bir geri dönüş payı ekler.
      if(next.assistEnabled&&defender.assist)defender.assist.meter=Math.min(ASSIST_RULES.max,defender.assist.meter+assistGainFromDamage(dealt));
    }
    if(ultimate){
      const phase=phases[attack.phaseIndex];
      events.push(addEvent(next,'ULTIMATE_PHASE',{fromSeat:attack.fromSeat,toSeat:attack.toSeat,
        skill:'r',character:attack.character,ultimateId:attack.ultimateId,
        phase:attack.phaseIndex+1,totalPhases:phases.length,phaseName:phase.name,
        effect:phase.effect,blocked,amount,at:attack.resolveAt,
        motion:ULTIMATE_MOTIONS[attack.phaseIndex]||'strike',multiplier:Number.isFinite(attack.multiplier)?attack.multiplier:1,
        returnAt:(attack.resolve?attack.resolveAt-phases[attack.phaseIndex].offset:attack.issuedAt+SHIELD_WINDOW_MS)+phases[phases.length-1].offset+ULTIMATE_RETURN_MS}));
    }
    events.push(addEvent(next,'DAMAGE_APPLIED',{fromSeat:attack.fromSeat,toSeat:defender.seat,
      skill:attack.skill,amount,blocked,blockKind,shieldBreak,counter:Boolean(attack.counter),bonusTags:attack.bonusTags||[],
      at:attack.issuedAt,hpAfter:defender.hp,...(capped?{capped:true}:{}),...(attack.assist?{assist:true,partner:attack.partner}:{}),
      ...(ultimate?{ultimateId:attack.ultimateId,phase:attack.phaseIndex+1,totalPhases:phases.length}: {})}));
    if(defender.hp===0&&rounds){
      // KO: advanceMatch closes the round and, since HP carries over, the match (NAKAVT).
      next.round.koSeat=attack.fromSeat;next.round.koAt=attack.resolveAt;next.pendingAttacks=[];
    }else if(defender.hp===0){
      next.status='ended';next.endedAt=at;next.winnerSeat=attack.fromSeat;next.endReason='KNOCKOUT';
      next.pendingAttacks=[];
    }else if(ultimate&&attack.phaseIndex<phases.length-1){
      // Schedule one queued object per ultimate: cooldown, replay safety and alarm
      // behavior remain compatible with previous work packages.
      const nextIndex=attack.phaseIndex+1;
      next.pendingAttacks.push({...attack,phaseIndex:nextIndex,
        resolveAt:attack.resolve?attack.resolveAt+phases[nextIndex].offset-phases[attack.phaseIndex].offset
          :attack.issuedAt+SHIELD_WINDOW_MS+phases[nextIndex].offset});
    }
    next.pendingAttacks.sort((a,b)=>a.resolveAt-b.resolveAt||a.issuedAt-b.issuedAt||a.fromSeat-b.fromSeat);
    delete next.activeTurn;delete next.activeResolveAt;
  }
  if(events.length)next.sequence++;
  return {match:next,events};
}

export function finishMatch(match,at=Date.now()){
  if(!match||match.mode==='rounds'||match.status!=='running'||at<match.endsAt)return match;
  const next=structuredClone(match);next.status='ended';next.endedAt=at;next.sequence++;
  const [a,b]=next.participants;
  next.winnerSeat=a.hp===b.hp?null:(a.hp>b.hp?a.seat:b.seat);
  next.endReason='TIME_LIMIT';next.pendingAttacks=[];return next;
}
/** KESINYAP 11: raund kazanma/pip yok. Can taşınır; maç NAKAVT'la ya da 7. raund sonunda (canı fazla olan) biter;
 * eşitse ani ölüm raundu (en çok SUDDEN_DEATH_MAX). Raund `winnerSeat` yalnız bilgi: KO'cu ya da o raund daha çok hasar veren. */
function closeRound(match,closeAt,reason,roundEvents){
  const m=structuredClone(match);const r=m.round;
  const scores=[...m.participants].sort((a,b)=>a.seat-b.seat).map(p=>({seat:p.seat,correct:p.roundCorrect,wrong:p.roundWrong,
    bestStreak:p.roundBestStreak,damageDealt:p.roundDamage,hpLeft:p.hp,rp:roundScore(p),lastCorrectAt:p.lastCorrectAt}));
  const [a,b]=scores;
  const winnerSeat=reason==='KO'?r.koSeat:(a.damageDealt===b.damageDealt?null:(a.damageDealt>b.damageDealt?a.seat:b.seat));
  m.pendingAttacks=[];
  m.activeMs=(m.activeMs||0)+Math.max(0,Math.min(closeAt,r.endsAt)-r.startedAt);
  const hp=Object.fromEntries(scores.map(s=>[s.seat,s.hpLeft]));
  let over=false,matchWinner=null,endReason='ROUNDS';
  if(reason==='KO'){over=true;matchWinner=r.koSeat;endReason='KNOCKOUT';}
  else if(r.index>=r.total){
    if(hp[1]!==hp[2]){over=true;matchWinner=hp[1]>hp[2]?1:2;}
    else if(r.index-r.total>=SUDDEN_DEATH_MAX){over=true;endReason='ROUNDS_DRAW';}
  }
  r.phase=over?'ended':'intermission';r.endedAt=closeAt;
  r.nextRoundAt=over?null:closeAt+ROUND_SUMMARY_MS+ROUND_INTRO_MS;
  if(over){m.status='ended';m.endedAt=closeAt;m.winnerSeat=matchWinner;m.endReason=endReason;m.offlineSeats=[];}
  const nextIndex=r.index+1;
  const next=over?null:{round:nextIndex,suddenDeath:nextIndex>r.total,style:normalizeRoundStyle(m.roundStyle),
    ...(m.roundStyle==='timed'?{seconds:ROUND_DURATION_MS/1000}:{words:roundWordsFor(nextIndex)})};
  const payload={round:r.index,winnerSeat,reason,scores,hp,nextRoundAt:r.nextRoundAt,matchOver:over,suddenDeath:r.suddenDeath,next};
  m.roundHistory.push(structuredClone(payload));
  m.sequence++;
  roundEvents.push({type:'ROUND_END',payload,sequence:m.sequence});
  return m;
}
/** One authoritative clock step: resolves due attacks and applies every overdue round transition in order.
 * Classic mode: resolveDueAttacks + finishMatch. Returns the same object when nothing changed. */
export function advanceMatch(match,at=Date.now(),rng=Math.random){
  if(!match||match.status!=='running')return {match,events:[],roundEvents:[]};
  if(match.exchange){
    let m=match;const events=[],roundEvents=[];
    for(let guard=0;guard<256&&m.status==='running';guard++){
      if(m.exchange.phase==='typing'){
        if(at<m.exchange.endsAt)break;
        m=structuredClone(m);m.exchange.phase='resolve';
        const turns=scheduleAlternating(m,m.exchange.endsAt);m.sequence++;
        roundEvents.push({type:'EXCHANGE_RESOLVE',payload:{index:m.exchange.index,turns},sequence:m.sequence});
        continue;
      }
      const settled=resolveDueAttacks(m,at,rng);m=settled.match;events.push(...settled.events);
      const resolveUntil=Math.max(m.exchange.endsAt,m.exchange.resolveUntil??-Infinity);
      if(m.status!=='running'||m.pendingAttacks.length||at<resolveUntil)break;
      if(m.exchange.endsAt>=m.startedAt+MATCH_DURATION_MS){m=finishMatch(m,at);break;}
      // Sonraki pencere çözüm (vuruşların oynatılması) BİTİNCE başlar; yoksa çözüm süresi
      // bir sonraki 10 sn'lik pencereden yenir ("Pencere 3 · 3 sn" hatası). İş 12: bitiş = plan bitişi (son sahne + yerleşme).
      m=structuredClone(m);m.exchange.index++;m.exchange.startedAt=Math.max(at,resolveUntil);delete m.exchange.resolveUntil;
      m.exchange.endsAt=Math.min(m.exchange.startedAt+m.exchange.duration,m.startedAt+MATCH_DURATION_MS);
      m.exchange.phase='typing';m.sequence++;
      roundEvents.push({type:'EXCHANGE_START',payload:{index:m.exchange.index,endsAt:m.exchange.endsAt},sequence:m.sequence});
      if(at<m.exchange.endsAt)break;
    }
    return {match:m,events,roundEvents};
  }
  if(match.mode!=='rounds'){
    const settled=resolveDueAttacks(match,at,rng);
    return {match:finishMatch(settled.match,at),events:settled.events,roundEvents:[]};
  }
  let m=match;const events=[],roundEvents=[];
  for(let guard=0;guard<64&&m.status==='running';guard++){
    const phase=m.round.phase;
    if(m.resolveAtEnd){
      if(phase==='round'){
        if(at<m.round.endsAt&&!m.round.allDone)break;
        m=structuredClone(m);m.round.phase='resolve';
        const startedAt=m.round.allDone?Math.min(at,m.round.endsAt):m.round.endsAt;
        const turns=scheduleAlternating(m,startedAt);m.sequence++;
        roundEvents.push({type:'ROUND_RESOLVE',payload:{round:m.round.index,turns},sequence:m.sequence});
        continue;
      }
      if(phase==='resolve'){
        const settled=resolveDueAttacks(m,at,rng);m=settled.match;events.push(...settled.events);
        if(m.round.koSeat){m=closeRound(m,m.round.koAt,'KO',roundEvents);continue;}
        if(m.pendingAttacks.length)break;
        // İş 12: raund arası kartı son sahne bitip dövüşçüler yerine dönünce (plan bitişi) açılır.
        const closeAt=Math.max(m.round.endsAt,m.round.lastResolvedAt??-Infinity,m.round.resolveUntil??-Infinity);
        if(at<closeAt)break;
        m=closeRound(m,closeAt,m.round.allDone?'ALL_DONE':'TIME',roundEvents);
        continue;
      }
    }
    if(phase==='round'||phase==='settling'){
      const boundary=phase==='round'?m.round.endsAt:m.round.settleUntil;
      const settled=resolveDueAttacks(m,Math.min(at,boundary),rng);
      m=settled.match;events.push(...settled.events);
      if(m.round.koSeat){m=closeRound(m,m.round.koAt,'KO',roundEvents);continue;}
      if(phase==='round'){
        if(at<m.round.endsAt)break;
        m=structuredClone(m);m.round.phase='settling';m.round.settleUntil=m.round.endsAt+ROUND_SETTLE_MS;m.sequence++;
        continue;
      }
      const reason=m.round.allDone?'ALL_DONE':'TIME';
      if(!m.pendingAttacks.length){m=closeRound(m,Math.max(m.round.endsAt,m.round.lastResolvedAt??-Infinity),reason,roundEvents);continue;}
      if(at>=m.round.settleUntil){m=closeRound(m,m.round.settleUntil,reason,roundEvents);continue;}
      break;
    }
    if(phase==='intermission'&&at>=m.round.nextRoundAt){
      m=structuredClone(m);startRound(m,m.round.nextRoundAt);m.sequence++;
      roundEvents.push({type:'ROUND_START',payload:roundStartPayload(m),sequence:m.sequence});
      continue;
    }
    break;
  }
  return {match:m,events,roundEvents};
}
/** The next instant at which advanceMatch has work to do (DO alarm time). */
export function nextDeadline(match){
  if(!match||match.status!=='running')return null;
  const pending=(match.pendingAttacks||[]).map(a=>a.resolveAt);
  if(match.exchange)return match.exchange.phase==='typing'?match.exchange.endsAt:(pending.length?Math.min(...pending):Math.max(match.exchange.endsAt,match.exchange.resolveUntil??-Infinity));
  if(match.mode!=='rounds')return Math.min(match.endsAt,...pending);
  const r=match.round;
  if(r.koSeat)return r.koAt;
  if(match.resolveAtEnd){if(r.phase==='round')return r.allDone?Math.max(...match.participants.map(p=>p.finishedAt??r.endsAt)):r.endsAt;
    if(r.phase==='resolve')return pending.length?Math.min(...pending):Math.max(r.endsAt,r.lastResolvedAt??-Infinity,r.resolveUntil??-Infinity);}
  if(r.phase==='round')return Math.min(r.endsAt,...pending);
  if(r.phase==='settling')return Math.min(r.settleUntil,...pending);
  if(r.phase==='intermission')return r.nextRoundAt;
  return null;
}
/** Immutable, server-derived post-game scorecard; never accepts client stats. */
export function matchResult(match){
  if(!match||match.status!=='ended')return null;
  const players=match.participants.map(p=>({
    seat:p.seat,playerId:p.playerId,name:p.name||`Oyuncu ${p.seat}`,character:p.character,fighter:normalizeFighter(p.fighter,p.character),
    hp:p.hp,maxHp:p.maxHp,wpm:p.wpm,accuracy:p.accuracy,combo:p.combo,maxCombo:p.maxCombo||0,
    correctWords:p.correctWords,wrongWords:p.wrongWords,
    damageDealt:p.combatStats?.damageDealt||0,damageTaken:p.combatStats?.damageTaken||0,
    skillCasts:{q:p.combatStats?.casts?.q||0,e:p.combatStats?.casts?.e||0,r:p.combatStats?.casts?.r||0,
      ...(match.mode==='rounds'?{h:p.combatStats?.casts?.h||0}:{})},
    ...(match.mode==='rounds'?{healDone:p.combatStats?.healDone||0}:{}),
    counterDamage:p.combatStats?.counterDamage||0,
    defense:{...(p.defenseStats||{})}
  }));
  const highest=Math.max(...players.map(p=>p.damageDealt));
  const top=players.filter(p=>p.damageDealt===highest);
  const mvpSeat=highest>0?(top.length===1?top[0].seat:(top.find(p=>p.seat===match.winnerSeat)?.seat||null)):null;
  return {matchId:match.id,winnerSeat:match.winnerSeat,endReason:match.endReason,
    startedAt:match.startedAt,endedAt:match.endedAt,
    durationMs:Math.max(0,(match.endedAt||match.endsAt)-match.startedAt),mvpSeat,players,
    ...(match.mode==='rounds'?{mode:'rounds',totalRounds:match.totalRounds,roundStyle:normalizeRoundStyle(match.roundStyle),
      finalHp:Object.fromEntries(match.participants.map(p=>[p.seat,p.hp])),
      rounds:structuredClone(match.roundHistory||[])}:{})};
}
export function surrenderMatch(match,loserSeat,at=Date.now()){
  if(!match||!['running','paused'].includes(match.status)||![1,2].includes(loserSeat))return match;
  const next=structuredClone(match);next.status='ended';next.endedAt=at;
  next.winnerSeat=loserSeat===1?2:1;next.endReason='SURRENDER';
  next.pendingAttacks=[];next.offlineSeats=[];next.sequence++;return next;
}
export const SERVER_ONLY_EVENTS=new Set(['MATCH_START','STATE_UPDATE','MATCH_END','WORD_RESULT','DAMAGE_APPLIED','SKILL_CAST','SHIELD_TRIGGERED','PARRY_TRIGGERED','COUNTERATTACK_CAST','SHIELD_BROKEN','ULTIMATE_PHASE','MATCH_PAUSED','MATCH_RESUMED','REMATCH_STATUS','REMATCH_COUNTDOWN','REMATCH_CANCELLED','MATCH_HISTORY',
  'ROUND_START','ROUND_LAST_CALL','ROUND_END','ROUND_RESOLVE','EXCHANGE_START','EXCHANGE_RESOLVE','ROUND_SKILL_ACK','WORD_CLASH','ASSIST_CAST','HEAL_APPLIED']);

/** Package 11: server-authoritative pause/recovery. Never advance combat clocks
 * while both peers cannot play. Pauses are persisted in DO storage. */
export function pauseMatch(match,at,offlineSeats=[]){
  if(!match||match.status==='ended')return match;
  const next=structuredClone(match);
  if(next.status!=='paused'){
    if(next.status!=='running')return match;
    next.status='paused';next.pausedAt=at;
  }
  next.offlineSeats=[...new Set(offlineSeats)].sort();
  next.sequence++;
  return next;
}
export function resumeMatch(match,at){
  if(!match||match.status!=='paused')return match;
  const next=structuredClone(match);
  const delta=Math.max(0,at-next.pausedAt);
  next.startedAt+=delta;next.endsAt+=delta;
  for(const p of next.participants){
    if(next.mode==='rounds'&&Number.isFinite(p.roundEndsAt))p.roundEndsAt+=delta;
    for(const skill of ['q','e','s','r'])if(p.cooldownUntil[skill]>0)p.cooldownUntil[skill]+=delta;
    if(p.shieldUntil!==null)p.shieldUntil+=delta;
    if(p.staggerUntil>0)p.staggerUntil+=delta;
    if(p.assist?.cooldownUntil>0)p.assist.cooldownUntil+=delta;
    if(p.lastWordAt!==null)p.lastWordAt+=delta;
    if(Number.isFinite(p.lastCorrectAt))p.lastCorrectAt+=delta;
    if(Number.isFinite(p.finishedAt))p.finishedAt+=delta;
  }
  if(next.round){
    for(const key of ['startedAt','endsAt','settleUntil','nextRoundAt','koAt','lastResolvedAt'])
      if(Number.isFinite(next.round[key]))next.round[key]+=delta;
  }
  if(next.exchange){next.exchange.startedAt+=delta;next.exchange.endsAt+=delta;}
  for(const attack of next.pendingAttacks){attack.issuedAt+=delta;attack.resolveAt+=delta;}
  next.status='running';next.pausedAt=null;next.offlineSeats=[];next.sequence++;
  return next;
}
export function endDisconnectedMatch(match,at,loserSeat=null){
  if(!match||match.status!=='paused')return match;
  const next=structuredClone(match);
  next.status='ended';next.endedAt=at;next.winnerSeat=loserSeat===null?null:(loserSeat===1?2:1);
  next.endReason=loserSeat===null?'BOTH_DISCONNECTED':'DISCONNECT_FORFEIT';
  next.pendingAttacks=[];next.offlineSeats=[];next.sequence++;
  return next;
}
