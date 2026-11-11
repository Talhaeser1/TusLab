/** Maç ekranı bilgi katmanı (görev I2): "SEN" rozeti, her oyuncunun yazdığı kelimeler (kendi can barının altında)
 * ve üst-orta büyük süre/raund yazısı. Üç modda (classic, rounds, arena) çalışır; yalnız sunucu maç durumunu okur.
 *
 *   const info = createMatchInfo(root, {now, getMyId, getTyped, isReduced});
 *   info.update(match, myId);          // 'tuslab:pvp-match' olayında
 *
 * DOM tutamaçları: [data-sen-badge] · [data-typed-strip="1|2"] · [data-round-clock] · [data-round-label].
 * rounds/arena'da süre-raund tutamaçları mevcut madalyonun öğelerine eklenir (ikinci bir sayaç çizilmez);
 * classic'te madalyon olmadığı için kendi sayacı çizilir. Katman position:fixed (görünüm penceresi koordinatları), işaretçi olaylarını geçirir. */
export const STRIP_WORDS=5;
export const STRIP_WORDS_NARROW=3;
const KEEP=8;

const seatOf=(match,seat)=>(match?.players||[]).find(p=>p&&p.seat===seat)||null;
const isLive=match=>match?.status==='running'||match?.status==='paused';

/** Her koltuk için son yazılan kelimeleri sunucu anlık görüntülerinin farkından çıkarır (kelime indeksi/doğru-yanlış sayaçları). */
export function createTypedTracker(){
  let key=null,seats={};
  const fresh=()=>({idx:null,correct:0,wrong:0,words:new Map(),list:[]});
  const counters=(match,p)=>match.mode==='classic'||!match.round
    ?{idx:Number(p.wordIndex)||0,correct:Number(p.correctWords)||0,wrong:Number(p.wrongWords)||0}
    :match.mode==='arena'
      ?{idx:Number(p.roundWordIndex)||0,correct:Number(p.correctWords)||0,wrong:Number(p.wrongWords)||0}
      :{idx:Number(p.roundWordIndex)||0,correct:Number(p.roundCorrect)||0,wrong:Number(p.roundWrong)||0};
  function update(match){
    if(!match||!isLive(match)&&match.status!=='ended')return read();
    const k=`${match.matchId}:${match.mode==='classic'?0:match.round?.index??0}`;
    if(k!==key){key=k;seats={1:fresh(),2:fresh()};}
    for(const seat of [1,2]){
      const p=seatOf(match,seat);if(!p)continue;
      const s=seats[seat],now=counters(match,p);
      // Bilinen kelimeler: raund listesinin görünen penceresi + (classic) o anki kelime.
      if(Array.isArray(match.round?.words))match.round.words.forEach((w,i)=>{if(w)s.words.set(i,String(w));});
      if(match.mode==='classic'&&p.currentWord)s.words.set(now.idx,String(p.currentWord));
      if(s.idx===null){Object.assign(s,{idx:now.idx,correct:now.correct,wrong:now.wrong});continue;}
      const steps=now.idx-s.idx;
      if(steps>0){
        const wrong=Math.min(steps,Math.max(0,now.wrong-s.wrong));
        for(let i=s.idx;i<now.idx;i++){
          const text=s.words.get(i);
          const ok=i<now.idx-wrong;
          if(text&&ok)s.list.push(text);
        }
        if(s.list.length>KEEP)s.list.splice(0,s.list.length-KEEP);
      }
      Object.assign(s,{idx:now.idx,correct:now.correct,wrong:now.wrong});
    }
    return read();
  }
  const read=()=>({1:[...(seats[1]?.list||[])],2:[...(seats[2]?.list||[])]});
  return {update,read,reset(){key=null;seats={};}};
}

/** Üst-orta sayaç/etiket (classic için; rounds/arena madalyonu kendi saatini çizer). */
export function matchClockModel(match,serverNow){
  if(!isLive(match))return {visible:false};
  const ref=match.status==='paused'&&Number.isFinite(match.pausedAt)?match.pausedAt:serverNow;
  const end=Number(match.endsAt);
  const seconds=Number.isFinite(end)?Math.max(0,Math.ceil((end-ref)/1000)):0;
  if(match.mode==='arena'){
    return {visible:true,mode:'arena',seconds,label:`RAUND ${Number(match.round?.index)||1} / ${Number(match.round?.total)||6}`};
  }
  if(match.mode==='rounds'&&match.round){
    const total=Number(match.round.total??match.totalRounds)||5;
    const index=Number(match.round.index)||1;
    return {visible:true,mode:'rounds',seconds,label:index>total?'ANİ ÖLÜM':`RAUND ${index} / ${total}`};
  }
  return {visible:true,mode:'classic',seconds,label:'KLASİK DÜELLO'};
}

/** Donmuş An (❄ +3 sn) kullanan koltuklar — yalnız sunum; rounds: round.skills, arena: yalnız kendi seçimim. */
export function freezeSeats(match,myId){
  if(match?.round?.phase!=='round')return [];
  const out=[];
  if(match.mode==='rounds'){for(const seat of [1,2])if(match.round.skills?.[seat]==='freeze')out.push(seat);}
  else if(match.mode==='arena'&&match.me?.picks?.skill==='freeze'){
    const mine=(match.players||[]).find(p=>p&&p.playerId===myId);if(mine)out.push(mine.seat);
  }
  return out;
}

/** Şerit satırının içeriği: isim/rozet + son kelimeler + (yalnız yerel oyuncu) o an yazılan metin. */
export function stripModel(match,myId,seat,words,typed=''){
  const p=seatOf(match,seat);
  const mine=Boolean(p&&myId!=null&&p.playerId===myId);
  return {seat,mine,name:String(p?.name||`Oyuncu ${seat}`),words:[...words],typed:mine?String(typed||''):''};
}

export function ensureMatchInfoStyles(doc=globalThis.document){
  if(!doc?.head||doc.querySelector('link[href*="match-info.css"]'))return;
  const link=doc.createElement('link');link.rel='stylesheet';link.href=new URL('./match-info.css',import.meta.url).href;link.dataset.matchInfoCss='';
  doc.head.appendChild(link);
}

export function createMatchInfo(root,{doc=globalThis.document,now=()=>Date.now(),getTyped=()=>'',timers=globalThis}={}){
  ensureMatchInfoStyles(doc);
  const tracker=createTypedTracker();
  const el=doc.createElement('div');el.className='mi';el.hidden=true;el.setAttribute('data-match-info','');
  const strips=[1,2].map(seat=>{
    const node=doc.createElement('div');node.className=`mi-strip mi-strip-${seat}`;node.setAttribute('data-typed-strip',String(seat));
    node.setAttribute('aria-label',seat===1?'Oyuncu 1 yazdığı kelimeler':'Oyuncu 2 yazdığı kelimeler');
    const who=doc.createElement('span');who.className='mi-who';
    const badge=doc.createElement('b');badge.className='mi-sen';badge.setAttribute('data-sen-badge','');badge.textContent='SEN';badge.hidden=true;
    const name=doc.createElement('span');name.className='mi-name';
    who.append(badge,name);
    const words=doc.createElement('span');words.className='mi-words';
    const live=doc.createElement('span');live.className='mi-live';
    node.append(who,words,live);
    return {seat,node,badge,name,words,live,lastKey:''};
  });
  const clock=doc.createElement('div');clock.className='mi-clock';clock.hidden=true;
  const clockSecs=doc.createElement('strong');clockSecs.className='mi-clock-secs';
  const clockUnit=doc.createElement('small');clockUnit.textContent='sn';
  clock.setAttribute('data-round-clock','');clock.append(clockSecs,clockUnit);
  const label=doc.createElement('div');label.className='mi-label';label.hidden=true;label.setAttribute('data-round-label','');
  const bonus=doc.createElement('div');bonus.className='mi-bonus';bonus.hidden=true;bonus.setAttribute('data-freeze-bonus','');bonus.textContent='❄ +3 sn';
  el.append(...strips.map(s=>s.node),clock,label,bonus);
  root.append(el);
  let match=null,myId=null,interval=null,destroyed=false;
  const setText=(node,text)=>{if(node.textContent!==text)node.textContent=text;};
  const setHidden=(node,hidden)=>{if(node.hidden!==hidden)node.hidden=hidden;};
  const setStyle=(node,prop,value)=>{if(node.style[prop]!==value)node.style[prop]=value;};

  /** rounds/arena madalyonundaki mevcut süre ve raund öğelerine tutamaç ekler. */
  function tagMedal(){
    const pairs=match?.mode==='arena'?['.aui-clockface','.aui-title']:['.rui-clock','.rui-title'];
    const c=root.querySelector(pairs[0]),t=root.querySelector(pairs[1]);
    for(const [node,attr] of [[c,'data-round-clock'],[t,'data-round-label']])if(node&&!node.hasAttribute(attr))node.setAttribute(attr,'');
  }
  function render(){
    if(destroyed)return;
    const live=isLive(match);
    const narrow=(root.clientWidth||globalThis.innerWidth||1366)<520;
    const typed=tracker.read();
    let anyShown=false;
    const frozen=live?freezeSeats(match,myId):[];
    for(const s of strips){
      const health=root.querySelector(`.pvp2-side[data-seat="${s.seat}"] .pvp2-health`);
      const rect=health?.getBoundingClientRect();
      const show=Boolean(live&&rect&&rect.width>40&&rect.height>4);
      setHidden(s.node,!show);
      if(!show)continue;
      anyShown=true;
      setStyle(s.node,'left',`${Math.round(rect.left)}px`);
      setStyle(s.node,'top',`${Math.round(rect.bottom+4)}px`);
      setStyle(s.node,'width',`${Math.round(rect.width)}px`);
      const m=stripModel(match,myId,s.seat,typed[s.seat],getTyped(s.seat));
      setHidden(s.badge,!m.mine);setText(s.name,m.name);
      s.node.classList.toggle('is-me',m.mine);
      s.node.classList.toggle('is-freeze',frozen.includes(s.seat));
      const shownWords=m.words.slice(-(narrow?STRIP_WORDS_NARROW:STRIP_WORDS));
      const key=shownWords.join('\u0001');
      if(key!==s.lastKey){
        s.lastKey=key;s.words.replaceChildren(...shownWords.map((w,i)=>{
          const n=doc.createElement('span');n.className=`mi-w${i===shownWords.length-1?' is-new':''}`;n.textContent=w;return n;}));
      }
      setText(s.live,m.mine&&m.typed?m.typed:'');
      setHidden(s.live,!(m.mine&&m.typed));
    }
    // Süre/raund: classic'te kendi sayacımız; rounds/arena'da madalyon tutamaçlanır.
    const model=matchClockModel(match,now());
    const own=model.visible&&model.mode==='classic'&&anyShown;
    setHidden(clock,!own);setHidden(label,!own);
    if(own){
      setText(clockSecs,String(model.seconds));setText(label,model.label);
      clock.classList.toggle('is-urgent',model.seconds<=10);
      const health=root.querySelector('.pvp2-side .pvp2-health');const r=health?.getBoundingClientRect();
      // Dar düzende iki bar alt alta: sayaç ikinci şeridin altına iner; geniş düzende barların hizasında, üst-ortada.
      const top=narrow?Math.max(...strips.map(s=>s.node.getBoundingClientRect().bottom))+6:r?.top;
      if(Number.isFinite(top)){setStyle(clock,'top',`${Math.round(top)}px`);setStyle(label,'top',`${Math.round(top+46)}px`);}
    }
    if(model.visible&&model.mode!=='classic')tagMedal();
    // Donmuş An: sayacın yanında "+3 sn" vurgusu (yalnız sunum).
    const cEl=own?clock:root.querySelector('[data-round-clock]:not(.mi-clock)');
    const cr=frozen.length&&anyShown&&cEl?cEl.getBoundingClientRect():null;
    setHidden(bonus,!(cr&&cr.width>1));
    if(cr&&cr.width>1){setStyle(bonus,'left',`${Math.round(cr.right+6)}px`);setStyle(bonus,'top',`${Math.round(cr.top+cr.height/2-12)}px`);}
    setHidden(el,!(live&&anyShown));
  }
  function ensureTicker(on){
    if(on&&interval===null)interval=timers.setInterval(()=>{if(!doc.hidden)render();},250);
    if(!on&&interval!==null){timers.clearInterval(interval);interval=null;}
  }
  return {
    update(nextMatch,nextMyId){
      if(destroyed)return;
      match=nextMatch||null;myId=nextMyId??null;
      if(match)tracker.update(match);else tracker.reset();
      ensureTicker(isLive(match));
      render();
    },
    tick:render,
    tracker,
    destroy(){destroyed=true;ensureTicker(false);el.remove();}
  };
}
