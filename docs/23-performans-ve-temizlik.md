# 23 — Performans panosu, kalan davranışlar ve home/ temizliği (Terazi, 24 Kas 2026)

Kendi sekmemde `http://127.0.0.1:5177/index.html`. `tuslab-home-v1` önce yedeklendi, sonunda birebir geri yazıldı
(karşılaştırma `true`). Başka `tuslab-home-*` anahtarı yoktu, kalmadı. PvP anahtarlarına dokunulmadı.

## 1. Performans görünümü (`home/home.js` `mountPerf`, `home/home.css` "Performans panosu")
- **Özet** (Ders Haritası başlığıyla aynı aile, `.tl-box` + `.tl-map-tile`): "Performans · Sv. N", seviye çubuğu + XP,
  en iyi hız · ort. doğruluk (son 10) · biten metin (+ bugün) · gün serisi.
- **Hız ve doğruluk** (8/12 sütun, iki satır yüksekliğinde): elle SVG; sol eksen WPM, sağ eksen %; alan + çizgi, kesikli
  ortalama, yeşil doğruluk çizgisi, tarih ekseni (5 etiket, telefonda 3). Üzerine gelince ya da odakta ←/→/Home/End ile
  en yakın yazışın kutusu (WPM, doğruluk, tür, tarih-saat; `role="status"`). Tür süzgeci (kayıtta 2+ tür varsa) grafiği
  ve tabloyu süzer.
- **Günlük görevler** (mevcut satırlar, tıklanınca iş açılır), **Etkinlik** 7 gün / 30 gün şeridi (4 düzey, seri günleri
  en az 1. düzey, bugün çerçeveli).
- **Zorlandığın tuşlar**: ekran klavyesi bileşeni yeniden kullanıldı (`typing.js` yeni `heatKeyboard()`: aynı
  `KEY_ROWS` ve `.tl-kb/.tl-key` stilleri, hata oranına göre kırmızı ısı); yanında ilk 5 tuş listesi (ekran okuyucu için).
- **Son yazışlar** tablosu (tarih + saat, tür, WPM + küçük çubuk, ★ rekor, doğruluk; en çok 8) ve **rozet vitrini**
  (kazanılan parlak + tarih; kilitli: koşul + ilerleme çubuğu + `n/hedef`).
- Boş / 1 kayıt / 15 kayıt, 1440×900, 1280×720, 1024×768, 390×844 ekran görüntüsüyle bakıldı.

## 2. Kalan davranışlar
- (a) Yazma'da metin bitmeden çıkış: `complete` = akışta ≥1 parça, Kelime'de metnin sonu. Bitmediyse "biten metin",
  gün sayacı, seri ve metin görevleri artmaz; ≥20 harfse hız geçmişe ve rekora yazılır, "%98" görevine sayılmaz
  (`progress({ hist, accOk })`). Sonuç kartında "Metin bitmedi: hızın kaydedildi, biten metne sayılmadı".
  Tarayıcıda: 22 harf + Esc → biten 1→1, gün sayacı aynı, geçmiş 1→2, görev sayacı boş.
- (b) Kelime'de Esc: `escView()` önce yazıcıyı durdurur → aynı sonuç kartı; ikinci Esc Merkez. Gerçek tuşlarla
  ("yıldan" + Escape) denendi. Odak yazı alanı dışındayken akışta da artık sonuçsuz kapanmıyor.
- (c) Sekme gizlenince: yazıcının süresi ve 250 ms sayacı durur, dönünce kaldığı yerden sürer (`typing.js`
  pause/resume; Ders, Şiir & Atasözü, Yazma üçü de). Canlı satır zaten duruyordu; `document.hidden` taklidiyle ölçüldü
  (gizliyken 5→5 harf, dönünce sürdü; yazıcıda 2,6 sn gizlilik süreye eklenmedi).

## 3. Temizlik ve ölçüm
- `_to_delete/terazi-home/`: `home/scene3d.js` (hiç yüklenmiyordu), `assets/home/kart-yazma.svg`, `kart-edebiyat.svg`.
- Silinen ölü kod: `accHTML`, `weekHTML`, `weakHTML`, `literature.js dailyLine()` + `mix` + `PROVERBS`; gereksiz
  `export` (kbFits, bumpStreak, CATEGORIES); eski Performans CSS'i (`tlh-perf-*`, `tlh-panel`, `tlh-bars`, `tlh-quest*`,
  `tlh-badges`, `tlh-level-*`, `tlh-week/day`, `tlh-wk`, `tlh-ch--acc`); egitim.css'te hiç kullanılmayan `tl-pills`,
  `tl-actions`, `tl-pill`, `tl-link`, `tl-newkeys`, home.css `tlh-res-keys` (her biri grep ile 0 kullanım).
- egitim.css'te 12 çift kural: sonradan aynı seçiciyle ezilen özellikler öndeki kuraldan silindi (görünüm aynı).
- Renkler: `--tl-*-rgb` üçlüleri (bg, cyan, gold, ember, violet, bad, ok) ve `--tl-on-warm`; 142 rgba sabiti ve 3 `#3fe0ff` bunlara bağlandı.
- Boyut: home.css 79,3 → 87,8 KB (yeni pano CSS'i ≈15 KB; geri kalanı 72,8 KB), egitim.css 37,5 → 36,5 KB.
- Açılış: home/ istekleri 15 → 14 (`sfx.js` ilk dokunuş/tuşta iner). Toplam kaynak sayımı 77 (PvP/kök dosyaları bu
  oturumda değişiyor, karşılaştırma yalnız home/ için anlamlı).
- Ana iş parçacığı (`performance.measure`): `tlh-boot` 13–17 ms. Canlı satırın ilk çizimi sayfanın ilk tam düzenini
  zorluyordu (45–196 ms, `tlh-arena`) → ilk boyamadan sonraya ertelendi (`tlh-live`). Tuş başına süre (Yazma, klavye
  açık, 60 tuş): medyan 2,2 ms, p90 3,3 ms (21. rapor 2,2 / 3,0; gürültü düzeyi).
- `setAll` artık yalnız değişen metni yazar (renderStats açılışta 4–5 kez çağrılıyordu).

## 4. Tutarlılık
Dört görünümde "← Merkez" x=84 px ve ilk kutu x=84 px (1440), başlık satırı 62 px, üst menüde doğru sekme etkin
(ölçüldü). Bunun için tüm görünümlerin içeriği 1272 px'e eşitlendi; gövdede `scrollbar-gutter: stable both-edges`.
Ders Haritası artık bir ünitenin 7 dersini tek satırda gösteriyor; Şiir & Atasözü tür kartları satırı dolduruyor.

## Şöyle yorumladım
- "Biten metin" Yazma akışında oturum başına sayılmaya devam ediyor (en az bir parça bittiyse); parça başına saymak XP'yi şişirirdi.
- Metin bitmeden ≥20 harf: rekor ve hız rozetleri (40/60 WPM) yine sayılır ("hız kaydı tutulabilir").
- Sekme gizlenince oturum bitmez, yalnız duraklar.
- Performans'ta grafik tüm geçmişi (en çok 40) gösterir; "ort. doğruluk" son 10 yazış.
- Sahne'nin düzenine dokunulmadı (1440×900 834/834, 1280×720 654/654 aynı).

## Görmediklerim / yapmadıklarım
- Gerçek sekme gizleme (panel sekmeleri hep "visible"), gerçek telefon/dokunmatik, ekran okuyucu, gerçek
  `prefers-reduced-motion`. Telefon yatayda Performans'a bakmadım.
- `docs/codex/ANASAYFA-SOZLESME.md` `dailyLine`/`scene3d` satırları (sahiplik dışı) güncellenmedi. İLERLEME.md'ye yazılmadı.
- `npm run cf:validate` çalıştırılmadı. Commit yok.

## Test
`node --test tests/*.test.mjs` → **tests 1179 / pass 1179 / fail 0** (home: 94/94; yeni `tests/home-terazi.test.mjs` 8 test).
`home-gozcu`, `home-metrik`, `home-kartlar` yeni koda göre güncellendi.
