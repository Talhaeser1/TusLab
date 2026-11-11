# Kalan görev tanımları (5. oturum) — her biri AYRI işçi görevi

Ortak: önce docs/codex/00-ORTAK.md. Commit/push YOK, dal değiştirme YOK. index.html / devamindex.html / package.json YASAK
(yeni CSS/JS gerekiyorsa index.html'de ZATEN yüklü bir dosyaya ekle ya da mevcut bir modülden import et). Test silme/atlama yok.
`npm test` tam geçmeli. Rapor ≤40 satır Türkçe. Yazı ≥12 px; 1920×1080, 1366×768, 375×812'de yatay taşma/çakışma yok;
prefers-reduced-motion'a uy. Görseller: yalnız assets/ altındaki mevcut dosyalar (assets/higgsfield/final/*.webp dahil).

## J1 — ANA EKRAN (madde 1)
- Ana ekran ve "Maceralar" KALIR. "Liderlik tablosu" ve "Başarımlar" bölümleri/menü girişleri KALKAR (DOM'dan çıkar ya da kalıcı gizle; kırık bağlantı/boş alan kalmasın; ilgili testleri güncelle).
- Ortadaki boss 3D ve hareketli: assets/models/harf-muhafizi/harf-muhafizi.glb (klipler: Idle, Combat_Stance). PvP'deki three.js yükleyicisini (pvp/fighters3d.js / pvp/vendor) yeniden kullan; küçük bir canvas; Idle döngüsü + yavaş dönme/nefes; yüklenene kadar ve hata/WebGL yokken mevcut görsel (assets/arena-king.webp) görünür. Sekme gizliyken render durur. reduced-motion'da tek kare.
- "Komuta merkezi" / "Performans merkezi" panellerini modernleştir: sade kartlar, net hiyerarşi, tek vurgu rengi, tutarlı 8 px ızgara, gereksiz parıltı/cam efekti yok.

## J2 — PvP LOBİ (madde 2)
- Oyun modu EN ÜSTTE, yatay kaydırmalı (scroll-snap) seçici; klavye ok tuşları + dokunmatik kaydırma. Yeni modlar (Atasözü, Şiir, Osmanlıca) da burada.
- Karakterler YALNIZ ikon/portre (assets/higgsfield/final/portre-*.webp, konyali: assets/models/konyali/portre-konyali.webp). Üstüne gelince/odaklanınca (dokunmatikte dokununca) bilgi kartı: silah + Q/E/R adları ve kısa açıklamaları (pvp/shared/fighters.js'ten OKU).
- Sağda arenalar 3D kaydırmalı karusel (CSS 3D transform/perspective coverflow; assets/higgsfield/final/arena-*.webp; seçili öndeki büyük).
- Bot zorluğu, maç uzunluğu, raund biçimi tek şık "MAÇ AYARLARI" alanında (segment düğmeler).
- "Maç kuralları" paneli KALKAR.
- Maça girişte eski modeller GÖRÜNMESİN: yükleme sırasında eski/2B karakter ya da KayKit kalıntısı parlaması olmasın (yükleniyor göstergesi → Meshy modeli).
- Seçilen karakter ÜÇ modda da maça geçer; HUD etiketi modelle uyuşur (testle sabitle).
- Karakter kartları tek ekrana sığar: 1920 ve 1366'da tek satır, 375'te 2–3 sütun ızgara.

## K — YENİ KARAKTER: KONYALI (madde 9) — özgün, gerçek kişi değil
- Kimlik: id `konyali`, ad "Hacı Usta"; silah "Etli ekmek & ney". Q "Etli Ekmek Fırlatışı" (menzilli fırlatma), E "Sema Dönüşü" (dönerek alan hasarı), R ulti "Ney Feryadı" (ney çalar, ses dalgası rakibin kulaklarını patlatır; sinematik + ekran dalgası).
- Model: scripts/optimize-vargr-meshy.py ve merge-vargr-clips.py örnek alınarak assets/models/konyali/kaynak/konyali-anim.glb (Combat_Stance, Standard_Forward_Charge_inplace, Over_Shoulder_Throw=Q, 360_Power_Spin_Jump=E, Block1, Hit_Reaction, Knock_Down, Victory_Cheer) + konyali-ney.glb (klip `retarget_clip` → `Ney_Ulti` adıyla R) birleştir, dokuyu WebP'ye çevir → assets/models/konyali/konyali.glb ≤ 1,2 MiB. Portre: kaynak/konyali-portre.png → assets/models/konyali/portre-konyali.webp (768×1024, ≤120 KB). LISANS.txt (Meshy AI üretimi) ekle.
- Aynı betikle boss: assets/models/harf-muhafizi/kaynak/boss-anim.glb → assets/models/harf-muhafizi/harf-muhafizi.glb ≤ 1,2 MiB.
- pvp/shared/fighters.js'e beşinci dövüşçü olarak ekle: hasar/can/bekleme değerleri mevcut dört karakterin ORTALAMASI bandında (dengeyi bozma; mevcut karakterlerin sayılarına DOKUNMA). fighters3d.js klip tablosu, parçacık profili (sıcak buğday sarısı + kiremit), lobi kartı, bot rakip havuzu, cloudflare sunucu doğrulaması (karakter id listesi) güncellenir. Testler: 5 karakterin hepsi için klip tablosu eksiksiz, boy normalize 2,68.

## L — RAUND ARASI EKRANLARI (madde 6)
"TUR BİTTİ" ve "SONRAKİ RAUND" ekranları fantastik ve atmosfere uygun: assets/higgsfield/final/ekran-raund-banner.webp, ekran-zafer/yenilgi.webp üstüne; kazanan tarafın renginde sancak/ışık süpürmesi, rün çerçeve, raund pipleri, büyük display başlık, kısa giriş/çıkış geçişi (≤400 ms). Kural süreleri (ROUND_SUMMARY_MS / ROUND_INTRO_MS) DEĞİŞMEZ. Kapsam: pvp/rounds-ui.*, pvp/arena-ui.* (yalnız sunum).

## M — YENİ MODLAR (madde 8)
Üç yeni içerik modu (yazma içeriği değişir; dövüş kuralları aynı):
- `atasozu`: Türk atasözleri SIRAYLA yazılır (anonim, kamu malı; ≥120 adet; her biri tek "kelime birimi" olarak kelime kelime ilerler).
- `siir`: YALNIZ telifsiz eski şiirler — Yunus Emre, Karacaoğlan, Pir Sultan Abdal, Fuzûlî, Bâkî, Nedîm, Köroğlu, Dadaloğlu (hepsi 1900 öncesi ölmüş). 20. yy şairi YOK. Dizeler sırayla; her parçada şair adı gösterilir. ≥40 dörtlük/beyit. Metinleri UYDURMA: emin olmadığın dizeyi koyma.
- `osmanlica`: Osmanlı Türkçesi kelimeler (Latin harfli) + kısa günümüz karşılığı ipucu (ör. "mektep — okul"); ≥200 kelime; raund ilerledikçe uzun/zor kelimeler.
İçerik: pvp/shared/words.js yanında yeni veri modülleri; mod seçimi lobi seçicisine ve `?mode=`/içerik parametresine bağlanır; mevcut classic/rounds/arena bozulmaz; sunucu (cloudflare) doğrulaması yeni içerik kimliklerini kabul eder. Türkçe büyük/küçük harf (İ/ı) ve noktalama yazım kuralı testle sabitlenir.

## S — SES (madde 7)
- Mevcut kayıtlar: ses-taslak/sfx/*.mp3 (balta, kılıç, mızrak, hançer, ışık, meteor, kalkan, blok, kritik, düşme, koşu, seyirci-*, jingle-*) ve ses-taslak/replik-kesilmis/. Bunları assets/sfx/ altına (≤40 KB/dosya) alıp bağla: saldırı/darbe (temas karesinde), blok, düşme, zafer/yenilgi jingle, seyirci (başlangıç, tezahürat, uğultu döngüsü), seri anonsları, spiker.
- Skill adı seslendirmesi: karakter Q/E/R kullanınca kendi sesiyle skill adını söyler. Dosya yoksa SESSİZ geç (hata yok); dosya adı sözleşmesi: assets/sfx/replik/<karakter>-<q|e|r>.mp3 — sonradan eklenen dosya kod değişmeden çalar.
- Müzik: assets/music/ altındaki parçalar + scripts/generate-music.py; ney/bağlama tınılı özgün Anadolu ezgisi dosyası gelince `assets/music/anadolu.mp3` adıyla otomatik kullanılır (yoksa mevcut müzik).
- Sessiz mod: tek düğme tüm sesleri (müzik + efekt + replik) keser, tercih localStorage'da kalır, testle sabitlenir. Otomatik oynatma kısıtına uy (ilk kullanıcı etkileşiminden sonra).
