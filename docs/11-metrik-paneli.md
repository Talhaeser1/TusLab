# 11 — Metrik paneli ve Performans (Metrik, 24 Kas 2026)

## Yapılanlar
- **Sol sütun mini pano** (`.tlh-met-slot[data-slot="metrik-grafik"]`, `renderMetrics()`): eski `renderSpark()` çubukları kaldırıldı.
  - Son 12 yazışın **hız eğrisi**: elle SVG alan + çizgi, 0/orta/üst eksen etiketleri, tarih–"son" alt ekseni, kesikli **ortalama** (mor) ve **en iyi** (altın) çizgileri, son nokta vurgulu ve değerli; her noktanın `title`'ı (WPM · doğruluk · tür · tarih).
  - Az veri: 0 kayıt → soluk örnek eğri + "Hız eğrin burada çizilecek" + **İlk yazını yap** düğmesi (Yazma'yı açar). 1 kayıt → tek nokta + "Bir yazış daha: eğilim çizilsin". 2+ → eğri.
  - **Doğruluk eğilimi** (küçük, yeşil; 2+ kayıtta), **son 7 gün** etkinlik çubukları (gün başına biten metin; seri sürüyorsa serinin günleri her zaman etkin → gün serisiyle tutarlı), **zorlandığın tuşlar** (en çok 5; veri yoksa bölüm yok).
  - **Günlük görevler**: başlık çipi (→ Performans) + 3 görevin kısa adı, sayacı (0/1, 1/2, ✓) ve ince ilerleme çizgisi. Bitmeyen görev satırı düğmedir: o işi açar (ders → kaldığın ders, Şiir köşesi, Yazma; "Atasözü modunda" görevi Atasözü kipini seçip açar).
- **Performans** (`mountPerf`): aynı bileşenlerin geniş hâli — son 20 metin hız eğrisi (nokta değerleri yazılı), doğruluk eğilimi, son 7 gün, görevler (tam ad + "Bir göreve tıkla…" notu), zayıf tuşlar (ilk 10, çubuklu), seviye + 8 rozet tek satır. Boş/az veri metinleri; "En iyi hız" boşken "—".
- **Hız**: tüm sayılar tek geçişte `computeMetrics()` (saf hesap); çıktı dizgesi önbellekle karşılaştırılır, değişmedikçe DOM'a yazılmaz (açılışta 4–5 kez çağrılan `renderStats` artık paneli yeniden çizmez). Grafik yüzde konumlu SVG/HTML: yeniden boyutlanınca JS yok. İlk çizim `boot()` içinde eşzamanlı → düzen kayması yok. Yeni modül/istek yok.
- **Taşma**: ≥1181 px'te `.tlh-k-met { contain: size }` — panel satır yüksekliğini büyütmez, verilen alana uyar; grafik kalan yeri doldurur. Kısa ekranda öncelik sırası: ≤820 px yükseklikte zayıf tuşlar, ≤740 px'te doğruluk gizlenir (1280×720'de hız + 7 gün + görevler kalır).
- **İlk tuş hatası** (Mimar'ın işi): Merkez'de basılan ilk harf beklenen harfle büyük/küçük harf duyarsız (Türkçe `toLocaleLowerCase('tr')`: i↔İ, ı↔I) eşleşirse beklenen harf olarak aktarılır (doğru sayılır); eşleşmezse hiçbir şey aktarılmaz, hata yazılmaz. `typing.js`: `matchStartKey()` + denetleyicide `expected`. Yazma içindeki kurallar değişmedi.
- Depolama: `progress()` biten metni `d.days[gün]` sayacına da yazar (60 günden eskisi atılır).

## Şöyle yorumladım
- Grafikteki "en iyi" çizgisi **pencerenin** en iyisi (son 12/20); üstteki "en iyi WPM" kutusu tüm zamanların. 192 WPM gibi tek uç değer pencerede varsa ölçek ona göre (veri dürüst kalsın diye kırpılmadı).
- Haftalık etkinlik = geçmişteki kayıtlar ∪ günlük sayaç ∪ serinin günleri (ders bitirmek de seriyi artırdığı için).
- Merkez lejantında "son" yazılmadı (son nokta zaten değerli; dar sütunda iki satıra kırılıyordu); Performans'ta var.

## Test
`node --test tests/*.test.mjs` → **tests 1107 / pass 1107 / fail 0** (7'si yeni `tests/home-metrik.test.mjs`; aradaki artış başka şeridin testleri).

## Tarayıcıda görülenler (127.0.0.1:5177, ekran görüntüsüyle)
- Kullanıcı verisi önce yedeklendi, denemelerden sonra birebir geri yazıldı (karşılaştırma `true`).
- 1440×900: boş, 1 kayıt (gerçek veri), 2 kayıt, 12 kayıt — sol panel taşmıyor (`.tlh-k-met` 792/792, `.tlh-menu` 834/834).
- 1280×720: boş ve 12 kayıt — taşma yok (620/620, menü 654/654), doğruluk + zayıf tuşlar gizli.
- 390×844 (12 kayıt): tek sütun, tüm bölümler, yatay taşma yok (382/382), 12 px altı yazı yok. 1100×800 iki sütun: düzgün.
- Performans: 12 kayıt, boş ve 1 kayıt; görev satırı → Klavye Dersleri (Ders 1) açıldı; "İlk yazını yap" → Yazma, odak yazma alanında.
- İlk tuş: "Tilkinin…" satırında `t` → 0 hata, %100; "Köprüyü…" satırında `x` → hiçbir şey aktarılmadı, 0 hata; "El eli…" satırında `e` → "E" yeşil, 0 hata.
- Konsolda hata yok.

## Görmediklerim
- Gerçek telefon/dokunmatik, ekran okuyucu, `prefers-reduced-motion` açık tarayıcı.
- `i`→"İ" / `ı`→"I" yalnız birim testte (o harfle başlayan satır denk gelmedi).
- 1920 px geniş ekran ve 1366×768 ekran görüntüsüyle bakılmadı.
- Tarayıcı paneli gizliyken çekildi; giriş animasyonları elle bitirildi, ayrıntı için `#tl-home`'a geçici `transform: scale` uygulanarak bakıldı.
- `İLERLEME.md`'ye karar yazılmadı (sahiplik dışı; orkestraya bırakıldı). Commit yok.
