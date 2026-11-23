// Ana ekran yazma alanı ve "Şiir & Atasözü" bölümü için metin akışı.
// Akış: bir kategorinin öğeleri karışık sırayla, önce zor olanlar, tekrar etmeden art arda gelir.
// Havuz bitince yeniden karıştırılır. Zincir atasözlerinin parçaları da aynı turda ikinci kez gelmez.
import * as T from './data/texts.js';
// Kelime havuzu (data/words.js, ~104 KB) yalnız "Kelime" kipi için gerekir: açılışta inmez, ilk istendiğinde yüklenir.
// Kelime kipine geçmeden önce loadWords() beklenir; wordsReady() hazır mı söyler (home.js bunu yapar).
let WORDS = [];
let wordsP = null;
export function loadWords() {
  if (!wordsP) {
    wordsP = import('./data/words.js').then((m) => { WORDS = Array.isArray(m.WORDS) ? m.WORDS : []; return WORDS; });
    wordsP.catch(() => { wordsP = null; });
  }
  return wordsP;
}
export const wordsReady = () => WORDS.length > 0;

export const MODES = [
  { id: 'atasozu', label: 'Atasözü', icon: '🧿', hint: 'Zor atasözleri, art arda' },
  { id: 'siir', label: 'Şiir', icon: '🪶', hint: 'Ustaların dizeleri' },
  { id: 'deyim', label: 'Deyim', icon: '💬', hint: 'Deyimler ve anlamları' },
  { id: 'tekerleme', label: 'Tekerleme', icon: '🌀', hint: 'Dil döndüren cümleler' },
  { id: 'ozdeyis', label: 'Özdeyiş', icon: '✨', hint: 'Ünlü sözler' },
  { id: 'kelime', label: 'Kelime', icon: '🔤', hint: 'Geniş havuzdan rastgele kelimeler' },
];

// Kesintisiz akış kipindeki modlar (kelime modu tek metin olarak kalır).
export const STREAM_MODES = ['atasozu', 'deyim', 'tekerleme', 'ozdeyis', 'siir'];
export const isStreamMode = (mode) => STREAM_MODES.includes(mode);

const clean = (s) => String(s ?? '').replace(/\s*\/\s*$/, '').replace(/\s+/g, ' ').trim();
const endDot = (s) => (/[.!?…]$/.test(s) ? s : s + '.');
const low = (s) => String(s).toLocaleLowerCase('tr').replace(/[.!?…]+$/, '').trim();

// Zorluk puanı: uzunluk + noktalama + Türkçe özel harf + büyük harf/kesme.
export function difficulty(text) {
  const t = String(text || '');
  const punct = (t.match(/[,;:!?'"()-]/g) || []).length;
  const special = (t.match(/[çğıöşüÇĞİÖŞÜ]/g) || []).length;
  const caps = (t.match(/[A-ZÇĞİÖŞÜ]/g) || []).length;
  return t.length + punct * 4 + special * 2 + Math.max(0, caps - 1) * 2;
}

// Şiir dizelerini tek satıra çevirir: noktalamasız dize sonlarına virgül, en sona nokta.
function joinLines(lines) {
  const ls = lines.map(clean).filter(Boolean);
  return endDot(ls.map((l, i) => (i < ls.length - 1 && !/[.,;:!?…]$/.test(l) ? l + ',' : l)).join(' '));
}

// Bir kategorinin bütün öğeleri: { id, mode, text, source, level, score, parts }
export function itemsFor(mode) {
  let items = [];
  switch (mode) {
    case 'atasozu':
      items = (T.PROVERBS || []).filter((x) => x && x.text).map((x) => {
        const text = endDot(clean(x.text));
        const single = !text.includes(';') || text === 'Dost ile ye, iç; alışveriş etme.';
        return { id: 'a:' + low(text), mode, text, source: 'Atasözü' + (Number(x.level) >= 4 ? ' zinciri' : ''), level: Number(x.level) || 1,
          parts: single ? ['a:' + low(text)] : text.split(';').map((p) => 'a:' + low(p)) };
      });
      break;
    case 'siir':
      items = (T.POEMS || []).filter((p) => p && Array.isArray(p.lines) && p.lines.some((l) => clean(l))).map((p) => ({
        id: 'p:' + (p.id || p.title), mode, text: joinLines(p.lines), source: [p.author, p.title].filter(Boolean).join(' — '),
      }));
      break;
    case 'deyim':
      items = (T.IDIOMS || []).filter((x) => x && x.text).map((x) => {
        let m = clean(x.meaning).replace(/\.$/, '');
        if (m) m = m.charAt(0).toLocaleLowerCase('tr') + m.slice(1); // iki noktadan sonra küçük harf
        return { id: 'd:' + low(x.text), mode, text: endDot(m ? `${clean(x.text)}: ${m}` : clean(x.text)), source: m ? 'Deyim — anlamıyla birlikte' : 'Deyim' };
      });
      break;
    case 'tekerleme':
      items = (T.TWISTERS || []).filter(Boolean).map((x) => ({ id: 't:' + low(x), mode, text: endDot(clean(x)), source: 'Tekerleme' }));
      break;
    case 'ozdeyis':
      items = (T.QUOTES || []).filter((x) => x && x.text).map((x) => ({ id: 'q:' + low(x.text), mode, text: endDot(clean(x.text)), source: clean(x.author) || 'Özdeyiş' }));
      break;
    default:
      return [];
  }
  const seen = new Set();
  items = items.filter((it) => (seen.has(it.id) ? false : (seen.add(it.id), true)));
  items.forEach((it) => {
    it.score = difficulty(it.text);
    if (!it.parts) it.parts = [it.id];
  });
  // Kademe: 0 = en zor. Atasözlerinde seviye 3–4 önce; diğerlerinde puana göre üçte birlik dilimler.
  if (mode === 'atasozu') {
    items.forEach((it) => { it.tier = it.level >= 3 ? 0 : it.level === 2 ? 1 : 2; });
  } else {
    const sorted = items.slice().sort((a, b) => b.score - a.score);
    sorted.forEach((it, i) => { it.tier = Math.min(2, Math.floor((i * 3) / sorted.length)); });
  }
  return items;
}

function shuffled(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Sonsuz akış: next() her çağrıda bir öğe döner. Bir turda öğe tekrar etmez; tur bitince yeniden karışır.
export function createStream(mode, { rng = Math.random, items } = {}) {
  const all = items || itemsFor(mode);
  const usedParts = new Set();
  let queue = [];
  let last = null;
  let served = 0;
  let round = 0;
  function refill() {
    round++;
    usedParts.clear();
    const tiers = [0, 1, 2].map((t) => shuffled(all.filter((it) => it.tier === t), rng));
    queue = tiers.flat();
    if (last && queue.length > 1 && queue[0].id === last.id) queue.push(queue.shift());
  }
  function next() {
    if (!all.length) return null;
    for (let guard = 0; guard < all.length * 2 + 4; guard++) {
      if (!queue.length) refill();
      const it = queue.shift();
      if (it.parts.some((p) => usedParts.has(p))) continue; // zincirin bir parçası bu turda yazıldı
      it.parts.forEach((p) => usedParts.add(p));
      last = it;
      served++;
      return { ...it, index: served, round };
    }
    return null;
  }
  return {
    mode,
    next,
    get size() { return all.length; },
    get served() { return served; },
    get round() { return round; },
  };
}

// Ana ekran için modül düzeyi akışlar (oturum boyunca sürer).
const STREAMS = new Map();
export function nextChunk(mode) {
  if (!isStreamMode(mode)) return pickText(mode);
  if (!STREAMS.has(mode)) STREAMS.set(mode, createStream(mode));
  const it = STREAMS.get(mode).next();
  return it ? { text: it.text, source: it.source, id: it.id, mode } : null;
}

const SEEN_WORDS = new Set();
function takeWords(n) {
  const list = WORDS.filter((w) => w.length >= 3 && w.length <= 10);
  let pool = list.filter((w) => !SEEN_WORDS.has(w));
  if (pool.length < n) { SEEN_WORDS.clear(); pool = list.slice(); }
  const out = [];
  while (out.length < n && pool.length) {
    const w = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    SEEN_WORDS.add(w);
    out.push(w);
  }
  return out;
}

// Tek parça metin (eski arabirim). Akış modlarında ≥ 110 karakter olana dek sıradaki öğeleri birleştirir.
export function pickText(mode) {
  if (mode === 'kelime') return { text: takeWords(26).join(' '), source: 'Kelime havuzu' };
  const m = isStreamMode(mode) ? mode : 'atasozu';
  const parts = [];
  const sources = [];
  let len = 0;
  for (let i = 0; i < 6 && (len < 110 || !parts.length); i++) {
    const c = nextChunk(m);
    if (!c) break;
    parts.push(c.text);
    if (!sources.includes(c.source)) sources.push(c.source);
    len += c.text.length + 1;
    if (m === 'siir') break;
  }
  return { text: parts.join(' '), source: sources.join(', ') };
}
