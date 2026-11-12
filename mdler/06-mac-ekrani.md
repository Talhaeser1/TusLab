# 06 — Maç Ekranı

Son güncelleme: 13 Kasım 2026

## Kullanıcının kuralı
Ayrı kullanıcı dosyası yok. Geri bildirim (12 Kasım): kutucuklar "berbat", can barı altı boş şerit, yeteneğin ne zaman atılacağı belirsiz. Kural: yazılar 12 px'ten küçük olmaz, çakışma ve kesik yazı olmaz.

## Şu an oyunda olan
| Parça | Ne gösterir |
|---|---|
| Can barı | eğik bar; yanında ad ve can; "hayalet can" vuruşta 400 ms içinde erir; her 1000 canda çentik; %25 altında uyarı rengi |
| Seri göstergesi | "SERİ n", pipler (yanık/eşik işaretli), çarpan (x1,5 gibi) ve sıradaki adım |
| Yetenek rayı | altıgen kartlar: raundda Q/E/R, klasikte Q/E/S/R, arenada yok; seri halkayı doldurur, eşikte "atım" |
| Yazma paneli | hedef kelime, yazılan kelime şeritleri, ipucu |
| Sayaç / raund etiketi | zamana karşıda 30 sn geri sayım; kelime raundunda "Sen 4/7 · Rakip 5/7"; raund etiketi |
| Hasar sayıları | temas anında çıkar; Q beyaz-sarı, E turuncu-camgöbeği, R altın ve büyük; en üstte etiket |
| SEN rozeti | kendi tarafını gösterir |
| Kombo / saldırı | kombo sayacı 3+ ; "SALDIRI SIRASI" altında saldırı yazısı (saldırı yazısı sonradan kapatıldı) |
| Kelime raundunda | geri sayım yok; son 10 sn'de küçük "Raund kapanıyor" |

Kontroller: yazarak oynanır; tek pencere kuralı: aynı anda en fazla bir açılır kutu.

## Planlanan / sırada (henüz kodda yok)
- Yeni yetenek rayı Q/W/E/R (bkz. 03).
- "Süre doluyor" uyarısı (ses + yazı) kalkıyor.
- Mürekkep ve cel dili; her taraf kendi karakter rengiyle.
- Zemin hasarı görselleri (bkz. 09).

## Yeni bir şey eklerken uyulacaklar
- [ ] 1920x940, 1366x650, 375x812'de ölç: taşma, çakışma, 12 px altı yazı 0.
- [ ] Oyun durumlarının hepsinde bak (yazarken, çözüm, raund arası).
- [ ] Yeni bir gösterge eski bir şeyi tekrar etmez; boş şerit bırakma.
- [ ] Hasar sayısı yalnız temas karesinde çıkar.

## Kodda nerede
- `pvp/hud-v2.js`, `pvp/fight-hud.js/.css`, `pvp/skillbar.js`, `pvp/match-info.js`, `pvp/typing-top.css`
- `pvp/fx-damage.js/.css`, `pvp/combo-counter.js`, `pvp/rounds-ui.js`; test `tests/pvp-hud-v2.test.mjs`
