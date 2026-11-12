# 13 — Yapılanlar ve Kalanlar

Son güncelleme: 13 Kasım 2026

## Kullanıcının kuralı
Kalıcı kurallar `KESINYAP.md` içinde. İş listesi oradan sadeleştirilmiştir.

## Şu an oyunda olan
### İş listesi (12 Kasım geri bildirimi)
| # | İş | Durum |
|---|---|---|
| 1 | Dövüş temposu: saldır, dön, bekle, öbürü | Bitti |
| 2 | Metinler her el/raund/maç değişir | Bitti |
| 3 | Zamana karşı süre bitene kadar kelime; sayılı raund | Bitti (sonra kelime raundu oldu) |
| 4 | Her doğru kelimede yükselen seri sesi, seyirci | Bitti |
| 5 | Anonslar sıraya girer, karışmaz | Bitti |
| 6 | Kaybeden zafer repliği söylemez | Bitti |
| 7 | VS ekranında maçtaki karakterler | Bitti |
| 8 | Sonuç ve raund arası ekranlarında karakter ve görseller | Bitti |
| 9 | Ana ekran boss'u eski haline döndü | Bitti |
| 10 | Lobi "sahne" tasarımı (kutusuz, tek ekran) | Bitti |
| 11 | Raund sistemi (7 raund, 4000 can, tavan 1300) | Bitti |
| 12 | Raund sonunda saldırılar sürmez, kadraj düzgün | Bitti |
| 13 | Yanlış kelimede seri yarıya iner | Bitti |
| 14 | Maç HUD'u yeniden | Bitti |
| 15 | Vuruş efektleri zengin (özellikle Hacı Usta) | Sırada — başlanmadı |
| 16 | Sonuç ekranı dolu ve temiz | Bitti |
| 17 | Zor atasözleri (182'ye çıktı) | Bitti |
| 18 | Raund arası tek bant | Bitti |

### Son yapılanlar (yeniden eskiye)
- Raund arası ekranı tek yatay bant oldu; dikey yazı, taşma ve çift sayım kutusu giderildi.
- Raund sonunda kart ve geri sayım, saldırılar bitmeden açılmıyor; hasar yalnız temasta.
- Maç arayüzü yenilendi: eğik can barları, hayalet can, seri göstergesi, yetenek rayı, hasar sayıları. Sonuç ekranı temizlendi.
- Lobi kutusuz tek ekran sahne oldu; VS, sonuç ve raund arası ekranlarına tam ekran Higgsfield zeminleri geldi; Hacı Usta portresi düzeldi.
- Atasözü modu 60 uzun atasözüyle genişledi (toplam 182).
- Dövüş animasyonu üçüncü tur: yüz eve dönük koşu, ~1,1 sn gidiş/dönüş, ışınlanma yok.
- Kelime raundu: süre yok, ilk bitiren raundu bitirir.
- Raund sistemi geldi: 7 raund, taşınan 4000 can, raund hasar tavanı 1300.
- Dövüş temposu ilk tur; ses işleri (seri sesi, tek kuyruklu anons, bitiş repliği).
- Yeni lobi (mod şeridi, ikon karakterler, 3B arena karuseli); atasözü, şiir, Osmanlıca modları.
- Hacı Usta beşinci dövüşçü oldu.

### Bilinen açıklar
- Vuruş efektleri sade (KESINYAP 15).
- Rounds sonucu 7 raund sürdüğü için tarayıcıda tam bitirilmedi (aynı çizim yolu birim testli).
- Kalite valisi başsız GPU'da 35. saniye civarı düşük kaliteye iniyor (gerçek kullanımda doğrulanmadı).
- 1920 ve 1366'da "zamana karşı" VS ekranı yavaş model yüklemesinde ölçülemedi (yerleşim aynı CSS).

## Planlanan / sırada (henüz kodda yok)
- Dört yetenek (Q/W/E/R) ve kendine can yenileme.
- Zemin hasarı (çatlak, krater).
- Karaktere özel yetenek efektleri.
- Mürekkep ve cel arayüz dili.
- "Süre doluyor" uyarısının kalkması.
- Her haritaya ayrı atmosfer ve hareketli arka plan; yeni arenalar.

## Yeni bir şey eklerken uyulacaklar
- [ ] İş bitince bu tabloyu ve "Son yapılanlar"ı güncelle.
- [ ] Bir madde ancak test ve tarayıcı ölçümüyle "Bitti" olur.
- [ ] Yarım kalan işi "Sürüyor" yaz, bitmiş gibi gösterme.

## Kodda nerede
- `KESINYAP.md`, `İLERLEME.md`, `docs/KONTROL-LISTESI.md`; geçmiş için `git log --oneline`
