# 09 — Dövüş ve Animasyon

Son güncelleme: 13 Kasım 2026

## Kullanıcının kuralı
KESINYAP kural 2: "Dövüş sıralıdır. Bir karakter saldırır, yerine döner, 1–2 sn beklenir, sonra öbürü saldırır. Birinin animasyonu bitmeden öbürü başlamaz. Işınlanma yok, animasyonsuz hasar yok."

## Şu an oyunda olan
### Sıra
1. Saldıran koşarak rakibe gider (yaklaşma ~1,1 sn; ölçüm 847–1255 ms).
2. Vuruş klibi doğal hızda oynar; hasar yalnız temas karesinde işlenir ve sayı o anda çıkar.
3. Dönüş koşu klibiyle, yüz eve dönük (geri geri koşu yok); ölçüm 901–1272 ms.
4. Nefes payı ~1,3 sn (en az 1, en çok 2 sn); aynı kişinin yeni vuruşu için kısa pay (0,3 sn).
5. Sonra öbürü saldırır. Aynı anda iki saldırı yok.

Kareler arası sıçrama en çok 0,12 birim (ışınlanma yok). Saldırı yazısı (callout) kapalı.

### Raund sonu çözümü
- Raund bitince bekleyen vuruşlar tek tek oynanır; raund arası kartı ve "RAUND n" geri sayımı hepsi bitmeden açılmaz.
- Süre planla hesaplanır (üst sınır 20 sn): yakın sahne ~4,6 sn, her ek vuruş 1,4 sn, ulti sahnesi ~4,2 sn, sahneler arası 1,5 sn.
- Zincir halinde vuruşlar tek yaklaşmada (en çok 3 vuruş) oynar. Klasikte karşı saldırı ek sahne (~6,1 sn) ekler.
- Kart açıkken iki dövüşçü de kadrajda; kamera yakın çekimde takılı kalmaz.
- Animasyonsuz hasar 0 (ölçüldü).

### Ulti
Üç evre (Ateş: Kızıl Hamle, Alev Çemberi, Kızıl İnfaz; Rün: Mühür Çatlağı, Yankı Dalgası, Sonsuz Mühür). Ulti sonrası toparlanma 0,8 sn, dönüş 0,4 sn. Ulti ~4 sn civarı.

### Efektler
Her yeteneğin bir efekt anahtarı var (03). Kıvılcım, darbe hissi, kritik vuruş (KRİTİK 3B arka plan), kalite valisi düşük GPU'da efekt sayısını azaltır.

### Klip adları
Ortak: Idle, 2H_Melee_Idle, Hit_A/Hit_B, Death_A, Cheer, Blocking, Block_Hit.

## Planlanan / sırada (henüz kodda yok)
- Zemin hasarı: Q/W küçük çatlak veya yanık, ulti kalıcı göçük/krater (en çok 4).
- Karaktere özel zengin efektler (KESINYAP 15).
- Cel gölgelendirme (bkz. 01).

## Yeni bir şey eklerken uyulacaklar
- [ ] Yeni yetenek: klip + efekt anahtarı + temas karesi tanımlı; animasyonsuz hasar çıkmaz.
- [ ] Sıra kilidi bozulmaz; ışınlanma yok.
- [ ] Ulti en çok ~4 sn; kare süresi 250 ms üstüne çıkmaz.
- [ ] Yeni gölgelendirici dövüş sırasında derlenmez (önceden ısıtılır).
- [ ] Gerçek GPU'da bot maçıyla ölç.

## Kodda nerede
- `pvp/visual-timeline.js`, `pvp/shared/resolve-timing.js` (RESOLVE_SCENE, VISUAL_TURN), `pvp/fighters3d.js`
- `pvp/arena3d-fx.js`, `pvp/combat-fx.js`, `pvp/impact-feel.js`, `pvp/anim-state.js`
- Testler: `tests/pvp-anim3-tempo.test.mjs`, `tests/pvp-raund-sonu.test.mjs`
