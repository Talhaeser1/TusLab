// Yazma hissi (14 Kas 2026): kelime GÖNDERİLİNCE yazma paneli (.tt) kısa bir durum sınıfı alır.
// Doğru kelime → .is-hit (çakma, ≤ 180 ms) · yanlış kelime → .is-miss (sarsılma + kırmızı parlama, ≤ 160 ms).
// Kaynak: sunucunun WORD_RESULT'u (yalnız gönderen oyuncuya gelir → hep benim kelimem). Harf yazarken hiçbir şey olmaz;
// yazma yolu (tuş → ekran) etkilenmez. Animasyon CSS'te (fight-hud.css, YAZMA PANELI · CERCEVE), yalnız transform/opacity.
export const FEEL_MS = Object.freeze({hit: 180, miss: 160});

export function attachTypingFeel({root, reduced = () => false, later = (fn, ms) => globalThis.setTimeout(fn, ms), cancel = id => globalThis.clearTimeout(id),
  frame = fn => (globalThis.requestAnimationFrame ? globalThis.requestAnimationFrame(fn) : later(fn, 0))} = {}) {
  if (!root?.addEventListener) return () => {};
  let timer = null;
  const panel = () => root.querySelector?.('.pvp2-shell>.tt') || null;
  const clear = tt => { tt.classList.remove('is-hit', 'is-miss'); };
  const fire = kind => {
    const tt = panel(); if (!tt) return;
    cancel(timer); timer = null;
    if (reduced()) { clear(tt); return; }
    const cls = `is-${kind}`;
    const start = () => { tt.classList.add(cls); timer = later(() => { timer = null; tt.classList.remove(cls); }, FEEL_MS[kind] + 40); };
    // Aynı sınıf hâlâ duruyorsa (çok hızlı art arda) bir kare sonra yeniden ekle: animasyon baştan başlar, zorla yerleşim hesabı yok.
    if (tt.classList.contains(cls)) { clear(tt); frame(start); } else { clear(tt); start(); }
  };
  const onResult = event => {
    const d = event?.detail || {};
    if (d.accepted) fire(d.correct ? 'hit' : 'miss');
  };
  const onEnd = event => { if (/^yp-(hit|miss)/.test(event?.animationName || '')) { const tt = panel(); if (tt && event.target === tt.querySelector('.tt-word')) clear(tt); } };
  root.addEventListener('tuslab:pvp-word-result', onResult);
  root.addEventListener('animationend', onEnd);
  return () => { cancel(timer); root.removeEventListener('tuslab:pvp-word-result', onResult); root.removeEventListener('animationend', onEnd); };
}
