// Siyah ekran regresyonu: arenayı (z-index 7) kaplayan 2B parçacık canvas'ı
// `desynchronized: true` ile açıldığında bazı Windows GPU + Chromium (Brave)
// kombinasyonlarında saydamlığını kaybedip tüm arenayı siyaha boyuyordu.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createParticleLayer} from '../pvp/fx-particles.js';

const root=resolve(import.meta.dirname,'..');

function captureContextOptions(){
  const calls=[];
  const ctx=new Proxy({},{get:(t,k)=>k in t?t[k]:(k==='createRadialGradient'?()=>({addColorStop(){}}):()=>undefined),set:(t,k,v)=>{t[k]=v;return true;}});
  const rect=(left,top,width,height)=>({left,top,width,height});
  const duel={children:[],appendChild(n){this.children.push(n);},getBoundingClientRect:()=>rect(0,0,900,600)};
  const doc={
    hidden:false,
    createElement:()=>({width:0,height:0,style:{},setAttribute(){},remove(){},getContext:(type,options)=>{calls.push({type,options});return ctx;}}),
    addEventListener(){},removeEventListener(){}
  };
  duel.ownerDocument=doc;
  const stage={getBoundingClientRect:()=>rect(20,60,400,500)};
  const fakeRoot={ownerDocument:doc,querySelector:sel=>sel==='.pvp2-duel'?duel:(sel.includes('.pvp2-stage')?stage:null),querySelectorAll:()=>[]};
  const env={document:doc,devicePixelRatio:1,random:Math.random,requestAnimationFrame:()=>1,cancelAnimationFrame(){}};
  const layer=createParticleLayer({root:fakeRoot,env});
  return {calls,layer};
}

test('blackscreen: the full-arena particle canvas never asks for a desynchronized context',()=>{
  const {calls,layer}=captureContextOptions();
  const main=calls.find(c=>c.type==='2d');
  assert.ok(main,'2D bağlam istenmeli');
  assert.notEqual(main.options?.desynchronized,true,'desynchronized canvas bazı GPU\'larda siyah görünür');
  assert.notEqual(main.options?.alpha,false,'katman saydam kalmalı');
  layer.destroy();
});

test('blackscreen: losing the WebGL context drops back to the visible 2D arena',async()=>{
  const js=await readFile(join(root,'pvp','arena3d.js'),'utf8');
  const lost=js.slice(js.indexOf('const onContextLost'),js.indexOf('const onContextRestored'));
  const restored=js.slice(js.indexOf('const onContextRestored'),js.indexOf('const onContextRestored')+400);
  assert.match(lost,/classList[^;]*remove(?:\?\.)?\([^)]*pvp26-3d/,'bağlam kaybında 3B sınıfı kaldırılmalı (siyah canvas yerine DOM arena)');
  assert.match(restored,/classList[^;]*add(?:\?\.)?\([^)]*pvp26-3d/,'bağlam geri gelince 3B sınıfı geri eklenmeli');
});

test('layout: the PvP shell column is locked to the viewport and the toolbar wraps',async()=>{
  const css=await readFile(join(root,'pvp','pvp.css'),'utf8');
  assert.match(css,/\.pvp2-shell\{grid-template-columns:minmax\(0,1fr\)\}/);
  assert.match(css,/\.pvp2-actions\{flex-wrap:wrap/);
});

test('build: every stylesheet and script linked from index.html is copied by build-assets', async () => {
  const html = await readFile(join(root, 'index.html'), 'utf8');
  const build = await readFile(join(root, 'cloudflare', 'build-assets.mjs'), 'utf8');
  const links = [...html.matchAll(/(?:href|src)="\.?\/?([^"]+\.(?:css|js))"/g)].map(m => m[1]);
  for (const link of links) {
    const top = link.split('/')[0];
    assert.ok(build.includes(`'${top}'`), `build-assets.mjs kopyalamıyor: ${link}`);
  }
});
