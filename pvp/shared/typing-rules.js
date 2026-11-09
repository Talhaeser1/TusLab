/**
 * TuşLab PvP / paket 30 — yazma kuralları (maç başına, oda sahibi ya da bot maçı seçer).
 *
 *   caseSensitive  true  → "Güçlü" ile "güçlü" farklı kelimedir (varsayılan)
 *                  false → büyük/küçük harf yok sayılır (Türkçe kurallarıyla: I/ı, İ/i)
 *   punctuation    true  → nokta, virgül vb. de yazılmalıdır (varsayılan)
 *                  false → noktalama işaretleri hem hedefte hem yazılanda yok sayılır
 *
 * Sunucu (cloudflare/src/room.js) ve yerel bot motoru aynı fonksiyonu kullanır; istemci
 * yalnız önizleme/tahmin için çağırır, karar her zaman maç motorundadır.
 */
export const DEFAULT_TYPING = Object.freeze({caseSensitive: true, punctuation: true});

/** Any input → a clean {caseSensitive, punctuation} pair (unknown keys dropped, defaults kept). */
export function normalizeTyping(value) {
  return {
    caseSensitive: value?.caseSensitive !== false,
    punctuation: value?.punctuation !== false,
  };
}

/** True when the value is a valid wire payload: an object with only boolean caseSensitive/punctuation. */
export function isTypingPayload(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length > 0 && keys.every(k => (k === 'caseSensitive' || k === 'punctuation') && typeof value[k] === 'boolean');
}

const PUNCT = /[\p{P}]/gu;

/** The comparable form of a word under the given rules. */
export function foldWord(word, rules = DEFAULT_TYPING) {
  let out = String(word ?? '').normalize('NFC');
  if (rules && rules.punctuation === false) out = out.replace(PUNCT, '');
  if (rules && rules.caseSensitive === false) out = out.toLocaleLowerCase('tr-TR');
  return out;
}

/** Whether a typed word counts as the expected one. */
export function wordsMatch(typed, expected, rules = DEFAULT_TYPING) {
  return foldWord(typed, rules) === foldWord(expected, rules);
}

/** Correct characters by position after folding (accuracy stats). Returns {correct, total}. */
export function charScore(typed, expected, rules = DEFAULT_TYPING) {
  const a = [...foldWord(typed, rules)];
  const b = [...foldWord(expected, rules)];
  let correct = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] === b[i]) correct++;
  return {correct, total: Math.max(a.length, b.length)};
}

/** Short Turkish label for HUD/lobby, e.g. "Aa duyarlı · noktalama var". */
export function typingLabel(value) {
  const t = normalizeTyping(value);
  return `${t.caseSensitive ? 'Aa duyarlı' : 'Aa serbest'} · ${t.punctuation ? 'noktalama var' : 'noktalama yok'}`;
}
