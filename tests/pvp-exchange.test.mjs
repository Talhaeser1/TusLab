import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,submitWord,advanceMatch,nextDeadline,publicMatch,MATCH_HP,ROUND_HP,roundDurationMs,planResolve,RESOLVE_SCENE} from '../pvp/shared/match.js';
// KESINYAP mekanik: sayılı raund süresi kelime sayısına bağlı; testlerde "varsayılan raund süresi" = varsayılan sayılı raund (10 kelime → 60 sn).
const ROUND_DURATION_MS=roundDurationMs({});

const players=[{playerId:'a',seat:1,character:'fire'},{playerId:'b',seat:2,character:'rune'}];
function write(m,seat,at){
  const p=m.participants.find(x=>x.seat===seat);
  const out=submitWord(m,{playerId:p.playerId,matchId:m.id,wordIndex:p.wordIndex,text:p.currentWord,round:m.round?.index},at);
  assert.ok(out.match,out.error);return out.match;
}
function drain(m,at){const seen=[];for(let i=0;i<50&&m.status==='running';i++){
  const due=nextDeadline(m);if(due===null||due>at)break;
  const step=advanceMatch(m,due,()=>0.99);assert.notEqual(step.match,m);
  seen.push(...step.events,...step.roundEvents);m=step.match;
}return {m,seen};}

test('classic exchange holds damage, alternates turns and opens the next ten-second window',()=>{
  let m=createMatch(players,0,'classic',{exchangeMs:10000});
  for(const [seat,at] of [[1,100],[2,200],[1,300],[2,400],[1,500],[2,600],[1,700],[2,800]])m=write(m,seat,at);
  assert.deepEqual(m.participants.map(p=>p.hp),[MATCH_HP,MATCH_HP]);
  assert.equal(m.combatEvents.length,0);
  assert.deepEqual(publicMatch(m).exchange,{index:1,endsAt:10000,phase:'typing'});
  let step=advanceMatch(m,10000,()=>0.99);m=step.match;
  assert.equal(step.roundEvents[0].type,'EXCHANGE_RESOLVE');
  assert.deepEqual(step.roundEvents[0].payload,{index:1,turns:4});
  assert.equal(publicMatch(m).exchange.phase,'resolve');
  assert.equal(submitWord(m,{playerId:'a',matchId:m.id,wordIndex:4,text:'x'},10001).error,'EXCHANGE_NOT_ACTIVE');
  const plan=planResolve(m.pendingAttacks.slice().sort((a,b)=>a.turn-b.turn),{maxMs:RESOLVE_SCENE.exchangeMaxMs});
  const result=drain(m,10000+plan.totalMs);m=result.m;
  const damage=result.seen.filter(e=>e.type==='DAMAGE_APPLIED');
  // İş 12: sahneler koltuklar arasında dönüşümlü; 4 vuruş 14 sn'ye sığmadığı için aynı saldıranın 2 vuruşu tek yaklaşmada.
  assert.deepEqual(damage.map(e=>[e.fromSeat,e.turn]),[[1,1],[1,3],[2,2],[2,4]]);
  assert.ok(damage.every(e=>e.resolve===true));
  assert.ok(result.seen.filter(e=>e.type==='SKILL_CAST').every(e=>e.resolve===true));
  // Sonraki pencere çözüm planı (son sahne + yerleşme) bitince başlar ve tam 10 sn sürer.
  assert.ok(plan.totalMs<=RESOLVE_SCENE.exchangeMaxMs);
  assert.deepEqual(publicMatch(m).exchange,{index:2,endsAt:10000+plan.totalMs+10000,phase:'typing'});
  assert.ok(result.seen.some(e=>e.type==='EXCHANGE_START'&&e.payload.index===2));
});

test('round resolve waits for typing to end, then applies alternating attacks',()=>{
  let m=createMatch(players,0,'rounds',{rounds:5,seed:2,resolveAtEnd:true});
  for(let i=0;i<5;i++){m=write(m,1,100+i*200);m=write(m,2,200+i*200);}
  assert.deepEqual(m.participants.map(p=>p.hp),[ROUND_HP,ROUND_HP]);
  assert.equal(m.combatEvents.length,0);
  let step=advanceMatch(m,ROUND_DURATION_MS,()=>0.99);m=step.match;
  assert.equal(m.round.phase,'resolve');
  assert.equal(step.roundEvents[0].type,'ROUND_RESOLVE');
  const result=drain(m,ROUND_DURATION_MS+30000);m=result.m;
  const damage=result.seen.filter(e=>e.type==='DAMAGE_APPLIED'&&e.phase===undefined);
  // İş 12: sahneler dönüşümlü; aynı saldıranın vuruşları tek yaklaşmada zincirlenir (çözüm ≤ 20 sn).
  assert.deepEqual(damage.map(e=>[e.fromSeat,e.turn]),[[1,1],[1,3],[2,2],[2,4]]);
  assert.ok(damage.every(e=>e.resolve===true));
  assert.ok(result.seen.some(e=>e.type==='ROUND_END'));
});

test('unconfigured createMatch retains immediate casts and deferred 250 ms damage',()=>{
  let m=createMatch(players,0,'legacy');m=write(m,1,100);m=write(m,1,200);
  assert.equal(m.combatEvents[0].type,'SKILL_CAST');
  assert.equal(m.combatEvents[0].resolve,undefined);
  assert.equal(nextDeadline(m),450);
});

test('resolve-time shield and parry events carry the attack turn',()=>{
  let m=createMatch(players,0,'shield',{exchangeMs:10000});
  m=write(m,1,100);m=write(m,1,200);
  m=advanceMatch(m,10000,()=>0).match;
  const step=advanceMatch(m,nextDeadline(m),()=>0);
  assert.ok(step.events.some(e=>e.type==='PARRY_TRIGGERED'&&e.resolve===true&&e.turn===1));
  assert.ok(step.events.some(e=>e.type==='DAMAGE_APPLIED'&&e.blocked&&e.turn===1));
  assert.equal(step.match.participants[1].hp,MATCH_HP);
});

test('exchange KO cancels the remaining queued attacks',()=>{
  let m=createMatch(players,0,'ko',{exchangeMs:10000});
  for(const [seat,at] of [[1,100],[2,200],[1,300],[2,400]])m=write(m,seat,at);
  m.participants.find(p=>p.seat===2).hp=1;
  m=advanceMatch(m,10000,()=>0.99).match;
  m=advanceMatch(m,nextDeadline(m),()=>0.99).match;
  assert.equal(m.status,'ended');assert.equal(m.winnerSeat,1);
  assert.equal(m.pendingAttacks.length,0);
});

// İş 12: eski "vuruşlar arası ≥ RESOLVE_STEP_MS" kuralı sahne kuralına dönüştü: farklı SAHNELER (yaklaşmalar) arası
// en az tek sahne süresi + ara; aynı sahnedeki zincir vuruşları sahne başında birlikte çözülür, görsel temas karesinde gösterir.
test('saldırılar sıra sıra: sahneler arası en az bir sahne süresi + ara (animasyon üst üste binmesin)', () => {
  let m=createMatch(players,0,'classic',{exchangeMs:10000});
  for(const [seat,at] of [[1,100],[2,200],[1,300],[2,400],[1,500],[2,600],[1,700],[2,800]])m=write(m,seat,at);
  m=advanceMatch(m,10000,()=>0.99).match;
  const casts=drain(m,40000).seen.filter(e=>e.type==='SKILL_CAST');
  const starts=[...new Map(casts.map(e=>[e.scene,e.at])).values()].sort((a,b)=>a-b);
  assert.ok(starts.length>=2);
  for(let i=1;i<starts.length;i++)assert.ok(starts[i]-starts[i-1]>=RESOLVE_SCENE.meleeMs+RESOLVE_SCENE.sameSeatMs,`sahne ${i}: ${starts[i]-starts[i-1]} ms`);
  const perScene=new Map();for(const e of casts)perScene.set(e.scene,(perScene.get(e.scene)||0)+1);
  assert.ok([...perScene.values()].every(n=>n<=RESOLVE_SCENE.maxChain));
  for(const e of casts)assert.equal(new Set(casts.filter(x=>x.scene===e.scene).map(x=>x.fromSeat)).size,1,'sahnede tek saldıran');
});

test('arena çözüm aralığı vuruş sayısına göre 450–1100 ms, toplam ~12 sn', async () => {
  const {arenaResolveStep} = await import('../pvp/shared/arena.js');
  assert.equal(arenaResolveStep(4), 1100);
  assert.equal(arenaResolveStep(40), 450);
  assert.ok(arenaResolveStep(20) * 20 <= 12000);
});
