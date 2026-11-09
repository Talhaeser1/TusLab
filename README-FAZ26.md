# TuşLab PvP — Paket 24 görseller + Paket 26 3B arena

## Neler eklendi
- **Bota karşı antrenman** (`pvp/practice.js`): gerçek maç motoru (`pvp/shared/match.js`) tarayıcıda çalışır; sunucu gerekmez. Bot Kolay/Orta/Zor (~25/45/70 WPM).
- **Piksel hasar sayıları** (`pvp/fx-damage.js`), **dövüş hareketleri** (`pvp/fight-motion.js`), **2B canvas parçacıkları** (`pvp/fx-particles.js`).
- **3B arena** (`pvp/arena3d.js`): three.js r160 (`pvp/vendor/`, MIT lisansı `THREE-LICENSE.txt`). Neon platform, ışıklar, sis, 2.5B karakterler (mevcut PNG katmanları), kamera sarsıntısı/yaklaşması, nakavt.
- **3B efektler** (`pvp/arena3d-fx.js`): GPU parçacıkları, ateş/rün mermileri, şok halkaları, kalkan kırıkları, ulti meteoru.
- PvP araç çubuğunda **"◈ 3B Arena"** aç/kapat düğmesi. WebGL yoksa veya yüklenemezse CSS arena otomatik kalır.

## Hızlı deneme
```
python -m http.server 5176 --bind 127.0.0.1
```
`http://127.0.0.1:5176/?pvp=practice&bot=orta` — ek parametreler: `bot=kolay|orta|zor`, `char=fire|rune`, `arena=2d|3d`.

## Doğrulama
- `npm test`: 232/232 geçti. `npm run cf:validate`: 54/54 geçti.
- Tarayıcıda 1366×768'de bot maçı nakavtla bitirildi; 3B sahne, mermiler, meteor, hasar sayıları görüldü; konsolda hata yok; geliştirme bilgisayarında ~143 FPS (en yavaş kare 21 ms).
- 3B düğmesi kapatınca canvas kalkıyor ve PNG karakterler geri geliyor; açınca 3B dönüyor.

## Bilinen eksikler
- (Düzeltildi) Çift efekt: 3B açıkken eski DOM mermileri, sahne kıvılcımları, 2B parçacıklar ve DOM sarsıntısı kapanır; PARRY/COUNTER/faz yazıları her iki modda yalnızca piksel etiketlerle çıkar. Test: `tests/pvp-dedupe26.test.mjs`.
- three.js yüklenene kadar (yerel sunucuda birkaç saniye) arena 2B görünür, sonra 3B'ye geçer.
- Dar (telefon) ekranda 3B yerleşim denenmedi.
- Zayıf GPU'larda FPS ölçülmedi (otomatik kalite düşürme var).
- Cloudflare'a yayın yapılmadı.
