# 7 — Raund sayacı madalyonu (24 Kas 2026)

Şikâyet: maçta üst ortadaki raund sayacı (`.rui-medal`: RAUND 1 / 7 + halka + "21 sn") soluk, küçük, can barları arasında kayboluyor. "Güzel bir resim sayacı olsun."

## Kök neden
1. **Soluk:** `.pvp2-shell` `isolation:isolate` (pvp/pvp.css:7) kendi yığın bağlamını kurar; madalyonun z-index'i kabuktan çıkamaz, kardeş `.fhud2` (z 25) kabuğun üstünde boyanır. `.fhud2::before`'un üst karartması (fight-hud.css:331, rgba(8,5,18,.86)→.5) madalyonun tam üstüne düşüyordu.
2. **Küçük/silik:** CSS yığını tabanı eziyordu: fight-hud.css:316 zemin/kenar/gölgeyi sıfırlar, compact-height.css:266-268 saati 24 px'e indirir; fullscreen33.css:59, match-info.css:42-44, typing-top.css:165-171, ui-polish.css:51 de karışır. rounds-ui.css bunlardan önce yüklendiği için tabanın sözü geçmiyordu.

## Yeni tasarım
- `assets/pvp/raund-sayac.svg` (200×140, elle yazıldı): altın kasnak + 12 çentik, mor neon çekirdek, üç katlı kanatlar ve kum saatleri, tepe taşı, kalkan sivrisi. Halka ve saniye merkez (100,84) çekirdeğine oturur.
- `assets/pvp/raund-sayac-serit.svg`: "RAUND N / 7" yazısının altındaki altın-mor şerit.
- Saniye 38 px (tabandaki 24-26 px yerine), beyaz + mor hale; azalan halka altın, 5 px.
- Seçiciler `#pvp-root#pvp-root[data-layout="fullscreen"] …` (iki kimlik): yükleme sırasından bağımsız kazanır; başka dosyaya dokunulmadı.
- Karartmaya madalyon kadar yumuşak kenarlı elips pencere açılır (mask), barların arkası aynen kalır. Sonuç anında pencere şerit boyuna daralır (önceki ajanın sürümünde sonuçta pencere kapanıyordu ve "RAUND N SONUCU" şeridi yine soluk kalıyordu; bu oturumda düzeltildi).
- Durumlar: `is-urgent` kırmızı halka + kırmızı rakam + kızıl hale, tek seferlik `rui-pulse` (sonsuz yanıp sönme yok); `is-frozen` soluk mor-gri; `is-result` saat ve madalyon gövdesi gizli, yalnız şerit; `is-sudden` kızıl şerit/halka; `.rui-lastcall` görünürken başlık gizli (taban kural korunur).
- Ölçek `--rs`: masaüstü 1 (200×140), telefon dikey .72 (top 240 px — match-info.css:38'deki `!important` ile aynı; kelime şeritlerine yer açar, bilerek korundu), alçak ekran .62.
- `prefers-reduced-motion` ve `.pvp4-reduced`: geçiş ve nabız yok.

## Dosyalar
- `pvp/rounds-ui.css` 865-954 (yeni blok, dosyanın sonu). JS'e dokunulmadı.
- `assets/pvp/raund-sayac.svg`, `assets/pvp/raund-sayac-serit.svg` (yeni).
- `tests/pvp-raund-sayac.test.mjs` (yeni, 6 test).

## Test
`node --test tests/*.test.mjs`: **1081 test, 1077 geçti, 4 kaldı**. Dördü de `tests/home-anasayfa.test.mjs` (2) ve `tests/home-kartlar.test.mjs` (2): home/ dosyalarında sürmekte olan Mimar işi; bu işle ilgisi yok. Yeni 6 test geçti. `npm run cf:validate`: 79/79, SVG'ler `cloudflare/public/assets/pvp/` içinde.

## Tarayıcıda görülenler (bot maçı, 5177)
- 1920×1080: normal (RAUND 2 / 7, 15 sn), acil (kırmızı "1"), raund sonu çözümü (saat gizli, "RAUND 1 SONUCU" şeridi) ekran görüntüsüyle. Madalyon 860-1060 px, can barları 96-848 / 1072-1824: çakışma yok.
- 1280×720: acil durum (kırmızı "3" ve "0") ekran görüntüsüyle; madalyon 540-740, barlar 96-528 / 752-1184.
- 1440×900: sonuç şeridi; düzeltmeden önce soluktu, sonra maske penceresi ölçüldü.
- 390×844: normal (24/28 sn) ve sonuç şeridi ekran görüntüsüyle, net okunuyor; barların ve kelime şeritlerinin altında.

## Görülmeyenler / sınırlar
- `is-frozen`, `is-sudden` ve `.rui-lastcall` ekranda görülmedi (oyun döngüsü zorlanan sınıfı bir sonraki karede siliyor). Yalnız hesaplanan stillerle doğrulandı: son çağrıda başlık `hidden`, son çağrı `grid`; donmuşta saniye rengi #d6d0f2.
- Tarayıcı paneli 1920×1080'i küçülterek gösterdiği için yakın plan görüntüler, inceleme amacıyla anlık `transform:scale` ile alındı (kaydedilmedi).
- Telefon yatay (844×390): yazma paneli tüm HUD'un üstüne biniyor ve madalyon şeridini örtüyor. Bu düzen zaten bozuk ve kaynağı bu işin dosyaları dışında. **Düzeltilmedi.**
- Telefonda "BOT · ORTA" adı (KALKAN rozeti varken) dikey kırılıyor: fight-hud sorunu, bu işin dışında.
- Tur arası panelinde madalyon görünmüyor (mevcut davranış, değiştirilmedi).
