# Şerit B — Düzen: tam ekran dövüş oyunu HUD'u

Önce `docs/codex/00-ORTAK.md`'yi oku ve uygula. Ayrıca `docs/EKRAN-KONTROL-KURALLARI.md`'yi oku.

## Sahip olduğun dosyalar
pvp/fullscreen33.css (yarım başlanmış — git diff ile gör), pvp/compact-height.css (index.html'de EN SON yüklenen; testler bunu istiyor),
pvp/player-panel.css, pvp/topbar.css, pvp/skillbar.css, pvp/typing-top.css, pvp/arena3d.css, pvp/pvp.css, pvp/backdrop.css, pvp/ui-polish.css,
pvp/index.js'te YALNIZ `data-layout` ve "Tam ekran" düğmesi satırları, tests/pvp-fullscreen33.test.mjs (yeni).

## Hedef görünüm (maç sırasında, `#pvp-root[data-layout="fullscreen"]`)
```
┌────────────────────────────────────────────────────────────┐
│ [ince üst şerit: ⚔ 🏆 👥 ... ? ⚙ Teslim ol Çık]   (≤ 40 px)│
│ [Oyuncu 1 HP ████████████░░]  (⏱ 87 · RAUND 2)  [░░████████ Oyuncu 2 HP] │
│  Ad · Karakter  rozetler                       rozetler  Ad · Karakter │
│                                                            │
│        3B SAHNE TÜM ARKA PLANI KAPLAR (dövüşçüler sol/sağ)   │
│                                                            │
│   [SÜPER/DESTEK barları HP altında ya da beceri şeridinde]   │
│        ┌──────── yazma paneli (hedef kelime + giriş) ────────┐  │
│        └─────────────────────────────────────────────────┘  │
│ [Q][E][S][R] oyuncu 1 beceri şeridi        [Q][E][S][R] oyuncu 2 │
└────────────────────────────────────────────────────────────┘
```

## Adımlar
1. `git diff pvp/fullscreen33.css pvp/compact-height.css pvp/index.js` ile önceki yarım işi oku.
2. pvp/index.js: maç `running`/`paused` iken ve 3B ya da 2B arena açıkken `root.dataset.layout='fullscreen'`; lobi/maç dışı/maç sonu
   sonuç ekranında `delete root.dataset.layout`. Bunu `tuslab:pvp-match` dinleyicisinde yap (mevcut dinleyicilerin YANINA yeni küçük bir fonksiyon).
3. ⚙ ayarlar menüsüne (index.js'teki `pvp4-settings-pop` markup'ı) "⛶ Tam ekran" düğmesi: `document.fullscreenEnabled` değilse gizli;
   tıklayınca `root.requestFullscreen()` / `document.exitFullscreen()`; `fullscreenchange`'de etiket "Tam ekrandan çık" olur, `aria-pressed` güncellenir.
4. pvp/fullscreen33.css (yalnız `#pvp-root[data-layout="fullscreen"]` kapsamında):
   - `.pvp2-duel` `position:fixed; inset:0; z-index:0` (3B tuval duel'i kapladığı için sahne tüm ekranı kaplar); `.pvp2-side` iki sütun,
     her biri ekranın yarısı; `.pvp2-stage` yüksekliği `calc(100vh - üst HUD - alt şerit)`.
   - HP barları üstte: `.pvp2-player-top` + `.pvp2-health` aynı satırda, büyük (yükseklik 26–32 px), oyuncu 2'nin barı `transform:scaleX(-1)`
     ile sağdan sola dolar (yazılar ters dönmesin: bar iç dolgusunu çevir, metni değil).
   - Ortada süre/raund rozeti (mevcut `.pvp-topbar-clock` / rounds HUD'unu ortaya taşı; markup değiştirmeden CSS konumlandırma).
   - Yazma paneli (`.tt`) altta ortada, genişlik `min(760px, 92vw)`, koyu opak arka plan (blur YOK), hedef kelime ≥ 28 px.
   - Beceri şeritleri (`.pvp2-skillrow`) en altta, her oyuncunun kendi tarafında, kompakt (kart yüksekliği ≤ 48 px).
   - Üst araç çubuğu `.pvp2-toolbar` ≤ 40 px ince şerit.
   - Fight HUD (pvp/fight-hud.css Şerit D'nin): `.fhud-super`/`.fhud-assist` konumu çakışırsa burada yalnız `top/left/right/bottom` ile taşı.
5. Kısa ekran (≤ 760 px) ve telefon (≤ 600 px genişlik): compact-height.css içinde aynı kapsamla: telefonda dikey yığın — üstte iki HP barı
   üst üste, ortada sahne (≥ 40vh), altta yazma paneli ve tek satır beceri şeridi. compact-height.css dosyanın EN SON yüklenen olduğunu
   test ediyor — dosya adını/yerini değiştirme.
6. tests/pvp-fullscreen33.test.mjs: index.js'te data-layout ayarlama ve kaldırma kodunun varlığı; fullscreen33.css'te kapsam seçicisi,
   `position:fixed` duel, scaleX(-1) HP, blur/backdrop-filter YOK; 12 px altı font-size YOK (regex ile tara).

## Kabul ölçütleri
B1 data-layout maçta var, maç dışında yok · B2 Tam ekran düğmesi (Fullscreen API) · B3 HP barları üstte, oyuncu 2 sağdan dolar ·
B4 yazma paneli altta ortada, opak · B5 beceri şeritleri altta · B6 telefon dikey yığın · B7 backdrop-filter/blur yok, font ≥ 12 px ·
B8 tüm testler + cf:validate. (Tarayıcı ölçümünü orkestratör yapacak; CSS seçicilerini sınıf adlarına göre doğru yaz — markup'ı
pvp/index.js `screen()`/`sideHTML` ve pvp/network.js'ten OKU.)
