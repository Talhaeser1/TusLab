import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,statSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {SFX_NAMES,FIGHTER_SFX_NAMES,FIGHTER_SFX_KEYS,ALL_SFX_NAMES,fighterSfx,fighterFallbackSfx,createPvPAudio} from '../pvp/sound.js';
import {FIGHTER_IDS} from '../pvp/shared/fighters.js';

const base=join(dirname(fileURLToPath(import.meta.url)),'..');

test('paket 32: every fighter has q/e/r/hit/ko names, kept out of the eager SFX_NAMES set',()=>{
  assert.deepEqual([...FIGHTER_IDS].sort(),['doran','nyx','sira','vargr']);
  assert.deepEqual([...FIGHTER_SFX_KEYS],['q','e','r','hit','ko']);
  assert.equal(FIGHTER_SFX_NAMES.length,FIGHTER_IDS.length*5);
  for(const id of FIGHTER_IDS)for(const key of FIGHTER_SFX_KEYS){
    assert.ok(FIGHTER_SFX_NAMES.includes(`${id}-${key}`));
    assert.match(`${id}-${key}`,/^[a-z]+-(q|e|r|hit|ko)$/);
  }
  for(const name of FIGHTER_SFX_NAMES)assert.ok(!SFX_NAMES.includes(name),`${name} must stay lazy`);
  assert.equal(ALL_SFX_NAMES.length,SFX_NAMES.length+FIGHTER_SFX_NAMES.length);
  assert.equal(new Set(ALL_SFX_NAMES).size,ALL_SFX_NAMES.length);
});

test('paket 32: fighter WAVs are mono 16-bit 22.05 kHz, 0.05–1.6 s, -1 dBFS peak, clean edges, DC≈0, ≤1.2 MB total',()=>{
  let total=0;
  const seen=new Set();
  for(const name of FIGHTER_SFX_NAMES){
    const path=join(base,'assets/sfx',name+'.wav');
    assert.ok(existsSync(path),name);
    const buf=readFileSync(path);total+=statSync(path).size;
    assert.equal(buf.subarray(0,4).toString(),'RIFF');
    assert.equal(buf.subarray(8,12).toString(),'WAVE');
    assert.equal(buf.readUInt16LE(20),1,'PCM');
    assert.equal(buf.readUInt16LE(22),1,'mono');
    assert.equal(buf.readUInt32LE(24),22050);
    assert.equal(buf.readUInt16LE(34),16);
    const frames=buf.readUInt32LE(40)/2,seconds=frames/22050;
    assert.ok(seconds>=0.05&&seconds<=1.6,`${name} ${seconds}s`);
    let peak=0,sum=0;
    for(let i=44;i<buf.length;i+=2){const v=buf.readInt16LE(i);sum+=v;peak=Math.max(peak,Math.abs(v));}
    const peakDb=20*Math.log10(peak/32768);
    assert.ok(peakDb>-1.3&&peakDb<-0.7,`${name} peak ${peakDb.toFixed(2)} dBFS`);
    assert.ok(Math.abs(sum/frames)<40,`${name} DC ${sum/frames}`);
    assert.ok(Math.abs(buf.readInt16LE(44))<200,`${name} click at start`);
    assert.ok(Math.abs(buf.readInt16LE(buf.length-2))<200,`${name} click at end`);
    const digest=buf.subarray(44,44+4000).toString('base64');
    assert.ok(!seen.has(digest),`${name} duplicates another fighter sound`);seen.add(digest);
  }
  assert.ok(total<=1_200_000,`fighter sfx footprint ${total}`);
});

test('paket 32: fighterSfx names and archetype fallbacks',()=>{
  assert.equal(fighterSfx('vargr','q'),'vargr-q');
  assert.equal(fighterSfx('nyx','ko'),'nyx-ko');
  assert.equal(fighterSfx('sira','hit'),'sira-hit');
  assert.equal(fighterSfx('nobody','q'),null);
  assert.equal(fighterSfx('doran','s'),null);
  assert.equal(fighterSfx(undefined,'q'),null);
  assert.equal(fighterFallbackSfx('sira','q'),'fire-q');
  assert.equal(fighterFallbackSfx('nyx','r'),'rune-r');
  assert.equal(fighterFallbackSfx('doran','hit'),'hit');
  assert.equal(fighterFallbackSfx('vargr','ko'),'defeat');
  assert.equal(fighterFallbackSfx('nobody','e','rune'),'rune-e');
});

function harness({failNames=[]}={}){
  class Node{connect(){return this}disconnect(){}}
  const played=[];
  class Voice extends Node{start(){played.push(this.buf?.name);}stop(){this.onended?.()}set buffer(x){this.buf=x}get buffer(){return this.buf}}
  class Context{
    constructor(){this.state='suspended';this.destination=new Node();}
    async resume(){this.state='running';}
    createGain(){const n=new Node();n.gain={value:1};return n;}
    createStereoPanner(){const n=new Node();n.pan={value:0};return n;}
    createBufferSource(){return new Voice();}
    async decodeAudioData(buf){return {name:new TextDecoder().decode(buf)};}
    async close(){this.state='closed';}
  }
  const requested=[];
  const fetcher=async url=>{
    const name=url.split('/').pop().replace('.wav','');requested.push(name);
    if(failNames.includes(name))return {ok:false,status:404};
    return {ok:true,arrayBuffer:async()=>new TextEncoder().encode(name).buffer};
  };
  const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
  return {engine:createPvPAudio({storage,AudioContextClass:Context,fetcher}),requested,played};
}

test('paket 32: fighter sounds load lazily, only for the selected fighters',async()=>{
  const {engine,requested,played}=harness();
  await engine.preload();
  assert.equal(requested.length,SFX_NAMES.length,'eager preload stays the 28 legacy files');
  assert.ok(!requested.some(n=>FIGHTER_SFX_NAMES.includes(n)));
  assert.equal(await engine.unlock(),true);
  assert.equal(await engine.preloadFighters(['sira','nyx','sira','bogus']),true);
  const fighterReqs=requested.filter(n=>FIGHTER_SFX_NAMES.includes(n));
  assert.deepEqual(fighterReqs.sort(),[...FIGHTER_SFX_KEYS.map(k=>`nyx-${k}`),...FIGHTER_SFX_KEYS.map(k=>`sira-${k}`)].sort());
  await engine.preloadFighters(['sira']);
  assert.equal(requested.filter(n=>n==='sira-q').length,1,'no refetch for an already loaded fighter');
  assert.deepEqual(engine.getState().fighters.sort(),['nyx','sira']);
  assert.equal(engine.playFighter('sira','q'),true);
  assert.equal(engine.playFighter('nyx','ko',{gain:.7}),true);
  // doran was never preloaded -> archetype fallback (rune-e / hit)
  assert.equal(engine.playFighter('doran','e'),true);
  assert.equal(engine.playFighter('doran','hit'),true);
  assert.equal(engine.playFighter('nobody','q',{character:'fire'}),true);
  assert.equal(engine.playFighter('vargr','s'),false);
  assert.deepEqual(played,['sira-q','nyx-ko','rune-e','hit','fire-q']);
  await engine.dispose();
});

test('paket 32: missing fighter files fall back, and muted requests load on unlock',async()=>{
  const {engine,requested,played}=harness({failNames:['vargr-r']});
  engine.setMuted(true);
  assert.equal(await engine.preloadFighters(['vargr']),false);
  assert.equal(requested.length,0,'muted: nothing fetched');
  engine.setMuted(false);
  assert.equal(await engine.unlock(),true);
  assert.ok(requested.includes('vargr-q'),'remembered fighter is fetched on unlock');
  assert.equal(engine.playFighter('vargr','q'),true);
  assert.equal(engine.playFighter('vargr','r'),true);
  assert.deepEqual(played,['vargr-q','fire-r']);
  await engine.dispose();
  const silent=createPvPAudio({storage:null,AudioContextClass:null,fetcher:null});
  assert.equal(await silent.preloadFighters(['vargr']),false);
  assert.equal(silent.playFighter('vargr','q'),false);
});
