// KESINYAP iş 12 — raund/pencere sonu eşzamanı: çözüm süresi bekleyen vuruşlardan SAF planla ölçeklenir,
// motor (sunucu = istemci) ve görsel kuyruk aynı sabitleri kullanır; raund arası kartı son sahne bitince açılır.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,submitWord,advanceMatch,nextDeadline,publicMatch,
  ROUND_SUMMARY_MS,ROUND_INTRO_MS} from '../pvp/shared/match.js';
import {planResolve,resolveDurationMs,RESOLVE_SCENE,VISUAL_TURN,sceneMs} from '../pvp/shared/resolve-timing.js';
import * as server from '../cloudflare/src/match.js';
import * as visual from '../pvp/visual-timeline.js';
import {createArenaMatch,submitArenaWord,advanceArenaMatch,nextArenaDeadline} from '../pvp/shared/arena.js';

const atk=(fromSeat,skill='q',extra={})=>({fromSeat,skill,...extra});
const alt=n=>Array.from({length:n},(_,i)=>atk(i%2?2:1,i%5===4?'e':i===7||i===26?'r':'q'));

test('planResolve saf ve deterministik: aynı girdi → aynı süre, girdi değişmez',()=>{
  const list=alt(9);const copy=structuredClone(list);
  const a=planResolve(list),b=planResolve(structuredClone(list));
  assert.equal(a.totalMs,b.totalMs);
  assert.deepEqual(a.scenes.map(s=>[s.seat,s.kind,s.items.length,s.startMs]),b.scenes.map(s=>[s.seat,s.kind,s.items.length,s.startMs]));
  assert.deepEqual(list,copy);
  assert.equal(resolveDurationMs(list),a.totalMs);
  assert.equal(resolveDurationMs([]),0);
});

test('tek vuruş = giriş + yakın sahne + yerleşme; saldıran değişimi ve aynı saldıran arası sabitlerden',()=>{
  const {leadMs,meleeMs,tailMs,turnMs,sameSeatMs,ultMs}=RESOLVE_SCENE;
  assert.equal(resolveDurationMs([atk(1)]),leadMs+meleeMs+tailMs);
  assert.equal(resolveDurationMs([atk(1),atk(2)]),leadMs+2*meleeMs+turnMs+tailMs);
  assert.equal(resolveDurationMs([atk(1,'r')]),leadMs+ultMs+tailMs);
  // Aynı saldıranın iki q'su: zincir 1 iken iki yaklaşma (aralarında sameSeatMs).
  assert.equal(resolveDurationMs([atk(1),atk(1)]),leadMs+2*meleeMs+sameSeatMs+tailMs);
});

test('görsel zaman çizelgesi motorla AYNI sabit/fonksiyonu kullanır (ayrışamaz)',()=>{
  assert.equal(visual.planResolve,planResolve);
  assert.equal(visual.resolveDurationMs,resolveDurationMs);
  assert.equal(visual.TURN.breathMs,VISUAL_TURN.breathMs);
  assert.equal(visual.TURN.sameSeatMs,VISUAL_TURN.sameSeatMs);
  // Motor planı görsel aradan uzun (üst sınır): görsel hiç birikmez.
  assert.ok(RESOLVE_SCENE.turnMs>=visual.TURN.breathMs);
  assert.ok(RESOLVE_SCENE.sameSeatMs>=visual.TURN.sameSeatMs);
});

test('≤ 20 sn sınırı: önce zincir uzar, son çare koltuk başına TEK toplu sahne; hiçbir vuruş kaybolmaz',()=>{
  for(const n of [4,8,12,20,40]){
    const list=alt(n);const plan=planResolve(list);
    // Ulti sahnesi sıkıştırılmaz/katlanmaz: ikinci ve sonraki ultiler sınırın üstüne kendi süresini ekleyebilir.
    const ults=list.filter(a=>a.skill==='r').length;
    assert.ok(plan.totalMs<=RESOLVE_SCENE.maxMs+Math.max(0,ults-1)*RESOLVE_SCENE.ultMs,`n=${n}: ${plan.totalMs}`);
    assert.equal(plan.slots.size,n,'her vuruşun yuvası var');
    // Yaklaşma başına görünür vuruş ≤ maxChain; fazlası (fold) son temas karesinde toplu.
    for(const [i,s] of plan.scenes.entries())if(s.kind==='melee')assert.ok(s.items.filter(a=>!plan.slots.get(a).fold).length<=RESOLVE_SCENE.maxChain,`sahne ${i}`);
    // Sıra korunur: her koltuğun vuruşları kendi içinde sırayla (yuva başlangıçları azalmaz).
    // (katlanan toplu vuruşlar hariç: onlar koltuğun toplu temas karesine taşınır)
    for(const seat of [1,2]){const t=list.filter(a=>a.fromSeat===seat&&!plan.slots.get(a).fold).map(a=>plan.slots.get(a).startMs);assert.deepEqual(t,[...t].sort((x,y)=>x-y));}
    const folds=plan.scenes.filter(s=>s.kind==='fold');
    assert.ok(new Set(folds.map(s=>s.seat)).size===folds.length,'koltuk başına en çok bir toplu sahne');
  }
  // 12 vuruş: zincirleme devrede (en az bir sahnede >1 vuruş).
  assert.ok(planResolve(alt(12)).scenes.some(s=>s.items.length>1));
  // 40 vuruş: toplu sahne devrede.
  assert.ok(planResolve(alt(40)).scenes.some(s=>s.kind==='fold'));
  assert.equal(sceneMs({kind:'fold',items:[]}),RESOLVE_SCENE.meleeMs);
});

const T0=10_000;
const players=()=>[{playerId:'a',seat:1,character:'fire',name:'A'},{playerId:'b',seat:2,character:'rune',name:'B'}];
const seatOf=(m,seat)=>m.participants.find(p=>p.seat===seat);
function type(api,m,seat,at){
  const p=seatOf(m,seat);const word=m.round.words[p.roundWordIndex];
  const out=api.submitWord(m,{playerId:p.playerId,matchId:m.id,wordIndex:p.wordIndex,text:word,round:m.round.index},at);
  assert.ok(out.match,'submit: '+out.error);return out.match;
}
/** Kelime raundu: seat 1 bitirir, seat 2 yarıda kalır → çözüm → kart. Döner: adım adım olaylar. */
function playCountedRound(api){
  let m=api.createMatch(players(),T0,'rs1',{rounds:true,roundStyle:'counted',resolveAtEnd:true,seed:'k12'});
  let at=T0+3500;const all=[];
  const n=m.round.words.length;
  for(let i=0;i<n;i++){
    m=type(api,m,1,at);at+=300;
    if(i<n-2&&m.round.phase==='round'){m=type(api,m,2,at);at+=300;}
  }
  for(let guard=0;guard<200&&m.status==='running'&&m.round.phase!=='intermission';guard++){
    const d=api.nextDeadline(m);if(d===null)break;at=Math.max(at,d);
    const step=api.advanceMatch(m,at,()=>0.99);all.push({at,phase:step.match.round?.phase,events:step.events,roundEvents:step.roundEvents,m:step.match});m=step.match;
  }
  return {m,all};
}

test('raund sonu: kart (intermission) çözüm planı bitince açılır; nextRoundAt = çözüm sonu + ÖZET + GİRİŞ',()=>{
  const {m,all}=playCountedRound({createMatch,submitWord,advanceMatch,nextDeadline});
  const resolveStep=all.find(s=>s.phase==='resolve');
  assert.ok(resolveStep,'çözüm fazı');
  const until=resolveStep.m.round.resolveUntil;
  assert.ok(Number.isFinite(until));
  const hits=all.flatMap(s=>s.events).filter(e=>e.type==='DAMAGE_APPLIED');
  assert.ok(hits.length>0);
  assert.ok(hits.every(e=>(e.at??0)<=until),'tüm vuruşlar plan bitişinden önce');
  assert.equal(m.round.phase,'intermission');
  const end=all.flatMap(s=>s.roundEvents.map(e=>({...e,at:s.at}))).find(e=>e.type==='ROUND_END');
  assert.ok(end&&end.at>=until,'kart son sahne + yerleşme bitmeden açılmaz');
  assert.equal(m.round.nextRoundAt,until+ROUND_SUMMARY_MS+ROUND_INTRO_MS);
  // Hasar kaybolmaz / değişmez: can düşüşü = DAMAGE_APPLIED toplamı.
  const lost=seat=>seatOf(m,seat).maxHp-seatOf(m,seat).hp;
  const dealt=seat=>hits.filter(e=>e.toSeat===seat).reduce((s,e)=>s+e.amount,0);
  assert.equal(lost(1),dealt(1));assert.equal(lost(2),dealt(2));
  assert.equal(publicMatch(resolveStep.m,1).round.resolveEndsAt,until);
});

test('sunucu (cloudflare/src/match.js) ile istemci aynı sonucu üretir',()=>{
  const a=playCountedRound({createMatch,submitWord,advanceMatch,nextDeadline});
  const b=playCountedRound(server);
  assert.deepEqual(b.m,a.m);
  // Sunucu girişi ortak motoru yeniden ihraç eder (ek ihracat yasak: tests/pvp-practice.test.mjs) → planlayan kod aynı.
  assert.equal(server.advanceMatch,advanceMatch);
});

test('resolveAtEnd: aynı raunttaki ultilerin kimliği benzersiz (istemci kopya sanıp sahnesiz göstermesin)',()=>{
  let m=createMatch(players(),T0,'ul1',{rounds:true,roundStyle:'timed',resolveAtEnd:true,seed:'k12'});
  let at=m.round.startedAt+100;
  // KESINYAP 21 (kullanıcı kuralı: dört yetenek, ulti yalnız 10 seride): seri 10 → r; 11. kelime yanlış (10→5) → 5 doğru daha → seri 10 → ikinci ulti.
  for(let i=0;i<16;i++){
    const p=seatOf(m,1);const w=i===10?'yanlışxx':publicMatch(m,1).round?.words?.[p.roundWordIndex];
    const out=submitWord(m,{playerId:p.playerId,matchId:m.id,wordIndex:p.wordIndex,text:w,round:m.round.index},at);
    if(out.match)m=out.match;at+=400;
  }
  const ids=m.pendingAttacks.filter(a=>a.skill==='r').map(a=>a.ultimateId);
  assert.ok(ids.length>=2,'en az iki ulti: '+ids.length);
  assert.equal(new Set(ids).size,ids.length);
});

test('toplu temas: 30 bekleyen vuruş aynı karede teslim (taşma yok), en çok 3 tam darbe (kare donması olmasın)',async()=>{
  const {createImpactDirector}=await import('../pvp/impact-feel.js');
  let t=0,contacts=0;const got=[];let ready=false;
  const d=createImpactDirector({now:()=>t,isReduced:()=>false,contact:()=>{contacts++;},deliver:(e,scene)=>got.push([e.id,scene])});
  for(let i=0;i<30;i++)d.queue({id:i,amount:10,skill:'q'},()=>ready,9000);
  d.flush();assert.equal(got.length,0,'temastan önce hiçbiri gösterilmez (16 sınırı taşmıyor)');
  ready=true;t=100;d.flush();
  assert.equal(got.length,30);assert.equal(contacts,3);
  assert.deepEqual(got.map(g=>g[0]),[...Array(30).keys()],'sıra korunur');
});

test('arena raund sonu: özet kartı plan bitişinden önce açılmaz, vuruşlar plan içinde',()=>{
  let m=createArenaMatch(players(),T0,'ar1',{seed:'k12'});
  let at=T0;
  for(let g=0;g<40&&m.round.phase!=='round';g++){const d=nextArenaDeadline(m);at=Math.max(at,d??at+100);m=advanceArenaMatch(m,at).match;}
  for(let i=0;i<8;i++)for(const seat of [1,2]){
    const p=m.participants.find(x=>x.seat===seat);const word=m.round.words?.[p.wordIndex]??p.currentWord;
    const out=submitArenaWord(m,{playerId:p.playerId,matchId:m.id,wordIndex:p.wordIndex,text:word,round:m.round.index},at+=200);
    if(out.match)m=out.match;
  }
  let until=null,summaryAt=null;const hitsAt=[];
  for(let g=0;g<200&&m.status==='running'&&summaryAt===null;g++){
    const d=nextArenaDeadline(m);if(d===null)break;at=Math.max(at,d);
    const step=advanceArenaMatch(m,at);m=step.match;
    if(m.round.phase==='resolve')until=m.round.resolveUntil;
    for(const e of step.events||[])if(e.type==='ARENA_ATTACK')hitsAt.push(at);
    if(m.round.phase==='summary')summaryAt=at;
  }
  if(until===null)return; // kimse doğru yazamadıysa (tohuma bağlı) çözüm yok
  assert.ok(hitsAt.every(t=>t<=until));
  assert.ok(summaryAt===null||summaryAt>=until,'özet kartı plan bitişinden önce açılmaz');
});
