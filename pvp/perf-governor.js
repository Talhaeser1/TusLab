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
  // Paket 33: tam ekran 1920×940 CSS @ dpr 1.25 = 2.82 MP; eski 2.0 MP bütçesi oranı 1.05'e
  // indiriyordu (ekran pikselinin %84'ü → yumuşak görüntü). Ölçüldü: 3.0 MP'de ≥ 55 FPS.
  arenaHigh: 3.0e6,     // 3B canvas, en yüksek kademe (bloom açık/kapalı)
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
  nativeMinMs = 19.5,
  // 15 Kas 2026 ölçüm (Intel UHD, 48 Hz): oyun saatinin ortancası 21,1–21,4 ms geliyor; 21,5 sınırı ara sıra aşılıp
  // kalite boş yere 'low'a iniyordu. Gerçek yavaşlık vsync'e kuantalanır (27,8 ms+), 22,6 güvenli.
  nativeMaxMs = 22.6,
  steadyMaxMs = 25.5,
  mildMs = 25.5,
} = {}) {
  let step = 0;
  let warm = 0;
  let sum = 0;
  let count = 0;
  let paused = false;
  let prevAverage = 0; // kademe düşürülmeden önceki pencere ortalaması
  let locked = false;  // 'işe yaramadı' kararından sonra kademe sabit
  let last = null; // son pencerenin ölçümü (tanı)
  const win = [];
  const resetWindow = () => { warm = 0; sum = 0; count = 0; win.length = 0; };
  return {
    get step() { return step; },
    get last() { return last; },
    get locked() { return locked; },
    /** Kademe değişince / görünürlük dönüşünde ısınmayı yeniden başlat. */
    reset: resetWindow,
    setPaused(next) {
      const value = Boolean(next);
      if (paused !== value) { paused = value; resetWindow(); }
    },
    setStep(next) {
      step = Math.max(0, Math.min(maxStep, Math.round(Number(next) || 0)));
      locked = false; prevAverage = 0;
      resetWindow();
    },
    sample(dtMs) {
      if (paused || locked) return false;
      const dt = Number(dtMs);
      if (step >= maxStep || !(dt > 0) || dt > ignoreAboveMs) return false;
      if (warm < warmupFrames) { warm++; return false; }
      sum += dt;
      count++;
      win.push(dt);
      if (count < windowFrames) return false;
      const average = sum / count;
      // 48/50 Hz ekran (pil modundaki dizustu): karelerin ORTANCASI ekranin kendi araligidir (~20-20,8 ms); bu yavaslik degil.
      // Ortanca nativeMinMs..nativeMaxMs araligindaysa ve ortalama steadyMaxMs'i asmiyorsa kademe dusurulmez
      // (gercek yavaslik vsync'e kuantalanir: ortanca 27,8 / 33,3 / 41,7 ms olur).
      const median = win.sort((a, b) => a - b)[win.length >> 1];
      // Tek tuk sapma (cop toplama, sekme arkasi) ortalamayi sisirir; karelerin en az %80'i ekran araligindaysa duzgun sayilir.
      const onPace = win.filter(x => x <= median * 1.5).length / win.length;
      const steady = median >= nativeMinMs && median <= nativeMaxMs && (average <= steadyMaxMs || onPace >= 0.8);
      last = {average: Math.round(average * 10) / 10, median: Math.round(median * 10) / 10, onPace: Math.round(onPace * 100) / 100, steady, step};
      sum = 0;
      count = 0;
      win.length = 0;
      if (average <= slowMs || steady) return false;
      // Kademe düşürmek işe yaramadıysa (darboğaz ekran kartı değil: ölçüm 15 Kas 2026, Intel UHD — çözünürlük ve 'low'
      // kare süresini 23,5 ms'den indirmedi) ve yavaşlık hafifse: son kademeyi GERİ AL ve orada kal. Görüntü boş yere bozulmaz.
      if (step > 0 && prevAverage && average <= mildMs && average > prevAverage * 0.92) {
        step--; locked = true; warm = 0; prevAverage = 0;
        return true;
      }
      prevAverage = average;
      step++;
      warm = 0;
      return true;
    },
  };
}
