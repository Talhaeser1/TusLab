// DEVIR-PVP madde 1: raund sonu vuruşları tur arası / yeni raundla karışmaz.
// - Çözümde (settling/resolve) ve vuruşlar bitmeyi beklerken üst başlık "RAUND N SONUCU", geri sayım yok.
// - Tur arası paneli/bandı açılmadan HEMEN önce ve ROUND_START'ta settleVisuals çağrılır (kalan vuruşlar animasyonsuz).
// - "SÜRE!" bandı yazma bitince (ROUND_RESOLVE) çıkar; ROUND_END'de (vuruşlardan sonra) tekrar çıkmaz.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {roundsViewModel,roundResultTitle,isResultPhase,createRoundsUi,ROUND_HOLD_MAX_MS} from '../pvp/rounds-ui.js';
import {roundResolveText,attachCinematic} from '../pvp/cinematic.js';
import {createArenaMatch,submitArenaPick,advanceArenaMatch,arenaPublicMatch,ARENA_ROUND_DURATION_MS} from '../pvp/shared/arena.js';
import {createArenaUi} from '../pvp/arena-ui.js';
import {createVisualTimeline} from '../pvp/visual-timeline.js';
import {createImpactDirector,createSettleGate,SETTLED_IDLE_PHASES} from '../pvp/impact-feel.js';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const WORDS=['ateş','kalkan','rün','kılıç','şato','yıldız','gölge','ışık','zafer','deniz'];
function roundMatch(over={}){
  const base={matchId:'m-1',sequence:5,status:'running',mode:'rounds',totalRounds:7,
    round:{index:2,total:7,suddenDeath:false,phase:'round',style:'timed',words:WORDS,startedAt:10_000,endsAt:40_000,settleUntil:null,nextRoundAt:null},
    roundHistory:[],
    players:[
      {playerId:'me',seat:1,name:'Ayşe',character:'fire',hp:1200,maxHp:2000,streak:4,roundWordIndex:6,roundCorrect:5,roundWrong:1,roundDamage:105,roundDone:false},
      {playerId:'op',seat:2,name:'Bot',character:'rune',hp:900,maxHp:2000,streak:2,roundWordIndex:7,roundCorrect:7,roundWrong:0,roundDamage:300,roundDone:false}
    ]};
  return {...base,...over,round:{...base.round,...(over.round||{})},players:over.players||base.players};
}
const roundEnd={round:2,winnerSeat:2,reason:'TIME',nextRoundAt:50_000,matchOver:false,
  scores:[{seat:1,correct:5,wrong:1,bestStreak:4,damageDealt:105,hpLeft:1200},{seat:2,correct:7,wrong:0,bestStreak:7,damageDealt:300,hpLeft:900}]};

// ---------- sahte DOM ----------
class FakeClassList{constructor(){this.set=new Set();}add(...c){c.forEach(x=>this.set.add(x));}remove(...c){c.forEach(x=>this.set.delete(x));}
  toggle(c,on){const want=on===undefined?!this.set.has(c):Boolean(on);want?this.set.add(c):this.set.delete(c);return want;}contains(c){return this.set.has(c);}}
class FakeEl{
  constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.attrs={};this.classList=new FakeClassList();this.style={setProperty:(k,v)=>{this.style[k]=v;}};this.dataset={};this._text='';this.hidden=false;this.parentNode=null;this.listeners={};}
  set className(v){this.classList=new FakeClassList();String(v).split(/\s+/).filter(Boolean).forEach(c=>this.classList.add(c));}
  get className(){return [...this.classList.set].join(' ');}
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
}
const fakeDoc={createElement:t=>new FakeEl(t),createElementNS:(ns,t)=>new FakeEl(t),hidden:false};
function fakeTimers(){
  const live=new Map();let id=0;
  const add=(fn,ms,repeat)=>{id++;live.set(id,{fn,ms,repeat});return id;};
  return {live,setTimeout:(fn,ms)=>add(fn,ms,false),clearTimeout:i=>live.delete(i),setInterval:(fn,ms)=>add(fn,ms,true),clearInterval:i=>live.delete(i),
    runOnce(){for(const [k,t] of [...live]){if(!t.repeat){live.delete(k);t.fn();}}}};
}
const all=node=>[node,...node.children.flatMap(all)];
const byRole=(el,name)=>all(el).filter(n=>n.dataset?.rui===name);
const byClass=(el,c)=>all(el).find(n=>n.classList.contains(c));

// ---------- saf model ----------
test('DEVIR-PVP 1: raund sonucu başlığı ve faz kuralı (saf)',()=>{
  assert.equal(roundResultTitle(1),'RAUND 1 SONUCU');
  assert.equal(roundResultTitle(8,true),'ANİ ÖLÜM SONUCU');
  assert.equal(isResultPhase('resolve'),true);assert.equal(isResultPhase('settling'),true);
  assert.equal(isResultPhase('intermission'),false,'tur arası paneli açıkken sonuç değil');
  assert.equal(isResultPhase('intermission',true),true,'vuruşlar bitmeyi beklerken hâlâ sonuç');
  assert.equal(isResultPhase('round',true),false);
});

test('DEVIR-PVP 1: çözümde başlık "RAUND N SONUCU" (ÇÖZÜLÜYOR değil), geri sayım ve yan saatler boş',()=>{
  for(const phase of ['resolve','settling']){
    const vm=roundsViewModel(roundMatch({round:{phase,resolveEndsAt:58_000,settleUntil:41_000}}),'me',40_500);
    assert.equal(vm.medalTitle,'RAUND 2 SONUCU',phase);
    assert.notEqual(vm.phaseLabel,'ÇÖZÜLÜYOR');
    assert.equal(vm.timer.text,'',`${phase}: geri sayım sayısı yok`);assert.equal(vm.timer.hidden,true);assert.equal(vm.timer.fraction,0);
    assert.equal(vm.unit,'');assert.equal(vm.result,true);
    assert.deepEqual(vm.sides.map(s=>s.clock),['',''],'yan saatler de saymaz');
  }
  // Kelime raundu (counted) da aynı akış.
  const c=roundsViewModel(roundMatch({round:{phase:'resolve',style:'counted',wordCount:7,resolveEndsAt:58_000}}),'me',40_500);
  assert.equal(c.medalTitle,'RAUND 2 SONUCU');assert.equal(c.timer.text,'');
  // Ani ölüm.
  const sd=roundsViewModel(roundMatch({round:{index:8,phase:'resolve',suddenDeath:true,resolveEndsAt:58_000}}),'me',40_500);
  assert.equal(sd.medalTitle,'ANİ ÖLÜM SONUCU');
});

test('DEVIR-PVP 1: tur arası — vuruşlar beklenirken sonuç başlığı, panel açılınca TUR ARASI + geri sayım',()=>{
  const m=roundMatch({round:{phase:'intermission',nextRoundAt:50_000}});
  const hold=roundsViewModel(m,'me',41_000,null,{resultHold:true});
  assert.equal(hold.medalTitle,'RAUND 2 SONUCU');assert.equal(hold.timer.text,'');
  const open=roundsViewModel(m,'me',41_000);
  assert.equal(open.medalTitle,'TUR ARASI');assert.equal(open.timer.text,'9');
  // Yazma raundunda resultHold etkisiz.
  assert.equal(roundsViewModel(roundMatch(),'me',31_000,null,{resultHold:true}).medalTitle,'RAUND 2 / 7');
});

// ---------- DOM: tur arası kapısı ----------
function mountHold(hold){
  const host=new FakeEl('div');const timers=fakeTimers();let t=41_000;const settled=[];
  let el=null;
  const ui=createRoundsUi(host,{now:()=>t,doc:fakeDoc,timers,holdTransition:()=>hold,
    settleVisuals:reason=>{
      // settle anında panel / "RAUND 3" bandı / özet henüz görünmemeli (önce vuruşlar biter, sonra panel).
      settled.push({reason,banner:byRole(el,'banner')[0].hidden,summary:byRole(el,'summary')[0].hidden,inter:byRole(el,'inter')[0].hidden});
    }});
  el=host.children[0];
  return {el,ui,timers,settled,setNow:v=>{t=v;}};
}
test('DEVIR-PVP 1: kuyruk bitmezse tavan anında kalan vuruşlar animasyonsuz uygulanır, panel ANCAK sonra açılır',()=>{
  const {el,ui,timers,settled,setNow}=mountHold(new Promise(()=>{})); // görsel kuyruk hiç boşalmıyor
  const m=roundMatch({round:{phase:'intermission',nextRoundAt:50_000}});
  ui.handle({type:'ROUND_END',payload:{...roundEnd,match:m}});ui.update(m,'me');ui.tick();
  const medal=byRole(el,'medal')[0],title=byRole(el,'title')[0],secs=byClass(el,'rui-secs');
  assert.equal(byRole(el,'banner')[0].hidden,true,'bekleme: RAUND 3 bandı yok');
  assert.equal(byRole(el,'summary')[0].hidden,true,'bekleme: tur arası paneli yok');
  assert.equal(byRole(el,'inter')[0].hidden,true);
  assert.equal(title.textContent,'RAUND 2 SONUCU');assert.equal(secs.textContent,'','bekleme: geri sayım yok');
  assert.ok(medal.classList.contains('is-result'));
  assert.equal(settled.length,0,'tavan dolmadan zorla bitirme yok (vuruşlar animasyonlu oynar)');
  setNow(41_000+ROUND_HOLD_MAX_MS);timers.runOnce();ui.tick();
  assert.equal(settled.length,1);
  assert.deepEqual(settled[0],{reason:'intermission',banner:true,summary:true,inter:true},'settle paneli açmadan ÖNCE');
  assert.equal(byRole(el,'summary')[0].hidden,false,'tavandan sonra panel açılır');
  assert.equal(title.textContent,'TUR ARASI');assert.ok(!medal.classList.contains('is-result'));
  ui.tick();ui.tick();assert.equal(settled.length,1,'tek sefer');
  ui.destroy();
});
test('DEVIR-PVP 1: kuyruk erken boşalırsa da settle çağrılır (son uçan sayı panelin üstünde kalmaz); ROUND_START da settle eder',async()=>{
  let release;const hold=new Promise(r=>{release=r;});
  const {el,ui,settled}=mountHold(hold);
  const m=roundMatch({round:{phase:'intermission',nextRoundAt:50_000}});
  ui.handle({type:'ROUND_END',payload:{...roundEnd,match:m}});ui.update(m,'me');ui.tick();
  assert.equal(settled.length,0);
  release(true);await hold;await Promise.resolve();
  assert.equal(settled.length,1);assert.equal(settled[0].banner,true,'"RAUND 3" bandı settle\'dan sonra');
  assert.equal(byRole(el,'banner')[0].hidden,false);
  const next=roundMatch({round:{index:3,phase:'round',startedAt:50_000,endsAt:80_000}});
  ui.handle({type:'ROUND_START',payload:{round:3,match:next}});
  assert.equal(settled.at(-1).reason,'round-start','yeni raund başında kalan vuruş temizlenir');
  ui.destroy();
});

// ---------- Görsel kuyruk: zorla boşaltma son durumu kaybetmeden anında uygular ----------
test('DEVIR-PVP 1: visual-timeline flush — oynayan ve bekleyen sahneler anında (forced) biter, kuyruk boşalır',()=>{
  const tl=createVisualTimeline({now:()=>0});
  const done=[];
  for(let i=0;i<3;i++)tl.enqueue({seat:i%2?2:1,estimateMs:4000,keep:true,start:()=>({contactMs:1500,durationMs:4000}),
    onContact:()=>done.push(`hit${i}`),complete:forced=>done.push(`forced${i}:${forced}`)});
  tl.tick(500);
  assert.equal(tl.isBusy(),true);
  let idle=false;tl.whenIdle(10_000).then(v=>{idle=v;});
  tl.drain(ROUND_HOLD_MAX_MS);tl.flush();
  assert.equal(tl.isBusy(),false);
  assert.deepEqual(done,['forced0:true','forced1:true','forced2:true'],'hiçbir sahne animasyonla oynamadı, hepsi zorla tamamlandı');
  return Promise.resolve().then(()=>assert.equal(idle,true,'bekleyen whenIdle çözülür'));
});

// ---------- Sinematik: SÜRE! bandının yeri ----------
function fakeEnv(){
  const listeners={};
  const mk=()=>{const cls=new Set();const kids=[];return {hidden:false,isConnected:true,className:'',style:{setProperty(){}},children:kids,
    classList:{add:c=>cls.add(c),remove:(...c)=>c.forEach(x=>cls.delete(x)),contains:c=>cls.has(c)},
    setAttribute(){},append(...k){kids.push(...k);},replaceChildren(...k){kids.length=0;kids.push(...k);},remove(){},textContent:''};};
  const rootCls=new Set();let shown=[];
  const doc={createElement:()=>{const n=mk();return n;},addEventListener(){},removeEventListener(){}};
  const root={classList:{add:c=>rootCls.add(c),remove:(...c)=>c.forEach(x=>rootCls.delete(x)),contains:c=>rootCls.has(c)},
    appendChild(n){this.layer=n;},querySelector:()=>null,
    addEventListener:(t,f)=>{listeners[t]=f;},removeEventListener:t=>{delete listeners[t];},emit:(t,detail)=>listeners[t]?.({detail})};
  const timers=new Map();let id=0;
  const scheduler={setTimeout:(f)=>{timers.set(++id,f);return id;},clearTimeout:k=>timers.delete(k),flush(){for(const [k,f] of [...timers]){timers.delete(k);f();}}};
  const sfx=[];
  return {root,doc,scheduler,rootCls,sfx,shown};
}
const bandTitle=layer=>{const band=layer?.children?.find(c=>String(c.className).includes('cin-band'));return band?.children?.find(c=>String(c.className).includes('cin-title'))?.textContent??null;};
// Sahte createElement textContent'i atanınca saklanır; el() textContent atar.
test('DEVIR-PVP 1: roundResolveText — zamana karşı SÜRE!, kelime raundu RAUND N BİTTİ',()=>{
  assert.deepEqual(roundResolveText({round:1,style:'timed',turns:5}),{title:'SÜRE!',sub:'Vuruşlar sırayla geliyor',tone:'time'});
  assert.equal(roundResolveText({round:1,style:'timed',turns:0}).sub,'Vuruş yok');
  assert.equal(roundResolveText({round:3,style:'counted',turns:2}).title,'RAUND 3 BİTTİ');
  assert.equal(roundResolveText({round:8,style:'counted',suddenDeath:true}).title,'ANİ ÖLÜM BİTTİ');
});
test('DEVIR-PVP 1: SÜRE! bandı yazma bitince (ROUND_RESOLVE) çıkar; vuruşlardan sonraki ROUND_END onu tekrar göstermez',()=>{
  const e=fakeEnv();let banners=0;
  attachCinematic({root:e.root,doc:e.doc,scheduler:e.scheduler,sfx:()=>{banners++;}});
  const match={matchId:'m-1',players:[],round:{index:1,style:'timed'}};
  e.root.emit('tuslab:pvp-round',{type:'ROUND_RESOLVE',payload:{round:1,turns:6,match}});
  assert.equal(bandTitle(e.root.layer),'SÜRE!');assert.equal(e.root.layer.hidden,false);
  assert.ok(e.rootCls.has('cin-round-end'),'yazma paneli aşağı iner (çözüm başı)');
  e.scheduler.flush();assert.equal(e.root.layer.hidden,true);
  const before=banners;
  e.root.emit('tuslab:pvp-round',{type:'ROUND_END',payload:{round:1,reason:'TIME',winnerSeat:2,match}});
  assert.equal(e.root.layer.hidden,true,'ROUND_END (vuruşlardan sonra) SÜRE! göstermez');
  assert.equal(banners,before,'ses de yok');
  assert.ok(!e.rootCls.has('cin-round-end'),'tur arası paneli gizlenmez');
  // K.O. raund sonunda yine gösterilir.
  e.root.emit('tuslab:pvp-round',{type:'ROUND_RESOLVE',payload:{round:2,turns:3,match:{...match,round:{index:2,style:'timed'}}}});
  e.scheduler.flush();
  e.root.emit('tuslab:pvp-round',{type:'ROUND_END',payload:{round:2,reason:'KO',winnerSeat:1,match}});
  assert.equal(bandTitle(e.root.layer),'K.O.!');
});
test('DEVIR-PVP 1: çevrimiçi akış (ROUND_RESOLVE yok) — ROUND_END eski bandı göstermeye devam eder',()=>{
  const e=fakeEnv();
  attachCinematic({root:e.root,doc:e.doc,scheduler:e.scheduler});
  e.root.emit('tuslab:pvp-round',{type:'ROUND_END',payload:{round:1,reason:'TIME',winnerSeat:2,match:{matchId:'r-1',players:[]}}});
  assert.equal(bandTitle(e.root.layer),'SÜRE!');assert.ok(e.rootCls.has('cin-round-end'));
});

// ---------- Arena modu: aynı ilke ----------
test('DEVIR-PVP 1: arena özeti açılırken settleVisuals çağrılır (özet eski vuruşla karışmaz)',async()=>{
  const PLAYERS=[{playerId:'me',seat:1,name:'Ayşe',character:'fire'},{playerId:'op',seat:2,name:'Bot',character:'rune'}];
  const T0=1_000_000;
  let m=createArenaMatch(PLAYERS,T0,'m-arena',{seed:12345});
  for(const playerId of ['me','op']){const r=submitArenaPick(m,{playerId},T0+100);assert.ok(r.match,r.error);m=r.match;}
  m=advanceArenaMatch(m,T0+200).match;
  m=advanceArenaMatch(m,T0+200+ARENA_ROUND_DURATION_MS+1).match;
  const pub=arenaPublicMatch(m,1);
  assert.equal(pub.round.phase,'summary');
  const hud=new FakeEl('div'),stage=new FakeEl('div'),overlay=new FakeEl('div'),timers=fakeTimers();
  let release;const hold=new Promise(r=>{release=r;});const settled=[];
  const ui=createArenaUi({hudHost:hud,stageHost:stage,overlayHost:overlay,now:()=>pub.round.summaryEndsAt-1000,doc:fakeDoc,timers,
    holdTransition:()=>hold,settleVisuals:reason=>settled.push({reason,summary:all(overlay).find(n=>n.dataset?.aui==='summary')?.hidden})});
  ui.update(pub,'me');ui.tick();
  assert.equal(settled.length,0);
  release(true);await hold;await Promise.resolve();
  assert.deepEqual(settled,[{reason:'summary',summary:true}],'settle özetten ÖNCE');
  assert.equal(all(overlay).find(n=>n.dataset?.aui==='summary').hidden,false);
  ui.destroy();
});

// ---------- Bağlantı (index.js) ----------
test('DEVIR-PVP 1: index.js — kart arkasında 12 sn boşaltma yok; settleVisuals bağlı; ROUND_START sahneyi sıfırlar',()=>{
  const idx=read('pvp/index.js');
  assert.doesNotMatch(idx,/drain\(12000\)/,'raund arası kartının arkasında vuruş oynatan 12 sn boşaltma kalktı');
  assert.match(idx,/detail\.type==='ROUND_END'\)arena3d\.instance\?\.visualQueue\?\.drain\(ROUND_HOLD_MAX_MS\)/);
  assert.equal((idx.match(/settleVisuals:settleRoundVisuals/g)||[]).length,2,'rounds-ui ve arena-ui');
  assert.match(idx,/function settleRoundVisuals\(\)\{[\s\S]*?a\.settle\|\|a\.clear[\s\S]*?impactGate\.close\(\)[\s\S]*?fx24\.damage\?\.clear\(\)[\s\S]*?release/);
  assert.match(idx,/function playImpactFeedback\([^)]*\)\{\s*if\(!impactGate\.allows\(network\.match\)\)return;/,'kapı kapalıyken sayı/ses/tepki yok');
  assert.match(idx,/whenIdle\(ROUND_HOLD_MAX_MS\)/);
  const css=read('pvp/rounds-ui.css');
  assert.match(css,/\.rui-medal\.is-result \.rui-clock\{visibility:hidden\}/);
});

// ---------- 2. tur (koordinatör bulgusu): kuyruk boşken ~1,4 sn sonra doğan eski sayı ----------
test('DEVIR-PVP 1: impactFeel.flush(true) — temas bekleyen hasar anında sahnesiz teslim edilir, sonradan hiçbir şey doğmaz',()=>{
  let t=0;const delivered=[];
  const fx=createImpactDirector({now:()=>t,isReduced:()=>false,contact(){},deliver:(ev,scene)=>delivered.push({id:ev.id,scene})});
  let contactReached=false;
  fx.queue({id:'a',amount:200},()=>contactReached,9000);
  fx.queue({id:'u',amount:120,skill:'r',phase:3},()=>contactReached);
  fx.flush();assert.equal(delivered.length,0,'temas yok: beklemede');
  fx.flush(true);
  assert.deepEqual(delivered,[{id:'a',scene:false},{id:'u',scene:false}],'raund geçişi: hepsi sahnesiz, bir kez');
  assert.equal(fx.pending,0);
  contactReached=true;t=60_000;fx.flush();fx.flush(true);
  assert.equal(delivered.length,2,'tavan/temas sonradan ikinci sayı doğurmaz');
});
test('DEVIR-PVP 1: settle kapısı — tur arası / özet / hazırlıkta eski hasar gösterimi atlanır, yeni raundda açılır',()=>{
  assert.deepEqual([...SETTLED_IDLE_PHASES],['intermission','summary','prep']);
  const g=createSettleGate();
  const m=phase=>({status:'running',round:{phase}});
  assert.equal(g.allows(m('intermission')),true,'kapanmadan önce (vuruşlar yetişirken) gösterilir');
  g.close();
  assert.equal(g.allows(m('intermission')),false,'settle sonrası tur arasında: eski sayı yok');
  assert.equal(g.allows(m('summary')),false);assert.equal(g.allows(m('prep')),false);
  assert.equal(g.allows(m('round')),true,'yeni raund: açılır');
  assert.equal(g.closed,false);
  assert.equal(g.allows(m('intermission')),true,'açıldıktan sonra yeniden kapanana dek serbest');
  g.close();assert.equal(g.allows({status:'ended',round:{phase:'intermission'}}),true,'maç bitti: kapı takılı kalmaz');
});
test('DEVIR-PVP 1: arena3d.settle — kuyruk boş olsa da ulti zinciri/bekleyen hasar temizlenir; eski sahne tamponu nesil kimliğiyle düşer',()=>{
  const src=read('pvp/arena3d.js');
  assert.match(src,/function settle\(\) \{[\s\S]*?timeline\.flush\(\);[\s\S]*?pendingUltEvents[\s\S]*?impactFeel\.flush\(true\);\s*clear\(\);/);
  assert.match(src,/function clear\(notifyPlugins = true\) \{\s*if \(destroyed\) return;\s*visualGen\+\+;\s*sceneHold\.clear\(\);/);
  assert.match(src,/const gen = visualGen;\s*env\?\.setTimeout\?\.\(\(\) => \{\s*if \(gen !== visualGen\) return;/);
  assert.match(src,/\n    clear,\n    settle,/);
  // Tanım sırası: sceneHold/visualGen clear()'dan önce (TDZ yok).
  assert.ok(src.indexOf('let visualGen = 0;')<src.indexOf('function clear(notifyPlugins'));
});
