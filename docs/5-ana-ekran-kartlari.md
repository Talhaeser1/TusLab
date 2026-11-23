# 5 — Ana ekran kartları (23 Kas 2026)

## Ne değişti
- **Üç kartın ortası artık dolu.** Her kartın üst bölümünde temaya uygun, elle yazılmış vektör sahne var (dış kaynak, betik ve `<image>` yok):
  - `assets/home/kart-yazma.svg` (camgöbeği): eğik neon Türkçe klavye (Ğ Ü Ş İ Ö Ç), basılı tuşlar, tuşlardan yukarı uçan harfler, imleçli "Damlaya damlaya göl olur" satırı.
  - `assets/home/kart-dersler.svg` (altın): yıldızlı ders ilerleme yolu (biten / şu anki / kilitli) ve parmak renklerine boyanmış üç sıralı tuş haritası (F/J kabartmalı).
  - `assets/home/kart-edebiyat.svg` (mor): kemerli sayfa, italik şiir satırları, mürekkep dalgaları, tüy kalem.
- Görseller CSS katmanı (`.tlh-card::before`, `--art` değişkeni) olarak gelir, DOM'a `<img>` eklenmedi. Katman alta doğru söner (mask), yazılara koyu gölge eklendi. PvP kartının afişine dokunulmadı.
- **Dört kartta aynı hizalama:** açıklama 2 satır yer tutar, ders çubuğu kartın alt kenarında ince şerit oldu → başlıklar ve "Aç →" satırları aynı hizada.
- **Odak:** klavyeyle gezilince kartta kendi renginde 3 px halka (`--acc`). **Azaltılmış hareket:** kart, görsel ve ok kaymaları dahil hiçbir dönüşüm yok (hem `prefers-reduced-motion` hem `html.reduced-motion`).
- **İstatistik kutusu ve görev çipi:** kartlarla aynı yüzey (degrade, 22 px köşe, gölge). Her sayının üstünde kendi renginde ince şerit var. Görev çipi altın tonlu; odak halkası altın.
- Telefon (≤860 px): görsel kartın sağ yarısında, sola doğru söner; kartlar tek sütun.

## Dosyalar
- `home/home.css`: 124–147 (istatistik + görev çipi), 206–223 (kart görselleri, hizalama, odak, yazı gölgesi), 493–499 (telefon), 524–525 ve 528–531 (azaltılmış hareket). Başka oturumların değişikliklerine dokunulmadı.
- Yeni: `assets/home/kart-yazma.svg`, `assets/home/kart-dersler.svg`, `assets/home/kart-edebiyat.svg` (3,5–10 KB).
- Yeni test: `tests/home-kartlar.test.mjs` (3 test: dosyalar yerel/güvenli/küçük, CSS bağları, odak + azaltılmış hareket).
- `home/home.js` değişmedi.

## Optimizasyon: ne bulundu
Açılışta 151 istek var. **Ertelenebilecek yükün hiçbiri home/ kaynaklı değil**, bu yüzden dokunulmadı:
- PvP modülleri (`pvp/index.js` ve ~60 import, `pvp/shared/*` 16 dosya, ~40 pvp CSS): `index.html` satır 77'deki `<script type="module" src="./pvp/index.js">` ve oradaki `<link>`'ler.
- Dövüşçü portreleri (`assets/higgsfield/final/portre-*.webp`) ve 10 padişah SVG'si: `pvp/cinematic.js:96`, modül yüklenince `PORTRAITS`'in hepsini `new Image()` ile önden indiriyor. Öneri (pvp şeridi için): bu önden yüklemeyi lobi açılınca ya da `requestIdleCallback` ile yapmak.
- `assets/adventure-*.jpg`, `castle-scene.webp`, `player.jpg`, `arena-king.webp`, `rune-preview.webp`: eski site (`app.js` / `#app` ve eski CSS'ler). `#app` gizli olsa da CSS arka planları ve `<img>`'ler iniyor. Öneri: eski CSS'leri `index.html`'den çıkarmak (index.html kuralı nedeniyle kullanıcı kararı gerekir).
- home/'un kendi yükü küçük: `home.js`, `home.css`, `sfx.js`, `arena.js`, `typing.js`, `lessons.js`, `data/*` (3). Kart sayıları ("234 atasözü…") bunlara bağlı, ertelenmedi.

## Test
`node --test tests/*.test.mjs` → **tests 1071 / pass 1071 / fail 0** (önce 1068; artı yeni 3 test).

## Tarayıcıda gördüklerim (127.0.0.1:5177, ekran görüntüsüyle)
- 1440×900 ve 1280×720: dört kart dengeli, üç kartın ortası dolu, yazılar okunuyor. 1280×720'de Yazma kartında klavyenin alt sırası "HEMEN YAZ" yazısının arkasına giriyor; gölge sayesinde okunuyor.
- 390×844: kartlar tek sütun, yatay kaydırma yok (`scrollWidth 382 = clientWidth 382`).
- Tab ile Yazma kartına gelince camgöbeği odak halkası görünüyor. Konsolda hata ve CSP ihlali yok.

## Görmediklerim
- `prefers-reduced-motion` gerçek tarayıcı ayarıyla denenmedi; yalnız CSS kuralı ve test var.
- Hover'daki %4 büyüme ekranda izlenmedi.
- Safari/Firefox'ta SVG yazı tipleri (Segoe UI → system-ui yedeği) görülmedi.
- `npm run cf:validate` çalıştırılmadı (npm PATH'te yok). `cloudflare/public` aynasına kopyalama gerekiyorsa yapılmadı.

## Orkestra doğrulaması (23 Kas 2026)
- `node --test tests/*.test.mjs`: 1071/1071.
- Ekran görüntüleriyle görüldü: 1440×900 ve 1280×720'de dört kart dengeli, üç kartın ortası dolu, yazılar okunuyor; 390 px'te tek sütun, görsel kartın sağında, yatay kaydırma yok (scrollWidth 390 = clientWidth 390); konsolda hata yok.
- Commit durumu: SVG'ler ve bu rapor commit edildi. `home/home.css` eklemeleri ve `tests/home-kartlar.test.mjs` commit EDİLMEDİ: ana ekranın "Merkez" tasarımı (`.tlh-card` kuralları) son commit'te yok, başka bir oturumun commit edilmemiş işi; kart CSS'i onunla birlikte commit edilmeli.
