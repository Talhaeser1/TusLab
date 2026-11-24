# RAPOR — PvP kalan işler (23 Kasım 2026)

Şerit: PvP KALANLAR (`pvp/*`, `cloudflare/src/*`, testleri). `index.html` DEĞİŞMEDİ (`git diff --stat -- index.html` boş). `home/*` ve `_to_delete/` elle tutulmadı. Commit/push/deploy yok.
Yeni dosyalar: `tests/pvp-kalanlar.test.mjs` (11 test), `scripts/pvp-denge-sim.mjs` (denge simülatörü), bu rapor.

## 1. Görev başına değişiklik (dosya:satır)

1. **Raund modunda beceri satırı Q/W/E/R**
   - `pvp/skillbar.js:11-27` `ROW_KEYS` (klasik Q/E/S/R · rounds Q/W/E/R), `rowKeysFor`, `syncRowLayout` (görünmeyen kart `hidden`). `applySkillRow` / `applySkillPreview` / `applyFighterNames` artık moda göre anahtar listesiyle çalışır; rounds E kartının simgesi karaktere göre kalkan ya da can, karakter bilinmiyorsa ad "Kor Nefesi/Mühür Şifası" (savunma) olur.
   - `pvp/index.js:439` satıra beşinci (W) kart eklendi, ilk çizimde `hidden`. `pvp/skillbar.css:105-106` gizli kart yer kaplamaz.
   - Doluluk metni değişmedi: `n/N kelime → HAZIR → Kullanıldı` (`skillStatusText`). Tarayıcıda (Doran, raund maçı) satır: `Q Kılıç Darbesi 0/3 · W Kalkan Ezici 0/5 · E Sur Andı 0/7 · R Sur Çöküşü 0/10`, S gizli.
2. **Kalkan görseli**
   - `pvp/arena3d.js:69-73` `E_SHIELD_COLOR=0x5ee3f5`; `:2762` `raiseEShield` (mevcut kubbe ağı + malzemesi, yeni nesne yok), `:3230-3240` kalkan açıkken kubbe camgöbeği, sabit opaklık 0,38 (yalnız 250 ms belirme), `shatterBubble` kubbeyi kapatır; `:3892` `HEAL_APPLIED kind:'shield'` → `raiseEShield`; raund temizliğinde (`clear`) ve 45 sn güvence süresiyle söner. Azaltılmış harekette çağrılmaz.
   - `pvp/arena3d-fx.js:1426-1444` `shieldRaise`: zeminden yükselen camgöbeği altıgen halkalar + yüzey kıvılcımları (mevcut halka/parçacık havuzları, sayı `countScale()` ile perf kademesine bağlı); `:2850` HEAL_APPLIED dalı kalkan/can ayrımı (can → eski yeşil motif). Kırılma: mevcut `SHIELD_BROKEN` → `shieldShatter` (cam kıymıkları) + `shatterBubble`. `handle()` azaltılmış harekette `reducedFlash`'tan döner (kalkan için flaş yok = sessiz).
   - 2B yedek: `pvp/index.js:764-767` `choreographers[...].onDefense('BLOCK')` (aegis halkası; `choreography21.js` azaltılmış harekette çizmez).
3. **Denge** (ayrıntı §2)
   - `pvp/shared/bot-ai.js:12-14` plan çarpanları küçüldü (push ×1,09/×1,75 → ×1,01/×1,2; careful ×0,95/×0,45 → ×0,99/×0,8); `:71-81` süre becerisi seçimi: güç sırası herkes için aynı (Zaman Hırsızı > Donmuş An > Karanlık Saat), kişilik yalnız ±0,15 eğilim.
   - `pvp/shared/match.js:136-150` zincir: 13'te Q, sonra her 8. kelime (`CHAIN_LONG_AFTER=13`, `CHAIN_EVERY_LONG=8`, `chainProgress`); `:163` `ROUND_ASSIST_CAP=2` (raund modunda raund başına en çok 2 destek; `assistStep`); `:166-167` `SHIELD_AMOUNT=330`, `healAmount(kind)`.
   - Sunucu yeniden ihracı `cloudflare/src/match.js:29`; `pvp/skillbar.js:86-91` Q zinciri göstergesi `chainProgress`'ten (1/3 → HAZIR (13), 1/8 … HAZIR (21)).
   - Metinler: `pvp/rounds-ui.js:29` lobi kural ipucu "7 → E (kalkan 330 ya da can 300) · … sonra 13. ve her 8. doğru kelime Q"; `docs/HASAR-KURALLARI.md` §2 güncellendi.
   - Yan düzeltme: `pvp/rounds-ui.js:83` arayüz çarpanı ×2,5'e kadar gösteriyordu (motor ×2'de kesiyor) → `MULTIPLIER_CAP` (×1,5 · ×1,8 · ×2).
4. **Ulti kuralı görünür** — `pvp/howto.js:6-10` `ULTI_RULE_TEXT="Ulti çarpanı en çok ×2"` (motor sabitinden); "Hasar ve kombo" sekmesine "Raund modu serisi" ve "Ulti (R)" satırları (`:32-33`), karakter satırlarında "R … (3 evre; ulti çarpanı en çok ×2)" ve E türü (kalkan/can; önceden herkese "can" yazıyordu). `pvp/skillbar.js:57` R kartının açıklaması (aria-label) "… Ulti çarpanı en çok ×2". Eski "Zamana Karşı: 40 sn turlar, 5/7/10 tur" metni gerçek kurala çevrildi (`:25`: 7 raund, 30 sn, 6000 can). R'nin 3 evresi değişmedi.
5. **Telefon arena seçici** — `pvp/compact-height.css:406-440`: telefon/dikey tablet düzeninde ok + ad satırı gizli, masaüstüyle aynı resimli kartlar 2×2 + tam genişlik ince "Rastgele"; ≤700 px yükseklikte (360×640) tek sıra: 4 sahne + dar "?" kartı, ad iki satır. Radiogroup + ok tuşları korunur.
6. **fhud2 karartması** — `pvp/fight-hud.css:332-333` `#pvp-root[data-layout="fullscreen"] .fhud2::before{top:var(--fs-toolbar,40px)}`; `pvp/compact-height.css:316`'daki ezme kaldırıldı (yerine yorum). Aynı seçici özgüllüğü; tarayıcıda hesaplanan değer `top:40px, height:190px` (önceki görünümle aynı).
7. **Sonuç ekranı** — `pvp/phase15-results.js:11` `leaveLabel`, `:88-90` bot maçında "Lobiye dön" (aria "Bot maçını bitir, PvP lobisine dön"), odada "Odadan çık". Davranış aynı yol (`index.js` `network.disconnect(true)`); tarayıcıda tıklandı → PvP lobisi açık, adres `?pvp=lobby`, sonuç paneli gizli.
8. **İçerik modları** (ayrıntı §3)
   - "Rastgele" artık gerçek karışım: `pvp/shared/content-modes.js:15-38` `RANDOM_CONTENT='rastgele'`, `contentMixPlan(seed, n)` (tohumlu; her 4 raundluk blokta kelime/atasözü/şiir/Osmanlıca birer kez, art arda aynısı yok). `pvp/shared/match.js:207-211` `roundContentOf`/`isContentRound`; `startRound` her içeriğin kaldığı yeri ayrı tutar (`contentPos`); `publicMatch.round.content` ve `ROUND_START.roundContent` iki oyuncuya aynı içerik. Arayüz: `pvp/arena-ui.js:255` lobi düğmesi "Rastgele · her raund başka içerik", `pvp/typing-top-model.js:22` "RASTGELE · ŞİİR · RAUND 2/7", `pvp/rounds-ui.js:16,211,669` başlık/raund flaşı " · ŞİİR". Sunucu doğrulaması değişmedi: `room.js` `isContentId` yalnız bilinen kimlikleri kabul eder ('rastgele' listeye girdi, 'karisik' gibi bilinmeyenler `INVALID_MATCH_CONFIG`).
   - Lobi mod ipucu `pvp/arena-ui.js:247` "tur · 40 sn" → "7 raund · 30 sn".
   - İçerik düzeltmeleri §3.
9. **Ölçümler** (ayrıntı §4) — 1920×1080 maç içi araç çubuğu: taşma yok, 12 px altı yazı yok, kontrast sorunu yok. Arena hazırlık evresi 1366×768'de eşya satırı panelin altında kalıyordu (içerik 374 px / panel 254 px, 15 sn'lik seçimde kaydırma) → `pvp/compact-height.css:441-453` ≤900 px yükseklikte beceriler tek sırada 5, eşyalar tek sırada 4 kart, açıklama satırı gizli (tam metin aria-label/title'da).

## 2. Denge tabloları (önce / sonra)

Yöntem: `node scripts/pvp-denge-sim.mjs 300 <zorluk>` — gerçek motor (`pvp/shared/match.js`), practice.js bot yazma modeli (`botWordDelay`, `makeTypo`, `BOT_DIFFICULTIES`), İKİ tarafta bot zekâsı, destek açık, zamana karşı, tohumlu, **eşleşme başına 300 maç**, koltuk her maçta değişir (A önce 1., sonra 2. koltuk). Aynı arketipli eşleşmelerde karakter motor durumuna maçtan sonra yazılır (raund hasarı iki arketipte eşit; karakter farkı E türü + bot kişiliği). "Önce" tablosu değişiklik öncesi kodun birebir kopyasıyla (aynı simülatör) üretildi; baz çizgiyi doğruladım (vargr–doran önce 58,3/41,7, 6,26 raund — iki ayrı koşuda aynı).

**Orta – orta** (A kazanma %, B kazanma %, ort. raund)

| Eşleşme | Önce | Sonra |
|---|---|---|
| vargr – sira | 65,0 / 35,0 · 6,40 | 45,0 / 55,0 · 6,87 |
| vargr – doran | 58,3 / 41,7 · 6,26 | 48,3 / 51,7 · 6,80 |
| vargr – nyx | 65,0 / 35,0 · 6,22 | 50,7 / 49,3 · 6,75 |
| vargr – konyalı | 64,0 / 36,0 · 6,21 | 45,7 / 54,3 · 6,77 |
| sira – doran | 47,3 / 52,7 · 6,33 | 49,0 / 51,0 · 6,92 |
| sira – nyx | 60,0 / 40,0 · 6,27 | 49,0 / 51,0 · 6,82 |
| sira – konyalı | 46,0 / 54,0 · 6,17 | 46,3 / 53,7 · 6,84 |
| doran – nyx | 58,7 / 41,3 · 6,08 | 52,7 / 47,3 · 6,85 |
| doran – konyalı | 50,7 / 49,3 · 6,08 | 50,0 / 50,0 · 6,86 |
| nyx – konyalı | 46,0 / 54,0 · 6,01 | 48,0 / 52,0 · 6,78 |

Sonra: 10/10 eşleşme %45–55 aralığında (vargr–sira tam sınırda 45,0). Nakavt oranı önce %95–100, sonra %70–86 (kalanı 7. raund sonunda can üstünlüğü).

**Zor – zor**

| Eşleşme | Önce | Sonra |
|---|---|---|
| vargr – sira | 67,0 / 33,0 · 3,31 | 44,0 / 56,0 · 4,71 |
| vargr – doran | 77,0 / 23,0 · 3,11 | 50,3 / 49,7 · 4,75 |
| vargr – nyx | 88,3 / 11,7 · 3,09 | 53,7 / 46,3 · 4,69 |
| vargr – konyalı | 68,7 / 31,3 · 3,07 | 53,7 / 46,3 · 4,65 |
| sira – doran | 54,0 / 46,0 · 3,11 | 54,3 / 45,7 · 4,74 |
| sira – nyx | 70,7 / 29,3 · 3,10 | 59,7 / 40,3 · 4,66 |
| sira – konyalı | 53,3 / 46,7 · 3,04 | 55,7 / 44,3 · 4,72 |
| doran – nyx | 68,7 / 31,3 · 3,03 | 56,7 / 43,3 · 4,77 |
| doran – konyalı | 52,7 / 47,3 · 3,02 | 55,7 / 44,3 · 4,73 |
| nyx – konyalı | 26,0 / 74,0 · 3,02 | 54,3 / 45,7 · 4,70 |

Zor–zor ortalama 3,0–3,3 → **4,65–4,77 raund** (hedef ≥ 4,5 sağlandı). Zor'da 5 eşleşme %45–55 dışında (en kötü sira–nyx 59,7; kalkanlılar hızlıda hafif önde). Kolay–kolay (100 maç, 2 eşleşme): 7 raund, nakavt yok (önceki gibi).

Bulgular (deneylerle ayrıştırıldı, 80–300 maçlık koşular):
- "Doran zayıf" mekanik değil, **bot zekâsı** kaynaklıydı: süre becerisi ve plan kapatılınca (herkes "steady", süre becerisi yok) zor–zor eşleşmeleri %47–56. Asıl sapma: saldırgan kişilikler Zaman Hırsızı (−5 sn rakip) seçiyor, Nyx/Doran çoğunlukla Karanlık Saat seçiyordu (bota karşı etkisiz) ve "push" planı (+%9 hız) hızlı yazarda baskındı.
- Zor–zor kısalığının kaynağı raund başına zincir Q (zor'da ~663 hasar/raund) + destek (~500/raund, 2–3 kez). Seri her raund sıfırlandığı için zinciri 13'ten sonra seyreltmek yalnız hızlıyı etkiler.
- **Denenip bırakılan:** yumuşak raund tavanı (1100 üstü ×0,5) iki tarafın raund hasarını eşitledi ve sonucu küçük farklara bağladı (vargr–doran 95/5) — eski 1300 tavanının sorunu; geri alındı. Raund başına 1 destek ve CHAIN_EVERY=5 orta–orta maçları 7 raunda itti (%40–60 nakavt); kullanılmadı. Kalkan 360/400 aşırı güçlü (59–69 %).

## 3. İçerik düzeltmeleri ve emin olunmayanlar

Tarama (betikle): atasözü 214→213, yinelenen yok; şiir 114 dize, Osmanlıca 363 kelime yinelenen yok, hepsi en az 5 harf ve yalnız a–z + çğıöşü (â/î/û yok); atasözü/şiir metinlerinde harf + boşluk + `.,;?!'` dışında karakter yok (kesme işareti düz `'`). Kelime bankası 863 kelime, yinelenen/yabancı karakter yok.

Düzeltilenler:
- Atasözü: "Deveye hendek atlatmak zordur." silindi — bağımsız atasözü değil, listedeki "Cahile söz anlatmak deveye hendek atlatmaktan zordur."un parçası (yineleme).
- Şiir (Nedim, İstanbul Kasidesi): "Bu şehri Sıtanbul" → "Bu şehri **Sitanbul**" (aslı şehr-i Sitanbul).
- Osmanlıca ipucu: "tasavvur: tasarım" → "tasavvur: zihinde canlandırma".
- Dosya notu: tüm şairler 1900'den önce ölmüş (Ziya Paşa 1880; diğerleri 13.–18. yy ya da halk/âşık geleneği) → kamu malı.

Emin olmadıklarım (DEĞİŞTİRİLMEDİ, kontrol önerilir):
- Atasözü "Yuvarlanan taş yosun tutmaz." — İngilizce "A rolling stone gathers no moss"un çevirisi olabilir; geleneksel Türk atasözü olduğundan emin değilim.
- Atasözü "Ölme eşeğim ölme, yaza yonca bitecek." — yaygın biçim "… yaz gelir yonca biter"; iki biçim de dolaşımda.
- Şiir: "Yaratılanı severiz / Yaratandan ötürü" Yunus Emre'ye yaygın olarak atfedilir ama divan nüshalarındaki biçimi tartışmalı.
- Şiir (Karacaoğlan'a atfedilenler): "Ala gözlüm ben bu ilden gidersem … melil melil", "Vara vara vardım ol kara taşa … Bir ayrılık bir yoksulluk bir ölüm", "Nedendir de kömür gözlüm nedendir", "Üryan geldim gene üryan giderim" — dizelerin harfiyen doğruluğu ve atfı (halk derlemeleri farklı) kaynaktan doğrulanmadı.
- Şiir (Pir Sultan Abdal): "Gelmiş iken bir habercik sorayım … Yıldız Dağı dumanın" ve "Garip bülbül gibi zareler beni" biçimleri doğrulanmadı.
- Osmanlıca listesindeki kelimeler TDK sözlüğünde bulunan Osmanlıca kökenli kelimeler (bilgime göre); "ehemmiyetsiz", "lüzumsuz", "tahammülsüz" Türkçe ekli melez biçimlerdir (kullanımda var). "müstehcen" (açık saçık) okul yaşı için uygun mu, karar kullanıcının.

Rastgele: her raund tohumlu içerik (yukarıda §1-8); iki oyuncu ve bot motoru aynı tohumdan aynı sırayı üretir (test: `contentMixPlan` deterministik, iki koltuğun `publicMatch.round` içeriği/kelimeleri aynı).

## 4. Doğrulama

- `node --check` (18 dosya: skillbar, index, arena3d, arena3d-fx, howto, rounds-ui, typing-top-model, arena-ui, phase15-results, shared/match, shared/bot-ai, shared/content-modes/-atasozu/-siir/-osmanlica, cloudflare/src/match, scripts/pvp-denge-sim.mjs, tests/pvp-kalanlar.test.mjs): hepsi geçti.
- `node --test tests/*.test.mjs` → **`# tests 1029 · # pass 1029 · # fail 0`** (başlangıç 1011/0; arada başka şeritler de test ekledi). Yeni: `tests/pvp-kalanlar.test.mjs` 11 test. Güncellenen eski kural testleri: `pvp-rounds-ui` (çarpan ×2), `pvp-dort-yetenek` ve `pvp-raund-sistemi` (zincir 13/21/29; kusursuz oyuncu nakavtı 3. raundda; kural ipucu metni), `pvp-mekanik-savunma-bot` (kalkan 330), `pvp-skillbar` (Q zinciri 1/8 … HAZIR), `pvp-practice` (sunucu ihracat listesi), `pvp-akis-arayuz` (fhud2 kuralı fight-hud.css'te), `pvp-lobi-j2` (mod şeridinde Rastgele). Destek tavanı testi tavan 99 yapılınca düştüğü görüldü (4 destek) — boş test değil.
- `npm run cf:validate` → `Cloudflare static assets prepared at: …/cloudflare/public` · **`Ön dağıtım kontrolü başarılı: 79/79 kontrol.`** Deploy çalıştırılmadı.
- Tarayıcı (kullanıcının sunucusu http://127.0.0.1:5176/, kendi sekmem): eski önbellekli `content-modes.js` yüzünden ilk açılışta modül hatası verdi (`does not provide an export named 'RANDOM_CONTENT'`); dosyalar `fetch(…,{cache:'reload'})` ile yenilenince düzeldi — kullanıcı eski sekmede Ctrl+F5 yapmalı.
  - 1920×1080, Doran + Rastgele + raund maçı (otomatik yazıcıyla): beceri satırı Q/W/E/R (S gizli); üst etiket "RASTGELE · ATASÖZÜ · RAUND 1/7", sonra "RASTGELE · ŞİİR · RAUND 2/7"; HEAL_APPLIED kind:shield geldiğinde Doran'ın çevresinde camgöbeği kubbe + zeminde halka (ekran görüntüsünde görüldü), HUD "KALKAN 330"; çözümde SHIELD_BROKEN e-shield → beyaz/camgöbeği kırılma patlaması görüldü.
  - 1920 maç içi araç çubuğu ölçümü: görünür düğmeler 12–20 px yazı, 32 px yükseklik, taşma/ekran dışı yok, kontrast eşiği altı yok (yalnız ekran okuyucuya gizli `pvp2-network`/`pvp24-chip` 1–8 px kutular "taşma" sayıldı: görsel değil). `.fhud2::before` hesaplanan `top:40px`.
  - Teslim ol → sonuç ekranı: "Lobiye dön" düğmesi; tıklanınca PvP lobisi (Savaşa başla görünür).
  - Arena hazırlığı: 1920×1080'de panel 866 px, yazma paneli 1040 px, 12 px altı yazı/taşma yok ("Seçimi kilitle" düşük kontrast uyarısı yanlış alarm: altın degrade üstünde koyu yazı, en kötü durak ~6,5:1). 1366×768'de eşya satırı kesikti → düzeltme sonrası kaydırma yok (204/204 px, 9 kart görünür, gözle bakıldı). 1366×650: 204/201 (3 px) → satır aralığı 4 px yapıldı (bu son küçük ayar tarayıcıda yeniden ölçülemedi; maç bitmişti).
  - Telefon lobisi: 390×844 ve 430×932 2×2 kart + Rastgele, ad 12 px tek satır, kesik yok; 360×640 tek sıra 4+?, adlar iki satır (Gök Demirhanesi sığıyor), portre üst çubuğun altına girmiyor; Fırtına Limanı'na tıklama seçimi değiştirdi (✓). Lobi 12 px altı yazı yok.
  - Görünüm sonunda "desktop" ön ayarına döndürüldü.

## 5. Kalan sorunlar

- Zor–zor'da 5 eşleşme %45–55 dışında (sira–nyx 59,7/40,3; kalkanlılar hızlıda biraz önde). Orta ve zor için aynı anda tutan tek kalkan değeri bulamadım (300: orta'da kalkanlı %40–46; 330: zor'da kalkanlı %54–60).
- Orta–orta maçlar artık ort. 6,8 raund, %70–86 nakavt (önce 6,2, ~%97). Daha kısa isteniyorsa raund canı ya da W hasarı ayarlanmalı.
- Sonuç kartında kalkanlı karakter için "Toplam iyileşme: +0" yazıyor (emilen kalkan sayılmıyor) — sonuç verisine emilen hasar eklenmeli.
- Kalkan kubbesi/kırılma yalnız 3B'de gözle görüldü; 2B yedek (aegis halkası) tarayıcıda denenmedi. Kalkan kurma için ayrı ses yok.
- Rastgele karışım yalnız raund modunda; çevrimiçi odada (8787, Cloudflare) denenmedi — yerel sunucuda oda çalışmıyor.
- 1366×650 arena hazırlığındaki son 2 px'lik aralık ayarı tarayıcıda yeniden ölçülmedi.
- §3'teki emin olunmayan atasözü/şiir maddeleri kaynakla doğrulanmalı.
- Tarayıcı önbelleği: güncellemeden sonra açık sekmeler eski modülü tutabiliyor (Ctrl+F5).
