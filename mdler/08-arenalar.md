# 08 — Arenalar

Son güncelleme: 13 Kasım 2026

## Kullanıcının kuralı
Kullanıcının notu (aynen; tam metin 01'de): "her haritanın farklı bi atmosferi olması lazım mesela uzak arenası mezarlık gibi" · "haritalar da bi tane arane olsun karakterlerin savaşacağı birde arka plan olsun arkda plan genelde hareketli olsun dumanlar yapmurlar uzayda arkadan geçen uzat araçları vs"

## Şu an oyunda olan
Dört arena + "Rastgele" (maç başında dörtten biri). Arena yalnız görsel/atmosferdir; hasar ve dengeyi değiştirmez.

| Arena | Atmosfer | Renkler (gök / zemin / vurgu / kenar) | Hava ve hareket |
|---|---|---|---|
| Neon Kolezyum | neon halkalı klasik meydan | #0b1020 / #1b2140 / #ff4fd8 / #4fd8ff | 3B kolezyum yapısı (arena3d.js); ek hava yok (doğrulanmadı) |
| Gök Demirhanesi | bulut üstü ada, lav dökümhanesi | #1a0d0a / #2a1712 / #ff7a1a / #ffc163 | süzülen kayalar (3), kıvılcım (300; düşük kalitede 120), kırmızı sis |
| Rün Bahçesi | gece bahçesi, parlayan rün taşları, ağaç siluetleri | #070b1c / #101a2a / #35e0d0 / #a070ff | ateş böcekleri (200; düşük 80), rün taşları parlar |
| Fırtına Limanı | yağmurlu gece limanı, iskele | #060d18 / #0e1a28 / #6fb6ff / #e8f4ff | yağmur (1200; düşük 500), 6-12 sn'de bir şimşek |

- Sis yoğunlukları: Gök Demirhanesi 0,027; Rün Bahçesi 0,035; Fırtına Limanı 0,033.
- Hareketsizleştir (azaltılmış hareket) ayarında hava efektleri kapanır.
- Lobi pencere görselleri: `arena-neon-kolezyum`, `arena-gok-demirhanesi`, `arena-run-bahcesi`, `arena-firtina-limani` (.webp).
- Her arenanın müzik anahtarı arena adıdır.

## Planlanan / sırada (henüz kodda yok)
- Kullanıcı kuralı: her haritaya ayrı atmosfer ve hareketli arka plan — duman, yağmur, uzayda geçen araçlar. Yağmur (Fırtına Limanı) ve kıvılcım var; duman ve uzay araçları yok.
- "Uzak arena mezarlık gibi" tasarımı kodda yok; yeni arena olarak düşünülür.
- Yeni arena için yeni kimlik, palet ve arka plan eklenmeli (şu an 4 sabit).
- Zemin hasarı (çatlak/krater) arena yüzeyinde (bkz. 09).

## Yeni bir şey eklerken uyulacaklar
- [ ] Benzersiz kimlik, ad, kısa açıklama, 5 renk (sky, fog, floor, accent, rim) tanımla.
- [ ] Mevcut dört haritadan farklı atmosfer + en az bir hareketli arka plan öğesi.
- [ ] Düşük kalite ve azaltılmış hareket için sayı belirle.
- [ ] Lobi kartı + pencere görseli + müzik anahtarı ekle.
- [ ] Hasar/denge değişmez. Bu belgeyi güncelle.

## Kodda nerede
- `pvp/shared/stages.js` (liste, paletler), `pvp/stages3d.js` (hava, sis, gök), `pvp/arena3d.js` (kolezyum)
- `pvp/network.js` (arena kartları), `assets/higgsfield/final/arena-*.webp`
