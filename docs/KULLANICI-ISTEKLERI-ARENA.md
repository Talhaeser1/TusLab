# Kullanıcı istekleri — Arena modu (8 Kasım 2026, kelimesi kelimesine)

> Bu metin oyun sahibinin isteğidir. Tüm ajanlar bunu esas alır. Yorumlar `docs/ARENA-MODLARI.md` içinde yapılır.

```
arena modu
raund raund olucak ilk round 5 tane kelime verilicek 5 tane kelimeyi ilk kim yazarsa raund biter sonra kimler ne kadar doğru yazmış o kontrol edilir eğer bi tane doğru geri kalan yanlış sa bi tane lik hasar vururlur eğer iki tane doğruysa ona göre hasar vurulucak ( bu sistemi 3 tane ajan kontrol etsin onlar geliştirsin raund sistemini vs.) eğer mesela 1 doğru 2. 3. 4. yanlış 5. doğru ise 1. nin tam hasarı vurulur ama sonra yanlış çarpanı olur 0.1 2. de yanlış 0.15 3. de yanlışl 0.23 olur ve 5. nin hasaruı bu oranda düşürülür (hasasr vs bnlar da bi ajan vbaksın ve büyün ajanlar ne yaptıklarını rapor etsin) böyle ilk raound biter sonra ikinci raund 10 kelime sonra 15 sonra 15 sonra 15 die devam eder son raund 20 kelime olur ona göre gasarlar çıkar maks kombo hasarı 4 tane ard arda olur sa ama sorna sonda da çarpan olsun eğer 5 tane ise 4 tane lik kombo vurulsun 5. de çarpanlı bir hasar versin gibi

bide hasarlar verilmeden once de eşyalar olsun mesela kombolar daha fazla vur eğer üst üste yanlış yaparsan onalrın bi sonraki vuruşa vericeği azaltma katmaın kaldırsın vs. bide raunda başlamadn da skiller olsun rakibin yazmasını engellicek (mesela yazıcağı kelimler de ki hjarflerin yerleni değiştiricek mesela karpuz zurpak olucak onu yazmak zorunda) buna da ajanlar ata bide yazma ekranı da düzenlensin sayfaa da güzel bi yerde dursun sorna alta insin fight lar başlasın ve bunlar içijn ajanlar tut her bir göreve bi ajan baksın ve onalrı denetleyen bi ajan olsun ve skilller kullanın

mesela aklıma geldi raund başlamadan öncekli skliller ekstra süre ekle karşı taraf bitirse normalde raund biter ama ona 5 saniye daha eklensin gibi ve bana ilk once fikirleri yaz neler yapılıcak onlar dan bahset bu sayfa raund öncesi sornasi kullancıılıcak skilleri raund sitemi gibi bölümlere ayrılsın

arena zaman a karşı olsun o da mesela 30 sanite de kim ne kadar yazarsa oyle olsun bu sistemi ona entegrae et mesela onda da karşısında kinden eksi 5 sniye siler yada zamanı göremesin yada kendi zamanını dondruırsun gibisinden ama bunların hepsi ii,n birere ajanoolucak
```

## Önceki istekler (hâlâ geçerli)
- Kelimeler hep aynı olmasın, iki tarafa aynı kelimeler verilsin; ana sayfada da değişsin. (yapıldı: `pvp/shared/words.js`)
- Ulti rakibi ortaya (VS) çeksin, hasar versin, geri fırlatsın. (yapıldı: `pvp/arena3d.js`)
- Arka plan arenada gibi olsun. (yapıldı: kolezyum)
- Siyah ekran olmasın. (düzeltildi, kullanıcı doğrulaması bekleniyor)
- 30 sn içinde kim ne kadar yazarsa tur sistemi (yapıldı: `docs/TUR-SISTEMI.md`) → artık **"Zamana Karşı" modu** olarak yeni skillerle genişletilecek.
