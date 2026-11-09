# TuşLab Neon Arena — Efekt Kaynakları ve Uygulama Planı

> Araştırma tarihi: 2026-11-07. Bu belge yalnızca araştırma çıktısıdır: hiçbir dosya indirilmedi, proje kodu değiştirilmedi.
> İşaretler: **[D]** = bu araştırmada kaynağından doğrulandı · **[?]** = doğrulanamadı / tahmin.

## 0. Mevcut durum (kısa)

`pvp/arena3d.js` + `pvp/arena3d-fx.js` zaten şunları içeriyor: tek `THREE.Points` + özel `ShaderMaterial` GPU parçacıkları (additive, `depthWrite:false`), comet/crystal mermiler (bezier uçuş), shockwave halkaları, kalkan hex/flare/shatter, shard parçaları, meteor, sütun (pillar), emitter'lar, nokta ışık flaşı, kamera shake ve tam ekran flash quad'ı. Kalite kademeleri `FX3D_CAPS.high/low` + `auto` (kare süresine göre). Renderer: `ACESFilmicToneMapping`, exposure 1.05, `SRGBColorSpace`, doğrudan `renderer.render(scene, camera)` (post-processing **yok**).

Yani en büyük boşluk **post-processing** (bloom, isabet anında chromatic aberration, vignette) ve **şekil tabanlı efektler** (trail ribbon, ışın/tether, şimşek, dissolve). Bunların hepsi additive parçacık sistemimizin üstüne bindirilebilir.

---

## 1. Öncelikli tablo

Efor: S = < 0,5 gün · M = 1–2 gün · L = 3+ gün. Kazanç: ★ (az) – ★★★★★ (çok).

| # | Efekt | Teknik | Kaynak | Lisans | Efor | Görsel kazanç |
|---|---|---|---|---|---|---|
| 1 | **Neon bloom (parlama)** | `EffectComposer` + `RenderPass` + `UnrealBloomPass` + `OutputPass` | https://threejs.org/examples/#webgl_postprocessing_unreal_bloom · kod: `three@0.160.1/examples/jsm/postprocessing/UnrealBloomPass.js` | MIT (three.js) [D] | S–M | ★★★★★ (neon temanın tamamı buna dayanıyor) |
| 2 | **İsabette chromatic aberration (RGB kayması)** | `ShaderPass(RGBShiftShader)`; `amount` uniform'u isabet anında 0→0.004→0'a ~150 ms'de sön | `examples/jsm/shaders/RGBShiftShader.js` | MIT [D] | S | ★★★★ (vuruş “acıtır”) |
| 3 | **Vignette + düşük HP kırmızı vinyet** | `ShaderPass(VignetteShader)` (`offset`, `darkness`); düşük HP'de ayrıca CSS overlay de yeter | `examples/jsm/shaders/VignetteShader.js` | MIT [D] | S | ★★★ |
| 4 | **Seçici bloom** (sadece mermi/halka/rün parlasın, karakter sanatı okunur kalsın) | `layers` + iki composer + karartma materyali + mix `ShaderPass` | https://threejs.org/examples/#webgl_postprocessing_unreal_bloom_selective (r160 kaynağında `BLOOM_SCENE`, `darkMaterial`, `mixPass` doğrulandı) | MIT [D] | M | ★★★★ (1'in kalite yükseltmesi) — basit alternatif: eşik (`threshold`) ~0.8 + karakter emissive'ini eşik altında tutmak |
| 5 | **Mermi ribbon trail (kuyruk)** | Kendi “trail” şeridimiz: son N konumu halka tampona yaz, `BufferGeometry` üçgen şeridi, kamera‑yüzlü genişlik, uca doğru alfa/genişlik azalması, additive. Alternatif: `Line2`/`LineMaterial` (fat lines) | Fat lines: https://threejs.org/examples/#webgl_lines_fat (`examples/jsm/lines/*`) · MeshLine: https://github.com/pmndrs/meshline | three: MIT [D] · meshline: MIT [D] (bare `'three'` import kullanıyor gibi görünüyor [?]) | M | ★★★★ (comet mermiler çok daha “hızlı” görünür) |
| 6 | **Ultimate çekme ışını / tether** | Hedefe uzanan silindir/düzlem şerit; fragment shader'da kaydırılan (scroll) gürültü + `sin` dalga, kenarda Fresnel benzeri yumuşak alfa, çekirdek beyaz + dış renk; uçlarda parçacık emitter | Teknik: shader ile UV scroll + gürültü (kendi yazımımız; `examples/jsm/math/SimplexNoise.js` CPU tarafı gerekirse) | Kendi kodumuz / MIT | M | ★★★★★ (ultimate'in imza anı) |
| 7 | **Şimşek (lightning bolt)** | Orta nokta yer değiştirme (midpoint displacement) ile CPU'da 2D/3D kırık çizgi → ribbon (5. maddedeki şerit) + bloom; 2–3 karede yeniden üret, dallanma %20 | three'nin `LightningStrike.js` dosyası **r160 paketinde YOK** [D] (r150.0'da `examples/jsm/geometries/LightningStrike.js` var, r155'te kaldırılmış [D]); r150 dosyası `SimplexNoise.js`'e bağlı [D] | MIT | M | ★★★★ (karşı saldırı/parry için ideal) |
| 8 | **KO dissolve (karakter erimesi)** | Karakter materyaline `onBeforeCompile` ile gürültü eşiği: `if(noise < uProgress) discard;` + eşiğe yakın bantta emissive kenar (neon renk); eriyen bölgeden parçacık spawn | Teknik yaygın (dissolve shader); gürültü: 2D noise texture veya shader içi value noise | Kendi kodumuz | M | ★★★★ |
| 9 | **Flipbook patlama sprite'ları** | Sprite sheet (ör. 8×8) + `ShaderMaterial`'da `floor(t*frames)` ile UV ofseti; Points sisteminde parçacık başına kare indeksi attribute'u | Doku: Kenney Smoke Particles / Particle Pack (aşağıda) · örnek: https://threejs.org/examples/#webgl_points_sprites | CC0 [D] / MIT | M | ★★★ (meteor/büyük patlamaya hacim katar) |
| 10 | **Soft particles** | Parçacık fragment'inde sahne derinliği ile farkı al: `alpha *= smoothstep(0, fade, sceneDepth - particleDepth)`; `DepthTexture`'lı render target gerekir (composer ile birlikte gelir) | Teknik (soft particles, depth fade) | — | M | ★★ (zemine değen halkalardaki sert kesik kalkar; bizde zaten çoğu efekt havada) |
| 11 | **Shockwave ekran bozulması (radial distortion)** | Ekran uzayı `ShaderPass`: merkezden halka şeklinde UV ofseti `uv += dir * amp * exp(-pow((d-r)/w,2))`, `r` zamanla büyür; mevcut 3D halkalara eşlik eder | Kendi `ShaderPass` shader'ımız (≈30 satır GLSL) | Kendi kodumuz | S–M | ★★★★ (ultimate / KO anı) |
| 12 | **Film grain / tarama çizgisi** | `FilmPass` (`intensity`, `grayscale`) — çok düşük yoğunlukta | `examples/jsm/postprocessing/FilmPass.js` + `shaders/FilmShader.js` | MIT [D] | S | ★★ (stil; mobilde kapalı) |
| 13 | **Glitch (bağlantı kopması/round geçişi)** | `GlitchPass` (sadece kısa anlarda `goWild=false`) | `examples/jsm/postprocessing/GlitchPass.js` + `shaders/DigitalGlitch.js` | MIT [D] | S | ★★ (dikkatli; epilepsi riski → reduced-motion'da kapalı) |
| 14 | **Hareket izi (afterimage) — ultimate slow-mo** | `AfterimagePass` (`damp` 0.85–0.92) yalnızca ultimate fazında açık | `examples/jsm/postprocessing/AfterimagePass.js` + `shaders/AfterimageShader.js` | MIT [D] | S | ★★★ |
| 15 | **Ucuz kalabalık (tribün)** | `InstancedMesh` ile billboard silüet kartları (tek doku atlası), vertex shader'da instance ID'ye göre zıplama `sin(time*f + id)`; combo/KO'da genlik artır | https://threejs.org/examples/#webgl_instancing_dynamic | MIT [D] | M | ★★★ |
| 16 | **Arka plan / gökyüzü** | Poly Haven gece/neon HDRI → yalnızca `scene.background` veya düşük çözünürlüklü `environment` (1K). Daha ucuz: tek gradyan + yıldız Points (zaten neon tema) | https://polyhaven.com/hdris | CC0 [D] | S | ★★ (dosya boyutu maliyeti var) |

---

## 2. İlk 5 (kodumuza göre uyarlanmış)

1. **Post-processing iskeleti + Bloom (madde 1)** — `arena3d.js` içinde `renderer.render(scene, camera)` (satır ~1630) yerine `composer.render(dt)`. Zincir: `RenderPass → UnrealBloomPass(res/2, strength 0.9, radius 0.4, threshold 0.75) → [RGBShift] → [Vignette] → OutputPass`. **Önemli:** composer kullanılınca ACES tone mapping + sRGB dönüşümü `OutputPass`'te yapılır (r153+ davranışı; `OutputShader.js` `tonemapping_pars_fragment` ve `colorspace_pars_fragment` içeriyor [D]). Renderer ayarları kalabilir, `OutputPass` bunları okur. `low` kalitede composer'ı tamamen atla (doğrudan `renderer.render`), `high`'da bloom çözünürlüğü yarım. Resize'da `composer.setSize` + `bloomPass.resolution`, `setPixelRatio` ile birlikte `composer.setPixelRatio`.
   - Not: tam ekran flash quad'ı ve additive parçacıklar artık otomatik parlayacak → flash yoğunluklarını ~%30 düşürmek gerekebilir.
2. **İsabette RGB shift + mikro zoom (madde 2)** — `impact()` / `bigExplosion()` içinden `api.aberration(amount, ms)` gibi bir kanca; mevcut `shakes`/`flashes` dizileriyle aynı zarf (envelope) mantığı. Counter/parry'de açıyı vuruş yönüne göre ayarla (`angle` uniform'u). `reducedFlash`/reduced-motion'da devre dışı.
3. **Comet mermiler için ribbon trail (madde 5)** — `updateProjectiles()` her karede konumu yazar; mermi başına 16–24 noktalık halka tampon, havuzlu (`acquireProjectile` ile aynı havuz deseni). Tek `ShaderMaterial` (additive, `depthWrite:false`), palete göre renk. `low`'da 8 nokta.
4. **Ultimate tether ışını + ekran shockwave (madde 6 + 11)** — `onUltimatePhase(ev)` fazlarına bağla: “çekme” fazında iki koltuk arası ışın şeridi (scroll gürültü), vuruş anında ekran uzayı radyal bozulma pass'i + mevcut 3D halka. Bu ikisi ultimate'i diğer saldırılardan ayıran en net imza olur.
5. **KO dissolve + şimşekli parry (madde 8 + 7)** — `onKnockout(ev)`: kaybeden karaktere 0.9 s dissolve + kenar parçacıkları; `parryBurst(seat)`: midpoint‑displacement şimşek (aynı ribbon kodunu yeniden kullanır). İkisi de 3. maddedeki şerit altyapısını paylaşır.

Sıra mantığı: 1 tüm diğerlerini güzelleştirir; 2 en ucuz “his” kazancı; 3'teki şerit kodu 4 ve 5'te yeniden kullanılır.

---

## 3. Post-processing dosyalarını vendor'lama planı (bundler yok, CSP `script-src 'self'`)

### 3.1 Gereken dosyalar (`three@0.160.1` npm paketi içi yollar) [D]

Hepsi https://unpkg.com/three@0.160.1/ veya https://cdn.jsdelivr.net/npm/three@0.160.1/ altında; aynı sürüm (r160) olmalı — vendor'daki `three.module.min.js` ile **birebir aynı sürüm** şart.

| Dosya | Import'ları | Gerekli mi |
|---|---|---|
| `examples/jsm/postprocessing/EffectComposer.js` | `'three'`, `../shaders/CopyShader.js`, `./ShaderPass.js`, `./MaskPass.js` | Evet |
| `examples/jsm/postprocessing/Pass.js` | `'three'` (`Pass`, `FullScreenQuad` export eder) | Evet |
| `examples/jsm/postprocessing/RenderPass.js` | `'three'`, `./Pass.js` | Evet |
| `examples/jsm/postprocessing/ShaderPass.js` | `'three'`, `./Pass.js` | Evet |
| `examples/jsm/postprocessing/MaskPass.js` | `./Pass.js` (three import yok) | Evet (EffectComposer statik import ediyor) |
| `examples/jsm/postprocessing/UnrealBloomPass.js` | `'three'`, `./Pass.js`, `../shaders/CopyShader.js`, `../shaders/LuminosityHighPassShader.js` | Evet |
| `examples/jsm/postprocessing/OutputPass.js` | `'three'`, `./Pass.js`, `../shaders/OutputShader.js` | Evet (tone mapping + sRGB) |
| `examples/jsm/shaders/CopyShader.js` | yok | Evet |
| `examples/jsm/shaders/LuminosityHighPassShader.js` | `'three'` | Evet |
| `examples/jsm/shaders/OutputShader.js` | yok (shader chunk `#include` kullanır) | Evet |
| `examples/jsm/shaders/RGBShiftShader.js` | yok | Madde 2 için |
| `examples/jsm/shaders/VignetteShader.js` | yok | Madde 3 için |
| `examples/jsm/postprocessing/FilmPass.js` + `shaders/FilmShader.js` | `'three'`, `./Pass.js`, `../shaders/FilmShader.js` | İsteğe bağlı |
| `examples/jsm/postprocessing/AfterimagePass.js` + `shaders/AfterimageShader.js` | `'three'`, `./Pass.js`, `../shaders/AfterimageShader.js` | İsteğe bağlı |
| `examples/jsm/postprocessing/GlitchPass.js` + `shaders/DigitalGlitch.js` | `'three'`, `./Pass.js`, `../shaders/DigitalGlitch.js` | İsteğe bağlı |
| `examples/jsm/lines/LineSegmentsGeometry.js`, `LineGeometry.js`, `LineMaterial.js`, `LineSegments2.js`, `Line2.js` | `'three'` + birbirleri | Sadece fat‑line trail seçilirse |

Çekirdek set: **11 dosya** (EffectComposer, Pass, RenderPass, ShaderPass, MaskPass, UnrealBloomPass, OutputPass, CopyShader, LuminosityHighPassShader, OutputShader + RGBShift/Vignette). Toplam boyut küçük (birkaç on KB, minify edilmemiş) [? tam bayt sayısı ölçülmedi].

### 3.2 Bare `'three'` import sorunu ve import map

- Dosyaların çoğu `import { ... } from 'three';` kullanıyor [D]. Bundler olmadan tarayıcı bunu çözemez.
- **Import map seçeneği uygun değil:**
  - `<script type="importmap">` **satır içi (inline)** olmak zorunda; harici `src` desteklenmiyor (DataTables'ın 2023 deneme yazısı: “there currently isn't support for external JSON” — https://datatables.net/blog/2023/importmap). Tarayıcı desteği: Chrome/Edge 89, Firefox 108, Safari 16.4 (https://web.dev/blog/import-maps-in-all-modern-browsers) [D].
  - Inline import map, CSP'de inline script gibi değerlendirilir; `script-src 'self'` bunu **engeller** (hash/nonce eklemeden). JS ile DOM'a inline importmap enjekte etmek de aynı CSP kontrolüne takılır. [CSP'nin importmap'e uygulanması tarayıcı davranışı olarak yaygın bilgi; bu oturumda spesifikasyondan ayrıca doğrulanmadı → **[?]**]
  - Alternatif: CSP'ye importmap'in `sha256-...` hash'ini eklemek mümkün ama `_headers` (iki kopya: `./_headers` ve `cloudflare/public/_headers`) ile senkron tutmak kırılgan.
- **Öneri: import belirtecini yeniden yaz (path rewrite).** Dizin yapısını koru ki göreli `../shaders/...` import'ları çalışsın:

```
pvp/vendor/three.module.min.js            (mevcut)
pvp/vendor/jsm/postprocessing/*.js
pvp/vendor/jsm/shaders/*.js
pvp/vendor/jsm/lines/*.js                 (isteğe bağlı)
pvp/vendor/THREE-LICENSE.txt              (mevcut, MIT — jsm dosyaları da aynı lisans)
```

Her dosyada yalnızca şu değişiklik:
`from 'three'` → `from '../../three.module.min.js'`

Böylece `pvp/vendor/jsm/postprocessing/X.js` içinden çözülen URL `/pvp/vendor/three.module.min.js` olur, yani `arena3d.js`'nin `import('./vendor/three.module.min.js')` ile yüklediği **aynı modül örneği** (tek THREE instance → `instanceof` kontrolleri ve `ShaderChunk` paylaşımı bozulmaz). Farklı bir URL'den (ör. `three.module.js` vs `.min.js`) yüklemek iki ayrı THREE kopyası yaratır — kaçınılmalı.

Yükleme: mevcut dinamik import desenine uygun olarak, post-processing'i ayrı ve isteğe bağlı yükle:
```js
const [{EffectComposer}, {RenderPass}, {UnrealBloomPass}, {ShaderPass}, {OutputPass}] = await Promise.all([
  import('./vendor/jsm/postprocessing/EffectComposer.js'), ...
]);
```
Hata olursa (eski cihaz/WebGL1) composer'sız çalışmaya devam et. Yeniden yazmayı bir kez elle (veya küçük bir sed/py betiğiyle) yap; dosya başına bir yorum satırı ekle: `// vendored from three@0.160.1 examples/jsm, 'three' specifier rewritten`.

CSP açısından: shader'lar `eval`/`new Function` kullanmaz; `script-src 'self'` yeterli. Same-origin modül dosyaları olduğundan ek CSP değişikliği gerekmez.

### 3.3 Şimşek için not
`LightningStrike.js` r160'ta yok [D]. r150.0 sürümündeki dosya (`examples/jsm/geometries/LightningStrike.js` + `examples/jsm/math/SimplexNoise.js`) MIT'tir ama r160 ile uyumluluğu test edilmedi **[?]**. Daha hafif ve kontrol edilebilir yol: kendi midpoint‑displacement üreticimiz (~40 satır) + ribbon şeridi.

---

## 4. Ücretsiz varlık paketleri (sadece liste — indirilmedi)

| Paket | URL | Lisans | Boyut/İçerik | Ne için |
|---|---|---|---|---|
| Kenney — Particle Pack | https://kenney.nl/assets/particle-pack | CC0 [D] | 80 dosya, 512×512 dokular (2018, v1.0) [D]; zip boyutu sayfada yok [?] | Kıvılcım, yıldız, büyü halkası, iz (trace) dokuları → Points sprite'ları, halka dokusu, trail ucu |
| Kenney — Smoke Particles | https://kenney.nl/assets/smoke-particles | CC0 [D] | 70 dosya (2014) [D] | Patlama/duman flipbook'u, meteor çarpma tozu |
| Kenney — Impact Sounds | https://kenney.nl/assets/impact-sounds | CC0 [D] | 130 dosya [D]; format sayfada belirtilmemiş (Kenney ses paketleri genelde .ogg) [?] | Vuruş, blok, kalkan çarpma |
| Kenney — Sci-Fi Sounds | https://kenney.nl/assets/sci-fi-sounds | CC0 [D] | 70 dosya (2020) [D] | Lazer/ışın, ultimate şarj, mermi fırlatma |
| Poly Haven — HDRI'ler | https://polyhaven.com/hdris | CC0 [D] — ticari kullanım serbest, atıf gerekmez (logo/metin gibi site içeriği hariç) | 1K–16K; web için 1K `.hdr` ≈ 1–2 MB [?] | Arka plan / yansıma ortamı (gece şehir, stüdyo). Boyut nedeniyle sadece `high`'da veya hiç |
| Sonniss GDC Game Audio Bundle | https://sonniss.com/gdc-bundle-license/ | Telifsiz, ticari kullanım serbest, atıf gerekmez [D]; **ama** ham sesleri “ses efekti olarak” yeniden dağıtmak yasak, AI eğitimi yasak [D] | Çok büyük (GB'larca) [?] | Kaliteli darbe/whoosh. Web oyununda dosyalar herkese açık sunulduğu için risk düşük ama sıfır değil → mümkünse CC0 Kenney'i tercih et |

---

## 5. Daktilo/dövüş oyunu “his” desenleri (telifli içerik değil, genel desenler)

- **Combo sayacı:** Her doğru tuşta sayı “pop” (ölçek 1.0→1.25→1.0, 80–120 ms), eşiklerde (10/25/50) renk kademesi değişir ve kısa unvan ("GREAT", "FRENZY") belirir. Kombo kırılınca sayaç parçalanıp düşer (shards ile 3D'de de yapılabilir) — kayıp da görünür olmalı.
- **Çarpan (multiplier):** Sabit bir köşede büyük ×2/×3 rozeti; artışta halka dalgası, yaklaşan düşüşte yanıp sönme (uyarı süresi). Çarpana bağlı olarak bloom gücü/parçacık rengi artarsa oyuncu ekrana bakmadan “ısındığını” hisseder.
- **Hit-stop (vuruş donması):** Büyük isabette 40–90 ms tüm animasyonu dondur (kamera shake devam eder). Dövüş oyunlarının vuruş ağırlığının ana kaynağı; bizde `TRAVEL_S` zamanlamasıyla çakışmaması için sadece görsel katmanda uygulanmalı (sunucu zamanı değişmez).
- **Hata geri bildirimi:** Yanlış tuşta küçük kırmızı titreme + kısa düşük frekanslı ses; tekrarlayan hatada cezalandırıcı değil, bilgilendirici kal (vinyet kısaca kızarır).
- **Round başlangıcı:** “3‑2‑1‑FIGHT” sayımı; her sayıda kamera hafif dolly‑in + zemin halkası; FIGHT'ta tam ekran flash + bloom tepe. Girdi FIGHT ile birlikte açılmalı (sayım sırasında yazılanlar yok sayılır, bunu görsel olarak belirt: soluk input alanı).
- **Round sonu / KO:** Slow‑mo (0.3×, ~600 ms) + afterimage + dissolve, ardından “K.O.” veya “ROUND 2” kartı; kazananın tarafı renkle işaretlenir. Final vuruş kameraya hafif yakınlaşma.
- **Ultimate hazır:** Ultimate barı dolunca sürekli nabız (glow pulse) ve karakter etrafında rün/parçacık auras — oyuncu ne zaman kullanabileceğini yan gözle bilmeli.
- **Erişilebilirlik:** Tüm flash/glitch/aberration efektleri mevcut `reducedFlash` / reduced-motion yolundan geçmeli; flash frekansı saniyede 3'ün altında kalmalı.

---

## 6. Lisans ve atıf notları

- **three.js `examples/jsm` dosyaları:** MIT, “Copyright © 2010-2023 three.js authors” [D]. Mevcut `pvp/vendor/THREE-LICENSE.txt` jsm dosyalarını da kapsar; dosya başlarındaki yorumları silme. Eklenen her vendor dosyası için kaynak sürümü (r160 / 0.160.1) not edilmeli.
- **pmndrs/meshline:** MIT [D] — kullanılırsa lisans metnini `pvp/vendor/` altına ekle; bare `'three'` import'u varsa aynı rewrite gerekir [?].
- **Kenney ve Poly Haven:** CC0 — atıf zorunlu değil, ama bir “Credits” satırı (“Kenney.nl”, “Poly Haven”) iyi uygulama.
- **Sonniss:** Atıf gerekmez, ancak lisans koşulları indirme tarihindeki sürüme bağlı; ham dosyaları bağımsız paket olarak sunma. Tercih edilen değil.
- **CC‑BY kaynaklar** (ör. OpenGameArt/Freesound'daki bazı paketler) kullanılacaksa: yazar adı, eser adı, lisans bağlantısı ve yapılan değişiklik oyun içi Credits'te gösterilmeli. Bu araştırmada belirli bir CC‑BY paketi doğrulanmadı.

## 7. Doğrulanamayanlar özeti

- Kenney paketlerinin zip boyutları ve ses formatı (sayfada yok).
- Poly Haven 1K HDRI dosya boyutları (tahmin).
- Inline importmap'in `script-src 'self'` tarafından engellendiği (yaygın davranış; spesifikasyondan bu oturumda okunmadı) — rewrite önerisi bundan bağımsız olarak güvenli.
- r150 `LightningStrike.js`'in r160 ile uyumu.
- meshline'ın dağıtım biçimi (ESM/bare import).
- Vendor çekirdek setinin tam bayt boyutu.

## Kaynaklar

- three.js örnekleri (r160 kaynağında doğrulandı): https://threejs.org/examples/#webgl_postprocessing_unreal_bloom · #webgl_postprocessing_unreal_bloom_selective · #webgl_lines_fat · #webgl_postprocessing_afterimage · #webgl_postprocessing_glitch · #webgl_instancing_dynamic · #webgl_points_sprites
- Paket dosya listesi: https://data.jsdelivr.com/v1/packages/npm/three@0.160.1?structure=flat · https://unpkg.com/three@0.160.1/
- Import map desteği: https://web.dev/blog/import-maps-in-all-modern-browsers · https://datatables.net/blog/2023/importmap
- https://github.com/pmndrs/meshline
- https://kenney.nl/assets/particle-pack · https://kenney.nl/assets/smoke-particles · https://kenney.nl/assets/impact-sounds · https://kenney.nl/assets/sci-fi-sounds
- https://polyhaven.com/license
- https://sonniss.com/gdc-bundle-license/
