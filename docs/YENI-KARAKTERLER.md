# TuşLab Neon Arena — Yeni Özgün Karakterler (Tasarım Belgesi)

Sürüm 1.0 · 10 Kasım 2026 · Hazırlayan: Ajan K (GLM 5.3 / Evren) · Durum: **TASARIM — kod değişikliği yok**

Bu belde iki yeni savaşçının tam tasarımını ve uygulama planını içerir. Tasarım sözleşmesidir; motor,
arayüz veya varlık dosyaları bu belgeyle değişmez. Yalnızca `docs/YENI-KARAKTERLER.md` oluşturulmuştur.

## 0. Özgünlük ve yasal çerçeve

- Sahibin isteği: MOBA türünün **genel mekanik kalıplarından** (atılma, tekme, kalkan, ışın,
  sersemletme) ilham alan iki savaşçı. Tür ortak kalıpları telif kapsamında değildir; ancak hiçbir
  mevcut oyunun karakter adı, görünüşü, hikâyesi veya birebir beceri seti kullanılmaz ve bu belgede
  adı geçmez.
- Adlar, kimlikler, paletler, silüetler, beceri adları ve tüm sayısal değerler bu proje için
  üretilmiştir. İç kimlikler (`bora`, `pulsar`) İngilizce kod anahtarıdır (mevcut `fire`/`rune`
  üslubuyla uyumlu) ve herhangi bir üçüncü taraf karakterine gönderme içermez.
- Beceri adları kısa Türkçe adlardır; arayüz metinleri Türkçe kalır.

## 1. Sisteme uyum ilkeleri

- **Tetik:** Beceriler tuşla basılmaz; doğru kelime yazıldıkça dolar. Klasik mod: 5 kelimelik
  döngüde Q=2, E=4, R=5. doğru kelime. Tur modu: seri 3/5/7 → Q/E/R (8/9/10 → Q). Bekleme:
  Q 1300 / E 2500 / R 4500 / S 2500 ms.
- **Döngü dengesi:** Mevcut iki savaşçının 5 kelimelik döngü hasarı 585'tir (fire 105+175+305,
  rune 95+185+305). Yeni karakterler de **tam 585** verir; motorun `ULTIMATE_PHASES` değişmezi
  (3 aşama, aşama toplamı = R hasarı; aksi halde modül yüklenmezken `throw`) aynen korunur.
- **S (siper):** Herkesin ortak tepkisel kalkanıdır (yazma penceresi 250 ms, %30 olasılık, mükemmel
  block 150 ms, parry 90 ms + %45, karşı saldırı 65 hasar / 180 ms gecikme, sersemletme 350 ms).
  Yeni karakterlerde S yalnızca tema ve görselle farklılaşır; sayısal olarak standart kalır.
- **Sırayla saldırı akışı:** Sahibin yeni isteğiyle hasarlar sırayla oynatılır (bir taraf saldırır,
  diğeri siper alır). Aşağıdaki "savunmada" notları bu akışı esas alır: gecikmeli vuruş ve savurma
  etkileri kuyruktaki çözülme zamanını kaydırır; yeni bir savunma kuralı eklenmez.
- **Arena modu:** Hasar formülleri karakterden bağımsızdır (arena-damage.js); yeni karakterler
  yalnızca palet/silüet/FX tanımıyla katılır, sayısal değişiklik gerektirmez.

## 2. Karakter A — Bozkır Pehlivanı (`bora`) — Dövüş Ustası

**Kimlik:** Bozkırın yel okulundan yetişen, ayaklarını kılıç gibi kullanan çıplak ayaklı bir pehlivan.
Gücünü nefes ve yel tekniklerinden alır: hava hilalleri fırlatır, yeri döver, rakibini geri savurur.
**Palet:** Yeşim yeşili ana (#2fbf9f), antik altın vurgu (#f2c14e), kalkan altın-sarı (#ffd166).
**Silüet:** Geniş duruş, çıplak ayak, sarılı bilek şeritleri, kısa yelek, uzun örgülü saç, kalın kuşak
kuşak uçları rüzgârda savrulur. Silah katmanı: sarılı diz/kol zırhı; muhafız katmanı: öne uzanan
kumaş kuşak kalkanı. Kahraman etiketi: **YEL** (lobi ikonu: 💨).

| Beceri | Tetik | Hasar | Olaylar | Savunmada |
|---|---|---|---|---|
| Q — Yel Tekmesi | 2. / 3. doğru | 105 | Bükülmüş hava hilali rakibe uçar. Bloklanmamış isabette saldırganda 12 sn geçerli `followUpUntil` işareti kalır; işaretliyken atılan sonraki Q **Atılma Vuruşu** olur: +35 hasar ("İkinci Tekme" etiketi), karakter rakibe doğru atılır, işaret tüketilir | Standart S; blok işaret bırakmaz |
| E — Demir Topuk | 4. / 5. doğru | 165 | Topuk yere iner, genişleyen toz halkası. Bloklanmamış isabette **400 ms sersemletme** (`staggerUntil`; parry'deki alanın yenisi): kurban yeni beceri üretemez | Standart S; tam blok sersemletmez |
| R — Fırtına Savurması | 5. / 7. doğru | 315 (3 aşama) | Atılım 60 (0 ms) → Dönme Tekmesi 105 (+240) → Savuran Tekme 150 (+520). Son aşama bloklanmadıysa **savurma**: savunanın kuyruktaki saldırılarının `resolveAt` değeri +350 ms gecikir, rig geri kayar (`KNOCKBACK` olayı) | Standart S; ultimatum savunması ilk aşamadan hatırlanır (mevcut `ultimateDefense` kuralı) |
| S — Nefes Yeleği | Tepkisel | 0 | Altın nefes aurası gövdeyi sarar, kuşak şeritleri sertleşir | Standart (250 ms pencere, %30, 650 ms süre) |

Zincir Q tam değerine ulaşmak için 10 doğru kelime gerekir (Q döngüsü 5 kelimede bir tekrarlar);
ortalama katkı +17,5/5 kelime ile sınırlıdır — rün bonuslarıyla üst üste binmez, koşulludur.

**2B görsel:** Q hilali: yeşim hilal sprite'ı (yalnız transform/opacity); Atılma: rig `translateX`
geçişi + solan iz şeridi. E: ölçeklenen toz halkası + kısa opacity flaşı. R: çekme → dönme → savurma
üçlemesi; savunan rig geri kayar. `prefers-reduced-motion` / `pvp4-reduced`: yalnız renk flaşları.
**3B:** PALETTE `bora` girişi; hilal = eğik torus dilimi mesh; atılma = pozisyon tween'i; savurma =
savunan rig z konumu 1,5 birim geri. **Ses:** Q bant geçirenli gürültü süpürmesi; E alçak top +
tok darbe; R yükselen davul roll + büyük çarpma; S kumaş hışırtısı + alçak üfleme.

## 3. Karakter B — Yıldız Yutan (`pulsar`) — Boşluk Büyücüsü

**Kimlik:** Yüzü görünmeyen, kolları huni gibi açılan uzun pelerinli bir kâhin; başının arkasında
parçalanmış yıldızlardan bir hale taşır. Işığı bükerek mızraklaştırır, yıldız tohumu ekip patlatır,
sonunda her şeyi yutan bir ışın kanallar.
**Palet:** Macenta ana (#ff4fa3), asit yeşili vurgu (#a8ff4f), kalkan macenta-buz (#ff9ad2).
**Silüet:** Uzun boy, kapüşon, yüz yerine koyu boşluk, geniş kollar, hafif yüzen etek. Silah
katmanı: kafa arkasında yıldız hale halkası; muhafız katmanı: önünde yarı saydam beşgen perde.
Kahraman etiketi: **YILDIZ** (lobi ikonu: 🌌).

| Beceri | Tetik | Hasar | Olaylar | Savunmada |
|---|---|---|---|---|
| Q — Işık Mızrağı | 2. / 3. doğru | 90 | Koldan çıkan sert ışık mızrağı uç uca uzayarak rakibe saplanır (görsel uzama; tek isabet) | Standart S |
| E — Yıldız Tohumu | 4. / 5. doğru | 185 | Kara bir tohum rakibe gömülür, 450 ms boyunca hızlanan nabız atar, sonra içe çöküp patlar (gecikmeli patlama: `resolveAt = atılma + SHIELD_WINDOW_MS + 450`) | Standart S; kalkan zamanlaması atılma kelimesine göre ölçülür (mevcut kural). Gecikme savunana görüp siper alma payı verir; tohum sahibi ise KO yarışında risko girer (maç/bit tur sonunda bekleyen saldırı silinir) |
| R — Yutan Işın | 5. / 7. doğru | 310 (3 tik) | Kanal: hale halkası hedefe kilitlenir, ışın her tikte kalınlaşır. Tikler: Tutuş 50 (0 ms) → Büyüme 105 (+300) → Yutuş 155 (+620). Arenadaki en uzun kanal (~870 ms) | Standart S; ilk tikin savunma kararı tüm kanala uygulanır (mevcut `ultimateDefense` kuralı) |
| S — Yarık Perdesi | Tepkisel | 0 | Önünde uzayın katlanmış perdesi belirir (beşgen ışıltı, hafif titrek kenar) | Standart |

**2B görsel:** Q mızrak: scaleX 0.2→1 uzama + saplanma flaşı. E tohum: nokta → üç hızlanan nabız
halkası → içe çökme + patlama halkası. R: rig sabit kanal pozu + genişleyen paralel ışın katmanı,
tik başına parlaklık adımı (yalnız transform/opacity). **3B:** mızrak = uçlu ışıklı silindir; tohum =
emissive nabızlı küre; ışın = haleden hedefe silindir, yarıçapı tiklerle büyür. **Ses:** Q camcıngıl
süpürmesi; E üç yükselen ping + derin patlama; R katmanlı testere + sub bas frekans tırmanışı;
S ters şişme + cam vızıltı.

## 4. Denge karşılaştırması

| | Alev Celladı | Rün Muhafızı | Bozkır Pehlivanı | Yıldız Yutan |
|---|---|---|---|---|
| Q | 105 | 95 | 105 (+35 koşullu zincir) | 90 |
| E | 175 | 185 | 165 (+400 ms sersemletme) | 185 (+450 ms gecikme) |
| R | 305 (65/100/140 · 0/180/420) | 305 (75/90/140 · 0/260/540) | 315 (60/105/150 · 0/240/520) + savurma | 310 (50/105/155 · 0/300/620) |
| 5 kelimelik döngü | 585 | 585 | 585 | 585 |
| Karaktere özel yetenek | Kızıl Öfke (+%7) | Mühür Birikimi (E +16) | — (v1'de yok) | — (v1'de yok) |

- **Bora** E'den 10 hasar eksik ve R'den +10 fazlaysa da, getirdiği sersemletme ve savurmayı öder.
  Zincir Q'su koşulludur (blok işareti bırakmaz, 10 kelime ister). `lightning` rünü gibi Q bonusları
  işaretle çakışmaz; toplam Q üst sınırı 105+35=140 (fire'ın rünlü 105+18=233'ünün altında).
- **Pulsar** en zayıf Q'ya (−5) sahip; karşılığında en uzun R kanalı ve gecikmeli E alır. Gecikme
  çift ucu keskindir: tur `settling` (1000 ms) içinde çözülür ama maç/KO bitişi tohumu geçersiz kılar.
- Sersemletme ve savurma oyunun ilk **kontrol (CC)** etkileridir; ikisi de yalnız bloklanmamış
  isabette ve 350–400 ms ile sınırlıdır. `practice.js` botunun üç zorluğunda simülasyon istatistikleri
  (hasar/maç, seri kesme sayısı) izlenir; gerekirse 400→300 ms düşülür.

## 5. Uygulama planı (sonraki dalga; bu belge kod değiştirmez)

1. **`pvp/shared/match.js`** — `DAMAGE`'a `bora`/`pulsar`; `ULTIMATE_PHASES`'e 3 aşamalı girişler
   (mevcut yüklenme `throw` değişmezi yeni satırları otomatik korur); `createMatch` doğrulaması
   karakter listesinden yapılır (export'lu `CHARACTER_IDS`); `computeSkillBonus`'a bora zinciri
   (+35, "İkinci Tekme", işaretin tüketimi); `resolveDueAttacks`'a üç kural: (a) bloklanmamış bora Q →
   saldığan `followUpUntil = at + 12_000`, (b) bloklanmamış bora E →
   `staggerUntil = max(·, resolveAt + 400)`, (c) bora R son aşaması → savunanın `pendingAttacks`
   kayıtlarına +350 ms + `KNOCKBACK` olayı (`SERVER_ONLY_EVENTS`'e eklenir); pulsar E atış anında
   `resolveAt = issuedAt + 250 + 450`; `resumeMatch` yeni `followUpUntil` alanını diğer zamanlayıcılar
   gibi öteler; `publicMatch`'teki `activeBonuses` üçlü ifadesi karakter anahtarlı haritaya düzeltilir
   (yoksa bora/pulsar yanlışlıkla "Mühür Birikimi" gösterir).
2. **`pvp/characters.js`** — `VALID_CHARS`; `rigMarkup` adları; `MOTION_CUES` /
   `CHARACTER_ULTIMATE_CUES` (yeni işaret türleri: `kick-trail`, `dash`, `seismic-ring`,
   `seed-pulse`, `beam-ramp`; zamanlar ULTIMATE_PHASES ofsetleriyle hizalı).
3. **`assets/rig/`** — `bora-{core,guard,weapon}.png` ve `pulsar-{core,guard,weapon}.png`
   (1024×1536 saydam katmanlar, mevcut pivot ölçüsünde). Görsel üretilmezse **geçici çözüm**:
   `rigMarkup` satır içi SVG katmanları döndürür (tek renk silüet + vurgu); 3B tarafı düz renkli
   düzlemler/basit geometri (PALETTE renkleriyle). Oyun kurulabilir kalır, kalite sonradan beslenir.
4. **Arayüz** — `pvp/index.js` oyuncu tablosuna (satır 47–48 bölgesi) yeni girişler; kahraman
   etiketi haritası (`YEL`, `YILDIZ`); `pvp/network.js` `CHARACTERS` (satır 33), lobi butonları
   (satır 570) ve antrenman seçimi (satır 552); `pvp/practice.js`'te koltuk ataması karakterden
   ayrılır (karakter ≠ taraf; taraf etiketleri KIZIL/MAVİ kalır), bot rakip karakteri havuzdan seçer.
   `index.js` paylaşımlıdır: yamadan önce yeniden oku, yalnızca sana ayrılan bölgeyi değiştir.
5. **Sunucu** — `cloudflare/src/room.js` `CHARACTERS` kümesine (satır 14) iki kimlik eklenir.
6. **`pvp/arena3d.js`** — `PALETTE`/pivot tablolarına iki giriş; `CHARACTER_OF_SEAT` sabiti maç
   katılımcılarından türetilir; zeminin sıcak/soğuk kenarı koltuk paletlerinden boyanır
   (fire/rune sabitlerinden arındırılır); karakter FX mesh'leri (hilal, mızrak, tohum, ışın).
7. **Ses** — `pvp/sound.js` işaret eşlemeleri; örnek dosya yoksa WebAudio sentezi (bant geçirenli
   gürültü, sub patlamalar, katmanlı testere — `assets/sfx` üslubuna uygun kısa tek atışlıklar).
8. **Test** — yeni döngü değişmezleri (585; 3 aşama), zincir/sersemletme/savurma/gecikme çözümlemeleri
   (enjekte edilen RNG ile deterministik), `resumeMatch` ötelemesi. Mevcut test seti aynen geçmeli;
   sonunda `node --test tests/*.test.mjs`.

## 6. Riskler

- **Denge:** CC (sersemletme/savurma) yeni bir boyut; tur modunda seri becerisi reddedilen oyuncu
  haksızlık hissedebilir. Süreler kısa (400/350 ms) tutuldu; bot simülasyonuyla gözlenmeli.
- **Paylaşımlı `pvp/index.js`:** başka ajanlar eşzamanlı çalışıyor; yalnızca verilen bölge, her
  yamadan önce yeniden okuma zorunlu (ortak bağlam kuralı).
- **Görsel varlık açığı:** PNG katmanları üretilmezse SVG/geometri geçici çözümü kalite çıtasının
  altında görünebilir (sahibin "göze hitap etsin" isteği); varlık üretimine öncelik verilmeli.
- **Zaman kaydırma etkileşimi:** gecikmeli E ve savurma `resolveAt` kaydırır. DO alarmı
  (`nextDeadline`) her `advanceMatch` sonrası yeniden hesaplandığından güvenlidir; ancak sırayla
  saldırı akışını uygulayan ajanla kuyruk modeli koordinasyonu gerekir.
- **Karaktere özel yetenek yokluğu:** v1'de bora/pulsar, Kızıl Öfke/Mühür Birikimi benzeri satır
  almaz (genel rünler yine çalışır). v2 önerisi: "Yel Gücü" (sersemletme +100 ms) ve "Yıldız Tozu"
  (E gecikmesi −100 ms).
- **Kanal uzunluğu:** pulsar R (~870 ms) sonraki kelime dökümüyle görsel çakışabilir;
  `choreography21` kuyruğu sınırlıdır (3) — aşırı doldurma kontrol edilmeli.
- **Performans kuralı:** tüm yeni animasyonlar yalnız transform/opacity; yeni sonsuz animasyon yok;
  `prefers-reduced-motion` ve `#pvp-root.pvp4-reduced` desteklenir.
