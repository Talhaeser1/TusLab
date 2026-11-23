# 16 — Yazma ekranları: Klavye Dersleri, Yazma, Şiir & Atasözü (Hoca, 24 Kas 2026)

## Yapılanlar
- **Ortak düzen** (`home/egitim.css` "Ortak yazma ekranı" bölümü; `home/lessons.js`, `home/literature.js`, `home/home.js`): başlık satırı (tür/ünite · ders adı · hedef, yeni tuşlar, **sayaç şeridi**, `Klavye: açık/kapalı` + `Ders Haritası`/`Tüm türler`), metin kutusu, ekran klavyesi, alt bilgi. Sayaçlar başlık satırında (`mountTyper(..., { statsHost })`). Yazı boyu ve tuş yüksekliği `vh` ile ölçeklenir (`--u: clamp(26px, 5.2vh, 54px)`), klavye genişliği tuş yüksekliğine bağlı ve ortalı; içerik geniş ekranda en çok 1320 px ve dikeyde ortalı.
- **Kutu ailesi** ana ekran kartlarıyla aynı: vurgu renkli cam degrade, 22 px köşe, gölge, renkli üst şerit (`.tl-box`, `.tl-typer-box`, `.tl-kb`). Görünüm katmanı Merkez'in durağan arka planı üzerinde yarı saydam, `backdrop-filter` kaldırıldı.
- **Şiir & Atasözü**: ≥1100 px'te yazıcı solda, kıta/anlam + son yazılanlar sağ sütunda (dar sütun + boş alan sorunu).
- **Ders Haritası**: üst özet (ders/yıldız/rekor/seri kutuları, genel ilerleme, "Kaldığın yerden devam et · Ders N"), yapışkan ünite atlama çipleri, her ünite renkli kutu (ilerleme çubuğu, ★ toplamı), dersler **yol** üzerinde düğüm: tamamlanan ✓ (3 yıldız altın), sıradaki büyük ve parlayan "Sıradaki", kilitli kesik çizgi + kilit. Açılışta sıradaki derse kaydırılır ve odaklanır (Enter başlatır). Klavye: tek sekme durağı, ←/→ ders, ↑/↓ ünite, Home/End.
- **Sonuç ekranları**: ders — yıldızlar (sırayla beliren, azaltılmış harekette yok), mesaj, WPM/doğruluk kutularında "✓/✗ hedef", bir üst yıldız için gereken hız/doğruluk (`nextStarGoal`), zorlanılan tuşlar, `Sonraki ders → / Tekrar / Zayıf tuşlarımı çalış / Ders Haritası / Merkez`; birincil düğme odakta (Enter). Şiir & Atasözü — "Oturum bitti · N metin", türdeki en iyiye göre durum, `Devam et / Tüm türler / Merkez`. Yazma — kutu ailesinde kart, rekora göre durum ("Rekorun X WPM · Y WPM geride"), 5 kutucuk, `Merkez Esc`; konfeti 160→70 parça ve yalnız rekor ya da USTA+ derecede.
- **Ekran klavyesi** (`home/typing.js`): Türkçe Q (veri `KEY_ROWS`, test ile doğrulandı), rakam sırası ve `< " * -` için parmak rengi, Shift ile gelen işaret tuş köşesinde (1/!, 2/', ,/; …), Shift tuşları serçe renginde ve büyük harfte karşı el Shift'i vurgulu, sıradaki tuşta beyaz çerçeve, doğru basış yeşil / yanlış kırmızı + titreme. **Tercih kalıcı ve üç ekranda ortak**: `localStorage['tuslab-home-kb']` ('1'/'0'); kayıt yoksa açık; <700 px genişlik veya <620 px yükseklikte hiç gösterilmez (düğme de gizli). Yazma'ya da düğme eklendi.
- **Telefon (≤699 px)**: ekran klavyesi ve alt bilgi gizli, içerik üstten başlar, yazarken (odak) yeni tuş kartları ve hedef satırı gizlenir; sanal klavye açılınca kutu görünür alanda kalsın diye `visualViewport` boyutu değişince bir kez kaydırılır.

## Şöyle yorumladım
1. Haritada **kilitli derse tıklamak önizlemeyi açar** (eskiden yalnız uyarı + ayrı "Önizle" bağlantısı vardı; 40 kilitli kartta bağlantı kalabalık yapıyordu). Uyarı yine gösterilir, ekranda "Önizleme… kaydedilmez" şeridi var.
2. Şiir & Atasözü'nde ekran klavyesi eskiden varsayılan kapalıydı; artık tek ortak tercih (varsayılan açık). İstenmezse bir tık, kalıcı.
3. Yazma'da 1280×720'de parmak renk açıklaması gizli (yükseklik ≤ 800 px; renkler tuşlarda).
4. "Hedefe göre durum": derste ders hedefi; Yazma ve Şiir & Atasözü'nde hedef olmadığı için kişisel/tür en iyisine göre.

## L07 (DEVIR-ANA-EKRAN 2)
İçerik uydurulmadı. Durum aynı: L07 "Temel sıra kelimeleri" yalnız ana sıra harfleriyle (a s d f g h j k l ş i) ~30 gerçek kelime bulabiliyor; hepsi kullanılıyor, kalan yer sözde-kelimeyle doluyor (`tests/home-dersler.test.mjs` ≥25 gerçek kelime şartı). Çözüm kelime havuzuna doğrulanmış gerçek kelime eklemek ya da ders uzunluğunu kısaltmak; karar kullanıcının.

## Performans (tuş başına, `input` + zorlanmış düzen, `performance.now`, 60 tuş, ekran klavyesi açık)
| Ekran | medyan | p90 |
|---|---|---|
| Ders, 1280×720 | **0,9 ms** | 1,2 ms |
| Yazma (akış, kombo dahil), 1280×720 | 1,7 ms | 2,3 ms |
(Tuşçu ölçümü: Yazma 1440×900 klavyeli 2,0 ms.) Tuş başına eklenen düzen okuması yok; tersine `flashKey` ve hata titremesindeki `void offsetWidth` (her tuşta zorla düzen) kaldırıldı. Metin yalnız kurulumda/yeni parçada çizilir. Görünüm katmanının `backdrop-filter`'ı ve yazı kutusunun blur'u kaldırıldı.

## Test
`node --test tests/*.test.mjs` → **tests 1141 / pass 1141 / fail 0** (yeni `tests/home-yazma-ekranlari.test.mjs` 10 test; `home-typing-akis` değişmeden geçti).

## Tarayıcıda görülenler (127.0.0.1:5177, kendi sekmem, ekran görüntüsüyle)
- Kullanıcı verisi (7 anahtar) önce yedeklendi, sonda birebir geri yazıldı (karşılaştırma `true`; `tuslab-home-kb` silindi).
- Kaydırmasız (`scrollHeight = clientHeight`): ders 1440×900 773/773, 1280×720 593/593, 1920×1080 953/953; Yazma 1440×900 772/772, 1280×720 592/592 (ilk denemede 21 px taşma → açıklama gizlendi), 1920×1080 952/952; Şiir & Atasözü oturumu 1440×900 773/773, 1280×720 593/593; ders sonucu 1280×720'de ilk 9 px taştı → sonuçta alt bilgi gizlendi.
- Baştan sona: Ders 1 (sentetik giriş, 1280×720) ve **Ders 2 gerçek tuş vuruşuyla** (1440×900) bitti → ★★★, "Sonraki ders" odakta; hatalı denemede "Hedefe az kaldı", ✗ hedef %94. Şiir (İstiklal Marşı kıtası) yazıldı, kıta kutusu ilerledi, Esc → özet, odak "Devam et". Yazma akışı yazıldı, Esc → sonuç kartı.
- Harita: 1440/1280/1920/390; Enter ile sıradaki ders, →/↓ ile Ders 3 → Ders 10, tek `tabindex=0`. Klavye tercihi: derste kapat → Yazma'yı yeniden yükle → "Klavye: kapalı", klavye gizli; açınca odak yazma alanında.
- Yanlış tuş: Q kırmızı, sıradaki N + sol Shift vurgulu.
- 390×844: harita, ders, Şiir & Atasözü (deyim), Yazma: yatay taşma yok (390/390), ekran klavyesi yok; ders kutusu odakta 280–412 px'te. Telefonda 12 px altı yazı: `Bitir` içindeki `Esc` (11,5 px) bulundu → 12 px, telefonda gizli.
- Konsolda hata yok.

## Görmediklerim
- Gerçek telefon ve gerçek sanal klavye (yalnız emülasyon + DOM ölçümü; telefon ekran görüntüsü araç tarafından kırpıldı), ekran okuyucu, `prefers-reduced-motion` açık tarayıcı (yalnız CSS + test).
- Tarayıcı paneli gizliyken animasyonlar elle bitirildi; yıldız belirme animasyonunu canlı izlemedim.
- 700–1099 px ara genişlik, Serbest Alıştırma'nın yazma ve sonuç ekranı (yalnız seçim ekranı görüldü; 1280×720'de seçim ekranı kayıyor, yazma değil).
- Commit yok; `İLERLEME.md` ve `DEVIR-ANA-EKRAN.md` değişmedi (sahiplik dışı).
