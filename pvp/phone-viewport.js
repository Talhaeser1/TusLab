// Telefoncu (docs/24): telefon ve dar ekran yardımcıları. Yalnız görünüm; oyun kuralına dokunmaz.
//
// 1) Ekran klavyesi: iOS Safari ve Android Chrome (varsayılan "resizes-visual") klavye açılınca yalnız GÖRSEL
//    görüntü alanını küçültür; #pvp-root (position:fixed; inset:0) eski yükseklikte kalır, yazma paneli klavyenin
//    altına düşer ya da tarayıcı sayfayı kaydırıp üst HUD'u ekrandan çıkarır. Klavye açıkken kök, görsel görüntü
//    alanının kutusuna oturtulur (--pvp-vv-top / --pvp-vv-h + .pvp-kb-open); CSS (compact-height.css "TELEFONCU")
//    yazma panelini alta sabitler, sığmayan süsleri gizler.
// 2) Yazma paneline (büyük kelimeye) dokununca yazma kutusu odaklanır → telefonda klavye açılır. Dokunmatik cihazda
//    otomatik odak bilerek yok (pvp-main focusTypingWhenReady): klavye kendiliğinden açılıp sahneyi kapatmasın.

export const KB_OPEN_CLASS = 'pvp-kb-open';
export const KB_TIGHT_CLASS = 'pvp-kb-tight';
export const KB_SHORT_CLASS = 'pvp-kb-short';
/** Görsel alan, tam yükseklikten en az bu kadar kısaysa klavye açık sayılır (adres çubuğu oynaması ≈ 60–110 px). */
export const KB_MIN_PX = 120;
/** Klavye açıkken görünen yükseklik bunun altındaysa (telefon yatay) yalnız yazma paneli + araç çubuğu kalır. */
export const KB_TIGHT_PX = 300;
/** 440 px altında (iPhone SE + klavye ≈ 380) raund madalyonu küçülür, yazma panelinin üstüne binmesin. */
export const KB_SHORT_PX = 440;

const TEXT_INPUT = 'input:not([type=range]):not([type=checkbox]):not([type=radio]):not([type=button]),textarea,[contenteditable=""],[contenteditable="true"]';

/**
 * Saf karar: klavye açık mı, kök nereye oturmalı?
 * fullHeight: bu yönde görülen en büyük pencere yüksekliği (resizes-content kipinde innerHeight de küçülür).
 */
export function keyboardLayout({fullHeight = 0, vvHeight = 0, vvTop = 0, typing = false} = {}) {
  const full = Number(fullHeight) || 0;
  const h = Number(vvHeight) || 0;
  if (!typing || full <= 0 || h <= 0 || full - h < KB_MIN_PX) return {open: false, tight: false, short: false, top: 0, height: 0};
  return {open: true, tight: h < KB_TIGHT_PX, short: h < KB_SHORT_PX, top: Math.max(0, Math.round(Number(vvTop) || 0)), height: Math.round(h)};
}

/** Dokunulan yer yazma panelinin boş/kelime alanı mı (düğme, bağlantı, form öğesi değil)? */
export function isTypingPanelTap(target) {
  const el = target?.closest ? target : target?.parentElement;
  if (!el?.closest) return false;
  if (!el.closest('.tt')) return false;
  return !el.closest('button,a[href],input,select,textarea,summary,label,[role="button"],[contenteditable="true"]');
}

export function installPhoneViewport(root, env = globalThis) {
  if (!root?.addEventListener) return {destroy() {}, sync() {}};
  const doc = root.ownerDocument || env.document;
  const vv = env.visualViewport || null;
  const coarse = () => {
    try { return Boolean(env.matchMedia?.('(pointer: coarse)').matches); } catch { return false; }
  };
  let fullH = 0, fullW = 0, applied = '';

  function typingFocused() {
    const a = doc?.activeElement;
    return Boolean(a && a !== doc.body && root.contains?.(a) && a.matches?.(TEXT_INPUT));
  }
  function sync() {
    const w = Number(env.innerWidth) || 0;
    const ih = Number(env.innerHeight) || 0;
    // Yön/genişlik değişince tam yükseklik yeniden ölçülür; aynı yönde en büyük değer korunur.
    if (Math.abs(w - fullW) > 40) { fullW = w; fullH = 0; }
    if (!typingFocused()) fullH = Math.max(ih, Number(vv?.height) || 0);
    else fullH = Math.max(fullH, ih);
    const state = coarse() && vv
      ? keyboardLayout({fullHeight: fullH, vvHeight: vv.height, vvTop: vv.offsetTop, typing: typingFocused()})
      : {open: false, tight: false, short: false, top: 0, height: 0};
    const key = state.open ? `${state.top}|${state.height}` : '';
    if (key === applied) return state;
    applied = key;
    root.classList.toggle(KB_OPEN_CLASS, state.open);
    root.classList.toggle(KB_TIGHT_CLASS, state.open && state.tight);
    root.classList.toggle(KB_SHORT_CLASS, state.open && state.short);
    if (state.open) {
      root.style.setProperty('--pvp-vv-top', `${state.top}px`);
      root.style.setProperty('--pvp-vv-h', `${state.height}px`);
      if (root.scrollTop) root.scrollTop = 0;
    } else {
      root.style.removeProperty('--pvp-vv-top');
      root.style.removeProperty('--pvp-vv-h');
    }
    return state;
  }
  // Klavye animasyonu bitene dek visualViewport birkaç kez değişir; her olayda yeniden ölç (ucuz: imza karşılaştırması).
  const onViewport = () => sync();
  const onFocus = () => { sync(); env.setTimeout?.(sync, 350); };
  function onTap(event) {
    if (!isTypingPanelTap(event.target)) return;
    const input = root.querySelector?.('#tt-input');
    if (!input || input.disabled || doc?.activeElement === input || !input.getClientRects?.().length) return;
    input.focus({preventScroll: true});
  }
  vv?.addEventListener?.('resize', onViewport);
  vv?.addEventListener?.('scroll', onViewport);
  env.addEventListener?.('resize', onViewport);
  env.addEventListener?.('orientationchange', onFocus);
  root.addEventListener('focusin', onFocus);
  root.addEventListener('focusout', onFocus);
  root.addEventListener('click', onTap);
  sync();
  return {
    sync,
    destroy() {
      vv?.removeEventListener?.('resize', onViewport);
      vv?.removeEventListener?.('scroll', onViewport);
      env.removeEventListener?.('resize', onViewport);
      env.removeEventListener?.('orientationchange', onFocus);
      root.removeEventListener('focusin', onFocus);
      root.removeEventListener('focusout', onFocus);
      root.removeEventListener('click', onTap);
      root.classList.remove(KB_OPEN_CLASS, KB_TIGHT_CLASS, KB_SHORT_CLASS);
    },
  };
}
