# 05 — Seçim Ekranı (Lobi)

Son güncelleme: 13 Kasım 2026

## Kullanıcının kuralı
Bu konuda ayrı kullanıcı dosyası yok. Geri bildirim (12 Kasım): lobi kutusuz, kaydırmasız tek ekran "sahne" olsun; Hacı Usta portresi simsiyah olmasın.

## Şu an oyunda olan
Lobi tek ekranlı bir sahnedir (modal değil). Arka plan `lobi-sahne.webp`.

| Parça | Ne yapar |
|---|---|
| Mod şeridi (üstte) | klasik, zamana karşı, kelime raundu, arena; atasözü, şiir, Osmanlıca içerik modları |
| Karakter dock'u | beş yuvarlak madalyon (ikon), seçilen karakterin büyük portresi ve bilgi kartı |
| Arena seçimi | arena yelpazesi ve sağda eğik pencere; dört arena + Rastgele; zemini değiştirmez, pencere 300 ms geçişle değişir |
| Maç ayarları | bot zorluğu (Kolay/Orta/Zor), içerik modu, segment düğmeleri |
| Arkadaşla oyna | çekmecede; oda oluştur / katıl |
| Savaşa başla | seçilen karakter, mod ve zorlukla maçı başlatır |

### Klavye
- Sol/Sağ ok: karakter değiştirir (5 karakter); arena tekerleğinde arena; mod şeridinde mod.
- Tab sırası: mod, karakter, arena, ayar, başlat.
- Enter: bot maçını başlatır. Esc: çekmeceyi/alt sayfayı kapatır. Çekmecede Tab içeride döner.

### Telefon görünümü
Yetenekler ve Ayarlar alt sayfa olarak açılır; arena için ‹ › düğmeleri; dokunma hedefi en az 44 px.

### Ölçülen kalite
1920x1080, 1366x768, 1366x650, 768x1024, 375x812: kaydırma yok, çakışma 0, 12 px altı yazı 0, kontrast 4,5:1 ve üstü (KESINYAP 10).

### Adres kısayolları
Karakter `?karakter=konyali`; bot `?bot=`; sahne `?stage=`.

## Planlanan / sırada (henüz kodda yok)
- "Mürekkep ve cel" dili lobiye uygulanacak (bkz. 01).
- Yeni 4 yetenek bilgi kartında gösterilecek (bkz. 03).

## Yeni bir şey eklerken uyulacaklar
- [ ] Yeni karakter madalyonu, portresi (görünür parlaklık, siyah değil) ve bilgi kartı eklenir.
- [ ] Yeni arena kartı + pencere görseli eklenir.
- [ ] Kaydırma çıkmaz; odak sırası bozulmaz; telefonda 44 px hedef.
- [ ] `docs/EKRAN-KONTROL-KURALLARI.md` listesi uygulanır; bu belge güncellenir.

## Kodda nerede
- `pvp/network.js` (lobi işaretlemesi, klavye), `pvp/lobby-v3.css` ("J2 SAHNE"), `pvp/practice.js`
- `pvp/portraits.js`, `assets/higgsfield/final/lobi-sahne.webp`, `lobi-afis.webp`
