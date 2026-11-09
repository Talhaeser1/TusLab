/** Stage 18: strict single-location, per-visitor edge limiter.
 * Identity is a SHA-256 of the Cloudflare-provided client IP; never store raw IPs.
 * This limiter controls HTTP/handshake floods, not the match-specific per-player quota.
 */
const allowed=new Set(['/api/pvp/rooms','/api/pvp/social','/api/pvp/profile','/api/pvp/leaderboard','websocket','status']);
export class PvPGuard {
  constructor(ctx){this.ctx=ctx;this.queue=Promise.resolve();}
  async fetch(request){
    if(new URL(request.url).pathname!=='/check'||request.method!=='POST')return new Response(null,{status:404});
    const policy=await request.json().catch(()=>null);
    if(!allowed.has(policy?.scope)||!Number.isSafeInteger(policy.max)||policy.max<1||policy.max>500||![60].includes(policy.seconds))return new Response(null,{status:400});
    const run=async()=>{
      const now=Date.now(),key='rate:'+policy.scope;
      let state=await this.ctx.storage.get(key);
      if(!state||now>=state.until)state={count:0,until:now+policy.seconds*1000};
      state.count++; await this.ctx.storage.put(key,state);
      return new Response(null,{status:state.count>policy.max?429:204,headers:{'retry-after':String(Math.max(1,Math.ceil((state.until-now)/1000)))}});
    };
    const result=this.queue.then(run,run);this.queue=result.catch(()=>{});return result;
  }
}
