/** Paket 33 — Klasik maçta pencere kapanırken (çözüm / saldırı sırası evresi) basılan boşluğun kaybolmaması.
 *
 * Hata: pencere sunucuda kapanınca (exchange.phase='resolve') motor kelimeyi EXCHANGE_NOT_ACTIVE ile reddeder;
 * istemci yazılan kelimeyi kutuda bırakıyordu ("kelime"), çözümden sonra yazılan kelime buna eklenip
 * ("kelimesonraki") yanlış sayılıyordu. Kural: boşluk HER ZAMAN kelimeyi kutudan alır. Pencere kapalıysa kelime
 * sıraya konur ve sıradaki pencere açılır açılmaz (aynı kelime sırası numarasıyla) gönderilir.
 * Saf modül: DOM yok; pvp/index.js bağlar.
 */
/** Bu kodlarla reddedilen kelime sıradaki pencerede yeniden gönderilir (kelime sırası değişmez). */
export const QUEUE_CODES=new Set(['EXCHANGE_NOT_ACTIVE']);

/** Klasik pencere kapısı: yazma penceresi açık mı? (Tur/Arena modlarının kendi kilitleri vardır.) */
export function exchangeGate(match,serverNow){
  const x=match?.exchange;
  if(!x||match.status!=='running')return 'open';
  if(x.phase!=='typing')return 'closed';
  return Number.isFinite(x.endsAt)&&serverNow>=x.endsAt?'closed':'open';
}

/** Girişte boşluk/yeni satır görülünce ne yapılacağı. typed: kutunun ham değeri. */
export function wordCommit({typed,gate}){
  const text=String(typed??'');
  if(!/\s/u.test(text))return {action:'type',word:'',typed:text};
  const word=text.split(/\s/u)[0];
  if(!word)return {action:'none',word:'',typed:''};
  if(gate==='closed')return {action:'queue',word,typed:''};
  return {action:'submit',word,typed:word};
}

/** Sunucu kelimeyi reddetti: kutu her durumda boşalır (birleşme olmaz); pencere kapandığı için reddedildiyse sıraya girer. */
export function afterReject({code,word}){
  const w=String(word??'');
  return {queued:QUEUE_CODES.has(code)&&w?w:null,typed:''};
}

/** Sıradaki kelime şimdi gönderilebilir mi? */
export function queuedReady({queued,pending,match,now,own}){
  return Boolean(queued)&&!pending&&Boolean(own)&&match?.status==='running'&&Boolean(match.exchange)&&exchangeGate(match,now)==='open';
}
