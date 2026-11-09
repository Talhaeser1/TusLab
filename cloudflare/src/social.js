/** PvP 17 — guest social graph. All mutations are serialized inside PvPProfiles DO.
 * A friend code is an address, NOT an authentication credential.
 */
export const PROFILE_ID=/^[a-f0-9]{64}$/;
export const FRIEND_CODE=/^[A-F0-9]{12}$/;
export const ROOM_CODE=/^[A-Z2-9]{16}$/;
export const friendCode=id=>id.slice(0,12).toUpperCase();
export const initialSocial=()=>({friends:[],incoming:[],outgoing:[],blocked:[],invites:[],sentAt:[]});
export const cap=(items,size=40)=>items.slice(0,size);
export const linked=(a,b)=>a.friends.includes(b);
export const isBlocked=(a,b)=>a.blocked.includes(b);
export const cleanInvites=(social,now=Date.now())=>({...social,invites:social.invites.filter(i=>i.expiresAt>now).slice(-15)});
export const SOCIAL_ACTIONS=new Set(['request','accept','reject','remove','block','unblock','cancel','invite','dismiss']);
export const socialError=(code,status=400)=>({error:code,status});
export function updateSocialPair(action,actor,target,actorId,targetId,now=Date.now()) {
  const a=structuredClone(actor),b=structuredClone(target);
  if(isBlocked(a,targetId)||isBlocked(b,actorId))return socialError('BLOCKED',403);
  if(action==='request'){
    if(linked(a,targetId))return socialError('ALREADY_FRIENDS',409);
    if(b.incoming.includes(actorId)||a.outgoing.includes(targetId))return socialError('ALREADY_PENDING',409);
    if(a.incoming.includes(targetId))return socialError('ACCEPT_INSTEAD',409);
    if(a.outgoing.length>=20||b.incoming.length>=20)return socialError('REQUEST_LIMIT',429);
    const recent=a.sentAt.filter(t=>t>now-86400000);
    if(recent.length>=12)return socialError('DAILY_LIMIT',429);
    a.sentAt=cap([...recent,now],12);a.outgoing.push(targetId);b.incoming.push(actorId);
  } else if(action==='accept'){
    if(!a.incoming.includes(targetId)||!b.outgoing.includes(actorId))return socialError('REQUEST_NOT_FOUND',404);
    if(a.friends.length>=80||b.friends.length>=80)return socialError('FRIENDS_LIMIT',429);
    a.incoming=a.incoming.filter(x=>x!==targetId);b.outgoing=b.outgoing.filter(x=>x!==actorId);
    a.friends.push(targetId);b.friends.push(actorId);
  } else if(action==='reject'){
    if(!a.incoming.includes(targetId))return socialError('REQUEST_NOT_FOUND',404);
    a.incoming=a.incoming.filter(x=>x!==targetId);b.outgoing=b.outgoing.filter(x=>x!==actorId);
  } else if(action==='cancel'){
    if(!a.outgoing.includes(targetId))return socialError('REQUEST_NOT_FOUND',404);
    a.outgoing=a.outgoing.filter(x=>x!==targetId);b.incoming=b.incoming.filter(x=>x!==actorId);
  } else if(action==='remove'){
    if(!linked(a,targetId))return socialError('NOT_FRIENDS',404);
    a.friends=a.friends.filter(x=>x!==targetId);b.friends=b.friends.filter(x=>x!==actorId);
  } else return socialError('INVALID_ACTION');
  return {a,b};
}
