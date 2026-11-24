# 26 — Şiir & Atasözü menüsü, "Ana Sayfa" adı, ortak ses (Derleyici, 24 Kas 2026)

docs/25'in ana site tarafındaki "karar gerekir" maddeleri. Kararlar orkestradan geldi.

## Yapılanlar
1. **Şiir & Atasözü tür menüsü** (`home/literature.js` `renderMenu`/`menuMove`, `home/home.css` "Şiir & Atasözü tür menüsü" bölümü):
   sayfayı dolduran bento. Üstte başlık + **Günün sözü** şeridi ("Atasözleri yaz →" gibi, sözün türünü açan düğme),
   ortada **2 büyük + 3 orta** tür kartı (6 sütun): motif, ad, sayı, kısa açıklama, **örnek satır** (var olan içerikten,
   her açılışta rastgele: şiirde ilk iki dize, deyimde kalıp + anlam, özdeyişte yazar), ilerleme çizgisi, "N metin yazdın",
   "en iyi hız", **Başla**. Altta **Son yazdıkların** (türlerin son oturumu: bitirilen son metin, WPM, "bugün/dün"; tıklayınca
   o türde devam) ya da kısa ipucu. Kartlar kalan yüksekliği paylaşır (≥901 px genişlik ve ≥600 px yükseklikte kaydırmasız).
   ≤900 px iki sütun (5. kart tam genişlik), ≤600 px tek sütun. 1280×720/1366×768'de orta kartlarda açıklama gizli.
   - Klavye: açılışta ilk kart (özetten "Tüm türler" ile dönülünce o tür) odakta; **ok tuşları** ekrandaki konuma göre
     kartlar arasında gezinir, Home/End ilk/son, Enter başlatır. Odak halkası tür renginde; azaltılmış harekette kayma ve geçiş yok.
   - Oturum özeti artık `litStreams[tür].last.t` (zaman) ve `recent` (bitirilen son 3 metin, ≤400 harf) kaydeder.
   - **Günün sözü** artık gün içinde sabit ve ana ekran kartıyla aynı: `home/arena.js` `dailyQuote()` (kısa atasözü +
     özdeyiş havuzundan gün anahtarının özetiyle). Önceden ana ekranda her açılışta rastgeleydi.
2. **Ad: "← Ana Sayfa"** (`home/home.js`, `home/lessons.js`, `home/literature.js`): görünüm başlığındaki geri düğmeleri
   (aria-label "Ana Sayfaya dön"), logo aria-label, Yazma sonucu "← Ana Sayfa Esc", ders ve Şiir & Atasözü sonuç
   düğmeleri, "Esc Ana Sayfa" / "Esc: Ana Sayfa" ipuçları. Kod adları ve yorumlar değişmedi.
3. **Ortak ses** (`home/home.js`, `home/sfx.js`): `localStorage['tuslab-ses']` = 'on'/'off'. Açılışta önce bu okunur;
   yoksa `tuslab-home-v1.sound` değeri buraya taşınır. Aç/kapa ikisini de yazar. `storage`, `visibilitychange` (görünür)
   ve `pageshow`'da yeniden okunur, düğme ve ses modülü güncellenir. PvP alt ayarlarına (müzik/efekt) dokunulmadı.
4. **Ana ekran Günün sözü kaynağı** (`home/home.css` `.tlh-quote figcaption`): üç noktayla kısalmak yerine ikinci satıra iner.
5. `docs/DEVIR-ANA-EKRAN.md`, `docs/codex/ANASAYFA-SOZLESME.md` güncellendi.

## Şöyle yorumladım
- "Son yazdıkların" için kalıcı kayıt gerekiyordu: türün son oturumu + bitirilen son metinler `litStreams`'e eklendi
  (eski kayıtlarda metin yok, "N metin" yazar). `r.best` artık `r.last` ile aynı nesne değil, kopya.
- Sonuç ekranlarındaki "Merkez" düğmesi de PvP gibi oklu: "← Ana Sayfa".
- Günün sözünü "günün" yapmak için iki yerde aynı söz seçildi (gün içinde sabit).

## Test
`node --test tests/*.test.mjs` → **tests 1202 / pass 1202 / fail 0** (başta 1195; yeni `tests/home-derleyici.test.mjs` 7 test;
`home-yazma-ekranlari`, `home-sahne`, `home-tuslar` beklentileri yeni ada/söze göre güncellendi). PvP testleri bu koşuda geçti.

## Tarayıcıda görülenler (127.0.0.1:5177, kendi sekmem, ekran görüntüsüyle)
- Kullanıcı verisi (`tuslab-home-v1`) önce yedeklendi (`derleyici-ls-yedek.json`, oturum karalama klasörü), sonda birebir geri
  yazıldı (karşılaştırma `true`); `tuslab-ses` silindi.
- Menü: 1920×1080 (952/952), 1440×900 (772/772), 1366×768 (640/640), 1280×720 (592/592) kaydırmasız, yatay taşma yok,
  kart içinde taşan/üst üste binen öğe yok, 12 px altı yazı yok. 768×1024 iki sütun, 390×844 tek sütun (yatay taşma yok).
- Gerçek tuşlarla: → ve ↓ (Atasözleri → Deyimler → Özdeyişler), End + ↑ (Özdeyişler → Deyimler), odak halkası görüldü;
  Enter Özdeyiş oturumunu açtı, metin yazıldı, Esc → özet ("← Ana Sayfa" düğmesi, "Esc: Ana Sayfa"), "Tüm türler" →
  menüde "Son yazdıkların" şeridi ve Özdeyişler kartında 1 metin / en iyi hız göründü.
- "← Ana Sayfa": Şiir & Atasözü, Klavye Dersleri (ders alt bilgisi "Esc Ana Sayfa"), Yazma sonucu ("← Ana Sayfa Esc").
- Ses: düğmeyle kapat → `tuslab-ses`='off', `tuslab-home-v1.sound`=false, düğme 🔇; anahtar elle 'on' + storage olayı → 🔊;
  'off' + visibilitychange → 🔇; **ikinci sekmede** `tuslab-ses`='on' yazılınca ilk sekmede gerçek storage olayıyla 🔊.
- Ana ekran 1366×768 ve 1280×720: "— Mustafa Kemal Atatürk" (DOM'a elle konarak) ikinci satırda tam; kart ve sayfa taşmıyor.
- `html.reduced-motion`: odaktaki kartta kayma yok (transform none), geçiş 0 s. Konsolda hata yok.

## Görmediklerim
- PvP tarafında ortak anahtarın okunması (Nişancı'nın işi); ses düğmesi kapalıyken gerçek ses çıkmadığını bu turda saymadım
  (yalnız düğme durumu ve `setEnabled` yolu).
- Gerçek `prefers-reduced-motion`, ekran okuyucu, gerçek telefon/dokunmatik; 844×390'da menü; gerçek sekme değiştirme
  (visibilitychange elle tetiklendi).
- Yazma sonucu ve ders ekranı yalnız 1280×720'de bakıldı. Commit yok.
