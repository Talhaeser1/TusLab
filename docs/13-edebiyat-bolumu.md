# 13 — "Edebiyatla yaz" bölümü ve Şiir & Atasözü akışı (Edip, 24 Kas 2026)

## Yapılanlar
- **Ana ekran kartları** (`home/home.js` `LIT`/`litChipHTML`/`renderLit`, `home/home.css`): 4 çip → **5 tür kartı** (Atasözleri, Deyimler, Şiirler, Tekerlemeler, **Özdeyişler**) tek sırada. Her kartta: tür rengi, elle çizilmiş SVG motif (`assets/home/lit-*.svg`, CSS maskesiyle tür rengine boyanır; köşede büyük soluk motif), üstte **"Başla →"**, tür adı, **o türden kısa örnek satır** (her açılışta rastgele; deyimde kalıp kalın + anlamı, şiirde ilk iki dize), altta ilerleme çizgisi + "N metin yazdın" (veri yoksa "234 atasözü" gibi toplam). Başlık "Edebiyatla yaz" + kısa ipucu (Esc ile bitir; dokunmatikte gizli). Odak halkası tür renginde, azaltılmış harekette kayma yok. Ekran okuyucu: `aria-label` "Atasözleri, başla (234 atasözü, …)", örnek satır `aria-describedby`.
- Telefon (≤860 px): 2 sütun, 5. kart tam genişlik. 1181–1400 px ve kısa ekranda (≤760 px yükseklik) kartlar sıkılaşır.
- **Hız**: sayılar ve örnekler `requestIdleCallback` içinde tür başına bir kez `itemsFor()` (tarayıcıda 5 tür ≈ 6 ms, ilk boyamadan sonra). Eskiden açılışta kelime dahil tüm `MODES` için eşzamanlı sayım yapılıyordu. Yeni JS modülü yok; 5 küçük SVG (<0,5 KB) CSS ile iner.
- **Akış** (`home/literature.js`): tür menüsü ana ekran kartlarıyla aynı görünüm ve sıra (emoji yerine motif; sayı · yazdığın · en iyi WPM). Oturum başlığı tür motifi ve rengiyle; WPM/ilerleme çizgisi/odak çerçevesi tür renginde.
  - **Şiir**: "Kıta · N dize" kutusu özgün dizeleri alt alta gösterir, yazılan dize vurgulanır, bitenler yeşil (`lineStarts`/`lineAt`, `onProgress`).
  - **Deyim**: "Deyim / Anlamı" kutusu (kalıp ayrı, anlam ayrı).
  - Son yazılanlar kendi kutusunda (ilk metin bitince görünür). Kaynak satırının başındaki fazla "—" kaldırıldı ("— Deyim — anlamıyla birlikte" → "Deyim — anlamıyla birlikte").
  - Sonuç: tür motifi, "Kaydedildi · bu türde toplam N metin · en iyi X WPM", **Enter = devam**, "Tüm türler", "Ana ekran"; **Esc = ana ekran**.
  - **Hata onarımı**: karttan gelip hiç yazmadan Esc/Bitir → eskiden tür menüsüne düşüyordu (ana ekrana dönmek için ikinci Esc gerekiyordu); artık doğrudan ana ekrana döner. Menüden açılan oturumda eskisi gibi menüye döner.

## Şöyle yorumladım (kararlar)
1. **Tür seçimi Merkez'de yalnız kartlarda.** Yazma önizlemesinin altındaki 6 tür düğmesi Merkez'den **kaldırıldı** (iki yerde tür seçimi karışıyordu, ayrıca 1280×720'de kartlara yer açtı). Önizleme, Yazma görünümünde son seçilen türü göstermeye devam eder (çubukta tür etiketi var); tür değiştirmek Yazma görünümünün içindeki düğmelerle olur. Yazma = hızlı serbest yazma, kartlar = türe adanmış kesintisiz oturum.
2. Karttaki ilerleme çizgisi "yazılan metin / türdeki metin sayısı" (tekrarlar dahil, %100'de durur); en iyi WPM kartta değil ipucunda ve menüde.
3. Örnek satırlar yalnız var olan içerikten seçilir (yeni metin yazılmadı).

## "Diğer yerlerde atasözü olmasın" denetimi
- `home/lessons.js`: atasözü/deyim girişi yok (L34–37 ders metinlerindeki atasözü cümleleri içerik; dokunulmadı).
- Performans (`mountPerf`): tür seçimi/girişi yok. Yalnız günlük görev "Atasözü modunda bir metin bitir" (`QUESTS.arena`) satırı tıklanınca Yazma'yı Atasözü kipinde açar — görev Metrik/Tuşçu alanı, dokunulmadı; kaldırılması istenirse orkestra karar vermeli.
- Yazma görünümünün kendi tür düğmeleri (Atasözü, Şiir, Deyim, Tekerleme, Özdeyiş, Kelime) yerinde: Yazma'nın parçası, Merkez'de değil.
- PvP içerik kipleri (atasözü vb.) ayrı oyun özelliği; **dokunulmadı**.

## Test
- `node --test tests/*.test.mjs` → **tests 1114 / pass 1114 / fail 0** (home: 52/52; yeni `tests/home-edebiyat.test.mjs` 6 test, `home-typing-akis` +1 şiir/deyim/Esc testi, `home-kokpit` 5 kart için güncellendi).

## Tarayıcıda görülenler (127.0.0.1:5177, ekran görüntüsüyle)
- Kullanıcı verisi (`tuslab-home-v1`) önce yedeklendi, denemelerden sonra birebir geri yazıldı (karşılaştırma `true`).
- 1440×900: kaydırmasız (`.tlh-menu` 834/834, yatay 1440/1440), kesilen yazı yok. 1280×720: kaydırmasız (654/654); ilk denemede 9 px taşma vardı, kısa ekran kuralıyla giderildi. 390×844: tek sütun, yatay taşma yok (382/382).
- Baştan sona yazıldı: 1 atasözü, 1 deyim (+anlam kutusu), 1 şiir (İstiklal Marşı 6. kıta; dize vurgusu ilerledi), 1 tekerleme, 1 özdeyiş (menüden). Her birinde sıradaki metin aynı tuşta geldi; Esc → özet; Enter → devam; Esc (boş) → ana ekran; özetten Esc → ana ekran; kart ilerlemesi "1 metin yazdın" oldu.
- Konsolda kodumuzdan hata yok. Bir kez `net::ERR_NO_BUFFER_SPACE` (çok sayıda yeniden yüklemede tarayıcı/soket kaynaklı; o yüklemede başarısız istek görülmedi).

## Görmediklerim
- Gerçek dokunmatik telefon, ekran okuyucu, `prefers-reduced-motion` açık tarayıcı (yalnız CSS kuralı + test).
- Telefonda oturum yalnız görüntüyle bakıldı, telefonda yazılmadı. 1100–1180 px iki sütun düzeni ekran görüntüsüyle bakılmadı.
- Çok uzun atasözünde satır kırılması ayrıca denenmedi; şiirde (162 karakter) kelime bölünmeden üç satıra kırıldığı görüldü (aynı yazıcı).
- Commit yok; `İLERLEME.md`'ye yazılmadı (sahiplik dışı).
