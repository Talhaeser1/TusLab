// Üst yazma paneli için saf görünüm modeli (Ajan F, 2. dalga). DOM yok; Node testleriyle doğrulanır.
const live=m=>Boolean(m&&['running','paused'].includes(m.status));
const hasRound=m=>Boolean(m&&m.round&&typeof m.round==='object');

/** Mod/faz etiketi: CANLI MAÇ · ZAMANA KARŞI · RAUND n/t · ARENA · RAUND n/t · YEREL YAZMA TESTİ. */
export function ttModeLabel(match){
  if(!live(match))return 'YEREL YAZMA TESTİ';
  const r=match.round;
  if(match.mode==='rounds'&&hasRound(match)){
    if(r.suddenDeath)return 'ZAMANA KARŞI · ALTIN RAUND';
    return `ZAMANA KARŞI · RAUND ${r.index}${r.total?`/${r.total}`:''}`;
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
