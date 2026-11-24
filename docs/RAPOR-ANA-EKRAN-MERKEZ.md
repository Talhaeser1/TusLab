# Ana ekran "Merkez" yeniden yapımı — rapor (23 Kas 2026)

## 1) Yapılanlar
1. `home/home.js` (938 satır) — 3B sahne kaldırıldı (`scene3d` artık ne import ediliyor ne kuruluyor; dosya yerinde duruyor).
   - :154 `CARDS` + `cardHTML`: 2×2 kart (Yazma Arenası, Klavye Dersleri, Şiir & Atasözü, PvP Düello). Kartın tamamı `<button>`; PvP kartı `<a href="?pvp=lobby">`.
   - :178 yeni iskelet: üst çubuk (logo `data-nav="hub"` = Merkez, 5 sekme, ses), Merkez (eyebrow, başlık, tek satır tanıtım, "▶ Yazmaya başla", "Kaldığın ders / İlk derse başla", 4 gerçek sayı, "Günlük görevler x/3" şeridi), ayrı `.tlh-write` (Yazma) ve `.tlh-module` (diğer bölümler) görünümleri.
   - :311 `lessonInfo()` — sıradaki açık ders `lessons.js`'teki `lessonUnlocked` ile, `tuslab-home-v1 → sec.egitim.lessons` kaydından; :323 `avgAcc()` son 10 sonucun doğruluğu (boşsa "—").
   - :328 `renderStats()` — en iyi WPM, ort. doğruluk, yıldız x/(ders×3=141), gün serisi; kart açıklamaları gerçek veriden (47 ders · 8 ünite · N bitti + ilerleme çubuğu; 234 atasözü · 26 şiir · 45 tekerleme · 91 deyim — `arena.itemsFor` sayıları).
   - :443 `mountPerf()` — Günlük Görevler + Seviye/XP + 8 rozet (adlarıyla) Performans görünümüne taşındı.
   - :490 `VIEWS.yazma` ve `VIEW_IDS` (#yazma #egitim #edebiyat #performans); :546 `setNav('hub')` logoya `aria-current="page"` verir, sekmelerden hiçbiri seçili olmaz.
   - :555/:607 `openView/closeView` Yazma görünümünü de yönetir (geçmiş/hash mantığı aynı); :700 `closeWrite()` yazıcıyı kapatır.
   - :667 `loadArena()` arena.js+typing.js'i Merkez açılışında önden yükler; :723 `newText()` ve :747 `startTyper()` akışa bağlı (`text: … ? '' : current.text`, `stream: … () => arenaMod.nextChunk(current.mode)`, :763 `onChunk` kaynak satırını günceller, biten her parça "daily"/"arena" görevine sayılır).
   - :789 `finishArena()` — akışta tek özet (WPM, doğruluk, süre, tamamlanan metin, en uzun kombo; "Yeni oturum ⏎" / "Merkeze dön"); Kelime'de eski tek metin sonucu. Hiç yazmadan Bitir/Esc → Merkez'e döner (sahte sonuç yazılmaz).
   - :824 tıklama: kartlar, CTA, kaldığın ders (intent `{lesson, index}` ile), görev şeridi → Performans, logo → Merkez (sayfa yenilenmez).
   - Korunanlar: `?pvp=` yönlendirme gözcüsü, `tlh-app-off`, `showHome/hideHome/watchPvp`, popstate, depolama, ses, toast, konfeti.
2. `home/home.css` (477 satır) baştan yazıldı: :24 durağan degrade + soluk tuş ızgarası + yavaş aurora; :79 Merkez ızgarası; :126 kartlar (hover'da 4 px kalkış, renkli kenar ışığı, PvP'de `lobi-afis.webp` + koyu degrade); :217 Yazma görünümü (1120 px, ortalanmış, büyük yazı, sakin — dönen neon çerçeve kaldırıldı); :415 ≤1100 px alt alta ve kayar; :423 ≤860 px alt sekme çubuğu, istatistik 2×2, kartlar tek sütun. Ölü kurallar silindi: `.tlh-scene*`, `.tlh-shade`, `.tlh-side`, `.tlh-player*`, `.tlh-main`, `.tlh-chip`, `.tlh-stats` (eski), `@property --ang`, `tlh-sweep`.
3. `tests/home-anasayfa.test.mjs` (yeni, 7 test): scene3d yok, PvP `?pvp=lobby` (sekme+kart), 5 sekme/4 görünüm/logo Merkez, akış bağlantısı birebir, satır içi işleyici/betik yok, eski site koruması, azaltılmış hareket+odak halkası.
4. `index.html` değişmedi (`git diff --stat -- index.html` boş).

## 2) Tasarım kararları
1. Taslak 1 "MERKEZ" esas alındı; ilk sürümün (a544772) gradyan başlığı, kart ikon kutusu ve "Aç →" dili geri getirildi; 3B eğilme/fare ışığı eklenmedi (sakin).
2. Görevler+rozetler Performans'a taşındı; Merkez'de yalnız tek satırlık "🗓️ Günlük görevler 2/3 →" şeridi var (karmaşa yaratmadan görünür kalsın diye).
3. Seviye/XP Merkez'den çıktı (taslakta yok); Performans'ta.
4. Merkez'de hiçbir sekme seçili değil; logo `aria-current="page"`. Yazma açıkken "Yazma" sekmesi seçili.
5. Akışta "↻ Yeni metin" gizli (metin kendiliğinden ilerler); Kelime'de görünür. Akış sırasında alt satırda "Kesintisiz akış · bitirmek için Bitir ya da Esc" ipucu.
6. Kontrast için `--tl-violet-ink:#b9a3ff` (#tl-home içinde) eklendi; ortak `:root` renkleri değiştirilmedi.
7. Görünüm arka planları %96 opak: Yazma'da Merkez arkadan sızmaz.

## 3) Doğrulama
1. `node --check home/home.js` temiz. Tüm testler: **1018 geçti / 0 kaldı** (önceki 1011 + 7 yeni).
2. Tarayıcı (kendi sekmem, 127.0.0.1:5176), ekran görüntülerine bakıldı:
   - 1366×768: Merkez tek ekran; `.tlh-menu` scrollHeight 702 = clientHeight 702, scrollWidth 1366 = genişlik. Konsol hatası yok. Sayfada canvas 0, scene3d/three isteği 0.
   - 1920×1080: menü 1014/1014, yatay taşma yok (bu ölçüde kartlar 720 px'e, başlık 96 px'e büyütüldü).
   - 1280×720: menü 654/654; kartlar 95–691 px, başlık bloğu 175–611 px (alt/üst boşluk eşit), kaydırma yok.
   - 390×844: Merkez dikey kayar (1567/722), yatay taşma yok (scrollWidth 390); alt sekme çubuğu etiketli; Yazma görünümünde taşma yok.
   - 360×740: yatay taşma yok; 12 px altı görünür yazı yok (JS ile tarandı).
3. Tıklama akışı: CTA → #yazma → ilk atasözü yazıldı → ikinci atasözü sonuç kartı OLMADAN geldi ("Metin 1", kaynak satırı güncellendi, "Atasözü modunda bir metin bitir" görevi düştü) → Esc → tek özet (WPM/%/sn/1 tamamlanan metin/kombo) → Esc → Merkez, sayılar güncellendi. Kelime: 26 kelime yazıldı → eski tek sonuç (Sonraki metin / Aynısını tekrar / Merkeze dön).
4. Kartlar ve sekmeler (JS ile tıklandı, durum ölçüldü): Yazma/Klavye Dersleri/Şiir & Atasözü kartları ve 4 sekme doğru görünümü açtı, hash ve `aria-current` doğru; logo her seferinde hash'i temizleyip Merkez'e döndü; "Kaldığın ders" → Klavye Dersleri.
5. PvP kartı → `?pvp=lobby` lobi açıldı (maç başlamadı); lobideki "← Ana Sayfa" → temiz adres, Merkez göründü.
6. Gizli panelde ekran görüntüsü bazen giriş animasyonunun ortasında (soluk) yakalandı; `getAnimations()` ile `tlh-rise` "finished" doğrulandı, ikinci görüntü normaldi.
7. Test edilemeyenler: gerçek telefon/dokunmatik, ekran okuyucu, `prefers-reduced-motion` açıkken görsel kontrol (yalnız CSS kuralı var), dersi olan bir kullanıcıyla "Kaldığın ders: N · başlık" metni (bu tarayıcıda ders kaydı yoktu; "İlk derse başla" görüldü).

## 4) Başka şeritte gereken değişiklikler
1. GEREKEN DEĞİŞİKLİK: `home/lessons.js` → `mountLessons(host, ctx)` içinde `ctx.intent?.lesson` (ders kimliği) veya `ctx.intent?.index` varsa haritayı değil doğrudan o dersi açsın (`go('lesson', { idx, preview:false, last:'' })`). Şu an "Kaldığın ders" düğmesi ders haritasını açıyor; haritadaki "Kaldığın yerden devam et" aynı derse götürüyor (bir tık fazla).

## 5) Kalan sorunlar
1. Tarayıcı denemesinde bu sekmenin `localStorage['tuslab-home-v1']` kaydına deneme sonuçları yazıldı (en iyi 1231 WPM, 2 metin, rozetler, 1 gün seri). Temizleme girişimim izin sistemi tarafından engellendi; kullanıcı isterse tarayıcıda bu anahtarı silebilir.
2. Yazma'dan oturum bitmeden çıkılırsa (Merkez/sekme) o oturumun sonucu kaydedilmez (bilinçli: yarım oturum sayılmaz).
3. 1100 px altı (tablet yatay) Merkez kayar; yalnız ≥ 1280×720 tek ekran garanti.
4. Geniş ekranda (1920) Merkez ortada 1560 px'e sınırlı; kenarlarda yalnız arka plan var.
5. Eski site (#app) arka planda gizli ama animasyonları çalışmaya devam ediyor (önceden de böyleydi, bu şeridin dışı).
