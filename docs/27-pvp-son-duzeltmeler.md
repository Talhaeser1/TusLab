# 27 — PvP son düzeltmeler (Nişancı, 24 Kas 2026)

docs/25'in PvP'de bıraktığı işler. Kendi sekmem, `http://127.0.0.1:5177`. Kural, denge ve zamanlama değişmedi. Yalnız gösterim değişti.
Commit yok. Push ve deploy yapılmadı.

## Yapılanlar
1. **Raund sonu hasar sayıları (DEVIR 22)**: `pvp/fx-damage.js`
   - Sabit 6 şeridin yerine ölçüye göre yuva seçen `placeNumber` geldi. Kutu boyu `estimateBox` ile tahmin ediliyor. 1440 px'te ölçülen "-200" 158 px, tahmin 166 px.
   - Aynı karede gelen sayılar önce aynı satırda yan yana dizilir. Satır dolarsa üst ya da alt satıra geçer.
   - Yükselmekte olan eski sayının kutusu, o ana kadar yükseldiği kadar yukarı uzatılmış sayılır. Böylece sayılar ömürleri boyunca birbirine binmez.
   - Doğuş büyümesi (×1.4, 120 ms) sırasında da birleşmesinler diye yeni sayı için ×1.2 pay bırakılır.
   - Yer kalmazsa en eski sayı 140 ms'de solar (`.pxd-leaving`).
   - Sınırlar sahne katmanından alınır. Üstte yükselme payı bırakılır, böylece sayılar HUD'a çıkmaz.
   - Renkler, değerler ve süreler (820/900/1100 ms) aynı kaldı.
2. **601–1023 px üst şerit (DEVIR 23)**: `pvp/fight-hud.css`
   - Ad ve alt başlık tek satırda, sığmazsa üç noktayla kısalır. Yer daralınca önce alt başlık kısalır.
   - 900 px altında alt başlık gizlenir.
   - Satır kaydırma kapatıldı, böylece SEN ve KALKAN rozetleri yerinde kalıyor.
   - Ada italik payı eklendi. Pay yokken sığan ad da kesirli taşma yüzünden "BOT · KOL…" diye kısalıyordu.
3. **Lobi portresi (DEVIR 24)**: `pvp/lobby-v3.css`, `pvp/network.js`
   - Giden portre anında kaybolur, gelen portre 200 ms'de belirir. Arada koyu bir yer tutucu görünür.
   - `preloadLobbyPortraits` lobi açılınca boşta 5 portreyi indirip çözer.
   - Ölçüm: portreler zaten 280 ms'de iniyordu. Hakem'in gördüğü 1–2 sn'lik gecikme, panel gizliyken geçişlerin ~1 sn'de bir ilerlemesinden geliyordu. Artık eski görsel hiç kalmıyor.
4. **Ortak ses (sözleşme)**: yeni `pvp/master-sound.js`, `pvp/pvp-main.js`, `pvp/music23.js`
   - `tuslab-ses` önce okunur. Yoksa `tuslab-pvp-sfx-muted` değerinden taşınır.
   - "Sesi kapat/aç" bu anahtarı yazar. Eski anahtar da `sound.js` üzerinden yazılmaya devam ediyor.
   - Anahtar `storage`, `visibilitychange` ve `pageshow` olaylarında yeniden okunur. PvP her açılışta da okur, çünkü aynı sekmede `storage` olayı gelmez.
   - Müziğe kalıcı olmayan bir kapı eklendi (`setMasterMuted`). Ana anahtar 'off' iken müzik susar ama "♫ Müziği kapat" ayarı yazılmaz.
   - Bunun sonucu: eskiden "Sesi kapat" müzik ayarını da kalıcı olarak kapatıyordu. Artık müzik ayarı ayrı kalıyor.
5. **Padişah kalıntıları**: Kod yerinde bırakıldı. Tarayıcıda boşa inen tek dosya `quote-bubble.js` idi (`sound.js`'ten statik içe aktarılıyordu). Artık yalnız sözü olan dövüşçü konuşunca dinamik olarak yükleniyor. Maçta 0 istek ölçüldü.
6. **DEVIR 17 (onay beklerken basılan harfler)**: yeni `pvp/pending-buffer.js`
   - Kutu kilitliyken basılan harf ve Backspace tuşları tampona alınır.
   - Onay ya da ret gelip kutu açılınca (üç yolda da) tampon sırayla kutuya verilir. Boşluk varsa yalnız ilk kelime gönderilir, kalanı bir sonraki onayı bekler.
   - Maç değişince ve kurtarmada tampon temizlenir.
   - Bot maçında tampon hiç dolmuyor, çünkü onay eşzamanlı geliyor.
   - **8787 kapalı olduğu için gerçek odada denenmedi.** Yalnız birim testiyle doğrulandı.
7. **DEVIR 19 (geri tuşu)**: yeni `pvp/back-guard.js`
   - Canlı maçta adres değişmeden bir koruma kaydı eklenir (`pushState`).
   - Geri tuşuna basılınca "Maçtan çık?" kutusu açılır. Vazgeç denince maç sürer. Çık denince PvP kapanır.
   - Maç bitince koruma kaydı geri alınır. Bu `popstate` ana sayfa yönlendiricisine ulaşmaz (yakalama aşaması).
8. **DEVIR 18 (serve.py kuyruğu)**: önceden yapılmıştı (`request_queue_size = 128`). Silindi.
9. `docs/DEVIR-PVP.md`: 17, 18, 19, 22, 23 ve 24 silindi.

## Doğrulama
- `node --test tests/*.test.mjs`: **1215/1215**. Yeni `tests/pvp-nisanci.test.mjs`: 13 test.
  - Güncellenen testler: `pvp-fx-damage`, `pvp-anim33` (solan sayı sayılmaz, sabit şerit yerine ölçülü yuva) ve `pvp-kasif` (araya tampon satırı girdi).
- `node cloudflare/build-assets.mjs` + `node scripts/predeploy-check.mjs`: **79/79**.
- **İki tam bot maçı oynandı.** Yazıcı sayfa içindeydi (kelime başına bir `input` olayı).
  - 1440×900: 4 raund, NAKAVT, ZAFER. 45 sayı çıktı. 270 DOM ölçümünde **çakışma 0**, aynı anda en çok 5 sayı.
  - 390×844: 4 raund, NAKAVT, ZAFER. 42 sayıda çakışma 0. Tur arası, süre becerisi seçimi (Donmuş An), ayar paneli ve sonuç ekranı ekran görüntüsüyle görüldü.
- 768×1024'te bir maç oynandı (8 sayıda çakışma 0), sonra geri tuşuyla çıkıldı.
- Ekran görüntüleri: 1440'ta aynı karede 5 adet "-200" iki satırda ayrı. 768 ve 390'da sütunda ayrı.
- Bu görüntüler, sayıların o anki konumunun donuk kopyasından alındı. Panel gizliyken animasyon kare kare ilerlemiyordu, büyüme anı (pop) görüntülenemedi. Düzeltmeden önceki "-200-200200" birleşmesi aynı yöntemle görüldü.
- Üst şerit 1023, 900, 768 ve 640 px'te ölçüldü ve ekran görüntüsüyle bakıldı. Adlar tek satır (26 px), can barı ve seri yerinde. 900'de alt başlık "SİRA · GÖ…" diye kısalıyor.
- Geri tuşu gerçek tarayıcı geri gezinmesiyle denendi.
  - Kutu açıldı. Vazgeç sonrası maç sürdü. Çık sonrası PvP kapandı.
  - Maç bitince koruma kaldırıldı (`history.state` null).
- Ses: açıkken 4 sn'de 24 `start` çağrısı, kapalıyken 6 sn'de 0. Başka sekmeyi taklit eden `storage` olayı ve `visibilitychange` düğmeyi güncelledi.
- Konsol: iki maçta hata yok, sayfa `error` dinleyicisi boş kaldı.

## Şöyle yorumladım
- Ana ses = PvP'nin "Sesi kapat" düğmesi (efekt ve sesler). Müzik ve efekt ses seviyeleri ile "♫ Müziği kapat" alt ayar sayıldı.
- `?pvp=` adresinden çıkınca ana sayfa `location.replace` yapıyor. Bu sırada korumanın `history.back()` çağrısı da çalışıyor. Sonuç: geçmişte ileri yönde fazladan aynı adresli bir kayıt kalabilir. Zararsız, düzeltilmedi.

## Görülmeyenler
- Gerçek çevrimiçi oda (8787) ve tamponun gerçek ağ gecikmesiyle çalışması.
- Panel görünürken akıcı animasyon. Pop anındaki ×1.4 büyüme gözle izlenemedi, yalnız hesapla payı bırakıldı.
- Gerçek telefon, Safari ve Firefox.
- 768×1024 sonuç ekranı bu turda yeniden görülmedi (390 ve 1440'ta görüldü).

## localStorage
- Yedek: karalama klasöründe `nisanci-ls-yedek.json`. `tuslab-pvp-*` anahtarları birebir geri yazıldı. Oturumda oluşan `tuslab-pvp-sfx-muted` silindi.
- `tuslab-ses` başta yoktu. Sözleşmedeki taşıma ile `'on'` yazıldı ve öyle bırakıldı. Bu varsayılan değer ve Derleyici de aynı anahtarı kullanıyor.

## Değişen dosyalar
`pvp/fx-damage.js`, `pvp/fx-damage.css`, `pvp/fight-hud.css`, `pvp/lobby-v3.css`, `pvp/network.js`, `pvp/pvp-main.js`,
`pvp/music23.js`, `pvp/sound.js`. Yeni: `pvp/master-sound.js`, `pvp/back-guard.js`, `pvp/pending-buffer.js`, `tests/pvp-nisanci.test.mjs`.
Değişen testler: `tests/pvp-fx-damage.test.mjs`, `tests/pvp-anim33.test.mjs`, `tests/pvp-kasif.test.mjs`. Belgeler: `docs/DEVIR-PVP.md`, bu dosya.
Ölçüm betiği: `.playwright-mcp/nisanci-probe.js` (takip edilmeyen probe klasörü).
