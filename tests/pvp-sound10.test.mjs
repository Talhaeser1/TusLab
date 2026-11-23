import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {SFX_NAMES,MAX_VOICES,SKILL_SFX,soundForCue,createPvPAudio} from '../pvp/sound.js';
const base=join(dirname(fileURLToPath(import.meta.url)),'..');
test('28 original mono PCM assets are present, well-formed, short and include fire/rune ultimates',()=>{
  assert.equal(SFX_NAMES.length,28);
  let total=0;
  for(const name of SFX_NAMES){
    const path=join(base,'assets/sfx',name+'.wav');assert.ok(existsSync(path),name);
    const data=readFileSync(path);assert.ok(data.byteLength>1000,name);total+=data.byteLength;
    assert.equal(data.subarray(0,4).toString(),'RIFF');
    assert.equal(data.subarray(8,12).toString(),'WAVE');
    assert.equal(data.readUInt16LE(20),1,'PCM');
    assert.equal(data.readUInt16LE(22),1,'mono audio');
    assert.equal(data.readUInt32LE(24),22050,'22.05kHz sample rate');
    assert.equal(data.readUInt16LE(34),16,'16-bit');
    const seconds=data.readUInt32LE(40)/(22050*2);
    assert.ok(seconds>=0.05&&seconds<=1.6,`${name} ${seconds}s`);
  }
  assert.ok(total<=1_500_000,`sfx footprint ${total}`);
});
test('two fighters have different Q/E/R sounds and shield is shared',()=>{
  for(const key of ['q','e','r'])assert.notEqual(SKILL_SFX.fire[key],SKILL_SFX.rune[key]);
  assert.equal(soundForCue('fire','blade-trail','q'),'fire-q');
  assert.equal(soundForCue('rune','blade-trail','e'),'rune-e');
  assert.equal(soundForCue('fire','ultimate-charge','r'),'fire-r');
  assert.equal(soundForCue('rune','ward-rise','s'),'shield');
  assert.equal(soundForCue('unknown','charge','q'),null);
});
test('muting, level, WebAudio unlocking, stereo pan and voice limit are enforced',async()=>{
  class Node{connect(){return this}disconnect(){}}
  let created=0,decoded=0,stopped=0;
  class Voice extends Node{start(){}stop(){stopped++;this.onended?.()}set buffer(x){this.buf=x}}
  class Context{
    constructor(){created++;this.state='suspended';this.destination=new Node();}
    async resume(){this.state='running';}
    createGain(){const node=new Node();node.gain={value:1};return node;}
    createDynamicsCompressor(){const node=new Node();for(const key of ['threshold','knee','ratio','attack','release'])node[key]={value:0};return node;}
    createStereoPanner(){const node=new Node();node.pan={value:0};return node;}
    createBufferSource(){return new Voice();}
    async decodeAudioData(buf){decoded++;return {byteLength:buf.byteLength};}
    async close(){this.state='closed';}
  }
  const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
  let requests=0;
  const engine=createPvPAudio({storage,AudioContextClass:Context,fetcher:async()=>{requests++;return {ok:true,arrayBuffer:async()=>new Uint8Array([1,2,3]).buffer};}});
  assert.equal(engine.play('fire-q'),false);
  assert.equal(await engine.unlock(),true);
  assert.equal(created,1);assert.equal(decoded,SFX_NAMES.length);
  assert.equal(engine.playCue('fire','blade-trail','q'),true);
  for(let i=0;i<MAX_VOICES+3;i++)engine.play('hit');
  assert.equal(engine.getState().voices,MAX_VOICES);
  assert.ok(stopped>=4);
  assert.equal(engine.setVolume(2),1);
  assert.equal(data.get('tuslab-pvp-sfx-volume'),'1');
  assert.equal(engine.setMuted(true),true);
  assert.equal(engine.play('hit'),false);
  assert.equal(engine.setMuted(false),false);
  assert.equal(engine.combat({type:'DAMAGE_APPLIED',toSeat:2,blocked:true}),true);
  assert.equal(engine.combat({type:'SKILL_CAST'}),false);
  assert.equal(requests,SFX_NAMES.length);
  await engine.dispose();assert.equal(engine.getState().disposed,true);
});
test('sound engine is optional and does not require AudioContext or fetch',async()=>{
  const engine=createPvPAudio({storage:null,AudioContextClass:null,fetcher:null});
  assert.equal(await engine.unlock(),false);
  assert.equal(engine.play('hit'),false);
  engine.setMuted(true);await engine.dispose();
});
test('sound event integration is cosmetic and never sends damage',()=>{
  const html=readFileSync(join(base,'pvp/pvp-main.js'),'utf8');
  assert.match(html,/pvpAudio\.combat\(action\)/);
  assert.match(html,/pvpAudio\.playCue\(id,cue,action\)/);
  assert.match(html,/projectiles\?\.launch/);
  assert.doesNotMatch(readFileSync(join(base,'pvp/sound.js'),'utf8'),/WORD_SUBMIT|DAMAGE_APPLIED.*send\(/);
});
