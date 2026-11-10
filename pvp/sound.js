/**
 * TuşLab / PvP work package 10 — original sampled audio + Web Audio mixing.
 * Audio assets are procedurally authored for TuşLab, never extracted from games.
 * The server remains authoritative; audio may only respond to confirmed cues.
 * Paket 32: character-specific SFX (<fighter>-q/e/r/hit/ko) are lazy — fetched only via
 * preloadFighters(ids) for the fighters of the current match; missing files fall back to the
 * archetype sound (fire-q / rune-e / hit / defeat …).
 */
import {FIGHTER_IDS,isFighterId,fighterSide} from './shared/fighters.js';
export const SFX_NAMES=Object.freeze([
 'fire-q','fire-e','fire-r','rune-q','rune-e','rune-r','shield','block','hit','critical','victory','defeat','key','perfect','parry','counter','shatter',
 'prep','skill-lock','round-start','scramble','time-thief','time-freeze','blind-clock','clash','attack-turn','word-correct','word-wrong'
]);
/** Paket 32: per-fighter keys. Not part of SFX_NAMES so the eager preload stays unchanged. */
export const FIGHTER_SFX_KEYS=Object.freeze(['q','e','r','hit','ko']);
export const FIGHTER_SFX_NAMES=Object.freeze(FIGHTER_IDS.flatMap(id=>FIGHTER_SFX_KEYS.map(key=>`${id}-${key}`)));
export const ALL_SFX_NAMES=Object.freeze([...SFX_NAMES,...FIGHTER_SFX_NAMES]);
const KNOWN_SFX=new Set(ALL_SFX_NAMES);
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
       const name=`${id}-${key}`;
       try{const response=await fetcher(baseURL+name+'.wav');if(!response.ok)throw new Error(`HTTP ${response.status}`);raw.set(name,await response.arrayBuffer());}
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
 function setMuted(value){muted=Boolean(value);safeWrite(storage,'tuslab-pvp-sfx-muted',muted);if(muted)stop();setGain();return muted;}
 function setVolume(value){volume=clamp(Number(value)||0,0,1);safeWrite(storage,'tuslab-pvp-sfx-volume',volume);if(volume<=0)stop();setGain();return volume;}
 function setOnPlay(callback){onPlay=typeof callback==='function'?callback:null;}
 function stop(){for(const source of voices){try{source.stop();}catch{}}voices.clear();}
 async function dispose(){if(disposed)return;disposed=true;stop();if(ctx){try{await ctx.close();}catch{}}ctx=null;}
 return {preload,preloadFighters,unlock,play,playFighter,playCue,combat,keyClick,heartbeat,setMuted,setVolume,setOnPlay,stop,dispose,
   getState:()=>({muted,volume,voices:voices.size,loaded:decoded.size,raw:raw.size,fighters:[...fighterLoads.keys()],unlocked:ctx?.state==='running',supported:Boolean(AudioContextClass),disposed})};
}
