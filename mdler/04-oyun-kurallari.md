# 04 — Oyun Kuralları

Son güncelleme: 13 Kasım 2026

## Kullanıcının kuralı
Kullanıcının notu (aynen): "ulti sadece 10 tane üst üste yazarsa atılıcak" (yeteneklerle ilgili tam not 03'te). Ayrıca `KESINYAP.md` kalıcı kuralları geçerlidir (metin her zaman değişir, dövüş sıralıdır, sesler karışmaz, ekranlarda maçtaki karakter görünür).

## Şu an oyunda olan
Oyuncu klavyeyle doğru yazar; doğru kelime saldırı üretir. Üç mod var.

| | Klasik | Raund | Arena |
|---|---|---|---|
| Can | 2000 | 4000 (raundlar arası taşınır) | 3000 |
| Süre | 120 sn maç, 10 sn pencereler | 7 raund | 6 raund, 40 sn |
| Yetenek | seriyle 5'li döngü | seriyle: 3→Q, 5→W, 7→E (kendine can), 10→R | eşya ve beceri seçimi |
| Çarpan | yok | seri 10'dan ×1,5 | seri çarpanı (kombo) |
| Rastgelelik | %30 kalkan, parry | yok | yok |

### Raund modu
- **Zamana karşı:** her raund 30 sn, kelime tükenmez.
- **Kelime raundu:** kelime sayıları 5-7-9-10-10-10-15; süre yok, ilk bitiren raundu bitirir (gizli 120 sn sınır).
- **Yetenekler (KESINYAP 21):** seri 3 → Q, 5 → W (yakın; motor anahtarı `e`), 7 → E (kendine can; anahtar `h`), 10 → R (ulti); 11 ve sonrası her doğru kelime → Q. E: eski E hasarının %80'i kadar can, azami canı ve raund başına 400'ü aşamaz, çarpan almaz, sahne kuyruğuna girmez (yazıldığı an yerinde kısa can pozu). Ayrıntı ve klipler: 03.
- **Çarpan:** seri 10 → ×1,5; 11 → ×1,8; 12 → ×2,16; 13 ve sonrası ×2,5 (üst sınır).
- **Sahne:** zemin yarığı/krater ve büyük sarı dalga efektleri kapalı. Rounds çözümünde "SALDIRI SIRASI", "RAUND SONU · Sen · Rakip" hapı, havada yüzen efekt adları ve "DESTEK" çubukları gösterilmez (KESINYAP 22).
- **Yanlış kelime:** seri yarıya iner (8→4, 7→3, 5→2, 3→1, 1→0). Eşik altına inince yetenek yeniden atılır. Yalnız raund modunda; klasik ve arena sıfırlar.
- **Hasar tavanı:** bir oyuncu tek raundda en çok 1300 verir. 3 x 1300 < 4000, nakavt en erken 4. raundda.
- **Kazanma:** can 0 = NAKAVT. 7. raundun sonunda canı fazla olan kazanır. Eşitse en çok 3 ani ölüm raundu (10 kelime); hâlâ eşitse berabere.
- **Süre becerileri** (Zaman Hırsızı, Donmuş An, Karanlık Saat) yalnız zamana karşıda çalışır.
- **Örnek hesap (Ateş, kusursuz 13 kelime):** 3. kelime Q 105; 5. W 175 (toplam 280); 7. E +140 can (hasar değil); 10. R ×1,5 = 458 (738); 11. Q ×1,8 = 189 (927); 12. Q ×2,16 = 227 (1154); 13. Q ×2,5 = 263 ama tavan yalnız 146'ya izin verir. Raund hasarı = 1300.

### Klasik
- Can 2000, süre biterse canı fazla olan kazanır. Savunma rastgele: savunanın aynı anda doğru kelimesi varsa %30 kalkan, kusursuz blokta %45 parry (65 karşı vuruş).
- Örnek: Ateş, 5 kelimelik tam döngü = 105 + 175 + 305 = 585.

### Arena
- Kelime sayıları 5-10-15-15-15-20. Doğru kelime başına taban hasar raunda göre 100, 90, 80, 80, 80, 75.
- Seri: 4. ardışık KOMBO x1,5, 5+ FİNAL x2. Ardışık yanlış cezası: %10, %25, %48, %78 (en çok %75).
- Hazırlıkta 15 sn beceri/eşya seçilir; her biri maçta en çok 2 kez.
- Örnek: 1. raund, 5 ardışık doğru = 100+100+100+150+200 = 650.

### Yanlış yazı
Yanlış kelime saldırı üretmez; seri cezası yukarıdaki gibi (modlara göre).

### Bot zorluğu (yerel maç)
Kolay 25 WPM, Orta 45, Zor 70.

## Planlanan / sırada (henüz kodda yok)
- Raund modunda yeni yetenek eşikleri: 3 Q, 5 W, 7 E (kendine can), 10 R (bkz. 03).
- Zemin hasarı (çatlak, krater).

## Yeni bir şey eklerken uyulacaklar
- [ ] Yeni kural rounds'ta rastgelelik eklemez.
- [ ] Sunucu ve istemci aynı `match.js` dosyasını kullanır; sayıyı tek yerde değiştir.
- [ ] Hasar tavanı ve 4. raund nakavt sınırı bozulmaz.
- [ ] `docs/HASAR-KURALLARI.md` ve bu belge güncellenir; ilgili test yazılır.

## Kodda nerede
- `pvp/shared/match.js` (ROUND_*, STREAK_SKILLS, wrongStreak, streakMultiplier), `pvp/shared/arena.js`, `pvp/shared/arena-damage.js`, `pvp/shared/arena-skills.js`
- `pvp/practice.js` (bot zorluğu); testler `tests/pvp-raund-sistemi.test.mjs`, `tests/pvp-yanlis-yarim.test.mjs`
