# TuşLab — PvP Oyuncu Rehberi

> Bu rehber doğrudan oyun kodundan alınmıştır; buradaki tüm sayılar (HP, süre, çarpan, kullanım hakkı) motordaki gerçek değerlerdir.

## 1. Modlar

TuşLab'te üç PvP modu var. **Klasik**: 90 saniyelik, 2000 HP'lik serbest düello; her 5 doğruda Q (2.), E (4.), R (5.) vuruşları otomatik atılır (bekleme: Q 1,3 sn · E 2,5 sn · R 4,5 sn). **Zamana Karşı**: 30 saniyelik kısa turlarda seri yarışı (ayrıntı: bölüm 7). **Arena**: 6 raundluk, skill + eşya seçilen ana mod (bölüm 2–6).

| Mod | Ana sayfa kartı | Doğrudan adres |
|---|---|---|
| Klasik | "Klasik" | `?pvp=practice&mode=classic` |
| Zamana Karşı | "Zamana Karşı" | `?pvp=practice&mode=rounds` |
| Arena | "Arena" | `?pvp=practice&mode=arena` |

- Ana sayfadaki **"PvP Ruh Düellosu"** kartları bota karşı anında başlatır; **"Çevrimiçi lobiyi aç"** düğmesi arkadaşla oynamayı sağlar (lobide modu oda sahibi seçer).
- Adrese şunlar eklenebilir: `&bot=kolay|orta|zor` (~25/45/70 WPM, varsayılan orta), `&char=fire|rune`, `&arena=2d|3d`. Kısa yol olarak `?pvp=arena` de Arena antrenmanını açar.

## 2. Raund sistemi (Arena)

Arena **6 raundluk** bir düellodur. İki oyuncu **aynı kelime setini** alır. Her oyuncu **3000 HP** ile başlar ve HP raundlar arasında taşınır (yenilenmez).

| Raund | Kelime sayısı | Harf sayısı | Zorluk |
|---|---|---|---|
| 1 | 5 | 3–6 | kolay |
| 2 | 10 | 4–7 | kolay |
| 3 | 15 | 4–8 | normal |
| 4 | 15 | 5–9 | normal |
| 5 | 15 | 5–9 | zor |
| 6 (FİNAL) | 20 | 5–10 | zor |

Raund akışı dört adımdır: **Hazırlık (10 sn) → Yazma (en fazla 30 sn) → Vuruşlar → Özet (4 sn)**, sonra yeni hazırlık gelir.

- **Hazırlık:** 1 skill + 1 eşya seçersin (veya hiçbirini). İki taraf da kilitler ya da süre dolunca raund başlar. Seçimler rakibe gizlidir.
- **Yazma:** süren kişiseldir: 30 sn. Rakip Zaman Hırsızı oynadıysa 25 sn; sen Donmuş An oynadıysan saatin ilk 3 sn akmaz (toplam 33 sn).
- **İlk bitiren:** kelimelerin hepsini gönderen raundu kapatır. İstisna: sende Zaman Hediyesi aktifse, rakip bitirdikten sonra **+5 sn** daha yazarsın.
- **Vuruşlar:** doğru kelimeler, gönderim sırasına göre **350 ms arayla** tek tek vurulur (bkz. bölüm 6).

## 3. Hasar ve çarpanlar

Taban hasar (doğru kelime başına, raunda göre): **R1: 100 · R2: 90 · R3–R5: 80 · R6: 75**.

```
hasar = yuvarla(taban × kombo çarpanı × (1 − yanlış cezası))
```

**Yanlış çarpanı (toplamsal):** doğru bir kelimeden sonra gelen her ardışık yanlış, *sonraki doğru kelimenin* hasarını düşürür:

| Ardışık yanlış | 1 | 2 | 3 | 4 ve üzeri |
|---|---|---|---|---|
| Toplam düşüş | −%10 | −%25 | −%48 | her yanlış −%30 daha, tavan **−%75** |

Örnek: `D Y Y Y D` → 1. kelime tam hasar vurur; 5. kelime ×(1 − 0,10 − 0,15 − 0,23) = **×0,52** vurur. Doğru kelime gelince sayaç sıfırlanır. HUD'da `−%48` biçiminde görünür.

**Kombo (ardışık doğru):**

| Seri | 1–3 | 4 | 5 ve üzeri |
|---|---|---|---|
| Çarpan | ×1,0 | ×1,5 — **KOMBO** | ×2,0 — **FİNAL** |

Yanlış kelime komboyu sıfırlar; ceza ve kombo aynı kelimede birlikte uygulanır. Kombo göstergesi 4 hücrelidir: 4. hücre dolarak KOMBO, 5+ doğruda etiket FİNAL'e döner.

## 4. Eşyalar (hasar öncesi)

Hazırlıkta seçilir, yalnızca **o raund** geçerlidir. Her eşyanın maç boyunca **2 kullanım hakkı** vardır (skill haklarından ayrı sayılır). Kartların köşesinde kalan hak görünür (örn. 2/2).

| Tuş | Eşya | Etki |
|---|---|---|
| 6 | 🔥 Kombo Yükselteci | KOMBO ×1,5 → **×1,75**, FİNAL ×2,0 → **×2,4** |
| 7 | 🛡️ Arınma Taşı | O raund yanlış cezası hiç uygulanmaz |
| 8 | 🥊 Ağır Eldiven | Taban hasar **+%10** (örn. R1'de 100 → 110) |
| 9 | ⚡ Çelik Kalkan | O raund aldığın hasar **−%20** |

## 5. Raund öncesi beceriler (skill)

Hazırlıkta seçilir ve **bir sonraki raunda** etki eder. Her skillin maç boyunca **2 kullanım hakkı** vardır. Rakibin seçimi sana, senin seçimin rakibe gizlidir; seçimler raund sonunda özet kartında açıklanır.

| Tuş | Skill | Etki | Kurbanın ekranında |
|---|---|---|---|
| 1 | 🔀 Harf Kaosu | Rakibin o raund kelimeleri karışık harflerle gösterilir; **karışık haliyle** yazmak zorundadır (karpuz → zurpak) | "🔀 HARF KAOSU · kelimeyi gördüğün gibi yaz" çipi |
| 2 | ⏰ Zaman Hediyesi | Rakip kelimeleri bitirse de sana **+5 sn** yazma süresi | — (sadece sende "⏰ +5 sn ek süre" çipi görünür) |
| 3 | 🕜 Zaman Hırsızı | Rakibin raund süresi **−5 sn** (25 sn olur) | "🕜 Zaman Hırsızı · süren 5 sn kısaldı" çipi |
| 4 | ❄️ Donmuş An | Saatin ilk **3 sn** akmaz (+3 sn eşdeğeri; toplam 33 sn) | — (sadece sende "❄ Saatin donmuş" çipi görünür) |
| 5 | 🌑 Karanlık Saat | Rakip o raund **hiçbir kalan süreyi göremez** (ne kendi ne senin) | "🌑 KARANLIK SAAT · bu raund süreleri göremezsin" çipi; saatler `🌑 —` olur |

İki taraf aynı anda skill oynayabilir; karşılıklı Zaman Hırsızı iki tarafın da süresini kısaltır.

## 6. Raund sonrası

- **Vuruş animasyonu:** yazma fazı bitince yazma paneli yumuşak bir animasyonla alta iner; doğru kelimelerin vuruşları 350 ms arayla uygulanır. KOMBO/FİNAL etiketleri, hasar sayıları uçar, HP çubukları düşer. **KO olursa kalan vuruşlar iptal edilir.**
- **Özet kartı (4 sn):** Doğru · Yanlış · En iyi seri · KOMBO/FİNAL sayısı · ceza kaybı · o raund kullanılan skill ve eşyalar (burada açıklanır) · verilen hasar · kalan HP. Raundun hasar galibi ve sıradaki raundun kelime sayısı yazılır.
- **Kazanma koşulları:**
  1. **NAKAVT:** bir raundun vuruşlarında rakibin HP'si 0 olursa maç anında biter.
  2. **6 raund sonunda:** yüksek HP kazananır (`KALAN HP ÜSTÜNLÜĞÜ`).
  3. **Eşitlikte:** daha çok doğru kelime yazan, o da eşitse daha çok toplam hasar veren kazanır; hâlâ eşitse **BERABERE**.
- Maç sonu kartında ayrıca raund raund hasar dökümü, toplam ceza kaybı ve **MVP** (en çok toplam hasar) gösterilir.

## 7. Zamana Karşı modu

- **5** (varsayılan), **7** veya **10** turluk maç; her turda **10 kelime** ve **30 sn**. İki taraf aynı kelimeleri alır. HP her turda **1200**'e yenilenir; tur içinde KO turu bitirir.
- **Seri → büyü:** doğru kelime serisi otomatik vuruş atar (bekleme süresi yok): 3. doğru → **Q**, 5. doğru → **E**, 7. doğru → **R**, 8–10. doğrular → Q.
- **Çarpan** 7 seriden devreye girer: seri 7 → ×1,5 · 8 → ×1,8 · 9 → ×2,16 · 10 → ×2,5 (tavan).
- Temel vuruşlar: fire Q 105 / E 175 / R 305; rune Q 95 / E 185 / R 305 (çarpanla ölçeklenir).
- **Son çağrı:** rakip 10 kelimeyi bitirirse süren en fazla **+5 sn** uzatılır.
- **Tur arası süre becerileri** (3 sn özet + 2 sn tanıtım sırasında seçilir; 1–3 tuşları, Enter kilitle, Esc geç): 🕜 Zaman Hırsızı (rakibe −5 sn) · 🌑 Karanlık Saat (rakip saati göremez) · ❄ Donmuş An (kendine +3 sn). Her biri maçta **2 kez** kullanılabilir.
- Tur galibi RP ile belirlenir: `RP = 100×doğru + 50×en iyi seri + ⌊hasar/10⌋`. Maçı tur çoğunluğu alır (5 turda 3 galibiyet); eşitlikte en çok **3 ani ölüm turu** oynanır, o da eşitse beraberlik.

## 8. Kontroller ve ipuçları

| Tuş | Ne yapar |
|---|---|
| Yazma + **Space** | Kelimeyi gönderir (boşluk = gönder) |
| **1–5** | Arena hazırlığında skill seç |
| **6–9** | Arena hazırlığında eşya seç |
| **1–3** | Zamana Karşı tur arası süre becerisi seç |
| **Enter** | Seçimi kilitler |
| **Esc** | Seçmeden geç · açık ayar menüsünü kapat · PvP'den çık (canlı maçta onay sorar) |

- **Ayarlar menüsü (⚙):** müzik aç/kapa + seviyesi, ses aç/kapa + seviyesi, efektleri azalt, 3B arenayı aç/kapat.
- İpuçları:
  - Hazırlık süresi dolarken seçili kartlar otomatik kilitlenir — seçimin kaybolmaz.
  - Yanlış cezası birikimlidir: 3 üst üste yanlıştan sonraki doğru kelime ancak %52 vurur. Arınma Taşı cezayı tamamen siler.
  - Seriyi korumak değerlidir: 4'lü KOMBO ×1,5, FİNAL ×2,0 çarpar.
  - İki gönderim arasında en az 55 ms geçmelidir (spam koruması).
  - Harf Kaosu kurbanıysan ekranda gördüğün **karışık** kelimeyi yaz; orijinalini yazarsan yanlış sayılır.
  - Zaman Hediyesi yalnızca rakip senden önce bitirirse işe yarar; bitireceğinden eminsen raund sonuna sakla.
