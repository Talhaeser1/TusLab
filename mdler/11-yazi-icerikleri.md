# 11 — Yazı İçerikleri

Son güncelleme: 15 Kasım 2026

## Kullanıcının kuralı
KESINYAP kural 1: "Metin her zaman değişir. Yazılan içerik her elde, her raundda ve her maçta farklıdır. Aynı maçta tekrar yok; yeni maç bir öncekiyle aynı içerikle başlamaz. Atasözü ve şiirde parça kendi içinde sırayla yazılır, ama hangi atasözü/şiirin geleceği her seferinde karışır."

## Şu an oyunda olan
| Mod | Ne yazılır | Parça sayısı | İpucu |
|---|---|---|---|
| Kelime (varsayılan) | kelime bankasından | 863 kelime | yok |
| Atasözü | atasözleri, kelime kelime sırayla | 216 (sürüm 2; hepsi ≥ 4 kelime ve ≥ 28 karakter, 36 tanesi ≥ 7 kelime) | yok |
| Şiir | eski şiir dizeleri, sırayla | 114 dize | şair adı (varsa başlık) |
| Osmanlıca | Osmanlıca kelime | 363 (sürüm 2; hepsi ≥ 5 harf, 273 yeni zor kelime 7–15 harf) | günümüz karşılığı; yazılan yalnız kelime |

- Osmanlıcada 1. raund havuzun ortasından başlar (ort. ~7,5–8 harf), raund ilerledikçe en uzun kelimelere çıkar (7. raund ort. ~10,5 harf). Aynı maçta tekrar yok.
- Zorlaştırma (15 Kas 2026, "atasözlerini ve osmanlıca kelimeleri zorlaştır"): Osmanlıcada 5 harften kısa ve günlük dilde çok bilinen kelimeler (şehir, zaman, vatan...) çıktı; atasözünde 4 kelimeden / 28 karakterden kısalar ("Balık baştan kokar.") çıktı. Yeni eklenen kelime/atasözlerinde şapka (â/î/û) yok.
- Sıralı içerikte (atasözü, şiir) raund, önceki raundun kaldığı yerden devam eder.
- Tohumla karışım: sunucu ve tarayıcı aynı sonucu üretir. Klasik cümleler tohumlu; zamana karşı uzatma tekrarsız.
- Seçim lobide mod şeridinden yapılır.

## Planlanan / sırada (henüz kodda yok)
- Yeni içerik modu eklemek serbest (örneğin deyim); şu an plan yok.
- Zor atasözleri tamamlandı (KESINYAP 17); yeni zorluk dilimi planı yok.

## Yeni bir şey eklerken uyulacaklar
- [ ] Yeni içerik saf ES modülü; sunucu ve istemci aynı dosyayı kullanır.
- [ ] Tekrar yok; tohumlu karıştırma testi yazılır.
- [ ] Yalnız Türkçe karakterler doğru yazılır; telif sorunu olan metin eklenmez (şiirde şair adı ipucu).
- [ ] Mod `CONTENT_MODES` ve lobi etiketine eklenir; bu belgedeki sayılar güncellenir.

## Kodda nerede
- `pvp/shared/content-modes.js`, `content-atasozu.js`, `content-siir.js`, `content-osmanlica.js`, `pvp/shared/words.js`
- Test: `tests/pvp-icerik-tekrar.test.mjs`, `tests/pvp-icerik-zor.test.mjs`
