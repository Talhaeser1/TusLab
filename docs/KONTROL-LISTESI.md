# KONTROL LİSTESİ — "Gerçek dövüş hissi" paketi

Durum: ⬜ başlanmadı · 🟡 sürüyor · ✅ bitti (test + gözle doğrulandı) · ⚠️ engelli

| # | İş | Durum | Kanıt / not |
|---|----|-------|-------------|
| 1 | Animasyon: ışınlanma yok, doğal hız (timeScale ≤1.2), temas karesinde efekt, ulti sinematik | 🟡 | Codex çalışıyor (3. oturum) |
| 2 | Raund özeti: görsel kuyruk bitince açılır (≤~3 sn), sonra geri sayım | 🟡 | Codex |
| 3 | Raund geçiş ekranı: "RAUND X" tek başına → kompakt beceri paneli; taşma/çakışma yok | 🟡 | Codex |
| 4 | Karakter seçimi tüm modlarda maça taşınır | 🟡 | GLM analiz ediyor |
| 5a | Sira/Doran/Nyx Meshy modelleri tüm modlara bağlı (≤1,2 MB) | 🟡 | Modeller üretildi; bağlama bekliyor |
| 5b | Ana menü orta karakter 3D modeli (idle) | ⚠️ | Meshy API anahtarı harcama sınırı (402) |
| 6 | Sesler: karakter, silah/skill, seyirci, seri anonsları, spiker; temas senkron, ≤40 KB, sessiz mod | ⬜ | ses-taslak/ hazır, entegre değil |
| 7 | Mekanik: zamana karşı kelime akışı + saniye; sayılı sabit kelime; skill/süper bar, can/hasar uçtan uca | ⬜ | |
| 8 | Ekran düzeni: 1920x1080, 1366x768, 375x812 taşma/çakışma yok | ⬜ | docs/EKRAN-KONTROL-KURALLARI.md |
| 9 | Son denetim: Playwright ile her modda bot maçı | ⬜ | |

## Her işten sonra
- [ ] Diff'te izinsiz kural değişikliği yok (pvp/shared/match.js, cloudflare/, raund/kelime/süre/hasar sabitleri)
- [ ] `npm test` tamamen geçti
- [ ] Commit atıldı (push yok)
