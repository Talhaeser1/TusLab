# 20 — PvP tuş turu: her düğme, her tuş, her akış (Kâşif, 24 Kas 2026)

Tarayıcı: 5177, Claude tarayıcı paneli, kendi sekmem. Bitince kapattım. Commit yok.
Panel çoğu zaman **gizliydi** ve rAF donuyordu. Önceki turlardaki gibi yalnız kendi sekmeme `requestAnimationFrame → setTimeout(16)` yaması koydum. 3B döngü bu yamayı görsün diye 3B'yi ayardan kapatıp açtım. Bu bir test düzeneği, koda girmedi.
Gerçek tuş: `computer key` ile tek tek basıldı (harf, ğ/ş/ı, Backspace, Space, Esc, Tab, Enter, 1–3, 2/7). `computer type` metnin tamamını tek `input` olayıyla yapıştırıyor. Uzun maçları sayfa içi bir yazıcıyla oynattım: harf harf `input` olayı gönderdi.
**Dikkat:** aynı tarayıcı profilinde başka bir oturum `tuslab-pvp-*` anahtarlarını değiştiriyor. Test sırasında dövüşçü, zorluk ve arena kendiliğinden değişti. Her maçtan önce seçimi yeniden yaptım.

## Envanter

| Öğe | Beklenen | Sonuç | Düzeltme |
|---|---|---|---|
| Lobi · 7 içerik sekmesi | Seçilen içerikle maç açılır | Hepsini maçta ilk kelimelerle doğruladım. Klasik: genel cümle. Zamana Karşı: kelime. Arena: hazırlık evresi. Atasözü: "Güvenme varlığa…". Şiir: "Tüfek icat oldu…" ve şair ipucu (Köroğlu). Osmanlıca: "tahammül" ve "Anlamı: dayanma". Rastgele: raund başına değişiyor (1. raund kelime, 2. raund Osmanlıca). | — |
| Lobi · Arkadaşla oyna (8787 kapalı) | Formlar, hata durumları, düzgün uyarı | "Oda oluştur" ve geçerli kodla katıl: "Çevrimiçi oda sunucusu bu adreste çalışmıyor… BASLAT-CLOUDFLARE.bat…" kutusu çıktı. Esc ve Kapat çekmeceyi kapatıyor. **Hata:** `ABCDEF1234567890` gibi 16 karakterlik ama 0/1 içeren koda "16 karakter olmalı" deniyordu. Davet bağlantısının tamamı yapıştırılınca kod alınmıyordu. | Düzeltildi (aşağıda 7) |
| Lobi · ← Ana Sayfa | Ana sayfaya döner | Döndü (`index.html`). | — |
| Lobi · 5 dövüşçü | Tık, ok tuşları, Enter | Tık ve → çalışıyor (Doran → Nyx), seçim kalıcı. Radyo üzerinde Enter maçı başlatıyor. | — |
| Lobi · 4 arena + Rastgele, bot zorluğu, raund biçimi | Gerçekten etki eder | Zor bot 11 sn'de 10 kelime (≈65 WPM), Kolay ≈25 WPM. "Kelime raundu" ilk bitirenle bitiyor (ALL_DONE). "Zamana karşı" 30 sn sürüyor. İkisi de oynandı. | — |
| Lobi · Savaşa başla | Tık ve Enter | İkisi de çalışıyor. Çift tık tek maç açıyor. | — |
| Maç · Lobiyi aç | Lobi açılır, maça dönülür | **Hata:** dövüş HUD'u (can barları, beceri rayları, süre) lobinin ÜSTÜNE çiziliyordu ve "Yeniden savaş" düğmesini örtüyordu. Lobiden maça dönmenin yolu yoktu: Esc bir şey yapmıyordu, "Lobiyi kapat" düğmesi lobinin altında kalıyordu. Maç arkada sürüp oyuncu dayak yiyordu. | Düzeltildi (1) |
| Maç · Profil, Arkadaşlar | Panel açılır | **Hata:** panel 26 px'lik bir şeride iniyordu ve HUD'un altında kalıyordu. Görünen yalnız ince bir çizgiydi. | Düzeltildi (2) |
| Maç · ? (Nasıl oynanır) | Sekmeli rehber, Esc kapatır | Çalışıyor. | — |
| Maç · ⚙ ayarlar | Her ayar etki eder ve kalıcı | Müzik ve ses aç/kapat, iki kaydırıcı (`tuslab-pvp-*-volume/muted`) kalıcı. 3B kapat/aç çalışıyor ve kalıcı. "Tam ekran" API'ye bağlı, gömülü panelde denemedim. **Hata:** "Efektleri azalt" kalıcı değildi, yenilemede sıfırlanıyordu. | Düzeltildi (5) |
| Maç · Teslim ol | Kutu: Devam et / Teslim ol / Esc | Tık, Esc ve Enter (varsayılan "Devam et") çalışıyor. Teslimde YENİLGİ · TESLİM OLMA. | — |
| Maç · ← Ana Sayfa | Onay sorar | "Maçtan çık?" kutusu, Vazgeç çalışıyor. | — |
| Maç içi tuşlar | Harf, ğüşıöç, Space, Backspace, yanlış kelime, Esc, Tab | Gerçek tuşla yazıldı: "sepe x ⌫ t ␣", "taş", "şimdx" (yanlış). Yanlışta sıradaki kelimeye geçiyor, seri yarıya iniyor (1→0), doğruluk %88. **Hata:** Esc yazma kutusundayken hiçbir şey yapmıyordu. Kutu dışındayken de Chrome'da onay kutusu açılır açılmaz kapanıyordu. Gerçek klavyede Esc hiç onay göstermiyordu, sentetik olay gösteriyordu. **Hata:** Profil/Arkadaşlar/ayar kapanınca odak araç çubuğu düğmesinde kalıyordu ve basılan harfler kayboluyordu. Tab odağı araç çubuğuna taşıyor, bu erişilebilirlik için bilinçli. | Düzeltildi (3, 4) |
| Beceriler seriyle | Raund: 3/5/7/10 · klasik: 2/4/5 | Raund modunda raylar Q ATILDI, W ATILDI, E "+300 can / KALKAN 330", R; sonra "zincir 1/8". Klasik raylar 2/4/5. Kurallar `HASAR-KURALLARI.md` ile tutarlı. | — |
| Tur arası süre becerisi | Tık, 1–3, Enter, süre dolunca | "2" kartı seçiyor, Enter kilitliyor, Esc "Seçme". Süre dolunca seçim yoksa beceri yok. **Hata:** karta tıklayıp ya da 1–3'e basıp "Seçimi kilitle"yi unutan oyuncunun seçimi süre dolunca boşa gidiyordu. | Düzeltildi (6) |
| Raund sonu çözümü, sonuç kartları | Vuruşlar sırayla, özet | Zamana karşı, kelime raundu ve arena özetlerini gördüm. Özet ilk 4–5 sn çözüm kuyruğu yüzünden bekliyor. Seçim penceresi ≈4 sn. | — |
| Sonuç ekranı | Rövanş, Lobiye dön, istatistik | ZAFER (NAKAVT, klasik), ZAFER (KALAN CAN ÜSTÜNLÜĞÜ, 7 raund), YENİLGİ (SÜRE DOLDU), YENİLGİ (TESLİM OLMA; klasik, raund, arena). Rövanşa çift tık güvenli (düğme kilitleniyor). **Hata:** maç bitince düzen eski 2B ızgaraya dönüyordu. Zafer/yenilgi pozu yerine 850 ms boyunca ve sonuç kartının açılış geçişinde eski "RUH DÜELLOSU" panelleri (CAN PUANI, Q/W/S/R kartları) görünüyordu. **Hata:** klasik maçta "Süre … · Sıra #102" kutusu madalyonun iki yanından taşıyordu ("Sü 95 10"). Maç sonunda da sunucu sıra numarası ortada kalıyordu. | Düzeltildi (8, 9) |
| `?pvp=practice` | Bot maçı kendiliğinden açılır | Açıldı. Bir kez açılmadı ve 20 sn sonra ana sayfaya atıldı. Kök neden: yerel sunucu bir modül isteğini reddetti (`shared/match.js ERR_CONNECTION_REFUSED`). | Kısmen (10) |
| Odak kaybı, sekme gizlenip dönme | Süre ve animasyon bozulmaz | `visibilitychange` gizli → 4 sn → görünür: maç sürüyor, 3B döngü yeniden başlıyor, HUD doğru. | — |
| Tarayıcı geri tuşu | — | PvP adres geçmişine kayıt eklemiyor. Geri, önceki sayfaya (ana sayfa) gidiyor, maç sorusuz bırakılıyor. Dokunmadım. | — |
| T-poz (maç açılışı) | Model hazır olana dek görünmez | Önbellekli yerel yüklemede yeniden üretemedim. Kodda yol var: mikser ilk `update`'e kadar iskelet bağlama pozunda kalıyordu. | Düzeltildi (11) |
| Boyutlar | 1920×1080, 1440×900, 1280×720, 390×844, 844×390 | Lobi, maç, maç-üstü lobi ve Profil'e her boyutta baktım. 390'da "Maça dön" "PvP ARENA" başlığının üstüne biniyordu, düzelttim. | — |

## Bulunan ve düzeltilen hatalar

1. **Maç sırasında açılan lobi** (`pvp/lobby-v3.css` sonu; `pvp/network.js` 241, 390–391, 399–409, 915–918, 1035). HUD katmanları (`.fhud2`, `.mi`, kombo, sinematik) lobi açıkken gizleniyor. Lobiye "⚔ Maça dön" düğmesi geldi (yalnız maç sürerken görünür). Esc lobiyi kapatıp maça döndürüyor. Odak yazma kutusuna dönüyor (`tuslab:pvp-lobby-closed`, `pvp/pvp-main.js` 981). Bot maçı sürerken "Enter ile de başlar" ipucu gizli, çünkü Enter yeniden başlatmıyor. Lobi açıkken odak arkadaki yazma kutusuna çalınmıyor (`pvp-main.js` 970).
2. **Profil ve Arkadaşlar paneli** (`pvp/phase16-ui.css` sonu). Panel görüntü alanına sabitlendi (`position:fixed`), yüksekliği artık `100dvh`'ye göre. Açıkken HUD gizli. Telefonda alttan sayfa olarak açılıyor. 1440, 844×390 ve 390'da baktım.
3. **Esc çıkış onayı** (`pvp/pvp-main.js` 1053–1068). Tuş tüketiliyor (`preventDefault`), kutu bir sonraki görevde açılıyor. Yazma kutusundayken de çalışıyor. Gerçek tuşla 1440'ta gördüm.
4. **Kaybolan harfler** (`pvp/pvp-main.js` 1025–1037 `redirectTypingKey`). Canlı maçta odak metin alanı dışındaysa basılan harf yazma kutusuna gidiyor. Space düğmeyi etkinleştirmeye devam ediyor. Panel, kutu, lobi ya da sonuç açıkken bu yönlendirme çalışmıyor. Profil kapatılıp odak düğmede kalmışken "taş␣" yazdım, kelime kabul edildi.
5. **"Efektleri azalt" kalıcı** (`pvp/pvp-main.js` 262–264, 685). Anahtar `tuslab-pvp-reduced-fx` (yalnız açıkken yazılır). İki yenilemede doğruladım.
6. **Süre becerisi kendiliğinden kilit** (`pvp/rounds-ui.js` 32–33, 688–693; `PICK_AUTO_LOCK_MS = 700`). Gerçek maçta karta tıklayıp kilitlemedim. ROUND_SKILL_ACK raund başlamadan 660 ms önce geldi (freeze, seat 1).
7. **Oda kodu** (`pvp/network.js` 168–174 `roomCodeProblem`, 607–612). Hata yazısı artık gerçek nedeni söylüyor: boş, uzunluk ya da 0/1. Davet bağlantısının tamamı yapıştırılabiliyor.
8. **Maç sonu düzeni** (`pvp/pvp-main.js` 459–462). `ended` durumunda da `data-layout="fullscreen"` kalıyor. Teslim ve nakavt anında 3B arena, zafer pozu ve YENİLGİ bandı göründü. Eski paneller görünmedi.
9. **Eski süre/sıra kutusu** (`pvp/topbar.css` sonu). `fhud-on` iken gizli. Klasik madalyon artık temiz ("115 sn · KLASİK DÜELLO").
10. **Modül yükleme hatası** (`pvp/index.js` 11–12, 54–57, 65–76). `?pvp=` adresinde import hata verirse sayfa bir kez yenileniyor (en çok dakikada bir, `sessionStorage`). Ana sayfadan açılışta eski davranış kaldı: ipucu gizleniyor, sonraki tık yeniden deniyor. Asıl neden sunucuda, aşağıda.
11. **T-poz** (`pvp/fighters3d.js` 1268–1272). `goIdle(0)` sonrası `mixer.update(0)` çağrılıyor. Duruş klibi, model sahneye girdiği ilk karede uygulanıyor. Ön-ısıtma çizimi (`warmDraw`, `arena3d.js` 4438) tick'in başında modeller güncellenmeden çiziyordu. Bu kare yerine yeni model artık duruşta.

## Düzeltilmeyenler ve neden

- **GEREKEN DEĞİŞİKLİK (sahiplik dışı): `scripts/serve.py`.** `ThreadingHTTPServer` varsayılan `request_queue_size = 5`. Lobi tek seferde ~150 dosya istiyor ve Windows taşan bağlantıları reddediyor (`ERR_CONNECTION_REFUSED`). Bu turda iki kez PvP hiç açılmadı ve ana sayfaya atıldı. Önerim: `class Server(http.server.ThreadingHTTPServer): request_queue_size = 128` ve `main()` onu kullansın. Yenileme önlemi (10) yalnız bir yamadır.
- **Çevrimiçi (8787) yazarken harf kaybı (sınanamadı).** `pvp-main.js` 916: sunucu onayı beklenirken (`p.pending`) basılan harfler atılıyor. Bot maçında onay eşzamanlı geldiği için sorun yok. Odada ~1 gidiş-dönüş süresince sonraki kelimenin ilk harfleri kaybolabilir. 8787 kapalı olduğu için denemedim. Riskli olduğu için değiştirmedim.
- **Tarayıcı geri tuşu** maçı sorusuz bırakıyor. `beforeunload` ya da geçmiş kaydı eklemek tasarım kararı, dokunmadım.
- **Yapıştırma**: yazma kutusuna birden çok kelime yapıştırılırsa yalnız ilki gönderiliyor, kalanı atılıyor. Gerçek klavyede olmuyor.
- **Tur arası seçim penceresi** çözüm kuyruğu yüzünden ≈4 sn kalıyor. Zamanlama tasarımı, dokunmadım.
- **Görmediklerim:** ani ölüm raundu, berabere sonuç, Tam ekran düğmesi (gömülü panel), gerçek GPU kare hızı (panel gizli), yavaş ağda model gecikmesi (T-poz yalnız kodla kapatıldı), çevrimiçi oda.
- Profil/Arkadaşlar açıkken 1440'ta raund madalyonu panelin sol kenarının altında kısmen kalıyor. Küçük, dokunmadım.

## Şöyle yorumladım
- Maç sürerken açılan lobi, maçı durdurmaz (PvP). Maça dönüş için düğme ve Esc ekledim. Enter maçı yeniden başlatmaz, kazara olmasın diye.
- Yazma kutusundaki Esc: çıkış onayını açar (kutu dışındaki Esc ile aynı). Kelimeyi silmez.
- Tur arası: seçili kart süre dolmadan kilitlenir. Kural değil, oyuncunun kendi seçimini uyguluyor. Seçim yoksa davranış aynı.
- `tests/pvp-fullscreen33.test.mjs` B1: `ended` artık tam ekran grubunda, bilinçli değişiklik.

## Test
- `node --test tests/*.test.mjs`: **1164/1165**. Tek kırık `home-yazma-ekranlari.test.mjs` "kbToggle" (`home/typing.js:111`, Ressam'ın süren işi). PvP ve varlık testlerinin tamamı geçti. Başlangıçta 1140/1143'tü (3 home testi kırıktı). Yeni `tests/pvp-kasif.test.mjs`: 11 test.
- `node cloudflare/build-assets.mjs` tamam; `node scripts/predeploy-check.mjs`: **79/79**.

## Değişen dosyalar
`pvp/pvp-main.js`, `pvp/network.js`, `pvp/rounds-ui.js`, `pvp/fighters3d.js`, `pvp/index.js`, `pvp/lobby-v3.css`, `pvp/phase16-ui.css`, `pvp/topbar.css`, `tests/pvp-fullscreen33.test.mjs` (B1), yeni `tests/pvp-kasif.test.mjs`, `docs/DEVIR-PVP.md`, bu rapor. `cloudflare/public` derleme çıktısı `build-assets` ile yenilendi.
