# 07 — Ara Ekranlar

Son güncelleme: 13 Kasım 2026

## Kullanıcının kuralı
KESINYAP kural 4: VS, raund arası ve sonuç ekranlarında o maçta oynayan karakterlerin kendi görselleri (Higgsfield portreleri) kullanılır.

## Şu an oyunda olan
### VS ekranı (maç başı)
- İki dövüşçü iki yandan kayar, ortada VS çarpar. Zemin: `vs-zemin.webp` (sol ateş, sağ buz).
- Yazılar: oyuncu adı, karakter adı, unvan, "ARENA: <arena adı>". Portre alt ve yan kenarlarda zemine erir.
- Portre = seçilen karakter (data-portrait ile doğrulandı).

### Raund arası bandı (rounds)
Tek yatay bant, alt-orta, en çok 960 px:
- Etiket; solda "Rakip vurdu", sağda "Sen vurdun" ve tek satır hasar; yalnız tavanda "tavan" rozeti; "n doğru · n yanlış · seri n".
- 7 parçalı raund şeridi; sıradaki raund / ipucu.
- Üç beceri tek satırda (tuş, ad, açıklama, "2 hak"); 1/2/3 seçer, Enter kilitler, Esc "Seçme"yi kilitler.
- Geri sayım bandın içinde: "Raund 5 başlıyor 2". Süre: özet 6 sn, giriş 3 sn.
- Kural: kart ve geri sayım, bütün saldırı sahneleri bitmeden açılmaz.
- Kazanan renginde ışık süpürmesi, zafer/yenilgi tonu, NAKAVT rozeti, "SEN KAZANDIN" başlığı.

### Sonuç ekranı
- Tam ekran sahne. Arka plan: zafer `sonuc-zafer.webp`, yenilgi `sonuc-yenilgi.webp`, berabere/iptal `ekran-raund-banner.webp`.
- Başlık: ZAFER / YENİLGİ / BERABERE / MAÇ İPTAL. Bitiş nedeni: NAKAVT, SÜRE DOLDU, TESLİM OLMA, BAĞLANTI HÜKMEN YENİLGİ vb.
- Adlar tam yazılır (kısaltma yok); kazanan portresi büyük (~%46 yükseklik), kaybeden küçük (~%34).
- Oyuncu satırı: WPM, doğruluk, hasar, doğru/yanlış, en yüksek seri, Q/E/R. Raund raund hasar şeridi (arena 5 sütun), "En yüksek seri / En çok hasar".
- Blok/savuşturma/karşı saldırı satırları ve emoji yok.
- Düğmeler: "Rövanşa başla" (bota karşı) / "Rövanş iste", "Odadan çık", "Raund dökümü".

## Planlanan / sırada (henüz kodda yok)
- Sonuç ve bant için mürekkep ve cel dili; taraf renkleri (bkz. 01).
- Zafer repliği yalnız kazanana (kural zaten var, bkz. 10).

## Yeni bir şey eklerken uyulacaklar
- [ ] Yeni karakterin VS ve sonuç portresi yüklü ve ölçülür.
- [ ] 1920x1080, 1366x768, 1366x650, 375x812: kaydırma 0, düğmeler görünür, kontrast en az 8:1.
- [ ] Yazı 12 px altına inmez.

## Kodda nerede
- `pvp/cinematic.js/.css` (VS), `pvp/rounds-ui.js/.css` (raund arası), `pvp/phase15-results.js/.css` (sonuç), `pvp/results-v2.css`
- `assets/higgsfield/final/` (`vs-zemin`, `sonuc-*`, `ekran-*`); testler `tests/pvp-raund-bant.test.mjs`
