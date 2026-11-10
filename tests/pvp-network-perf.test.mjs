/**
 * U2 — pvp/network.js performans testleri.
 * 1) Ağ paketleri tam render() yerine kare başına birleşik çizim ister (requestAnimationFrame).
 * 2) Bir maç paketi arenayı bir kez çizer (applyMatch); kare sonundaki ortak render tekrar çizmez.
 * 3) Eski 500 ms yetenek döngüsü (ilk <small>'a "3/5 · OTOMATİK", pvp2-skill-ready sınıfı, title)
 *    kalktı: kartların durumu pvp/skillbar.js sahipliğinde; maç kilidi ve gerçek demo düğmelerinin
 *    başlığı korunur. Node'da DOM yoktur: elle yapılmış sahte düğümler + kuyruklanabilir sahte rAF.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PvPNetworkConsole} from '../pvp/network.js';

const netSource=readFileSync(new URL('../pvp/network.js',import.meta.url),'utf8');
const G=globalThis;
const GLOBAL_KEYS=['document','location','localStorage','requestAnimationFrame'];

function makeNode(){
  const attrs=new Map();
  return {
    hidden:false,disabled:false,title:'',dataset:{},style:{},textContent:'',
    getAttribute:n=>attrs.has(n)?attrs.get(n):null,
    setAttribute(n,v){attrs.set(n,String(v));},
    removeAttribute(n){attrs.delete(n);},
    hasAttribute(n){return attrs.has(n);},
    classList:{set:new Set(),contains(c){return this.set.has(c);},toggle(c,on){on?this.set.add(c):this.set.delete(c);}},
    addEventListener(){},removeEventListener(){},dispatchEvent(){return true;},
    querySelector(){return null;},querySelectorAll(){return [];},
    appendChild(c){return c;},replaceChildren(){},animate(){},focus(){},
  };
}
function makeSide(){
  const side=makeNode();
  const span=makeNode();
  const connection=makeNode();connection.querySelector=()=>span;
  const skills={};
  for(const key of ['Q','E','S','R']){
    const btn=makeNode();
    btn.dataset.skill=key;btn.setAttribute('data-skill',key);btn.setAttribute('data-demo-action',key.toLowerCase());
    const small=makeNode();btn.querySelector=sel=>sel==='small'?small:null;
    skills[key]={btn,small};
  }
  const demo=makeNode();demo.setAttribute('data-demo-action','hit');   // .pvp3-mini gibi gerçek demo düğmesi
  const pool={
    '[data-server-player-name]':makeNode(),'[data-player-connection]':connection,
    '[data-server-hp]':makeNode(),'[data-server-hp-track]':makeNode(),
    '[data-server-hp-fill]':makeNode(),'[data-server-hp-trail]':makeNode(),
    '.pvp2-health':makeNode(),'[data-server-shield]':makeNode(),'[data-server-shield-layer]':makeNode(),
    '[data-server-combo]':makeNode(),'[data-pvp22-passive]':makeNode(),
    '[data-server-defense]':makeNode(),'[data-server-score]':makeNode(),
  };
  side.querySelector=sel=>{
    const m=/^\[data-skill="([QESR])"\]$/.exec(sel);
    if(m)return skills[m[1]].btn;
    return pool[sel]??null;
  };
  side.querySelectorAll=sel=>sel.includes('data-demo-action')?[skills.Q.btn,skills.E.btn,skills.S.btn,skills.R.btn,demo]:[];
  return {side,skills,demo};
}
function makeRoot(){
  const panel=makeNode();
  const side1=makeSide(),side2=makeSide();
  const events=[];
  const root=makeNode();
  root.querySelector=sel=>{
    if(sel==='[data-lobby-panel]')return panel;
    if(sel==='[data-seat="1"]')return side1.side;
    if(sel==='[data-seat="2"]')return side2.side;
    return null;
  };
  root.querySelectorAll=()=>[];
  root.dispatchEvent=e=>{events.push(e);return true;};
  return {root,panel,side1,side2,events};
}
function player(seat,extra={}){
  return {seat,playerId:'p'+seat,name:'Oyuncu '+seat,character:seat===1?'fire':'rune',rune:'none',online:true,ready:true,
    hp:2400,maxHp:3000,combo:3,streak:3,roundCorrect:2,roundWrong:0,correctWords:5,wrongWords:1,wpm:41,accuracy:96,
    skillCharge:{q:2,e:3,r:1},cooldownUntil:{q:0,e:0,s:0,r:0},shieldUntil:null,runeEnergy:2,activeBonuses:[],
    defenseStats:{normalBlocks:1,perfectBlocks:0,parries:0,counters:0,shieldBreaks:0},...extra};
}
function statePacket(seq,{status='running',endsAt=Date.now()+120000}={}){
  return {version:1,type:'STATE_UPDATE',payload:{match:{matchId:'m1',sequence:seq,status,endsAt,pausedAt:null,
    players:[player(1),player(2)],combatEvents:[]}},serverTime:Date.now()};
}
/** Sahte tarayıcı ortamı + konsol + render/updateArena sayaçları. cleanup() mutlaka çağrılmalı. */
function setup({raf=true}={}){
  const saved={};
  for(const k of GLOBAL_KEYS)saved[k]=G[k];
  G.document={addEventListener(){},hidden:false};
  G.location={href:'https://oyun.local/'};
  G.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
  const rafState={frames:[]};
  if(raf)G.requestAnimationFrame=cb=>{rafState.frames.push(cb);return rafState.frames.length;};
  const dom=makeRoot();
  const nc=new PvPNetworkConsole(dom.root);
  let renders=0,arenas=0;
  const render=nc.render.bind(nc),arena=nc.updateArena.bind(nc);
  nc.render=function(){renders++;return render();};
  nc.updateArena=function(){arenas++;return arena();};
  const cleanup=()=>{
    try{nc.disconnect(false);}catch{}
    for(const k of GLOBAL_KEYS){if(saved[k]===undefined)delete G[k];else G[k]=saved[k];}
  };
  return {...dom,nc,rafState,renders:()=>renders,arenas:()=>arenas,cleanup,
    flushFrame(){for(const cb of rafState.frames.splice(0))cb();}};
}

test('U2: aynı karede gelen paketler tek render() ile birleşir',()=>{
  const s=setup();
  try{
    for(const seq of [1,2,3])s.nc.receive(statePacket(seq));
    assert.equal(s.renders(),0,'paketler senkron render çağırmamalı');
    assert.equal(s.rafState.frames.length,1,'tüm paketler tek kare işine birleşmeli');
    s.flushFrame();
    assert.equal(s.renders(),1,'kare sonunda tek render');
    assert.ok(s.events.some(e=>e.type==='tuslab:pvp-match'),'skillbar veri kaynağı (tuslab:pvp-match) kesilmedi');
  }finally{s.cleanup();}
});

test('U2: log() da kare başına birleşir (paket içi loglar çift çizmez)',()=>{
  const s=setup();
  try{
    s.nc.log('a');s.nc.log('b');s.nc.log('c');
    assert.equal(s.renders(),0,'log senkron render çağırmamalı');
    s.flushFrame();
    assert.equal(s.renders(),1,'üç log tek render');
  }finally{s.cleanup();}
});

test('U2: her maç paketi arenayı bir kez çizer; kare sonundaki render tekrar çizmez',()=>{
  const s=setup();
  try{
    s.nc.receive(statePacket(1));
    s.flushFrame();
    assert.equal(s.arenas(),1,'applyMatch bir kez, render sıfır ek');
    s.nc.receive(statePacket(2));
    s.flushFrame();
    assert.equal(s.arenas(),2);
  }finally{s.cleanup();}
});

test('U2: eski yetenek döngüsü kartlara yazmıyor; maç kilidi ve gerçek demo başlığı kalıyor',()=>{
  const s=setup();
  try{
    s.nc.receive(statePacket(1));   // running · skillCharge dolu (eski kod "2/2 · OTOMATİK" yazardı)
    s.flushFrame();
    for(const key of ['Q','E','S','R']){
      const {btn,small}=s.side1.skills[key];
      assert.equal(small.textContent,'',`${key}: eski durum metni yazılmamalı`);
      assert.equal(btn.classList.contains('pvp2-skill-ready'),false,`${key}: eski hazır sınıfı atanmamalı`);
      assert.equal(btn.title,'',`${key}: karta title atanmamalı (skillbar.js kuralı)`);
      assert.equal(btn.disabled,true,`${key}: maçta kilitli kalmalı`);
    }
    assert.equal(s.side1.demo.title,'Aktif veya duraklatılmış maçta yalnız sunucu saldırı başlatabilir','gerçek demo düğmesi başlığı korunur');
    s.nc.receive(statePacket(2,{status:'ended',endsAt:Date.now()}));
    s.flushFrame();
    assert.equal(s.side1.skills.Q.btn.disabled,false,'maç bitince kilit açılır');
    assert.equal(s.side1.demo.title,'Animasyon önizlemesi','maç dışı demo başlığı döner');
  }finally{s.cleanup();}
});

test('U2: requestAnimationFrame yoksa (Node) çizim anında yapılır — güvenli geri dönüş',()=>{
  const s=setup({raf:false});
  try{
    assert.equal(typeof G.requestAnimationFrame,'undefined');
    s.nc.receive(statePacket(1));
    assert.equal(s.renders(),1,'rAF yoksa paket senkron çizilir, render kaybolmaz');
  }finally{s.cleanup();}
});

test('U2 kaynak: receive/log kare başına çizim ister; eski döngü kalıntıları yok',()=>{
  assert.match(netSource,/scheduleRender\(\)\{/);
  assert.match(netSource,/requestAnimationFrame/);
  const receiveBlock=netSource.slice(netSource.indexOf('  receive(packet){'),netSource.indexOf('  applyMatch(payload,serverTime){'));
  assert.ok(receiveBlock.includes('this.scheduleRender();'),'receive kare başına çizim istemeli');
  assert.doesNotMatch(receiveBlock,/this\.render\(\);\s*\}/,'receive doğrudan render ile bitmemeli');
  const logLine=netSource.match(/^  log\(message\)\{.*$/m)?.[0]??'';
  assert.match(logLine,/scheduleRender/,'log kare başına çizim istemeli');
  for(const gone of ['pvp2-skill-ready','OTOMATİK',"querySelector('small')",'%30 BLOK','KALKAN AKTİF','SAVUNMA ','BEKLE ','writeClass'])
    assert.ok(!netSource.includes(gone),`eski kalıntı kaldırılmalı: ${gone}`);
  assert.ok(!netSource.includes('[data-skill="'),'updateArena artık yetenek kartlarını sorgulamamalı');
  assert.match(netSource,/shouldPaint\(document.hidden\)/,'ticker kuralı korunmalı (perf19)');
  assert.match(netSource,/this\.arenaFresh=false;else this\.updateArena\(\);/,'paket başına tek arena çizimi korunmalı');
  assert.match(netSource,/tuslab:pvp-match/,'skillbar veri kaynağı korunmalı');
});
