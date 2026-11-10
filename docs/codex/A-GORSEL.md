# Şerit A — Görsel: net görüntü, sahneler, tam ekran tuval

Önce `docs/codex/00-ORTAK.md`'yi oku ve uygula.

## Sahip olduğun dosyalar
pvp/arena3d.js, pvp/arena3d-fx.js, pvp/arena3d-bloom.js, pvp/arena3d-hpbars.js, pvp/arena3d-assist.js, pvp/fighters3d.js,
YENİ pvp/stages3d.js, scripts/optimize-characters.mjs, assets/characters/*.glb (yeniden üretim), tests/pvp-stages3d33.test.mjs (yeni),
tests/pvp-render33.test.mjs (yeni), mevcut arena3d/fighters3d testleri (yalnız yeni davranışa göre güncelleme), pvp/index.js'te YALNIZ
`setStage` ile ilgili satırlar (aşağıda adım 5).

## Adımlar

### 1. Netlik — ölç ve raporla (kod yazmadan önce)
`pvp/arena3d.js` ve `pvp/arena3d-bloom.js`, `pvp/perf-governor.js` (yalnız oku) içinde şunları bul ve rapora "ÖNCE" değerleri olarak yaz:
renderer pixelRatio hesabı (high/low/auto), bloom render target boyutu (tam/yarım), antialias/MSAA ayarı, parçacık (Points) doku boyutu ve
`size` hesabı, mermi/iz geometri segment sayıları, `scripts/optimize-characters.mjs` doku hedef boyutu (256?).

### 2. Netlik — düzelt
a) Yüksek kalite (`high`): `pixelRatio = Math.min(devicePixelRatio, 2)`; düşük kalite (`low`): 1; `auto` yalnız FPS düşünce low'a iner (mevcut mantık korunur).
b) Bloom/post-process kullanılıyorsa sahne render target'ı TAM çözünürlük × pixelRatio ve `samples: 4` (WebGL2 MSAA). Bloom'un kendi
   mip zincirinde başlangıç çözünürlüğü en az ekranın yarısı. Bloom yoksa `WebGLRenderer({antialias:true})` olduğundan emin ol.
c) Parçacık sprite dokusu (canvas ile üretilen yumuşak daire) en az 128×128; mermi çekirdeği (core) keskin + dış hale (additive), çekirdek
   için ayrı küçük, yüksek opaklıklı sprite ya da mesh. İz (trail) segment sayısı ≥ 24.
d) `scripts/optimize-characters.mjs`: doku hedefini 512 px yap; `node scripts/optimize-characters.mjs` ile `assets/characters/*.glb`'yi
   yeniden üret. Her GLB ≤ 1 200 000 bayt olmalı (değilse 384 px dene). Paletle tonlama korunur.
e) Kabul: tests/pvp-render33.test.mjs — sahte renderer ile high'da pixelRatio=min(dpr,2), low'da 1; bloom hedefi tam çözünürlük ve samples 4
   (ya da antialias true); GLB boyutları ≤ 1.2 MB ve doku boyutu 512 (GLB içindeki PNG başlığından oku).

### 3. Sahneler — YENİ pvp/stages3d.js
`export function buildStage(THREE, {id, quality, parent}) → {group, update(dt,t), applyQuality(level), dispose()}`.
- `colosseum`: mevcut `buildEnvironment`/`buildColosseum` içeriğini BURAYA TAŞIMA; arena3d.js'teki mevcut kolezyum kurulumu colosseum için
  aynen kullanılmaya devam etsin (buildStage('colosseum') arena3d'nin mevcut ortamını döndüren ince bir sarmalayıcı olabilir).
- `skyforge` (Gök Demirhanesi): sıcak turuncu-kızıl gökyüzü (gradyan ShaderMaterial küre), yüzen ada zemini (silindir + kaya halkası),
  arka planda 3 yüzen kaya (InstancedMesh), lav akan iki kanal (emissive düzlem, UV kaydırmalı ShaderMaterial), yükselen kıvılcımlar
  (Points ≤ 300, low'da 120).
- `runegarden` (Rün Bahçesi): gece mor-camgöbeği gökyüzü, çimen-taş zemin, arena çevresinde 8 parlayan rün taşı (InstancedMesh, emissive nabız),
  4 ağaç silueti (basit koni+silindir, koyu), ateş böcekleri (Points ≤ 200, sinüs gezinme).
- `harbor` (Fırtına Limanı): koyu mavi gece, ahşap iskele zemini (tahta şeritli doku canvas'tan), arkada deniz düzlemi (dalga vertex shader),
  2 fener direği (PointLight yalnız high), yağmur (LineSegments ≤ 600, low'da 250), rastgele 6–12 sn'de bir şimşek (sahne flaşı 120 ms).
- Her sahne: kendi `scene.fog` rengi/yoğunluğu ve ortam ışığı; çizim çağrısı artışı ≤ 12; tüm geometri/malzeme/doku `dispose()`'da serbest.
- Dövüşçü zemin konumu (y=0) ve koltuk yerleşimi DEĞİŞMEZ.

### 4. arena3d.js entegrasyonu
- `arena.setStage(id)`: `normalizeStage(id)` (pvp/shared/stages.js'ten import); aynı id ise hiçbir şey yapma; değilse eski sahneyi dispose,
  yenisini kur, kalite seviyesini uygula. `api.stage()` güncel id'yi döndürür. clear() sahneyi değiştirmez; destroy() dispose eder.
- `tick()` içinde aktif sahnenin `update(dt,t)`'si çağrılır (slowMo'ya uyar: dt * api.timeScale()).
- reduced modda yağmur/kıvılcım/şimşek kapalı.

### 5. pvp/index.js (yalnız şu satırlar)
Maç durumu her güncellendiğinde (`tuslab:pvp-match` dinleyicisi; `fighterOfSeat` güncellendiği yerin yanında) `arena3d.instance?.setStage?.(network.match?.stage)`.
Ayrıca URL debug parametresi: yalnız localhost'ta `?stage=<id>` varsa onu kullan (fighter1/fighter2 parametresinin kalıbını izle).

### 6. Tam ekran tuval ve telefon düzeni
- Tuval zaten `.pvp2-duel` kutusunu kaplıyor; Şerit B maç sırasında `#pvp-root[data-layout="fullscreen"]` ile `.pvp2-duel`'i tüm görünür alana yayacak.
  Senin işin: `layout()` dövüşçüleri `.pvp2-side[data-seat] .pvp2-stage` kutularına göre yerleştirmeye devam etsin; kutular büyüyünce
  dövüşçüler orantılı büyüsün (mevcut davranış — doğrula).
- Telefon/alt alta düzen: iki `.pvp2-stage` kutusu yatayda ÇAKIŞMIYORSA DEĞİL, DİKEYDE alt alta ise (stage2.top ≥ stage1.bottom − 4),
  koltuk hedeflerini gerçek kutular yerine `.pvp2-duel` içinde yan yana iki SANAL kutu (sol yarı / sağ yarı, yükseklik = iki kutunun
  ortalaması, duel'in dikey ortasında) olarak hesapla. Böylece iki dövüşçü aynı sahnede yan yana görünür.
- Kabul: tests/pvp-stages3d33.test.mjs içinde sahte DOM ile alt alta kutularda iki koltuğun projeksiyonunun duel içinde ve yan yana olduğu.

### 7. Testler
tests/pvp-stages3d33.test.mjs: her sahne kurulur, update çağrılır, dispose sonrası sahnede ek nesne kalmaz; setStage aynı id'de no-op;
geçersiz id → colosseum; reduced'ta yağmur/kıvılcım yok; alt alta düzen. Tüm testler + cf:validate geçmeli.

## Kabul ölçütleri (raporda tek tek)
A1 high pixelRatio=min(dpr,2) · A2 MSAA/antialias açık · A3 GLB'ler 512 px doku, her biri ≤ 1.2 MB · A4 4 sahne kuruluyor ve dispose temiz ·
A5 setStage + index.js bağlantısı · A6 alt alta düzende dövüşçüler yan yana · A7 tüm testler + cf:validate.
