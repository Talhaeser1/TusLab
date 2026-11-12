/**
 * KESINYAP iş 4 — doğru kelime serisi sesi (saf mantık, DOM/WebAudio yok).
 * Yalnız YEREL oyuncunun doğru kelimeleri sayılır; yanlış kelime seriyi sıfırlar, perde başa döner.
 * Perde: majör pentatonik merdiven (C5 tabanı), 1..8+ basamak; 8'den sonra son basamakta kalır.
 * Eşiklerde (5, 10, 15) seyirci tezahüratı; 5'te mevcut "seri-5" anonsu da çalar.
 */
export const STREAK_BASE_HZ = 523.25;                        // C5
export const STREAK_SEMITONES = Object.freeze([0, 2, 4, 7, 9, 12, 14, 16]); // 8 basamak, giderek incelen
export const STREAK_MAX_STEP = STREAK_SEMITONES.length;
export const STREAK_THRESHOLDS = Object.freeze([5, 10, 15]);
/** Eşik → seyirci + (varsa) mevcut anons dosyası. Anons dosyaları "N kombo" okur → yalnız sayısı tutan eşikte çalar. */
export const STREAK_ANNOUNCE = Object.freeze({5: 'seri-5'});

export const streakStep = n => Math.min(STREAK_MAX_STEP, Math.max(1, Math.floor(Number(n) || 1)));
export const streakFrequency = n => +(STREAK_BASE_HZ * Math.pow(2, STREAK_SEMITONES[streakStep(n) - 1] / 12)).toFixed(2);

export function createStreakTracker() {
  let n = 0;
  return {
    /** Doğru kelime: {n, step, hz, threshold} */
    hit() { n += 1; return {n, step: streakStep(n), hz: streakFrequency(n), threshold: STREAK_THRESHOLDS.includes(n) ? n : null}; },
    /** Yanlış kelime / yeni maç: seri sıfırlanır. */
    reset() { n = 0; },
    get count() { return n; }
  };
}
