# Hasar kuralları (koddan okunmuştur, 12 Kasım 2026)

Kaynak: `pvp/shared/match.js` (klasik + raund), `pvp/shared/arena-damage.js` + `arena.js` (arena). Sunucu (`cloudflare/src/match.js`) aynı dosyayı kullanır.
Temel vuruşlar (`DAMAGE`): Ateş Q 105 · E 175 · R 305 — Rün Q 95 · E 185 · R 305. R (ulti) üç vuruşa bölünür: Ateş 65+100+140, Rün 75+90+140.
Rün bonusları (`computeSkillBonus`, rünsüz oyuncuda 0): Alev Mührü Q +8, Savaş Ritimcisi E/R +6, Yıldırım her 3. Q +18, Q→E +15, E→R +25 (12 sn içinde), Ateşte seri ≥3 iken +%7.

## 1. Klasik (`mode=classic`)
- Can 2000, maç 120 sn, 10 sn'lik yazma pencereleri; vuruşlar pencere sonunda sırayla oynatılır.
- Beceri döngüsü seri sayısına göre 5'li çevrim: 2. doğru → Q, 4. → E, 5. → R (sonra baştan). Çarpan yok.
- Savunma RASTGELE: savunanın aynı anda doğru kelimesi varsa %30 kalkan (`SHIELD_PROBABILITY`), kusursuz blokta %45 parry
  (`DEFENSE_RULES.parryChance`) → saldırgana 65 karşı vuruş; açık kalkana E %40, R %70 deler.
- Örnek: Ateş 5 kelimelik tam döngü = 105 + 175 + 305 = 585 (bloksuz). Can 0 → NAKAVT; süre biterse canı fazla olan kazanır.

## 2. Raund (`mode=rounds`) — KESINYAP 11
- 7 raund, her oyuncu **4000 can** ile başlar; can raundlar arasında **taşınır** (sıfırlanmaz).
- Biçim: **Zamana karşı** her raund 30 sn, kelime tükenmez · **Kelime raundu** 5-7-9-10-10-10-15 kelime, kelime başına 6 sn.
- Seri → beceri (`streakSkill`): 3 → Q, 5 → E, 7 → R, 8 ve sonrası her doğru kelime → Q. Yanlış kelime seriyi 0'lar.
- Çarpan (`streakMultiplier`): seri < 7 → ×1; 7'den itibaren ×1,5 ve her doğru kelimede ×1,2 artar, en çok ×2,5 (7:1,5 · 8:1,8 · 9:2,16 · 10+:2,5).
- **Rastgelelik yok**: rounds'ta kalkan/parry/çarpışma zarı atılmaz, her vuruş tam iner.
- **Raund tavanı 1300** (`ROUND_DAMAGE_CAP`): bir oyuncu tek raundda en çok 1300 verir, fazlası düşer → 3 × 1300 = 3900 < 4000, nakavt en erken 4. raundda.
- Örnek (Ateş, rünsüz, kusursuz 10 kelime): 3. Q 105 → 5. E 175 (280) → 7. R ×1,5 = 98+150+210 = 458 (738) → 8. Q ×1,8 = 189 (927)
  → 9. Q ×2,16 = 227 (1154) → 10. Q ×2,5 = 263 ama tavan 146'sına izin verir → raund hasarı **1300 · TAVAN**.
- Bitiş: can 0 → NAKAVT. 7. raund sonunda canı fazla olan kazanır; eşitse en çok 3 ani ölüm raundu (10 kelime), yine eşitse berabere.
- Partner desteği açıksa destek vuruşu savunanın azami canının %3,5'idir (4000 → 140); raund tavanına dahildir.

## 3. Arena (`mode=arena`)
- Can 3000, 6 raund; her raund sonunda o raundun doğru kelimeleri sırayla vurur (`resolveRoundAttacks`).
- Doğru kelime başına taban hasar raunda göre: 100, 90, 80, 80, 80, 75 (`ARENA_ROUND_BASE_DAMAGE`).
- Seri çarpanı: 1–3. ardışık doğru ×1, 4. KOMBO ×1,5, 5+ FİNAL ×2 (Kombo Yükselteci ile ×1,75 / ×2,4).
- Ardışık yanlış cezası sonraki doğru vuruştan düşer: %10, %25, %48, %78 → en çok %75. Ağır Eldiven tabanı +%10, Çelik Kalkan gelen hasarı −%20.
- Örnek (1. raund, 5 ardışık doğru, eşyasız): 100+100+100+150+200 = 650. Önce bir yanlış yazılsaydı ilk doğru 90 olurdu.
- Can 0 → NAKAVT; 6 raund sonunda canı fazla olan kazanır.
