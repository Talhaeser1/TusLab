# 21 — Ana site tuş, düğme ve görev turu (Gözcü, 24 Kas 2026)

Kapsam: ana sitenin PvP dışındaki bütün düğmeleri, tuşları, görevleri ve rozetleri; yeni "Sahne" ana ekranıyla birlikte.
Adres `http://127.0.0.1:5177/index.html`, kendi sekmem. Kâşif aynı anda `pvp/` üzerinde çalıştı ve oturum sırasında en az bir kez
`localStorage`'ı tümden sildi. Bu yüzden testler tek seferlik betiklerle yapıldı. Sonunda `tuslab-home-v1` yedekten birebir geri
yazıldı (karşılaştırma `true`). Benim eklediğim `tuslab-home-kb` silindi. PvP anahtarlarına dokunulmadı.

## Envanter (öğe · beklenen · sonuç · düzeltme)

| Öğe | Beklenen | Sonuç | Düzeltme |
|---|---|---|---|
| Üst menü: 4 bölüm | bölüm açılır, sekme `aria-current`, Esc → Merkez | çalışıyor | — |
| PvP sekmesi ve kartı | `?pvp=lobby` | bağlantı doğru (lobi Kâşif'in alanı, açılmadı) | karta tek parça erişilebilir ad eklendi, ⚔️ gizlendi |
| Logo | Merkez | çalışıyor | dokunmatikte 42 → 44 px |
| Ses düğmesi | aç/kapa, kalıcı | `aria-pressed`, etiket ve `d.sound` doğru | — |
| Telefon alt menüsü | 5 sekme, içeriği örtmez | 390/360: son kart 756, menü 782'den başlıyor | **844×390 yatayda yazı kutusunu örtüyordu** → yatayda sekmeler üst çubuğa taşındı |
| "Yazmaya başla", "İlk derse / Kaldığın ders" | Yazma / kaldığın ders | çalışıyor | — |
| Canlı satır (tık, harfle başlama) | aynı satır, ilk harf doğru | `t` → "Tatlı dil…" ilk harf doğru, 0 hata | — |
| 4 sayı | gerçek değerler | doğru | etiketler daha açık renk, üstte solan ince çizgi, kısa ekranda sıkı |
| Yazma kartının 6 tür çipi | o türle Yazma | **çalışmıyordu: süs olarak duran `<i>`'lerdi, kart düğmesinin içindeydi** | gerçek düğmeler (`data-wmode`), kart bölüm oldu. 6'sı da doğru kipi açtı. `home/data/words.js` yalnız Kelime'de indi (15,5 sn'deki tık) |
| Yazma kartı boşluğu | — | başlık ile klavye arası ~150 px boştu | "Son yazış · Rekor · Bugün" rozetleri eklendi (telefonda gizli) |
| Dersler kartı: halka, 3 adım, kilit, "Ders haritası", gövde | | çalışıyor; ders bitince halka 0→1, adım "2 sıradaki", "Kaldığın ders: 2" | adımlara okunur ad ("Ders 5: G ve H, sıradaki") |
| Şiir & Atasözü kartı: söz, 5 çip, ok, gövde | | 5 çip doğru türü açtı, ok ve gövde tür menüsünü açtı | — |
| Performans kartı: eğri, "İlk yazını yap", 3 görev | | çalışıyor ama **boşken düğme eğrinin üstündeydi** (CTA 699–735, eğri 653–714) | boşken başlık gizli, eğri üstte, düğme altta. Görevler üst çizgiyle ayrı bölüm |
| Günlük görev satırları | o işi açar | ders → kaldığın ders, lit → tür menüsü, arena → Atasözü kipi (Deyim seçiliyken de) | okunur ad ("…: 0/1, başla") |
| Yazma: tür düğmeleri, Bitir/Esc, sonuç (Yeni oturum/Enter, Merkez/Esc, Sonraki, Aynısını tekrar, ↻ Yeni metin) | | çalışıyor | — |
| Yazma: Türkçe karakterler, Backspace | | gerçek tuşla "Yiğidi öldür," 0 hata; yanlış `x` kırmızı, Backspace ile düzeldi | — |
| Ekran klavyesi aç/kapa | ortak, kalıcı tercih | **gizli Yazma görünümündeki düğme eski durumu gösteriyordu** (etiket ile klavye ters düşüyordu) | sayfadaki bütün düğmeler birlikte yenileniyor |
| Ders: harita (←/→/↓/Home/End), kilitli ders önizleme | | çalışıyor; önizleme depoya hiçbir şey yazmadı | — |
| Ders sonucu: Sonraki / Tekrar / Zayıf tuşlarımı çalış / Harita / Merkez | | hepsi çalışıyor; önizlemede "Sonraki" kapalı | — |
| Serbest Alıştırma | 1280×720'de kaymasın | **36 px kayıyordu** | kısa ekran kuralı → 593/593. Ö+Ş seçimi, Başla, sonuç, Yeni kelimeler çalışıyor |
| Şiir & Atasözü oturumu: Esc, özet, Devam et / Tüm türler / Merkez | | çalışıyor | — |
| Adres: `#egitim` ile yenileme, `#performans`, geri/ileri, Esc zinciri | | çalışıyor | — |
| Kısa deneme (birkaç harf + Esc) | rekor sayılmamalı | **3 kelimelik hızlı başlangıç "Yeni kişisel rekor" ve en iyi WPM yazıyordu** | <20 harf ve 0 metin: sonuç görünür, kaydedilmez ("Kısa deneme…") |
| egitim.css | bir kez | **iki kez yükleniyordu** (kabuk + typing.js) | ikinci ekleme engellendi |

## Görev ve rozet tablosu (gerçekten yapılarak; gün değişimi `Date` kaydırılarak)

Görev havuzu (`home.js` QUESTS): her gün `lesson` + `acc98` + dönüşümlü biri (`daily`, `wpm35`, `lit`, `arena`).

| Görev | Koşul | Denendi | Sonuç |
|---|---|---|---|
| 1 ders bitir | ders geçilir | 0. gün Ders 1, 1. gün **aynı dersin tekrarı** | önceden tekrar sayılmıyordu (yalnız yıldız artışı); düzeldi ✓ |
| %98 doğrulukla yaz | biten metin ≥ %98 | Yazma, ders, Şiir | ✓ |
| Yazma'da 2 metin bitir | akışta 2 parça | 1. parçada 1/2, 2.'de ✓ | ✓ |
| 35+ WPM | biten metin ≥ 35 | 1. gün | ✓ |
| Şiir & Atasözü'nde 1 metin | ≥ 1 parça | 2. gün | **önceden hiç sayılmıyordu** (sonuç bulunamıyordu); düzeldi ✓ |
| Atasözü modunda 1 metin | atasözü parçası | 3. gün (önce Deyim seçiliydi) | ✓ |
| 3/3 | | | "Bugünün 3 görevi tamam!" bildirimi eklendi; `allQuests` +1 |
| Gün değişimi | sayaçlar sıfırlanır | 1., 2., 3. gün | ✓. Sekmeye dönünce gün değiştiyse Merkez yenileniyor (yeni) |
| Gün serisi | ardışık gün +1, boşlukta kırılır | 0→1→2→3→4, 5. gün (4 atlandı) önce 0, yazınca 1; 5–11 → 7 | ✓ |

| Rozet | Koşul | Kazanıldı mı |
|---|---|---|
| İlk Adım | 1 biten metin | ✓ |
| 40 WPM / 60 WPM | en iyi hız | ✓ / ✓ |
| Kusursuz | %100 biten metin | ✓ |
| Görev Avcısı | bir gün 3/3 | ✓ |
| 3 Gün Seri / 7 Gün Seri | seri | ✓ / ✓ |
| 10 Yıldız | ders yıldızı ≥ 10 (Ders 1–4, 3'er yıldız) | ✓ |

8 rozetin 8'i kazanıldı. Performans'ta 8'i, Sv. 5 ve XP çubuğu görüldü. Boş durum, 1 kayıt ve 15 kayıt görüldü.

## Düzeltilen hatalar (dosya)
1. **Ders tekrarı, zayıf tuş ve serbest alıştırma görev/seri/geçmişe sayılmıyordu.** Ayrıca **Şiir & Atasözü oturumu hiç sayılmıyordu** (`findResult` iç içe kaydı bulamıyordu). `home/lessons.js` `resultEvent` + 3 çağrı, `home/literature.js` `summary` olay kaydı (`all.last`) bırakıyor. `home/home.js` `makeCtx.save` bunu okuyor ve depoya yazmıyor. Ders geçince `lesson`, Şiir & Atasözü'nde ≥1 metinle `lit` sayılıyor. Ders ve alıştırmalar artık geçmişe ("Ders") ve zayıf tuşlara da giriyor.
2. **Yazma kartı çipleri işlevsizdi.** `home/home.js` şablonu (`WMODES`, `data-wmode`, tık işleyicisi, Kelime önden yükleme). `home/home.css` çip, rozet ve düğme stilleri; odak `:has(:focus-visible)`.
3. **Performans kartı boş durumu üst üste biniyordu.** `home/home.css` `.tlh-met-slot` ve `.tlh-mq-box`.
4. **1280×720 Serbest Alıştırma kayıyordu.** `home/egitim.css` kısa ekran bloğu.
5. **Telefon yatayda alt menü yazı alanını yiyordu.** `home/home.css` yatay blok (sekmeler üstte, dar yatayda yalnız simge, ad erişilebilir).
6. **Klavye düğmeleri senkron değildi.** `home/typing.js` `kbToggle`.
7. **Kısa deneme rekoru şişiriyordu.** `home/home.js` `finishArena` (`short`) ve `makeCtx.save`, `home/literature.js`.
8. **Çift egitim.css yükleniyordu.** `home/typing.js` `ensureStyles`.
9. **Dokunmatikte 44 px altı hedefler vardı:** logo, Yazma çipleri, ← Merkez, tür düğmeleri (38), Bitir, Ders Haritası / Tüm türler (38), harita atlama çipleri (40), ok düğmeleri (32 genişlik). `home/home.css` ve `home/egitim.css` `pointer: coarse` blokları; 360×740'ta yeniden ölçüldü, kalan yok.
10. **Erişilebilir adlar:** ders adımı, görev satırı, PvP kartı, kart içi "Yazmaya başla" ("Yazma Arenası: yazmaya başla"; sahnedekiyle aynı ad olmasın diye).
11. 3/3 bildirimi, sekmeye dönünce gün değişimi yenilemesi (`visibilitychange`).

## Tasarım cilası (önce/sonra ekran görüntüsüyle)
- Yazma kartı: başlık ile klavye arasındaki boşlukta 6 tür çipi (3×2) ve 3 kişisel rozet var, altta "Yazmaya başla →" düğmesi duruyor. 1280×720'de çipler tek satıra iniyor, rozetler gizli. Telefonda rozetler gizli; 768 px'te klavye görselinin üstüne biniyordu, görülüp düzeltildi.
- Performans kartı: boşken soluk örnek eğri üstte, "İlk yazını yap" altta duruyor; görevler ince çizgiyle ayrı. 1 kayıtta tek nokta görünüyor.
- Sol sahne: sayıların üstünde solan ince çizgi var, aralık 36 → 28 px oldu, etiketler daha açık (#aeb6de).
- Görüp düzeltme turları: ilk denemede 1280×720'de 7 px taşma çıktı (Performans kartı 10 px uzamıştı) → kısa ekranda sıkılaştırıldı, sonuç 654/654. 768'de rozet–klavye çakışması da görüp düzeltildi.
- Kontrast (koyu zemine göre hesap): gri metinler ≥5:1. Tek istisna canlı satırın yazılacak kısmı (≈2,4:1); bilerek soluk, metnin tamamı ekran okuyucuya ayrıca veriliyor.

## Ölçümler
- Kaydırmasız: 1440×900 834/834, 1280×720 654/654, Serbest Alıştırma 1280×720 593/593.
- Yatay taşma yok: 390, 360, 844×390, 768, 1100. 12 px altı yazı hiçbir görünümde yok.
- Tuş başına (Yazma, 1440×900, ekran klavyesi açık, 60 tuş): medyan **2,2 ms**, p90 3,0 ms (15. rapor 2,0 ms; panel gizliyken ölçüldü, fark gürültü düzeyinde).
- Konsolda hata yok.

## Şöyle yorumladım
- Yazma kartı artık `<button>` değil, `<section>`: iç içe düğme geçersiz olduğu için. Kartın boş yerine tıklamak yine Yazma'yı açar.
- Görevler: **ders tekrarı da "1 ders bitir" sayılıyor** (geçmek şartıyla). Ders ve alıştırmalar "%98" ve "35+ WPM" görevlerini de tamamlayabiliyor. Önizleme hiçbir şey saymıyor.
- Şiir & Atasözü'nde hiç metin bitmeden kapatılan oturum: hız ve rekor sayılmıyor, zayıf tuşlar sayılıyor.
- Yazma akışında 20 harften kısa ve 0 metinlik deneme kaydedilmiyor; sonuç kartında nedeni yazıyor.
- Telefon yatayda (≤860 px genişlik ve ≤500 px yükseklik) sekmeler üst çubukta duruyor.

## Düzeltilmeyenler / görmediklerim
- Gerçek telefon, gerçek dokunmatik ve ekran okuyucu yok. 844×390 ve 768 özel boyutlar dokunmatik emülasyonu vermiyor, dokunmatik ölçüsü 390/360'ta yapıldı.
- Gerçek `prefers-reduced-motion` ayarı denenmedi; yalnız CSS kuralları eklendi.
- Ekran görüntüleri panel ölçeğinde (800 px'e küçültülmüş); ince ayrıntılar DOM ölçümüyle doğrulandı.
- Sekme gizlenince canlı satırın durması yalnız koddan okundu (`document.hidden`), elle denenmedi.
- Merkez'de gerçek `type` aracı `keydown` göndermiyor; harfle başlama `key` ve olay gönderimiyle denendi.
- Akışta ≥20 harf yazıp hiç metin bitirmeden çıkmak hâlâ "biten metin" sayılıyor (eski davranış).
- Kelime kipinde Esc sonuçsuz Merkez'e döner (eski davranış).
- `İLERLEME.md`'ye yazılmadı (sahiplik dışı). `npm run cf:validate` çalıştırılmadı. Commit yok.

## Test
`node --test tests/*.test.mjs` → **tests 1167 / pass 1167 / fail 0**. Ana ekran: 86/86; yeni `tests/home-gozcu.test.mjs` 10 test.
`home-kartlar`, `home-sahne` ve `home-yazma-ekranlari` yeni yapıya göre güncellendi.
