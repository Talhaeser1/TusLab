import {setTextIfChanged as writeText,setAttributeIfChanged as writeAttr,setWidthIfChanged as writeWidth,shouldPaint} from './performance.js';
import {normalizeTyping,wordsMatch} from './shared/typing-rules.js';
import {normalizeAssist,partnerName} from './shared/assist-rules.js';
import {FIGHTERS,FIGHTER_IDS,isFighterId,normalizeFighter,defaultFighter} from './shared/fighters.js';
import {STAGES,RANDOM_STAGE,DEFAULT_STAGE,normalizeStageChoice} from './shared/stages.js';
import {ClockSynchronizer, SnapshotOrder} from './net-sync.js';
import {initProfileUI, profilePanelHTML} from './phase16-ui.js';
import {initSocialUI,friendPanelHTML} from './phase17-social.js';
// Offline practice vs bot: runs the real engine locally and emits server-shaped packets.
import {createPracticeSession,ensurePracticeStyles,normalizeDifficulty,BOT_DIFFICULTIES} from './practice.js';
// Tur sistemi (docs/TUR-SISTEMI.md §10): maç uzunluğu seçici, tur paketleri, seri tahmini.
import {PRACTICE_ROUND_STYLE_KEY,normalizeRoundStyle,roundStylePickDecision,roundStylePickerHTML,syncRoundStylePicker,PRACTICE_ROUNDS_KEY,DEFAULT_ROUNDS,normalizeRounds,phaseOverdueMs,PHASE_STALL_MS,roundsPickDecision,roundsPickerHTML,syncRoundsPicker,predictedSkill,roundInputLock,isRoundMatch,ensureRoundsStyles} from './rounds-ui.js';
// Sıralı çözüm (Ajan A): klasik değiş tokuş pencereleri ve tur sonu çözümü de maç görüntüsü taşır.
const ROUND_PACKETS=new Set(['ROUND_START','ROUND_LAST_CALL','ROUND_END','ROUND_SKILL_ACK','ROUND_RESOLVE','EXCHANGE_START','EXCHANGE_RESOLVE']);
// Arena modu (docs/ARENA-MODU.md §7.1): her paket kişisel anlık görüntü (`match`) taşır.
// ARENA_ATTACK ayrıca anlık görüntünün combatEvents listesinde gelir (id ile tekilleştirilir).
import {isArenaMatch,normalizeMode,modePickDecision,modePickerHTML,syncModePicker,modeSelectionKey,PRACTICE_MODE_KEY,PRACTICE_CONTENT_KEY} from './arena-ui.js';
import {normalizeContent,isContentMode,CONTENT_LABELS} from './shared/content-modes.js';
const ARENA_PACKETS=new Set(['ARENA_PREP_START','ARENA_PICK_ACK','ARENA_ROUND_START','ARENA_ROUND_END','ARENA_MATCH_END','ARENA_ATTACK']);
/** Sunucu hata kodları → oyuncu dili (kod sızdırmaz; bilinmeyen kod olduğu gibi kalır). */
export const ERROR_TEXT=Object.freeze({
  ROOM_FULL:'Oda dolu (2/2).',ROOM_NOT_FOUND:'Oda bulunamadı; kodu kontrol et.',ROOM_BUSY:'Oda meşgul; birkaç saniye sonra yeniden dene.',
  MATCH_ALREADY_STARTED:'Maç zaten başladı; yeni oda kur.',INVALID_JOIN:'Oturum geçersiz; sayfayı yenile.',
  WORD_INDEX_MISMATCH:'Sıra güncellendi; güncel durum alınıyor…',ROUND_NOT_ACTIVE:'Raund kapalı; gönderim sayılmadı.',
  ROUND_COMPLETE:'Bu raundun kelimelerini bitirdin.',ROUND_MISMATCH:'Raund değişti; güncel durum alınıyor…',WORD_BURST_LIMIT:'Çok hızlı gönderim; tekrar dene.',
  MATCH_NOT_ACTIVE:'Aktif maç yok.',HOST_ONLY:'Bu ayarı yalnız oda sahibi değiştirebilir.',MATCH_STARTED:'Maç başladı; ayar değişmez.',
  ARENA_PICK_NOT_PREP:'Seçim süresi doldu; bu raund seçimsiz oynanıyor.',ARENA_PICK_LOCKED:'Seçimin zaten kilitli.',
  INVALID_ARENA_PICK:'Geçersiz seçim.',INVALID_MATCH_CONFIG:'Geçersiz maç ayarı.',
  INVALID_ROUND_SKILL:'Geçersiz süre becerisi.',ROUND_SKILL_NOT_INTERMISSION:'Süre becerisi seçimi yalnız tur arasında yapılır.',
  ROUND_SKILL_LOCKED:'Süre becerisi seçimin kilitli.',ROUND_SKILL_EXHAUSTED:'Bu becerinin kullanım hakkı bitti.'
});
export const errorText=code=>ERROR_TEXT[code]||String(code||'Bilinmeyen hata');
/** Work package 11 — live PvP networking with 20-second rejoin recovery. */
/** Sentinel stored in `autoInvite` for `?pvp=practice` so index.js opens the PvP view
 * exactly as it does for a room invite; mount() then starts a practice match. */
const PRACTICE_URL_FLAG='__practice__';
const practiceFromUrl=href=>{try{return ['practice','arena'].includes(new URL(href).searchParams.get('pvp'));}catch{return false;}};
/** URL'den karakter: ?karakter=vargr|sira|doran|nyx|konyali (eski: ?fighter=). Geçersiz/yoksa null → kayıtlı tercih ya da varsayılan. */
export const fighterFromUrl=href=>{try{const q=new URL(href).searchParams;const v=String(q.get('karakter')??q.get('fighter')??'').trim().toLowerCase();return isFighterId(v)?v:null;}catch{return null;}};
/** Hata ayıklama/QA: ?fighter2=nyx → bot antrenmanında rakip (bot) karakteri. Geçersiz/yoksa null (bot karşı arketipten seçilir).
 * Yalnız karşı arketipten karakter bot olabilir (motor `character` arketipe bağlı; practiceFighters aynı kuralı uygular). */
export const botFighterFromUrl=href=>{try{const v=String(new URL(href).searchParams.get('fighter2')??'').trim().toLowerCase();return isFighterId(v)?v:null;}catch{return null;}};
const ROOM_CODE=/^[A-Z2-9]{16}$/;
const CHARACTERS={fire:'Alev Celladı',rune:'Rün Muhafızı'};
// Paket 32 — karakter kadrosu: seçim localStorage'da tutulur; bot maçına ve odaya (FIGHTER_SELECT) gider.
export const FIGHTER_KEY='tuslab-pvp-fighter';
const SIDE_LABEL={fire:'ATEŞ',rune:'RÜN'};
const FX_ICON={'axe-chop':'🪓',spin:'🌀','blood-storm':'🩸','projectile-spear':'🗡','dual-stab':'⚔','shadow-volley':'🌑',
  'sword-chop':'⚔','shield-bash':'🛡','wall-crash':'🏰','projectile-rune':'✴',pillar:'🔆',meteor:'☄','projectile-bread':'🥖','ney-shockwave':'🎶'};
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fighterStyle=f=>`--f-main:${f.palette.main};--f-accent:${f.palette.accent}`;
/** Bilgi kartı içeriği (silah + Q/E/R adları ve kısa açıklamaları) — yalnız pvp/shared/fighters.js'ten okunur. */
export function fighterInfoHTML(id){
  const f=FIGHTERS[isFighterId(id)?id:defaultFighter('fire')];
  const skills=['q','e','r'].map(k=>{const sk=f.skills[k];
    return `<li class="j2-skill"><span class="lb3-f-key" aria-hidden="true"><i>${FX_ICON[sk.fx]||'✦'}</i>${k.toUpperCase()}</span><span class="lb3-f-skill-copy"><b>${esc(sk.name)}</b><small>${esc(sk.desc)}</small></span></li>`;}).join('');
  return `<div class="j2-info-head"><b>${esc(f.name)}</b><span>${esc(f.title)}</span><em class="${f.archetype}">${SIDE_LABEL[f.archetype]}</em></div>`
    +`<p class="j2-weapon"><span>Silah</span><b>${esc(f.weapon||f.skills.q.short)}</b></p><ul class="j2-skills">${skills}</ul>`;
}
/** Lobi vitrini: yalnız portre ikonları (radyo grubu; ok tuşlarıyla gezilir). Silah + Q/E/R bilgi kartı `<template>`'ten tek kutuya yazılır. */
export function fighterRosterHTML(selected=defaultFighter('fire')){
  const cards=FIGHTER_IDS.map(id=>{const f=FIGHTERS[id],on=id===selected;
    return `<button type="button" role="radio" aria-checked="${on}" tabindex="${on?0:-1}" class="lb3-fighter ${f.archetype}" data-lobby-action="fighter" data-fighter="${id}" data-side="${f.archetype}" style="${fighterStyle(f)}" aria-label="${esc(`${f.name} · ${f.title} · ${f.archetype==='fire'?'Ateş':'Rün'}`)}">`
      +`<span class="lb3-f-art" data-fighter-portrait="${id}" aria-hidden="true"><span class="lb3-f-emblem">${esc(f.name[0])}</span></span>`
      +`<b class="lb3-f-name">${esc(f.name)}</b></button>`
      +`<template data-fighter-card="${id}">${fighterInfoHTML(id)}</template>`;}).join('');
  return `<div class="lb3-fighters j2-chars" role="radiogroup" aria-labelledby="lb3-hero-title" data-fighter-group="lobby">${cards}</div>`
    +`<div class="j2-info" data-fighter-info aria-live="polite"></div>`;
}
/** Oda içi kısa seçim: 4 karakter, ad + arketip (radyo grubu). */
function roomFighterChoicesHTML(selected=defaultFighter('fire')){
  return `<div class="pvp6-choices lb3-room-fighters" role="radiogroup" aria-labelledby="lb3-room-fighter-label" data-fighter-group="room">${FIGHTER_IDS.map(id=>{const f=FIGHTERS[id],on=id===selected;
    return `<button type="button" role="radio" aria-checked="${on}" tabindex="${on?0:-1}" class="lb3-room-fighter ${f.archetype}" data-lobby-action="fighter" data-fighter="${id}" data-character="${f.archetype}" style="${fighterStyle(f)}"><span class="lb3-f-emblem" aria-hidden="true">${esc(f.name[0])}</span><span class="lb3-room-fighter-copy"><b>${esc(f.name)}</b><small>${esc(f.title)} · ${SIDE_LABEL[f.archetype]}</small></span></button>`;}).join('')}</div>`;
}
const joinedFighter=(joined,me,local)=>joined&&me?normalizeFighter(me.fighter,me.character):local;
const readFighterPref=()=>{const v=safeStore(localStorage,FIGHTER_KEY);return isFighterId(v)?v:null;};
const RUNE_NAMES={none:'Klasik',ember:'Alev Mührü',crystal:'Kristal Kalkan',rhythm:'Savaş Ritimcisi',laststand:'Son Direniş',reflex:'Keskin Refleks',lightning:'Yıldırım Kesişi'};
const clock=()=>new Date().toLocaleTimeString('tr-TR');
const safeStore=(storage,key,value)=>{try{if(value===undefined)return storage.getItem(key);storage.setItem(key,value);}catch{return null;}};
// Paket 30: yazma kuralları (büyük/küçük harf, noktalama) — bot maçında tercih, odada oda sahibinin ayarı.
const TYPING_KEY='tuslab-pvp-typing';
function readTypingPref(){try{return normalizeTyping(JSON.parse(safeStore(localStorage,TYPING_KEY)||'{}'));}catch{return normalizeTyping();}}
/** Bot zorluğu: segment düğmeler (MAÇ AYARLARI). */
export function difficultyPickerHTML(selected='orta'){
  return `<div class="rui-picker" data-difficulty-picker><span class="rui-picker-label" id="j2-diff-label">Bot zorluğu</span><div class="rui-seg" role="group" aria-labelledby="j2-diff-label">`
    +Object.values(BOT_DIFFICULTIES).map(d=>`<button type="button" data-lobby-action="difficulty" data-difficulty="${d.id}" aria-pressed="${d.id===selected}" title="${d.label} bot · ~${d.wpm} WPM"><b>${d.label}</b> <small>~${d.wpm} WPM</small></button>`).join('')
    +`</div></div>`;
}
/** (Arayüzden kaldırıldı — "Maç kuralları" paneli yok; yazma kuralları kayıtlı tercih/varsayılanla işler.) */
export function typingPickerHTML(scope){
  return `<fieldset class="lb3-typing" data-typing-box="${scope}"><legend>Maç kuralları</legend>`
   +`<label class="lb3-switch"><input type="checkbox" role="switch" data-typing-key="caseSensitive" data-typing-scope="${scope}" checked><span><b>Büyük/küçük harf duyarlı</b><small>Açıkken “Güçlü” ile “güçlü” farklı sayılır</small></span></label>`
   +`<label class="lb3-switch"><input type="checkbox" role="switch" data-typing-key="punctuation" data-typing-scope="${scope}" checked><span><b>Noktalama yazılsın ( . , )</b><small>Kapalıyken nokta, virgül vb. atlanabilir</small></span></label>`
   +`<label class="lb3-switch"><input type="checkbox" role="switch" data-assist-scope="${scope}" checked><span><b>Partner desteği</b><small data-assist-info="${scope}">Partner: Rün Muhafızı · bar dolunca destek saldırısı yapar</small></span></label>`
   +`<small class="lb3-typing-note" data-typing-note="${scope}"></small></fieldset>`;
}
// Paket 33: özgün TuşLab sahne kartları; radyo grubu, ok tuşlarıyla gezilir.
// Bot maçında tercih (localStorage), odada oda sahibinin ayarı (MATCH_CONFIG {stage}); 'random' maç başında çözülür.
const STAGE_KEY='tuslab-pvp-stage';
const STAGE_CHOICES=[...STAGES.map(s=>({id:s.id,name:s.name,blurb:s.blurb,palette:s.palette})),
  {id:RANDOM_STAGE,name:'Rastgele',blurb:'Her maç başında dört sahneden biri seçilir.',palette:null}];
const stageStyle=p=>p?`--st-sky:${p.sky};--st-fog:${p.fog};--st-floor:${p.floor};--st-accent:${p.accent};--st-rim:${p.rim}`:'';
export function stagePickerHTML(scope,selected=DEFAULT_STAGE){
  const cards=STAGE_CHOICES.map(st=>{const on=st.id===selected;
    return `<button type="button" class="lb3-stage-card" role="radio" tabindex="${on?0:-1}" aria-checked="${on}" data-stage-pick="${st.id}" data-stage-scope="${scope}" style="${stageStyle(st.palette)}" aria-label="${esc(`${st.name} · ${st.blurb}`)}">`
      +`<span class="lb3-stage-art" data-stage-art="${st.id}" aria-hidden="true">${st.id===RANDOM_STAGE?'<i>?</i>':''}</span><b class="lb3-stage-name">${esc(st.name)}</b><small class="lb3-stage-description">${esc(st.blurb)}</small></button>`;}).join('');
  return `<fieldset class="lb3-stage" data-stage-box="${scope}"><legend>Arena seç</legend>`
   +`<div class="lb3-stage-strip" role="radiogroup" aria-label="Sahne seçimi" data-stage-group="${scope}">${cards}</div>`
   +`<small class="lb3-stage-blurb" data-stage-blurb="${scope}" aria-live="polite"></small></fieldset>`;
}
function syncStagePicker(panel,scope,{value,editable,note}){
  const v=normalizeStageChoice(value);
  const cards=[...panel.querySelectorAll(`[data-stage-scope="${scope}"]`)],sel=cards.findIndex(b=>b.dataset.stagePick===v);
  cards.forEach((b,i)=>{const on=i===sel;
    b.setAttribute('aria-checked',String(on));b.tabIndex=on?0:-1;b.disabled=!editable;
    // Karusel (CSS 3B): seçiliye göre ofset; seçili öndeki büyük kart.
    b.style?.setProperty?.('--o',String(i-sel));b.style?.setProperty?.('--a',String(Math.abs(i-sel)));});
  const st=STAGE_CHOICES.find(x=>x.id===v);const text=`${st.name} — ${st.blurb}${note?` ${note}`:''}`;
  const n=panel.querySelector(`[data-stage-blurb="${scope}"]`);if(n&&n.textContent!==text)n.textContent=text;
}
// Paket 31: partner desteği anahtarı (bot maçında tercih, odada oda sahibinin ayarı). Arena modunda destek yoktur.
const ASSIST_KEY='tuslab-pvp-assist';
function syncAssistPicker(panel,scope,{value,editable,character,arena}){
  const input=panel.querySelector(`[data-assist-scope="${scope}"]`);
  if(input){input.checked=!arena&&normalizeAssist(value);input.disabled=!editable||arena;}
  const info=panel.querySelector(`[data-assist-info="${scope}"]`);
  const text=arena?'Arena modunda partner desteği yok':`Partner: ${partnerName(character)} · bar dolunca destek saldırısı yapar`;
  if(info&&info.textContent!==text)info.textContent=text;
}
function syncTypingPicker(panel,scope,{value,editable,note}){
  const t=normalizeTyping(value);
  panel.querySelectorAll(`[data-typing-scope="${scope}"]`).forEach(input=>{input.checked=t[input.dataset.typingKey];input.disabled=!editable;});
  const n=panel.querySelector(`[data-typing-note="${scope}"]`);if(n&&n.textContent!==note)n.textContent=note;
}
export const invitedRoom=(href)=>{
  try{const u=new URL(href);const code=(u.searchParams.get('pvpRoom')||'').toUpperCase();return ROOM_CODE.test(code)?code:null;}catch{return null;}
};
export const inviteLink=(href,code)=>{
  const u=new URL(href);u.pathname='/';u.hash='';u.search='';u.searchParams.set('pvpRoom',code);return u.toString();
};
export const guestToken=()=>{
  let token=safeStore(localStorage,'tuslab-pvp-guest-id');
  if(!/^[a-f0-9]{64}$/.test(token||'')){
    token=Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');
    safeStore(localStorage,'tuslab-pvp-guest-id',token);
  }
  return token;
};
export class PvPNetworkConsole {
  constructor(root){
    this.root=root;this.ws=null;this.code='';this.myId=null;this.seat=null;
    this.name=safeStore(localStorage,'tuslab-pvp-name')||'Savaşçı';
    this.fighter=fighterFromUrl(location.href)||readFighterPref()||defaultFighter('fire');
    this.character=FIGHTERS[this.fighter].archetype;this.rune='none';this.status='Bağlı değil';this.players=[];this.phase='waiting';
    this.ready=false;this.startAt=null;this.hostPlayerId=null;this.open=true;this.connecting=false;this.rematchVotes=[];this.history=[];
    this.entries=[];this.autoInvite=invitedRoom(location.href)||(practiceFromUrl(location.href)?PRACTICE_URL_FLAG:null);this.ticker=null;
    this.renderPending=false;   // U2: aynı karede gelen paketler tek render'da birleşir (scheduleRender).
    // Practice session (null when playing online). While set, send() is routed to it.
    this.practice=null;this.practiceDifficulty=normalizeDifficulty(safeStore(localStorage,'tuslab-pvp-practice-difficulty'));
    this.practiceRounds=normalizeRounds(safeStore(localStorage,PRACTICE_ROUNDS_KEY));this.roomRounds=DEFAULT_ROUNDS;
    this.practiceRoundStyle=normalizeRoundStyle(safeStore(localStorage,PRACTICE_ROUND_STYLE_KEY)); // KESINYAP 11: kelime sayısı tercihi kalktı (eski kayıt yok sayılır)
    this.roomRoundStyle=normalizeRoundStyle();
    this.practiceMode=normalizeMode(safeStore(localStorage,PRACTICE_MODE_KEY));this.roomMode='rounds';
    this.practiceContent=this.practiceMode==='rounds'?normalizeContent(safeStore(localStorage,PRACTICE_CONTENT_KEY)):'kelime';this.roomContent='kelime';
    this.practiceTyping=readTypingPref();this.roomTyping=normalizeTyping();
    this.practiceAssist=safeStore(localStorage,ASSIST_KEY)!=='off';this.roomAssist=true;
    this.practiceStage=normalizeStageChoice(safeStore(localStorage,STAGE_KEY)||DEFAULT_STAGE);this.roomStage=DEFAULT_STAGE;
    this.match=null;this.lastSeq=0;this.lastCombatId=0;this.serverOffset=0;
    this.clockSync=new ClockSynchronizer();this.snapshots=new SnapshotOrder();
    this.pingTimer=null;this.lastStateRequestAt=0;this.prediction=null;
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&this.root&&!this.root.hidden){this.renderConnection();this.updateArena();this.renderCountdown();}});
    this.reconnecting=false;this.reconnectStartedAt=0;this.reconnectAttempt=0;this.reconnectTimer=null;
    this.profiles=initProfileUI(root,()=>guestToken());
    this.social=initSocialUI(root,()=>guestToken(),()=>this);
    root.addEventListener('change',e=>{
      const input=e.target.closest?.('[data-assist-scope]');if(!input)return;
      if(input.dataset.assistScope==='room'){
        if(!(this.myId&&!this.practice&&this.hostPlayerId===this.myId&&['waiting','countdown'].includes(this.phase))){this.render();return;}
        this.send('MATCH_CONFIG',{assist:input.checked});this.roomAssist=input.checked;
        this.log(`Partner desteği ${input.checked?'açıldı':'kapatıldı'}. Hazır durumları sıfırlandı.`);
      }else{this.practiceAssist=input.checked;safeStore(localStorage,ASSIST_KEY,input.checked?'on':'off');}
      this.render();
    });
    root.addEventListener('change',e=>{
      const input=e.target.closest?.('[data-typing-key]');if(!input)return;
      const key=input.dataset.typingKey;if(key!=='caseSensitive'&&key!=='punctuation')return;
      const label=key==='caseSensitive'?'Büyük/küçük harf duyarlılığı':'Noktalama';
      if(input.dataset.typingScope==='room'){
        if(!(this.myId&&!this.practice&&this.hostPlayerId===this.myId&&['waiting','countdown'].includes(this.phase))){this.render();return;}
        this.send('MATCH_CONFIG',{typing:{[key]:input.checked}});this.roomTyping={...this.roomTyping,[key]:input.checked};
        this.log(`${label} ${input.checked?'açıldı':'kapatıldı'}. Hazır durumları sıfırlandı.`);
      }else{
        this.practiceTyping={...this.practiceTyping,[key]:input.checked};safeStore(localStorage,TYPING_KEY,JSON.stringify(this.practiceTyping));
      }
      this.render();
    });
    root.addEventListener('click',e=>{
      const b=e.target.closest('[data-lobby-action]');if(!b)return;
      const action=b.dataset.lobbyAction;
      if(action==='toggle'){this.open=!this.open;this.render();return;}
      if(action==='create')void this.create();
      if(action==='join')void this.join(this.panel()?.querySelector('[data-lobby-join-code]')?.value||'');
      if(action==='copy')void this.copyInvite();
      if(action==='ready')this.send('READY_SET',{ready:!this.ready});
      if(action==='leave')this.disconnect(true);
      if(action==='practice'){
        const panel=this.panel();
        this.startPractice({character:panel?.querySelector('[data-practice-character]')?.value});
      }
      if(action==='difficulty'){this.practiceDifficulty=normalizeDifficulty(b.dataset.difficulty);safeStore(localStorage,'tuslab-pvp-practice-difficulty',this.practiceDifficulty);this.render();}
      if(action==='practice-stop')this.disconnect(true);
      if(action==='rounds'){
        const scope=b.dataset.roundsScope==='practice'?'practice':'room';
        const decision=roundsPickDecision({scope,value:b.dataset.rounds,isHost:Boolean(this.myId)&&!this.practice&&this.hostPlayerId===this.myId,phase:this.phase,current:this.roomRounds});
        if(decision?.store){this.practiceRounds=decision.store;safeStore(localStorage,PRACTICE_ROUNDS_KEY,String(decision.store));}
        else if(decision?.type==='MATCH_CONFIG'){this.send('MATCH_CONFIG',decision.payload);this.roomRounds=decision.payload.rounds;this.log(`Maç uzunluğu: ${decision.payload.rounds} tur. Hazır durumları sıfırlandı.`);}
        this.render();
      }
      if(action==='roundstyle'){
        const scope=b.dataset.styleScope==='practice'?'practice':'room';
        const decision=roundStylePickDecision({scope,kind:'style',value:b.dataset.roundStyle,isHost:Boolean(this.myId)&&!this.practice&&this.hostPlayerId===this.myId,phase:this.phase,current:this.roomRoundStyle});
        if(decision&&'store' in decision){
          this.practiceRoundStyle=decision.store;safeStore(localStorage,PRACTICE_ROUND_STYLE_KEY,String(decision.store));
        }else if(decision?.type==='MATCH_CONFIG'){
          this.send('MATCH_CONFIG',decision.payload);
          this.roomRoundStyle=decision.payload.roundStyle;
          this.log('Raund biçimi değişti. Hazır durumları sıfırlandı.');
        }
        this.render();
      }
      if(action==='mode'){
        const scope=b.dataset.modeScope==='practice'?'practice':'room';
        const decision=modePickDecision({scope,value:b.dataset.mode,isHost:Boolean(this.myId)&&!this.practice&&this.hostPlayerId===this.myId,phase:this.phase,current:modeSelectionKey(this.roomMode,this.roomContent),rounds:this.roomRounds});
        if(decision?.store){this.practiceMode=decision.store;this.practiceContent=normalizeContent(decision.content);safeStore(localStorage,PRACTICE_MODE_KEY,decision.store);safeStore(localStorage,PRACTICE_CONTENT_KEY,this.practiceContent);}
        else if(decision?.type==='MATCH_CONFIG'){this.send('MATCH_CONFIG',decision.payload);this.roomMode=decision.payload.mode;this.roomContent=normalizeContent(decision.payload.content);this.log(`Oyun modu: ${b.querySelector('b')?.textContent||decision.payload.mode}. Hazır durumları sıfırlandı.`);}
        this.render();
      }
      if(action==='kick'){const id=b.dataset.target;if(id&&window.confirm('Rakibi lobiden çıkarmak istiyor musun?'))this.send('HOST_KICK',{playerId:id});}
      if(action==='close-room'&&window.confirm('PvP odasını kapatmak istiyor musun?'))this.send('HOST_CLOSE',{});
      if(action==='rune'){this.rune=b.dataset.rune;this.send('RUNE_SELECT',{rune:this.rune});this.render();}
      // Lobi vitrini: oda dışındayken savaşçı seçimi (bot maçı ve JOIN aynı this.character'ı kullanır).
      if(action==='hero'&&['fire','rune'].includes(b.dataset.hero)&&(!this.myId||this.practice)){this.character=b.dataset.hero;this.render();}
      if(action==='fighter')this.selectFighter(b.dataset.fighter);
      if(action==='char'){
        const kind=b.dataset.character;
        this.character=kind;
        if(this.ws?.readyState===1&&this.myId)this.send('CHARACTER_SELECT',{character:kind});
        this.render();
      }
    });
    root.addEventListener('click',e=>{const b=e.target.closest?.('[data-stage-pick]');if(b&&!b.disabled)this.selectStage(b.dataset.stageScope,b.dataset.stagePick);});
    // Not: PvP açıkken index.js belge düzeyinde yakalama aşamasında keydown'ı durdurur (stopImmediatePropagation) → ok tuşları
    // bu kökteki dinleyiciye hiç ulaşmaz; bu yüzden index.js merkezi yönlendiricisi `lobbyKey`'i çağırır.
    root.addEventListener('keydown',e=>{this.lobbyKey(e);});
    // Karakter bilgi kartı: üzerine gelince/odaklanınca o karakter; ayrılınca seçili karakter (dokunmatikte dokunma = seçim → kart seçiliyi gösterir).
    const infoTarget=e=>e.target.closest?.('[data-fighter-group="lobby"] [data-fighter]');
    root.addEventListener('pointerover',e=>{const b=infoTarget(e);if(b&&e.pointerType!=='touch')this.showFighterInfo(b.dataset.fighter);});
    root.addEventListener('pointerout',e=>{if(infoTarget(e)&&!infoTarget({target:e.relatedTarget||{}}))this.showFighterInfo();});
    root.addEventListener('focusin',e=>{const b=infoTarget(e);if(b)this.showFighterInfo(b.dataset.fighter);});
    root.addEventListener('focusout',e=>{if(infoTarget(e))this.showFighterInfo();});
    // Arena kaydırmalı karusel: yatay kaydırma (dokunmatik/fare) komşu sahneyi seçer.
    let swipe=null;
    root.addEventListener('pointerdown',e=>{const g=e.target.closest?.('[data-stage-group="practice"]');swipe=g?{x:e.clientX,y:e.clientY,id:e.pointerId}:null;});
    root.addEventListener('pointerup',e=>{if(!swipe||swipe.id!==e.pointerId)return;const dx=e.clientX-swipe.x,dy=e.clientY-swipe.y;swipe=null;
      if(Math.abs(dx)>=40&&Math.abs(dx)>Math.abs(dy)*1.5)this.stepStage('practice',dx<0?1:-1);});
    root.addEventListener('input',e=>{
      if(e.target.matches('[data-lobby-name]')){
        this.name=e.target.value.slice(0,20);safeStore(localStorage,'tuslab-pvp-name',this.name);
      }
      // Remember practice choices so a re-render does not reset the selects.
      if(e.target.matches('[data-practice-character]')&&['fire','rune'].includes(e.target.value)&&(!this.myId||this.practice)){this.character=e.target.value;this.render();}
    });
  }
  panel(){return this.root.querySelector('[data-lobby-panel]');}
  mount(){
    ensurePracticeStyles();ensureRoundsStyles();
    this.open=true;this.render();
    if(this.autoInvite){const code=this.autoInvite;this.autoInvite=null;
      if(code===PRACTICE_URL_FLAG){const q=new URL(location.href).searchParams;
        if(q.has('mode')||q.get('pvp')==='arena')this.practiceMode=normalizeMode(q.get('mode')||'arena');
        // İçerik modu: ?icerik=atasozu|siir|osmanlica (ya da ?mode=atasozu…) → raund modu + içerik. Aksi hâlde kelime bankası.
        const urlContent=isContentMode(q.get('icerik'))?q.get('icerik'):isContentMode(q.get('mode'))?q.get('mode'):null;
        if(urlContent){this.practiceMode='rounds';this.practiceContent=urlContent;}
        else if(q.has('mode')||q.get('pvp')==='arena')this.practiceContent='kelime';
        this.startPractice({difficulty:q.get('bot'),character:q.get('char'),fighter:fighterFromUrl(location.href),botFighter:botFighterFromUrl(location.href),stage:q.get('stage')});}
      else void this.join(code);}
  }
  /** Start an offline match against the bot. Its packets go through receive(),
   * the same path as WebSocket messages, so all HUD/FX/result listeners work. */
  /** Paket 32: karakter seçimi (lobi vitrini + oda). Oda içinde yalnız bekleme aşamasında sunucuya gider. */
  selectFighter(id){
    if(!isFighterId(id))return;
    const joined=Boolean(this.myId)&&!this.practice;
    if(joined&&this.phase!=='waiting')return;
    this.fighter=id;this.character=FIGHTERS[id].archetype;safeStore(localStorage,FIGHTER_KEY,id);
    if(joined&&this.ws?.readyState===1)this.send('FIGHTER_SELECT',{fighter:id});
    this.render();
  }
  /** Lobi ok tuşları (karakter ikonları · arena karuseli · mod şeridi). İşlediyse true döner. */
  lobbyKey(e){
    if(e.defaultPrevented)return true;
    this.fighterKey(e);if(e.defaultPrevented)return true;
    this.stageKey(e);if(e.defaultPrevented)return true;
    this.modeKey(e);return Boolean(e.defaultPrevented);
  }
  /** Radyo grubu: ok tuşları seçimi ve odağı birlikte taşır (Home/End uçlara gider). */
  fighterKey(e){
    const group=e.target.closest?.('[data-fighter-group]');if(!group||!e.target.matches('[data-fighter]'))return;
    const keys={ArrowRight:1,ArrowDown:1,ArrowLeft:-1,ArrowUp:-1,Home:'first',End:'last'};
    if(!(e.key in keys))return;
    e.preventDefault();
    const items=[...group.querySelectorAll('[data-fighter]')].filter(x=>!x.disabled);if(!items.length)return;
    const i=items.indexOf(e.target),k=keys[e.key];
    const next=k==='first'?items[0]:k==='last'?items.at(-1):items[(i+k+items.length)%items.length];
    this.selectFighter(next.dataset.fighter);
    group.querySelector(`[data-fighter="${next.dataset.fighter}"]`)?.focus();
  }
  /** Paket 33: sahne seçimi. Bot maçında yerel tercih; odada yalnız oda sahibi, maç başlamadan. */
  selectStage(scope,id){
    const v=normalizeStageChoice(id);if(v!==id)return;
    if(scope==='practice'){this.practiceStage=v;safeStore(localStorage,STAGE_KEY,v);this.render();return;}
    const host=Boolean(this.myId)&&!this.practice&&this.hostPlayerId===this.myId;
    if(!host||!['waiting','countdown'].includes(this.phase)||v===this.roomStage){this.render();return;}
    this.send('MATCH_CONFIG',{stage:v});this.roomStage=v;
    this.log(`Sahne: ${STAGE_CHOICES.find(x=>x.id===v).name}. Hazır durumları sıfırlandı.`);this.render();
  }
  stageKey(e){
    const group=e.target.closest?.('[data-stage-group]');if(!group||!e.target.matches?.('[data-stage-pick]'))return;
    const keys={ArrowRight:1,ArrowDown:1,ArrowLeft:-1,ArrowUp:-1,Home:'first',End:'last'};
    if(!(e.key in keys))return;
    e.preventDefault();
    const items=[...group.querySelectorAll('[data-stage-pick]')].filter(x=>!x.disabled);if(!items.length)return;
    const i=items.indexOf(e.target),k=keys[e.key];
    const next=k==='first'?items[0]:k==='last'?items.at(-1):items[(i+k+items.length)%items.length];
    this.selectStage(group.dataset.stageGroup,next.dataset.stagePick);
    group.querySelector(`[data-stage-pick="${next.dataset.stagePick}"]`)?.focus();
  }
  /** Arena karuselinde komşu sahneye geç (kaydırma); uçlarda durur. */
  stepStage(scope,dir){
    const ids=STAGE_CHOICES.map(s=>s.id),cur=ids.indexOf(normalizeStageChoice(scope==='practice'?this.practiceStage:this.roomStage));
    const next=ids[Math.max(0,Math.min(ids.length-1,cur+dir))];
    if(next&&next!==ids[cur])this.selectStage(scope,next);
  }
  /** Mod şeridi: ← → odağı komşu moda taşır; bot antrenmanında seçimi de değiştirir (şerit kaydırılır). Home/End uçlara gider. */
  modeKey(e){
    const strip=e.target.closest?.('[data-mode-picker]');if(!strip||!e.target.matches?.('[data-mode]'))return;
    const keys={ArrowRight:1,ArrowLeft:-1,Home:'first',End:'last'};if(!(e.key in keys))return;
    e.preventDefault();
    const items=[...strip.querySelectorAll('[data-mode]')].filter(x=>!x.disabled);if(!items.length)return;
    const i=items.indexOf(e.target),k=keys[e.key];
    const next=k==='first'?items[0]:k==='last'?items.at(-1):items[Math.max(0,Math.min(items.length-1,i+k))];
    next.focus();next.scrollIntoView?.({inline:'center',block:'nearest'});
    if(strip.dataset.modePicker==='practice'&&next!==e.target)next.click();
  }
  /** Bilgi kartı: id verilmezse seçili karakter. Yalnız pvp/shared/fighters.js'ten üretilmiş <template> içeriğini taşır. */
  showFighterInfo(id){
    const panel=this.panel(),card=panel?.querySelector('[data-fighter-info]');if(!card)return;
    const want=isFighterId(id)?id:this.fighter;
    if(card.dataset.shown===want)return;
    const tpl=panel.querySelector(`template[data-fighter-card="${want}"]`);if(!tpl)return;
    card.replaceChildren(tpl.content.cloneNode(true));card.dataset.shown=want;
    card.style.setProperty('--f-main',FIGHTERS[want].palette.main);card.style.setProperty('--f-accent',FIGHTERS[want].palette.accent);
  }
  startPractice({difficulty,character,fighter,botFighter,stage}={}){
    this.disconnect(false);                       // closes any socket, resets lobby state
    this.practiceDifficulty=normalizeDifficulty(difficulty||this.practiceDifficulty);
    safeStore(localStorage,'tuslab-pvp-practice-difficulty',this.practiceDifficulty);
    if(isFighterId(fighter)){this.fighter=fighter;this.character=FIGHTERS[fighter].archetype;}
    else if((character==='fire'||character==='rune')&&character!==this.character){this.character=character;this.fighter=normalizeFighter(this.fighter,character);}
    const session=createPracticeSession({
      difficulty:this.practiceDifficulty,character:this.character,fighter:this.fighter,botFighter:isFighterId(botFighter)?botFighter:(botFighterFromUrl(typeof location!=='undefined'?location.href:'')||undefined),rune:this.rune,name:this.readName()||'Savaşçı',rounds:this.practiceRounds,roundStyle:this.practiceRoundStyle,mode:this.practiceMode,content:this.practiceMode==='rounds'?this.practiceContent:'kelime',typing:this.practiceTyping,assist:this.practiceAssist,stage:normalizeStageChoice(stage||this.practiceStage),
      // Deliver asynchronously (like a socket) and drop packets from a disposed session.
      onPacket:packet=>queueMicrotask(()=>{if(this.practice===session)this.receive(packet);})
    });
    this.practice=session;this.code='';this.open=false; // bot maçı başlarken lobi paneli kapanır (maç ekranının arkasında açık kalmasın)
    this.myId=session.humanId;this.seat=session.humanSeat;
    this.status=`Antrenman · ${this.practiceMode==='arena'?'Arena':this.practiceMode==='classic'?'Klasik':isContentMode(this.practiceContent)?CONTENT_LABELS[this.practiceContent]:'Zamana Karşı'} · Bot (${BOT_DIFFICULTIES[this.practiceDifficulty].label}) · çevrimdışı`;
    this.log('Bota karşı antrenman başladı. Sunucu yok; profil ve puan etkilenmez.');
    session.start();
  }
  /** Dispose the practice session and all of its timers (idempotent). */
  stopPractice(){if(this.practice){this.practice.dispose();this.practice=null;}}
  reset(){this.disconnect(true);this.open=true;this.stopTicker();this.match=null;this.lastSeq=0;this.lastCombatId=0;this.snapshots.reset();this.clearPrediction();this.rematchVotes=[];this.history=[];this.updateArena();}
  log(message){this.entries.unshift(`${clock()} · ${message}`);this.entries.length=Math.min(this.entries.length,5);this.scheduleRender();}
  readName(){const input=this.panel()?.querySelector('[data-lobby-name]');const name=(input?.value||this.name).trim().replace(/\s+/g,' ');this.name=name.slice(0,20);safeStore(localStorage,'tuslab-pvp-name',this.name);return this.name;}
  resetLobby(){this.myId=null;this.seat=null;this.ready=false;this.players=[];this.hostPlayerId=null;this.startAt=null;this.phase='waiting';this.stopTicker();this.match=null;this.lastSeq=0;this.lastCombatId=0;this.snapshots.reset();this.clearPrediction();this.updateArena();}
  stopTicker(){if(this.ticker!==null){clearInterval(this.ticker);this.ticker=null;}}
  serverNow(){return this.clockSync.stats().ready?this.clockSync.serverNow():Date.now()+this.serverOffset;}
  startProbes(){
    this.stopProbes();this.clockSync.reset();this.probe();
    this.pingTimer=setInterval(()=>{if(!document.hidden)this.probe();},6000);
  }
  stopProbes(){if(this.pingTimer!==null){clearInterval(this.pingTimer);this.pingTimer=null;}this.clockSync.pending.clear();}
  probe(){
    if(this.ws?.readyState!==1||!this.myId)return;
    const nonce=crypto.randomUUID();
    this.send('PING',this.clockSync.request(nonce,Date.now()));
  }
  requestSnapshot(){
    if(this.practice){this.send('STATE_REQUEST',{});return;}
    if(this.ws?.readyState!==1||!this.myId)return;
    const now=Date.now();if(now-this.lastStateRequestAt<750)return;
    this.lastStateRequestAt=now;this.send('STATE_REQUEST',{});
  }
  clearPrediction(){
    this.prediction=null;
    this.root?.querySelectorAll('[data-pvp12-windup]').forEach(e=>{e.hidden=true;e.textContent='';});
  }
  predictWord(mine,word){
    if(!wordsMatch(word,mine.currentWord,this.match?.typing))return;
    const skill=predictedSkill(mine,this.match);   // tur modunda STREAK_SKILLS[seri+1], klasikte Q2/E4/R5
    this.prediction={wordIndex:mine.wordIndex,matchId:this.match.matchId,skill};
    const info=this.root.querySelector('[data-pvp12-windup]');
    if(info){info.hidden=false;info.textContent=skill?`${skill} hazırlanıyor · sunucu onayı bekleniyor`:'Doğru kelime · sunucu onayı bekleniyor';}
  }
  stopReconnect(){
    if(this.reconnectTimer!==null){clearTimeout(this.reconnectTimer);this.reconnectTimer=null;}
    this.reconnecting=false;this.reconnectStartedAt=0;this.reconnectAttempt=0;
  }
  scheduleReconnect(){
    if(!this.code||!this.reconnecting)return;
    const remaining=19_200-(Date.now()-this.reconnectStartedAt);
    if(remaining<=0){this.stopReconnect();this.status='Bağlantı süresi doldu · lobiyi açıp yeniden oda kur veya katıl';this.render();return;}
    const base=Math.min(250*2**Math.min(this.reconnectAttempt,4),2500);
    const delay=Math.min(remaining,base+Math.round(Math.random()*180));
    this.reconnectAttempt++;
    if(this.reconnectTimer!==null)clearTimeout(this.reconnectTimer);
    this.reconnectTimer=setTimeout(()=>{
      this.reconnectTimer=null;
      if(this.reconnecting&&!this.ws)this.connect(this.code,true);
    },delay);
    this.status=`Yeniden bağlanılıyor · ${Math.ceil(remaining/1000)} sn kaldı`;
    this.render();
  }

  send(type,payload={}){
    // Practice mode: WORD_SUBMIT / SURRENDER / REMATCH_VOTE / LEAVE go to the local engine.
    if(this.practice){this.practice.send(type,payload);return;}
    if(this.ws?.readyState===1)this.ws.send(JSON.stringify({version:1,type,payload}));
  }
  submitWord(word){
    const mine=this.match?.players?.find(p=>p.playerId===this.myId);
    if(!mine||this.match?.status!=='running'||!word.trim())return false;
    if(isArenaMatch(this.match)){
      // Arena: kelime sırası raund içindedir (roundWordIndex) ve raund numarası zorunludur.
      const me=this.match.me||mine;
      if(this.match.round.phase!=='round'||me.roundDone)return false;
      this.send('WORD_SUBMIT',{matchId:this.match.matchId,wordIndex:Number(me.roundWordIndex)||0,text:word.trim(),round:Number(this.match.round.index)});
      return true;
    }
    if(roundInputLock(this.match,this.myId,this.serverNow()).locked)return false;
    this.predictWord(mine,word.trim());
    const round=isRoundMatch(this.match)?Number(this.match.round.index)||undefined:undefined;
    this.send('WORD_SUBMIT',{matchId:this.match.matchId,wordIndex:mine.wordIndex,text:word.trim(),...(round?{round}:{})});
    return true;
  }
  /** Arena hazırlık seçimi (skill/eşya ya da null). Antrenmanda yerel motora, online'da sunucuya gider. */
  sendArenaPick(skill=null,item=null){
    if(!isArenaMatch(this.match)||this.match.status!=='running')return false;
    this.send('ARENA_PICK',{skill:skill??null,item:item??null});return true;
  }
  disconnect(explicit){
    this.stopProbes();this.clockSync.reset();this.stopReconnect();this.clearPrediction();
    if(explicit)this.send('LEAVE',{});
    this.stopPractice();                          // leaving / switching to online ends practice
    const sock=this.ws;this.ws=null;
    if(sock?.readyState<2)try{sock.close(1000,'Leaving lobby');}catch{}
    this.resetLobby();this.connecting=false;
    this.status='Bağlı değil';
    if(explicit){this.code='';this.open=true;try{const u=new URL(location.href);u.searchParams.delete('pvpRoom');history.replaceState(null,'',u);}catch{}}
    this.render();
  }
  async create(){
    if(this.readName().length<2)return this.log('İsim en az 2 karakter olmalı.');
    this.disconnect(false);this.connecting=true;this.status='Oda oluşturuluyor';this.render();
    try{
      const res=await fetch('/api/pvp/rooms',{method:'POST',headers:{'content-type':'application/json'},body:'{}',cache:'no-store'});
      const data=await res.json();
      if(!res.ok||!ROOM_CODE.test(data.roomCode||''))throw new Error(data.error||'ODA_OLUSTURULAMADI');
      this.code=data.roomCode;this.log('Oda oluşturuldu: '+this.code);
      this.connect(this.code);
    }catch(error){this.status='Oda oluşturulamadı · bota karşı başlatabilir veya yeniden deneyebilirsin';this.log('Oda kurma hatası: '+error.message);}
    finally{this.connecting=false;this.render();}
  }
  async join(code){
    const normalized=String(code).trim().toUpperCase();
    if(!ROOM_CODE.test(normalized))return this.log('Oda kodu 16 karakter olmalı.');
    if(this.readName().length<2)return this.log('İsim en az 2 karakter olmalı.');
    this.disconnect(false);this.code=normalized;this.open=true;this.connect(normalized);
  }
  ticket(code){
    const key=`tuslab-pvp-rejoin:${code}`;
    let ticket=safeStore(sessionStorage,key);
    if(!ticket||!/^[a-f0-9-]{36,80}$/.test(ticket)){
      ticket=crypto.randomUUID()+'-'+crypto.randomUUID();safeStore(sessionStorage,key,ticket);
    }
    return ticket;
  }
  connect(code,recover=false){
    this.code=code;this.status=recover?'Odaya yeniden bağlanılıyor':'Odaya bağlanılıyor';this.render();
    const scheme=location.protocol==='https:'?'wss:':'ws:';
    const endpoint=`${scheme}//${location.host}/api/pvp/rooms/${code}/ws`;
    let sock;try{sock=new WebSocket(endpoint);}catch(e){this.status='Bağlantı hatası';this.log(e.message);if(recover)this.scheduleReconnect();return;}
    this.ws=sock;
    sock.addEventListener('open',()=>{
      if(this.ws!==sock)return;
      this.status=recover?'Oturum geri yükleniyor':'Kimlik doğrulanıyor';
      this.send('JOIN',{name:this.name,character:this.character,fighter:this.fighter,resumeToken:this.ticket(code),guestToken:guestToken()});
      this.render();
    });
    sock.addEventListener('message',event=>{
      if(this.ws!==sock)return;
      let packet;try{packet=JSON.parse(event.data);}catch{return this.log('Geçersiz sunucu mesajı');}
      if(packet.version!==1)return;
      this.receive(packet);
    });
    sock.addEventListener('error',()=>{if(this.ws===sock)this.status='Sunucuya erişilemiyor';});
    sock.addEventListener('close',event=>{
      if(this.ws!==sock)return;
      this.ws=null;this.stopProbes();this.clearPrediction();
      // A seat taken over elsewhere or an invalid JOIN must not auto-reclaim itself.
      if([1000,1008,1009,4001].includes(event.code)){
        this.stopReconnect();this.status=event.code===4001?'Oturum başka sekmede açıldı':`Bağlantı kapandı (${event.code})`;
        this.render();return;
      }
      if(!this.reconnecting){this.reconnecting=true;this.reconnectStartedAt=Date.now();this.reconnectAttempt=0;
        this.log('Bağlantı kesildi. Maç duraklatıldı; geri bağlanmayı deniyoruz.');}
      this.scheduleReconnect();
    });
  }
  receive(packet){
    const p=packet.payload||{};
    if(packet.type==='CONNECTED'){
      this.stopReconnect();
      this.myId=p.playerId;this.seat=p.seat;this.status=`Odadaki yerin: Oyuncu ${p.seat}`;
      try{history.replaceState(null,'',inviteLink(location.href,this.code));}catch{}
      this.startProbes();
      this.log(p.resumed?'Aynı oyuncu oturumu geri yüklendi.':'Lobiye katıldın.');
    }else if(packet.type==='ROOM_STATE'){
      this.players=Array.isArray(p.players)?p.players:[];this.hostPlayerId=p.hostPlayerId||null;
      this.phase=p.phase||'waiting';
      const rounds=p.rounds??p.summary?.rounds;if(rounds!==undefined)this.roomRounds=normalizeRounds(rounds);
      const rstyle=p.roundStyle??p.summary?.roundStyle;if(rstyle!==undefined)this.roomRoundStyle=normalizeRoundStyle(rstyle);      const mode=p.mode??p.summary?.mode;if(mode!==undefined)this.roomMode=normalizeMode(mode);
      const content=p.content??p.summary?.content;if(content!==undefined)this.roomContent=normalizeContent(content);
      const typing=p.typing??p.summary?.typing;if(typing!==undefined)this.roomTyping=normalizeTyping(typing);
      const assist=p.assist??p.summary?.assist;if(assist!==undefined)this.roomAssist=normalizeAssist(assist);
      const stage=p.stage??p.summary?.stage;if(stage!==undefined)this.roomStage=normalizeStageChoice(stage);
      this.startAt=typeof p.startAt==='number'?p.startAt:null;
      const mine=this.players.find(x=>x.playerId===this.myId);
      this.ready=Boolean(mine?.ready);
      const online=this.players.filter(x=>x.online).length;
      this.status=this.match?.status==='paused'?'⏸ Bağlantı bekleniyor · düello duraklatıldı':this.phase==='started'?'Düello aktif · sunucu otoriteli':`Lobi · ${online}/2 oyuncu bağlı`;
      if(this.phase==='started'&&!this.match)this.requestSnapshot();
      if(this.phase==='countdown')this.startTicker();
      else if(this.phase==='rematch_countdown')this.startMatchTicker();
      else if(this.match?.status==='running')this.startMatchTicker();
      else this.stopTicker();
    }else if(packet.type==='COUNTDOWN'){
      this.phase='countdown';this.startAt=p.startAt;this.startTicker();this.log('İki oyuncu da hazır! Başlıyor...');
      // VS girişi geri sayımda oynar: maç saati henüz çalışmıyor, kimsenin yazma süresi kapanmaz.
      this.root.dispatchEvent(new CustomEvent('tuslab:pvp-cinematic',{detail:{type:'COUNTDOWN',match:{players:this.players},startAt:p.startAt,seat:this.seat}}));
    }else if(packet.type==='COUNTDOWN_CANCELLED'){
      this.phase='waiting';this.startAt=null;this.stopTicker();this.log('Geri sayım iptal edildi.');
    }else if(packet.type==='MATCH_START'){
      this.rematchVotes=[];this.startAt=null;
      this.phase='started';this.stopTicker();this.open=false;
      this.applyMatch(p,packet.serverTime);this.startMatchTicker();
      if(p.resumed){this.root.dispatchEvent(new CustomEvent('tuslab:pvp-recovered'));this.log('Oturum ve maç durumu sunucudan geri yüklendi.');}
      else this.log(isArenaMatch(this.match)?'Arena başladı! Her raund önce skill + eşya seç, sonra kelimeleri yaz.':'Maç başladı! Q/E/R otomatik saldırır; S eşzamanlı kelimede kalkan şansıdır.');
      // Sinematik katman (VS girişi) için; yalnız görseldir, oyun durumunu değiştirmez.
      if(!p.resumed)this.root.dispatchEvent(new CustomEvent('tuslab:pvp-cinematic',{detail:{type:'MATCH_START',match:this.match,seat:this.seat}}));
    }else if(['STATE_UPDATE','MATCH_END','MATCH_PAUSED','MATCH_RESUMED'].includes(packet.type)){
      this.applyMatch(p,packet.serverTime);
      if(packet.type==='MATCH_PAUSED'){this.status='⏸ Maç duraklatıldı · oyuncu bekleniyor';this.log('Bağlantı kesildi; maç süresi ve saldırılar donduruldu.');this.startMatchTicker();}
      else if(packet.type==='MATCH_RESUMED'){this.status='⚔ Maç devam ediyor';this.log('İki oyuncu döndü; savaş devam ediyor.');this.startMatchTicker();}
      else if(packet.type==='MATCH_END'){
        this.stopTicker();const reason=this.match?.endReason;
        this.log(reason==='ARENA_DRAW'?'Arena berabere bitti.':isArenaMatch(this.match)&&reason==='ROUNDS'?'Arena 6 raund sonunda kalan HP ile bitti.':reason==='DISCONNECT_FORFEIT'?'Bağlantı süresi doldu: hükmen galibiyet.':reason==='BOTH_DISCONNECTED'?'İki oyuncu koptu: maç iptal edildi.':reason==='KNOCKOUT'?'Düello nakavtla bitti.':reason==='ROUNDS'?`Maç tur skoruyla bitti: ${this.match?.roundsWon?.[1]??0} – ${this.match?.roundsWon?.[2]??0}.`:reason==='ROUNDS_DRAW'?'Ani ölüm turları da berabere: maç berabere.':reason==='SURRENDER'?'Maç teslim olmayla bitti.':'Düello süresi doldu.');
      }else if(['running','paused'].includes(this.match?.status))this.startMatchTicker();
    }else if(ROUND_PACKETS.has(packet.type)){
      // Tur olayları her zaman güncel publicMatch taşır; önce snapshot, sonra tur arayüzü.
      this.applyMatch(p,packet.serverTime);
      if(['running','paused'].includes(this.match?.status))this.startMatchTicker();
      this.root.dispatchEvent(new CustomEvent('tuslab:pvp-round',{detail:{type:packet.type,payload:p,serverTime:packet.serverTime}}));
      if(packet.type==='ROUND_END'&&p.round)this.log(p.winnerSeat?`Raund ${p.round}: ${this.match?.players?.find(x=>x.seat===p.winnerSeat)?.name||'Oyuncu '+p.winnerSeat} kazandı${p.reason==='KO'?' (KO)':''}.`:`Raund ${p.round}: berabere.`);
    }else if(ARENA_PACKETS.has(packet.type)){
      // Önce kişisel anlık görüntü (HP, faz, kelimeler; ARENA_ATTACK combatEvents ile görsele gider), sonra arena arayüzü.
      if(p.match)this.applyMatch(p,packet.serverTime);
      if(['running','paused'].includes(this.match?.status))this.startMatchTicker();else if(this.match?.status==='ended')this.stopTicker();
      if(packet.type!=='ARENA_ATTACK')this.root.dispatchEvent(new CustomEvent('tuslab:pvp-arena',{detail:{type:packet.type,payload:p,serverTime:packet.serverTime}}));
      if(packet.type==='ARENA_ROUND_END'&&p.round)this.log(`Raund ${p.round} bitti · vuruşlar sırayla uygulanıyor.`);
    }else if(packet.type==='REMATCH_STATUS'){
      this.rematchVotes=Array.isArray(p.votes)?p.votes:[];
      this.root.dispatchEvent(new CustomEvent('tuslab:pvp-rematch'));
    }else if(packet.type==='REMATCH_COUNTDOWN'){
      this.phase='rematch_countdown';this.startAt=p.startAt;this.startMatchTicker();
      this.log('Her iki oyuncu rövanşı kabul etti. 3-2-1!');
      this.root.dispatchEvent(new CustomEvent('tuslab:pvp-rematch'));
    }else if(packet.type==='REMATCH_CANCELLED'){
      this.phase='started';this.startAt=null;this.rematchVotes=[];
      this.log('Rövanş iptal edildi.');this.root.dispatchEvent(new CustomEvent('tuslab:pvp-rematch'));
    }else if(packet.type==='MATCH_HISTORY'){
      this.history=Array.isArray(p.results)?p.results:[];
    }else if(packet.type==='WORD_RESULT'){
      this.clearPrediction();
      if(p.match)this.applyMatch(p,packet.serverTime);
      if(isArenaMatch(this.match))this.root.dispatchEvent(new CustomEvent('tuslab:pvp-arena',{detail:{type:'WORD_RESULT',payload:p,serverTime:packet.serverTime}}));
      this.root.dispatchEvent(new CustomEvent('tuslab:pvp-word-result',{detail:p}));
      if(p.accepted)this.log(p.correct?'✓ Doğru kelime, kombo '+p.combo:'✕ Hatalı kelime, kombo sıfırlandı');
      else {
        this.log('Kelime sayılmadı: '+errorText(p.code));
        if(['WORD_INDEX_MISMATCH','ROUND_MISMATCH'].includes(p.code))this.requestSnapshot();
      }
    }else if(packet.type==='ROOM_KICKED'||packet.type==='ROOM_CLOSED'){
      this.disconnect(false);this.code='';this.open=true;this.status=packet.type==='ROOM_KICKED'?'Oda sahibi tarafından çıkarıldın':'Oda sahibi odayı kapattı';this.log(this.status);
    }else if(packet.type==='ERROR'){
      this.log('Sunucu: '+errorText(p.code));
      if(['ROOM_FULL','ROOM_NOT_FOUND','ROOM_BUSY','MATCH_ALREADY_STARTED','INVALID_JOIN'].includes(p.code)){
        this.stopReconnect();this.status='Odaya katılınamadı: '+errorText(p.code);
        const ws=this.ws;this.ws=null;ws?.close();
      }
    }else if(packet.type==='PONG'){
      this.clockSync.receive(p,Date.now());
    }else if(packet.type==='PEER_MESSAGE')this.log('Rakip: '+String(p.text||''));
    this.scheduleRender();   // U2: paket patlaması kare başına tek render'a iner; davranış aynı kalır.
  }
  applyMatch(payload,serverTime){
    const m=payload.match;
    if(!m||typeof m.matchId!=='string'||!Number.isSafeInteger(m.sequence))return;
    const ordered=this.snapshots.observe(m.matchId,m.sequence);
    if(!ordered.accepted)return;
    const firstSnapshot=ordered.newMatch;
    if(ordered.gap)this.requestSnapshot();
    if(firstSnapshot){
      this.lastSeq=0;
      // A late join must not replay the previous 24 battle animations.
      this.lastCombatId=m.combatEvents?.at(-1)?.id||0;
    }
    this.lastSeq=m.sequence;
    this.match=m;
    // Before the first two-way RTT sample, serverTime provides only a rough offset.
    // Never replace an RTT-derived estimate with a one-way packet arrival timestamp.
    if(typeof serverTime==='number'&&!this.clockSync.stats().ready)this.serverOffset=serverTime-Date.now();
    this.updateArena();
    // Bu paket arenayı az önce çizdi; kare sonundaki ortak render() aynısını tekrar çizmesin (U2).
    this.arenaFresh=true;
    if(!firstSnapshot){
      for(const event of m.combatEvents||[]){
        if(event.id<=this.lastCombatId)continue;
        this.lastCombatId=event.id;
        this.root.dispatchEvent(new CustomEvent('tuslab:pvp-combat',{detail:event}));
      }
    }
    this.root.dispatchEvent(new CustomEvent('tuslab:pvp-match',{detail:{match:this.match,myId:this.myId,seat:this.seat}}));
  }
  updateArena(){
    const match=this.match;
    const serverNow=this.serverNow();
    // Faz takılırsa (sunucu saatine göre bitiş + 2 sn geçti) en son durumu yeniden iste (istek 750 ms'de bir sınırlıdır).
    if(match&&!document.hidden&&phaseOverdueMs(match,serverNow)>PHASE_STALL_MS)this.requestSnapshot();
    if(this.phase==='rematch_countdown'&&this.startAt){
      const countdown=this.root?.querySelector('[data-pvp15-votes]');
      if(countdown)writeText(countdown,`RÖVANŞ: ${Math.max(0,Math.ceil((this.startAt-serverNow)/1000))} · Yeni maç başlıyor`);
    }
    const banner=this.root?.querySelector('[data-match-status]');
    if(banner){writeText(banner,match?.status==='paused'?'⏸ MAÇ DURAKLADI':match?.status==='running'?'⚔ CANLI MAÇ':match?.status==='ended'?'⌛ MAÇ BİTTİ':'⚔ MAÇ BEKLENİYOR');writeAttr(banner,'title',match?.status==='running'?'Sunucu senkronize; HP ve hasar sunucudan gelir':match?.status==='paused'?'Oyuncu bekleniyor':'');writeAttr(banner,"data-live",String(match?.status==='running'));
      // B2A: banner yalnız duraklatılmış maçta görünür (network.css sr-only kuralının işareti); diğer durumlar ekran okuyucuda kalır.
      writeAttr(banner,"data-paused",String(match?.status==='paused'));}
    const timer=this.root?.querySelector('[data-match-timer]');
    if(timer)writeText(timer,match?`${Math.max(0,Math.ceil((match.endsAt-(match.status==='paused'&&match.pausedAt?match.pausedAt:serverNow))/1000))} sn${match.status==='paused'?' ⏸':''}`:'—');
    const seq=this.root?.querySelector('[data-match-sequence]');if(seq)writeText(seq,match?`#${match.sequence}`:'—');
    const net=this.root?.querySelector('[data-pvp12-ping]');
    if(net){const stats=this.clockSync.stats();
      writeText(net,stats.ready?`● ${stats.rtt} ms · titreşim ${stats.jitter} ms`:'◌ Ping ölçülüyor');
      writeAttr(net,"data-quality",!stats.ready?'unknown':stats.rtt<90?'good':stats.rtt<180?'medium':'high');
      const help='Gidiş-dönüş süresi (RTT), sunucu saat tahmini; saldırı kararı her zaman sunucuda.';if(net.title!==help)net.title=help;
    }
    for(const seat of [1,2]){
      const p=match?.players?.find(x=>x.seat===seat);
      const side=this.root?.querySelector(`[data-seat=\"${seat}\"]`);
      if(!side)continue;
      const playerName=side.querySelector('[data-server-player-name]');
      if(playerName)writeText(playerName,p?.name||'Oyuncu bekleniyor');
      // Paket 32: oyuncu başlığında karakter adı (ör. "Sira · Gölge Mızrak"); maç yokken arketipin eski adı kalır.
      const charName=side.querySelector('.pvp2-character-name');
      if(charName&&p&&isFighterId(p.fighter)){const f=FIGHTERS[p.fighter];writeText(charName,`${f.name} · ${f.title}`);side.dataset.fighter=f.id;}
      const connection=side.querySelector('[data-player-connection]');
      if(connection){
        const own=p?.playerId===this.myId;
        const ping=!this.practice&&own?this.clockSync.stats():null;
        const label=!p?'Bekleniyor':this.practice?'Yerel maç':this.reconnecting&&own?'Bağlanıyor':match.status==='paused'?'Bekleniyor':match.status==='ended'?'Maç bitti':ping?.ready?`${ping.rtt} ms`:'Bağlı';
        writeText(connection.querySelector('span'),label);
        writeAttr(connection,'data-quality',!p?'unknown':this.reconnecting&&own?'poor':match.status==='paused'?'unknown':ping?.ready?(ping.rtt<90?'good':ping.rtt<180?'medium':'poor'):'good');
      }
      const validHp=Boolean(p&&Number.isFinite(p.hp)&&Number.isFinite(p.maxHp)&&p.maxHp>0);
      const currentHp=validHp?Math.max(0,Math.min(p.maxHp,p.hp)):0;
      const maxHp=validHp?p.maxHp:1;
      const ratio=currentHp/maxHp;
      const hp=side.querySelector('[data-server-hp]');
      if(hp)writeText(hp,validHp?`${currentHp.toLocaleString('tr-TR')} / ${maxHp.toLocaleString('tr-TR')} HP`:'Maç bekleniyor');
      const track=side.querySelector('[data-server-hp-track]');
      if(track){writeAttr(track,'aria-valuenow',currentHp);writeAttr(track,'aria-valuemax',maxHp);writeAttr(track,'aria-valuetext',validHp?`${currentHp} / ${maxHp} HP`:'Maç bekleniyor');}
      const fill=side.querySelector('[data-server-hp-fill]');
      const trail=side.querySelector('[data-server-hp-trail]');
      const scale=`scaleX(${ratio})`;
      if(fill&&fill.style.transform!==scale)fill.style.transform=scale;
      if(trail&&trail.style.transform!==scale)trail.style.transform=scale;
      const health=side.querySelector('.pvp2-health');
      if(health)writeAttr(health,'data-low',String(validHp&&ratio<.3));
      const shieldActive=Boolean(p?.shieldUntil&&p.shieldUntil>serverNow);
      const shield=side.querySelector('[data-server-shield]');
      if(shield)shield.hidden=!shieldActive;
      const shieldLayer=side.querySelector('[data-server-shield-layer]');
      if(shieldLayer)writeAttr(shieldLayer,'data-active',String(shieldActive));
      const combo=side.querySelector('[data-server-combo]');if(combo)writeText(combo,p?(isArenaMatch(match)?`Seri ${p.combo} · ${p.correctWords} doğru / ${p.wrongWords} yanlış`:isRoundMatch(match)?`Seri ${p.streak??p.combo} · turda ${p.roundCorrect??0} doğru / ${p.roundWrong??0} yanlış`:`${p.combo} kombo · ${p.correctWords} doğru / ${p.wrongWords} yanlış`):'Henüz maç yok');
      const runeLine=side.querySelector('[data-pvp22-passive]');if(runeLine)writeText(runeLine,p?`✦ ${RUNE_NAMES[p.rune]||'Klasik'} · Rün enerjisi ${p.runeEnergy||0}/5 · ${(p.activeBonuses||[]).join(', ')}`:'Rün: maç öncesi seçim');
      const defense=side.querySelector('[data-server-defense]');
      if(defense){const d=p?.defenseStats||{};writeText(defense,`🛡 ${d.normalBlocks||0} BLOK · ✦ ${d.perfectBlocks||0} PERFECT · ⚔ ${d.parries||0} PARRY · ↯ ${d.counters||0} COUNTER · ✹ ${d.shieldBreaks||0} KIRILMA`);}
      const score=side.querySelector('[data-server-score]');if(score)writeText(score,p?`${p.wpm} WPM · %${p.accuracy} doğruluk`:'Sunucu istatistiği bekleniyor');
      // U2: yetenek kartlarının durumu (metin, ölçer, hazır hâli) pvp/skillbar.js sahipliğinde —
      // tuslab:pvp-match olayıyla index.js applySkillRow günceller. Eski yetenek durum döngüsü
      // kaldırıldı; burada yalnız maç kiliti kaldı: kartlar [data-demo-action] olduğundan disabled
      // kilitlenir ama başlık (title) almaz — skillbar.js kartsız title istemiyor.
      side.querySelectorAll('[data-demo-action],[data-demo-combo]').forEach(button=>{
        const locked=Boolean(['running','paused'].includes(match?.status));if(button.disabled!==locked)button.disabled=locked;
        if(button.dataset.skill)return;   // yetenek kartı: eski başlık ataması yapılmaz
        const title=locked?'Aktif veya duraklatılmış maçta yalnız sunucu saldırı başlatabilir':'Animasyon önizlemesi';if(button.title!==title)button.title=title;
      });
    }
  }
  startTicker(){if(this.ticker!==null)return;this.ticker=setInterval(()=>{if(shouldPaint(document.hidden)){this.renderCountdown();this.updateArena();}},250);this.renderCountdown();}
  startMatchTicker(){if(this.ticker!==null)return;this.ticker=setInterval(()=>{if(shouldPaint(document.hidden)){this.updateArena();this.renderConnection();}},500);}

  renderCountdown(){const el=this.panel()?.querySelector('[data-lobby-countdown]');if(!el)return;const remaining=Math.max(0,Math.ceil((this.startAt-Date.now())/1000));writeText(el,remaining>0?String(remaining):'BAŞLA!');}
  async copyInvite(){
    if(!ROOM_CODE.test(this.code))return;
    const link=inviteLink(location.href,this.code);
    try{await navigator.clipboard.writeText(link);this.log('Davet bağlantısı kopyalandı.');}
    catch{this.log('Otomatik kopyalanamadı; bağlantıyı aşağıdan seç.');this.panel()?.querySelector('[data-lobby-link]')?.select();}
  }
  renderConnection(){
    const banner=this.root?.querySelector('[data-reconnect-banner]');if(!banner)return;
    const offline=this.match?.status==='paused'?(this.match.offlineSeats||[]):[];
    const active=this.reconnecting||offline.length>0;
    banner.hidden=!active;
    const wait=this.players.filter(p=>!p.online&&p.reconnectUntil);
    const remaining=wait.length?Math.max(0,Math.min(...wait.map(p=>p.reconnectUntil))-(this.serverNow())):0;
    banner.textContent=this.reconnecting
      ?`◌ Yeniden bağlanılıyor · ${Math.max(0,Math.ceil((19_200-(Date.now()-this.reconnectStartedAt))/1000))} sn kaldı`
      :`⏸ Rakip yeniden bağlanıyor · ${Math.ceil(remaining/1000)} sn · HP ve zaman donduruldu`;
  }
  /** U2: paket kaynaklı çizimleri kare başına tek render()'a indirir; requestAnimationFrame
   * yoksa (ör. Node testleri) anında çizer, böylece davranış eski hâliyle aynı kalır. */
  scheduleRender(){
    if(this.renderPending)return;
    this.renderPending=true;
    const paint=()=>{this.renderPending=false;this.render();};
    if(typeof requestAnimationFrame==='function')requestAnimationFrame(paint);
    else paint();
  }
  render(){
    const panel=this.panel();if(!panel)return;
    this.renderConnection();
    panel.hidden=!this.open;
    const lobbyToggle=this.root.querySelector('[data-lobby-action="toggle"]');if(lobbyToggle){lobbyToggle.setAttribute('aria-expanded',String(this.open));lobbyToggle.textContent=this.open?'⚔ Lobiyi kapat':'⚔ Lobiyi aç';}
    const badge=this.root.querySelector('[data-net-status]');
    if(badge){badge.textContent=this.status;badge.dataset.online=this.ws?.readyState===1&&Boolean(this.myId)?'true':'false';}
    const put=(selector,value)=>{const el=panel.querySelector(selector);if(el)el.textContent=value;};
    put('[data-lobby-state]',this.status);
    put('[data-lobby-code]',this.code||'—');
    put('[data-lobby-count]',this.players.filter(p=>p.online).length+' / 2');
    const input=panel.querySelector('[data-lobby-name]');if(input&&document.activeElement!==input&&input.value!==this.name)input.value=this.name;
    const link=panel.querySelector('[data-lobby-link]');if(link)link.value=this.code?inviteLink(location.href,this.code):'';
    // Practice has a local myId but no room: keep the room section hidden and
    // show the practice controls + "ANTRENMAN · çevrimdışı" chip instead.
    const joined=Boolean(this.myId)&&!this.practice;
    const chip=this.root.querySelector('[data-practice-chip]');if(chip)chip.hidden=!this.practice;
    panel.querySelector('[data-lobby-action="practice-stop"]')?.toggleAttribute('hidden',!this.practice);
    put('[data-practice-main]',this.practice?'Yeniden savaş':'Savaşa gir');put('[data-practice-sub]',this.practice?'↻ Yeni bot maçı başlat':'🤖 Seçili modda bot maçını başlat');
    panel.querySelectorAll('[data-difficulty]').forEach(b=>{const on=String(b.dataset.difficulty===this.practiceDifficulty);if(b.getAttribute('aria-pressed')!==on)b.setAttribute('aria-pressed',on);});
    const charSelect=panel.querySelector('[data-practice-character]');if(charSelect&&document.activeElement!==charSelect)charSelect.value=this.character;
    panel.dataset.hero=this.character;
    panel.dataset.fighter=this.fighter;
    const me=this.players.find(p=>p.playerId===this.myId);
    const shownFighter=joinedFighter(Boolean(this.myId)&&!this.practice,me,this.fighter);
    panel.querySelectorAll('[data-lobby-action="fighter"]').forEach(b=>{
      const on=b.dataset.fighter===shownFighter;b.setAttribute('aria-checked',String(on));b.tabIndex=on?0:-1;
      if(b.closest('[data-fighter-group="room"]'))b.disabled=!(Boolean(this.myId)&&!this.practice)||this.phase!=='waiting';
    });
    this.showFighterInfo(panel.querySelector('[data-fighter-group="lobby"] [data-fighter]:is(:hover,:focus-visible)')?.dataset.fighter||shownFighter);
    const host=joined&&this.hostPlayerId===this.myId;
    const roomEditable=host&&['waiting','countdown'].includes(this.phase);
    syncRoundsPicker(panel,'room',{value:this.roomRounds,editable:roomEditable,note:roomEditable?'Değiştirmek iki oyuncunun hazır durumunu sıfırlar.':host?'Maç başladı; rövanş aynı uzunlukta oynanır.':'Maç uzunluğunu oda sahibi belirler.'});
    syncRoundsPicker(panel,'practice',{value:this.practiceRounds,editable:true,note:''});
    syncRoundStylePicker(panel,'room',{style:this.roomRoundStyle,editable:roomEditable,note:roomEditable?'Değiştirmek iki oyuncunun hazır durumunu sıfırlar.':'Raund biçimini oda sahibi belirler.'});
    syncRoundStylePicker(panel,'practice',{style:this.practiceRoundStyle,editable:true,note:''});
    syncModePicker(panel,'room',{value:this.roomMode,content:this.roomContent,editable:roomEditable,note:roomEditable?'Modu değiştirmek hazır durumlarını sıfırlar.':host?'Maç başladı; rövanş aynı modda oynanır.':'Oyun modunu oda sahibi belirler.'});
    syncTypingPicker(panel,'practice',{value:this.practiceTyping,editable:true,note:''});
    syncTypingPicker(panel,'room',{value:this.roomTyping,editable:roomEditable,note:roomEditable?'Değiştirmek hazır durumlarını sıfırlar.':host?'Maç başladı; rövanş aynı kurallarla oynanır.':'Yazma kurallarını oda sahibi belirler.'});
    syncAssistPicker(panel,'practice',{value:this.practiceAssist,editable:true,character:this.character,arena:this.practiceMode==='arena'});
    syncAssistPicker(panel,'room',{value:this.roomAssist,editable:roomEditable,character:this.character,arena:this.roomMode==='arena'});
    syncStagePicker(panel,'practice',{value:this.practiceStage,editable:true,note:''});
    syncStagePicker(panel,'room',{value:this.roomStage,editable:roomEditable,note:roomEditable?'':host?'':'(Sahneyi oda sahibi seçer.)'});
    syncModePicker(panel,'practice',{value:this.practiceMode,content:this.practiceContent,editable:true,note:this.practiceMode==='arena'?'6 raund · 3.000 HP · raund öncesi skill + eşya seçilir.':''});
    const hostBox=panel.querySelector('[data-pvp17-host]');if(hostBox)hostBox.hidden=!host||!['waiting','countdown'].includes(this.phase);
    const kickButton=panel.querySelector('[data-lobby-action="kick"]');const opponent=this.players.find(p=>p.playerId!==this.myId);
    if(kickButton){kickButton.hidden=!opponent;kickButton.dataset.target=opponent?.playerId||'';}
    panel.querySelector('[data-lobby-before]')?.toggleAttribute('hidden',joined);
    panel.querySelector('[data-lobby-after]')?.toggleAttribute('hidden',!joined);
    for(const seat of [1,2]){
      const slot=panel.querySelector(`[data-lobby-slot="${seat}"]`);
      const player=this.players.find(p=>p.seat===seat);
      const name=slot?.querySelector('[data-slot-name]');if(name)name.textContent=player?.name||'Arkadaşını davet et';
      const pf=player?FIGHTERS[normalizeFighter(player.fighter,player.character)]:null;
      const char=slot?.querySelector('[data-slot-char]');if(char)char.textContent=pf?`${pf.name} · ${pf.title} · ${RUNE_NAMES[player.rune]||'Klasik'}`:'Henüz katılmadı';
      if(slot){if(pf){slot.dataset.fighter=pf.id;slot.style.setProperty('--f-main',pf.palette.main);slot.style.setProperty('--f-accent',pf.palette.accent);}
        else{delete slot.dataset.fighter;slot.style.removeProperty('--f-main');slot.style.removeProperty('--f-accent');}
        const em=slot.querySelector('[data-slot-emblem]');if(em)em.textContent=pf?pf.name[0]:'?';}
      const status=slot?.querySelector('[data-slot-status]');if(status)status.textContent=player?(player.online?(player.ready?'✓ HAZIR':'● Bağlandı'):`◌ Yeniden bağlanıyor (${Math.ceil(Math.max(0,(player.reconnectUntil-(this.serverNow()))/1000))} sn)`):'○ Boş';
      if(slot){slot.dataset.ready=String(Boolean(player?.ready));slot.dataset.online=String(Boolean(player?.online));slot.dataset.character=player?.character||'';}
    }
    panel.querySelectorAll('[data-lobby-action="char"]').forEach(b=>{
      b.setAttribute('aria-pressed',String(this.players.find(p=>p.playerId===this.myId)?.character===b.dataset.character||(!joined&&this.character===b.dataset.character)));
      b.disabled=!joined||this.phase!=='waiting';
    });
    panel.querySelectorAll('[data-lobby-action="rune"]').forEach(b=>{b.setAttribute('aria-pressed',String((this.players.find(p=>p.playerId===this.myId)?.rune||this.rune)===b.dataset.rune));b.disabled=!joined||this.phase!=='waiting';});
    const ready=panel.querySelector('[data-lobby-action="ready"]');
    if(ready){ready.textContent=this.ready?'✓ Hazırsın — Vazgeç':'⚔ Hazırım · Savaşa gir';ready.disabled=!joined||this.phase==='started';}
    const c=panel.querySelector('[data-lobby-counter]');
    if(c)c.hidden=this.phase!=='countdown';
    if(this.phase==='countdown')this.renderCountdown();
    panel.querySelectorAll('[data-lobby-action="create"],[data-lobby-action="join"]').forEach(b=>b.disabled=this.connecting);
    const entries=panel.querySelector('[data-lobby-log]');
    if(entries)entries.replaceChildren(...this.entries.map(v=>{const e=document.createElement('div');e.textContent=v;return e;}));
    if(this.arenaFresh)this.arenaFresh=false;else this.updateArena();
  }
}
export function networkConsoleHTML(){
  return `<div class="pvp5-network-controls"><button type="button" class="pvp5-net-button ui-button-secondary" data-lobby-action="toggle" aria-controls="pvp-lobby-panel" title="Oda kur, katıl veya bot maçını başlat">⚔ Lobiyi aç</button><button type="button" class="pvp5-net-button pvp16-open ui-button-ghost" data-pvp16-action="toggle" title="Oyuncu profilini aç">🏆 Profil</button><button type="button" class="pvp5-net-button ui-button-ghost" data-social-action="toggle" title="Arkadaş listesini aç">👥 Arkadaşlar</button><span class="pvp5-connect-status" data-net-status data-online="false">Bağlı değil</span><span class="pvp24-chip" data-practice-chip hidden title="Bota karşı yerel maç; sunucu, profil ve puan kullanılmaz">🤖 ANTRENMAN · çevrimdışı</span></div>
    <section class="pvp6-panel lb3" id="pvp-lobby-panel" data-lobby-panel data-hero="fire" aria-label="PvP lobisi ve bot antrenmanı" role="region">
      <header class="pvp6-head lb3-head"><div class="lb3-head-copy"><span class="pvp6-eyebrow">1v1 · YAZARAK DÖVÜŞ</span><h2>RUH DÜELLOSU</h2><p data-lobby-state>Bağlı değil</p></div><span class="pvp6-label">PvP</span><button type="button" class="lb3-close" data-lobby-action="toggle" aria-label="Lobiyi kapat" title="Lobiyi kapat">Kapat <span aria-hidden="true">✕</span></button></header>
      <div class="pvp6-before j2-before" data-lobby-before>
        <section class="j2-modes" aria-label="Oyun modu">${modePickerHTML('practice')}</section>
        <section class="lb3-showcase lb3-roster j2-pick" aria-labelledby="lb3-hero-title">
          <h3 class="lb3-kicker" id="lb3-hero-title">Savaşçını seç</h3>
          ${fighterRosterHTML()}
        </section>
        <section class="j2-settings" data-j2-settings data-practice-box aria-labelledby="j2-settings-title">
          <h3 class="lb3-kicker" id="j2-settings-title">MAÇ AYARLARI</h3>
          ${difficultyPickerHTML()}
          ${roundsPickerHTML('practice')}
          ${roundStylePickerHTML('practice')}
        </section>
        <section class="j2-arena" aria-label="Arena seçimi">${stagePickerHTML('practice')}</section>
        <div class="j2-go">
          <button type="button" class="pvp24-practice-start ui-button-primary lb3-fight" data-lobby-action="practice"><span class="lb3-fight-main" data-practice-main>Savaşa gir</span><span class="lb3-fight-sub" data-practice-sub>🤖 Seçili modda bot maçını başlat</span></button>
          <button type="button" class="pvp24-practice-stop ui-button-ghost" data-lobby-action="practice-stop" hidden>Bot maçını bitir</button>
          <p class="pvp6-help">Çevrimdışı bot maçı · profil ve puan değişmez.</p>
        </div>
        <section class="lb-card lb-online lb3-online j2-online" aria-labelledby="lb-online-title">
          <header class="lb-card-head"><h3 id="lb-online-title"><span class="lb3-step" aria-hidden="true">2</span>Arkadaşınla düello</h3><span class="lb-tag">Çevrimiçi</span></header>
          <label for="pvp6-name">Oyuncu adın</label><input id="pvp6-name" data-lobby-name maxlength="20" value="Savaşçı" autocomplete="nickname" />
          <div class="pvp6-startrow"><button type="button" class="pvp6-primary ui-button-secondary" data-lobby-action="create">✦ Oda oluştur ve davet et</button></div>
          <div class="lb-divider" role="separator"><span>veya arkadaşının koduyla katıl</span></div>
          <label for="lb3-join-code">Oda kodu</label>
          <div class="pvp6-join"><input id="lb3-join-code" data-lobby-join-code maxlength="16" autocomplete="off" spellcheck="false" placeholder="16 karakter" aria-describedby="lb3-join-hint"/><button type="button" class="ui-button-secondary" data-lobby-action="join">Odaya katıl</button></div>
          <p class="pvp6-help" id="lb3-join-hint">Kodu arkadaşının davet bağlantısının sonunda bulursun.</p>
        </section>
      </div>
      <div class="pvp6-after" data-lobby-after hidden>
        <div class="lb3-room-stage">
          <div class="lb3-ticket">
            <div class="pvp6-code"><div><small>ODA KODU</small><strong data-lobby-code>—</strong></div><span>👥 <b data-lobby-count>0 / 2</b></span></div>
            <div class="pvp6-share"><label for="lb3-invite">Davet bağlantısı</label><input id="lb3-invite" data-lobby-link readonly><button type="button" class="ui-button-secondary" data-lobby-action="copy">🔗 Davet bağlantısını kopyala</button></div>
          </div>
          <div class="pvp6-players lb3-versus">
            <div class="pvp6-slot fire" data-lobby-slot="1" data-character=""><span class="lb3-slot-art" aria-hidden="true"></span><span class="lb3-slot-emblem lb3-f-emblem" data-slot-emblem aria-hidden="true">?</span><span class="pvp6-player-tag">I · KIZIL</span><strong data-slot-name>Oyuncu bekleniyor…</strong><small data-slot-char>Henüz katılmadı</small><em data-slot-status>○ Boş</em></div>
            <span class="lb3-vs" aria-hidden="true">VS</span>
            <div class="pvp6-slot rune" data-lobby-slot="2" data-character=""><span class="lb3-slot-art" aria-hidden="true"></span><span class="lb3-slot-emblem lb3-f-emblem" data-slot-emblem aria-hidden="true">?</span><span class="pvp6-player-tag">II · MAVİ</span><strong data-slot-name>Oyuncu bekleniyor…</strong><small data-slot-char>Henüz katılmadı</small><em data-slot-status>○ Boş</em></div>
          </div>
          <div class="pvp6-counter" data-lobby-counter hidden><div>⚡ DÜELLO BAŞLIYOR</div><strong data-lobby-countdown>3</strong></div>
          <div class="pvp6-controls"><button type="button" class="pvp6-primary lb3-fight" data-lobby-action="ready">⚔ Hazırım · Savaşa gir</button><button type="button" class="pvp6-leave" data-lobby-action="leave">Odadan çık</button></div><div class="pvp17-host" data-pvp17-host hidden><small>👑 Oda sahibi kontrolleri (maç başlamadan önce)</small><button type="button" data-lobby-action="kick" hidden>Rakibi çıkar</button><button type="button" data-lobby-action="close-room">Odayı kapat</button></div>
        </div>
        <div class="lb3-room-setup">
          <div class="pvp6-charlabel" id="lb3-room-fighter-label">SAVAŞÇINI SEÇ</div>
          ${roomFighterChoicesHTML()}
          ${stagePickerHTML('room')}
          ${roundStylePickerHTML('room')}
          <div class="pvp22-runes"><div class="pvp6-charlabel">⚡ RÜNÜNÜ SEÇ · HER OYUNCU 1 RÜN</div><div class="pvp22-rune-grid"><button type="button" data-lobby-action="rune" data-rune="none" aria-pressed="true" title="Bonus yok">⚔ Klasik</button><button type="button" data-lobby-action="rune" data-rune="ember" aria-pressed="false" title="Q hasarı +8">🔥 Alev Mührü</button><button type="button" data-lobby-action="rune" data-rune="crystal" aria-pressed="false" title="Savunma cooldown -200 ms">🛡 Kristal Kalkan</button><button type="button" data-lobby-action="rune" data-rune="rhythm" aria-pressed="false" title="E/R hasarı +6">♫ Savaş Ritimcisi</button><button type="button" data-lobby-action="rune" data-rune="laststand" aria-pressed="false" title="Düşük HP son çare">♥ Son Direniş</button><button type="button" data-lobby-action="rune" data-rune="reflex" aria-pressed="false" title="Perfect pencere +25 ms">✦ Keskin Refleks</button><button type="button" data-lobby-action="rune" data-rune="lightning" aria-pressed="false" title="Her üçüncü Q +18">⚡ Yıldırım Kesişi</button></div></div>${modePickerHTML('room')}${roundsPickerHTML('room')}
          <p class="pvp6-help">İkiniz de <b>Hazırım</b> dediğinizde 3-2-1 sayımı başlar. Bağlantı koparsa maç 20 saniye duraklar; geri gelince kaldığı yerden sürer.</p>
        </div>
      </div>
      <div class="pvp6-log" data-lobby-log role="log" aria-live="polite"></div>
    </section>${profilePanelHTML()}${friendPanelHTML()}`;
}
