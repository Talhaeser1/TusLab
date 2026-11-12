// Üst yazma paneli için saf görünüm modeli (Ajan F, 2. dalga). DOM yok; Node testleriyle doğrulanır.
const live=m=>Boolean(m&&['running','paused'].includes(m.status));
const hasRound=m=>Boolean(m&&m.round&&typeof m.round==='object');

const CONTENT_TITLES=Object.freeze({atasozu:'ATASÖZÜ',siir:'ŞİİR',osmanlica:'OSMANLICA'});

/** İçerik modunda (şiir: şair adı · Osmanlıca: anlam) yazılan kelimenin ipucu; yoksa ''. */
export function ttHint(match,me){
  if(!live(match)||!me||match.mode!=='rounds'||!hasRound(match)||match.round.phase!=='round'||me.roundDone)return '';
  const hints=match.round.hints;
  return Array.isArray(hints)?String(hints[Number(me.roundWordIndex)||0]||''):'';
}

/** Mod/faz etiketi: CANLI MAÇ · ZAMANA KARŞI · RAUND n/t · ARENA · RAUND n/t · YEREL YAZMA TESTİ. */
export function ttModeLabel(match){
  if(!live(match))return 'YEREL YAZMA TESTİ';
  const r=match.round;
  if(match.mode==='rounds'&&hasRound(match)){
    // KESINYAP 11: 'ZAMANA KARŞI · RAUND 2/7' ya da 'KELİME RAUNDU · RAUND 2/7 · 7 kelime'; içerik modunda ad içerik adıdır.
    const counted=r.style==='counted';
    const name=CONTENT_TITLES[match.content]||(counted?'KELİME RAUNDU':'ZAMANA KARŞI');
    const words=counted?Number(r.wordCount)||(Array.isArray(r.words)?r.words.length:0):0;
    const tail=words?` · ${words} kelime`:'';
    if(r.suddenDeath)return `${name} · ALTIN RAUND${tail}`;
    return `${name} · RAUND ${r.index}${r.total?`/${r.total}`:''}${tail}`;
  }
  if(match.mode==='arena'&&hasRound(match))return `ARENA · RAUND ${r.index}${r.total?`/${r.total}`:''}`;
  return 'CANLI MAÇ';
}

/** Sıradaki en çok `count` kelime. Klasikte cümle içindeki yer belirsizse (tekrarlı kelime) boş döner. */
export function ttUpcoming(match,me,count=3){
  if(!live(match)||!me)return [];
  if((match.mode==='rounds'||match.mode==='arena')&&hasRound(match)){
    if(match.round.phase!=='round'||me.roundDone)return [];
    const words=Array.isArray(match.round.words)?match.round.words:[];
    const i=Number(me.roundWordIndex)||0;
    return words.slice(i+1,i+1+count).map(String);
  }
  const words=String(me.activeText||'').split(/\s+/).filter(Boolean);
  const cur=String(me.currentWord||'');
  const at=words.indexOf(cur);
  if(at<0||words.lastIndexOf(cur)!==at)return [];
  return words.slice(at+1,at+1+count);
}

/** Değiş tokuş penceresi (klasik, Ajan A): publicMatch.exchange={index,endsAt,phase}; yoksa null. */
export function ttExchange(match,now,windowMs=10000){
  const x=match?.exchange;
  if(!live(match)||!x||typeof x!=='object')return null;
  const index=Number(x.index)||1;
  if(x.phase==='resolve')return {index,phase:'resolve',secs:0,frac:0,text:`Pencere ${index} · hamleler oynatılıyor`};
  const left=Math.max(0,(Number(x.endsAt)||0)-now);
  const secs=Math.ceil(left/1000);
  return {index,phase:'typing',secs,frac:Math.min(1,left/windowMs),text:`Pencere ${index} · ${secs} sn`};
}

/** Girişin altındaki tek yardım satırı: kilit > çözüm > bekleme > Harf Kaosu > ipucu. */
export function ttNotice({live:isLive,own,disabled,pending,scrambled,exchange,status}={}){
  const text=String(status||'');
  if(!isLive)return {kind:'hint',text};
  if(own&&exchange?.phase==='resolve')return {kind:'lock',text:'Hamleler sırayla oynatılıyor · sıradaki pencere birazdan açılır'};
  if(own&&pending)return {kind:'wait',text};
  if(disabled)return {kind:'lock',text};
  if(scrambled)return {kind:'chaos',text:'Harf Kaosu: harfler karışık · kelimeyi ekranda göründüğü gibi yaz, Space ile gönder'};
  return {kind:'hint',text};
}

/**
 * Paket 33: saf animasyon durumu; DOM veya zamanlayıcı oluşturmaz.
 * Tüm zamanlar aynı saatten (ms) gelir. Renderer son giriş/yanıt zamanını saklar,
 * letterClass'ı letterIndex'teki harfe, wordClass/comboClass'ı kelimeye,
 * clockClass'ı sayaca uygular; süre dolunca yeniden hesaplayıp sınıfı kaldırır.
 * Doğru yanıtta wordClass gönderilen eski kelimeye uygulanır (yenisine değil).
 */
export function ttAnimationState({typed='',previousTyped='',lastInputAt=null,
  correct=null,submittedAt=null,combo=0,secondsLeft=null,now=0,reduced=false}={}){
  const recent=(at,duration)=>Number.isFinite(at)&&Number.isFinite(now)&&now>=at&&now-at<duration;
  const text=String(typed).normalize('NFC'),before=String(previousTyped).normalize('NFC');
  const added=text.length>before.length&&text.startsWith(before);
  const letterHit=added&&recent(lastInputAt,120);
  const outcome=correct===true?'hit':correct===false?'miss':null;
  const wordActive=outcome&&recent(submittedAt,correct?180:260);
  const count=Number(combo);
  const comboLevel=Number.isFinite(count)?Math.max(0,Math.min(4,Math.floor(count/2))):0;
  const urgent=Number.isFinite(secondsLeft)&&secondsLeft>0&&secondsLeft<=5;
  return {
    letterIndex:!reduced&&letterHit?[...text].length-1:-1,
    letterClass:!reduced&&letterHit?'tt-letter-hit':'',
    wordClass:!reduced&&wordActive?(correct?'tt-word-pop':'tt-word-miss'):'',
    comboClass:!reduced&&comboLevel?`tt-combo-${comboLevel}`:'',
    clockClass:!reduced&&urgent?'tt-clock-urgent':'',
    outcome,comboLevel,urgent,
  };
}
