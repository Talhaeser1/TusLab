# Eğitim araştırması: klavye dersleri nasıl kurgulanır (23 Kas 2026)

Kısa web taraması + bilinen yöntemler. Kaynaklar kendi cümlelerimizle özetlendi; alıntı yok. Aramada keybr, TypingClub/typing.com ve Ratatype için doğrudan resmi sayfa bulunamadı; keybr bilgisi forum ve üçüncü taraf yazılarından, bu yüzden "kesin" sayılmamalı. Türkçe siteler (onparmak, klavyehiz, m5bilisim) için bir ders sırası doğrulanamadı; Türkçe Q ders sırası aşağıdaki ortak yöntemden türetildi.

## Bulgular
1. **keybr.com**: Önce birkaç sık harfle başlar, yeni harfi ancak mevcut harflerde yeterli güven oluşunca açar. Üretilen metin yalnız açılmış harflerden oluşur ve en zayıf tuş daha sık çıkar. Açma ölçütünde hız mı doğruluk mu ağır basıyor, kaynaklar çelişiyor.
2. **TypingClub / typing.com**: Her dersin geçmesi için en düşük hız ve doğruluk eşiği vardır. Yıldız/puan ve ders ders ilerleme eşiği motivasyon sağlar; sınıf düzeyine göre hedef WPM ve doğruluk tablosu verilir.
3. **Ratatype**: Parmaklar ana sıraya (ASDF - JKL;) yerleştirilir ve her vuruştan sonra oraya dönülür. Klavye üzerindeki renkler hangi parmağın hangi tuşa bastığını gösterir.
4. **10fastfingers ve Monkeytype**: Ders vermez, test eder. En sık kelimelerden (10fastfingers'ta ilk ~1000) rastgele akış üretir; Monkeytype büyük harf, noktalama, sayı ve alıntı kipleri sunar. Ders sonrası serbest "hız" bölümü için iyi bir model.
5. **Genel on parmak yöntemi (Türkçe Q dahil)**: Ana sıra (a s d f / j k l ş) -> üst sıra -> alt sıra -> özel harfler -> büyük harf ve noktalama -> hız metinleri. Her dersin başında yalnız 1-2 yeni tuş vardır, alıştırmalar önce hece/sözde-kelime, sonra gerçek kelimedir.

## Derslere alınan fikirler
- **Kademeli harf açma** (keybr): 47 ders, 8 ünite; her derste en çok 2 yeni tuş (`newKeys`), `keys` birikimlidir.
- **Yalnız öğrenilmiş harflerden üretim** (keybr): `buildDrill` kelimeleri `keys` ile süzer; havuz yetmezse sözde-kelime üretir. Sözde-kelimeler ünlü/ünsüz dönüşümlüdür ve yeni tuşa ağırlık verir.
- **Geçme eşikleri** (TypingClub): her derste `goalWpm` ve `goalAcc`; ilk derslerde 6 WPM ve %90 ile başlar, hız ünitesinde 24-30 WPM ve %94-95'e çıkar.
- **Parmak haritası ve renk** (Ratatype): `FINGERS` (L5..L2, R2..R5, T) ve `KEY_ROWS` arayüzün parmak renklerini ve klavye çizimini beslemesi için verilir.
- **Zayıf tuş tekrarı** (keybr): yazma ekranı `weakKeys` toplar; `focus`/`newKeys` mantığı buildDrill'de ağırlık verir, ileride zayıf tuşlar `focus` olarak verilebilir.
- **Test benzeri hız bölümü** (10fastfingers/Monkeytype): "Hız" ünitesi kısa / orta / uzun / karışık kelime akışıdır; "Ustalık" ünitesi alıntı kipine karşılık gelir (atasözü, şiir, tekerleme, deyim, özdeyiş).
- **Türkçeye özgü** (kendi tasarımımız): ö, ğ, ş, ç, ü ve ı/i için ayrı dersler; ğı/ğü, şç, ük, ler/lar, yor ve ünlü uyumu kalıpları ayrı bir "Kombinasyonlar" ünitesinde; İ/I büyük harf ayrımı için ayrı ders.

## Veri notları
- `home/data/words.js`: 8000'den fazla benzersiz küçük harfli kelime (2-15 harf, yalnız a-z (q w x hariç) ve çğıöşü). Çekimli biçimler kök listelerinden kurallarla (ünlü uyumu, ünsüz yumuşaması, -yor kuralı) üretilip el ile eklenen kelimelerle birleştirildi; ç, ğ, ş, ö, ü, ı içeren kelime sayısı yüksektir.
- `home/data/texts.js`: şiirler yalnız telifsiz yazarlardan (Yunus Emre, Mehmet Akif Ersoy, Fuzuli, Nedim, Ziya Paşa, Dadaloğlu, Mehmet Emin Yurdakul, Mevlana) ve halk türküsünden; Âşık Veysel kasten yok (telifli). Yazılabilsin diye â/î/û kullanılmadı. Atasözü seviyeleri: 1 kısa, 2 orta, 3 uzun/noktalamalı, 4 çok uzun veya birkaç atasözünün ";" ile zinciri. Zincirlerin bir kısmı gerçek atasözlerini birleştirir, bir kısmı sonuna açıklayıcı bir yan cümle ekler; bunlar alıştırma metnidir, atasözü değildir. Tekerlemelerin bir bölümü geleneksel, bir bölümü geleneksel kalıpta yeni yazılmıştır.
- Şiirlerde halk kaynaklı metinlerin söyleniş farkları olabilir; yayın öncesi bir Türkçe okuyucusunun gözden geçirmesi önerilir.
