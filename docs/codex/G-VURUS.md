# Şerit G — Animasyon durum makinesi ve vuruş hissi

Önce `docs/codex/00-ORTAK.md` kurallarını oku ve uy. Referans his: tok vuruşlu, akıcı 2D/2.5D dövüş oyunu (yalnız his/tempo; hiçbir ticari oyunun karakter/görsel/ses/adını kopyalama).

## Sahip olduğun dosyalar
pvp/fighters3d.js, pvp/arena3d.js, pvp/arena3d-fx.js, pvp/impact-feel.js, pvp/fight-motion.js, pvp/fx-particles.js, pvp/fx-damage.js, pvp/combat-fx.js (+ ilgili .css), tests/pvp-anim-state-g.test.mjs (yeni), mevcut ilgili testler (yalnız gerekirse güncelle, gerekçeyle).

## YASAK
index.html, pvp/shared/** (oyun kuralları), cloudflare/**, pvp/network.js, pvp/rounds-ui.*, assets/** (ikili dosya üretme), oyunun girdi kodu.

## Yapılacaklar
1. **Animasyon durum makinesi** (fighters3d.js içinde ya da yeni küçük modül `pvp/anim-state.js` — sahip listesine eklenir): durumlar idle, attack(Q/E/R), hit, block, knockdown, victory, defeat.
   - Öncelik: knockdown/defeat > hit > block > attack > idle. Yüksek öncelik düşüğü keser; hit saldırıyı keser; knockdown her şeyi keser; victory/defeat sonrası başka klip oynamaz.
   - Saldırı sürerken yeni saldırı: ilk saldırının temas karesi geçtiyse kısa kesin geçiş (≤0.08 s crossfade), geçmediyse kuyruğa al (en fazla 1 kuyruk).
   - Crossfade süreleri tablo olarak: idle↔attack 0.10 s, attack→idle 0.18 s, any→hit 0.05 s, any→knockdown 0.04 s, →victory 0.25 s. Tek seferlik klipler LoopOnce + clampWhenFinished; bitince idle'a dön.
   - Aynı anda iki klip ağırlığı karışıp "yarım poz" oluşmasın (eski action'ları fade sonrası stop et).
   - Hem Meshy Vargr (klip adları: Combat_Stance, Attack, Axe_Spin_Attack, Charged_Axe_Chop, Hit_Reaction, Knock_Down, Victory_Cheer, Two_Handed_Parry) hem eski KayKit modelleriyle çalışsın (mevcut varyant/klip eşleme tablosunu kullan).
2. **Vuruş hissi (impact-feel.js geliştir)**: temas karesinde (klip peakMs/temas zamanı) tetiklenen: hitstop (hafif 50 ms, ağır/ulti 90–120 ms; her iki dövüşçünün mixer'ı durur), kamera sarsıntısı (şiddete göre, sönümlü), kısa kamera punch-in, knockback (savunan geri kayar ve geri döner), hit flash (savunan 1–2 kare beyaz/emissive), kıvılcım parçacığı temas noktasında. `prefers-reduced-motion` / `.pvp4-reduced` altında sarsıntı ve punch kapalı, flash yumuşak.
3. **Saldıran rakibe atılsın**: saldırı başında saldıran rakibe doğru hızlı dash (temas mesafesine), temas, sonra yerine geri dönüş. Silah gerçekten rakibe değsin (temas mesafesi model ölçeğine göre). Kamera 2.5D yan görünüm; iki dövüşçü kadrajda kalsın.
4. **Karaktere özel skill efektleri**: Vargr (balta/ateş-buz kuzey: kıvılcım + kar/kor), Sira (mızrak/hançer keskin, mor iz), Doran (kalkan/ışık sütunu, altın), Nyx (rün/meteor, camgöbeği-mor). Mevcut `assets/higgsfield/` efekt görsellerini (yalnız WebP/PNG mevcutsa) doku olarak + kodla parçacık. Yeni görsel üretme.
5. **Testler**: tests/pvp-anim-state-g.test.mjs — durum geçiş öncelikleri, kuyruk, hit'in saldırıyı kesmesi, knockdown'ın her şeyi kesmesi, victory sonrası kilit, crossfade tablosu, hitstop süreleri, reduced-motion. `node --test tests/*.test.mjs` tamamı ve `npm run cf:validate` geçmeli.

## Performans
Kare başına yeni nesne/obje tahsisi yapma (havuz kullan); mevcut perf-governor bütçesine uy; parçacık sayısı düşük cihazda azalsın.

## Rapor
00-ORTAK.md rapor başlıklarıyla, Türkçe, ≤500 kelime.
