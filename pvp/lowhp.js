/**
 * TuşLab PvP / paket 28 — düşük can geri bildirimi (yalnız KENDİ oyuncun için).
 *
 *   const low = createLowHpFeedback({root, isReduced, heartbeat, scheduler});
 *   low.update(ratio, running);  // ratio = hp/maxHp (0..1), running = maç sürüyor mu
 *   low.hit(amountRatio);        // kendi oyuncun hasar aldığında kısa kırmızı flaş
 *   low.destroy();
 *
 * Ekran kenarlarında kırmızı vinyet (pointer-events: none, DOM'u kaydırmaz) ve
 * can azaldıkça hızlanan kalp atışı. Değer sunucu HP'sinden gelir; burada hesap yok.
 */
export const LOW_HP_THRESHOLD = 0.3;
export const CRITICAL_HP_THRESHOLD = 0.12;

/** Beat interval (ms) for a given HP ratio; null when above the threshold. */
export function heartbeatInterval(ratio) {
  const r = Number(ratio);
  if (!Number.isFinite(r) || r <= 0 || r >= LOW_HP_THRESHOLD) return null;
  // 30 % → 1150 ms, 0 % → 560 ms.
  return Math.round(560 + (r / LOW_HP_THRESHOLD) * 590);
}

export function lowHpLevel(ratio) {
  const r = Number(ratio);
  if (!Number.isFinite(r) || r <= 0 || r >= LOW_HP_THRESHOLD) return 'off';
  return r < CRITICAL_HP_THRESHOLD ? 'critical' : 'low';
}

export function createLowHpFeedback({
  root,
  isReduced = () => false,
  heartbeat = () => false,
  scheduler = globalThis,
} = {}) {
  const doc = root?.ownerDocument;
  let overlay = null;
  let level = 'off';
  let ratio = 1;
  let timer = null;
  let hitTimer = null;
  let destroyed = false;

  function ensureOverlay() {
    if (overlay || !doc?.createElement || !root) return overlay;
    overlay = doc.createElement('div');
    overlay.className = 'pvp28-lowhp';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.dataset.level = 'off';
    root.appendChild(overlay);
    return overlay;
  }

  function stopBeat() {
    if (timer != null) scheduler.clearTimeout(timer);
    timer = null;
  }

  function beat() {
    timer = null;
    if (destroyed || level === 'off') return;
    try { heartbeat(1 - ratio / LOW_HP_THRESHOLD); } catch { /* ses isteğe bağlı */ }
    if (overlay && !isReduced()) {
      overlay.classList.remove('is-beat');
      void overlay.offsetWidth; // animasyonu yeniden başlat
      overlay.classList.add('is-beat');
    }
    const next = heartbeatInterval(ratio);
    if (next) timer = scheduler.setTimeout(beat, next);
  }

  function update(nextRatio, running = true) {
    if (destroyed) return level;
    ratio = Number.isFinite(Number(nextRatio)) ? Number(nextRatio) : 1;
    const nextLevel = running ? lowHpLevel(ratio) : 'off';
    if (nextLevel !== 'off') ensureOverlay();
    if (overlay) overlay.dataset.level = nextLevel;
    if (nextLevel === 'off') stopBeat();
    else if (level === 'off' || timer == null) {
      stopBeat();
      timer = scheduler.setTimeout(beat, 120);
    }
    level = nextLevel;
    return level;
  }

  function hit(strength = 0.5) {
    if (destroyed || !ensureOverlay()) return;
    overlay.style.setProperty('--pvp28-hit', String(Math.max(0.25, Math.min(1, Number(strength) || 0))));
    overlay.classList.remove('is-hit');
    void overlay.offsetWidth;
    overlay.classList.add('is-hit');
    if (hitTimer != null) scheduler.clearTimeout(hitTimer);
    hitTimer = scheduler.setTimeout(() => { hitTimer = null; overlay?.classList.remove('is-hit'); }, 420);
  }

  function destroy() {
    destroyed = true;
    stopBeat();
    if (hitTimer != null) scheduler.clearTimeout(hitTimer);
    overlay?.remove?.();
    overlay = null;
  }

  return {update, hit, destroy, state: () => ({level, ratio, beating: timer != null})};
}
