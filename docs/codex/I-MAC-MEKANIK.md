# GÖREV I — Maç ekranı + kazanan hatası + mekanik (kullanıcı maddeleri 3 ve 5)

Önce docs/codex/00-ORTAK.md'yi oku. Commit/push YAPMA, dal değiştirme. index.html, devamindex.html, package.json yasak.
Bot maçı: http://127.0.0.1:5176/index.html?pvp=practice&mode=rounds|classic|arena&bot=easy&karakter=vargr&fighter1=vargr&fighter2=nyx
Dövüş animasyonu dosyalarına (pvp/visual-timeline.js, arena3d.js, fighters3d.js, anim-state.js, impact-feel.js, combo-counter.js, attack-callout.js) DOKUNMA.

## I1. KAZANAN YANLIŞ GÖSTERİLİYOR (hata — önce kök neden)
Kullanıcı: "botu öldürdüğüm halde 'bot kazandı' dedi." Üç modda (classic, rounds timed/counted, arena) kazanan belirleme ve GÖSTERME zincirini izle:
pvp/shared/match.js (closeRound, decideRound, KNOCKOUT), pvp/shared/arena.js (finish, recordRoundHistory: raund kazananı yalnız damageDealt'e bakıyor, KO'yu saymıyor),
pvp/arena-ui.js:200 (özet kazananı dealt'ten yeniden hesaplanıyor), pvp/rounds-ui.js, pvp/fight-hud.js matchEnd, pvp/phase15-results.js (myWon), pvp/practice.js (bot koltuğu / myId), pvp/index.js:690-750.
Sahte saatli birim testiyle yeniden üret: "oyuncu rakibin canını 0'a indirir → raund/maç kazananı oyuncu, ekranda ZAFER". Beklenen kural:
- Bir raundda rakibi nakavt eden o raundu alır (arena dahil). Maçta canı 0'a inen kaybeder.
- Raund bazlı maçta maçı daha çok raund alan kazanır; maç sonu ekranı raund skorunu (ör. 3–2) açıkça gösterir ki sonuç anlaşılır olsun.
- Koltuk/isim karışması yok: "SEN" her zaman yerel oyuncu; bot adı bot koltuğunda.
Kök nedeni raporda dosya:satır ile yaz, düzelt, regresyon testi ekle.

## I2. MAÇ EKRANI
- Yerel oyuncunun tarafında belirgin "SEN" etiketi (isim yanında rozet; her üç modda; ≥12 px).
- Her oyuncunun YAZDIĞI kelimeler kendi can barının ALTINDA görünür (son yazılan 3–5 doğru kelime küçük şerit + o an yazdığı metin; rakibinki de kendi barının altında). Mevcut ortadaki kelime akışı/"SALDIRI SIRASI" ile üst üste binmez.
- Süre ve raund NET: üst-ortada büyük sayaç (sn) ve "RAUND n/m"; 1366×768 ve 375×812'de okunur, başka öğeyle çakışmaz.

## I3. MEKANİK
- Zamana karşı (rounds, roundStyle=timed): süre bitene kadar kelime GELMEYE devam eder; oyuncu listeyi bitirip rakibi BEKLEMEZ (kelime havuzu süre boyunca yeter/çevrimsel uzar). Raund süre dolunca biter.
- Sayılı raund (counted): raund başına 10 kelime.
- Raund ilerledikçe zorlaşma KORUNUR (mevcut davranış; değiştirme, testle sabitle).
- Skill / süper (ulti) / can akışı için uçtan uca birim testi: skill seç → etkisi uygulanır → hasar → can düşer → KO/raund sonu → sonraki raund → maç sonu. Etkisi uygulanmayan skill bulursan (ör. "Donmuş An"/freeze) kök nedenini bul ve düzelt; raporda yaz.

## KURAL DEĞİŞİKLİĞİ SINIRI
pvp/shared/* içinde YALNIZ I1 ve I3'ün gerektirdiği değişiklik. Hasar katsayıları, can, süre sabitleri, ağ protokolü alan adları değişmez (yeni alan eklenebilir). Test silme/atlama yok; kural değişen testi gerekçesiyle güncelle.

## ÇIKTI
`npm test` tam geçmeli. En fazla 40 satır Türkçe rapor: kök neden(ler), değişen dosyalar, eklenen testler, riskler. DOM tutamaçları: [data-sen-badge], [data-typed-strip="1|2"], [data-round-clock], [data-round-label].
