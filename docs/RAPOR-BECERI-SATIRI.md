# Beceri satırı (raund modu) + E savunması + tur arası — rapor (23 Kas 2026)

Kapsam: maç içi alt köşe altıgen beceri satırı (oyuncu solda, rakip sağda), "Kan Nabzı / Şifa Rünü yok" şikâyeti,
tur arası soluk ekran / boş bant, ayarlar paneli. Denge (eşik, hasar, can, zincir) DEĞİŞMEDİ.

## 1) Bulunan hatalar (kök neden, dosya:satır)

1. **E (can) "yok" görünüyordu — motor çalışıyor, görünmüyordu.** Gerçek maçta ölçüldü (Vargr–Nyx, Zamana Karşı):
   - Can doluyken (1. raund ya da o ana dek hiç vurulmamışken) seri 7'de E atılır ama can *bekletilir*
     (`pvp/shared/match.js` `submitRoundWord`, "E savunma" bloğu: `amount=0`, `healBank=300`). Olay `HEAL_APPLIED amount:0`
     geliyordu; `pvp/fight-hud.js` `showHeal` `amount>0` değilse hiçbir şey çizmiyordu → yazı yok, bar oynamıyor.
   - Bekleyen can, raund sonu çözümünde her yenen darbeden HEMEN sonra uygulanıyor (`match.js` `resolveDueAttacks`,
     "Bekletilen can" bloğu). Darbe ve can aynı anlık görüntüde geldiği için can barı net olarak hiç değişmiyordu.
     Tarayıcı kanıtı (eski kod): Nyx'e 100 + 180 hasar → olaylar `HEAL_APPLIED banked amount:100/180 hpAfter:6000`,
     Nyx'in barı 6.000'de sabit kaldı; oyuncu için hem "vurmadım" hem "can gelmedi" görünümü.
   - O raund hiç darbe yenmezse bekleyen can raund başında sıfırlanır (`resetForRound`, `healBank:0`) — 1. maçta bot E'si böyle boşa gitti.
     Bu kural (can doluyken can işe yaramaz) değiştirilmedi; öneri §5.
   - Can eksikken E anında çalışıyor: tarayıcıda 4.082 → 4.382, "+300" görüldü. Yani (a) uygulanıyor, (b) bekletilende görünmüyordu,
     (c) hiç darbe yoksa düşüyor, (d) kartta karşılığı yoktu ("HAZIR" sonra gri "kullanıldı"), (e) kart HAZIR'da kalmıyordu ama yanlış söylüyordu.
   - Kalkan (Sira, Doran) çalışıyor: "KALKAN 330", ikinci 7'de sınırla 500, çözümde emdi (DAMAGE_APPLIED.absorbed).
2. **Kart durumları yanlış/yanıltıcı** — `pvp/skillbar.js` `skillCharge`/`skillMeter`/`skillStatusText` (eski 79–131) ve `pvp/hud-v2.js` `railModel` (eski 52–56):
   eşiğe gelinen kelimede "HAZIR" (beceri o anda kendiliğinden atılmış, oyuncunun yapacağı bir şey yok), sonra "kullanıldı" +
   `pvp/fight-hud.css` 275 `opacity:.45` (bu oturumdan önceki, commit edilmemiş değişiklik) → atılmış beceri devre dışı/bozuk görünüyordu.
3. **Hizalama**: `fight-hud.css` `.fhud2-skills{align-items:flex-end}` + ad `overflow-wrap:anywhere`: iki satıra kayan ad ("Şifa Rünü 4/7")
   o kartı yukarı itiyordu; rakip rayında not satırı gizli olduğu için iki yan farklı taban çizgisindeydi (ölçüm: 1031 / 1066 px).
4. **Yardım satırı yanlış**: "Seri dolunca yetenek kendiliğinden atılır" — rounds'ta yanlış kelime seriyi SIFIRLAMIYOR, yarıya indiriyor (`wrongStreak`).
5. **Ayarlar paneli HUD'un altında**: `pvp/pvp.css:7` `.pvp2-shell{isolation:isolate}` kabuğu ayrı yığın bağlamı yapıyor; çubuk (z 40) ve
   panel (z 260) kabuk içinde kaldığı için kök düzeydeki `.fhud2` (z 25) panelin ÜSTÜNE çiziliyordu (elementFromPoint ile doğrulandı:
   panel alanında `fhud2-series`, `fhud2-pip`). Panel zemini zaten opak (#17132f); "yarı saydam" görüntüsü HUD'un üstte olmasıydı.
   Dışarı tıklayınca kapanmıyordu (Esc kapanıyordu).
6. **Tur arası soluk ekran + boş/çakışan bant**: raund sonu sinematiği (`pvp/cinematic.css:5` `.cin-flash`, z 45, tüm ekran, `#fff`, opaklık .42)
   üst çubuk + HUD + sahne dahil her şeyi beyazlatıyor; bant başlığı 60 ms gecikmeyle kayarak geliyor → ilk karelerde "boş bant + beyaz sis".
   Aynı anda rounds-ui'nin büyük "RAUND n" başlığı (`.rui-banner`) bandın arkasında çiziliyordu (1920×1080'de ekran görüntüsünde görüldü:
   "SÜRE!" bandının arkasında yarım "RAUND 5"). Kullanıcının tam karesini (sürekli kalan sis) birebir yeniden üretemedim; en yakın görülen bu.
7. Bu oturumun öncesinden kalan `git diff`: `fight-hud.css` `.fhud2::before{top:40px}` taşıması haze ile ilgili değil (karartma koyu, 40 px altından başlıyor);
   `used` kartını .45'e söndüren satır ise madde 2'nin görünümünü yapan değişiklikti.

## 2) Yapılanlar

- `pvp/skillbar.js`: durumlar `charging` (n/N) · `cast` ("ATILDI ✓", halka dolu, yanık) · `pending` ("BEKLİYOR") · klasik S "Devrede".
  "HAZIR" ve "Kullanıldı" kalktı. E kartı: can → "+N can" (uygulanan, `roundHeal`), kalkan → "KALKAN N" / bitince "KIRILDI".
  Q zinciri `chain:true`. Yeni saf `skillRowNote()` (doğru yardım satırı). Kartta seri düşünce kısa sarsıntı, eşikte parlama.
- `pvp/hud-v2.js`: ray aynı `railModel` ile iki koltuk için; alt yazı `skillStatusText(…,{compact})`; "zincir" etiketi; eşiğe gelince pop + parlama;
  seri düşünce (yarıya/raund başı) sarsıntı; not satırı "Seri 7 · seri 3 / 5 / 7 / 10'da kendiliğinden atılır · yanlış kelime seriyi yarıya indirir",
  can bekliyorsa "Seri 8 · E bekliyor: ilk yediğin darbeden sonra +300 can". Yeni `combat()`: bekletilen can gelince bar önce darbe sonrası değere iner,
  420 ms sonra canla yükselir (yeşil `is-heal`); azaltılmış harekette 120 ms.
- `pvp/fight-hud.js`: can doluyken atılan E için "+300 CAN BEKLİYOR" yazısı; HEAL_APPLIED `hud2.combat()`'a iletilir.
- `pvp/shared/match.js`: yalnız `publicMatch` oyuncu görüntüsüne `healBank` eklendi (kural/sayı değişmedi).
- `pvp/fight-hud.css`: kart = 3 sabit satır (altıgen · ad en çok 2 satır · durum 1 satır), satırlar üstten hizalı; rakip not satırı yer tutar (görünmez);
  E kartı daha geniş; durum renkleri (doluyor beyaz, atıldı altın, E yeşil, bekliyor yeşil kesikli halka); 1400 px altı küçük boy;
  reduced-motion/`pvp4-reduced` → kart animasyonu yok. Eski `used` .45 söndürmesi kaldırıldı.
- `pvp/compact-height.css` (sona ekleme): panel açıkken `.pvp2-shell{isolation:auto}` → çubuk HUD'un üstüne çıkar; panel zemini opak + gölge.
- `pvp/index.js`: ayarlar paneli dışına tıklayınca kapanır (tek satır, Esc zaten vardı).
- `pvp/cinematic.css` (sona ekleme): raund bandının flaşı koyu-altın, opaklık .22 (beyaz .42 yerine); bant oynarken `.rui-banner` gizli.
- Testler: `tests/pvp-skillbar.test.mjs` (eski "HAZIR/Kullanıldı" beklentileri güncellendi, seri→kart tablosu, E durumları, yardım satırı, KIRILDI),
  `tests/pvp-hud-v2.test.mjs` (ray tablosu, zincir, klasik satır, kaynak denetimi), yeni `tests/pvp-beceri-satiri.test.mjs`
  (tohumlu Vargr–Nyx: iki koltuk 7'de E → BEKLİYOR → çözümde yenen hasar kadar can + olay sırası; Sira kalkanı emer; hiç darbe yoksa can düşer).
- `index.html`, `home/*`, `cloudflare/*` değişmedi. Denge simülasyonu çalıştırılmadı: kural değişmediği için gerekmedi.

## 3) Tarayıcıda görülen durumlar (gerçek bot maçı, 127.0.0.1:5177, Zamana Karşı)

| Seri / an | Oyuncu (sol) | Rakip (sağ) |
|---|---|---|
| 0 (raund başı) | Q 0/3 · W 0/5 · E 0/7 · R 0/10 | aynı |
| 2 | Q 2/3 · W 2/5 · E 2/7 · R 2/10 | — |
| 4 | Q ATILDI ✓ · W 4/5 · E 4/7 · R 4/10 | — |
| 5 | Q ATILDI ✓ · W ATILDI ✓ · E 5/7 · R 5/10 | aynı (bot) |
| 7, can dolu | … E BEKLİYOR (+"+300 CAN BEKLİYOR" yazısı), not "E bekliyor: ilk yediğin darbeden sonra +300 can" | Doran: E "KALKAN 330" |
| 8 / 9 | E BEKLİYOR · R 8/10 · 9/10 | Doran 2. kez 7: "KALKAN 500" (sınır) |
| 10 | R ATILDI ✓ | — |
| 11 / 12 | Q 1/3 [zincir] · 2/3 [zincir] · W/E/R yanık | — |
| yanlış kelime (12 → 6) | Q/W ATILDI ✓ · E 6/7 · R 6/10 (sarsıntı) | bot 9 → 4: W 4/5 · E 4/7 · R 4/10 |
| çözüm | bar 6.000 → 5.820 → 6.000 (+100 ×3), sonra gerçek hasar | kalkan erir: "KALKAN 10" → bitince "ATILDI ✓" görüldü; "KIRILDI" metni sonradan eklendi, yalnız testle doğrulandı |
| raund sonu | "SÜRE!" bandı koyu flaşla, arkasında "RAUND n" yok; tur arası panelinde ray gizli | Nyx E "BEKLİYOR" (hiç vurulmadı) |
| eski kod (karşılaştırma) | 7'de "HAZIR", 8'de gri "kullanıldı"; Nyx 6.000'de, "+100/+180" bar oynamadan | — |

Yerleşim ölçümü (en uzun metinler zorlanarak: ATILDI ✓ / BEKLİYOR / KALKAN 330 / zincir): 1920×1080, 1600×900, 1366×768'de
iki ray tek taban çizgisi (alt yazı altları 1031 / 851 / 719 px, tek değer), komşu yazılar arası en az 13 px, ekran dışı yok, ad kırpılması yok,
yazma paneliyle çakışma yok, en küçük yazı 12 px. Ayarlar paneli: panel alanında üstte başka öğe yok (0 nokta), dışarı tıklama ve Esc kapatıyor.
Not: tarayıcı bölmesi 800 px genişlikte gösterildiği için ekran görüntüleri küçültülmüştü; yazılar DOM'dan okundu, yerleşim ölçümle doğrulandı.

## 4) Testler ve gerçek sonuçlar

- `node --check`: skillbar.js, hud-v2.js, fight-hud.js, index.js, shared/match.js — hatasız.
- `node --test tests/*.test.mjs`: **1038 / 1038 geçti, 0 kaldı** (başlangıç 1029; +9 yeni test).
- `npm run cf:validate`: "Ön dağıtım kontrolü başarılı: 79/79 kontrol." (dağıtım yapılmadı).

## 5) Kural değişikliği önerisi (uygulanmadı)

- Can doluyken atılan E, o raund hiç darbe yenmezse tamamen boşa gidiyor (1. raundda ve rakip zayıfken sık). Öneri: bekleyen can bir sonraki
  raunda taşınsın (raund sınırı 500 içinde) ya da can doluyken E kalkana dönüşsün (o raundun hasarını emer). Her ikisi dengeyi değiştirir;
  `scripts/pvp-denge-sim.mjs` ile ölçülmeden yapılmamalı.

## 6) Kalan sorunlar

- Kullanıcının gördüğü "sürekli beyaz sis + boş bant" karesi birebir yeniden üretilemedi; flaş yumuşatıldı ve başlık çakışması giderildi,
  başka bir katman (ör. tarayıcı tam ekran modunda) varsa tekrar ekran görüntüsü gerekir. Gerçek tam ekranda (Fullscreen API) denenmedi.
- Azaltılmış hareket (prefers-reduced-motion / "Efektleri azalt") tarayıcıda açılarak denenmedi; CSS ve kod yolu testle/okumayla doğrulandı.
- Klasik modun satırı yalnız birim testle doğrulandı (gerçek klasik maç oynanmadı).
- Telefon genişliğinde (≤ 760 px) rakip rayı zaten gizli; orada ölçüm yapılmadı.
- Çözümde bekletilen can, darbe sahnesinden bağımsız olarak olay geldiği anda (art arda "+100" ×3) gösteriliyor; sahne temasına bağlanmadı.
