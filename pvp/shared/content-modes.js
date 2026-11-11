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
export const CONTENT_MODES = Object.freeze(['atasozu', 'siir', 'osmanlica']);
export const CONTENT_IDS = Object.freeze([DEFAULT_CONTENT, ...CONTENT_MODES]);
export const CONTENT_LABELS = Object.freeze({kelime: 'Kelime', atasozu: 'Atasözü', siir: 'Şiir', osmanlica: 'Osmanlıca'});
export const isContentId = v => CONTENT_IDS.includes(v);
export const isContentMode = v => CONTENT_MODES.includes(v);
export const normalizeContent = v => (isContentMode(v) ? v : DEFAULT_CONTENT);

const tokens = list => list.split(/\s+/u).filter(Boolean);
const build = (items, text, hint) => {
  const words = [], hints = [];
  for (const item of items) for (const w of tokens(text(item))) { words.push(w); hints.push(hint(item)); }
  return {words: Object.freeze(words), hints: Object.freeze(hints)};
};
// Akışlar tembel kurulur (yalnız içerik modunda).
let streams = null;
function stream(content) {
  streams ??= {
    atasozu: build(ATASOZLERI, s => s, () => ''),
    siir: build(SIIR_DIZELERI, d => d.metin, d => (d.baslik ? `${d.sair} · ${d.baslik}` : d.sair))
  };
  return streams[content] || null;
}

/** Sıralı içerikten `count` kelime (start'tan, sona gelince başa sarar). */
function sequential(content, start, count) {
  const s = stream(content), n = s.words.length, words = [], hints = [];
  const from = ((Math.trunc(start) || 0) % n + n) % n;
  for (let i = 0; i < count; i++) { words.push(s.words[(from + i) % n]); hints.push(s.hints[(from + i) % n]); }
  return {words, hints};
}

let sortedOsmanlica = null;
const osmanlicaPool = () => (sortedOsmanlica ??= [...OSMANLICA].map((e, i) => [e, i]).sort((a, b) => a[0].kelime.length - b[0].kelime.length || a[1] - b[1]).map(x => x[0]));

/** Osmanlıca: raund ilerledikçe havuzun daha uzun/zor dilimi; dilim içinden tohumlu, tekrarsız seçim. */
function osmanlica({seed, round, total, count, exclude}) {
  const pool = osmanlicaPool(), n = pool.length;
  const band = Math.min(n, Math.max(count * 4, 48));
  const progress = Math.min(1, Math.max(0, (round - 1) / Math.max(1, total - 1)));
  const lo = Math.round((n - band) * progress);
  const banned = new Set(exclude || []);
  const slice = pool.slice(lo, lo + band).filter(e => !banned.has(e.kelime));
  const rng = createRng(`${seed}:osm:${round}`);
  for (let i = slice.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [slice[i], slice[j]] = [slice[j], slice[i]]; }
  let chosen = slice.slice(0, count);
  if (chosen.length < count) { // dilim tükendi: tüm havuzdan tamamla
    const have = new Set(chosen.map(e => e.kelime));
    chosen = chosen.concat(pool.filter(e => !have.has(e.kelime) && !banned.has(e.kelime)).slice(0, count - chosen.length));
  }
  if (!chosen.length) chosen = pool.slice(0, count);
  return {words: chosen.map(e => e.kelime), hints: chosen.map(e => `Anlamı: ${e.anlam}`)};
}

/**
 * Bir raund (ya da timed uzatma) için içerik: {words, hints}. Kelimeler boşluksuzdur.
 * @param {'atasozu'|'siir'|'osmanlica'} content
 * @param {{start?:number, seed?:string|number, round:number, total:number, count:number, exclude?:string[]}} o
 */
export function contentWords(content, o) {
  if (content === 'osmanlica') return osmanlica(o);
  if (stream(content)) return sequential(content, o.start || 0, o.count);
  throw new RangeError(`Unknown content: ${content}`);
}

/** Her kelimeyi yazılacak hâliyle ve ipucuyla (testler/arayüz için). */
export const contentStreamLength = content => stream(content)?.words.length ?? OSMANLICA.length;
