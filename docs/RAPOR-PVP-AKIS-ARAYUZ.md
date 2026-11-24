# RAPOR — PvP AKIŞ + PvP ARAYÜZ CİLASI (23 Kas 2026)

Şerit: PvP akışı + araç çubuğu/lobi arayüzü. Değişen dosyalar: `home/home.js`, `pvp/index.js`, `pvp/network.js`,
`pvp/compact-height.css` (sonuna tek kural bloğu), `docs/codex/ANASAYFA-SOZLESME.md` (bağlantı satırları), yeni test
`tests/pvp-akis-arayuz.test.mjs`. `index.html` DEĞİŞMEDİ. Commit yapılmadı (yalnız okuma git komutları).

## 1. Yapılanlar

1. **PvP Düello'ya tıklayınca maç kendiliğinden başlıyordu**
   - Neden: ana sayfa bağlantısı `?pvp=practice&mode=classic` idi; `pvp/network.js` bunu `autoInvite=PRACTICE` sayıp `mount()` içinde hemen `startPractice()` çağırıyordu (`pvp/index.js` `autoPractice`).
   - Değişen: bağlantı `?pvp=lobby` oldu (`home/home.js:169`, açıklama `:708`). Yeni `LOBBY_URL_FLAG`/`lobbyFromUrl` (`pvp/network.js:50-58`, kurucu `:183`): PvP görünümü açılır, yalnız LOBİ gösterilir; `mount()` (`:319-322`) maç başlatmaz, yalnız `?mode=classic|rounds|arena` verilirse mod sekmesini seçer. Bot maçı yalnız lobideki "Savaşa başla" (veya Enter) ile başlar. `?pvp=practice` testler/derin bağlantı için olduğu gibi çalışır.
2. **Kapat → eski arena / "Arenaya dön" → ana ekran**
   - Neden: lobideki "Kapat" düğmesi `data-lobby-action="toggle"` idi: yalnız lobi panelini gizliyor, arkadaki boş PvP sahnesini (ve PvP kapanınca `?pvp=` sayfasında alttaki eski `#app`'i) açığa çıkarıyordu.
   - Değişen: lobi düğmesi artık "← Ana Sayfa" ve `data-pvp-action="close"` (`pvp/network.js:992`) → araç çubuğu düğmesiyle aynı yol: `PVP_CLOSE` → `#pvp-root` gizlenir → `home/home.js` `?pvp=` sayfasında temiz adrese (yeni ana sayfa) yönlendirir, sayfa içi açılışta `#tl-home`'u geri açar. Araç çubuğu etiketi "← Arenaya dön" → "← Ana Sayfa", aria-label "PvP'den çık, ana sayfaya dön" (`pvp/index.js:467`). Canlı maçta veya çevrimiçi odadayken çıkışta onay sorulur (`pvp/index.js:638-641`). Esc de aynı yoldan ana sayfaya döner (değişmedi, tarayıcıda doğrulandı). Sonuç ekranındaki "Odadan çık" PvP lobisine döner (PvP görünümü kapanmaz).
   - Ek güvence: `home/home.js:10-15` `html.tlh-app-off` sınıfı + `#app`'e `aria-hidden`; `pvp/compact-height.css:313` `html.tlh-app-off #app{visibility:hidden!important;pointer-events:none!important}`. app.js silinmedi; programatik `.click()` çağrıları (ör. `data-action="pvp-enter"`) çalışmaya devam eder. Kural home.css yerine en son yüklenen compact-height.css'e kondu (home.css başka şeritte yeniden tasarlanıyor; çakışma olmasın).
3. **Üst çubuk (Lobiyi aç, Profil, Arkadaşlar, ?, ayarlar, Teslim ol) çok soluk**
   - Neden (tarayıcıda ölçüldü): maçta `#pvp-root` doğrudan çocuğu `.fhud2` (z-index 25) `::before` karartması (rgba(8,5,18,.86), üstten 190 px) `.pvp2-shell` (isolation:isolate, z auto) içindeki çubuğun ÜSTÜNE çiziliyordu; düğme renkleri doğru olsa da ekranda soluk görünüyordu. Ayrıca tam ekranda durum grubu 2 px'lik boş kutu olarak kalıyordu; telefonda ağ düğmelerinin yazısı 32 px kutudan taşıyordu ("Lobiy", "P").
   - Değişen (`pvp/compact-height.css:315-339`): karartma çubuğun altından başlar (`.fhud2::before{top:var(--fs-toolbar,40px)}`); düğmeler beyaz yazı, #221c4a zemin, #a99ce0 kenar, belirgin hover (#352b72), 2 px mavi odak halkası, kesik kenarlı devre dışı hâli; Teslim ol koyu kırmızı zemin + açık kenar; açık lobi/ayar düğmesi altın kenar; boş durum kutusunun çerçevesi kalktı; ≤600 px'te ağ düğmeleri yalnız simge (36×32, metin erişilebilir adda kalır).
4. **Klasik maç ayarları kötü** → MAÇ AYARLARI segmentleri eşit boy kartlar (`pvp/compact-height.css:347-361`): etiket üstte büyük harf, 3 eşit sütun, en az 50 px (kısa ekranda 42 px), "Kolay / ~25 WPM" iki satır, seçili = altın kenar + koyu altın dolgu + açık yazı, hover/odak/devre dışı hâlleri. Aynı stil "Raund biçimi" için de geçerli. Düğmeler zaten `<button aria-pressed>`; klavyeyle Tab/Enter/Space çalışır.
5. **Neon Kolezyum / harita yeri kötü** → masaüstü ve yatay tablette eğik şerit + büyük eğik pencere kaldırıldı; yerine 2×2 küçük resim kartı (`arena-*.webp`, ad alt şeritte, seçili = altın kenar + ✓ rozeti) ve tam genişlik ince "Rastgele" kartı (`pvp/compact-height.css:363-404`). Yüksek ekranda (≥900 px) kartlar büyür ve ayarlar kartların hemen altına gelir; kısa ekranda (≤720 px) "ARENA" etiketi gizlenip kartlar küçülür. Telefon düzeni (ok + ad) değişmedi. Klavye: mevcut radiogroup + ok tuşları korunur.
6. **Soru işareti taşmış** → eski eğik şeritte "Rastgele" kartındaki 28 px "?" dar eğik dilimden taşıyordu (ilk ekran görüntüsünde şeridin sağ ucunda dışarıda görünüyordu). Yeni kartta "?" 24 px yuvarlak rozet, kartın içinde; 4 ekran boyutunda ölçüldü (`qInside:true`). Araç çubuğundaki "?" (Nasıl oynanır) düğmesi 32×32 kutuya sığıyor (scrollWidth 30 ≤ 32). Başka bir "?" taşması bulamadım.
7. **Arkadaşınla oyna → Oda oluştur çalışmıyor**
   - Neden: BASLAT.bat'in düz python sunucusu (`scripts/serve.py`) `POST /api/pvp/rooms` için **501 + HTML** döndürüyor (tarayıcıda ölçüldü). Kod `res.json()` ile HTML'i okumaya çalışıp SyntaxError atıyor; yalnız sol üstte kısa "Oda oluşturulamadı" ve çekmece günlüğüne teknik satır yazılıyordu.
   - Değişen (`pvp/network.js:57-58, 560-569, 579-582, 945-946, 1002`): `roomServerMissing()` (501/405 ya da JSON olmayan yanıt) → çekmecede kırmızı çerçeveli `role="alert"` kutu: "Çevrimiçi oda sunucusu bu adreste çalışmıyor. Arkadaşınla oynamak için oyunu BASLAT-CLOUDFLARE.bat ile aç (http://127.0.0.1:8787/). Bota karşı oynamaya devam edebilirsin." Odaya katıl için de aynı. Ağ hatasında (TypeError) ayrı Türkçe mesaj. Sahte oda kurulmaz, soket açılmaz.

## 2. Doğrulama

- `node --check pvp/index.js pvp/network.js home/home.js` → hatasız.
- `node --test tests/pvp-akis-arayuz.test.mjs` → `# pass 6 / # fail 0` (yeni: ana sayfa bağlantısı ?pvp=lobby; lobi açılışı maç başlatmaz; "← Ana Sayfa" etiketi, "Arenaya dön" yok; lobi düğmesi PvP'yi kapatır; #app koruması + fhud karartması; 501+HTML → mesaj, soket yok).
- `tests/pvp-cloudflare.test.mjs` "expired invitation…" testini ilk sürümüm bozdu (başlıksız sahte yanıtı "sunucu yok" sanıyordu); `roomServerMissing` yalnız gerçek içerik türüyle karar verecek şekilde düzeltildi, test geçiyor.
- Tam takım `node --test tests/*.test.mjs` (son koşu): **tests 936 / pass 916 / fail 20**. 20 hatanın tamamı mekanik şeridinin şu an değişen dosyalarından (`pvp/shared/match.js` `ROUND_DAMAGE_CAP` ihracatı yok → 4 dosya yüklenemiyor; raund HP/hasar tavanı, `CHAIN_EVERY`, `sira.e`, assist, rounds-ui testleri). Hiçbiri home.js / index.js / network.js / compact-height.css'e dokunmuyor. Bu yüzden toplam sayı 974'ün altında (yüklenemeyen dosyalar tek test sayılıyor). Bir ara koşuda `home-typing-akis` (3. şerit) de düşmüştü.
- `npm run cf:validate` ÇALIŞTIRILAMADI: `cf:build` `cloudflare/public/` içinde dosya silmek istiyor, bu oturumda silme kapalı (EPERM).
- Tarayıcı (kullanıcının makinesindeki tarayıcı paneli, çalışan yerel sunucu http://localhost:5176 aynı klasörü sunuyor): ana sayfa → "PvP Düello" → `?pvp=lobby`, lobi açık, durum "MAÇ BEKLENİYOR", antrenman yongası gizli (maç başlamadı). Lobi "← Ana Sayfa", araç çubuğu "← Ana Sayfa" (maç içinde) ve Esc → adres `/`, `#tl-home` görünür, `#app` visibility hidden. Teslim ol → sonuç → "Odadan çık" → PvP lobisi. Oda oluştur → yukarıdaki mesaj görünüyor. Lobi ölçümleri (ekran dışı öğe, <12 px yazı, ızgara/ayarlar/başlat çakışması, "?" kart içinde) 1366×768, 1366×650, 1308×1036, 1920×1080 ve 390×844'te Klasik/Zamana Karşı/Arena/Atasözü modlarında: ekran dışı öğe yok (telefonda yalnız yatay kayan mod sekmeleri), küçük yazı yok, çakışma yok. Araç çubuğu kontrastı (zemin bileşimiyle hesap): düğmeler 15.75:1, Teslim ol 12.79:1, süre 12.45:1; yazı 12 px (Teslim/çıkış), ikonlar 20 px. Ekran görüntüleri 800 px'e küçültülmüş geldiği için ince ayrıntı gözle değil ölçümle doğrulandı.
- Not: tarayıcı paneli eski home.js'i önbellekten getirdi; `fetch(...,{cache:'reload'})` ile yenilendi. `scripts/serve.py` zaten `no-cache` gönderiyor; kullanıcı eski sekmede görürse Ctrl+F5 yeter.

## 3. Başka şeritte gereken değişiklikler

- GEREKEN DEĞİŞİKLİK: `pvp/fight-hud.css` → `.fhud2::before` karartması `top:var(--fs-toolbar,40px)` ile başlasın (şu an compact-height.css'ten eziliyor; kaynağında düzeltilirse ezme kaldırılabilir).
- GEREKEN DEĞİŞİKLİK: `pvp/phase15-results.js` → bot maçında "Odadan çık" yerine "Lobiye dön" yazsın (davranış zaten lobiye dönüyor; dosya bu şeritte değildi).
- Mekanik şeridi: `pvp/shared/match.js` `ROUND_DAMAGE_CAP` ihracı ve HP/tavan değişiklikleri 20 testi düşürüyor (bkz. 2).

## 4. Kalan sorunlar

- `npm run cf:validate` bu oturumda çalıştırılamadı (silme izni yok).
- Arkadaşla oda kurma gerçek Cloudflare sunucusuyla (BASLAT-CLOUDFLARE.bat, 8787) denenmedi; yalnız düz sunucudaki hata yolu doğrulandı.
- Telefonda (≤760 px) arena seçimi eski "‹ ad ›" düzeninde kaldı (kullanıcı şikâyeti masaüstü görünümündeydi).
- Araç çubuğu yalnız tam ekran maç düzeninde (data-layout="fullscreen") ve 1366×768/390×844'te ölçüldü; arena modu hazırlık evresi ve 1920 genişlikte maç içi çubuk ayrıca bakılmadı.
- `#app` gizli olsa da app.js'in belge düzeyindeki klavye dinleyicileri çalışmaya devam eder (davranış değişmedi; yalnız görünürlük/tıklama kesildi).
