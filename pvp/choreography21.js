/**
 * TuşLab — Combat Choreography Director (package 21)
 * Cosmetic-only per-character combat choreography. Never computes HP, hit success,
 * timing fairness, or authoritative match events. Stage elements are isolated
 * from the keyboard/typing UI and are cleaned on exit or reduced-motion toggle.
 */
export const CHOREO_LIMITS = Object.freeze({bursts:4, cuesPerSecond:24, hitStopMs:52});
export const CHOREO_PROFILES = Object.freeze({
 fire:Object.freeze({style:'whirl',q:'crescent',e:'flame-fissure',r:'inferno',guard:'ember-guard'}),
 rune:Object.freeze({style:'crusher',q:'rune-cut',e:'rune-quake',r:'seal',guard:'aegis'})
});
const CUE_VARIANTS=Object.freeze({
 'blade-trail':'slash',strike:'hit','ground-smash':'crack','aftershock':'shock',
 'ward-rise':'ward','ward-pulse':'ward-ring','ultimate-charge':'surge',
 'ultimate-hit':'cut','final-blast':'finisher','damage-react':'hit',
 sparks:'sparks',embers:'embers'
});
const BEAT_TYPES=['prelude','assault','finisher'];
export function createChoreographyDirector({stage,id,scheduler=globalThis,reduced=()=>false,now=()=>Date.now()}={}){
 if(!stage?.querySelector||!CHOREO_PROFILES[id])throw new TypeError('Valid stage and character id are required');
 let dead=false,seq=0,hitStopSeq=0,bumpSeq=0,dropped=0,count=0,windowStart=0;
 const timers=new Set(),bursts=new Set();
 const later=(fn,ms)=>{
   const h=scheduler.setTimeout(()=>{timers.delete(h);if(!dead)fn();},ms);
   timers.add(h);return h;
 };
 const isReduced=()=>Boolean(reduced());
 function clearTransient(){
   seq++;hitStopSeq++;bumpSeq++;
   for(const timer of timers)scheduler.clearTimeout(timer);
   timers.clear();for(const item of bursts)item.remove();bursts.clear();
   stage.classList.remove('pvp21-hitstop','pvp21-bump','pvp21-guard');
   stage.removeAttribute('data-choreo-beat');
 }
 function addBurst(type,ms=680){
   if(dead)return false;
   if(isReduced())return true;
   const layer=stage.querySelector('.pvp21-layer');if(!layer)return false;
   if(bursts.size>=CHOREO_LIMITS.bursts){const oldest=bursts.values().next().value;oldest?.remove();bursts.delete(oldest);}
   const el=layer.ownerDocument.createElement('span');
   el.className=`pvp21-burst pvp21-${type}`;
   el.setAttribute('aria-hidden','true');
   layer.appendChild(el);bursts.add(el);
   later(()=>{el.remove();bursts.delete(el);},ms);
   return true;
 }
 function hitStop(ms=CHOREO_LIMITS.hitStopMs){
   if(dead||isReduced())return;
   const n=++hitStopSeq;
   stage.classList.add('pvp21-hitstop');
   later(()=>{if(n===hitStopSeq)stage.classList.remove('pvp21-hitstop');},Math.min(75,Math.max(30,ms)));
 }
 function onMotion({state,action}={}){
   if(dead)return false;
   if(!state||!action)return false;
   stage.dataset.choreoState=state;
   stage.dataset.choreoAction=action;
   if(state==='idle'||state==='defeat'||state==='victory'){
     // An old delayed release must not interrupt the new action.
     seq++;hitStopSeq++;bumpSeq++;stage.classList.remove('pvp21-hitstop','pvp21-bump');
   }
   return true;
 }
 function onCue({cue,action}={}){
   if(dead||!CUE_VARIANTS[cue])return false;
   const t=now();if(t<windowStart||t-windowStart>=1000){windowStart=t;count=0;}
   if(++count>CHOREO_LIMITS.cuesPerSecond){dropped++;return false;}
   const kind=CUE_VARIANTS[cue];
   if(kind==='ward'||kind==='ward-ring'){
     stage.classList.add('pvp21-guard');
     later(()=>stage.classList.remove('pvp21-guard'),560);
   }
   if(['hit','crack','cut','finisher'].includes(kind)){
     // 52 ms of local visual hit-stop; NOT a pause of the match timer/typing.
     hitStop();
     // Only the stage backdrop jolts; the textarea is outside this element.
     if(!isReduced()){
       stage.classList.remove('pvp21-bump');
       const n=++bumpSeq; stage.classList.add('pvp21-bump');
       later(()=>{if(n===bumpSeq)stage.classList.remove('pvp21-bump');},240);
     }
   }
   // The existing phase-04 VFX director still owns its own capped particle effects.
   if(['slash','crack','shock','ward','surge','cut','finisher'].includes(kind))addBurst(kind,kind==='finisher'?950:680);
   return true;
 }
 function onUltimateBeat(phase){
   if(dead||!Number.isInteger(phase)||phase<1||phase>3)return false;
   stage.dataset.choreoBeat=String(phase);
   if(!isReduced())addBurst(BEAT_TYPES[phase-1],phase===3?1000:620);
   const n=++seq;
   later(()=>{if(seq===n)stage.removeAttribute('data-choreo-beat');},800);
   return true;
 }
 function onDefense(kind){
   if(dead||!['BLOCK','PERFECT_BLOCK','PARRY','SHIELD_BROKEN','COUNTERATTACK'].includes(kind))return false;
   if(!isReduced())addBurst(kind==='SHIELD_BROKEN'?'fracture':kind==='PARRY'?'parry':kind==='COUNTERATTACK'?'counter':'aegis',800);
   if(kind==='PARRY'||kind==='SHIELD_BROKEN')hitStop(58);
   return true;
 }
 function setReduced(){clearTransient();}
 function stop(){clearTransient();seq++;stage.removeAttribute('data-choreo-state');stage.removeAttribute('data-choreo-action');}
 function dispose(){if(dead)return;stop();dead=true;}
 return {onMotion,onCue,onUltimateBeat,onDefense,setReduced,stop,dispose,stats:()=>({active:bursts.size,timers:timers.size,dropped,disposed:dead})};
}
