# 14 — PvP denetimi (Denetçi, 24 Kas 2026)

Gerçek kullanımla tur: 5177, Claude tarayıcı paneli (kendi sekmem; bitince kapatıldı). Commit yok.
Not: panel bu oturumda **gizliydi**. Bu yüzden rAF saniyede 1 kez çalıştı, CSS geçişleri dondu ve kare süresi ölçülemedi (aşağıda).

## Bulunan sorunlar

| # | Sorun | Nerede | Düzeltildi mi | Dosya / satır |
|---|---|---|---|---|
| 1 | "Teslim ol" tepki vermiyor. Kök neden: `window.confirm` gömülü tarayıcıda gösterilmeden `false` dönüyor (konsolda "Page dialog suppressed (confirm)" uyarısı). Esc ve maç içi "← Ana Sayfa" de aynı yolu kullanıyordu. | maç, sağ üst | Evet. Oyun içi `<dialog>` kutusu açılıyor; varsayılan odak "Devam et" düğmesinde. Vazgeçince odak yazma kutusuna dönüyor. | `pvp/confirm-dialog.js` (yeni); `pvp/pvp-main.js`: import satır 19; kapatma 657–664; keydown 1005 ve 1015–1019; teslim 1064–1070; `pvp/phase15-results.css` sonu |
| 2 | Telefon yatay (844×390): yazma paneli y≈20'ye çıkıp HUD'u ve madalyonu örtüyor. Beceri rayları ekran dışında (y<0). Sahne 54 px olduğu için dövüşçüler minicik. | maç | Evet. Panel altta ve kısa, raylar alt köşelerde küçük (yalnız altıgen), madalyon araç çubuğunun altında, sahne ≈230 px. Tur arası bandı can barlarının altından başlıyor. | `pvp/fight-hud.css` sonu (2 blok); `pvp/rounds-ui.css` max-height:500 bloğu + sondaki yatay blok |
| 2b | Telefon yatayda maç başlarsa dövüşçüler hiç görünmüyor: gösterilen konum x≈±98'de başlıyor, saniyede 7,2 birimle ~13 sn yürüyor (gizli sekmede dakikalarca). | maç, 3B | Evet. Arena genişliğini aşan fark (`ARENA_SNAP_DIST` = 15) bozuk durum sayılıyor ve dövüşçü anında yerine oturuyor. | `pvp/arena3d.js`: sabit 138; dövüşçü konumu 3159–3162 |
| 3 | Telefon dikey: KALKAN rozeti `flex:none` olduğu için ad 22 px'e sıkışıyor, "BOT · KOLAY" harf harf kırılıyor (910 px'te de iki satır). | maç HUD | Evet. Üst satır sarıyor, rozet alt satıra iniyor. | `pvp/fight-hud.css` sonu (`.fhud2-top{flex-wrap:wrap}`) |
| 4 | Arena kartı adları ≤620 px yükseklikte gizli. Ayrıca bu yükseklikte arena satırı 0 px'e iniyor, kartlar ve ad MAÇ AYARLARI'nın üstüne biniyordu (844×390). | lobi | Biniş düzeltildi. Adlar bilerek gizli bırakıldı (aşağıda). | `pvp/lobby-v3.css` sonu |
| 5 | Tur arası panelinde madalyon yok. | tur arası | Değiştirilmedi. Panelin başlığı "RAUND N BİTTİ · Raund N+1 başlıyor ⟨sayaç⟩" aynı bilgiyi veriyor ve görüntü temiz (1440 ve 1280'de baktım). | — |
| 6 | Pencere boyutlanınca seçili madalyon yeniden ortalanmıyor. | lobi | Evet (1280→1000'de ölçüldü: seçili madalyonun merkezi şeridin merkezinde, 320=320). | `pvp/network.js` 310–314 |
| 7 | "RAUND N SONUCU" şeridi soluk. Başka bir oturumun commit edilmemiş değişikliği karartmayı 40 px aşağı kaydırmış (`fight-hud.css:333` top:var(--fs-toolbar)), madalyon penceresi şeridin altına düşmüştü. | maç, raund sonu | Evet (1440'ta önce soluk, sonra parlak). | `pvp/rounds-ui.css` 931–936 |
| 8 | three r160 `compileAsync` yoklaması, atılmış malzemede "reading 'isReady'" diye yakalanmamış hata veriyordu. Söz çözülmeyince `pendingCompiles` sıfıra inmiyor, kalite yöneticisi kalıcı duruyor, `whenWarm` 60 sn bekliyordu (`?pvp=practice` açılışında yazma paneli gizli kalabilir). | maç sonu / rövanş | Evet. Senkron `compile` + güvenli yoklama + 5 sn tavan. Yeniden yüklemeden sonra konsolda bu hata görülmedi. | `pvp/arena3d.js` `safeCompileAsync` (4500), warmStep |
| 9 | 761–1279 px'te 7 mod sekmesi sığmıyor, seçili "Rastgele" kırpılıyordu (1000×720). | lobi üst | Evet. Sekmeler sıkılaştı; dar pencerede sağ kenar soluyor, seçili sekme görünür alana kayıyor. | `pvp/lobby-v3.css` sonu; `pvp/arena-ui.js` `revealInSeg` |
| 10 | 390 px'te 5 madalyon 31 px taşıyor, "DÖVÜŞÇÜLER" başlığı kırpılıyordu. | lobi telefon | Evet (356/356). | `pvp/lobby-v3.css` sonu (max-width:440px) |
| 11 | Sonuç ekranı, teslimde "6.000 – 6.000 · 7 raund" yazıyor (TESLİM OLMA başlığı doğru). | sonuç | Hayır, küçük. Metin kuralı phase15 dosyasında; karar gerek. | — |
| 12 | Kalkanlı botta sonuç kartında "Toplam iyileşme: +0" (DEVIR-PVP 7). | sonuç | Hayır, zaten listede. | — |
| 13 | Lobide (maç yokken) arena varsayılan Vargr + Doran GLB'lerini yüklüyor (2,3 MB). Seçim Sira/Nyx olunca boşa gidiyor. | lobi → maç | Hayır (riskli). Önceden yüklemeyi kaldırmak maç açılışını yavaşlatır. Önerim: lobide oyuncunun seçili dövüşçüsünü yüklemek. | `pvp/pvp-main.js` `arena3dSyncFighters` |
| 14 | Maç açılışında tek bir 963 ms'lik uzun görev var (model/gölgelendirici). Maç içindeki uzun görevler ≈50–55 ms. | maç başı | Hayır (ölçüm sınırlı). | — |

### Düzeltilmeyenler / bilinçli kararlar
- **Arena kartı adları (madde 4):** ≤620 px yükseklikte kart 64×44 px; 12 px'lik "Gök Demirhanesi" sığmıyor. Seçili arenanın adı hemen üstte büyük yazıyla duruyor, adlar ekran okuyucuda var. Diğer boyutlarda (1920, 1440, 1280, 1000×720, 390) adlar kartta görünüyor. Bunu "tutarlı" kabul ettim.
- **Telefon yatayda yazma paneli dövüşçülerin iç yarısını örtüyor.** 844 px'te panel 444 px, dövüşçüler x≈210/630'da. Daha dar panel kelimeyi sıkıştırır. Gerçek telefonda ekran klavyesi zaten bu yüksekliğin çoğunu kaplar.
- **Telefon yatayda tur arası bandı** 246 px. Kartların alt yarısını görmek için bant içinde kaydırmak gerekiyor (1–3 + Enter ile seçim çalışıyor).
- Q/W/E/R becerileri seriyle kendiliğinden atılıyor; elle basılacak bir tuş yok (`pvp-main.js`'te tuş işleyicisi yok). Maçta Q, W ve R'nin "ATILDI ✓", E'nin "KALKAN 330" ve "+300 can" olarak çalıştığını gördüm.

## Padişahlar kaldırıldı (kullanıcı kararı)
- `pvp/shared/fighters.js`: `FIGHTERS` artık yalnız 5 temel dövüşçü. `PADISAH_IDS = []`. `fighterBody`, `fighterQuote` ve `BASE_FIGHTER_IDS` yerinde kalıyor (`fighterBody(id)` kimliği aynen döndürüyor). Import kaldırıldı.
- `_to_delete/padisah-pvp/` altına taşınanlar (düz taşıma): `pvp/shared/padisahlar.js`, `assets/padisah/` (20 SVG), `scripts/padisah-madalyon.mjs`, `tests/pvp-padisah.test.mjs`.
- `pvp/portraits.js`: padişah portre eşlemesi ve `DOCK_NAMES` girdileri kaldırıldı. `DOCK_NAMES = {}` oldu. `dockMedallionUrl` her zaman `null` döndürüyor (dışa aktarım uyumluluk için duruyor).
- `pvp/lobby-v3.css`: padişah portre, yüz, küçük madalyon ve `.j2-soz` kuralları silindi (26 satır), `data-dock-group="padisah"` başlık rengi de.
- `pvp/network.js`: dokunulmadı. Padişah grubu boş olduğu için hiç çıkmıyor (`group()` boşta ''). Bilgi kartındaki "N. padişah" ve söz satırları alan yokken üretilmiyor (testle doğrulandı).
- `pvp/arena3d.js`: yalnız yorum güncellendi. `pvp/quote-bubble.js`, `sound.js`: söz yokken zararsız, olduğu gibi kaldı.
- Bot havuzu 5 dövüşçüden seçiyor (ateş: Vargr, Sira; rün: Doran, Nyx, Hacı Usta).
- Testler: `tests/pvp-lobi-serit.test.mjs` 5'li kadroya göre yeniden yazıldı. `pvp-fighters32` (kart sayısı 5, havuz uçları), `pvp-konyali-k` ve `pvp-lobi-j2` güncellendi.
- `cloudflare/public` yeniden üretildi, padişah dosyaları artık yok (git'te yok sayılan klasör).
- Tarayıcıda gördüm: lobide 5 madalyon, tek "DÖVÜŞÇÜLER" grubu, ortada (1920, 1440, 800×546, 390). Bot maçı açıldı: Nyx – Sira (1440) ve Nyx – Vargr.

## Tarayıcıda gördüklerim (ekran görüntüsüne bakarak)
- 1440×900: lobi; Hacı Usta ile kolay bot maçı. Yazma (gerçek tuşlarla "Çocuğa", "Zemheride"; sonra otomatik yazıcı), raund sonu çözümü, tur arası süre becerisi seçimi (1/2 + Enter), ayar paneli, yardım (?) paneli ve Esc ile kapanması, raund 5'te nakavt ile ZAFER sonuç ekranı. "Rövanşa başla" yeni maçı açtı. Teslim ol → kutu → "Teslim ol" → YENİLGİ · TESLİM OLMA. "Lobiye dön" lobiyi açtı. Kutuda "Devam et" ve Esc maça döndürdü.
- Önce/sonra: Teslim ol (önce tepkisiz, sonra kutu), RAUND N SONUCU şeridi (soluk/parlak), 390 KALKAN rozeti (kırık/tek satır), 844×390 maç (bozuk/düzgün), 844×390 lobi (biniş/düzgün), 1000×720 sekmeler, 390 lobi şeridi.
- 1920×1080 lobi; 7 sekmenin hepsi tıklandı, hata yok. "Arkadaşla oyna" → "Oda oluştur": 8787 kapalıyken açıklayıcı hata kutusu çıktı ("BASLAT-CLOUDFLARE.bat ile aç…"). Esc yalnız çekmeceyi kapattı. "← Ana Sayfa" ana ekrana döndü.
- 1280×720: tur arası bandı ve kalkan rozeti satır içinde.
- Sızıntı: maçtan lobiye dönünce 6 sn boyunca hiç rAF ve setTimeout çağrısı olmadı, çalışan CSS animasyonu yoktu, JS yığını 28 MB. Maç içinde sonsuz döngülü CSS animasyonu yok.

## Görmediklerim / denenmeyenler
- **Kare süresi:** panel gizliydi, rAF saniyede 1 kez çalıştı. Takılma ölçümü yapılamadı, yalnız longtask ve LoAF kaydı alındı (madde 14).
- Telefon dikeyde KALKAN rozeti **yapay olarak** açıldı. O an bot kalkan kurmamıştı; aynı DOM durumu elle verildi. 1280'de gerçek rozeti gördüm.
- Çevrimiçi oda (8787) çalışmadı; yalnız hata yolu denendi.
- `prefers-reduced-motion` taklit edilmedi.
- Telefon yatayda tur arası bandının kaydırılmış alt kısmı ve sonuç ekranı görülmedi.
- Gizli panelde çekmece kapanış geçişi donduğu için "← Ana Sayfa" tıkı bir kez çekmeceye takıldı. Animasyonlar bitirilince çalıştı; bu bir test ortamı yan etkisi, hata değil.

## Test
- `node --test tests/*.test.mjs`: **1123/1123** geçti (yeni `tests/pvp-denetim.test.mjs` 5 test). Arada `home-kokpit` testi Edip'in işi yüzünden bir süre kırıldı, son koşuda geçti.
- cf:validate (`npm` PATH'te yok; iki adımı tam node yoluyla çalıştırdım): `cloudflare/build-assets.mjs` sonra `scripts/predeploy-check.mjs` → **79/79**.

## Değişen dosyalar
- Yeni: `pvp/confirm-dialog.js`, `tests/pvp-denetim.test.mjs`, `docs/14-pvp-denetim.md`.
- `pvp/pvp-main.js` (yalnız onay kutusu satırları), `pvp/phase15-results.css` (sona blok), `pvp/rounds-ui.css` (maske kaydırması, max-height:500 bloğu, sona yatay blok), `pvp/fight-hud.css` (sona 3 blok; başka oturumun değişikliklerine dokunulmadı), `pvp/lobby-v3.css` (sona 3 blok; padişah kuralları silindi), `pvp/network.js` (310–314 resize dinleyicisi), `pvp/arena-ui.js` (`revealInSeg`), `pvp/arena3d.js` (`ARENA_SNAP_DIST`, `safeCompileAsync`, yorum), `pvp/portraits.js`, `pvp/shared/fighters.js`.
- Testler: `tests/pvp-lobi-serit.test.mjs`, `tests/pvp-fighters32.test.mjs`, `tests/pvp-konyali-k.test.mjs`, `tests/pvp-lobi-j2.test.mjs`, `tests/pvp-raund-sayac.test.mjs`.
- Taşınan: `_to_delete/padisah-pvp/{pvp/shared/padisahlar.js, assets/padisah/, scripts/padisah-madalyon.mjs, tests/pvp-padisah.test.mjs}`.
