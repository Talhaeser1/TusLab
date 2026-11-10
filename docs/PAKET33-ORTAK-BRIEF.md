# Paket 33 — ortak kurallar (her ajan okur)

Proje kökü: C:\Users\Talha Eser\Downloads\DUZENLI\Projeler\TusLab\Surumler\TusLab-PvP-IsPaketi23\TusLab-PvP-IsPaketi23
Oyun: tarayıcıda 1v1 "yazarak dövüş" (TuşLab Ruh Düellosu). Doğru yazılan kelimeler Q/E/R becerilerini doldurur. Sunucu
(cloudflare/src/room.js) ve yerel bot motoru (pvp/practice.js) aynı paylaşılan motoru kullanır (pvp/shared/match.js klasik +
"Zamana Karşı" tur modu, pvp/shared/arena.js Arena modu). 4 karakter var: pvp/shared/fighters.js (vargr, sira, doran, nyx) —
gerçek 3B rig'li modeller assets/characters/*.glb, pvp/fighters3d.js (koreografi, klipler, karaktere özel efektler),
pvp/arena3d.js (three.js r160 sahne, kamera, layout, eklentiler), pvp/arena3d-fx.js, pvp/arena3d-bloom.js, pvp/arena3d-hpbars.js,
pvp/arena3d-assist.js (partner desteği). HUD: pvp/fight-hud.js/.css. Lobi: pvp/network.js + pvp/lobby-v3.css. Ses: pvp/sound.js.

## Kullanıcının hedefi (paket 33)
Modern dövüş oyunu (2XKO / Street Fighter türü) kalitesi:
1. Atış/beceri efektleri ve görüntüler bulanık/düşük pikselli görünüyor → NET, keskin, yüksek kaliteli görüntü.
2. Raund/tur bittikten sonraki ekran (tur arası, raund sonucu) düzgün ve güzel olsun.
3. Arena TAM EKRAN olsun (dövüş oyunu gibi: sahne tüm ekranı kaplar, HUD üstünde).
4. Arena SEÇİMİ olsun (Street Fighter'daki sahne seçimi gibi): birden çok özgün sahne.
5. Yazı animasyonları, tur özellikleri, modlar düzgün çalışsın ve güzel olsun.
Hiçbir ticari oyunun adını, sahnesini, karakterini, görselini kopyalama; özgün TuşLab neon kimliği.

## PAYLAŞILAN SÖZLEŞMELER (sabit)
- **Sahne kimlikleri** (Ajan Kurallar `pvp/shared/stages.js` dosyasını İLK İŞ olarak yazar; diğerleri OKUR):
  `export const STAGES` = [{id, name, blurb, palette{sky,fog,floor,accent,rim}, music?:sahne adı}], `STAGE_IDS`, `normalizeStage(id)`,
  `DEFAULT_STAGE='colosseum'`. Sahneler: `colosseum` "Neon Kolezyum" (bugünkü sahne), `skyforge` "Gök Demirhanesi" (yüzen ada, lav
  dökümhanesi, turuncu), `runegarden` "Rün Bahçesi" (gece, parlayan rün taşları, camgöbeği/mor, ağaç siluetleri), `harbor` "Fırtına
  Limanı" (yağmurlu gece limanı, şimşek, mavi-beyaz). İsimler özgün kalsın.
- **3B API:** `arena3d instance.setStage(id)` (Ajan Görsel ekler) → sahne ortamını değiştirir; maç `match.stage` alanından okunur
  (Ajan Kurallar motor+sunucu+bot'a ekler; publicMatch'te `stage`).
- **Tam ekran:** Ajan Düzen, maç sırasında `#pvp-root` üzerine `data-layout="fullscreen"` (ya da sınıf) koyar ve CSS ile sahneyi tüm
  ekrana yayar; Ajan Görsel, 3B tuvalin ve kameranın bu düzende TÜM görünür alanı kaplamasını (tuval .pvp2-duel yerine görünür sahne
  alanına/viewport'a yayılabilir) ve dövüşçülerin ekranın sol/sağ üçte birinde, HUD'un altında kalmasını sağlar. İkisi bu sözleşmeye
  göre çalışır: Düzen DOM/CSS'i, Görsel tuval/kamera/yerleşimi yapar. Ortak ölçüt: 1920x940'ta dövüşçüler ≥ 300 px, HP/HUD ile
  çakışma yok, yazma kutusu her zaman görünür.

## Dosya sahipliği (ÇAKIŞMA YOK)
- **Ajan Görsel (render + sahneler + karakter görselliği):** pvp/arena3d.js, pvp/arena3d-fx.js, pvp/arena3d-bloom.js,
  pvp/arena3d-hpbars.js, pvp/arena3d-assist.js, pvp/fighters3d.js, YENİ pvp/stages3d.js, scripts/optimize-characters.mjs,
  assets/characters/, testleri.
- **Ajan Düzen (tam ekran dövüş HUD düzeni):** pvp/fullscreen33.css (yeni, boş, index.html'de bağlı), pvp/compact-height.css,
  pvp/player-panel.css, pvp/topbar.css, pvp/skillbar.css, pvp/typing-top.css, pvp/arena3d.css, pvp/pvp.css, pvp/backdrop.css,
  pvp/ui-polish.css; pvp/index.js'te yalnız düzen anahtarı/tam ekran düğmesi satırları; testleri.
- **Ajan Kurallar (oyun kuralları + modlar + tur sonu + sahne seçimi verisi):** YENİ pvp/shared/stages.js, pvp/shared/match.js,
  pvp/shared/arena.js, pvp/shared/arena-skills.js, pvp/shared/arena-damage.js, cloudflare/src/room.js, pvp/practice.js,
  pvp/rounds-ui.js, pvp/rounds-ui.css, pvp/arena-ui.js, pvp/arena-ui.css, pvp/resolve-ui.js, pvp/resolve-ui.css, pvp/modes33.css
  (yeni, boş, bağlı), pvp/network.js + pvp/lobby-v3.css (lobide sahne seçici), pvp/howto.js, testleri.
- **Ajan Animasyon (yazı + sinematik + vuruş yazıları):** pvp/fight-hud.js, pvp/fight-hud.css, pvp/fx-damage.js, pvp/fx-damage.css,
  pvp/cinematic.js, pvp/cinematic.css, pvp/stage-focus.js, pvp/typing-top-model.js, pvp/fight-motion.*, pvp/combat-fx.*, testleri.
  Yazma kutusunun YAZI animasyonları (harf girişinde vurgu, doğru kelimede patlama, yanlışta sarsıntı) için pvp/typing-top-model.js
  ve gerekirse sınıf adları; CSS'i fight-hud.css'e koy (typing-top.css Düzen'in).
- index.html'e kimse DOKUNMAZ. Başka ajanın dosyasında gereken değişikliği raporla.

## Kalite kuralları
- Önce docs/EKRAN-KONTROL-KURALLARI.md'yi oku ve uygula (tüm durumlar; 1920x940, 2400x1175, 1366x650, 375x812; ölçerek).
- Erişilebilirlik: yazı ≥12 px, odak halkası, prefers-reduced-motion ve #pvp-root.pvp4-reduced'a uy.
- Sunucu güvenliği: istemci yalnız izinli kimlik/boolean gönderir; sunucu doğrular. Paket sınırı room.js MAX_BYTES 4096.
- `node --test tests/*.test.mjs` ve `npm run cf:validate` geçmeli (son bilinen: 602/602, 75/75; önceki yarım kalan ajanların kısmi değişiklikleri diskte olabilir — `git diff` ile gör, üzerine kur). Başkasının yarım işinden düşen testi raporla.
- Dosyaların satır sonlarını koru (çoğu LF; CRLF'ye çevirme).
- Tarayıcı: dev sunucu http://localhost:5178 açık. KENDİ sekmeni aç (mcp__Claude_Browser__tabs_create), ölçmeden önce ÖNE AL
  (tabs_select; arka planda rAF/animasyon durur), hep o tabId'yi kullan, bitince resize_window preset desktop ve sekmeni kapat.
  Bot maçları: http://localhost:5178/?pvp=practice&mode=classic&arena=3d (mode=rounds, mode=arena); karakter/sahne debug:
  &fighter1=sira&fighter2=nyx (yalnız localhost). Gerçek yazma: find "textbox" → type="text" olan ana kutu → left_click → computer type "kelime ".
- **Gamedev skill'leri (yeni kuruldu, ÖNCE BUNLAR):** gamedev:router (hangi skill'in uyduğunu söyler), gamedev:threejs-scene-setup, gamedev:threejs-gltf-loading, gamedev:threejs-materials-lighting, gamedev:shader-programming, gamedev:game-feel, gamedev:camera-systems, gamedev:game-ui-ux, gamedev:audio-design, gamedev:performance-optimization, gamedev:level-design (sahne tasarımı), gamedev:create-game-assets.
- **Skill kullanımı ZORUNLU:** işine uygun skill'leri Skill aracıyla çağır ve uygula. Örnekler: UI/CSS → vectorlab-ux-skills:ux-audit,
  :viewports, :typography, :spacing, :motion, :transitions, :reduced-motion, :keyboard, :surfaces, :colour-palette, :anti-slop,
  frontend-design:frontend-design; hata ayıklama → superpowers:systematic-debugging; yeni özellik → superpowers:test-driven-development;
  bitirmeden önce → superpowers:verification-before-completion; kod incelemesi → superpowers:requesting-code-review.
  Raporunda "Kullanılan skill'ler:" satırında hangilerini NEDEN kullandığını yaz.

## Rapor (son mesajın, Türkçe)
Ne yaptın, değişen/eklenen dosyalar, önce/sonra ölçümler, test sonucu, Kullanılan skill'ler, kalan sorunlar (kimin dosyasında).
