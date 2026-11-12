# KESİN YAP — kalıcı kurallar ve sıralı iş listesi

Her oturumda ve her işçi görevinde önce bu dosya okunur. Kurallar tartışılmaz; işler sırayla yapılır, bitince işaretlenir.

## Kalıcı kurallar

1. **Metin her zaman değişir.** Yazılan içerik (kelime, cümle, atasözü, şiir, Osmanlıca kelime) her elde, her raundda
   ve her maçta farklıdır. Aynı maçta tekrar yok; yeni maç bir öncekiyle aynı içerikle başlamaz. Atasözü ve şiirde parça
   kendi içinde sırayla yazılır, ama hangi atasözü/şiirin geleceği her seferinde karışır.
2. **Dövüş sırayladır.** Bir karakter saldırır, yerine döner, 1–2 sn beklenir, sonra öbürü saldırır. Birinin
   animasyonu bitmeden öbürü başlamaz. Işınlanma yok, animasyonsuz hasar yok.
3. **Sesler birbirine girmez.** Anonslar (süre doluyor, seri, spiker) tek kuyruktan sırayla çalar. Spiker/anons
   sesleri karakter sesiyle okunmaz; karakter yalnız kendi repliğini söyler. Zafer repliğini yalnız kazanan söyler.
4. **Ekranlarda maçtaki karakter görünür.** VS, raund arası ve sonuç ekranlarında o maçta oynayan karakterlerin
   kendi görselleri kullanılır (Higgsfield portreleri).
5. Push/deploy, satın alma, plan yükseltme yok. index.html'e dokunulmaz.

## Sıralı iş listesi (12 Kasım 2026 geri bildirimi)

Durum: ⬜ başlanmadı · 🟡 sürüyor · ✅ bitti (test + tarayıcıda ölçüldü)

| # | İş | Durum | Kanıt / not |
|---|----|-------|-------------|
| 1 | Dövüş temposu: saldır → yerine dön → 1–2 sn bekle → öbürü; animasyon bitmeden sıra geçmez; ışınlanma ve takılma yok; saldırı gecikmesi yok | 🟡 | Gerçek GPU tarayıcı ölçümü (rounds/classic/arena + hızlı yazan): iki dövüşçü aynı anda saldırı 0 kare; saldıran değişimi arası 616–1393 ms; kelime→hareket 93–336 ms (kuyruk boş, rounds/classic); maxJump arena 0,30 · rounds 0,38 · classic 0,68 (savunanın darbe/fırlatma tepkisi, 57 ms'lik uzun karede); sayfa hatası 0; tests/pvp-dovus-tempo.test.mjs, 869/869. KALAN: GPU tarafı rAF donmaları (1,4–4,5 sn, ana iş parçacığında uzun görev YOK), raund sonunda ulti oynarken bekleyen karşı sahne sessiz biter |
| 2 | Metinler her el/raund/maç değişir (kural 1), tüm modlarda | ✅ | atasözü/şiir tohumla karışık parça sırası, klasik cümleler tohumlu, timed uzatma tekrarsız; tests/pvp-icerik-tekrar.test.mjs |
| 3 | Mekanik: zamana karşıda süre bitene kadar kelime gelir; sayılı raundda tam 10 kelime | ✅ | motor+tarayıcı ölçüldü (timed tükenmedi). 12 Kas: madde 11 ile değişti — sayılı raund artık "KELİME RAUNDU", kelime sayısı planla (5-7-9-10-10-10-15), seçenek yok |
| 4 | Her doğru kelimede seri sesi (art arda doğruda gittikçe incelen), seyirci tepkisi | ✅ | tarayıcı: perde 523→587→659→784→880→1046→1175→1318 Hz (8. basamakta sabit), yanlışta 523'e döndü; 5. seride seri-5 + tezahürat; probe .playwright-mcp/kesin-ses-probe.js |
| 5 | Anonslar sıraya girer ("süre doluyor" vb. karışmaz); spiker karakter sesiyle okunmaz | ✅ | 3 bot maçı (~700 sn) konuşma çizelgesinde 0 çakışma; bayat (>2,5 sn) anons düşer (bitiş spikeri bazen düşer — bkz. rapor) |
| 6 | Teslim olan/kaybeden karakter zafer repliği söylemez | ✅ | teslim: yalnız spiker-yenilgi; yenilgi: zafer repliği yok; galibiyet: yalnız vargr-zafer (kazanan) |
| 7 | VS ekranında oynayan karakterlerin kendi görselleri | ⬜ | |
| 8 | Sonuç (ZAFER/YENİLGİ) ve raund arası ekranlarında karakter + Higgsfield görselleri | ⬜ | |
| 9 | Ana ekran boss'u eski haline döner (uzak ve kötü duran 3B kaldırılır) | ✅ | 1366x768 ve 375x812: canvas 0, arena-king.webp yüklü/opaklık 1, yatay taşma yok, liderlik/başarım yok |
| 10 | PvP lobi "sahne" tasarımı: kutusuz, aşağı kaydırmasız tek ekran; arka plan seçili arena, büyük karakter portresi, madalyon dock, arena yelpazesi, çevrimiçi oda çekmecede | ⬜ | kullanıcı: "aşağı kaydırılır kare olmasın" |
| 11 | Raund sistemi: zamana karşı 30 sn / kelime raundu 5-7-9-10-10-10-15; 4000 taşınan can; raund hasar tavanı 1300 (en az 4 raund) | ✅ | tests/pvp-raund-sistemi.test.mjs (14 test: plan, timed 30 sn tükenmez, taşınan can, tavan + mükemmel oyunda nakavt tam 4. raund, 7. raund can kararı, ani ölüm, rounds'ta zar yok, sunucu=istemci). Tarayıcı (bot maçı, 1366): kelime raundu 5/7/9/10/10 kelime, sayaç 42/54/60; zamana karşı sayaç 30, raund başına 33 kelime eksiksiz; can raundlar arası taşındı; raund hasarı en çok 1300 · TAVAN; nakavt 4. raundda ("2.455 – 0 · NAKAVT"); 375/1920'de taşma yok, 12 px altı yazı yok. Kurallar: docs/HASAR-KURALLARI.md |

Mekanik (madde 11 sonrası): zamana karşı 30 sn; kelime raundu süresi = kelime × 6 sn (5→30 … 15→90); arena değişmedi (40 sn).
