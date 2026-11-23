/**
 * Tur (raund) arayüzü — docs/TUR-SISTEMI.md §10.
 * Yalnızca sunucu (veya antrenman motoru) anlık görüntülerini ve ROUND_* / WORD_CLASH
 * olaylarını gösterir; hiçbir skor, süre ya da HP yerelde hesaplanmaz. Tüm metinler
 * textContent ile yazılır (sunucudan gelen isim/kelime HTML olarak yorumlanmaz).
 * Klasik maçta (mode!=='rounds' ya da round alanı yok) kök gizli kalır ve eski HUD aynen çalışır.
 */

import {FIGHTERS,normalizeFighter} from './shared/fighters.js';
import {portraitImg} from './portraits.js';
import {ROUND_DURATION_MS,ROUND_CAP_WARN_MS,roundDurationMs,ROUND_SUMMARY_MS,ROUND_INTRO_MS,ROUND_SETTLE_MS,RESOLVE_BUDGET_MS,roundSkillMs,
  ROUND_STYLES,DEFAULT_ROUND_STYLE,normalizeRoundStyle,ROUND_TOTAL,ROUND_HP,roundWordsFor,streakSkill,STREAK_SKILLS,ROUND_HEAL_CAP,MULTIPLIER_START,MULTIPLIER_CAP,ULTIMATE_MULTIPLIER_CAP,DEFENSE_AMOUNT,CHAIN_EVERY,CHAIN_EVERY_LONG,SHIELD_AMOUNT} from './shared/match.js';
import {SKILL_KEY} from './shared/fighters.js';
import {CONTENT_LABELS} from './shared/content-modes.js';
/** Rastgele içerik maçında raundun seçilen içeriği (iki oyuncu da aynı yazıyı görür): ' · ŞİİR'. */
export const roundContentTag=round=>round?.content&&CONTENT_LABELS[round.content]?` · ${CONTENT_LABELS[round.content].toLocaleUpperCase('tr-TR')}`:'';
export {ROUND_DURATION_MS,ROUND_SUMMARY_MS,ROUND_INTRO_MS,STREAK_SKILLS};
// KESINYAP 11: maç uzunluğu ve kelime sayısı seçeneği yok; her rounds maçı 7 raund, ROUND_HP taşınan can (raund hasar tavanı YOK).
export const ROUND_OPTIONS=Object.freeze([ROUND_TOTAL]);
export const DEFAULT_ROUNDS=ROUND_TOTAL;
export const ROUND_WORDS=10; // seri göstergesi hücre sayısı ve kelime şeridi penceresi
export const ROUND_LAST_CALL_MS=5_000;
export const STREAK_TICKS=Object.freeze([{at:3,key:'Q'},{at:5,key:'W'},{at:7,key:'E'},{at:10,key:'R'}]);
export const PRACTICE_ROUNDS_KEY='tuslab-pvp-practice-rounds';
export const PRACTICE_ROUND_STYLE_KEY='tuslab-pvp-practice-round-style';
export const ROUND_STYLE_LABELS=Object.freeze({timed:'Zamana karşı',counted:'Kelime raundu'});
export const ROUND_STYLE_TITLES=Object.freeze({timed:'ZAMANA KARŞI',counted:'KELİME RAUNDU'});
/** Tek satırlık hasar kuralı ipucu (lobi MAÇ AYARLARI). */
export const DAMAGE_RULE_HINT=`Seri 3 → Q · 5 → W · 7 → E (kalkan ${SHIELD_AMOUNT} ya da can ${DEFENSE_AMOUNT}) · 10 → R (en çok ×${String(ULTIMATE_MULTIPLIER_CAP).replace('.',',')}) · sonra ${10+CHAIN_EVERY}. ve her ${CHAIN_EVERY_LONG}. doğru kelime Q · 10. seriden sonra hasar çarpanı artar (en çok ×${String(MULTIPLIER_CAP).replace('.',',')}) · yanlış kelime serinin yarısını götürür · raund başına en çok ${ROUND_HEAL_CAP} kalkan/can`;
export {DEFAULT_ROUND_STYLE,normalizeRoundStyle,ROUND_HP};
const START_FLASH_MS=900;
/** Raund arası: "RAUND X" yazısı önce tek başına bu kadar görünür; sonra kompakt özet/seçim paneli açılır. */
export const ROUND_TITLE_MS=900;
/** holdTransition (ör. dövüş animasyonu bitişi) tur arasının başından sayılarak bu süreden uzun beklemez; panel yine açılır.
 *  Kalan görsel kuyruk panelin arkasında oynamaya devam edebilir (panel alt dock, sahne üstte açık). */
// İş 12: motor kartı son sahne bitince açar; bu yalnız güvenlik (sahne bitmeden kart açılmasın), en çok +3 sn.
export const ROUND_HOLD_MAX_MS=3000;
/** Bekletme bundan uzun sürdüyse "RAUND X" yazı aşaması atlanır, özet doğrudan açılır (özet ≥ ~3 sn okunur kalsın). */
export const ROUND_HOLD_TITLE_SKIP_MS=1000;
/** Tur arası aşaması: 'title' (yalnız büyük yazı) → 'panel' (özet + beceri seçimi) → 'count' (son geri sayım; özet GİZLENMEZ,
 *  geri sayım özetle birlikte/üstünde durur — rounds-ui.css `.rui-inter.is-count` gerekirse özeti kompakt tek satıra indirir). */
export function intermissionStage({elapsed=0,remaining=Infinity}={}){
  if(remaining<=ROUND_INTRO_MS)return 'count';
  if(elapsed<ROUND_TITLE_MS)return 'title';
  return 'panel';
}
const CLASH_MS=1300;
const BREAK_MS=900;
const PULSE_MS=300;

const num=n=>Number(n||0).toLocaleString('tr-TR');
const clamp01=v=>Math.max(0,Math.min(1,v));
const REASON_LABELS=Object.freeze({KO:'NAKAVT',TIME:'SÜRE DOLDU',ALL_DONE:'İKİ TARAF DA BİTİRDİ'});
const BLOCK_LABELS=Object.freeze({PERFECT_BLOCK:'PERFECT BLOK',PARRY:'PARRY',BLOCK:'BLOK'});
const END_REASON_LABELS=Object.freeze({ROUNDS:'KALAN CAN ÜSTÜNLÜĞÜ',ROUNDS_DRAW:'ANİ ÖLÜMDE DE BERABERE',KNOCKOUT:'NAKAVT'});

/** Eski kayıtlı 5/10 tercihleri sessizce 7'ye döner. */
export function normalizeRounds(){return DEFAULT_ROUNDS;}
const validRounds=value=>ROUND_OPTIONS.includes(Number(value));
export function isRoundMatch(match){return Boolean(match&&match.mode==='rounds'&&match.round&&typeof match.round==='object');}
/** Raund hasarı metni: '640' (raund hasar tavanı kaldırıldı). */
export function roundDamageText(damage){
  return String(Math.max(0,Math.round(Number(damage)||0)));
}
/** Raund ilerleme noktaları: 7 nokta, oynanmış (bitmiş) raundlar dolu. */
export function roundDots(index,total,phase){
  const t=Math.max(1,Number(total)||ROUND_TOTAL),i=Number(index)||1;
  const played=Math.min(t,Math.max(0,phase==='round'||phase==='settling'||phase==='resolve'?i-1:i));
  return {filled:played,total:t,current:Math.min(t,i)};
}
/** 'Sıradaki: RAUND 3 · 9 kelime' / '· 30 sn'. */
export function nextRoundText(next,style,total=ROUND_TOTAL){
  const idx=Number(next?.round)||0;if(!idx)return '';
  const st=normalizeRoundStyle(next?.style??style);
  const tail=st==='timed'?`${Number(next?.seconds)||ROUND_DURATION_MS/1000} sn`:`${Number(next?.words)||roundWordsFor(idx)} kelime`;
  return `Sıradaki: ${idx>total?'ANİ ÖLÜM':`RAUND ${idx}`} · ${tail}`;
}

/** M(seri) = seri<10 ? 1 : min(MULTIPLIER_CAP=2, 1.5 × 1.2^(seri−10)) — 2 ondalığa yuvarlanmış gösterim değeri (motorla aynı tavan; önceden 2,5 gösteriyordu). */
export function streakMultiplier(streak){
  const s=Math.max(0,Math.floor(Number(streak)||0));
  if(s<MULTIPLIER_START)return 1;
  return Math.min(MULTIPLIER_CAP,Math.round(1.5*1.2**(s-MULTIPLIER_START)*100)/100);
}
export function multiplierLabel(multiplier){
  const m=Number(multiplier)||1;
  return m>1?`×${String(Math.round(m*100)/100)}`:null;
}
const streakOf=p=>Math.max(0,Math.floor(Number(p?.streak??p?.combo)||0));

export function streakModel(streak,serverNextSkill){
  const s=Math.max(0,Math.floor(Number(streak)||0));
  const multiplier=streakMultiplier(s);
  const derived=streakSkill(s+1);
  const next=serverNextSkill===undefined?derived:serverNextSkill;
  return {streak:s,cells:ROUND_WORDS,filled:Math.min(s,ROUND_WORDS),
    ticks:STREAK_TICKS.map(t=>({...t,reached:s>=t.at})),
    nextSkill:next?(SKILL_KEY[next]||String(next).toUpperCase()):null,multiplier,multiplierLabel:multiplierLabel(multiplier),hot:s>=MULTIPLIER_START};
}

/** Sonraki doğru kelimede tetiklenecek büyü (tahmin yalnızca bekleme metni içindir). */
export function predictedSkill(player,match){
  if(match?.mode==='rounds'){const k=streakSkill(streakOf(player)+1);return k?SKILL_KEY[k]:null;}
  const future=(Number(player?.combo)||0)+1;
  return future%5===2?'Q':future%5===4?'E':future%5===0?'R':null;
}

const playerBySeat=(match,seat)=>match?.players?.find(p=>p.seat===seat)||null;
const mySeatOf=(match,myId)=>match?.players?.find(p=>p.playerId===myId)?.seat||null;
const nameOf=(match,seat)=>String(playerBySeat(match,seat)?.name||`Oyuncu ${seat}`);
const roundLabel=(index,total)=>index>total?'ANİ ÖLÜM':`RAUND ${index}`;
export const ROUND_SKILL_CARDS=Object.freeze([
  {id:'timethief',icon:'⏳',name:'Zaman Hırsızı',effect:'−5 sn rakibe'},
  {id:'blindclock',icon:'🌑',name:'Karanlık Saat',effect:'Rakip saati göremez'},
  {id:'freeze',icon:'❄',name:'Donmuş An',effect:'+3 sn kendine'}
]);
export function roundSkillPickerModel(match,myId){
  if(!isRoundMatch(match)||match.status!=='running'||match.round.phase!=='intermission')return {visible:false};
  const seat=mySeatOf(match,myId);
  if(!seat||match.round.style==='counted')return {visible:false}; // süre becerileri kelime raundunda yok
  const left=match.roundSkillUsesLeft||{};
  return {visible:true,locked:!!match.roundSkillPickLocked,pick:match.roundSkillPick??null,
    cards:ROUND_SKILL_CARDS.map(c=>({...c,left:Math.max(0,Number(left[c.id]??2))}))};
}

/** Fazın bitiş anı: round → kişisel süre, settling → settleUntil, resolve → son saldırı, intermission → sonraki raund. */
function phaseDeadline(match,seat){
  const round=match.round;
  switch(round.phase){
    case 'round':return round.personalEndsAt?.[seat]??playerBySeat(match,seat)?.roundEndsAt??(match.blindClock?null:round.endsAt);
    case 'settling':return round.settleUntil;
    case 'resolve':return round.resolveEndsAt;
    case 'intermission':return round.nextRoundAt;
    default:return null;
  }
}
/** Faz geçişi sunucu saatini bu kadar ms aştıysa (>0) anlık görüntü takılmış demektir. */
export function phaseOverdueMs(match,serverNow){
  if(!isRoundMatch(match)||match.status!=='running')return 0;
  const phase=match.round.phase;
  const deadline=phase==='round'?(match.blindClock?null:match.round.endsAt):phaseDeadline(match,null);
  return Number.isFinite(deadline)?Math.max(0,serverNow-deadline):0;
}
export const PHASE_STALL_MS=2000;
const PHASE_TOTAL_MS=Object.freeze({intermission:ROUND_SUMMARY_MS+ROUND_INTRO_MS,settling:ROUND_SETTLE_MS,resolve:RESOLVE_BUDGET_MS});
function timerOf(match,serverNow,seat){
  const round=match.round;
  const frozen=match.status==='paused'&&Number.isFinite(match.pausedAt);
  const ref=frozen?match.pausedAt:serverNow;
  const active=round.phase==='round';
  const hidden=active&&match.blindClock===true;
  const deadline=phaseDeadline(match,seat);
  const remaining=!hidden&&Number.isFinite(deadline)?Math.max(0,deadline-ref):0;
  const seconds=Math.ceil(remaining/1000);
  // Halka toplamı: temel süre + Donmuş An (+) − rakibin Zaman Hırsızı'sı; böylece hızlı/yavaş başlangıçta halka dolu başlar.
  const mine=round.skills?.[seat],rival=round.skills?.[seat===1?2:1];
  const baseMs=roundDurationMs({roundStyle:round.style,roundWords:Number.isInteger(round.wordCount)?round.wordCount:roundWordsFor(round.index)});
  const total=active?Math.max(1000,baseMs+(mine==='freeze'?roundSkillMs('freeze'):0)-(rival==='timethief'?roundSkillMs('timethief'):0))
    :(PHASE_TOTAL_MS[round.phase]||ROUND_DURATION_MS);
  return {remaining,seconds,text:hidden?'🌑 —':String(seconds),fraction:hidden?0:clamp01(remaining/total),
    hidden,urgent:active&&!hidden&&remaining<=ROUND_LAST_CALL_MS,frozen};
}

/** DEVIR-PVP 1: çözüm (settling/resolve) ve vuruşların bitmesi beklenen tur arası başı "RAUND N SONUCU" der; geri sayım yok. */
export function roundResultTitle(index,suddenDeath=false){return suddenDeath?'ANİ ÖLÜM SONUCU':`RAUND ${Number(index)||1} SONUCU`;}
/** Saf: raund sonucu gösterimi mi? settling/resolve her zaman; intermission yalnız görsel kuyruk bitmeyi beklerken (resultHold). */
export function isResultPhase(phase,resultHold=false){return phase==='settling'||phase==='resolve'||(phase==='intermission'&&Boolean(resultHold));}
/** Saf görünüm modeli: HUD'un tüm metinleri buradan gelir (test edilebilir).
 *  resultHold: tur arası geldi ama raundun vuruşları henüz ekranda bitmedi (rounds-ui geçiş kapısı açılmadı). */
export function roundsViewModel(match,myId,serverNow,marks,{lastCallRound=null,resultHold=false}={}){
  if(!isRoundMatch(match)||!['running','paused'].includes(match.status))return {visible:false};
  const round=match.round;
  const total=Number(round.total??match.totalRounds)||DEFAULT_ROUNDS;
  const index=Number(round.index)||1;
  const suddenDeath=Boolean(round.suddenDeath)||index>total;
  const mySeat=mySeatOf(match,myId)||1;
  const timer=timerOf(match,serverNow,mySeat);
  const players=[1,2].map(seat=>playerBySeat(match,seat));
  const anyDone=players.some(p=>p?.roundDone),allDone=players.every(p=>p?.roundDone);
  const countedRound=round.style==='counted';
  const lastCallActive=!countedRound&&round.phase==='round'&&!allDone&&(anyDone||(lastCallRound!==null&&Number(lastCallRound)===Number(round.index)));
  const dots=roundDots(index,total,round.phase);
  const me=playerBySeat(match,mySeat),opp=playerBySeat(match,mySeat===1?2:1);
  const myIdx=Number(me?.roundWordIndex)||0;
  // Kelime penceresi: timed modda sunucu yalnız pencereyi gönderir (öncesi '' ile dolu); counted'da 10'dan uzun listede kaydırılır.
  const allWords=Array.isArray(round.words)?round.words:[];
  const offset=Math.max(0,allWords.findIndex(w=>String(w)!==''));
  const start=Math.max(offset,Math.min(myIdx-1,allWords.length-ROUND_WORDS));
  const words=allWords.slice(start,start+ROUND_WORDS).map((text,k)=>{
    const i=start+k;
    return {text:String(text??''),
      state:i<myIdx?(marks?.get?.(i)||'done'):i===myIdx&&!me?.roundDone&&round.phase==='round'?'active':'todo',
      opponent:Boolean(opp&&!opp.roundDone&&Number(opp.roundWordIndex)===i)};
  });
  const timed=round.style==='timed';
  const wordTotal=timed?0:(Number(round.wordCount)||allWords.length||roundWordsFor(index));
  const sides=[1,2].map(seat=>{
    const p=playerBySeat(match,seat);
    const idx=timed?Math.max(0,Number(p?.roundWordIndex)||0):Math.min(wordTotal,Number(p?.roundWordIndex)||0);
    const hp=Math.max(0,Number(p?.hp)||0),maxHp=Number(p?.maxHp)||ROUND_HP;
    const damage=Number(p?.roundDamage)||0;
    const clock=timerOf(match,serverNow,seat);
    const skill=round.phase==='round'?round.skills?.[seat]??null:null;
    const badge=[skill==='freeze'?'❄ +3 sn':null,round.phase==='round'&&round.skills?.[seat===1?2:1]==='timethief'?'−5 sn':null].filter(Boolean).join(' · ');
    return {seat,name:nameOf(match,seat),isMe:Boolean(p&&p.playerId===myId),clock:countedRound&&round.phase==='round'?'':clock.text,badge,
      progress:timed?`Kelime ${idx}`:`Kelime ${idx}/${wordTotal}`,progressValue:idx,done:Boolean(p?.roundDone),doneText:p?.roundDone?'Tamamlandı ✓':'',
      streak:streakModel(streakOf(p),p?.nextSkill),pips:dots,
      hp,maxHp,hpText:`Can ${num(hp)}/${num(maxHp)}`,damage,damageText:`Raund hasarı ${roundDamageText(damage)}`};
  });
  const styleTitle=ROUND_STYLE_TITLES[timed?'timed':'counted'];
  // DEVIR-PVP 1: çözüm sırasında oynanacak bir şey yok → "RAUND N SONUCU", sayaç (çözüm planının bitişine kalan süre) gizli.
  const result=isResultPhase(round.phase,resultHold);
  if(result)for(const s of sides)s.clock='';
  const phaseLabel=result?roundResultTitle(index,suddenDeath):round.phase==='intermission'?'TUR ARASI':match.status==='paused'?'DURAKLADI':'SANİYE';
  // Madalyon: faz birimi her zaman kısa "sn"; başlık alanında yalnız TEK yazı (raund adı YA DA faz adı) görünür.
  const title=suddenDeath?'ANİ ÖLÜM':`RAUND ${index} / ${total}`;
  let medalTitle=match.status==='paused'?'DURAKLADI':round.phase==='round'?title:phaseLabel;
  // Üst bilgi: 'ZAMANA KARŞI · RAUND 2/7' ya da 'KELİME RAUNDU · RAUND 2/7 · 7 kelime'.
  const headline=`${styleTitle} · ${suddenDeath?'ANİ ÖLÜM':`RAUND ${index}/${total}`}${roundContentTag(round)}${timed?'':` · ${wordTotal} kelime`}`;
  // KELİME RAUNDU: geri sayım yok; medalda ilerleme 'x/7' ve 'Sen 4/7 · Rakip 5/7'. Gizli 120 sn sınırı yalnız son 10 sn'de uyarır.
  // 13 Kas 2026 (KESINYAP 19): "süre doluyor" / "SON ÇAĞRI" / "Raund kapanıyor" uyarısı kalktı; lastCall hep kapalı (süre kuralları değişmedi).
  void lastCallActive;
  let timerOut=timer,lastCall={active:false,text:''},progressText='',unit='sn';
  if(countedRound&&round.phase==='round'){
    const mine=sides[mySeat-1],rival=sides[mySeat===1?1:0];
    progressText=`Sen ${mine.progressValue}/${wordTotal} · Rakip ${rival.progressValue}/${wordTotal}`;
    timerOut={...timer,text:`${mine.progressValue}/${wordTotal}`,seconds:-1,fraction:clamp01(mine.progressValue/Math.max(1,wordTotal)),hidden:false,urgent:false};
    unit='';
    if(match.status!=='paused')medalTitle=progressText; // başlık yuvasında 'Sen 4/7 · Rakip 5/7'
  }
  if(result){timerOut={...timer,text:'',seconds:-1,fraction:0,hidden:true,urgent:false};unit='';}
  return {visible:true,index,total,title,medalTitle,headline,style:timed?'timed':'counted',dots,unit,suddenDeath,phase:round.phase,phaseLabel,result,
    timer:timerOut,progressText,lastCall,sides,words,mySeat};
}

/** Tur sonu kilidi: sunucu saatiyle `serverNow ≥ endsAt` olunca da kilitlenir (§8). */
export function roundInputLock(match,myId,serverNow){
  if(match?.status==='running'&&match.exchange?.phase==='resolve')return {locked:true,clearInput:true,reason:'Saldırı sırası · dövüşü izle'};
  if(!isRoundMatch(match)||match.status!=='running')return {locked:false,reason:null};
  const round=match.round;
  if(round.phase==='resolve')return {locked:true,clearInput:true,reason:'RAUND BİTTİ · vuruşlar oynuyor'};
  if(round.phase==='intermission')return {locked:true,clearInput:true,reason:'Tur arası · sonraki raund bekleniyor'};
  if(round.phase==='settling')return {locked:true,clearInput:true,reason:'Süre doldu · saldırılar çözülüyor'};
  const me=match.players?.find(p=>p.playerId===myId);
  const counted=round.style==='counted';
  if(me?.roundDone)return {locked:true,clearInput:true,reason:counted?'Tamamlandı ✓ · raund kapanıyor':'Tamamlandı ✓ · rakip bekleniyor'};
  const deadline=round.personalEndsAt?.[me?.seat]??me?.roundEndsAt??(match.blindClock?null:round.endsAt);
  if(Number.isFinite(deadline)&&serverNow>=deadline)return {locked:true,clearInput:true,reason:counted?'Rakip bitirdi · raund kapanıyor':'Süre doldu · tur kapanıyor'};
  return {locked:false,reason:null};
}

/** Raund özeti sunumu: kazanan "SEN" ise zafer, rakipse yenilgi tonu; berabere nötr. */
export function summaryPresentation(winnerSeat,match,myId){
  if(winnerSeat!==1&&winnerSeat!==2)return {mine:false,tone:'draw',headline:'BERABERE'};
  const mine=playerBySeat(match,winnerSeat)?.playerId===myId&&myId!=null;
  return {mine,tone:mine?'win':'loss',headline:mine?'SEN KAZANDIN':`${nameOf(match,winnerSeat)} KAZANDI`};
}

export function summaryModel(roundEnd,match,myId){
  const round=Number(roundEnd?.round)||Number(match?.round?.index)||1;
  const total=Number(match?.round?.total??match?.totalRounds)||DEFAULT_ROUNDS;
  const winnerSeat=roundEnd?.winnerSeat===1||roundEnd?.winnerSeat===2?roundEnd.winnerSeat:null;
  const scores=[1,2].map(seat=>(roundEnd?.scores||[]).find(s=>s.seat===seat)||{});
  const names=[1,2].map(seat=>nameOf(match,seat)+(playerBySeat(match,seat)?.playerId===myId?' (sen)':''));
  const row=(label,key)=>({label,values:scores.map(s=>num(s[key]))});
  // KESINYAP 11: raund kazananı yok; kart iki tarafın bu raunddaki hasarını ve TAŞINAN kalan canını gösterir.
  const mySeat=mySeatOf(match,myId);
  const order=mySeat===2?[2,1]:[1,2];
  const who=seat=>mySeat?(seat===mySeat?'Sen':'Rakip'):nameOf(match,seat);
  const dmg=seat=>Number(scores[seat-1].damageDealt)||0;
  const hpOf=seat=>Number(roundEnd?.hp?.[seat]??scores[seat-1].hpLeft??playerBySeat(match,seat)?.hp)||0;
  const damageLine=`Bu raund: ${order.map(s=>`${who(s)} ${num(dmg(s))} hasar`).join(' · ')}`;
  const hpLine=`Kalan can: ${order.map(s=>`${who(s)} ${num(hpOf(s))}`).join(' · ')}`;
  const ko=roundEnd?.reason==='KO';
  const pres=ko?summaryPresentation(winnerSeat,match,myId):{mine:false,tone:winnerSeat&&mySeat?(winnerSeat===mySeat?'win':'loss'):'draw',headline:damageLine};
  const next=roundEnd?.next||(roundEnd?.nextRoundAt?{round:round+1}:null);
  // Tek bant düellosu: solda rakip, sağda sen (koltuk bilinmiyorsa 1 → 2); sayılar tek satır, tavan rozeti yalnız tavanda.
  const colors=summaryColors(match);
  const stat=seat=>{const s=scores[seat-1];return `${num(s.correct)} doğru · ${num(s.wrong)} yanlış · seri ${num(s.bestStreak)}`;};
  const duel=(mySeat?[mySeat===1?2:1,mySeat]:[1,2]).map(seat=>({seat,me:seat===mySeat,winner:winnerSeat===seat,
    label:mySeat?(seat===mySeat?'Sen vurdun':'Rakip vurdu'):`${nameOf(match,seat)} vurdu`,
    damage:num(dmg(seat)),detail:stat(seat),color:colors[seat-1]}));
  const nextIdx=Number(next?.round)||round+1;
  return {round,title:`RAUND ${round} BİTTİ`,winnerSeat,draw:winnerSeat===null,duel,progress:roundDots(round,total,'intermission'),
    countText:next&&!roundEnd?.matchOver?(nextIdx>total?'Ani ölüm başlıyor':`Raund ${nextIdx} başlıyor`):'Sonuç hazırlanıyor',
    winnerText:damageLine,...pres,damageLine,hpLine,
    ko,reasonText:REASON_LABELS[roundEnd?.reason]||'',names,
    rows:[row('Doğru','correct'),row('Yanlış','wrong'),row('En iyi seri','bestStreak'),
      {label:'Hasar',values:[1,2].map(s=>roundDamageText(dmg(s)))},row('Kalan can','hpLeft')],
    colors,players:summaryPlayers(match),pips:[1,2].map(()=>roundDots(round,total,'intermission')),
    scoreline:`${num(hpOf(1))} – ${num(hpOf(2))}`,
    nextText:next&&!roundEnd?.matchOver?nextRoundText(next,match?.round?.style,total):'Maç sonucu hazırlanıyor'};
}

export function clashModel(event,match){
  const blockerSeat=event?.blockerSeat===1||event?.blockerSeat===2?event.blockerSeat:null;
  return {title:'ÇARPIŞMA!',word:String(event?.word??''),blockerSeat,variant:blockerSeat?'block':'trade',
    detail:blockerSeat?`${nameOf(match,blockerSeat)} blokladı · ${BLOCK_LABELS[event?.blockKind]||'BLOK'}`:'İKİSİ DE VURDU'};
}

/** Lobi seçicisi: odada yalnızca host, waiting/countdown iken MATCH_CONFIG gönderir. */
export function roundsPickDecision({scope,value,isHost,phase,current}={}){
  if(!validRounds(value))return null;
  const rounds=Number(value);
  if(scope==='practice')return {store:rounds};
  if(scope!=='room'||!isHost||!['waiting','countdown'].includes(phase)||rounds===Number(current))return null;
  return {type:'MATCH_CONFIG',payload:{rounds}};
}

/** KESINYAP 11: 'Maç uzunluğu' seçeneği kaldırıldı; yerinde (yalnız bot lobisinde çağrılıyordu) hiçbir şey çizilmez. */
export function roundsPickerHTML(){return '';}
/** Raund biçimi seçici kararı (yalnız kind='style'). practice: yerel tercih; room: yalnız host, waiting/countdown, değişiklikte MATCH_CONFIG. */
export function roundStylePickDecision({scope,kind='style',value,isHost,phase,current}={}){
  if(kind!=='style'||!ROUND_STYLES.includes(value))return null;
  if(scope==='practice')return {store:value};
  if(scope!=='room'||!isHost||!['waiting','countdown'].includes(phase)||value===current)return null;
  return {type:'MATCH_CONFIG',payload:{roundStyle:value}};
}
const STYLE_TITLES=Object.freeze({timed:'Her raund 30 sn; süre bitene kadar kelime akar, kim çok doğru yazarsa o kadar vurur',
  counted:'Raund başına 5-7-9-10-10-10-15 kelime · süre yok, ilk bitiren raundu bitirir; iki oyuncuya aynı kelimeler'});
export function roundStylePickerHTML(scope){
  const s=scope==='practice'?'practice':'room';
  return `<div class="rui-picker" data-style-picker="${s}"><span class="rui-picker-label" id="rui-style-${s}">Raund biçimi</span>`
    +`<div class="rui-seg" role="group" aria-labelledby="rui-style-${s}">`
    +ROUND_STYLES.slice().reverse().map(k=>`<button type="button" data-lobby-action="roundstyle" data-style-scope="${s}" data-round-style="${k}" aria-pressed="${k===DEFAULT_ROUND_STYLE}" title="${STYLE_TITLES[k]}">${ROUND_STYLE_LABELS[k]}</button>`).join('')
    +`</div><small class="rui-rule-hint" data-damage-rules>7 raund · ${num(ROUND_HP)} can (raundlar arası taşınır) · ${DAMAGE_RULE_HINT}</small>`
    +`<small class="rui-picker-note" data-style-note></small></div>`;
}
/** Biçim seçicisini eşitle. */
export function syncRoundStylePicker(container,scope,{style,editable,note=''}={}){
  const box=container?.querySelector(`[data-style-picker="${scope}"]`);if(!box)return;
  const st=normalizeRoundStyle(style);
  box.dataset.readonly=String(!editable);
  box.querySelectorAll('[data-round-style]').forEach(b=>{
    const pressed=String(b.dataset.roundStyle===st);
    if(b.getAttribute('aria-pressed')!==pressed)b.setAttribute('aria-pressed',pressed);
    if(b.disabled!==!editable)b.disabled=!editable;
  });
  const n=box.querySelector('[data-style-note]');if(n&&n.textContent!==note)n.textContent=note;
}
/** Seçici durumunu eşitle; host olmayan oyuncu için salt-okunur. */
export function syncRoundsPicker(container,scope,{value,editable,note=''}={}){
  const box=container?.querySelector(`[data-rounds-picker="${scope}"]`);if(!box)return;
  const current=normalizeRounds(value);
  box.dataset.readonly=String(!editable);
  box.querySelectorAll('[data-rounds]').forEach(b=>{
    const pressed=String(Number(b.dataset.rounds)===current);
    if(b.getAttribute('aria-pressed')!==pressed)b.setAttribute('aria-pressed',pressed);
    if(b.disabled!==!editable)b.disabled=!editable;
  });
  const n=box.querySelector('[data-rounds-note]');if(n&&n.textContent!==note)n.textContent=note;
}

/** Maç sonu karnesi için tur özeti; klasik sonuçta null. */
export function roundsResultModel(result,myId){
  if(!result||(result.mode!=='rounds'&&!Array.isArray(result.rounds)))return null;
  const total=Number(result.totalRounds)||DEFAULT_ROUNDS;
  const name=seat=>String(result.players?.find(p=>p.seat===seat)?.name||`Oyuncu ${seat}`);
  const list=Array.isArray(result.rounds)?result.rounds:[];
  const rows=list.map(r=>{
    const sc=seat=>(r.scores||[]).find(s=>s.seat===seat)?.damageDealt;
    return {round:r.round,label:r.round>total?`Ani ölüm ${r.round-total}`:`Raund ${r.round}`,
      winnerSeat:r.winnerSeat??null,winner:r.winnerSeat===1||r.winnerSeat===2?name(r.winnerSeat):'Eşit',
      ko:r.reason==='KO',damage:`${num(sc(1))} – ${num(sc(2))}`};
  });
  // Skor satırı: kalan (taşınan) can. '1.240 – 0 · NAKAVT' ya da '2.100 – 1.650 · 7 raund'.
  const hpOf=seat=>Number(result.finalHp?.[seat]??result.players?.find(p=>p.seat===seat)?.hp)||0;
  const ko=result.endReason==='KNOCKOUT';
  const mySeat=result.players?.find(p=>p.playerId===myId)?.seat||null;
  return {scoreline:`${num(hpOf(1))} – ${num(hpOf(2))} · ${ko?'NAKAVT':`${list.length||total} raund`}`,names:[name(1),name(2)],mySeat,rows,
    reasonLabel:END_REASON_LABELS[result.endReason]||null,lengthLabel:`Kalan can · ${total} raundluk maç · ${num(ROUND_HP)} can`};
}

// ------------------------------------------------------------------ DOM ---
function builder(doc){
  return (tag,props={},...kids)=>{
    const el=doc.createElement(tag);
    if(props.cls)el.className=props.cls;
    if(props.rui)el.dataset.rui=props.rui;
    for(const [k,v] of Object.entries(props.attrs||{}))el.setAttribute(k,v);
    if(props.text!==undefined)el.textContent=props.text;
    if(props.hidden)el.hidden=true;
    for(const k of kids)if(k)el.append(k);
    return el;
  };
}
const setText=(el,v)=>{const s=String(v);if(el&&el.textContent!==s)el.textContent=s;};
const setHidden=(el,h)=>{if(el&&el.hidden!==Boolean(h))el.hidden=Boolean(h);};
const setFlag=(el,c,on)=>{if(el&&el.classList.contains(c)!==Boolean(on))el.classList.toggle(c,Boolean(on));};
const RING_R=26,RING_C=2*Math.PI*RING_R;
const SVG_NS='http://www.w3.org/2000/svg';

/** Her iki modun sonuç kartı: güvenilmeyen adlar yalnız textContent ile yazılır. */
export function summaryColors(match){
  return [1,2].map(seat=>{const p=playerBySeat(match,seat);return FIGHTERS[normalizeFighter(p?.fighter,p?.character)].palette.accent;});
}
/** Raund özeti portreleri için iki oyuncunun kaydı ({fighter, character}). */
export function summaryPlayers(match){
  return [1,2].map(seat=>{const p=playerBySeat(match,seat);return {fighter:p?.fighter,character:p?.character};});
}
export function createRoundEndCard(doc,model){
  const h=builder(doc);
  // Tek bant (docs/EKRAN-KONTROL-KURALLARI.md): etiket → iki sütunlu hasar düellosu → ilerleme şeridi → sıradaki/ipucu → (bant ızgarasında beceriler) → geri sayım.
  const rowVal=(label,i)=>model.rows?.find(r=>r.label===label)?.values?.[i];
  const duel=model.duel||model.names.map((name,i)=>({seat:i+1,me:false,label:`${name} vurdu`,damage:String(rowVal('Verilen hasar',i)??rowVal('Hasar',i)??'0'),capped:false,
    detail:`${rowVal('Doğru',i)??0} doğru · ${rowVal('Yanlış',i)??0} yanlış · seri ${rowVal('En iyi seri',i)??0}`,color:model.colors?.[i],winner:model.winnerSeat===i+1}));
  const players=h('div',{cls:'m33-players'},...duel.map(d=>{
    const i=d.seat-1; // portre maçtaki karakterin kendi görseli (kural 4)
    const portrait=model.players?.[i]?portraitImg(doc,model.players[i],'m33-portrait'):null;
    return h('article',{cls:`m33-player${d.winner?' is-winner':''}${d.me?' is-me':''}${portrait?' has-portrait':''}`,attrs:{style:`--m33-player:${d.color||'#e4dcff'}`,'data-seat':String(d.seat)}},portrait,
      h('div',{cls:'m33-body'},
        h('span',{cls:'m33-who',text:d.label}),
        h('div',{cls:'m33-dmgrow'},h('strong',{cls:'m33-dmg',text:d.damage,attrs:{'data-round-damage':''}})),
        h('small',{cls:'m33-detail',text:d.detail})));
  }));
  const d=model.progress||model.pips[0];
  const pips=h('div',{cls:'m33-pips',attrs:{'aria-label':`Raund ilerlemesi ${d.filled}/${d.total}`}},
    ...Array.from({length:d.total},(_,j)=>h('span',{cls:`m33-pip${j<d.filled?' is-won':''}`,attrs:{'aria-hidden':'true'}})));
  const seconds=h('strong',{text:'0'});
  const countdown=h('div',{cls:'m33-countdown',attrs:{role:'timer','aria-label':'Sonraki tura kalan süre'}},h('span',{cls:'m33-count-label',text:model.countText||'Sonraki raund başlıyor'}),seconds);
  const tone=model.tone||'draw';
  const winColor=model.winnerSeat?model.colors[model.winnerSeat-1]:'#e4dcff';
  const node=h('div',{cls:'m33-result m33-band',attrs:{'data-tone':tone,'data-ko':model.ko?'1':'0',style:`--rui-win:${winColor}`}},
    h('header',{cls:'m33-head'},h('h2',{cls:'m33-title',text:model.title}),model.ko?h('span',{cls:'rui-ko',text:'NAKAVT'}):null),
    players,pips,
    h('footer',{cls:'m33-foot'},h('span',{cls:'m33-next',text:model.nextText}),h('span',{cls:'m33-hint',text:'Süre becerisi seç · 1–3 · Enter kilitler'})),
    countdown);
  return {node,update(deadline,at){
    const remaining=Number.isFinite(deadline)?Math.max(0,deadline-at):0;
    setHidden(countdown,!Number.isFinite(deadline));setText(seconds,Math.ceil(remaining/1000));
  }};
}

/**
 * createRoundsUi(root,{now}) → {update(match,myId), handle(packet), tick(), destroy()}
 * DOM tek kökte (`[data-rounds-ui]`) üretilir.
 */
export function createRoundsUi(root,{now=()=>Date.now(),doc=globalThis.document,timers=globalThis,isReduced=()=>false,onLockChange=null,send=()=>{},holdTransition=null,settleVisuals=null}={}){
  const h=builder(doc);
  const el=h('div',{cls:'rui',attrs:{'data-rounds-ui':''},hidden:true});
  // Üst şerit: [taraf 1] [madalyon] [taraf 2]
  const sideEls=[1,2].map(seat=>{
    const pips=h('span',{cls:'rui-pips',rui:'pips'});
    const name=h('strong',{cls:'rui-name'});
    const you=h('span',{cls:'rui-you',text:'SEN',hidden:true});
    const progress=h('span',{cls:'rui-progress',rui:'progress'});
    const clock=h('span',{cls:'rui-side-clock'}),badge=h('span',{cls:'rui-time-badge',hidden:true});
    const done=h('span',{cls:'rui-done',hidden:true});
    const hp=h('span',{cls:'rui-hp',attrs:{'data-rui-hp':String(seat)}}),dmg=h('span',{cls:'rui-dmg',attrs:{'data-rui-dmg':String(seat)}});
    const cells=Array.from({length:ROUND_WORDS},(_,i)=>h('i',{cls:`rui-cell${STREAK_TICKS.some(t=>t.at===i+1)?' rui-cell-tick':''}`}));
    const ticks=STREAK_TICKS.map(t=>h('span',{cls:'rui-tick',attrs:{'data-at':String(t.at),style:`--at:${t.at}`},text:t.key}));
    const meterLabel=h('span',{cls:'rui-meter-label'});
    const next=h('span',{cls:'rui-next',attrs:{title:'Sonraki doğru kelimede tetiklenecek büyü'}});
    const mult=h('span',{cls:'rui-mult',hidden:true});
    const meter=h('div',{cls:'rui-meter',rui:'meter',attrs:{role:'meter','aria-valuemin':'0','aria-valuemax':String(ROUND_WORDS),'aria-valuenow':'0','aria-label':`Oyuncu ${seat} serisi`}},
      h('div',{cls:'rui-cells'},...cells),h('div',{cls:'rui-ticks'},...ticks));
    const node=h('div',{cls:`rui-side rui-side-${seat}`,rui:'side'},
      h('div',{cls:'rui-side-top'},name,you,progress,clock,badge,done,h('span',{cls:'rui-meter-meta'},meterLabel,next,mult),pips),
      h('div',{cls:'rui-side-hp'},hp,dmg),
      meter);
    return {seat,node,pips,name,you,progress,clock,badge,done,hp,dmg,cells,ticks,meter,meterLabel,next,mult,
      pipCount:-1,prev:null,breakTimer:null,pulseTimer:null};
  });
  const ringFill=doc.createElementNS(SVG_NS,'circle');
  for(const [k,v] of Object.entries({cx:'32',cy:'32',r:String(RING_R),class:'rui-ring-fill','stroke-dasharray':RING_C.toFixed(2),'stroke-dashoffset':'0'}))ringFill.setAttribute(k,v);
  const ringTrack=doc.createElementNS(SVG_NS,'circle');
  for(const [k,v] of Object.entries({cx:'32',cy:'32',r:String(RING_R),class:'rui-ring-track'}))ringTrack.setAttribute(k,v);
  const ring=doc.createElementNS(SVG_NS,'svg');
  for(const [k,v] of Object.entries({viewBox:'0 0 64 64',class:'rui-ring','aria-hidden':'true'}))ring.setAttribute(k,v);
  ring.append(ringTrack,ringFill);
  const title=h('div',{cls:'rui-title',rui:'title'});
  const secs=h('strong',{cls:'rui-secs'});
  const secsUnit=h('small',{cls:'rui-secs-unit'});
  const lastCall=h('div',{cls:'rui-lastcall',rui:'lastcall',hidden:true});
  const medal=h('div',{cls:'rui-medal',rui:'medal'},title,h('div',{cls:'rui-clock'},ring,h('div',{cls:'rui-clock-text'},secs,secsUnit)),lastCall);
  const bar=h('div',{cls:'rui-bar'},sideEls[0].node,medal,sideEls[1].node);
  const strip=h('ol',{cls:'rui-words',rui:'words',attrs:{'aria-label':'Bu turun kelimeleri'}});
  const wordEls=Array.from({length:ROUND_WORDS},()=>{const li=h('li',{cls:'rui-word',rui:'word'});strip.append(li);return li;});
  // Katmanlar (yazı alanını örtmeyecek biçimde üst-orta bölgede).
  const clash=h('div',{cls:'rui-clash',rui:'clash',hidden:true,attrs:{role:'status'}});
  const clashTitle=h('strong',{cls:'rui-clash-title'}),clashWord=h('span',{cls:'rui-clash-word'}),clashDetail=h('span',{cls:'rui-clash-detail'});
  clash.append(clashTitle,clashWord,clashDetail);
  const flash=h('div',{cls:'rui-flash',rui:'flash',hidden:true});
  const flashTitle=h('strong'),flashSub=h('span',{text:'BAŞLA!'});flash.append(flashTitle,flashSub);
  const banner=h('div',{cls:'rui-banner',rui:'banner',hidden:true,attrs:{'aria-hidden':'true'}});
  const bannerTitle=h('strong',{cls:'rui-banner-title'});banner.append(bannerTitle);
  const intro=h('div',{cls:'rui-intro',rui:'intro',hidden:true});
  const introTitle=h('span',{cls:'rui-intro-title'}),introCount=h('strong',{cls:'rui-intro-count'});intro.append(introTitle,introCount);
  const summary=h('section',{cls:'rui-summary',rui:'summary',hidden:true,attrs:{'aria-label':'Tur sonucu'}});
  const picker=h('section',{cls:'rui-skill-picker',hidden:true,attrs:{'aria-label':'Süre becerisi seç'}});
  const pickerTitle=h('strong',{text:'SONRAKİ RAUND · SÜRE BECERİSİ'});
  const pickerCards=h('div',{cls:'aui-cards rui-skill-cards'});
  const pickerStatus=h('span',{cls:'rui-pick-status',attrs:{role:'status'}});
  const pickerLock=h('button',{cls:'rui-pick-lock',attrs:{type:'button'},text:'Seçimi kilitle · Enter'});
  const pickerSkip=h('button',{cls:'rui-pick-skip',attrs:{type:'button'},text:'Seçme · Esc'});
  picker.append(pickerTitle,pickerCards,h('div',{cls:'rui-pick-actions'},pickerStatus,pickerLock,pickerSkip));
  const reveal=h('div',{cls:'rui-skill-reveal',hidden:true,attrs:{role:'status'}});
  const live=h('span',{cls:'rui-sr',attrs:{'aria-live':'polite','aria-atomic':'true'}});
  // Tur arası: sonuç + süre becerisi TEK panelde, boştaki yazma panelinin (.tt) yerine oturur;
  // beceri kartlarının, arenanın ya da HP çubuklarının üstüne binmez (docs/EKRAN-KONTROL-KURALLARI.md, H3).
  const inter=h('div',{cls:'rui-inter rui-band',rui:'inter',hidden:true},summary,picker);
  el.append(bar,strip,clash,flash,banner,intro,inter,reveal,live);
  root.append(el);

  const state={match:null,myId:null,visible:false,destroyed:false,interval:null,clashTimer:null,
    marks:new Map(),marksKey:null,lastRoundEnd:null,lastCallRound:null,announced:null,lockKey:'',summaryKey:null,shownClash:null,
    selected:null,pending:false,pickKey:null,gate:null,pickerVisible:false,panelOpen:false,revealUntil:0,endCard:null,skillCards:[]};
  const later=(fn,ms)=>timers.setTimeout(fn,ms);
  // DEVIR-PVP 1: tur arası paneli açılırken / yeni raund başlarken görsel kuyrukta kalan vuruşlar animasyonsuz uygulanır
  // (index.js: arena3d.clear + uçan hasar sayıları silinir + can barı son değere). Kozmetik; hata oyunu bozmaz.
  const settle=reason=>{try{settleVisuals?.(reason);}catch{}};
  const announce=text=>{live.textContent='';live.textContent=text;};

  function ensureTicker(on){
    if(on&&state.interval===null)state.interval=timers.setInterval(()=>{if(!doc.hidden)tick();},100);
    if(!on&&state.interval!==null){timers.clearInterval(state.interval);state.interval=null;}
  }
  function trackDiffs(match){
    const idx=Number(match.round.index)||1;
    const key=`${match.matchId}:${idx}`;
    if(state.marksKey!==key){state.marksKey=key;state.marks=new Map();}
    const mySeat=mySeatOf(match,state.myId)||1;
    for(const side of sideEls){
      const p=playerBySeat(match,side.seat);if(!p)continue;
      const cur={key,correct:Number(p.roundCorrect)||0,wrong:Number(p.roundWrong)||0,idx:Number(p.roundWordIndex)||0,streak:streakOf(p),mult:Number(p.multiplier)||streakMultiplier(streakOf(p))};
      const prev=side.prev;side.prev=cur;
      if(!prev||prev.key!==key)continue;
      if(side.seat===mySeat&&cur.idx>prev.idx){
        if(cur.wrong>prev.wrong)state.marks.set(cur.idx-1,'bad');
        else if(cur.correct>prev.correct)state.marks.set(cur.idx-1,'good');
      }
      if(cur.wrong>prev.wrong)streakBreak(side,prev.streak,cur.streak);
      if(cur.mult>prev.mult&&cur.mult>1)pulse(side);
    }
  }
  function streakBreak(side,from,to){
    setFlag(side.meter,'is-broken',true);side.meterLabel.textContent=from>to?`SERİ ${from} → ${to}`:'SERİ BOZULDU';
    if(side.breakTimer!==null)timers.clearTimeout(side.breakTimer);
    side.breakTimer=later(()=>{side.breakTimer=null;setFlag(side.meter,'is-broken',false);render();},BREAK_MS);
  }
  function pulse(side){
    if(isReduced())return;
    setFlag(side.mult,'is-rising',true);
    if(side.pulseTimer!==null)timers.clearTimeout(side.pulseTimer);
    side.pulseTimer=later(()=>{side.pulseTimer=null;setFlag(side.mult,'is-rising',false);},PULSE_MS);
  }
  function renderSide(side,vm){
    setText(side.name,vm.name);setHidden(side.you,!vm.isMe);setFlag(side.node,'is-me',vm.isMe);
    setText(side.progress,vm.progress);setText(side.clock,vm.clock);setText(side.badge,vm.badge);setHidden(side.badge,!vm.badge);
    setHidden(side.done,!vm.done);setText(side.done,vm.doneText);setFlag(side.node,'is-done',vm.done);
    if(side.pipCount!==vm.pips.total){side.pipCount=vm.pips.total;side.pips.replaceChildren(...Array.from({length:vm.pips.total},()=>doc.createElement('i')));}
    side.pips.children&&Array.from(side.pips.children).forEach((pip,i)=>setFlag(pip,'is-won',i<vm.pips.filled));
    side.pips.setAttribute?.('aria-label',`Oynanan raund ${vm.pips.filled}/${vm.pips.total}`);
    setText(side.hp,vm.hpText);setText(side.dmg,vm.damageText);
    const s=vm.streak;
    side.cells.forEach((c,i)=>setFlag(c,'is-on',i<s.filled));
    side.ticks.forEach((t,i)=>setFlag(t,'is-reached',s.ticks[i].reached));
    if(side.meter.getAttribute('aria-valuenow')!==String(s.filled))side.meter.setAttribute('aria-valuenow',String(s.filled));
    setFlag(side.meter,'is-hot',s.hot);
    if(side.breakTimer===null)setText(side.meterLabel,`Seri ${s.streak}`);
    setText(side.next,s.nextSkill?`Sıradaki ${s.nextSkill}`:'');setHidden(side.next,!s.nextSkill);
    setText(side.mult,s.multiplierLabel||'');setHidden(side.mult,!s.multiplierLabel);
  }
  function renderPicker(match){
    const model=roundSkillPickerModel(match,state.myId);
    state.pickerVisible=model.visible;
    setHidden(picker,!(model.visible&&state.panelOpen));
    if(!model.visible)return;
    setFlag(picker,'is-locked',model.locked);
    const key=`${match.matchId}:${match.round.index}`;
    if(state.pickKey!==key){state.pickKey=key;state.selected=null;state.pending=false;}
    if(model.locked){state.pending=false;state.selected=model.pick;}
    if(!state.skillCards.length){state.skillCards=model.cards.map((c,i)=>{
      const uses=h('span',{cls:'aui-uses'});
      const button=h('button',{cls:'aui-card',attrs:{type:'button','data-round-skill':c.id,'aria-pressed':String(state.selected===c.id),'aria-label':`${i+1}. ${c.name}, ${c.effect}, ${c.left}/2 hak`}},
        h('span',{cls:'aui-card-key',text:String(i+1)}),h('span',{cls:'aui-card-icon',text:c.icon}),
        h('span',{cls:'aui-card-copy'},h('strong',{text:c.name}),h('small',{text:c.effect})),uses);
      return {button,uses};
    });pickerCards.replaceChildren(...state.skillCards.map(c=>c.button));}
    state.skillCards.forEach(({button,uses},i)=>{
      const c=model.cards[i];
      button.setAttribute('aria-pressed',String(state.selected===c.id));
      button.setAttribute('aria-label',`${i+1}. ${c.name}, ${c.effect}, ${c.left}/2 hak`);
      setText(uses,`${c.left} hak`);
      uses.setAttribute('aria-label',`${c.left}/2 hak`);
      setFlag(button,'is-empty',c.left===0);
      button.disabled=model.locked||state.pending||c.left===0;
    });
    setText(pickerStatus,model.locked?`Onaylandı: ${model.pick?ROUND_SKILL_CARDS.find(c=>c.id===model.pick)?.name:'Seçme'} · Rakibin seçimi gizli`:state.pending?'Onay bekleniyor…':'');
    pickerLock.disabled=model.locked||state.pending;
    pickerSkip.disabled=model.locked||state.pending;
  }
  function choose(skill){
    const model=roundSkillPickerModel(state.match,state.myId);
    if(!model.visible||model.locked||state.pending)return false;
    if(skill&&model.cards.find(c=>c.id===skill)?.left===0)return false;
    state.selected=skill;renderPicker(state.match);return true;
  }
  function lockPick(skill=state.selected){
    if(!choose(skill))return false;
    state.pending=true;renderPicker(state.match);send('ROUND_SKILL_PICK',{skill});return true;
  }
  picker.addEventListener('click',e=>{const b=e.target.closest('[data-round-skill]');if(b)choose(b.dataset.roundSkill);else if(e.target.closest('.rui-pick-lock'))lockPick();else if(e.target.closest('.rui-pick-skip'))lockPick(null);});
  function currentSummarySource(match){
    const idx=Number(match.round.index)||1;
    if(state.lastRoundEnd&&Number(state.lastRoundEnd.round)===idx&&state.lastRoundEnd.matchId===match.matchId)return state.lastRoundEnd;
    const h=Array.isArray(match.roundHistory)?match.roundHistory.at(-1):null;
    return h&&Number(h.round)===idx?h:null;
  }
  function renderSummary(source,match){
    const key=`${match.matchId}:${source.round}:${match.sequence}`;
    if(state.summaryKey===key)return;state.summaryKey=key;
    const m=summaryModel(source,match,state.myId);
    state.endCard=createRoundEndCard(doc,m);
    summary.replaceChildren(state.endCard.node);
    setFlag(summary,'is-ko',m.ko);
  }
  /**
   * Tur arası geçişinin TEK giriş noktası. Her tur arası için bir kez: önce yalnız "RAUND X" yazısı, sonra panel.
   * `holdTransition(match)` (createRoundsUi seçeneği) bir Promise döndürürse (ör. dövüş animasyonunun bitişi) yazı/panel
   * o çözülene dek bekler; tavan ROUND_HOLD_MAX_MS ve süre tur arasının İLK görülmesinden sayılır. Hold ROUND_HOLD_TITLE_SKIP_MS'ni
   * aştıysa yazı aşaması atlanır, özet doğrudan açılır. Geri sayıma çok az kala görülen geçiş (yeniden bağlanma) de yazıyı atlar.
   */
  function openIntermission(match,t,nextRoundAt){
    const key=`${match.matchId}:${match.round.index}`;
    if(state.gate&&state.gate.key===key)return state.gate;
    if(state.gate?.timer!==null&&state.gate?.timer!==undefined)timers.clearTimeout(state.gate.timer);
    // nextRoundAt, dövüş çözümlemesinden ÖNCE hesaplanır; bu yüzden süre "ilk görülme"den sayılır. Geri sayıma çok az kaldıysa yazı atlanır.
    const gate=state.gate={key,ready:false,openedAt:t,timer:null,closeAt:nextRoundAt-(ROUND_SUMMARY_MS+ROUND_INTRO_MS)};
    const late=nextRoundAt-t<=ROUND_INTRO_MS+ROUND_TITLE_MS+600;
    let sync=true;
    const open=()=>{
      if(state.destroyed||state.gate!==gate||gate.ready)return;
      settle('intermission'); // bekleme tavanı dolduysa kalan vuruşlar şimdi, animasyonsuz (panel eski vuruşla karışmaz)
      gate.ready=true;
      // Uzun bekletme (veya yeniden bağlanma): "RAUND X" yazısını atla, özet doğrudan açılsın.
      gate.openedAt=(late||now()-t>ROUND_HOLD_TITLE_SKIP_MS)?-Infinity:now();
      if(gate.timer!==null){timers.clearTimeout(gate.timer);gate.timer=null;}
      if(!sync)tick();
    };
    let hold=null;
    try{hold=holdTransition?.(match,{round:Number(match.round.index)||1,nextRoundAt});}catch{hold=null;}
    if(hold&&typeof hold.then==='function'){hold.then(open,open);gate.timer=later(open,ROUND_HOLD_MAX_MS);}
    else open();
    sync=false;
    return gate;
  }
  function tick(){
    if(state.destroyed)return;
    const match=state.match;const t=now();
    // Tur arası kapısı vuruşlar bitene dek kapalıysa üst başlık hâlâ "RAUND N SONUCU" (sayaç yok).
    const inter0=isRoundMatch(match)&&match.round.phase==='intermission';
    const src0=inter0?currentSummarySource(match):null;
    const nextAt0=inter0?Number(match.round.nextRoundAt??src0?.nextRoundAt)||null:null;
    const gate0=inter0&&nextAt0&&['running','paused'].includes(match.status)?openIntermission(match,t,nextAt0):null;
    const vm=roundsViewModel(match,state.myId,t,state.marks,{lastCallRound:state.lastCallRound,resultHold:inter0&&!gate0?.ready});
    // Kilit değişimi index.js'e bildirilir (giriş alanı sunucu saatine göre kapanır).
    const lock=roundInputLock(match,state.myId,t);const lockKey=`${lock.locked}:${lock.reason}`;
    if(lockKey!==state.lockKey){state.lockKey=lockKey;try{onLockChange?.(lock);}catch{}}
    if(!vm.visible){hideOverlays();return;}
    // Saat
    const tm=vm.timer;
    setText(secs,tm.text);setText(secsUnit,tm.hidden?'':vm.unit);setText(title,vm.medalTitle);
    sideEls.forEach((side,i)=>setText(side.clock,vm.sides[i].clock));
    ringFill.setAttribute('stroke-dashoffset',(RING_C*(1-tm.fraction)).toFixed(2));
    setFlag(medal,'is-urgent',tm.urgent);setFlag(medal,'is-frozen',tm.frozen);setFlag(medal,'is-result',Boolean(vm.result));
    setText(lastCall,vm.lastCall.text);setHidden(lastCall,!vm.lastCall.active);    // Saniye anonsu (ekran okuyucu dahil) kalktı (KESINYAP 19).
    // Katmanlar
    const round=match.round;
    const src=round.phase==='round'?null:currentSummarySource(match);
    const nextRoundAt=Number(round.nextRoundAt??src?.nextRoundAt)||null;
    let showSummary=false,showIntro=false,showFlash=false,showBanner=false,panelOpen=false;
    if(round.phase==='intermission'&&nextRoundAt){
      // Tek giriş noktası: openIntermission() geçişi (yazı → panel) başlatır; holdTransition bitene dek bekletir.
      const gate=openIntermission(match,t,nextRoundAt);
      const stage=gate.ready?intermissionStage({elapsed:t-gate.openedAt,remaining:nextRoundAt-t}):'hold';
      if(stage==='title'){showBanner=true;setText(bannerTitle,roundLabel(vm.index+1,vm.total));}
      else if(stage==='count'){
        showIntro=true;panelOpen=true; // seçilmemiş beceri son 3 sn'de de kilitlenebilsin
        setText(introTitle,roundLabel(vm.index+1,vm.total));
        setText(introCount,String(Math.max(1,Math.ceil((nextRoundAt-t)/1000))));
        // Son 3 sn'de özet GİZLENMEZ: kart görünür kalır, geri sayım üstte onunla birlikte durur.
        if(src){showSummary=true;renderSummary(src,match);}
      }else if(stage==='panel'){panelOpen=true;if(src){showSummary=true;renderSummary(src,match);}}
    }else if(src&&round.phase!=='round'){showSummary=true;panelOpen=true;renderSummary(src,match);}
    else if(round.phase==='round'&&Number.isFinite(round.startedAt)&&t>=round.startedAt&&t-round.startedAt<START_FLASH_MS&&match.status==='running'){
      showFlash=true;setText(flashTitle,(vm.suddenDeath?'ANİ ÖLÜM':`RAUND ${vm.index}`)+roundContentTag(round));
    }
    state.panelOpen=panelOpen;
    setHidden(summary,!showSummary);setHidden(intro,!showIntro);setHidden(flash,!showFlash);setHidden(banner,!showBanner);
    setHidden(picker,!(state.pickerVisible&&panelOpen));
    setFlag(inter,'is-count',showIntro&&showSummary); // son 3 sn: geri sayım + özet birlikte → gerekirse kompakt düzen
    if(showSummary)state.endCard?.update(nextRoundAt,t,ROUND_SUMMARY_MS+ROUND_INTRO_MS);
    setHidden(reveal,t>=state.revealUntil);
    setFlag(el,'is-sudden',vm.suddenDeath);
    syncInter();
  }
  // Tur arası paneli ALT KISIMDA kompakt "dock": beceri satırının hemen üstünden başlar, yüksekliği ekranın ~%45'ini aşmaz
  // (üst %55'te 3B karakterler/arena açık kalır); tam ekran karartma yok. Tüm yerleşimlerde (tam ekran dahil) aynı panel.
  function syncInter(){
    const open=!summary.hidden||!picker.hidden;
    setHidden(inter,!open);
    setFlag(inter,'is-solo',summary.hidden||picker.hidden);
    const pvp=el.closest?.('#pvp-root')||null;
    if(pvp)setFlag(pvp,'rui-inter-open',open);
    inter.classList.toggle('is-dock',open);
    if(!open)return;
    // Alt boşluk: beceri satırının (yoksa yazma panelinin) üst kenarından; panel onların altına inmez/örtmez.
    const ref=pvp?.querySelector?.('.pvp2-skillrow')||pvp?.querySelector?.('.tt');
    const r=ref?.getBoundingClientRect?.();
    const vh=Number(globalThis.innerHeight)||0;
    const bottom=r&&r.height>0&&vh?Math.min(Math.max(8,Math.round(vh-r.top+8)),Math.round(vh*.2)):72;
    // Yetenek rayları (alt köşeler): bant iki rayın arasına sığar; sığmazsa (dar ekran) rayların üstüne çıkar.
    const vw=Number(globalThis.innerWidth)||0;
    const rails=[...(pvp?.querySelectorAll?.('[data-fhud-rail]')||[])].map(n=>n.getBoundingClientRect?.()).filter(b=>b&&b.width>0&&b.height>0);
    let bandW=960,lift=0;
    if(rails.length&&vw){
      const leftEdge=Math.max(0,...rails.filter(b=>b.left+b.width/2<vw/2).map(b=>b.right));
      const rightEdge=Math.min(vw,...rails.filter(b=>b.left+b.width/2>=vw/2).map(b=>b.left));
      bandW=Math.max(0,Math.floor(2*Math.min(vw/2-leftEdge,rightEdge-vw/2)-16)); // bant ortalı: iki rayın iç kenarlarından en yakınına göre simetrik
      if(bandW<620){lift=Math.round(vh-Math.min(...rails.map(b=>b.top))+6);bandW=960;}
    }
    const dock=lift?Math.max(bottom,lift):bottom;
    const key=`${dock}:${bandW}`;
    if(inter.dataset.dock!==key){inter.dataset.dock=key;inter.style.setProperty?.('--rui-dock-bottom',`${dock}px`);inter.style.setProperty?.('--rui-band-w',`${bandW}px`);}
  }
  function hideOverlays(){state.panelOpen=false;setHidden(banner,true);setHidden(summary,true);setHidden(intro,true);setHidden(flash,true);setHidden(picker,true);setHidden(reveal,true);setFlag(inter,'is-count',false);syncInter();}
  function render(){
    if(state.destroyed)return;
    const match=state.match;
    const inter0=isRoundMatch(match)&&match.round.phase==='intermission';
    const vm=roundsViewModel(match,state.myId,now(),state.marks,{lastCallRound:state.lastCallRound,
      resultHold:inter0&&!(state.gate?.key===`${match.matchId}:${match.round.index}`&&state.gate.ready)});
    state.visible=vm.visible;
    setHidden(el,!vm.visible);
    if(!vm.visible){hideOverlays();setHidden(clash,true);ensureTicker(false);tick();return;}
    setText(title,vm.medalTitle);setFlag(el,'me-2',vm.mySeat===2);
    sideEls.forEach((side,i)=>renderSide(side,vm.sides[i]));
    renderPicker(match);syncInter();
    vm.words.forEach((w,i)=>{
      const li=wordEls[i];setText(li,w.text);
      li.className=`rui-word is-${w.state}${w.opponent?' has-opp':''}`;
      if(w.state==='active')li.setAttribute('aria-current','true');else li.removeAttribute('aria-current');
    });
    wordEls.forEach((li,i)=>setHidden(li,i>=vm.words.length));
    ensureTicker(true);
    tick();
  }
  function showClash(payload){
    if(!isRoundMatch(state.match)&&!state.match)return;
    if(payload?.clashId&&state.shownClash===payload.clashId)return;
    state.shownClash=payload?.clashId??null;
    const m=clashModel(payload,state.match);
    setText(clashTitle,m.title);setText(clashWord,m.word?`«${m.word}»`:'');setText(clashDetail,m.detail);
    clash.className=`rui-clash is-${m.variant}${m.blockerSeat?` is-seat-${m.blockerSeat}`:''}`;
    setHidden(clash,false);announce(`Çarpışma: ${m.detail}`);
    for(const side of sideEls)setFlag(side.node,'is-shield',side.seat===m.blockerSeat);
    if(state.clashTimer!==null)timers.clearTimeout(state.clashTimer);
    state.clashTimer=later(()=>{state.clashTimer=null;setHidden(clash,true);for(const side of sideEls)setFlag(side.node,'is-shield',false);},CLASH_MS);
  }

  return {
    el,
    update(match,myId){
      if(state.destroyed)return;
      state.match=match||null;state.myId=myId??null;
      if(isRoundMatch(match))trackDiffs(match);
      render();
    },
    handle(packet){
      if(state.destroyed||!packet||typeof packet!=='object')return;
      const p=packet.payload&&typeof packet.payload==='object'?packet.payload:{};
      try{
        if(packet.type==='ROUND_START'){
          settle('round-start'); // önceki raunddan kalan vuruş yeni raundda oynamaz
          state.lastRoundEnd=null;announce(`${p.suddenDeath?'Ani ölüm turu':`Raund ${p.round}`} başladı`);
          const seat=mySeatOf(p.match||state.match,state.myId);
          const rival=p.skills?.[seat===1?2:1];
          if(seat&&rival){const card=ROUND_SKILL_CARDS.find(c=>c.id===rival);setText(reveal,`Rakip: ${card?.name||rival} · ${card?.effect||''}`);state.revealUntil=now()+2400;setHidden(reveal,false);}
          else {state.revealUntil=0;setHidden(reveal,true);}
        }else if(packet.type==='ROUND_SKILL_ACK'){
          state.pending=false;announce('Süre becerisi seçimi onaylandı');
        }else if(packet.type==='ROUND_LAST_CALL'){
          state.lastCallRound=p.round??null;
          if(p.match&&!state.match)state.match=p.match;
          announce('Son çağrı: 5 saniye');
        }else if(packet.type==='ROUND_END'){
          state.lastRoundEnd={...p,matchId:p.match?.matchId??state.match?.matchId};
          const m=summaryModel(p,p.match||state.match,state.myId);
          announce(`${m.title}: ${m.damageLine}. ${m.hpLine}`);
        }else if(packet.type==='WORD_CLASH'){showClash(p.type==='WORD_CLASH'?p:{...p});return;}
        else return;
        if(p.match&&isRoundMatch(p.match))state.match=p.match;
        render();
      }catch(error){console.warn?.('Tur arayüzü paketi işlenemedi',error);}
    },
    tick,
    openIntermission:()=>state.gate,
    handleKey(event){
      const model=roundSkillPickerModel(state.match,state.myId);
      if(!state.panelOpen||!model.visible||model.locked)return false;
      if(event.altKey||event.ctrlKey||event.metaKey)return false;
      const index=Number(event.key)-1;
      let handled=false;
      if(index>=0&&index<3)handled=choose(ROUND_SKILL_CARDS[index].id);
      else if(event.key==='Enter')handled=lockPick();
      else if(event.key==='Escape')handled=lockPick(null);
      if(handled)event.preventDefault();
      return handled;
    },
    lockState(){return roundInputLock(state.match,state.myId,now());},
    destroy(){
      if(state.destroyed)return;state.destroyed=true;
      ensureTicker(false);
      if(state.gate?.timer!==null&&state.gate?.timer!==undefined)timers.clearTimeout(state.gate.timer);
      if(state.clashTimer!==null)timers.clearTimeout(state.clashTimer);
      for(const s of sideEls){if(s.breakTimer!==null)timers.clearTimeout(s.breakTimer);if(s.pulseTimer!==null)timers.clearTimeout(s.pulseTimer);s.breakTimer=s.pulseTimer=null;}
      state.clashTimer=null;(el.closest?.('#pvp-root'))?.classList.remove('rui-inter-open');el.remove();
    }
  };
}

/** Sonuç ekranına (phase15) tur skoru ve tur tablosu ekler; klasik maçta bloğu kaldırır. */
export function renderRoundsResult(root,match,myId,doc=globalThis.document){
  const card=root?.querySelector?.('[data-pvp15-results] .pvp15-card');if(!card)return;
  let block=card.querySelector('[data-rounds-result]');
  // Arena maçında raund galibiyeti yok (HP belirler): tur skoru bloğu gösterilmez, arena bloğu yeterli.
  const model=match?.status==='ended'&&match?.mode!=='arena'&&match?.result?.mode!=='arena'?roundsResultModel(match.result,myId):null;
  if(!model){block?.remove();return;}
  const h=builder(doc);
  if(model.reasonLabel){const reason=card.querySelector('[data-pvp15-reason]');if(reason)reason.textContent=model.reasonLabel;}
  const score=h('div',{cls:'rui-res-score'},
    h('span',{cls:`rui-res-name rui-col-1${model.mySeat===1?' is-me':''}`,text:model.names[0]}),
    h('strong',{cls:'rui-res-line',text:model.scoreline,attrs:{'aria-label':`Kalan can ${model.scoreline}`,'data-rounds-scoreline':''}}),
    h('span',{cls:`rui-res-name rui-col-2${model.mySeat===2?' is-me':''}`,text:model.names[1]}));
  const list=h('ol',{cls:'rui-res-rounds',attrs:{'aria-label':'Raund tablosu: raund başına iki tarafın hasarı'}},...model.rows.map(r=>h('li',{cls:`rui-res-round${r.winnerSeat?` is-seat-${r.winnerSeat}`:' is-draw'}`},
    h('span',{cls:'rui-res-label',text:r.label}),h('b',{text:`Hasar ${r.damage}`}),r.ko?h('em',{cls:'rui-ko',text:'NAKAVT'}):null)));
  const next=h('div',{cls:'rui-result',attrs:{'data-rounds-result':''}},h('small',{cls:'rui-res-len',text:model.lengthLabel}),score,list);
  if(block)block.replaceWith(next);
  else{const anchor=card.querySelector('[data-pvp15-reason]');anchor?anchor.after(next):card.prepend(next);}
}

/** rounds-ui.css'i bir kez yükler (index.html bağlantısı eklenene kadar güvence). */
export function ensureRoundsStyles(doc=globalThis.document){
  if(!doc?.head||doc.querySelector('link[href*="rounds-ui.css"]'))return;
  const link=doc.createElement('link');
  link.rel='stylesheet';link.href=new URL('./rounds-ui.css',import.meta.url).href;link.dataset.roundsCss='';
  doc.head.appendChild(link);
}
