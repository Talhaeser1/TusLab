# Şerit IS1-TEMPO-2 — Dövüş temposu 2. tur (KESINYAP iş 1)

ÖNCE OKU: `KESINYAP.md` (kural 2, 3, iş 1 satırı), `docs/codex/00-ORTAK.md` (ortak kurallar — uy).
Önceki tur: `git show HEAD --stat`, `git show HEAD -- pvp/visual-timeline.js pvp/arena3d.js pvp/fighters3d.js`
(ara ~1,2 sn, sıra kilidi, raund sonu toplama, KO bekleme, efekt ön ısıtma yapıldı). Çalışma ağacında orkestratörün
iki eklemesi var, KORU: `pvp/arena3d.js` `_debug.perf()` ve `.playwright-mcp/kasma-probe.js` (yeni ölçüm probu).

## Sahip olduğun dosyalar (yalnız bunlara yaz)
pvp/arena3d.js, pvp/arena3d-bloom.js, pvp/arena3d-fx.js, pvp/fighters3d.js, pvp/visual-timeline.js, pvp/perf-governor.js,
pvp/performance.js, pvp/index.js, pvp/sound.js (YALNIZ tetikleme zamanlaması), pvp/voice-queue.js, pvp/end-voice.js,
pvp/combat-fx.js, pvp/choreography21.js, pvp/fight-motion.js, tests/* (yeni test ekle; test SİLME/ATLAMA yok),
.playwright-mcp/* (prob/ölçüm betikleri), İLERLEME.md (kısa karar notu), KESINYAP.md (YALNIZ iş 1 satırı).

## DOKUNMA
index.html, devamindex.html, package.json, cloudflare/, pvp/shared/*, pvp/cinematic.js, pvp/cinematic.css,
pvp/phase15-results.js, pvp/rounds-ui.js, pvp/rounds-ui.css, pvp/arena-ui.js, pvp/fx-damage.js, app.js (başka işçi çalışıyor).
Commit/push YOK, dal değiştirme YOK, `git checkout/reset/stash` YOK. Sunucu http://127.0.0.1:5176 zaten açık — BAŞLATMA.
AYNI ANDA TEK tarayıcı (ölçümleri sırayla çalıştır, paralel değil). Sunum zamanlaması kuralları/hasarı değiştirmez.
`prefers-reduced-motion` yolu bozulmasın.

## Ölçüm araçları
- `node .playwright-mcp/run-gpu.mjs .playwright-mcp/kasma-probe.js '{"mode":"rounds","maxMs":100000}'`
  (gerçek GPU, ANGLE/D3D11). Modlar: rounds, classic, arena; hızlı yazan: `{"mode":"classic","maxMs":100000,"gap":60,"key":2}`.
  Çıktı: `long` (her >150 ms kare + o anda/400 ms öncesinde başlayan olaylar: res=ağ kaynağı, gl.texImage2D vb. süreli GL çağrısı,
  loaf=long-animation-frame atfı, clip=yeni klip, cast/strike, class=kök sınıf değişimi, play/decode=ses),
  `avgFight`, `over250Fight`, `bothAtk`, `maxJump`, `slides` (idle klibinde kayma), `switchMin/Max`, `lat` (kelime→hareket).
- Deterministik: `node .playwright-mcp/dovus-sim.mjs` (ve `--trace`). Eski prob `.playwright-mcp/dovus-tempo-probe.js` de var.
- Bu makinede bellek az: ölçümü tek tarayıcıyla, başka iş yokken al; koşulu (GL renderer satırı, viewport) raporla.
- Prob yetersizse genişlet (ör. her olayın klip adı, doku adı); ama ham kare dökümü değil, özet döndür.

## YÖNTEM
1. ÖNCE ÖLÇ: dört koşunun hepsini al, sonuçları `.playwright-mcp/tempo2-once-<mod>.json` olarak kaydet.
2. Kök nedene in (madde 1), düzelt (madde 1–5 + EK), `node --test tests/*.test.mjs` geçir.
3. SONRA AYNI dört koşuyu tekrarla → `.playwright-mcp/tempo2-sonra-<mod>.json`. Önce/sonra tablo.

## GÖREVLER

### 1) KASMA (en önemli — kullanıcı "kasıyor, saldırılar gecikmeli" diyor)
Önceki ölçüm: 1,4–4,5 sn kare donmaları, ana iş parçacığında uzun görev yok, dövüşte shader derlenmiyor → GPU tarafı görünüyor.
- Her donmayı (`long`) o anda başlayan olayla eşle. Şüpheliler: ilk kullanımda doku yükleme/GPU'ya yükleme (texImage2D, WebP decode),
  ilk kez görünen GLB klibi/iskelet, bloom hedef boyutu, gölge haritası, devicePixelRatio × tam ekran canvas, çok sayıda parçacık,
  her karede ağır CSS (filter/backdrop-filter/box-shadow animasyonu, büyük text-shadow), HUD'da layout okuma-yazma,
  ses dosyalarının ilk decode'u, GC (her karede yeni Vector3/dizi).
- `pvp/perf-governor.js` + arena3d.js `monitorFrame`/`AUTO_QUALITY`: vali `ignoreAboveMs:250` ile UZUN donmaları hiç saymıyor ve
  45 kare ısınma bekliyor → donmalar kaliteyi düşürmüyor. Düzelt: tekrarlayan uzun kareler (ör. 3 sn içinde ≥2 kare >250 ms,
  sekme dönüşü/ilk ısınma hariç) ve kötü pencere ortalaması kademeyi GERÇEKTEN düşürsün (bloom→pixelRatio→düşük: parçacık/ışık/gölge);
  ilk karelerden itibaren ölçsün. `pvp/performance.js`'in ne yaptığını incele, gereksiz/çakışan iş varsa düzelt.
  Uyarlamalı: kalite yalnız GEREKTİĞİNDE düşsün (hızlı makinede yüksek kalır). Testle sabitle (tests/ altında).
- Maç başında (VS/geri sayım sırasında) tüm dövüş kaynaklarını ön yükle ve GPU'ya ön ısıt: `renderer.initTexture` (her malzeme
  dokusu, efekt dokuları, karakter dokuları), `renderer.compile` + her efekt ve her saldırı/ulti/tepki klibi bir kez görünmez
  karede çizilsin/oynatılsın (AnimationMixer ilk eylem kurulumu), ses örnekleri önceden decode. Mevcut `queueWarmup/warmDraw`
  (arena3d.js ~3934–4005) ve fighters3d.js `warmGroup` (~1364) üzerine kur.
- HEDEF: maç başladıktan sonra 250 ms üstü kare boşluğu 0; maç içi ortalama kare ≤ 20 ms. Olmuyorsa kalan her donmanın KANITLI
  nedeni (hangi olay, hangi GL çağrısı/kaynak).

### 2) RAUND SONU + ULTİ
Ulti oynarken raund biterse karşı tarafın bekleyen sahnesi animasyonsuz bitiyor (visual-timeline `tick` → `drainUntil`
dolunca `finish(queue.shift(), true)`). Düzelt: bekleyen sahneler sıralı ve kısa (sıkıştırılmış) animasyonla oynasın YA DA tek
toplu sahnede gösterilsin; animasyonsuz hasar 0. Prob/sim ile say (forced tamamlanan + hasarı uygulanmış sahne sayısı = 0).

### 3) ARENA RAUND GEÇİŞİ
Oynayan sahne raund geçişinde (flush/clear) kesilince model yerine ANINDA oturuyor (görünür sıçrama). Sahne bitene kadar bekle
ya da yerine yumuşak dön (≤ 400 ms lerp + klip crossFade). Kabul: arena maxJump ≤ 0,35.

### 4) SESLER SAHNEYLE AYNI KAREDE
`pvp/index.js` ~675–729: arena `attack-turn`, `clash`, `counter` ve kalkan (`ward-rise` → 'shield') sesleri sunucu olayı ANINDA
çalıyor; sahne sıra bekliyor. Bu sesler görsel sahnenin ilgili karesinde (cast başlangıcı / temas) çalsın — arena3d'nin
`tuslab:pvp-cast` / `tuslab:pvp-strike` olayları ya da zaman çizelgesi temasları üzerinden. 3B yoksa / reduced-motion'da eski
anlık davranış kalsın. `pvp/sound.js`'e yalnız tetikleme zamanlaması için dokunabilirsin; tek kuyruklu konuşma düzeni, seri
sesi ve bitiş repliği mantığı BOZULMASIN — `tests/pvp-kesinyap-ses-sure.test.mjs` geçmeli. Testle sabitle.

### 5) ULTİ SALDIRANI KAYMASI
Ulti saldıranı kısa bir anda koşu klibi olmadan idle duruşunda kayarak ilerliyor. Hareket ederken (root/actor x değişirken)
her zaman yürüyüş/koşu klibi oynasın; ayak kayması yok. Prob alanı `slides` (idle klibinde > 0,6 birim/sn) = 0 olmalı.

### EK) BİTİŞ SPİKERİ
Maç sonunda bekleyen düşük öncelikli replik kuyruğu meşgul tuttuğu için `spiker-zafer/yenilgi` bazen 2,5 sn bayatlık sınırını
aşıp düşüyor. KARAR: maç bitince kuyruktaki bekleyen düşük öncelikli replikler ATILIR; sıra: (kazananın zafer repliği) → bitiş
spikeri; bitiş spikeri bayatlıktan muaf. `pvp/voice-queue.js` / `pvp/end-voice.js` içinde düzelt, testle sabitle.

## KABUL (üç mod + hızlı yazan, gerçek GPU)
iki dövüşçü aynı anda saldırı 0 kare; saldıran değişimi arası 0,6–2,0 sn; maxJump ≤ 0,35; kuyruk boşken kelime→hareket ≤ 300 ms;
maç içinde 250 ms üstü kare 0 (olmuyorsa her kalan donmanın kanıtlı nedeni); animasyonsuz hasar 0; slides 0; sayfa hatası yok;
`node --test tests/*.test.mjs` tamamen geçer; `npm run cf:validate` geçer.

## BİTİRİNCE
- KESINYAP.md'de YALNIZ iş 1 satırını güncelle: kabul sağlandıysa ✅ + kısa kanıt, değilse 🟡 + kalan.
- İLERLEME.md'ye kısa karar notu (tarih 2026-11-12, ne kararlaştırıldı, neden).
- Rapor (Türkçe, ≤ 50 satır): donmaların kök nedeni; önce/sonra tablosu (mod × avgFight, over250Fight, bothAtk, switchMin–Max,
  maxJump, latMax, slides, sayfa hatası); değişen dosyalar; test sayıları; açık kalanlar. Bitmeyen işi "bitti" yazma.
