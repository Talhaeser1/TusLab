// Cosmetic contact policy. No DOM, three.js, game state or network dependency.
export const IMPACT_TIERS = Object.freeze({
  small: Object.freeze({hitstopMs:50, trauma:.2, flashMs:60, slowMs:0, slowScale:1, zoom:.08}),
  medium: Object.freeze({hitstopMs:90, trauma:.45, flashMs:75, slowMs:0, slowScale:1, zoom:.16}),
  large: Object.freeze({hitstopMs:120, trauma:.8, flashMs:90, slowMs:320, slowScale:.3, zoom:.38}),
});
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
export function impactTier(e={}) {
  if(e.type==='KNOCKOUT')return 'large';
  // Ulti: yalnız ana vuruş (faz 2 ya da fazsız) yavaş çekimli 'large'; çekiş (1) ve iniş (3) 'medium' —
  // her fazda 320 ms yavaş çekim ulti sahnesini ~4 sn'ye uzatıyordu (tavan ~3 sn).
  if(e.skill==='r')return e.phase===1||e.phase===3 ? 'medium' : 'large';
  if(e.super||e.amount>=140)return 'large';
  return e.skill==='q'||e.skill==='e'||e.critical||e.bonusTags?.length||e.amount>=40 ? 'medium':'small';
}
/**
 * Görev 4 — saf hasar tepkisi politikası: 'knockdown' | 'heavy' | 'hit' | 'trace'.
 * knockdown: can 0'a düştü (hpAfter≤0) ya da KNOCKOUT olayı.
 * heavy: bitirici vuruş (kombo son teması) / ulti / ≥140 hasar.
 * trace: aynı savunan üst üste 180 ms içinde tekrar darbe → hafif titreme, yeni tepki yok.
 */
export const HIT_REACTION = Object.freeze({windowMs: 180, heavyDamage: 140});
export function hitReaction(e={}, {lastAt = -Infinity, now = 0, windowMs = HIT_REACTION.windowMs} = {}) {
  const hpAfter = Number(e.hpAfter);
  if (e.type === 'KNOCKOUT' || (Number.isFinite(hpAfter) && hpAfter <= 0)) return 'knockdown';
  if (e.finisher || e.skill === 'r' || e.super || (Number(e.amount) || 0) >= HIT_REACTION.heavyDamage) return 'heavy';
  if (Number.isFinite(lastAt) && Number.isFinite(now) && now - lastAt <= windowMs) return 'trace';
  return 'hit';
}
export function createImpactState() {
  return {trauma:0,punch:0,zoom:0,timeScale:1,stopId:0,stopUntil:0,slowUntil:0,lastStopAt:-Infinity};
}
export function addTrauma(s,amount) { s.trauma=clamp(s.trauma+amount,0,1); }
export function beginHitstop(s,now,ms) {
  s.stopUntil=now+ms; s.timeScale=.05; return ++s.stopId;
}
export function restoreHitstop(s,id,now) {
  if(id!==s.stopId||now<s.stopUntil)return false;
  s.stopUntil=0; s.timeScale=now<s.slowUntil ? IMPACT_TIERS.large.slowScale : 1; return true;
}
export function resetImpact(s) {
  const id=s.stopId+1; Object.assign(s,createImpactState(),{stopId:id});
}
export function triggerImpact(s,event,now,reduced=false) {
  const tier=impactTier(event), spec=IMPACT_TIERS[tier];
  if(reduced) { resetImpact(s); return {tier,...spec,hitstopMs:0}; }
  addTrauma(s,spec.trauma);
  const power=clamp((Number(event.amount)||40)/140,.2,1.3);
  s.punch=clamp(s.punch+(event.fromSeat===2?-1:1)*(.08+.18*power),-.4,.4);
  s.zoom=Math.min(.6,s.zoom+spec.zoom*power);
  s.slowUntil=spec.slowMs ? now+spec.hitstopMs+spec.slowMs : s.slowUntil;
  beginHitstop(s,now,spec.hitstopMs);
  return {tier,...spec};
}
// Pure frame policy: safe to sample repeatedly without advancing the live state.
export function sampleImpact(input,dt,now,reduced=false) {
  const s=reduced ? {...createImpactState(),stopId:input.stopId+1} : {...input};
  s.trauma=Math.max(0,s.trauma-1.6*Math.max(0,dt));
  const blend=1-Math.exp(-12*Math.max(0,dt));
  s.punch+=(0-s.punch)*blend; s.zoom+=(0-s.zoom)*blend;
  if(Math.abs(s.punch)<.00001)s.punch=0;
  if(s.zoom<.00001)s.zoom=0;
  s.timeScale=now<s.stopUntil ? .05 : now<s.slowUntil ? IMPACT_TIERS.large.slowScale : 1;
  const shake=s.trauma*s.trauma*.22, t=now/1000;
  return {state:s,frame:{shakeX:(Math.sin(t*71.3)+Math.sin(t*43.1+1.3))*.5*shake,
    shakeY:(Math.sin(t*59.7+2.1)+Math.sin(t*37.9))*.5*shake,
    punch:s.punch,zoom:s.zoom,timeScale:s.timeScale}};
}
export function stepImpact(s,dt,now,reduced=false) {
  const next=sampleImpact(s,dt,now,reduced);
  Object.assign(s,next.state);
  return next.frame;
}

// Owns delivery once per received damage event. Render adapters reuse the existing
// fighter tracks, FX pools, damage text and sound implementation.
export function createImpactDirector({now,isReduced,contact,deliver}) {
  const state=createImpactState(), pending=[];
  const seen=new WeakSet();
  function hit(event,scene=true) {
    if(seen.has(event))return;
    seen.add(event);
    if(scene){
      const time=now();
      const canStop=time-state.lastStopAt>=400;
      const spec=event.blocked ? {...IMPACT_TIERS.small,hitstopMs:0}
        : canStop ? triggerImpact(state,event,time,isReduced()) : {...IMPACT_TIERS[impactTier(event)],hitstopMs:0};
      if(canStop&&!event.blocked&&!isReduced())state.lastStopAt=time;
      try { contact(event,spec); } catch { /* presentation adapters are optional */ }
    }
    deliver(event,scene);
  }
  return {state,
    queue(event,ready,deadlineMs) {
      // A dropped/replaced visual cue must never retain an unbounded backlog.
      if(pending.length>=16)hit(pending.shift().event,false);
      pending.push({event,ready,deadline:now()+(deadlineMs||(event.skill==='r'?5000:2400))});
    },
    flush() { for(let i=0;i<pending.length;i++) {
      const p=pending[i], ready=p.ready(); if(!ready&&now()<p.deadline)continue;
      pending.splice(i--,1); hit(p.event,ready);
    } },
    hit,
    silent(event) { hit(event,false); },
    clear() { pending.length=0; resetImpact(state); },
  };
}
