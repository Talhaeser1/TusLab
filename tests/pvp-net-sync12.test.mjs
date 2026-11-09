import test from 'node:test';
import assert from 'node:assert/strict';
import {ClockSynchronizer,SnapshotOrder} from '../pvp/net-sync.js';
import {PvPRoom} from '../cloudflare/src/room.js';

function measure(clock,nonce,clientSend,up,down,serverOffset=0,serverProcessing=2){
  clock.request(nonce,clientSend);
  return clock.receive({nonce,receivedAt:clientSend+up+serverOffset,sentAt:clientSend+up+serverOffset+serverProcessing},clientSend+up+down+serverProcessing);
}

test('30/100/200 ms RTT NTP-style clock synchronization gives correct unbiased time',()=>{
  for(const latency of [30,100,200]){
    const clock=new ClockSynchronizer();
    for(let i=0;i<5;i++)measure(clock,'probe-'+latency+'-'+i,10000+i*6000,latency/2,latency/2,450);
    const s=clock.stats();
    assert.ok(s.ready);assert.equal(s.rtt,latency);
    assert.equal(s.offset,450);
    assert.equal(clock.serverNow(60_000),60_450);
    assert.equal(s.jitter,0);
  }
});

test('clock sync selects lowest RTT packets amid queueing and rejects invalid probe replies',()=>{
  const c=new ClockSynchronizer();
  c.request('lost-001',500);
  assert.equal(c.receive({nonce:'unknown',receivedAt:600,sentAt:601},620),null);
  assert.equal(c.stats().ready,false);
  measure(c,'fast-001',1000,20,20,100);
  measure(c,'slow-001',2000,180,80,100);
  measure(c,'fast-002',3000,21,19,100);
  measure(c,'fast-003',4000,20,20,100);
  assert.ok(Math.abs(c.stats().offset-100)<0.5);
  assert.ok(c.stats().jitter>0);
  c.request('bad-001',8000);
  assert.equal(c.receive({nonce:'bad-001',receivedAt:8003,sentAt:9000},8010),null);
  assert.ok(Math.abs(c.stats().offset-100)<0.5);
});

test('never accept stale snapshots and detect missing sequence numbers',()=>{
  const order=new SnapshotOrder();
  assert.deepEqual(order.observe('m1',2),{accepted:true,newMatch:true,gap:false});
  assert.deepEqual(order.observe('m1',5),{accepted:true,newMatch:false,gap:true});
  assert.equal(order.observe('m1',3).accepted,false);
  assert.equal(order.observe('m1',5).accepted,true); // idempotent same revision
  assert.equal(order.observe('m1',6).gap,false);
  assert.deepEqual(order.observe('m2',1),{accepted:true,newMatch:true,gap:false});
  assert.equal(order.observe('m2',-1).accepted,false);
});

function simulateLinks({latency,loss}){
  const authoritative=Array.from({length:81},(_,i)=>({matchId:'duel',sequence:i+1,hpA:2000-i*8,hpB:2000-i*4}));
  let seed=2026;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const arrive=[];
  for(const [viewer,oneWay] of [['A',latency/2],['B',latency/2+11]]){
    for(const packet of authoritative){
      if(random()<loss)continue; // app-level dropped updates, NOT raw TCP packet loss
      const jitter=(random()-.5)*latency*.75;
      arrive.push({viewer,time:packet.sequence*70+oneWay+jitter,packet});
      if(random()<.12)arrive.push({viewer,time:packet.sequence*70+oneWay+jitter+5,packet}); // dup
    }
    // A periodic full authoritative snapshot corrects any lost updates.
    arrive.push({viewer,time:10_000+oneWay,packet:authoritative.at(-1)});
  }
  arrive.sort((a,b)=>a.time-b.time);
  const states={A:{order:new SnapshotOrder(),hpA:null,hpB:null,gaps:0,stale:0},B:{order:new SnapshotOrder(),hpA:null,hpB:null,gaps:0,stale:0}};
  for(const {viewer,packet} of arrive){
    const c=states[viewer];const verdict=c.order.observe(packet.matchId,packet.sequence);
    if(!verdict.accepted){c.stale++;continue;}
    if(verdict.gap)c.gaps++;
    c.hpA=packet.hpA;c.hpB=packet.hpB;
  }
  const last=authoritative.at(-1);
  for(const view of Object.values(states)){
    assert.equal(view.order.sequence,last.sequence);
    assert.equal(view.hpA,last.hpA);
    assert.equal(view.hpB,last.hpB);
  }
  return states;
}
for(const latency of [30,100,200]){
  for(const loss of [.01,.05,.10]){
    test(`network emulation ${latency}ms RTT / ${loss*100}% application-message loss converges on server HP`,()=>{
      const states=simulateLinks({latency,loss});
      assert.ok(states.A.order.sequence>0&&states.B.order.sequence>0);
    });
  }
}

test('server ping replies with server-side receive and send timestamps and throttles abusive probes',async()=>{
  const ctx={setWebSocketAutoResponse(){}};
  globalThis.WebSocketRequestResponsePair=class{constructor(){}};
  const room=new PvPRoom(ctx,{});
  const packets=[];let attachment={verified:true,playerId:'player-1',seat:1,count:0,windowAt:Date.now()};
  const sock={deserializeAttachment(){return attachment;},serializeAttachment(a){attachment=a;},send(raw){packets.push(JSON.parse(raw));},close(){}};
  const msg=nonce=>JSON.stringify({version:1,type:'PING',payload:{nonce}});
  await room.webSocketMessage(sock,msg('test-probe-0001'));
  assert.equal(packets.length,1);
  assert.equal(packets[0].type,'PONG');
  assert.equal(packets[0].payload.nonce,'test-probe-0001');
  assert.ok(packets[0].payload.sentAt>=packets[0].payload.receivedAt);
  for(let i=0;i<50;i++)await room.webSocketMessage(sock,msg('test-probe-'+String(i).padStart(4,'0')));
  assert.equal(packets.filter(p=>p.type==='PONG').length,1); // no PONG amplification
  assert.ok(packets.some(p=>p.payload?.code==='RATE_LIMIT')); // raw flood blocked
  attachment.rawWindowAt=Date.now()-6000; attachment.rawCount=0;
  await room.webSocketMessage(sock,msg('BAD'));
  assert.equal(packets.at(-1).payload.code,'INVALID_PROBE');
});
