# 10 — Ana ekran "kokpit" (Mimar, 24 Kas 2026)

## Düzen
Üst gezinme çubuğu aynı. Merkez artık tek ekranda beş panel (CSS grid alanları):

| Sol (250–310 px) | Orta | Sağ (280–350 px) |
|---|---|---|
| **Eğitim metriklerin**: 4 sayı (2×2), hız grafiği yuvası, günlük görevler çipi, "Performans ayrıntıları" | **Yazma Arenası**: önizleme satırı + imleç, 6 tür düğmesi, "Yazmaya başla" | **Klavye Dersleri**: ders/ünite özeti, ilerleme çubuğu, 4 adımlık ders yolu, "İlk derse başla / Kaldığın ders", "Tümü" |
| (iki satır boyunca) | **Atasözü · Deyim · Şiir · Tekerleme**: 4 çip (sayılarıyla) + "Tüm türler" | **PvP Düello** (lobi afişli küçük kart → `?pvp=lobby`) |

- ≤1180 px: iki sütun (Yazma, tür şeridi tam genişlik; altında Dersler | Metrikler, PvP). ≤860 px: tek sütun, sıra Yazma → tür şeridi → Dersler → Metrikler → PvP; alt sekme çubuğu aynı.
- Görseller: `kart-dersler.svg` Dersler panelinin, `kart-edebiyat.svg` tür şeridinin soluk arka katmanı. `kart-yazma.svg` artık kullanılmıyor (içindeki "Damlaya damlaya…" yazısı önizleme metniyle çakışıyordu); dosya yerinde.

## Verilen kararlar (şöyle yorumladım)
1. **Yazma ortaya gömülmedi, önizleme paneli yapıldı.** Merkez'e canlı yazıcı gömmek; açılışta otomatik odak (telefonda klavye açılması), Esc/sonuç kartı ve görünüm geçmişiyle çakışma riski taşıyordu. Bunun yerine: önizlemedeki satır akışın gerçek ilk parçası (`peek`); "Yazmaya başla", önizlemeye tıklamak ya da **herhangi bir harfe basmak** Yazma görünümünü açar, **aynı satır** yazılır ve basılan harf kaybolmaz (yazıcıya aktarılır, odak doğrudan yazma alanına geçer). Merkez'deki tür düğmeleri yalnız önizleme satırını değiştirir.
2. Tür çipleri Şiir & Atasözü bölümünü `intent: { cat }` ile açar; `literature.js` kategori menüsünü atlayıp o türün kesintisiz akışını hemen başlatır. "Tüm türler" kategori menüsünü (özdeyiş dahil) açar.
3. Ders yolundaki biten/sıradaki/açık dersler tıklanabilir (o dersi açar), kilitliler değil. "Tümü" ders haritasını açar.
4. "Diğer yerlerde atasözü olmasın": Dersler (`lessons.js`) ve Performans görünümünde atasözü/deyim **girişi (kart/bağlantı) zaten yoktu**; kaldırılacak bir şey bulunmadı. Performans'taki görev metinleri ("Atasözü modunda bir metin bitir") ve "Ustalık" ünitesindeki ders metinleri içerik olduğu için dokunulmadı.
5. Gövdede (odak hiçbir yerdeyken) Esc artık görünümü kapatıyor: eski site/PvP dinleyicileri Esc'yi önceden `preventDefault` ettiği için Şiir & Atasözü kategori menüsünden Esc ile dönülemiyordu.
6. Klavye sırası: Yazma → tür şeridi → Metrikler → Dersler → PvP (görsel sıra soldan sağa değil, odak önce ana işe gider).

## Optimizasyon
- Yeni modül/istek eklenmedi; açılışta yüklenenler aynı (arena.js + typing.js + data/lessons.js + lessons.js + sfx.js). Yazıcı Merkez'de kurulmaz.
- Görseller CSS arka planı (yalnız görünen panelde iner), `<img>` eklenmedi.
- Düzen kayması önlemleri: önizleme metni 3 satır yer ayırır (`min-height: 4.5em`), ders yolu 4 satır yer ayırır, çip sayıları sabit kutuda. Giriş animasyonu yalnız opacity/transform.
- Azaltılmış hareket: imleç yanıp sönmesi, giriş ve hover dönüşümleri kapalı (`prefers-reduced-motion` ve `html.reduced-motion`).

## Dosyalar
- `home/home.js`: kart dizisi → `LIT` + kokpit iskeleti; `renderPath`, `renderSpark`, önizleme (`ensurePeek/takePeek/renderPreview`), `flushPending`, `typeToStart`; `setMode` Merkez'de yalnız önizlemeyi değiştirir; tıklama: `data-lit`, `data-lesson`, `perf`, `lessons`, `lit-all`.
- `home/home.css`: eski Merkez/kart blokları → kokpit blokları; duyarlı kurallar (1400/1180/860, `pointer: coarse`), `.tlh-btn--gold`, `tlh-blink`, azaltılmış hareket listesi.
- `home/literature.js`: `ctx.intent.cat` ile doğrudan oturum.
- Testler: `tests/home-anasayfa.test.mjs`, `tests/home-kartlar.test.mjs` yeni düzene güncellendi; yeni `tests/home-kokpit.test.mjs` (6 test).
- `index.html`, `pvp/`, `cloudflare/`, `app.js` değişmedi.

## Test
`node --test tests/*.test.mjs` → **tests 1087 / pass 1087 / fail 0**.

## Tarayıcıda görülenler (127.0.0.1:5177, ekran görüntüsüyle)
- 1440×900: beş panel kaydırmasız (`.tlh-menu` 834/834, yatay 1440/1440).
- 1280×720: kaydırmasız (654/654, yatay 1280/1280). İlk denemede taşma vardı (tür düğmeleri iki satır, ders düğmeleri iki satır); 1400 px altında düğme ikonları gizlendi, "Tümü" özet satırına alındı.
- 390×844: tek sütun, doğru sıra, yatay taşma yok (382/382), 12 px altı görünür yazı yok.
- Tıklamalar: harfe basınca Yazma açıldı, önizlemedeki satır yazıldı, ilk harf doğru sayıldı (yanlış harfte hata sayıldı); "Yazmaya başla" → odak yazma alanında; 4 tür çipi doğru oturumu açtı (Atasözleri/Deyimler/Şiirler/Tekerlemeler); "Tüm türler" → kategori menüsü; ders adımı ve "İlk derse başla" → ders; "Tümü" → ders haritası; Performans ve görev çipi → #performans; PvP kartı → `?pvp=lobby` lobisi açıldı, lobideki "Ana Sayfa" → temiz adres, Merkez göründü; logo ve Esc → Merkez. Konsolda hata yok.

## Görmediklerim
- Gerçek telefon/dokunmatik ve ekran okuyucu; `prefers-reduced-motion` açık tarayıcı (yalnız CSS kuralı ve test).
- "Kaldığın ders: N · …" metni (bu tarayıcıda ders kaydı yok, "İlk derse başla" görüldü).
- 1100–1180 px arası ve 1920 px geniş ekran ekran görüntüsüyle bakılmadı.
- Tarayıcı paneli gizliyken çekildiği için giriş animasyonları elle bitirildi (`getAnimations().finish()`).
- `npm run cf:validate` çalıştırılmadı; `cloudflare/public` aynası güncellenmedi (dokunma yasağı).

## Sonraki ajanlara bırakılan yerler
- **Metrik**: sol panel `.tlh-k-met`; grafik yuvası `.tlh-met-slot[data-slot="metrik-grafik"]` (şu an `renderSpark()` son 12 sonucun basit çubukları — tek aşırı değer (192 WPM deneme kaydı) çubuğu tavana vuruyor). 4 sayı `renderStats()` içinde. Yuva `flex: 1`, en az 120 px.
- **Edip**: tür şeridi `.tlh-k-lit` (`LIT` dizisi, `litChipHTML`), açılan akış `home/literature.js` `startSession(cat)`; özdeyiş yalnız "Tüm türler" menüsünde.
