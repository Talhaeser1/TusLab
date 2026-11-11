import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('desktop typing focus waits for visible unlocked input and respects coarse pointer and active controls',()=>{
  const js=read('pvp/index.js');
  assert.match(js,/function focusTypingWhenReady\(/);
  assert.match(js,/matchMedia\?\.\('\(pointer: coarse\)'\)/);
  assert.match(js,/getClientRects\(\)\.length/);
  assert.match(js,/activeElement/);
  assert.match(js,/focus\(\{preventScroll:true\}\)/);
  assert.match(js,/focusTypingWhenReady\(\)/);
});

test('typing focus calls focus only for an unobstructed desktop input',()=>{
  const js=read('pvp/index.js');
  const body=js.slice(js.indexOf('function focusTypingWhenReady('),js.indexOf("root?.addEventListener('tuslab:pvp-recovered'",js.indexOf('function focusTypingWhenReady(')));
  const run=({coarse=false,active='body',visible=true,modal=false}={})=>{
    let focused=0;
    const input={disabled:false,getClientRects:()=>visible?[{}]:[],focus:()=>focused++};
    const doc={body:{},activeElement:null};
    doc.activeElement=active==='body'?doc.body:active==='input'?input:{};
    const root={hidden:false,querySelector:sel=>sel==='#tt-input'?input:modal?{}:null};
    const fn=new Function('window','root','document','requestAnimationFrame','getComputedStyle','setTimeout',`${body};return focusTypingWhenReady`)(
      {matchMedia:()=>({matches:coarse})},root,doc,cb=>cb(),()=>({visibility:'visible'}),()=>{});
    fn();return focused;
  };
  assert.equal(run(),1);
  assert.equal(run({coarse:true}),0);
  assert.equal(run({active:'other'}),0);
  assert.equal(run({modal:true}),0);
  assert.equal(run({visible:false}),0);
});

test('summary open state hides lower round HUD and word strips',()=>{
  const rounds=read('pvp/rounds-ui.css');
  const arena=read('pvp/arena-ui.css');
  assert.match(rounds,/#pvp-root\.rui-inter-open \.rui-bar/);
  assert.match(rounds,/#pvp-root\.rui-inter-open \.rui-words/);
  assert.match(arena,/#pvp-root\.aui-summary-open \.aui-hud/);
  assert.match(arena,/#pvp-root\.aui-summary-open \.aui-words/);
});

test('result scenes use published imagery, entrance motion, and reduced-motion override',()=>{
  const css=[read('pvp/rounds-ui.css'),read('pvp/arena-ui.css'),read('pvp/phase15-results.css')].join('\n');
  for(const file of ['ekran-raund-banner.webp','ekran-zafer.webp','ekran-yenilgi.webp'])
    assert.match(css,new RegExp(`assets/higgsfield/final/${file}`));
  assert.match(css,/scale\(\.9[0-9]*\)/);
  assert.match(css,/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css,/\.pvp15-backdrop:not\(\[hidden\]\)/);
});
