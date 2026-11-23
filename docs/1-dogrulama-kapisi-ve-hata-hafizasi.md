# 1 — Doğrulama kapısı ve hata hafızası (23 Kas 2026)

## Sorun
Model işleri test etmeden ve oyuna bakmadan "bitti" diyordu. CLAUDE.md'deki kurallar yalnızca tavsiye olduğu için atlanabiliyordu. Hafıza klasörü de boştu.

## Kurulan
| Parça | Dosya | Ne yapar |
|---|---|---|
| Stop hook | `scripts/hooks/dogrulama_kapisi.py` | Son kullanıcı mesajından bu yana kod dosyası (.js/.mjs/.css/.html/.py) düzenlendiyse ya da kod yazan bir alt ajan çalıştıysa, ana modelin `node --test` çalıştırmasını bekler. `home/`, `pvp/`, .css ya da .html değiştiyse tarayıcıda ekran görüntüsü de bekler. Bunlardan biri eksikse turu bitirtmez ve modele eksik olanı söyler. Model ikinci kez durmaya çalışırsa (`stop_hook_active`) sonsuz döngü olmasın diye engellemez, kullanıcıya "⚠ Doğrulama kapısı" uyarısı gösterir. |
| UserPromptSubmit hook | `scripts/hooks/hata_hafizasi.py` | Kullanıcının mesajında "yanlış, hata, olmadı, çalışmıyor, bozuk, kontrol etmedin, yine aynı…" gibi sözcükler geçerse modelin bağlamına bir not ekler: önce hatayı yeniden üret ve düzelt, sonra hafıza klasörüne bir feedback dosyası yaz (Why / How to apply) ve `MEMORY.md`'ye işaretçisini ekle. |
| Ayar | `.claude/settings.json` → `hooks` | İki betiği `python` ile çalıştırır. Node PATH'te olmadığı için Python seçildi. Bu dosya `.gitignore`'da, yani yalnızca bu bilgisayarda geçerli. |

## Doğrulama
- İki betik örnek girdilerle denendi: kod değişip test yoksa → engel; test ve ekran görüntüsü varsa → geçer; yalnızca md değiştiyse ya da Explore ajanı çalıştıysa → geçer; ikinci denemede → yalnızca uyarı. Düzeltme mesajı → not eklenir; normal mesaj → hiçbir şey olmaz.
- Bu oturumun gerçek transcript'i üzerinde de çalıştırıldı ve geçti.
- **Denenmedi:** Hook'ların Claude Code içinde gerçekten tetiklenmesi. Ayarlar yeni oturumda yükleniyor.

## Sınırlar
- Kapı, test komutunun **çalıştırılıp çalıştırılmadığına** bakar, sonucunun geçip geçmediğine bakmaz. Ekran görüntüsünün alınıp alınmadığına bakar, modelin onu doğru okuyup okumadığına bakamaz.
- Alt ajanın kendi çalıştırdığı test sayılmaz. Ana model kendisi doğrulamalı (CLAUDE.md'deki rol kuralıyla uyumlu).
- Kabukla yapılan dosya yazımları (`sed -i`, `> x.js`) kaba bir kalıpla yakalanır. Python/Node betiğiyle yazılan dosyalar yakalanmaz.
- Kapatmak için: `.claude/settings.json` içindeki `hooks` bölümünü silin.
