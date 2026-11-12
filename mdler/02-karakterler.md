# 02 — Karakterler

Son güncelleme: 13 Kasım 2026

## Kullanıcının kuralı
Karakterlere dair ayrı bir kullanıcı dosyası yok. Yeni karakter için kullanıcının karakter notu (12'nin başında) ve `12-yeni-karakter-rehberi.md` geçerlidir.

## Şu an oyunda olan
Beş oynanabilir karakter. Taraf (Ateş/Rün) hasar ve denge değerlerini belirler; karakter farkı görsel, ad, efekt ve animasyondur.

| Karakter | Unvan | Taraf | Silah | Ana renk | Vurgu rengi |
|---|---|---|---|---|---|
| Vargr | Kızıl Balta | Ateş | Çift başlı savaş baltası | #c2412d | #f2a541 |
| Sira | Gölge Mızrak | Ateş | Mızrak ve çifte hançer | #7b3fc4 | #3ee0c8 |
| Doran | Demir Sur | Rün | Kılıç ve kalkan | #2f6fb5 | #d9c27a |
| Nyx | Rün Kâhini | Rün | Rün asası | #1f9e8f | #b79cff |
| Hacı Usta | Ney Ustası | Rün | Etli ekmek ve ney | #d6a53a | #b8512f |

Taban hasar: Ateş Q 105, E 175, R 305; Rün Q 95, E 185, R 305 (detay 03 ve 04).

### Vargr — Kızıl Balta
- **Kimlik:** Kuzey buzullarında kor yakıp kışı deviren balta ustası; her yenilgiyi bir sonraki savuruşa öfke olarak saklar.
- **Görünüş:** iri barbar, kızıl ve altın tonlar. **Tarz:** yakın dövüş, ağır ve çok vuruşlu.
- **Güçlü:** çok vuruşlu E, üç evreli ulti. **Zayıf:** menzilli saldırısı yok.
- **Ses:** `vargr-q/e/r/hit/ko` wav; zafer repliği var (KESINYAP'ta "vargr-zafer"); replik mp3 klasöründe yok (doğrulanmadı).
- **Model:** `assets/models/vargr/vargr.glb`; **portre:** `portre-vargr.webp`.

### Sira — Gölge Mızrak
- **Kimlik:** Çöl kervanlarının izini gölgelerden süren iz sürücü; mızrağını ancak hedef ışığa çıkınca fırlatır.
- **Görünüş:** mor-camgöbeği, hafif kılıklı hırsız. **Tarz:** menzilli (mızrak) + yakın (çifte hançer).
- **Güçlü:** Q'su uzaktan vurur, ulti üç mızrak. **Zayıf:** yakın vuruşta sadece E.
- **Ses:** `replik/sira-*.mp3`, `sira-q/e/r/hit/ko` wav. **Model/portre:** `sira.glb`, `portre-sira.webp`.

### Doran — Demir Sur
- **Kimlik:** Yıkılan kale kentinin son muhafızı; surları yeniden örene dek kalkanını indirmeyeceğine ant içti.
- **Görünüş:** mavi zırh, altın detay. **Tarz:** yakın, dengeli, kalkan odaklı.
- **Güçlü:** kalkanla rakibin siperini sarsar; sağlam ulti. **Zayıf:** menzilsiz.
- **Ses:** `replik/doran-*.mp3`, `doran-q/e/r/hit/ko` wav. **Model/portre:** `doran.glb`, `portre-doran.webp`.

### Nyx — Rün Kâhini
- **Kimlik:** Gece gökyüzündeki takımyıldızları rün diye okuyan kâhin; her savaşı yıldızlarda önceden görmüş gibi dövüşür.
- **Görünüş:** camgöbeği-mor büyücü. **Tarz:** menzilli büyü (mermi, sütun, meteor).
- **Güçlü:** menzil, gökten meteor ulti. **Zayıf:** yakın savunma büyüsüne bağlı.
- **Ses:** `replik/nyx-*.mp3`, `nyx-q/e/r/hit/ko` wav. **Model/portre:** `nyx.glb`, `portre-nyx.webp`.

### Hacı Usta — Ney Ustası
- **Kimlik:** Konya pazarının fırınından çıkıp meydanlara düşen usta; etli ekmeği fırlatır, neyini üfleyince meydan susar.
- **Görünüş:** altın-kiremit tonlu, Konyalı usta. **Tarz:** menzilli Q + dönerek alan hasarı + sinematik ulti.
- **Güçlü:** özgün, hem menzilli hem alan hasarı. **Zayıf:** efektleri henüz sade (KESINYAP 15).
- **Ses:** `replik/konyali-*.mp3`, `konyali-q/e/r` mp3. **Model:** `assets/models/konyali/konyali.glb`; **portre:** `assets/models/konyali/portre-konyali.webp`.
- **Not:** Model kaynağı Meshy; diğer dört model KayKit Adventurers 1.0 (CC0).

## Planlanan / sırada
- Henüz kodda yok: karaktere özel zengin vuruş efektleri (özellikle Hacı Usta) — KESINYAP 15.
- `assets/models/harf-muhafizi/` klasörü var; oynanabilir kadroda değil (bot karakteri olabilir, doğrulanmadı).

## Yeni bir şey eklerken uyulacaklar
- [ ] Kart şablonunu (12-yeni-karakter-rehberi) eksiksiz doldur.
- [ ] Renk, mevcut beş karakterle karışmıyor.
- [ ] Taraf (Ateş/Rün) seçildi; hasar o taraftan gelir.
- [ ] Bu tabloyu ve 03'ü güncelle.

## Kodda nerede
- `pvp/shared/fighters.js` (kadro), `pvp/portraits.js`, `pvp/characters.js`, `pvp/fighters3d.js`
- `assets/models/<id>/`, `assets/higgsfield/final/portre-*.webp`, `assets/sfx/replik/`
