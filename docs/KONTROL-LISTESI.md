# KONTROL LİSTESİ — TuşLab "gerçek dövüş hissi" hedefi (6. oturum düzeni)

Durum: ⬜ başlanmadı · 🟡 sürüyor · ✅ bitti (test + tarayıcıda ölçüldü) · ⚠️ engelli
Dal: `is-4-dovus` (push/deploy yok). Görev tanımları: docs/codex/.

| # | İş | Durum | Kanıt / not |
|---|----|-------|-------------|
| 1 | DÖVÜŞ: "N KOMBO!" sayacı + tek yaklaşmada zincir; ultide boş bekleme yok; bot yürüyüp saldırır; KRİTİK arka planda görünür; savunma efekti; ışınlanma/animasyonsuz hasar yok | ✅ | 8986722; ölçüm rounds 1366: kombo, bot sahnesi, blok, tek yönlü can; yük altında kare donması madde 10'da yeniden ölçülecek |
| 2 | MAÇ EKRANI: "SEN" etiketi; yazılan kelimeler can barı altında; süre/raund net; kazanan (nakavt) hatası; Donmuş An vb. görsel etki | ✅ | 3d5c3df; rounds 1366 + arena 375 ölçüldü; Donmuş An canlı görünümü madde 10'da |
| 3 | MEKANİK: zamana karşıda süre bitene kadar kelime; sayılı raundda 10 kelime; zorlaşma; skill/süper/can uçtan uca test | ✅ | 3d5c3df; tests/pvp-mac-mekanik-i.test.mjs (11 test) |
| 4 | YENİ MODLAR: atasözü, şiir, Osmanlıca oyuna bağlı | 🟡 | 0f3c912 yarım; içerik hazır |
| 5 | HACI USTA: model + portre bağlı; Q etli ekmek, E sema dönüşü, R ney ultisi; sesler | ⬜ | varlıklar hazır (d7d6a9c, 030e2f2) |
| 6 | PvP LOBİ: üstte kaydırmalı mod seçici; ikon karakterler + bilgi kartı; 3D arena karuseli; maç ayarları alanı; kurallar paneli yok; eski model parlaması yok | ⬜ | görev J2 |
| 7 | RAUND ARASI: "Tur bitti / sonraki raund" ekranları | ⬜ | görev L |
| 8 | SES: skill replikleri, saldırı/darbe/zafer, efektler, seyirci, seri anonsu, spiker, Anadolu müziği, sessiz mod | ⬜ | dosyalar hazır, bağlanmadı (görev S) |
| 9 | AÇIKLAR: karakter tüm modlarda maça geçer + etiket uyumu; seçme kartları sığar; küçük yazılar; turkuaz kristal; "SALDIRI SIRASI"na binen kelimeler; ana menü 3D modeli | 🟡 | ana menü 3D ✅ cefd596 |
| 10 | SON ÖLÇÜM: her modda 1920×1080, 1366×768, 375×812 tam maç | ⬜ | |

## Her işten sonra
- [ ] Diff'te izinsiz kural değişikliği yok (pvp/shared/match.js, cloudflare/, raund/kelime/süre/hasar sabitleri)
- [ ] `npm test` tamamen geçti
- [ ] Commit atıldı (push yok)

## Elle test maddeleri
(Oturum sonunda doldurulacak.)
