import test,{beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {ATASOZLERI} from '../pvp/shared/content-atasozu.js';
import {SIIRLER,SIIR_DIZELERI} from '../pvp/shared/content-siir.js';
import {OSMANLICA} from '../pvp/shared/content-osmanlica.js';
import {CONTENT_IDS,CONTENT_MODES,isContentId,normalizeContent,contentWords} from '../pvp/shared/content-modes.js';
import {createMatch,publicMatch,roundStartPayload,submitWord,advanceMatch} from '../pvp/shared/match.js';
import {wordsMatch} from '../pvp/shared/typing-rules.js';
import {createPracticeSession} from '../pvp/practice.js';
import {modePickDecision,modePickerHTML,modeSelectionKey,normalizeMode} from '../pvp/arena-ui.js';
import {ttModeLabel,ttHint} from '../pvp/typing-top-model.js';
import {PvPRoom} from '../cloudflare/src/room.js';

const players=[{playerId:'a',seat:1,character:'fire',name:'A'},{playerId:'b',seat:2,character:'rune',name:'B'}];
const mk=(content,o={})=>createMatch(players,1000,'m1',{rounds:5,roundStyle:'counted',roundWords:10,seed:'s',content,...o});
const OLD_POETS=['Yunus Emre','Karacaoğlan','Pir Sultan Abdal','Fuzûlî','Bâkî','Nedîm','Köroğlu','Dadaloğlu',
  'Muhibbi'/* Kanuni, ö. 1566 */,'Ziya Paşa'/* ö. 1880 */]; // hepsi 1900 öncesi vefat

test('içerik: sayı hedefleri, tek kelime birimi ve yalnız telifsiz şairler',()=>{
  assert.ok(ATASOZLERI.length>=200,`atasözü ${ATASOZLERI.length}`); // 15 Kas 2026: zorlaştırıldı
  assert.ok(SIIR_DIZELERI.length>=40&&SIIRLER.length>=10,`şiir ${SIIR_DIZELERI.length}`);
  assert.ok(OSMANLICA.length>=250,`osmanlıca ${OSMANLICA.length}`);
  const bare=s=>s.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
  for(const s of SIIRLER)assert.ok(OLD_POETS.some(p=>bare(p)===bare(s.sair)),`20. yy şairi olamaz: ${s.sair}`);
  assert.ok(OSMANLICA.every(e=>e.kelime&&e.anlam&&!/\s/u.test(e.kelime)),'osmanlıca: boşluksuz kelime + anlam');
  assert.equal(new Set(OSMANLICA.map(e=>e.kelime)).size,OSMANLICA.length,'osmanlıca kelimeler tekil');
  assert.deepEqual([...CONTENT_IDS],['kelime',...CONTENT_MODES]);
  assert.equal(normalizeContent('x'),'kelime');assert.equal(normalizeContent('siir'),'siir');
  assert.ok(isContentId('osmanlica')&&!isContentId('classic'));
});

test('Türkçe yazım: İ/ı büyük-küçük harf ve noktalama kuralı sabit',()=>{
  const dotted={caseSensitive:false,punctuation:true},plain={caseSensitive:false,punctuation:false};
  assert.ok(wordsMatch('ışık','IŞIK',dotted)&&wordsMatch('ilim','İLİM',dotted),'I↔ı, İ↔i');
  assert.ok(!wordsMatch('ilim','ILIM',dotted),'noktasız I, i ile eşleşmez');
  assert.ok(!wordsMatch('olur','olur.'),'varsayılan: noktalama gerekli');
  assert.ok(wordsMatch('olur','olur.',plain)&&wordsMatch('Gel,','gel',plain),'noktalama kapalıyken yok sayılır');
  assert.ok(!wordsMatch('ısık','ışık',dotted),'ı/ş ayrı harf');
});

test('atasözü: SIRAYLA, kelime kelime; raund kaldığı yerden devam eder',()=>{
  // Hangi atasözünün geleceği tohumla karışır (kural 1); her atasözü kendi içinde sıralı kalır.
  const flat=contentWords('atasozu',{seed:'s',start:0,count:40,round:1,total:5}).words;
  const m=mk('atasozu');
  assert.deepEqual(m.round.words,flat.slice(0,5)); // KESINYAP 11: 1. kelime raundu 5 kelime
  assert.ok(ATASOZLERI.some(s=>s.split(/\s+/).slice(0,3).join(' ')===flat.slice(0,3).join(' ')),'akış bir atasözünün başından başlar');
  assert.equal(publicMatch(m,1).content,'atasozu');
  assert.equal(roundStartPayload(m).content,'atasozu');
  assert.equal(publicMatch(m,1).round.hints,undefined,'atasözünde ipucu yok');
  // her iki oyuncu 5 kelimeyi de yazarsa 2. raund (7 kelime) 6. kelimeden başlar — KESINYAP 11 planı
  assert.deepEqual(contentWords('atasozu',{seed:'s',start:5,count:7,round:2,total:7}).words,flat.slice(5,12));
  assert.deepEqual(contentWords('atasozu',{seed:'s',start:5,count:7,round:2,total:7}).words,flat.slice(5,12),'deterministik');
});

test('şiir: dizeler sırayla, her kelimede şair adı ipucu',()=>{
  const m=mk('siir');
  assert.deepEqual(m.round.words,contentWords('siir',{seed:'s',start:0,count:5,round:1,total:7}).words); // KESINYAP 11: 5 kelime
  const pub=publicMatch(m,1);
  assert.equal(pub.round.hints.length,pub.round.words.length);
  assert.ok(SIIR_DIZELERI.some(d=>pub.round.hints[0].startsWith(d.sair)),pub.round.hints[0]);
  const bare=s=>s.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
  assert.ok(pub.round.hints.every(h=>OLD_POETS.some(p=>bare(h).startsWith(bare(p)))));
  assert.equal(ttHint(pub,{roundWordIndex:0}),pub.round.hints[0]);
});

test('osmanlıca: yalnız kelime yazılır, anlam ipucu görünür, raund ilerledikçe uzar',()=>{
  const m=mk('osmanlica');
  const known=new Map(OSMANLICA.map(e=>[e.kelime,e.anlam]));
  m.round.words.forEach((w,i)=>{assert.ok(known.has(w),w);assert.equal(m.round.hints[i],`Anlamı: ${known.get(w)}`);});
  const avg=r=>{const w=contentWords('osmanlica',{seed:'s',round:r,total:5,count:10}).words;return w.reduce((a,x)=>a+x.length,0)/w.length;};
  assert.ok(avg(5)>avg(1)+1.5,`raund 5 (${avg(5)}) raund 1'den (${avg(1)}) uzun olmalı`);
  const pub=publicMatch(m,1);assert.equal(ttHint(pub,{roundWordIndex:2}),pub.round.hints[2]);
});

test('içerik modu: motor kelimeleri kabul eder, bir sonraki raund devam eder (counted + timed)',()=>{
  for(const style of ['counted','timed']){
    let m=mk('atasozu',{roundStyle:style,seed:'q'});
    const first=[...m.round.words];let at=2000;
    for(let i=0;i<4;i++){
      const out=submitWord(m,{matchId:'m1',wordIndex:i,round:1,text:first[i],playerId:'a'},at+=300);
      assert.ok(!out.error,out.error);assert.equal(out.result.accepted,true);m=out.match;
    }
    assert.equal(m.round.words[0],first[0]);
    if(style==='timed')assert.ok(m.round.words.length>=10&&m.round.hints.length===m.round.words.length);
  }
  // timed: kuyruk uzatması sıralı akışı sürdürür
  let t=mk('siir',{roundStyle:'timed',seed:'q'});let at=2000;
  for(let i=0;i<9;i++){const w=t.round.words[i];t=submitWord(t,{matchId:'m1',wordIndex:i,round:1,text:w,playerId:'a'},at+=300).match;}
  const flat=contentWords('siir',{seed:'q',start:0,count:t.round.words.length,round:1,total:5}).words;
  assert.deepEqual(t.round.words,flat);
});

test('eski modlar: içeriksiz maçta alan/ipucu yok (classic · rounds · arena davranışı aynı)',()=>{
  const m=createMatch(players,1000,'m1',{rounds:5,seed:'s'});
  assert.equal(m.content,undefined);assert.equal(publicMatch(m,1).content,undefined);
  assert.equal(roundStartPayload(m).content,undefined);assert.equal(publicMatch(m,1).round.hints,undefined);
  assert.equal(ttModeLabel({status:'running',mode:'rounds',round:{index:2,total:5}}),'ZAMANA KARŞI · RAUND 2/5');
  assert.equal(ttModeLabel({status:'running',mode:'rounds',content:'siir',round:{index:2,total:5}}),'ŞİİR · RAUND 2/5');
  assert.equal(ttHint(publicMatch(m,1),{roundWordIndex:0}),'');
});

test('bot antrenmanı uçtan uca: içerik pratik oturumuna ve anlık görüntüye ulaşır',()=>{
  for(const content of ['atasozu','siir','osmanlica']){
    const packets=[];
    const s=createPracticeSession({mode:'rounds',content,rounds:5,roundStyle:'counted',rng:()=>.3,createId:()=>'p1',onPacket:p=>packets.push(p),
      scheduler:{setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){}}}).start();
    assert.equal(s.content,content);assert.equal(s.mode,'rounds');
    const snap=s.snapshot();
    assert.equal(snap.mode,'rounds');assert.equal(snap.content,content);
    assert.ok(snap.round.words.length===5&&snap.round.words.every(Boolean)); // KESINYAP 11: kelime raundu planı 5
    assert.equal(packets.find(p=>p.type==='ROUND_START').payload.content,content);
    s.dispose();
  }
  // classic içeriği yok sayar; bilinmeyen içerik kelime bankasına düşer
  const c=createPracticeSession({mode:'classic',content:'siir'});assert.equal(c.content,'kelime');c.dispose();
  const u=createPracticeSession({mode:'rounds',content:'yok'});assert.equal(u.content,'kelime');u.dispose();
});

test('lobi mod seçici: üç yeni seçenek, antrenmanda raund+içerik saklanır, odada MATCH_CONFIG',()=>{
  const html=modePickerHTML('practice');
  for(const label of ['Atasözü','Şiir','Osmanlıca','Klasik','Zamana Karşı','Arena'])assert.ok(html.includes(label),label);
  for(const id of CONTENT_MODES)assert.ok(html.includes(`data-mode="${id}"`),id);
  assert.deepEqual(modePickDecision({scope:'practice',value:'siir'}),{store:'rounds',content:'siir'});
  assert.deepEqual(modePickDecision({scope:'practice',value:'arena'}),{store:'arena'});
  assert.deepEqual(modePickDecision({scope:'room',value:'osmanlica',isHost:true,phase:'waiting',current:'rounds',rounds:7}),{type:'MATCH_CONFIG',payload:{mode:'rounds',rounds:7,content:'osmanlica'}});
  assert.equal(modePickDecision({scope:'room',value:'siir',isHost:false,phase:'waiting',current:'rounds'}),null);
  assert.equal(modePickDecision({scope:'room',value:'siir',isHost:true,phase:'waiting',current:'siir'}),null);
  assert.equal(modeSelectionKey('rounds','siir'),'siir');assert.equal(modeSelectionKey('arena','siir'),'arena');assert.equal(modeSelectionKey('rounds','kelime'),'rounds');
  assert.equal(normalizeMode('siir'),'rounds');
});

// ---- sunucu (Durable Object) doğrulaması ---------------------------------
const original={Response:globalThis.Response,WebSocketPair:globalThis.WebSocketPair,WebSocketRequestResponsePair:globalThis.WebSocketRequestResponsePair};
let last;
class Sock{constructor(){this.readyState=1;this.messages=[];this.attachment=null;}
  send(x){this.messages.push(JSON.parse(x));}serializeAttachment(a){this.attachment=structuredClone(a);}deserializeAttachment(){return structuredClone(this.attachment);}
  close(code=1000){this.readyState=3;this.code=code;}}
class Pair{constructor(){this.client=new Sock();this.server=new Sock();last=this.server;}}
class FakeResponse{constructor(_,p={}){this.status=p.status??200;this.webSocket=p.webSocket;this.headers=new Headers(p.headers);}}
beforeEach(()=>{globalThis.Response=FakeResponse;globalThis.WebSocketPair=Pair;globalThis.WebSocketRequestResponsePair=class {};});
afterEach(()=>Object.assign(globalThis,original));
const token=i=>`${String(i).repeat(8)}-1234-4123-8123-${String(i).repeat(12)}-12345678-1234-4123-8123-${String(i).repeat(12)}`;
const request=(room,ws,type,payload={})=>room.webSocketMessage(ws,JSON.stringify({version:1,type,payload}));
async function join(room,i){await room.fetch(new Request('https://local.test/connect',{headers:{Upgrade:'websocket'}}));const ws=last;
  await request(room,ws,'JOIN',{name:`Oyuncu ${i}`,character:i===1?'fire':'rune',resumeToken:token(i)});return ws;}

test('sunucu: MATCH_CONFIG content yalnız izinli kimlikleri kabul eder; maç içeriği taşır',async()=>{
  const sockets=[],store=new Map(),f={alarm:null};
  const ctx={getWebSockets:()=>sockets.filter(s=>s.readyState===1),acceptWebSocket:s=>sockets.push(s),setWebSocketAutoResponse(){},
    storage:{get:async k=>structuredClone(store.get(k)),put:async(k,v)=>store.set(k,structuredClone(v)),setAlarm:async t=>{f.alarm=t;},deleteAll:async()=>store.clear()}};
  const room=new PvPRoom(ctx,{});await room.fetch(new Request('https://local.test/initialize',{method:'POST'}));
  const a=await join(room,1),b=await join(room,2);
  const err=ws=>ws.messages.filter(m=>m.type==='ERROR').at(-1)?.payload.code;
  const state=ws=>ws.messages.filter(m=>m.type==='ROOM_STATE').at(-1).payload;
  assert.equal(state(a).content,'kelime');
  await request(room,b,'MATCH_CONFIG',{mode:'rounds',rounds:7,content:'siir'});assert.equal(err(b),'HOST_ONLY');
  await request(room,a,'MATCH_CONFIG',{mode:'rounds',rounds:7,content:'<script>'});assert.equal(err(a),'INVALID_MATCH_CONFIG');
  await request(room,a,'MATCH_CONFIG',{mode:'rounds',rounds:7,content:'classic'});assert.equal(err(a),'INVALID_MATCH_CONFIG');
  await request(room,a,'MATCH_CONFIG',{mode:'rounds',rounds:7,content:'osmanlica',x:1});assert.equal(err(a),'INVALID_ROUNDS');
  for(const content of CONTENT_MODES){
    await request(room,a,'MATCH_CONFIG',{mode:'rounds',rounds:7,content});
    assert.equal(state(a).content,content);assert.equal(state(a).mode,'rounds');assert.equal(state(b).rounds,7);
  }
  await request(room,a,'MATCH_CONFIG',{mode:'classic'});assert.equal(state(a).content,'kelime');
  await request(room,a,'MATCH_CONFIG',{mode:'rounds',rounds:7,content:'atasozu'});
  await request(room,a,'READY_SET',{ready:true});await request(room,b,'READY_SET',{ready:true});
  const l=await room.roster();l.startAt=Date.now()-5;await room.save(l);await room.alarm();
  const m=await ctx.storage.get('match');
  assert.equal(m.mode,'rounds');assert.equal(m.content,'atasozu');
  assert.ok(m.seed,'sunucu maç tohumu üretir');
  assert.deepEqual(m.round.words,contentWords('atasozu',{seed:m.seed,start:0,count:m.round.words.length,round:1,total:5}).words);
  const ms=a.messages.filter(x=>x.type==='MATCH_START').at(-1).payload.match;
  assert.equal(ms.content,'atasozu');
  assert.ok(JSON.stringify(a.messages.at(-1)).length<4096*4,'snapshot şişmedi');
});
