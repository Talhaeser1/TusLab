# TEMİZLİK RAPORU (uygulandı, 23 Kas 2026)

## 1. Özet
- Taşınan: 603 dosya, 131 MB (`du -sh _to_delete`). Hiçbir şey silinmedi (`rm` yok), yalnız `_to_delete/` altına `mv` yapıldı, yollar korundu.
- `.gitignore` sonuna `_to_delete/` eklendi (tek kaynak düzenlemesi).
- `npm test` benzeri: `node --test tests/*.test.mjs` → 1011 test, 1011 geçti, 0 kaldı.

## 2. Taşınanlar
| Yol (`_to_delete/` altında aynı yol) | Neden | Boyut |
|---|---|---|
| `.playwright-mcp/` içinden 457 giriş: 270 ekran görüntüsü (png/jpg), `v3/` (91 dosya, ekran görüntüsü), `head/` (pvp HEAD kopyaları), `tempo/`, iç içe `.playwright-mcp/`, `.marker-qw`, ~170 eski prob/çıktı (`*-out*.json`, `*.log`, `*.txt`, `page-*.yml`, `*-probe.js`, `*.mjs`, `*.py`) | Ölçüm çıktısı/geçici; repoda hiçbir dosya ve hiçbir belge adını anmıyor | ~123 MB |
| `debug.log` | Log, referans yok | 36 KB |
| `.opencode-data/` | Ajan çalışma verisi (boş), yalnız `.claudeignore`/`.gitignore`'da geçiyor | 0 |
| `.opencode-runtime/` | Ajan çalışma zamanı/log, referans yok | 408 KB |
| `ses-taslak/replik-ham/` | Ham voice-design kayıtları; kod/script kullanmıyor (yalnız İLERLEME.md düz yazıyla anıyor) | ~3,5 MB |
| `ses-taslak/yeni/` | Ham/taslak üretimler, referans yok | ~4 MB |

Not: `.playwright-mcp` içindeki 62 izlenen (git tracked) dosya taşındığı için `git status`'ta " D" görünür; commit edilirse silinmiş sayılır.
`raund-sonu-probe.js` önce taşındı, `K-RAPOR.md` adıyla andığı için geri alındı.

## 3. Dokunulmayan şüpheliler (emin değilim)
- `.playwright-mcp/` içinde kalan 48 giriş: `run.mjs`, `run-gpu.mjs`, `sshot.js`, `bandshot.js` (belgelerdeki çalıştırma komutları), belgelerde adı geçen ~45 prob/özet betiği, `K-RAPOR.md`, `qwer-out.json`. Adı geçtiği için tutuldu.
- `pvp/` ve `home/`: başka işçiler düzenlediği için hiç incelenmedi/dokunulmadı. Yetim aday listesi çıkarılmadı.
- `assets/higgsfield/` (~107 MB, `deneme/` build'de dışlı) ve `assets/_eski/` (2,7 MB, eski KayKit GLB arşivi): "assets" kuralı gereği taşınmadı; yayına girmiyor, en büyük kazanç buradan olur, karar kullanıcıda.
- `assets/models/*/kaynak/*.glb`, `assets/characters-src/`: scriptler kullanıyor, tutuldu.
- `ses-taslak/replik-kesilmis/`, `ses-taslak/sfx/`, `split_lines.py`: `docs/codex/J-KALAN-GOREVLER.md` ve İLERLEME.md anıyor.
- `galeri.html` (kökte yalnız 1 anma), `tests/_pending/*.disabled`, `GIZLILIK-BILDIRIMI-TASLAK.md`, `YAYIN-KONTROL-LISTESI.md`.
- Kök `*.css`/`*.js` dosyalarının hepsi başka dosyalarca anılıyor (yetim yok).

## 4. Eskimiş görünen belgeler (taşınmadı)
- `GIZLILIK-BILDIRIMI-TASLAK.md` (taslak), `YAYIN-KONTROL-LISTESI.md` (docs/KONTROL-LISTESI.md ile çakışıyor olabilir), `mdler/07-ara-ekranlar.md` (CLAUDE.md: portreler artık eşit boy), `.playwright-mcp/K-RAPOR.md`.
- `İLERLEME.md` satır 59/193 `ses-taslak/replik-ham/`'a atıf yapıyor; artık `_to_delete/` altında.

## 5. Doğrulama
- Taşınan ad/yollar için tüm repoda (node_modules, .git, _to_delete hariç) tekrar grep: kalan atıf yok (biri hariç: `raund-sonu-probe.js`, geri alındı). `debug.log`, `opencode-*`, `replik-ham` yalnız .gitignore/.claudeignore/İLERLEME.md düz yazı anmalarında geçiyor.
- `node --test tests/*.test.mjs`: `# tests 1011`, `# pass 1011`, `# fail 0`.
- `du -sh _to_delete` → 131M; `find _to_delete -type f | wc -l` → 603.

## 6. Geri alma
```
cd "$PROJE" && cp -an _to_delete/. . && git status --short | head
```
(`mv` ile geri almak için: `rsync -a --remove-source-files _to_delete/ ./` ya da `cp -an` sonrası `_to_delete` silinir.)

## 7. Kalıcı silme (kullanıcı çalıştıracak)
```
rm -rf _to_delete
```
