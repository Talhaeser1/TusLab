# TuşLab PvP — İş Paketi 22/25: Savaş Mekanikleri Mimarı

## Eklenenler
- Lobi: klasik dövüş dahil 7 adet seçilebilir rün; sunucu `RUNE_SELECT` ile doğrular, iki tarafın hazır olma durumu sıfırlanır.
- `match.js`: karaktere özel güçler, sunucu otoriteli rün etkileri, Q→E / E→R / Parry→Q etkileşimleri.
- Alev Celladı: doğru kelime serisinde Kızıl Öfke. Rün Muhafızı: Mühür Birikimi ve E güçlendirme.
- HP düşükken tek kullanımlık Son Direniş; refleks, kalkan cooldown ve diğer rün bonusları.
- Yetenek etkileri bir kere hesaplanır; üç aşamalı R bonusu son darbeye bir kez eklenir.
- Maç ekranında rün ve enerji göstergesi.

## Güvenlik ve sınırlamalar
- İstemci bir rune adı seçebilir ama hasar/buff miktarı bildiremez.
- Rün seçimi sadece waiting/countdown evresindedir. Geçersiz kimlikler reddedilir.
- Eskiden kaydedilmiş maçlarda rün `none` sayılır, eski hasar korunur.
- Bu tasarım ilk denge sürümüdür; gerçek internet maçlarında denge henüz ölçülmedi. Çoklu rün seçim sistemi yok; maç başına tek seçim var.
- Canlı Cloudflare yayını yapılmadı.

## Test
`npm test` — 175/175 başarılı.
`npm run cf:validate` — 49/49 başarılı.
Yerel iki gerçek WebSocket istemcisi ve farklı ağlardan canlı test henüz yapılmadı.

## Başlat
`npm install` ardından `npm run cf:dev` ve http://127.0.0.1:8787/.
