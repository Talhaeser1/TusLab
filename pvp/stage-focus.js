// Arena odağı: yazılmayan anlarda (saldırı sırası) yazma paneli katlanır, arena yukarı uzayıp ekranı doldurur.
//  - Klasik:        EXCHANGE_RESOLVE → odak · EXCHANGE_START → normal
//  - Zamana Karşı:  ROUND_RESOLVE → odak · ROUND_END (+bant süresi) → normal (tur arası paneli açılır) · ROUND_START → normal
//  - Raund Arena:   #pvp-root[data-arena-phase="resolve"] → odak
// Yerleşim değişimi ani zıplama olmasın diye arena FLIP ile yumuşakça kayar (yalnız transform).
// Yalnız görseldir; oyun durumunu değiştirmez.

export const FOCUS_CLASS = 'stage-focus';
export const FOCUS_RELEASE_AFTER_ROUND_END_MS = 1250; // sinematik bant süresi (cinematic.js roundEndHold)

// Odaktan çıkarken arena eski (yukarıdaki) yerinden aşağı kayar; yazma paneli (z-index'i daha yüksek)
// o sırada HP panellerinin üstüne biniyordu. Kayma bitene dek yazma paneli görünmez, sonra belirir.
export const FOCUS_OUT_CLASS = 'stage-focus-out';
export const FLIP_MS = 420;
export const INTER_CLASS = 'rui-inter-open';

export function attachStageFocus({root, isReduced = () => false, scheduler = globalThis, observe = globalThis.MutationObserver} = {}) {
  if (!root?.addEventListener) return {destroy() {}, set() {}};
  let releaseTimer = null, outTimer = null, flipAnim = null;
  const duel = () => root.querySelector?.('.pvp2-duel') || null;
  const endOut = () => {
    if (outTimer !== null) { scheduler.clearTimeout(outTimer); outTimer = null; }
    root.classList?.remove(FOCUS_OUT_CLASS);
  };

  // fromTop: yerleşim CSS ile zaten değiştiyse (tur arası paneli açıldı) arenanın önceki konumu.
  function flip(apply, on, fromTop = null) {
    const d = duel();
    try { flipAnim?.cancel?.(); } catch { /* yalnız süs */ }
    flipAnim = null;
    endOut();
    const before = Number.isFinite(fromTop) ? fromTop : d?.getBoundingClientRect?.().top;
    apply();
    const after = d?.getBoundingClientRect?.().top;
    focusTop = on && Number.isFinite(after) ? after : null;
    if (!d || before === undefined || isReduced() || typeof d.animate !== 'function') return;
    const dy = before - after;
    if (Math.abs(dy) < 4) return;
    try { flipAnim = d.animate([{transform: `translateY(${Math.round(dy)}px)`}, {transform: 'none'}], {duration: FLIP_MS, easing: 'cubic-bezier(.2,.9,.3,1)'}); } catch { return; /* yalnız süs */ }
    const anim = flipAnim;
    // Arena aşağı inerken yazma paneli onun üst şeridini (oyuncu başlığı + HP) kapatmasın.
    if (!on) {
      root.classList?.add(FOCUS_OUT_CLASS);
      anim?.finished?.then?.(() => { if (flipAnim === anim) endOut(); }, () => {});
    }
    // Kare çizilmezse (arka plan sekmesi, ağır kare) kayma takılı kalmasın: süre dolunca bitir, sonra paneli göster.
    outTimer = scheduler.setTimeout(() => {
      outTimer = null;
      if (flipAnim === anim) { try { anim.finish?.(); } catch { /* yalnız süs */ } }
      root.classList?.remove(FOCUS_OUT_CLASS);
    }, FLIP_MS + 280);
  }
  let busy = false; // kendi sınıf değişimlerimiz gözlemciyi yeniden tetiklemesin
  function set(on, fromTop = null) {
    if (releaseTimer !== null) { scheduler.clearTimeout(releaseTimer); releaseTimer = null; }
    if (busy || Boolean(root.classList?.contains(FOCUS_CLASS)) === Boolean(on)) return;
    busy = true;
    try { flip(() => root.classList?.toggle(FOCUS_CLASS, Boolean(on)), Boolean(on), fromTop); } finally { busy = false; }
  }
  function releaseLater(ms) {
    if (releaseTimer !== null) scheduler.clearTimeout(releaseTimer);
    releaseTimer = scheduler.setTimeout(() => { releaseTimer = null; set(false); }, ms);
  }

  const onRound = e => {
    const type = e.detail?.type;
    if (type === 'ROUND_RESOLVE' || type === 'EXCHANGE_RESOLVE') set(true);
    else if (type === 'ROUND_END') releaseLater(isReduced() ? 0 : FOCUS_RELEASE_AFTER_ROUND_END_MS);
    else if (type === 'ROUND_START' || type === 'EXCHANGE_START') set(false);
  };
  const onMatch = e => { const s = e.detail?.match?.status; if (s && s !== 'running' && s !== 'paused') set(false); };
  const onCinematic = e => { if (e.detail?.type === 'MATCH_START' || e.detail?.type === 'COUNTDOWN') set(false); };
  root.addEventListener('tuslab:pvp-round', onRound);
  root.addEventListener('tuslab:pvp-match', onMatch);
  root.addEventListener('tuslab:pvp-cinematic', onCinematic);

  // Raund Arena fazı kök öznitelikte tutuluyor.
  // Tur arası paneli (.rui-inter) yazma panelinin kutusuna oturur: panel açılırken odak sürerse kutu yoktu,
  // panel "yüzer" moda geçip ekranın soluna kayıyor ve HP panellerinin üstüne biniyordu.
  // CSS (cinematic.css) panel açıkken yazma panelini yerinde tutar; burada odak FLIP ile kapatılır.
  let mo = null, lastPhase = root.dataset?.arenaPhase, focusTop = null;
  if (typeof observe === 'function') {
    mo = new observe(records => {
      const list = Array.isArray(records) ? records : [];
      const phaseChanged = !list.length || list.some(r => r.attributeName === 'data-arena-phase');
      const ph = root.dataset?.arenaPhase;
      if (phaseChanged && ph !== lastPhase) { lastPhase = ph; set(ph === 'resolve'); return; } // öznitelik silinince odak kalkar
      if (root.classList?.contains(INTER_CLASS) && root.classList?.contains(FOCUS_CLASS)) set(false, focusTop);
    });
    try { mo.observe(root, {attributes: true, attributeFilter: ['data-arena-phase', 'class']}); } catch { mo = null; }
  }
  return {
    set,
    destroy() {
      if (releaseTimer !== null) scheduler.clearTimeout(releaseTimer);
      endOut();
      mo?.disconnect?.();
      root.removeEventListener('tuslab:pvp-round', onRound);
      root.removeEventListener('tuslab:pvp-match', onMatch);
      root.removeEventListener('tuslab:pvp-cinematic', onCinematic);
      root.classList?.remove(FOCUS_CLASS);
    }
  };
}
