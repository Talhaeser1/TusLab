// Şerit F — raund ve yazı mekanikleri: roundStyle/roundWords, sayaç, çözüm süresi, başlık çakışması, eşik tek kaynak.
import test,{beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createMatch,publicMatch,submitWord,advanceMatch,nextDeadline,resolveStepMs,
  ROUND_WORDS,ROUND_WORDS_MIN,ROUND_WORDS_MAX,ROUND_VIEW_AHEAD,ROUND_DURATION_MS,ROUND_SUMMARY_MS,ROUND_INTRO_MS,ROUND_SETTLE_MS,
  RESOLVE_STEP_MS,RESOLVE_MIN_STEP_MS,RESOLVE_BUDGET_MS,SKILL_THRESHOLDS,STREAK_SKILLS,normalizeRoundStyle,normalizeRoundWords,
  roundSkillMs} from '../pvp/shared/match.js';
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
test('F1: varsayılan counted, 10 kelime; normalize geçersiz değerleri düşürür',()=>{
  const m=make();
  assert.equal(m.roundStyle,'counted');assert.equal(m.roundWords,ROUND_WORDS);assert.equal(m.round.words.length,10);
  assert.equal(normalizeRoundStyle('x'),'counted');assert.equal(normalizeRoundStyle('timed'),'timed');
  for(const bad of [4,21,10.5,'10',null,undefined,NaN])assert.equal(normalizeRoundWords(bad),10,String(bad));
  assert.equal(normalizeRoundWords(5),5);assert.equal(normalizeRoundWords(20),20);
  assert.equal(ROUND_WORDS_MIN,5);assert.equal(ROUND_WORDS_MAX,20);
});
test('F1: counted roundWords kelime sayısı kadar kelime verir ve tüm kelimeler bitince raund biter',()=>{
  for(const n of [5,14,20]){
    let m=make({roundWords:n,roundStyle:'counted'});
    assert.equal(m.round.words.length,n);
    for(let i=0;i<n;i++)m=type(m,1,T0+500+i*100).match;
    assert.equal(seatOf(m,1).roundDone,true,`n=${n}`);
    assert.equal(publicMatch(m,1).round.words.length,n);
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
  assert.ok(JSON.stringify(view).length<4096*2,'anlık görüntü şişmemeli');
  assert.ok(!view.round.words.slice(0,me.roundWordIndex-2).some(Boolean),'geçmiş kelime metni gönderilmez');
  // gerçek kuyruktaki kelimeler sunucuda kalır
  assert.ok(m.round.words.length>view.round.words.length-1);
});
test('F1: counted anlık görüntü hâlâ tüm listeyi içerir (eski davranış)',()=>{
  const m=make();const v=publicMatch(m,1);
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
test('F1: oda MATCH_CONFIG roundStyle/roundWords alanlarını izinli listeyle doğrular ve maça aktarır',async()=>{
  const f=fixture();await f.room.fetch(new Request('https://local.test/initialize',{method:'POST'}));
  const a=await join(f.room,1);await join(f.room,2);
  const errors=()=>a.messages.filter(m=>m.type==='ERROR'&&m.payload.code==='INVALID_MATCH_CONFIG').length;
  for(const bad of [{roundStyle:'hack'},{roundStyle:1},{roundWords:4},{roundWords:21},{roundWords:'10'},{roundWords:7.5}])
    await request(f.room,a,'MATCH_CONFIG',bad);
  assert.equal(errors(),6);
  await request(f.room,a,'MATCH_CONFIG',{roundStyle:'timed'});
  await request(f.room,a,'MATCH_CONFIG',{roundWords:12});
  const data=await f.room.roster();
  assert.equal(data.roundStyle,'timed');assert.equal(data.roundWords,12);
  const s=f.room.summary(data);assert.equal(s.roundStyle,'timed');assert.equal(s.roundWords,12);
  const started=f.room.startMatch(data,Date.now());
  assert.equal(started.match.roundStyle,'timed');assert.equal(started.match.roundWords,12);
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
test('F2: çok sayıda birikmiş saldırı ≈ 6 sn içinde oynatılır ("ÇÖZÜLÜYOR" takılmaz)',()=>{
  let m=make();
  for(let i=0;i<10;i++){m=type(m,1,T0+500+i*100).match;m=type(m,2,T0+520+i*100).match;}
  const before=m.pendingAttacks.length;assert.ok(before>=4);
  const ended=advanceMatch(m,m.round.endsAt,NO_BLOCK).match;
  if(ended.round.phase!=='resolve')return; // KO vb. erken kapanış
  const times=ended.pendingAttacks.map(a=>a.resolveAt);
  const span=Math.max(...times)-ended.round.endsAt;
  assert.ok(span<=RESOLVE_BUDGET_MS+RESOLVE_STEP_MS,`çözüm ${span} ms`);
  const gaps=times.slice(1).map((t,i)=>t-times[i]).filter(g=>g>0);
  assert.ok(gaps.every(g=>g>=RESOLVE_MIN_STEP_MS||g<RESOLVE_MIN_STEP_MS),'aralık tanımlı');
  assert.equal(publicMatch(ended,1).round.resolveEndsAt,Math.max(...times));
});
function viewOf(phase,extra={},roundExtra={}){
  return {mode:'rounds',status:'running',matchId:'x',totalRounds:5,roundsWon:{1:0,2:0},blindClock:false,
    round:{index:2,total:5,suddenDeath:false,phase,words:['a','b'],startedAt:1000,endsAt:41_000,settleUntil:null,nextRoundAt:null,style:'counted',...roundExtra},
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
  const base=viewOf('round',{},{skills:{1:'freeze',2:null},personalEndsAt:{1:44_000,2:41_000}});
  base.players[0].roundEndsAt=44_000;
  const f=roundsViewModel(base,'me',1000);
  assert.equal(f.timer.fraction,1);assert.equal(f.timer.seconds,43);
  const t=viewOf('round',{},{skills:{1:null,2:'timethief'},personalEndsAt:{1:36_000,2:41_000}});
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
test('F3: Q/E/R seri eşikleri 3/5/7 sunucuda tetiklenir ve skillbar eşikleriyle aynıdır',()=>{
  let m=make();const skills=[];
  for(let i=1;i<=7;i++){
    const out=type(m,1,T0+300+i*120);m=out.match;
    if(out.result.cast)skills.push([i,out.result.cast.skill]);
    const sp=publicMatch(m,1).players[0];
    assert.equal(sp.streak,i);
  }
  assert.deepEqual(skills,[[3,'q'],[5,'e'],[7,'r']]);
  assert.deepEqual({...SKILL_THRESHOLDS.rounds},{Q:3,E:5,S:0,R:7});
  assert.equal(SKILLBAR_THRESHOLDS,SKILL_THRESHOLDS,'skillbar.js eşikleri match.js ile aynı nesne');
  for(const [n,k] of Object.entries(STREAK_SKILLS).slice(0,3))assert.equal(SKILL_THRESHOLDS.rounds[k.toUpperCase()]<=Number(n),true);
});
test('F3: skillbar "Hazır" durumu eşikte tamamlanır; yanlış kelime seriyi sıfırlar',()=>{
  let m=make();
  for(let i=0;i<3;i++)m=type(m,1,T0+300+i*120).match;
  const pl=publicMatch(m,1).players[0];
  const st=readSkillState(pl,'Q',{rounds:true,now:T0+1000});
  assert.equal(st.energy,st.threshold);
  m=type(m,1,T0+900,{wrong:true}).match;
  assert.equal(publicMatch(m,1).players[0].streak,0);
  assert.equal(readSkillState(publicMatch(m,1).players[0],'Q',{rounds:true,now:T0+1000}).energy,0);
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
test('F3: practice (bot) timed + counted modları baştan sona akar ve roundStyle/roundWords aktarılır',()=>{
  for(const style of ['counted','timed']){
    let time=1_700_000_000_000;const packets=[];
    const s=createPracticeSession({now:()=>time,rng:()=>.5,createId:()=>'f-'+style,onPacket:p=>packets.push(p),rounds:5,
      roundStyle:style,roundWords:6,scheduler:{setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){}}});
    s.start();
    assert.equal(s.match.roundStyle,style);assert.equal(s.match.roundWords,6);
    assert.equal(s.match.round.words.length>=6,true);
    if(style==='counted')assert.equal(s.match.round.words.length,6);
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
  const c=roundsViewModel(publicMatch(make({roundWords:14}),1),'a',T0+500,new Map());
  assert.equal(c.sides[0].progress,'Kelime 0/14');assert.ok(c.words.length<=ROUND_WORDS);
});
