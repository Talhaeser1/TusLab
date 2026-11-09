# TuşLab PvP — Gizlilik ve veri yönetimi taslağı

**Bu bir taslaktır; hukuki uyumluluk ve KVKK incelemesi yerine geçmez.** Halka açık üretim yayını öncesi bir işletici ve iletişim adresi atanmalıdır.

- **İşlenen veriler:** Kullanıcının seçtiği görünen ad, rastgele misafir kimliğinin sunucuda tutulan özeti, arkadaş kodu, bağlantı/oda durumu, maç sonucu, WPM, doğruluk, karakter tercihleri ve sosyal etkileşimler.
- **Saklama yeri:** Cloudflare Workers/Durable Objects; yerel tarayıcı `localStorage` ve `sessionStorage` içinde misafir oturum anahtarları.
- **Amaç:** Odaya katılma, rekabetçi savaşın doğrulanması, arkadaş davetleri, maç geçmişi ve liderlik tablosu.
- **Süre:** Prototipin şu anki profil kayıtları için kullanıcıya açıklanmış otomatik silme süresi yoktur. Canlı yayın öncesi belirlenmeli ve uygulanmalıdır.
- **Silme ve erişim talepleri:** Henüz son kullanıcı arayüzü/API'si mevcut değildir. Yayından önce token doğrulamalı kayıt erişimi ve silme akışı eklenmeli; sosyal ilişkiler ve liderlik tablosu kayıtları dahil veri ilişkileri dikkate alınmalıdır.
- **Misafir profili riskleri:** Tarayıcı verisi silinirse kimlik kaybolabilir; cihazlar arası güvenli hesap kurtarma yoktur. Misafir tokenının çalınması durumda başka kullanıcı taklit edilebilir.
- **İzleme:** IP tabanlı hız sınırında IP'nin SHA-256 özeti anahtar olarak kullanılmaktadır; günlük tutma ve saklama süresi incelemesi gereklidir.
- **Üçüncü taraf hizmet:** Cloudflare'ın uygun bölgesel işleme ve sözleşme şartlarını değerlendirin. Aydınlatma metninde bu sağlayıcıyı ve veri aktarım koşullarını açıklayın.
