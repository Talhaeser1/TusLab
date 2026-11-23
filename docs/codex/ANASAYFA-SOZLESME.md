# Yeni Ana Sayfa + Eğitim — ortak sözleşme (23 Kas 2026)

Kullanıcı isteği: ana sayfa baştan, tek tema (tüm sitede korunacak "Neon Arena" paleti), eğlenceli 3B ana ekran,
klavye dersleri (Ö, Ğ, Ş, Ç, İ/ı, kombinasyonlar), ana sayfadaki hızlı yazma yerine şiir / atasözü / tekerleme
(atasözleri zorlaştırılmış), geniş kelime havuzu (aynı kelimeler tekrar etmesin). **PvP'ye dokunulmaz.**

## Kurallar
- Tüm yeni kod `home/` klasöründe. `pvp/`, `app.js`, mevcut CSS dosyaları DEĞİŞMEZ.
- `index.html`'e yalnız 2 satır: `<link rel="stylesheet" href="./home/home.css" />` (compact-height.css'ten ÖNCE)
  ve `<script defer src="./home/home.js"></script>`. Bunu orkestra ekler, işçiler dokunmaz.
- CSP: `script-src 'self'` → satır içi `<script>` yok, CDN yok, `eval` yok. Font CDN yok (sistem fontu).
  three.js yerel: `../pvp/vendor/three.module.min.js`, `../pvp/vendor/GLTFLoader.js` (home/ içinden göreli).
- Dil Türkçe. Saf JS (ES2020 modülleri), framework yok, derleme yok.
- Tarayıcı depolaması: `localStorage` anahtarı `tuslab-home-v1` (try/catch ile). app.js'in `STORAGE_KEY`'ine dokunma.
- `prefers-reduced-motion` ve `html.reduced-motion` sınıfına uy. Telefonda (≤ 600 px) yatay kaydırma yok.

## Tema belirteçleri (home/home.css :root içinde, `--tl-` önekli)
```
--tl-bg:#080b1a; --tl-bg2:#10142b; --tl-panel:rgba(18,22,48,.72); --tl-line:rgba(120,140,255,.18);
--tl-ink:#eef1ff; --tl-mute:#9aa3c7; --tl-ember:#ff7a2f; --tl-gold:#ffc861; --tl-cyan:#3fe0ff;
--tl-violet:#8b5cff; --tl-ok:#45e39a; --tl-bad:#ff4d6d; --tl-radius:18px;
--tl-font:"Segoe UI",system-ui,-apple-system,Roboto,"Noto Sans",sans-serif;
```
Eğitim ekranları da yalnız bu değişkenleri kullanır.

## Dosyalar ve sahipleri (iki işçi aynı dosyaya yazmaz)
| Dosya | Sahip |
|---|---|
| home/data/words.js, home/data/texts.js, home/data/lessons.js, docs/EGITIM-ARASTIRMA.md | İşçi V (veri) |
| home/home.js, home/home.css, home/scene3d.js, home/sfx.js | İşçi K (kabuk) |
| home/typing.js, home/lessons.js, home/literature.js, home/egitim.css | İşçi E (eğitim) |

## Veri biçimi (İşçi V üretir, diğerleri yalnız okur)
```js
// home/data/words.js
export const WORDS = [/* ≥ 5000 benzersiz, küçük harf Türkçe kelime, 2–15 harf, yalnız a-z + çğıöşü + â î û yok */];
// home/data/texts.js
export const POEMS = [{ id, title, author, lines: ['…', '…'] }];          // telifsiz (yazarı ≥ 70 yıl önce ölmüş / halk)
export const PROVERBS = [{ text, level }];                                  // level 1..4, 4 = en zor (uzun, nadir, noktalamalı)
export const IDIOMS = [{ text, meaning }];
export const TWISTERS = ['…'];                                              // tekerlemeler (zor)
export const QUOTES = [{ text, author }];                                   // telifsiz özdeyişler
// home/data/lessons.js
export const FINGERS = { 'a':'L5', 's':'L4', … };                           // Türkçe Q klavye, L5..L1 / R1..R5, başparmak 'T'
export const KEY_ROWS = [['"','1',…], ['q','w','e','r','t','y','u','ı','o','p','ğ','ü'], ['a','s','d','f','g','h','j','k','l','ş','i',','], ['<','z','x','c','v','b','n','m','ö','ç','.']];
export const UNITS = [{ id, title, desc }];
export const LESSONS = [{ id, unit, title, desc, newKeys:['f','j'], keys:['f','j',…] /* birikimli izinli harfler */,
                          kind:'keys'|'combo'|'words'|'text', combos:['ğı',…]?, goalWpm, goalAcc, length /* karakter */ }];
export function buildDrill(lesson, words, rng) -> string   // aynı kelimeyi bir alıştırmada tekrar etmez, rastgele
```

## Modül arabirimleri
```js
// home/typing.js (İşçi E)
export function mountTyper(host, { text, keyboard = true, onProgress(stats), onFinish(stats), sfx }) -> { destroy(), focus() }
// stats = { wpm, acc, errors, elapsedMs, typed, total, weakKeys:{ch:count} }
// home/lessons.js (İşçi E)
export function mountLessons(host, ctx) -> { destroy() }
// home/literature.js (İşçi E)
export function mountLiterature(host, ctx) -> { destroy() }
export function dailyLine() -> { text, source }        // ana sayfadaki "Günün Dizesi" kutusu için
// home/scene3d.js (İşçi K)
export function mountScene(host) -> { destroy(), pulse(kind) }   // kind: 'key'|'win'
// home/sfx.js (İşçi K)
export const sfx = { key(), error(), win(), voice(name) }       // voice: 'welcome'|'great'|'lesson'|'record'
// ctx (home.js verir): { back(), sfx, save(obj), load() -> obj, toast(msg) }
```
Ses dosyaları (orkestra üretir, ElevenLabs/Higgsfield): `assets/sfx/home/welcome.mp3`, `great.mp3`, `lesson.mp3`, `record.mp3`,
`chime.mp3`, `fanfare.mp3`. Dosya yoksa sessiz geç (WebAudio yedek bip).

## Var olan uygulamayla bağlantı (home.js)
- `?pvp=` sorgusu varsa ana sayfa hiç açılmaz. `#pvp-root` görünür olunca veya `tuslab:pvp-enter` olayında gizlenir.
- "Hız Arenası" → ana sayfa gizlenir, mevcut uygulama görünür (gerekirse `data-action="nav" data-mode="arena"` düğmesine tıklanır).
- "PvP Düello" → `?pvp=practice&mode=classic` bağlantısı; "Çevrimiçi" → `document.dispatchEvent(new CustomEvent('tuslab:pvp-enter'))`.
- Mevcut uygulamaya dönen kullanıcı için sağ altta küçük "⌂ Ana Sayfa" düğmesi (PvP açıkken gizli).
