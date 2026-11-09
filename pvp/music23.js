/** TuşLab Original Dynamic Score — phase 23 (rev. 2).
 *  Seven original synthesised cues (22.05 kHz mono), no samples from commercial titles.
 *  Loading is lazy: preload() fetches lobby + combat first; every other scene is
 *  fetched the first time setScene() asks for it. Scene changes crossfade ~0.6 s.
 *  Purely cosmetic; never sends gameplay commands or server damage.
 */
export const MUSIC_SCENES=Object.freeze(['lobby','prep','combat','tension','ultimate','victory','defeat']);
const PRIORITY_SCENES=Object.freeze(['lobby','combat']);
const FADE=.6;
const clip=n=>Math.max(0,Math.min(1,Number(n)||0));
function read(storage,key,fallback){try{return storage?.getItem(key)??fallback;}catch{return fallback;}}
function write(storage,key,value){try{storage?.setItem(key,String(value));}catch{}}
export function createDynamicScore({storage=globalThis.localStorage,AudioContextClass=globalThis.AudioContext||globalThis.webkitAudioContext,fetcher=globalThis.fetch?.bind(globalThis),baseURL='./assets/music/'}={}){
 let ctx=null,master=null,compressor=null,disposed=false,loading=null,unlocked=false,duckTimer=null;
 let volume=clip(Number(read(storage,'tuslab-pvp-music-volume','0.20')));
 let muted=read(storage,'tuslab-pvp-music-muted','false')==='true';
 let requested='lobby',current=null,transitionTimer=null;
 const raw=new Map(),decoded=new Map(),voices=new Set();
 function setup(){
  if(disposed||!AudioContextClass)return false;
  if(ctx)return true;
  ctx=new AudioContextClass({latencyHint:'playback'});
  master=ctx.createGain();master.gain.value=1;
  if(ctx.createDynamicsCompressor){
    compressor=ctx.createDynamicsCompressor();compressor.threshold.value=-20;compressor.knee.value=12;
    compressor.ratio.value=10;compressor.attack.value=.006;compressor.release.value=.18;
    master.connect(compressor);compressor.connect(ctx.destination);
  }else master.connect(ctx.destination);
  return true;
 }
 const pending=new Map();
 // Fetch (and, once the context is unlocked, decode) one scene; deduplicated.
 function load(scene){
  if(decoded.has(scene))return Promise.resolve(true);
  if(pending.has(scene))return pending.get(scene);
  const job=(async()=>{
   try{
    if(!raw.has(scene)){
     if(!fetcher||disposed)return false;
     const response=await fetcher(baseURL+scene+'.wav');if(!response.ok)throw new Error('Missing track');
     raw.set(scene,await response.arrayBuffer());
    }
    if(ctx&&unlocked&&!decoded.has(scene)){decoded.set(scene,await ctx.decodeAudioData(raw.get(scene).slice(0)));raw.delete(scene);}
    return true;
   }catch{/* Missing music is never a gameplay failure. */return false;}
   finally{pending.delete(scene);}
  })();
  pending.set(scene,job);
  return job;
 }
 // Start the requested scene now if decoded, otherwise lazily load then start it.
 function want(scene){
  if(applyScene(scene))return true;
  if(disposed||muted||volume<=0||decoded.has(scene))return false;
  void load(scene).then(()=>{if(requested===scene&&current!==scene)applyScene(scene);});
  return false;
 }
 async function preload(){
  if(!fetcher||disposed||muted||volume<=0)return false;
  if(loading)return loading;
  loading=Promise.all(PRIORITY_SCENES.map(load)).then(()=>raw.size+decoded.size>0);
  return loading;
 }
 async function unlock(){
  if(disposed||muted||volume<=0||!setup())return false;
  try{await ctx.resume();}catch{return false;}
  unlocked=ctx.state==='running';
  if(!raw.size&&!decoded.size)await preload();
  await Promise.all([...pending.values()]);
  for(const scene of [...raw.keys()])await load(scene);
  if(!decoded.has(requested))await load(requested);
  if(unlocked&&!muted&&volume>0&&!current)applyScene(requested);
  return unlocked;
 }
 function automate(gain,value,at){
  if(gain.cancelScheduledValues)gain.cancelScheduledValues(at);
  if(gain.setValueAtTime)gain.setValueAtTime(gain.value??0,at);
  else gain.value=gain.value??0;
  if(gain.linearRampToValueAtTime)gain.linearRampToValueAtTime(value,at+FADE);
  else gain.value=value;
 }
 function stopCurrent(){
  for(const voice of voices){try{voice.source.stop();}catch{}}
  voices.clear();current=null;
 }
 function applyScene(scene){
  if(disposed||muted||volume<=0||!unlocked||!ctx||!decoded.has(scene))return false;
  if(scene===current)return true;
  const time=ctx.currentTime||0;
  const src=ctx.createBufferSource(),gain=ctx.createGain();
  src.buffer=decoded.get(scene);src.loop=scene!=='victory'&&scene!=='defeat';
  gain.gain.value=0;src.connect(gain);gain.connect(master);
  const voice={source:src,gain,scene};voices.add(voice);src.onended=()=>{voices.delete(voice);if(current===scene)current=null;try{src.disconnect();gain.disconnect();}catch{}};
  src.start(0);automate(gain.gain,volume*.35,time);
  for(const old of [...voices])if(old!==voice){
   automate(old.gain.gain,0,time);
   // AudioContext scheduling stops old loops even if the tab is backgrounded.
   try{old.source.stop(time+FADE+.06);}catch{}
  }
  current=scene;
  return true;
 }
 function setScene(scene){
  if(!MUSIC_SCENES.includes(scene)||disposed)return false;
  requested=scene;
  return want(scene);
 }
 function setMuted(value){
  muted=Boolean(value);write(storage,'tuslab-pvp-music-muted',muted);
  if(muted)stopCurrent();else want(requested);
  return muted;
 }
 function setVolume(value){
  volume=clip(value);write(storage,'tuslab-pvp-music-volume',volume);
  if(volume<=0)stopCurrent();else if(!current)want(requested);
  else for(const voice of voices){automate(voice.gain.gain,volume*.35,ctx.currentTime||0);}
  return volume;
 }
 function stop(){stopCurrent();}
 function duck(){
  if(disposed||muted||volume<=0||!ctx||!unlocked||!current)return false;
  if(duckTimer)clearTimeout(duckTimer);
  const gain=master.gain,now=ctx.currentTime||0;
  gain.cancelScheduledValues?.(now);
  gain.setValueAtTime?.(gain.value??1,now);
  gain.linearRampToValueAtTime?.(.65,now+.025);
  if(!gain.linearRampToValueAtTime)gain.value=.65;
  duckTimer=setTimeout(()=>{
   duckTimer=null;
   if(disposed||!ctx)return;
   const at=ctx.currentTime||0;
   gain.cancelScheduledValues?.(at);
   gain.setValueAtTime?.(gain.value??.65,at);
   gain.linearRampToValueAtTime?.(1,at+.28);
   if(!gain.linearRampToValueAtTime)gain.value=1;
  },160);
  return true;
 }
 async function dispose(){if(disposed)return;disposed=true;stopCurrent();if(transitionTimer)clearTimeout(transitionTimer);if(duckTimer)clearTimeout(duckTimer);if(ctx)try{await ctx.close();}catch{};ctx=null;}
 return {preload,unlock,setScene,setMuted,setVolume,duck,stop,dispose,getState:()=>({volume,muted,requested,current,voices:voices.size,unlocked,loaded:decoded.size,disposed})};
}
