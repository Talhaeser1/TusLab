import test from 'node:test';
import assert from 'node:assert/strict';
import {setTextIfChanged,setWidthIfChanged,setAttributeIfChanged,setClassIfChanged,shouldPaint} from '../pvp/performance.js';
import {createProjectileDirector,MAX_PROJECTILES,MAX_IMPACTS} from '../pvp/projectiles.js';
import {createCombatFxDirector,MAX_PARTICLES,MAX_EFFECTS} from '../pvp/combat-fx.js';
import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
function fixture(){
 let counter=0;const timers=new Map();
 const doc={createElement:()=>({className:'',dataset:{},style:{setProperty(){}},setAttribute(){},remove(){this.removed=true;}})};
 const elements=[];
 const layer={ownerDocument:doc,appendChild(el){elements.push(el)}};
 const label={textContent:''};
 const classes=new Set();
 const node={classList:{add:(...a)=>a.forEach(x=>classes.add(x)),remove:(...a)=>a.forEach(x=>classes.delete(x))},querySelector(sel){return sel==='.pvp4-effects'?layer:sel==='[data-fx-label]'?label:null}};
 const arena={querySelector(sel){return sel==='.pvp2-duel'?layer:null}};
 const scheduler={setTimeout(fn,ms){const id=++counter;timers.set(id,fn);return id},clearTimeout(id){timers.delete(id)}};
 return {node,arena,elements,timers,scheduler,classes,label};
}
test('phase 19 DOM setters perform no writes on identical values',()=>{
 let textWrites=0,attrWrites=0,widthWrites=0,classWrites=0;
 const node={
  _textContent:'',get textContent(){return this._textContent},set textContent(v){this._textContent=v;textWrites++},
  attrs:new Map(),getAttribute(k){return this.attrs.get(k)??null},setAttribute(k,v){attrWrites++;this.attrs.set(k,v)},
  style:{_width:'',get width(){return this._width},set width(v){widthWrites++;this._width=v}},
  classes:new Set(),classList:{contains(k){return node.classes.has(k)},toggle(k,on){classWrites++;if(on)node.classes.add(k);else node.classes.delete(k)}}
 };
 for(let i=0;i<1000;i++){
   setTextIfChanged(node,'2.000 / 2.000 HP');setWidthIfChanged(node,'100%');
   setAttributeIfChanged(node,'aria-valuenow',2000);setClassIfChanged(node,'ready',true);
 }
 assert.deepEqual([textWrites,widthWrites,attrWrites,classWrites],[1,1,1,1]);
 assert.equal(shouldPaint(true),false);assert.equal(shouldPaint(false),true);assert.equal(shouldPaint(true,true),true);
});
test('phase 19 projectile spam caps combined transients and clears timers',()=>{
 const f=fixture(),vfx=createProjectileDirector({root:f.arena,scheduler:f.scheduler});
 for(let i=0;i<500;i++){vfx.launch({fromSeat:1,skill:i%5===0?'r':'q'});vfx.impact({toSeat:2,blocked:i%2===0});}
 assert.ok(vfx.stats().active<=MAX_PROJECTILES+MAX_IMPACTS);
 assert.ok(f.timers.size<=MAX_PROJECTILES+MAX_IMPACTS);
 vfx.dispose();assert.equal(f.timers.size,0);assert.equal(vfx.stats().active,0);
 assert.equal(vfx.launch(),false);
});
test('phase 19 VFX burst cap on both particles and transient effects',()=>{
 const f=fixture(),fx=createCombatFxDirector({root:f.node,scheduler:f.scheduler});
 for(let i=0;i<150;i++)fx.play({cue:['ultimate-hit','strike','ground-smash','final-blast'][i%4],action:'q'});
 const stats=fx.stats();assert.ok(stats.particles<=MAX_PARTICLES);assert.ok(stats.effects<=MAX_EFFECTS);
 assert.ok(stats.dropped>=100,'cosmetic flood must be rate-limited');
 fx.stop();assert.equal(fx.stats().particles,0);assert.equal(fx.stats().effects,0);assert.equal(fx.stats().timers,0);
 assert.ok(f.elements.every(x=>x.removed));fx.dispose();assert.equal(fx.play({cue:'strike'}),false);
});
test('phase 19 reduced motion removes active effects and allocates only compact flashes',()=>{
 const f=fixture(),fx=createCombatFxDirector({root:f.node,scheduler:f.scheduler});
 fx.play({cue:'final-blast'});assert.ok(fx.stats().particles>0);
 fx.setReduced(true);assert.equal(fx.stats().particles,0);assert.equal(fx.stats().effects,0);
 fx.play({cue:'strike'});assert.equal(fx.stats().particles,0);assert.equal(fx.stats().effects,1);
 fx.dispose();assert.equal(fx.stats().timers,0);
});
test('phase 19 scope: no combat values edited, static publication references performance files',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const net=readFileSync(new URL('../pvp/network.js',import.meta.url),'utf8');
 const fx=readFileSync(new URL('../pvp/combat-fx.js',import.meta.url),'utf8');
 assert.match(html,/pvp\/phase19-performance\.css/);
 assert.match(net,/performance\.js/);assert.match(net,/shouldPaint\(document.hidden\)/);
 assert.doesNotMatch(fx,/offsetWidth/);
 assert.ok(!net.includes('setInterval(()=>{this.updateArena();this.renderConnection();},250)'));
 for(const file of ['cloudflare/src/match.js','cloudflare/src/room.js','cloudflare/src/profiles.js','app.js'])
   assert.ok(readFileSync(new URL('../'+file,import.meta.url)).length>1000);
});

test('phase 19 PvP entry initializes phase-15 timers before first show',()=>{
  const script=readFileSync(new URL('../pvp/pvp-main.js',import.meta.url),'utf8');
  assert.ok(script.indexOf('let phase15StartedId=') < script.indexOf('show(false);'));
});
