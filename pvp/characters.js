/**
 * TuşLab PvP / Phase 03
 * Layered raster puppet + testable event-based animation controller.
 * This stage ONLY previews animations: no damage, networking, XP or scoring.
 */
export const MOTIONS = Object.freeze({
  q:Object.freeze([{state:'anticipation',ms:145},{state:'attack',ms:380},{state:'recovery',ms:210}]),
  e:Object.freeze([{state:'anticipation',ms:230},{state:'heavy',ms:585},{state:'recovery',ms:260}]),
  s:Object.freeze([{state:'shield',ms:780},{state:'recovery',ms:160}]),
  hit:Object.freeze([{state:'hit',ms:510},{state:'recovery',ms:190}]),
  r:Object.freeze([{state:'anticipation',ms:300},{state:'ultimate',ms:1430},{state:'recovery',ms:330}]),
  victory:Object.freeze([{state:'victory',ms:0}]),
  defeat:Object.freeze([{state:'defeat',ms:0}]),
  idle:Object.freeze([{state:'idle',ms:0}]),
});
const VALID_CHARS=new Set(['fire','rune']);
export const MOTION_NAMES = Object.freeze({
  idle:'Bekleme', anticipation:'Hazırlık',attack:'Hızlı Saldırı',heavy:'Yıkıcı Darbe',
  shield:'Kalkan',hit:'Darbe Aldı',ultimate:'ULTRA YETENEK',recovery:'Toparlanma',
  victory:'Zafer',defeat:'Yenilgi'
});
export const MOTION_KEYS=Object.freeze({q:'q',e:'e',s:'s',r:'r',hit:'hit',victory:'victory',defeat:'defeat',idle:'idle'});
export function validateCharacterId(value){return VALID_CHARS.has(value);}

/**
 * Controller has a deterministic queue, bounded to avoid DOM/sound floods.
 * Consecutive events play in order; 'hit', 'victory', 'defeat', 'idle' interrupt.
 * The same API will accept server-confirmed events in later packages.
 */
/**
 * Local visual-only events measured from each action's START (milliseconds).
 * Onset/impact timings are independent of network state; no HP is modified.
 * Attack → impact → recovery is deterministic and interruptible.
 */
export const MOTION_CUES = Object.freeze({
  q:Object.freeze([{at:0,type:'charge'},{at:155,type:'blade-trail'},{at:290,type:'strike'},{at:335,type:'embers'}]),
  e:Object.freeze([{at:0,type:'charge'},{at:235,type:'blade-trail'},{at:480,type:'ground-smash'},{at:600,type:'aftershock'}]),
  s:Object.freeze([{at:0,type:'ward-rise'},{at:235,type:'ward-pulse'},{at:550,type:'ward-pulse'}]),
  hit:Object.freeze([{at:0,type:'damage-react'},{at:130,type:'sparks'}]),
  r:Object.freeze([{at:0,type:'ultimate-charge'},{at:320,type:'blade-trail'},{at:520,type:'ultimate-hit'},{at:810,type:'blade-trail'},{at:1020,type:'ultimate-hit'},{at:1280,type:'ground-smash'},{at:1490,type:'final-blast'}]),
  victory:Object.freeze([{at:0,type:'victory-flare'}]),
  defeat:Object.freeze([{at:0,type:'defeat-smoke'}]),
  idle:Object.freeze([])
});
// Phase 14: presentation times mirror the two unique authoritative R hit patterns.
// Cosmetic cues do NOT decide damage; only ULTIMATE_PHASE/DAMAGE_APPLIED from the room do.
export const CHARACTER_ULTIMATE_CUES=Object.freeze({
  fire:Object.freeze([
    {at:0,type:'ultimate-charge'},{at:130,type:'blade-trail'},
    {at:250,type:'ultimate-hit'},{at:340,type:'blade-trail'},
    {at:430,type:'ultimate-hit'},{at:550,type:'blade-trail'},
    {at:670,type:'final-blast'}]),
  rune:Object.freeze([
    {at:0,type:'ultimate-charge'},{at:150,type:'ground-smash'},
    {at:250,type:'ultimate-hit'},{at:440,type:'aftershock'},
    {at:510,type:'ultimate-hit'},{at:660,type:'ground-smash'},
    {at:790,type:'final-blast'}])
});
export function createCharacterController({id,onChange=()=>{},onCue=()=>{},scheduler=globalThis}={}) {
  if(!validateCharacterId(id))throw new TypeError('Unknown character id');
  if(typeof onChange!=='function'||typeof onCue!=='function')throw new TypeError('Callbacks must be functions');
  let state='idle',active=null,timers=new Set(),queue=[],disposed=false,epoch=0;
  const inform=(next,event)=>{state=next;onChange({id,state,action:event,queued:queue.length});};
  const schedule=(fn,ms)=>{
    let handle=scheduler.setTimeout(()=>{timers.delete(handle);fn();},ms);
    timers.add(handle);
  };
  const clear=()=>{for(const timer of timers)scheduler.clearTimeout(timer);timers.clear();epoch++;};
  function start(action){
    if(disposed)return false;
    const phases=MOTIONS[action];if(!phases)return false;
    active=action;const token=++epoch;
    for(const cue of (action==='r'?CHARACTER_ULTIMATE_CUES[id]:MOTION_CUES[action])||[]){
      if(cue.at===0)onCue({id,action,cue:cue.type,at:cue.at});
      else schedule(()=>{if(!disposed&&token===epoch)onCue({id,action,cue:cue.type,at:cue.at});},cue.at);
    }
    let elapsed=0;
    for(const phase of phases){
      if(elapsed===0)inform(phase.state,action);
      else schedule(()=>{if(!disposed&&token===epoch)inform(phase.state,action);},elapsed);
      elapsed+=phase.ms;
    }
    if(elapsed){
      schedule(()=>{
        if(disposed||token!==epoch)return;
        active=null;inform('idle',action);
        if(queue.length)start(queue.shift());
      },elapsed);
    } else active=null; // persistent victory/defeat/idle pose
    return true;
  }
  function trigger(action){
    if(disposed||!Object.hasOwn(MOTIONS,action))return false;
    const interrupts=['hit','victory','defeat','idle'].includes(action);
    if(interrupts){clear();queue=[];active=null;return start(action);}
    if(active){if(queue.length>=3)return false;queue.push(action);return true;}
    clear();return start(action); // reset stale cue timers after persistent poses
  }
  function dispose(){if(disposed)return;clear();disposed=true;queue=[];active=null;}
  return {trigger,dispose,getState:()=>({id,state,active,queued:queue.slice(),disposed,pendingTimers:timers.size})};
}

export function rigMarkup(id){
  if(!validateCharacterId(id))throw new TypeError('Unknown rig');
  const local=id==='fire'?'Alev Celladı':'Rün Muhafızı';
  return `<div class="pvp3-rig pvp3-rig-${id}" data-rig="${id}" data-motion="idle" role="img" aria-label="${local}: gövdesi, silah kolu ve kalkan kolu bağımsız hareket eden animasyonlu savaşçı">
    <div class="pvp3-model">
      <img class="pvp3-piece pvp3-core" src="./assets/rig/${id}-core.webp" alt="" draggable="false" />
      <img class="pvp3-piece pvp3-guard" src="./assets/rig/${id}-guard.webp" alt="" draggable="false" />
      <img class="pvp3-piece pvp3-weapon" src="./assets/rig/${id}-weapon.webp" alt="" draggable="false" />
    </div>
  </div>`;
}
