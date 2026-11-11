/**
 * Arena modu arayüzü — docs/ARENA-MODU.md §8.2 (4 bölüm: RAUND ÖNCESİ → RAUND → RAUND SONRASI → ÖZET).
 * rounds-ui.js deseni: yalnızca sunucu (veya antrenman motoru) anlık görüntülerini ve ARENA_* paketlerini
 * gösterir; hasar, HP ve kalan süre yerelde hesaplanmaz. Tüm metin textContent ile yazılır.
 * Kalan süre: motor `remainingMs`'i kendi saatine göre verir; burada her yeni anlık görüntüde
 * `şimdi + remainingMs` tahmini alınır ve raund boyunca en küçüğü tutulur (ARENA_ROUND_START'taki
 * kişisel `endsAt` üst sınırdır). Sunucu her gönderimi yine kendi saatiyle doğrular.
 */
import {WORD_BANK} from './shared/words.js';
import {createRoundEndCard,summaryColors,ROUND_TITLE_MS} from './rounds-ui.js';
import {ARENA_ROUND_DURATION_MS,ARENA_SUMMARY_MS,ARENA_PREP_DURATION_MS} from './shared/arena.js';

// Şartname §2 sabitleri (yalnız sunum için aynalanır; otorite motordadır).
export const ARENA_UI_ROUND_WORDS=Object.freeze([5,10,15,15,15,20]);
export const ARENA_UI_TOTAL_ROUNDS=6;
export const ARENA_UI_ROUND_MS=ARENA_ROUND_DURATION_MS;
export const ARENA_UI_FREEZE_MS=3_000;
export const ARENA_UI_THIEF_MS=5_000;
export const ARENA_UI_MAX_USES=2;
const WRONG_FACTORS=[0.10,0.15,0.23,0.30];
const PENALTY_CAP=0.75;
const AUTO_LOCK_MS=700;

/** Skill/eşya kartları: fiil öncelikli başlık + resmi ad + tek satır etki. Tuşlar 1–5 skill, 6–9 eşya. */
export const ARENA_UI_SKILLS=Object.freeze([
  {id:'scramble',key:'1',icon:'🔀',verb:'Harfleri karıştır',name:'Harf Kaosu',detail:'Rakip kelimeleri karışık haliyle yazar'},
  {id:'overtime',key:'2',icon:'⏰',verb:'+5 sn ek süre al',name:'Zaman Hediyesi',detail:'Rakip bitirse de 5 sn daha yazarsın'},
  {id:'timethief',key:'3',icon:'🕜',verb:'Rakipten 5 sn çal',name:'Zaman Hırsızı',detail:'Rakibin raund süresi 25 sn olur'},
  {id:'freeze',key:'4',icon:'❄️',verb:'Saatini 3 sn dondur',name:'Donmuş An',detail:'İlk 3 sn süren akmaz'},
  {id:'blindclock',key:'5',icon:'🌑',verb:'Saati karart',name:'Karanlık Saat',detail:'Raund boyunca bir saat görünmez olur'}
].map(Object.freeze));
export const ARENA_UI_ITEMS=Object.freeze([
  {id:'combostone',key:'6',icon:'🔥',verb:'Komboyu güçlendir',name:'Kombo Yükselteci',detail:'KOMBO ×1.75 · FİNAL ×2.4'},
  {id:'cleanse',key:'7',icon:'🛡️',verb:'Yanlış cezasını sil',name:'Arınma Taşı',detail:'Bu raund yanlış çarpanı yok'},
  {id:'gauntlet',key:'8',icon:'🥊',verb:'Taban hasarı artır',name:'Ağır Eldiven',detail:'Doğru kelime başına +%10 hasar'},
  {id:'aegis',key:'9',icon:'⚡',verb:'Alınan hasarı azalt',name:'Çelik Kalkan',detail:'Bu raund aldığın hasar −%20'}
].map(Object.freeze));
const CATALOG=new Map([...ARENA_UI_SKILLS,...ARENA_UI_ITEMS].map(c=>[c.id,c]));
const BANK=new Set(WORD_BANK);

const num=n=>Number(n||0).toLocaleString('tr-TR');
const clamp01=v=>Math.max(0,Math.min(1,v));
const other=seat=>seat===1?2:1;
const playerBySeat=(match,seat)=>match?.players?.find(p=>p.seat===seat)||null;
const nameOf=(match,seat)=>String(playerBySeat(match,seat)?.name||`Oyuncu ${seat}`);
const PHASE_STEPS=Object.freeze([
  {id:'prep',label:'Hazırlık'},{id:'round',label:'Yazma'},{id:'resolve',label:'Vuruşlar'},{id:'summary',label:'Özet'}
]);
const END_REASON_LABELS=Object.freeze({KNOCKOUT:'NAKAVT',ROUNDS:'KALAN HP ÜSTÜNLÜĞÜ',ARENA_DRAW:'BERABERE',SURRENDER:'TESLİM OLMA',
  DISCONNECT_FORFEIT:'BAĞLANTI HÜKMEN YENİLGİ',BOTH_DISCONNECTED:'MAÇ İPTALİ'});
const arenaRecords=new Map();
const freshRecord=()=>({rounds:new Map(),seen:new Set(),activeRound:1});
function matchRecord(id){
  if(!id)return freshRecord();
  if(!arenaRecords.has(id))arenaRecords.set(id,freshRecord());
  while(arenaRecords.size>3)arenaRecords.delete(arenaRecords.keys().next().value);
  return arenaRecords.get(id);
}
function roundRecord(record,n){
  if(!record.rounds.has(n))record.rounds.set(n,{1:{damage:0,combo:0,final:0,penaltyLost:0,skill:undefined,item:undefined},
    2:{damage:0,combo:0,final:0,penaltyLost:0,skill:undefined,item:undefined}});
  return record.rounds.get(n);
}
/** Sunucunun gönderdiği vuruşları id ile tekilleştir; aynı olay anlık görüntüde de gelebilir. */
export function recordArenaAttack(matchId,round,event){
  if(!matchId||event?.type!=='ARENA_ATTACK'||![1,2].includes(event.fromSeat))return;
  const record=matchRecord(matchId),id=Number(event.id);
  if(Number.isFinite(id)&&record.seen.has(id))return;
  if(Number.isFinite(id))record.seen.add(id);
  const side=roundRecord(record,Number(round)||record.activeRound)[event.fromSeat];
  const amount=Math.max(0,Number(event.amount)||0),penalty=Math.max(0,Math.min(.75,Number(event.penalty)||0));
  side.damage+=amount;
  // amount has already been rounded by the engine; this is the nearest unpenalized damage.
  side.penaltyLost+=Math.max(0,Math.round(amount/(1-penalty))-amount);
  const tags=Array.isArray(event.tags)?event.tags:[];
  if(tags.includes('KOMBO'))side.combo++;
  if(tags.includes('FİNAL'))side.final++;
  if(tags.includes('AĞIR'))side.item='gauntlet';
  if(tags.includes('ARINMA'))side.item='cleanse';
  if(Number(event.multiplier)>=2.4||(tags.includes('KOMBO')&&Number(event.multiplier)>=1.75))side.item='combostone';
}
export function recordArenaSnapshot(match){
  if(!isArenaMatch(match))return;
  const record=matchRecord(match.matchId);record.activeRound=Number(match.round.index)||record.activeRound;
  const seat=match.me?.seat;
  if([1,2].includes(seat)){
    const own=roundRecord(record,record.activeRound)[seat];
    if(match.me.picks){own.skill=match.me.picks.skill;own.item=match.me.picks.item;}
    const rival=roundRecord(record,record.activeRound)[other(seat)];
    if(match.me.blindClock)rival.skill='blindclock';
    else if(match.round.phase==='round'&&looksScrambled(match.round.words))rival.skill='scramble';
  }
  let eventRound=record.activeRound;
  for(const event of match.combatEvents||[]){
    if(event.type==='ARENA_PREP_START')eventRound=Number(event.round)||eventRound;
    if(event.type==='ARENA_ATTACK')recordArenaAttack(match.matchId,eventRound,event);
  }
}
const pickLabel=(id,kind)=>{const c=CATALOG.get(id);return c?`${c.icon} ${c.name}`:(id===null?'—':kind==='opponent'?'Açıklanmadı':'—');};

export function isArenaMatch(match){return Boolean(match&&match.mode==='arena'&&match.round&&typeof match.round==='object');}
function mySeatOf(match,myId){
  if(match?.me?.seat&&(!myId||match.me.playerId===myId))return match.me.seat;
  return match?.players?.find(p=>p.playerId===myId)?.seat||match?.me?.seat||null;
}
function meOf(match,myId){
  if(match?.me&&(!myId||match.me.playerId===myId))return match.me;
  return match?.players?.find(p=>p.playerId===myId)||null;
}

/** Bu oyuncunun yazacağı kelime (kişisel: Harf Kaosu'nda karışık hali). */
export function arenaTarget(match,myId){
  if(!isArenaMatch(match))return null;
  const me=meOf(match,myId);if(!me)return null;
  const words=Array.isArray(match.round.words)?match.round.words:[];
  if(match.round.phase!=='round'||me.roundDone)return '';
  return String(words[Number(me.roundWordIndex)||0]??'');
}

/** Giriş kilidi: yalnız `round` fazında, raundu bitirmemişken ve kişisel süre dolmamışken açık. */
export function arenaInputLock(match,myId,serverNow,personalEnd=null){
  if(!isArenaMatch(match)||match.status!=='running')return {locked:false,reason:null};
  const phase=match.round.phase;
  if(phase==='prep')return {locked:true,clearInput:true,reason:'Raund öncesi · skill ve eşya seç'};
  if(phase==='resolve')return {locked:true,clearInput:true,reason:'Vuruşlar çözülüyor · dövüşü izle'};
  if(phase==='summary')return {locked:true,clearInput:true,reason:'Raund özeti · sıradaki hazırlık geliyor'};
  if(phase!=='round')return {locked:true,clearInput:true,reason:'Maç bitti'};
  const me=meOf(match,myId);
  if(me?.roundDone)return {locked:true,clearInput:true,reason:'Tamamlandı ✓ · rakip bekleniyor'};
  if(Number.isFinite(personalEnd)&&serverNow>=personalEnd)return {locked:true,clearInput:true,reason:'Süren doldu · raund kapanıyor'};
  if(Number.isFinite(match.round.endsAt)&&serverNow>=match.round.endsAt)return {locked:true,clearInput:true,reason:'Süre doldu · raund kapanıyor'};
  return {locked:false,reason:null};
}

/** §5.2 yanlış çarpanı (toplamsal, tavan %75); Arınma Taşı cezayı kaldırır. */
export function arenaPenalty(consecutiveWrong,item=null){
  if(item==='cleanse')return 0;
  const n=Math.max(0,Math.floor(Number(consecutiveWrong)||0));
  let sum=0;for(let i=0;i<n;i++)sum+=WRONG_FACTORS[Math.min(i,WRONG_FACTORS.length-1)];
  return Math.min(PENALTY_CAP,Math.round(sum*100)/100);
}
/** §5.3 kombo: 4 hücre; 4. doğru KOMBO, 5+ FİNAL. */
export function arenaComboModel(streak,item=null){
  const s=Math.max(0,Math.floor(Number(streak)||0));
  const boost=item==='combostone';
  const label=s>=5?`FİNAL ×${boost?'2.4':'2'}`:s===4?`KOMBO ×${boost?'1.75':'1.5'}`:null;
  return {streak:s,cells:4,filled:Math.min(4,s),label,final:s>=5};
}

/** Karışık kelime tespiti: kelimelerin en az yarısı kelime bankasında yoksa Harf Kaosu etkisindesin. */
export function looksScrambled(words){
  const list=Array.isArray(words)?words.filter(Boolean):[];
  if(!list.length)return false;
  const unknown=list.filter(w=>!BANK.has(String(w))).length;
  return unknown>=Math.ceil(list.length/2);
}

/** ARENA_ATTACK → mevcut dövüş katmanlarının bildiği SKILL_CAST + DAMAGE_APPLIED çifti. */
export function arenaCombatActions(event){
  if(!event||typeof event!=='object')return [];
  if(event.type!=='ARENA_ATTACK')return [event];
  const tags=Array.isArray(event.tags)?event.tags.map(String):[];
  const skill=tags.includes('FİNAL')?'e':'q';
  const base={id:event.id,fromSeat:event.fromSeat,toSeat:event.toSeat,arena:true};
  return [
    {...base,type:'SKILL_CAST',skill},
    {...base,type:'DAMAGE_APPLIED',skill,amount:Math.max(0,Math.round(Number(event.amount)||0)),blocked:false,blockKind:null,
      counter:false,shieldBreak:false,bonusTags:tags.filter(t=>t==='KOMBO'||t==='FİNAL'),hpAfter:event.hpAfter,
      wordIndex:event.wordIndex,multiplier:event.multiplier,penalty:event.penalty,tags}
  ];
}

export function arenaSummaryModel(roundEnd,match,myId,{damage=null,record=null}={}){
  const round=Number(roundEnd?.round)||Number(match?.round?.index)||1;
  const total=Number(match?.round?.total)||ARENA_UI_TOTAL_ROUNDS;
  const scores=[1,2].map(seat=>(roundEnd?.scores||[]).find(s=>s.seat===seat)||{});
  const dealt=[1,2].map((seat,i)=>Number(damage?.[seat]??scores[i].damageDealt)||0);
  const hp=[1,2].map((seat,i)=>playerBySeat(match,seat)?.hp??scores[i].hpLeft);
  const names=[1,2].map(seat=>nameOf(match,seat)+(playerBySeat(match,seat)?.playerId===myId?' (sen)':''));
  const known=v=>v===undefined||v===null?'—':num(v);
  const details=(record||matchRecord(match?.matchId)).rounds.get(round)||roundRecord(freshRecord(),round);
  const meSeat=mySeatOf(match,myId);
  const revealed=Array.isArray(roundEnd?.picks)?roundEnd.picks:
    (match?.lastRoundPicks?.round===round?match.lastRoundPicks.picks:null);
  const selection=(seat,kind)=>{
    const pick=revealed?.find(p=>p.seat===seat);
    return pickLabel(pick&&Object.hasOwn(pick,kind)?pick[kind]:details[seat][kind],seat===meSeat?'own':'opponent');
  };
  const rows=[
    {label:'Doğru',values:scores.map(s=>known(s.correct))},
    {label:'Yanlış',values:scores.map(s=>known(s.wrong))},
    {label:'En iyi seri',values:scores.map(s=>known(s.bestStreak))},
    {label:'KOMBO / FİNAL',values:[1,2].map(seat=>`${num(details[seat].combo)} / ${num(details[seat].final)}`)},
    {label:'Ceza kaybı',values:[1,2].map(seat=>num(details[seat].penaltyLost))},
    {label:'Skill',values:[1,2].map(seat=>selection(seat,'skill'))},
    {label:'Eşya',values:[1,2].map(seat=>selection(seat,'item'))},
    {label:'Verilen hasar',values:dealt.map(num)},
    {label:'Kalan HP',values:hp.map(known)}
  ];
  const winnerSeat=dealt[0]===dealt[1]?null:dealt[0]>dealt[1]?1:2;
  const next=round+1;
  const wins={1:0,2:0};
  for(const r of match?.roundResults||[])if(r.winnerSeat)wins[r.winnerSeat]++;
  return {round,title:`RAUND ${round} BİTTİ`,names,rows,winnerSeat,colors:summaryColors(match),
    pips:[1,2].map(seat=>({filled:wins[seat],total})),
    winnerText:winnerSeat?`${nameOf(match,winnerSeat)} RAUNDU ALDI`:'BERABERE',
    nextText:round<total?`Sıradaki: RAUND ${next} · ${ARENA_UI_ROUND_WORDS[next-1]??'—'} kelime`:'Maç sonucu hazırlanıyor'};
}

export function arenaResultModel(result,myId,{record=null}={}){
  if(!result||result.mode!=='arena')return null;
  const players=[...(result.players||[])].sort((a,b)=>a.seat-b.seat);
  const name=seat=>String(players.find(p=>p.seat===seat)?.name||`Oyuncu ${seat}`);
  const details=record||matchRecord(result.matchId);
  const totals=seat=>[...details.rounds.values()].reduce((sum,r)=>sum+r[seat].penaltyLost,0);
  return {
    reasonLabel:END_REASON_LABELS[result.endReason]||null,
    mvp:result.mvpSeat?name(result.mvpSeat):null,
    rows:players.map(p=>({seat:p.seat,name:String(p.name||`Oyuncu ${p.seat}`),isMe:p.playerId===myId,winner:p.seat===result.winnerSeat,
      hp:`${num(p.hp)} / ${num(p.maxHp)} HP`,damage:num(p.damageDealt),penalty:num(totals(p.seat)),correct:num(p.correctWords),wrong:num(p.wrongWords),maxCombo:num(p.maxCombo)})),
    rounds:(Array.isArray(result.rounds)?result.rounds:[]).map(r=>{
      const d=seat=>(r.scores||[]).find(s=>s.seat===seat)?.damageDealt;
      const detail=details.rounds.get(r.round)||roundRecord(freshRecord(),r.round);
      const selection=(seat,kind)=>{
        const pick=r.picks?.find(p=>p.seat===seat);
        return pickLabel(pick&&Object.hasOwn(pick,kind)?pick[kind]:detail[seat][kind],
          players.find(p=>p.seat===seat)?.playerId===myId?'own':'opponent');
      };
      return {label:`Raund ${r.round}`,winner:r.winnerSeat?name(r.winnerSeat):'Berabere',winnerSeat:r.winnerSeat??null,
        damage:[num(d(1)),num(d(2))],picks:[1,2].map(seat=>`${selection(seat,'skill')} · ${selection(seat,'item')}`)};
    })
  };
}

// ------------------------------------------------------------ mod seçici ---
export const MODE_OPTIONS=Object.freeze([
  {id:'classic',label:'Klasik',hint:'120 sn düello'},
  {id:'rounds',label:'Zamana Karşı',hint:'tur · 40 sn'},
  {id:'arena',label:'Arena',hint:'6 raund · skill + eşya'}
].map(Object.freeze));
export const PRACTICE_MODE_KEY='tuslab-pvp-practice-mode';
export function normalizeMode(value){return MODE_OPTIONS.some(o=>o.id===value)?value:'rounds';}
/** Odada yalnız host, waiting/countdown iken MATCH_CONFIG gönderir; antrenmanda yerel saklanır. */
export function modePickDecision({scope,value,isHost,phase,current,rounds}={}){
  if(!MODE_OPTIONS.some(o=>o.id===value))return null;
  if(scope==='practice')return {store:value};
  if(scope!=='room'||!isHost||!['waiting','countdown'].includes(phase)||value===current)return null;
  return {type:'MATCH_CONFIG',payload:value==='rounds'?{mode:'rounds',rounds:Number(rounds)||5}:{mode:value}};
}
export function modePickerHTML(scope){
  const s=scope==='practice'?'practice':'room';
  return `<div class="rui-picker aui-modes" data-mode-picker="${s}"><span class="rui-picker-label" id="aui-mode-${s}">Oyun modu</span>`
    +`<div class="rui-seg" role="group" aria-labelledby="aui-mode-${s}">`
    +MODE_OPTIONS.map(o=>`<button type="button" data-lobby-action="mode" data-mode-scope="${s}" data-mode="${o.id}" aria-pressed="${o.id==='rounds'}" title="${o.label} modunu seç · ${o.hint}"><b>${o.label}</b> <small>${o.hint}</small></button>`).join('')
    +`</div><small class="rui-picker-note" data-mode-note></small></div>`;
}
export function syncModePicker(container,scope,{value,editable,note=''}={}){
  const box=container?.querySelector(`[data-mode-picker="${scope}"]`);if(!box)return;
  const current=normalizeMode(value);
  box.dataset.readonly=String(!editable);box.dataset.mode=current;
  box.querySelectorAll('[data-mode]').forEach(b=>{
    if(!b.dataset.modeScope)return;
    const pressed=String(b.dataset.mode===current);
    if(b.getAttribute('aria-pressed')!==pressed)b.setAttribute('aria-pressed',pressed);
    if(b.disabled!==!editable)b.disabled=!editable;
  });
  const n=box.querySelector('[data-mode-note]');if(n&&n.textContent!==note)n.textContent=note;
}

// ------------------------------------------------------------------ DOM ---
function builder(doc){
  return (tag,props={},...kids)=>{
    const el=doc.createElement(tag);
    if(props.cls)el.className=props.cls;
    if(props.aui)el.dataset.aui=props.aui;
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
const setAttr=(el,k,v)=>{const s=String(v);if(el&&el.getAttribute(k)!==s)el.setAttribute(k,s);};
const secsOf=ms=>Math.max(0,Math.ceil(ms/1000));

/**
 * createArenaUi({hudHost,stageHost,overlayHost,now,send}) →
 *   {update(match,myId), handle({type,payload}), handleKey(event)→bool, lockState(), personalEnd(), tick(), destroy()}
 * hudHost: üst HUD satırı (.pvp2-announce); stageHost: üst yazma panelindeki yuva; overlayHost: özet kartı.
 */
export function createArenaUi({hudHost,stageHost,overlayHost,now=()=>Date.now(),doc=globalThis.document,timers=globalThis,
  isReduced=()=>false,send=()=>{},onLockChange=null,holdTransition=null}={}){
  const h=builder(doc);
  // ---------------- HUD: [taraf 1] [madalyon] [taraf 2]
  const sides=[1,2].map(seat=>{
    const name=h('strong',{cls:'aui-name'});
    const you=h('span',{cls:'aui-you',text:'SEN',hidden:true});
    const progress=h('span',{cls:'aui-progress',aui:'progress'});
    const hpFill=h('span',{cls:'aui-hp-fill'});
    const hpTrack=h('div',{cls:'aui-hp',aui:'hp',attrs:{role:'meter','aria-valuemin':'0','aria-valuemax':'3000','aria-valuenow':'3000','aria-label':`Oyuncu ${seat} can puanı`}},hpFill);
    const hpText=h('span',{cls:'aui-hp-text'});
    const clock=h('span',{cls:'aui-clock',aui:'clock',attrs:{title:'Kişisel kalan süre'}});
    const cells=Array.from({length:4},(_,i)=>h('i',{cls:`aui-cell${i===3?' aui-cell-final':''}`}));
    const comboLabel=h('span',{cls:'aui-combo-label'});
    const combo=h('div',{cls:'aui-combo',aui:'combo',attrs:{role:'meter','aria-valuemin':'0','aria-valuemax':'4','aria-valuenow':'0','aria-label':`Oyuncu ${seat} kombo`}},h('span',{cls:'aui-cells'},...cells),comboLabel);
    const penalty=h('span',{cls:'aui-penalty',aui:'penalty',hidden:true,attrs:{title:'Sonraki doğru kelimenin hasar düşüşü'}});
    const done=h('span',{cls:'aui-done',hidden:true});
    const node=h('div',{cls:`aui-side aui-side-${seat}`,aui:'side'},
      h('div',{cls:'aui-side-top'},name,you,progress,done),
      h('div',{cls:'aui-hp-row'},hpTrack,hpText),
      h('div',{cls:'aui-side-meta'},clock,combo,penalty));
    return {seat,node,name,you,progress,hpFill,hpTrack,hpText,clock,cells,comboLabel,combo,penalty,done};
  });
  const title=h('div',{cls:'aui-title',aui:'title'});
  const secs=h('strong',{cls:'aui-secs',aui:'secs'});
  const unit=h('small',{cls:'aui-unit'});
  const steps=h('ol',{cls:'aui-steps',attrs:{'aria-label':'Raund akışı'}},
    ...PHASE_STEPS.map(s=>h('li',{cls:'aui-step',attrs:{'data-step':s.id}},h('span',{text:s.label}))));
  const medal=h('div',{cls:'aui-medal',aui:'medal'},title,h('div',{cls:'aui-clockface'},secs,unit),steps);
  const hud=h('div',{cls:'aui-hud',attrs:{'data-arena-ui':''},hidden:true},sides[0].node,medal,sides[1].node);
  hudHost?.append(hud);

  // ---------------- Yazma paneli yuvası: durum çipleri, D/Y şeridi, hazırlık kartları
  const chips=h('div',{cls:'aui-chips',aui:'chips'});
  const chip=(cls,text)=>{const c=h('span',{cls:`aui-chip ${cls}`,text,hidden:true});chips.append(c);return c;};
  const chipScramble=chip('is-scramble','🔀 HARF KAOSU · kelimeyi gördüğün gibi yaz');
  const chipThief=chip('is-thief','🕜 Zaman Hırsızı · süren 5 sn kısaldı');
  const chipFreeze=chip('is-freeze','❄ Saatin donmuş');
  const chipBlind=chip('is-blind','🌑 KARANLIK SAAT · bu raund süreleri göremezsin');
  const chipOvertime=chip('is-gift','⏰ +5 sn ek süre');
  const chipPicks=chip('is-picks','');
  const strip=h('ol',{cls:'aui-words',aui:'strip',attrs:{'aria-label':'Bu raundun kelimeleri ve doğru/yanlış durumu'}});
  // Hazırlık bölümü
  const prepTitle=h('strong',{cls:'aui-prep-title'});
  const prepTimer=h('span',{cls:'aui-prep-timer',aui:'prep-timer'});
  const cardEls=[];
  const cardFor=c=>{
    const uses=h('span',{cls:'aui-uses'});
    const btn=h('button',{cls:'aui-card',aui:'card',attrs:{type:'button','aria-pressed':'false','data-kind':ARENA_UI_SKILLS.includes(c)?'skill':'item','data-id':c.id,title:`${c.name} · ${c.detail}`,
      'aria-label':`${c.verb} — ${c.name}. ${c.detail}. Kısayol ${c.key}`}},
      h('kbd',{cls:'aui-key',text:c.key}),h('span',{cls:'aui-icon',text:c.icon,attrs:{'aria-hidden':'true'}}),
      h('span',{cls:'aui-card-copy'},h('strong',{text:c.verb}),h('small',{text:`${c.name} · ${c.detail}`})),uses);
    btn.addEventListener('click',()=>select(c.id));
    cardEls.push({c,btn,uses});return btn;
  };
  const skillGrid=h('div',{cls:'aui-cards',attrs:{role:'group','aria-label':'Skill seç (1–5)'}},...ARENA_UI_SKILLS.map(cardFor));
  const itemGrid=h('div',{cls:'aui-cards aui-cards-items',attrs:{role:'group','aria-label':'Eşya seç (6–9)'}},...ARENA_UI_ITEMS.map(cardFor));
  const lockLabel=h('span',{cls:'aui-lock-label'}),lockKbd=h('kbd',{text:'Enter'});
  const lockBtn=h('button',{cls:'aui-lock',aui:'lock',attrs:{type:'button'}},lockLabel,lockKbd);
  const skipBtn=h('button',{cls:'aui-skip',aui:'skip',attrs:{type:'button'}},h('span',{text:'Seçmeden geç'}),h('kbd',{text:'Esc'}));
  const lockNote=h('span',{cls:'aui-lock-note',aui:'lock-note',text:'Rakibin seçimi gizli · senin seçimin de ona gizli'});
  lockBtn.addEventListener('click',()=>lock());skipBtn.addEventListener('click',()=>skip());
  const prep=h('section',{cls:'aui-prep',aui:'prep',hidden:true,attrs:{'aria-label':'Raund öncesi seçim'}},
    h('header',{cls:'aui-prep-head'},prepTitle,prepTimer),
    h('div',{cls:'aui-group'},h('span',{cls:'aui-group-label',text:'Skill · rakibe ya da saate etki eder'}),skillGrid),
    h('div',{cls:'aui-group'},h('span',{cls:'aui-group-label',text:'Eşya · bu raundun hasarına etki eder'}),itemGrid),
    h('footer',{cls:'aui-prep-foot'},lockNote,skipBtn,lockBtn));
  const live=h('span',{cls:'aui-sr',attrs:{'aria-live':'polite','aria-atomic':'true'}});
  const stage=h('div',{cls:'aui-stage',attrs:{'data-arena-stage':''},hidden:true},chips,strip,prep,live);
  stageHost?.append(stage);

  // ---------------- Özet kartı
  const summary=h('section',{cls:'aui-summary',aui:'summary',hidden:true,attrs:{'aria-label':'Raund özeti',role:'status'}});
  // Hazırlık başında "RAUND X" yazısı önce tek başına (≈900 ms); sonra kompakt seçim paneli açılır.
  const bannerTitle=h('strong',{cls:'rui-banner-title'});
  const banner=h('div',{cls:'rui-banner aui-banner',aui:'banner',hidden:true,attrs:{'aria-hidden':'true'}},bannerTitle);
  const overlay=h('div',{cls:'aui-overlay',attrs:{'data-arena-overlay':''}},summary,banner);
  overlayHost?.append(overlay);

  const state={match:null,myId:null,destroyed:false,interval:null,visible:false,
    selected:{skill:null,item:null},prepKey:null,sentKey:null,
    marksKey:null,marks:new Map(),endKey:null,myEnd:Infinity,oppEnd:Infinity,roundStartEnd:null,lastSeq:null,
    roundEnds:new Map(),damageBase:new Map(),summaryKey:null,endCard:null,lockKey:'',wordKey:null,announced:null,summaryGate:null};
  const announce=text=>{live.textContent='';live.textContent=text;};
  const roundKey=m=>`${m?.matchId}:${Number(m?.round?.index)||0}`;
  const phase=()=>state.match?.round?.phase||null;
  const locked=()=>state.sentKey!==null&&state.sentKey===state.prepKey;

  function ensureTicker(on){
    if(on&&state.interval===null)state.interval=timers.setInterval(()=>{if(!doc.hidden)tick();},200);
    if(!on&&state.interval!==null){timers.clearInterval(state.interval);state.interval=null;}
  }
  function select(id){
    if(phase()!=='prep'||locked())return false;
    const c=CATALOG.get(id);if(!c)return false;
    const kind=ARENA_UI_SKILLS.includes(c)?'skill':'item';
    const uses=state.match?.me?.usesLeft?.[kind==='skill'?'skills':'items']?.[id];
    if(uses!==undefined&&uses<=0)return false;
    state.selected={...state.selected,[kind]:state.selected[kind]===id?null:id};
    renderPrep();return true;
  }
  function lock(){
    if(phase()!=='prep'||locked())return false;
    state.sentKey=state.prepKey;
    try{send('ARENA_PICK',{skill:state.selected.skill,item:state.selected.item});}catch{}
    const names=[state.selected.skill,state.selected.item].map(id=>CATALOG.get(id)?.name).filter(Boolean);
    announce(names.length?`Seçim kilitlendi: ${names.join(' ve ')}`:'Seçim yapmadan geçtin');
    renderPrep();return true;
  }
  function skip(){if(phase()!=='prep'||locked())return false;state.selected={skill:null,item:null};return lock();}

  function personalEnd(){return Number.isFinite(state.myEnd)?state.myEnd:null;}
  function freezeUntil(){
    const m=state.match;
    return m?.me?.picks?.skill==='freeze'&&Number.isFinite(m.round.startedAt)?m.round.startedAt+ARENA_UI_FREEZE_MS:null;
  }
  function blindMe(){const m=state.match;return Boolean(m?.me&&m.round?.phase==='round'&&(m.me.blindClock||m.me.remainingMs===null));}
  function myRemaining(t){
    const end=personalEnd();if(end===null)return null;
    const f=freezeUntil();
    return Math.max(0,end-Math.max(t,f??t));
  }
  function trackClocks(m){
    const key=roundKey(m);
    if(state.endKey!==key){state.endKey=key;state.myEnd=Infinity;state.oppEnd=Infinity;state.roundStartEnd=null;state.lastSeq=null;}
    if(m.round.phase!=='round'||m.sequence===state.lastSeq)return;
    state.lastSeq=m.sequence;const t=now();
    if(Number.isFinite(m.me?.remainingMs))state.myEnd=Math.min(state.myEnd,t+m.me.remainingMs);
    if(Number.isFinite(m.opponent?.remainingMs))state.oppEnd=Math.min(state.oppEnd,t+m.opponent.remainingMs);
  }
  function trackDamage(m){
    const key=roundKey(m);
    if(!state.damageBase.has(key)&&['prep','round'].includes(m.round.phase)){
      state.damageBase.set(key,{1:Number(playerBySeat(m,1)?.combatStats?.damageDealt)||0,2:Number(playerBySeat(m,2)?.combatStats?.damageDealt)||0});
      if(state.damageBase.size>8)state.damageBase.delete(state.damageBase.keys().next().value);
    }
  }
  function marksFor(m){
    const key=roundKey(m);
    if(state.marksKey!==key){state.marksKey=key;state.marks=new Map();}
    return state.marks;
  }
  function trailingWrong(m,me){
    const marks=marksFor(m);let n=0;
    for(let i=(Number(me?.roundWordIndex)||0)-1;i>=0;i--){const v=marks.get(i);if(v==='bad')n++;else break;}
    return n;
  }

  function renderSide(side,m,mySeat,t){
    const p=playerBySeat(m,side.seat);const isMe=side.seat===mySeat;
    setText(side.name,nameOf(m,side.seat));setHidden(side.you,!isMe);setFlag(side.node,'is-me',isMe);
    const hp=Number(p?.hp)||0,max=Number(p?.maxHp)||3000;
    side.hpFill.style.width=`${(clamp01(hp/max)*100).toFixed(2)}%`;
    setFlag(side.hpTrack,'is-low',hp/max<.3);
    setAttr(side.hpTrack,'aria-valuenow',hp);setAttr(side.hpTrack,'aria-valuemax',max);
    setText(side.hpText,`${num(hp)} / ${num(max)}`);
    const words=Array.isArray(m.round.words)?m.round.words.length:0;
    const count=words||ARENA_UI_ROUND_WORDS[(Number(m.round.index)||1)-1]||0;
    setText(side.progress,m.round.phase==='prep'?`${count} kelime`:`${Math.min(count,Number(p?.roundWordIndex)||0)}/${count}`);
    setHidden(side.done,!p?.roundDone||m.round.phase!=='round');setText(side.done,'Bitirdi ✓');
    // Kombo: kendi eşyam bilinir, rakibinki gizli.
    const cm=arenaComboModel(p?.combo,isMe?m.me?.picks?.item:null);
    side.cells.forEach((c,i)=>setFlag(c,'is-on',i<cm.filled));
    setFlag(side.combo,'is-final',cm.final);setFlag(side.combo,'is-combo',cm.filled===4);
    setAttr(side.combo,'aria-valuenow',cm.filled);
    setText(side.comboLabel,cm.label||`Seri ${cm.streak}`);
    // Ceza çipi yalnız kendi tarafımda (kendi D/Y geçmişimden).
    if(isMe&&m.round.phase==='round'){
      const n=trailingWrong(m,m.me||p);const item=m.me?.picks?.item;
      const pen=arenaPenalty(n,item);
      setHidden(side.penalty,n===0);
      setText(side.penalty,item==='cleanse'?'🛡 ARINMA · ceza yok':`−%${Math.round(pen*100)}`);
      setFlag(side.penalty,'is-clean',item==='cleanse');
    }else setHidden(side.penalty,true);
    // Kişisel saat
    if(m.round.phase==='round'){
      setHidden(side.clock,false);
      if(isMe){
        const rem=myRemaining(t);const f=freezeUntil();
        const frozen=Boolean(m.me?.frozen)||(f!==null&&t<f);
        const blind=blindMe();
        setText(side.clock,p?.roundDone?'⏱ ✓':blind?'🌑 —':rem===null?'⏱ —':`${frozen?'❄':'⏱'} ${secsOf(rem)} sn`);
        setFlag(side.clock,'is-frozen',frozen&&!blind);setFlag(side.clock,'is-urgent',!blind&&rem!==null&&rem<=5000&&!p?.roundDone);setFlag(side.clock,'is-blind',blind);
        setAttr(side.clock,'title',blind?'Karanlık Saat: süren gizli':'Kişisel kalan süren');
      }else{
        const blind=m.opponent&&m.opponent.remainingMs===null;
        const rem=Number.isFinite(state.oppEnd)?Math.max(0,state.oppEnd-t):null;
        setText(side.clock,blind?'🌑 —':p?.roundDone?'⏱ ✓':rem===null?'⏱ —':`⏱ ${secsOf(rem)} sn`);
        setFlag(side.clock,'is-blind',Boolean(blind));setFlag(side.clock,'is-frozen',false);setFlag(side.clock,'is-urgent',false);
        setAttr(side.clock,'title',blind?'Karanlık Saat: rakibin süresi gizli':'Rakibin kalan süresi');
      }
    }else setHidden(side.clock,true);
  }
  function renderMedal(m,t){
    const r=m.round;
    setText(title,`RAUND ${r.index} / ${r.total||ARENA_UI_TOTAL_ROUNDS}${(r.index===(r.total||ARENA_UI_TOTAL_ROUNDS))?' · FİNAL':''}`);
    for(const li of steps.children){
      const id=li.getAttribute('data-step');
      const order=PHASE_STEPS.findIndex(s=>s.id===id),cur=PHASE_STEPS.findIndex(s=>s.id===r.phase);
      setFlag(li,'is-active',id===r.phase);setFlag(li,'is-past',cur>order);
      if(id===r.phase)li.setAttribute('aria-current','step');else li.removeAttribute('aria-current');
    }
    let value='—',label='';
    if(r.phase==='prep'){value=String(secsOf((Number(r.endsAt)||t)-t));label='sn';}
    else if(r.phase==='round'){
      const me=m.me;const rem=myRemaining(t);const f=freezeUntil();
      const blind=blindMe();
      value=me?.roundDone?'✓':blind?'🌑':rem===null?'—':String(secsOf(rem));
      label=me?.roundDone?'BİTİRDİN':blind?'KARANLIK':(f!==null&&t<f)||me?.frozen?'DONDU':'SANİYE';
      setFlag(medal,'is-urgent',!blind&&rem!==null&&rem<=5000&&!me?.roundDone);setFlag(medal,'is-frozen',label==='DONDU');setFlag(medal,'is-blind',blind);
    }
    else if(r.phase==='resolve'){value='⚔';label='';} // etiket: yalnız etkin adım ("3 Vuruşlar"); iki etiket üst üste binmesin
    else if(r.phase==='summary'){value=String(secsOf((Number(r.summaryEndsAt)||t)-t));label='sn';}
    else {value='—';label='';}
    if(r.phase!=='round'){setFlag(medal,'is-urgent',false);setFlag(medal,'is-frozen',false);setFlag(medal,'is-blind',false);}
    setText(secs,value);setText(unit,label);
    // Ekran okuyucu: son 10/5 sn
    if(r.phase==='round'&&!blindMe()){
      const s=Number(value);const a=`${roundKey(m)}:${s}`;
      if([10,5].includes(s)&&state.announced!==a){state.announced=a;announce(`${s} saniye kaldı`);}
    }
  }
  function renderStrip(m){
    const words=Array.isArray(m.round.words)?m.round.words:[];
    const me=m.me||meOf(m,state.myId);const opp=m.opponent;
    const idx=Number(me?.roundWordIndex)||0,oppIdx=Number(opp?.roundWordIndex);
    const key=`${roundKey(m)}:${words.length}:${words.join('|')}`;
    if(state.wordKey!==key){
      state.wordKey=key;
      strip.replaceChildren(...words.map((w,i)=>h('li',{cls:'aui-word',aui:'word',text:String(w),attrs:{'data-index':String(i)}})));
    }
    setFlag(strip,'is-compact',words.length>=15);
    setHidden(strip,!words.length||m.round.phase==='prep');
    const marks=marksFor(m);
    Array.from(strip.children).forEach((li,i)=>{
      const st=i<idx?(marks.get(i)||'done'):i===idx&&!me?.roundDone&&m.round.phase==='round'?'active':'todo';
      const cls=`aui-word is-${st}${Number.isFinite(oppIdx)&&!opp?.roundDone&&oppIdx===i&&m.round.phase==='round'?' has-opp':''}`;
      if(li.className!==cls)li.className=cls;
      if(st==='active')li.setAttribute('aria-current','true');else li.removeAttribute('aria-current');
      const sr=st==='good'?'doğru':st==='bad'?'yanlış':null;
      if(sr)setAttr(li,'aria-label',`${li.textContent} — ${sr}`);
    });
  }
  function renderChips(m,t){
    const round=m.round.phase==='round'||m.round.phase==='resolve';
    const scrambled=round&&looksScrambled(m.round.words);
    setHidden(chipScramble,!scrambled);
    setFlag(stage,'is-scrambled',scrambled);
    const freeze=m.me?.picks?.skill==='freeze';
    let thief=false;
    if(state.roundStartEnd!==null&&Number.isFinite(m.round.startedAt)){
      const dur=state.roundStartEnd-m.round.startedAt-(freeze?ARENA_UI_FREEZE_MS:0);
      thief=dur<=ARENA_UI_ROUND_MS-ARENA_UI_THIEF_MS+50;
    }
    setHidden(chipThief,!(m.round.phase==='round'&&thief));
    const f=freezeUntil();
    setHidden(chipBlind,!blindMe());
    setHidden(chipFreeze,!(m.round.phase==='round'&&((f!==null&&t<f)||m.me?.frozen)));
    const gift=m.me?.picks?.skill==='overtime'&&m.round.phase==='round';
    const giftActive=gift&&m.opponent?.roundDone&&!m.me?.roundDone;
    setHidden(chipOvertime,!gift);
    setText(chipOvertime,giftActive?'⏰ +5 sn ek süre · rakip bitirdi, yazmaya devam':'⏰ Zaman Hediyesi hazır · rakip bitirirse +5 sn');
    setFlag(chipOvertime,'is-active',Boolean(giftActive));
    const picks=[m.me?.picks?.skill,m.me?.picks?.item].map(id=>CATALOG.get(id)).filter(Boolean);
    setHidden(chipPicks,!(round&&picks.length));
    setText(chipPicks,`Seçimin: ${picks.map(c=>`${c.icon} ${c.name}`).join(' · ')}`);
  }
  /** Hazırlık yazısı: yalnız taze hazırlıkta (yeniden bağlanmada atlanır) ve ROUND_TITLE_MS boyunca; bu sürede panel gizli. */
  function prepBannerActive(m,t){
    if(m.round.phase!=='prep'){state.bannerKey=null;return false;}
    const key=roundKey(m);
    if(state.bannerKey!==key){
      state.bannerKey=key;
      const start=(Number(m.round.endsAt)||t)-ARENA_PREP_DURATION_MS;
      state.bannerAt=t-start<=800?t:-Infinity;
    }
    return t-state.bannerAt<ROUND_TITLE_MS;
  }
  function renderPrep(){
    const m=state.match;if(!m)return;
    const isPrep=m.round.phase==='prep';
    const t=now();
    const banner_=isPrep&&prepBannerActive(m,t);
    setHidden(banner,!banner_);if(banner_)setText(bannerTitle,`RAUND ${m.round.index}`);
    setFlag(stage,'is-banner',banner_);
    setHidden(prep,!isPrep);
    if(!isPrep)return;const left=secsOf((Number(m.round.endsAt)||t)-t);
    const count=ARENA_UI_ROUND_WORDS[(Number(m.round.index)||1)-1]||0;
    setText(prepTitle,`RAUND ${m.round.index} · HAZIRLIK — ${count} kelime gelecek. 1 skill + 1 eşya seç`);
    setText(prepTimer,`${left} sn`);
    const isLocked=locked();
    const usesLeft=m.me?.usesLeft||{};
    for(const {c,btn,uses} of cardEls){
      const kind=ARENA_UI_SKILLS.includes(c)?'skill':'item';
      const n=usesLeft[kind==='skill'?'skills':'items']?.[c.id];
      const left2=Number.isFinite(n)?n:ARENA_UI_MAX_USES;
      setText(uses,`${left2}/${ARENA_UI_MAX_USES}`);
      setAttr(uses,'aria-label',`${left2} hak kaldı`);
      const pressed=state.selected[kind]===c.id;
      setAttr(btn,'aria-pressed',pressed);
      setFlag(btn,'is-empty',left2<=0);
      const dis=isLocked||left2<=0;
      if(btn.disabled!==dis)btn.disabled=dis;
    }
    setFlag(prep,'is-locked',isLocked);
    if(isLocked){
      const names=[state.selected.skill,state.selected.item].map(id=>CATALOG.get(id)).filter(Boolean);
      setText(lockLabel,'✓ Kilitlendi · rakip bekleniyor');setHidden(lockKbd,true);
      setText(lockNote,names.length?`Seçimin: ${names.map(c=>`${c.icon} ${c.name}`).join(' · ')} · rakibin seçimi gizli`:'Bu raund seçim yok · rakibin seçimi gizli');
    }else{
      setText(lockLabel,`Seçimi kilitle · ${left} sn`);setHidden(lockKbd,false);
      setText(lockNote,'Rakibin seçimi gizli · senin seçimin de ona gizli');
    }
    if(lockBtn.disabled!==isLocked)lockBtn.disabled=isLocked;
    if(skipBtn.disabled!==isLocked)skipBtn.disabled=isLocked;
  }
  function currentRoundEnd(m){
    const idx=Number(m.round.index)||1;
    return state.roundEnds.get(`${m.matchId}:${idx}`)||null;
  }
  function renderSummary(m,t){
    const show=m.round.phase==='summary';
    if(show){
      const key=roundKey(m);
      if(state.summaryGate?.key!==key){
        const gate=state.summaryGate={key,ready:false,timer:null};
        const open=()=>{
          if(state.destroyed||state.summaryGate!==gate||gate.ready)return;
          gate.ready=true;
          if(gate.timer!==null){timers.clearTimeout(gate.timer);gate.timer=null;}
          tick();
        };
        let hold;
        try{hold=holdTransition?.(m,{round:Number(m.round.index)||1});}catch{hold=null;}
        if(hold&&typeof hold.then==='function'){
          gate.timer=timers.setTimeout(open,3000);
          hold.then(open,open);
        }else gate.ready=true;
      }
    }else if(state.summaryGate){
      if(state.summaryGate.timer!==null)timers.clearTimeout(state.summaryGate.timer);
      state.summaryGate=null;
    }
    const visible=show&&state.summaryGate?.ready;
    setHidden(summary,!visible);
    const pvp=overlayHost?.closest?.('#pvp-root');
    if(pvp)setFlag(pvp,'aui-summary-open',visible);
    if(!visible)return;
    const key=roundKey(m);const base=state.damageBase.get(key);
    const damage=base?{1:(Number(playerBySeat(m,1)?.combatStats?.damageDealt)||0)-base[1],2:(Number(playerBySeat(m,2)?.combatStats?.damageDealt)||0)-base[2]}:null;
    const source=m.roundSummary||currentRoundEnd(m)||{round:m.round.index};
    const s=arenaSummaryModel(source,m,state.myId,{damage,record:matchRecord(m.matchId)});
    const sumKey=`${key}:${m.sequence}:${matchRecord(m.matchId).seen.size}`;
    if(state.summaryKey!==sumKey){
      state.summaryKey=sumKey;
      state.endCard=createRoundEndCard(doc,s);summary.replaceChildren(state.endCard.node);
    }
    state.endCard?.update(m.round.summaryEndsAt,t,ARENA_SUMMARY_MS);
  }
  function tick(){
    if(state.destroyed)return;
    const m=state.match;const t=now();
    const inputLock=arenaInputLock(m,state.myId,t,personalEnd());
    const lockKey=`${inputLock.locked}:${inputLock.reason}`;
    if(lockKey!==state.lockKey){state.lockKey=lockKey;try{onLockChange?.(inputLock);}catch{}}
    if(!state.visible)return;
    // Süre bitmeden hemen önce seçili kartlar otomatik kilitlenir (seçim kaybolmaz).
    if(m.round.phase==='prep'&&!locked()&&(state.selected.skill||state.selected.item)&&Number(m.round.endsAt)-t<=AUTO_LOCK_MS)lock();
    const mySeat=mySeatOf(m,state.myId)||1;
    for(const side of sides)renderSide(side,m,mySeat,t);
    renderMedal(m,t);renderChips(m,t);renderPrep();renderSummary(m,t);
  }
  function render(){
    if(state.destroyed)return;
    const m=state.match;
    const visible=isArenaMatch(m)&&['running','paused'].includes(m.status);
    state.visible=visible;
    setHidden(hud,!visible);setHidden(stage,!visible);
    if(!visible){setHidden(summary,true);overlayHost?.closest?.('#pvp-root')?.classList.remove('aui-summary-open');ensureTicker(false);tick();return;}
    const pk=roundKey(m);
    if(m.round.phase==='prep'&&state.prepKey!==pk){state.prepKey=pk;state.selected={skill:null,item:null};}
    if(m.round.phase!=='prep')state.prepKey=pk;
    setAttr(hud,'data-phase',m.round.phase);setAttr(stage,'data-phase',m.round.phase);
    setFlag(hud,'me-2',mySeatOf(m,state.myId)===2);
    renderStrip(m);
    ensureTicker(true);
    tick();
  }

  return {
    hud,stage,overlay,
    update(match,myId){
      if(state.destroyed)return;
      state.match=match||null;state.myId=myId??null;
       if(isArenaMatch(match)){recordArenaSnapshot(match);trackClocks(match);trackDamage(match);}
      render();
    },
    handle(packet){
      if(state.destroyed||!packet||typeof packet!=='object')return;
      const p=packet.payload&&typeof packet.payload==='object'?packet.payload:{};
      try{
        const m=isArenaMatch(p.match)?p.match:state.match;
        if(packet.type==='ARENA_PREP_START'){if(m?.matchId)matchRecord(m.matchId).activeRound=Number(p.round)||1;announce(`Raund ${p.round} hazırlığı · skill ve eşya seç`);}
        else if(packet.type==='ARENA_ROUND_START'){
          const key=`${m?.matchId}:${Number(p.round)||0}`;
          if(state.endKey!==key){state.endKey=key;state.myEnd=Infinity;state.oppEnd=Infinity;state.lastSeq=null;}
          if(Number.isFinite(p.endsAt)){state.roundStartEnd=p.endsAt;state.myEnd=Math.min(state.myEnd,p.endsAt);}
          announce(`Raund ${p.round} başladı · ${Array.isArray(p.words)?p.words.length:''} kelime`);
        }else if(packet.type==='ARENA_ROUND_END'){
          state.roundEnds.set(`${m?.matchId}:${Number(p.round)||0}`,{round:p.round,scores:p.scores,roundsWon:p.roundsWon,picks:p.picks});
          if(state.roundEnds.size>8)state.roundEnds.delete(state.roundEnds.keys().next().value);
          announce(`Raund ${p.round} bitti · vuruşlar başlıyor`);
        }else if(packet.type==='ARENA_PICK_ACK'){
          if(m)state.sentKey=roundKey(m);
          if(p.skill!==undefined||p.item!==undefined)state.selected={skill:p.skill??null,item:p.item??null};
        }else if(packet.type==='WORD_RESULT'){
          if(!p.accepted||!Number.isInteger(p.wordIndex))return;
          const mm=state.match;
          if(mm&&(p.round===undefined||Number(p.round)===Number(mm.round.index)))marksFor(mm).set(p.wordIndex,p.correct?'good':'bad');
        }else if(packet.type==='ARENA_MATCH_END'){announce('Maç bitti');}
        else return;
        if(isArenaMatch(p.match))state.match=p.match;
        render();
      }catch(error){console.warn?.('Arena arayüzü paketi işlenemedi',error);}
    },
    /** Hazırlık klavyesi: 1–5 skill, 6–9 eşya, Enter kilitle, Esc seçmeden geç. Yazı alanında devre dışı. */
    handleKey(event){
      if(state.destroyed||!state.visible||phase()!=='prep'||locked())return false;
      if(state.match&&prepBannerActive(state.match,now()))return false; // panel yazıdan sonra açılır
      const tag=event?.target?.tagName;
      if(['INPUT','TEXTAREA','SELECT'].includes(tag)&&event.target?.dataset?.input===undefined)return false;
      if(event.ctrlKey||event.metaKey||event.altKey)return false;
      const key=String(event.key||'');
      const card=[...ARENA_UI_SKILLS,...ARENA_UI_ITEMS].find(c=>c.key===key);
      let handled=false;
      if(card)handled=select(card.id);
      else if(key==='Enter')handled=lock();
      else if(key==='Escape')handled=skip();
      if(handled)event.preventDefault?.();
      return handled;
    },
    lockState(){return arenaInputLock(state.match,state.myId,now(),personalEnd());},
    personalEnd,
    tick,
    destroy(){
      if(state.destroyed)return;state.destroyed=true;
      if(state.summaryGate?.timer!==null&&state.summaryGate?.timer!==undefined)timers.clearTimeout(state.summaryGate.timer);
      ensureTicker(false);overlayHost?.closest?.('#pvp-root')?.classList.remove('aui-summary-open');banner.remove();hud.remove();stage.remove();overlay.remove();
    }
  };
}

/** Sonuç ekranına (phase15) arena bloğu: kalan HP, toplam hasar, raund dökümü. Arena dışı maçta bloğu kaldırır. */
export function renderArenaResult(root,match,myId,doc=globalThis.document){
  const card=root?.querySelector?.('[data-pvp15-results] .pvp15-card');if(!card)return;
  let block=card.querySelector('[data-arena-result]');
  if(isArenaMatch(match))recordArenaSnapshot(match);
  const model=match?.status==='ended'?arenaResultModel(match.result,myId,{record:matchRecord(match.matchId)}):null;
  if(!model){block?.remove();delete card.dataset.arenaResult;return;}
  const h=builder(doc);
  card.dataset.arenaResult='';
  const rematch=card.querySelector('[data-pvp15-action="rematch"]');
  const leave=card.querySelector('[data-pvp15-action="leave"]');
  if(rematch&&rematch.textContent.includes('Rövanş İste'))rematch.textContent='⚔ Rövanş';
  if(leave)leave.textContent='Lobiye dön';
  if(model.reasonLabel){const reason=card.querySelector('[data-pvp15-reason]');if(reason)reason.textContent=model.reasonLabel;}
  const players=h('div',{cls:'aui-res-players'},...model.rows.map(r=>h('div',{cls:`aui-res-player aui-col-${r.seat}${r.isMe?' is-me':''}${r.winner?' is-win':''}`},
    h('strong',{text:`${r.winner?'👑 ':''}${r.name}${r.isMe?' (sen)':''}`}),
    h('span',{cls:'aui-res-hp',text:r.hp}),
     h('small',{text:`Hasar ${r.damage} · ceza kaybı ${r.penalty} · ${r.correct} doğru / ${r.wrong} yanlış · en iyi seri ${r.maxCombo}`}))));
  const list=h('div',{cls:'aui-res-table-wrap'},h('table',{cls:'aui-res-table',attrs:{'aria-label':'Raund dökümü'}},
    h('thead',{},h('tr',{},h('th',{attrs:{scope:'col'},text:'Raund'}),...model.rows.map(p=>h('th',{attrs:{scope:'col'},text:p.name})))),
    h('tbody',{},...model.rounds.map(r=>h('tr',{},h('th',{attrs:{scope:'row'},text:r.label}),
      ...r.damage.map((value,i)=>h('td',{},h('strong',{text:`${value} hasar`}),h('small',{text:r.picks[i]}))))),
      h('tr',{cls:'aui-res-total'},h('th',{attrs:{scope:'row'},text:'TOPLAM'}),...model.rows.map(p=>h('td',{},h('strong',{text:`${p.damage} hasar`}),h('small',{text:`${p.penalty} ceza kaybı`})))))));
  const next=h('div',{cls:'aui-result',attrs:{'data-arena-result':''}},h('small',{cls:'aui-res-len',text:'Arena · 6 raund · 3.000 HP'}),
    h('strong',{cls:'aui-res-mvp',text:model.mvp?`MVP · ${model.mvp}`:'MVP · Belirlenmedi'}),players,list);
  if(block)block.replaceWith(next);
  else{const anchor=card.querySelector('[data-pvp15-reason]');anchor?anchor.after(next):card.prepend(next);}
}
