# Devir notu — PvP sohbeti (23 Kas 2026)

Bu dosyayı yeni sohbetin ilk mesajında okut: "docs/DEVIR-PVP.md'yi oku, 1. maddeden başla."

## Çalışma kuralları
1. Yalnız `pvp/`, `cloudflare/src/` ve ilgili `tests/` dosyalarına dokun. `home/` ve `index.html` değişmez.
2. Bir seferde TEK madde. Bitince `node --test tests/*.test.mjs` (şu an 1038/1038) ve tarayıcıda gerçek bot maçı: `http://127.0.0.1:5177/index.html?pvp=lobby` (BASLAT.bat; 5176 kullanılmaz, önbellek tutuyor).
3. "Bitti" demeden önce ekran görüntüsüne bak: oyun sırası, raund sonu çözümü, tur arası, süre becerisi seçimi, ayar paneli, sonuç ekranı.
4. Her doğrulanmış maddeden sonra commit (push yok).

## Açık sorunlar (öncelik sırasıyla)
1. (BİTTİ 23 Kas — docs/2-raund-sonu-vuruslari.md) Açık kalan: K.O. bandı hâlâ ROUND_END anında çıkıyor; kuyruk gerideyse K.O. yazısı son vuruştan önce gelebilir. Çevrimiçi oda ve arena modu gerçek maçta denenmedi.
1b. (BİTTİ 23 Kas — docs/3-destek-hayaleti-zamanlamasi.md) Destek hayaleti çözüm başında değil kendi sahnesinde oynuyor. Tasarım sorusu açık: hayalet "diğer karakter"in kopyası, yani bot destek kullanınca oyuncunun kendi karakterinin (ör. Vargr) kopyası oyuncuya saldırıyor.
2. Animasyonlar düzgün değil (kullanıcı şikâyeti, ayrıntı verilmedi): çözüm sırasındaki vuruş/tepki/geri dönüş klipleri ve zamanlaması gerçek maçta kare kare izlenip listelenmeli, sonra düzeltilmeli.
3. Can becerisi rakipte fark edilmiyor: yenen hasar aynı çözümde geri dolduğu için bar oynamıyor. Görsel: bar önce insin, sonra yeşil yükselsin (ajan bunu yaptığını bildirdi; gerçek maçta doğrula).
4. Can doluyken atılan E, o raund darbe yenmezse yanıyor (healBank raund başında sıfırlanıyor) — kural kararı gerek.
6. Zor–zor bot dengesi: 5 eşleşme %45–55 dışında (scripts/pvp-denge-sim.mjs).
9. Tur arasında "sürekli soluk ekran" (kullanıcı görüntüsü) birebir üretilemedi; yeniden bak.
10. Çevrimiçi oda gerçek Cloudflare sunucusuyla (BASLAT-CLOUDFLARE.bat, 8787) hiç denenmedi.

(24 Kas, Usta — docs/17-pvp-kalanlar.md: 5, 7, 8 ve 12 bitti, listeden silindi. Kalanların numaraları değişmedi.)
17. (24 Kas, Kâşif — docs/20-pvp-tus-turu.md) Çevrimiçi odada sunucu onayı beklenirken (`pvp-main.js` input, `p.pending`) basılan harfler atılıyor; hızlı yazanda sonraki kelimenin ilk harfi kaybolabilir. Bot maçında sorun yok. 8787 ile dene.
18. (Kâşif) Yerel sunucu `scripts/serve.py`: `ThreadingHTTPServer` dinleme kuyruğu 5 → lobinin ~150 isteğinden bazıları ERR_CONNECTION_REFUSED, PvP bazen açılmıyor. `request_queue_size = 128` önerildi (sahiplik dışı). İstemci tarafında `pvp/index.js` bir kez yeniliyor.
19. (Kâşif) Tarayıcı geri tuşu canlı maçı sorusuz bırakıyor (tasarım kararı gerek).

## Kullanıcı kararı bekleyenler
- "Ultide max 2 kombo": şu an çarpan tavanı ×2; "en çok 2 vuruş" mu?

## Okunacak raporlar
docs/RAPOR-PVP-MEKANIK.md, RAPOR-PVP-KALANLAR.md, RAPOR-BECERI-SATIRI.md, RAPOR-PVP-AKIS-ARAYUZ.md, HASAR-KURALLARI.md

## Daha eski açıklar (14 Kas listesinden taşındı, hâlâ doğrulanmadı)
11. Arena modunda hazırlık/özet evresinde yazma paneli çerçevesi (1040 px) kontrol edilmedi.
13. E (can) her karakterde zafer klibiyle oynuyor; karaktere özel klip yok.
14. Ses efektleri genel olarak kötü (yalnız düşme sesi değişti).
15. Harita başına atmosfer / hareketli arka plan yok.
16. Belgeler eski: mdler/07-ara-ekranlar.md, docs/KONTROL-LISTESI.md.

(24 Kas, Telefoncu — docs/24-pvp-telefon-turu.md: telefon turu. Yetenekler alt sayfası yığılma hatası, 740×360 lobi ve sonuç düzeni, ekran klavyesi düzeni (`pvp/phone-viewport.js`), yazma paneline dokununca odak, dokunmatikte 44 px düğmeler, teslim satırı taşması, 601–820 px "Arkadaşlar" taşması ve telefonda otomatik kalite başlangıç kademesi düzeltildi.)
20. (Telefoncu) Gerçek telefonda (iOS Safari, Android Chrome) ekran klavyesiyle maç hiç denenmedi; düzen sahte `visualViewport` ile doğrulandı. Raund sonunda klavye kapanıyor, oyuncu panele yeniden dokunuyor (iOS otomatik odağa izin vermez).
21. (Telefoncu) `index.html` viewport etiketinde `viewport-fit=cover` yok → `env(safe-area-inset-*)` hep 0 (içerik çentikte kesilmez ama kenardan kenara da değil). index.html kararı kullanıcıda.
