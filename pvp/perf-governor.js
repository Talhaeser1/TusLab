/**
 * TuşLab Neon Arena — performans valisi (Ajan: performans / tarayıcı yakınlaştırma).
 *
 * İki sorun için ortak, saf (DOM'suz, test edilebilir) yardımcılar:
 *
 * 1) Canvas çözünürlüğü MUTLAK piksel bütçesiyle sınırlanır. Tarayıcı %80 / %67
 *    yakınlaştırmada CSS görüş alanı büyür (1920 genişlik → 2400 CSS px) ve
 *    devicePixelRatio 1'in altına düşer. Eski kod oranı `max(1, …)` ile 1'e
 *    sabitliyordu: uzaklaştırınca GPU ekranda görünenden FAZLA piksel boyuyordu.
 *    Artık oran = min(üst sınır, dpr, √(bütçe / CSS alanı)); 1'in altına inebilir.
 *
 * 2) Kare süresi valisi: ısınma kareleri ve uzun duraklamalar (shader derleme,
 *    sekme dönüşü) ölçülmez; kısa bir pencerenin ortalaması eşiği aşarsa bir
 *    kademe aşağı inilir. Tek yönlüdür (inip çıkma titremesi yok).
 */

/** Cihaz pikseli bütçeleri (backing store = genişlik × yükseklik). */
export const PIXEL_BUDGETS = Object.freeze({
  arenaHigh: 2.0e6,     // 3B canvas, en yüksek kademe (bloom açık/kapalı)
  arenaMedium: 1.4e6,   // 3B canvas, "DPR düşür" kademesi
  arenaLow: 1.0e6,      // 3B canvas, düşük kalite
  particlesHigh: 1.0e6, // 2B parçacık canvas'ı
  particlesLow: 0.7e6,
});

/** Oran asla bunun altına inmez (aşırı bulanıklığı önler). */
export const MIN_RENDER_RATIO = 0.5;

/**
 * Canvas piksel oranı: dpr'yi izler (1'in altında da), üst sınır ve mutlak
 * piksel bütçesiyle kırpar. Sonuç 0.01 adımına yuvarlanır (yeniden boyutlama titremesi olmasın).
 */
export function budgetRatio(cssWidth, cssHeight, dpr, {maxRatio = 2, budget = PIXEL_BUDGETS.arenaHigh, minRatio = MIN_RENDER_RATIO} = {}) {
  const device = Number(dpr) > 0 ? Number(dpr) : 1;
  const area = Math.max(0, Number(cssWidth) || 0) * Math.max(0, Number(cssHeight) || 0);
  const byBudget = area > 0 ? Math.sqrt(budget / area) : maxRatio;
  const ratio = Math.min(maxRatio, device, byBudget);
  return Math.max(minRatio, Math.floor(ratio * 100) / 100);
}

/** Backing store piksel sayısı (ölçüm/test için). */
export function backingPixels(cssWidth, cssHeight, ratio) {
  return Math.round(cssWidth * ratio) * Math.round(cssHeight * ratio);
}

/**
 * Kare süresi valisi.
 * sample(dtMs) → true döndürürse çağıran bir kademe aşağı inmelidir.
 */
export function createFrameGovernor({
  slowMs = 20,
  warmupFrames = 45,
  windowFrames = 40,
  ignoreAboveMs = 250,
  maxStep = 3,
} = {}) {
  let step = 0;
  let warm = 0;
  let sum = 0;
  let count = 0;
  const resetWindow = () => { warm = 0; sum = 0; count = 0; };
  return {
    get step() { return step; },
    /** Kademe değişince / görünürlük dönüşünde ısınmayı yeniden başlat. */
    reset: resetWindow,
    setStep(next) {
      step = Math.max(0, Math.min(maxStep, Math.round(Number(next) || 0)));
      resetWindow();
    },
    sample(dtMs) {
      const dt = Number(dtMs);
      if (step >= maxStep || !(dt > 0) || dt > ignoreAboveMs) return false;
      if (warm < warmupFrames) { warm++; return false; }
      sum += dt;
      count++;
      if (count < windowFrames) return false;
      const average = sum / count;
      sum = 0;
      count = 0;
      if (average <= slowMs) return false;
      step++;
      warm = 0;
      return true;
    },
  };
}
