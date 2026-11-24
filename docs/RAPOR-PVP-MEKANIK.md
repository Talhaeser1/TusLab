# RAPOR — PvP mekanik, denge, beceri çubuğu, bot zekâsı (23 Kasım 2026)

Şerit: PvP MEKANİK / DENGE / BECERİ ÇUBUĞU / BOT AI. `index.html` değişmedi. Commit/push/deploy yapılmadı.
Ana mod: raund modu (`mode=rounds`, zamana karşı 30 sn varsayılan; çevrimiçi oda ve antrenman aynı motoru kullanır).

## 1. Maddeler: kök neden → değişiklik → dosya:satır

1. **Beceri çubuğu "doldu mu belli değil", S maç yokken "Hazır"**
   - Kök neden: (a) `skillCardHTML` eşiksiz (S) kartı `ready` + dolu ölçerle çiziyordu; `applySkillPreview`/`skillMeter` S'yi maç dışında da `ready` sayıyordu → maç yokken "S Demir Duruş — Hazır". (b) Rounds'ta kart enerjisi `min(eşik, seri)` idi → Q seri 3'ten sonra (atılmış olsa da) hep "Hazır" kalıyordu, sıfırlanmıyordu. (c) Klasikte enerji `combo%5` → R'nin atıldığı 5. kelimede sayaç 0'a düşüyor, R kartı hiç 5/5 göstermiyordu; Q atıldıktan sonra 3–4. kelimelerde de "Hazır" yazıyordu. (d) Klasik satırda motor 'e' (yakın vuruş) kartı "E" rozetiyle görünüyordu ("E Kasırga").
   - Değişiklik: saf `skillCharge(key, seri, {rounds})` → `n/N` doluyor · tam eşik kelimesinde **HAZIR** · eşik geçilince **Kullanıldı** · yeni çevrimde/seri düşüp eşik yeniden geçilince yeniden dolar; rounds'ta 10 sonrası Q zinciri 1/3 → 2/3 → HAZIR. Yeni durumlar `idle` (maç yok: S "Maçta açılır", boş ölçer), `used`, `off` (rounds'ta S "Yalnız klasik"). Klasik E kartının rozeti canlıda "W".
   - Dosyalar: `pvp/skillbar.js:45-58` (ilk çizim), `:59-91` (`skillCharge`, `readSkillState`), `:93-115` (`skillMeter`, `skillStatusText`), `:173-181` (önizleme), `:198-202` (rozet); `pvp/skillbar.css:81-85`; HUD rayı `pvp/hud-v2.js:41-58` (alt yazı `n/N` · HAZIR · kullanıldı), `pvp/fight-hud.css:275`.
   - Not: tarayıcıda gözle kontrol edilmedi (bu şeritte tarayıcı yok); motor → `readSkillState` zinciri testle doğrulandı.
2. **"Ultide de max 2 kombo"**
   - Kural: çarpan (`streakMultiplier`) seri 10'da ×1,5'ten başlar, ×1,2 artar. `ULTIMATE_MULTIPLIER_CAP=2` eklendi; R çarpanı `min(2, çarpan)` (`pvp/shared/match.js:144`, `:588`). Genel çarpan tavanı da 2,5 → **2** (`:142`). R şu an yalnız seri 10'da atıldığı için ×1,5 alır; tavan güvence. (Yorum notu: "2 kombo" ×2 çarpan olarak uygulandı; "ulti en çok 2 vuruş" kastedildiyse ayrıca söylenmeli — R hâlâ 3 evreli.)
3. **Raund hasar tavanı 1300 kaldırıldı**
   - Kök neden (ölçüm, değişiklik ÖNCESİ motor, orta–orta, 30 maç): 30/30 maç **tam 4. raundda** nakavtla bitti, 1. koltuk 24/30 kazandı. Tavan her raund iki tarafı 1300'de eşitliyordu → 3×1300=3900, canlar ~100'e iniyor, 4. raundda **ilk vuran** kazanıyordu (bu, madde 4'teki "kim ilk vurursa kazanır" şikâyetinin asıl kaynağı).
   - Değişiklik: `ROUND_DAMAGE_CAP` sabiti, `resolveDueAttacks` içindeki kırpma, `capped` alanı, `damageCap` (anlık görüntü + `ROUND_START`) silindi; sunucu yeniden ihracı güncellendi; arayüzde "x/1300 · TAVAN" ve "tavan" rozeti kalktı. `pvp/shared/match.js` (sabit/kırpma satırları silindi), `cloudflare/src/match.js:27-28`, `pvp/rounds-ui.js:12,26-27,58-61,200,259,269,400,538`, `pvp/rounds-ui.css:288`.
4. **"Canımız 400, vuruş 400, ilk vuran kazanır"**
   - Kök neden: 1. maddede ölçülen tavan eşitlemesi + çözüm sırasında **her zaman 1. koltuğun önce vurması** (`scheduleAlternating`). Tavan kalkınca hasar 2000+/raund oluyordu (orta–orta 2. raundda nakavt) çünkü 10 serisinden sonra her kelime ×2,5 Q'ydu.
   - Değişiklik (büyük sistem yok, yalnız sayı/ölçek): can 4000 → **6000**; raund tabanı iki arketipte eşit `ROUND_DAMAGE={q:100,e:180,r:305}` (klasik `DAMAGE` aynı); 10 sonrası Q zinciri **her 3. kelime** (`CHAIN_EVERY=3`); çarpan tavanı ×2; sıra: **ilk becerisini (destek hariç) önce yazan önce vurur**, eşitlikte raund numarasına göre dönüşümlü. `pvp/shared/match.js:64-67,130-142,511-521,590`.
   - Sonuç: tek sıradan vuruş en çok 210 (canın %3,5'i); orta–orta ortalama 5,5 raund ve ~80 isabet; tek raundda nakavt yok (test).
5. **Kalkan ya da can (karakter başına tam biri)**
   - Değişiklik: `fighters.js` `skills.e.defense:'shield'|'heal'` + `shield:true`/`heal:true` bayrağı, kısa metin "KALKAN: 300 hasar emer" / "CAN: +300 can toplar"; `fighterDefense(id)`. Motor: E (seri 7) kalkansa `shieldHp=300` → o raundun çözümünde gelen hasarı emer, biterse `SHIELD_BROKEN{kind:'e-shield'}`, raund sonunda söner; `DAMAGE_APPLIED.absorbed`. Olay adı uyum için `HEAL_APPLIED`, `kind:'shield'|'heal'`, `shield`, `shieldAdded`, `banked`. HUD: `fhud2-shield` rozeti "KALKAN 300", sayı balonu "KALKAN 300" (mavi), ray E ikonu kalkan.
   - Dosyalar: `pvp/shared/fighters.js:18,30,44,57,70,99-100`; `pvp/shared/match.js:145-151,561-583,750-754,780-791`; `pvp/hud-v2.js:119-122`; `pvp/fight-hud.js:388-397,424-425`; `pvp/fight-hud.css:367`.
6. **Hacı Usta "Şerbet Molası" çalışmıyor**
   - Kök neden (eski motorla yeniden üretildi): `resolveAtEnd` modunda hasar raund sonunda iner; 1. raundda E atıldığında can her zaman tam → `amount:0`, raund sonunda `healDone 0` (çıktı: `HEAL_APPLIED {amount:0, base:148, hp:4000}`, raund sonu `3895/4000 healDone 0`). Kelime raundunda 1. raund 5 kelime olduğundan seri 7'ye zaten ulaşılamıyordu.
   - Değişiklik: can doluyken atılan E boşa gitmez; `healBank`'te bekler ve o raundun ilk yenen darbesinden hemen sonra uygulanır (azami canı aşmaz). Yeni motor aynı senaryo: `HEAL_APPLIED {amount:0, banked:300}`, raund sonu `6000/6000 healDone 100`. `pvp/shared/match.js:566-578,780-791`.
7. **Karakter başına bot zekâsı**
   - Gerçek: beceriler seriyle kendiliğinden atılır, oyuncu tuşa basmaz → botun kararları **yazma planı** (hızlı/dengeli/dikkatli: seriyi koruyup E veya R'ye ulaşmak ya da rakip düşükken hızlanmak) ve **raund arası süre becerisi** seçimidir. Yeni saf modül `pvp/shared/bot-ai.js` (`decideBotPlan`, `pickBotTimeSkill`, `botContext`, `applyPlan`, `BOT_PERSONAS`); `pvp/practice.js:29-30,150-151,214,272-296,304,315,370` entegre. Rastgelelik ayrı tohumlu akıştan (`createRng(matchId+':bot-ai')`) → motorun rng tüketimi değişmez, aynı tohumda aynı maç. `botAi:false` eski davranış. Yazma hızı/doğruluğu (BOT_DIFFICULTIES) değişmedi; planlar yalnız çarpan.

## 2. Yeni denge tablosu (raund modu)

| Kalem | Eski | Yeni |
|---|---|---|
| Can (`ROUND_HP`) | 4000 | **6000** |
| Raund hasar tavanı | 1300 | **yok** |
| Taban Q / W / R | Ateş 105/175/305 · Rün 95/185/305 | **iki arketip 100 / 180 / 305** (klasik değişmedi) |
| 10 sonrası zincir Q | her kelime | **her 3. kelime** (13, 16, 19 …) |
| Çarpan tavanı | ×2,5 | **×2** |
| Ulti (R) kombo sınırı | yok (×1,5 fiilen) | **en çok ×2** |
| E savunma | herkes can, 140/148, raund ≤400 | **kalkan YA can, 300, raund ≤500** |
| Destek vuruşu (%3,5) | 140 | 210 |
| Tek sıradan vuruş en çok | 263 (%6,6) | 210 (%3,5) |
| Çözüm sırası | hep 1. koltuk önce | ilk becerisini önce yazan önce |

| Karakter | E becerisi | Tür |
|---|---|---|
| Vargr | Kan Nabzı | CAN +300 |
| Sira | Gölge Sisi | KALKAN 300 |
| Doran | Sur Andı | KALKAN 300 |
| Nyx | Şifa Rünü | CAN +300 |
| Hacı Usta (konyali) | Şerbet Molası | CAN +300 |

## 3. Bot zekâsı (karakter başına ağırlıklar, 0–1)

| Karakter | Kişilik | aggro | guard | sustain | burst | noise |
|---|---|---|---|---|---|---|
| Vargr | saldırgan | 1,00 | 0,25 | 0,45 | 0,55 | 0,30 |
| Sira | fırsatçı | 0,75 | 0,55 | 0,25 | 0,70 | 0,35 |
| Doran | savunmacı | 0,45 | 0,60 | 0,50 | 0,45 | 0,20 |
| Nyx | patlayıcı | 0,55 | 0,35 | 0,40 | 1,00 | 0,30 |
| Hacı Usta | dayanıklı | 0,40 | 0,45 | 1,00 | 0,50 | 0,25 |

Puanlar (her kelimede): **h** (E): kalkanlıda `guard·(0,9·rakipUltiYakın + 0,6·sertVuruldu) + 0,3·(1−can)`, canlıda `sustain·(1,4·(1−can) + 0,4·sertVuruldu) + 0,2·rakipUltiYakın` (yalnız E bu raund kullanılmadıysa ve seri < 7) · **r**: seri 5–9 iken `burst·(0,55+0,25·seri/10)` · **finish**: `aggro·(1,3·(1−rakipCan)² + 0,35·(1−kalanSüre)) + 0,15·(can−rakipCan)` · **steady** 0,45; her puana `±noise/2` gürültü. En yüksek: h/r → `careful` (hız ×0,95, hata ×0,45), finish → `push` (×1,09, ×1,75), steady → `steady`. Planlar dengeli ölçüldü (Vargr aynasında zorla push 109/200, steady 112/200, careful 95/200 — gürültü içinde). Süre becerisi: zorluk şansı tutarsa saldırgan Zaman Hırsızı, gerideki Donmuş An, patlayıcı Karanlık Saat'e yatkın.

## 4. Doğrulama (komutlar ve gerçek çıktılar)

- `node --check` (match.js, fighters.js, bot-ai.js, practice.js, skillbar.js, hud-v2.js, fight-hud.js, rounds-ui.js, cloudflare/src/match.js): hepsi geçti.
- `node --test tests/*.test.mjs` → `# tests 1011 · # pass 1011 · # fail 0` (başlangıç 974/0; yeni dosya `tests/pvp-mekanik-savunma-bot.test.mjs` 11 test, `tests/pvp-skillbar.test.mjs` +3 test; eski kuralı sabitleyen testler yeni kurala güncellendi: assist31, cloudflare, combat09, dort-yetenek, fighters32, kelime-raundu-kural, mac-mekanik-i, practice, practice-rounds, raund-bant, raund-sistemi, raund-sonu, results15, rounds-engine, rounds-room, rounds-ui, skillbar).
- Testler-önce notu: madde 3/4/6 önce motorda simülasyon ve eski motor kopyasıyla yeniden üretildi (çıktılar §1), testler düzeltmeyle aynı turda yazıldı; madde 6 testi eski motorda `banked` alanı olmadığı ve can artmadığı için kalır.
- `node cloudflare/build-assets.mjs` → **BAŞARISIZ**: `EPERM: operation not permitted, unlink cloudflare/public/_headers` (bu oturumda silme kapalı; `cloudflare/public/` .gitignore'da). `node scripts/predeploy-check.mjs` → `Ön dağıtım kontrolü başarılı: 77/77 kontrol.` (eski `public/` kopyası üzerinde; yeni dosyalar oraya kopyalanamadı).
- Simülasyon (gerçek motor + `botWordDelay`/`makeTypo` + bot zekâsı iki tarafta, destek açık, tohumlu): zamana karşı, orta–orta, **300 maç/eşleşme**:

| Eşleşme | P1 kazanma | P2 kazanma | Ort. raund | Nakavt | Ort. isabet |
|---|---|---|---|---|---|
| Vargr – Doran | %57,7 | %42,3 | 5,53 | %100 | 79,2 |
| Vargr – Nyx | %56,3 | %43,7 | 5,50 | %100 | 91,6 |
| Vargr – Hacı Usta | %51,3 | %48,7 | 5,57 | %100 | 91,7 |
| Sira – Doran | %54,3 | %45,7 | 5,50 | %100 | 66,7 |
| Sira – Nyx | %52,3 | %47,7 | 5,43 | %100 | 78,9 |
| Sira – Hacı Usta | %54,0 | %46,0 | 5,57 | %100 | 79,9 |

  Kelime raundu (200 maç/eşleşme): kazanma %45,5–56, hep 7 raund, nakavt yok (kusursuz oyuncu 7 raundda en çok 3992 vurur < 6000). Zorluk aynası (100 maç): zor–zor 3,00 raund, orta–orta 5,52, kolay–kolay 7,00 (can üstünlüğü); en büyük tek vuruş 210. Bot zekâsı kapalıyken (mekanik tek başına) eşleşmeler %49–54,5. "İsabet" yalnız can düşüren vuruşları sayar (kalkanın emdiği sayılmaz).

## 5. Başka şeritte gereken değişiklikler

- GEREKEN DEĞİŞİKLİK: `pvp/arena3d-fx.js` / `pvp/arena3d.js` (sahibi belirtilmemiş görsel şerit) → `HEAL_APPLIED` olayında `kind==='shield'` ise iyileşme yerine kalkan görseli (şimdilik karakterin E motifi + "heal" klibi oynuyor; Doran "aegis", Sira "mist" motifi kalkana uygun). `SHIELD_BROKEN{kind:'e-shield'}` için kırılma efekti.
- GEREKEN DEĞİŞİKLİK: `pvp/index.js` (akış şeridi) → `pvp2-skillrow` ilk işaretlemesi rounds'ta Q/E/S/R kartlarını klasik eşiklerle (2/4/0/5) çiziyor; rounds maçında W kartı yok ve S "Yalnız klasik" görünür. İstenirse rounds için Q/W/E/R satırı.
- GEREKEN DEĞİŞİKLİK: `pvp/network.js` → yok (yeni istemci alanı yok; sunucu doğrulaması gerekmedi). `pvp/sound.js` → kalkan kırılma/kalkan kurma sesi isteğe bağlı.

## 6. Kalan sorunlar

- Tarayıcıda gözle kontrol yapılmadı (beceri çubuğu, KALKAN rozeti, mavi "KALKAN 300" balonu).
- `cloudflare/build-assets.mjs` silme izni olmadığı için çalışmadı; `public/` eski. Yayından önce silme izniyle `npm run cf:validate` yeniden çalıştırılmalı.
- Bot zekâsıyla ateş tarafı hafif önde (%51–58); en zayıf Doran (%42–46). Kişilik ağırlıkları ince ayar ister.
- Zor–zor maçlar ortalama 3 raundda bitiyor (çok hızlı yazanlar için hâlâ kısa); kolay–kolay hiç nakavt olmuyor (7. raundda can üstünlüğü).
- Klasik mod (2000 can) ve arena değişmedi; klasikte E savunma becerisi yok (yalnız %30 rastgele S bloğu).
- "Ultide max 2 kombo" ×2 çarpan olarak yorumlandı; R hâlâ 3 evreli vuruş.
