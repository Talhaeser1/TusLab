/* TuşLab — içerik modları (atasözü · şiir · Osmanlıca). Saf ES modülü; sunucu ve tarayıcı aynı sonucu üretir.
 *
 *   kelime     varsayılan: kelime bankasından rastgele (eski davranış, bu modül devreye girmez)
 *   atasozu    atasözleri SIRAYLA, kelime kelime ilerler
 *   siir       eski şiir dizeleri SIRAYLA; her kelimenin ipucu şair adıdır
 *   osmanlica  Osmanlıca kelime; ipucu günümüz karşılığıdır, yazılan yalnız kelimedir; raund ilerledikçe uzun/zor
 *
 * Sıralı içerikte raund, bir önceki raundun bittiği yerden devam eder (başlangıç indeksi motor durumundan gelir).
 */
import {ATASOZLERI} from './content-atasozu.js';
import {SIIR_DIZELERI} from './content-siir.js';
import {OSMANLICA} from './content-osmanlica.js';
import {createRng} from './words.js';

export const DEFAULT_CONTENT = 'kelime';
/** Rastgele (karışık): her raundun içeriği maç tohumundan seçilir (kelime · atasözü · şiir · Osmanlıca); iki oyuncu aynısını görür. */
export const RANDOM_CONTENT = 'rastgele';
export const CONTENT_MODES = Object.freeze(['atasozu', 'siir', 'osmanlica', RANDOM_CONTENT]);
export const CONTENT_IDS = Object.freeze([DEFAULT_CONTENT, ...CONTENT_MODES]);
export const CONTENT_LABELS = Object.freeze({kelime: 'Kelime', atasozu: 'Atasözü', siir: 'Şiir', osmanlica: 'Osmanlıca', rastgele: 'Rastgele'});
export const isContentId = v => CONTENT_IDS.includes(v);
export const isContentMode = v => CONTENT_MODES.includes(v);
export const normalizeContent = v => (isContentMode(v) ? v : DEFAULT_CONTENT);
/** Rastgele karışımın raund raund içerik sırası (tohumlu): her 4'lük blokta dört içeriğin hepsi bir kez, art arda aynısı yok.
 *  Sunucu ve bot motoru aynı tohumdan aynı sırayı üretir. */
export const MIX_CONTENTS = Object.freeze([DEFAULT_CONTENT, 'atasozu', 'siir', 'osmanlica']);
export function contentMixPlan(seed, rounds) {
  const rng = createRng(`${seed}:mix`), plan = [];
  while (plan.length < rounds) {
    const block = [...MIX_CONTENTS];
    for (let i = block.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [block[i], block[j]] = [block[j], block[i]]; }
    if (plan.length && block[0] === plan.at(-1)) [block[0], block[1]] = [block[1], block[0]];
    plan.push(...block);
  }
  return plan.slice(0, rounds);
}

const tokens = list => list.split(/\s+/u).filter(Boolean);
// Akışlar tembel kurulur (yalnız içerik modunda).
let streams = null;
function stream(content) { // öğe = bir atasözü / bir şiir dizesi
  streams ??= {
    atasozu: {list: ATASOZLERI, text: s => s, hint: () => ''},
    siir: {list: SIIR_DIZELERI, text: d => d.metin, hint: d => (d.baslik ? `${d.sair} · ${d.baslik}` : d.sair)}
  };
  return streams[content] || null;
}

// Bir "tur" (epoch): öğelerin tohumdan karıştırılmış sırası, kelime kelime düzleştirilmiş. Her öğe kendi içinde SIRALI.
const epochCache = new Map();
function epochAt(content, seed, epoch) {
  const key = `${content}|${seed}|${epoch}`;
  const hit = epochCache.get(key);
  if (hit) return hit;
  const def = stream(content), n = def.list.length;
  const order = Array.from({length: n}, (_, i) => i);
  const rng = createRng(`${seed}:${content}:e${epoch}`);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  // Havuz tükenip yeniden karıştırılınca son kullanılanla başlama.
  if (epoch > 0 && n > 1 && order[0] === epochAt(content, seed, epoch - 1).last) [order[0], order[1]] = [order[1], order[0]];
  const words = [], hints = [];
  for (const i of order) { const it = def.list[i], h = def.hint(it); for (const w of tokens(def.text(it))) { words.push(w); hints.push(h); } }
  const built = {words, hints, last: order[n - 1]};
  if (epochCache.size > 24) epochCache.clear();
  epochCache.set(key, built);
  return built;
}

/** Sıralı içerikten `count` kelime. `start`, tohumla karıştırılmış akıştaki konumdur; tur bitince yeni karışım gelir. */
function sequential(content, start, count, seed) {
  const sd = String(seed ?? ''), words = [], hints = [];
  let pos = Math.max(0, Math.trunc(start) || 0);
  for (let i = 0; i < count; i++, pos++) {
    let e = 0, ep = epochAt(content, sd, 0);
    while (pos >= ep.words.length * (e + 1)) { e++; ep = epochAt(content, sd, e); }
    const off = pos - ep.words.length * e;
    words.push(ep.words[off]); hints.push(ep.hints[off]);
  }
  return {words, hints};
}

let sortedOsmanlica = null;
const osmanlicaPool = () => (sortedOsmanlica ??= [...OSMANLICA].map((e, i) => [e, i]).sort((a, b) => a[0].kelime.length - b[0].kelime.length || a[1] - b[1]).map(x => x[0]));

// 1. raund havuzun ortasından başlar (kolay dilim yok), son raund en uzun dilimdir.
export const OSMANLICA_START = 0.5;

/** Osmanlıca: raund ilerledikçe havuzun daha uzun/zor dilimi; dilim içinden tohumlu, tekrarsız seçim. */
function osmanlica({seed, round, total, count, exclude, salt}) {
  const pool = osmanlicaPool(), n = pool.length;
  const band = Math.min(n, Math.max(count * 4, 48));
  const progress = Math.min(1, Math.max(0, (round - 1) / Math.max(1, total - 1)));
  const lo = Math.round((n - band) * (OSMANLICA_START + (1 - OSMANLICA_START) * progress));
  const banned = new Set(exclude || []);
  const slice = pool.slice(lo, lo + band).filter(e => !banned.has(e.kelime));
  const rng = createRng(`${seed}:osm:${round}${salt ? ':' + salt : ''}`);
  for (let i = slice.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [slice[i], slice[j]] = [slice[j], slice[i]]; }
  let chosen = slice.slice(0, count);
  if (chosen.length < count) { // dilim tükendi: dilime en yakın (önce daha uzun) kullanılmamış kelimelerle tamamla
    const have = new Set(chosen.map(e => e.kelime)), mid = lo + band / 2;
    const near = pool.map((e, i) => [e, i]).filter(([e]) => !have.has(e.kelime) && !banned.has(e.kelime))
      .sort((a, b) => Math.abs(a[1] - mid) - Math.abs(b[1] - mid) || b[1] - a[1]).map(x => x[0]);
    chosen = chosen.concat(near.slice(0, count - chosen.length));
  }
  if (!chosen.length) chosen = pool.slice(lo, lo + count);
  return {words: chosen.map(e => e.kelime), hints: chosen.map(e => `Anlamı: ${e.anlam}`)};
}

/**
 * Bir raund (ya da timed uzatma) için içerik: {words, hints}. Kelimeler boşluksuzdur.
 * @param {'atasozu'|'siir'|'osmanlica'} content
 * @param {{start?:number, seed?:string|number, round:number, total:number, count:number, exclude?:string[]}} o
 */
export function contentWords(content, o) {
  if (content === 'osmanlica') return osmanlica(o);
  if (stream(content)) return sequential(content, o.start || 0, o.count, o.seed);
  throw new RangeError(`Unknown content: ${content}`);
}

/** Her kelimeyi yazılacak hâliyle ve ipucuyla (testler/arayüz için). */
export const contentStreamLength = content => stream(content) ? epochAt(content, '', 0).words.length : OSMANLICA.length;
