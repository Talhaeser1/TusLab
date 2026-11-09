import test from 'node:test';
import assert from 'node:assert/strict';
import {
 createMatch,publicMatch,submitWord,resolveDueAttacks,pauseMatch,resumeMatch,
 MATCH_HP,SHIELD_PROBABILITY,DEFENSE_RULES,SERVER_ONLY_EVENTS
} from '../cloudflare/src/match.js';
const names=[{playerId:'p1',seat:1,character:'fire'},{playerId:'p2',seat:2,character:'rune'}];
const start=()=>createMatch(names,1000,'pvp13');
function type(m,seat,at,typed){const p=m.participants[seat-1];const result=submitWord(m,{playerId:p.playerId,matchId:m.id,wordIndex:p.wordIndex,text:typed??p.currentWord},at);assert.ok(result.match,result.error);return result.match;}
function q(){let m=start();m=type(m,1,2000);m=type(m,1,2100);return m;}
const resolve=(m,at,values=[0,0.99])=>resolveDueAttacks(m,at,()=>values.length?values.shift():.99);
test('perfect block window is 150ms; one correct defensive word prevents Q damage',()=>{
 let m=q();m=type(m,2,2220); // 120ms after cast
 const out=resolve(m,2350,[.01,.99]);
 assert.deepEqual(out.events.map(e=>e.type),['SHIELD_TRIGGERED','DAMAGE_APPLIED']);
 assert.equal(out.events[0].kind,'PERFECT_BLOCK');assert.equal(out.match.participants[1].hp,MATCH_HP);
 assert.equal(out.match.participants[1].defenseStats.perfectBlocks,1);
 assert.equal(DEFENSE_RULES.perfectWindowMs,150);
});
test('normal reactive block uses 250ms window and increments only normal blocks',()=>{
 let m=q();m=type(m,2,2320); // 220ms after cast
 const out=resolve(m,2350,[0.01]);
 assert.equal(out.events[0].type,'SHIELD_TRIGGERED');assert.equal(out.events[0].kind,'NORMAL_BLOCK');
 assert.equal(out.match.participants[1].defenseStats.normalBlocks,1);
 assert.equal(out.match.participants[1].defenseStats.perfectBlocks,0);
});
test('parry requires precise timing AND both successful server random draws',()=>{
 let m=q();m=type(m,2,2160);
 let res=resolve(m,2350,[.01,.01]);
 assert.deepEqual(res.events.map(e=>e.type),['PARRY_TRIGGERED','COUNTERATTACK_CAST','DAMAGE_APPLIED']);
 assert.equal(res.match.participants[1].hp,2000);
 assert.equal(res.match.participants[1].defenseStats.parries,1);
 assert.equal(res.match.participants[1].defenseStats.counters,1);
 assert.equal(res.match.participants[0].staggerUntil,2100+DEFENSE_RULES.staggerMs);
 assert.equal(res.match.pendingAttacks.length,1);
 assert.equal(res.match.pendingAttacks[0].unblockable,true);
 res=resolveDueAttacks(res.match,2530,()=>{throw Error('A counter must not roll block RNG');});
 assert.equal(res.match.participants[0].hp,2000-DEFENSE_RULES.counterDamage);
 assert.equal(res.events[0].skill,'counter');
 assert.equal(res.events[0].counter,true);
 assert.equal(res.match.pendingAttacks.length,0);
 assert.equal(resolveDueAttacks(res.match,2600).events.length,0);
});
test('parry roll fails => perfect block only, never grants free counterstrike',()=>{
 let m=q();m=type(m,2,2160);
 const out=resolve(m,2350,[0,.99]);
 assert.deepEqual(out.events.map(e=>e.type),['SHIELD_TRIGGERED','DAMAGE_APPLIED']);
 assert.equal(out.events[0].kind,'PERFECT_BLOCK');
 assert.equal(out.match.pendingAttacks.length,0);
});
test('parry cannot be repeated while S cooldown is active',()=>{
 let m=q();m=type(m,2,2160);m=resolve(m,2350,[0,0]).match;
 m.pendingAttacks.push({fromSeat:1,toSeat:2,skill:'q',character:'fire',issuedAt:3300,resolveAt:3550,amount:105});
 m=type(m,2,3350);
 const out=resolveDueAttacks(m,3550,()=>0);
 assert.equal(out.events.some(e=>e.type==='PARRY_TRIGGERED'),false);
 assert.equal(out.match.participants[1].defenseStats.parries,1);
});
test('E breaks existing ordinary shield and deals 40% damage then expires the ward',()=>{
 const m=start();m.participants[1].shieldUntil=3000;
 m.pendingAttacks.push({fromSeat:1,toSeat:2,skill:'e',character:'fire',issuedAt:2200,resolveAt:2450,amount:175});
 const out=resolveDueAttacks(m,2450,()=>.99);
 assert.deepEqual(out.events.map(e=>e.type),['SHIELD_BROKEN','DAMAGE_APPLIED']);
 assert.equal(out.events[1].amount,70);
 assert.equal(out.match.participants[1].hp,1930);
 assert.equal(out.match.participants[1].shieldUntil,null);
 assert.equal(out.match.participants[1].defenseStats.shieldBreaks,1);
 assert.equal(resolveDueAttacks(out.match,3000).events.length,0);
});
test('R shatters guard with 70% penetration; a perfect block still saves its defender',()=>{
 let m=start();m.participants[1].shieldUntil=3100;
 m.pendingAttacks.push({fromSeat:1,toSeat:2,skill:'r',character:'fire',issuedAt:2200,resolveAt:2450,amount:305});
 const out=resolveDueAttacks(m,2450,()=>.99);
 assert.equal(out.events[0].type,'SHIELD_BROKEN');assert.equal(out.events[1].amount,214);
 m=start();m.participants[1].shieldUntil=3100;m=type(m,2,2230);
 m.pendingAttacks.push({fromSeat:1,toSeat:2,skill:'r',character:'fire',issuedAt:2200,resolveAt:2450,amount:305});
 const blocked=resolve(m,2450,[0,.99]);
 assert.equal(blocked.match.participants[1].hp,2000);
 assert.equal(blocked.events.some(e=>e.type==='SHIELD_BROKEN'),false);
});
test('counter damage can KO but cannot trigger a counter-on-counter loop',()=>{
 let m=start();m.participants[0].hp=25;
 m.pendingAttacks.push({fromSeat:2,toSeat:1,skill:'counter',character:'rune',issuedAt:2000,resolveAt:2180,amount:65,unblockable:true,counter:true});
 m.participants[0].lastWordAt=2000;
 const out=resolveDueAttacks(m,2180,()=>{throw Error('unblockable counter must not roll');});
 assert.equal(out.match.participants[0].hp,0);
 assert.equal(out.match.status,'ended');assert.equal(out.match.winnerSeat,2);
 assert.equal(out.match.pendingAttacks.length,0);
});
test('pause/resume shifts pending counter, cooldown, and parry stun without time loss',()=>{
 let m=q();m=type(m,2,2160);m=resolve(m,2350,[0,0]).match;
 const before=m.pendingAttacks[0].resolveAt;
 const stun=m.participants[0].staggerUntil;
 const paused=pauseMatch(m,2400,[1]);const resumed=resumeMatch(paused,7400);
 assert.equal(resumed.pendingAttacks[0].resolveAt,before+5000);
 assert.equal(resumed.participants[0].staggerUntil,stun+5000);
 assert.equal(resumed.status,'running');
});
test('browser cannot forge perfect block, parry, counterattack or shield break events',()=>{
 for(const e of ['SHIELD_BROKEN','PARRY_TRIGGERED','COUNTERATTACK_CAST'])assert.ok(SERVER_ONLY_EVENTS.has(e));
 const m=start();const clone=publicMatch(m);
 clone.players[0].defenseStats.parries=999;
 assert.equal(m.participants[0].defenseStats.parries,0);
 assert.equal(SHIELD_PROBABILITY,.3);
});
