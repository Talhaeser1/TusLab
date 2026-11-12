# K şeridi — Raund sonu eşzamanı + kamera + kasma (KESINYAP iş 12 ve iş 1'in açıkları)

ÖNCE OKU: `docs/codex/00-ORTAK.md` (ortak kurallar, rapor biçimi), `KESINYAP.md` (kural 2, iş 1, iş 12),
`docs/HASAR-KURALLARI.md`, `docs/EKRAN-KONTROL-KURALLARI.md`. Sonra `git log --oneline -5`, `git show HEAD --stat`, `git diff --stat`.
Ağaçta BAŞKA işçinin yarım değişiklikleri var (pvp/network.js, pvp/lobby-v3.css, tests/pvp-lobi-j2.test.mjs) — onlara DOKUNMA.

## Kullanıcı şikâyeti
Rounds modu, kelime raundu: "raund bitti ama benim karakter saldırı attı; o optimizasyonlara da iyi bak." Görüntüde
'RAUND 3 BİTTİ' kartı + ortada 'RAUND 4 · 2' geri sayımı AÇIKKEN hâlâ '-113 KIVILCIM 1/3' vuruşu oynuyor; kamera oyuncunun
karakterine (Doran) yakın çekimde takılı, karakter ekranı dolduruyor, rakip kadraj DIŞINDA.

## Kök neden adayı (DOĞRULA, raporda kanıtla)
`pvp/shared/match.js` raund sonu çözümüne sabit bütçe veriyor (RESOLVE_BUDGET_MS=6000, ROUND_SETTLE_MS, ROUND_SUMMARY_MS,
ROUND_INTRO_MS; `resolveStepMs` satır ~115-120, `nextRoundAt` ~761, settling ~830). Son animasyon turunda sahneler yavaşlatıldı
(yaklaşma başına ~3,5–4,5 sn, saldıran değişiminde 1,2 sn ara) → bekleyen vuruşlar bütçeye sığmıyor, raund arası kartı + geri sayım
sahneler oynarken açılıyor; yeni raund başlayınca kalan vuruşlar sahnesiz bitiyor (önceki ölçümde bir koşuda 11 adet).

## İSTENEN
A) SIRA: raund biter → yazma kilitlenir, ekranda sade 'RAUND BİTTİ · vuruşlar oynuyor' durumu → bekleyen TÜM vuruş sahneleri
sırayla, animasyonlu (kural 2: tek saldıran, yerine dönüş, ara) → son sahne bitip iki dövüşçü yerinde idle → raund arası kartı →
kart süresi (ROUND_SUMMARY_MS) → 'RAUND n' geri sayımı (ROUND_INTRO_MS) → yeni raund. Kart/geri sayım açıkken HİÇBİR vuruş/hasar
yazısı oynamaz; yeni raund başında önceki raundun sahnesi kalmaz; sahnesiz (animasyonsuz) hasar 0.

B) NASIL: çözüm süresini bekleyen vuruşlara göre ÖLÇEKLE. Motor deterministik kalır (sunucu = istemci): çözüm fazı süresi bekleyen
saldırıların sayısı/türü ve saldıran değişimi sayısından SAF bir fonksiyonla hesaplanır (ör. `resolveDurationMs(attacks)`, pvp/shared
içinde) ve `pvp/visual-timeline.js` AYNI fonksiyonu/sabitleri kullanır (ayrışma imkânsız olsun). Üst sınır ≤ 20 sn: aşılacaksa aynı
saldıranın vuruşlarını tek yaklaşmada zincirle (vuruş/yaklaşma sınırı 3, gerekirse 4–5), en son çare kalanları oyuncu başına TEK
'toplu vuruş' sahnesinde topla (hasar toplamı tek temas karesinde, animasyonlu). İstemci güvenlik olarak kartı
`visualQueue.whenIdle()` ile de bekletsin (motor süresi dolsa da sahne bitmeden kart açılmaz; en çok +3 sn). Aynı mantığı classic
pencere sonu ve arena raund sonu için doğrula; arena kurallarına (pvp/shared/arena*.js, ARENA_RESOLVE_BUDGET_MS) gerekirse aynı
ölçekleme. Hasar/can/kelime planı/tavan 1300 DEĞİŞMEZ — yalnız zamanlama.

C) VURUŞLAR RAUND İÇİNDE DE AKSIN: kuyruk boşaldıkça raund sürerken sahneler oynasın, hepsi sona yığılmasın. Mevcut davranışı
ölç ve raporla (bir raundda kaç vuruş raund içinde, kaçı raund sonunda oynuyor). Kelime raundu çok kısa sürebilir → raund sonu
çözümü asıl gösteri, akıcı ve net.

D) KAMERA: raund sonunda, kartta, geri sayımda, yeni raund başında kamera iki dövüşçüyü kadrajda gösteren GENEL plana döner;
yakın çekim/ulti kamerası sahne bitince VE sahne iptal olursa ≤ 600 ms yumuşak geçişle genel plana döner, asla takılmaz. Kök nedeni
bul (hangi durumda kamera hedefi sıfırlanmıyor; pvp/arena3d.js / fighters3d.js). Ölç: kart açıkken iki modelin ekran kutusu
(projeksiyon) tamamen görünür alanda, hiçbir model ekran yüksekliğinin %70'inden büyük değil.

E) HASAR SAYISI ERKEN ÇIKMASIN: konyali menzilli Q ve arena KOMBO/FİNAL ek hasarında sayı temastan 300–600 ms önce çıkıyor
(kanıt `.playwright-mcp/anim3-sonra-*.json` early[]). Hedef: hasar sayısı/can düşüşü temas karesiyle ≤ 100 ms.

F) KASMA/OPTİMİZASYON (kullanıcı özellikle istedi): maç içinde 250 ms üstü kare donması hâlâ 8–12. Ölçülen nedenler: dövüş
ortasında 2 gölgelendirici derlemesi (biri 1,8 sn), pvp/practice.js bot tiki 85–450 ms, ses decode. Gider:
- tüm malzeme/efekt/ışık kombinasyonlarını maç başında (VS/geri sayımda) derle (renderer.compileAsync; gölge + bloom + her efekt
  varyantı). Işık SAYISI maç boyunca sabit (efekt ışıklarını baştan ekle, şiddet 0) → yeniden derleme yok.
- bot tikini hafiflet: neden 85–450 ms bul (structuredClone ile tüm maç kopyası, kelime havuzunu yeniden üretme vb.); parçala ya da
  önbellekle — bot davranışı/kuralı DEĞİŞMEZ.
- tüm sesleri maç başında decode et (AudioBuffer önbelleği, pvp/sound.js).
- DOM: her karede layout okuyan/yazan HUD kodu, büyük box-shadow/filter animasyonları, yağmur/parçacık sayısı — ölç, pahalıyı azalt.
- perf-governor ilk 2 sn'de ölçüp kademeyi düşürsün.
Hedef: maç içinde 250 ms üstü donma 0–1; medyan kare ≤ 20 ms. Önce/sonra tablo.

## İZİNLİ DOSYALAR
pvp/shared/match.js (YALNIZ çözüm/raund-sonu zamanlaması), pvp/shared/arena.js (yalnız aynı zamanlama), cloudflare/src/match.js,
pvp/visual-timeline.js, pvp/arena3d.js, pvp/fighters3d.js, pvp/index.js, pvp/rounds-ui.js (yalnız kart açılma zamanı ve 'vuruşlar
oynuyor' durumu), pvp/arena-ui.js (aynı), pvp/practice.js (yalnız performans), pvp/sound.js (yalnız ön decode), pvp/perf-governor.js,
pvp/performance.js, pvp/fx-*.js, pvp/fight-hud.js, ilgili testler (tests/*), .playwright-mcp/ altındaki prob betikleri,
KESINYAP.md (yalnız iş 1 ve iş 12 satırları), İLERLEME.md (karar notu ekle).
YASAK: index.html, devamindex.html, package.json, pvp/network.js, pvp/lobby-v3.css, pvp/phase15-results.*, pvp/cinematic.*,
pvp/rounds-ui.css. Commit/push YOK, dal değiştirme YOK, git checkout/reset/stash YOK. Test silme/atlama YOK (zamanlama sabitlerini
sınayan testleri gerekçeyle güncelle — gerekçeyi test içinde yorum olarak yaz).

## DOĞRULAMA
- `node --test tests/*.test.mjs` — kendi alanın tamamen geçmeli (pvp-lobi-j2 başka işçinin; düşerse raporla). `npm run cf:validate`.
- Yeni test: tests/pvp-raund-sonu.test.mjs — resolveDurationMs saf/deterministik, ≤ 20 sn sınırı, zincirleme/toplu vuruş,
  sunucu (cloudflare/src/match.js) ile istemci aynı sonuç, nextRoundAt = çözüm sonu + SUMMARY + INTRO, hasar toplamı değişmedi.
- Tarayıcı: sunucu http://127.0.0.1:5176 AÇIK (başlatma). `.playwright-mcp/run-gpu.mjs` + anim3-probe.js, kasma-probe.js,
  raund-sistemi-probe.js, kelime-raundu-probe.js (gerekirse yeni prob ekle: kart/geri sayım görünürken oynayan sahne ve hasar
  yazısı sayacı, sahnesiz hasar sayacı, kart açıkken iki modelin projeksiyon kutusu). AYNI ANDA TEK tarayıcı, bitince kapat.
  Rounds (kelime raundu + zamana karşı), classic, arena'da ölç. Önce (değişiklikten önce) ölç ki önce/sonra tablo olsun.

## KABUL
1. Kart/geri sayım görünürken oynayan vuruş sahnesi ve hasar yazısı 0.
2. Sahnesiz hasar 0 (5 tam maç).
3. Kart açıkken iki dövüşçü kadrajda (projeksiyon kutuları tam görünür, ≤ %70 yükseklik).
4. Hasar–temas farkı ≤ 100 ms.
5. Maç içi 250 ms üstü donma ≤ 1; medyan kare ≤ 20 ms.
6. Sunucu–istemci aynı sonuç testi geçer; sayfa hatası 0.
KESINYAP.md iş 12 ve iş 1 satırlarını kanıtla güncelle (yalnız gerçekten ölçülen için ✅). İLERLEME.md'ye karar notu.

## RAPOR
00-ORTAK.md başlıklarıyla, Türkçe; ayrıca: kök neden (raund sonu + kamera + her donma nedeni), C maddesi ölçümü (raund içi/raund
sonu vuruş sayısı), önce/sonra tablo (donma sayısı, medyan kare, sahnesiz hasar, kart açıkken sahne, hasar–temas farkı), değişen
dosyalar listesi. Raporu ayrıca `.playwright-mcp/K-RAPOR.md` dosyasına yaz.
