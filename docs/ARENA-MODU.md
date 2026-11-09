# Arena Modu Şartnamesi (spec)

> Bu doküman, arena modunu geliştiren tüm ajanların ortak sözleşmesidir.
> Buradaki sabit değerler, formüller ve fonksiyon imzaları BAĞLAYICIDIR.
> Değişiklik gerekirse önce bu doküman güncellenir, sonra kod.

## 0. Genel kurallar

- Mevcut `rounds` ve `classic` modlarına (`pvp/shared/match.js`) **dokunulmaz**.
  232 testin tamamı yeni işle birlikte geçmek zorundadır (`npm test`).
- Motor kodu saf ES modül olur; yalnız `structuredClone`, `crypto.randomUUID`
  ve `pvp/shared/words.js` kullanılır (Node/Worker/tarayıcı üçlüsünde de çalışır).
- Zaman damgaları her zaman **sunucu/motor saati**dir; tarayıcıdan gelen
  zaman asla kabul edilmez. Tüm rastgelelik enjekte edilebilir RNG ile
  (`rng()` → [0,1)) test edilebilir olmalı.
- Tüm oyuncu metinleri `textContent` ile yazılır; sunucudan gelen hiçbir
  isim/kelime HTML olarak yorumlanmaz.
- Kod yorumları ve adlar projedeki üslubu izler (kısa, İngilizce kod +
  Türkçe açıklama yorumları kabul edilebilir).

## 1. Mod kimliği

- `mode: 'arena'`. `match.js` içindeki `rounds` modundan tamamen bağımsız,
  yeni `pvp/shared/arena.js` dosyasında yaşar.
- Bot antrenmanı: `?pvp=practice&mode=arena&bot=kolay|orta|zor`
  (uyumluluk için `?pvp=arena&bot=...` da çalışır).
- Online: lobide "Arena" modu seçeneği; oda `mode:'arena'` ile kurulur.

## 2. Raund yapısı

```
ARENA_ROUND_WORDS = [5, 10, 15, 15, 15, 20]   // raund başına kelime sayısı
ARENA_TOTAL_ROUNDS = 6                        // son raund FİNAL
ARENA_MATCH_HP = 3000                         // maç boyu kalıcı (hasar denetçisi: 5000→3000)
ARENA_ROUND_DURATION_MS = 30_000              // raund (yazma) süresi — zamana karşı
ARENA_PREP_DURATION_MS = 10_000               // raund öncesi skill+eşya seçimi
ARENA_RESOLVE_STEP_MS = 350                   // raund sonu hasar vuruşları arası animasyon adımı
ARENA_SUMMARY_MS = 4_000                      // raund özeti
ARENA_OVERTIME_MS = 5_000                     // Zaman Hediyesi: rakip bitirse de +5 sn
ARENA_FREEZE_MS = 3_000                       // Donmuş An: kendi süren +3 sn (donar)
ARENA_TIME_THIEF_MS = 5_000                   // Zaman Hırsızı: rakibin süresinden −5 sn
ARENA_MAX_USES = 2                            // her skill ve her eşya maçta en fazla 2 kez
```

Kelime kuralları (`pvp/shared/words.js` `pickWords` kullanılır, tekrar yok):

| Raund | Kelime | Uzunluk | Zorluk |
|---|---|---|---|
| 1 | 5 | 3–6 | easy |
| 2 | 10 | 4–7 | easy |
| 3 | 15 | 4–8 | normal |
| 4 | 15 | 5–9 | normal |
| 5 | 15 | 5–9 | hard |
| 6 | 20 | 5–10 | hard |

İki oyuncu **aynı kelime setini** alır (Harf Kaosu skill'i hariç; bkz. §6).

## 3. Faz makinesi (state machine)

```
prep (10 sn) ──► round (≤30 sn) ──► resolve (hasar) ──► summary (4 sn) ──► prep (sonraki raund)
                                                                    └──► ended
```

- `prep`: her iki oyuncu 1 skill + 1 eşya seçer (veya hiç). İkisi de kilitlerse
  veya süre dolarsa `round` başlar. Seçimler rakibe **kapalıdır**.
- `round`: yazma fazı. Biter:
  1. **İlk bitiren**: bir oyuncu tüm kelimeleri gönderdiyse raund anında biter
     (son çağrı yok). **İstisna:** rakipte Zaman Hediyesi aktifse, rakibin kişisel
     bitişi `bitirenAnı + ARENA_OVERTIME_MS` olur.
  2. **Süre**: oyuncunun kişisel kalan süresi biter (30 sn; Zaman Hırsızı −5 sn,
     Donmuş An +3 sn ile kişiselleşir).
  3. Her iki koşul da izlenir; raund `max(kişisel uçlar)` üzerinden kapanır.
- `resolve`: kelime kelime doğruluk zaten kaydedilmiştir; hasarlar sırayla,
  `ARENA_RESOLVE_STEP_MS` aralıklarla uygulanır (animasyon). KO olursa kalan
  vuruşlar iptal edilir.
- `summary`: raund özeti; sonra ya yeni `prep` ya `ended`.

Raund fazı alanı: `match.round.phase ∈ {'prep','round','resolve','summary','ended'}`.

## 4. Kelime gönderimi (submitArenaWord)

`submitWord`'ün rounds modundaki güvenlik kuralları aynen geçerli:

- `matchId` eşleşmeli, `wordIndex === p.roundWordIndex` olmalı,
- metin: trim + NFC, ≤80 karakter, boşluksuz,
- iki gönderim arası ≥55 ms (`WORD_BURST_LIMIT`),
- faz `round` değilse `ROUND_NOT_ACTIVE`, oyuncu bitirdiyse `ROUND_COMPLETE`.

Her gönderimde kaydedilir (hasar sonra hesaplanmak üzere):

```js
p.attempts.push({ index, submitted, expected, correct, at })
```

Doğruluk, hız, WPM,accuracy hesapları rounds modundakiyle aynı formüldedir.

## 5. Hasar sistemi (arena-damage.js — Ajan 2'nin sahası)

Raund sonu `resolve` fazında, kelime kelime, **gönderim sırasına göre** hesaplanır.

### 5.1 Taban hasar

```
ARENA_ROUND_BASE_DAMAGE = [100, 90, 80, 80, 80, 75]  // raund başına, doğru kelime başına
```

### 5.2 Yanlış çarpanı (toplamsal)

Doğru bir kelimeden sonra gelen her ardışık yanlış, **sonraki doğru kelimenin**
hasarını düşüren katsayı ekler:

```
ARENA_WRONG_FACTORS = [0.10, 0.15, 0.23, 0.30]   // 1., 2., 3., 4.+ ardışık yanlış
ARENA_PENALTY_CAP = 0.75                          // toplam düşüş tavanı (hasar en az %25)
```

- `penalty = min(ARENA_PENALTY_CAP, sum(factors[:consecutiveWrong]))`
- Doğru kelime gelince ardışık yanlış sayacı sıfırlanır.
- **Sözleşme örneği:** `D Y Y Y D` → 1. kelime tam hasar; 5. kelime
  `×(1 − 0.10 − 0.15 − 0.23) = ×0.52`.
- HUD'da `−%48` biçiminde gösterilir.

### 5.3 Kombo (maks 4)

Ardışık doğru sayacı (`streak`):

```
streak 1–3  → çarpan 1.0
streak 4    → KOMBO vuruşu   ×1.5   ("4'lü kombo")
streak 5+   → FİNAL vuruşu   ×2.0   (kombo devam eder, sayaç 4'te taşmaz)
```

Yanlış kelime komboları sıfırlar. Yanlış çarpanı ile kombo çarpanı **aynı**
kelimede çarpılarak birleşir: `amount = round(base × komboÇarpanı × (1 − penalty))`.

### 5.4 Eşyalar (prep fazında seçilir, o raund geçerli)

| id | Ad | Etki |
|---|---|---|
| `combostone` | 🔥 Kombo Yükselteci | KOMBO ×1.5→×1.75, FİNAL ×2.0→×2.4 |
| `cleanse` | 🛡️ Arınma Taşı | Yanlış çarpanı o raund uygulanmaz (penalty=0) |
| `gauntlet` | 🥊 Ağır Eldiven | Taban hasar +%10 (denetim sonrası; ilk değer +%20) |
| `aegis` | ⚡ Çelik Kalkan | O raund alınan hasar −%20 |

### 5.5 Sözleşme fonksiyonları (imzalar değişmez)

```js
// pvp/shared/arena-damage.js
export const ARENA_WRONG_FACTORS, ARENA_PENALTY_CAP, ARENA_COMBO_RULES,
             ARENA_ROUND_BASE_DAMAGE, ARENA_ITEMS
export function wrongPenalty(consecutiveWrong, item)     // → 0..0.75
export function comboMultiplier(streak, item)            // → 1.0 | 1.5 | 1.75 | 2.0 | 2.4
export function wordDamage({roundIndex, streakBefore, consecutiveWrong, item})
// → { amount, multiplier, penalty, tags:['KOMBO'|'FİNAL'|'ARINMA'...], base }
```

- `wordDamage` tam sayı `amount` döner (`Math.round`).
- Sözleşme testleri (`tests/pvp-arena-damage.test.mjs`) yukarıdaki örnekleri
  birebir doğrular; bu örnekler bozulamaz.

## 6. Skill sistemi (arena-skills.js — Ajan 3'ün sahası)

Prep fazında seçilir, **bir sonraki raunda** etki eder. Her skill maçta en
fazla `ARENA_MAX_USES` (2) kez kullanılır.

| id | Ad | Etki |
|---|---|---|
| `scramble` | 🔀 Harf Kaosu | Rakibin o raund kelimelerinin harfleri karışık gösterilir; rakip **karışık haliyle** yazmak zorundadır (karpuz → zurpak) |
| `overtime` | ⏰ Zaman Hediyesi | Rakip kelimeleri bitirse de sana +5 sn yazma süresi |
| `timethief` | 🕜 Zaman Hırsızı | Rakibin o raund süresinden −5 sn |
| `freeze` | ❄️ Donmuş An | Kendi süren 3 sn donar (+3 sn eşdeğeri) |
| `blindclock` | 🌑 Karanlık Saat | Rakip kalan süresini göremez (anlık görüntüde rakip süresi `null`) |

Kurallar:

- `scrambleWord(word, rng)`: kelimenin **anagramı**dır (aynı harf çokluğu),
  orijinalinden farklıdır (≥2 farklı harf varsa), deterministik RNG ile üretilir
  (seed: `match.seed + round.index + wordIndex`).
- Karıştırma yalnızca **etkilenen oyuncunun görünümünü ve beklenen girdisini**
  değiştirir: `p.roundWords[index] = scrambled`. Diğer oyuncu orijinali görür/yazar.
- `blindclock` yalnızca anlık görüntüye yansır: `arenaPublicMatch(match, seat)`
  rakibin kalan süresini `null` gösterir.
- Skill seçimleri gizli; kendi anlık görüntünde görünür.

```js
// pvp/shared/arena-skills.js
export const ARENA_SKILLS
export function scrambleWord(word, rng)
export function validatePick(match, seat, {skill, item})   // kullanım hakkı + geçerlilik
```

## 7. Motor API'si (arena.js — Ajan 1'in sahası)

`match.js` ile aynı desen: saf geçişler, `structuredClone` ile kopya,
`sequence` artışı, `combatEvents` (son 24) + raund olayları.

```js
export function createArenaMatch(players, at, id, {seed?, pickWords?})
export function submitArenaPick(match, {playerId, skill, item}, at)   // yalnız prep fazında
export function submitArenaWord(match, {playerId, matchId, wordIndex, text, round}, at)
export function advanceArenaMatch(match, at, rng)   // → {match, events, roundEvents}
export function nextArenaDeadline(match)            // DO alarm zamanı
export function arenaPublicMatch(match, viewerSeat) // kişiye göre süreyi/kelimeleri filtreler
export function arenaMatchResult(match)             // sonuç kartı (matchResult deseni)
export function surrenderArenaMatch(match, loserSeat, at)  // surrenderMatch deseni
export const ARENA_SERVER_ONLY_EVENTS = new Set([...])    // bkz. §9
```

- Oyuncu state'i `match.js` participant deseniyle aynı başlar; ek alanlar:
  `roundWordIndex, attempts, roundSkill, roundItem, skillUses, itemUses,
  personalEndsAt, frozenUntil, overtimeUntil, roundDone, finishedAt`.
- `advanceArenaMatch` faz geçişlerini `nextDeadline` ile sürer (DO alarm uyumu).
- KO: `resolve` fazında HP 0 → `round.phase='ended'`, maç biter (`endReason:'KNOCKOUT'`).
- 6 raund sonunda canlı kalan taraflardan **yüksek HP** kazanır;
  eşitse doğru kelime, sonra toplam hasar, hâlâ eşitse beraberlik
  (`endReason:'ARENA_DRAW'`).

### 7.1 Olay (event) adları

```
ARENA_PREP_START    {round, endsAt}
ARENA_PICK_ACK      {seat, skill, item}            (yalnız ilgili oyuncuya)
ARENA_ROUND_START   {round, totalRounds, words, endsAt}   (kişisel kelimeler!)
WORD_RESULT         (rounds modundaki alanlarla uyumlu)
ARENA_ROUND_END     {round, scores, roundsWon benzeri özet}
ARENA_ATTACK        {fromSeat,toSeat,wordIndex,amount,multiplier,penalty,tags,hpAfter}
ARENA_MATCH_END     {result}
```

`SERVER_ONLY_EVENTS` kümesine arena olayları eklenir (`match.js` dışında,
`arena.js` kendi kümesini ihraç eder; `cloudflare/src/match.js` re-export eder).

### 7.2 Anlık görüntü (arenaPublicMatch)

`publicMatch` desenini izler + arena alanları:

```js
{ mode:'arena', phase, round:{index,total,phase,words(KİŞİSEL),endsAt},
  me:{remainingMs, frozen, picks, usesLeft...},
  opponent:{remainingMs | null (Karanlık Saat), roundDone, hp...},
  players:[...], result }
```

## 8. Entegrasyonlar

### 8.1 Bot antrenmanı (Ajan 4)

- `pvp/practice.js` genişletilir: `mode:'arena'` seçeneği; bot mevcut beyinden
  (kolay/orta/zor ~25/45/70 WPM) yazmaya devam eder.
- Bot prep fazında elindeki skill/eşyalardan rastgele seçer.
- `?pvp=practice&mode=arena&bot=orta&char=fire&arena=2d|3d` çalışır.
- 3B arena ile uyum: mevcut `arena3d.js` katmanları ARENA_ATTACK olaylarını
  `DAMAGE_APPLIED` benzeri görselleştirir (en azından 2B CSS arena çalışır).

### 8.2 Arayüz (Ajan 4) — 4 bölümlü akış

- Yeni `pvp/arena-ui.js` + `pvp/arena-ui.css` (`rounds-ui.js` deseni:
  yalnız sunucu anlık görüntüsünü gösterir, hiçbir skor yerelde hesaplanmaz).
- Bölümler: **RAUND ÖNCESİ** (skill+eşya kartları, kalan kullanım hakları,
  kilit sayacı) → **RAUND** (yazma ekranı sayfanın üst-orta bölümünde,
  canlı HP çubukları, kalan süre, D/Y şeridi, `−%48` ceza göstergesi,
  kombo sayacı 4 hücre) → **RAUND SONRASI** (yazma paneli yumuşak animasyonla
  alta iner, dövüş animasyonu + hasar sayıları `fx-damage.js` ile) → özet.
- Yazma paneli `transform: translateY()` geçişiyle iner/çıkar
  (`prefers-reduced-motion` desteği projedeki üsluba uygun).

### 8.3 Online (Ajan 5)

- `cloudflare/src/match.js`: arena ihracatları re-export edilir.
- `cloudflare/src/room.js`: `mode:'arena'` odaları — `submitArenaPick`,
  `submitArenaWord`, `advanceArenaMatch`, **kişiye göre anlık görüntü**
  (Karanlık Saat + kişisel kelimeler nedeniyle her bağlantıya ayrı gönderim).
- `pvp/contracts.js` + lobide ("Arena" modu seçimi) şema/genişletme.
- `npm run cf:validate` geçmek zorunda.

## 9. Testler

| Dosya | Kapsam | Ajan |
|---|---|---|
| `tests/pvp-arena-damage.test.mjs` | §5 sözleşme örnekleri, kombo, cap, eşyalar | Ajan 2 |
| `tests/pvp-arena-skills.test.mjs` | §6 katalog, scramble determinizmi, kullanım hakkı | Ajan 3 |
| `tests/pvp-arena-engine.test.mjs` | faz makinesi, submit kuralları, ilk-bitiren, KO, maç sonu, deterministik RNG ile tam maç | Ajan 1 |
| `tests/pvp-arena-ui.test.mjs` | DOM bölümleri, kişisel kelime görünümü, süre gizleme | Ajan 4 |
| `tests/pvp-arena-online.test.mjs` | oda kurulumu, kişiye göre anlık görüntü, olay akışı | Ajan 5 |

- Tüm testler `node --test` ile deterministik koşar (enjekte edilmiş rng/seed).
- Mevcut 232 test kırmadan geçmeli; `npm run cf:validate` 54/54+ geçmeli.

## 10. Denge başlangıç değerleri (tunable)

`ARENA_MATCH_HP=3000`, taban hasar `[100,90,80,80,80,75]` ile:

- Kusursuz R1: `100+100+100+150+200 = 650`
- Kusursuz R6 (20 kelime): `3×75 + 113 + 16×150 ≈ 2738`
- Tipik maç (%60 doğruluk, cezalarla) KO'ya 4–6 raund arası ulaşır.

Bu değerler Ajan 2'nin raporunda gerekçeyle ayarlanabilir; sözleşme
örnekleri (×0.52 vb.) korunarak.
