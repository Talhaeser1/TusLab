# TuşLab PvP — İş Paketi 23/25: Sinematik Ses Yönetmeni

## Yeni ses içerikleri
- 6 farklı **tamamen özgün, prosedürel sentezlenmiş** PCM müzik döngüsü: `lobby`, `combat`, `tension`, `ultimate`, `victory`, `defeat`.
- Dosyalar `assets/music/*.wav`; mono 24 kHz, 8 saniye/örnek. Mevcut 17 savaş efekt dosyası korunmuştur.
- Müzik, savaş SFX motorundan bağımsız kanaldadır. Müzik aç/kapat ve %0–100 ses seviyesi ayrı tutulur.
- `pvp/music23.js`: tarayıcı etkileşiminden sonra ses başlatma, dosya önbelleği, fade geçişleri, en fazla iki eşzamanlı müzik kaynağı, sonlandırma ve ses sıkıştırıcısı.
- `pvp/index.js`: maç başlangıcında savaş, HP %30 altındaysa gerilim, R yeteneğinde ulti, maç sonunda zafer/yenilgi müziği.
- Karakterlerin mevcut özgün kılıç/ateş/rün/kalkan/Parry sesleri korunmuştur.

## Lisans ve referans
Tüm yeni sesler sıfırdan deterministik sentezle üretildi. Ticari oyunlardan örnek, melodi veya efekt kopyalanmadı.
Samira veya başka bir ticari yapımın ses kaydı projeye dahil edilmedi.

## Limitler
- Bu müzikler sentezlenmiş **prototip sesleri**, profesyonel kaydedilmiş bir orkestra / stüdyo miksajı değildir.
- Tarayıcının autoplay politikası nedeniyle ilk tıklama/tuş etkileşiminden sonra başlar.
- Görsel ve çift cihazlı Cloudflare testi bu ortamda tarayıcı gezinme kısıtı nedeniyle tamamlanamadı.
- Ses analiz testi WAV biçimini doğruladı; nihai gerçek cihaz hoparlör seviyeleri değerlendirilmedi.
- Stage/production henüz dağıtılmadı.

## Test
`npm test` — 178/178 geçiş.
`npm run cf:validate` — 50/50 geçiş.
`node --check pvp/music23.js` ve `node --check pvp/index.js` başarılı.

## Başlat
`npm install`, `npm run cf:dev`, `http://127.0.0.1:8787/`.
