# 24 — PvP telefon ve dar ekran turu (Telefoncu, 24 Kas 2026)

İstek: PvP'nin telefon ve dar ekran deneyimini baştan sona denemek ve onarmak. Oyun kuralı ve denge değişmedi. Commit yok.
Tarayıcı: 5177, Claude tarayıcı paneli, kendi sekmem (bitince kapattım, görünüm masaüstüne döndü). `tuslab-pvp-*` anahtarları önce yedeklendi, sonunda geri kondu. Oturumda oluşan `tuslab-pvp-guest-id` silindi.
**Gerçek telefon yok. Her şey Chrome emülasyonu.** 768 px'ten dar boyutlarda emülasyon dokunmatik + mobil kullanıcı aracısı (`pointer: coarse`) verdi. 844×390, 896×414 ve tabletlerde dokunmatik emülasyonu yoktu.

## Boyut × ekran tablosu

| Boyut | Lobi | Alt sayfalar / çekmece | Maç | Tur arası | Ayar / ? / Profil / Arkadaşlar | Teslim kutusu | Sonuç | Alıştırma |
|---|---|---|---|---|---|---|---|---|
| 390×844 (dokunmatik) | gördüm | Yetenekler (önce bozuk, düzeldi), Ayarlar, Arkadaşla oyna | gördüm, dokununca yazma | gördüm, kartı dokunarak seçtim | hepsini gördüm | — | ZAFER gördüm | gördüm |
| 375×812 (dokunmatik) | gördüm | — | gördüm (araç çubuğu 44 px) | gördüm, 2. kart dokunarak seçildi | ayar 44 px, Profil 44 px | gördüm | YENİLGİ · TESLİM (önce taşma, düzeldi) | — |
| 360×740 (dokunmatik) | gördüm | — | görmedim | görmedim | görmedim | görmedim | görmedim | — |
| 414×896 (dokunmatik) | gördüm | — | gördüm + yön değişimi | görmedim | görmedim | — | görmedim | — |
| 844×390 | docs/22'de görülmüş | — | gördüm | — | — | — | ZAFER gördüm, kaydırınca hepsi görünüyor | — |
| 740×360 (dokunmatik) | önce bozuk, düzeldi | Ayarlar, Yetenekler (düzeldi) | gördüm | görmedim | — | — | ZAFER ve YENİLGİ (önce tek kart, düzeldi) | — |
| 896×414 | — | — | yön değişimi ara adımı | — | — | — | — | — |
| 768×1024 | gördüm | — | gördüm (Arkadaşlar taşması düzeldi) | — | — | — | görmedim | — |
| 1024×768 | gördüm | — | gördüm | — | — | — | görmedim | — |
| 1440×900, 1920×1080 | gördüm, değişiklik yok | — | gördüm, araç çubuğu 32 px (değişmedi) | — | — | — | — | — |

Klavye düzeni için ayrıca 390×844 ve 844×390'da sahte `visualViewport` (470, 380 ve 190 px) ile kökü daralttım ve ekran görüntüsüne baktım.

## Bulunan ve düzeltilen sorunlar

| # | Sorun | Düzeltme | Dosya |
|---|---|---|---|
| 1 | **Telefonda Yetenekler alt sayfası arena kartlarının altında kalıyordu.** Q/W satırları kartların arkasındaydı, dokunuş perdeye gidip sayfayı kapatıyordu. Sebep: `.j2-info`'nun açılış animasyonu (opacity, `fill:both`) yığılma bağlamı kuruyor, içindeki sabit konumlu alt sayfanın z-index'i oraya hapsoluyor. | Alt sayfa açıkken `.j2-info` animasyonu kalkıyor. | `pvp/lobby-v3.css` 989–996 |
| 2 | **740×360 lobi:** dövüşçü bilgisi 0 px'e eziliyordu. SAVAŞA BAŞLA ekranın altında kırpılıyordu (333–396, ekran 360) ve panel kaymıyor. | Yatay telefonda bilgi ve dövüşçü şeridi yan yana. Arenalar tam satır. Yetenekler, Ayarlar ve BAŞLA tek satırda (başla 286–348). Alt sayfalar başlığın altında kalıyor. | `pvp/lobby-v3.css` 998–1011 |
| 3 | **Yazma paneline dokununca klavye açılmıyordu.** Büyük kelimeye dokunmak kutuya odak vermiyor. Kutu saydam, kelimenin altında 44 px'lik şerit. Dokunmatikte otomatik odak bilerek yok. | Panelde (düğme ya da giriş olmayan yere) dokununca `#tt-input` odaklanıyor. | yeni `pvp/phone-viewport.js` (`isTypingPanelTap`, `onTap`) |
| 4 | **Ekran klavyesi açılınca yazma kutusu kayboluyordu.** iOS ve Android klavyesi yalnız görsel alanı küçültüyor. 390×470'te yazma paneli ekran dışındaydı (kabuk en az 668 px). Tarayıcı sayfayı kaydırıp üst HUD'u kaçırırdı. | `visualViewport` izleniyor. Klavye açıkken kök görsel alana oturuyor (`.pvp-kb-open`, `--pvp-vv-h`). Yazma paneli alta yapışıyor. İstatistik satırı ve raylar gizleniyor. Madalyon kelime şeritlerinin altına çıkıyor. 440 px altında madalyon küçülüyor (`.pvp-kb-short`). 300 px altında (yatay + klavye) yalnız araç çubuğu ve yazma paneli kalıyor (`.pvp-kb-tight`). Yalnız `pointer: coarse` iken çalışıyor. | `pvp/phone-viewport.js`, `pvp/pvp-main.js` 40 ve 64, `pvp/compact-height.css` 593–606 |
| 5 | Araç çubuğu düğmeleri 32–36 px'ti. | Dokunmatikte 44×44. Çubuk 40 px kalıyor. Düğmeler üst kenara yaslanıyor ve 4 px HUD boşluğuna taşıyor. ≤600 px'te simge düğmeleri 44 px genişliğinde. 390'da yedi düğme sığıyor (8–382). | `pvp/compact-height.css` 577–587 |
| 6 | Dokunmatikte ayar paneli düğmeleri ve kaydırıcıları 36 px, Profil ve Arkadaşlar düğmeleri 36 px, teslim kutusu düğmeleri 40 px'ti. | Hepsi 44 px. Ölçtüm: ayar 156×44 ve 330×44, Profil ve Arkadaşlar'da 44 altı düğme yok. | `pvp/compact-height.css` 568–576 |
| 7 | iOS'ta 16 px altı yazı kutusuna odaklanınca sayfa yakınlaşır (ad 15 px, oda kodu 15 px, arkadaş kodu 14 px). | Dokunmatikte bu kutular 16 px. `tt-input` zaten 19–20 px. | `pvp/compact-height.css` 570 |
| 8 | Kökte `touch-action` ve `overscroll-behavior` yoktu. Çift dokunma yakınlaştırıyordu, lastik etkisi vardı. | `#pvp-root{overscroll-behavior:none;touch-action:manipulation;text-size-adjust:100%}`. İki parmakla yakınlaştırma serbest kaldı. | `pvp/compact-height.css` 567 |
| 9 | **Teslim sonuç ekranı (telefon dikey):** "Teslim · Raund 4/7'de çekildin" satırı 26 px ve `nowrap` olduğu için kartın sağından taşıp kırpılıyordu. | ≤600 px'te 18 px, satır kırılabilir. | `pvp/results-v2.css` 194–197 |
| 10 | **740×360 sonuç ekranı:** iki oyuncu kartı alt alta diziliyordu, düğmelerin üstünde yalnız biri görünüyordu. | Yatayda kartlar yan yana. | `pvp/results-v2.css` 187–193 |
| 11 | **601–820 px (768×1024, 740×360):** "Arkadaşlar" yazısı 40 px'lik düğmeden taşıp boşluğa biniyordu. Sadece simge kalması gerekiyordu; tam ekran kuralı yazı boyutunu geri getiriyordu. Bu dokunmatikten bağımsız bir hataydı. | `font-size:0`, yalnız 👥 görünüyor. | `pvp/compact-height.css` 588–592 |
| 12 | Telefonda 3B arena bloom ve tam dpr ile başlıyordu. Vali ancak 45 ısınma ve 40 ölçüm karesinden sonra iniyordu. | `deviceStartStep`: dokunmatik ve kısa kenarı ≤500 px olan cihaz 1. kademeden başlıyor (bloom kapalı). Zayıf telefon (≤4 çekirdek ya da ≤3 GB) 2. kademeden başlıyor (oran ≤1,25, 1,4 MP). Çok zayıf masaüstü (≤2 çekirdek ya da ≤2 GB) 1. kademeden başlıyor. Elle seçilen `high`/`low` her zaman üstün. `auto`'ya dönüşte cihaz kademesine dönülüyor. Emülasyonda ölçtüm: `step 1, bloom false, ratio 2`. | `pvp/perf-governor.js` 45–72, `pvp/arena3d.js` 5, 597–599, 4321 |

**docs/17'deki 844×390 sorunu ("En yüksek seri" düğmelerin altında) artık yok.** Düğmeler yapışkan. Kart sonuna kaydırınca raund çubukları, "En yüksek seri", süre ve rövanş satırı düğmelerin üstünde görünüyor. Kod değiştirmedim, önceki bir iş düzeltmiş.

## Sorun olmayanlar (kontrol edildi)
- Yatay taşma: hiçbir boyutta yok (`scrollWidth = innerWidth`). 12 px altı görünür yazı: yok. Telefonda gizli 10×48'lik beceri düğmeleri ekran okuyucu içindir (`clip-path: inset(50%)`).
- `tt-input` için `autocapitalize`, `autocorrect`, `spellcheck` ve `autocomplete` kapalı, `enterkeyhint="send"`. Türkçe karakterli kelimeler gerçek tuşla yazıldı ("Cahile", Space ile gönderildi). `inputmode` yok, varsayılan metin klavyesi doğru.
- Yön değişimi: 414×896 → 896×414 → 414×896 maç sırasında. Düzen toparlandı, dövüşçüler yerinde.
- Tur arası kartı dokunarak seçildi (`aria-pressed=true`). "Seçimi kilitle" ve "Seçme" 44 px.
- Kök `position:fixed; inset:0`, kabuk `100dvh`. `100vh` sorunu görmedim.
- 3B tuval: dpr üst sınırı 2 (yüksek), 2. kademede 1,25 ve bütçe, düşükte 1. Parçacık tuvali kendi bütçesinde.

## Düzeltilmeyenler / bilinenler
- **Güvenli alan:** `index.html` viewport etiketinde `viewport-fit=cover` yok (index.html değişmez). Bu yüzden `env(safe-area-inset-*)` hep 0 ve tarayıcı içeriği çentiğin dışında tutuyor, kesilme olmaz. Alt sayfalara `env(safe-area-inset-bottom)` dolgusu ekledim. `viewport-fit=cover` eklenirse etkinleşir, şu an etkisiz.
- **Raund sonunda klavye kapanıyor.** Çözüm sırasında yazma paneli gizleniyor, odak düşüyor. Dokunmatikte otomatik odak yok, çünkü iOS izin vermez ve klavye kendiliğinden açılıp sahneyi kapatırdı. Oyuncu her raunt panele bir kez dokunuyor. Düzeltme 3 bunu kolaylaştırıyor.
- **Yatay + klavye (görünür alan < 300 px):** sahne neredeyse tamamen kapanıyor, yalnız araç çubuğu ve yazma paneli kalıyor. Bilerek böyle bıraktım, o yükseklikte başka bir şey sığmıyor.
- Lobide "Rastgele" arena düğmesi 740×360'ta 26×44 (yan simge).
- Araç çubuğu düğmelerinin üst köşeleri ekran kenarına yaslı. "Sekme" görünümü oluşuyor, bilerek.
- 360×740'ta maç, sonuç ve tur arası görülmedi. Tabletlerde sonuç ekranı görülmedi. 844×390, 896×414 ve tabletlerde dokunmatik emülasyonu yoktu: 44 px kuralı tablette ayrı bir stil etiketiyle denendi, gerçek `pointer:coarse` ile değil.
- Gerçek ekran klavyesi, gerçek iOS/Android ve gerçek GPU kare hızı denenmedi. Klavye düzeni sahte `visualViewport` ile doğrulandı.
- Zayıf telefon kademesi (2) emülasyonda tetiklenemedi (makine 12 çekirdek), yalnız birim testiyle doğrulandı.

## Şöyle yorumladım
- "Dokunma hedefi ≥44 px": araç çubuğunu 44 px'e büyütmek HUD'u kaydırırdı. Çubuğu 40 px bıraktım, düğmeleri 44×44 yaptım, 4 px HUD boşluğuna taşıyorlar. Kural yalnız dokunmatikte, masaüstü değişmedi.
- Telefon kalite kademesi: "kalite seçimi" düğmesi yok. Oyuncunun elle seçimi "3B arenayı kapat" ve "Efektleri azalt" ile, ikisi de dokunulmadan üstün. `setQuality('high'|'low')` API'si de kademeyi eziyor. Otomatik kademe yalnız `auto` iken çalışıyor.
- Yatay telefonda (≤760 px) kahraman portresini gizledim, adı ve silahı bıraktım. 360 px yükseklikte başla düğmesine yer açmak için.
- Klavye açıkken istatistik satırını (WPM, kelime sayısı) ve beceri raylarını gizledim. Geçerli kelime, yazma kutusu, can barları ve raund saati görünür kalıyor.

## Testler
- `node --test tests/*.test.mjs`: **1186/1186**. Bunun PvP kısmı (`tests/pvp-*.test.mjs`): **1081/1081**. Yeni `tests/pvp-telefon.test.mjs`: 7 test. Home testleri bu çalıştırmada kırık değildi.
- `node cloudflare/build-assets.mjs`: tamam (`phone-viewport.js` çıktıda). `node scripts/predeploy-check.mjs`: **79/79**.

## Dosyalar
`pvp/phone-viewport.js` (yeni), `pvp/pvp-main.js` (2 satır: import ve kurulum), `pvp/perf-governor.js` (`deviceStartStep`, `readDeviceHints`), `pvp/arena3d.js` (import ve 2 `setStep` satırı), `pvp/compact-height.css` (sona TELEFONCU bölümü), `pvp/lobby-v3.css` (sona TELEFONCU bölümü), `pvp/results-v2.css` (sona TELEFONCU bölümü), `tests/pvp-telefon.test.mjs` (yeni), `docs/DEVIR-PVP.md`, bu rapor. `cloudflare/public` yeniden üretildi.
