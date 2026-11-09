/** Cosmetic-only cross-arena projectile visuals. No changes to HP or server game state. */
export const MAX_PROJECTILES=4;
export const MAX_IMPACTS=2;
export function createProjectileDirector({root,motionReduced=()=>false,scheduler=globalThis}={}){
 if(!root?.querySelector)throw new TypeError('PvP arena is required');
 const active=new Set();let dead=false;
 function dropOldest(){const old=active.values().next().value;if(old){scheduler.clearTimeout(old.timer);old.element.remove();active.delete(old);}}
 function launch({fromSeat=1,skill='q',character='fire'}={}){
   if(dead)return false;
   const board=root.querySelector('.pvp2-duel');if(!board)return false;
   if(motionReduced())return true;
   while([...active].filter(r=>r.kind==='projectile').length>=MAX_PROJECTILES||active.size>=MAX_PROJECTILES+MAX_IMPACTS)dropOldest();
   const element=board.ownerDocument.createElement('span');
   const safeCharacter=character==='rune'?'rune':'fire';
   const safeSkill=['q','e','r'].includes(skill)?skill:'q';
   element.className=`pvp10-projectile pvp10-${safeCharacter} pvp10-${safeSkill}`;
   element.dataset.from=String(fromSeat);
   element.setAttribute('aria-hidden','true');
   board.appendChild(element);
   const record={element,timer:null,kind:'projectile'};
   record.timer=scheduler.setTimeout(()=>{element.remove();active.delete(record);},safeSkill==='r'?1050:520);
   active.add(record);return true;
 }
 function impact({toSeat=2,blocked=false}={}){
   if(dead)return false;const board=root.querySelector('.pvp2-duel');if(!board)return false;
   if(motionReduced())return true;
   while([...active].filter(r=>r.kind==='impact').length>=MAX_IMPACTS||active.size>=MAX_PROJECTILES+MAX_IMPACTS)dropOldest();
   const el=board.ownerDocument.createElement('span');el.className='pvp10-cross-impact'+(blocked?' pvp10-cross-block':'');
   el.dataset.to=String(toSeat);el.setAttribute('aria-hidden','true');board.appendChild(el);
   const record={element:el,timer:null,kind:'impact'};
   record.timer=scheduler.setTimeout(()=>{el.remove();active.delete(record);},530);
   active.add(record);return true;
 }
 function stop(){for(const r of active){scheduler.clearTimeout(r.timer);r.element.remove();}active.clear();}
 return {launch,impact,stop,dispose(){stop();dead=true;},stats:()=>({active:active.size,disposed:dead})};
}
