# 03 — Karakter Yetenekleri

Son güncelleme: 13 Kasım 2026

## Kullanıcının kuralı
Kullanıcının 12 Kasım 2026 gecesi yazdığı not (aynen; çelişkide bu geçerlidir):

> sen bi skil yazma ajanısın lol valo deadlock dota oyunları gibi bi skill yazma uzmanısın ama oyunumuzn atmosferine uygun olucak ve skiller 4 tane olucak
>
> q w e r 3 tane normal vuruş bir tane ulti
>
> q skili karşı takıma hasar veren bi skill olsun
>
> w skili yakın dövüş bi skill olsun
>
> e skili genel olarak kendine can veren bi yetenek olsun
>
> r ulti ise güçlü bi skill olsun mesela ney saldırısı gibi hacı dayı karakterinin alan hasarlı güçlü bi yetenek olsun
>
> karaketlerin hasarlarına göre harita da hasar oluşsun genellik le yerde olsun mesela ulti gibi gü.lü bi skill atınca yerde bi göçük gibi bir şey olsun
>
> oyun kuralları: ulti sadece 10 tane üst üste yazarsa atılıcak

## Şu an oyunda olan
Her karakterin dört yeteneği var: **Q, E, R** (saldırı) ve **S** (savunma). Rounds modunda yetenekler seriyle otomatik atılır (S yok); klasikte Q/E/S/R vardır; arenada yetenek rayı yoktur.

**Tür kuralı:** Ateş Q 105, E 175, R 305 · Rün Q 95, E 185, R 305. R üç vuruşa bölünür: Ateş 65+100+140, Rün 75+90+140.

| Karakter | Tuş | Ad | Tür | Ne yapar |
|---|---|---|---|---|
| Vargr | Q | Balta Savuruşu | yakın | tepeden balta, hızlı net vuruş |
| Vargr | E | Kasırga | yakın | dönerek çok vuruş |
| Vargr | R | Kan Fırtınası | yakın ulti | sıçrayıp kızıl girdap, 3 evre |
| Vargr | S | Demir Duruş | savunma | baltayı siper alır |
| Sira | Q | Mızrak Atışı | menzilli | mızrak mermisi rakibe uçar |
| Sira | E | Çifte Hançer | yakın | ileri atılıp iki hançer saplar |
| Sira | R | Gölge Yağmuru | menzilli ulti | yana kayıp üç gölge mızrağı |
| Sira | S | Gölge Adımı | savunma | geri kayıp karşılar |
| Doran | Q | Kılıç Darbesi | yakın | dengeli tepeden kılıç |
| Doran | E | Kalkan Ezici | yakın | kalkanla ezer, siperi sarsar |
| Doran | R | Sur Çöküşü | yakın ulti | sıçrayıp çakılır, yatay keser |
| Doran | S | Kale Kalkanı | savunma | kalkanı kaldırır |
| Nyx | Q | Rün Oku | menzilli | parlayan rün mermisi |
| Nyx | E | Rün Sütunu | menzilli | rakibin altından ışık sütunu |
| Nyx | R | Yıldız Çöküşü | menzilli ulti | gökten meteor, 3 evre |
| Nyx | S | Rün Perdesi | savunma | önüne rün perdesi |
| Hacı Usta | Q | Etli Ekmek Fırlatışı | menzilli | omuz üstünden sıcak etli ekmek |
| Hacı Usta | E | Sema Dönüşü | alan | sıçrayıp dönerek çevreye hasar |
| Hacı Usta | R | Ney Feryadı | ulti | ses dalgası, sinematik |
| Hacı Usta | S | Hacı Duruşu | savunma | yere basıp karşılar |

Savunma (S): eş kelimede %30 blok; tam zamanlamada savuşturma. Rounds'ta rastgele blok yok.

**Efekt anahtarları** (kodda): axe-chop, spin, blood-storm · projectile-spear, dual-stab, shadow-volley · sword-chop, shield-bash, wall-crash · projectile-rune, pillar, meteor · projectile-bread, spin, ney-shockwave; hepsinde S = guard.

**Ses:** her karakterin q/e/r sesi var (bkz. 10).

## Raund modu: dört yetenek Q/W/E/R (KESINYAP 21 — kodda, 13 Kasım 2026)
Yalnız raund modunda; klasik ve arena kuralları aynı kaldı. Kaynak: `pvp/shared/match.js` `STREAK_SKILLS`.

| Seri | Tuş | Motor anahtarı | Rol | Kural |
|---|---|---|---|---|
| 3 | Q | `q` | menzilli/ilk vuruş | tablodaki Q hasarı |
| 5 | W | `e` | yakın dövüş | klasikteki eski E vuruşu (aynı hasar/klip/ses) |
| 7 | E | `h` | kendine can | eski E hasarının %80'i; azami canı ve raund başına 400'ü aşamaz; çarpan yok |
| 10 | R | `r` | ulti | yalnız 10 üst üste doğruda; 3 evre |

11 ve sonrası her doğru kelime → Q. Yanlış kelimede seri yarıya iner (8→4, 5→2). Çarpan seri 10'dan başlar.

E adları: Vargr **Kan Nabzı**, Sira **Gölge Sisi**, Doran **Sur Andı**, Nyx **Şifa Rünü**, Hacı Usta **Şerbet Molası**.

**Sahnede (her yetenek karakterin kendi klibiyle):**

| Karakter | Q klibi | W klibi | E (can) klibi | R klibi |
|---|---|---|---|---|
| Vargr | Attack | Axe_Spin_Attack | Victory_Cheer (ilk 1,5 sn) | Charged_Axe_Chop |
| Sira | Thrust_Slash | Double_Blade_Spin | Victory_Cheer (ilk 1,5 sn) | Triple_Combo_Attack |
| Doran | Right_Hand_Sword_Slash | Shield_Push_Left | Victory_Fist_Pump | Sword_Judgment |
| Nyx | mage_soell_cast | Charged_Spell_Cast | victory (ilk 1,5 sn) | Charged_Ground_Slam |
| Hacı Usta | Over_Shoulder_Throw | 360_Power_Spin_Jump | Victory_Cheer (ilk 1,5 sn) | Ney_Ulti |

- E (can) yazıldığı an, karakter boştaysa yerinde oynar (`fighters3d.js` `HEAL_SCENE`, tablo `clips.heal`) + karakterin çevresinde kendi can efekti (`arena3d-fx.js` onHeal); sahne kuyruğuna girmez, vuruş sırası ve çözüm süresi değişmez. GLB'lerde kullanılmayan uygun klip olmadığı için zafer klibinin kısa hali kullanıldı (yeni animasyon üretilmedi).
- W katlanmaz: motor 20 sn bütçesi için W'yi Q sahnesine katlasa da W ya zincire eklenir ya da (menzilli Q + yakın W, ör. Hacı Usta) kendi yaklaşmasında oynar; görsel birikim tavanı aşılırsa katlanır.
- Zemin yarığı/krater (`GROUND_DAMAGE_ON=false`) ve büyük sarı dalga/halka (`BIG_WAVES_ON=false`) KAPALI — kullanıcı istemedi.
- Karaktere özel Q/W/R efektleri KESINYAP 15'te yapıldı (Hacı Usta: dönen etli ekmek + un bulutu, sema girdabı, ney ses dalgaları).

## Yeni bir şey eklerken uyulacaklar
- [ ] Her karakter Q, W (yakın), E (kendine can), R (ulti) alır; `MODEL_VARIANTS` tablosunda q/e/r klibi ve `clips.heal` tanımlı olmalı (Q, W, R klipleri birbirinden farklı).
- [ ] Hasar tabloda tanımlı sayıdan sapmaz; denge `docs/HASAR-KURALLARI.md`'ye göre.
- [ ] Ulti üç evreli; hasarlar toplamı 305.
- [ ] Her yetenek için klip, efekt anahtarı ve ses tarifi yaz.
- [ ] Bu tabloyu ve 02, 09, 10'u güncelle.

## Kodda nerede
- `pvp/shared/fighters.js` (skills), `pvp/shared/match.js` (DAMAGE, ULTIMATE_PHASES, STREAK_SKILLS, COOLDOWNS)
- `pvp/fighters3d.js`, `pvp/combat-fx.js`, `pvp/arena3d-fx.js` (efektler); `pvp/skillbar.js`
