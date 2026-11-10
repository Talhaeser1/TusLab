// Tur (raund) arayüzü — docs/TUR-SISTEMI.md §10 ve §11 (Ajan B).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  ROUND_OPTIONS,STREAK_SKILLS,PRACTICE_ROUNDS_KEY,normalizeRounds,isRoundMatch,streakMultiplier,multiplierLabel,
  streakModel,predictedSkill,winsNeeded,roundsViewModel,summaryModel,clashModel,roundsPickDecision,
  roundInputLock,roundsResultModel,roundsPickerHTML,createRoundsUi
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
  const {el,ui}=mount(41_000);
  ui.update(roundMatch({round:{phase:'intermission',nextRoundAt:50_000}}),'me');
  const cards=all(el).filter(n=>n.getAttribute('data-round-skill'));
  assert.equal(cards.length,3);
  ui.handleKey({key:'1',preventDefault(){}});
  assert.equal(all(el).find(n=>n.getAttribute('data-round-skill')==='timethief'),cards[0]);
  assert.equal(cards[0].getAttribute('aria-pressed'),'true');
  ui.destroy();
});

test('fullscreen round result uses the centered panel without measuring or covering the typing panel',()=>{
  const {host,el,ui}=mount(41_000);host.dataset.layout='fullscreen';el.closest=()=>host;
  host.querySelector=()=>{throw new Error('fullscreen must not place results in the typing box');};
  const m=roundMatch({round:{phase:'intermission',nextRoundAt:50_000},roundHistory:[roundEnd]});
  ui.update(m,'me');const inter=byRole(el,'inter')[0];
  assert.ok(inter.classList.contains('is-centered'));assert.equal(inter.hidden,false);assert.ok(host.classList.contains('rui-inter-open'));
  ui.destroy();assert.equal(host.classList.contains('rui-inter-open'),false);
});

test('round end: shared player columns, winner emphasis, win pips and live countdown ring',()=>{
  const {el,ui,setNow}=mount(41_000);
  const m=roundMatch({roundsWon:{1:1,2:1},round:{phase:'intermission',nextRoundAt:50_000}});
  ui.handle({type:'ROUND_END',payload:{...roundEnd,match:m}});ui.update(m,'me');
  const result=all(el).find(n=>n.classList.contains('m33-result'));
  assert.ok(result);
  const columns=all(result).filter(n=>n.classList.contains('m33-player'));
  assert.equal(columns.length,2);assert.ok(columns[1].classList.contains('is-winner'));
  assert.ok(columns[0].textContent.includes('Doğru'));assert.ok(columns[0].textContent.includes('210'));
  assert.equal(all(result).filter(n=>n.classList.contains('m33-pip')).length,10);
  const ring=all(result).find(n=>n.getAttribute('class')==='m33-count-fill');
  assert.equal(ring.getAttribute('stroke-dashoffset'),'0.00');
  setNow(42_000);ui.tick();assert.ok(Number(ring.getAttribute('stroke-dashoffset'))>0);
  ui.destroy();
});

// ---------- sabitler ve eşlemeler ----------
test('rounds: options and normalisation (invalid → 5)',()=>{
  assert.deepEqual(ROUND_OPTIONS,[5,7,10]);
  assert.equal(normalizeRounds(7),7);assert.equal(normalizeRounds('10'),10);
  for(const bad of [0,3,6,'x',null,undefined,11])assert.equal(normalizeRounds(bad),5);
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
  assert.equal(streakModel(10).nextSkill,null);
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
test('rounds: wins needed for 5 / 7 / 10',()=>{
  assert.deepEqual([5,7,10].map(winsNeeded),[3,4,6]);
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
  assert.ok(Math.abs(vm.timer.fraction-0.375)<1e-9);
  assert.equal(vm.words.length,10);assert.equal(vm.words[6].state,'active');assert.equal(vm.words[7].opponent,true);
  assert.equal(vm.words[9].state,'todo');
  const [left,right]=vm.sides;
  assert.equal(left.seat,1);assert.equal(left.isMe,true);assert.equal(left.progress,'Kelime 6/10');
  assert.equal(right.progress,'Kelime 7/10');assert.equal(right.streak.multiplierLabel,'×1.5');
  assert.deepEqual(left.pips,{filled:1,total:3});assert.deepEqual(right.pips,{filled:0,total:3});
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
test('round summary card: winner, KO badge, stats table and score line',()=>{
  const s=summaryModel(roundEnd,roundMatch(),'me');
  assert.equal(s.title,'TUR 2 BİTTİ');assert.equal(s.ko,true);assert.equal(s.draw,false);assert.equal(s.winnerSeat,2);
  assert.ok(s.winnerText.includes('<img src=x onerror=alert(1)>'),'isim düz metin olarak kalır; DOM katmanı textContent kullanır');
  assert.deepEqual(s.rows.map(r=>r.label),['Doğru','Yanlış','En iyi seri','Hasar','RP']);
  assert.deepEqual(s.rows.find(r=>r.label==='RP').values,['721','1.170']);
  assert.deepEqual(s.rows.find(r=>r.label==='En iyi seri').values,['4','7']);
  assert.equal(s.scoreline,'1 – 1');assert.equal(s.nextText,'Sıradaki: RAUND 3');
  const draw=summaryModel({...roundEnd,winnerSeat:null,reason:'TIME'},roundMatch(),'me');
  assert.equal(draw.winnerText,'BERABERE');assert.equal(draw.draw,true);assert.equal(draw.ko,false);
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
test('rounds picker: MATCH_CONFIG only for the host while waiting/countdown; practice stores locally',()=>{
  assert.deepEqual(roundsPickDecision({scope:'room',value:7,isHost:true,phase:'waiting'}),{type:'MATCH_CONFIG',payload:{rounds:7}});
  assert.deepEqual(roundsPickDecision({scope:'room',value:'10',isHost:true,phase:'countdown'}),{type:'MATCH_CONFIG',payload:{rounds:10}});
  assert.equal(roundsPickDecision({scope:'room',value:7,isHost:false,phase:'waiting'}),null);
  assert.equal(roundsPickDecision({scope:'room',value:7,isHost:true,phase:'started'}),null);
  assert.equal(roundsPickDecision({scope:'room',value:7,isHost:true,phase:'waiting',current:7}),null,'aynı değer tekrar gönderilmez');
  assert.equal(roundsPickDecision({scope:'room',value:6,isHost:true,phase:'waiting'}),null,'geçersiz değer gönderilmez');
  assert.deepEqual(roundsPickDecision({scope:'practice',value:10}),{store:10});
  const html=roundsPickerHTML('room');
  for(const n of [5,7,10])assert.ok(html.includes(`data-rounds="${n}"`));
  assert.ok(html.includes('data-lobby-action="rounds"'));assert.ok(html.includes('Maç uzunluğu'));
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
test('match result: round scoreline and per-round rows; classic result has none',()=>{
  const result={mode:'rounds',totalRounds:5,roundsWon:{1:3,2:1},winnerSeat:1,endReason:'ROUNDS',
    players:[{seat:1,playerId:'me',name:'Ayşe'},{seat:2,playerId:'op',name:'Bot'}],
    rounds:[{round:1,winnerSeat:1,reason:'KO',scores:[{seat:1,rp:900},{seat:2,rp:400}]},{round:2,winnerSeat:2,reason:'TIME',scores:[{seat:1,rp:700},{seat:2,rp:800}]},
      {round:3,winnerSeat:null,reason:'TIME',scores:[{seat:1,rp:0},{seat:2,rp:0}]},{round:4,winnerSeat:1,reason:'ALL_DONE',scores:[{seat:1,rp:1100},{seat:2,rp:1000}]},{round:5,winnerSeat:1,reason:'KO',scores:[{seat:1,rp:1300},{seat:2,rp:200}]}]};
  const r=roundsResultModel(result,'me');
  assert.equal(r.scoreline,'3 – 1');assert.equal(r.rows.length,5);
  assert.equal(r.rows[0].winner,'Ayşe');assert.equal(r.rows[0].ko,true);assert.equal(r.rows[2].winner,'Berabere');
  assert.equal(r.reasonLabel,'TUR ÜSTÜNLÜĞÜ');assert.equal(r.lengthLabel,'5 turluk maç');
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
  assert.ok(summary.textContent.includes('TUR 2 BİTTİ'));assert.ok(summary.textContent.includes('KO'));assert.ok(summary.textContent.includes('1.170'));
  setNow(48_500);ui.tick();
  assert.equal(summary.hidden,true);
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
