# 01 — Oyun Atmosferi

Son güncelleme: 13 Kasım 2026

## Kullanıcının kuralı
Kullanıcının 12 Kasım 2026 gecesi yazdığı not (aynen; çelişkide bu geçerlidir):

> biraz anime oyunlarına benzer ama farklı bi atmosfer de cille çizgi filmi gibi 2d ama 3d karakteler ve animasyonları
>
> her haritanın farklı bi atmosferi olması lazım mesela uzak arenası mezarlık gibi
>
> haritalar da bi tane arane olsun karakterlerin savaşacağı birde arka plan olsun arkda plan genelde hareketli olsun dumanlar yapmurlar uzayda arkadan geçen uzat araçları vs

## Şu an oyunda olan
- **Dünya:** TuşLab "Ruh Düellosu": iki dövüşçü, klavyeyle yazarak savaşır. Karakterler 3B modeldir (glb).
- **Ton:** ciddi destan; karakter kimlikleri efsane havalı (kuzey balta ustası, çöl iz sürücüsü, kale muhafızı, rün kâhini, Konya ney ustası). Şaka yok, ama Hacı Usta'da yerel mizah (etli ekmek) var.
- **İki taraf rengi:** Ateş tarafı (Vargr, Sira) sol, Rün tarafı (Doran, Nyx, Hacı Usta) sağ görünür; VS zemininde sol ateş, sağ buz.
- **Arayüz:** koyu zemin, ince çerçeveli paneller, eğik can barları, altıgen yetenek rayı. Yazı tipi: sistem yazısı (system-ui / Segoe UI); ZAFER/YENİLGİ başlıklarında Impact.
- **Görseller:** Higgsfield ile üretilmiş tam ekran zeminler ve portreler (webp). Müzik: Anadolu müziği varsayılan; ayrı lobi, savaş, gerilim, ulti, zafer, yenilgi parçaları.
- **Karakter renkleri** `02-karakterler.md` içinde; her arenanın renk paleti `08-arenalar.md` içinde.

## Planlanan / sırada (henüz kodda yok)
- **"Mürekkep ve cel" arayüz dili:** kalın kontur, düz dolgu, kesik köşe, ofset gölge.
- Her taraf kendi karakter rengini arayüzde taşır (can barı, seri, yetenek rayı, sonuç).
- Cel çizgi film hissi için model gölgelendirmesi (kalın dış çizgi, basamaklı ışık) — henüz yok.
- Her haritaya ayrı atmosfer ve hareketli arka plan (bkz. 08).

## Yeni bir şey eklerken uyulacaklar
- [ ] Yeni görsel, kimlik, tonla uyumlu mu (destan; karakterin kendi dünyası)?
- [ ] Renk: karakterin ana ve vurgu rengi, iki tarafla karışmıyor mu?
- [ ] Yazı en az 12 px; kontrast okunur (ölçülen hedef 4,5:1 ve üstü).
- [ ] Telif: yalnız özgün veya lisanslı görsel; model lisansı karakter klasöründeki LISANS.txt'te.
- [ ] Mevcut karakter/arena görselini değiştirmeden ekle; mdler ve `docs/EKRAN-KONTROL-KURALLARI.md` kontrolünü yap.

## Kodda nerede
- Renkler: `pvp/shared/fighters.js` (palette), `pvp/shared/stages.js`
- Stil dosyaları: `pvp/*.css` (ör. `lobby-v3.css`, `fight-hud.css`, `phase15-results.css`)
- Görseller: `assets/higgsfield/final/`; modeller: `assets/models/`; müzik: `assets/music/`
