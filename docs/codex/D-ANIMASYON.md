# Şerit D — Animasyon: yazma, hasar yazıları, sinematikler

Önce `docs/codex/00-ORTAK.md`'yi oku ve uygula.

## Sahip olduğun dosyalar
pvp/fight-hud.js, pvp/fight-hud.css, pvp/fx-damage.js, pvp/fx-damage.css, pvp/cinematic.js, pvp/cinematic.css, pvp/stage-focus.js,
pvp/typing-top-model.js, pvp/fight-motion.js/.css, pvp/combat-fx.js/.css, tests/pvp-anim33.test.mjs (yeni), ilgili mevcut testler.

## Adımlar

### 1. Önceki yarım işi oku
`git diff pvp/fx-damage.js pvp/fx-damage.css pvp/fight-hud.js pvp/fight-hud.css pvp/typing-top-model.js pvp/cinematic.js pvp/cinematic.css`.

### 2. Hasar/vuruş yazıları NET (kullanıcının şikâyeti: "pikselleri düşük")
- Bugün fx-damage.js her sayıyı küçük bir bitmap fontla `<canvas>`a çizip CSS'te `image-rendering: pixelated` ile büyütüyor.
- Yeni yöntem: canvas YERİNE DOM metin: `<span class="pxd-num">-175</span>`; font: `font: 900 clamp(28px, 3vw, 46px)/1 system-ui,
  'Segoe UI', sans-serif; letter-spacing: .02em; transform: skewX(-8deg)`; dış hat: `-webkit-text-stroke: 3px #120818; paint-order: stroke fill`
  + `text-shadow: 0 3px 0 #120818, 0 0 18px <renk>`; renk paletleri mevcut PALETTES'ten (ateş turuncu, rün camgöbeği, kritik altın, parry beyaz-mavi,
  destek partner rengi). Etiketler (KRİTİK, PARRY!, KONTRA, KALKAN KIRIK!, DESTEK) aynı tipografide, 15–18 px, kalın, büyük harf.
- Mevcut public API (createDamageNumbers, handle, clear, destroy, liveCount, LABELS, MAX_LIVE_PER_SIDE, COMBO_WINDOW_MS) KORUNUR;
  `rasterize`/`FONT` export'ları testler kullanıyorsa yerinde bırak (artık çizimde kullanılmasa da).
- Animasyon: çıkış 0→110% ölçek 90 ms, 100% 80 ms, sonra yukarı süzülme + sönme (toplam ≤ 900 ms; ağır vuruş 1100 ms); aynı taraftaki sayılar
  çakışmasın: her yeni sayı önceki canlı sayılardan en az 34 px yukarı/yana.
- `image-rendering: pixelated` kuralları kaldırılır.

### 3. Yazma animasyonları (pvp/typing-top-model.js + pvp/fight-hud.css)
typing-top-model.js'in ürettiği yapıyı/sınıfları oku. Ekle (yalnız sınıf/durum üretimi; DOM'u kim çiziyorsa ona dokunma — index.js'te ise
"GEREKEN DEĞİŞİKLİK" yaz):
- `tt-letter-hit` (son girilen harf: 120 ms parıltı, translateY -2px), `tt-word-pop` (doğru gönderilen kelime: 180 ms sağa kayıp sönme),
  `tt-word-miss` (yanlış: 260 ms yatay sarsıntı ±6px + kırmızı), `tt-combo-1..4` (kombo 2,4,6,8+ eşiklerinde kelime ışıltısı artar),
  `tt-clock-urgent` (son 5 sn: sayaç 1 Hz nabız). CSS'leri fight-hud.css'e, yalnız transform/opacity/filter/color; reduced-motion'da yok.

### 4. Sinematikler
- fight-hud.js anonsları (VS → RAUND N → SAVAŞ!, ULTİ = karakterin R adı, KRİTİK/PARRY/KONTRA/KALKAN KIRIK/DESTEK, NAKAVT, ZAFER/YENİLGİ):
  çapraz kayan iki bant (üst bant soldan, alt bant sağdan, 220 ms giriş), ortada büyük metin (≥ 56 px ana, 22 px alt satır, dış hatlı),
  karakter rengi vurgu; toplam ≤ 2.2 sn (intro), anons ≤ 900 ms; `pointer-events:none`; aynı anda tek anons kuralı ve kuyruk (≤ 2) korunur.
- cinematic.css/cinematic.js: VS ekranında iki karakter adı + ünvan (pvp/shared/fighters.js'ten), sahne adı (match.stage → pvp/shared/stages.js
  name) alt satırda "ARENA: Fırtına Limanı".
- stage-focus.js: ULTİ odak geçişlerinde panel kayması olmasın (mevcut FLIP + 700 ms emniyet korunur).

### 5. Testler (tests/pvp-anim33.test.mjs)
fx-damage DOM metin üretimi (canvas yok, sınıf ve metin doğru, etiketler), aynı taraf yığılma ofseti ≥ 34 px, reduced modda animasyon sınıfı yok;
typing-top-model yeni sınıf durumları; fight-hud anons süreleri ≤ sınırlar ve VS'de sahne adı. Tüm testler + cf:validate.

## Kabul ölçütleri
D1 hasar sayıları DOM metin, net, pixelated yok · D2 etiketler aynı tipografi · D3 yığılma ofseti · D4 yazma animasyon sınıfları + CSS ·
D5 anons bantları ve süre sınırları · D6 VS'de karakter + sahne adı · D7 reduced-motion · D8 tüm testler + cf:validate.
