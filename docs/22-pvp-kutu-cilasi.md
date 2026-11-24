# 22 — PvP kutu cilası (Cilacı, 24 Kas 2026)

İstek: "optimizasyon ve güzelleştirme yapalım kutulara vs". İşlev, kural ve denge değişmedi. Değişen yalnız görünüm, okunurluk ve tutarlılık. Commit yok.
Tarayıcı: 5177, Claude tarayıcı paneli, kendi sekmem. Bitince kapattım. Panel gizliydi, bu yüzden sekmeye `requestAnimationFrame → setTimeout(16)` yaması koydum (test düzeneği, koda girmedi). `tuslab-pvp-*` anahtarlarını yedekleyip sonunda geri koydum.

## Kutu ailesi (tek ölçek)
`pvp/compact-height.css` sonunda "CİLACI" bölümü (bu dosya en son yüklenir). Ana ekranın görsel dili (docs/18) PvP'ye uyarlandı:
- köşe: panel 18 px, kart 12 px, düğme 10 px, çip tam yuvarlak
- yüzey: koyu yarı saydam degrade + ince `#ffffff24` kenar + üst sol köşe ışığı (`--cl-acc` rengiyle)
- seçili: altın kenar + 3 px soluk altın halka (arena kartı, bot zorluğu, raund biçimi, yardım sekmesi, Profil sekmesi). Önceden üç ayrı dil vardı: altın, mor (`#7c5cff`) ve mavi.
- odak: 3 px `#7fd7ff` çizgi
- gölge: tek katman, en çok 40 px

## Ekran ekran
**Lobi**
- Kural özeti: 5 satırlık gri paragraf yerine iki parça var. Üstte seri merdiveni (Q 3 · W 5 · E 7 · R 10, altın tuş rozetleri), altında 7 kısa madde: 7 raund · 6.000 can, E kalkan 330 ya da can 300, R en çok ×2, 13. ve her 8. doğru → Q, 10+ seri çarpanı, yanlışta seri yarıya, raund başı 500 kalkan/can. Tam cümle `title`'da duruyor. Yazı 12 px, kontrast 14,1:1. Kod: `pvp/rounds-ui.js` `ruleHintHTML()`. Oda çekmecesindeki seçici de aynı işaretlemeyi kullanıyor.
- MAÇ AYARLARI cam karta alındı. Segment düğmeler 10 px köşeli, seçili düğmede altın halka var.
- Arena kartları ve Rastgele 12 px köşeli, seçim halkası aynı.
- Bilgi kartı (ad, Silah, Q/W/E/R) masaüstünde cam kart oldu: dövüşçü renginde köşe ışığı, en çok 560 px. Açıklama yazısı `#e2dcf5`.
- Dövüşçü şeridi 8 px'ten 18 px köşeye çıktı, aynı yüzeyi kullanıyor.
- SAVAŞA BAŞLA 12 px köşeli, hafif degrade ve yumuşak altın gölgeli.
- Üst sekmelerde seçili yazı altın, hover'da soluk zemin var. "Arkadaşla oyna" ve "Ana Sayfa" 10 px köşeli.
- **Hata düzeltildi:** 844×390'da bilgi kartının başı ("NYX") üstten kırpılıyordu ve kaydırınca da görünmüyordu. Sebep `align-content:center` ile taşmaydı. Şimdi `safe center` var: kart kendi içinde kayıyor, başlık görünüyor.

**Maç**
- Araç çubuğu düğmeleri 10 px köşeli, odak halkaları 3 px.
- Ayar paneli (çark): müzik ve ses satırları aynı ızgarada (düğme · kaydırıcı · %). Kaydırıcılar altın renkte. **Hata düzeltildi:** ≤1050 px'te ses kaydırıcısı gizleniyordu (eski araç çubuğu kuralı, `sound-fx.css:21`), müzik kaydırıcısı görünüyordu. Artık ikisi de görünüyor. 844×390'da "Müziği kapat" kaydırıcıya biniyordu, düzeldi.
- Yardım (?): seçili sekme mordan altına geçti, panel kenarı ince.
- Profil (camgöbeği kenar) ve Arkadaşlar (mor kenar) aynı panel ailesine geçti: 18 px köşe, ince kenar, köşe ışığı (Profil altın, Arkadaşlar mor). Gölge 70 px yerine 40 px.
- Teslim kutusu 18 px köşeli, düğmeler 10 px ve 42 px yüksekliğinde. Tab ile odak halkası göründü.
- Kelime kuyruğu (can barı altı): beyaz %62'den %80'e çıktı.
- Değişmedi: can barları, beceri altıgenleri, yazma paneli çerçevesi, afişler, tur arası kartları. Bunlar zaten tutarlı ve ölçüm temizdi: 12 px altı ya da soluk yazı yok.

**Sonuç ekranı**
- Pahlı (clip-path) düğmelerde dışa çizilen odak çizgisi kırpılıyordu, yani klavye odağı görünmüyordu. Artık içe çizilen 3 px halka var. Gerçek Tab tuşuyla "Rövanşa başla" üzerinde gördüm.
- Başlık, oyuncu kartları ve istatistikler kendi "dövüş oyunu" pah diline sahip. Dokunmadım.

## Optimizasyon (ölçüm)
- Lobi, maç ve sonuç ekranında görünen öğelerde `backdrop-filter` **0**, `filter: blur` **0**, çalışan sonsuz animasyon **0**. `will-change` yalnız iki can barında (`transform`), bunlar gerçekten canlanıyor. Yeni kurallar bulanıklık, sonsuz animasyon ya da `will-change` eklemedi (test bunu denetliyor).
- Profil ve Arkadaşlar gölgesi 70 px + 2 katmandan tek katman 40 px'e indi. Teslim kutusu 50 px'ten 40 px'e indi.
- Kullanılmayan CSS: `pvp/page-adventures.css`, `page-boss.css`, `page-command.css`, `page-lobby.css`, `page-social.css`, `page-topnav.css` (≈101 KB). `index.html`, JS ve testler bunları yüklemiyordu (grep ile doğrulandı; yalnız birbirlerinin yorumlarında adları geçiyor). `_to_delete/pvp-css-kullanilmayan/` altına taşındı, silinmedi. Cloudflare çıktısı da artık bunları taşımıyor.

## Boyutlar
1920×1080, 1440×900, 1280×720, 390×844 ve 844×390'da lobiye baktım. Yatay taşma yok (`scrollWidth = innerWidth`). Ayarlar, BAŞLA düğmesiyle üst üste binmiyor. 1440'ta ayarlar 761'de bitiyor, düğme 806'da başlıyor. 1280×720'de 581 / 636. Maçta ayar paneline 1440, 390 ve 844×390'da baktım. Telefonda (390) Ayarlar alt sayfası kural maddeleriyle birlikte kayıyor.

## Doğrulama
- Bot maçı (Zamana karşı, Rastgele) sonuç ekranına kadar iki kez oynandı: önce/sonra. Ara ekranlar: tur arası seçimi (gerçek "2" tuşu), raund sonu, Profil, Arkadaşlar, ?, çark, teslim kutusu (Tab + Devam et), ZAFER · NAKAVT, Lobiye dön, Arkadaşla oyna çekmecesi, `?pvp=practice`. Yazma sayfa içi yazıcıyla yapıldı (harf harf `input` olayı).
- `node --test tests/*.test.mjs`: **1168/1171**. Kırık 3 test `home-gozcu.test.mjs` ve `home-metrik.test.mjs` içinde (Gözcü'nün süren home/ işi). PvP, varlık, açılış ve higgsfield testleri: **1085/1085**. Yeni `tests/pvp-cila.test.mjs`: 4 test.
- `node cloudflare/build-assets.mjs` tamam. `node scripts/predeploy-check.mjs`: **79/79**.

## Görmediklerim / denemediklerim
- Sonuç ekranını 390 ve 844×390'da bu turda görmedim (yerleşimini değiştirmedim).
- `prefers-reduced-motion` ve "Efektleri azalt" açıkken görsel kontrol yapmadım. Yeni kurallarda animasyon ya da geçiş yok.
- Kelime kuyruğu açık gökyüzünün üstünde gölgesiz ≈2,6:1 kalıyor. Gölge (`0 1px 3px #000`) okunurluğu artırıyor ama sahneye bağlı olduğu için 4,5:1'i garanti edemem.
- Oda (8787) içindeki kural özetini canlı görmedim (aynı fonksiyon, testle doğrulandı).
- Gerçek GPU kare hızı ölçülmedi (panel gizli).

## Şöyle yorumladım
- "Kutular aynı aileden" sözünü ana ekranın 22 px kart dilinin PvP'ye ölçeklenmesi olarak yorumladım: panel 18 / kart 12 / düğme 10. Küçük PvP öğelerinde 22 px fazla yuvarlak duruyordu.
- Bilgi kartını ve MAÇ AYARLARI'nı (docs/8'de "kutusuz" tasarlanmıştı) cam karta aldım. Görev bunları kutu olarak sayıyordu, kart da portre üstündeki yazının okunurluğunu artırıyor.
- Sonuç ekranının pahlı dövüş oyunu dilini korudum. Yalnız odak sorununu düzelttim.
- Kural maddelerindeki ifadeleri kısalttım ("raundlar arası taşınır" → "taşınır"). Tam cümle `title`'da ve `DAMAGE_RULE_HINT` aynı kaldı.

## Dosyalar
`pvp/compact-height.css` (yalnız sona ekleme: CİLACI bölümü), `pvp/rounds-ui.js` (`ruleHintHTML`, seçicide tek satır), yeni `tests/pvp-cila.test.mjs`, bu rapor. Taşınan 6 dosya: `pvp/page-*.css` → `_to_delete/pvp-css-kullanilmayan/`. `cloudflare/public` yeniden üretildi.
