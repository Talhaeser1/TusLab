/**
 * TuşLab / PvP work package 10 — original sampled audio + Web Audio mixing.
 * Audio assets are procedurally authored for TuşLab, never extracted from games.
 * The server remains authoritative; audio may only respond to confirmed cues.
 * Paket 32: character-specific SFX (<fighter>-q/e/r/hit/ko) are lazy — fetched only via
 * preloadFighters(ids) for the fighters of the current match; missing files fall back to the
 * archetype sound (fire-q / rune-e / hit / defeat …).
 */
import {FIGHTER_IDS,isFighterId,fighterSide} from './shared/fighters.js';
import {createVoiceQueue} from './voice-queue.js';
export const SFX_NAMES=Object.freeze([
 'fire-q','fire-e','fire-r','rune-q','rune-e','rune-r','shield','block','hit','critical','victory','defeat','key','perfect','parry','counter','shatter',
 'prep','skill-lock','round-start','scramble','time-thief','time-freeze','blind-clock','clash','attack-turn','word-correct','word-wrong'
]);
/** Paket 32: per-fighter keys. Not part of SFX_NAMES so the eager preload stays unchanged. */
export const FIGHTER_SFX_KEYS=Object.freeze(['q','e','r','hit','ko']);
export const FIGHTER_SFX_NAMES=Object.freeze(FIGHTER_IDS.flatMap(id=>FIGHTER_SFX_KEYS.map(key=>`${id}-${key}`)));
export const ALL_SFX_NAMES=Object.freeze([...SFX_NAMES,...FIGHTER_SFX_NAMES]);
const KNOWN_SFX=new Set(ALL_SFX_NAMES);
/** Görev S: dosya adı sözleşmesi. Karakter repliği = assets/sfx/replik/<id>-<q|e|r|savunma|zafer|soz>.mp3 */
export const VOICE_KEYS=Object.freeze(['q','e','r','savunma','zafer','soz']);
export const voiceKey=(fighterId,key)=>isFighterId(fighterId)&&VOICE_KEYS.includes(key)?`replik/${fighterId}-${key}`:null;
/** assets/sfx/extra/*.mp3 (silah, blok, kritik, düşme, seyirci, jingle) */
export const EXTRA_NAMES=Object.freeze(['balta','kilic','mizrak','hancer','isik','meteor','kalkan','blok','kritik','dusme','run',
 'seyirci-baslangic','seyirci-tezahurat','seyirci-ugultu','jingle-2','jingle-3','jingle-4','jingle-5','jingle-6']);
/** assets/sfx/anons/*.mp3 (spiker + seri anonsları) */
export const ANNOUNCE_NAMES=Object.freeze(['spiker-raund1','spiker-savas','spiker-son-raund','spiker-sure','spiker-yeni-raund','spiker-yenilgi','spiker-zafer',
 'seri-2','seri-3','seri-4','seri-5','seri-6']);
const EXTRA_SET=new Set(EXTRA_NAMES),ANNOUNCE_SET=new Set(ANNOUNCE_NAMES);
/** Temas karesinde çalacak silah sesi (konyalı kendi mp3'ünü playFighter ile çalar → null). */
const WEAPON_SFX={vargr:{q:'balta',e:'balta',r:'balta'},sira:{q:'mizrak',e:'hancer',r:'hancer'},doran:{q:'kilic',e:'kalkan',r:'meteor'},nyx:{q:'isik',e:'isik',r:'meteor'}};
export const weaponSfx=(fighterId,skill)=>WEAPON_SFX[fighterId]?.[skill]??null;
/** Karakter efekt dosyası (baseURL'e göre). Konyalı q/e/r → mp3; konyalı hit/ko dosyası yok → null (arketip sesine düşer, 404 yok). */
export const fighterSfxFile=(fighterId,key)=>{
 if(!isFighterId(fighterId)||!FIGHTER_SFX_KEYS.includes(key))return null;
 if(fighterId==='konyali')return ['q','e','r'].includes(key)?`${fighterId}-${key}.mp3`:null;
 return `${fighterId}-${key}.wav`;
};
/** Per-fighter SFX name for key ('q'|'e'|'r'|'hit'|'ko'), or null for unknown fighter/key. */
export const fighterSfx=(fighterId,key)=>isFighterId(fighterId)&&FIGHTER_SFX_KEYS.includes(key)?`${fighterId}-${key}`:null;
/** Archetype fallback used when a fighter file is missing or not loaded yet. */
export const fighterFallbackSfx=(fighterId,key,character)=>{
 const side=character==='fire'||character==='rune'?character:isFighterId(fighterId)?fighterSide(fighterId):'fire';
 if(key==='hit')return 'hit';
 if(key==='ko')return 'defeat';
 return SKILL_SFX[side]?.[key]??null;
};
export const MAX_VOICES=8;
export const SKILL_SFX=Object.freeze({fire:{q:'fire-q',e:'fire-e',r:'fire-r'},rune:{q:'rune-q',e:'rune-e',r:'rune-r'}});
export const soundForCue=(character,cue,action)=>{
 if(cue==='ward-rise')return 'shield';
 if(cue==='blade-trail'&&action==='q')return SKILL_SFX[character]?.q??null;
 if(cue==='blade-trail'&&action==='e')return SKILL_SFX[character]?.e??null;
 if(cue==='ultimate-charge'&&action==='r')return SKILL_SFX[character]?.r??null;
 return null;
};
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
function safeRead(store,key,defaultValue){try{return store?.getItem(key)??defaultValue;}catch{return defaultValue;}}
function safeWrite(store,key,val){try{store?.setItem(key,String(val));}catch{}}
export function createPvPAudio({storage=globalThis.localStorage, AudioContextClass=globalThis.AudioContext||globalThis.webkitAudioContext, fetcher=globalThis.fetch?.bind(globalThis),baseURL='./assets/sfx/'}={}){
 const v=parseFloat(safeRead(storage,'tuslab-pvp-sfx-volume','0.55'));
 let volume=Number.isFinite(v)?clamp(v,0,1):.55;
 let muted=safeRead(storage,'tuslab-pvp-sfx-muted','false')==='true';
 let ctx=null,master=null,decoded=new Map(),raw=new Map(),loading=null,unlocking=null,disposed=false,lastKey=0,onPlay=null;
 const voices=new Set();
 function setGain(){if(master)master.gain.value=muted?0:volume*.64;}
 function ensureContext(){
   if(disposed||!AudioContextClass)return null;
   if(ctx)return ctx;
   ctx=new AudioContextClass({latencyHint:'interactive'});
   master=ctx.createGain();
   if(typeof ctx.createDynamicsCompressor==='function'){
     const compressor=ctx.createDynamicsCompressor();
     compressor.threshold.value=-20;compressor.knee.value=12;compressor.ratio.value=12;
     compressor.attack.value=.004;compressor.release.value=.18;
     master.connect(compressor);compressor.connect(ctx.destination);
   }else master.connect(ctx.destination);
   setGain();return ctx;
 }
 async function preload(){
   if(disposed||!fetcher||muted||volume<=0)return false;
   if(loading)return loading;
   loading=Promise.all(SFX_NAMES.map(async name=>{
     try{const response=await fetcher(baseURL+name+'.wav');if(!response.ok)throw new Error(`HTTP ${response.status}`);raw.set(name,await response.arrayBuffer());}
     catch{/* An asset can be unavailable on file:// or an incomplete deploy; sound stays optional. */}
   })).then(()=>raw.size>0);
   return loading;
 }
 // Paket 32: lazy per-match fighter set. Only the given fighters' files are fetched (and decoded
 // right away when the context is already running); unknown ids are ignored.
 const fighterLoads=new Map(),wantedFighters=new Set();
 function preloadFighters(ids=[]){
   const list=[...new Set((Array.isArray(ids)?ids:[ids]).filter(isFighterId))];
   for(const id of list)wantedFighters.add(id);
   // Muted/silent: remember the request, unlock() fetches it later (same rule as preload()).
   if(disposed||!fetcher||!list.length||muted||volume<=0)return Promise.resolve(false);
   return Promise.all(list.map(id=>{
     if(!fighterLoads.has(id))fighterLoads.set(id,Promise.all(FIGHTER_SFX_KEYS.map(async key=>{
       const name=`${id}-${key}`,file=fighterSfxFile(id,key);
       if(!file)return; // dosyası olmayan anahtar: istek atma
       try{const response=await fetcher(baseURL+file);if(!response.ok)throw new Error(`HTTP ${response.status}`);raw.set(name,await response.arrayBuffer());}
       catch{return;}
       if(ctx&&ctx.state==='running'&&!decoded.has(name)){try{decoded.set(name,await ctx.decodeAudioData(raw.get(name).slice(0)));}catch{}}
     })));
     return fighterLoads.get(id);
   })).then(()=>list.some(id=>FIGHTER_SFX_KEYS.some(key=>raw.has(`${id}-${key}`))));
 }
 async function unlock(){
   if(disposed||muted||volume<=0)return false;
   if(unlocking)return unlocking;
   unlocking=(async()=>{
     const audio=ensureContext();if(!audio)return false;
     try{await audio.resume();}catch{return false;}
     await preload();
     if(wantedFighters.size)await preloadFighters([...wantedFighters]);
     if(wantedAssets.size)await Promise.all([...wantedAssets].map(loadAsset));
     for(const [name,bytes] of raw){
       if(decoded.has(name))continue;
       try{decoded.set(name,await audio.decodeAudioData(bytes.slice(0)));}catch{}
     }
     return audio.state==='running';
   })();
   try{return await unlocking;}finally{unlocking=null;}
 }
 function play(name,{character='fire',gain=1}={}){
   if(disposed||muted||volume<=0||!KNOWN_SFX.has(name)||!ctx||ctx.state!=='running')return false;
   const buffer=decoded.get(name);if(!buffer)return false;
   while(voices.size>=MAX_VOICES){
     const old=voices.values().next().value;
     if(!old)break;
     voices.delete(old);try{old.stop();}catch{}
   }
   const source=ctx.createBufferSource();source.buffer=buffer;
   const level=ctx.createGain();level.gain.value=clamp(gain,0,1.4)*(.25/Math.sqrt(Math.max(1,voices.size+1)));
   if(typeof ctx.createStereoPanner==='function'){
      const pan=ctx.createStereoPanner();pan.pan.value=character==='fire'?-0.56:character==='rune'?0.56:0;
      source.connect(level);level.connect(pan);pan.connect(master);
   }else{source.connect(level);level.connect(master);}
   source.onended=()=>{voices.delete(source);try{source.disconnect();level.disconnect();}catch{}};
   voices.add(source);source.start(0);try{onPlay?.(name);}catch{}return true;
 }
 // ---- Görev S: replik / anons / efekt / seyirci katmanı (tembel yüklenir, ilk etkileşimden sonra; eksik dosya 1 kez denenir)
 const assets=new Map(),assetLoads=new Map(),failedAssets=new Set(),wantedAssets=new Set(),assetVoices=new Set();
 let crowdWanted=false,crowdEntry=null,lastCheer=0;
 const CROWD_KEY='extra/seyirci-ugultu';
 function loadAsset(key){
   if(disposed||!fetcher||!ctx||failedAssets.has(key))return Promise.resolve(null);
   if(assets.has(key))return Promise.resolve(assets.get(key));
   if(assetLoads.has(key))return assetLoads.get(key);
   const job=(async()=>{
     try{
       const response=await fetcher(`${baseURL}${key}.mp3`);if(!response.ok)throw new Error(`HTTP ${response.status}`);
       const buffer=await ctx.decodeAudioData(await response.arrayBuffer());
       assets.set(key,buffer);return buffer;
     }catch{failedAssets.add(key);return null;}
     finally{assetLoads.delete(key);}
   })().then(buffer=>{if(buffer&&crowdWanted&&key===CROWD_KEY)startCrowd();return buffer;});
   assetLoads.set(key,job);return job;
 }
 /** Maç için gerekecek replik/silah/anons/seyirci dosyalarını ister (sessizdeyken yalnız hatırlar). */
 function preloadVoices(ids=[]){
   const list=[...new Set((Array.isArray(ids)?ids:[ids]).filter(isFighterId))];
   for(const id of list){
     for(const k of VOICE_KEYS)wantedAssets.add(voiceKey(id,k));
     for(const w of new Set(Object.values(WEAPON_SFX[id]||{})))wantedAssets.add(`extra/${w}`);
   }
   for(const n of ['blok','kritik','dusme','seyirci-baslangic','seyirci-tezahurat','seyirci-ugultu','jingle-2','jingle-3','jingle-4','jingle-5','jingle-6'])wantedAssets.add(`extra/${n}`);
   for(const n of ANNOUNCE_NAMES)wantedAssets.add(`anons/${n}`);
   if(disposed||muted||volume<=0||!ctx)return Promise.resolve(false);
   return Promise.all([...wantedAssets].map(loadAsset)).then(r=>r.some(Boolean));
 }
 function playAsset(key,{gain=1,loop=false,duck=true,onEnd=null}={}){
   if(disposed||muted||volume<=0||!ctx||ctx.state!=='running'||failedAssets.has(key))return null;
   const buffer=assets.get(key);
   if(!buffer){if(wantedAssets.has(key))void loadAsset(key);return null;}
   const source=ctx.createBufferSource();source.buffer=buffer;source.loop=loop;
   const level=ctx.createGain();level.gain.value=clamp(gain,0,1.5);
   source.connect(level);level.connect(master);
   const entry={source,level,key};assetVoices.add(entry);
   source.onended=()=>{assetVoices.delete(entry);try{source.disconnect();level.disconnect();}catch{}onEnd?.();};
   source.start(0);if(duck)try{onPlay?.(key);}catch{}
   return entry;
 }
 const voiceQueue=createVoiceQueue({now:()=>typeof performance!=='undefined'?performance.now():Date.now(),
   start:(item,done)=>{
     const entry=playAsset(item.key,{gain:item.gain,onEnd:done});
     if(!entry)return false;
     // Güvence: onended hiç gelmezse (askıya alınmış bağlam) kuyruk takılmasın.
     const dur=Number(assets.get(item.key)?.duration)||2;
     setTimeout(done,Math.min(8000,dur*1000+600));
     return true;
   }});
 /** Karakterin kendi repliği (q/e/r/savunma/zafer/soz). Dosya yoksa sessiz. */
 function speak(fighterId,key,{priority=3,gain=.9,ttlMs}={}){
   const k=voiceKey(fighterId,key);if(!k||disposed||muted||volume<=0)return false;
   if(!assets.has(k)&&ctx&&!failedAssets.has(k)){ // henüz inmediyse: inince (süresi geçmediyse) sıraya gir
     const t=typeof performance!=='undefined'?performance.now():Date.now(),life=ttlMs>0?ttlMs:1600;
     void loadAsset(k).then(b=>{const now=typeof performance!=='undefined'?performance.now():Date.now();if(b&&now-t<life&&!muted&&!disposed)voiceQueue.push({key:k,priority,gain,ttlMs:life-(now-t)});});
     return true;
   }
   return voiceQueue.push({key:k,priority,gain,ttlMs});
 }
 /** Spiker / seri anonsu — replikle aynı tek kanalı paylaşır (üst üste binmez). */
 function announce(name,{priority=2,gain=.8,ttlMs}={}){
   if(!ANNOUNCE_SET.has(name)||disposed||muted||volume<=0)return false;
   return voiceQueue.push({key:`anons/${name}`,priority,gain,ttlMs});
 }
 /** Silah / blok / kritik / düşme / seyirci / jingle efekti. */
 function playExtra(name,{gain=.4}={}){
   if(!EXTRA_SET.has(name))return false;
   return Boolean(playAsset(`extra/${name}`,{gain}));
 }
 function startCrowd(){
   crowdWanted=true;
   if(crowdEntry||disposed||muted||volume<=0)return Boolean(crowdEntry);
   const entry=playAsset(CROWD_KEY,{gain:.1,loop:true,duck:false,onEnd:()=>{if(crowdEntry===entry)crowdEntry=null;}});
   crowdEntry=entry;return Boolean(entry);
 }
 function stopCrowd(){
   crowdWanted=false;
   if(crowdEntry){const e=crowdEntry;crowdEntry=null;try{e.source.stop();}catch{}}
 }
 /** Tezahürat (kısa soğuma ile). */
 function cheer(gain=.3){
   const t=typeof performance!=='undefined'?performance.now():Date.now();
   if(t-lastCheer<3500)return false;
   const ok=playExtra('seyirci-tezahurat',{gain});if(ok)lastCheer=t;return ok;
 }
 function silenceAssets(){
   voiceQueue.clear();crowdEntry=null;
   for(const e of [...assetVoices]){try{e.source.stop();}catch{}}
   assetVoices.clear();
 }
 /** Paket 32: plays the fighter's own sound; falls back to the archetype sound when missing. */
 function playFighter(fighterId,key,{character,gain=1}={}){
   const side=character??(isFighterId(fighterId)?fighterSide(fighterId):'fire');
   const own=fighterSfx(fighterId,key);
   if(own&&decoded.has(own))return play(own,{character:side,gain});
   const fallback=fighterFallbackSfx(fighterId,key,side);
   return fallback?play(fallback,{character:side,gain}):false;
 }
 function playCue(character,cue,action){const s=soundForCue(character,cue,action);return s?play(s,{character,gain:s.endsWith('-r')?.88:1}):false;}
 function combat(event){
   if(!event||event.type!=='DAMAGE_APPLIED')return false;
   const character=event.toSeat===2?'rune':'fire';
   return play(event.blocked?'block':event.critical?'critical':'hit',{character,gain:event.blocked?.7:1});
 }
 // Paket 28: düşük can kalp atışı — örnek dosya yok, iki alçak "lub-dub" vuruşu sentezlenir.
 let lastBeat=0;
 function heartbeat(intensity=1){
   if(disposed||muted||volume<=0||!ctx||ctx.state!=='running'||typeof ctx.createOscillator!=='function')return false;
   const nowMs=typeof performance!=='undefined'?performance.now():Date.now();
   if(nowMs-lastBeat<450)return false;lastBeat=nowMs;
   const k=clamp(Number(intensity)||0,0,1);
   const t0=ctx.currentTime+.01;
   for(const [at,freq,peak] of [[0,62,.5],[.17,52,.36]]){
     const osc=ctx.createOscillator(),level=ctx.createGain();
     osc.type='sine';
     osc.frequency.setValueAtTime(freq*1.6,t0+at);osc.frequency.exponentialRampToValueAtTime(freq,t0+at+.06);
     level.gain.setValueAtTime(0.0001,t0+at);
     level.gain.exponentialRampToValueAtTime(Math.max(.0002,peak*(.5+.5*k)),t0+at+.018);
     level.gain.exponentialRampToValueAtTime(.0001,t0+at+.2);
     osc.connect(level);level.connect(master);
     osc.start(t0+at);osc.stop(t0+at+.22);
     osc.onended=()=>{try{osc.disconnect();level.disconnect();}catch{}};
   }
   return true;
 }
 function keyClick(){
   const now=typeof performance!=='undefined'?performance.now():Date.now();
   if(now-lastKey<55)return false;lastKey=now;
   return play('key',{character:'center',gain:.12});
 }
 function setMuted(value){muted=Boolean(value);safeWrite(storage,'tuslab-pvp-sfx-muted',muted);if(muted)stop(true);else if(crowdWanted)startCrowd();setGain();return muted;}
 function setVolume(value){volume=clamp(Number(value)||0,0,1);safeWrite(storage,'tuslab-pvp-sfx-volume',volume);if(volume<=0)stop(true);else if(crowdWanted)startCrowd();setGain();return volume;}
 function setOnPlay(callback){onPlay=typeof callback==='function'?callback:null;}
 /** keepCrowd: sessize alma / ses 0 → seyirci isteği hatırlanır, ses açılınca geri gelir. */
 function stop(keepCrowd=false){for(const source of voices){try{source.stop();}catch{}}voices.clear();silenceAssets();if(keepCrowd!==true)crowdWanted=false;}
 async function dispose(){if(disposed)return;disposed=true;stop();if(ctx){try{await ctx.close();}catch{}}ctx=null;}
 return {preload,preloadFighters,preloadVoices,speak,announce,playExtra,startCrowd,stopCrowd,cheer,unlock,play,playFighter,playCue,combat,keyClick,heartbeat,setMuted,setVolume,setOnPlay,stop,dispose,
   getState:()=>({muted,volume,voices:voices.size,assets:assets.size,speaking:voiceQueue.state(),crowd:Boolean(crowdEntry),loaded:decoded.size,raw:raw.size,fighters:[...fighterLoads.keys()],unlocked:ctx?.state==='running',supported:Boolean(AudioContextClass),disposed})};
}
