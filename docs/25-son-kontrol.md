# 25 — Son kontrol (Hakem, 24 Kas 2026)

Gecenin 17 ajanının işinin bağımsız, baştan sona kontrolü. Kendi sekmem, `http://127.0.0.1:5177/index.html`. Başka ajan
çalışmıyordu. Ekran görüntüleri panel ölçeğinde (800 px'e küçültülmüş) alındı. Ayrıntıya yakın plan (zoom) ve DOM ölçümüyle
bakıldı: yatay taşma, ekrandan çıkan öğe, 12 px altı yazı ve kesilen yazı.

**Kullanıcı verisi:** başta `tuslab-*` anahtarlarının hepsi (7 anahtar) yedeklendi
(`hakem-ls-yedek.json`, oturum karalama klasöründe), sonra silindi (taze kullanıcı). Dönen kullanıcı turunda ve en sonda yedek
birebir geri yazıldı. Karşılaştırma `true`. Oturumda oluşan `tuslab-pvp-sfx-muted` ve `tuslab-pvp-music-muted` silindi.
`yirmitl:kurulum` anahtarına dokunulmadı.

## Kod sağlığı
- `node --test tests/*.test.mjs`: başta **1186/1186**, sonda **1195/1195** (yeni `tests/hakem.test.mjs`: 9 test).
- `node cloudflare/build-assets.mjs` + `node scripts/predeploy-check.mjs`: **79/79 kontrol başarılı** (deploy yapılmadı).
- Kalıntı taraması:
  - `kokpit`: kodda yok.
  - `scene3d` ve `dailyLine` yalnız `docs/codex/ANASAYFA-SOZLESME.md` belgesinde kalmıştı. Güncellendi; eski "Hız Arenası" satırı da düzeltildi.
  - Taşınan `page-*.css` dosyalarına yalnız bir yorumda atıf var (`pvp/network.css:30`). Zararsız.
  - Padişah kalıntıları: `pvp/network.js` (boş "Padişahlar" grubu ve `f.padisah` dalı), `pvp/quote-bubble.js`, `pvp/sound.js`,
    `pvp/portraits.js`, `fighters.js` (`PADISAH_IDS=[]`). Hepsi veri boşken çalışmıyor. Dışa aktarım uyumluluğu için bilerek
    bırakılmışlar. Silmek test ve import değiştirir, risk getirir. **Dokunulmadı.**

## (a) Görünüm × boyut tablosu

✓ = ekran görüntüsüne bakıldı, sorun yok · ✓* = bu turda bulunup düzeltildi, düzeltme ekranda görüldü · ~ = küçük, düzeltilmedi (bkz. b) · — = bakılmadı

| Görünüm | 1920×1080 | 1440×900 | 1366×768 | 1280×720 | 1100×800 | 768×1024 | 390×844 | 844×390 |
|---|---|---|---|---|---|---|---|---|
| Ana ekran (Merkez) | ✓ | ✓ | ✓ ~(9) | ✓ ~(9) | ✓ | ✓* (3) | ✓ | ✓ |
| Yazma | ✓ | ✓ (bitirildi + sonuç) | ✓ | ✓ (DOM) | ✓ | ✓ | ✓ | ✓ |
| Ders | ✓ | ✓ (Ders 1 bitirildi) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Ders Haritası | ✓ | ✓* (1) | ✓ | ✓ (DOM) | ✓ | ✓ | ✓ | ✓ |
| Serbest Alıştırma (yazma + sonuç) | — | ✓ | — | — | — | — | — | — |
| Şiir & Atasözü (menü + oturum) | ✓ ~(7) | ✓* (2) | ✓ (DOM) | ✓ (DOM) | ✓ | ✓* (4) | ✓ | ✓ |
| Performans | ✓ | ✓* (5, 6) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| PvP lobi | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓* (10) |
| Maç | ✓ ~(13) | ✓* (8) | ✓ | ✓ | ✓ | ~ (14) | ✓ | ✓ |
| Tur arası (süre becerisi seçimi) | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓* (11) |
| Sonuç | ✓ | ✓ | ✓ | ✓ | ✓ | ✓* (12) | ✓ | ✓ |

Ek boyutlar: 1180×800 (Merkez, Tekerleme oturumu) ✓ · 360×740 PvP sonuç (ZAFER ve motorla üretilen YENİLGİ) ✓.
"(DOM)": o boyutta yalnız ölçümle bakıldı, ekran görüntüsü başka bir boyutta alındı.

## (b) Bulunan sorunlar ve durumu

| # | Sorun (nerede, nasıl görüldü) | Durum |
|---|---|---|
| 1 | Ders Haritası ünite çipleri, 1440 px: gizli kaydırma çubuklu yatay şeritte son çip yarım kesiliyordu ("Ustalık 0/"). | **Düzeltildi.** `home/egitim.css`: ≥1000 px'te satır kırılır. 1440'ta tek satıra sığıyor, 1100'de iki satır. Telefon ve tablette kaydırma korunuyor. |
| 2 | Şiir & Atasözü oturumu, ≥1100 px: Atasözü, Tekerleme ve Özdeyiş'te sağ sütun bomboştu, yazıcı yarım genişlikte kalıyordu. | **Düzeltildi.** `home/literature.js` ve `egitim.css`: "Son yazdıkların" kutusu baştan görünüyor, içinde "Bitirdiğin metinler burada birikir." ipucu var. Dar ekranda boşken gizli. |
| 3 | Merkez, 768×1024: Yazma kartındaki klavye görseli Deyim ve Kelime çiplerinin altına giriyordu. | **Düzeltildi.** `home/home.css`: 600–860 px'te görsel sağa çekildi. Yakın planda bakıldı. |
| 4 | Şiir & Atasözü oturumu, 768 px: başlıktaki "Bitir Esc" düğmesinde Esc etiketi düğmenin dışına taşıyordu. | **Düzeltildi.** `egitim.css`: 900 px altında Esc etiketi gizli. |
| 5 | Performans grafiği: aynı günün kayıtlarında eksende 5 kez "24 Kas" yazıyordu. | **Düzeltildi.** `home/home.js` `xLabels`: hepsi aynı gündeyse saat yazar, art arda gelen aynı etiket tekrarlanmaz. |
| 6 | Performans, tek kayıt (dönen kullanıcı): "%99" ve "192 WPM" etiketleri üst üste biniyordu. | **Düzeltildi.** `home.css`: doğruluk etiketi noktanın soluna alındı. |
| 7 | Şiir & Atasözü menüsü, ≥1440 px: 5 kart sayfanın üst üçte birinde, altı boş. | Düzeltilmedi. Yeniden tasarım gerekir → (d). |
| 8 | Maç ray notu ("Seri N · seri 3/5/7/10'da…") sahnedeki ışık sütununun üstünde okunmuyordu. | **Düzeltildi.** `pvp/fight-hud.css`: yarı saydam koyu zemin. İki tarafta da yakın planda bakıldı. |
| 9 | Merkez, 1366 ve 1280: "Günün sözü — Mustafa Kemal At…" yazar adı üç noktayla kısalıyor. | Düzeltilmedi. Bilinçli üç nokta, küçük. |
| 10 | PvP lobi: bota karşı oynayacak yeni kullanıcıya "Bağlı değil" yazısı gösteriliyordu. 844×390'da portrenin üstüne biniyordu. | **Düzeltildi.** `pvp/network.js`: durum "Bağlı değil" iken satır gizli. Oda hatasında ("Oda oluşturulamadı · çevrimiçi sunucu yok") görünüyor, ekranda bakıldı. |
| 11 | Tur arası, 844×390: "RAUND N BİTTİ" ve "Raund N başlıyor" başlığı kelime şeritlerine biniyordu. | **Düzeltildi.** `pvp/rounds-ui.css`: bant açıkken kelime şeritleri gizli. Tur arası ekran görüntüsüyle doğrulandı. |
| 12 | **PvP sonuç, 768×1024: kartlar daralıyordu, ad harf harf kırılıyordu ("KOLA Y", "SAVA ŞÇI"), sayı satırı öbür kartın üstüne biniyordu.** | **Düzeltildi.** `pvp/results-v2.css`: portre boyu `min(30vh,22vw)`, sayı yazısı `min(3.6vh,2.6vw)` ile sınırlı. 761–1000 px'te aralık daraltıldı. 768'de ekran görüntüsü ve ölçümle bakıldı (sayılar kart içinde). 1440, 1280, 1100, 390, 360 ve 844×390'da sonuç değişmedi. |
| 13 | Raund sonu hasar sayıları üst üste biniyor ("-200" ile "-10" birleşip "-20010" gibi okunuyor). | Düzeltilmedi. VFX yerleşimi riskli → DEVIR-PVP 22. |
| 14 | 768 px maç üst şeridi: "BOT · / KOLAY" ve "SİRA · / GÖLGE / MIZRAK" satırlara kırılıyor. | Düzeltilmedi. Okunuyor ama sıkışık → DEVIR-PVP 23. |
| 15 | Lobide dövüşçü değişince yeni portre 1–2 sn gecikmeli geliyor; o arada ad yeni, görsel eski. | Düzeltilmedi → DEVIR-PVP 24. |
| 16 | `ANASAYFA-SOZLESME.md`: kaldırılmış `dailyLine()` ve `home/scene3d.js` satırları, eski "Hız Arenası" satırı. | **Düzeltildi** (belge). |
| 17 | Oda kurma denemesinde konsolda `501 (Unsupported method 'POST')`. | Beklenen davranış: 5177 durağan sunucu, oda sunucusu yok. Hata kutusu doğru. |
| 18 | Teslim onay kutusu açıkken raund sayacı ve bot sürüyor. | Tasarım (bot maçı duraklamaz). Not olarak yazıldı. |

## (c) Açılış ölçümü
Yöntem: yüklemeden 3,5 sn sonra `performance` kaynak listesi + belge. Her adrese `HEAD` isteği atılıp `Content-Length`
toplandı (docs/6 ve 12'deki gibi). 1440×900, taze kullanıcı. Dış adrese istek ve 404 yok.

| Sayfa | Gece başı (docs/6) | docs/6 sonrası | docs/12 sonrası | **Şimdi** | Gece başına göre |
|---|---|---|---|---|---|
| Ana sayfa | 154 istek / 3074 KB | 132 / 2170 KB | 75 / 1406 KB | **77 / 1270 KB** (CSS 884, JS 331, webp 39, svg 12, html 4) | −77 istek, −1804 KB (−%59) |
| `?pvp=lobby` | — (docs/17: 198 → 197 istek) | — | — | **193 / 6173 KB** (JS 2387, webp 1168, GLB 1074, CSS 890, mp3 650) | −5 istek (bayt karşılaştırması yok) |

Ana sayfadaki ağırlığın çoğu PvP CSS'i. `index.html` bağlantıları değişmeden azaltılamaz (docs/12).

## Konsol ve ağ
- Taze kullanıcı turunun tamamında (Merkez, Yazma, Ders, Serbest Alıştırma, Harita, Şiir & Atasözü, Performans, lobi, iki bot
  maçı, teslim, rövanş, lobiye dönüş, Ana Sayfa) **konsolda hata ve uyarı yok.** Konsolun kayıt tuttuğu, deneme amaçlı bir `console.warn` ile doğrulandı.
- CSP ihlali dinleyicisi (`securitypolicyviolation`) maçlar boyunca boş kaldı. Başarısız kaynak (≥400) yok.
- Tek hata: oda kurma denemesindeki 501 (#17, beklenen).

## Tur ayrıntısı (görülenler)
- **Taze kullanıcı:** Yazma'da atasözü gerçek tuşlarla yazıldı → Esc → sonuç kartı ("İlk sonucun kaydedildi", görev ve rozet
  bildirimleri). Ders 1 bitti (★★★, "Sonraki ders"). Ders Haritası açıldı. Serbest Alıştırma: Ş seçildi, Kısa, yazıldı,
  "Alıştırma bitti" kartı göründü. Şiir & Atasözü'nde 5 türden birer metin yazıldı (deyimde anlam kutusu, şiirde kıta kutusu,
  son yazdıkların listesi göründü). Performans'ta 8 kayıt, grafik, görevler, ısı haritası, son yazışlar ve rozetler görüldü.
  PvP'de Sira (kolay bot) ile maç sonuna kadar oynandı: raund 4'te NAKAVT, ZAFER. Tur arasında süre becerisi seçildi,
  ayar paneli açıldı. Nyx ile maç teslim edildi (YENİLGİ · TESLİM OLMA). Rövanş açıldı, yine teslim edildi. Lobiye dön ve
  "← Ana Sayfa" ile Merkez'e dönüldü.
- **Üçüncü maç** (Nyx, kolay bot, boyutlar arasında gezerek): 6 raund, NAKAVT, ZAFER. Tur arası 6 boyutta görüldü.
- **Ses:** `AudioBufferSourceNode.start` ve `OscillatorNode.start` çağrıları sayıldı. Açıkken 5 sn'de 8 buffer ve 24 osilatör
  çağrısı oldu. "Sesi kapat" sonrası 6 sn'de 0 çağrı (müzik de kapanıyor). "Sesi aç" sonrası 16 çağrı.
- **Ani ölüm ve berabere:** motor nesnesi elle kurulup `renderResult` ve `renderRoundsResult` doğrudan çağrıldı.
  BERABERE · ANİ ÖLÜMDE DE BERABERE (9 raund, 1440) ve YENİLGİ · KALAN CAN ÜSTÜNLÜĞÜ (8 raund, 360×740) düzgün çizildi.
  (Sahte oyuncu kimliği bot sayılmadığı için düğmeler "Rövanş iste / Odadan çık" çıktı; bu deneme düzeninden, hata değil.)
- **Azaltılmış hareket:** gerçek `prefers-reduced-motion` taklit edilemedi. `html.reduced-motion` sınıfı eklenince Merkez'de
  çalışan sonsuz animasyon sayısı 3'ten 0'a indi. Sayfada 70 adet `prefers-reduced-motion` medya kuralı var.
- **Dönen kullanıcı:** yedek geri yazılınca Merkez (rekor 192 WPM, 1 gün seri, Tekerleme canlı satırı), Performans (tek kayıt:
  #6 burada bulundu), lobi (Nyx, Gök Demirhanesi, Rastgele sekmesi) görüldü. Eski kayıt `m:"padisah"` türü "Diğer" olarak gösteriliyor, hata yok.

## Tutarlılık
- Sayfa başlığı her görünümde aynı ("TuşLab — Neon Arena | Kişisel Klavye Koçu"). Tema ve yazı tipleri geçişte tutarlı.
- Ses: ana site (`tuslab-home-v1.sound`) ile PvP (`tuslab-pvp-sfx-muted`) ayrı ayrı tutuluyor → (d).
- Adlandırma: ana sitede "← Merkez", PvP'de "← Ana Sayfa" (testte de geçiyor) → (d). Merkez kartında "Ders haritası →"
  küçük harfle, öbür düğmelerde "Ders Haritası". Kart bağlantıları cümle düzeninde yazılmış ("Yazmaya başla →", "Lobiye git →"), dokunulmadı.
- Arayüz metinlerinde İ/I taraması: `'I'` + küçük harf kalıbıyla hatalı büyük I bulunmadı. Yazım hatası görülmedi.

## (d) Kullanıcı kararı gerekenler
1. Şiir & Atasözü menüsünün geniş ekranda boş kalan alt yarısı (#7): kartların altına ek şerit mi, kartlar büyüsün mü?
2. Ses düğmeleri: ana site ve PvP tek "sesi kapat" durumunu paylaşsın mı?
3. "Merkez" mi, "Ana Sayfa" mı? Tek ad seçilirse PvP düğmeleri ve `tests/pvp-akis-arayuz.test.mjs` birlikte değişmeli.
4. Raund sonu hasar sayılarının üst üste binmesi (#13): VFX yerleşimini değiştirmek oyun hissine dokunur.
5. Padişah kodu kalıntılarının (boş grup, `quote-bubble.js`) `_to_delete/` altına taşınması: testler ve import'lar birlikte değişir.

## (e) Hâlâ görülmeyenler
- Gerçek telefon, dokunmatik, ekran okuyucu, gerçek `prefers-reduced-motion` ayarı (yalnız `html.reduced-motion` sınıfı).
- Gerçek GPU kare hızı: panel çoğu zaman gizliydi, giriş animasyonları `getAnimations().finish()` ile bitirildi. **Ölçülemedi.**
- Tur arası 1366×768'de (5 tur arasına 1920, 1280, 1100, 768, 390, 844×390 sığdı).
- Serbest Alıştırma yalnız 1440'ta. Ders sonucu ve Yazma sonucu yalnız 1440'ta.
- Çevrimiçi oda (8787): yalnız hata yolu. VS giriş sinematiği ayrıca yakalanmadı.
- 768×1024 sonuç düzeltmesi, sonuç ekranı açıkken stil dosyası yeniden bağlanarak görüldü. Düzeltmeden sonra ayrı bir maç oynanıp bakılmadı.
  Telefon yatay tur arası düzeltmesi de aynı yolla görüldü.
- Safari ve Firefox.

## Değişen dosyalar
`home/egitim.css`, `home/home.css`, `home/home.js`, `home/literature.js`, `pvp/fight-hud.css`, `pvp/network.js`,
`pvp/results-v2.css`, `pvp/rounds-ui.css`, `tests/hakem.test.mjs` (yeni), `docs/codex/ANASAYFA-SOZLESME.md`,
`docs/DEVIR-ANA-EKRAN.md`, `docs/DEVIR-PVP.md`, `docs/25-son-kontrol.md` (bu dosya). Commit yok, push ve deploy yok.
