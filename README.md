# TuşLab — Neon Arena · PvP İş Paketi 20/20

**Durum: Yayına hazırlık tamamlandı; Cloudflare hesabına dağıtılmadı.** Kaynakların yerel testleri ve statik derleme başarılıdır. Gerçek Workers/Durable Objects çalışma zamanı, internet üzerinden iki ayrı cihaz, üretim maliyeti ve kararlı FPS **henüz doğrulanmış değildir**.

## Mimari

```text
             Oyuncu A (HTTPS)            Oyuncu B (HTTPS)
                     \                       /
             Cloudflare Worker + static assets
                | /, /pvp/*   | /api/*
                |            |\__ /api/pvp/rooms/:id/ws  (WSS)
              Frontend       |        |
                   PvPRoom Durable Objects (lobi, maç, hasar, reconnect)
                   PvPProfiles Durable Object (misafir profil, arkadaşlar, sıralama)
                   PvPGuard Durable Object (API rate limit)
```

**Tek Worker** hem HTML/CSS/JS/görseller/sesleri hem de API/WebSocket uç noktalarını sunar. Ayrı Pages kurmak veya farklı API alan adı/CORS ayarlamak gerekmez. **Production** ve **staging** ayrı Worker adlarıyla kurulur; veri alanları karışmamalıdır. Klasik SQLite-backed Durable Object `migrations` yapılandırması önceki paketlerden korunmuştur. Proje, yeni sıfırdan kurulumlarda Cloudflare'ın `exports` yapılandırma biçimiyle ayrıca güncellenebilir; iki biçimi karıştırarak aynı Worker'a uygulama yapmayın.

## 1. Windows'ta yerel test

Gereksinim: **Node.js 22 LTS** ve npm, çalışan internet, Cloudflare hesabı (gerçek yayın için). ZIP'i `Tümünü Ayıkla` ile çıkarın ve PowerShell'de klasöre geçin:

```powershell
npm install
npm test
npm run cf:validate
npm run cf:dev
```

Son komut yerel Worker başlatır. Brave'de `http://127.0.0.1:8787/` açın. **Kontrol API'si `http://127.0.0.1:8787/api/health`**, `/health` **değildir**. Daha kolay başlatmak için `BASLAT-CLOUDFLARE.bat` da mevcuttur.

## 2. Cloudflare giriş ve staging yayını

1. https://dash.cloudflare.com/ adresinde Cloudflare hesabınıza girin; Workers & Pages kullanımını açın.
2. Proje klasöründe `npx wrangler login` çalıştırıp tarayıcıdan kendi hesabınıza yetki verin. Kimlik bilgilerini veya API tokenını paylaşmayın.
3. `npm run cf:validate` çalıştırın.
4. `npm run cf:deploy:staging` (veya `DEPLOY-STAGING.bat`) çalıştırın.
5. Wrangler'ın **gerçekten döndürdüğü** `https://...workers.dev` adresini kaydedin. Burada örnek veya tahmini URL kullanmayın.
6. Yayın sonrası salt-okunur test:

```powershell
node scripts/smoke-deployment.mjs https://GERCEK-STAGING-ADRESIN
```

Staging üzerinde oda oluşturup iki WebSocket, iki koltuk, hazır olma ve maç başlangıcını kontrol etmek için:

```powershell
node scripts/smoke-deployment.mjs https://GERCEK-STAGING-ADRESIN --rooms
```

İlgili 2 WebSocket test otomatik istemcidir; **gerçek iki insanın farklı ağlardan oynadığı bir test değildir**. Ayrıca iki gerçek Brave/Chrome profilinde, mümkünse iki ayrı bilgisayar ve internet bağlantısında davet → hazır olma → Q/E/R hasarı → kalkan/parry → maç sonucu → rövanş akışını test edin. En az bir oyuncu interneti kesip 20 sn içinde döndüğünde durum korunmalı.

## 3. Production yayını

**Staging testleri başarılı olduktan sonra**:

```powershell
npm run cf:deploy:production
```

Alternatif: `DEPLOY-PRODUCTION.bat`; bu dosya **YAYINLA** onayı ister. İşlemin sonucunda Wrangler'ın döndürdüğü canlı `workers.dev` adresini kullanın ve salt-okunur smoke test yapın. Production üzerinde otomatik oda açma testi ancak açıkça izin verilerek yapılmalıdır. Bu script, isim eşleşmesiyle production hedefini korur ama **gerçek kullanıcı kabul testlerinde otomatik olarak veri temizliği veya rollback yapmaz**.

**Arkadaş daveti:** Canlı site → PvP → Oda Oluştur → Davet Linkini Kopyala → arkadaşına gönder. Her ikiniz **aynı yayın alan adını** açmalısınız. HTTPS sitesinde WebSocket otomatik `wss://` olarak kurulur.

## 4. Özel alan adı (isteğe bağlı)

Cloudflare Dashboard → Workers & Pages → `tuslab-neon-pvp` → Settings → Domains & Routes → Add → Custom Domain. Sahip olduğunuz alan adının Cloudflare zone olarak etkin olması gerekir. Özel alan adı zorunlu değil; `workers.dev` yeterlidir. Alan adı değişirse aynı tarayıcıda eski `localStorage` otomatik taşınmaz.

## 5. Mevcut dosyalar ve komutlar

| Dosya / komut | Amaç |
|---|---|
| `cloudflare/wrangler.jsonc` | Yerel Worker yapılandırması |
| `cloudflare/wrangler.staging.jsonc` | Ayrı staging Worker / Durable Objects |
| `cloudflare/wrangler.production.jsonc` | Canlı Worker / Durable Objects |
| `cloudflare/src/index.js` | HTTPS API, statik dosyalar, same-origin, rate limit |
| `cloudflare/src/room.js` | PvP oda, WebSocket, authoritative maç |
| `cloudflare/src/profiles.js` | Misafir profil ve liderlik kayıtları |
| `cloudflare/src/guard.js` | Merkezi API hız sınırı |
| `scripts/predeploy-check.mjs` | Yayın dosyaları ve binding yapısını denetler |
| `scripts/smoke-deployment.mjs` | Yayın sonrası temel HTTP ve isteğe bağlı oda testi |
| `npm run cf:dry-run` | Yerel Wrangler dry-run (Wrangler indirildiyse) |
| `npm run cf:deploy:staging` | Hesaba staging dağıtımı |
| `npm run cf:deploy:production` | Hesaba production dağıtımı |

## 6. Rollback ve izleme

- Yayından hemen önce Cloudflare Dashboard → Workers & Pages → Worker → Deployments üzerinden önceki stabil sürüm kimliğini kaydedin.
- Bir hata olursa aynı sayfadan eski sürüme **Rollback** yapın veya `npx wrangler rollback` komutunu mevcut Wrangler sürümünüzün yardım çıktısına göre çalıştırın. **Rollback kod sürümünü geri alır; kalıcı SQLite verisini geri almayabilir.** Kalıcı şema/alan adı değişikliklerini geri almak için ayrıca veri planı gerekir.
- Canlı hata takibi: `npx wrangler tail tuslab-neon-pvp` veya Cloudflare dashboard logs.
- Çalışma eşiği: sıra dışı 429/5xx oranı, websocket kopma artışı, oda oluşturma hataları, beklenmeyen maliyet ve kotaya yaklaşım kontrol edilmeli.
- Cloudflare'ın Workers Free ve Durable Objects Free kullanım limitleri vardır. Kota aşılırsa işlemler başarısız olabilir; üretim öncesi panelde **Usage** ve **Billing** ayarlarını gözden geçirin. Uzun PvP WebSocket oturumları önemli olabilir.

## 7. Güvenlik / veri koruma / bilinen sınırlamalar

- Otoriter hasar hesabı sunucuda; müşteriden gelen HP, R damage veya maç sonucu doğrudan kabul edilmez.
- İstemci davetleri ve WebSocket eş köken kontrolü kullanılır; aşırı istek oranı ve JSON boyutu sınırlanır.
- Oyuncular **misafir kimliği** ile çalışır, Google/e-posta hesabı bulunmaz. Kimliğini taşıyan yerel token kaybedilirse farklı cihazdan aynı profili otomatik kurtarma garantisi yoktur. Tarayıcı tokenının çalınması durumunda tam hesap güvenliği yoktur.
- Ücretsiz, eşleştirmesiz arkadaş odaları **derecesizdir**; genel dereceli maç eşleştirme sistemi yoktur.
- Yerel ağ ve otomatik testler gerçek makroları ve tüm hileleri ayırt edemez.
- Arkadaşlık, profil ve maç istatistiği gibi kayıtlar için yayın öncesi **gizlilik bildirimi**, veri saklama/silme politikası ve gerekirse KVKK uygunluk incelemesi gereklidir. Kalıcı profil silme için son kullanıcı arayüzü henüz yoktur; bu sınırlama giderilmeden genel erişime geniş çapta açmayın.
- Staging vs prod verileri ayrı tutulur. Aynı kullanıcı iki alan adı arasında tek profille oturum açamaz.
- Sunucuda eşzamanlı yarış sayısına ve ülke bazlı ping'e ilişkin gerçek kapasite ölçümü yoktur; güvenli bir küçük beta ile başlayın.
- 60 FPS **ölçülmedi**; farklı GPU/CPU'larda otomatik garanti verilmez.

## Test özeti (bu paket)

- `npm test`: 161 test geçti. Önceki 157 teste 4 dağıtım yapılandırması/sağlık kontrolü regresyon testi eklendi.
- `npm run cf:validate`: 16 ön dağıtım doğrulaması geçti; statik assets üretildi.
- Gerçek Wrangler çalıştırma/Workers deployment sınanamadı: bu çalışma ortamında `registry.npmjs.org` erişimi DNS hatası (`EAI_AGAIN`) verdi ve Cloudflare hesabı kimlik doğrulaması sağlanmadı.
- Bu nedenlerle **Cloudflare staging/prod canlı yayın, gerçek HTTPS/WSS, uzak iki cihaz ve güvenilir FPS testi henüz yapılmadı**. Aşama 20'nin kod/kurulum teslimi hazır; yayında çalıştığı henüz kanıtlanmış değil.

---

# İŞ PAKETİ 21/25 — SAVAŞ KOREOGRAFI

Bu sürüm **İş Paketi 20'nin üzerine eklenmiştir**. Tek oyunculu `app.js`, Cloudflare maç sunucusu, yetenek hasarı, HP, arkadaşlar, profil ve turnuva dışı mevcut sistemler değiştirilmedi.

## Ne eklendi?

- `pvp/choreography21.js`: aşamalı, olay tabanlı koreografi yönetimi. Savaşçı başına ayrı yönetici; `onMotion`, `onCue`, `onUltimateBeat` ve `onDefense` girişleri.
- `pvp/choreography21.css`: Alev Celladı ve Rün Muhafızı için **ayrı Q/E/S hareketleri**, ayrı vücut/ulti ritmi, enerji izleri, yerde çatlak/şok ve rün kalkanı.
- İstemciye ait 52 ms görsel **hit-stop**, aşırı kullanılmaması için 30–75 ms aralığında sınırlandırılır. Yazma kutusu, maç zamanlayıcısı ve sunucu işlemleri durdurulmaz.
- Animasyonlar yalnızca `.pvp2-stage` içine eklenen `.pvp21-layer` üzerinde çalışır; HP ve metin alanına müdahale etmez.
- Sunucudan onaylanan `ULTIMATE_PHASE`, `PARRY_TRIGGERED`, `SHIELD_BROKEN`, `SHIELD_TRIGGERED`, `COUNTERATTACK_CAST` olayları yeni kozmetik efektlere bağlandı.
- En fazla dört eşzamanlı yeni efekt ve saniyede 24 yeni koreografi işareti sınırı. Eski VFX sınırları da korunur.
- `Efektleri azalt` ve `prefers-reduced-motion` desteklenir. PvP'den çıkınca ve sistem değiştirilince zamanlayıcılar temizlenir.
- Oyunda yeni bağımlılık eklenmedi.

## Gerçek hareket sınırı

Mevcut görseller üç katmanlı raster rig'dir (gövde, silah kolu, savunma kolu). Kollar ayrı ayrı döner. Ancak tam kemik rig'i, kare kare elle çizilmiş sprite animasyonu, inverse kinematics veya gerçek 3D fizik **henüz yoktur**; animasyonların bu düzeyde olduğu iddia edilmemektedir.

## Test ve görsel doğrulama

- `npm test`: **168/168 geçti** (önceki 161 + 7 yeni koreografi testi).
- `npm run cf:validate`: **48/48 ön dağıtım kontrolü geçti**.
- Chromium'da `page.set_content` ile bağımsız arena önizlemesi: **1366×768** ve **1920×1080**; her iki tarafta üçer raster katman yükleniyor, taşma ve tarayıcı JavaScript hatası yok.
- Görsel önizlemedeki saldırı ve kalkan, paket 21'in gerçek `createChoreographyDirector` ve mevcut `createCharacterController` fonksiyonları kullanılarak tetiklendi.
- **Önemli:** Ekran görüntüleri bağımsız arena önizlemesidir; Cloudflare'ın canlı WebSocket oturumunun uçtan uca testi değildir. Tarayıcı ortamı yerel adreslere gezinmeyi engellediğinden tam oyun tarayıcı gezinmesi doğrulanamadı. Gerçek ölçülmüş FPS değeri bulunmuyor, dolayısıyla 60 FPS garantisi yok.

## Kurulum

1. Windows üzerinde bütün ZIP içeriğini çıkart.
2. Node.js kurulu olmalı.
3. Proje kökünde `npm install`, ardından `BASLAT-CLOUDFLARE.bat` çalıştır.
4. Brave'de `http://127.0.0.1:8787/` adresini aç.
5. PvP ekranında maç dışında Q/E/S/R kartlarına basarak koreografileri test et. Canlı maçta efektler yalnız sunucu olaylarıyla tetiklenir.

Cloudflare staging/production dağıtımı bu iş paketinin parçası olarak yapılmadı; İş Paketi 20'deki yayın yönergeleri geçerlidir.
