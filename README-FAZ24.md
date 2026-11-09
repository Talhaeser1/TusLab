# TuşLab PvP — İş Paketi 24 (başlangıç): Güvenli ilk yayın hazırlığı

## Bu adımda değişenler
- **Yerel Worker adı ayrıldı:** `cloudflare/wrangler.jsonc` artık `tuslab-neon-pvp-dev`. Önceden production ile aynı adı kullanıyordu; yerelden yanlışlıkla canlıya yazma riski kapandı.
- **`npm run cf:deploy` kaldırıldı.** Yayın yalnızca `cf:deploy:staging` ve `cf:deploy:production` (veya `.bat` dosyaları) ile yapılır.
- **Tek sürüm kaynağı:** `pvp/release.js` (`RELEASE_STAGE = 24`). `/api/health` ve PvP alt bilgisi bu değeri kullanır. Smoke testi artık `stage >= 24` bekler.
- **Animasyon test düğmeleri** ("Darbe", "Zafer", "Yenilgi", "↺", "Q→E→R") yalnızca adrese `?debug=1` eklenince görünür.
- Yeni regresyon testleri: yerel/staging/production adları farklı olmalı, health sürümü sabitten gelmeli, `cf:deploy` olmamalı, test düğmeleri debug arkasında olmalı.

## Test
- `npm test`: **180/180 geçti** (178 + 2 yeni).
- `npm run cf:validate`: **50/50 geçti.**
- Tarayıcıda görsel kontrol ve gerçek Cloudflare yayını bu adımda yapılmadı.

## Sıradaki (hesap gerektiren) adımlar
1. `npx wrangler login`
2. `npm run cf:deploy:staging` → dönen gerçek adresi kaydet
3. `node scripts/smoke-deployment.mjs https://GERCEK-STAGING-ADRESI --rooms`
4. İki farklı ağdan gerçek maç, 20 sn kopma testi, FPS ölçümü
5. Gizlilik bildirimini kesinleştir, profil silme arayüzünü ekle
