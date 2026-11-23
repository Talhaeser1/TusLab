# 15 — Ana ekran düğme/tuş denetimi ve onarım (Tuşçu, 24 Kas 2026)

Kapsam: ana sitenin PvP dışındaki bütün düğmeleri, tuşları ve işlevleri; `http://127.0.0.1:5177/index.html`, kendi sekmemde.
Kullanıcı verisi (`tuslab-home-v1` + 6 `tuslab-pvp-*` anahtarı) önce yedeklendi, sonda birebir geri yazıldı (karşılaştırma `true`).

## Envanter (öğe · beklenen · sonuç · düzeltme)

| Öğe | Beklenen | Sonuç | Düzeltme |
|---|---|---|---|
| Logo | Merkez, yeniden yüklemeden | çalışıyor (tık + Enter) | — |
| Üst gezinme: Yazma / Klavye Dersleri / Şiir & Atasözü / Performans | bölümü açar, sekme vurgulanır, odak "← Merkez"e | çalışıyor; hızlı ardışık 4 tıkta son tıklanan açık kaldı, tek görünüm, hata yok | — |
| PvP Düello (sekme + kart) | `?pvp=lobby` lobisi; lobideki "← Ana Sayfa" → temiz adres, Merkez | çalışıyor | — |
| Ses düğmesi | aç/kapa, kalıcı, gerçekten susar | kapalıyken `play()`/osilatör çağrısı 0; açınca `chime.mp3` çaldı; `d.sound` kalıcı | dokunmatikte 38→44 px |
| Telefon alt gezinme | 5 sekme, altta sabit | 375/390 px'te görünür, taşma yok | — |
| Yazma önizlemesi (tık), "Yazmaya başla" | Yazma açılır, aynı satır, odak yazma alanında | çalışıyor | — |
| Merkez'de harf | Yazma açılır, ilk harf doğru sayılır | `u` → "Uyuyan…" 0 hata | — |
| Ctrl+A, Alt+D, boşluk, Tab (Merkez) | başlatmaz | başlatmadı; Tab sırası Yazma→kartlar→metrik→dersler→PvP, odak halkası görünür | — |
| 5 edebiyat kartı | o türün akışı hemen | 5'i de doğru türü açtı, odak yazma alanında | — |
| Görev çipi / görev satırları / "Performans ayrıntıları" | Performans / ilgili iş | çalışıyor; "Atasözü modunda" görevi (sahte düğmeyle) Yazma'yı Atasözü kipinde açtı (Deyim'den geçildi) | — |
| Ders yolu adımları, "İlk derse başla"/"Kaldığın ders", "Tümü" | ders / harita | doğrudan dersi açıyor (DEVIR 1 zaten yapılmış), "Tümü" harita | dokunmatikte "Tümü" 30→44 px |
| Yazma: tür düğmeleri | metin türü değişir | çalışıyor; Kelime kipi ilk seçimde havuzu yükler ("Yükleniyor…" ~ anlık) | kelime havuzu ertelendi |
| Yazma: sayaçlar (WPM/doğruluk/hata/süre/metin), kombo | canlı | doğru; kombo parçalar arasında sürüyor, sonuçtaki "en uzun kombo" ile tutarlı | tuş başı maliyet düşürüldü |
| Ekran klavyesi (≥1000×800) | sıradaki tuş + Shift | ğ ü ş i ö ç ı doğru tuşu yaktı (i→İ, ı→I tuşu), büyük harfte karşı el Shift, boşluk | — |
| Yanlış tuş / Backspace | kırmızı, geri alınca düzelir | çalışıyor | — |
| Bitir / Esc (akış) | özet; hiç yazmadan → Merkez | çalışıyor; özetten Enter → yeni oturum, Esc → Merkez | — |
| Sonuç: Sonraki metin / Aynısını tekrar / Merkeze dön | | üçü de çalışıyor | — |
| Odak yazma alanından çıkınca harf | kaybolmamalı | **kayboluyordu** (kutuya tıklamak gerekiyordu) | düzeltildi |
| Uzun metin / satır kırılması | kelime bölünmeden | 3 satırlık görünümde kayarak ilerliyor | — |
| Klavye Dersleri: harita, kilit, Önizle | | 1/47, kilitliler 🔒 + "Önizle" | — |
| Ders 1'i baştan sona | yıldız, sonraki açılır, Merkez'e yansır | ★★★; Merkez: "Kaldığın ders: 2 · D ve K", 3 yıldız, yol 1 bitti/2 sıradaki, görev 3/3 | — |
| Ders ekranı | | **"null" yazısı görünüyordu** (yeni tuş kartlarının altında) | düzeltildi |
| Performans (boş + dolu) | tüm bölümler, "İlk yazını yap" | çalışıyor | — |
| Geri/ileri tuşu, `#yazma` `#edebiyat` `#performans` ile açılış, yenileme | | çalışıyor; **ama adresle açılan bölümden başka bölüme geçip "← Merkez"/Esc → önceki bölüme dönüyordu** | düzeltildi |
| Çift tık "Yazmaya başla" | tek yazıcı | tek yazıcı | — |
| Sızıntı: 15 aç/yaz/kapa döngüsü | | açık `setInterval` 0, DOM düğümü geri döndü (1235→1072) | — |
| Konsol | hata yok | hata/uyarı yok | — |

## Bulunan ve düzeltilen hatalar
1. **Ders ekranında "null" yazısı** — `home/lessons.js` `startAttempt` (≈355–357): `stage.replaceChildren(not ? … : null, tHost)`; `replaceChildren(null)` "null" metni ekler. Not yoksa yalnız yazıcı.
2. **Odak yazma alanından çıkınca basılan harfler kayboluyordu** (tür düğmesine/boş yere tıklayınca, `#yazma` ile açılışta) — `home/home.js` `typeToStart` (≈1304): açık yazıcı varsa odak ona verilir, tuş oraya düşer (Yazma, ders, Şiir & Atasözü). Boşluk düğme/bağlantı üstündeyse düğmeyi çalıştırır, Merkez'de başlatmaz.
3. **Geçmiş:** `#performans` adresiyle açılıp "İlk yazını yap" → Yazma → "← Merkez"/Esc kullanıcıyı Performans'a götürüyordu. `openView` (≈928–935) adresle açılmış bölümden geçişte kaydı değiştirir, kendi eklediği kayda `pushed: true` yazar; `closeView` (≈988) yalnız o zaman `history.back()`, yoksa adresi temizler.
4. **Dokunmatik hedefler** — `home/home.css` `@media (pointer: coarse)` (≈849): ses ve "Tümü" en az 44 px.
5. **DEVIR 4** — `home/egitim.css`: kullanılmayan `.tl-tabs/.tl-tab/.tl-filter(-row)/.tl-marathon/.tl-lit-grid/.tl-item(-text)/.tl-meaning/.tl-seq-*/.tl-lit-cat-ic/.tl-lit-cat-meta` (≈30 satır) kaldırıldı. Kanıt: her sınıf için `grep -- <sınıf> home/*.js` boş; dinamik `'tl-' +` kurulumu yok; projede başka JS/HTML'de yok.
6. **DEVIR 5** — `docs/codex/ANASAYFA-SOZLESME.md`: `mountTyper` tam imzası (stream/onChunk, dönen `setKeyboard/stop/stats/item/expected`), `matchStartKey`, `setText`, arena.js arabirimi (`loadWords/wordsReady`), `ders-kilit.js`, `ctx.intent`.
7. **DEVIR 1** ("Kaldığın ders" doğrudan dersi açsın) zaten yapılmıştı (`intentLessonIndex`); tarayıcıda doğrulandı. DEVIR'den 1, 4, 5 silindi.

## Optimizasyon ve ölçümler
**Tuş başına işlem** (Yazma, gerçek yazıcı; `input` olayı + ardından zorlanmış düzen, `performance.now`, 60 tuş):

| | medyan | p90 |
|---|---|---|
| Önce (910 px, klavye yok) | 7,7 ms | 13,8 ms |
| Sonra (aynı) | **1,3 ms** | 2,6 ms |
| Sonra (1440×900, ekran klavyesi açık) | **2,0 ms** | 2,9 ms |

En kötü tek değer (~15–21 ms) yalnız akışta yeni parça gelince (metnin yeniden kurulması, parça başına bir kez).

Neden: sayaç/kombo `textContent =` ile yazılıyordu; metin düğümü değişimi sayfadaki ~80 stil dosyasının yapısal seçicileri yüzünden tüm belgede ~6 ms stil hesabı tetikliyordu (aynı değeri metin düğümü verisiyle yazmak 0,8 ms). Bu, boşta da her 250 ms'de bir oluyordu.
- `home/typing.js`: yeni `setText(el, v)` (≈57; yalnız değişince, `firstChild.data`); `paintStats` (≈386) bunu kullanır; ilerleme çubuğu `width` yerine `transform: scaleX` (`egitim.css` geçişi de transform → her karede düzen yok).
- `home/home.js` `setCombo` (≈1113): değişmezse dokunmaz, metin düğümü verisi; sınıflar yalnız durum değişince.
- **Görünmeyen katmanlar** (`home/home.css` ≈23–33): eski site `#app` (yalnız `visibility:hidden`) altta sonsuz animasyonlar çalıştırıyordu (boss aurası, kıvılcımlar, imleç) → duraklatıldı. Bir bölüm açıkken Merkez, görünümün %96 opak + `backdrop-filter` katmanının altında boyanıyor ve arka plan bulutları (`filter: blur(90px)`) her kare hareket ediyordu → Merkez `visibility: hidden` (kaydırma konumu korunur), bulutlar `tlh-in-view` sınıfıyla durur.
- **Açılışta inen dosyalar** (önce → sonra): `home/data/words.js` 104 KB ve `home/lessons.js` 25 KB artık açılışta inmiyor; eski sitenin görünmeyen PvP vitrini 137 KB'lık `lobi-afis.webp`'i indiriyordu → kapatıldı (`html body #app .home-pvp-entry.lb3-home`); PvP kartı 720 px'lik kopyayı kullanıyor (`assets/home/pvp-kart.webp`, 39 KB, PIL ile üretildi). Toplam ≈ **266 KB → 41 KB** (−225 KB). Ölçüm: açılıştaki kaynak listesinde words.js, lessons.js, lobi-afis.webp yok; görsel yalnız pvp-kart.webp.
  - Kelime havuzu: `home/arena.js` `loadWords()/wordsReady()` (dinamik import); `home.js` `needWords` Kelime kipini havuz gelene dek bekletir (bu arada basılan harfler saklanır). Son kip "Kelime" ise önizleme için açılışta yine iner (kullanıcı seçimi).
  - Ders kilidi: yeni `home/ders-kilit.js` (`lessonUnlocked`, `intentLessonIndex`, `lessonRec`; saf); `lessons.js` buradan alır ve yeniden dışa verir; `home.js` açılışta bunu yükler. Fare/odak Dersler paneline, `Klavye Dersleri` sekmesine ya da ders görevine gelince `lessons.js` önden yüklenir; "Kelime" düğmesine gelince kelime havuzu.
- Sızan dinleyici/zamanlayıcı: bulunmadı (yukarıdaki döngü testi; `literature.js` belge dinleyicisini `destroy`'da kaldırıyor).

## Karar (şöyle yorumladım)
- "Atasözü modunda bir metin bitir" görevi kaldı: Yazma'yı Atasözü kipinde açıyor, akışta biten her atasözü parçası sayılıyor (`onChunk` → `['daily','arena']`). Bugünün görev listesinde değildi; açma davranışı sahte bir `data-quest="arena"` düğmesiyle denendi, sayma kodla doğrulandı.
- Odak geri verme ders ve Şiir & Atasözü yazıcılarına da uygulandı (aynı sorun oradaydı); form alanında (serbest alıştırma "Ekle" kutusu) yazarken devreye girmez.

## Test
- `node --test tests/*.test.mjs` → **tests 1124 / pass 1124 / fail 0** (home: 63/63; yeni `tests/home-tuslar.test.mjs` 11 test; `home-metin-akisi` kelime havuzunu bekleyecek, `home-kokpit` boşluk kuralı, `home-anasayfa`/`home-kartlar` pvp-kart.webp için güncellendi).

## Tarayıcıda görülenler (ekran görüntüsüyle)
1440×900 Merkez ve Yazma (ekran klavyesi, ilerleme çubuğu, hatalı harf), 1280×720 Merkez (kaydırmasız 654/654), 375×812 Merkez + Yazma, ders ekranı ("null" önce görüldü, sonra yok), ders haritası, sonuç kartı. 1100×800 ve 390×844: ekran görüntüsü aracı emülasyonu kırptığı için DOM ölçümüyle bakıldı (yatay taşma yok: 1092/1092, 382/382; 12 px altı yazı yok).

## Görmediklerim / düzeltilmeyenler
- Gerçek telefon/dokunmatik, ekran okuyucu, `prefers-reduced-motion` açık tarayıcı; gerçek ses çıkışı kulakla (yalnız `play()`/osilatör çağrıları sayıldı).
- Tarayıcı paneli çoğunlukla gizliydi: giriş animasyonları elle bitirildi; ölçümler `requestAnimationFrame` yerine `setTimeout` aralıklarıyla.
- Odak yazma alanı dışındayken **Backspace** yönlendirilmez (yalnız yazılabilir karakterler); düşük öncelik.
- Akışta pencere/sekme değişince süre işlemeye devam eder (diğer yazma testleri gibi); duraklatma tasarım kararı, dokunulmadı.
- Kelime kipinde Esc sonuç göstermeden Merkez'e döner (tek metin, "Bitir" düğmesi yok) — eskisi gibi.
- `.tlh-view` ve `.tl-typer-box` `backdrop-filter` blur'u görsel dil olduğu için bırakıldı (altları artık durağan).
- `cloudflare/public` aynası güncellenmedi, `npm run cf:validate` çalıştırılmadı (sahiplik dışı). `tuslab-pvp-fighter` PvP lobisini açınca `murad1` → `nyx` olmuştu (padişah kaldırma işi); birebir geri yazıldı (`murad1`).
- Commit yok.
