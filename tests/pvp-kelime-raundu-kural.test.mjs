import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createMatch,submitWord,advanceMatch,nextDeadline,publicMatch,pickRoundSkill,roundDurationMs,ROUND_COUNTED_CAP_MS,ROUND_CAP_WARN_MS,ROUND_DURATION_MS,ROUND_HP,ROUND_TOTAL,ROUND_WORD_PLAN} from '../pvp/shared/match.js';
import * as cf from '../cloudflare/src/match.js';
import {roundsViewModel,roundInputLock,roundSkillPickerModel,roundStylePickerHTML} from '../pvp/rounds-ui.js';
import {createPracticeSession,HUMAN_ID,BOT_ID} from '../pvp/practice.js';

// KELİME RAUNDU KURAL DÜZELTMESİ: süre sınırı yok, ilk bitiren raundu bitirir, gizli 120 sn üst sınır.
const T0=10_000;
const players=[{playerId:'a',seat:1,character:'fire',name:'A'},{playerId:'b',seat:2,character:'rune',name:'B'}];
const make=(o={})=>createMatch(players,T0,'kelime-kural',{rounds:7,seed:7,roundStyle:'counted',resolveAtEnd:true,...o});
const seatOf=(m,s)=>m.participants.find(p=>p.seat===s);
const NO_BLOCK=()=>0.99;
function type(m,seat,at,wrong=false){
  const p=seatOf(m,seat),w=m.round.words[p.roundWordIndex];
  const out=submitWord(m,{playerId:p.playerId,matchId:m.id,wordIndex:p.wordIndex,text:wrong?w+'x':w,round:m.round.index},at);
  assert.ok(out.match,`submit: ${out.error}`);return out.match;
}

test('kelime raundu: ilk bitiren raundu kapatır, rakibin yazdıkları sayılır, kalanı yazamaz', () => {
  let m=make();
  m=type(m,2,T0+300);m=type(m,2,T0+500);m=type(m,2,T0+700); // rakip 3/5 yazdı (3. kelimede seri → Q vuruşu bekler)
  const pendingBefore=m.pendingAttacks.length;
  for(let i=0;i<5;i++)m=type(m,1,T0+1000+i*100);
  assert.equal(m.round.allDone,true);
  assert.equal(m.round.endsAt,T0+1400,'raund son kelimenin yazıldığı anda biter');
  assert.equal(seatOf(m,2).roundWordIndex,3,'rakibin 3 kelimesi sayılır');
  assert.equal(submitWord(m,{playerId:'b',matchId:m.id,wordIndex:seatOf(m,2).wordIndex,text:m.round.words[3],round:1},T0+1401).error,'ROUND_NOT_ACTIVE');
  assert.ok(m.pendingAttacks.length>=pendingBefore,'bekleyen vuruşlar kaybolmaz');
  const adv=advanceMatch(m,T0+1400,NO_BLOCK);
  assert.equal(adv.match.round.phase,'resolve','bekleyen vuruşlar çözüm akışıyla oynar');
  assert.ok(adv.roundEvents.some(e=>e.type==='ROUND_RESOLVE'));
  let r=adv.match;for(let i=0;i<20&&r.round.phase==='resolve';i++)r=advanceMatch(r,r.pendingAttacks.length?Math.min(...r.pendingAttacks.map(a=>a.resolveAt)):nextDeadline(r),NO_BLOCK).match; // İş 12: kart plan bitişinde açılır
  assert.equal(r.round.phase,'intermission');assert.equal(r.roundHistory.at(-1).reason,'ALL_DONE');
});

test('kelime raundu: rakip (bot/ikinci koltuk) önce bitirirse de raund kapanır; ROUND_LAST_CALL yayılmaz', () => {
  let m=make();const events=[];
  for(let i=0;i<5;i++){const p=seatOf(m,2);const out=submitWord(m,{playerId:'b',matchId:m.id,wordIndex:p.wordIndex,text:m.round.words[p.roundWordIndex],round:1},T0+200+i*100);m=out.match;events.push(...out.result.roundEvents);}
  assert.deepEqual(events,[]);assert.equal(m.round.allDone,true);assert.equal(seatOf(m,1).roundEndsAt,T0+600);
});

test('kelime raundu: gizli 120 sn üst sınırı kimse bitirmezse yazılan kadar sayar', () => {
  assert.equal(ROUND_COUNTED_CAP_MS,120_000);assert.equal(ROUND_CAP_WARN_MS,10_000);
  for(const n of [5,7,9,10,15])assert.equal(roundDurationMs({roundStyle:'counted',roundWords:n}),120_000);
  let m=make();m=type(m,1,T0+500);m=type(m,2,T0+600);
  assert.equal(m.round.endsAt,T0+120_000);
  assert.equal(advanceMatch(m,T0+119_999,NO_BLOCK).match.round.phase,'round');
  const end=advanceMatch(m,T0+120_000,NO_BLOCK).match;
  assert.notEqual(end.round.phase,'round');assert.equal(seatOf(end,1).roundWordIndex,1);assert.equal(seatOf(end,2).roundWordIndex,1);
});

test('kelime raundu: kelime planı ve 7 raund değişmedi; can 6000, raund hasar tavanı YOK', async () => {
  assert.deepEqual([...ROUND_WORD_PLAN],[5,7,9,10,10,10,15]);assert.equal(ROUND_TOTAL,7);
  assert.equal(ROUND_HP,6000);assert.equal('ROUND_DAMAGE_CAP' in await import('../pvp/shared/match.js'),false);
  const m=make();assert.equal(m.round.words.length,5);assert.equal(seatOf(m,1).hp,6000);
});

test('zamana karşı değişmedi: 30 sn, kelime tükenmez, süre becerileri çalışır', () => {
  assert.equal(ROUND_DURATION_MS,30_000);assert.equal(roundDurationMs({roundStyle:'timed'}),30_000);
  let m=make({roundStyle:'timed'});
  assert.equal(m.round.endsAt-m.round.startedAt,30_000);
  for(let i=0;i<12;i++)m=type(m,1,T0+200+i*100);
  assert.equal(seatOf(m,1).roundDone,false);assert.ok(m.round.words.length>seatOf(m,1).roundWordIndex);assert.equal(m.round.allDone,false);
  let t=make({roundStyle:'timed'});t=advanceMatch(t,t.round.endsAt+1,NO_BLOCK).match;
  while(t.round.phase==='resolve')t=advanceMatch(t,t.round.endsAt+9000,NO_BLOCK).match;
  const picked=pickRoundSkill(t,{playerId:'a',skill:'freeze'},t.round.endedAt+1);
  assert.ok(picked.match,picked.error);
  t=advanceMatch(picked.match,picked.match.round.nextRoundAt,NO_BLOCK).match;
  assert.equal(seatOf(t,1).roundEndsAt,t.round.startedAt+30_000+3000);
});

test('kelime raundunda süre becerisi: seçim reddedilir, seçici gösterilmez, etkisizdir', () => {
  let m=make();m=advanceMatch(m,m.round.endsAt,NO_BLOCK).match;
  while(m.round.phase==='resolve')m=advanceMatch(m,m.round.endsAt+9000,NO_BLOCK).match;
  assert.equal(m.round.phase,'intermission');
  assert.equal(pickRoundSkill(m,{playerId:'a',skill:'timethief'},m.round.endedAt+1).error,'ROUND_SKILL_NOT_TIMED');
  assert.equal(roundSkillPickerModel(publicMatch(m,1),'a').visible,false);
  const next=advanceMatch(m,m.round.nextRoundAt,NO_BLOCK).match;
  assert.deepEqual(next.participants.map(p=>p.roundSkill),[null,null]);
});

test('kelime raundu arayüzü: görünür geri sayım yok; "Sen 4/7 · Rakip 5/7" ilerlemesi', () => {
  const view=(idxA,idxB,now,extra={})=>({mode:'rounds',status:'running',matchId:'x',totalRounds:7,blindClock:false,
    round:{index:2,total:7,suddenDeath:false,phase:'round',words:Array(7).fill('kelime'),wordCount:7,startedAt:1000,endsAt:121_000,style:'counted',...extra},
    players:[{seat:1,playerId:'me',name:'A',roundWordIndex:idxA,roundEndsAt:121_000},{seat:2,playerId:'op',name:'B',roundWordIndex:idxB,roundEndsAt:121_000}]});
  const vm=roundsViewModel(view(4,5),'me',30_000);
  assert.equal(vm.medalTitle,'Sen 4/7 · Rakip 5/7');assert.equal(vm.timer.text,'4/7');assert.equal(vm.unit,'');
  assert.equal(vm.timer.seconds,-1);assert.equal(vm.lastCall.active,false);assert.ok(vm.sides.every(s=>s.clock===''));
  assert.equal(vm.sides[0].progress,'Kelime 4/7');assert.equal(vm.sides[1].progress,'Kelime 5/7');
  assert.equal(roundsViewModel(view(4,5),'op',30_000).medalTitle,'Sen 5/7 · Rakip 4/7');
  // 13 Kas 2026: gizli sınırın son 10 sn'inde bile "Raund kapanıyor" uyarısı yok (kullanıcı: "süre doluyor uyarısı kalksın").
  assert.equal(roundsViewModel(view(1,1),'me',110_999).lastCall.active,false);
  const warn=roundsViewModel(view(1,1),'me',111_000);
  assert.equal(warn.lastCall.active,false);assert.equal(warn.lastCall.text,'');
  // Zamana karşı: sayaç aynen.
  const tv=view(1,1);tv.players.forEach(p=>{p.roundEndsAt=31_000;});
  const timed=roundsViewModel({...tv,round:{...tv.round,style:'timed',endsAt:31_000}},'me',21_000);
  assert.equal(timed.timer.seconds,10);assert.equal(timed.unit,'sn');assert.match(timed.medalTitle,/^RAUND 2/);
});

test('kelime raundu: giriş kilidi ilk bitireni belirtir (süre dolmadı yazısı yok)', () => {
  const pub=(me,at)=>({mode:'rounds',status:'running',round:{phase:'round',style:'counted',endsAt:121_000,personalEndsAt:{1:at,2:121_000}},
    players:[{seat:1,playerId:'me',roundDone:me,roundEndsAt:at},{seat:2,playerId:'op',roundDone:false,roundEndsAt:121_000}]});
  assert.match(roundInputLock(pub(true,5000),'me',6000).reason,/raund kapanıyor/);
  assert.equal(roundInputLock(pub(false,5000),'me',6000).reason,'Rakip bitirdi · raund kapanıyor');
  assert.equal(roundInputLock(pub(false,121_000),'me',6000).locked,false);
});

test('lobi ipucu: kelime raundu "süre yok, ilk bitiren raundu bitirir"; eski 6 sn kuralı yok', () => {
  const html=roundStylePickerHTML('room');
  assert.match(html,/süre yok, ilk bitiren raundu bitirir/);assert.doesNotMatch(html,/6 sn/);
});

test('sunucu–istemci aynı kural: bulut motoru paylaşılan motoru yeniden dışa aktarır', () => {
  assert.equal(cf.roundDurationMs,roundDurationMs);assert.equal(cf.ROUND_COUNTED_CAP_MS,120_000);assert.equal(cf.advanceMatch,advanceMatch);
  const room=readFileSync(new URL('../cloudflare/src/room.js',import.meta.url),'utf8');
  assert.match(room,/advanceMatch/);assert.match(room,/pickRoundSkill/);
});

test('pratik: bot önce bitirince raund kapanır, insanın yazamadığı kelimeler sayılmaz', () => {
  let time=1_700_000_000_000,serial=0;const timers=new Map();const packets=[];
  const add=(fn,ms,repeat)=>{const id=++serial;timers.set(id,{fn,at:time+ms,ms,repeat});return id;};
  const advance=ms=>{const end=time+ms;for(;;){let c=null;for(const [id,t] of timers)if(t.at<=end&&(!c||t.at<c.t.at||t.at===c.t.at&&id<c.id))c={id,t};if(!c)break;time=c.t.at;if(c.t.repeat)c.t.at+=c.t.ms;else timers.delete(c.id);c.t.fn();}time=end;};
  const session=createPracticeSession({roundStyle:'counted',difficulty:'zor',now:()=>time,rng:()=>.99,createId:()=>'kural-1',
    scheduler:{setTimeout:(fn,ms)=>add(fn,ms,false),clearTimeout:id=>timers.delete(id),setInterval:(fn,ms)=>add(fn,ms,true),clearInterval:id=>timers.delete(id)},
    onPacket:p=>packets.push(p)});
  session.start();
  let closed=null;
  for(let t=0;t<200&&!closed;t++){advance(500);closed=packets.find(p=>p.type==='ROUND_END');}
  session.dispose();
  assert.ok(closed,'bot 5 kelimeyi bitirince raund 120 sn dolmadan kapandı');
  assert.equal(closed.payload.reason,'ALL_DONE');
  const m=session.match;
  assert.ok(m.roundHistory[0].scores.find(s=>s.seat!==m.participants.find(p=>p.playerId===HUMAN_ID).seat).correct>=0);
  assert.equal(packets.filter(p=>p.type==='ROUND_LAST_CALL').length,0);
  assert.ok(BOT_ID);
});
