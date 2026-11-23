# 17 — PvP: Denetçinin bıraktıkları + açılış/maç performansı (Usta, 24 Kas 2026)

Tarayıcı: 5177, Claude tarayıcı paneli (kendi sekmem, bitince kapatıldı). Commit yok.
Panel bu oturumda da **gizliydi**: yerel rAF donuk. Ölçüm ve maç oynatma için sekmeye `requestAnimationFrame → setTimeout(16)` yaması
(yalnız benim sekmem, kod değil) koydum; 3B arenanın kendi döngüsü bu yamayı görsün diye 3B'yi ayardan kapatıp açtım.
Bu yüzden kare süreleri **GPU'suz, yalnız ana iş parçacığı** ölçümüdür; gerçek kare hızı ölçülemedi.

## Sorunlar

| # | Sorun | Düzeltildi mi | Dosya / satır | Ölçüm |
|---|---|---|---|---|
| 1 | Lobide maç yokken varsayılan Vargr + Doran GLB'leri iniyordu | Evet. Maç yokken yalnız oyuncunun SEÇİLİ dövüşçüsü, arketipinin koltuğunda yüklenir. Lobide seçim değişince (`selectFighter` → `tuslab:pvp-fighter` olayı) yenisi yüklenir. Bot, maç açılınca yüklenir; o sırada mevcut "Savaşçılar hazırlanıyor…" göstergesi çıkar. | `pvp/pvp-main.js` 186–197 (`lobbyFighterMap`, lobi dalı), 857 (dinleyici); `pvp/network.js` 357 | Lobi GLB: önce vargr+doran **2341 KB**, sonra yalnız seçili **1113–1228 KB**. Sira seçiliyken önce sira hiç yoktu (maçta iniyordu), şimdi lobide iniyor. Lobide Nyx'e tıklayınca nyx.glb indi (görüldü). Maç açılışında bot modeli dahil "hazır" süresi 887–942 ms (yerel). |
| 2 | Maç açılışında ≈963 ms'lik tek uzun görev | Kısmen. **Birebir yeniden üretilemedi.** Ölçtüğüm en uzun maç açılış karesi 100–107 ms. Ön-ısıtma işleri kare kare (derleme ×3, prova, çizim): en ağırları ilk `renderer.compile` (~300–376 ms) ve efekt provası (~260 ms). (1) sayesinde bunlar artık lobide, oyuncu seçim yaparken oluyor. Efekt provası koltuk başına ayrı kareye bölündü; provası yapılmış koltuk (oyuncunun dövüşçüsü) maçta tekrar prova edilmiyor. | `pvp/arena3d.js` 4346 (`warmQueue` koltuk başına), 4371–4376 (`rehearseFx(only)`), `warmStep` | Maç açılışı ana iş parçacığı kareleri (>30 ms): önce 46 / 100 / 100 / 35 ms, sonra 43 / 107 / 87 ms. Lobide (arka planda) 300 / 142 / 115 / 264 / 81 ms. LoAF/longtask gözlemcisi gizli panelde hiç kayıt vermedi (yapay 200 ms döngüyü de görmedi), bu yüzden kendi zamanlayıcımla ölçtüm. |
| 3 | Teslimde "6.000 – 6.000 · 7 raund" | Evet. Teslimde satır: "Teslim · Raund 1/7'de çekildin" (rakip çekildiyse "Rakip Raund N/T'de çekildi", ani ölümde "ani ölümde"). Üst küçük satır "7 raundluk maç · 0 raund oynandı". Uzun satır adların altına iner, ad kırılmaz. Yalnız metin. | `pvp/rounds-ui.js` 370–378, 843; `pvp/rounds-ui.css` 965–969 | 1440×900 ve 844×390'da gördüm. |
| 4 | Kalkanlı dövüşçüde "Toplam iyileşme: +0" (DEVIR 7) | Evet. Kalkan kuran dövüşçüde (Sira, Doran) satır gizli. Motor sonucu kalkan toplamını taşımıyor. `shieldDone` alanı eklenirse "Toplam kalkan: N" yazılır. | `pvp/phase15-results.js` 40–47 (`defenseLine`) | Gerçek maçta: Sira/Doran kartında satır yok, Nyx'te "Toplam iyileşme: +880". |
| 5 | Telefon yatayda yazma paneli dövüşçülerin iç yarısını örtüyordu | Evet. Panel 444 → 324 px (844'te), `clamp(300px, 100vw − 520px, 520px)`. Kelime 30 px, başlık 12 px. | `pvp/fight-hud.css` 688–691 | 844×390'da önce/sonra baktım: iki dövüşçü artık görünüyor, yazılan "Eğ" kutuda okunuyor. |
| 6a | DEVIR 5: 800 px'te beceri rayları üst HUD'un üstüne biniyor | Evet. 761–1100 px'te raylar panelin üstüne değil, alt köşelere (panelin altındaki 150 px'lik boşluğa) iner. | `pvp/fight-hud.css` 693–697 | 800×600: önce raylar y=55 (HUD 46–177'yi örtüyor), sonra y=444–586. Ekran görüntüsüyle baktım. |
| 6b | DEVIR 8: Kalkan kurma sesi yok | Evet. Kalkan kurulunca mevcut `assets/sfx/shield.mp3` çalar. | `pvp/pvp-main.js` 800–802 | Gerçek maçta kalkan olayı (37304 ms) ile aynı ms'de 700 ms'lik ses tamponu başladı. |
| 6c | DEVIR 12: ad "SAVAŞ/ÇI" diye kırılıyor | Evet. `overflow-wrap:anywhere` yerine `break-word`. | `pvp/fight-hud.css` 699–701 | 800×600 ve 390×844'te "SAVAŞÇI" tek satır. |
| 7a | Lobide 4 arenanın tam (1600×900) görselleri | Evet. Lobi kartları ve oda slotu 800×450 sürümleri (`*-kart.webp`) kullanıyor. 3B sahne tam görseli kullanmaya devam ediyor. | `pvp/lobby-v3.css` 189, 766–769, 785–788; yeni `assets/higgsfield/final/arena-*-kart.webp` | 315 KB → 73 KB (−242 KB). 1440'ta kart kalitesine baktım. |
| 7b | Lobide 3B arena opak lobinin arkasında sürekli çiziliyordu | Evet. Maç yokken lobi paneli açıksa kare çizilmez. Ön-ısıtma kuyruğu doluyken yine çizilir. | `pvp/arena3d.js` 532, 4681; `pvp/pvp-main.js` 139, 150 | Lobi döngüsünün ana iş parçacığı maliyeti kare başına 2,31 → 1,11 ms (GPU ölçülemedi). Lobi 1440, 390 ve 844'te tam ekran ve opak. |

Lobi toplamı (`?pvp=lobby`, 1440): istek sayısı 198 → 197. İndirilen bayt yaklaşık −1,35 MB: bir GLB (1,1–1,2 MB) + arena görselleri (−242 KB).

## Dokunulmayanlar / öneriler
- **Rig düzlem dokuları** (`assets/rig/*-core.webp` vb., ~474 KB): lobide hem 2B rig (`characters.js`) hem 3B yedek düzlem için iniyor (ikincisi önbellekten). 3B'nin `readyState` hazır olma koşulu bu dokulara bağlı, değiştirmek riskli.
- **Lobide sahne:** 3B, maç yokken varsayılan kolezyum görselini (54 KB) yükler. Seçili arena maçta iner. Lobide seçili arenayı ön ısıtmak küçük bir kazanç, yapılmadı.
- **Lobi müziği** (anadolu.mp3, 467 KB) zaten boşta yükleniyor. 29 SFX toplam ~180 KB. Dokunulmadı.
- **GEREKEN DEĞİŞİKLİK (sahiplik dışı):** `pvp/shared/match.js` `matchResult` → oyuncuya `shieldDone` (kurulan kalkan toplamı; `HEAL_APPLIED.shieldAdded` toplamı) eklenirse sonuç kartı "Toplam kalkan" yazar. `cloudflare/src/match.js` aynası da gerekir.
- **844×390 sonuç ekranı:** kart 463 px, ekran 390. Kaydırılabiliyor ama "En yüksek seri" satırı düğmelerin altında kalıyor. Dokunulmadı.
- DEVIR'de kalanlar: 1 ve 1b (K.O. bandı / hayalet tasarımı), 2 (animasyon şikâyeti, ayrıntı yok), 3 (can barı görseli, doğrulanmadı), 4 ve 6 (kural/denge, yasak), 9 (soluk tur arası: 1440'ta tur arasını gördüm, kalıcı soluk ekran görmedim), 10 (8787), 11, 13–16.

## Tarayıcıda gördüklerim (ekran görüntüsüyle)
- 5 dövüşçünün her biriyle maç açılışı, model geldi: Vargr–Doran, Sira–Doran, Nyx–Sira, Hacı Usta–Vargr (1440), Doran–Vargr (844×390).
- Tam bot maçı sonuç ekranına kadar iki kez (Sira–Doran ZAFER/NAKAVT, Nyx–Sira). Yazma: JS ile kutuya kelime + boşluk (gerçek klavye değil). 844'te "Eğ" gerçek tuşla yazıldı.
- Tur arası süre becerisi seçimi (2 + Enter, gerçek tuşla), ayar paneli (aç/Esc), raund sonu çözümü.
- Teslim: kutu → Teslim ol → YENİLGİ · TESLİM OLMA (844×390 ve 1440). "Lobiye dön" lobiyi açtı.
- 800×600 raylar, 390×844 maç HUD'u.
- Konsol: yakalanan kayıtlarda hata yok (`read_console_messages`, son sayfa).

## Görmediklerim / denenmeyenler
- Gerçek kare süresi ve GPU maliyeti (panel gizli). 963 ms'lik görev birebir üretilemedi (GPU gölgelendirici önbelleği sıcak olabilir).
- Yavaş ağda bot modelinin geç gelmesi: "Savaşçılar hazırlanıyor…" göstergesinin yerelde ~0,9 sn göründüğünü sınıf üzerinden ölçtüm, görüntüsünü çekmedim.
- Çevrimiçi oda (8787) ve oda içinde seçim değişimi.
- `prefers-reduced-motion`.
- Not: tarayıcı profilinde `tuslab-pvp-fighter` başka bir oturum tarafından `murad1`'e geri yazılıyor (docs/15). Geçersiz kimlik, varsayılan Vargr'a düşüyor. Zararsız.

## Test
- `node --test tests/*.test.mjs`: **1143/1143** (yeni `tests/pvp-usta.test.mjs`: 9 test). Arada bir kez home testi (`home-typing-akis`, Hoca'nın işi) kırıktı, sonraki koşuda geçti.
- `node cloudflare/build-assets.mjs` + `node scripts/predeploy-check.mjs`: **79/79**.

## Değişen dosyalar
`pvp/pvp-main.js`, `pvp/network.js`, `pvp/arena3d.js`, `pvp/rounds-ui.js`, `pvp/rounds-ui.css`, `pvp/phase15-results.js` (yalnız `defenseLine` eklendi; başka oturumun `leaveLabel` değişikliği yerinde), `pvp/fight-hud.css` (sona 3 blok), `pvp/lobby-v3.css` (9 görsel yolu), `tests/pvp-ekran-duzen.test.mjs` (görsel yolu), yeni `tests/pvp-usta.test.mjs`, yeni `assets/higgsfield/final/arena-{neon-kolezyum,gok-demirhanesi,run-bahcesi,firtina-limani}-kart.webp`, `docs/DEVIR-PVP.md` (5, 7, 8, 12 silindi), bu rapor.
