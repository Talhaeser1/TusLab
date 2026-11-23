# 19 — Ana ekran "Sahne" kuruldu (Ressam, 24 Kas 2026)

Tasarım: `docs/18-ana-ekran-sahne-tasarim.md`. Üç sütunlu kokpit kalktı; yerine sol sahne + sağ bento geldi.

## Yapılanlar
- **Sol sahne** (`.tlh-stage`): üst yazı "NEON ARENA · TÜRKÇE KLAVYE", iki satırlık degrade başlık "Parmakların / ışık hızında" (`<h1>`), tek cümle alt yazı, iki düğme: "Yazmaya başla" ve "İlk derse başla / Kaldığın ders: N" (dersin adı `title` içinde). Arkada soluk, büyük "ğ ü ş i ö ç" harfleri (`aria-hidden`).
- **Canlı satır** (`.tlh-live`, `liveRun`): Yazma'nın önizleme parçası (`peek`) harf harf kendiliğinden yazılıyor. Yazılan kısım parlak, yazılacak kısım soluk, imleç yanıp sönüyor. Ortalama ≈14 harf/sn; virgülde ve boşlukta biraz bekliyor. Satır bitince 3 sn bekleyip akıştaki sıradaki parçaya geçiyor. Harfe basınca Yazma tam o satırla açılıyor (`takePeek`, `matchStartKey` aynen kaldı). Yalnız Merkez görünürken çalışıyor; bir görünüm açıkken, sekme gizliyken ya da ana sayfa gizliyken durup sonra kaldığı yerden sürüyor. Azaltılmış harekette satır hazır yazılmış duruyor. Her adımda yalnız iki metin düğümünün verisi değişiyor. Kısa ekranda satır tek satıra iniyor; imleç görünür kalsın diye satır yatayda kayıyor, solda yumuşak bir solma var.
- **4 sayı**: en iyi WPM · ort. doğruluk · ★ ders yıldızı · gün serisi. Tek satırda, kutusuz, aralarında ince çizgiler.
- **Bento** (`.tlh-bento`, 12 sütun × 3 satır):
  - **Yazma Arenası** (7×2, tüm kart tek düğme): "HEMEN YAZ", başlık, "Kesintisiz akış · son yazışın N WPM", 6 tür etiketi. Elle çizilmiş eğik SVG Türkçe Q klavye (`KB_SVG`): F/J tümsekli, T-U-Ş tuşları hep yanık. Üzerine gelince tuşlar soldan sağa bir tur parlıyor (CSS, `--i` gecikmesi).
  - **Klavye Dersleri** (5×2): elle SVG ilerleme halkası (biten/47), "47 ders · 8 ünite", ünite satırı, sıradaki 3 ders (`renderPath`: biten/şimdi/açık/kilitli), "Ders haritası →". Kartın boş yerine tıklamak kaldığın dersi açıyor.
  - **Şiir & Atasözü** (5 sütun): "Günün sözü", her açılışta rastgele bir atasözü ya da özdeyiş (≤72 harf, Georgia italik). Altında 5 tür çipi (sayılarıyla), her biri o türün akışını doğrudan açıyor. Kartın geri kalanı ve "→" tür menüsünü açıyor.
  - **PvP Düello** (3 sütun): `pvp-kart.webp` afişi, `?pvp=lobby`.
  - **Performans** (4 sütun): `renderMetrics` artık yalnız hız eğrisinin küçük hâlini çiziyor. Altında "Günlük görevler N/3" ve 3 görev satırı (ince ilerleme çizgileriyle; bitmemiş görev o işi açıyor). Kart ve "→" Performans'ı açıyor. 7 gün, doğruluk, zayıf tuşlar ve rozetler Performans görünümünde aynen duruyor.
- **Görsel dil**: cam kartlar, 22 px köşe, her kartın kendi rengi (camgöbeği/altın/mor/turuncu/yeşil), üst sol köşede renk ışığı, üstte iç parıltı çizgisi. Üzerine gelince 3 px yükseliyor ve kenar parlıyor. Giriş hareketi: sahne soldan (0,45 sn), kartlar 60 ms arayla (en geç 0,27 + 0,32 = 0,59 sn), bir kez. Sağda ızgara deseni.
- **Duyarlı**: ≥1181 px iki sütun (40/60, en çok 1560 px, ortalı). 1181 px'in altında ve 800 px'ten kısa ekranda sıkı kurallar var. ≤1180 px'te sahne üstte, kendi içinde iki sütun (solda başlık + düğmeler, sağda canlı satır + sayılar), bento 2 sütun. ≤860 px'te tek sütun; sıra sahne → Yazma → Dersler → Edebiyat → PvP → Performans. Dokunmatikte çip, bağlantı, ders adımı ve görev en az 44 px.

## Görüp düzeltme turları (ekran görüntüsüne bakarak)
1. 1440×900: 85 px dikey, 23 px yatay taşma vardı. Nedeni dekor katmanlarıydı (harfler, ızgara); `.tlh-hub { overflow: clip }` ile giderildi.
2. Tür çipleri 250 px'lik kartta 4 satıra kırılıyor, sayılar taşıyordu ("Tekerleme 45"). Çipler 2 sütunlu ızgaraya alındı, Edebiyat kartı 5 sütuna genişletildi (PvP 3 sütun). "Tüm türler" ve "Ayrıntılar" yalnız ok düğmesi oldu (`aria-label` ile); kesilen başlıklar ("Şiir & At…", "Perform…") düzeldi.
3. Klavye görseli küçük ve soluktu, Yazma kartının ortası boştu. Klavye büyütüldü, kontrastı artırıldı, T-U-Ş tuşları yakıldı. Dersler halkası ekran yüksekliğiyle büyüyor (64–104 px).
4. 1280×720: 19 px taşma vardı. Kısa ekran kuralı alt satır kartlarını sıkılaştırdı, sonuç 654/654.
5. 1100×800: sahne ilk ekranın tamamını kaplıyordu. Sahne kendi içinde iki sütuna bölündü, bento ilk ekranda görünüyor.
6. Telefonda Edebiyat kartının arka görseli `kart-edebiyat.svg` içindeki "Damlaya damlaya…" yazısı günün sözüyle çakışıyordu. Görsel Merkez'den kaldırıldı.
7. 1920×1080'de "PvP Düello" başlığı iki satıra kırılıyordu; boyu ayarlandı, tek satıra sığıyor.
8. Telefonda "/141" 11 px'e düşüyordu; `max(12px, .5em)` yapıldı.
9. 1280×720'de tek satırlık canlı satırın sonu görünmüyordu. Satır imleci izleyerek kayıyor, solda yumuşak bir solma var.

## Tasarımdan sapmalar ve nedenleri
- **Arka plan bulutlarının yavaş kayması kaldırıldı** (`tlh-drift`): belge "sonsuz animasyon yalnız imleçte" diyor. Bulutlar yerinde, durağan.
- **Alt satır 4/4/4 yerine 5/3/4**: çipler ve sayılar 4 sütuna sığmıyordu. PvP afişi dar kartta da iyi duruyor.
- **Edebiyat ve Yazma kartlarında `kart-edebiyat.svg` / `kart-yazma.svg` kullanılmadı**: ikisinin içinde de yazı var, ekrandaki sözle çakışıyor (dosyalar yerinde). Yazma kartında belgede istenen klavye görseli elle çizilmiş satır içi SVG oldu; tuş tuş parlama başka türlü yapılamıyordu.
- **Canlı satır son seçilen türü yazıyor** (varsayılan Atasözü). Kullanıcı Yazma'da Şiir/Kelime seçtiyse o türün satırı gelir ve harfe basınca o yazılır; harfle başlama sözleşmesi böylece bozulmuyor. 2 satırı aşan metin "…" ile kısaltılıp yazılıyor.
- **Hero'daki ders düğmesi yalnız "Kaldığın ders: N"** (adı `title` içinde, Dersler kartında görünüyor).

## Korunanlar (denendi)
Harfle başlama (ilk harf doğru sayıldı, %100, 0 hata), Ctrl+A/Alt+D/boşluk/Tab başlatmıyor, odak alan dışındayken yönlendirme kodu aynen duruyor. 5 çip doğru türü açtı; kart gövdesi ve "→" tür menüsünü açtı; görevler (ders → Ders 1, 2 metin → Yazma), hero'daki iki düğme, canlı satır, Yazma kartı, Dersler kart gövdesi, ders adımı, Ders haritası, Performans gövdesi ve oku, boş verideki "İlk yazını yap" düğmesi denendi. PvP kartı gerçek tıkla `?pvp=lobby` lobisini açtı. Esc → sonuç → Esc → Merkez çalışıyor, ardından canlı satır yeniden başladı; tarayıcının geri düğmesi Merkez'e döndü. Açılışta 78 istek (artmadı); `words.js`/`lessons.js` ertelemeleri ve `pvp-kart.webp` aynı. Yazma, Dersler, Şiir & Atasözü ve Performans görünümlerine dokunulmadı.

## Dosyalar
- `home/home.js`: Merkez şablonu (sahne + bento), `LIT` (+`short`), `litChipHTML`, `KB_SVG`, `renderPath` (3 adım), `renderMetrics` (yalnız eğri), canlı satır (`liveRun`/`livePaint`), `computeLit`/`renderLit` (günün sözü, çip sayıları), `renderStats` (halka, kısa ders etiketi), önden yükleme seçicisi, `showHome` → `liveRun`.
- `home/home.css`: kokpit blokları yerine Sahne bloğu; tür menüsünün kart stilleri (literature.js kullanıyor) korundu. Kullanılmayan `.tlh-k*`, `.tlh-pw*`, `.tlh-stat*`, `.tlh-met-sec/-acc/-week/-weak`, `.tlh-quest-strip`, `.tlh-met-perf`, `.tlh-btn--gold`, `.tlh-lit-head/-kinds/-tip/-chips`, `tlh-drift` silindi. Duyarlı, dokunmatik ve azaltılmış hareket listeleri güncellendi.
- Testler: yeni `tests/home-sahne.test.mjs` (9 test). Güncellenenler: `home-anasayfa`, `home-kartlar`, `home-metrik`, `home-edebiyat`, `home-tuslar`. `tests/home-kokpit.test.mjs` → `_to_delete/tests/` (geçerli denetimleri home-sahne'ye taşındı).
- `index.html`, `pvp/`, `cloudflare/`, `app.js`, `exact-ui.css`, görünüm modülleri değişmedi. Commit yok.

## Test
`node --test tests/*.test.mjs` → **tests 1146 / pass 1145 / fail 1**. Kalan hata `pvp-akis-arayuz.test.mjs` "lobi ← Ana Sayfa…": Usta'nın şu an değiştirdiği PvP lobi kodu, ana ekranla ilgisi yok. Ana ekran testleri: **76/76**.

## Tarayıcıda görülenler (127.0.0.1:5177, kendi sekmem, ekran görüntüsüyle)
- 1440×900 kaydırmasız (834/834, yatay 1440/1440); 1280×720 kaydırmasız (654/654, 1280/1280); 1920×1080 ortalı (1560 px: 180–1740), dolu, kaydırmasız (1014/1014); 1100×800 iki katman, yatay taşma yok (1092/1092); 390×844 tek sütun, doğru sıra, yatay taşma yok (382/382), 12 px altı yazı yok.
- Boş veri (yeni kullanıcı) ve dolu veri (12 yazış, 7 ders, 5 gün seri) 1440 ve 1280'de ekran görüntüsüyle görüldü.
- Canlı satırın yazılışı ara anlarda görüldü ("Tilkinin dönüp |dolaşıp…"). Kısa ekranda kayan tek satır ve solma görüldü; azaltılmış harekette (`html.reduced-motion`) satır tam ve imleç durgundu. Yazma kartında üzerine gelince parlama dalgası anlık görüntüde görüldü.
- Kullanıcı verisi: `tuslab-home-v1` başta yedeklendi, sonda birebir geri yazıldı (karşılaştırma `true`). PvP anahtarlarına (`tuslab-pvp-*`) ve `yirmitl:*` anahtarlarına dokunmadım; bunlar oturum sırasında başka bir yerden değişti (ör. `tuslab-pvp-fighter` vargr → nyx). Usta çalışırken üstüne yazmamak için geri almadım.

## Görmediklerim / yapılmayanlar
- Gerçek dokunmatik telefon, ekran okuyucu, gerçek `prefers-reduced-motion` ayarı (yalnız `html.reduced-motion` sınıfı ve CSS kuralı).
- Giriş animasyonları panel gizliyken elle bitirildi (`getAnimations().finish()`); 600 ms'lik girişin akışını canlı izlemedim.
- Merkez'de tuş başına süre yeniden ölçülmedi. Yazma görünümünün kodu değişmedi; canlı satır görünüm açıkken çalışmıyor.
- Konsolda kodumuzdan hata yok. Çok sayıda yeniden yüklemede bir kez `net::ERR_NO_BUFFER_SPACE` görüldü (13. raporda da var, tarayıcı/soket kaynaklı).
- Kontrast: yazılacak kısım (soluk "hayalet" metin) bilerek düşük kontrastlı (≈2,3:1). Tam metin ekran okuyucuya ayrıca veriliyor. Diğer metinler koyu zeminde ≥4,5:1 (soluk gri #9aa3c7 ≈7:1).
- `İLERLEME.md` ve `docs/DEVIR-ANA-EKRAN.md`'ye yazılmadı (sahiplik dışı). `npm run cf:validate` çalıştırılmadı.
