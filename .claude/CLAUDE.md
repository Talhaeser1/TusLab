# TusLab-PvP-IsPaketi23
Language: JavaScript
Data source: CSV / local files
Output format: web sitesi (HTML/CSS/JS)
Who uses this: Fable kotasının en fazla ~%50'si kullanılacak; ağır işi Codex yapacak, Onay bekleme. Kararları İLERLEME.md'ye yaz ve devam et. Sadece push/deploy, satın alma ve plan yükseltme yasak. Mevcut site yapısı ve içeriği bozulmayacak.
Constraints: devamindex.html'e sadece o 2 satırı (bir <link>, bir <script defer>) eklemene izin veriyorum. compact-height.css son sırada kalsın, başka hiçbir satıra dokunma. Bu istisnayı docs/codex/00-ORTAK.md'ye de not düş. Aşama 2'ye (madde 1–5) geç. Aşama sonunda değişen dosyaların listesini ve index.html diff'ini göster.

# AI strategy
Use Haiku for simple tasks; Sonnet for main dev; Opus for complex arch or if Sonnet fails 2x.
Keep context low: Grep before Read, targeted reads only.

# Rules
Concise responses. No overengineering. No unrequested extras.

# Çalışma şekli (kullanıcı kararı, 13 Kas 2026)
- Kullanıcıya SORU SORMA, onay isteme. Gerekeni yap, kararı İLERLEME.md'ye yaz. Yalnız push/deploy, satın alma, plan yükseltme yasak.
- Alt ajanları KENDİN kullan, kullanıcı söylemeden: ağır uygulama işi Codex'e (kotası yenilendi) ve hesap1/hesap2'deki Opus/Sonnet işçilerine; Fable yalnız orkestra + doğrulama.
- İki işçi aynı dosyaya aynı anda yazmaz. İşçi bitince: `npm test`, ekran görüntüsüyle gözle kontrol, sonra commit (push yok).
- Dışarıdan kod indirip çalıştıran komutlar (`npx skills use <github>` gibi) çalıştırılmaz; kurulu `gamedev:game-feel`, `gamedev:game-ai`, `gamedev:create-game-assets` becerileri kullanılır.
- Higgsfield ücretsiz planda üretim yapmıyor; görsel gerekirse Meshy (nano-banana-pro, 9 kredi).

# Yarıda kalan / yapılmayan işler (14 Kas 2026 — bitince buradan sil)
Bitti (commit edildi, YAYINDA DEĞİL — yayın: `npm run cf:deploy:production`, yalnız kullanıcı isterse): yazma paneli çerçevesi + is-hit/is-miss, resimli beceri kartları, sonuç ekranı v3, dört yetenek/yön/kalabalık doğrulaması, R kadrajı, maç başı shader hazırlığı.
Yapılmadı:
- Sonuç ekranı gerçek maçta (oyunun kendi #pvp-root içinde) gözle kontrol edilmedi; örnek veriyle ölçüldü.
- Arena modunda hazırlık/özet evresinde yazma paneli çerçevesi (1040 px) kontrol edilmedi.
- Beceri bandında seçilmeyen kartlar fazla sönük olabilir.
- Telefonda oyuncu adı sarıyor ("SAVAŞÇ/I"), üst araç çubuğu sıkışık.
- E (can) her karakterde zafer klibiyle oynuyor; karaktere özel klip yok. Ses efektleri genel olarak kötü (yalnız düşme sesi değişti).
- Harita başına atmosfer/hareketli arka plan.
- mdler/07-ara-ekranlar.md: sonuç ekranında portreler artık eşit boy (belge eski).
- Belgeler: docs/KONTROL-LISTESI.md.
