/** Paket 33 — TuşLab Ruh Düellosu sahne (arena) kadrosu: paylaşılan sözleşme.
 * Saf ES modülü: Cloudflare Durable Object, yerel bot motoru ve tarayıcı aynı dosyayı kullanır.
 * Sahne yalnız görsel/atmosferdir; hasar/denge kurallarını DEĞİŞTİRMEZ.
 * `palette` renkleri '#rrggbb' biçimindedir: sky (gök/arka plan), fog (sis), floor (zemin), accent (vurgu ışığı), rim (kenar ışığı).
 * `music` sahnenin müzik/ambiyans anahtarıdır (sahne adı). Tüm sahneler özgün TuşLab tasarımıdır.
 */
const freezeDeep=o=>{for(const v of Object.values(o))if(v&&typeof v==='object')freezeDeep(v);return Object.freeze(o);};

export const DEFAULT_STAGE='colosseum';
/** Oda ayarında "sunucu maç başında seçsin" anlamına gelen özel kimlik (bir sahne DEĞİLDİR). */
export const RANDOM_STAGE='random';

export const STAGES=freezeDeep([
 {id:'colosseum',name:'Neon Kolezyum',blurb:'Neon halkalarla çevrili klasik düello meydanı.',
  palette:{sky:'#0b1020',fog:'#141a33',floor:'#1b2140',accent:'#ff4fd8',rim:'#4fd8ff'},music:'Neon Kolezyum'},
 {id:'skyforge',name:'Gök Demirhanesi',blurb:'Bulutların üstünde yüzen ada; lav dökümhanesi kor saçar.',
  palette:{sky:'#1a0d0a',fog:'#3a1a10',floor:'#2a1712',accent:'#ff7a1a',rim:'#ffc163'},music:'Gök Demirhanesi'},
 {id:'runegarden',name:'Rün Bahçesi',blurb:'Gece bahçesi; parlayan rün taşları ve ağaç siluetleri.',
  palette:{sky:'#070b1c',fog:'#151238',floor:'#101a2a',accent:'#35e0d0',rim:'#a070ff'},music:'Rün Bahçesi'},
 {id:'harbor',name:'Fırtına Limanı',blurb:'Yağmurlu gece limanı; şimşekler iskeleyi aydınlatır.',
  palette:{sky:'#060d18',fog:'#12233a',floor:'#0e1a28',accent:'#6fb6ff',rim:'#e8f4ff'},music:'Fırtına Limanı'}
]);

export const STAGE_IDS=Object.freeze(STAGES.map(s=>s.id));
const BY_ID=Object.freeze(Object.fromEntries(STAGES.map(s=>[s.id,s])));

/** Geçersiz/bilinmeyen her değer için DEFAULT_STAGE döner ('random' dahil — rastgeleyi pickStage çözer). */
export function normalizeStage(id){return typeof id==='string'&&Object.prototype.hasOwnProperty.call(BY_ID,id)?id:DEFAULT_STAGE;}
/** Sahne kaydı (her zaman geçerli bir kayıt döner). */
export function getStage(id){return BY_ID[normalizeStage(id)];}
/** Oda ayarı için: geçerli sahne kimliği ya da 'random'; aksi halde DEFAULT_STAGE. */
export function normalizeStageChoice(id){return id===RANDOM_STAGE?RANDOM_STAGE:normalizeStage(id);}
/** Kablo doğrulaması (MATCH_CONFIG {stage}): yalnız bilinen sahne kimliği ya da 'random' string'i kabul edilir. */
export function isStageChoicePayload(id){return typeof id==='string'&&(id===RANDOM_STAGE||Object.prototype.hasOwnProperty.call(BY_ID,id));}
/** Oda ayarını somut sahneye çevirir. 'random' → random() ile (0..1) eşit olasılıkla bir sahne. */
export function pickStage(choice,random=Math.random){
 if(choice!==RANDOM_STAGE)return normalizeStage(choice);
 const r=Number(random());const i=Math.min(STAGE_IDS.length-1,Math.max(0,Math.floor((Number.isFinite(r)?r:0)*STAGE_IDS.length)));
 return STAGE_IDS[i];
}
