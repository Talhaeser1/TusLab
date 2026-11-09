# Ekran Kontrol Kuralları (zorunlu)

Bu dosya, ekran ve arayüz değişikliklerinde yapılan hataların tekrar etmemesi için yazıldı.
Arayüze, CSS'e, resimlere ya da yayına dokunan her iş **başlamadan önce** bu dosyayı okur ve
**bitirmeden önce** aşağıdaki listeyi uygular. Liste temiz değilse iş "bitti" sayılmaz.

## 1. Yapılan hatalar ve nedenleri

| # | Hata | Sonuç | Asıl neden |
|---|---|---|---|
| H1 | Yayından önce ekranı kullanıcının koşullarında açmadım | Arkadaşın bilgisayarında arena boş göründü | "Testler geçti" ile "ekran doğru" aynı sanıldı |
| H2 | Resim boyutlarını hiç ölçmedim | Sayfa 22 MB indiriyordu; yavaş internette karakterler hiç gelmedi | Yalnız hızlı yerel sunucuda (localhost) baktım; ağ maliyetini görmedim |
| H3 | Hep tek bir durumda baktım (maç ortası, yazarken) | Tur arasında iki pencere üst üste bindi, yazılar kesildi | Ara ekranlar (tur arası, sonuç, beceri seçimi, maç sonu) hiç açılmadı |
| H4 | Kullanıcıdan daha büyük bir ekranda baktım (1920×1080) | Senin ekranında arena ezildi, sayaç rozetin üstüne bindi | Brave'in sekme ve yer imi çubukları hesaba katılmadı (gerçek yükseklik ~940 px) |
| H5 | Göz kararı baktım, ölçmedim | Kesik yazılar ("Zama…") ve çakışmalar kaçtı | 800 px küçültülmüş ekran görüntüsünde küçük hatalar görünmüyor |
| H6 | Ajanların işini görmeden "bitti" dedim | Yarım kalan işler "bitti" diye raporlandı | Kuyruk betiği "hata yok" ile "iş tamam"ı ayırt etmiyordu |
| H7 | Kullanıcıya hep tek tek komut verdim, uygulamayı denemedim | `.bat` ve PowerShell komutları kullanıcıda çalışmadı | Komutu kullanıcının kabuğunda (cmd / PowerShell) denemeden verdim |

## 2. Her ekran işinde zorunlu kontrol listesi

### A. Ekran boyutları (hepsi)
- [ ] **1920×940, %100** (kullanıcının Brave'i: sekme ve yer imi çubuğu düşülmüş)
- [ ] **1920×940, %80 yakınlaştırma** (eşdeğeri 2400×1175 CSS piksel)
- [ ] **1366×650** (küçük dizüstü)
- [ ] **375×812** (telefon), yalnız taşma ve okunabilirlik için

### B. Oyun durumları (hepsi; yalnız "maç ortası" yetmez)
- [ ] Ana sayfa ve lobi
- [ ] Klasik maç: yazarken, saldırı sırası (çözüm), pencere özeti
- [ ] Zamana Karşı: yazarken, **tur arası (sonuç kutusu + süre becerisi seçimi)**, maç sonu
- [ ] Raund Arena: hazırlık (beceri/eşya seçimi), yazarken, çözüm, raund sonucu, maç sonu
- [ ] Ayarlar menüsü ve "Nasıl oynanır" paneli açıkken

### C. Ölçülerek bakılacaklar (göz kararı değil, JavaScript ile sayılır)
- [ ] **Çakışma yok:** açık pencereler / kutular, yazma paneli, kelime şeridi, beceri kartları ve HP çubuklarıyla kesişmiyor
- [ ] **Kesik yazı yok:** `scrollWidth > clientWidth` olan yazı yok; "…" ile kesilen önemli metin yok
- [ ] **Yazı boyutu:** görünen hiçbir yazı 12 pikselden küçük değil
- [ ] **Taşma yok:** sayfa yatay kaydırma çubuğu çıkarmıyor
- [ ] **Arena alanı:** karakter görselleri en az ~250 px yüksekliğinde görünüyor
- [ ] **Aynı anda tek pencere:** bir durumda en fazla bir açılır pencere/kutu
- [ ] **Konsol temiz:** konsolda hata yok, 400/404 dönen istek yok

### D. Ağ ve yükleme (yayından önce)
- [ ] Sayfanın toplam indirmesi ölçülür (hedef: ilk açılış < 6 MB)
- [ ] 400 KB'tan büyük tek resim yok (test: `tests/assets.test.mjs`)
- [ ] Müzik gibi ağır dosyalar ilk ekrandan sonra yüklenir
- [ ] Yayından sonra yayın adresinden `curl` ile en az 3 dosya kontrol edilir

### E. Ekran görüntüsü
- [ ] Her durumun **tam çözünürlüklü** ekran görüntüsü alınır; küçük önizlemeye bakmak yetmez
- [ ] Şüpheli bölge `zoom` ile büyütülerek okunur

### F. Bitirme ölçütü
- [ ] `node --test tests/*.test.mjs` hepsi geçiyor
- [ ] `npm run cf:validate` geçiyor
- [ ] A–E listesi temiz; temiz değilse kalan hatalar raporda **açıkça** yazılır, "bitti" denmez

## 3. Komut verirken
- Kullanıcıya verilen komut, kullanıcının kabuğuna (PowerShell mi, cmd mi) göre yazılır ve önce denenir.
- `.bat` dosyaları **CRLF satır sonu + yalnız ASCII** olur (Türkçe karakter yok).

## 4. Ajan (GLM) işleri
- "Hata kalıbı yok" demek "iş bitti" demek değildir. Ajanın raporu (`Kullanılan skill'ler` satırı) ve dosya değişikliği görülmeden iş tamam sayılmaz.
- Ajan çıktısı, siteye bağlanmadan önce bu listedeki A–C adımlarından geçer.
