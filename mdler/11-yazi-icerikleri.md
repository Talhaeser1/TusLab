# 11 — Yazı İçerikleri

Son güncelleme: 13 Kasım 2026

## Kullanıcının kuralı
KESINYAP kural 1: "Metin her zaman değişir. Yazılan içerik her elde, her raundda ve her maçta farklıdır. Aynı maçta tekrar yok; yeni maç bir öncekiyle aynı içerikle başlamaz. Atasözü ve şiirde parça kendi içinde sırayla yazılır, ama hangi atasözü/şiirin geleceği her seferinde karışır."

## Şu an oyunda olan
| Mod | Ne yazılır | Parça sayısı | İpucu |
|---|---|---|---|
| Kelime (varsayılan) | kelime bankasından | 863 kelime | yok |
| Atasözü | atasözleri, kelime kelime sırayla | 182 (60'ı uzun/zor) | yok |
| Şiir | eski şiir dizeleri, sırayla | 114 dize | şair adı (varsa başlık) |
| Osmanlıca | Osmanlıca kelime | 210 | günümüz karşılığı; yazılan yalnız kelime |

- Osmanlıcada raund ilerledikçe kelimeler uzun/zor olur.
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
- Test: `tests/pvp-icerik-tekrar.test.mjs`
