# TuşLab Neon Arena — Tur (Raund) Sistemi Spesifikasyonu

Sürüm: 1.0 · Kapsam: PvP (Cloudflare DO) + çevrimdışı bot antrenmanı · Dil: Türkçe UI
Kaynak motor: `pvp/shared/match.js` (sunucu ve botun ortak, saf ES modülü). Bu belge kod değiştirmez;
üç paralel ajanın (A motor+sunucu, B tur arayüzü, C bot) uygulayacağı kesin kuralları tanımlar.

---

## 0. Tasarım ilkeleri

1. **Mevcut motoru yeniden kullan.** HP, Q/E/R, S tepkisel kalkan, perfect block / parry / karşı saldırı,
   rünler, `ULTIMATE_PHASE`, pause/resume, teslim olma, rövanş aynen kalır; üzerine tur katmanı eklenir.
2. **Klasik mod korunur (geri uyumluluk).** `createMatch(players, at, id)` *seçeneksiz* çağrıldığında bugünkü
   90 sn / `MATCH_WORDS` / döngüsel Q2-E4-R5 davranışı **bit bit aynı** kalır. Böylece mevcut motor testlerinin
   (combat09, words, defense13, runes22, ultimate14) büyük bölümü dokunulmadan geçer.
   Tur modu yalnızca `createMatch(players, at, id, {rounds, seed})` ile açılır. `room.js` ve `practice.js`
   **her zaman** tur modunu kullanır.
3. **Sunucu otoritesi.** Kelimeler, tohum (seed), süreler, RNG ve skorlar sunucuda üretilir; istemci yalnızca
   kelime gönderir. Tohum asla `publicMatch` içinde yayınlanmaz.

---

## 1. Temel sabitler (`pvp/shared/match.js`, export edilir)

| Sabit | Değer | Not |
|---|---|---|
| `ROUND_OPTIONS` | `[5, 7, 10]` | Geçersiz değer → `5` |
| `ROUND_WORDS` | `10` | Tur başına kelime/deneme hakkı |
| `ROUND_DURATION_MS` | `30_000` | Tur süresi |
| `ROUND_LAST_CALL_MS` | `5_000` | Bir oyuncu 10 denemeyi bitirince kalan süre en fazla bu kadar olur |
| `ROUND_SETTLE_MS` | `1_000` | Süre bitince havadaki saldırıların (ultimate dahil) çözülme payı |
| `ROUND_SUMMARY_MS` | `3_000` | Tur sonu özet ekranı |
| `ROUND_INTRO_MS` | `2_000` | Sonraki tur için "Raund N" geri sayımı |
| `ROUND_HP` | `1200` | Her tur başında iki oyuncu da `1200/1200` |
| `SUDDEN_DEATH_MAX` | `3` | En fazla 3 ani ölüm turu |
| `STREAK_SKILLS` | `{3:'q',5:'e',7:'r',8:'q',9:'q',10:'q'}` | Seri → otomatik büyü |
| `MULTIPLIER_START` / `_STEP` / `_CAP` | `7` / `1.5 × 1.2^(seri−7)` / `2.5` | Bkz. §4 |
| `ROUND_SCORE` | `{correct:100, bestStreak:50, damageDiv:10}` | Bkz. §3.3 |

Mevcut `SHIELD_WINDOW_MS=250`, `SHIELD_PROBABILITY=0.30`, `DEFENSE_RULES`, `DAMAGE`, `ULTIMATE_PHASES`
**değişmez**.

---

## 2. Durum makinesi

```
LOBİ (waiting) ──iki oyuncu hazır──► COUNTDOWN 3 sn (mevcut) ──► MAÇ BAŞLAR = RAUND 1 "round"
                                                                 │
   ┌─────────────────────────────────────────────────────────────┘
   ▼
 round ──(KO)──────────────────────────────────────────────┐
   │ (endsAt doldu)                                         │
   ▼                                                        ▼
 settling (≤1 sn, havadaki saldırılar çözülür; yeni kelime yok) ─► roundEnd hesapla
   │
   ├─ maç kesinleşti / son tur / ani ölüm sonucu belli ─► match.status='ended' (MATCH_END)
   └─ aksi halde ─► intermission (3 sn özet + 2 sn geri sayım) ─► round (N+1)
```

- `match.status` bugünkü gibi `'running' | 'paused' | 'ended'` kalır. Tur modunda ek alan
  `match.round.phase ∈ 'round' | 'settling' | 'intermission'`.
- **Tur bitiş koşulları (ilk gerçekleşen):**
  1. **KO:** bir oyuncunun HP'si 0 → tur anında biter (`reason:'KO'`), bekleyen saldırılar silinir
     (bugünkü KO davranışı, sadece maç yerine tur biter). `settling` atlanır.
  2. **Süre:** `at ≥ round.endsAt` → `settling`.
  3. **İkisi de bitirdi:** iki oyuncu da 10 denemeyi tamamladı → `endsAt = at` → `settling`.
- **Erken bitiren:** Oyuncu 10 denemeyi bitirince durur (giriş kilitlenir, "Tamamlandı ✓"). Tur
  `endsAt = min(endsAt, at + ROUND_LAST_CALL_MS)` olur ("SON ÇAĞRI 5 sn"). Gerekçe: hızlı oyuncu 20 sn
  boş beklemez, yavaş oyuncu yine de son kelimelerini yazabilir; hız zaten tie-break'te ödüllendirilir.
- **settling:** `settleUntil = endsAt + ROUND_SETTLE_MS`. `endsAt` öncesinde verilmiş saldırılar çözülür;
  `pendingAttacks` boşalınca ya da `settleUntil` geçince tur kapanır; kalanlar silinir. Bu sürede KO olursa
  KO sayılır (`reason:'KO'`).
- **intermission:** `nextRoundAt = roundEndedAt + ROUND_SUMMARY_MS + ROUND_INTRO_MS` (5 sn). O anda yeni tur
  açılır: HP'ler `ROUND_HP`, seri 0, kalkan/stagger/parryCharge/pending temizlenir, cooldown'lar sıfırlanır.
  Maç boyunca kalanlar: `runeEnergy` **sıfırlanır**, `lastStandUsed` **sıfırlanır** (her tur yeni düello),
  `combatStats`, `defenseStats`, `correctWords`, `wrongWords`, `maxCombo` **birikir** (maç sonu karnesi).

### 2.1 HP: tur başına sıfırlanır (karar)
Taşınan HP'de erken KO maçı bitirir ve "5/7/10 tur" anlamsızlaşır. Bu yüzden her tur bağımsız bir düellodur;
HP barı turun gidişatını gösterir, maçı tur sayısı belirler.

---

## 3. Kelimeler, deneme ve tur skoru

### 3.1 Kelime dağıtımı
- Maç oluşturulurken sunucu `seed = createSeed()` üretir (`match.seed`, **gizli**; `publicMatch` vermez).
- Tur `r` için: `pickWords({seed: \`${match.seed}:r${r}\`, count: 10, minLen, maxLen, exclude: match.usedWords})`.
  - Uzunluk rampası: `r ≤ ceil(total/2)` → `minLen 3, maxLen 7`; sonrası → `4–9`; ani ölüm → `5–10`.
  - `exclude`: maçta daha önce çıkan tüm kelimeler (tekrar yok). Rövanş = yeni `seed` = yeni kelimeler.
  - `words.js` tohumu sayı olarak istiyorsa motor `fnv1a32(string)` ile sayıya çevirir (match.js içinde
    20 satırlık saf yardımcı). Test için `createMatch(..., {pickWords})` enjeksiyonu desteklenir.
  - Kelime havuzu `NFC` normalize, boşluksuz olmalıdır; motor yine de `normalize('NFC')` uygular.
- **İki oyuncu aynı turda aynı 10 kelimeyi aynı sırayla alır.** Kelimeler tur başında açılır
  (`ROUND_START.words`); intermission'da bir sonraki turun kelimeleri gösterilmez.

### 3.2 Deneme kuralı (yanlış kelime)
- Her gönderim (doğru/yanlış) **kelimeyi tüketir**: `roundWordIndex++`. Turda tam 10 deneme vardır.
  Gerekçe: iki oyuncu da aynı listede ilerler (eşzamanlı aynı kelime anlamlı kalır), yanlış yazmanın bedeli
  net olur: kelime kaybedilir + seri bozulur.
- Yanlış kelime → `streak = 0` ("3 doğru 1 yanlış seri bozulur"). Havada olan saldırılar iptal edilmez.
- `wordIndex` (maç boyu artan, replay koruması) aynen kalır; `WORD_SUBMIT` yükü değişmez
  (`{matchId, wordIndex, text}`), opsiyonel `round` alanı gelirse ve tutmazsa `ROUND_MISMATCH` hatası.
- Hata kodları (yeni): `ROUND_NOT_ACTIVE` (settling/intermission), `ROUND_COMPLETE` (10 deneme bitti).
  Mevcut `WORD_BURST_LIMIT` (55 ms), `INVALID_WORD`, `WORD_INDEX_MISMATCH` aynen.

### 3.3 Tur kazananı (kesin formül)
1. Turda KO yapan turu kazanır.
2. Aksi halde **Raund Puanı** büyük olan:
   `RP = 100 × doğru + 50 × enİyiSeri + floor(verilenHasar / 10)` (hepsi o tura ait).
3. Eşitlikte sırayla: (a) daha çok doğru, (b) daha az yanlış, (c) son doğru kelimesini daha erken yazan
   (`lastCorrectAt` küçük olan; hiç doğrusu olmayan kaybeder), (d) hâlâ eşit → **berabere tur**
   (`winnerSeat:null`, kimse puan almaz).
- İkisi de 0 doğru → (a)(b)(c) ile çözülemezse berabere. Turu "oynamamak" ödüllendirilmez.

Örnek: A 8 doğru, en iyi seri 4, 210 hasar → 800+200+21 = **1021**. B 7 doğru, seri 7, 738 hasar →
700+350+73 = **1123** → B kazanır (seri ödüllendirilir, ama 1 doğru fark 100 puandır).

### 3.4 Maç kazananı (5 / 7 / 10 tur)
- `roundsWon = {1:n, 2:m}`. Her tur sonunda **kesinleşme kontrolü**: `kalan = total − oynanan`;
  `roundsWon[x] > roundsWon[y] + kalan` ise maç biter (`endReason:'ROUNDS'`). Böylece 5'te 3-0, 7'de 4-0,
  10'da 6-0 erken biter; berabere turlar doğal olarak hesaba katılır.
- Tüm turlar oynandı ve eşitlik (ör. 10 turda 5-5 veya 2-2 + 1 berabere) → **ani ölüm turu** (`suddenDeath:true`,
  numara `total+1`, `+2`…). İlk kazanılan ani ölüm turu maçı bitirir. 3 ani ölüm turu da berabere → maç
  berabere (`winnerSeat:null`, `endReason:'ROUNDS_DRAW'`).
- Teslim olma / bağlantı kaybı hükmen: mevcut `SURRENDER`, `DISCONNECT_FORFEIT`, `BOTH_DISCONNECTED` aynen,
  hangi turda olursa olsun maçı bitirir. `KNOCKOUT` ve `TIME_LIMIT` tur modunda maç sonu nedeni olmaz.

---

## 4. Seri (streak) → saldırı eşlemesi ve hasar

Tur modunda döngüsel `combo % 5` (Q2/E4/R5) yerine **tur içi mutlak seri** kullanılır (seri tur başında 0):

| Seri | Büyü | Çarpan M | Fire hasar | Rune hasar | Fire kümülatif | Rune kümülatif |
|---|---|---|---|---|---|---|
| 1–2 | — | 1 | 0 | 0 | 0 | 0 |
| 3 | Q "Kombo Vuruşu" | 1.0 | 105 | 95 | 105 | 95 |
| 4 | — | 1.0 | 0 | 0 | 105 | 95 |
| 5 | E "Ağır Darbe" | 1.0 | 175 | 185 | 280 | 280 |
| 6 | — | 1.0 | 0 | 0 | 280 | 280 |
| 7 | R Ultimate (3 faz) | 1.5 | 458 | 458 | 738 | 738 |
| 8 | Q zincir | 1.8 | 189 | 171 | 927 | 909 |
| 9 | Q zincir | 2.16 | 227 | 205 | 1154 | 1114 |
| 10 | Q zincir | 2.5 (tavan) | 263 | 238 | 1417 | 1352 |

- `M(seri) = seri < 7 ? 1 : min(2.5, 1.5 × 1.2^(seri−7))` → "katlı artış" (her ek doğru ×1.2).
- Hasar: `amount = round((DAMAGE[char][skill] + rünBonusu) × M)`. Ultimate'te her faz ayrı yuvarlanır:
  `round((faz.damage + (sonFaz ? bonus : 0)) × M)` (fire: 98+150+210 = 458; rune: 113+135+210 = 458).
  `attack.multiplier` alanı saldırıya yazılır; karşı saldırı (counter 65) ve shield-break penetrasyonu çarpandan
  **sonra** uygulanır; counter çarpılmaz.
- **Denge değişmezi:** `ROUND_HP=1200` ile rünsüz kusursuz tur (10/10, hiç blok yok) **ancak 10. kelimede**
  KO eder; herhangi bir karakter×rün kombinasyonunda KO **en erken 9. doğru kelimede** mümkündür
  (ör. fire+rhythm: 112, 320, 856, 1058, 1300). Tur "kazanılabilir ama anlık değil".
- Cooldown: tur modunda seri eşikleri tekil olduğu için Q/E/R cooldown kontrolü **atlanır** (8-9-10 zincir
  Q'ları 1300 ms cooldown'a takılmasın). Stagger (parry sonrası 350 ms) kuralı korunur: stagger'daysa o
  eşiğin büyüsü kaybolur. S cooldown'u (2500 ms) korunur.
- Rün/yetenek bonusları (`computeSkillBonus`) aynen çalışır; `Q→E` / `E→R` zincir bonusları doğal olarak
  3→5→7 akışında tetiklenir. `fireCombo:3` eşiği seri ile aynı alanı (`combo`) okur.
- `publicMatch.players[i]`: `combo` (=seri), yeni `multiplier` (sonraki doğru kelimede geçerli olacak çarpan
  değil, **mevcut** seriye ait çarpan), `nextSkill` (`'q'|'e'|'r'|null`, sonraki doğruda tetiklenecek büyü).

---

## 5. Eşzamanlı aynı kelime → kalkan (Çarpışma)

Tur modunda "aynı kelime" = aynı `roundWordIndex` (listeler ortak olduğu için aynı metin).

- **Pencere:** iki oyuncunun aynı indeksteki **doğru** gönderimleri arasındaki sunucu zaman farkı
  `≤ SHIELD_WINDOW_MS (250 ms)`.
- **Tek taraflı (yalnızca A büyü attı):** B'nin tepkisel kalkanı bugünkü kuralla atılır, tek fark ek koşul:
  `defender.lastCorrectRoundIndex === attack.roundWordIndex`. Şans `%30`; aralık ≤150 ms (+25 reflex) →
  PERFECT_BLOCK; ≤90 ms ve ikinci zar `%45` → PARRY + counter. S cooldown kuralı aynen.
- **Çift taraflı (ikisi de aynı kelimede büyü attı) = ÇARPIŞMA:** ikinci saldırı oluşturulurken motor, ters
  yönlü bekleyen saldırıyı (aynı `roundWordIndex`, `|Δt| ≤ 250`) bulur ve ikisine aynı `clashId` yazar.
  İlk çözülen saldırıda **tek zar** atılır: `rng() < 0.30` ise **yalnızca biri** bloklar:
  - Bloklayan = **daha önce gönderen** (hız ödülü); eşitse daha yüksek seriye sahip olan; o da eşitse seat 1.
  - Bloklayanın saldırısı karşıya normal vurur (o saldırıya ayrıca zar atılmaz). Blok türü bloklayanın
    aralığına göre PERFECT/PARRY katmanlarıyla belirlenir (parry için ikinci zar yine `%45`).
  - Zar başarısızsa iki saldırı da vurur, başka zar atılmaz. Hüküm `match.clashes[clashId]`'de saklanır
    (ultimate fazlarındaki "ilk hüküm tekrar kullanılır" kuralıyla aynı mantık).
- Yeni combat olayı `WORD_CLASH` (ring buffer'a girer, `tuslab:pvp-combat` ile UI'a akar):
  `{type:'WORD_CLASH', clashId, seats:[1,2], roundWordIndex, word, blockerSeat|null, blockKind|null, at}`.
- Klasik modda bu bölüm devre dışıdır (bugünkü `lastWordAt` kuralı aynen).

---

## 6. Ultimate sözleşmesi (3D ajanı için)

Hasar/zamanlama değişmez (fazlar 0/180/420 ms fire, 0/260/540 ms rune, toplam 305 doğrulaması kalır).
`ULTIMATE_PHASE` olayına **eklenen** alanlar (eski alanlar korunur):

| Faz | `motion` | Görsel anlam |
|---|---|---|
| 1 | `'pull'` | Rakip VS merkezine çekilir + ilk vuruş |
| 2 | `'strike'` | Merkezde vuruş |
| 3 | `'return'` | Finisher + rakip yerine fırlatılır |

Ek alanlar: `multiplier`, `returnAt` (= faz 3 `at` + 400 ms, istemci geri dönüş animasyonu bitiş önerisi).
KO faz 1/2'de olursa kalan fazlar gelmez; istemci `ROUND_END` alınca açık bir ultimate varsa geri dönüş
animasyonunu kendisi oynatır (karakterler tur başında kendi yerinde olmalı).

---

## 7. Protokol

### 7.1 İstemci → sunucu
| Mesaj | Yük | Kural |
|---|---|---|
| `MATCH_CONFIG` (yeni) | `{rounds: 5\|7\|10}` | Yalnızca host, `waiting/countdown`; iki oyuncunun `ready=false`; countdown iptal. Geçersiz → `ERROR INVALID_ROUNDS`. Host değil → `HOST_ONLY`. |
| `WORD_SUBMIT` | `{matchId, wordIndex, text, round?}` | Değişmedi (opsiyonel `round`). |

`ROOM_STATE.summary` yeni alan: `rounds` (varsayılan 5). Rövanş aynı `rounds` ile başlar.

### 7.2 Sunucu → istemci (tümü `SERVER_ONLY_EVENTS`'e eklenir)
| Olay | Yük (+ her zaman `match: publicMatch`, `serverTime`) |
|---|---|
| `MATCH_START` | Değişmedi; `match.round` zaten 1. turu içerir (`ROUND_START` ayrıca gönderilir). |
| `ROUND_START` | `{round, totalRounds, suddenDeath, words[10], startedAt, endsAt, roundHp}` |
| `ROUND_LAST_CALL` | `{round, finishedSeat, endsAt}` — bir oyuncu 10 denemeyi bitirdi |
| `ROUND_END` | `{round, winnerSeat\|null, reason:'KO'\|'TIME'\|'ALL_DONE', scores:[{seat, correct, wrong, bestStreak, damageDealt, hpLeft, rp, lastCorrectAt}], roundsWon:{1,2}, nextRoundAt\|null, matchOver}` |
| `MATCH_END` | Değişmedi; `match.result` ek alanlar: `mode:'rounds'`, `totalRounds`, `roundsWon`, `rounds:[ROUND_END özetleri]`. `endReason` yeni: `'ROUNDS'`, `'ROUNDS_DRAW'`. |
| Combat | `SKILL_CAST` ek alanlar `streak`, `multiplier`, `roundWordIndex`, `chain:boolean` (8–10 Q). `WORD_CLASH` yeni. |

Ayrı bir `STREAK_UPDATE` olayı **eklenmez**: seri `WORD_RESULT` (`combo`, yeni `streak`, `multiplier`,
`nextSkill`, `roundWordIndex`, `roundDone`) ve her `STATE_UPDATE` ile gelir (paket trafiği artmaz).

### 7.3 `publicMatch` ek alanları (tur modunda)
```js
mode:'rounds', totalRounds, roundsWon:{1:0,2:0},
round:{index, total, suddenDeath, phase, words, startedAt, endsAt, settleUntil, nextRoundAt},
roundHistory:[ /* ROUND_END özetleri */ ],
players[i]: { ...mevcut, streak, multiplier, nextSkill, roundWordIndex, roundCorrect, roundWrong,
              roundBestStreak, roundDamage, roundDone, finishedAt }
```
- `match.endsAt` = **mevcut turun** `endsAt`'i (eski HUD zamanlayıcısı bozulmaz). `match.seed` ve
  `match.usedWords` yayınlanmaz. Klasik modda `mode:'classic'`, `round:null`.
- `activeText` = turun 10 kelimesi boşlukla birleşik; `currentWord` = `words[roundWordIndex]`
  (eski yazı alanı çalışmaya devam eder).
- WPM: maç başından değil, **oynanan tur sürelerinin toplamından** (`activeMs`) hesaplanır.

### 7.4 Motor API'si (A'nın B ve C'ye sözleşmesi)
```js
createMatch(players, at, id, {rounds, seed?, pickWords?})   // rounds yoksa klasik mod
submitWord(match, {playerId, matchId, wordIndex, text, round?}, at)  // imza aynı
advanceMatch(match, at, rng=Math.random) → {match, events, roundEvents}
   // resolveDueAttacks + tur bitişi + settling + yeni tur + maç sonu. Klasikte resolveDueAttacks+finishMatch.
   // roundEvents: [{type:'ROUND_END'|'ROUND_START'|'ROUND_LAST_CALL', payload}]
nextDeadline(match) → number|null    // alarm zamanı: min(pending.resolveAt, endsAt|settleUntil|nextRoundAt)
roundScore(p) → number               // RP formülü, test edilebilir
streakMultiplier(streak) → number
```
`submitWord` sonucunda `result.roundEvents` da olabilir (10. deneme → `ROUND_LAST_CALL` veya `ALL_DONE`).
`pauseMatch/resumeMatch` tur alanlarını da kaydırır (§8). `cloudflare/src/match.js` yeniden export listesi
yeni isimlerle güncellenir.

---

## 8. Kenar durumlar

| Durum | Kural |
|---|---|
| Tur ortasında kopma | Mevcut pause: süre, saldırılar donar. `resumeMatch` şunları da `delta` kadar kaydırır: `round.startedAt/endsAt/settleUntil/nextRoundAt`, `finishedAt`, `lastCorrectAt`. 20 sn grace sonra hükmen. |
| Intermission'da kopma | Aynı pause; `nextRoundAt` kayar. Dönen oyuncu `MATCH_START{resumed}` + `STATE_UPDATE` ile turu snapshot'tan kurar (kelimeler `match.round.words`). |
| Teslim olma | Her fazda (round/settling/intermission/paused) `SURRENDER` → maç biter; tur skoru yazılmaz, `roundHistory` o ana kadarki. |
| Rövanş | Yeni `id`, yeni `seed`, aynı `rounds`, `roundsWon` sıfır. |
| İkisi de 0 doğru | Tur berabere (§3.3). Kimse puan almaz; tur sayılır. |
| Zaman kayması | Tüm tarihler sunucu saatinde. `at ≥ round.endsAt` → `ROUND_NOT_ACTIVE` (tolerans yok). İstemci `clockSync.serverNow()` ile sayar, `serverNow ≥ endsAt` olunca girişi kilitler. Alarm geç tetiklense bile `advanceMatch` geçmiş tüm geçişleri sırayla uygular (tur bitişi → intermission → yeni tur) ve olayları sırasıyla döndürür. |
| Geç gelen kelime | `wordSubmit` önce `advanceMatch(now)` çağırır; tur kapanmışsa olaylar yayınlanır, gönderim reddedilir. |
| KO + havadaki karşı saldırı | KO turu bitirir, `pendingAttacks=[]`; counter dahil hiçbir şey sonraki tura taşınmaz. |
| Ani ölüm sınırı | 3 berabere ani ölüm → `ROUNDS_DRAW`. |
| Profil/Elo kaydı | `recordResult` maç sonunda bir kez; `result.winnerSeat` tur kazananı değil maç kazananı. |

---

## 9. Bot (antrenman) kuralları

- Bot `match.round.words[roundWordIndex]` kelimesini yazar (insanla aynı liste). `roundDone` olunca ve
  `phase !== 'round'` iken yazmaz; her `ROUND_START`'ta tepki gecikmesiyle yeniden başlar.
- `BOT_DIFFICULTIES`'e yeni alan `startDelayMs`: kolay `[900,1500]`, orta `[600,1100]`, zor `[400,800]`.
  Mevcut `wpm/jitter/typo/pause` aynen. Beklenen tur performansı (6 harfli ort.):
  kolay ≈ 3.4 sn/kelime → 30 sn'de ~8 deneme, seri 7'ye nadiren ulaşır;
  orta ≈ 1.9 sn → ~19 sn'de 10 deneme; zor ≈ 1.2 sn → ~12 sn'de 10 deneme, sık ultimate.
- Tick döngüsü `finishMatch` yerine `advanceMatch` kullanır; `roundEvents` aynı zarfla (`emit`) yayınlanır.
  `alarm` eşdeğeri: `tickMs` (50) yeterli; ayrıca `nextDeadline` gerekmez.
- `createPracticeSession({..., rounds})`: varsayılan 5; `normalizeRounds()` export edilir. Rövanş aynı tur sayısı.

---

## 10. İstemci arayüzü (B'nin göstermesi gerekenler)

1. **Lobi + bot paneli:** "Maç uzunluğu: 5 / 7 / 10 tur" seçici (segment buton). Lobide yalnızca host
   değiştirir (`MATCH_CONFIG`), diğerine salt-okunur gösterilir; bot panelinde `localStorage`
   `tuslab-pvp-practice-rounds`.
2. **Üst HUD:** `RAUND 3 / 7` (ani ölümde `ANİ ÖLÜM`), tur skoru `● ● ○ – ● ○ ○` (roundsWon), 30 sn sayaç
   (son 5 sn kırmızı, `SON ÇAĞRI` rozetinde `ROUND_LAST_CALL`).
3. **Oyuncu başına:** `Kelime 6/10`, seri metresi (3/5/7 eşik çentikleri, sonraki büyü ikonu `nextSkill`),
   çarpan rozeti `×1.5 / ×1.8 / ×2.16 / ×2.5` (seri ≥7), `Tamamlandı ✓`.
4. **Kelime şeridi:** turun 10 kelimesi; yazılan doğrular yeşil, yanlışlar kırmızı üstü çizili, aktif kelime
   vurgulu. Rakibin ilerleme imleci (`roundWordIndex`) aynı şeritte ince işaretle.
5. **Seri kırılması:** yanlışta metrede kısa "SERİ BOZULDU" (yerel, `WORD_RESULT.correct=false`).
6. **Çarpışma:** `WORD_CLASH` → ortada "ÇARPIŞMA!" + bloklayan tarafta kalkan; `blockerSeat:null` → "İKİSİ DE VURDU".
7. **Tur sonu katmanı (`ROUND_END`, 3 sn):** kazanan, RP tablosu (doğru, yanlış, en iyi seri, hasar, RP),
   güncel tur skoru; ardından 2 sn `RAUND N` geri sayımı (`nextRoundAt`'e göre). Giriş bu sırada kilitli.
8. **Maç sonu:** mevcut sonuç ekranı + tur tablosu (`result.rounds`).
9. **Erişilebilirlik:** `prefers-reduced-motion` → katmanlar yalnızca opaklıkla; sayaç `aria-live="polite"`
   (her saniye değil, 10/5/0 sn'de duyuru).

---

## 11. Uygulama paylaşımı (3 paralel ajan, katı dosya sahipliği)

**Sıra:** A önce §7.4 API iskeletini (sabitler + imzalar) yazar; B ve C §7 sözleşmesine göre paralel
başlar, gerekirse sahte snapshot ile test eder. Kimse başkasının dosyasını düzenlemez.

### Ajan A — Motor + sunucu
- **Sahip:** `pvp/shared/match.js`, `cloudflare/src/match.js` (re-export), `cloudflare/src/room.js`,
  `pvp/contracts.js` (yeni `MessageType` girdileri), yeni `tests/pvp-rounds-engine.test.mjs`,
  `tests/pvp-rounds-room.test.mjs`, aşağıdaki mevcut testlerin güncellenmesi.
- **Bağımlılık:** `pvp/shared/words.js` (başka ajan) → `pickWords`, `createSeed`. Hazır değilse
  `createMatch` opsiyonel `pickWords` enjeksiyonuyla test edilir.
- `room.js`: `createMatch(players, now, id, {rounds:data.rounds||5})`; `wordSubmit` ve `runAlarm`
  `advanceMatch` kullanır; `roundEvents` → `broadcast(type, {...payload, match, serverTime})`;
  `schedule()` running iken `nextDeadline(match)`; `MATCH_CONFIG` handler (host, waiting/countdown).
- **Yeni testler (engine):** seçeneksiz createMatch klasik modla aynı · rounds 5/7/10 doğrulama ve geçersiz→5 ·
  iki oyuncu aynı 10 kelime, turlar arası tekrar yok, aynı seed → aynı kelimeler · yanlış kelime tüketir ve
  seriyi sıfırlar · seri 3/5/7/8/9/10 büyü eşlemesi ve §4 hasar tablosu (fire+rune, tam sayılar) · çarpan
  tavanı 2.5 · her karakter×rün için KO ≥ 9 doğru değişmezi · 10 deneme sonrası `ROUND_COMPLETE` ve
  `LAST_CALL` clamp · ikisi bitince `ALL_DONE` · süre → settling → havadaki ultimate tamamlanır → tur sonu ·
  KO turu bitirir ve pending'i temizler · RP formülü + tüm tie-break'ler + 0-0 berabere · kesinleşmede
  erken bitiş (5'te 3-0) · 10 turda 5-5 → ani ölüm, 3 berabere → `ROUNDS_DRAW` · tek taraflı aynı
  kelime kalkanı (aynı indeks şartı) · çarpışmada tek zar, yalnızca biri bloklar, bloklayan = önce gönderen ·
  pause/resume tur saatlerini kaydırır · intermission'da submit reddi · tur başında HP/seri/kalkan sıfırlama ·
  `publicMatch` seed sızdırmaz · `advanceMatch` geç alarmda birden çok geçişi sırayla üretir.
- **Yeni testler (room):** `MATCH_CONFIG` host-only, ready sıfırlama, ROOM_STATE'te `rounds` · iki sokete
  aynı `ROUND_START.words` · `ROUND_END`/`MATCH_END` tam bir kez · rövanş aynı rounds + yeni kelimeler ·
  sahte `ROUND_START/ROUND_END/WORD_CLASH` istemciden `SERVER_ONLY_EVENT`.
- **Güncellenecek mevcut testler (room tur moduna geçtiği için):**
  `pvp-match.test.mjs` ("both players receive terminal snapshot exactly once at expiration" → son tur bitişi),
  `pvp-words.test.mjs` (room üzerinden gönderilen kelimeler `round.words` olmalı; motor testleri klasikte kalır),
  `pvp-combat09.test.mjs` ("server chamber alarm resolves…" oda testi), `pvp-results15.test.mjs`
  (rövanş: "full HP" → `ROUND_HP`; sonuç `mode:'rounds'`), `pvp-reconnect11.test.mjs` (resume sonrası
  `round.endsAt` kaydırması), `pvp-practice.test.mjs`'deki re-export listesi testi (yeni exportlar).

### Ajan B — Tur arayüzü
- **Sahip:** `pvp/network.js` (yalnızca tur paketleri, HUD, lobi/bot tur seçici, `predictWord`'ün seri
  eşlemesine geçmesi), `pvp/index.js` (yalnızca `WORD_CLASH`/`ROUND_*` dinleyicileri ve rounds-ui bağlama),
  yeni `pvp/rounds-ui.js`, `pvp/rounds-ui.css`, yeni `tests/pvp-rounds-ui.test.mjs`.
  `cloudflare/public/**` build çıktısıdır, elle düzenlenmez.
- `rounds-ui.js` API: `createRoundsUi(root, {now})` → `{update(match, myId), handle(packet), destroy()}`;
  DOM'u tek kökte (`[data-rounds-ui]`) üretir, tüm metinler `textContent` ile (XSS yok).
- `predictWord`: tur modunda `STREAK_SKILLS[streak+1]`, klasikte eski `%5` eşlemesi.
- **Yeni testler:** `ROUND_START` → `RAUND 1/5`, 10 kelime şeridi · sayaç sunucu saatinden, pause'da donuk ·
  `Kelime x/10`, seri metresi, `nextSkill` ikonu, çarpan rozeti yalnızca seri ≥7 · `ROUND_LAST_CALL`
  rozeti · `ROUND_END` katmanı RP tablosu ve `nextRoundAt` geri sayımı, girişin kilitlenmesi · `WORD_CLASH`
  iki varyantı · lobide host dışı salt-okunur seçici, `MATCH_CONFIG` gönderimi · bot panelinde localStorage
  · kötü niyetli isim/kelime kaçışlanır · bilinmeyen paket tipi hata atmaz · `destroy` tüm zamanlayıcıları siler.
- **Güncellenebilecek mevcut testler:** `pvp-net-sync12.test.mjs` (Q/E/R tahmin metni), `pvp-arena.test.mjs`
  (HUD işaretleri değişirse), `pvp-results15.test.mjs`'in HTML karnesi bölümü (tur tablosu eklenirse) —
  B yalnızca UI assert'lerini, A yalnızca motor/oda assert'lerini düzenler; aynı dosyada çakışma olursa
  B yeni assert'leri kendi yeni test dosyasına koyar.

### Ajan C — Bot
- **Sahip:** `pvp/practice.js`, `pvp/practice.css` (gerekirse), `tests/pvp-practice.test.mjs`
  (re-export listesi bloğu hariç — o A'nın), yeni `tests/pvp-rounds-practice.test.mjs`.
- **Yeni testler:** deterministik (enjekte rng/now/scheduler) 5 turluk maç uçtan uca `MATCH_END
  endReason:'ROUNDS'` · bot ile insan aynı kelimeleri alır · bot intermission'da ve `roundDone` sonrası
  yazmaz · `startDelayMs` zorluk sırası kolay>orta>zor · `ROUND_START/ROUND_END` paketleri sunucu zarfında,
  `eventId` benzersiz · rövanş aynı `rounds`, yeni kelimeler · `rounds` geçersiz→5 · dispose tüm timer'ları siler ·
  hâlâ `fetch` çağırmaz.
- **Güncellenecek mevcut testler:** `pvp-practice.test.mjs` "a full deterministic match runs to an end state"
  (artık turlar üzerinden), "bot difficulty changes typing speed" (tur bazlı ölçüm), "surrender, rematch…"
  (yeni maçta `round.index===1`).

### Kapsam dışı (başka ajanlar)
- `pvp/shared/words.js` ve tek oyunculu ana sayfa (`app.js`) kelime çeşitliliği: kelime bankası ajanı.
- 3D çekme/fırlatma animasyonu: 3D ajanı, §6 sözleşmesine göre (`motion`, `returnAt`).

---

## 12. Kabul kriterleri
- `npm test` tamamen yeşil; klasik mod testleri değişmeden geçer.
- Aynı odadaki iki istemci her turda aynı 10 kelimeyi görür; iki maç arasında kelimeler farklıdır.
- 5/7/10 seçimi lobide ve bot modunda çalışır; kesinleşmede maç erken biter; eşitlikte ani ölüm oynanır.
- Kusursuz rünsüz tur 10. kelimede KO eder; hiçbir kombinasyon 9'dan önce KO edemez.

---

## Açık sorular (önerilen varsayılanla)

1. **HP turlar arasında sıfırlansın mı, taşınsın mı?** → Varsayılan: **sıfırlanır** (`ROUND_HP=1200`).
2. **Bir oyuncu 10'u bitirince tur hemen mi bitsin?** → Varsayılan: hayır, rakibe **5 sn son çağrı**.
3. **Yanlış kelime yeniden mi yazılsın, tüketilsin mi?** → Varsayılan: **tüketilir** (turda tam 10 deneme).
4. **Tur kazananı ölçütü** → Varsayılan: KO, yoksa `RP = 100·doğru + 50·enİyiSeri + hasar/10`.
5. **Çarpan eğrisi** → Varsayılan: seri 7'de ×1.5, her ek doğru ×1.2, tavan ×2.5.
6. **Çarpışmada kim bloklar?** → Varsayılan: **önce gönderen**, şans %30 (mevcut `SHIELD_PROBABILITY`).
7. **Varsayılan maç uzunluğu** → **5 tur**; rövanşta aynı uzunluk korunur.
8. **Ani ölüm sınırı** → en fazla **3** ani ölüm turu, sonra berabere.
9. **Kelime zorluğu turla artsın mı?** → Varsayılan: evet, ilk yarı 3–7 harf, ikinci yarı 4–9, ani ölüm 5–10.
10. **Rün enerjisi / Son Direniş her turda sıfırlansın mı?** → Varsayılan: **evet** (her tur bağımsız düello).
11. **İki tur üst üste hiç yazmayan (AFK) oyuncu?** → Varsayılan: özel kural yok; turları kaybeder,
    bağlantı koparsa mevcut 20 sn hükmen kuralı geçerli.
