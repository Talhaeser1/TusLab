# Devir notu — Ana ekran / dersler sohbeti (son güncelleme: 24 Kas 2026, Derleyici)

Yeni sohbetin ilk mesajı: "docs/DEVIR-ANA-EKRAN.md'yi oku, 1. maddeden başla."

## Çalışma kuralları
1. Yalnız `home/`, `assets/home/` ve ilgili `tests/home-*.test.mjs` dosyalarına dokun. `pvp/`, `cloudflare/`, `index.html` değişmez.
2. Bir seferde tek madde; test (`node --test tests/*.test.mjs`, 24 Kas Derleyici: 1202/1202) + tarayıcıda
   `http://127.0.0.1:5177/index.html` ekran görüntüsü; sonra commit (push yok).

## Durum
- Ana ekran "Sahne" (docs/18, docs/19): solda başlık + canlı satır + 4 sayı, sağda 5 kartlık bento. 3B yok.
- Dört görünüm (Yazma, Klavye Dersleri, Şiir & Atasözü, Performans) aynı başlık satırını ve aynı içerik genişliğini
  (1272 px) kullanır; "← Ana Sayfa" içeriğin sol kenarıyla hizalı (docs/23). Kullanıcıya görünen ad her yerde "Ana Sayfa" (docs/26).
- Şiir & Atasözü tür menüsü bento (docs/26): üstte başlık + "Günün sözü" şeridi, 2 büyük + 3 orta tür kartı, altta
  "Son yazdıkların" ya da ipucu; ok tuşlarıyla gezinilir. Günün sözü gün içinde sabit, ana ekran kartıyla aynı (`dailyQuote`).
- Ses: ana site ve PvP tek anahtarı paylaşır (`localStorage['tuslab-ses']` = 'on'/'off'; docs/26).
- Performans bir pano (docs/23): özet + seviye, hız/doğruluk grafiği (tür süzgeci, değer kutusu), görevler, 7/30 gün
  etkinlik şeridi, zorlanılan tuşlar (ekran klavyesi ısı haritası), son yazışlar, rozet vitrini.
- Yazma: metin bitmeden çıkış "biten metin" sayılmaz; Kelime'de Esc önce sonuç kartı; sekme gizlenince süre durur.

## Açık sorunlar (sırayla)
1. L07 dersinde uygun gerçek kelime az (30), kalanı sözde-kelime (içerik işi; metin uydurulmaz, kullanıcı/editör kararı).
2. Gerçek telefon, gerçek dokunmatik, ekran okuyucu ve gerçek `prefers-reduced-motion` ayarıyla hiç denenmedi
   (yalnız 390×844 / 360×740 emülasyonu ve CSS kuralları).
3. Sekme gizlenmesi tarayıcı panelinde gerçek olarak denenemedi (panel sekmeleri hep "visible"); `document.hidden`
   taklidiyle ve birim testiyle doğrulandı. Gerçek sekme değiştirerek bir kez bakılmalı.
4. Yazma akışında "biten metin" sayacı hâlâ oturum başına 1 artar (en az bir parça bittiyse), parça başına değil.
   Parça başına saymak XP'yi şişirir; karar verilmedi (docs/23 "şöyle yorumladım").
5. (Derleyici, docs/26) Ortak ses anahtarının PvP tarafı "Nişancı" ajanında; iki yönlü uçtan uca deneme (ana sitede kapat →
   PvP'de kapalı gelir ve tersi) PvP işi bitince bir kez yapılmalı. Ana site tarafı denendi.
6. "Son yazdıkların" şeridi yalnız bu sürümden sonraki oturumlarda metin gösterir (eski kayıtlarda yalnız "N metin").
7. Ana ekran "Günün sözü": yazar adı artık ikinci satıra iniyor; ama sözün kendisi 1280×720'de uzun sözlerde (≈60+ harf)
   iki satırda üç noktayla kısalıyor (önceden de böyleydi, bilinçli satır sınırı). İstenirse havuz üst sınırı 72 → 56 harf.

## Kullanıcı kararı bekleyenler
- Silinen 51 atasözü zinciri; emin olunmayan metinler (docs/RAPOR-DERSLER-METIN-AKISI.md §4).

## Okunacak raporlar
docs/18, 19, 21, 23, 26 ve RAPOR-DERSLER-METIN-AKISI.md
