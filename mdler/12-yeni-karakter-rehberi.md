# 12 — Yeni Karakter Rehberi

Son güncelleme: 13 Kasım 2026

## Kullanıcının kuralı
Kullanıcının 12 Kasım 2026 gecesi yazdığı not (aynen; çelişkide bu geçerlidir):

> sen bi karakter yazma ustasısın karaktelerden bir şey değiştiriken veya yeni bi karakter oluşturuken aşşadaki maddelere dikkat etmen lazım
>
> madde 1 her karakterin oyun atmosferine uygun olması gözetlenmelidir.
>
> madde 2 karakterlerin 3 skill bi tane ultileri olmalıdır

Kullanıcının isteği: yeni karakter oluştururken `mdler/` klasörüne bakılacak ve karakter ona göre yapılacak.

## Şu an oyunda olan (adımlar)
1. **Fikir:** tek cümle kimlik; mevcut beş karakterden farklı (bkz. 02).
2. **Atmosfere uygunluk:** ton ve görünüş 01'e uyar.
3. **Kimlik kartı:** aşağıdaki şablonu doldur.
4. **Dört yetenek:** şu an Q, E, R + savunma S; planlanan sistemde Q (menzilli hasar), W (yakın dövüş), E (kendine can), R (ulti) — bkz. 03.
5. **Renk ve silah:** ana ve vurgu rengi; taraf (Ateş veya Rün) seçilir.
6. **Model, portre, klipler:** glb model (`assets/models/<id>/<id>.glb` + LISANS.txt), portre webp (Higgsfield). Şart klipler: Idle, 2H_Melee_Idle, Hit_A, Hit_B, Death_A, Cheer, Blocking, Block_Hit + her yeteneğin kendi klibi (ulti için evre klipleri).
7. **Sesler:** q, e, r, savunma, söz, zafer repliği + hit ve ko sesi (bkz. 10).
8. **Efektler:** her yetenek için efekt anahtarı (bkz. 03, 09).
9. **fighters.js alanları:** id, name, title, archetype, source, weapon, model, palette (main, accent, hex), blurb, skills (q, e, r, s: name, short, desc, clip, fx; ulti için clips).
10. **Bağlantılar:** portre kaydı (`portraits.js`), lobi madalyonu ve bilgi kartı, bot havuzu, adres kısayolu `?karakter=<id>`.
11. **Testler:** karakter listesi ve beceri alanı testleri çalışır; `node --test tests/*.test.mjs` hepsi geçer.
12. **Belgeler:** 02, 03, 10, 13 güncellenir.

Örnek: Hacı Usta (`konyali`) beşinci karakter olarak bu yolla eklendi.

## Boş şablon
```
Ad:
Unvan:
Kimlik (tek cümle):
Görünüş:
Taraf (Ateş / Rün):
Ana renk / Vurgu rengi:
Silah:
Dövüş tarzı (yakın / menzilli):
Model dosyası / Portre dosyası:
Q (menzilli hasar): ad / tür / klip / efekt / ses
W (yakın dövüş):    ad / tür / klip / efekt / ses
E (kendine can):    ad / tür / klip / efekt / ses
R (ulti, 3 evre):   ad / evreler / klip / efekt / ses
S (savunma):        ad / klip
Replik karakteri:
Güçlü yan / Zayıf yan:
```

## Planlanan / sırada (henüz kodda yok)
- W ve E (kendine can) alanları `fighters.js`'te yok; sistem koda girince şablon alanları zorunlu olur.
- Karakter ekleme için otomatik doğrulama betiği yok.

## Yeni bir şey eklerken uyulacaklar
- [ ] 01 ve 02 okundu; renk çakışmıyor.
- [ ] Şablon eksiksiz; her alan dolu.
- [ ] Model lisansı belgeli; portre parlaklığı ölçüldü (siyah çıkmaz).
- [ ] VS, sonuç, lobi ve maç ekranında karakter görünür.
- [ ] İş bitince ilgili md'ler güncellendi.

## Kodda nerede
- `pvp/shared/fighters.js`, `pvp/portraits.js`, `pvp/characters.js`, `pvp/fighters3d.js`, `pvp/network.js`
- `assets/models/`, `assets/higgsfield/final/`, `assets/sfx/replik/`
