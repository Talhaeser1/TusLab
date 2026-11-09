import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createDynamicScore,MUSIC_SCENES} from '../pvp/music23.js';
const dir=join(import.meta.dirname,'../assets/music');
test('7 original PCM tracks are 22.05kHz 16-bit mono, loops ~16s, stingers 8-10s, valid and distinct',()=>{
 assert.deepEqual(MUSIC_SCENES,['lobby','prep','combat','tension','ultimate','victory','defeat']);
 const heads=[];let total=0;
 for(const scene of MUSIC_SCENES){const name=join(dir,scene+'.wav');assert.ok(existsSync(name));const buf=readFileSync(name);total+=buf.byteLength;
  assert.equal(buf.toString('utf8',0,4),'RIFF');assert.equal(buf.toString('utf8',8,12),'WAVE');
  assert.equal(buf.readUInt16LE(20),1,'PCM');assert.equal(buf.readUInt16LE(22),1,'mono');assert.equal(buf.readUInt32LE(24),22050);assert.equal(buf.readUInt16LE(34),16,'16-bit');
  assert.equal(buf.toString('utf8',36,40),'data');
  const seconds=buf.readUInt32LE(40)/(22050*2);
  if(scene==='victory'||scene==='defeat')assert.ok(seconds>=8&&seconds<=10,`${scene} ${seconds}s`);
  else assert.ok(seconds>=15.9&&seconds<=18.1,`${scene} ${seconds}s`);
  heads.push(buf.subarray(30000,30040).toString('hex'));}
 assert.equal(new Set(heads).size,MUSIC_SCENES.length,'every scene is distinct');
 assert.ok(total<=5_200_000,`music footprint ${total}`);
});
test('preload fetches lobby+combat first; other scenes load lazily on first setScene',async()=>{
 class Node{connect(){}disconnect(){}}
 class Context{constructor(){this.state='suspended';this.destination=new Node();this.currentTime=0;}
  async resume(){this.state='running'}async close(){}
  createGain(){const n=new Node();n.gain={value:1,setValueAtTime(){},linearRampToValueAtTime(v){this.value=v},cancelScheduledValues(){}};return n}
  createBufferSource(){const n=new Node();n.start=()=>{};n.stop=()=>{n.onended?.()};return n}
  async decodeAudioData(b){return {length:b.byteLength}}}
 const fetched=[];
 const score=createDynamicScore({storage:null,AudioContextClass:Context,fetcher:async url=>{fetched.push(url.split('/').pop());return {ok:true,arrayBuffer:async()=>new Uint8Array(8).buffer};}});
 assert.equal(await score.preload(),true);
 assert.deepEqual(fetched.sort(),['combat.wav','lobby.wav']);
 assert.equal(await score.unlock(),true);assert.equal(score.getState().current,'lobby');
 assert.equal(score.setScene('ultimate'),false,'not loaded yet');
 await new Promise(r=>setTimeout(r,0));
 assert.equal(score.getState().current,'ultimate');
 assert.equal(fetched.filter(f=>f==='ultimate.wav').length,1);
 assert.equal(score.setScene('combat'),true,'preloaded scene switches immediately');
 assert.ok(!fetched.includes('prep.wav')&&!fetched.includes('defeat.wav'));
 await score.dispose();
});
test('autoplay disabled before unlock, levels persisted, invalid scenes rejected',async()=>{
 class Node{connect(){}disconnect(){}}
 let starts=0,stops=0;
 class Context{constructor(){this.state='suspended';this.destination=new Node();this.currentTime=4;}
  async resume(){this.state='running'}async close(){this.state='closed'}
  createGain(){const n=new Node();n.gain={value:1,setValueAtTime(v){this.value=v},linearRampToValueAtTime(v){this.value=v},cancelScheduledValues(){}};return n}
  createDynamicsCompressor(){const n=new Node();for(const k of ['threshold','knee','ratio','attack','release'])n[k]={value:0};return n}
  createBufferSource(){const n=new Node();n.start=()=>starts++;n.stop=()=>{stops++;n.onended?.()};return n}
  async decodeAudioData(buffer){return {length:buffer.byteLength}}
 }
 const storage=new Map(),s={getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)};
 const score=createDynamicScore({storage:s,AudioContextClass:Context,fetcher:async()=>({ok:true,arrayBuffer:async()=>new Uint8Array(300).buffer})});
 assert.equal(score.setScene('hacker'),false);
 assert.equal(score.setScene('combat'),false);
 assert.equal(starts,0);assert.equal(await score.unlock(),true);assert.equal(score.getState().current,'combat');assert.equal(starts,1);
 score.setScene('tension');await new Promise(r=>setTimeout(r,0));assert.equal(starts,2);assert.ok(stops>0);
 assert.equal(score.setVolume(2),1);assert.equal(storage.get('tuslab-pvp-music-volume'),'1');
 assert.equal(score.setMuted(true),true);assert.equal(score.getState().voices,0);assert.equal(score.setMuted(false),false);
 assert.equal(score.getState().current,'tension');
 await score.dispose();assert.equal(score.getState().disposed,true);
});
test('music remains optional if AudioContext unavailable; no server commands',async()=>{
 const score=createDynamicScore({storage:null,AudioContextClass:null,fetcher:null});assert.equal(await score.unlock(),false);score.setScene('lobby');await score.dispose();
 const src=readFileSync(join(import.meta.dirname,'../pvp/music23.js'),'utf8');assert.doesNotMatch(src,/WORD_SUBMIT|DAMAGE_APPLIED|fetch\(['"]\/api/);
});
