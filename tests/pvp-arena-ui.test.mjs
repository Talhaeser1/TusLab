// Arena arayüzü — docs/ARENA-MODU.md §8.2 (Ajan 4a). Anlık görüntüler gerçek motordan üretilir.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createArenaMatch,submitArenaPick,submitArenaWord,advanceArenaMatch,arenaPublicMatch,surrenderArenaMatch,ARENA_MATCH_HP,
  ARENA_ROUND_DURATION_MS,ARENA_PREP_DURATION_MS} from '../pvp/shared/arena.js';
import {
  ARENA_UI_SKILLS,ARENA_UI_ITEMS,isArenaMatch,arenaTarget,arenaInputLock,arenaPenalty,arenaComboModel,
  arenaCombatActions,arenaSummaryModel,arenaResultModel,looksScrambled,normalizeMode,modePickDecision,
  modePickerHTML,createArenaUi
} from '../pvp/arena-ui.js';

const PLAYERS=[{playerId:'me',seat:1,name:'Ayşe',character:'fire'},{playerId:'op',seat:2,name:'<img src=x onerror=alert(1)>',character:'rune'}];
const T0=1_000_000;
function fresh(){return createArenaMatch(PLAYERS,T0,'m-arena',{seed:12345});}
function toRound(m,picks={}){
  for(const [playerId,pick] of Object.entries({me:picks.me||{},op:picks.op||{}})){
    const r=submitArenaPick(m,{playerId,...pick},T0+100);assert.ok(r.match,r.error);m=r.match;
  }
  return advanceArenaMatch(m,T0+200).match;
}

// ---------- minimal sahte DOM (innerHTML yasak) ----------
class FakeClassList{constructor(){this.set=new Set();}add(...c){c.forEach(x=>this.set.add(x));}remove(...c){c.forEach(x=>this.set.delete(x));}
  toggle(c,on){const want=on===undefined?!this.set.has(c):Boolean(on);want?this.set.add(c):this.set.delete(c);return want;}contains(c){return this.set.has(c);}}
class FakeEl{
  constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.attrs={};this.classList=new FakeClassList();this.style={setProperty:(k,v)=>{this.style[k]=v;}};this.dataset={};this._text='';this.hidden=false;this.parentNode=null;this.disabled=false;this.listeners={};}
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
  addEventListener(type,fn){(this.listeners[type]||=[]).push(fn);}removeEventListener(){}
  click(){for(const fn of this.listeners.click||[])fn({target:this,currentTarget:this,preventDefault(){}});}
}
const fakeDoc={createElement:t=>new FakeEl(t),createElementNS:(ns,t)=>new FakeEl(t),hidden:false};
function fakeTimers(){
  const live=new Map();let id=0;
  const add=(fn,ms,repeat)=>{id++;live.set(id,{fn,ms,repeat});return id;};
  return {live,setTimeout:(fn,ms)=>add(fn,ms,false),clearTimeout:i=>live.delete(i),setInterval:(fn,ms)=>add(fn,ms,true),clearInterval:i=>live.delete(i)};
}
const all=node=>[node,...node.children.flatMap(all)];
const byRole=(el,name)=>all(el).filter(n=>n.dataset?.aui===name);
function mount(now){
  const hud=new FakeEl('div'),stage=new FakeEl('div'),overlay=new FakeEl('div');const timers=fakeTimers();let t=now;const sent=[];
  const ui=createArenaUi({hudHost:hud,stageHost:stage,overlayHost:overlay,now:()=>t,doc:fakeDoc,timers,isReduced:()=>false,send:(type,payload)=>sent.push({type,payload})});
  return {hud,stage,overlay,ui,timers,sent,setNow:v=>{t=v;}};
}

// ---------- saf modeller ----------
test('arena ui: catalog mirrors the spec ids, verb-first labels and keyboard slots',()=>{
  assert.deepEqual(ARENA_UI_SKILLS.map(s=>s.id),['scramble','overtime','timethief','freeze','blindclock']);
  assert.deepEqual(ARENA_UI_ITEMS.map(s=>s.id),['combostone','cleanse','gauntlet','aegis']);
  assert.deepEqual([...ARENA_UI_SKILLS,...ARENA_UI_ITEMS].map(s=>s.key),['1','2','3','4','5','6','7','8','9']);
  for(const s of [...ARENA_UI_SKILLS,...ARENA_UI_ITEMS]){assert.ok(s.verb.length>3);assert.ok(s.name.length>3);}
});
test('arena ui: penalty mirrors §5.2 (D Y Y Y D → −%48, cap 75, cleanse → 0)',()=>{
  assert.equal(arenaPenalty(0),0);assert.equal(arenaPenalty(1),0.1);
  assert.equal(Math.round(arenaPenalty(3)*100),48);
  assert.equal(arenaPenalty(9),0.75);
  assert.equal(arenaPenalty(3,'cleanse'),0);
});
test('arena ui: combo meter has 4 cells, KOMBO at 4, FİNAL at 5+, combostone boosts labels',()=>{
  assert.equal(arenaComboModel(2).filled,2);assert.equal(arenaComboModel(2).label,null);
  assert.equal(arenaComboModel(4).label,'KOMBO ×1.5');assert.equal(arenaComboModel(4).cells,4);
  assert.equal(arenaComboModel(7).filled,4);assert.equal(arenaComboModel(7).label,'FİNAL ×2');
  assert.equal(arenaComboModel(4,'combostone').label,'KOMBO ×1.75');assert.equal(arenaComboModel(5,'combostone').label,'FİNAL ×2.4');
});
test('arena ui: mode helpers (classic · rounds · arena), host-only MATCH_CONFIG',()=>{
  assert.equal(normalizeMode('arena'),'arena');assert.equal(normalizeMode('x'),'rounds');assert.equal(normalizeMode('classic'),'classic');
  assert.deepEqual(modePickDecision({scope:'room',value:'arena',isHost:true,phase:'waiting',current:'rounds'}),{type:'MATCH_CONFIG',payload:{mode:'arena'}});
  assert.deepEqual(modePickDecision({scope:'room',value:'rounds',isHost:true,phase:'waiting',current:'arena',rounds:7}),{type:'MATCH_CONFIG',payload:{mode:'rounds',rounds:7}});
  assert.equal(modePickDecision({scope:'room',value:'arena',isHost:false,phase:'waiting',current:'rounds'}),null);
  assert.equal(modePickDecision({scope:'room',value:'arena',isHost:true,phase:'started',current:'rounds'}),null);
  assert.deepEqual(modePickDecision({scope:'practice',value:'arena'}),{store:'arena'});
  const html=modePickerHTML('practice');
  for(const label of ['Klasik','Zamana Karşı','Arena'])assert.ok(html.includes(label),label);
  assert.ok(html.includes('data-lobby-action="mode"'));
});

test('arena ui: personal target, input lock per phase and scramble detection',()=>{
  const prep=arenaPublicMatch(fresh(),1);
  assert.ok(isArenaMatch(prep));assert.equal(isArenaMatch({mode:'rounds',round:{}}),false);
  assert.equal(arenaInputLock(prep,'me',T0).locked,true);
  assert.match(arenaInputLock(prep,'me',T0).reason,/Raund öncesi/);
  const m=toRound(fresh());const pub=arenaPublicMatch(m,1);
  assert.equal(pub.round.phase,'round');
  assert.equal(arenaTarget(pub,'me'),pub.round.words[0]);
  assert.equal(arenaInputLock(pub,'me',T0+300).locked,false);
  assert.equal(arenaInputLock(pub,'me',T0+300,T0+250).locked,true,'kişisel süre bittiyse kilitli');
  assert.equal(looksScrambled(pub.round.words),false);
  const scrambled=arenaPublicMatch(toRound(fresh(),{op:{skill:'scramble'}}),1);
  assert.notDeepEqual(scrambled.round.words,pub.round.words);
  assert.equal(looksScrambled(scrambled.round.words),true);
});

test('arena ui: ARENA_ATTACK maps to a cast + DAMAGE_APPLIED pair; other events pass through',()=>{
  const e={id:7,type:'ARENA_ATTACK',fromSeat:1,toSeat:2,wordIndex:4,amount:150,multiplier:1.5,penalty:0,tags:['KOMBO'],hpAfter:4850};
  const actions=arenaCombatActions(e);
  assert.equal(actions.length,2);
  assert.equal(actions[0].type,'SKILL_CAST');assert.equal(actions[0].fromSeat,1);
  assert.equal(actions[1].type,'DAMAGE_APPLIED');assert.equal(actions[1].toSeat,2);assert.equal(actions[1].amount,150);
  assert.equal(actions[1].blocked,false);assert.deepEqual(actions[1].bonusTags,['KOMBO']);
  const final=arenaCombatActions({...e,tags:['FİNAL']});assert.equal(final[0].skill,'e');
  const plain={type:'DAMAGE_APPLIED',toSeat:1,amount:3};
  assert.deepEqual(arenaCombatActions(plain),[plain]);
});

test('arena ui: round summary and result models (names stay text)',()=>{
  const m=arenaPublicMatch(fresh(),1);
  const s=arenaSummaryModel({round:2,scores:[{seat:1,correct:8,wrong:2,bestStreak:5,damageDealt:0,hpLeft:4000},{seat:2,correct:6,wrong:4,bestStreak:3,damageDealt:0,hpLeft:3500}]},
    m,'me',{damage:{1:1234,2:567}});
  assert.equal(s.title,'RAUND 2 BİTTİ');
  assert.deepEqual(s.rows.find(r=>r.label==='Verilen hasar').values,['1.234','567']);
  assert.ok(s.names[0].includes('(sen)'));assert.ok(s.names[1].includes('<img'));
  assert.ok(s.nextText.includes('RAUND 3'));
  const ended=arenaPublicMatch(surrenderArenaMatch(fresh(),2,T0+500),1);
  const r=arenaResultModel(ended.result,'me');
  assert.equal(r.rows.length,2);assert.ok(r.rows[0].hp.includes(ARENA_MATCH_HP.toLocaleString('tr-TR')));
  assert.equal(arenaResultModel({mode:'rounds'},'me'),null);
});

// ---------- DOM ----------
test('arena DOM: hidden outside arena; prep cards with uses, hidden opponent pick, keyboard lock',()=>{
  const {hud,stage,ui,sent,setNow}=mount(T0+1000);
  ui.update({mode:'rounds',status:'running',round:{phase:'round'},players:[]},'me');
  assert.equal(hud.children[0].hidden,true);
  const prep=arenaPublicMatch(fresh(),1);
  ui.update(prep,'me');
  assert.equal(hud.children[0].hidden,false);
  const text=hud.textContent+stage.textContent;
  assert.ok(text.includes('RAUND 1 / 6'));assert.ok(text.includes('<img src=x onerror=alert(1)>'));
  assert.ok(stage.textContent.includes('Rakibin seçimi gizli'));
  const cards=byRole(stage,'card');assert.equal(cards.length,9);
  assert.ok(cards[0].textContent.includes('2/2'));
  // 1 → Harf Kaosu seçilir, 6 → Kombo Yükselteci, Enter kilitler.
  const key=k=>({key:k,preventDefault(){},target:{tagName:'BODY'}});
  assert.equal(ui.handleKey(key('1')),true);assert.equal(ui.handleKey(key('6')),true);
  assert.equal(cards[0].getAttribute('aria-pressed'),'true');
  assert.equal(ui.handleKey(key('Enter')),true);
  assert.deepEqual(sent,[{type:'ARENA_PICK',payload:{skill:'scramble',item:'combostone'}}]);
  assert.ok(stage.textContent.includes('Kilitlendi'));
  assert.equal(ui.handleKey(key('2')),false,'kilitten sonra seçim değişmez');
  setNow(T0+2000);ui.tick();
  ui.destroy();
});
test('arena DOM: Esc skips with an empty pick; auto-lock just before the prep deadline',()=>{
  const a=mount(T0+1000);a.ui.update(arenaPublicMatch(fresh(),1),'me');
  assert.equal(a.ui.handleKey({key:'Escape',preventDefault(){},target:{tagName:'BODY'}}),true);
  assert.deepEqual(a.sent,[{type:'ARENA_PICK',payload:{skill:null,item:null}}]);a.ui.destroy();
  const b=mount(T0+1000);b.ui.update(arenaPublicMatch(fresh(),1),'me');
  b.ui.handleKey({key:'4',preventDefault(){},target:{tagName:'BODY'}});
  b.setNow(T0+ARENA_PREP_DURATION_MS-400);b.ui.tick();
  assert.deepEqual(b.sent,[{type:'ARENA_PICK',payload:{skill:'freeze',item:null}}]);b.ui.destroy();
});
test('arena DOM: round view — strip sized to word count, D/Y marks, penalty chip, blind clock, HARF KAOSU label',()=>{
  let m=toRound(fresh(),{op:{skill:'scramble'}});
  const {hud,stage,ui,setNow}=mount(T0+300);
  ui.handle({type:'ARENA_ROUND_START',payload:{round:1,totalRounds:6,words:arenaPublicMatch(m,1).round.words,endsAt:T0+200+ARENA_ROUND_DURATION_MS}});
  ui.update(arenaPublicMatch(m,1),'me');
  const words=byRole(stage,'word');assert.equal(words.length,5);
  assert.ok(stage.textContent.includes('HARF KAOSU'));
  assert.ok(/⏱ \d+ sn/.test(hud.textContent),'kendi süren görünür');
  // Karanlık Saat: motor süreyi null verince arayüz sayı göstermez ("🌑 —"), kurban etiketi görür.
  const blind=toRound(fresh(),{op:{skill:'blindclock'}});
  const b=mount(T0+300);b.ui.handle({type:'ARENA_ROUND_START',payload:{round:1,totalRounds:6,words:[],endsAt:T0+200+ARENA_ROUND_DURATION_MS}});
  b.ui.update(arenaPublicMatch(blind,1),'me');
  assert.ok(b.hud.textContent.includes('🌑 —'));assert.ok(!/⏱ \d+ sn/.test(b.hud.textContent),'sayı sızmaz');
  assert.ok(b.stage.textContent.includes('KARANLIK SAAT'));
  b.ui.destroy();
  // D Y Y Y → −%48
  const w=arenaPublicMatch(m,1).round.words;
  let at=T0+400;
  const send=(text,i)=>{const r=submitArenaWord(m,{playerId:'me',matchId:m.id,wordIndex:i,text,round:1},at);assert.ok(r.match,r.error);m=r.match;at+=100;
    ui.handle({type:'WORD_RESULT',payload:r.result});};
  send(w[0],0);send('yanlis',1);send('yanlis',2);send('yanlis',3);
  setNow(at);ui.update(arenaPublicMatch(m,1),'me');
  assert.ok(byRole(stage,'word')[0].classList.contains('is-good'));
  assert.ok(byRole(stage,'word')[1].classList.contains('is-bad'));
  assert.ok(hud.textContent.includes('−%48'));
  ui.destroy();
  assert.equal(hud.children.length,0);
});
test('arena DOM: summary overlay after the round and destroy clears timers',()=>{
  let m=toRound(fresh());
  m=advanceArenaMatch(m,T0+200+ARENA_ROUND_DURATION_MS+1).match;          // süre doldu → (vuruş yok) → özet
  const pub=arenaPublicMatch(m,1);assert.equal(pub.round.phase,'summary');
  const {overlay,ui,timers}=mount(pub.round.summaryEndsAt-1000);
  ui.handle({type:'ARENA_ROUND_END',payload:{round:1,scores:[{seat:1,correct:0,wrong:0,bestStreak:0,damageDealt:0,hpLeft:5000},{seat:2,correct:0,wrong:0,bestStreak:0,damageDealt:0,hpLeft:5000}]}});
  ui.update(pub,'me');
  const summary=byRole(overlay,'summary')[0];
  assert.equal(summary.hidden,false);assert.ok(summary.textContent.includes('RAUND 1 BİTTİ'));
  assert.ok(timers.live.size>0);
  ui.destroy();assert.equal(timers.live.size,0);
});
test('arena summary waits for visual queue before showing result and starting its display timer',async()=>{
  let m=toRound(fresh());m=advanceArenaMatch(m,T0+200+ARENA_ROUND_DURATION_MS+1).match;
  const pub=arenaPublicMatch(m,1);
  const hud=new FakeEl('div'),stage=new FakeEl('div'),overlay=new FakeEl('div'),timers=fakeTimers();
  let release;const hold=new Promise(resolve=>{release=resolve;});let calls=0;
  const ui=createArenaUi({hudHost:hud,stageHost:stage,overlayHost:overlay,now:()=>pub.round.summaryEndsAt-1000,
    doc:fakeDoc,timers,holdTransition:()=>{calls++;return hold;}});
  ui.update(pub,'me');ui.tick();
  assert.equal(byRole(overlay,'summary')[0].hidden,true);
  assert.equal(calls,1);
  release();await hold;await Promise.resolve();
  assert.equal(byRole(overlay,'summary')[0].hidden,false);
  ui.destroy();
});

// ---------- kaynak bağlantıları ----------
test('wiring: network.js routes arena packets, ARENA_PICK and practice mode; index.js maps ARENA_ATTACK',()=>{
  const net=readFileSync(new URL('../pvp/network.js',import.meta.url),'utf8');
  for(const t of ['ARENA_PREP_START','ARENA_ROUND_START','ARENA_ROUND_END','ARENA_MATCH_END','ARENA_PICK_ACK'])assert.ok(net.includes(`'${t}'`),t);
  assert.match(net,/tuslab:pvp-arena/);
  assert.match(net,/mode:this\.practiceMode/);
  assert.match(net,/'ARENA_PICK'/);
  const idx=readFileSync(new URL('../pvp/pvp-main.js',import.meta.url),'utf8');
  assert.match(idx,/createArenaUi\(/);assert.match(idx,/arenaCombatActions\(/);assert.match(idx,/renderArenaResult\(/);
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(html,/pvp\/arena-ui\.css/);assert.match(html,/pvp\/typing-top\.css/);
});
