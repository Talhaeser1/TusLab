# 18 — Ana ekran "Sahne" tasarımı (Fable 5.2'nin tasarım kararı, 24 Kas 2026)

**İstek (kullanıcı):** "Ana ekran vs. hepsini değiştir; eski düzen olsun; Fable 5.2'nin yaratıcılığına bırakalım."

**Şöyle yorumladım:** üç sütunlu "kokpit" kalkar. Eski düzenin iskeleti geri gelir (solda büyük başlık + düğmeler + sayılar, sağda bölüm kartları) ama kartlar düz 2×2 yerine canlı bir "bento" ızgarası olur. Kokpit için yazılan işlevler (harfle başlama, 5 edebiyat türü, metrik bileşenleri, görev satırları) kaybolmaz; yeni yerlerine taşınır.

## Düzen (1440×900, kaydırmasız)

```
┌───────────────────────────── üst menü (değişmez) ─────────────────────────────┐
│ SOL (≈40%)                         │ SAĞ (≈60%) — bento, 12 sütun × 3 satır    │
│ NEON ARENA · TÜRKÇE KLAVYE         │ ┌──────────────────────┬───────────────┐ │
│ Parmakların                        │ │ YAZMA ARENASI (7×2)  │ DERSLER (5×2) │ │
│ ışık hızında   (degrade başlık)    │ │ canlı satır + klavye │ halka + sıradaki│ │
│ On parmak öğren, atasözleriyle…    │ │ görseli              │ 3 ders adımı  │ │
│ [▶ Yazmaya başla] [🎓 Kaldığın ders]│ ├───────────┬──────────┴──┬────────────┤ │
│                                    │ │ EDEBİYAT  │ PvP DÜELLO  │ PERFORMANS │ │
│ «canlı satır»: günün atasözü kendi │ │ (4×1)     │ (4×1) afiş  │ (4×1) mini │ │
│ kendine yazılır, imleç yanıp söner │ │ günün sözü│             │ eğri + 0/3 │ │
│ "herhangi bir harfe bas"           │ │ + 5 tür   │             │ görev      │ │
│                                    │ └───────────┴─────────────┴────────────┘ │
│ 192 WPM · %99 · 0/141 ★ · 1 gün    │                                          │
└────────────────────────────────────┴──────────────────────────────────────────┘
```

## Parçalar
1. **Sol sahne (kahraman alanı).** Küçük üst yazı, iki satırlık degrade başlık ("Parmakların / ışık hızında"), tek cümle alt yazı, iki düğme: birincil "Yazmaya başla", ikincil "İlk derse başla / Kaldığın ders: N". Altında **canlı satır**: var olan içerikten günün atasözü, harf harf kendiliğinden yazılır (≈14 harf/sn, bitince 3 sn bekler, yenisine geçer); herhangi bir harf tuşu Yazma'yı o satırla açar (mevcut `typeToStart` + `matchStartKey` davranışı korunur). Azaltılmış harekette satır hazır yazılmış durur. En altta 4 sayı tek satırda, ince ayraçlarla (kutu değil): en iyi WPM · ort. doğruluk · ders yıldızı · gün serisi.
2. **Yazma Arenası kartı (büyük).** `assets/home/kart-yazma.svg` klavye görseli sağ altta, eğik; üstte "HEMEN YAZ", başlık, "Kesintisiz akış · son yazışın N WPM". Üzerine gelince klavyedeki tuşlar sırayla parlar (CSS, 1 tur). Tık → Yazma.
3. **Klavye Dersleri kartı (büyük, dar).** Solda ilerleme halkası (elle SVG, biten/toplam ders), yanında "47 ders · 8 ünite", altında sıradaki 3 ders adımı (1 açık + 2 kilitli, mevcut bileşen), en altta "Ders haritası →". Tık → ilgili ders / harita.
4. **Şiir & Atasözü kartı.** "Günün sözü": büyük tırnak içinde rastgele bir atasözü/özdeyiş (var olan içerik), altında 5 küçük tür çipi (Atasözü 234 · Deyim 91 · Şiir 26 · Tekerleme 45 · Özdeyiş 28) — her çip o türü doğrudan açar; kartın geri kalanı tür menüsünü açar.
5. **PvP Düello kartı.** Mevcut afiş (`assets/home/pvp-kart.webp`), "Yazarak dövüş · bot ya da arkadaş", "Lobiye git →". `?pvp=lobby`.
6. **Performans kartı.** Mini hız eğrisi (Metrik'in `renderMetrics` bileşeninin küçük hâli), yanında "Günlük görevler 0/3" ve üç ince ilerleme çizgisi; tık → Performans. Ayrıntılı metrikler (7 gün, zorlanılan tuşlar, rozetler) Performans görünümünde kalır.

## Görsel dil
- Koyu neon tema ve `--tl-*` değişkenleri aynen. Kartlar: cam yüzey, 22 px köşe, ince kenar, her kartın kendi vurgu rengi (Yazma camgöbeği, Dersler altın, Edebiyat mor, PvP turuncu, Performans yeşil); üst sol köşede yumuşak renk ışığı.
- Hareket: sayfa açılışında sol sahne soldan, kartlar 60 ms arayla aşağıdan belirir (toplam < 600 ms, bir kez). Kartın üzerine gelince 3 px yükselme + kenar parlaması. Sonsuz animasyon yalnız canlı satırın imlecinde.
- Arka plan: sol sahnenin arkasında çok soluk, büyük "ğ ü ş i ö ç" harfleri (dekor, `aria-hidden`), sağda ızgara deseni.

## Duyarlı
- ≤1180 px: sol sahne üstte tam genişlik, bento altında 2 sütun.
- ≤860 px (telefon): tek sütun; sıra: sahne (başlık, düğmeler, canlı satır, sayılar) → Yazma → Dersler → Edebiyat → PvP → Performans. Yatay kaydırma yok; dokunma alanları ≥44 px.
- 1280×720: kaydırmasız (canlı satır tek satıra iner, bento satırları kısalır).
- 1920×1080: içerik en çok 1560 px genişlikte ortalanır, ölçek büyür (başlık clamp).

## Korunacaklar
- Harf tuşuyla başlama, Esc zinciri, geçmiş (`#yazma`, `#egitim`, `#edebiyat`, `#performans`), görev satırlarının işi açması, ilk tuş eşleşmesi, ertelenmiş yüklemeler (`words.js`, `lessons.js`), tuş başına ≈1,3 ms.
- Yazma, Dersler, Şiir & Atasözü ve Performans görünümlerinin kendisi (Hoca'nın cilası) değişmez; yalnız ana ekran.
