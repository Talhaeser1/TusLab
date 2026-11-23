import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {SFX_NAMES,createPvPAudio} from '../pvp/sound.js';
import {MUSIC_SCENES,createDynamicScore} from '../pvp/music23.js';

const root=join(import.meta.dirname,'..');
test('all authored WAV files have safe peaks, short effects and a compact total',()=>{
 let total=0;
 for(const [folder,names] of [['sfx',SFX_NAMES],['music',MUSIC_SCENES]]){
  for(const name of names){
   const path=join(root,'assets',folder,name+'.wav');
   const buf=readFileSync(path);
   total+=statSync(path).size;
   const channels=buf.readUInt16LE(22),rate=buf.readUInt32LE(24),frames=buf.readUInt32LE(40)/(channels*2);
   assert.ok(frames/rate<=(folder==='sfx'?1.7:18.1),name);
   let peak=0;
   for(let i=44;i<buf.length;i+=2)peak=Math.max(peak,Math.abs(buf.readInt16LE(i)));
   assert.ok(peak>500&&peak<30000,`${name} peak ${peak}`);
   assert.ok(Math.abs(buf.readInt16LE(44))<200,`${name} click at start`);
   assert.ok(Math.abs(buf.readInt16LE(buf.length-2))<200,`${name} click at end`);
  }
 }
 assert.ok(total<6_700_000,`audio footprint ${total}`);
});

test('muted engines create no context or playback source',async()=>{
 let contexts=0,sources=0;
 class Node{connect(){}disconnect(){}}
 class Context{
  constructor(){contexts++;this.state='suspended';this.destination=new Node();}
  createGain(){const n=new Node();n.gain={value:1};return n;}
  createBufferSource(){sources++;return new Node();}
  async resume(){this.state='running';}
  async close(){}
 }
 const storage={getItem:key=>key.endsWith('muted')?'true':null,setItem(){}};
 const sfx=createPvPAudio({storage,AudioContextClass:Context,fetcher:null});
 const music=createDynamicScore({storage,AudioContextClass:Context,fetcher:null});
 assert.equal(await sfx.unlock(),false);
 assert.equal(await music.unlock(),false);
 assert.equal(sfx.play('hit'),false);
 assert.equal(music.setScene('combat'),false);
 assert.equal(contexts,0);assert.equal(sources,0);
 await sfx.dispose();await music.dispose();
});

test('new arena, round and word events have audio call sites',()=>{
 const src=readFileSync(join(root,'pvp/pvp-main.js'),'utf8');
 for(const cue of ['prep','skill-lock','round-start','scramble','time-thief','time-freeze','blind-clock','clash','attack-turn','word-correct','word-wrong'])
  assert.ok(src.includes(cue),cue);
 assert.match(src,/setOnPlay\(\(\)=>pvpMusic\.duck\(\)\)/);
});
