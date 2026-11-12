// Tur (raund) arayüzü — docs/TUR-SISTEMI.md §10 ve §11 (Ajan B).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  ROUND_OPTIONS,STREAK_SKILLS,PRACTICE_ROUNDS_KEY,normalizeRounds,isRoundMatch,streakMultiplier,multiplierLabel,
  streakModel,predictedSkill,roundDots,roundsViewModel,summaryModel,summaryPresentation,clashModel,roundsPickDecision,
  roundInputLock,roundsResultModel,roundsPickerHTML,createRoundsUi,intermissionStage,ROUND_TITLE_MS,ROUND_HOLD_MAX_MS,ROUND_HOLD_TITLE_SKIP_MS
} from '../pvp/rounds-ui.js';

// ---------- örnek yükler (spec §7) ----------
const WORDS=['ateş','kalkan','rün','kılıç','<b>x</b>','şato','yıldız','gölge','ışık','zafer'];
function roundMatch(over={}){
  const base={matchId:'m-1',sequence:5,status:'running',mode:'rounds',totalRounds:5,roundsWon:{1:1,2:0},
    startedAt:0,endsAt:40_000,pausedAt:null,
    round:{index:2,total:5,suddenDeath:false,phase:'round',words:WORDS,startedAt:10_000,endsAt:40_000,settleUntil:null,nextRoundAt:null},
    roundHistory:[],
    players:[
      {playerId:'me',seat:1,name:'Ayşe',character:'fire',hp:1200,maxHp:1200,combo:4,streak:4,multiplier:1,nextSkill:'e',roundWordIndex:6,roundCorrect:5,roundWrong:1,roundBestStreak:4,roundDamage:105,roundDone:false,finishedAt:null,wordIndex:16,currentWord:'yıldız'},
      {playerId:'op',seat:2,name:'<img src=x onerror=alert(1)>',character:'rune',hp:900,maxHp:1200,combo:7,streak:7,multiplier:1.5,nextSkill:'q',roundWordIndex:7,roundCorrect:7,roundWrong:0,roundBestStreak:7,roundDamage:738,roundDone:false,finishedAt:null,wordIndex:17,currentWord:'gölge'}
    ]};
  return {...base,...over,round:{...base.round,...(over.round||{})},players:over.players||base.players};
}
const classicMatch={matchId:'c-1',sequence:3,status:'running',mode:'classic',round:null,startedAt:0,endsAt:90_000,
  players:[{playerId:'me',seat:1,name:'A',combo:2,wordIndex:2,currentWord:'x'},{playerId:'op',seat:2,name:'B',combo:0,wordIndex:0,currentWord:'y'}]};
const roundEnd={round:2,winnerSeat:2,reason:'KO',roundsWon:{1:1,2:1},nextRoundAt:50_000,matchOver:false,
  scores:[{seat:1,correct:5,wrong:2,bestStreak:4,damageDealt:210,hpLeft:0,rp:721,lastCorrectAt:30_000},
          {seat:2,correct:7,wrong:0,bestStreak:7,damageDealt:1200,hpLeft:420,rp:1170,lastCorrectAt:29_000}]};

// ---------- minimal sahte DOM (innerHTML yasak: XSS testi) ----------
class FakeClassList{constructor(){this.set=new Set();}add(...c){c.forEach(x=>this.set.add(x));}remove(...c){c.forEach(x=>this.set.delete(x));}
  toggle(c,on){const want=on===undefined?!this.set.has(c):Boolean(on);want?this.set.add(c):this.set.delete(c);return want;}contains(c){return this.set.has(c);}}
class FakeEl{
  constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.attrs={};this.classList=new FakeClassList();this.style={setProperty:(k,v)=>{this.style[k]=v;}};this.dataset={};this._text='';this.hidden=false;this.parentNode=null;}
  set className(v){this.classList=new FakeClassList();String(v).split(/\s+/).filter(Boolean).forEach(c=>this.classList.add(c));}
  get className(){return [...this.classList.set].join(' ');}
  set innerHTML(v){throw new Error('innerHTML kullanılmamalı');}
  set textContent(v){this._text=String(v);this.children=[];}
  get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}
  append(...nodes){for(const n of nodes){const node=typeof n==='string'?Object.assign(new FakeEl('#text'),{_text:n}):n;node.parentNode=this;this.children.push(node);}}
  appendChild(n){this.append(n);return n;}
  replaceChildren(...n){this.children=[];this._text='';this.append(...n);}
  remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(c=>c!==this);this.parentNode=null;}
  setAttribute(k,v){this.attrs[k]=String(v);}getAttribute(k){return this.attrs[k]??null;}removeAttribute(k){delete this.attrs[k];}
  hasAttribute(k){return k in this.attrs;}toggleAttribute(k,on){if(on)this.attrs[k]='';else delete this.attrs[k];}
  querySelector(){return null;}querySelectorAll(){return [];}
  addEventListener(){}removeEventListener(){}
}
const fakeDoc={createElement:t=>new FakeEl(t),createElementNS:(ns,t)=>new FakeEl(t),hidden:false};
function fakeTimers(){
  const live=new Map();let id=0;
  const add=(fn,ms,repeat)=>{id++;live.set(id,{fn,ms,repeat});return id;};
  return {live,setTimeout:(fn,ms)=>add(fn,ms,false),clearTimeout:i=>live.delete(i),setInterval:(fn,ms)=>add(fn,ms,true),clearInterval:i=>live.delete(i),
    runAll(){for(const [k,t] of [...live]){if(!t.repeat)live.delete(k);t.fn();}}};
}
function mount(now){
  const host=new FakeEl('div');const timers=fakeTimers();let t=now;
  const ui=createRoundsUi(host,{now:()=>t,doc:fakeDoc,timers,isReduced:()=>false});
  const el=host.children[0];
  return {host,el,ui,timers,setNow:v=>{t=v;}};
}
const all=node=>[node,...node.children.flatMap(all)];
const byRole=(el,name)=>all(el).filter(n=>n.dataset?.rui===name);

test('round skill cards remain mounted while keyboard selection changes',()=>{
  const {el,ui,setNow}=mount(41_000);
  ui.update(roundMatch({round:{phase:'intermission',nextRoundAt:50_000}}),'me');
  const cards=all(el).filter(n=>n.getAttribute('data-round-skill'));
  assert.equal(cards.length,3);
  assert.equal(ui.handleKey({key:'1',preventDefault(){}}),false,'title stage does not accept a hidden choice');
  setNow(41_000+ROUND_TITLE_MS+10);ui.tick();
  ui.handleKey({key:'1',preventDefault(){}});
  assert.equal(all(el).find(n=>n.getAttribute('data-round-skill')==='timethief'),cards[0]);
  assert.equal(cards[0].getAttribute('aria-pressed'),'true');
  ui.destroy();
});

test('round result opens as a compact bottom dock (every layout) after the title, never as a centered modal',()=>{
  const {host,el,ui,setNow}=mount(41_000);host.dataset.layout='fullscreen';el.closest=()=>host;
  const m=roundMatch({round:{phase:'intermission',nextRoundAt:50_000},roundHistory:[roundEnd]});
  ui.update(m,'me');const inter=byRole(el,'inter')[0];
  assert.equal(inter.hidden,true,'önce yalnız RAUND yazısı');
  setNow(41_000+ROUND_TITLE_MS+50);ui.tick();
  assert.ok(inter.classList.contains('is-dock'));assert.equal(inter.classList.contains('is-centered'),false);
  assert.equal(inter.hidden,false);assert.ok(host.classList.contains('rui-inter-open'));
  ui.destroy();assert.equal(host.classList.contains('rui-inter-open'),false);
});

test('round end: shared player columns, winner emphasis, win pips and live countdown ring',()=>{
  const {el,ui,setNow}=mount(41_000);
  const m=roundMatch({roundsWon:{1:1,2:1},round:{phase:'intermission',nextRoundAt:50_000}});
  ui.handle({type:'ROUND_END',payload:{...roundEnd,match:m}});ui.update(m,'me');
  setNow(41_000+ROUND_TITLE_MS+50);ui.tick();
  const result=all(el).find(n=>n.classList.contains('m33-result'));
  assert.ok(result);
  const columns=all(result).filter(n=>n.classList.contains('m33-player'));
  assert.equal(columns.length,2);assert.ok(columns[1].classList.contains('is-winner'));
  assert.ok(columns[0].textContent.includes('Doğru'));assert.ok(columns[0].textContent.includes('210'));
  // KESINYAP 11: pipler raund galibiyeti değil, raund ilerleme noktaları (toplam raund kadar, tek sıra).
  assert.equal(all(result).filter(n=>n.classList.contains('m33-pip')).length,5);
  assert.ok(result.textContent.includes('Kalan can'));
  const ring=all(result).find(n=>n.getAttribute('class')==='m33-count-fill');
  const before=Number(ring.getAttribute('stroke-dashoffset'));
  setNow(43_000);ui.tick();assert.ok(Number(ring.getAttribute('stroke-dashoffset'))>before);
  ui.destroy();
});

// ---------- raund geçişi: önce yazı, sonra panel ----------
test('intermissionStage: title (tek başına) → panel → count',()=>{
  assert.ok(ROUND_TITLE_MS>=700&&ROUND_TITLE_MS<=1000);
  assert.equal(intermissionStage({elapsed:0,remaining:9000}),'title');
  assert.equal(intermissionStage({elapsed:ROUND_TITLE_MS-1,remaining:9000}),'title');
  assert.equal(intermissionStage({elapsed:ROUND_TITLE_MS,remaining:9000}),'panel');
  assert.equal(intermissionStage({elapsed:5000,remaining:2900}),'count');
});
test('tur arası: RAUND yazısı önce tek başına; özet + seçici sonra açılır',()=>{
  const {el,ui,setNow}=mount(41_000);
  const m=roundMatch({roundsWon:{1:1,2:1},round:{phase:'intermission',nextRoundAt:50_000}});
  ui.handle({type:'ROUND_END',payload:{...roundEnd,match:m}});ui.update(m,'me');
  const banner=byRole(el,'banner')[0],summary=byRole(el,'summary')[0],inter=byRole(el,'inter')[0];
  const picker=all(el).find(n=>n.classList.contains('rui-skill-picker'));
  assert.equal(banner.hidden,false);assert.ok(banner.textContent.includes('RAUND 3'));
  assert.equal(summary.hidden,true);assert.equal(picker.hidden,true);assert.equal(inter.hidden,true);
  setNow(41_000+ROUND_TITLE_MS+10);ui.tick();
  assert.equal(banner.hidden,true);assert.equal(summary.hidden,false);assert.equal(picker.hidden,false);assert.equal(inter.hidden,false);
  ui.destroy();
});
test('tur arası: holdTransition Promise çözülene dek yazı/panel bekler (tek giriş noktası); en çok ROUND_HOLD_MAX_MS',async()=>{
  const host=new FakeEl('div');const timers=fakeTimers();let t=41_000;let release;
  const gate=new Promise(r=>{release=r;});let calls=0;
  const ui=createRoundsUi(host,{now:()=>t,doc:fakeDoc,timers,holdTransition:()=>{calls++;return gate;}});
  const el=host.children[0];
  const m=roundMatch({roundsWon:{1:1,2:1},round:{phase:'intermission',nextRoundAt:50_000}});
  ui.handle({type:'ROUND_END',payload:{...roundEnd,match:m}});ui.update(m,'me');ui.tick();
  assert.equal(calls,1);assert.equal(byRole(el,'banner')[0].hidden,true,'bekleme: yazı da yok');assert.equal(byRole(el,'summary')[0].hidden,true);
  release();await gate;await Promise.resolve();
  assert.equal(byRole(el,'banner')[0].hidden,false,'çözülünce yazı');assert.equal(calls,1);
  ui.destroy();
  // Asla çözülmeyen Promise: zaman aşımı kilidi açar.
  const host2=new FakeEl('div');const timers2=fakeTimers();
  const ui2=createRoundsUi(host2,{now:()=>t,doc:fakeDoc,timers:timers2,holdTransition:()=>new Promise(()=>{})});
  ui2.handle({type:'ROUND_END',payload:{...roundEnd,match:m}});ui2.update(m,'me');
  assert.equal(byRole(host2.children[0],'banner')[0].hidden,true);
  timers2.runAll();
  assert.equal(byRole(host2.children[0],'banner')[0].hidden,false);
  ui2.destroy();
});
test('tur arası: geri sayıma az kala görülen geçiş (yeniden bağlanma) yazıyı atlar',()=>{
  const {el,ui}=mount(46_800);
  const m=roundMatch({roundsWon:{1:1,2:1},round:{phase:'intermission',nextRoundAt:50_000}});
  ui.handle({type:'ROUND_END',payload:{...roundEnd,match:m}});ui.update(m,'me');
  assert.equal(byRole(el,'banner')[0].hidden,true);
  ui.destroy();
});

// ---------- GÖREV C: özet okunurluğu (hold tavanı, uzun hold'da yazı atlama, count'ta özet kalıcı) ----------
test('tur arası: hold tavanı tur arasının başından sayılır ve en çok 2000 msdir',()=>{
  assert.ok(ROUND_HOLD_MAX_MS>0&&ROUND_HOLD_MAX_MS<=3000,'ROUND_HOLD_MAX_MS ≤ 3000 (İş 12: sahne bitmeden kart açılmaz, en çok +3 sn)');
  assert.ok(ROUND_HOLD_TITLE_SKIP_MS>=500&&ROUND_HOLD_TITLE_SKIP_MS<ROUND_HOLD_MAX_MS,'yazı atlma eşiği tavanın altında');
});
test('tur arası: hold 3 sn sürse bile özet ≥2,5 sn görünür — tavan 2 sn, yazı atlanır, countta geri sayımla birlikte kalır',()=>{
  const host=new FakeEl('div');const timers=fakeTimers();let t=41_000;
  const ui=createRoundsUi(host,{now:()=>t,doc:fakeDoc,timers,holdTransition:()=>new Promise(()=>{})});
  const el=host.children[0];
  const m=roundMatch({roundsWon:{1:1,2:1},round:{phase:'intermission',nextRoundAt:50_000}});
  ui.handle({type:'ROUND_END',payload:{...roundEnd,match:m}});ui.update(m,'me');ui.tick();
  assert.equal(byRole(el,'summary')[0].hidden,true,'bekleme çözülmeden panel açılmaz');
  t=41_000+ROUND_HOLD_MAX_MS;timers.runAll();ui.tick(); // hiç çözülmeyen Promise: tavan anında panel açılır
  const summary=byRole(el,'summary')[0],banner=byRole(el,'banner')[0],intro=byRole(el,'intro')[0],inter=byRole(el,'inter')[0];
  assert.equal(banner.hidden,true,'uzun hold: "RAUND X" yazı aşaması atlanır');
  assert.equal(summary.hidden,false,'özet tavan anında doğrudan açılır');
  let visibleMs=0;
  for(;t<50_000;t+=100){ui.tick();if(!summary.hidden)visibleMs+=100;}
  assert.ok(visibleMs>=2500,`özet en az 2,5 sn görünür olmalı (${visibleMs} ms)`);
  assert.equal(intro.hidden,false,'son 3 sn: geri sayım özetle birlikte görünür');
  assert.ok(inter.classList.contains('is-count'),'son 3 sn: kompakt düzen işareti (is-count)');
  ui.destroy();
});
test('tur arası: kısa hold yazı → panel sırasını korur; uzun hold yazıyı atlayıp özeti doğrudan açar',async()=>{
  const m=roundMatch({roundsWon:{1:1,2:1},round:{phase:'intermission',nextRoundAt:50_000}});
  // Kısa hold (≤ ROUND_HOLD_TITLE_SKIP_MS): yazı yine görünür, sonra panel.
  const host=new FakeEl('div');const timers=fakeTimers();let t=41_000;let release;
  const hold=new Promise(resolve=>{release=resolve;});
  const ui=createRoundsUi(host,{now:()=>t,doc:fakeDoc,timers,holdTransition:()=>hold});
  const el=host.children[0];
  ui.handle({type:'ROUND_END',payload:{...roundEnd,match:m}});ui.update(m,'me');ui.tick();
  t=41_000+ROUND_HOLD_TITLE_SKIP_MS-500;release();await hold;await Promise.resolve();ui.tick();
  const banner=byRole(el,'banner')[0],summary=byRole(el,'summary')[0];
  assert.equal(banner.hidden,false,'kısa hold: yazı gösterilir');
  assert.equal(summary.hidden,true,'panel yazı bitince açılır');
  t+=ROUND_TITLE_MS+10;ui.tick();
  assert.equal(banner.hidden,true);assert.equal(summary.hidden,false);
  ui.destroy();
  // Uzun hold (> ROUND_HOLD_TITLE_SKIP_MS): yazı atlanır, özet doğrudan açılır.
  const host2=new FakeEl('div');const timers2=fakeTimers();let t2=41_000;let release2;
  const hold2=new Promise(resolve=>{release2=resolve;});
  const ui2=createRoundsUi(host2,{now:()=>t2,doc:fakeDoc,timers:timers2,holdTransition:()=>hold2});
  ui2.handle({type:'ROUND_END',payload:{...roundEnd,match:m}});ui2.update(m,'me');ui2.tick();
  t2=41_000+ROUND_HOLD_TITLE_SKIP_MS+300;release2();await hold2;await Promise.resolve();ui2.tick();
  assert.equal(byRole(host2.children[0],'banner')[0].hidden,true,'uzun hold: yazı aşaması atlanır');
  assert.equal(byRole(host2.children[0],'summary')[0].hidden,false,'özet doğrudan açılır');
  ui2.destroy();
});
test('tur arası: count aşamasında beceri seçici açık kalır ve kilitlenebilir (son 3 sn davranışı korunur)',()=>{
  const {el,ui,setNow}=mount(41_000);
  const m=roundMatch({roundsWon:{1:1,2:1},round:{phase:'intermission',nextRoundAt:50_000}});
  ui.handle({type:'ROUND_END',payload:{...roundEnd,match:m}});ui.update(m,'me');
  setNow(48_000);ui.tick(); // remaining=2000 → count
  assert.equal(byRole(el,'summary')[0].hidden,false);assert.equal(byRole(el,'intro')[0].hidden,false);
  assert.equal(ui.handleKey({key:'1',preventDefault(){}}),true,'count aşamasında seçim yapılabilir');
  assert.equal(ui.handleKey({key:'Enter',preventDefault(){}}),true,'count aşamasında kilitlenebilir');
  ui.destroy();
});

// ---------- sabitler ve eşlemeler ----------
test('rounds: single option 7; every stored value normalises to 7',()=>{
  // KESINYAP 11: maç uzunluğu seçeneği kalktı; eski kayıtlı 5/10 sessizce 7'ye döner.
  assert.deepEqual(ROUND_OPTIONS,[7]);
  for(const v of [7,'10',5,0,3,6,'x',null,undefined,11])assert.equal(normalizeRounds(v),7);
  assert.equal(PRACTICE_ROUNDS_KEY,'tuslab-pvp-practice-rounds');
});
test('rounds: streak multiplier and label mapping (×1.5 → ×2.5 cap, none below 7)',()=>{
  for(const s of [0,1,3,5,6])assert.equal(streakMultiplier(s),1);
  assert.equal(streakMultiplier(7),1.5);assert.equal(streakMultiplier(8),1.8);
  assert.equal(streakMultiplier(9),2.16);assert.equal(streakMultiplier(10),2.5);assert.equal(streakMultiplier(14),2.5);
  assert.equal(multiplierLabel(1),null);
  assert.deepEqual([7,8,9,10].map(s=>multiplierLabel(streakMultiplier(s))),['×1.5','×1.8','×2.16','×2.5']);
});
test('rounds: streak meter thresholds 3 Q / 5 E / 7 R and next skill',()=>{
  assert.deepEqual(STREAK_SKILLS,{3:'q',5:'e',7:'r',8:'q',9:'q',10:'q'});
  const four=streakModel(4);
  assert.deepEqual(four.ticks.map(t=>[t.at,t.key,t.reached]),[[3,'Q',true],[5,'E',false],[7,'R',false]]);
  assert.equal(four.nextSkill,'E');assert.equal(four.multiplierLabel,null);assert.equal(four.cells,10);assert.equal(four.filled,4);
  assert.equal(streakModel(2).nextSkill,'Q');assert.equal(streakModel(6).nextSkill,'R');
  const seven=streakModel(7);assert.equal(seven.multiplierLabel,'×1.5');assert.equal(seven.nextSkill,'Q');
  assert.equal(streakModel(10).nextSkill,'Q'); // KESINYAP 11: 8 ve sonrası her doğru kelime Q
  assert.equal(streakModel(-3).filled,0);
});
test('rounds: predicted skill uses streak table in round mode, cyclic Q2/E4/R5 in classic',()=>{
  assert.equal(predictedSkill({combo:2,streak:2},{mode:'rounds',round:{}}),'Q');
  assert.equal(predictedSkill({combo:6,streak:6},{mode:'rounds',round:{}}),'R');
  assert.equal(predictedSkill({combo:3,streak:3},{mode:'rounds',round:{}}),null);
  assert.equal(predictedSkill({combo:1},classicMatch),'Q');
  assert.equal(predictedSkill({combo:3},classicMatch),'E');
  assert.equal(predictedSkill({combo:4},classicMatch),'R');
  assert.equal(predictedSkill({combo:2},classicMatch),null);
});
test('rounds: progress dots replace wins needed (7 dots, played filled)',()=>{
  // KESINYAP 11: raund kazanma/pip yok; noktalar oynanan raundları gösterir.
  assert.deepEqual(roundDots(1,7,'round'),{filled:0,total:7,current:1});
  assert.deepEqual(roundDots(3,7,'round'),{filled:2,total:7,current:3});
  assert.deepEqual(roundDots(3,7,'intermission'),{filled:3,total:7,current:3});
  assert.deepEqual(roundDots(9,7,'round'),{filled:7,total:7,current:7});
});

// ---------- HUD görünüm modeli ----------
test('rounds HUD: classic or missing payloads keep the round UI hidden',()=>{
  assert.equal(isRoundMatch(classicMatch),false);assert.equal(isRoundMatch(null),false);
  assert.equal(isRoundMatch({mode:'rounds'}),false,'round alanı olmadan tur modu sayılmaz');
  assert.equal(roundsViewModel(classicMatch,'me',1000).visible,false);
  assert.equal(roundsViewModel(null,'me',1000).visible,false);
  assert.equal(roundsViewModel({...classicMatch,status:'ended'},'me',1000).visible,false);
});
test('rounds HUD: ROUND_START → RAUND 2 / 5, ten-word strip, server-clock timer',()=>{
  const vm=roundsViewModel(roundMatch(),'me',25_000);
  assert.equal(vm.visible,true);assert.equal(vm.title,'RAUND 2 / 5');assert.equal(vm.suddenDeath,false);
  assert.equal(vm.timer.seconds,15);assert.equal(vm.timer.text,'15');assert.equal(vm.timer.urgent,false);
  assert.ok(Math.abs(vm.timer.fraction-0.5)<1e-9); // KESINYAP 11: biçimsiz raund = zamana karşı 30 sn → 15/30
  assert.equal(vm.words.length,10);assert.equal(vm.words[6].state,'active');assert.equal(vm.words[7].opponent,true);
  assert.equal(vm.words[9].state,'todo');
  const [left,right]=vm.sides;
  assert.equal(left.seat,1);assert.equal(left.isMe,true);assert.equal(left.progress,'Kelime 6/10');
  assert.equal(right.progress,'Kelime 7/10');assert.equal(right.streak.multiplierLabel,'×1.5');
  // KESINYAP 11: pip = raund ilerlemesi (2. raund oynanıyor → 1 dolu / 5); taşınan can ve raund hasarı görünür.
  assert.deepEqual(left.pips,{filled:1,total:5,current:2});assert.deepEqual(right.pips,left.pips);
  assert.equal(left.hpText,'Can 1.200/1.200');assert.equal(right.hpText,'Can 900/1.200');
  assert.equal(right.damageText,'Raund hasarı 738/1300');assert.equal(right.capped,false);
});
test('rounds HUD: urgent in the last 5 s and frozen while paused',()=>{
  assert.equal(roundsViewModel(roundMatch(),'me',35_500).timer.urgent,true);
  assert.equal(roundsViewModel(roundMatch(),'me',35_500).timer.seconds,5);
  const paused=roundMatch({status:'paused',pausedAt:20_000});
  const a=roundsViewModel(paused,'me',22_000),b=roundsViewModel(paused,'me',38_000);
  assert.equal(a.timer.seconds,20);assert.equal(b.timer.seconds,20);assert.equal(a.timer.frozen,true);
});
test('rounds HUD: last call badge and finished player',()=>{
  const m=roundMatch({round:{endsAt:31_000},players:roundMatch().players.map(p=>p.seat===2?{...p,roundWordIndex:10,roundDone:true,finishedAt:26_000}:p)});
  const vm=roundsViewModel(m,'me',27_000);
  assert.equal(vm.lastCall.active,true);assert.equal(vm.lastCall.text,'SON ÇAĞRI · 4 sn');assert.equal(vm.timer.urgent,true);
  assert.equal(vm.sides[1].done,true);assert.equal(vm.sides[1].doneText,'Tamamlandı ✓');assert.equal(vm.sides[0].done,false);
  assert.equal(roundsViewModel(roundMatch(),'me',27_000).lastCall.active,false);
});
test('rounds HUD: sudden death styling label',()=>{
  const vm=roundsViewModel(roundMatch({round:{index:6,suddenDeath:true}}),'me',20_000);
  assert.equal(vm.title,'ANİ ÖLÜM');assert.equal(vm.suddenDeath,true);
});
test('rounds HUD: input lock reasons (intermission, settling, done, time over)',()=>{
  assert.equal(roundInputLock(classicMatch,'me',1000).locked,false);
  assert.equal(roundInputLock(roundMatch(),'me',20_000).locked,false);
  assert.equal(roundInputLock(roundMatch(),'me',40_000).locked,true,'serverNow ≥ endsAt girişi kilitler');
  assert.equal(roundInputLock(roundMatch({round:{phase:'intermission'}}),'me',20_000).locked,true);
  assert.equal(roundInputLock(roundMatch({round:{phase:'settling'}}),'me',20_000).locked,true);
  const done=roundMatch({players:roundMatch().players.map(p=>p.seat===1?{...p,roundDone:true}:p)});
  const lock=roundInputLock(done,'me',20_000);assert.equal(lock.locked,true);assert.match(lock.reason,/Tamamlandı/);
});

// ---------- tur sonu, çarpışma ----------
test('round summary card: both sides\' damage, carried HP, KO badge, stats table and next round',()=>{
  // KESINYAP 11: raund kazananı yerine 'Bu raund: Sen X hasar · Rakip Y hasar' + kalan can + sıradaki raund.
  const s=summaryModel({...roundEnd,next:{round:3,style:'counted',words:9}},roundMatch(),'me');
  assert.equal(s.title,'RAUND 2 BİTTİ');assert.equal(s.ko,true);assert.equal(s.draw,false);assert.equal(s.winnerSeat,2);
  assert.ok(s.names[1].includes('<img src=x onerror=alert(1)>'),'isim düz metin olarak kalır; DOM katmanı textContent kullanır');
  assert.equal(s.damageLine,'Bu raund: Sen 210 hasar · Rakip 1.200 hasar');
  assert.equal(s.hpLine,'Kalan can: Sen 0 · Rakip 420');
  assert.deepEqual(s.rows.map(r=>r.label),['Doğru','Yanlış','En iyi seri','Hasar','Kalan can']);
  assert.deepEqual(s.rows.find(r=>r.label==='Hasar').values,['210/1300','1200/1300']);
  assert.deepEqual(s.rows.find(r=>r.label==='En iyi seri').values,['4','7']);
  assert.equal(s.scoreline,'0 – 420');assert.equal(s.nextText,'Sıradaki: RAUND 3 · 9 kelime');
  assert.equal(summaryModel({...roundEnd,next:{round:3,style:'timed',seconds:30}},roundMatch(),'me').nextText,'Sıradaki: RAUND 3 · 30 sn');
  const draw=summaryModel({...roundEnd,winnerSeat:null,reason:'TIME'},roundMatch(),'me');
  assert.equal(draw.winnerText,draw.damageLine);assert.equal(draw.draw,true);assert.equal(draw.ko,false);
  const last=summaryModel({...roundEnd,nextRoundAt:null,matchOver:true},roundMatch(),'me');
  assert.equal(last.nextText,'Maç sonucu hazırlanıyor');
});
test('word clash callout: blocker variant and both-hit variant',()=>{
  const m=roundMatch();
  const blocked=clashModel({type:'WORD_CLASH',clashId:'c1',seats:[1,2],roundWordIndex:3,word:'kılıç',blockerSeat:1,blockKind:'PERFECT_BLOCK',at:1},m,'me');
  assert.equal(blocked.title,'ÇARPIŞMA!');assert.equal(blocked.variant,'block');assert.equal(blocked.blockerSeat,1);
  assert.equal(blocked.detail,'Ayşe blokladı · PERFECT BLOK');assert.equal(blocked.word,'kılıç');
  const trade=clashModel({type:'WORD_CLASH',clashId:'c2',seats:[1,2],roundWordIndex:4,word:'<b>x</b>',blockerSeat:null,blockKind:null},m,'me');
  assert.equal(trade.variant,'trade');assert.equal(trade.detail,'İKİSİ DE VURDU');assert.equal(trade.blockerSeat,null);
});

// ---------- lobi seçici ----------
test('rounds picker removed: only 7 is valid, the picker renders nothing',()=>{
  // KESINYAP 11: 'Maç uzunluğu 5/7/10 tur' seçeneği kalktı; yalnız 7 geçerli, seçici HTML üretmez.
  assert.deepEqual(roundsPickDecision({scope:'room',value:7,isHost:true,phase:'waiting'}),{type:'MATCH_CONFIG',payload:{rounds:7}});
  assert.equal(roundsPickDecision({scope:'room',value:'10',isHost:true,phase:'countdown'}),null);
  assert.equal(roundsPickDecision({scope:'room',value:7,isHost:false,phase:'waiting'}),null);
  assert.equal(roundsPickDecision({scope:'room',value:7,isHost:true,phase:'started'}),null);
  assert.equal(roundsPickDecision({scope:'room',value:7,isHost:true,phase:'waiting',current:7}),null,'aynı değer tekrar gönderilmez');
  assert.equal(roundsPickDecision({scope:'room',value:5,isHost:true,phase:'waiting'}),null,'eski değer gönderilmez');
  assert.equal(roundsPickDecision({scope:'practice',value:10}),null);
  assert.deepEqual(roundsPickDecision({scope:'practice',value:7}),{store:7});
  const html=roundsPickerHTML('room');
  assert.equal(html,'');assert.ok(!html.includes('Maç uzunluğu'));
});
test('network.js wires the picker, MATCH_CONFIG, practice rounds and round packets',()=>{
  const net=readFileSync(new URL('../pvp/network.js',import.meta.url),'utf8');
  assert.match(net,/roundsPickDecision\(/);assert.match(net,/PRACTICE_ROUNDS_KEY/);
  assert.match(net,/rounds:this\.practiceRounds/);
  for(const t of ['ROUND_START','ROUND_LAST_CALL','ROUND_END'])assert.ok(net.includes(`'${t}'`),t);
  assert.match(net,/tuslab:pvp-round/);
  const idx=readFileSync(new URL('../pvp/index.js',import.meta.url),'utf8');
  assert.match(idx,/createRoundsUi\(/);assert.match(idx,/WORD_CLASH/);assert.match(idx,/renderRoundsResult\(/);
});

// ---------- maç sonu ----------
test('match result: remaining-HP scoreline and per-round damage rows; classic result has none',()=>{
  // KESINYAP 11: '3 – 2' yerine kalan can ('2.100 – 1.650 · 7 raund' / '1.240 – 0 · NAKAVT'); tabloda raund başına iki tarafın hasarı.
  const result={mode:'rounds',totalRounds:7,finalHp:{1:2100,2:1650},winnerSeat:1,endReason:'ROUNDS',
    players:[{seat:1,playerId:'me',name:'Ayşe'},{seat:2,playerId:'op',name:'Bot'}],
    rounds:[1,2,3,4,5,6,7].map(n=>({round:n,winnerSeat:n===3?null:n%2?1:2,reason:'TIME',scores:[{seat:1,damageDealt:n===3?0:400},{seat:2,damageDealt:n===3?0:300}]}))};
  const r=roundsResultModel(result,'me');
  assert.equal(r.scoreline,'2.100 – 1.650 · 7 raund');assert.equal(r.rows.length,7);
  assert.equal(r.rows[0].winner,'Ayşe');assert.equal(r.rows[0].damage,'400 – 300');assert.equal(r.rows[2].winner,'Eşit');
  assert.equal(r.reasonLabel,'KALAN CAN ÜSTÜNLÜĞÜ');assert.equal(r.lengthLabel,'Kalan can · 7 raundluk maç · 4.000 can');
  const ko=roundsResultModel({...result,endReason:'KNOCKOUT',finalHp:{1:1240,2:0},rounds:result.rounds.slice(0,5)},'me');
  assert.equal(ko.scoreline,'1.240 – 0 · NAKAVT');assert.equal(ko.reasonLabel,'NAKAVT');
  assert.equal(roundsResultModel({...result,endReason:'ROUNDS_DRAW',winnerSeat:null},'me').reasonLabel,'ANİ ÖLÜMDE DE BERABERE');
  assert.equal(roundsResultModel({endReason:'KNOCKOUT',players:[]},'me'),null);
  assert.equal(roundsResultModel(null,'me'),null);
});

// ---------- DOM bileşeni ----------
test('rounds DOM: hidden for classic, renders round text, escapes names via textContent',()=>{
  const {el,ui}=mount(25_000);
  assert.equal(el.getAttribute('data-rounds-ui'),'');
  ui.update(classicMatch,'me');assert.equal(el.hidden,true);
  ui.update(roundMatch(),'me');assert.equal(el.hidden,false);
  const text=el.textContent;
  assert.ok(text.includes('RAUND 2 / 5'));assert.ok(text.includes('Kelime 6/10'));assert.ok(text.includes('<img src=x onerror=alert(1)>'));
  assert.equal(byRole(el,'word').length,10);
  assert.ok(text.includes('×1.5'));
  ui.update(classicMatch,'me');assert.equal(el.hidden,true);
  ui.destroy();
});
test('rounds DOM: last call, clash callout, summary overlay and unknown packets',()=>{
  const {el,ui,setNow}=mount(27_000);
  const m=roundMatch();ui.update(m,'me');
  ui.handle({type:'ROUND_LAST_CALL',payload:{round:2,finishedSeat:2,endsAt:31_000,match:m}});
  assert.ok(el.textContent.includes('SON ÇAĞRI'));
  ui.handle({type:'WORD_CLASH',payload:{type:'WORD_CLASH',clashId:'k',seats:[1,2],roundWordIndex:2,word:'rün',blockerSeat:null,blockKind:null}});
  assert.ok(el.textContent.includes('İKİSİ DE VURDU'));
  assert.doesNotThrow(()=>ui.handle({type:'TOTALLY_UNKNOWN',payload:null}));
  assert.doesNotThrow(()=>ui.handle(null));
  const ended=roundMatch({roundsWon:{1:1,2:1},round:{phase:'intermission',nextRoundAt:50_000}});
  setNow(46_000);ui.handle({type:'ROUND_END',payload:{...roundEnd,match:ended}});ui.update(ended,'me');
  const summary=byRole(el,'summary')[0];assert.equal(summary.hidden,false);
  // KESINYAP 11: başlık RAUND; kart iki tarafın hasarını (tavana göre) gösterir.
  assert.ok(summary.textContent.includes('RAUND 2 BİTTİ'));assert.ok(summary.textContent.includes('NAKAVT'));assert.ok(summary.textContent.includes('1200/1300'));
  setNow(48_500);ui.tick();
  // Yeni davranış: son 3 sn'de (count) özet GİZLENMEZ; geri sayımla birlikte görünür kalır.
  assert.equal(summary.hidden,false);
  const intro=byRole(el,'intro')[0];assert.equal(intro.hidden,false);assert.ok(intro.textContent.includes('RAUND 3'));assert.ok(intro.textContent.includes('2'));
  ui.destroy();
});
test('rounds DOM: streak break flag on wrong word and destroy clears every timer',()=>{
  const {el,ui,timers}=mount(20_000);
  const m=roundMatch();ui.update(m,'me');
  const broken=roundMatch({sequence:6,players:m.players.map(p=>p.seat===1?{...p,streak:0,combo:0,roundWrong:2,roundWordIndex:7,nextSkill:'q'}:p)});
  ui.update(broken,'me');
  assert.ok(el.textContent.includes('SERİ BOZULDU'));
  assert.ok(byRole(el,'meter')[0].classList.contains('is-broken'));
  assert.ok(timers.live.size>0);
  ui.destroy();
  assert.equal(timers.live.size,0);assert.equal(el.parentNode,null);
});

test('round summary presentation: SEN KAZANDIN / rakip adı / berabere + ton',()=>{
  const m=roundMatch();
  const mine=summaryModel({...roundEnd,winnerSeat:1},m,'me');
  assert.deepEqual([mine.mine,mine.tone,mine.headline],[true,'win','SEN KAZANDIN']);
  const opp=summaryModel(roundEnd,m,'me');
  assert.equal(opp.tone,'loss');assert.equal(opp.mine,false);assert.ok(opp.headline.endsWith(' KAZANDI')&&!opp.headline.includes('SEN'));
  assert.deepEqual(summaryPresentation(null,m,'me'),{mine:false,tone:'draw',headline:'BERABERE'});
});
