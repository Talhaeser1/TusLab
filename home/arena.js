// Ana ekran yazma alanı için metin seçici. Oturum boyunca aynı metin/kelime tekrar gelmez.
import * as T from './data/texts.js';
import { WORDS } from './data/words.js';

export const MODES = [
  { id: 'atasozu', label: 'Atasözü', icon: '🧿', hint: 'Zor atasözleri, art arda' },
  { id: 'siir', label: 'Şiir', icon: '🪶', hint: 'Ustaların dizeleri' },
  { id: 'deyim', label: 'Deyim', icon: '💬', hint: 'Deyimler ve anlamları' },
  { id: 'tekerleme', label: 'Tekerleme', icon: '🌀', hint: 'Dil döndüren cümleler' },
  { id: 'ozdeyis', label: 'Özdeyiş', icon: '✨', hint: 'Ünlü sözler' },
  { id: 'kelime', label: 'Kelime', icon: '🔤', hint: 'Geniş havuzdan rastgele kelimeler' },
];

const SEEN = new Set();
const clean = (s) => String(s ?? '').replace(/\s*\/\s*$/, '').replace(/\s+/g, ' ').trim();
const rnd = (n) => Math.floor(Math.random() * n);

function take(list, key, n) {
  let pool = list.filter((x) => !SEEN.has(key(x)));
  if (pool.length < n) { list.forEach((x) => SEEN.delete(key(x))); pool = list.slice(); }
  const out = [];
  while (out.length < n && pool.length) {
    const x = pool.splice(rnd(pool.length), 1)[0];
    SEEN.add(key(x));
    out.push(x);
  }
  return out;
}

const endDot = (s) => (/[.!?…]$/.test(s) ? s : s + '.');

export function pickText(mode) {
  switch (mode) {
    case 'siir': {
      const poems = (T.POEMS || []).filter((p) => Array.isArray(p.lines) && p.lines.length);
      const [p] = take(poems, (p) => 'p:' + (p.id || p.title), 1);
      const lines = p.lines.map(clean).filter(Boolean).slice(0, 4);
      return { text: endDot(lines.join(', ').replace(/[,;:]\s*,/g, ',')), source: [p.author, p.title].filter(Boolean).join(' — ') };
    }
    case 'deyim': {
      const list = take((T.IDIOMS || []).filter((x) => x.text), (x) => 'd:' + x.text, 3);
      return { text: list.map((x) => endDot(x.meaning ? `${x.text}: ${x.meaning.replace(/\.$/, '')}` : x.text)).join(' '), source: 'Deyimler' };
    }
    case 'tekerleme': {
      const list = take((T.TWISTERS || []).filter(Boolean), (x) => 't:' + x, 2);
      return { text: list.map((x) => endDot(clean(x))).join(' '), source: 'Tekerlemeler' };
    }
    case 'ozdeyis': {
      const list = take((T.QUOTES || []).filter((x) => x.text), (x) => 'q:' + x.text, 2);
      return { text: list.map((x) => endDot(clean(x.text))).join(' '), source: [...new Set(list.map((x) => x.author).filter(Boolean))].join(', ') };
    }
    case 'kelime': {
      const list = take(WORDS.filter((w) => w.length >= 3 && w.length <= 10), (w) => 'w:' + w, 26);
      return { text: list.join(' '), source: 'Kelime havuzu' };
    }
    case 'atasozu':
    default: {
      const hard = (T.PROVERBS || []).filter((x) => x.text && (Number(x.level) || 1) >= 3);
      const list = take(hard, (x) => 'a:' + x.text, 3);
      return { text: list.map((x) => endDot(clean(x.text))).join(' '), source: 'Atasözleri · zor' };
    }
  }
}
