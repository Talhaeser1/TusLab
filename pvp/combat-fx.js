/** TuşLab PvP stage 04: visual-only particle and cue director.
 * No sound, HP, network, randomness in authoritative game logic.
 * Maximum six transient particles per stage, all effects self-clean.
 */
export const MAX_PARTICLES = 6;
export const MAX_EFFECTS = 8;
export const MAX_CUES_PER_SECOND = 48;
export const FX_CUES = Object.freeze([
  'charge','blade-trail','strike','embers','ground-smash','aftershock',
  'ward-rise','ward-pulse','damage-react','sparks','ultimate-charge',
  'ultimate-hit','final-blast','victory-flare','defeat-smoke'
]);
export function clampParticles(current, requested, max=MAX_PARTICLES){
  if(!Number.isFinite(current)||!Number.isFinite(requested)||max<0)throw new TypeError('Invalid particle count');
  return Math.min(Math.max(0,Math.floor(requested)),Math.max(0,Math.floor(max-current)));
}
const burstCues=new Set(['strike','ground-smash','ultimate-hit','final-blast','damage-react']);
const cuesWithParticles=new Set(['embers','sparks','strike','ground-smash','ultimate-hit','final-blast','victory-flare']);
const descriptors={
 'charge':'GÜÇ TOPLANIYOR','blade-trail':'KILIÇ İZİ','strike':'KESKİN VURUŞ',
 'embers':'KIVILCIM','ground-smash':'YER SARSINTISI','aftershock':'ŞOK DALGASI',
 'ward-rise':'KALKAN AÇILDI','ward-pulse':'RÜN SAVUNMASI',
 'damage-react':'DARBE ETKİSİ','sparks':'KIVILCIM',
 'ultimate-charge':'ULTİ YÜKLENİYOR','ultimate-hit':'ULTİ KESİŞİ',
 'final-blast':'BİTİRİCİ PATLAMA','victory-flare':'ZAFER','defeat-smoke':'YENİLGİ'
};
export function createCombatFxDirector({root,scheduler=globalThis,motionReduced=()=>false,now=()=>Date.now(),quietLabels=()=>false}={}){
  if(!root?.querySelector)throw new TypeError('An arena stage is required');
  let reduced=false,disposed=false,serial=0;
  const scheduled=new Set();
  const live=new Set();
  const effects=new Set();
  let cueWindow=0,cueCount=0,dropped=0,impactAnimation=null;
  const getLayer=()=>root.querySelector('.pvp4-effects');
  const delay=(fn,ms)=>{
    const handle=scheduler.setTimeout(()=>{scheduled.delete(handle);fn();},ms);
    scheduled.add(handle);return handle;
  };
  function purge(){
    for(const h of scheduled)scheduler.clearTimeout(h);
    scheduled.clear();
    for(const el of live)el.remove();live.clear();
    for(const el of effects)el.remove();effects.clear();
    root.classList.remove('pvp4-impact-jolt','pvp4-fx-ward','pvp4-fx-charging');
    if(impactAnimation){try{impactAnimation.cancel();}catch{}impactAnimation=null;}
    const label=root.querySelector('[data-fx-label]');if(label)label.textContent='';
  }
  function particle(kind,idx,count){
    const layer=getLayer();if(!layer||live.size>=MAX_PARTICLES)return;
    const el=layer.ownerDocument.createElement('i');
    el.className=`pvp4-particle pvp4-particle-${kind}`;
    el.style.setProperty('--pvp4-angle',`${(360/count)*idx+serial*37}deg`);
    el.style.setProperty('--pvp4-distance',`${36+idx*12}px`);
    el.style.setProperty('--pvp4-delay',`${idx*22}ms`);
    layer.appendChild(el);live.add(el);
    delay(()=>{el.remove();live.delete(el);},700);
  }
  function effect(kind,delayMS=680){
    const layer=getLayer();if(!layer)return;
    if(effects.size>=MAX_EFFECTS){const oldest=effects.values().next().value;oldest?.remove();effects.delete(oldest);}
    const el=layer.ownerDocument.createElement('span');
    el.className=`pvp4-effect pvp4-effect-${kind}`;
    layer.appendChild(el);effects.add(el);
    delay(()=>{el.remove();effects.delete(el);},delayMS);
  }
  function play({cue,action}={}){
    if(disposed||!FX_CUES.includes(cue))return false;
    const t=now();
    if(t-cueWindow>=1000||t<cueWindow){cueWindow=t;cueCount=0;}
    if(++cueCount>MAX_CUES_PER_SECOND){dropped++;return false;}
    // KESINYAP 22: rounds'ta havada yüzen efekt adı (KIVILCIM / KILIÇ İZİ / BİTİRİCİ PATLAMA) yazılmaz.
    const label=quietLabels()?null:root.querySelector('[data-fx-label]');
    if(label){label.textContent=descriptors[cue];const n=++serial;
      delay(()=>{if(serial===n)label.textContent='';},760);
    }
    if(motionReduced()||reduced){
      if(cue==='ward-rise'||cue==='ward-pulse')effect('shield-static',320);
      else if(burstCues.has(cue))effect('flash-static',250);
      return true;
    }
    if(cue==='blade-trail')effect('blade',450);
    if(cue==='ground-smash'||cue==='aftershock')effect('wave',800);
    if(cue==='ward-rise')effect('shield',850);
    if(cue==='ward-pulse')effect('shield-ring',490);
    if(cue==='ultimate-charge')effect('charge',620);
    if(cue==='ultimate-hit')effect('blade',450);
    if(cue==='final-blast')effect('explosion',930);
    if(cue==='strike'||cue==='damage-react'||cue==='ultimate-hit'||cue==='final-blast')effect('hitflash',430);
    if(cue==='victory-flare')effect('explosion',930);
    if(cue==='defeat-smoke')effect('smoke',850);
    if(burstCues.has(cue)){
      // Web Animations do not force a synchronous layout read.
      // CSS fallback avoids forced layout measurement on each hit.
      const rig=root.querySelector('.pvp3-model');
      if(typeof rig?.animate==='function'){
        if(impactAnimation){try{impactAnimation.cancel();}catch{}}
        impactAnimation=rig.animate([{transform:'translateX(0)'},{transform:'translateX(-3px)'},{transform:'translateX(4px)'},{transform:'translateX(0)'}],{duration:220,easing:'ease-out'});
      }else{
        root.classList.remove('pvp4-impact-jolt');
        delay(()=>root.classList.add('pvp4-impact-jolt'),0);
        delay(()=>root.classList.remove('pvp4-impact-jolt'),240);
      }
    }
    if(cuesWithParticles.has(cue)){
      const amount=clampParticles(live.size, ['final-blast','ultimate-hit'].includes(cue)?6:4);
      for(let i=0;i<amount;i++)particle(action==='s'?'rune':'spark',i,Math.max(1,amount));
    }
    return true;
  }
  return {
    play,stop:purge,dispose(){purge();disposed=true;},
    setReduced(value){reduced=Boolean(value);if(reduced)purge();},
    isReduced:()=>reduced||motionReduced(),
    stats:()=>({particles:live.size,effects:effects.size,timers:scheduled.size,dropped,disposed})
  };
}
