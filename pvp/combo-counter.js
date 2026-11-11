// Görev 4 / madde 3 — kombo sayacı ("2 KOMBO!", "3 KOMBO!" …). Yalnız sunum katmanı (DOM, canvas üstü).
// arena3d her kombo vuruşunun temas karesinde root'a 'tuslab:pvp-strike' {seat, index} gönderir;
// kombo bitince 'tuslab:pvp-combo-end'. Sayaç 2+ vuruşta görünür, bitişten ~600 ms sonra kaybolur.
// Ölçüm tutamacı: [data-combo-counter] (data-count, data-seat, data-active).

export const COMBO_COUNTER = Object.freeze({minHits: 2, hideMs: 600, popMs: 220});

/** Saf: bu vuruş (0 tabanlı indis) için sayaç metni; tek vuruşta null. */
export function comboLabel(index) {
  const count = Math.floor(Number(index)) + 1;
  return Number.isFinite(count) && count >= COMBO_COUNTER.minHits ? `${count} KOMBO!` : null;
}

export function createComboCounter({root, isReduced = () => false, setTimer = null, clearTimer = null} = {}) {
  const doc = root?.ownerDocument || globalThis.document || null;
  if (!root || !doc?.createElement || typeof root.addEventListener !== 'function') return {destroy() {}, hit() {}, end() {}, el: null};
  const later = setTimer || ((fn, ms) => globalThis.setTimeout(fn, ms));
  const unlater = clearTimer || (id => globalThis.clearTimeout(id));
  const el = doc.createElement('div');
  el.className = 'pvp-combo-counter';
  el.setAttribute('data-combo-counter', '');
  el.setAttribute('data-active', 'false');
  el.setAttribute('aria-hidden', 'true');
  el.hidden = true;
  root.append?.(el) ?? root.appendChild?.(el);
  let hideTimer = null;
  const reduced = () => { try { return Boolean(isReduced()); } catch { return false; } };

  function hit(seat, index) {
    const label = comboLabel(index);
    if (!label) return;
    if (hideTimer != null) { unlater(hideTimer); hideTimer = null; }
    el.hidden = false;
    el.textContent = label;
    el.setAttribute('data-active', 'true');
    el.setAttribute('data-count', String(index + 1));
    el.setAttribute('data-seat', String(seat));
    el.setAttribute('data-side', seat === 2 ? 'rune' : 'fire');
    if (!reduced()) { // kısa pop: sınıfı çıkarıp tekrar ekle
      el.classList?.remove('is-pop'); void el.offsetWidth; el.classList?.add('is-pop');
    }
  }
  function end(ms = COMBO_COUNTER.hideMs) {
    if (hideTimer != null) unlater(hideTimer);
    hideTimer = later(() => {
      hideTimer = null; el.hidden = true; el.setAttribute('data-active', 'false'); el.classList?.remove('is-pop');
    }, ms);
  }
  const onStrike = e => hit(e.detail?.seat, Number(e.detail?.index) || 0);
  const onEnd = () => end();
  root.addEventListener('tuslab:pvp-strike', onStrike);
  root.addEventListener('tuslab:pvp-combo-end', onEnd);
  return {
    el, hit, end,
    destroy() {
      if (hideTimer != null) unlater(hideTimer);
      root.removeEventListener?.('tuslab:pvp-strike', onStrike);
      root.removeEventListener?.('tuslab:pvp-combo-end', onEnd);
      el.remove?.();
    },
  };
}
