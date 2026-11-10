/**
 * TuşLab PvP / paket 31 — Partner desteği (assist) kuralları.
 *
 * Her oyuncunun partneri diğer karakterdir (ateş ↔ rün). Doğru kelimeler "destek barını"
 * doldurur; bar doluyken yazılan bir sonraki DOĞRU kelime partnerin kısa destek saldırısını
 * tetikler. Ek tuş yoktur; bar, tetikleme ve hasar yalnız maç motorunda (sunucu / yerel bot
 * motoru) hesaplanır. İstemci bu dosyayı yalnız etiket ve önizleme için kullanır.
 *
 *   max         bar tavanı (0..100)
 *   correct     doğru kelime başına dolum
 *   wrong       yanlış kelime başına kayıp (0'ın altına inmez)
 *   damageDiv   alınan hasar / damageDiv kadar ek dolum (geri dönüş payı) …
 *   damageCap   … vuruş başına en fazla bu kadar
 *   damage      destek saldırısı hasarı (baseHp canlı klasik maçta); tur modunda maxHp oranıyla ölçeklenir
 *   cooldownMs  iki destek arasındaki en kısa süre
 */
export const ASSIST_RULES = Object.freeze({
  max: 100, correct: 12, wrong: 10, damageDiv: 20, damageCap: 8, damage: 70, baseHp: 2000, cooldownMs: 6000,
});

/** Lobi/oda ayarı: yalnız açıkça `false` kapatır (varsayılan AÇIK). */
export const normalizeAssist = value => value !== false;
/** Kablo üzerinden yalnız boolean kabul edilir. */
export const isAssistPayload = value => typeof value === 'boolean';
/** Partner = diğer karakter. */
export const assistPartner = character => (character === 'rune' ? 'fire' : 'rune');
export const PARTNER_NAMES = Object.freeze({fire: 'Alev Celladı', rune: 'Rün Muhafızı'});
export const partnerName = character => PARTNER_NAMES[assistPartner(character)];

/** Destek hasarı, savunanın azami canına göre ölçeklenir (2000 → 70, 1200 → 42). */
export function assistDamage(maxHp) {
  const hp = Number(maxHp) > 0 ? Number(maxHp) : ASSIST_RULES.baseHp;
  return Math.max(1, Math.round(ASSIST_RULES.damage * hp / ASSIST_RULES.baseHp));
}
/** Alınan hasarın bara katkısı: floor(hasar / 20), vuruş başına en fazla +8. */
export function assistGainFromDamage(dealt) {
  const d = Number(dealt);
  return d > 0 ? Math.min(ASSIST_RULES.damageCap, Math.floor(d / ASSIST_RULES.damageDiv)) : 0;
}
