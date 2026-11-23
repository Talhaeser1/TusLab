// PvP yükleyicisi (docs/12-pvp-gecikmeli-yukleme.md). index.html'deki <script type="module" src="./pvp/index.js"> bu dosyayı yükler.
// Asıl PvP gövdesi ve ~60 bağımlı modülü (≈835 KB) pvp/pvp-main.js'tedir ve yalnız gerektiğinde iner:
//  - sayfa ?pvp=… ya da ?pvpRoom=… ile açıldıysa hemen (ana ekrandaki PvP kartı/menü öğesi ?pvp=lobby adresine gider),
//  - eski sitedeki "PvP Modları / Çevrimiçi lobiyi aç" (tuslab:pvp-enter olayı) ilk kez tetiklendiğinde.
// Ana sayfada PvP'ye girilmedikçe pvp-main.js ve bağımlılıkları indirilmez.
// İsteğe bağlı sessiz ön ısıtma: sayfa yüklendikten ≥4 sn sonra, tarayıcı boştayken ve bağlantı yavaş/saveData değilse
// <link rel="modulepreload"> eklenir (modül çalıştırılmaz; açılış ölçümünün ilk 3,5 sn'sine girmez).

export const PVP_MAIN = './pvp-main.js';
export const WARM_DELAY_MS = 4000;

/** Adres PvP'yi doğrudan açıyor mu? (?pvp=lobby, ?pvp=practice, ?pvpRoom=KOD) */
export function wantsPvp(search) {
  try { const q = new URLSearchParams(search || ''); return q.has('pvp') || q.has('pvpRoom'); } catch { return false; }
}

/** Ön ısıtma yapılmalı mı? Veri tasarrufu ya da 2g/3g bağlantıda yapılmaz. */
export function warmAllowed(nav) {
  const c = nav?.connection;
  if (!c) return true;
  if (c.saveData) return false;
  return !/(^|-)(2g|3g)$/.test(String(c.effectiveType || ''));
}

/**
 * Yükleyiciyi kurar. Tarayıcı dışında (testler) bağımlılıklar parametreyle verilir.
 * @returns {{load:()=>Promise<any>, state:()=>{requested:boolean,ready:boolean,warmed:boolean}}}
 */
export function createPvpLoader({
  doc = globalThis.document,
  win = globalThis.window,
  search = globalThis.location?.search,
  importMain = () => import(PVP_MAIN),
  mainUrl = new URL(PVP_MAIN, import.meta.url).href,
} = {}) {
  let pending = null, ready = false, wantOpen = false, warmed = false;

  function hideLoadingHint() {
    try { const hint = doc?.getElementById?.('pvp-loading'); if (hint) hint.hidden = true; } catch { /* yok */ }
  }

  function load() {
    if (!pending) {
      pending = importMain().then(mod => {
        ready = true;
        // pvp-main kendi tuslab:pvp-enter dinleyicisini yüklendiği anda kurar; ondan önce gelen olayı burada karşıla.
        if (wantOpen) { wantOpen = false; mod?.openPvp?.(); }
        return mod;
      }, err => {
        pending = null; wantOpen = false;
        hideLoadingHint();
        try { console.error('[pvp] PvP modülü yüklenemedi:', err); } catch { /* yok */ }
        throw err;
      });
      pending.catch(() => {});
    }
    return pending;
  }

  function warm() {
    if (warmed || pending || !warmAllowed(win?.navigator)) return;
    warmed = true;
    try {
      const link = doc.createElement('link');
      link.rel = 'modulepreload';
      link.href = mainUrl;
      doc.head.appendChild(link);
    } catch { /* yok */ }
  }

  function scheduleWarm() {
    const later = () => win.setTimeout(() => {
      const idle = win.requestIdleCallback;
      if (typeof idle === 'function') idle.call(win, warm, { timeout: 10000 }); else warm();
    }, WARM_DELAY_MS);
    if (doc.readyState === 'complete') later();
    else win.addEventListener('load', later, { once: true });
  }

  if (wantsPvp(search)) {
    load();
  } else {
    doc.addEventListener('tuslab:pvp-enter', () => {
      if (ready) return;          // pvp-main yüklü: olayı kendi dinleyicisi işler
      wantOpen = true;
      load();
    });
    if (win) scheduleWarm();
  }

  return { load, state: () => ({ requested: Boolean(pending), ready, warmed }) };
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  window.__tuslabPvpLoader = createPvpLoader();
}
