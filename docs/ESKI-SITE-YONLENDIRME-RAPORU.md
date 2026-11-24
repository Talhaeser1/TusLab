# Eski siteye düşme raporu

## 1. Bulunan yollar
1. Ana sayfadaki PvP bağlantıları (`?pvp=practice&mode=…`, app.js:489 ve home nav) tam sayfa yüklemesi yapar. Sayfa `?pvp=` ile açılınca home/home.js:9 `return` ediyordu, yeni ana sayfa hiç kurulmuyordu. PvP'de "← Arenaya dön" (`data-pvp-action="close"`, pvp/index.js:~636) `#pvp-root`'u gizleyince altta ESKİ uygulama (#app) görünüyordu, adres hâlâ `?pvp=…`.
2. PvP sonuç ekranında "Ayrıl" (`data-pvp15-action="leave"`, pvp/index.js:~1033): `network.disconnect(true)` + panel gizleme. `#pvp-root` gizlenirse yol 1 ile aynı sonuç; gizlenmezse PvP lobisinde kalınır (eski site görünmez).
3. Sayfa içi PvP (`tuslab:pvp-enter`, app.js:729 / pvp/index.js:633,999): home.js `hideHome()` yapıyor, PvP açılmazsa (hata/iptal) "ana sayfa gizli + PvP gizli" kalıyordu; yalnızca ⌂ düğmesi çıkış yoluydu (home.js eski satır 723).
4. PvP yüklenemezse (modül hatası) `?pvp=` sayfasında eski site açık kalıyordu.

## 2. Yapılan düzeltmeler (home/home.js)
- Satır 9–31: `?pvp=` varsa ana sayfa kurulmaz ama `#pvp-root` için `hidden` gözlemcisi kurulur; yalnızca görünür→gizli geçişinde `location.replace(location.pathname)` (temiz adres, yeni ana sayfa açılır). Başta gizli olması reload döngüsü yapmaz (`seen` bayrağı). #pvp-root sonradan eklenirse yakalanır. 20 sn içinde hiç görünmezse yine temiz adrese gider.
- Satır ~745–749: `tuslab:pvp-enter` sonrası 4 sn içinde PvP görünür değilse `showHome()`.
- Satır 3: başlık yorumu. HTML şablonlarına, sınıflara, CSS'e dokunulmadı.

## 3. Doğrulama
- `node --check home/home.js`: geçti (konteynerde).
- `npm test`: ÇALIŞTIRILAMADI (cihaz kabuğu "Workspace still downloading" hatası verdi; yalnızca dosya hazırlama araçları kullanıldı).
- Tarayıcıda tıklama testi: YAPILMADI. Yalnızca kod yolu analizi yapıldı.

## 4. home.js dışında gereken değişiklikler
- Yok zorunlu. Not: `data-pvp15-action="leave"` (pvp/index.js:~1033) `#pvp-root`'u gizlemiyorsa kullanıcı PvP lobisinde kalır (eski siteye düşmez). "Ayrıl" sonrası ana sayfa isteniyorsa pvp/index.js'te leave sonrası `PVP_CLOSE` gönderilmeli (dondurulmuş dosya, dokunulmadı).

## 5. Kalan riskler
- 20 sn zaman aşımı çok yavaş ağda PvP yüklenirken ana sayfaya atabilir (otomatik başlangıç yavaşsa).
- Gerçek tarayıcıda uçtan uca test edilmedi.
- `?pvp=` ile açılıp çıkınca sayfa yeniden yüklenir (kısa bir yenileme).
