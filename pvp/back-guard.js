// Nişancı (docs/27, DEVIR-PVP 19): tarayıcının geri tuşu canlı maçı sorusuz bırakıyordu.
// Maç sürerken geçmişe aynı adresle tek bir "koruma" kaydı eklenir (history.pushState). Geri tuşu bu kaydı tüketir →
// popstate → koruma yeniden kurulur ve çıkış onay kutusu açılır (onBack). Onaylanırsa PvP kapanır; maç bitince ya da PvP
// kapanınca koruma kaydı history.back() ile geri alınır (bu popstate ana sayfa yönlendiricisine ulaşmaz).

export const BACK_GUARD_STATE = 'tuslabPvpGuard';

export function createBackGuard({ win = globalThis.window, isLive = () => false, onBack = () => {} } = {}) {
  const history = win?.history;
  let armed = false;
  let skip = 0;

  function arm() {
    if (armed || !history?.pushState || !isLive()) return armed;
    try { history.pushState({ [BACK_GUARD_STATE]: true }, ''); armed = true; } catch { armed = false; }
    return armed;
  }

  function disarm() {
    if (!armed) return;
    armed = false;
    if (history?.state && history.state[BACK_GUARD_STATE]) {
      skip++;
      try { history.back(); } catch { skip--; }
    }
  }

  function onPop(event) {
    if (skip > 0) { skip--; event?.stopImmediatePropagation?.(); return; }
    if (!armed) return;
    armed = false; // koruma kaydı geri tuşuyla tüketildi
    if (!isLive()) return;
    event?.stopImmediatePropagation?.();
    arm(); // ikinci geri basışı da yakalansın
    try { onBack(); } catch { /* onay kutusu açılamadıysa maç sürer */ }
  }

  // Yakalama aşaması: hedefte (window) yakalayan dinleyiciler önce çalışır → ana sayfanın popstate'i bizimkinden sonra.
  win?.addEventListener?.('popstate', onPop, true);

  return {
    arm,
    disarm,
    /** Maç durumuna göre kur / kaldır. */
    sync() { if (isLive()) arm(); else disarm(); },
    isArmed: () => armed,
    destroy() { win?.removeEventListener?.('popstate', onPop, true); },
  };
}
