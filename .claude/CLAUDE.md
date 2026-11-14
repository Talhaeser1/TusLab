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

# Yarıda kalan / yapılmayan işler (13 Kas 2026 — bitince buradan sil)
Yarıda:
- Yeni görseller ekranlara bağlanmadı: assets/higgsfield/final/ içinde yazma-cerceve.webp (saydam, 1235×523, iç alan x 145–1178, y 36–470), secim-zemin.webp, kart-zaman-hirsizi.webp, kart-karanlik-saat.webp, kart-donmus-an.webp.
- Dövüş sahnesi işçisi (dovus5) yarıda kesildi, raporu yok: fighters3d.js, arena3d.js, anim-state.js, combat-fx.js, fight-hud.js, resolve-ui.js, KESINYAP.md, mdler/ değişmiş ama doğrulanmadı. Önce `git diff` ile oku, `npm test` çalıştır.
- Commit edilmemiş: kare valisi 48/50 Hz düzeltmesi + testi, yeni dusme.mp3, yazma paneli "FANTASTIK" bloğu, işçi değişiklikleri.
- Yerel sunucu oturumla kapanır: `python scripts/serve.py` (5176) arka planda yeniden başlat.
Yapılmadı:
- Yazma paneli: yeni çerçeveyle yeniden tasarım (pvp/fight-hud.css sonu).
- Beceri seçme (raund arası bandı): yeni kart resimleri + sunak zemini (pvp/rounds-ui.css sonu).
- Sonuç/Yenilgi ekranı: portreler başlık ve skor satırına biniyor, başlık üstten kesik (pvp/phase15-results.css `.pvp15-scene`; düzeltme pvp/results-v2.css sonuna).
- W (Sema Dönüşü) ve E (can) sahnede oynuyor mu; yetenekten sonra karakter rakibe dönük mü; DESTEK / SALDIRI SIRASI / PENCERE SONU / yüzen etiketler rounds modunda gizli mi — ölç.
- Performans: maç başı yüklemede kalite düşüyor (vali yükleme bitene kadar örneklemesin); ilk 4–9 sn'de 0,3–0,8 sn takılma.
- Yazma hissi: sarsılma yanlış KELİMEDE olmalı (şimdi yanlış harfte), çakma yalnız doğru kelimede (şimdi her yeni kelimede) — JS'te `.tt` durum sınıfı gerekli.
- Ses efektleri genel olarak kötü (yalnız düşme sesi değişti); karaktere özel animasyon klipleri.
- Harita başına atmosfer/hareketli arka plan; telefonda isim taşması, yetenek rayı çakışması, 3B yerine eski 2B karakter.
- Belgeler: İLERLEME.md, docs/KONTROL-LISTESI.md, KESINYAP 21–22 kanıtı.