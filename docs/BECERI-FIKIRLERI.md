# TuşLab — Q/E/R/S Beceri Tasarımı Önerileri

Taslak 1.0 · 8 Kasım 2026 · Bu belge yalnızca TASARIM önerisidir; kaynak kod değiştirmez.
Kaynaklar: `pvp/shared/match.js` (DAMAGE, COOLDOWNS, ULTIMATE_PHASES, DEFENSE_RULES, RUNES, STREAK_SKILLS),
`pvp/index.js` (`ability()`), `docs/TUR-SISTEMI.md`, `docs/ARENA-MODU.md`; sahibin istek 3 (sırayla saldırı) ve 9 (beceri geliştirme).

## 1. Bugünkü Q/E/R/S analizi

Tetik (klasik mod): beceriyi oyuncu seçmez; sunucu `combo%5` döngüsünde otomatik atar (2. doğru → Q,
4. → E, 5. → R). S düğmesi yoktur: savunma %30 olasılıklı otomatik zar (pencere 250 ms, bekleme 2500 ms).

| Tuş | Tetik | Hasar (ateş/rün) | Bekleme | Neden sıkıcı / dengesiz |
|---|---|---|---|---|
| Q | 2. doğru | 105 / 95 | 1300 ms | Karakterler arası tek fark ±10; hiçbir karar içermez |
| E | 4. doğru | 175 / 185 | 2500 ms | "Ağır darbe" hissi yok; kalkan delme (×0.4) görünmez pasif |
| R | 5. doğru | 305 / 305 (3 faz) | 4500 ms | 3 faz görsel şov; tek zar ya üç fazı da ya hiçbirini bloklar |
| S | — | blok 0 hasar; parry'de karşı 65 | 2500 ms | Tamamen şans; beceri değil kumar; kutu "aktif" görünüyor ama düğme değil |

Kök sorunlar: (1) iki karakter aynı Q-Q-E-R döngüsünü oynar, kimlik farkı yok; (2) beceriler seçim değil
sonuç — doğru yazınca kendiliğinden patlar; (3) savunmada zamanlama/okuma yok; (4) tur modunda 8-9-10
zincir Q (×1.8-2.5, toplam ~679) E ve R'den güçlü — Q spam'i ödüllendiriliyor; (5) `parryToQ +20`,
`comboQtoE +15` gibi bonuslar HUD'da hiç görünmüyor.

## 2. Yeni öneriler — iki ayrı oyun tarzı

Değişmezler: klasik 5-kelime döngüsü toplamı ≈ 585; tur modu 10/10 rünsüz ≈ 1417 (ateş) / 1352 (rün);
"hiçbir kombinasyon 9. doğru öncesi KO edemez" kuralı. Kimlik: **ateş kısa vadede patlar, rün işaretleyip
uzun vadede kazanır.**

### 2.1 ATEŞ — Alev Celladı (saldırgan seri: bas, yak, zincirle)

| Tuş | Ad | Yeni mekanik | Sayılar |
|---|---|---|---|
| Q | Alev Kesişi | **Kor birikimi**: hedefe 4 sn yanma bırakır; yeni Q süreyi tazeler, katman başına +10/sn (azami 3 katman) | 65 ani + 40 yanma (10/sn × 4 sn) → 1. Q eşdeğeri 105; 3 katman tazelenince 65 + 120 = 185'e dek (tek hedefte toplam DoT 90 ile sınırlı, bkz. §5) |
| E | Yer Yaran Darbe | **Kalkan kırıcı**: bekçi kalkanını koşulsuz kırar + 3 sn "Kırık Savunma" (blok şansı yarıya iner). Yanan hedefe +%25 | 175 (+44 yanan hedefte); ağır delme ×0.4 → ×0.6 |
| R | Kızıl Fırtına | **Çok aşamalı + infaz**: 3 faz korunur; her faz Kor katmanı başına +10 vurur; son faz hedef %15 can altındaysa ×1.5 | 65/100/140 (0/180/420 ms) + 10 × katman/faz (azami +90); infaz ≈ +70 |
| S | Kor Kalkanı | **Zamanlama parry'si**: saldırı anonsundan 600 ms içinde S: ≤150 ms → PARRY, ≤400 ms → BLOK, sonrası yalnız %30 azaltım. Ateş parry'si saldıranı tutuşturur | PARRY: karşı 65 + stagger 350 ms + **Kor Siperi** (saldırana 30 hasar / 3 sn) |

Oyun tarzı: seri bas; Q'ları sıkıştır (katman), E ile kalkanı kır, R ile yak-ve-infaz et.

### 2.2 RÜN — Rün Muhafızı (savunma / karşı saldırı: işaretle, biriktir, patlat)

| Tuş | Ad | Yeni mekanik | Sayılar |
|---|---|---|---|
| Q | Rün Kesişi | **Mühür dikme**: hedefe 8 sn Mühür bırakır (azami 3); E ve R mühürleri tüketir | 80 ani + 1 Mühür |
| E | Sarsıcı Darbe | **Kalkan delme**: vurur ve 4 sn "Delici Mühür" verir — sıradaki saldırın bloklanamaz | 150 + tüketilen Mühür başına +20 (azami +60) |
| R | Sonsuz Mühür | **Patlama + bariyer**: 3 faz korunur; son faz hedefteki tüm mühürleri +25'er patlatır; kanal boyunca bariyer | 75/90/140 (0/260/540 ms) + 25 × Mühür (azami +75); bariyer 100 (6 sn) |
| S | Mavi Mühür | **Geniş pencere parry**: rünün uzmanlığı; parry enerji ve bariyer kazandırır | Pencere 200 ms (ateşte 150); PARRY: karşı 65 + stagger 350 ms + runeEnergy +1 + bariyer 100 (2 sn); BLOK: hasar 0 |

Oyun tarzı: sabırla Q ile işaretle, S ile rakibin serisini kır, E → R ile mühürleri patlat.

## 3. "Sırayla saldırı" akışına uyum (istek 3)

Akış: iki oyuncu kendi kelimesini yazar → sunucu kuyruğu kurar → A'nın vuruşu sahneye konarken B'ye
600 ms reaksiyon penceresi (S) açılır → sonra B'nin vuruşu, A reaksiyonu; sıralar dönüşümlü ilerler.
Motor bu sırayı zaten kurabiliyor: `scheduleAlternating` + `RESOLVE_STEP_MS` (1300 ms/adım) —
600 ms'lik S penceresi her adımın içine sığar, yeni zamanlayıcı gerekmez.

| Beceri | Saldırı sırasında | Savunma sırasında |
|---|---|---|
| Ateş Q | 65 + Kor katmanı bırakır | Kor işlemeye devam eder; rakip yanarken E/R bonusu hazır bekler |
| Ateş E | Kalkanı kırar + Kırık Savunma; yanan hedefe +%25 | (opsiyonel) E'yi feda et: gelen vuruş %20 azalır — kararı sen verirsin |
| Ateş R | 3 faz dönüşümlü çözülür; Kor ile güçlenir | Kanalda savunma yok: all-in riski |
| Ateş S | — | PARRY / BLOK / %30 azaltım; parry saldıranı yakar (Kor Siperi) |
| Rün Q | 80 + Mühür diker | Mühür süreleri işler; savunurken bile hazırlık sürer |
| Rün E | 150 + mühür patlaması + Delici Mühür | "Yankı": vuruşu emer + 40 yansıtır (E hakkını yakar) |
| Rün R | Son faz mühür patlaması; 100 bariyer | Bariyer kanal boyunca kalır → ultimate aynı zamanda savunma |
| Rün S | — | 200 ms geniş parry; blok sonrası 100 bariyer (2 sn) |

Kurallar: (a) E/R'yi savunmada harcamak o saldırı hakkını yakar — fırsat maliyeti doğal denge aracıdır;
(b) Delici Mühür sıradaki savunmacının S'ini geçersiz kılar → kalkana oynayan rakibe karşı ateşin
cevabı E, rünün cevabı da kendisi (E) olur; (c) Kor tikleri savunan taraftayken de işler (baskı).

## 4. Denge tablosu — 10 sn'lik değiş tokuş

Varsayım: klasik mod, 5-6 harf, ~40 WPM (~1.5 sn/kelime); saldıran 10 sn'de 2-3 beceri çıkarır;
savunan zamanlamalı S kullanır (becerili: %50-70 blok; yeni oyuncu: %20-30; bugünkü sabit %30).
Net = ham hasar − bloklar − parry karşıları (65) − bariyerler (100).

| Senaryo | Bugünkü ham | Öneri ham — ateş | Öneri ham — rün | Öneri net (iyi S ile) |
|---|---|---|---|---|
| %100 (~6 doğru: Q+E+R) | 585 | 585-660 (Kor hâlâ yanıyorsa üst sınıra) | 555-605 (1-3 mühür) | 150-350 |
| %80 (~4-5 doğru: Q+E veya tam döngü) | 280-585 | 280-585 (yanma kısmî kesilir) | 260-560 | 100-280 |
| %60 (~3 doğru: Q, belki E) | 105-280 | 105-255 | 80-230 | 40-150 |

- Ateş kısa pencerede +%0-12 güçlenir (yanma hızlı oyuncuda tam işler); rün 2+ mühürlü kapanışta
  E→R ile farkı kapatır (170 + 330 = 500; 5 kelimelik döngü karşılığı 585).
- Tur modu değişmezi: 10/10 rünsüz ateş ≈ 1417 ± 90 (DoT tavanı), rün ≈ 1352 + mühür patlamaları
  (≤ +75) → KO yine en erken 9. doğru kelimede mümkün.
- Net etki: savunma becerisi artık gerçek fark yaratıyor — iyi zamanlama ~%45-55 azaltım (bugün ~%30).

## 5. Uygulama planı

| Alan | Değişiklik |
|---|---|
| Sabitler (`pvp/shared/match.js`) | Yeni `SKILL_EFFECTS` (katman tavanları/süreler/pencereler); `DEFENSE_RULES` pencere alanları (600/400/150/200 ms); `heavyPenetration.e` 0.4 → 0.6; rün E için `unblockableNext` bayrağı |
| Katılımcı durumu | `burn:{stacks,until}`, `brands:{stacks,until}`, `barrier:{hp,until}`, `pierceUntil` — `resumeMatch` bu alanları `delta` kadar kaydırır; `resetForRound` temizler |
| Fonksiyonlar | `computeSkillBonus` (Kor/mühür sinerjileri), `resolveDueAttacks` (DoT tikleri yalnız saldırı-çözüm adımlarında; bariyer önce hasarı emer; Delici Mühür blok atlar), `submitWord`/`submitRoundWord` (etiketli saldırı üretimi) |
| Olay alanları | `SKILL_CAST.effects:['burn'\|'brand'\|'pierce'\|'barrier']`; `DAMAGE_APPLIED` += `dot`, `burnStacks`, `brandStacks`, `barrierAbsorbed`; yeni istemci→sunucu `DEFEND_INTENT {matchId, attackId}` (sunucu saatiyle pencere doğrulaması) |
| Arayüz (`pvp/index.js`, yalnız `ability()` bölgesi) | Etiketler + eşik metinleri; yetenek çubuğunda Kor/Mühür katman sayaçları ve bariyer göstergesi (`publicMatch.players[i]` yeni alanlar) |
| Testler | Yeni `tests/pvp-skills.test.mjs`: DoT toplamı = katman × süre (tavan 90), bariyer önce-sonra, Delici Mühür S'i atlatır, pencere sınır değerleri, klasik 585 / tur 1417-1352 değişmezleri |

Riskler ve önlemler:
1. **DoT, "9 doğru öncesi KO yok" değişmezini bozabilir** → tikler yalnız saldırı-çözüm adımlarında
   uygulanır; toplam DoT ≤ 90 ile sınırlanır → KO en erken 9. doğru korunur.
2. **Aktif S + ağ gecikmesi** → pencere yalnız sunucu saatiyle doğrulanır, istemciye +100 ms tolerans;
   Space kelime gönderir, S düğmesi odağı çalmaz (giriş alanı yazmaya devam eder).
3. **Ateş/rün tempo asimetrisi** → ateş kısa (120 sn klasik), rün uzun (tur serileri) maçta güçlü;
   `SKILL_EFFECTS` tek yerden ayarlanabilir tutulur, sahiple canlı test sonrası kalibre edilir.
4. **Protokol koordinasyonu** → `DEFEND_INTENT` ve sıralı çözüm, sıra-akışı ajanıyla ortak sözleşme
   gerektirir (`pvp/contracts.js`); `pvp/index.js` paylaşılıyor: yalnız `ability()` bölgesine dokunulur.
5. **Klasik uyumluluk** → olasılıklı S klasik modda kalabilir (`match.options.activeDefense` bayrağı);
   zamanlamalı S yalnız yeni sıralı akışta açılır; ARENA moduna (`arena.js`) dokunulmaz.

Öncelik sırası: (1) S zamanlama penceresi — en yüksek his/kod oranı, (2) Kor + Mühür katmanları,
(3) Delici Mühür / Kalkan kırıcı etkileşimi, (4) R faz sinerjileri, (5) E'nin savunma kullanımı.
