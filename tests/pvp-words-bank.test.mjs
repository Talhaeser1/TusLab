// Shared seeded Turkish word bank (pvp/shared/words.js) and the home-page
// (app.js) word-variety block that consumes it.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import * as Words from '../pvp/shared/words.js';
import {MATCH_WORDS} from '../pvp/shared/match.js';

const {WORD_BANK_VERSION,WORD_COUNT,createSeed,createRng,pickWords,pickSentence,WORD_BANK}=Words;
const root=fileURLToPath(new URL('..',import.meta.url));
const TR_WORD=/^[a-zçğıöşü]+$/u;
const SPECIAL=/[çğıöşü]/gu;
const trLower=s=>s.replace(/I/g,'ı').replace(/İ/g,'i').toLowerCase();
const specialCount=w=>(w.match(SPECIAL)||[]).length;

test('exports version, word count and the full bank',()=>{
  assert.equal(WORD_BANK_VERSION,1);
  assert.ok(Number.isInteger(WORD_COUNT)&&WORD_COUNT>=600,`WORD_COUNT=${WORD_COUNT}`);
  assert.equal(WORD_BANK.length,WORD_COUNT);
  assert.ok(Object.isFrozen(WORD_BANK));
});
test('every bank word is lowercase Turkish letters only, 2-12 chars',()=>{
  const bad=WORD_BANK.filter(w=>!TR_WORD.test(w)||w.length<2||w.length>12||w!==w.normalize('NFC'));
  assert.deepEqual(bad,[]);
});
test('bank has no duplicates',()=>{
  const seen=new Set(),dups=[];
  for(const w of WORD_BANK){if(seen.has(w))dups.push(w);seen.add(w);}
  assert.deepEqual(dups,[]);
});
test('bank has a sensible length spread (3-12)',()=>{
  for(let len=3;len<=11;len++)
    assert.ok(WORD_BANK.filter(w=>w.length===len).length>=8,`too few words of length ${len}`);
  assert.ok(WORD_BANK.some(w=>w.length===12)||WORD_BANK.filter(w=>w.length>=11).length>=8);
});
test('every word used by the current engine MATCH_WORDS is in the bank',()=>{
  const bank=new Set(WORD_BANK);
  const missing=MATCH_WORDS.flatMap(t=>t.split(/\s+/u)).map(w=>trLower(w.replace(/[^\p{L}]/gu,''))).filter(w=>w&&!bank.has(w));
  assert.deepEqual(missing,[]);
});
test('createSeed returns a uint32 and honours the injected rng',()=>{
  const s=createSeed();
  assert.ok(Number.isInteger(s)&&s>=0&&s<=0xffffffff);
  assert.equal(createSeed(()=>0),0);
  assert.equal(createSeed(()=>0.5),0x80000000);
  assert.equal(createSeed(()=>0.9999999999),0xffffffff);
});
test('createRng is deterministic and returns values in [0,1)',()=>{
  const a=createRng(42),b=createRng(42),c=createRng(43);
  const xs=Array.from({length:200},()=>a());
  assert.deepEqual(xs,Array.from({length:200},()=>b()));
  assert.ok(xs.every(x=>x>=0&&x<1));
  assert.notDeepEqual(xs.slice(0,10),Array.from({length:10},()=>c()));
  // String seeds (e.g. a match id) hash deterministically too.
  assert.equal(createRng('match-8')(),createRng('match-8')());
});
test('pickWords is deterministic for the same arguments',()=>{
  const args={seed:12345,count:30,difficulty:'normal'};
  assert.deepEqual(pickWords(args),pickWords({...args}));
  assert.deepEqual(pickWords({seed:7,count:20,difficulty:'hard',exclude:['bilgisayar']}),
    pickWords({seed:7,count:20,difficulty:'hard',exclude:['bilgisayar']}));
});
test('pickWords returns exactly count unique words, up to 60',()=>{
  for(const difficulty of ['easy','normal','hard']){
    const list=pickWords({seed:99,count:60,difficulty});
    assert.equal(list.length,60,difficulty);
    assert.equal(new Set(list).size,60,difficulty);
    assert.ok(list.every(w=>WORD_BANK.includes(w)));
  }
});
test('pickWords respects exclude',()=>{
  const first=pickWords({seed:5,count:40});
  const second=pickWords({seed:5,count:40,exclude:first});
  assert.equal(second.length,40);
  assert.ok(second.every(w=>!first.includes(w)));
});
test('pickWords respects minLen/maxLen',()=>{
  const list=pickWords({seed:3,count:40,minLen:5,maxLen:7});
  assert.equal(list.length,40);
  assert.ok(list.every(w=>w.length>=5&&w.length<=7));
});
test('difficulty controls word length and Turkish-letter density',()=>{
  const sample=d=>Array.from({length:10},(_,i)=>pickWords({seed:1000+i,count:40,difficulty:d})).flat();
  const easy=sample('easy'),normal=sample('normal'),hard=sample('hard');
  assert.ok(easy.every(w=>w.length>=3&&w.length<=6),'easy is 3-6');
  assert.ok(normal.every(w=>w.length>=4&&w.length<=9),'normal is 4-9');
  assert.ok(hard.every(w=>w.length>=6&&w.length<=12),'hard is 6-12');
  const avg=(xs,f)=>xs.reduce((s,x)=>s+f(x),0)/xs.length;
  assert.ok(avg(hard,w=>w.length)>avg(normal,w=>w.length));
  assert.ok(avg(normal,w=>w.length)>avg(easy,w=>w.length));
  assert.ok(avg(hard,specialCount)>avg(normal,specialCount),'hard has more ç ğ ı ö ş ü');
});
test('different seeds give different lists',()=>{
  const lists=Array.from({length:20},(_,i)=>pickWords({seed:i*7919+1,count:15}).join(' '));
  assert.ok(new Set(lists).size>=19);
  const a=pickWords({seed:1,count:30}),b=pickWords({seed:2,count:30});
  assert.ok(a.filter(w=>b.includes(w)).length<15,'two seeds share less than half their words');
});
test('pickWords rejects an unknown difficulty and returns what is available when the pool is short',()=>{
  assert.throws(()=>pickWords({seed:1,count:5,difficulty:'insane'}),RangeError);
  const tiny=pickWords({seed:1,count:500,minLen:12,maxLen:12,difficulty:'hard'});
  assert.ok(tiny.length>0&&tiny.length<500);
  assert.equal(new Set(tiny).size,tiny.length);
  assert.deepEqual(pickWords({seed:1,count:0}),[]);
});
test('pickSentence builds a deterministic, capitalised Turkish phrase of the requested length',()=>{
  const s=pickSentence({seed:77,words:8});
  assert.equal(s,pickSentence({seed:77,words:8}));
  assert.notEqual(s,pickSentence({seed:78,words:8}));
  assert.match(s,/^[A-ZÇĞİÖŞÜ]/u);
  assert.match(s,/\.$/u);
  const tokens=s.split(/\s+/u).map(w=>trLower(w.replace(/[^\p{L}]/gu,'')));
  assert.equal(tokens.length,8);
  assert.ok(tokens.every(w=>WORD_BANK.includes(w)),s);
  for(const n of [3,5,12,20])assert.equal(pickSentence({seed:n,words:n}).split(/\s+/u).length,n);
  assert.equal(pickSentence({seed:1}).split(/\s+/u).length,8);
});
test('pickSentence capitalises i as İ without locale APIs',()=>{
  const starts=Array.from({length:400},(_,i)=>pickSentence({seed:i,words:4})[0]);
  assert.ok(!starts.includes('I')||WORD_BANK.some(w=>w.startsWith('ı')));
  assert.ok(starts.every(c=>/[A-ZÇĞİÖŞÜ]/u.test(c)));
});

// ---- app.js (classic script) ----
const appSource=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const BLOCK=/\/\* <tuslab-words> \*\/([\s\S]*?)\/\* <\/tuslab-words> \*\//u;
function loadAppWordBlock(bank){
  const block=appSource.match(BLOCK);
  assert.ok(block,'app.js has a /* <tuslab-words> */ ... /* </tuslab-words> */ block');
  const context=vm.createContext({});
  vm.runInContext(`${block[1]};globalThis.api={tusLabWordState,setTusLabWordBank,nextTusLabSeed,variedPick,variedShuffle,variedSentences,variedWords};`,context);
  if(bank)context.api.setTusLabWordBank(bank);
  return context.api;
}
const FALLBACK=['güçlü','çözüm','öğrenci','düşünce','özgür','yazılım','hızlı','kodlama'];

test('app.js still parses as a classic script',()=>{
  execFileSync(process.execPath,['--check',fileURLToPath(new URL('../app.js',import.meta.url))],{cwd:root});
});
test('app.js loads the shared bank with a dynamic import and keeps its built-in fallback',()=>{
  assert.match(appSource,/import\(['"]\.\/pvp\/shared\/words\.js['"]\)/u);
  for(const name of ['TEXTS','PRACTICE_WORDS','SPEED_WORDS','CASTLE_WORDS','CODE_CHUNKS'])
    assert.match(appSource,new RegExp(`const ${name}=`),name);
  assert.doesNotMatch(appSource,/SPEED_WORDS\[\(i\*11\+db\.sessions\.length\*7\)/u,'speed words no longer cycle by session count');
  assert.doesNotMatch(appSource,/TEXTS\.classic\[count%/u,'classic text no longer cycles by session count');
});
test('home-page word picks vary between seeds and repeat for the same seed (bank loaded)',()=>{
  const api=loadAppWordBlock(Words);
  const a=api.variedWords({seed:1,count:40,difficulty:'easy',fallback:FALLBACK});
  const b=api.variedWords({seed:2,count:40,difficulty:'easy',fallback:FALLBACK});
  assert.equal(a.length,40);assert.notDeepEqual(a,b);
  assert.deepEqual(a,api.variedWords({seed:1,count:40,difficulty:'easy',fallback:FALLBACK}));
  assert.ok(a.every(w=>WORD_BANK.includes(w)));
  const s1=api.variedSentences({seed:10,count:3,words:10,fallback:['Yedek metin.']});
  const s2=api.variedSentences({seed:11,count:3,words:10,fallback:['Yedek metin.']});
  assert.notEqual(s1,s2);assert.equal(s1.split(/\s+/u).length,30);
});
test('home-page picks also vary without the bank, using the built-in arrays',()=>{
  const api=loadAppWordBlock(null);
  const a=api.variedWords({seed:1,count:40,difficulty:'easy',fallback:FALLBACK});
  const b=api.variedWords({seed:2,count:40,difficulty:'easy',fallback:FALLBACK});
  assert.equal(a.length,40);assert.notDeepEqual(a,b);
  assert.ok(a.every(w=>FALLBACK.includes(w)));
  const texts=['bir','iki','üç','dört','beş'];
  const picks=new Set(Array.from({length:20},(_,i)=>api.variedPick(texts,i*31+5)));
  assert.ok(picks.size>=3);
  assert.deepEqual([...api.variedShuffle(texts,9)].sort(),[...texts].sort());
  assert.equal(api.variedSentences({seed:3,count:2,words:10,fallback:['Yedek metin.','İkinci yedek.']}).length>0,true);
});
test('each run draws a fresh seed within a session',()=>{
  const api=loadAppWordBlock(null);
  const seeds=new Set(Array.from({length:10},()=>api.nextTusLabSeed()));
  assert.equal(seeds.size,10);
  assert.ok([...seeds].every(s=>Number.isInteger(s)&&s>=0&&s<=0xffffffff));
});
