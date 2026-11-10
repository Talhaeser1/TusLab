// Paket 33 — çözüm (saldırı sırası) evresinde basılan boşluk: kelime kaybolmaz, kutuda kalıp sonrakiyle birleşmez.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {exchangeGate,wordCommit,afterReject,queuedReady,QUEUE_CODES} from '../pvp/word-queue.js';
import {createPracticeSession} from '../pvp/practice.js';

const read=p=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const classic=(phase,endsAt=10_000,status='running')=>({status,mode:'classic',exchange:{index:1,phase,endsAt}});

test('exchangeGate: classic window open only while typing and before endsAt; other modes never gated here',()=>{
  assert.equal(exchangeGate(classic('typing'),5_000),'open');
  assert.equal(exchangeGate(classic('typing'),10_000),'closed','sunucu saatiyle süre doldu');
  assert.equal(exchangeGate(classic('resolve'),5_000),'closed');
  assert.equal(exchangeGate({status:'running',mode:'rounds',round:{phase:'round'}},0),'open');
  assert.equal(exchangeGate({status:'running',mode:'arena'},0),'open');
  assert.equal(exchangeGate(null,0),'open');
  assert.equal(exchangeGate(classic('resolve',0,'ended'),0),'open','bitmiş maçta kuyruk yok');
});

test('wordCommit: space during a closed window queues the word and empties the box (no merge)',()=>{
  assert.deepEqual(wordCommit({typed:'kelime ',gate:'open'}),{action:'submit',word:'kelime',typed:'kelime'});
  assert.deepEqual(wordCommit({typed:'kelime ',gate:'closed'}),{action:'queue',word:'kelime',typed:''});
  assert.deepEqual(wordCommit({typed:'   ',gate:'closed'}),{action:'none',word:'',typed:''});
  assert.deepEqual(wordCommit({typed:'kel',gate:'closed'}),{action:'type',word:'',typed:'kel'});
  // Sonraki kelime aynı anda yazılmışsa yalnız ilk kelime işlenir.
  assert.equal(wordCommit({typed:'bir iki',gate:'open'}).word,'bir');
});

test('afterReject: a word rejected because the window closed is re-queued; any rejection clears the box',()=>{
  assert.ok(QUEUE_CODES.has('EXCHANGE_NOT_ACTIVE'));
  assert.deepEqual(afterReject({code:'EXCHANGE_NOT_ACTIVE',word:'kelime'}),{queued:'kelime',typed:''});
  assert.deepEqual(afterReject({code:'WORD_INDEX_MISMATCH',word:'kelime'}),{queued:null,typed:''});
  assert.deepEqual(afterReject({code:'ROUND_NOT_ACTIVE',word:'kelime'}),{queued:null,typed:''},'tur bitti: yeni turda kelimeler değişir');
  assert.deepEqual(afterReject({code:'EXCHANGE_NOT_ACTIVE',word:''}),{queued:null,typed:''});
});

test('queuedReady: queued word is flushed once the next window opens, never while pending or locked',()=>{
  const m=classic('typing',20_000);
  assert.equal(queuedReady({queued:'kelime',pending:false,match:m,now:12_000,own:true}),true);
  assert.equal(queuedReady({queued:'kelime',pending:true,match:m,now:12_000,own:true}),false);
  assert.equal(queuedReady({queued:null,pending:false,match:m,now:12_000,own:true}),false);
  assert.equal(queuedReady({queued:'kelime',pending:false,match:classic('resolve',20_000),now:12_000,own:true}),false);
  assert.equal(queuedReady({queued:'kelime',pending:false,match:m,now:12_000,own:false}),false);
});

test('engine contract: a word sent during resolve is rejected with EXCHANGE_NOT_ACTIVE and the same index is valid in the next window',()=>{
  let t=1_700_000_000_000;const tasks=new Map();let seq=0;const packets=[];
  const scheduler={setInterval:(fn,ms)=>{const id=++seq;tasks.set(id,{fn,ms,every:true});return id;},clearInterval:id=>tasks.delete(id),
    setTimeout:(fn,ms)=>{const id=++seq;tasks.set(id,{fn,ms});return id;},clearTimeout:id=>tasks.delete(id)};
  const s=createPracticeSession({mode:'classic',now:()=>t,scheduler,rng:()=>0.5,createId:()=>'wq',difficulty:'kolay',onPacket:p=>packets.push(p)});
  s.start();
  const tick=()=>{for(const [id,task] of [...tasks])if(task.every)task.fn();else{tasks.delete(id);task.fn();}};
  // İki doğru kelime → Q saldırısı sıraya girer; pencere kapanınca çözüm evresi (saldırı sırası) oynar.
  for(let i=0;i<4;i++){t+=300;const me=s.snapshot().players.find(p=>p.playerId===s.humanId);
    s.send('WORD_SUBMIT',{matchId:s.snapshot().matchId,wordIndex:me.wordIndex,text:me.currentWord});}
  t=1_700_000_000_000+10_001;tick();
  assert.equal(s.snapshot().exchange.phase,'resolve');
  const me=s.snapshot().players.find(p=>p.playerId===s.humanId);
  s.send('WORD_SUBMIT',{matchId:s.snapshot().matchId,wordIndex:me.wordIndex,text:me.currentWord});
  const rej=packets.filter(p=>p.type==='WORD_RESULT').at(-1).payload;
  assert.equal(rej.accepted,false);assert.equal(rej.code,'EXCHANGE_NOT_ACTIVE');
  for(let i=0;i<200&&s.snapshot().exchange.phase!=='typing';i++){t+=100;tick();}
  assert.equal(s.snapshot().exchange.phase,'typing');
  const me2=s.snapshot().players.find(p=>p.playerId===s.humanId);
  assert.equal(me2.wordIndex,me.wordIndex,'reddedilen kelime sırayı ilerletmez');
  t+=200;s.send('WORD_SUBMIT',{matchId:s.snapshot().matchId,wordIndex:me2.wordIndex,text:me2.currentWord});
  assert.equal(packets.filter(p=>p.type==='WORD_RESULT').at(-1).payload.accepted,true);
  s.dispose();
});

test('wiring: index.js routes space through wordCommit, re-queues on reject, flushes + refocuses on window start',()=>{
  const js=read('pvp/index.js');
  assert.match(js,/from '\.\/word-queue\.js'/);
  assert.match(js,/wordCommit\(/);
  assert.match(js,/afterReject\(/);
  assert.match(js,/queuedReady\(/);
  assert.match(js,/EXCHANGE_START/);
});
