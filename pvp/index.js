import {createPvPStore,PvPView} from './state.js';
import {getTypingPreview} from './preview.js';
import {exchangeGate,wordCommit,afterReject,queuedReady} from './word-queue.js';
import {normalizeTyping} from './shared/typing-rules.js';
import {createCharacterController,rigMarkup,MOTION_NAMES} from './characters.js';
import {createCombatFxDirector} from './combat-fx.js';
import {createPvPAudio,soundForCue,weaponSfx} from './sound.js';
import {FIGHTERS,isFighterId,normalizeFighter} from './shared/fighters.js';
import {createComboCounter} from './combo-counter.js';
import {createAttackCallout,createDisplayedHp} from './attack-callout.js';
import {createDynamicScore} from './music23.js';
import {createProjectileDirector} from './projectiles.js';
import {createChoreographyDirector} from './choreography21.js';
import {PvPNetworkConsole,networkConsoleHTML} from './network.js';
import {resultPanelHTML,renderResult} from './phase15-results.js';
import {RELEASE_LABEL} from './release.js';
import {createDamageNumbers} from './fx-damage.js';
// Paket 29: dövüş HUD'u (maç girişi, büyük kombo sayacı, süper bar, anons yazıları).
import {createFightHud} from './fight-hud.js';
import {createFightMotion} from './fight-motion.js';
import {createParticleLayer} from './fx-particles.js';
import {createLowHpFeedback} from './lowhp.js';
// Tur sistemi arayüzü (docs/TUR-SISTEMI.md §10). Klasik maçta gizli kalır.
import {createRoundsUi,renderRoundsResult,roundInputLock,isRoundMatch} from './rounds-ui.js';
import {createMatchInfo} from './match-info.js'; // görev I2: SEN rozeti, yazılan kelime şeritleri, classic sayacı
// Arena modu arayüzü (docs/ARENA-MODU.md §8.2) ve tüm modlarda ortak üst yazma paneli.
import {createArenaUi,renderArenaResult,arenaInputLock,arenaTarget,arenaCombatActions,isArenaMatch,looksScrambled} from './arena-ui.js';
import {ttModeLabel,ttUpcoming,ttExchange,ttNotice,ttHint} from './typing-top-model.js';
// Yetenek çubuğu (Q/E/S/R) — pasif HUD kartları, pvp/skillbar.css.
import {skillCardHTML,applySkillRow,applySkillPreview} from './skillbar.js';
import {attachResolveUi} from './resolve-ui.js';
import {attachHowto,howtoButtonHTML} from './howto.js';
import {attachCinematic} from './cinematic.js';
import {attachStageFocus} from './stage-focus.js';

// Animasyon test düğmeleri yalnızca ?debug=1 ile görünür.
const DEBUG_TOOLS = typeof location!=='undefined' && new URLSearchParams(location.search).get('debug')==='1';

/**
 * PvP package 09: server-validated skills, damage, shield and animation events.
 */
const store = createPvPStore();
// Çift yazı önleme: PARRY / PERFECT / COUNTER / KALKAN KIRIK artık fx-damage.js'in
// piksel etiketleriyle tek yerde gösteriliyor. Bant yalnızca piksel katmanı yoksa çıkar.
function pvp13Banner(seat,text,kind){
  if(!root||reducedEffects||fx24.damage)return;
  const stage=root.querySelector(`.pvp2-side[data-seat="${seat}"] .pvp2-stage`);
  if(!stage)return;
  const el=document.createElement('div');el.className=`pvp13-banner pvp13-${kind}`;el.textContent=text;
  stage.querySelectorAll('.pvp13-banner').forEach(x=>x.remove());stage.appendChild(el);
  setTimeout(()=>el.remove(),870);
}

const root = document.getElementById('pvp-root');
const network = new PvPNetworkConsole(root);
// Arena odağı: saldırı sırasında yazma paneli katlanır, arena ekranı doldurur.
attachStageFocus({root,isReduced:()=>reducedEffects||Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)});
// Sıralı saldırı göstergesi (U3): "SALDIRI SIRASI 3/8", saldıran/SİPER vurgusu, pencere özeti.
// Geçiş sesleri (attack-turn) oyuncunun SFX ayarına uyar; pvpAudio satır sonunda tanımlanır, çağrı anında hazırdır.
attachResolveUi({root,getSeat:()=>network.seat,isReduced:()=>reducedEffects||Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches),
  sfx:(name,gain)=>pvpAudio.play(name,{character:'center',gain})});
// Nasıl oynanır paneli (U5): ? düğmesi, sekmeli rehber, Esc yalnız paneli kapatır.
attachHowto({root});
// Dövüş oyunu tarzı sinematik geçişler (VS girişi, raund bantları, tur arası sıralaması).
attachCinematic({root,isReduced:()=>reducedEffects||Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches),
  // Sinematik sesleri oyuncunun SFX ayarına (sessiz/düzey) uyar; ortadan çalar.
  sfx:(name,gain)=>pvpAudio.play(name,{character:'center',gain})});
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const texts = [
  'Güçlü savaşçı, her doğru kelimeyle yeni bir güç kazanır. Cesaret, hız ve dikkat aynı arenada buluşur.',
  'Rünler ışıldarken kalkanın gücü artar. Doğru kelimeler, savaşın ritmini ve enerjisini belirler.',
  'Şatoda yankılanan adımlar düellonun başladığını haber verir. Hızlı düşün, dikkatli yaz ve ilerle.'
];
const players = {
  fire: {id:'fire',name:'Alev Celladı',player:'OYUNCU 1',style:'fire',role:'Kılıç · Alev · Saldırı',image:'./assets/arena-king.webp',textIndex:0,typed:'',startedAt:null,errors:0,pending:false,pendingIndex:null},
  rune: {id:'rune',name:'Rün Muhafızı',player:'OYUNCU 2',style:'rune',role:'Rün · Kalkan · Savunma',image:'./assets/rune-preview.webp',textIndex:1,typed:'',startedAt:null,errors:0,pending:false,pendingIndex:null}
};
const fxDirectors=Object.create(null);
const choreographers=Object.create(null);
const pvpAudio=createPvPAudio();
const pvpMusic=createDynamicScore();
// Müziği sayfa ve resimler yüklendikten sonra, tarayıcı boştayken indir (yavaş bağlantıda arena önce gelsin).
let musicPreloadQueued=false;
function deferMusicPreload(){
  if(musicPreloadQueued)return;musicPreloadQueued=true;
  const run=()=>{const idle=window.requestIdleCallback;idle?idle(()=>void pvpMusic.preload(),{timeout:8000}):setTimeout(()=>void pvpMusic.preload(),3000);};
  if(document.readyState==='complete')setTimeout(run,1500);else window.addEventListener('load',()=>setTimeout(run,1500),{once:true});
}
pvpAudio.setOnPlay(()=>pvpMusic.duck());
let lastMusicScene=null;
let projectiles=null;
// Paket 24 görsel katmanları: piksel hasar sayıları, dövüş hareketi, canvas parçacıkları.
// Hepsi yalnızca sunucu (veya antrenman motoru) olaylarını gösterir; HP'ye dokunmaz.
const fx24={damage:null,motion:null,particles:null,lowHp:null,hud:null,matchId:null};
const fx24Reduced=()=>reducedEffects||Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
function fx24Create(){
  fx24Destroy();
  fx24.damage=createDamageNumbers({root,isReduced:fx24Reduced});
  fx24.motion=createFightMotion({root,isReduced:fx24Reduced});
  fx24.particles=createParticleLayer({root,isReduced:fx24Reduced});
  fx24.lowHp=createLowHpFeedback({root,isReduced:fx24Reduced,heartbeat:k=>pvpAudio.heartbeat(k)});
  fx24.hud=createFightHud({root,isReduced:fx24Reduced,getArenaApi:()=>arena3d.instance?.api});
  // Görev 4: kombo sayacı, saldırı bilgi yazısı (+ durum rozeti) ve gösterilen can (temas karesine kadar bekletilir).
  fx24.combo=createComboCounter({root,isReduced:fx24Reduced});
  fx24.callout=createAttackCallout({root,isReduced:fx24Reduced,getFighterId:fighterOfSeat});
  fx24.shownHp=createDisplayedHp({root,getPlayers:()=>network.match?.players||[],
    isBusy:()=>Boolean(arena3d.instance?.visualQueue?.isBusy?.())});
}
function fx24Clear(){fx24.shownHp?.model?.release();fx24.shownHp?.sync?.();fx24.hud?.clear();fx24.damage?.clear();fx24.motion?.clear();fx24.particles?.clear();fx24.lowHp?.update(1,false);}
function fx24Destroy(){fx24.combo?.destroy();fx24.callout?.destroy();fx24.shownHp?.destroy();fx24.combo=fx24.callout=fx24.shownHp=null;fx24.hud?.destroy();fx24.hud=null;fx24.damage?.destroy();fx24.motion?.destroy();fx24.particles?.destroy();fx24.lowHp?.destroy();fx24.damage=fx24.motion=fx24.particles=fx24.lowHp=null;fx24.matchId=null;}

// Paket 26: three.js 3B arena. PvP açılınca tembel yüklenir (three.js ~670 KB).
// WebGL yoksa, modül yüklenemezse ya da oyuncu kapattıysa bugünkü CSS arena aynen kalır.
// Adres çubuğu: ?arena=2d zorla kapatır, ?arena=3d zorla açar. Tercih localStorage'da tutulur.
const ARENA3D_PREF_KEY='tuslab-pvp-arena3d';
const arena3d={instance:null,token:0};
function arena3dWanted(){
  const forced=new URLSearchParams(location.search).get('arena');
  if(forced==='2d')return false;
  if(forced==='3d')return true;
  try{return localStorage.getItem(ARENA3D_PREF_KEY)!=='off';}catch{return true;}
}
function arena3dSetPref(on){try{localStorage.setItem(ARENA3D_PREF_KEY,on?'on':'off');}catch{/* gizli pencere: tercih bu oturumla sınırlı */}}
function arena3dButtonSync(){
  const button=root?.querySelector('[data-pvp-action="arena3d"]');
  if(!button)return;
  const on=Boolean(arena3d.instance);
  button.setAttribute('aria-pressed',String(on));
  button.textContent=on?'◈ 3B arenayı kapat':'◈ 3B arenayı aç';
}
async function arena3dCreate(){
  arena3dDestroy();
  const token=arena3d.token;
  if(!root||!arena3dWanted()){arena3dButtonSync();return;}
  // Maça girişte eski/2B karakter parlaması olmasın: Meshy modelleri gelene dek 2B rig gizli, "yükleniyor" göstergesi açık
  // (arena3d.css). 3B açılamazsa (catch) sınıf kalkar ve bugünkü CSS arena aynen görünür.
  root.classList.add('pvp-models-pending');
  try{
    const [{createArena3D},{createArena3DFx},{createArena3DHpBars},{createArena3DAssist}]=await Promise.all([import('./arena3d.js'),import('./arena3d-fx.js'),import('./arena3d-hpbars.js'),import('./arena3d-assist.js')]);
    if(token!==arena3d.token||root.hidden)return;
    const instance=await createArena3D({root,isReduced:fx24Reduced,onImpact:playImpactFeedback});
    if(!instance){arena3dButtonSync();return;}
    if(token!==arena3d.token||root.hidden){instance.destroy();return;}
    instance.registerPlugin(createArena3DFx(instance.api));
    instance.registerPlugin(createArena3DHpBars(instance.api));
    instance.registerPlugin(createArena3DAssist(instance.api)); // paket 31: partner desteği silueti
    arena3d.instance=instance;
    lastFighterKey='';arena3dSyncFighters(); // paket 32: yalnız seçili iki karakterin modeli tembel yüklenir
    arena3dSyncStage();
    // Hata ayıklama tutamacı: yalnız yerel geliştirmede (localhost) + ?fighter1/2 ile. Yalnız kozmetik katmana
    // erişir (sunucuya/oyun durumuna yol yok); yayında hiç oluşmaz.
    if(/[?&]fighter[12]=/.test(location.search)&&/^(localhost|127\.0\.0\.1)$/.test(location.hostname))window.__tuslabArena3d=instance;
    syncHitFeel();
    fx24.motion?.clear();fx24.particles?.clear();
  }catch(error){
    console.warn('3B arena başlatılamadı; CSS arena kullanılıyor.',error);
    if(token===arena3d.token)root?.classList.remove('pvp-models-pending');
  }
  if(!arena3d.instance)root?.classList.remove('pvp-models-pending'); // 3B yok → 2B arena (bilinçli yedek) görünür
  arena3dButtonSync();
}
// Paket 32: koltuk → karakter (match.players[].fighter; yoksa arketipin varsayılanı). Yalnız görsel/ses içindir.
// Hata ayıklama: ?fighter1=sira&fighter2=nyx (yalnız bilinen kimlikler kabul edilir; oyun durumunu değiştirmez).
function fighterOfSeat(seat){
  const p=(network.match?.players||[]).find(x=>x?.seat===seat);
  const side=p?.character==='fire'||p?.character==='rune'?p.character:(seat===2?'rune':'fire');
  // URL zorlaması yalnız o koltuğun arketipiyle uyuşuyorsa geçerli: HUD/ses etiketi (match.players[].fighter) ile 3B model hep aynı karakter olur.
  // (Bot antrenmanında fighter2 artık oturuma da verilir; bkz. network.js botFighterFromUrl.)
  const forced=new URLSearchParams(location.search).get(`fighter${seat}`);
  if(isFighterId(forced)&&(!p||FIGHTERS[forced].archetype===side))return forced;
  return normalizeFighter(p?.fighter,side);
}
let lastFighterKey='';
function arena3dSyncFighters(){
  const map={1:fighterOfSeat(1),2:fighterOfSeat(2)};
  const key=`${map[1]}|${map[2]}`;
  if(network.match&&key!==lastFighterKey){lastFighterKey=key;pvpAudio.preloadFighters?.([map[1],map[2]]);void pvpAudio.preloadVoices?.([map[1],map[2]]);}
  if(!arena3d.instance?.setFighters)return;
  const token=arena3d.token,job=arena3d.instance.setFighters(map); // aynı seçim → yeniden yüklemez
  if(key===pendingKey)return;
  // Model değişti: Meshy GLB gelene dek 2B rig/düzlem silueti görünmez (arena3d.css "yükleniyor" göstergesi); bitince (ya da hata verince yedek) kalkar.
  pendingKey=key;root?.classList.add('pvp-models-pending');
  Promise.resolve(job).catch(()=>false).then(()=>{if(token===arena3d.token&&pendingKey===key)root?.classList.remove('pvp-models-pending');});
}
let pendingKey='';
function arena3dSyncStage(){
  const forced=/^(localhost|127\.0\.0\.1)$/.test(location.hostname)?new URLSearchParams(location.search).get('stage'):null;
  arena3d.instance?.setStage?.(forced||network.match?.stage);
}
/** Karaktere özel ses (dosya yoksa sound.js arketip sesine düşer). */
const FIGHTER_GAIN={'vargr-e':1.2,'doran-q':1.2,'doran-e':1.2};
function playFighterSfx(seat,key,gain=1){
  if(typeof pvpAudio.playFighter!=='function')return false;
  const fid=fighterOfSeat(seat);
  return pvpAudio.playFighter(fid,key,{character:seat===2?'rune':'fire',gain:gain*(FIGHTER_GAIN[`${fid}-${key}`]||1)});
}
/** Görev S: karakter repliği / spiker / seyirci yardımcıları (hepsi tek replik kanalından geçer, sessiz modda no-op). */
function speakSeat(seat,key,opts){return (seat===1||seat===2)&&pvpAudio.speak?.(fighterOfSeat(seat),key,opts);}
let lastRoundVoice='';
function roundVoice(){
  const m=network.match,r=m?.round;if(!r)return;
  const tag=`${m.matchId}:${r.index}`;if(tag===lastRoundVoice)return;lastRoundVoice=tag;
  const total=Number(r.total)||0;
  pvpAudio.announce?.(r.index===1?'spiker-raund1':total&&r.index>=total?'spiker-son-raund':'spiker-yeni-raund',{priority:2,ttlMs:2500});
  if(r.index===1)pvpAudio.announce?.('spiker-savas',{priority:2,ttlMs:3000});
}
let crowdOn=null;
function syncCrowd(scene){
  const on=['combat','tension','ultimate','prep'].includes(scene);
  if(on===crowdOn)return;crowdOn=on;
  if(on)pvpAudio.startCrowd?.();else pvpAudio.stopCrowd?.();
}
// Sahnenin cast anı (arena3d playModelSkill) → karakterin kendi sesiyle skill adı.
root?.addEventListener('tuslab:pvp-cast',event=>{const d=event.detail||{};if(['q','e','r'].includes(d.skill))speakSeat(d.seat,d.skill,{priority:3,ttlMs:1200});});
// Kombo vuruşunun temas karesi → seri anonsu ("2 KOMBO" …) + jingle + kalabalık.
root?.addEventListener('tuslab:pvp-strike',event=>{
  const n=Math.min(6,(Number(event.detail?.index)||0)+1);if(n<2)return;
  pvpAudio.announce?.(`seri-${n}`,{priority:2,ttlMs:900});
  pvpAudio.playExtra?.(`jingle-${n}`,{gain:.22});
  if(n>=3)pvpAudio.cheer?.(.3);
});
function arena3dDestroy(){
  arena3d.token++;pendingKey='';root?.classList.remove('pvp-models-pending');
  arena3d.instance?.destroy();
  arena3d.instance=null;
}
/** Paket 32: beceri sesi (q/e/r) karaktere özel çalar; diğer işaretler arketip sesinde kalır. */
function fighterSkillCue(side,cue,action){
  const name=soundForCue(side,cue,action);
  if(!name||!/-(q|e|r)$/.test(name)||!['q','e','r'].includes(action))return false;
  if(arena3d.instance)return true; // 3D contact plays this sample alongside the hit.
  return playFighterSfx(side==='rune'?2:1,action,action==='r'?.88:1);
}
let reducedEffects=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false;
// Tur HUD'u: .pvp2-announce satırına yerleşir; süreler network.serverNow() (saat eşitlemesi) ile sayılır.
let roundsUi=null;
function roundsUiCreate(){
  roundsUi?.destroy();roundsUi=null;
  const host=root?.querySelector('.pvp2-announce');if(!host)return;
  roundsUi=createRoundsUi(host,{now:()=>network.serverNow(),isReduced:fx24Reduced,send:(type,payload)=>network.send(type,payload),
    holdTransition:()=>arena3d.instance?.visualQueue?.whenIdle(3000),onLockChange:()=>{textUpdate('fire');textUpdate('rune');}});
  roundsUi.update(network.match,network.myId);
}
// Arena HUD'u .pvp2-announce satırına, hazırlık kartları ve D/Y şeridi üst yazma paneline yerleşir.
let arenaUi=null;
function arenaUiCreate(){
  arenaUi?.destroy();arenaUi=null;
  const hud=root?.querySelector('.pvp2-announce'),stage=root?.querySelector('[data-tt-arena]'),overlay=root?.querySelector('.pvp2-shell');
  if(!hud||!stage)return;
  arenaUi=createArenaUi({hudHost:hud,stageHost:stage,overlayHost:overlay,now:()=>network.serverNow(),isReduced:fx24Reduced,
    holdTransition:()=>arena3d.instance?.visualQueue?.whenIdle(3000),
    send:(type,payload)=>{if(type==='ARENA_PICK')network.sendArenaPick(payload?.skill,payload?.item);},
    onLockChange:()=>{textUpdate('fire');textUpdate('rune');}});
  arenaUi.update(network.match,network.myId);
}
// Görev I2: SEN rozeti + her oyuncunun yazdığı kelimeler (kendi can barının altında) + süre/raund tutamaçları.
let matchInfo=null;
function matchInfoCreate(){
  matchInfo?.destroy();matchInfo=null;
  if(!root)return;
  matchInfo=createMatchInfo(root,{now:()=>network.serverNow(),getTyped:seat=>players[seat===2?'rune':'fire']?.typed||''});
  matchInfo.update(network.match,network.myId);
}
/** Bu tarayıcının yazdığı taraf: maçta koltuk, maç öncesi seçili savaşçı. */
const myKey=()=>network.seat===2?'rune':network.seat===1?'fire':(network.character==='rune'?'rune':'fire');
/** Mod bağımsız giriş kilidi (tur: sunucu saati; arena: faz + kişisel süre). */
function inputLock(match){
  if(isArenaMatch(match))return arenaInputLock(match,network.myId,network.serverNow(),arenaUi?.personalEnd());
  return roundInputLock(match,network.myId,network.serverNow());
}
/** Canlı maçta yazılacak hedef. Arena'da kelime kişisel anlık görüntüden gelir (Harf Kaosu'nda karışık hali). */
function liveTarget(match,serverPlayer,own){
  if(isArenaMatch(match))return own?(arenaTarget(match,network.myId)||'✓'):'…';
  return serverPlayer?.currentWord||(isRoundMatch(match)?'✓':null);
}
function progressOf(match,pl,peer){
  if(!pl)return null;
  if(isArenaMatch(match)||isRoundMatch(match)){
    if(match.round?.style==='timed')return {text:`${Number(pl.roundWordIndex)||0} kelime`,frac:Math.min(1,(Number(pl.roundWordIndex)||0)/30)};
    const n=Array.isArray(match.round?.words)&&match.round.words.length?match.round.words.length:10;
    const i=Math.min(n,Number(pl.roundWordIndex)||0);
    return {text:`${i}/${n} kelime`,frac:i/n};
  }
  const lead=Math.max(1,Number(pl.correctWords)||0,Number(peer?.correctWords)||0);
  return {text:`${pl.correctWords??0} doğru`,frac:(Number(pl.correctWords)||0)/lead};
}
/** Ortak üst yazma paneli (Ajan F, 2. dalga): mod/faz etiketi · büyük hedef kelime + sıradaki kelimeler ·
 *  giriş · tek yardım satırı (kilit / Harf Kaosu / ipucu) · sen ve rakip ilerlemesi · değiş tokuş geri sayımı. */
let ttXchgTimer=0;
function ttXchgSync(){
  ttXchgTimer=0;
  const top=root?.querySelector('[data-typetop]');const box=top?.querySelector('[data-tt-xchg]');if(!box)return null;
  const x=root.hidden?null:ttExchange(network.match,network.serverNow());
  if(box.hidden!==!x)box.hidden=!x;
  if(!x)return null;
  if(box.dataset.phase!==x.phase)box.dataset.phase=x.phase;
  const text=box.querySelector('[data-tt-xchg-text]');if(text&&text.textContent!==x.text)text.textContent=x.text;
  const bar=box.querySelector('[data-tt-xchg-bar]');const s=`scaleX(${x.frac.toFixed(3)})`;if(bar&&bar.style.transform!==s)bar.style.transform=s;
  if(x.phase==='typing'&&x.secs>0)ttXchgTimer=setTimeout(ttXchgSync,250);
  return x;
}
function typeTopRender(id,{live,own,serverPlayer,target,typed,result,markup,disabled,status,label}){
  const top=root?.querySelector('[data-typetop]');if(!top)return;
  const match=network.match;
  clearTimeout(ttXchgTimer);const xchg=ttXchgSync();
  const resolving=Boolean(live&&own&&xchg?.phase==='resolve');
  const locked=Boolean(disabled||resolving);
  const scrambled=Boolean(live&&isArenaMatch(match)&&looksScrambled(match.round.words));
  const input=top.querySelector('[data-tt-input]');
  if(input){
    if(input.dataset.input!==id)input.dataset.input=id;
    if(input.disabled!==locked){
      input.disabled=locked;
      // Kilit açılınca odak <body>'de kaldıysa girişe geri dön (pencere/raund arası tıklama gerekmesin).
      const lost=!document.activeElement||document.activeElement===document.body;
      if(!locked&&live&&own&&lost&&!root.hidden)focusTypingWhenReady();
    }
    if(input.value!==typed)input.value=typed;
    if(input.placeholder)input.placeholder='';
  }
  const reset=top.querySelector('[data-tt-reset]');if(reset){reset.dataset.target=id;reset.hidden=Boolean(live);}
  const put=(sel,text)=>{const el=top.querySelector(sel);if(el&&el.textContent!==text)el.textContent=text;};
  put('[data-tt-mode]',ttModeLabel(live?match:null));
  const contentHint=live&&own?ttHint(match,match.players.find(x=>x.playerId===network.myId)):''; // şiir: şair adı · Osmanlıca: anlam ipucu
  put('[data-tt-label]',live?(own?`Senin kelimen${contentHint?` · ${contentHint}`:''}`:'Rakip yazıyor'):'Örnek metin');
  const notice=ttNotice({live,own,disabled,pending:Boolean(players[id]?.pending),scrambled,exchange:xchg,status});
  const statusEl=top.querySelector('[data-tt-status]');
  if(statusEl){if(statusEl.textContent!==notice.text)statusEl.textContent=notice.text;if(statusEl.dataset.kind!==notice.kind)statusEl.dataset.kind=notice.kind;}
  const targetEl=top.querySelector('[data-tt-target]');
  if(targetEl){
    const shown=live&&(target==='✓'||target==='…')?`<span class="tt-done">${target==='✓'?'✓':'…'}</span>`:markup;
    if(targetEl.innerHTML!==shown)targetEl.innerHTML=shown;
    targetEl.classList.toggle('is-sentence',!live);
    targetEl.classList.toggle('is-scrambled',scrambled);
    targetEl.setAttribute('aria-label',live?`Yazılacak kelime: ${target}`:'Yazılacak örnek metin');
    // Yeni kelime: tek seferlik 150 ms giriş (yalnız transform/opacity); azaltılmış harekette yok.
    const word=live?String(target):'';
    if(targetEl.dataset.word!==word){
      const fresh=Boolean(targetEl.dataset.word)&&word&&word!=='✓'&&word!=='…';
      targetEl.dataset.word=word;
      if(fresh&&!fx24Reduced())targetEl.animate?.([{opacity:.35,transform:'translateY(6px)'},{opacity:1,transform:'none'}],{duration:150,easing:'cubic-bezier(.16,1,.3,1)'});
    }
  }
  const peer=live?match.players.find(x=>x.playerId!==network.myId):null;
  const me=live?match.players.find(x=>x.playerId===network.myId):null;
  const nextEl=top.querySelector('[data-tt-next]');
  if(nextEl){
    const words=live&&own&&!locked?ttUpcoming(match,me):[];
    const html=words.map(w=>`<span>${escapeHTML(w)}</span>`).join('');
    if(nextEl.innerHTML!==html)nextEl.innerHTML=html;
    if(nextEl.hidden!==!words.length)nextEl.hidden=!words.length;
  }
  const meProg=live&&own?progressOf(match,me,peer):null,oppProg=live?progressOf(match,peer,me):null;
  put('[data-tt-me]',meProg?`${meProg.text} · %${me.accuracy??100} · ${me.wpm??0} WPM`:`${result.count}/${result.total} karakter · ${result.accuracy===null?'doğruluk —':'%'+result.accuracy} · ${result.wpm} WPM`);
  put('[data-tt-opp-name]',peer?String(peer.name||'Rakip'):'Rakip');
  put('[data-tt-opp]',oppProg?`${oppProg.text}${peer.roundDone?' · bitirdi ✓':''}`:'maç başlayınca');
  const bar=(sel,frac)=>{const el=top.querySelector(sel);if(el){const s=`scaleX(${Math.max(0,Math.min(1,frac||0)).toFixed(3)})`;if(el.style.transform!==s)el.style.transform=s;}};
  bar('[data-tt-bar-me]',meProg?meProg.frac:result.percent);bar('[data-tt-bar-opp]',oppProg?oppProg.frac:0);
  top.classList.toggle('is-locked',Boolean(live&&locked));
}
/** RAUND SONRASI: panel arenanın altına taşınır (yerleşim), geçiş FLIP ile transform:translateY olarak oynar. */
function typeTopMove(apply){
  const top=root?.querySelector('[data-typetop]');
  const before=top?.getBoundingClientRect().top;
  apply();
  if(!top||before===undefined||fx24Reduced())return;
  const dy=before-top.getBoundingClientRect().top;
  if(Math.abs(dy)<4)return;
  top.style.transition='none';top.style.transform=`translateY(${dy}px)`;
  void top.getBoundingClientRect();
  top.style.transition='';top.style.transform='';
}
/** Kök öznitelikleri: mod + arena fazı (CSS sadeleştirmesi ve panel inişi bunlara bağlı). */
function arenaLayoutSync(){
  if(!root||root.hidden)return;
  const m=network.match;const running=['running','paused'].includes(m?.status);
  const arena=isArenaMatch(m)&&running;
  const mode=arena?'arena':running&&isRoundMatch(m)?'rounds':running?'classic':'idle';
  if(root.dataset.pvpMode!==mode)root.dataset.pvpMode=mode;
  topbarModeSync(mode);
  const phase=arena?m.round.phase:'';
  if((root.dataset.arenaPhase||'')!==phase){
    typeTopMove(()=>{if(phase)root.dataset.arenaPhase=phase;else delete root.dataset.arenaPhase;});
  }
  const surrender=root.querySelector('[data-pvp15-action="surrender"]');if(surrender&&surrender.hidden!==!running)surrender.hidden=!running;
}
const controllers=Object.fromEntries(['fire','rune'].map(id=>[id,createCharacterController({id,onCue:({cue,action})=>{fxDirectors[id]?.play({cue,action});choreographers[id]?.onCue({cue,action});if(!fighterSkillCue(id,cue,action))pvpAudio.playCue(id,cue,action);},onChange:({state,action})=>{
  const stage=root?.querySelector(`.pvp2-side[data-player="${id}"] .pvp2-stage`);
  if(!stage)return;
  choreographers[id]?.onMotion({state,action});
  const rig=stage.querySelector('[data-rig]');
  if(rig)rig.dataset.motion=state;
  const status=stage.querySelector('[data-motion-label]');
  if(status)status.textContent=MOTION_NAMES[state]||state;
  stage.querySelectorAll('[data-demo-action]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.demoAction===action && state!=='idle' && state!=='recovery')));
}})]));

function ability(kind,key,label,threshold) {
  return skillCardHTML(kind,key,label,threshold);
}
// Canlı maçta yetenek kartları her sunucu anlık görüntüsünde güncellenir (tur modunda 3/5/7, klasikte 2/4/5).
function skillRowSync(){
  const m=network.match;
  if(!root||!['running','paused'].includes(m?.status))return;
  const rounds=isRoundMatch(m),now=network.serverNow(),reduced=fx24Reduced();
  for(const [id,seat] of [['fire',1],['rune',2]])
    applySkillRow(root.querySelector(`[data-player="${id}"]`),{player:m.players?.find(x=>x.seat===seat),rounds,now,reduced});
}
root?.addEventListener('tuslab:pvp-match',skillRowSync);
/** Paket 33: 3B tuval veya 2B sahneyle yalnız aktif maçta tam ekran HUD. */
function fullscreenLayoutSync(){
  if(!root)return;
  const running=['running','paused'].includes(network.match?.status);
  const arena=root.querySelector('.pvp2-duel .pvp2-stage');
  if(!root.hidden&&running&&arena)root.dataset.layout='fullscreen';
  else delete root.dataset.layout;
}
root?.addEventListener('tuslab:pvp-match',fullscreenLayoutSync);
function playerHTML(p){
  const isFire=p.id==='fire';
  return `<section class="pvp2-side pvp2-${p.style}" aria-label="${p.player} — ${p.name}" data-player="${p.id}" data-seat="${isFire?1:2}">
    <div class="pvp2-player-top"><span class="pvp2-player-mark" aria-hidden="true">${isFire?'✦':'◆'}</span><span class="pvp2-identity"><small>${p.player} · ${isFire?'KIZIL TARAF':'MAVİ TARAF'}</small><strong data-server-player-name>Oyuncu bekleniyor</strong><span class="pvp2-character-name">${p.name}</span></span><span class="pvp2-player-end"><span class="pvp2-hero-tag">${isFire?'ATEŞ':'RÜN'}</span><span class="pvp2-connection" data-player-connection data-quality="unknown"><i aria-hidden="true"></i><span>Bekleniyor</span></span></span></div>
    <div class="pvp2-health" data-low="false"><div class="pvp2-health-meta"><span><span class="pvp2-heart" aria-hidden="true">♥</span> CAN PUANI <em data-server-shield hidden>· KALKAN AKTİF</em></span><strong data-server-hp>Maç bekleniyor</strong></div><div class="pvp2-health-track" data-server-hp-track role="progressbar" aria-label="${p.name} can puanı" aria-valuetext="Maç bekleniyor" aria-valuenow="0" aria-valuemin="0" aria-valuemax="1"><span class="pvp2-health-trail" data-server-hp-trail aria-hidden="true"></span><span class="pvp2-health-fill" data-server-hp-fill aria-hidden="true"></span><span class="pvp2-health-shield" data-server-shield-layer aria-hidden="true"></span><span class="pvp2-health-segments" aria-hidden="true"></span></div></div>
    <div class="pvp2-stage" aria-label="${p.name} karakter görseli"><span class="pvp2-rune-ring pvp2-ring-one"></span><span class="pvp2-rune-ring pvp2-ring-two"></span><span class="pvp2-stage-ember"></span><span class="pvp2-floor"></span>${rigMarkup(p.id)}<div class="pvp3-vfx" aria-hidden="true"><span class="pvp3-slash"></span><span class="pvp3-shock"></span><span class="pvp3-ward"></span><span class="pvp3-flare"></span><span class="pvp3-spark"></span></div><div class="pvp4-effects" aria-hidden="true"></div><div class="pvp21-layer" aria-hidden="true"></div><div class="pvp4-cue-label" data-fx-label aria-hidden="true"></div><div class="pvp3-motion-label" data-motion-label="${p.id}">Bekleme</div>${DEBUG_TOOLS?`<div class="pvp3-stage-tests" aria-label="Karakter animasyon testleri"><span>TEST</span><button type="button" class="pvp3-mini" data-demo-action="hit" data-target="${p.id}" title="Karakter hasar tepkisi">Darbe</button><button type="button" class="pvp3-mini" data-demo-action="victory" data-target="${p.id}">Zafer</button><button type="button" class="pvp3-mini" data-demo-action="defeat" data-target="${p.id}">Yenilgi</button><button type="button" class="pvp3-mini" data-demo-action="idle" data-target="${p.id}">↺</button><button type="button" class="pvp3-mini pvp4-demo-combo" data-demo-combo="${p.id}" title="Q E R kombosunu sırayla göster">Q→E→R</button></div>`:''}<div class="pvp2-role">${p.role}</div></div>
    <div class="pvp22-passive" data-pvp22-passive>Rün: klasik · pasif kapalı</div><div class="pvp13-defense" data-server-defense>🛡 BLOK 0 · ✦ PERFECT 0 · ⚔ PARRY 0 · ↯ COUNTER 0</div><div class="pvp7-combo" data-server-combo>Henüz maç yok</div><div class="pvp8-score" data-server-score>Sunucu istatistiği bekleniyor</div><div class="pvp2-skillrow" aria-label="Yetenek göstergeleri (maçtan önce önizleme)">
      ${ability(p.id,'Q',isFire?'Alev Kesişi':'Rün Kesişi',2)}
      ${ability(p.id,'E',isFire?'Yer Yaran Darbe':'Sarsıcı Darbe',4)}
      ${ability(p.id,'S',isFire?'Kor Kalkanı':'Mavi Mühür',0)}
      ${ability(p.id,'R',isFire?'Kızıl Fırtına':'Sonsuz Mühür',5)}
    </div>
    <div class="pvp2-typebox">
      <div class="pvp2-typeheader"><span><span class="pvp2-type-dot"></span> <span data-type-label>YEREL YAZMA TESTİ</span></span><button type="button" class="pvp2-reset" data-pvp-action="reset" data-target="${p.id}" title="Test metnini sıfırla">↻ Sıfırla</button></div>
      <div class="pvp2-sample" data-sample="${p.id}" aria-label="Yazılacak örnek metin">${escapeHTML(texts[p.textIndex])}</div>
      <textarea class="pvp2-input" data-input="${p.id}" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off" rows="1" placeholder="Yazmaya başla..." aria-label="${p.player} yerel yazma testi"></textarea>
      <div class="pvp2-typing-bottom"><div class="pvp2-typing-progress"><span data-progress="${p.id}"></span></div><span data-counter="${p.id}">0 / ${texts[p.textIndex].length} karakter</span><span data-accuracy="${p.id}">Doğruluk —</span><span data-wpm="${p.id}">0 WPM</span></div>
    </div>
  </section>`;
}
// Ağ konsolundaki durum alanları tek merkez grubunda gösterilir; özgün veri öznitelikleri korunur.
function topbarModeSync(mode){
  const label=root?.querySelector('.pvp-topbar-start .pvp2-brand small');
  const next=({arena:'Raund Arena',rounds:'Zamana Karşı',classic:'Klasik Maç',idle:'PvP Arena'})[mode];
  if(label&&label.textContent!==next)label.textContent=next;
}
function topbarArrangeStatus(){
  const group=root?.querySelector('.pvp-topbar-center .pvp-status-group');
  if(!group)return;
  for(const selector of ['[data-net-status]','[data-practice-chip]']){
    const badge=root.querySelector(selector);
    if(badge)group.append(badge);
  }
}
function screen(){
  return `<main class="pvp2-shell" aria-label="PvP Ruh Düellosu ikiye bölünmüş arena önizlemesi">
   <header class="pvp2-toolbar"><div class="pvp-topbar-start"><div class="pvp2-brand"><span class="pvp2-brand-logo" aria-hidden="true">⚔</span><div><strong>TUŞLAB <em>· RUH DÜELLOSU</em></strong><small>PvP Arena · ${RELEASE_LABEL}</small></div></div>${networkConsoleHTML()}</div><div class="pvp-topbar-center"><div class="pvp-status-group" role="status" aria-label="Maç ve bağlantı durumu"><span class="pvp2-network" data-match-status>⚔ MAÇ BEKLENİYOR</span><span class="pvp12-ping" data-pvp12-ping data-quality="unknown">◌ Ping ölçülüyor</span></div><span class="pvp-topbar-clock">Süre <strong data-match-timer>—</strong><span aria-hidden="true">·</span>Sıra <strong data-match-sequence>—</strong></span><span class="pvp12-windup" data-pvp12-windup hidden></span><span class="pvp11-reconnect" data-reconnect-banner role="status" aria-live="polite" hidden></span></div><div class="pvp2-actions">${howtoButtonHTML()}<details class="pvp4-settings" data-pvp-settings><summary class="pvp4-icon-btn" aria-label="Ayarları aç: müzik, ses, efekt, 3B"><span aria-hidden="true">⚙</span><span class="pvp4-tip" aria-hidden="true">Ayarları aç · müzik, ses, efekt, 3B</span></summary><div class="pvp4-aux-buttons pvp4-settings-pop" role="group" aria-label="PvP ayarları"><div class="pvp23-audio" role="group" aria-label="Dinamik PvP müzik kontrolleri"><button type="button" class="pvp4-toggle" data-pvp-action="music" data-pvp23-music-toggle aria-pressed="false">♫ Müziği kapat</button><input type="range" min="0" max="100" step="5" value="20" data-pvp23-music aria-label="Müzik ses seviyesi"/><small data-pvp23-music-label>20%</small></div><div class="pvp10-audio-controls" role="group" aria-label="PvP ses kontrolleri"><button type="button" class="pvp4-toggle pvp10-sound-toggle" data-pvp-action="sound" aria-pressed="false">🔊 Sesi kapat</button><input type="range" class="pvp10-volume" data-pvp-volume aria-label="PvP ses seviyesi" min="0" max="100" step="5" value="55"/><span class="pvp10-volume-label" data-pvp-volume-label>55%</span></div><button type="button" class="pvp4-toggle" data-pvp-action="effects" aria-pressed="false">✧ Efektleri azalt</button><button type="button" class="pvp4-toggle" data-pvp-action="arena3d" aria-pressed="false">◈ 3B arenayı aç</button><button type="button" class="pvp4-toggle" data-pvp-action="fullscreen" aria-pressed="false">⛶ Tam ekran</button><span class="pvp4-perf">GPU dostu · ≤6 parçacık</span></div></details><button type="button" class="pvp15-surrender" data-pvp15-action="surrender" hidden>Teslim ol</button><button type="button" class="pvp2-back" data-pvp-action="close" aria-label="PvP'den çık, Yazma Arenasına dön">← Arenaya dön</button></div></header>
   <div class="pvp2-announce"><span class="pvp2-announce-icon" aria-hidden="true">✦</span><span><strong>RUH DÜELLOSU</strong><span class="pvp2-announce-sep" aria-hidden="true"> · </span>İki savaşçı, tek arena</span></div>
   <section class="tt" data-typetop aria-label="Yazma alanı">
     <div class="tt-arena" data-tt-arena></div>
     <div class="tt-type" data-tt-type>
       <div class="tt-head"><label class="tt-label" for="tt-input"><span class="tt-mode" data-tt-mode>YEREL YAZMA TESTİ</span><span class="tt-label-text" data-tt-label>Örnek metin</span></label><div class="tt-xchg" data-tt-xchg hidden><span class="tt-xchg-text" data-tt-xchg-text></span><span class="tt-xchg-bar" aria-hidden="true"><i data-tt-xchg-bar></i></span></div><button type="button" class="tt-reset" data-pvp-action="reset" data-target="fire" data-tt-reset>↻ Metni sıfırla</button></div>
       <div class="tt-word"><div class="tt-target" data-tt-target></div><div class="tt-next" data-tt-next aria-label="Sıradaki kelimeler" hidden></div></div>
       <input class="tt-input" id="tt-input" type="text" data-input="fire" data-tt-input spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off" enterkeyhint="send" aria-describedby="tt-status" placeholder=""/>
       <p class="tt-status" id="tt-status" data-tt-status role="status" aria-live="polite" data-kind="hint">Yazmaya başla…</p>
       <div class="tt-meta"><div class="tt-who tt-me"><span class="tt-who-line"><b>Sen</b> <span data-tt-me>—</span></span><span class="tt-bar tt-bar-me" aria-hidden="true"><i data-tt-bar-me></i></span></div><div class="tt-who tt-opp"><span class="tt-who-line"><b data-tt-opp-name>Rakip</b> <span data-tt-opp>maç başlayınca</span></span><span class="tt-bar tt-bar-opp" aria-hidden="true"><i data-tt-bar-opp></i></span></div></div>
     </div>
   </section>
   <div class="pvp2-duel" role="group" aria-label="Karşılıklı iki oyuncu alanı">
     ${playerHTML(players.fire)}
     <div class="pvp2-midline" aria-hidden="true"><div class="pvp2-vs"><strong>VS</strong></div></div>
     ${playerHTML(players.rune)}
   </div>
   ${resultPanelHTML()}
   <footer class="pvp2-footer"><span><strong>SİNEMATİK DÖVÜŞ / RUH DÜELLOSU</strong> · 2 doğru Q · 4 doğru E · 5 doğru R · Eşzamanlı doğru kelimelerde %30 S kalkan şansı. Saldırı ve HP sunucudan gelir.</span><span class="pvp2-footer-chip">${RELEASE_LABEL}</span></footer>
  </main>`;
}
function textUpdate(id){
  const p=players[id];if(!p || !root)return;
  const section=root.querySelector(`[data-player="${id}"]`);
  if(!section)return;
  const live=['running','paused'].includes(network.match?.status);
  const serverPlayer=live?network.match.players.find(x=>x.seat===(id==='fire'?1:2)):null;
  const own=serverPlayer&&serverPlayer.playerId===network.myId;
  const roundLock=live&&own?inputLock(network.match):{locked:false,reason:null};
  // Paket 30: maçın yazma kuralları — noktalama kapalıysa hedefte gösterilmez, harf duyarlılığı kapalıysa renklendirme harfi yok sayar.
  const typingRules=normalizeTyping(live?network.match?.typing:null);
  const rawTarget=(live?liveTarget(network.match,serverPlayer,own):null)||texts[p.textIndex];
  const target=typingRules.punctuation?rawTarget:(rawTarget.replace(/\p{P}/gu,'')||rawTarget);
  const sameChar=(a,b)=>typingRules.caseSensitive?a===b:a.toLocaleLowerCase('tr-TR')===b.toLocaleLowerCase('tr-TR');
  const elapsedMs=p.startedAt===null?0:performance.now()-p.startedAt;
  const result=getTypingPreview(target,p.typed,elapsedMs);
  const {typed}=result;
  const input=section.querySelector('.pvp2-input');
  const sample=section.querySelector('.pvp2-sample');
  const disabled=Boolean(live&&(!own||p.pending||network.match?.status==='paused'||network.reconnecting||roundLock.locked));
  const status=live?(network.match?.status==='paused'?'Maç duraklatıldı · yeniden bağlanma bekleniyor':roundLock.locked?roundLock.reason:own?(p.pending?'Sunucu doğruluyor…':'Kelimeyi yaz, Space ile gönder'):'Rakibin kelimesi · izleme modu'):'Yazmaya başla…';
  if(input){
    input.disabled=disabled;
    input.placeholder=status;
    if(input.value!==typed)input.value=typed;
  }
  const labelText=live?(own?(isArenaMatch(network.match)?`ARENA · RAUND ${network.match.round.index} · SENİN KELİMEN`:'CANLI MAÇ · SENİN KELİMEN'):'CANLI MAÇ · RAKİP YAZIYOR'):'YEREL YAZMA TESTİ';
  const label=section.querySelector('[data-type-label]');
  if(label)label.textContent=labelText;
  const reset=section.querySelector('[data-pvp-action="reset"]');if(reset)reset.disabled=Boolean(live);
  // Escape both user input and original text; no user HTML insertion.
  let markup='';
  for(let i=0;i<target.length;i++){
    const letter=escapeHTML(target[i]);
    if(i<typed.length){const ok=sameChar(typed[i],target[i]);markup+=`<span class="${ok?'pvp2-char-good':'pvp2-char-bad'}">${letter}</span>`;}
    else if(i===typed.length)markup+=`<mark class="pvp2-char-next">${letter}</mark>`;
    else markup+=letter;
  }
  sample.innerHTML=markup;
  if(id===myKey())typeTopRender(id,{live,own,serverPlayer,target,typed,result,markup,disabled,status,label:labelText});
  section.querySelector('[data-progress]').style.width=`${(result.percent*100).toFixed(2)}%`;
  section.querySelector('[data-counter]').textContent=`${result.count} / ${result.total} karakter`;
  section.querySelector('[data-accuracy]').textContent=live?`Sunucu %${serverPlayer?.accuracy??100}`:`Doğruluk ${result.accuracy===null?'—':result.accuracy+'%'}`;
  section.querySelector('[data-wpm]').textContent=`${live?(serverPlayer?.wpm??0):result.wpm} WPM`;
  // Yetenek satırı: canlı maçta pasif gösterge (odak dışı), maç dışında animasyon önizleme düğmesi.
  section.querySelectorAll('[data-skill]').forEach(element=>{
    if(element.getAttribute('aria-disabled')!==String(live))element.setAttribute('aria-disabled',String(live));
    element.tabIndex=live?-1:0;
    if(element.hasAttribute('title'))element.removeAttribute('title');
  });
  if(live)skillRowSync();
  else applySkillPreview(section,{chain:result.chain,reduced:fx24Reduced()});
  section.classList.toggle('pvp2-finished',result.finished);
}
function show(open){
  if(!root)return;
  document.body.classList.toggle('pvp-is-open',open);
  root.hidden=!open;
  if(!open){
    if(phase15RevealTimer!==null){clearTimeout(phase15RevealTimer);phase15RevealTimer=null;}
    network.reset();
    for(const ctrl of Object.values(controllers))ctrl.trigger('idle');
    for(const id of ['fire','rune']){fxDirectors[id]?.dispose();delete fxDirectors[id];choreographers[id]?.dispose();delete choreographers[id];}
    roundsUi?.destroy();roundsUi=null;arenaUi?.destroy();arenaUi=null;
    delete root.dataset.layout;delete root.dataset.pvpMode;delete root.dataset.arenaPhase;root.classList.remove('pvp15-results-open');
    projectiles?.dispose();projectiles=null;fx24Destroy();arena3dDestroy();pvpAudio.stop();pvpMusic.stop();lastMusicScene=null;crowdOn=null;
    root.replaceChildren();return;
  }
  root.innerHTML=screen();
  topbarArrangeStatus();
  const loading=document.getElementById('pvp-loading');if(loading)loading.hidden=true;
  network.mount();
  network.updateArena();
  projectiles?.dispose();
  projectiles=createProjectileDirector({root,motionReduced:()=>reducedEffects||Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)});
  // Tuş sesleri hemen; müzik (~1,8 MB) karakter resimleriyle yarışmasın diye boşta yüklenir.
  // İlk tuşta unlock() müziği zaten kendisi indirir; bu yalnız erken ısınma.
  void pvpAudio.preload();deferMusicPreload();pvpMusic.setScene('lobby');
  const audioSettings=pvpAudio.getState();
  if(audioSettings.muted&&!pvpMusic.getState().muted)pvpMusic.setMuted(true); // SESSİZ MOD: tek düğme müziği de keser
  const musicSettings=pvpMusic.getState();
  const musicLevel=root.querySelector('[data-pvp23-music]');if(musicLevel)musicLevel.value=String(Math.round(musicSettings.volume*100));
  const musicLabel=root.querySelector('[data-pvp23-music-label]');if(musicLabel)musicLabel.textContent=Math.round(musicSettings.volume*100)+'%';
  const musicMute=root.querySelector('[data-pvp23-music-toggle]');if(musicMute){musicMute.setAttribute('aria-pressed',String(musicSettings.muted));musicMute.textContent=musicSettings.muted?'♫ Müziği aç':'♫ Müziği kapat';}
  const soundButton=root.querySelector('[data-pvp-action="sound"]');
  if(soundButton){soundButton.setAttribute('aria-pressed',String(audioSettings.muted));soundButton.textContent=audioSettings.muted?'🔇 Sesi aç':'🔊 Sesi kapat';}
  const level=root.querySelector('[data-pvp-volume]');if(level)level.value=String(Math.round(audioSettings.volume*100));
  const levelText=root.querySelector('[data-pvp-volume-label]');if(levelText)levelText.textContent=Math.round(audioSettings.volume*100)+'%';
  root.classList.toggle('pvp4-reduced',reducedEffects);
  fx24Create();
  roundsUiCreate();arenaUiCreate();matchInfoCreate();arenaLayoutSync();fullscreenLayoutSync();fullscreenButtonSync();
  void arena3dCreate();
  for(const id of ['fire','rune']){
    const stage=root.querySelector(`.pvp2-side[data-player="${id}"] .pvp2-stage`);
    fxDirectors[id]=createCombatFxDirector({root:stage,motionReduced:()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false});
    fxDirectors[id].setReduced(reducedEffects);
    choreographers[id]?.dispose();
    choreographers[id]=createChoreographyDirector({stage,id,reduced:()=>reducedEffects||Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)});
  }
  const toggle=root.querySelector('[data-pvp-action="effects"]');
  if(toggle){toggle.setAttribute('aria-pressed',String(reducedEffects));toggle.textContent=reducedEffects?'✧ Efektleri geri aç':'✧ Efektleri azalt';}
  textUpdate('fire');textUpdate('rune');
}
store.subscribe(state=>show(state.view!==PvPView.CLOSED));
let audioPrepared=false,musicPrepared=false;
function prepareTypingAudio(){
  if(!audioPrepared&&!pvpAudio.getState().muted){audioPrepared=true;void pvpAudio.unlock().then(ok=>{if(!ok)audioPrepared=false;});}
  if(!musicPrepared&&!pvpMusic.getState().muted){musicPrepared=true;void pvpMusic.unlock().then(ok=>{if(!ok)musicPrepared=false;});}
}
root?.addEventListener('pointerdown',prepareTypingAudio,{passive:true});
root?.addEventListener('focusin',event=>{
  if(!event.target.matches?.('[data-tt-input],.pvp2-input'))return;
  event.target.closest('.tt,.pvp2-typebox')?.classList.add('is-input-focused');
  // Programmatic focus during setup is not an autoplay gesture.
  if(navigator.userActivation?.isActive)prepareTypingAudio();
});
root?.addEventListener('focusout',event=>{
  if(event.target.matches?.('[data-tt-input],.pvp2-input'))event.target.closest('.tt,.pvp2-typebox')?.classList.remove('is-input-focused');
});
root?.addEventListener('input',event=>{
 const volumeControl=event.target.closest('[data-pvp-volume]');
 if(!volumeControl){const musicSlider=event.target.closest('[data-pvp23-music]');if(!musicSlider)return;const n=pvpMusic.setVolume(Number(musicSlider.value)/100);const label=root.querySelector('[data-pvp23-music-label]');if(label)label.textContent=Math.round(n*100)+'%';if(n>0&&!pvpMusic.getState().muted)void pvpMusic.unlock();return;}
 const volume=pvpAudio.setVolume(Number(volumeControl.value)/100);
 root.querySelector('[data-pvp-volume-label]').textContent=Math.round(volume*100)+'%';
 if(volume>0&&!pvpAudio.getState().muted)void pvpAudio.unlock();
});
/** Paket 33: ⚙ → Tam ekran düğmesinin etiketi/durumu; API yoksa düğme gizlenir. */
function fullscreenButtonSync(){
  const button=root?.querySelector('[data-pvp-action="fullscreen"]');if(!button)return;
  button.hidden=!document.fullscreenEnabled;
  const on=document.fullscreenElement===root;
  button.setAttribute('aria-pressed',String(on));button.textContent=on?'⛶ Tam ekrandan çık':'⛶ Tam ekran';
}
document.addEventListener('fullscreenchange',fullscreenButtonSync);
document.addEventListener('tuslab:pvp-enter',()=>store.dispatch({type:'PVP_OPEN'}));
root?.addEventListener('click',event=>{
  const action=event.target.closest('[data-pvp-action]');if(!action)return;
  if(action.dataset.pvpAction==='music'){const muted=pvpMusic.setMuted(!pvpMusic.getState().muted);action.setAttribute('aria-pressed',String(muted));action.textContent=muted?'♫ Müziği aç':'♫ Müziği kapat';if(!muted)void pvpMusic.unlock();}
  else if(action.dataset.pvpAction==='close'){
    store.dispatch({type:'PVP_CLOSE'});
    document.querySelector('[data-action="nav"][data-mode="arena"]')?.focus({preventScroll:true});
  } else if(action.dataset.pvpAction==='effects'){
    reducedEffects=!reducedEffects;
    root.classList.toggle('pvp4-reduced',reducedEffects);
    Object.values(fxDirectors).forEach(director=>director.setReduced(reducedEffects));
    Object.values(choreographers).forEach(director=>director.setReduced());
    fx24Clear();arena3d.instance?.clear();
    action.setAttribute('aria-pressed',String(reducedEffects));
    action.textContent=reducedEffects?'✧ Efektleri geri aç':'✧ Efektleri azalt';
  } else if(action.dataset.pvpAction==='arena3d'){
    const turnOn=!arena3d.instance;
    arena3dSetPref(turnOn);
    if(turnOn)void arena3dCreate();else{arena3dDestroy();arena3dButtonSync();}
  } else if(action.dataset.pvpAction==='fullscreen'){
    // Paket 33: tarayıcı tam ekranı (Fullscreen API). Esc ile de çıkılır; etiket fullscreenchange ile eşitlenir.
    if(document.fullscreenElement)void document.exitFullscreen?.().catch(fullscreenButtonSync);
    else if(document.fullscreenEnabled)void root.requestFullscreen?.().catch(fullscreenButtonSync);
  } else if(action.dataset.pvpAction==='sound'){
    const next=pvpAudio.setMuted(!pvpAudio.getState().muted);
    action.setAttribute('aria-pressed',String(next));action.textContent=next?'🔇 Sesi aç':'🔊 Sesi kapat';
    if(pvpMusic.getState().muted!==next){pvpMusic.setMuted(next);const mb=root.querySelector('[data-pvp23-music-toggle]');if(mb){mb.setAttribute('aria-pressed',String(next));mb.textContent=next?'♫ Müziği aç':'♫ Müziği kapat';}}
    if(!next)void pvpMusic.unlock();
    if(!next)void pvpAudio.unlock().then(()=>pvpAudio.play('shield',{character:'center',gain:.22}));
  } else if(action.dataset.pvpAction==='reset') {
    const p=players[action.dataset.target];if(!p)return;
    if(['running','paused'].includes(network.match?.status))return;
    p.typed='';p.startedAt=null;p.errors=0;p.pending=false;p.pendingIndex=null;
    textUpdate(p.id);root.querySelector('[data-tt-input]')?.focus({preventScroll:true});
  }
});
// Local animation tests only. Server events in later packages can call
// document.dispatchEvent(new CustomEvent('tuslab:pvp-animation',
// {detail:{playerId:'fire',action:'q'}}));
root?.addEventListener('click',event=>{
  const combo=event.target.closest('[data-demo-combo]');
  if(combo){
    if(['running','paused'].includes(network.match?.status))return;
    const controller=controllers[combo.dataset.demoCombo];
    if(!controller)return;
    for(const key of ['q','e','r'])controller.trigger(key);
    return;
  }
  const button=event.target.closest('[data-demo-action]');
  if(!button||['running','paused'].includes(network.match?.status))return;
  controllers[button.dataset.target]?.trigger(button.dataset.demoAction);
});
document.addEventListener('tuslab:pvp-animation',event=>{
  if(store.getState().view===PvPView.CLOSED)return;
  const {playerId,action}=event.detail||{};
  controllers[playerId]?.trigger(action);
});

// Battle effects are driven by monotonically numbered, server-persisted events;
// no local click/keypress can change authoritative HP.
let terminalPlayed=null;
// Arena: ARENA_ATTACK, DAMAGE_APPLIED ile aynı görsel yoldan (saldıran hamlesi + savunan darbesi) oynatılır.
root?.addEventListener('tuslab:pvp-combat',event=>{for(const action of arenaCombatActions(event.detail||{}))playCombat(action);});
function playCombat(action){
  fx24.hud?.handle(action);
  if(action.arena&&action.type==='SKILL_CAST')pvpAudio.play('attack-turn',{character:action.fromSeat===2?'rune':'fire',gain:.6});
  if(action.type==='WORD_CLASH')pvpAudio.play('clash',{character:'center',gain:.78});
  // Paket 31: partner desteği girişi — yeni ses dosyası yok, mevcut 'counter' örneği kısık çalınır.
  if(action.type==='ASSIST_CAST')pvpAudio.play('counter',{character:action.fromSeat===2?'rune':'fire',gain:.62});
  if(action.type!=='DAMAGE_APPLIED')fx24.damage?.handle(action);
  if(action.type==='DAMAGE_APPLIED'&&arena3d.instance)fx24.shownHp?.expect?.(action); // can çubuğu temas karesine kadar eski değerde
  if(action.type==='SHIELD_BROKEN'){try{root.dispatchEvent(new CustomEvent('tuslab:pvp-status',{detail:{seat:action.seat,text:'KALKAN KIRIK',tone:'break'}}));}catch{}}
  if(arena3d.instance)arena3d.instance.handle(action);
  else{fx24.motion?.handle(action);fx24.particles?.handle(action);}
  if(!arena3d.instance&&action.type==='DAMAGE_APPLIED')playImpactFeedback(action);
  const actor=action.fromSeat===2?'rune':'fire';
  const defender=action.toSeat===2?'rune':'fire';
  if(action.type==='SKILL_CAST'){
    if(action.skill==='r'){pvpMusic.setScene('ultimate');setTimeout(()=>{if(root&&!root.hidden)syncMusic();},2200);}
    if(!arena3d.instance&&['q','e','r'].includes(action.skill))speakSeat(action.fromSeat,action.skill,{priority:3,ttlMs:1200});
    controllers[actor]?.trigger(action.skill);
    projectiles?.launch({fromSeat:action.fromSeat,skill:action.skill,character:actor});
  }else if(action.type==='ULTIMATE_PHASE'){
    const kind=action.character==='rune'?'rune':'fire';
    const side=root.querySelector(`.pvp2-side[data-player="${kind}"] .pvp2-stage`);
    if(side&&!fx24.damage){ // piksel faz sayacı yoksa eski faz yazısı
      const mark=document.createElement('div');
      mark.className=`pvp14-ultimate-beat pvp14-beat-${action.phase} pvp14-beat-${kind}`;
      mark.textContent=`${action.phase}/3  ${action.phaseName||'ULTİ DARBE'}`;
      mark.setAttribute('aria-hidden','true');side.appendChild(mark);
      if(side.querySelectorAll('.pvp14-ultimate-beat').length>3)side.querySelector('.pvp14-ultimate-beat')?.remove();
      setTimeout(()=>mark.remove(),820);
    }
    // Attack and damage are server-owned. This cue adds only presentation.
    fxDirectors[kind]?.play({cue:action.phase===3?'final-blast':kind==='fire'?'blade-trail':'aftershock',action:'r'});
    choreographers[kind]?.onUltimateBeat(action.phase);
    if(action.phase>1)projectiles?.launch({fromSeat:action.fromSeat,skill:'r',character:kind});
    if(!arena3d.instance)pvpAudio.play(action.phase===3?(kind==='fire'?'fire-r':'rune-r'):(kind==='fire'?'fire-q':'rune-e'),{character:kind,gain:action.phase===3?.60:.26});
  }else if(action.type==='SHIELD_TRIGGERED'){
    const kind=action.seat===2?'rune':'fire';
    controllers[kind]?.trigger('s');
    speakSeat(action.seat,'savunma',{priority:3,ttlMs:1200});
    choreographers[kind]?.onDefense(action.kind||'BLOCK');
    if(action.kind==='PERFECT_BLOCK'){
      fxDirectors[kind]?.play({cue:'ward-pulse',action:'s'});
      pvpAudio.play('perfect',{character:kind,gain:.85});
      pvp13Banner(action.seat,'✦ PERFECT BLOCK!', 'perfect');
    }
  }else if(action.type==='PARRY_TRIGGERED'){
    const kind=action.seat===2?'rune':'fire';
    controllers[kind]?.trigger('s');speakSeat(action.seat,'savunma',{priority:3,ttlMs:1200});choreographers[kind]?.onDefense('PARRY');fxDirectors[kind]?.play({cue:'sparks'});
    pvpAudio.play('parry',{character:kind,gain:1});
    pvp13Banner(action.seat,'✧ PARRY!', 'parry');
  }else if(action.type==='COUNTERATTACK_CAST'){
    const kind=action.fromSeat===2?'rune':'fire';
    controllers[kind]?.trigger('q');
    choreographers[kind]?.onDefense('COUNTERATTACK');
    projectiles?.launch({fromSeat:action.fromSeat,skill:'q',character:kind});
    pvpAudio.play('counter',{character:kind,gain:.85});
    pvp13Banner(action.fromSeat,'↯ COUNTER!', 'counter');
  }else if(action.type==='SHIELD_BROKEN'){
    const kind=action.seat===2?'rune':'fire';
    fxDirectors[kind]?.play({cue:'damage-react'});choreographers[kind]?.onDefense('SHIELD_BROKEN');
    pvpAudio.play('shatter',{character:kind,gain:1});
    pvp13Banner(action.seat,'✹ SHIELD BREAK!', 'shatter');
  }
}
function playImpactFeedback(action, scenePresented = true){
  fx24.damage?.handle(action);
  fx24.shownHp?.impact?.(action); // temas karesi: şimdi gerçekten düşer
  if(!scenePresented)return; // Sıkıştırılan sahne: yalnız hasar sayısı, yeni darbe/tepki yok.
  // Yalnız görsel: temas anı boyalı efekt katmanına (visual-enrich.js) duyurulur.
  try{root?.dispatchEvent(new CustomEvent('tuslab:pvp-impact',{bubbles:true,detail:{toSeat:action.toSeat,fromSeat:action.fromSeat,skill:action.skill,phase:action.phase,amount:Number(action.amount)||0,blocked:!!action.blocked,critical:!!action.critical}}));}catch{}
  const defender=action.toSeat===2?'rune':'fire';
  if(arena3d.instance&&!action.blocked&&['q','e','r'].includes(action.skill))playFighterSfx(action.fromSeat,action.skill,.8);
  // Paket 32: temiz isabet hedefin kendi sesiyle; blok/kritik sesleri aynı kalır.
  const plainHit=!action.blocked&&!action.critical&&(Number(action.amount)||0)>0&&(action.toSeat===1||action.toSeat===2);
  // Görev S: temas karesinde silah / blok / kritik efekti (konyalı q/e/r zaten kendi mp3'ünü çalar).
  const wpn=!action.blocked&&['q','e','r'].includes(action.skill)?weaponSfx(fighterOfSeat(action.fromSeat),action.skill):null;
  if(wpn)pvpAudio.playExtra?.(wpn,{gain:.4});
  const extra=action.blocked?'blok':action.critical?'kritik':null;
  const extraDone=extra?Boolean(pvpAudio.playExtra?.(extra,{gain:action.blocked?.45:.5})):false;
  if(action.critical&&!action.blocked)pvpAudio.cheer?.(.25);
  if(!extraDone&&!(plainHit&&playFighterSfx(action.toSeat,'hit')))pvpAudio.combat(action);
  if(!action.blocked&&(Number(action.amount)||0)>0)hitFeelDamage(action);
  projectiles?.impact({toSeat:action.toSeat,blocked:action.blocked});
  if(!action.blocked)controllers[defender]?.trigger('hit');
}
function syncMusic(){
  const m=network.match;
  const next=m?.status==='ended'?(m.winnerSeat===network.seat?'victory':'defeat')
    :m?.status==='running'?(m.mode==='arena'&&m.round?.phase==='prep'?'prep':m.players?.some(x=>x.hp/x.maxHp<.3)?'tension':'combat'):'lobby';
  syncCrowd(next);
  if(next!==lastMusicScene){lastMusicScene=next;pvpMusic.setScene(next);}
}
root?.addEventListener('tuslab:pvp-match',syncMusic);
// Paket 28: başüstü 3B can barı + düşük can vinyeti/kalp atışı + yan panel HP sarsıntısı.
// Değerler yalnız sunucu maç durumundan okunur.
function syncHitFeel(){
  const m=network.match;
  const running=m?.status==='running'||m?.status==='paused';
  const players=(m?.players||[]).filter(p=>p&&(p.seat===1||p.seat===2)&&Number(p.maxHp)>0)
    .map(p=>({seat:p.seat,hp:Number(p.hp)||0,maxHp:Number(p.maxHp),shield:Boolean(p.shieldUntil&&p.shieldUntil>network.serverNow())}));
  if(arena3d.instance&&players.length&&m?.status!=='waiting')arena3d.instance.handle({type:'HP_SYNC',players});
  const me=(m?.players||[]).find(p=>p?.playerId===network.myId);
  fx24.lowHp?.update(me&&Number(me.maxHp)>0?(Number(me.hp)||0)/Number(me.maxHp):1,running);
}
root?.addEventListener('tuslab:pvp-match',syncHitFeel);
const hpShakeTimers=new Map();
function hitFeelDamage(action){
  const health=root?.querySelector(`.pvp2-side[data-seat="${action.toSeat}"] .pvp2-health`);
  if(health){
    health.classList.remove('pvp28-hpshake');void health.offsetWidth;health.classList.add('pvp28-hpshake');
    clearTimeout(hpShakeTimers.get(action.toSeat));
    hpShakeTimers.set(action.toSeat,setTimeout(()=>health.classList.remove('pvp28-hpshake'),300));
  }
  if(network.seat===action.toSeat)fx24.lowHp?.hit(Math.min(1,(Number(action.amount)||0)/150));
}
root?.addEventListener('tuslab:pvp-match',()=>{
  const m=network.match;
  if(m?.status==='running'&&m.matchId!==fx24.matchId){fx24.matchId=m.matchId;fx24Clear();arena3d.instance?.clear();}
  arena3dSyncFighters(); // paket 32: maç/karakter değişince modeller (ve karakter sesleri) yenilenir
  arena3dSyncStage();
});
root?.addEventListener('tuslab:pvp-match',()=>{
  const m=network.match;
  if(!m||m.status!=='ended'||m.matchId===terminalPlayed)return;
  terminalPlayed=m.matchId;
  if(!arena3d.instance)fx24.motion?.onMatchEnd({winnerSeat:m.winnerSeat});
  if(arena3d.instance){
    if(m.winnerSeat===1||m.winnerSeat===2)arena3d.instance.handle({type:'KNOCKOUT',seat:m.winnerSeat===1?2:1});
    arena3d.instance.onMatchEnd({winnerSeat:m.winnerSeat});
  }
  for(const seat of [1,2])controllers[seat===1?'fire':'rune']?.trigger(m.winnerSeat===null?'idle':m.winnerSeat===seat?'victory':'defeat');
  if(m.winnerSeat===1||m.winnerSeat===2){
    pvpAudio.play(m.winnerSeat===network.seat?'victory':'defeat',{character:m.winnerSeat===1?'fire':'rune',gain:.7});
    playFighterSfx(m.winnerSeat===1?2:1,'ko',.9); // paket 32: kaybedenin KO sesi
    // Görev S: düşme + zafer repliği + spiker + tezahürat (tek replik kanalı; üst üste binmez)
    pvpAudio.playExtra?.('dusme',{gain:.5});pvpAudio.cheer?.(.4);
    speakSeat(m.winnerSeat,'zafer',{priority:4,ttlMs:4000});
    pvpAudio.announce?.(m.winnerSeat===network.seat?'spiker-zafer':'spiker-yenilgi',{priority:3,ttlMs:4000});
  }
});
// Paket 29: dövüş HUD'u (fx24Clear yapan dinleyiciden SONRA kayıtlı olmalı). Maç başı girişi (yeni matchId,
// yeni başlamış maç), süper bar/raund güncellemesi, maç sonu anonsu.
let hudStartedId=null,hudEndedId=null;
root?.addEventListener('tuslab:pvp-match',()=>{
  const m=network.match,hud=fx24.hud;if(!m||!hud)return;
  if(m.status==='running'&&m.matchId!==hudStartedId){
    hudStartedId=m.matchId;
    const fresh=!(Number(m.startedAt)>0)||network.serverNow()-Number(m.startedAt)<4000; // yeniden bağlanmada giriş oynamaz
    if(fresh){
      pvpAudio.playExtra?.('seyirci-baslangic',{gain:.35});
      const mine=(m.players||[]).find(p=>p.playerId===network.myId)?.seat;
      for(const seat of [mine,mine===1?2:1])speakSeat(seat,'soz',{priority:1,ttlMs:6000});
    }
    if(fresh)hud.matchStart({players:(m.players||[]).map(p=>({seat:p.seat,name:p.name,character:p.character,fighter:p.fighter})),mode:m.mode,round:m.round?.index||1});
  }
  hud.update(m,network.myId);
  if(m.status==='ended'&&m.matchId!==hudEndedId){hudEndedId=m.matchId;hud.matchEnd({winnerSeat:m.winnerSeat??null,reason:m.endReason||null});}
});

root?.addEventListener('input',event=>{
  const input=event.target.closest('[data-input]');if(!input)return;
  if(!input.disabled)pvpAudio.keyClick();
  const p=players[input.dataset.input];if(!p)return;
  if(p.startedAt===null) p.startedAt=performance.now();
  const match=network.match;
  if(['running','paused'].includes(match?.status)){
    const seat=p.id==='fire'?1:2;
    const serverPlayer=match.players.find(x=>x.seat===seat);
    if(!serverPlayer||serverPlayer.playerId!==network.myId||p.pending||match.status==='paused'||network.reconnecting||inputLock(match).locked){textUpdate(p.id);return;}
    const wordLength=String(liveTarget(match,serverPlayer,true)||'').length;
    // Paket 33: boşluk kelimeyi HER ZAMAN kutudan alır. Pencere kapandıysa (çözüm evresi) kelime sıraya girer ve
    // sıradaki pencere açılınca gönderilir; kutuda kalıp sonraki kelimeyle birleşmez (pvp/word-queue.js).
    const commit=wordCommit({typed:input.value,gate:exchangeGate(match,network.serverNow())});
    if(commit.action==='queue'){p.queued=commit.word;p.typed='';}
    else if(commit.action==='submit'){
      p.typed=commit.word.slice(0,wordLength+20);
      p.pending=true;p.pendingIndex=serverPlayer.wordIndex;
      if(!network.submitWord(commit.word)){p.pending=false;p.pendingIndex=null;p.typed='';}
    }else p.typed=commit.typed.slice(0,wordLength+20);
  }else p.typed=input.value.slice(0,texts[p.textIndex].length);
  textUpdate(p.id);
});
// Server snapshots drive the next target, skill charge, accuracy and WPM. Opponent input is read-only.
let lastLiveMatchId=null;
root?.addEventListener('tuslab:pvp-match',()=>{
  if(network.match?.matchId!==lastLiveMatchId){
    lastLiveMatchId=network.match?.matchId||null;
    for(const p of Object.values(players)){p.typed='';p.startedAt=null;p.pending=false;p.pendingIndex=null;p.queued=null;}
  }
  for(const id of ['fire','rune']){
    const p=players[id];
    const seat=id==='fire'?1:2;
    const serverPlayer=network.match?.players?.find(x=>x.seat===seat);
    if(p.pending&&serverPlayer&&serverPlayer.wordIndex>p.pendingIndex){p.pending=false;p.pendingIndex=null;p.typed='';}
    textUpdate(id);
    flushQueued(id);
  }
  focusTypingWhenReady();
});
/** Paket 33: sıraya alınmış kelimeyi (pencere kapalıyken boşluk basıldı) pencere açılınca gönder. */
function flushQueued(id){
  const p=players[id],m=network.match;if(!p)return;
  const sp=m?.players?.find(x=>x.seat===(id==='fire'?1:2));
  if(p.queued&&m?.status!=='running'&&m?.status!=='paused')p.queued=null;
  if(!queuedReady({queued:p.queued,pending:p.pending,match:m,now:network.serverNow(),own:sp?.playerId===network.myId}))return;
  const word=p.queued;p.queued=null;p.typed='';p.pending=true;p.pendingIndex=sp.wordIndex;
  if(!network.submitWord(word)){p.pending=false;p.pendingIndex=null;}
  textUpdate(id);
}
// Pencere/raund yeniden açılınca: sıradaki kelimeyi gönder ve odak <body>'de kaldıysa yazma kutusuna dön.
// (Kutu çözüm sırasında stage-focus ile gizlenir; kilit, gizliyken açıldığında focus() işe yaramıyordu.)
function focusTypingWhenReady(attempt=0){
  if(window.matchMedia?.('(pointer: coarse)')?.matches||!root||root.hidden)return;
  requestAnimationFrame(()=>{
    const input=root.querySelector('#tt-input');
    const active=document.activeElement;
    if(!input||input.disabled||root.hidden||root.querySelector('[data-pvp-settings][open], [data-pvp15-results]:not([hidden]), dialog[open]'))return;
    if(active&&active!==document.body&&active!==input)return;
    if(!input.getClientRects().length||getComputedStyle(input).visibility==='hidden'){
      if(attempt<30)setTimeout(()=>focusTypingWhenReady(attempt+1),50);
      return;
    }
    input.focus({preventScroll:true});
  });
}
root?.addEventListener('tuslab:pvp-recovered',()=>arena3d.instance?.clear());
root?.addEventListener('tuslab:pvp-arena',event=>{
  if(['ARENA_ROUND_START','ARENA_PREP_START'].includes(event.detail?.type))arena3d.instance?.clear();
  if(event.detail?.type==='ARENA_ROUND_END')arena3d.instance?.visualQueue?.drain(1500);
});
root?.addEventListener('tuslab:pvp-round',event=>{
  const type=event.detail?.type;if(type!=='EXCHANGE_START'&&type!=='ROUND_START')return;
  flushQueued(myKey());
  focusTypingWhenReady();
});
// A pending word may have been lost during a network cut. Let the player
// retype it after authoritative recovery instead of leaving the input locked.
root?.addEventListener('tuslab:pvp-recovered',()=>{
  for(const p of Object.values(players)){
    p.pending=false;p.pendingIndex=null;p.typed='';p.startedAt=null;p.queued=null;
    textUpdate(p.id);
  }
});
root?.addEventListener('tuslab:pvp-word-result',event=>{
  const result=event.detail||{};
  if(result.accepted)pvpAudio.play(result.correct?'word-correct':'word-wrong',{character:'center',gain:.22});
  if(!result.accepted){
    const ownId=network.seat===2?'rune':'fire',own=players[ownId];
    // Paket 33: reddedilen kelime kutuda kalmaz (sonraki kelimeyle birleşip yanlış sayılıyordu);
    // pencere kapandığı için reddedildiyse sıradaki pencerede yeniden gönderilir.
    const after=afterReject({code:result.code,word:own.typed});
    own.pending=false;own.pendingIndex=null;own.typed=after.typed;if(after.queued)own.queued=after.queued;
    textUpdate(ownId);flushQueued(ownId);
    return;
  }
  const id=(result.seat??network.seat)===2?'rune':'fire';
  const p=players[id];p.pending=false;p.pendingIndex=null;p.typed='';p.startedAt=performance.now();
  textUpdate(id);
  focusTypingWhenReady();
});
// PvP captures game shortcuts without interfering with ordinary text input.
document.addEventListener('keydown',event=>{
  if(store.getState().view===PvPView.CLOSED)return;
  if(!pvpAudio.getState().muted&&event.key.length===1)void pvpAudio.unlock();
  event.stopImmediatePropagation();
  if(network.lobbyKey?.(event))return; // lobi: karakter/arena/mod ok tuşları (kök dinleyicisi bu satırdan sonra hiç tetiklenmez)
  // Arena hazırlığı: 1–5 skill, 6–9 eşya, Enter kilitle, Esc seçmeden geç.
  if(arenaUi?.handleKey(event))return;
  if(roundsUi?.handleKey(event))return;
  if(event.key==='Escape'){
    const settings=root?.querySelector('[data-pvp-settings][open]');
    if(settings){settings.open=false;settings.querySelector('summary')?.focus({preventScroll:true});return;}
  }
  if(event.key==='Escape'&&!['TEXTAREA','INPUT'].includes(document.activeElement?.tagName)){
    // Canlı maçta yanlışlıkla Esc oyuncuyu odadan düşürmesin.
    if(['running','paused'].includes(network.match?.status)&&!window.confirm("PvP'den çıkarsan maçtan ayrılırsın. Çıkılsın mı?"))return;
    store.dispatch({type:'PVP_CLOSE'});
  }
},true);
// Declare phase-15 scorecard timer before show(false), which can access it.
let phase15StartedId=null,phase15RevealTimer=null,phase15TerminalQueued=null;
show(false);
// A room invite opens the PvP view automatically on initial page load.
// Route uses ?pvpRoom=CODE so the same URL works on static Workers assets.
if(network.autoInvite){
  const nav=document.querySelector('[data-action="pvp-enter"]');
  if(nav)nav.click();
  else document.dispatchEvent(new CustomEvent('tuslab:pvp-enter'));
}


// Phase 15: show only server-confirmed scorecards and action on user intent.
root?.addEventListener('tuslab:pvp-match',()=>{
  const match=network.match;
  if(match?.status==='ended'){
    if(phase15TerminalQueued!==match.matchId){
      phase15TerminalQueued=match.matchId;
      if(phase15RevealTimer!==null)clearTimeout(phase15RevealTimer);
      // Let the server-confirmed victory/defeat pose show before the scorecard.
      phase15RevealTimer=setTimeout(()=>{
        phase15RevealTimer=null;
        if(network.match?.status==='ended'&&network.match.matchId===match.matchId&&!root.hidden)
          {renderResult(root,network.match,network);renderRoundsResult(root,network.match,network.myId);renderArenaResult(root,network.match,network.myId);}
      },850);
    }
    return;
  }
  if(phase15RevealTimer!==null){clearTimeout(phase15RevealTimer);phase15RevealTimer=null;}
  phase15TerminalQueued=null;
  renderResult(root,match,network);renderRoundsResult(root,match,network.myId);renderArenaResult(root,match,network.myId);
  if(match?.status==='running'&&match.matchId!==phase15StartedId){
    phase15StartedId=match.matchId;
    controllers.fire?.trigger('idle');controllers.rune?.trigger('idle');
  }
});
root?.addEventListener('tuslab:pvp-rematch',()=>{renderResult(root,network.match,network);renderRoundsResult(root,network.match,network.myId);renderArenaResult(root,network.match,network.myId);});
root?.addEventListener('click',event=>{
  const control=event.target.closest('[data-pvp15-action]');if(!control)return;
  if(control.dataset.pvp15Action==='surrender'){
    if(['running','paused'].includes(network.match?.status)&&network.myId&&window.confirm('Maçtan çekilirsen rakibin hükmen kazanacak. Emin misin?'))network.send('SURRENDER',{});
  }else if(control.dataset.pvp15Action==='rematch'){
    if(network.match?.status!=='ended'||!network.myId)return;
    network.send('REMATCH_VOTE',{accept:!network.rematchVotes.includes(network.myId)});
  }else if(control.dataset.pvp15Action==='leave'){
    network.disconnect(true);
    const panel=root.querySelector('[data-pvp15-results]');if(panel)panel.hidden=true;root.classList.remove('pvp15-results-open');
  }
});

// Tur sistemi: snapshot → HUD, ROUND_* → katmanlar, WORD_CLASH → çarpışma çağrısı.
root?.addEventListener('tuslab:pvp-match',()=>roundsUi?.update(network.match,network.myId));
root?.addEventListener('tuslab:pvp-match',()=>matchInfo?.update(network.match,network.myId));
root?.addEventListener('tuslab:pvp-round',event=>{
  const detail=event.detail||{};
  if(detail.type==='ROUND_START')arena3d.instance?.clear();
  if(detail.type==='ROUND_END')arena3d.instance?.visualQueue?.drain(1500);
  if(detail.type==='ROUND_START'){pvpAudio.play('round-start',{character:'center',gain:.6});roundVoice();}
  if(detail.type==='ROUND_END'&&detail.payload?.reason==='TIME')pvpAudio.announce?.('spiker-sure',{priority:2,ttlMs:1800});
  if(detail.type==='ROUND_SKILL_ACK'){
    pvpAudio.play('skill-lock',{character:'center',gain:.45});
    const cue={timethief:'time-thief',freeze:'time-freeze',blindclock:'blind-clock'}[detail.payload?.skill];
    if(cue)pvpAudio.play(cue,{character:'center',gain:.55});
  }
  if(detail.type==='ROUND_START'){
    // Yeni tur yeni kelime listesi: yarım kalan yerel yazı ve bekleyen gönderim temizlenir.
    for(const p of Object.values(players)){p.typed='';p.pending=false;p.pendingIndex=null;p.startedAt=null;}
    textUpdate('fire');textUpdate('rune');
  }
  roundsUi?.handle({type:detail.type,payload:detail.payload});
});
root?.addEventListener('tuslab:pvp-combat',event=>{
  if(event.detail?.type==='WORD_CLASH')roundsUi?.handle({type:'WORD_CLASH',payload:event.detail});
});

// Arena: snapshot → HUD/faz öznitelikleri; ARENA_* paketleri → hazırlık/özet katmanları.
root?.addEventListener('tuslab:pvp-match',()=>{arenaUi?.update(network.match,network.myId);arenaLayoutSync();});
root?.addEventListener('tuslab:pvp-arena',event=>{
  const detail=event.detail||{};
  if(detail.type==='ARENA_PREP_START')pvpAudio.play('prep',{character:'center',gain:.65});
  if(detail.type==='ARENA_PICK_ACK')pvpAudio.play('skill-lock',{character:'center',gain:.48});
  if(detail.type==='ARENA_ROUND_START'){
    pvpAudio.play('round-start',{character:'center',gain:.7});roundVoice();
    const cue={scramble:'scramble',timethief:'time-thief',freeze:'time-freeze',blindclock:'blind-clock'}[network.match?.me?.picks?.skill];
    if(cue)pvpAudio.play(cue,{character:'center',gain:.55});
  }
  arenaUi?.handle({type:detail.type,payload:detail.payload});
  if(detail.type==='ARENA_ROUND_START'||detail.type==='ARENA_PREP_START'){
    // Yeni raund yeni kelime listesi: yarım kalan yerel yazı ve bekleyen gönderim temizlenir.
    for(const p of Object.values(players)){p.typed='';p.pending=false;p.pendingIndex=null;p.startedAt=null;}
    textUpdate('fire');textUpdate('rune');
    if(detail.type==='ARENA_ROUND_START')focusTypingWhenReady();
  }
  arenaLayoutSync();
});
