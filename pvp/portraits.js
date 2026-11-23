/** Dövüşçü kimliği → Higgsfield portre dosyası: TEK eşleme (VS, sonuç, raund arası kullanır).
 *  Lobi CSS'i (lobby-v3.css [data-fighter-portrait]) aynı dosyaları kullanır; yeni dövüşçü eklenirse ikisi birlikte güncellenir. */
import {normalizeFighter, getFighter, PADISAH_IDS} from './shared/fighters.js';

export const PORTRAITS = Object.freeze({
  vargr: './assets/higgsfield/final/portre-vargr.webp',
  sira: './assets/higgsfield/final/portre-sira.webp',
  doran: './assets/higgsfield/final/portre-doran.webp',
  nyx: './assets/higgsfield/final/portre-nyx.webp',
  konyali: './assets/models/konyali/portre-konyali.webp',
  // Osmanlı padişahları: yüz portresi yok → renkli madalyon (scripts/padisah-madalyon.mjs üretir)
  ...Object.fromEntries(PADISAH_IDS.map(id => [id, `./assets/padisah/${id}.svg`]))
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

/** Lobi şeridi (dövüşçü seçim madalyonları): madalyonun altındaki kısa ad. Listede yoksa dövüşçünün kendi adı. */
export const DOCK_NAMES = Object.freeze({
  osman: 'Osman', orhan: 'Orhan', murad1: 'I. Murad', bayezid1: 'Yıldırım', mehmed1: 'Çelebi',
  murad2: 'II. Murad', fatih: 'Fatih', bayezid2: 'II. Bayezid', yavuz: 'Yavuz', kanuni: 'Kanuni'
});
export const dockName = id => DOCK_NAMES[id] || getFighter(id)?.name || String(id);
/** Şeritteki küçük padişah madalyonu (yazısız sürüm; scripts/padisah-madalyon.mjs üretir). Temel dövüşçüde null. */
export const dockMedallionUrl = id => (PADISAH_IDS.includes(id) ? `./assets/padisah/${id}-kucuk.svg` : null);
