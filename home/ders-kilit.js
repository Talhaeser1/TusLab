// TuşLab — ders kilidi kuralları (saf, DOM yok). lessons.js bunları kullanır ve dışa da verir.
// Ayrı dosya: ana ekran (home.js) açılışta yalnız bunu yükler; lessons.js (ve onun 104 KB'lık kelime havuzu
// data/words.js) ancak Klavye Dersleri açılınca iner.
import * as LD from './data/lessons.js';

const LESSONS = LD.LESSONS || [];

export function lessonRec(all, id) {
  return (all && all.lessons && all.lessons[id]) || { stars: 0, bestWpm: 0, bestAcc: 0 };
}

// Açık ders: ilk ders, önceki dersi yıldızlı olan ders ya da daha önce kaydı olan (açılmış) ders.
// Zorluk artsa da kayıtlı ilerleme (sec.egitim.lessons[id]) kimseyi kilitlemez.
export function lessonUnlocked(all, i) {
  if (i <= 0) return true;
  const prev = LESSONS[i - 1];
  if (prev && lessonRec(all, prev.id).stars >= 1) return true;
  const own = LESSONS[i] && all && all.lessons && all.lessons[LESSONS[i].id];
  return !!own && ((own.stars || 0) > 0 || (own.bestWpm || 0) > 0);
}

// Ana ekrandaki "Kaldığın ders" düğmesi ctx.intent = { lesson: 'L07', index: 6 } gönderir.
// Geçerli ve açık bir dersse o dersin sırasını, değilse -1 döndürür (o zaman ders haritası açılır).
export function intentLessonIndex(intent, all) {
  if (!intent || typeof intent !== 'object') return -1;
  let i = typeof intent.lesson === 'string' ? LESSONS.findIndex((l) => l.id === intent.lesson) : -1;
  if (i < 0 && Number.isInteger(intent.index) && LESSONS[intent.index]) i = intent.index;
  if (i < 0) return -1;
  return lessonUnlocked(all || {}, i) ? i : -1;
}
