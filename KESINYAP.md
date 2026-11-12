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
| 1 | Dövüş temposu: saldır → yerine dön → 1–2 sn bekle → öbürü; animasyon bitmeden sıra geçmez; ışınlanma ve takılma yok; saldırı gecikmesi yok | ⬜ | |
| 2 | Metinler her el/raund/maç değişir (kural 1), tüm modlarda | ✅ | atasözü/şiir tohumla karışık parça sırası, klasik cümleler tohumlu, timed uzatma tekrarsız; tests/pvp-icerik-tekrar.test.mjs |
| 3 | Mekanik: zamana karşıda süre bitene kadar kelime gelir; sayılı raundda tam 10 kelime | ✅ | motor+tarayıcı ölçüldü (sayılı 5/10 kelime tam, timed tükenmedi); sayılı raund etiketi artık "SAYILI" |
| 4 | Her doğru kelimede seri sesi (art arda doğruda gittikçe incelen), seyirci tepkisi | ⬜ | |
| 5 | Anonslar sıraya girer ("süre doluyor" vb. karışmaz); spiker karakter sesiyle okunmaz | ⬜ | |
| 6 | Teslim olan/kaybeden karakter zafer repliği söylemez | ⬜ | |
| 7 | VS ekranında oynayan karakterlerin kendi görselleri | ⬜ | |
| 8 | Sonuç (ZAFER/YENİLGİ) ve raund arası ekranlarında karakter + Higgsfield görselleri | ⬜ | |
| 9 | Ana ekran boss'u eski haline döner (uzak ve kötü duran 3B kaldırılır) | ⬜ | |
