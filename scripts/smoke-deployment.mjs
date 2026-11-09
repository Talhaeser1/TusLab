/** Post-deployment smoke test. --rooms option mutates remote state: staging only. */
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
const target=process.argv[2];
const rooms=process.argv.includes('--rooms');
if(!target){console.error('Kullanım: node scripts/smoke-deployment.mjs https://PROJE.workers.dev [--rooms]');process.exit(2);}
const base=new URL(target);
if(!['https:','http:'].includes(base.protocol)||base.username||base.password||base.search||base.hash){throw Error('Geçersiz URL');}
if(base.protocol!=='https:'&&!['localhost','127.0.0.1','[::1]'].includes(base.hostname)){throw Error('Uzak sitede HTTPS zorunlu');}
const api=async(path,options={})=>{
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),10000);
  try{return await fetch(new URL(path,base),{redirect:'error',cache:'no-store',...options,signal:controller.signal});}
  finally{clearTimeout(timer);}
};
const res=await api('/api/health');assert.equal(res.status,200,'/api/health başarısız');
const health=await res.json();assert.equal(health.ok,true);assert.ok(Number.isInteger(health.stage)&&health.stage>=24,`beklenmeyen sürüm: ${health.stage}`);assert.equal(health.protocol,1);
const home=await api('/index.html');assert.equal(home.status,200,'index.html erişilemiyor');
assert.match(await home.text(),/TuşLab|Yazma Arenası|Neon Arena/i);
const pvp=await api('/pvp/network.js');assert.equal(pvp.status,200,'PvP kodu sunulmuyor');
assert.match(await pvp.text(),/WebSocket/);
const missing=await api('/api/this-does-not-exist');assert.equal(missing.status,404,'Bilinmeyen API doğru yanıt vermedi');
console.log('PASS: sağlık, HTML, PvP JavaScript ve bilinmeyen API rotası');
if(!rooms){console.log('Salt-okunur kontrol tamamlandı. Test odası açmak için --rooms (tercihen staging) kullan.');process.exit(0);}
if(/(^|\.)tuslab-neon-pvp\./i.test(base.hostname)&&process.env.ALLOW_PRODUCTION_SMOKE!=='1'){
  throw Error('Üretim Worker üzerinde oda testi için ALLOW_PRODUCTION_SMOKE=1 gereklidir.');
}
const roomResponse=await api('/api/pvp/rooms',{method:'POST',headers:{'content-type':'application/json','origin':base.origin},body:'{}'});
assert.equal(roomResponse.status,201,'Oda açılamadı');
const {roomCode}=await roomResponse.json();assert.match(roomCode,/^[A-Z2-9]{16}$/);
console.log('PASS: test odası açıldı:',roomCode);
const wsUrl=new URL(`/api/pvp/rooms/${roomCode}/ws`,base);wsUrl.protocol=base.protocol==='https:'?'wss:':'ws:';
function client(name,character){
  const ws=new WebSocket(wsUrl.toString());const inbox=[];const waiters=[];
  ws.addEventListener('message',evt=>{
    let msg;try{msg=JSON.parse(evt.data);}catch{return;}
    inbox.push(msg);
    for(const item of [...waiters])if(item.type===msg.type){clearTimeout(item.timeout);waiters.splice(waiters.indexOf(item),1);item.resolve(msg);}
  });
  ws.addEventListener('error',()=>{for(const item of waiters.splice(0)){clearTimeout(item.timeout);item.reject(new Error(name+' socket error'));}});
  const wait=(type,timeout=10000)=>{
    const found=inbox.find(m=>m.type===type);if(found)return Promise.resolve(found);
    return new Promise((resolve,reject)=>{const item={type,resolve,reject,timeout:setTimeout(()=>{waiters.splice(waiters.indexOf(item),1);reject(new Error(`${name}: ${type} timeout`));},timeout)};waiters.push(item);});
  };
  const open=new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
  const token=()=>randomUUID()+'-'+randomUUID();
  return {ws,open,wait,send:(type,payload={})=>ws.send(JSON.stringify({version:1,type,payload})),join:async()=>{
    await open;ws.send(JSON.stringify({version:1,type:'JOIN',payload:{name,character,resumeToken:token(),guestToken:randomBytes(32).toString('hex')}}));
    const result=await wait('CONNECTED');assert.ok(result.payload.playerId);return result;
  }};
}
const a=client('Kontrol A','fire');const b=client('Kontrol B','rune');
try{
  const [aJoin,bJoin]=await Promise.all([a.join(),b.join()]);
  assert.notEqual(aJoin.payload.seat,bJoin.payload.seat);
  a.send('READY_SET',{ready:true});b.send('READY_SET',{ready:true});
  await Promise.all([a.wait('COUNTDOWN',10000),b.wait('COUNTDOWN',10000)]);
  const [aStart,bStart]=await Promise.all([a.wait('MATCH_START',20000),b.wait('MATCH_START',20000)]);
  assert.equal(aStart.payload.match.matchId,bStart.payload.match.matchId);
  assert.ok(aStart.payload.match.players.every(p=>p.hp===2000));
  console.log('PASS: iki WebSocket oyuncusu, iki koltuk, hazır olma, 3-2-1 ve ortak maç');
}finally{
  for(const c of [a,b]){try{c.send('LEAVE',{});c.ws.close();}catch{}}
}
console.log('Smoke testi başarılı. Bu test gerçek insan oyununu, FPS veya yük altında kararlılığı kanıtlamaz.');
