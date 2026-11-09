/* TuşLab original synth game audio: no external files or libraries.
   Audio starts only after real keyboard/mouse interaction (browser autoplay policy). */
(function(){
  'use strict';
  let ctx=null,master=null,lastKey=0,active=0;
  function context(){
    try{
      const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;
      if(!ctx){
        ctx=new C();master=ctx.createGain();master.gain.value=.55;
        if(ctx.createDynamicsCompressor){
          const limiter=ctx.createDynamicsCompressor();
          limiter.threshold.value=-20;limiter.knee.value=10;limiter.ratio.value=12;
          limiter.attack.value=.004;limiter.release.value=.16;
          master.connect(limiter);limiter.connect(ctx.destination);
        }else master.connect(ctx.destination);
      }
      if(ctx.state==='suspended')ctx.resume().catch(()=>{});
      return ctx;
    }catch{return null;}
  }
  function tone(frequency,duration=.08,kind='triangle',volume=.06,shift=0,delay=0){
    const c=context();if(!c)return;const t=c.currentTime+delay;
    const osc=c.createOscillator(),gain=c.createGain();osc.type=kind;
    osc.frequency.setValueAtTime(Math.max(45,frequency),t);
    if(shift)osc.frequency.exponentialRampToValueAtTime(Math.max(45,frequency+shift),t+duration);
    gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(Math.max(.0002,volume/Math.sqrt(active+1)),t+.008);
    gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
    osc.connect(gain);gain.connect(master);active++;osc.onended=()=>{active=Math.max(0,active-1);osc.disconnect();gain.disconnect();};osc.start(t);osc.stop(t+duration+.008);
  }
  function noise(duration=.1,volume=.07,filterFreq=900,delay=0){
    const c=context();if(!c)return;const buffer=c.createBuffer(1,Math.ceil(c.sampleRate*duration),c.sampleRate);
    const data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(1-i/data.length);
    const source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();source.buffer=buffer;filter.type='lowpass';filter.frequency.value=filterFreq;
    gain.gain.setValueAtTime(volume/Math.sqrt(active+1),c.currentTime+delay);gain.gain.exponentialRampToValueAtTime(.0001,c.currentTime+delay+duration);
    source.connect(filter);filter.connect(gain);gain.connect(master);active++;source.onended=()=>{active=Math.max(0,active-1);source.disconnect();filter.disconnect();gain.disconnect();};source.start(c.currentTime+delay);
  }
  const api={
    key(correct=true){const now=performance.now();if(now-lastKey<25)return;lastKey=now;
      if(correct){tone(680+Math.random()*100,.036,'triangle',.023,-260);noise(.022,.009,2300)}
      else {tone(260,.095,'sawtooth',.05,-130);noise(.065,.025,600)}
    },
    hit(damage=8,critical=false){if(critical){noise(.22,.13,1100);tone(190,.28,'sawtooth',.10,-110);tone(480,.22,'triangle',.08,420,.05);tone(750,.29,'sine',.065,-240,.08)}
      else {noise(.1,.08,1000);tone(180+Math.min(200,damage*9),.14,'triangle',.065,-110);tone(410,.08,'sine',.038,-170,.03)}
    },
    block(){noise(.095,.045,1700);tone(660,.13,'sine',.05,-380)},
    start(){tone(380,.11,'sine',.05,150);tone(560,.13,'triangle',.04,260,.09)},
    victory(){[420,530,680,840].forEach((f,i)=>tone(f,.28,'triangle',.085,140,i*.125))},
    stage(){[310,430,600].forEach((f,i)=>tone(f,.20,'sawtooth',.06,100,i*.09))}
  };
  window.TusLabSFX=api;
})();
