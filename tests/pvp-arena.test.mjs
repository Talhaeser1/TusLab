import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {getTypingPreview} from '../pvp/preview.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');

test('phase 2 arena has two isolated sides, four skills, and per-player typing areas',()=>{
  const js=readFileSync(resolve(root,'pvp/index.js'),'utf8');
  assert.ok(js.includes('data-player="${p.id}"'));
  assert.ok(js.includes('data-input="${p.id}"'));
  for(const key of ['Q','E','S','R'])assert.ok(js.includes(`ability(p.id,'${key}'`));
  assert.match(js,/pvp2-midline/);
  for(const asset of ['assets/arena-king.webp','assets/rune-preview.webp','assets/castle-scene.webp'])assert.ok(existsSync(resolve(root,asset)),asset);
});
test('typing preview counts Turkish characters and accurate word streaks',()=>{
  const s=getTypingPreview('ışık güçlü bir kaleyi korur.','ışık güçlü bir ',10000);
  assert.equal(s.count,15);
  assert.equal(s.accuracy,100);
  assert.equal(s.chain,3);
  assert.deepEqual(s.ready,{Q:true,E:false,R:false});
  assert.ok(s.wpm>0);
});
test('incorrect character prevents ready streak and reduces accuracy',()=>{
  const s=getTypingPreview('savaşçı büyük bir güç.','savaaçı büyük bir ',20000);
  assert.ok(s.accuracy<100);
  assert.equal(s.chain,0);
  assert.deepEqual(s.ready,{Q:false,E:false,R:false});
});
test('local preview never grants damage or online connection',()=>{
  const s=getTypingPreview('iki dört beş altı yedi ', 'iki dört beş altı yedi ',5000);
  assert.equal(s.finished,true);
  assert.equal(s.ready.R,true);
  assert.equal(s.damage,undefined);
  assert.equal(s.connection,undefined);
  const js=readFileSync(resolve(root,'pvp/index.js'),'utf8');
  assert.match(js,/MAÇ BEKLENİYOR/);
  assert.match(js,/data-server-hp/);
  assert.match(js,/YEREL YAZMA TESTİ/);
});
test('typing preview handles zero elapsed without NaN and clamps to target',()=>{
  const s=getTypingPreview('çığ ','çığ daha fazla',0);
  assert.equal(s.typed,'çığ ');
  assert.equal(s.wpm,0);
  assert.equal(s.count,4);
  assert.equal(getTypingPreview('','',0).percent,0);
});
