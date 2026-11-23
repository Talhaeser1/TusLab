import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createChoreographyDirector, CHOREO_LIMITS, CHOREO_PROFILES} from '../pvp/choreography21.js';

class FakeClassList{
  value=new Set(); add(...x){x.forEach(v=>this.value.add(v));}
  remove(...x){x.forEach(v=>this.value.delete(v));}
  contains(x){return this.value.has(x);}
}
function harness(id='fire'){
 let time=0,next=1;const pending=new Map(),children=[];
 const scheduler={setTimeout(fn,ms){const key=next++;pending.set(key,{fn,at:time+ms});return key;},clearTimeout(key){pending.delete(key);}};
 const layer={ownerDocument:{createElement:()=>({className:'',style:{},setAttribute(){},remove(){this.removed=true;const idx=children.indexOf(this);if(idx>=0)children.splice(idx,1);}})},appendChild(x){children.push(x);}};
 const stage={dataset:{},classList:new FakeClassList(),removeAttribute(name){if(name.startsWith('data-'))delete this.dataset[name.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())];},querySelector(q){return q==='.pvp21-layer'?layer:null;}};
 const fastForward=(to)=>{while(true){const nextEvent=[...pending].sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];if(!nextEvent||nextEvent[1].at>to)break;pending.delete(nextEvent[0]);time=nextEvent[1].at;nextEvent[1].fn();}time=to;};
 let reduced=false;
 const director=createChoreographyDirector({stage,id,scheduler,now:()=>time,reduced:()=>reduced});
 return {director,stage,children,pending,fastForward,setReduced:v=>{reduced=v;director.setReduced();}};
}
test('phase21: independent choreography profiles and strict argument validation',()=>{
 assert.notEqual(CHOREO_PROFILES.fire.style,CHOREO_PROFILES.rune.style);
 assert.notEqual(CHOREO_PROFILES.fire.r,CHOREO_PROFILES.rune.r);
 assert.throws(()=>createChoreographyDirector({id:'fake',stage:{querySelector(){}}}),TypeError);
 assert.throws(()=>createChoreographyDirector({id:'fire'}),TypeError);
});
test('phase21: Q choreography sets motion and self-cleans effects',()=>{
 const h=harness();assert.equal(h.director.onMotion({state:'attack',action:'q'}),true);
 assert.equal(h.stage.dataset.choreoAction,'q');
 assert.equal(h.director.onCue({cue:'blade-trail',action:'q'}),true);
 assert.equal(h.children.length,1);
 h.fastForward(750);assert.equal(h.children.length,0);assert.equal(h.director.stats().timers,0);
});
test('phase21: 52ms hit stop never freezes typing UI or lingers',()=>{
 const h=harness();h.director.onCue({cue:'ground-smash',action:'e'});
 assert.equal(h.stage.classList.contains('pvp21-hitstop'),true);
 h.fastForward(52);assert.equal(h.stage.classList.contains('pvp21-hitstop'),false);
 assert.equal(h.stage.classList.contains('pvp21-bump'),true);
 h.fastForward(250);assert.equal(h.stage.classList.contains('pvp21-bump'),false);
});
test('phase21: 3 distinct server ult phases have effects and cleanup',()=>{
 const h=harness('rune');for(let phase=1;phase<=3;phase++)assert.equal(h.director.onUltimateBeat(phase),true);
 assert.equal(h.stage.dataset.choreoBeat,'3');
 assert.equal(h.children.length,3);
 h.fastForward(1100);assert.equal(h.children.length,0);assert.equal(h.stage.dataset.choreoBeat,undefined);
});
test('phase21: parry, shield break and perfect block triggers are cosmetic only',()=>{
 const h=harness('fire');for(const name of ['BLOCK','PERFECT_BLOCK','PARRY','SHIELD_BROKEN','COUNTERATTACK'])assert.equal(h.director.onDefense(name),true);
 assert.ok(h.children.length<=CHOREO_LIMITS.bursts);
 assert.equal(h.director.onDefense('INVALID'),false);
 h.director.dispose();assert.equal(h.children.length,0);assert.equal(h.pending.size,0);
 assert.equal(h.director.onCue({cue:'blade-trail'}),false);
});
test('phase21: overload bounded and no delayed animations after dispose/reduced',()=>{
 const h=harness();for(let i=0;i<60;i++)h.director.onCue({cue:'blade-trail'});
 assert.ok(h.children.length<=CHOREO_LIMITS.bursts);
 assert.ok(h.director.stats().dropped>0);
 h.setReduced(true);assert.equal(h.children.length,0);assert.equal(h.pending.size,0);
 h.director.onCue({cue:'blade-trail'});assert.equal(h.children.length,0);
 h.director.dispose();h.fastForward(5000);assert.equal(h.pending.size,0);
});
test('phase21: integration keeps keyboard and server-owned damage separate',()=>{
 const entry=readFileSync(new URL('../pvp/pvp-main.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../pvp/choreography21.css',import.meta.url),'utf8');
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(entry,/choreographers\[kind\]\?\.onUltimateBeat\(action\.phase\)/);
 assert.match(entry,/choreographers\[kind\]\?\.onDefense/);
 assert.match(entry,/choreographers\[id\]\?\.onCue/);
 assert.match(entry,/class="pvp21-layer"/);
 assert.match(html,/choreography21.css/);
 assert.match(css,/pvp21-fire-q/);
 assert.match(css,/pvp21-rune-q/);
 assert.match(css,/prefers-reduced-motion/);
 assert.doesNotMatch(css,/\.pvp2-input\s*\{/);
});
