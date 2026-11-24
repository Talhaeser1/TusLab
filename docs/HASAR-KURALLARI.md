# Hasar kuralları (koddan okunmuştur, 12 Kasım 2026; raund modu 23 Kasım 2026 güncellendi — RAPOR-PVP-KALANLAR dengesi dahil)

Kaynak: `pvp/shared/match.js` (klasik + raund), `pvp/shared/arena-damage.js` + `arena.js` (arena). Sunucu (`cloudflare/src/match.js`) aynı dosyayı kullanır.
Klasik temel vuruşlar (`DAMAGE`): Ateş Q 105 · E 175 · R 305 — Rün Q 95 · E 185 · R 305. R (ulti) üç vuruşa bölünür: Ateş 65+100+140, Rün 75+90+140.
Rün bonusları (`computeSkillBonus`, rünsüz oyuncuda 0): Alev Mührü Q +8, Savaş Ritimcisi E/R +6, Yıldırım her 3. Q +18, Q→E +15, E→R +25 (12 sn içinde), Ateşte seri ≥3 iken +%7.

## 1. Klasik (`mode=classic`)
- Can 2000, maç 120 sn, 10 sn'lik yazma pencereleri; vuruşlar pencere sonunda sırayla oynatılır.
- Beceri döngüsü seri sayısına göre 5'li çevrim: 2. doğru → Q, 4. → E, 5. → R (sonra baştan). Çarpan yok.
- Savunma RASTGELE: savunanın aynı anda doğru kelimesi varsa %30 kalkan (`SHIELD_PROBABILITY`), kusursuz blokta %45 parry
  (`DEFENSE_RULES.parryChance`) → saldırgana 65 karşı vuruş; açık kalkana E %40, R %70 deler.
- Örnek: Ateş 5 kelimelik tam döngü = 105 + 175 + 305 = 585 (bloksuz). Can 0 → NAKAVT; süre biterse canı fazla olan kazanır.

## 2. Raund (`mode=rounds`) — KESINYAP 11 + RAPOR-PVP-MEKANIK (23 Kasım 2026)
- 7 raund, her oyuncu **6000 can** (`ROUND_HP`) ile başlar; can raundlar arasında **taşınır** (sıfırlanmaz).
- Biçim: **Zamana karşı** her raund 30 sn, kelime tükenmez · **Kelime raundu** 5-7-9-10-10-10-15 kelime: **süre yok, ilk bitiren raundu bitirir** (rakibin o ana kadar yazdıkları sayılır). Kimse bitirmezse gizli 120 sn üst sınırı. Süre becerileri (Zaman Hırsızı, Donmuş An, Karanlık Saat) yalnız zamana karşıda.
- Raund taban hasarı (`ROUND_DAMAGE`, iki arketipte EŞİT): Q 100 · W 180 · R 305 (Ateş 65+100+140, Rün 75+90+140). Klasik `DAMAGE` tablosu değişmedi.
- Seri → beceri (`streakSkill`): 3 → Q, 5 → W, 7 → E (savunma), 10 → R; sonra **13'te Q, ardından her 8. doğru kelimede Q** (21, 29 …; `CHAIN_EVERY=3`, `CHAIN_LONG_AFTER=13`, `CHAIN_EVERY_LONG=8`, `chainProgress`). Önceden 13, 16, 19 … (her 3.) idi; seri her raund sıfırlandığından yalnız raundda 13'ü aşan çok hızlı yazanı etkiler (zor–zor 3,0 → 4,7 raund). Yanlış kelime seriyi **yarıya indirir** (8→4, 7→3 …; `wrongStreak`). Eşiğin altına inen seri eşiği yeniden geçince beceri yeniden atılır.
- Çarpan (`streakMultiplier`): seri < 10 → ×1; 10'da ×1,5 ve her doğru kelimede ×1,2 artar, **en çok ×2** (`MULTIPLIER_CAP`; 10:1,5 · 11:1,8 · 12+:2). **Ulti (R) en çok ×2** (`ULTIMATE_MULTIPLIER_CAP`).
- **E savunma** (karaktere göre YA kalkan YA can, `fighters.js skills.e.defense`; can `DEFENSE_AMOUNT=300`, kalkan `SHIELD_AMOUNT=330` (`healAmount(kind)`), çarpansız; ikisi birlikte raund başına en çok `ROUND_HEAL_CAP=500`):
  - **Kalkan** (Sira "Gölge Sisi", Doran "Sur Andı"): o raundun çözümünde gelen hasarı 330'a kadar emer (300'de kalkanlılar orta botta %40–46 kaldı) (`shieldHp`), biterse `SHIELD_BROKEN` (kind `e-shield`), raund sonunda söner.
  - **Can** (Vargr "Kan Nabzı", Nyx "Şifa Rünü", Hacı Usta "Şerbet Molası"): anında +300 (azami canı aşmaz); can doluyken atılırsa fazlası bekletilir (`healBank`) ve o raundun ilk yenen darbesinden hemen sonra işler.
  - Olay adı geriye uyum için `HEAL_APPLIED`; `kind:'shield'|'heal'`, `banked`, `shield`, `shieldAdded` alanları ayırır.
- **Raund hasar tavanı YOK** (eski `ROUND_DAMAGE_CAP=1300` kaldırıldı: her raund iki taraf da 1300'e dayanıyor, canlar eşitleniyor ve 4. raundda "ilk vuran kazanır" oluyordu).
- **Çözüm sırası** (`scheduleAlternating`): iki tarafın vuruşları dönüşümlü; **ilk becerisini (destek hariç) önce yazan önce vurur** (önceden her zaman 1. koltuk başlıyordu). Eşitlikte raund numarasına göre dönüşümlü.
- **Rastgelelik yok**: rounds'ta kalkan/parry/çarpışma zarı atılmaz.
- Örnek (rünsüz, kusursuz 13 kelime): 3. Q 100 → 5. W 180 (280) → 7. E (hasar yok) → 10. R ×1,5 = 98+150+210 = 458 (738) → 13. Q ×2 = 200 → **938**. Tek sıradan vuruş en çok 210 (canın %3,5'i).
- Bitiş: can 0 → NAKAVT. 7. raund sonunda canı fazla olan kazanır; eşitse en çok 3 ani ölüm raundu (10 kelime), yine eşitse berabere.
- Partner desteği açıksa destek vuruşu savunanın azami canının %3,5'idir (6000 → 210); raund modunda **raund başına en çok 2 destek** (`ROUND_ASSIST_CAP`; bar dolu bekler, sonraki raundda çıkar). Klasik mod etkilenmez.
- Simülasyon (`node scripts/pvp-denge-sim.mjs 300 orta` — gerçek motor, iki tarafta bot zekâsı, destek açık, koltuk her maçta değişir, 10 eşleşme × 300 maç): orta–orta tüm eşleşmeler %45–55, ortalama 6,8 raund, %70–86 nakavt; zor–zor 4,7 raund (önce 3,0); kolay–kolay 7 raund, nakavt yok. Ayrıntı ve önce/sonra tabloları: `docs/RAPOR-PVP-KALANLAR.md` §2.
- Ulti (R) metni oyuncuya görünür: "Ulti çarpanı en çok ×2" (Nasıl oynanır → Hasar ve kombo, R kartı açıklaması).

## 3. Arena (`mode=arena`)
- Can 3000, 6 raund; her raund sonunda o raundun doğru kelimeleri sırayla vurur (`resolveRoundAttacks`).
- Doğru kelime başına taban hasar raunda göre: 100, 90, 80, 80, 80, 75 (`ARENA_ROUND_BASE_DAMAGE`).
- Seri çarpanı: 1–3. ardışık doğru ×1, 4. KOMBO ×1,5, 5+ FİNAL ×2 (Kombo Yükselteci ile ×1,75 / ×2,4).
- Ardışık yanlış cezası sonraki doğru vuruştan düşer: %10, %25, %48, %78 → en çok %75. Ağır Eldiven tabanı +%10, Çelik Kalkan gelen hasarı −%20.
- Örnek (1. raund, 5 ardışık doğru, eşyasız): 100+100+100+150+200 = 650. Önce bir yanlış yazılsaydı ilk doğru 90 olurdu.
- Can 0 → NAKAVT; 6 raund sonunda canı fazla olan kazanır.
