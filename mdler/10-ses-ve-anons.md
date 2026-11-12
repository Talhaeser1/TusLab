# 10 — Ses ve Anons

Son güncelleme: 13 Kasım 2026

## Kullanıcının kuralı
KESINYAP kural 3: "Sesler birbirine girmez. Anonslar (süre doluyor, seri, spiker) tek kuyruktan sırayla çalar. Spiker/anons sesleri karakter sesiyle okunmaz; karakter yalnız kendi repliğini söyler. Zafer repliğini yalnız kazanan söyler."

## Şu an oyunda olan
| Tür | Ne | Dosya |
|---|---|---|
| Karakter repliği | q, e, r, savunma, söz, zafer (Sira, Doran, Nyx, Hacı Usta) | `assets/sfx/replik/<karakter>-*.mp3` |
| Vuruş sesi | q/e/r, hit, ko (karakter başına) | `assets/sfx/<karakter>-*.wav` |
| Spiker | raund 1, yeni raund, son raund, savaş, süre, zafer, yenilgi | `assets/sfx/anons/spiker-*.mp3` |
| Seri anonsu | 2, 3, 4, 5, 6 | `assets/sfx/anons/seri-*.mp3` |
| Seyirci | başlangıç, uğultu, tezahürat | `assets/sfx/extra/seyirci-*.mp3` |
| Müzik | Anadolu (varsayılan), lobi, savaş, gerilim, ulti, zafer, yenilgi | `assets/music/` |

### Kurallar
- **Tek kuyruk:** en çok 2 bekleyen; 2,5 sn'den eski anons düşer (bitiş spikeri bazen düşer). 3 bot maçında (~700 sn) çakışma 0.
- **Seri sesi:** her doğru kelimede yükselen perde: 523, 587, 659, 784, 880, 1046, 1175, 1318 Hz (8. basamakta sabit). Yanlışta yeni basamağa iner (seri yarıya iner). 5. seride seri anonsu ve tezahürat.
- **Replik zamanı:** karakter repliği yetenek atılırken (cast anında); silah/darbe sesi temas karesinde.
- **Zafer:** repliği yalnız kazanan söyler. Teslim olan yalnız spiker-yenilgi duyar; yenilen zafer repliği söylemez.
- **Sessiz mod** her şeyi keser.
- Vargr'ın replik mp3 dosyası klasörde yok; zafer sesi `vargr-zafer` olarak anılıyor (doğrulanmadı).

## Planlanan / sırada (henüz kodda yok)
- "Süre doluyor" uyarısı (ses + yazı) kalkıyor; `spiker-sure.mp3` artık çalmayacak. Şu an hâlâ var.
- Karaktere özel yeni yetenek sesleri (W, E can yenileme) — yeni tarife göre.

## Yeni bir şey eklerken uyulacaklar
- [ ] Yeni karakter için q, e, r, savunma, söz, zafer repliği ve hit/ko sesi.
- [ ] Ses tek kuyruğa girer; spiker karakter sesiyle okunmaz.
- [ ] Dosya boyutu küçük (mp3), ilk ekranı yavaşlatmaz.
- [ ] Çakışma ölçülür; bu belge güncellenir.

## Kodda nerede
- `pvp/sound.js`, `pvp/voice-queue.js` (VOICE_QUEUE), `pvp/streak-sound.js` (STREAK_BASE_HZ 523,25), `pvp/end-voice.js`
- Test: `tests/pvp-kesinyap-ses-sure.test.mjs`
