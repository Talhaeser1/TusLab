# Şerit C — Kurallar: sahne seçimi, tur sonu ekranı, mod hataları

Önce `docs/codex/00-ORTAK.md`'yi oku ve uygula.

## Sahip olduğun dosyalar
pvp/shared/stages.js, pvp/shared/match.js, pvp/shared/arena.js, pvp/shared/arena-skills.js, pvp/shared/arena-damage.js,
cloudflare/src/room.js, pvp/practice.js, pvp/network.js, pvp/lobby-v3.css, pvp/rounds-ui.js, pvp/rounds-ui.css, pvp/arena-ui.js,
pvp/arena-ui.css, pvp/resolve-ui.js, pvp/resolve-ui.css, pvp/modes33.css, pvp/howto.js, tests/pvp-stages33.test.mjs (yeni),
tests/pvp-modes33.test.mjs (yeni), ilgili mevcut testler (yalnız yeni davranışa göre).

## Adımlar

### 1. Önceki yarım işi oku
`git diff pvp/shared/stages.js pvp/shared/match.js pvp/shared/arena.js cloudflare/src/room.js pvp/practice.js pvp/network.js pvp/lobby-v3.css pvp/rounds-ui.js pvp/rounds-ui.css`.

### 2. Sahne verisi ve motor
- pvp/shared/stages.js: `STAGES` (4 kayıt: colosseum "Neon Kolezyum", skyforge "Gök Demirhanesi", runegarden "Rün Bahçesi",
  harbor "Fırtına Limanı"; her biri {id,name,blurb,palette{sky,fog,floor,accent,rim}}), `STAGE_IDS`, `DEFAULT_STAGE='colosseum'`,
  `normalizeStage(id)` (geçersiz → DEFAULT), `RANDOM_STAGE='random'`, `pickStage(value, rng)` ('random' ise STAGE_IDS'ten rng ile).
- match.js `createMatch(...,options)`: `match.stage = pickStage(options.stage, rng || Math.random)` sonra `normalizeStage`; publicMatch'te `stage`.
  arena.js `createArenaMatch` aynı. Hasar/denge DEĞİŞMEZ.
- room.js: `MATCH_CONFIG {stage}` — yalnız oda sahibi, lobi aşaması, değer `STAGE_IDS` ya da 'random' (değilse INVALID_MATCH_CONFIG);
  `data.stage` saklanır; ROOM_STATE/summary'de `stage`; startMatch'te `options.stage = data.stage`. Mevcut typing/assist dallarının kalıbını izle.
- practice.js: `o.stage` → createMatch/createArenaMatch options.

### 3. Lobi sahne seçici (pvp/network.js + pvp/lobby-v3.css)
- Bot bölümüne ve oda ayarlarına `stagePickerHTML(scope)`: başlık "Arena seç", 4 sahne kartı + "Rastgele" kartı; radyo grubu
  (role="radiogroup", her kart role="radio" aria-checked), ok tuşlarıyla gezinme (fighter seçicinin `fighterKey` mantığını örnek al),
  kart içeriği: palet gradyanlı önizleme şeridi (CSS linear-gradient sky→floor + accent çizgi), ad, blurb (12–13 px).
- Bot seçimi `localStorage['tuslab-pvp-stage']`; startPractice → `stage`. Oda: sahip değilse salt okunur (disabled) + not.
- ROOM_STATE'ten `stage` okunur, seçici senkronlanır.

### 4. Tur/raund sonu ekranı (yeniden tasarım)
Önce rounds-ui.js'te tur arası/özet (`.rui-inter`, `.rui-summary`), arena-ui.js'te raund sonucu (`.aui-result`/özet), resolve-ui.js'te
çözüm bandı (`.rsv-banner`) markup'ını oku. Sonra:
- Tek bir ortak düzen (pvp/modes33.css; mevcut rounds-ui.css/arena-ui.css'teki eski kuralları gerekirse sadeleştir):
  üstte büyük başlık "TUR 2 BİTTİ" / "RAUND 3 BİTTİ" (≥ 32 px, harf aralıklı), altında kazanan tarafın adı + karakter rengiyle vurgu
  ("SİRA TURU ALDI"; berabere ise "BERABERE"), iki sütun yan yana oyuncu istatistikleri (doğru / yanlış / verilen hasar / en iyi kombo;
  kazananın sütunu vurgulu), ortada tur galibiyet pipleri (●●○ gibi, toplam tura göre), sağ altta sonraki tura geri sayım halkası
  (SVG daire `stroke-dashoffset`, mevcut nextRoundAt/summaryEndsAt'tan), Zamana Karşı'da süre becerisi seçimi büyük, net kartlar
  (ad + etkisi + kalan hak; seçili olan vurgulu; klavyeyle seçilebilir).
- Giriş animasyonu: 220 ms ölçek+opaklık; çıkış 160 ms; reduced-motion'da animasyonsuz.
- Konum: `#pvp-root[data-layout="fullscreen"]` altında ekranın ortasında, `max-height: calc(100vh - 220px)`, üst HP HUD'u (≈ 110 px) ve alt
  yazma paneli/beceri şeridini (≈ 110 px) örtmez; telefonda tam genişlik, iç kaydırma.
- Aynı anda tek katman: tur sonu açıkken çözüm bandı gizlenir.

### 5. Mod kural hataları
- BİLİNEN HATA: çözüm/saldırı sırası evresinde (giriş kilitliyken) basılan boşluk kelimeyi göndermiyor; yazı kutuda kalıp sonraki kelimeyle
  birleşiyor ve yanlış sayılıyor. Düzeltme: kilit sırasında giriş değeri temizlenir ve kilit açıldığında boş başlar (giriş kilidini yöneten
  kod pvp/index.js'te olabilir — o dosya senin değil; kilit durumunu üreten `roundInputLock`/`arenaInputLock` (rounds-ui.js/arena-ui.js)
  senin: kilit nesnesine `clearInput:true` ekle ve raporda "GEREKEN DEĞİŞİKLİK: pvp/index.js textUpdate → kilitliyse p.typed='' " yaz).
- Şunları testle doğrula (tests/pvp-modes33.test.mjs, saf motor testleri): Zaman Hırsızı/Kör Saat/Donmuş An etkileri, son çağrı,
  ani ölüm (eşitlikte ek tur), beraberlik, teslim olma, rövanş sonrası match.stage/typing/assist korunması. Bulduğun her hatayı düzelt.
- pvp/howto.js: "Arena seçimi" maddesi ve tur sonu ekranı açıklaması.

### 6. Testler
tests/pvp-stages33.test.mjs: normalizeStage/pickStage, publicMatch.stage, room MATCH_CONFIG {stage} doğrulaması (geçersiz değer, sahip olmayan,
maç başladıktan sonra), practice o.stage, lobi markup'ında 5 kart ve radiogroup. tests/pvp-modes33.test.mjs: adım 5.

## Kabul ölçütleri
C1 stage motor+sunucu+bot+publicMatch · C2 lobi sahne seçici (5 kart, klavye, salt okunur misafir) · C3 tur sonu ekranı yeni düzen (başlık,
kazanan, yan yana istatistik, pip, geri sayım halkası, beceri kartları) · C4 tek katman kuralı · C5 boşluk/kilit hatası çözümü (+ index.js notu) ·
C6 mod kural testleri · C7 tüm testler + cf:validate.
