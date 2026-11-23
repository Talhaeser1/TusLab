// Yazma ekranı 2. dalga (Ajan F): mod/faz etiketi, sıradaki kelimeler, değiş tokuş geri sayımı, net kilit/Harf Kaosu mesajları.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ttModeLabel,ttUpcoming,ttExchange,ttNotice} from '../pvp/typing-top-model.js';
const read=p=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');

const classic=(extra={})=>({status:'running',mode:'classic',players:[{playerId:'a',seat:1,activeText:'güçlü kalkan yıldız ateş rüzgar',currentWord:'kalkan'}],...extra});
const rounds=(extra={})=>({status:'running',mode:'rounds',round:{index:2,total:5,phase:'round',words:['bir','iki','üç','dört','beş']},
  players:[{playerId:'a',seat:1,roundWordIndex:1}],...extra});
const arena=(extra={})=>({status:'running',mode:'arena',round:{index:3,total:5,phase:'round',words:['ok','yay','kılıç','kalkan']},
  players:[{playerId:'a',seat:1,roundWordIndex:0}],...extra});

test('mode label: local test, live classic, rounds and arena with round number',()=>{
  assert.equal(ttModeLabel(null),'YEREL YAZMA TESTİ');
  assert.equal(ttModeLabel({status:'ended',mode:'classic'}),'YEREL YAZMA TESTİ');
  assert.equal(ttModeLabel(classic()),'CANLI MAÇ');
  assert.equal(ttModeLabel(rounds()),'ZAMANA KARŞI · RAUND 2/5');
  assert.equal(ttModeLabel(rounds({round:{index:6,total:5,suddenDeath:true,phase:'round',words:[]}})),'ZAMANA KARŞI · ALTIN RAUND');
  assert.equal(ttModeLabel(arena()),'ARENA · RAUND 3/5');
});

test('upcoming words: next 3 after the current word in every mode',()=>{
  const me=m=>m.players[0];
  assert.deepEqual(ttUpcoming(classic(),me(classic())),['yıldız','ateş','rüzgar']);
  assert.deepEqual(ttUpcoming(rounds(),me(rounds())),['üç','dört','beş']);
  assert.deepEqual(ttUpcoming(arena(),me(arena())),['yay','kılıç','kalkan']);
  const end=rounds({players:[{playerId:'a',seat:1,roundWordIndex:4}]});
  assert.deepEqual(ttUpcoming(end,end.players[0]),[]);
});

test('upcoming words: hidden when ambiguous, not live or not typing phase',()=>{
  const dup=classic({players:[{playerId:'a',activeText:'kalkan ve kalkan',currentWord:'kalkan'}]});
  assert.deepEqual(ttUpcoming(dup,dup.players[0]),[]);
  assert.deepEqual(ttUpcoming(null,null),[]);
  const prep=arena({round:{index:1,total:5,phase:'prep',words:['a','b']}});
  assert.deepEqual(ttUpcoming(prep,prep.players[0]),[]);
});

test('exchange: countdown while typing, resolve text, hidden without exchange',()=>{
  assert.equal(ttExchange(classic(),1000),null);
  const x=ttExchange(classic({exchange:{index:2,endsAt:8000,phase:'typing'}}),1200);
  assert.equal(x.phase,'typing');assert.equal(x.secs,7);assert.equal(x.text,'Pencere 2 · 7 sn');
  assert.ok(x.frac>0.67&&x.frac<0.69);
  assert.equal(ttExchange(classic({exchange:{index:2,endsAt:1000,phase:'typing'}}),5000).secs,0);
  const r=ttExchange(classic({exchange:{index:3,endsAt:1000,phase:'resolve'}}),5000);
  assert.equal(r.phase,'resolve');assert.match(r.text,/Pencere 3 · hamleler oynatılıyor/);
  assert.equal(ttExchange(classic({status:'ended',exchange:{index:1,endsAt:9,phase:'typing'}}),1),null);
});

test('notice: lock, exchange resolve, Harf Kaosu and plain hint are distinct',()=>{
  assert.deepEqual(ttNotice({live:false,status:'Yazmaya başla…'}),{kind:'hint',text:'Yazmaya başla…'});
  assert.deepEqual(ttNotice({live:true,own:true,status:'Kelimeyi yaz, Space ile gönder'}),{kind:'hint',text:'Kelimeyi yaz, Space ile gönder'});
  assert.equal(ttNotice({live:true,own:true,disabled:true,status:'Tur arası · sonraki raund bekleniyor'}).kind,'lock');
  const chaos=ttNotice({live:true,own:true,scrambled:true,status:'Kelimeyi yaz, Space ile gönder'});
  assert.equal(chaos.kind,'chaos');assert.match(chaos.text,/Harf Kaosu/);assert.match(chaos.text,/göründüğü gibi/);
  const res=ttNotice({live:true,own:true,exchange:{phase:'resolve'},status:'x'});
  assert.equal(res.kind,'lock');assert.match(res.text,/sırayla/);
  assert.equal(ttNotice({live:true,own:true,disabled:true,pending:true,status:'Sunucu doğruluyor…'}).kind,'wait');
});

test('markup: visible label bound to the input, helper status, preview, exchange slot hidden by default',()=>{
  const js=read('pvp/pvp-main.js');
  const s=js.slice(js.indexOf('<section class="tt" data-typetop'),js.indexOf('<div class="pvp2-duel"'));
  assert.match(s,/<label class="tt-label" for="tt-input"/);
  assert.match(s,/id="tt-input"/);
  assert.match(s,/data-tt-mode/);
  assert.match(s,/data-tt-next/);
  assert.match(s,/data-tt-xchg hidden/);
  assert.match(s,/data-tt-status role="status" aria-live="polite"/);
  assert.ok(s.indexOf('data-tt-input')<s.indexOf('data-tt-status'),'durum satırı girişin altında (yardım metni)');
  assert.match(js,/ttExchange\(/);assert.match(js,/ttUpcoming\(/);assert.match(js,/ttNotice\(/);
});

test('css: big target, ≥44px input with visible focus, no text under 12px, reduced motion paths',()=>{
  const css=read('pvp/typing-top.css');
  const target=css.match(/\.tt-target\{[^}]*font:[^}]*\}/)[0];
  const min=Number(target.match(/clamp\((\d+)px/)[1]);assert.ok(min>=28,`hedef kelime en az 28px: ${min}`);
  const input=css.match(/\.tt-input\{[^}]*min-height[^}]*\}/)[0];
  assert.ok(Number(input.match(/min-height:(\d+)px/)[1])>=44);
  assert.match(css,/\.tt-input:focus-visible\{[^}]*outline:/);
  for(const m of css.matchAll(/font(?:-size)?:[^;}]*?(\d+(?:\.\d+)?)px/g))assert.ok(Number(m[1])>=12,`12px altı metin: ${m[0]}`);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{[^@]*\.tt-xchg-bar i/);
  assert.match(css,/#pvp-root\.pvp4-reduced [^{]*\.tt-xchg-bar i/);
  assert.doesNotMatch(css,/\.tt[^{]*\{[^}]*animation:[^;}]*infinite/,'yeni sonsuz animasyon yok');
  assert.doesNotMatch(css,/\.tt[^{]*\{[^}]*(backdrop-filter|filter:blur)/);
});
