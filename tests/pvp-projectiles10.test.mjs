import test from 'node:test';
import assert from 'node:assert/strict';
import {createProjectileDirector,MAX_PROJECTILES} from '../pvp/projectiles.js';
function fixture(){
 const timers=new Map();let next=0;
 const doc={createElement:()=>({className:'',dataset:{},setAttribute(){},remove(){this.removed=true}})};
 const board={ownerDocument:doc,children:[],appendChild(n){this.children.push(n)}};
 const root={querySelector(sel){return sel==='.pvp2-duel'?board:null}};
 const scheduler={setTimeout(fn){const id=++next;timers.set(id,fn);return id},clearTimeout(id){timers.delete(id)}};
 return {root,board,scheduler,timers};
}
test('server projectiles stay cosmetic, have bounded active count and remove stale elements',()=>{
 const f=fixture();const p=createProjectileDirector({root:f.root,scheduler:f.scheduler});
 for(let i=0;i<10;i++)assert.equal(p.launch({fromSeat:1,skill:'q',character:'fire'}),true);
 assert.equal(p.stats().active,MAX_PROJECTILES);
 assert.equal(f.timers.size,MAX_PROJECTILES);
 assert.equal(p.impact({toSeat:2,blocked:true}),true);
 assert.equal(p.stats().active,MAX_PROJECTILES+1);
 p.stop();assert.equal(p.stats().active,0);
 assert.equal(f.timers.size,0);assert.equal(p.stats().disposed,false);
 p.dispose();assert.equal(p.launch(),false);
});
test('reduced-motion honors user setting and does not allocate projectile DOM',()=>{
 const f=fixture();const p=createProjectileDirector({root:f.root,scheduler:f.scheduler,motionReduced:()=>true});
 assert.equal(p.launch(),true);assert.equal(p.impact(),true);
 assert.equal(f.board.children.length,0);assert.equal(p.stats().active,0);
 p.dispose();
});
