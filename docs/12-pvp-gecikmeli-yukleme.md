# 12 — PvP JS'inin gecikmeli yüklenmesi

Ölçüm: 1440×900, `http://127.0.0.1:5177/index.html`, yüklemeden 3,5 sn sonra `performance.getEntriesByType('resource')` + sayfa.
Bayt: her URL için HEAD `Content-Length` (sıkıştırmasız, rapor 6'daki yöntem).

| Ana sayfa | İstek | Bayt | PvP JS |
|---|---|---|---|
| Önce | 132 | 2223 KB | 60 dosya, 837 KB |
| Sonra | 75 | 1406 KB | 3 dosya (loading-hint.js, index.js yükleyici, shared/words.js: app.js istiyor) |
| Fark | −57 | −817 KB (−%37) | |

`?pvp=lobby` açılış süresi (aynı kökten iframe, lobi düğmeleri görünene kadar, 4–5 deneme):
önce 377 / 236 / 210 / 214 ms, sonra 250 / 237 / 240 / 226 / 242 ms. Yerelde fark gürültü düzeyinde (~+15 ms).
Gerçek ağda en fazla bir gidiş-dönüş eklenir: pvp-main.js'in bağımlılıkları yükleyici çalıştıktan sonra keşfediliyor.

## Yapılanlar
- `pvp/index.js` → küçük yükleyici (3,8 KB, statik import yok). `import('./pvp-main.js')` şu durumlarda:
  - adres `?pvp=…` ya da `?pvpRoom=…` içeriyorsa hemen (ana ekrandaki PvP kartı ve menü öğesi `?pvp=lobby` adresine tam sayfa geçiyor; eski sitedeki mod kartları `?pvp=practice…`);
  - `tuslab:pvp-enter` olayı ilk kez gelince (eski sitedeki "PvP Modları" / "Çevrimiçi lobiyi aç"). pvp-main kendi dinleyicisini yüklendiği anda kurduğu için ilk olayı kaçırır; yükleyici bunu `openPvp()` ile karşılar, sonraki olayları pvp-main işler. Yükleme hatasında "Arena hazırlanıyor" ipucu gizlenir, sonraki tıkta yeniden denenir.
  - Sessiz ön ısıtma: `load` + 4 sn + `requestIdleCallback`, `saveData`/2g/3g değilse `<link rel="modulepreload" href="pvp/pvp-main.js">`. Modül çalıştırılmaz. Chrome yalnız pvp-main.js'i (80 KB) çekiyor, bağımlılıkları çekmiyor. Kazancı küçük: ana ekran kartı yeni belge açtığı için yalnız HTTP önbelleğine yarar (`Cache-Control: no-cache` → 304). Gereksiz görülürse `scheduleWarm` çağrısı silinebilir.
  - Hata ayıklama için `window.__tuslabPvpLoader.state()` → `{requested, ready, warmed}`.
- `pvp/pvp-main.js` (yeni): eski index.js gövdesi aynen + başta 2 satır yorum + sonda `export function openPvp()`. index.js'te commit edilmemiş değişiklik yoktu.
- 33 test dosyasında yalnız okuma yolu `pvp/index.js` → `pvp/pvp-main.js` (`'pvp','index.js'` biçimi dahil). Testlerin anlamı değişmedi.
- Yeni test `tests/pvp-yukleyici.test.mjs` (8 test): statik import yok, index.html satırı aynı, `?pvp`/`?pvpRoom` hemen yükler, ana sayfada yüklemez, pvp-enter tek import + tek açılış, hata sonrası yeniden deneme, ön ısıtma ≥4 sn + boşta + modül çalışmaz, saveData/yavaş bağlantıda ısıtma yok.
- Yayın aynası: `cloudflare/build-assets.mjs` tüm `pvp/*.js`'i kopyalıyor; `cloudflare/public/pvp/pvp-main.js` oluştu.

## Dokunulmayanlar ve nedenleri
- **56 CSS `<link>`** (PvP CSS'lerinin çoğu ana sayfada da iniyor; en büyükleri rounds-ui.css 96 KB, lobby-v3.css 91 KB, fight-hud.css 55 KB): index.html değişmez. Erteleme için `<link>`'lerin index.html'den çıkıp yükleyicinin eklemesi gerekir (kullanıcı onayı ister).
- **assets/higgsfield/final/lobi-afis.webp (137 KB)**: ana ekrandaki PvP kartının görünen afişi; gerekli. Daha küçük bir sürümü (kart ~300 px) üretilirse ~100 KB kazanılır. home/ alanı, Metrik çalışıyor.
- **home/data/words.js (104 KB)**: rapor 6'daki öneri geçerli (home/ alanı).
- Yazı tipi isteği yok (preload sorunu yok). Bellek sızdıran dinleyici aramadım; ertelenen modüller artık ana sayfada hiç dinleyici kurmuyor (önceden document `keydown`, `visibilitychange`, `fullscreenchange` vb. açılışta kuruluyordu).
- Ana ekranın PvP girişi değişmedi (home/ dokunulmadı); gerek yok, `?pvp=lobby` zaten yükleyiciyi tetikliyor.
- `İLERLEME.md`'ye karar satırı yazılmadı (sahiplik dışında); orkestratör ekleyebilir.

## Doğrulama
- `node --test tests/*.test.mjs`: **1100/1100** (1092 + 8 yeni).
- `npm run cf:validate`: 79/79 kontrol.
- Tarayıcıda (ekran görüntüleriyle):
  - Ana sayfa: görünüm aynı; kaynak listesinde pvp-main.js ve PvP modülleri yok (3 pvp/ JS dosyası, yukarıda). ~11 sn'de yalnız pvp-main.js modulepreload ile indi.
  - PvP Düello kartı → `?pvp=lobby`: lobi açıldı (Hacı Usta, arena seçimi, SAVAŞA BAŞLA).
  - Bot maçı (Zamana Karşı, orta bot): Raund 1/7 sayacı, kelime yazma (7 kelime doğru, seri 12), raund sonu çözümü (yazma paneli katlandı, saldırılar, can 5.510/6.000), Raund 2/7 başladı.
  - `?pvp=lobby` doğrudan: lobi açıldı. Lobiden "Ana Sayfa" → `index.html`, ana ekran geldi, pvp-main yüklenmedi.
  - Ana sayfada `tuslab:pvp-enter` olayı elle yayınlandı → pvp-main yüklendi, lobi açıldı.
  - Konsolda hata yok (maç sırasında ve ana sayfada).
- Görülmeyenler: tur arası süre becerisi seçimi ekranı, ayar paneli, sonuç ekranı (maç sonuna gidilmedi); Q/E/S/R becerisini elle kullanmadım (beceri kartları çözümde etkin görüldü); eski sitedeki "PvP Modları" düğmesine gerçek tık (site gizli; olay elle yayınlandı); çevrimiçi oda (`?pvpRoom=`, 8787 gerekir); yavaş ağ koşulu.

## Değişen dosyalar
- `pvp/index.js` (yükleyici), `pvp/pvp-main.js` (yeni), `tests/pvp-yukleyici.test.mjs` (yeni), 33 testte okuma yolu.
