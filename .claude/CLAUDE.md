# TuşLab — Neon Arena (her oturumda okunur)
Türkçe klavye eğitimi + 1v1 "yazarak dövüş" oyunu. Düz HTML/CSS/JS (ES modülleri), framework ve derleme yok. Sunucu: Cloudflare Worker (`cloudflare/src`). CSP `script-src 'self'`: satır içi betik ve CDN yok.

## Kesin kurallar
- YASAK: push, deploy (`cf:deploy:*`), satın alma, plan yükseltme. Dışarıdan kod indirip çalıştırmak (`npx … <github>`) yok.
- `index.html` değişmez (yeni `<link>`/`<script>` eklenmez; yeni CSS var olan dosyaya, yeni JS var olan modülden import ile).
- Kalıcı silme yok: gereksiz dosya `_to_delete/` altına taşınır, kullanıcı siler.
- Kararlar `İLERLEME.md`'nin sonuna yazılır. Her işin sonunda `docs/` altına numaralı (1, 2, 3…) kısa bir rapor md'si.

## Roller (kullanıcı kararı, 23 Kas 2026)
- Ana model (Fable) YALNIZ orkestra + doğrulama yapar: işi böler, ajana verir, sonucu oyunda kendi kontrol eder.
- Kodlama işleri **Opus alt ajanına** verilir (Agent aracı, `model: "opus"`). Codex/OpenCode o oturumda varsa: kod Codex, test OpenCode; yoksa Opus.
- Dosya tarama, temizlik, araştırma gibi mekanik işler Sonnet (ya da Haiku) alt ajanına.
- Aynı anda EN ÇOK 2 ajan ve dosyaları ayrı olmalı (biri `pvp/`+`cloudflare/`, diğeri `home/`). İki ajan aynı dosyaya yazmaz.
- Ajan prompt'unda mutlaka yazılır: sahip olduğu dosyalar, dokunmayacağı dosyalar, kabul ölçütleri, çalıştıracağı komutlar, rapor dosyasının adı.

## Çalışma sırası
1. Bir seferde TEK konu. Kullanıcı çok madde yazdıysa sıraya koy, sırayı söyle, birinciden başla.
2. Soru sorma, onay bekleme; ama kural/tasarım gibi iki yöne gidebilecek bir şeyi tahminle yaptıysan bunu son mesajda "şöyle yorumladım" diye açıkça yaz.
3. Hata bildirimi ekran görüntüsüyle geldiyse önce aynı durumu tarayıcıda yeniden üret, sonra düzelt.

## "Bitti" demeden önce (hepsi zorunlu)
1. `node --test tests/*.test.mjs` — gerçek sayıları yaz (23 Kas: 1038/1038).
2. Tarayıcıda gerçek kullanım, EKRAN GÖRÜNTÜSÜNE BAKARAK: `http://127.0.0.1:5177/index.html` (BASLAT.bat → `scripts/serve.py`, önbelleksiz). 5176 kullanılmaz. PvP işi ise lobiden gerçek bot maçı: oyun sırası, raund sonu çözümü, tur arası, süre becerisi seçimi, ayar paneli, sonuç ekranı.
3. Görmediğin şeyi "görmedim / denenmedi" diye yaz. Testin geçmesi görünüşün doğru olduğunu göstermez.
4. Doğrulanan her maddeden sonra commit (push yok).
5. Yayın öncesi: `npm run cf:validate` (deploy değil).

## Nerede ne var
- `home/` yeni ana ekran, Yazma, dersler, Şiir & Atasözü, Performans. `pvp/` oyun; kurallar `pvp/shared/`. `app.js` eski site: silinmez ama kullanıcıya hiç gösterilmez.
- Açık sorunlar ve sıraları: `docs/DEVIR-PVP.md`, `docs/DEVIR-ANA-EKRAN.md`. Bir madde bitince oradan sil.
- Kurallar ve denge: `docs/HASAR-KURALLARI.md`, simülatör `scripts/pvp-denge-sim.mjs`. Ortak ajan kuralları: `docs/codex/00-ORTAK.md`.
- Çevrimiçi oda yalnız `BASLAT-CLOUDFLARE.bat` (8787) ile çalışır.
