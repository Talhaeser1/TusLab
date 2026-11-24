# Devir notu — Ana ekran / dersler sohbeti (son güncelleme: 24 Kas 2026, Terazi)

Yeni sohbetin ilk mesajı: "docs/DEVIR-ANA-EKRAN.md'yi oku, 1. maddeden başla."

## Çalışma kuralları
1. Yalnız `home/`, `assets/home/` ve ilgili `tests/home-*.test.mjs` dosyalarına dokun. `pvp/`, `cloudflare/`, `index.html` değişmez.
2. Bir seferde tek madde; test (`node --test tests/*.test.mjs`, 24 Kas Hakem: 1195/1195) + tarayıcıda
   `http://127.0.0.1:5177/index.html` ekran görüntüsü; sonra commit (push yok).

## Durum
- Ana ekran "Sahne" (docs/18, docs/19): solda başlık + canlı satır + 4 sayı, sağda 5 kartlık bento. 3B yok.
- Dört görünüm (Yazma, Klavye Dersleri, Şiir & Atasözü, Performans) aynı başlık satırını ve aynı içerik genişliğini
  (1272 px) kullanır; "← Merkez" içeriğin sol kenarıyla hizalı (docs/23).
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
5. (Hakem, docs/25) Şiir & Atasözü menüsü (5 kart) geniş ekranda sayfanın üst üçte birini dolduruyor, alt kısım boş.
   Yeniden tasarım kararı kullanıcıda (ör. kartların altına "son yazdıkların / türe göre en iyi hız" şeridi).
6. (Hakem) Ana site sesi (`tuslab-home-v1.sound`) ile PvP sesi (`tuslab-pvp-sfx-muted`) ayrı anahtar: birinde kapatınca
   öbüründe açık kalıyor. Ortak tek düğme mi olsun, kullanıcı kararı.

## Kullanıcı kararı bekleyenler
- Silinen 51 atasözü zinciri; emin olunmayan metinler (docs/RAPOR-DERSLER-METIN-AKISI.md §4).

## Okunacak raporlar
docs/18, 19, 21, 23 ve RAPOR-DERSLER-METIN-AKISI.md
