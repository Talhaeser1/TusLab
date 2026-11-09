/** Work package 14: deterministic, reproducible server-engine balance model.
 * Uses actual createMatch/submitWord/resolveDueAttacks. Not a live player study.
 * Usage: node scripts/pvp14-balance.mjs [rounds=120]
 */
import {createMatch,submitWord,resolveDueAttacks,finishMatch,CYCLE_DAMAGE,ULTIMATE_PHASES} from '../cloudflare/src/match.js';
function rng(seed){let state=seed>>>0;return ()=>((state=(1664525*state+1013904223)>>>0)/4294967296);}
function duel({fireWpm=60,runeWpm=60,accuracy=.95,seed=2026}){
 const random=rng(seed);
 const players=[{playerId:'fire',seat:1,character:'fire'},{playerId:'rune',seat:2,character:'rune'}];
 let m=createMatch(players,0,`simulation-${seed}`);
 const next=[1200,1200];let actions=0;
 while(m.status==='running'&&actions++<800){
  const seat=next[0]<=next[1]?0:1;const p=m.participants[seat];const at=next[seat];
  if(at>=m.endsAt)break;
  const due=resolveDueAttacks(m,at,random);m=due.match;if(m.status!=='running')break;
  const correct=random()<accuracy;
  const submitted=correct?p.currentWord:'!';
  const result=submitWord(m,{playerId:p.playerId,matchId:m.id,wordIndex:p.wordIndex,text:submitted},at);
  if(!result.match)throw new Error(result.error);
  m=result.match;
  const wpm=seat===0?fireWpm:runeWpm;
  // WPM is normalized to 5 characters; punctuation and spaces add typing effort.
  const charCount=[...p.currentWord].length+1;
  next[seat]=at+Math.max(270,charCount*60_000/(wpm*5));
 }
 if(m.status==='running')m=resolveDueAttacks(m,m.endsAt,random).match;
 if(m.status==='running')m=finishMatch(m,m.endsAt);
 return {winner:m.winnerSeat,hp:m.participants.map(p=>p.hp),words:m.participants.map(p=>p.correctWords),reason:m.endReason};
}
export function summarize({fireWpm,runeWpm,accuracy=.95,rounds=120}){
 let fire=0,rune=0,ties=0;let hpFire=0,hpRune=0;
 for(let i=0;i<rounds;i++){
  const result=duel({fireWpm,runeWpm,accuracy,seed:20261031+i*1777});
  fire+=Number(result.winner===1);rune+=Number(result.winner===2);ties+=Number(result.winner===null);
  hpFire+=result.hp[0];hpRune+=result.hp[1];
 }
 return {fireWpm,runeWpm,accuracy,rounds,fireWins:fire,runeWins:rune,draws:ties,avgHpFire:Math.round(hpFire/rounds),avgHpRune:Math.round(hpRune/rounds)};
}
if(process.argv[1]?.endsWith('pvp14-balance.mjs')){
 const rounds=Math.min(500,Math.max(1,Number(process.argv[2]||120)));
 console.log('DETERMINISTIC MODEL (not a real-world latency / skill study)');
 console.log('Cycle budgets:',CYCLE_DAMAGE,'ulti phases',Object.fromEntries(Object.entries(ULTIMATE_PHASES).map(([k,v])=>[k,v.map(x=>x.damage)])));
 console.table([
  summarize({fireWpm:30,runeWpm:30,accuracy:.95,rounds}),
  summarize({fireWpm:60,runeWpm:60,accuracy:.95,rounds}),
  summarize({fireWpm:90,runeWpm:90,accuracy:.95,rounds}),
  summarize({fireWpm:60,runeWpm:90,accuracy:.95,rounds}),
  summarize({fireWpm:90,runeWpm:60,accuracy:.95,rounds}),
  summarize({fireWpm:60,runeWpm:60,accuracy:.90,rounds})
 ]);
}
