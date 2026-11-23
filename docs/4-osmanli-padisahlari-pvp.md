# 4 — Osmanlı padişahları PvP dövüşçüsü (ilk 10)

**İstek:** "10 tane Osmanlı padişah karakteri ekleyene kadar durma; sözleri, kendine özel becerileri olsun."
(Önceki yanlış yorum — Yazma'da padişah metinleri — geri alındı: `de9b436`.)

## Ne eklendi
Lobide, bot maçında ve çevrimiçi odada seçilebilen 10 yeni dövüşçü, saltanat sırasıyla:

| # | Dövüşçü | Saltanat | Taraf | Gövde | Q · W · E · R |
|---|---|---|---|---|---|
| 1 | Osman Gazi — Kurucu Bey | yak. 1299–1324 | Rün | Doran | Söğüt Kılıcı · Koyunhisar Hamlesi · Edebali Duası (kalkan) · Kuruluş Rüyası |
| 2 | Orhan Gazi — Bursa Fatihi | 1324–1362 | Ateş | Sira | Akıncı Mızrağı · Bursa Baskını · Gece Geçişi (kalkan) · Rumeli Yağmuru |
| 3 | I. Murad — Hüdavendigar | 1362–1389 | Rün | Doran | Edirne Kılıcı · Yeniçeri Hücumu · Ocak Kalkanı · Kosova Darbesi |
| 4 | Yıldırım Bayezid | 1389–1402 | Ateş | Vargr | Yıldırım Darbesi · Niğbolu Kasırgası · Ulu Cami Adağı (can) · Şimşek Fırtınası |
| 5 | Çelebi Mehmed — Birleştirici | 1413–1421 | Rün | Nyx | Birlik Oku · Fetret Sütunu · Yeşil Türbe Şifası (can) · Devlet Yıldızı |
| 6 | II. Murad — Varna Galibi | 1421–1444, 1446–1451 | Ateş | Sira | Varna Mızrağı · Kosova Atılışı · Manisa İnzivası (kalkan) · Haçlı Bozgunu |
| 7 | Fatih Sultan Mehmed | 1444–1446, 1451–1481 | Rün | Nyx | Şahi Güllesi · Rumeli Hisarı · Akşemseddin Duası (can) · Gemiler Karadan |
| 8 | II. Bayezid — Veli | 1481–1512 | Rün | Nyx | Külliye Işığı · Veli Sütunu · Darüşşifa (can) · Kemal Reis Donanması |
| 9 | Yavuz Sultan Selim | 1512–1520 | Ateş | Vargr | Çaldıran Baltası · Ridaniye Kasırgası · Sina Çölü Nefesi (can) · Mercidabık Fırtınası |
| 10 | Kanuni Sultan Süleyman | 1520–1566 | Rün | Doran | Belgrad Kılıcı · Mohaç Hücumu · Kanunname Kalkanı · Rodos Kuşatması |

Her padişahta: kendi adı, unvanı, rengi, silahı, kısa tarih notu, Q/W/E/R/S beceri adları ve açıklamaları, **sözleri** (maç başı, E, R, savunma, zafer).
Tarihe atfedilen iki söz işaretli: Fatih "Ya ben İstanbul'u alırım…" (atfedilen), Kanuni "Halk içinde muteber…" (Muhibbi beyti). Diğer sözler oyun içi repliklerdir.

## Nasıl yapıldı (şöyle yorumladım)
- **Model ve portre yok, uydurma görsel üretilmedi.** Her padişah temel kadrodan bir **gövdenin** (Vargr/Sira/Doran/Nyx) 3B modelini, kliplerini, efektini ve sesini kullanır (`body` alanı). Ekranda görünen ad, beceri, söz, renk ve madalyon padişahındır; maçtaki 3B beden gövdeninkidir (ör. Fatih = Nyx'in bedeni).
- **Portre yerine madalyon:** `assets/padisah/<id>.svg`, padişahın rengi, hilal-yıldız, sıra numarası (I…X), unvan ve saltanat yılları. Yüz çizilmedi. Üretici: `scripts/padisah-madalyon.mjs`.
- **"Kendine özel beceri"** = kendi adı/açıklaması/sözü. Hasar sayıları arketipten gelir (Ateş/Rün), denge değişmedi; E'nin can mı kalkan mı olduğu gövdeninkiyle aynı (görsel motif gövdeden geliyor). Sunucu kuralları (`pvp/shared/match.js`) değişmedi.
- **Sözler yazıyla:** padişahların sesli repliği yok; konuşma anında ekranın üstünde «…» şeridi çıkar (`pvp/quote-bubble.js`, stil `pvp/sound-fx.css`). Ses kapalıyken de görünür. Sesli replik için 404 isteği atılmaz (`voice:false`).
- **Lobi:** 15 madalyon tek sıraya sığsın diye geniş ekranda madalyon küçüldü (`--sc-med`), padişahlar araya boşlukla ayrıldı. Telefon düzeni değişmedi (yatay kaydırma). Bilgi kartında "N. padişah · yıllar" ve söz satırı var.
- **Bot:** karşı taraftaki tüm dövüşçülerden (padişahlar dahil) seçer; kişiliği gövdeninki.

## Dosyalar
Yeni: `pvp/shared/padisahlar.js`, `pvp/quote-bubble.js`, `assets/padisah/*.svg`, `scripts/padisah-madalyon.mjs`, `tests/pvp-padisah.test.mjs`.
Değişen: `pvp/shared/fighters.js` (temel kadro + padişahlar, `fighterBody`, `BASE_FIGHTER_IDS`, `PADISAH_IDS`, `fighterQuote`), `pvp/arena3d.js` (gövde eşlemesi, 1 satır), `pvp/sound.js`, `pvp/shared/bot-ai.js`, `pvp/portraits.js`, `pvp/network.js` (bilgi kartı), `pvp/lobby-v3.css`, `pvp/sound-fx.css`. Testlerde temel kadroyu denetleyenler `BASE_FIGHTER_IDS` kullanır; bot havuzu beklentileri yeni havuza göre güncellendi.

## Doğrulama
- `node --test tests/*.test.mjs`: **1068/1068**. Ön dağıtım kontrolü (`cf:build` + `predeploy-check`, deploy yok): 79/79.
- Tarayıcı (`127.0.0.1:5177`, 1440×900, ekran görüntüleriyle): lobide 15 madalyon, Fatih ve Yavuz bilgi kartı; Fatih vs bot II. Murad maçı: HUD adları/madalyonları, beceri adları, bot "Manisa İnzivası" kalkanı, raund sonu çözümü, tur arası süre becerisi seçimi, ayar paneli, Fatih'in R'si ve ekranda «Gemiler karadan yürüsün!» sözü, sonuç ekranı (madalyonlarla). Yavuz (Vargr gövdesi) vs bot II. Bayezid maç açılışı.
- Görülmeyen / denenmeyen: Osman, Orhan, I. Murad, Yıldırım, Çelebi Mehmed, Kanuni ile maç (aynı gövde yolu, testlerle denetli); zafer sözü (maçı kazanmadım); telefon genişliği; çevrimiçi oda (8787). "Teslim ol" düğmesi tıklamada tepki vermedi; padişah işiyle ilgisi yok, ayrıca bakılmalı.

## Sıradaki
- Padişahlara kendi Meshy modeli ve portresi: model gelince `body` kaldırılır, `fighters3d.js` MODEL_VARIANTS/CHOREOGRAPHY ve `arena3d-fx.js` SIG_CONFIG'e padişah girişi eklenir.
- Sesli sözler (`assets/sfx/replik/<id>-<anahtar>.mp3`) gelince `voice:false` kaldırılır.
- 11. II. Selim'den devam.
