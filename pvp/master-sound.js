// Nişancı (docs/27): ana site ile PvP'nin ORTAK ana ses anahtarı (sözleşme, ana site tarafı home/home.js · Derleyici).
//   localStorage['tuslab-ses'] = 'on' | 'off'  (yoksa 'on')
// PvP açılışta önce bunu okur; yoksa kendi eski anahtarındaki değeri ('tuslab-pvp-sfx-muted' = 'true' → 'off') buraya taşır.
// Her aç/kapa bu anahtarı yazar (sound.js eski anahtarı da yazmaya devam eder). Başka sekmede değişince (`storage`) ve
// sayfa yeniden görünür olunca (`visibilitychange`, `pageshow`) yeniden okunur. Müzik ve efekt alt ayarları ayrı kalır;
// ana anahtar 'off' iken PvP hiçbir ses çalmaz.

export const MASTER_SOUND_KEY = 'tuslab-ses';
export const LEGACY_SFX_MUTED_KEY = 'tuslab-pvp-sfx-muted';

function get(storage, key) {
  try { return storage?.getItem?.(key) ?? null; } catch { return null; }
}
function set(storage, key, value) {
  try { storage?.setItem?.(key, value); } catch { /* kota / gizli sekme */ }
}

/** true = ses açık. Anahtar yoksa eski PvP anahtarından taşır (ve yazar). */
export function readMasterSound(storage = globalThis.localStorage) {
  const v = get(storage, MASTER_SOUND_KEY);
  if (v === 'on' || v === 'off') return v === 'on';
  const on = get(storage, LEGACY_SFX_MUTED_KEY) !== 'true';
  set(storage, MASTER_SOUND_KEY, on ? 'on' : 'off');
  return on;
}

export function writeMasterSound(storage = globalThis.localStorage, on) {
  set(storage, MASTER_SOUND_KEY, on ? 'on' : 'off');
}

/** Dış değişiklikleri izler; onChange(on) yalnız değer değişince çağrılır. Dönüş: dinleyicileri kaldıran işlev. */
export function watchMasterSound({ win = globalThis.window, doc = globalThis.document, storage = globalThis.localStorage, onChange, initial } = {}) {
  let last = typeof initial === 'boolean' ? initial : null;
  const sync = () => {
    const on = readMasterSound(storage);
    if (on === last) return;
    last = on;
    try { onChange?.(on); } catch { /* yalnız ses */ }
  };
  const onStorage = e => { if (!e || e.key == null || e.key === MASTER_SOUND_KEY) sync(); };
  const onVisible = () => { if (!doc?.hidden) sync(); };
  win?.addEventListener?.('storage', onStorage);
  win?.addEventListener?.('pageshow', sync);
  doc?.addEventListener?.('visibilitychange', onVisible);
  return {
    sync,
    /** Bu sekmede PvP kendi yazdığında izleyicinin bildiği değeri günceller (gereksiz geri çağrı olmasın). */
    note(on) { last = Boolean(on); },
    stop() {
      win?.removeEventListener?.('storage', onStorage);
      win?.removeEventListener?.('pageshow', sync);
      doc?.removeEventListener?.('visibilitychange', onVisible);
    },
  };
}
