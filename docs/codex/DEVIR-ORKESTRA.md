# Orkestra devri (12 Kasım 2026, 20:35)

Kullanıcı kararı: ana beyin artık **hesap2'deki Fable 5.2**. Bütün kalan işleri o dağıtır, denetler, kaydeder.

## Değişmez kurallar
- Önce `KESINYAP.md` (kök) okunur; kurallar tartışılmaz, işler bitince kanıtla işaretlenir.
- Push/deploy, satın alma, plan yükseltme YOK. `index.html` ve `devamindex.html`'e dokunulmaz.
- Kullanıcıya soru sorulmaz, onay beklenmez; kararlar `İLERLEME.md`'ye yazılır.
- Mevcut site yapısı ve içeriği bozulmaz. Her kayıttan önce `npm test` tamamen geçmeli.
- Kayıtlar `is-4-dovus` dalına, mesaj sonu: `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`.
- Aynı anda en çok 2 işçi, aynı anda TEK tarayıcı (bellek ~8 GB). İki işçi aynı dosyaya yazmaz.
- UI işinde `docs/EKRAN-KONTROL-KURALLARI.md`: 1920x1080, 1366x768, 375x812 ölçümü.

## İşçi başlatma
Scratchpad: `C:/Users/TALHAE~1/AppData/Local/Temp/claude/2e1362527dc05f2f/04812c34-0cfb-4d9c-bdfe-e0613ba3e735/scratchpad` (S).
- `bash "S/run-worker2.sh" <ad> <sonnet|opus> <hesap 1|2>` → görev `S/p-<ad>.txt`, rapor `S/w-<ad>.log`. `S/onsoz.txt` her göreve eklenir.
- Hesap1 12 Kasım 20:29'da kullanım sınırına ulaştı; hesap2 kullanılır. Codex kotası 13 Kasım 16:28'e kadar dolu.
- İşçi "başka işçiye devrettim" deyip çıkarsa ya da sınır/ağ hatası verirse yeniden başlatılır.
- Sunucu: `python scripts/serve.py` → http://127.0.0.1:5176 (kapalıysa arka planda başlat).
- Tarayıcı ölçümü: `node .playwright-mcp/run.mjs <probe.js> '<json>'` (gerçek GPU: `run-gpu.mjs`).

## Durum
Kaydedilmiş son iş: `8dd1348` (lobi sahnesi, sonuç/VS zeminleri). Testler 909/909.

Devir anında ÇALIŞAN iki işçi (ikisi de hesap2; yeniden başlatma, bitmelerini bekle — `S/w-hud.log` ve `S/w-raundsonu.log` dolunca bitmiştir):
| İş | Görev dosyası | İşçi |
|----|---------------|------|
| 14 + 16: maç HUD'u, sonuç ekranı temizliği | `p-hud.txt` | Sonnet |
| 12 (+ iş 1 artıkları): raund bitince saldırı sürmez, kamera geniş plan, hasar temasta, kasma | `p-raundsonu.txt` | Opus |

Çalışma ağacında bu iki işin kaydedilmemiş yarım değişiklikleri var (`pvp/shared/resolve-timing.js` yeni).

SIRADA (görev metinleri hazır):
| İş | Görev dosyası | Ne zaman |
|----|---------------|----------|
| 13: yanlış kelimede seri yarıya iner | `p-seri.txt` | raund sonu işi kaydedilince (match.js, rounds-ui.js çakışır) |
| 15: yetenek efektleri (özellikle Hacı Usta) | `p-vfx.txt` | raund sonu işi kaydedilince (arena3d.js çakışır) |

Biten işte açık kalanlar: raund arası kartı 1366x768'de dar/uzun, altı ekran dışı; VS ekranında 1920/1366 "zamana karşı" karakter ölçümü eksik; 768x1024 lobide 6 px gizli yatay taşma.

## Her iş bitince
1. Raporu oku, `git diff --stat` ile izin dışı dosyaya dokunulmuş mu bak.
2. `npm test` (tamamı geçmeli); gerekirse tarayıcıda bir bot maçıyla sayısal doğrula.
3. İlgili dosyaları + yeni dosyaları `git add`, kaydet. KESINYAP satırını kontrol et.
4. Sıradaki işi başlat.

## En son
- Tam test + üç boyutta üç mod (rounds/classic/arena) bot maçı ölçümü; "her şey çok hızlı" şikâyeti için sahne süreleri kontrolü.
- `docs/KONTROL-LISTESI.md` elle test maddeleri, `İLERLEME.md` özet, `KESINYAP.md` son durum.
- Kısa Türkçe bitiş raporu: yapılanlar, ölçülemeyenler, açık kalanlar.
