# 6 — Ana sayfa açılış yükü

Ölçüm: 1440×900, `http://127.0.0.1:5177/index.html`, yüklemeden 3,5 sn sonra `performance.getEntriesByType('resource')`.
Bayt: her URL'nin sunucudaki gerçek boyutu (HEAD `Content-Length`, sıkıştırmasız). `encodedBodySize` bu sunucuda 304 yanıtlarında 0 döndüğü için kullanılmadı.

| | İstek | Bayt |
|---|---|---|
| Önce | 154 | 3074 KB |
| Sonra | 132 | 2170 KB |
| Fark | −22 | −904 KB (−%29) |

## Ne ertelendi, nasıl
1. **VS portreleri (5 webp + 10 padişah svg, ~400 KB)** — `pvp/cinematic.js` `attachCinematic` içindeki önden indirme artık `#pvp-root` gizliyken kurulmuyor. `MutationObserver` `hidden` özniteliğini izliyor; PvP görünür olunca (kart → `?pvp=lobby`, `?pvp=practice`, eski sitedeki `pvp-enter`) eskisi gibi `requestIdleCallback` ile ısınıyor. `destroy()` gözlemciyi kapatıyor. Lobi zaten bu resimleri kendi CSS'iyle yüklüyor.
2. **Eski site görselleri (castle-scene, player.jpg, adventure-×3, arena-king, rune-preview, ~500 KB)** — `exact-ui.css` sonuna 3 kural eklendi: `html:not(.tlh-legacy)` altında `body` ve `#app` içindeki arka plan görselleri `none`, `#app img[loading="lazy"]` `display:none`. `app.js`'teki 3 `<img>`'e `loading="lazy"` eklendi (display:none + lazy olunca tarayıcı indirmiyor).
   - Kurallar `html.tlh-app-off` sınıfına bağlanmadı, çünkü görseller ilk boyamada (home.js sınıfı eklemeden önce, ~240 ms) isteniyordu; sınıfa bağlı denemede hiç kazanç olmadı.
   - Gövde arka planı hiçbir ekranda görünmüyor (`#tl-home` ve `#pvp-root` tam ekran ve opak).
   - Eski siteyi görselleriyle göstermek gerekirse `<html>`'e `.tlh-legacy` eklenmesi yeter.

## Dokunulmayanlar ve nedenleri
- **PvP JS grafiği (60 dosya, 835 KB: network.js, index.js, shared/match.js, rounds-ui.js, arena-ui.js…)** hâlâ açılışta iniyor. Bu dosyalar `index.html`'deki `<script type="module" src="./pvp/index.js">` ile ve index.js'in statik import'larıyla geliyor. Ertelemenin tek güvenli yolu var: index.js'i küçük bir yükleyiciye çevirmek (`?pvp`/`?pvpRoom` varsa hemen, yoksa `tuslab:pvp-enter` olayında `import('./pvp-main.js')` + olayı yeniden yayınlamak) ve bugünkü gövdeyi `pvp/pvp-main.js`'e taşımak. Ancak **33 test dosyası `pvp/index.js` metnini okuyup içinde import/kod arıyor** (ör. `pvp-fight-hud`, `pvp-skillbar`, `pvp-word-queue33`, `pvp-stages33`). Bu testler bu işin sahiplik alanında değil, o yüzden yapılmadı.
  - GEREKEN DEĞİŞİKLİK: testlerdeki `pvp/index.js` okumaları `pvp/pvp-main.js`'e çevrilirse, tahmini kazanç ~60 istek ve ~835 KB daha.
  - Ana sayfanın PvP kartı zaten tam sayfa geçişi (`?pvp=lobby`) yaptığı için yükleyici güvenli olur.
- **home/data/words.js (104 KB)** — `home/arena.js` (`WORDS`) ve `home/lessons.js` (`WD`) bunu statik import ediyor. `home/home.js` açılışta `loadArena()` ve ders verisiyle yüklüyor, çünkü kartlardaki gerçek sayılar (47 ders, 234 atasözü…) ve Yazma'nın hazır olması için gerekiyor. home/* dosyalarında başka oturumların commit edilmemiş değişiklikleri var, dokunulmadı.
  - Öneri: kart sayıları için hafif bir sayım modülü yazılabilir. Ya da `arena.js` içinde WORDS yalnız kelime modu açılınca dinamik yüklenebilir.
- **CSS (56 `<link>`)** — index.html değişmez, dokunulmadı.
- `pvp/shared/words.js` — app.js:214 ve PvP birlikte kullanıyor, dokunulmadı.

## Değiştirilen dosyalar
- `pvp/cinematic.js` 91–114 (ısınma gizliyken gözlemciye bağlandı), 242 (`destroy` gözlemciyi kapatır).
- `app.js` 489 ve 545: 3 `<img>`'e `loading="lazy"` eklendi. CRLF korundu.
- `exact-ui.css` 128–134: yorum ve 3 kural eklendi.
- Yeni test: `tests/acilis-yuku.test.mjs` (4 test).

## Test
`node --test tests/*.test.mjs` → **1075/1075** (önce 1071 + 4 yeni).

## Tarayıcıda görülenler
- **Ana sayfa:** görünüm öncekiyle aynı. Kart sayıları geliyor (47 ders, 234 atasözü…), PvP kartının afişi var.
- **Kart → lobi geçişi:** PvP Düello kartı `?pvp=lobby` adresine geçiyor, lobi açılıyor. Osman Gazi seçili, alt şeritte madalyonlar ve portreler, sağda arena görselleri var.
- **Bot maçı:** SAVAŞA BAŞLA ile bot maçı başladı. 3B dövüşçüler, yazma paneli, sayaç ve bot hamleleri görüldü.
- **`?pvp=lobby` doğrudan:** lobi açılıyor (`#pvp-root` görünür, lobi metni var).
- **Konsol:** tek hata satırı var: `net::ERR_CONNECTION_REFUSED`. Kaynak adresi görünmüyor. Sayfanın kaynak listesinde 5177 dışında adres yok, kodda da 8787/localhost adresi yok. Büyük olasılıkla tarayıcı panelinden ya da çevrimiçi odadan geliyor, ama doğrulanmadı.

## Görülmeyenler / denenmeyenler
- VS giriş sinematiğinin kendisi ekran görüntüsünde yakalanmadı (maç ekranına geçildi).
- Ses kulakla doğrulanmadı. Maç açılışında sfx ve müzik dosyalarının 200 ile indiği ağ listesinde görüldü.
- Eski sitedeki "PvP Modları / Çevrimiçi lobiyi aç" düğmesi denenmedi, çünkü kullanıcıya gösterilmiyor.
- Sonuç ekranı, raund sonu ve tur arası bu iş kapsamında denenmedi. Bu ekranlara dokunulmadı.
- `npm run cf:validate` çalıştırılmadı.
