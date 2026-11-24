/** PvP raund modu denge simülasyonu (RAPOR-PVP-KALANLAR §2). Gerçek motor (pvp/shared/match.js) + practice.js bot
 * yazma modeli (botWordDelay/makeTypo/BOT_DIFFICULTIES) + bot zekâsı (bot-ai.js) İKİ tarafta. Tohumlu, ağsız.
 * Kullanım: node scripts/pvp-denge-sim.mjs [maç/eşleşme=300] [zorluk=orta] [a,b çiftleri…]
 * Aynı arketipli eşleşmeler (ör. vargr–sira) için karakter motor durumuna maçtan sonra yazılır: raund modunda hasar
 * iki arketipte eşit (ROUND_DAMAGE), karakter farkı E türü (kalkan/can) + bot kişiliğidir. Koltuk her maçta değişir. */
import {createMatch,submitWord,advanceMatch,nextDeadline,pickRoundSkill,ROUND_TIME_SKILLS} from '../pvp/shared/match.js';
import {BOT_DIFFICULTIES,botWordDelay,makeTypo} from '../pvp/practice.js';
import {botContext,decideBotPlan,pickBotTimeSkill,personaOf,applyPlan} from '../pvp/shared/bot-ai.js';
import {fighterDefense,FIGHTER_IDS} from '../pvp/shared/fighters.js';
import {createRng} from '../pvp/shared/words.js';

export function simMatch({a,b,diffA='orta',diffB=diffA,seed=1,swap=false,assist=true}){
  const seatOf={[swap?2:1]:{fighter:a,diff:diffA,tag:'A'},[swap?1:2]:{fighter:b,diff:diffB,tag:'B'}};
  const rng=createRng(`sim:${seed}`);
  const players=[1,2].map(seat=>({playerId:`p${seat}`,seat,name:`P${seat}`,character:seat===1?'fire':'rune',fighter:seatOf[seat].fighter,rune:'none'}));
  let m=createMatch(players,0,`sim-${seed}`,{rounds:7,roundStyle:'timed',content:'kelime',seed:`sim-${seed}`,resolveAtEnd:true,assist,stage:'colosseum'});
  for(const p of m.participants)p.fighter=seatOf[p.seat].fighter; // aynı arketipli eşleşmeler için
  const bots={1:null,2:null};
  for(const seat of [1,2])bots[seat]={profile:BOT_DIFFICULTIES[seatOf[seat].diff],ai:createRng(`sim:${seed}:ai${seat}`),next:Infinity,plan:null};
  const me=seat=>m.participants.find(p=>p.seat===seat);
  const canType=seat=>m.status==='running'&&m.round?.phase==='round'&&!me(seat).roundDone;
  const plan=seat=>{const bot=bots[seat];const d=decideBotPlan(botContext(m,seat,0),personaOf(me(seat).fighter),bot.ai,fighterDefense(me(seat).fighter));return bot.plan=applyPlan(bot.profile,d.plan);};
  const startRound=at=>{for(const seat of [1,2]){const bot=bots[seat];if(!canType(seat)){bot.next=Infinity;continue;}const [lo,hi]=bot.profile.startDelayMs;bot.next=at+lo+rng()*(hi-lo)+botWordDelay(me(seat).currentWord,plan(seat),rng);}};
  const onStep=(step,at)=>{
    m=step.match;
    if(step.roundEvents?.some(e=>e.type==='ROUND_END')){bots[1].next=bots[2].next=Infinity;
      if(m.status==='running')for(const seat of [1,2]){
        const diff=seatOf[seat].diff;const chance={kolay:.2,orta:.45,zor:.7}[diff];
        const available=ROUND_TIME_SKILLS.filter(id=>(me(seat).roundSkillUses?.[id]||0)<2);
        const skill=pickBotTimeSkill(botContext(m,seat,at),personaOf(me(seat).fighter),bots[seat].ai,{available,chance});
        if(skill){const o=pickRoundSkill(m,{playerId:`p${seat}`,skill},at);if(!o.error)m=o.match;}
      }}
    if(step.roundEvents?.some(e=>e.type==='ROUND_START'))startRound(at);
  };
  startRound(0);
  let guard=0;let hits={1:0,2:0},maxHit=0;const bySkill={};
  const count=evs=>{for(const e of evs||[])if(e.type==='DAMAGE_APPLIED'&&e.amount>0){hits[e.fromSeat]=(hits[e.fromSeat]||0)+1;maxHit=Math.max(maxHit,e.amount);const k=e.assist?'assist':e.skill||'?';bySkill[k]=(bySkill[k]||0)+e.amount;}};
  while(m.status==='running'&&guard++<200000){
    const dl=nextDeadline(m)??Infinity;
    const seat=bots[1].next<=bots[2].next?1:2;const wordAt=bots[seat].next;
    if(dl===Infinity&&wordAt===Infinity)break;
    if(dl<=wordAt){const step=advanceMatch(m,dl,rng);count(step.events);if(step.match===m){bots[1].next=Math.max(bots[1].next,dl+1);}onStep(step,dl);continue;}
    const at=wordAt;const pre=advanceMatch(m,at,rng);count(pre.events);onStep(pre,at);
    if(!canType(seat)){bots[seat].next=Infinity;continue;}
    const p=me(seat);const word=p.currentWord;
    const text=rng()<bots[seat].plan.typo?makeTypo(word,rng):word;
    const out=submitWord(m,{matchId:m.id,wordIndex:p.wordIndex,text,round:m.round.index,playerId:`p${seat}`},at);
    if(out.error){bots[seat].next=at+50;continue;}
    m=out.match;count(out.result?.cast?[out.result.cast]:[]);
    const rev=out.result?.roundEvents||[];if(rev.length)onStep({match:m,roundEvents:rev},at);
    const post=advanceMatch(m,at,rng);count(post.events);onStep(post,at);
    bots[seat].next=canType(seat)?at+botWordDelay(me(seat).currentWord,plan(seat),rng):Infinity;
  }
  const winSeat=m.winnerSeat;const winner=winSeat?seatOf[winSeat].tag:null;
  return {winner,rounds:m.round?.index??0,reason:m.endReason,maxHit,hits:hits[1]+hits[2],bySkill};
}

export function simPair(a,b,{n=300,diff='orta',seed0=1000}={}){
  let wa=0,wb=0,dr=0,rounds=0,ko=0,maxHit=0,hits=0;const dmg={};
  for(let i=0;i<n;i++){const r=simMatch({a,b,diffA:diff,seed:`${a}-${b}-${diff}-${seed0+i}`,swap:i%2===1});
    if(r.winner==='A')wa++;else if(r.winner==='B')wb++;else dr++;rounds+=r.rounds;ko+=r.reason==='KNOCKOUT'?1:0;maxHit=Math.max(maxHit,r.maxHit);hits+=r.hits;for(const [k,v] of Object.entries(r.bySkill))dmg[k]=(dmg[k]||0)+v/r.rounds/2;}
  return {a,b,n,diff,winA:wa/n,winB:wb/n,draw:dr/n,avgRounds:rounds/n,ko:ko/n,maxHit,avgHits:hits/n,dmgPerRound:Object.fromEntries(Object.entries(dmg).map(([k,v])=>[k,Math.round(v/n)]))};
}
const pct=x=>(x*100).toFixed(1);
if(process.argv[1]?.endsWith('pvp-denge-sim.mjs')){
  const n=Number(process.argv[2]||300),diff=process.argv[3]||'orta';
  const ids=FIGHTER_IDS;const pairs=process.argv[4]?process.argv[4].split(';').map(s=>s.split(',')):ids.flatMap((x,i)=>ids.slice(i+1).map(y=>[x,y]));
  for(const [a,b] of pairs){const r=simPair(a,b,{n,diff});console.log(`${a}-${b}\t${pct(r.winA)}\t${pct(r.winB)}\tdraw ${pct(r.draw)}\trounds ${r.avgRounds.toFixed(2)}\tko ${pct(r.ko)}\tmaxHit ${r.maxHit}\thits ${r.avgHits.toFixed(1)}${process.env.SIM_DMG?'\tdmg/raund/oyuncu '+JSON.stringify(r.dmgPerRound):''}`);}
}
