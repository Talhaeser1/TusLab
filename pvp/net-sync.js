/** Work package 12 — transport clock estimation and monotonic snapshots.
 * Clock estimates are for UI presentation only; server time owns combat.
 */
export class ClockSynchronizer {
  constructor(maxSamples=7){this.samples=[];this.pending=new Map();this.maxSamples=maxSamples;}
  reset(){this.samples=[];this.pending.clear();}
  request(nonce,clientSentAt){
    if(typeof nonce!=='string'||!Number.isFinite(clientSentAt))return null;
    for(const [k,v] of this.pending)if(clientSentAt-v>12000)this.pending.delete(k);
    if(this.pending.size>=10)this.pending.delete(this.pending.keys().next().value);
    this.pending.set(nonce,clientSentAt);
    return {nonce};
  }
  receive({nonce,receivedAt,sentAt},clientReceivedAt){
    const started=this.pending.get(nonce);
    if(started===undefined)return null;
    this.pending.delete(nonce);
    if(![receivedAt,sentAt,clientReceivedAt].every(Number.isFinite))return null;
    const serverDuration=sentAt-receivedAt;
    const elapsed=clientReceivedAt-started;
    if(serverDuration<0||elapsed<0||elapsed>12000||serverDuration>elapsed)return null;
    const rtt=Math.max(0,elapsed-serverDuration);
    const offset=((receivedAt-started)+(sentAt-clientReceivedAt))/2;
    if(Math.abs(offset)>86400000)return null;
    this.samples.push({rtt,offset});
    if(this.samples.length>this.maxSamples)this.samples.shift();
    return this.stats();
  }
  stats(){
    if(!this.samples.length)return {ready:false,rtt:null,jitter:null,offset:0};
    // Favor the smallest RTT for offset: it has the least queueing/asymmetry.
    const ranked=[...this.samples].sort((a,b)=>a.rtt-b.rtt);
    const best=ranked.slice(0,Math.min(3,ranked.length));
    const offset=best.reduce((a,s)=>a+s.offset,0)/best.length;
    const rtt=Math.round(this.samples.at(-1).rtt);
    const avg=this.samples.reduce((a,s)=>a+s.rtt,0)/this.samples.length;
    const jitter=Math.round(this.samples.reduce((a,s)=>a+Math.abs(s.rtt-avg),0)/this.samples.length);
    return {ready:true,rtt,jitter,offset};
  }
  serverNow(clientNow=Date.now()){return clientNow+this.stats().offset;}
}

/** Enforces monotonic snapshots without changing authoritative state. */
export class SnapshotOrder {
  constructor(){this.reset();}
  reset(){this.matchId=null;this.sequence=-1;}
  observe(matchId,sequence){
    if(typeof matchId!=='string'||!Number.isSafeInteger(sequence)||sequence<0)return {accepted:false,reason:'INVALID'};
    const newMatch=this.matchId!==matchId;
    if(newMatch){this.matchId=matchId;this.sequence=sequence;return {accepted:true,newMatch:true,gap:false};}
    if(sequence<this.sequence)return {accepted:false,reason:'STALE'};
    const gap=sequence>this.sequence+1;
    this.sequence=sequence;
    return {accepted:true,newMatch:false,gap};
  }
}
