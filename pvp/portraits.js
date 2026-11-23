/** Dövüşçü kimliği → Higgsfield portre dosyası: TEK eşleme (VS, sonuç, raund arası kullanır).
 *  Lobi CSS'i (lobby-v3.css [data-fighter-portrait]) aynı dosyaları kullanır; yeni dövüşçü eklenirse ikisi birlikte güncellenir. */
import {normalizeFighter, getFighter} from './shared/fighters.js';

export const PORTRAITS = Object.freeze({
  vargr: './assets/higgsfield/final/portre-vargr.webp',
  sira: './assets/higgsfield/final/portre-sira.webp',
  doran: './assets/higgsfield/final/portre-doran.webp',
  nyx: './assets/higgsfield/final/portre-nyx.webp',
  konyali: './assets/models/konyali/portre-konyali.webp'
});

/** Portre yüklenemezse eski görsele düşülür (yalnız arketip bazlı). */
export const PORTRAIT_FALLBACK = Object.freeze({fire: './assets/arena-king.webp', rune: './assets/rune-preview.webp'});

/** Oyuncu kaydından ({fighter, character}) dövüşçü kimliği. */
export function portraitFighterId(player) {
  return normalizeFighter(player?.fighter, player?.character);
}
export function portraitUrl(fighterId) {
  return PORTRAITS[fighterId] || null;
}
export function portraitFor(player) {
  const id = portraitFighterId(player);
  const f = getFighter(id, player?.character);
  return {id, url: PORTRAITS[id] || PORTRAIT_FALLBACK[f.archetype] || PORTRAIT_FALLBACK.fire, fallback: PORTRAIT_FALLBACK[f.archetype] || PORTRAIT_FALLBACK.fire, name: f.name};
}

/** Küçük portre <img>: yüklenemezse eski görsele düşer. */
export function portraitImg(doc, player, cls) {
  const p = portraitFor(player);
  const img = doc.createElement('img');
  img.className = cls; img.alt = ''; img.decoding = 'async'; img.draggable = false;
  img.dataset.portrait = p.id;
  img.addEventListener?.('error', () => { if (!img.src.endsWith(p.fallback.slice(1))) img.src = p.fallback; }, {once: true});
  img.src = p.url;
  return img;
}

/** Lobi şeridi (dövüşçü seçim madalyonları): madalyonun altındaki kısa ad. Listede yoksa dövüşçünün kendi adı.
 *  Padişah kısa adları kadroyla birlikte kaldırıldı (docs/14). */
export const DOCK_NAMES = Object.freeze({});
export const dockName = id => DOCK_NAMES[id] || getFighter(id)?.name || String(id);
/** Eski padişah şerit madalyonu: kadro kaldırıldı, her dövüşçüde null (dışa aktarım uyumluluk için kalır). */
export const dockMedallionUrl = () => null;
