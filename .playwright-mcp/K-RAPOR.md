# K şeridi raporu — Raund sonu eşzamanı + kamera + kasma (KESINYAP iş 12, iş 1 açıkları)

## Kök nedenler
- Raund sonu: motor sabit 6 sn çözüm bütçesi veriyordu; yavaşlatılmış sahneler sığmıyor, kart/geri sayım sahne oynarken açılıyordu.
  Ara kayıttaki (9a2f3f4) saf plan (pvp/shared/resolve-timing.js) + kartın plan bitişinde açılması + whenIdle güvenliği doğrulandı.
- Bu turda bulunan ek sahnesiz hasar nedenleri:
  1. resolveAtEnd / pencere modunda yazarken olay üretilmediği için `nextCombatId` artmıyor → aynı raunttaki iki ulti aynı
     `ultimateId` → istemci ikincisini "bitmiş ultinin kopyası" sayıp atlıyor (ultSkip dup), 3 faz hasarı sahnesiz.
  2. Karşı saldırı, aynı sahnenin kalan vuruşlarını da 6,1 sn kaydırıyordu → sahne bitmiş, destek hasarı bağsız (classic 3 adet).
  3. Toplu sahnede ~25–70 vuruş: impactFeel bekleme sınırı 16 taşıyor, fazlası temastan ~1,9 sn önce gösteriliyordu.
- Hasar sayısı erken: menzilli ultide `cast.arrived` ulti başındaki efektle true oluyordu (1/3 sayısı ~0,9 sn erken).
- Kasma: toplu temas karesinde 25 sayı × (tam darbe efekti/ses + fx-damage yaz→getBoundingClientRect) = 258–302 ms kare.
  Gölgelendirici derlemesi dövüşte 0 (program sayısı 86→86), ses decode dövüşte 0, bot tiki uzun kare üretmiyor (LoAF yok).
- Kamera: kart/geri sayım/yeni raund başında settleCamera(500) (ara kayıt) — ölçümde ihlal 0.

## Değişiklikler (bu tur)
- pvp/shared/match.js: ultimateId resolveAtEnd/pencerede tüketilir; counter kaydırması yalnız sonraki sahnelere.
- pvp/impact-feel.js: bekleme sınırı 128; flush başına en çok 3 tam darbe (kalan aynı karede sayı + can).
- pvp/fx-damage.js: taşma kıstırması rAF'te toplu (önce oku, sonra yaz).
- pvp/arena3d.js: ulti 1. faz sayısı faz temasına bağlı; bağsız q/e/destek için kendi q sahnesi; ulti faz teması prob işareti.
- tests/pvp-raund-sonu.test.mjs: ulti kimliği benzersiz (RED→GREEN doğrulandı), toplu temas bütçesi testi.
- .playwright-mcp/raund-sonu-probe.js: sahnesiz bağlam, hasar sayısı–temas uzaklığı (floatFar).

## Ölçüm (gerçek GPU ANGLE/D3D11, 1366×768)
| Ölçüt | Önce (brif/ilk koşu) | Sonra |
|---|---|---|
| Kart/geri sayım açıkken sahne / hasar yazısı | var (ekran görüntüsü) | 0 / 0 (7 koşu) |
| Sahnesiz hasar | 11 (önceki), bu turda timed 2–3, classic 4 | 0 (kelime, timed×2, classic×2, arena) |
| Kart açıkken kamera | rakip kadraj dışı | ihlal 0, en büyük model %52–55 |
| Hasar–temas farkı | 300–600 ms; toplu sahnede 1,9 sn; ulti 0,9 sn | ≤ 4 ms, floatFar 0 |
| 250 ms+ kare / maç | 8–12; bu turda toplu temasta 1 (302 ms) | 0 (max 122–146 ms) |
| Medyan kare | — | 17 ms (p95 21–28) |
| Sayfa hatası | — | 0 |
C: tüm modlarda vuruşlar tasarım gereği raund/pencere sonunda oynuyor (raund içi cast 0, sonda 6–13); değiştirilmedi.

## Açık
- npm run cf:validate onay gerektirdiği için çalıştırılamadı. Kalite valisi başsız GPU'da ~35. sn'de 'low'a iniyor.
