// Şerit F — raund ve yazı mekanikleri: roundStyle/roundWords, sayaç, çözüm süresi, başlık çakışması, eşik tek kaynak.
import test,{beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createMatch,publicMatch,submitWord,advanceMatch,nextDeadline,resolveStepMs,
  ROUND_WORDS,ROUND_WORD_PLAN,ROUND_VIEW_AHEAD,roundDurationMs,ROUND_SUMMARY_MS,ROUND_INTRO_MS,ROUND_SETTLE_MS,
  RESOLVE_STEP_MS,RESOLVE_MIN_STEP_MS,RESOLVE_BUDGET_MS,SKILL_THRESHOLDS,STREAK_SKILLS,normalizeRoundStyle,
  roundSkillMs,DEFAULT_ROUND_STYLE,RESOLVE_SCENE} from '../pvp/shared/match.js';
// KESINYAP mekanik: sayılı raund süresi kelime sayısına bağlı; testlerde "varsayılan raund süresi" = varsayılan sayılı raund (10 kelime → 60 sn).
const ROUND_DURATION_MS=roundDurationMs({});
import {roundsViewModel,phaseOverdueMs,PHASE_STALL_MS} from '../pvp/rounds-ui.js';
import {SKILL_THRESHOLDS as SKILLBAR_THRESHOLDS,readSkillState} from '../pvp/skillbar.js';
import {createPracticeSession,HUMAN_ID} from '../pvp/practice.js';
import {PvPRoom} from '../cloudflare/src/room.js';

const T0=10_000;
const players=()=>[{playerId:'a',seat:1,character:'fire',name:'A'},{playerId:'b',seat:2,character:'rune',name:'B'}];
const make=(opts={})=>createMatch(players(),T0,'f1',{rounds:5,seed:123,...opts});
const seatOf=(m,seat)=>m.participants.find(p=>p.seat===seat);
const NO_BLOCK=()=>0.99;
function type(m,seat,at,{wrong=false}={}){
  const p=seatOf(m,seat);const word=m.round.words[p.roundWordIndex];
  const out=submitWord(m,{playerId:p.playerId,matchId:m.id,wordIndex:p.wordIndex,text:wrong?word+'x':word,round:m.round.index},at);
  assert.ok(out.match,'submit failed: '+out.error);return out;
}

// ── 1. roundStyle / roundWords ────────────────────────────────────────────────
test('F1: varsayılan timed (Zamana Karşı); roundWords seçeneği yok sayılır, kelime raundu planı sabit',()=>{
  // KESINYAP 11: 'Kelime sayısı 5/10/15' seçeneği kalktı; plan [5,7,9,10,10,10,15].
  const m=make({roundWords:15});
  assert.equal(m.roundStyle,'timed');assert.equal(DEFAULT_ROUND_STYLE,'timed');assert.equal(m.round.style,undefined);
  assert.equal(m.roundWords,undefined);
  const c=make({roundStyle:'counted',roundWords:15});
  assert.equal(c.roundStyle,'counted');assert.equal(c.round.words.length,ROUND_WORD_PLAN[0]);
  assert.equal(normalizeRoundStyle('x'),'timed');assert.equal(normalizeRoundStyle('counted'),'counted');assert.equal(normalizeRoundStyle('timed'),'timed');
  assert.equal(ROUND_WORDS,10,'ani ölüm raundu kelime sayısı');
});
test('F1: counted planlanan kelime sayısı kadar kelime verir ve tüm kelimeler bitince raund biter',()=>{
  // KESINYAP 11: 1. raund 5, 2. raund 7 kelime (roundWords seçeneği etkisiz).
  let m=make({roundWords:20,roundStyle:'counted'});
  for(const n of ROUND_WORD_PLAN.slice(0,2)){
    assert.equal(m.round.words.length,n);
    for(let i=0;i<n;i++)m=type(m,1,m.round.startedAt+500+i*100).match;
    assert.equal(seatOf(m,1).roundDone,true,`n=${n}`);
    assert.equal(publicMatch(m,1).round.words.length,n);assert.equal(publicMatch(m,1).round.wordCount,n);
    m=advanceMatch(m,m.round.endsAt+ROUND_SETTLE_MS+5000,NO_BLOCK).match;m=advanceMatch(m,m.round.nextRoundAt,NO_BLOCK).match;
  }
});
test('F1: timed — kelime sayısıyla bitmez, kuyruk deterministik uzar, ekran boş kalmaz',()=>{
  const run=()=>{
    let m=make({roundStyle:'timed',roundWords:5});
    for(let i=0;i<60;i++){
      m=type(m,1,T0+500+i*100).match;
      const p=seatOf(m,1);
      assert.ok(p.currentWord&&p.currentWord.length>0,'kelime boş kaldı: '+i);
      assert.ok(m.round.words.length>=p.roundWordIndex+ROUND_VIEW_AHEAD+1);
      assert.equal(p.roundDone,false);
    }
    return m;
  };
  const a=run(),b=run();
  assert.deepEqual(a.round.words,b.round.words,'aynı tohum aynı kelimeleri üretmeli');
  assert.ok(a.round.words.length>=64);
  assert.equal(a.round.allDone,false);
});
test('F1: timed roundDone yalnızca süreyle — süre dolunca raund kapanır',()=>{
  let m=make({roundStyle:'timed',roundWords:5});
  for(let i=0;i<30;i++)m=type(m,1,T0+500+i*100).match;
  assert.equal(nextDeadline(m)<=m.round.endsAt,true);
  const ended=advanceMatch(m,m.round.endsAt+ROUND_SETTLE_MS+1,NO_BLOCK);
  assert.ok(ended.roundEvents.some(e=>e.type==='ROUND_END'));
});
test('F1: timed anlık görüntü yalnız pencereyi taşır (küçük), words[roundWordIndex] doğru kelimedir',()=>{
  let m=make({roundStyle:'timed',roundWords:5});
  for(let i=0;i<40;i++)m=type(m,1,T0+500+i*100).match;
  const view=publicMatch(m,1);
  const me=view.players.find(p=>p.seat===1);
  assert.equal(view.round.style,'timed');
  assert.equal(view.round.words[me.roundWordIndex],me.currentWord);
  const real=view.round.words.filter(Boolean);
  assert.ok(real.length<=ROUND_VIEW_AHEAD+1+2,'pencere en fazla geri2+mevcut+ileri4');
  // KESINYAP 11: 8+ seride her doğru kelime Q attığı için olay tamponu (en çok 24 olay) dolabilir; tampon sınırı ayrıca doğrulanır,
  // boyut ölçümü raund/oyuncu bölümleri için yapılır (pencere sabit kalmalı).
  assert.ok(view.combatEvents.length<=24,'olay tamponu 24 ile sınırlı');
  assert.ok(JSON.stringify({...view,combatEvents:[]}).length<4096,'anlık görüntü şişmemeli');
  assert.ok(!view.round.words.slice(0,me.roundWordIndex-2).some(Boolean),'geçmiş kelime metni gönderilmez');
  // gerçek kuyruktaki kelimeler sunucuda kalır
  assert.ok(m.round.words.length>view.round.words.length-1);
});
test('F1: counted anlık görüntü hâlâ tüm listeyi içerir (eski davranış)',()=>{
  const m=make({roundStyle:'counted'});const v=publicMatch(m,1);
  assert.equal(v.round.style,'counted');assert.deepEqual(v.round.words,m.round.words);
});

// ── 1b. sunucu doğrulaması ───────────────────────────────────────────────────
const original={Response:globalThis.Response,WebSocketPair:globalThis.WebSocketPair,WebSocketRequestResponsePair:globalThis.WebSocketRequestResponsePair};
let last;
class Sock{constructor(){this.readyState=1;this.messages=[];this.attachment=null;}
 send(x){this.messages.push(JSON.parse(x));}serializeAttachment(a){this.attachment=structuredClone(a);}deserializeAttachment(){return structuredClone(this.attachment);}
 close(code=1000){this.readyState=3;this.code=code;}}
class Pair{constructor(){this.client=new Sock();this.server=new Sock();last=this.server;}}
class FakeResponse{constructor(_,p={}){this.status=p.status??200;this.webSocket=p.webSocket;this.headers=new Headers(p.headers);}}
beforeEach(()=>{globalThis.Response=FakeResponse;globalThis.WebSocketPair=Pair;globalThis.WebSocketRequestResponsePair=class {};});
afterEach(()=>Object.assign(globalThis,original));
function fixture(){const sockets=[],store=new Map();const f={alarm:null};
 const ctx={getWebSockets:()=>sockets.filter(s=>s.readyState===1),acceptWebSocket:s=>sockets.push(s),setWebSocketAutoResponse(){},
  storage:{get:async k=>structuredClone(store.get(k)),put:async(k,v)=>store.set(k,structuredClone(v)),setAlarm:async t=>{f.alarm=t;},deleteAll:async()=>store.clear()}};
 return Object.assign(f,{ctx,room:new PvPRoom(ctx,{})});
}
const token=i=>`${String(i).repeat(8)}-1234-4123-8123-${String(i).repeat(12)}-12345678-1234-4123-8123-${String(i).repeat(12)}`;
const request=(room,ws,type,payload={})=>room.webSocketMessage(ws,JSON.stringify({version:1,type,payload}));
async function join(room,i){await room.fetch(new Request('https://local.test/connect',{headers:{Upgrade:'websocket'}}));const ws=last;
 await request(room,ws,'JOIN',{name:`Oyuncu ${i}`,character:i===1?'fire':'rune',resumeToken:token(i)});return ws;}
test('F1: oda MATCH_CONFIG roundStyle alanını izinli listeyle doğrular, roundWords artık reddedilir',async()=>{
  // KESINYAP 11: kelime sayısı ayarı kalktı; roundWords her değerde reddedilir ve maça geçmez.
  const f=fixture();await f.room.fetch(new Request('https://local.test/initialize',{method:'POST'}));
  const a=await join(f.room,1);await join(f.room,2);
  const errors=code=>a.messages.filter(m=>m.type==='ERROR'&&m.payload.code===code).length;
  for(const bad of [{roundStyle:'hack'},{roundStyle:1}])await request(f.room,a,'MATCH_CONFIG',bad);
  assert.equal(errors('INVALID_MATCH_CONFIG'),2);
  for(const bad of [{roundWords:4},{roundWords:10},{roundWords:12}])await request(f.room,a,'MATCH_CONFIG',bad);
  assert.equal(errors('INVALID_ROUNDS'),3);
  await request(f.room,a,'MATCH_CONFIG',{roundStyle:'counted'});
  const data=await f.room.roster();
  assert.equal(data.roundStyle,'counted');assert.equal(data.roundWords,undefined);
  const s=f.room.summary(data);assert.equal(s.roundStyle,'counted');assert.equal(s.roundWords,undefined);
  const started=f.room.startMatch(data,Date.now());
  assert.equal(started.match.roundStyle,'counted');assert.equal(started.match.round.words.length,5);assert.equal(started.match.totalRounds,7);
});
test('F1: timed raund bölümü uzun akışta şişmez (pencere sabit; gelen mesaj sınırı 4096 B değişmedi)',()=>{
  let m=make({roundStyle:'timed',roundWords:20});
  let early=0;
  for(let i=0;i<120;i++){
    m=type(m,1,T0+500+i*60).match;m=type(m,2,T0+520+i*60).match;
    if(i===30)early=JSON.stringify(publicMatch(m,1).round).length;
  }
  const late=JSON.stringify(publicMatch(m,1).round).length;
  assert.ok(late<early+3*120,`raund bölümü ${early} → ${late} B`); // yalnız '' dolgusu (3 B/kelime) büyür
  assert.ok(late<900);
  assert.match(readFileSync(new URL('../cloudflare/src/room.js',import.meta.url),'utf8'),/const MAX_BYTES=4096;/);
});

// ── 2. sayaç, çözüm süresi ───────────────────────────────────────────────────
test('F2: resolveStepMs aralığı saldırı sayısına göre kısalır, alt sınırı korur, çözüm bütçesini aşmaz',()=>{
  assert.equal(resolveStepMs(1),RESOLVE_STEP_MS);assert.equal(resolveStepMs(4),RESOLVE_STEP_MS);
  assert.equal(resolveStepMs(10),600);
  assert.equal(resolveStepMs(100),RESOLVE_MIN_STEP_MS);
  for(const n of [1,3,5,8,12,17])assert.ok(resolveStepMs(n)*n<=RESOLVE_BUDGET_MS+n,`n=${n}`);
});
// İş 12: eski 6 sn bütçesi görsel sahnelere (~4,5 sn/yaklaşma) sığmıyordu → kart sahneler sürerken açılıyordu.
// Yeni kural: çözüm süresi bekleyen vuruşlardan saf planla (resolve-timing.js) ölçeklenir, üst sınır RESOLVE_SCENE.maxMs.
test('F2: çok sayıda birikmiş saldırı ≤ 20 sn plan içinde oynatılır ("ÇÖZÜLÜYOR" takılmaz)',()=>{
  let m=make();
  for(let i=0;i<10;i++){m=type(m,1,T0+500+i*100).match;m=type(m,2,T0+520+i*100).match;}
  const before=m.pendingAttacks.length;assert.ok(before>=4);
  const ended=advanceMatch(m,m.round.endsAt,NO_BLOCK).match;
  if(ended.round.phase!=='resolve')return; // KO vb. erken kapanış
  const times=ended.pendingAttacks.map(a=>a.resolveAt);
  const span=ended.round.resolveUntil-ended.round.endsAt;
  assert.ok(span<=RESOLVE_SCENE.maxMs+RESOLVE_SCENE.ultMs,`çözüm ${span} ms`);
  assert.ok(Math.max(...times)<ended.round.resolveUntil,'kart son sahne bitince');
  assert.equal(publicMatch(ended,1).round.resolveEndsAt,ended.round.resolveUntil);
});
function viewOf(phase,extra={},roundExtra={}){
  return {mode:'rounds',status:'running',matchId:'x',totalRounds:5,roundsWon:{1:0,2:0},blindClock:false,
    round:{index:2,total:5,suddenDeath:false,phase,words:['a','b'],startedAt:1000,endsAt:41_000,settleUntil:null,nextRoundAt:null,style:'timed',...roundExtra},
    players:[{seat:1,playerId:'me',name:'A',roundWordIndex:0,roundEndsAt:41_000},{seat:2,playerId:'op',name:'B',roundWordIndex:0,roundEndsAt:41_000}],...extra};
}
test('F2: sayaç her fazda doğru — round: kalan süre, settling/resolve/intermission: sonraki faza kalan süre',()=>{
  const r=roundsViewModel(viewOf('round'),'me',31_000);assert.equal(r.timer.seconds,10);
  const s=roundsViewModel(viewOf('settling',{},{settleUntil:42_000}),'me',41_400);
  assert.equal(s.timer.remaining,600);assert.equal(s.timer.text,'1');assert.ok(s.timer.fraction>0&&s.timer.fraction<=1);
  const v=roundsViewModel(viewOf('resolve',{},{resolveEndsAt:47_000}),'me',44_000);
  assert.equal(v.timer.seconds,3);assert.ok(Math.abs(v.timer.fraction-3000/RESOLVE_BUDGET_MS)<1e-9);
  const i=roundsViewModel(viewOf('intermission',{},{nextRoundAt:50_000}),'me',45_000);
  assert.equal(i.timer.seconds,5);assert.ok(i.timer.fraction<=1);
  assert.notEqual(i.timer.text,'0');
});
test('F2: halka toplamı Donmuş An / Zaman Hırsızı sonrası doğru başlar ve 1\'i aşmaz',()=>{
  const base=viewOf('round',{},{style:'timed',skills:{1:'freeze',2:null},personalEndsAt:{1:44_000,2:41_000}});
  base.players[0].roundEndsAt=44_000;
  const f=roundsViewModel(base,'me',1000);
  assert.equal(f.timer.fraction,1);assert.equal(f.timer.seconds,43);
  const t=viewOf('round',{},{style:'timed',skills:{1:null,2:'timethief'},personalEndsAt:{1:36_000,2:41_000}});
  t.players[0].roundEndsAt=36_000;
  const g=roundsViewModel(t,'me',1000);
  assert.ok(Math.abs(g.timer.fraction-1)<1e-9,'−5 sn sonrası halka dolu başlar: '+g.timer.fraction);
  assert.equal(roundSkillMs('freeze'),3000);assert.equal(roundSkillMs('timethief'),5000);assert.equal(roundSkillMs('nope'),0);
});
test('F2: takılan faz algılanır (deadline + 2 sn) ve yeniden senkron istenir; practice STATE_REQUEST fazı ilerletir',()=>{
  const stuck=viewOf('resolve',{},{resolveEndsAt:47_000});
  assert.equal(phaseOverdueMs(stuck,46_000),0);
  assert.ok(phaseOverdueMs(stuck,49_500)>PHASE_STALL_MS);
  assert.equal(phaseOverdueMs(viewOf('round'),42_500),1500);
  assert.equal(phaseOverdueMs({mode:'classic'},1e9),0);
  assert.equal(phaseOverdueMs(viewOf('round',{blindClock:true}),1e9),0,'karanlık saatte bitiş bilinmez');
  const net=readFileSync(new URL('../pvp/network.js',import.meta.url),'utf8');
  assert.match(net,/phaseOverdueMs\(match,serverNow\)>PHASE_STALL_MS\)this\.requestSnapshot\(\)/);
  // practice: zamanlayıcı çalışmasa bile STATE_REQUEST gecikmiş fazı ilerletir
  let time=1_700_000_000_000;const packets=[];
  const timers=[];
  const s=createPracticeSession({now:()=>time,rng:()=>.99,createId:()=>'f-prac',onPacket:p=>packets.push(p),rounds:5,
    scheduler:{setTimeout:()=>1,clearTimeout(){},setInterval:()=>{timers.push(1);return 1;},clearInterval(){}}});
  s.start();
  const first=s.match.round.index;
  time+=ROUND_DURATION_MS+ROUND_SETTLE_MS+ROUND_SUMMARY_MS+ROUND_INTRO_MS+500;
  s.send('STATE_REQUEST',{});
  assert.ok(s.match.round.index>first||s.match.round.phase!=='round','takılan faz zorla ilerletildi');
});

// ── 3. uçtan uca: raund geçişi, Q/E/R eşikleri, Hazır, barlar, can ───────────
test('F3: raund 2+ kelime indeksi tutarlı (wordIndex raund boyunca artar, roundWordIndex sıfırlanır)',()=>{
  let m=make();
  for(let i=0;i<3;i++)m=type(m,1,T0+500+i*200).match;
  assert.equal(seatOf(m,1).wordIndex,3);
  m=advanceMatch(m,m.round.endsAt+ROUND_SETTLE_MS+10,NO_BLOCK).match;
  m=advanceMatch(m,m.round.nextRoundAt,NO_BLOCK).match;
  assert.equal(m.round.index,2);assert.equal(seatOf(m,1).roundWordIndex,0);
  const p=seatOf(m,1);
  const bad=submitWord(m,{playerId:'a',matchId:m.id,wordIndex:0,text:m.round.words[0],round:2},m.round.startedAt+400);
  assert.equal(bad.error,'WORD_INDEX_MISMATCH');assert.equal(bad.expectedIndex,p.wordIndex);
  const ok=submitWord(m,{playerId:'a',matchId:m.id,wordIndex:p.wordIndex,text:m.round.words[0],round:2},m.round.startedAt+400);
  assert.equal(ok.result.correct,true);
});
test('F3: Q/W/E/R seri eşikleri 3/5/7/10 sunucuda tetiklenir ve skillbar eşikleriyle aynıdır',()=>{
  // KESINYAP 21 (kullanıcı kuralı: dört yetenek, ulti yalnız 10 seride): 7 → E (can, motor 'h'), R 10'da.
  let m=make();const skills=[];
  for(let i=1;i<=10;i++){
    const out=type(m,1,T0+300+i*120);m=out.match;
    if(out.result.cast)skills.push([i,out.result.cast.skill]);
    const sp=publicMatch(m,1).players[0];
    assert.equal(sp.streak,i);
  }
  assert.deepEqual(skills,[[3,'q'],[5,'e'],[7,'h'],[10,'r']]);
  assert.deepEqual({...SKILL_THRESHOLDS.rounds},{Q:3,W:5,E:7,S:0,R:10});
  assert.equal(SKILLBAR_THRESHOLDS,SKILL_THRESHOLDS,'skillbar.js eşikleri match.js ile aynı nesne');
  for(const [n,k] of Object.entries(STREAK_SKILLS))assert.equal(SKILL_THRESHOLDS.rounds[{q:'Q',e:'W',h:'E',r:'R'}[k]],Number(n));
});
test('F3: skillbar "Hazır" durumu eşikte tamamlanır; yanlış kelime seriyi yarıya indirir',()=>{
  let m=make();
  for(let i=0;i<3;i++)m=type(m,1,T0+300+i*120).match;
  const pl=publicMatch(m,1).players[0];
  const st=readSkillState(pl,'Q',{rounds:true,now:T0+1000});
  assert.equal(st.energy,st.threshold);
  m=type(m,1,T0+900,{wrong:true}).match;
  assert.equal(publicMatch(m,1).players[0].streak,1);// 3 → 1 (KESINYAP 13)
  assert.ok(readSkillState(publicMatch(m,1).players[0],'Q',{rounds:true,now:T0+1000}).energy<st.threshold);
});
test('F3: can/hasar akışı — saldırılar raund sonunda çözülür, HP azalır, destek barı public snapshot\'ta görünür',()=>{
  let m=make({assist:true});
  for(let i=1;i<=7;i++)m=type(m,1,T0+300+i*120).match;
  const hpBefore=publicMatch(m,2).players[1].hp;
  assert.ok(m.pendingAttacks.length>=1);
  const view=publicMatch(m,1);
  assert.ok(view.players[0].assist&&'meter' in view.players[0].assist);
  const after=advanceMatch(m,m.round.endsAt+ROUND_SETTLE_MS+5000,NO_BLOCK).match;
  assert.ok(publicMatch(after,2).players[1].hp<hpBefore||after.round.phase==='intermission');
  assert.equal(after.pendingAttacks.length,0);
});
test('F3: practice (bot) timed + counted modları başlar; roundStyle aktarılır, roundWords yok sayılır',()=>{
  // KESINYAP 11: kelime raundu 1. raund 5 kelime; roundWords seçeneği etkisiz.
  for(const style of ['counted','timed']){
    let time=1_700_000_000_000;const packets=[];
    const s=createPracticeSession({now:()=>time,rng:()=>.5,createId:()=>'f-'+style,onPacket:p=>packets.push(p),rounds:5,
      roundStyle:style,roundWords:6,scheduler:{setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){}}});
    s.start();
    assert.equal(s.match.roundStyle,style);assert.equal(s.match.roundWords,undefined);assert.equal(s.match.totalRounds,7);
    assert.equal(s.match.round.words.length>=5,true);
    if(style==='counted')assert.equal(s.match.round.words.length,5);
  }
});

// ── 4. TUR ARASI / RAUND çakışması ────────────────────────────────────────────
test('F4: madalyonda başlık ve birim çakışmaz — birim hep kısa "sn", başlık fazda tek yazı',()=>{
  const round=roundsViewModel(viewOf('round'),'me',5000);
  assert.equal(round.unit,'sn');assert.equal(round.medalTitle,'RAUND 2 / 5');
  const inter=roundsViewModel(viewOf('intermission',{},{nextRoundAt:50_000}),'me',45_000);
  assert.equal(inter.unit,'sn');assert.equal(inter.medalTitle,'TUR ARASI');
  const res=roundsViewModel(viewOf('resolve',{},{resolveEndsAt:47_000}),'me',44_000);
  assert.equal(res.medalTitle,'ÇÖZÜLÜYOR');
  assert.ok(inter.unit.length<=3,'58px dairede taşmaz');
  const js=readFileSync(new URL('../pvp/rounds-ui.js',import.meta.url),'utf8');
  assert.match(js,/setText\(secsUnit,tm\.hidden\?'':vm\.unit\);setText\(title,vm\.medalTitle\)/);
  const css=readFileSync(new URL('../pvp/rounds-ui.css',import.meta.url),'utf8');
  assert.match(css,/\.rui-secs-unit\{[^}]*font-size:12px/);
  assert.match(css,/\.rui-secs-unit\{[^}]*max-width:44px/);
  assert.doesNotMatch(css,/\.rui-secs-unit\{[^}]*font-size:(?:[0-9]|1[01])px/);
});
test('F4: timed HUD kelime şeridi pencere öncesi boş girdileri göstermez, sayaç "Kelime n" gösterir',()=>{
  let m=make({roundStyle:'timed',roundWords:5});
  for(let i=0;i<25;i++)m=type(m,1,T0+500+i*100).match;
  const vm=roundsViewModel(publicMatch(m,1),'a',T0+3000,new Map());
  assert.ok(vm.words.length>0&&vm.words.every(w=>w.text!==''));
  assert.ok(vm.words.some(w=>w.state==='active'));
  assert.equal(vm.sides[0].progress,'Kelime 25');
  const c=roundsViewModel(publicMatch(make({roundStyle:'counted',roundWords:14}),1),'a',T0+500,new Map());
  assert.equal(c.sides[0].progress,'Kelime 0/5');assert.ok(c.words.length<=ROUND_WORDS); // KESINYAP 11: 1. raund 5 kelime
});

// ── 6. lobi roundStyle seçicisi ───────────────────────────────────────────────
import {roundStylePickDecision,roundStylePickerHTML,syncRoundStylePicker,PRACTICE_ROUND_STYLE_KEY,DAMAGE_RULE_HINT} from '../pvp/rounds-ui.js';
test('G1: seçici kararı — practice yerel kaydeder, odada yalnız host/lobi fazında MATCH_CONFIG üretir',()=>{
  assert.deepEqual(roundStylePickDecision({scope:'practice',kind:'style',value:'counted'}),{store:'counted'});
  // KESINYAP 11: kelime sayısı seçimi kalktı; 'words' türü her zaman reddedilir.
  assert.equal(roundStylePickDecision({scope:'practice',kind:'words',value:'15'}),null);
  assert.equal(roundStylePickDecision({scope:'practice',kind:'style',value:'x'}),null);
  assert.equal(roundStylePickDecision({scope:'practice',kind:'words',value:10}),null);
  const room={scope:'room',isHost:true,phase:'waiting',current:'timed'};
  assert.deepEqual(roundStylePickDecision({...room,kind:'style',value:'counted'}),{type:'MATCH_CONFIG',payload:{roundStyle:'counted'}});
  assert.equal(roundStylePickDecision({...room,kind:'words',value:5,current:10}),null);
  assert.equal(roundStylePickDecision({...room,kind:'style',value:'timed'}),null,'aynı değer gönderilmez');
  assert.equal(roundStylePickDecision({...room,isHost:false,kind:'style',value:'counted'}),null);
  assert.equal(roundStylePickDecision({...room,phase:'started',kind:'style',value:'counted'}),null);
});
test('G1: seçici HTML varsayılan olarak Zamana karşı basılı gelir; kelime sayısı satırı yok, hasar kuralı ipucu var',()=>{
  // KESINYAP 11: yalnız 'Zamana karşı | Kelime raundu' + tek satır hasar kuralı.
  const html=roundStylePickerHTML('practice');
  assert.match(html,/data-round-style="timed"[^>]*aria-pressed="true"/);
  assert.match(html,/data-round-style="counted"[^>]*aria-pressed="false"/);
  assert.match(html,/Zamana karşı/);assert.match(html,/Kelime raundu/);
  assert.doesNotMatch(html,/data-round-words=/);assert.ok(html.includes(DAMAGE_RULE_HINT));
  const mk=()=>{const els=[];const mkEl=(attrs,sel)=>{const e={dataset:{},attrs:{...attrs},hidden:false,disabled:false,textContent:'',getAttribute(k){return this.attrs[k];},setAttribute(k,v){this.attrs[k]=v;}};Object.assign(e.dataset,sel);return e;};
    const st=[mkEl({'aria-pressed':'true'},{roundStyle:'timed'}),mkEl({'aria-pressed':'false'},{roundStyle:'counted'})];
    const wd=[5,10,15].map(n=>mkEl({'aria-pressed':'false'},{roundWords:String(n)}));
    const lab=mkEl({},{}),grp=mkEl({},{}),note=mkEl({},{});
    const box={dataset:{},querySelectorAll:s=>s==='[data-round-style]'?st:s==='[data-round-words]'?wd:[lab,grp],querySelector:()=>note};
    return {st,wd,lab,grp,note,root:{querySelector:()=>box}};};
  const a=mk();syncRoundStylePicker(a.root,'room',{style:'counted',words:15,editable:false,note:'x'});
  assert.equal(a.st[1].attrs['aria-pressed'],'true');assert.equal(a.st[0].attrs['aria-pressed'],'false');
  assert.equal(a.st[0].disabled,true);assert.equal(a.note.textContent,'x');
  const b=mk();syncRoundStylePicker(b.root,'room',{style:'timed',editable:true});
  assert.equal(b.st[0].attrs['aria-pressed'],'true');assert.equal(b.st[0].disabled,false);
});
test('G1: practice tercihi localStorage\'da (try/catch ile) saklanır ve başlangıçta okunur; maça aktarılır',()=>{
  assert.equal(PRACTICE_ROUND_STYLE_KEY,'tuslab-pvp-practice-round-style');
  const net=readFileSync(new URL('../pvp/network.js',import.meta.url),'utf8');
  assert.match(net,/safeStore\(localStorage,PRACTICE_ROUND_STYLE_KEY,String\(decision\.store\)\)/);
  assert.doesNotMatch(net,/PRACTICE_ROUND_WORDS_KEY|practiceRoundWords/); // KESINYAP 11: kelime sayısı tercihi kalktı
  assert.match(net,/this\.practiceRoundStyle=normalizeRoundStyle\(safeStore\(localStorage,PRACTICE_ROUND_STYLE_KEY\)\)/);
  assert.match(net,/roundStyle:this\.practiceRoundStyle,/);
  assert.match(net,/this\.send\('MATCH_CONFIG',decision\.payload\)/);
  assert.match(net,/p\.roundStyle\?\?p\.summary\?\.roundStyle/);
  assert.match(net,/\$\{roundStylePickerHTML\('practice'\)\}/);assert.match(net,/\$\{roundStylePickerHTML\('room'\)\}/);
  const safe=net.match(/const safeStore=\(storage,key,value\)=>\{try\{/);assert.ok(safe,'safeStore try/catch');
});
test('G1: varsayılanlar timed — motor, room.js ve practice',async()=>{
  const m=createMatch(players(),T0,'d',{rounds:5,seed:1});assert.equal(m.roundStyle,'timed');
  const s=createPracticeSession({rounds:5,now:()=>T0,rng:()=>.5,createId:()=>'dd',onPacket(){},scheduler:{setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){}}});
  s.start();assert.equal(s.match.roundStyle,'timed');
  const f=fixture();await f.room.fetch(new Request('https://local.test/initialize',{method:'POST'}));
  await join(f.room,1);await join(f.room,2);
  assert.equal(f.room.summary(await f.room.roster()).roundStyle,'timed');
  assert.match(readFileSync(new URL('../pvp/rounds-ui.css',import.meta.url),'utf8'),/\.rui-seg button\{[^}]*font-size:12px/);
});
