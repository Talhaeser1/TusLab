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
| home/home.js, home/home.css, home/sfx.js | İşçi K (kabuk) |
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
export function mountTyper(host, { text, keyboard = true, onProgress(stats), onFinish(stats), sfx,
                                   stream?() -> { text, source? } | string | null,   // akış kipi: sıradaki parça (null = bitti)
                                   onChunk?({ item, index, done, stats }) })
  -> { destroy(), focus(), setKeyboard(on), stop() /* oturumu bitir (Esc/Bitir) */, stats(), get item, get expected /* sıradaki karakter */ }
// stats = { wpm, acc, errors, elapsedMs, typed, total, weakKeys:{ch:count}, keystrokes, hits, chunks }
// Akışta Esc yazıcı içinde stop() çağırır; hiç yazılmadan bitirilirse de onFinish(stats) gelir (typed = 0).
export function matchStartKey(key, expected) -> string      // Merkez'de basılan ilk harf: büyük/küçük duyarsız eşleşirse beklenen harf, yoksa ''
export function setText(el, v)                              // sık güncellenen sayaçlar: yalnız değişince, metin düğümü verisiyle yaz
// home/arena.js (Yazma ve Şiir & Atasözü metin akışı)
export const MODES, STREAM_MODES; export function isStreamMode(m), itemsFor(m), createStream(m, { rng, items }), nextChunk(m), pickText(m)
export function loadWords() -> Promise, wordsReady() -> bool   // kelime havuzu (data/words.js) açılışta inmez; 'kelime' kipinden önce beklenir
// home/ders-kilit.js (ana ekran açılışta yalnız bunu yükler; lessons.js ve data/words.js Dersler açılınca iner)
export function lessonUnlocked(all, i), intentLessonIndex(intent, all), lessonRec(all, id)
// home/lessons.js (İşçi E)
export function mountLessons(host, ctx) -> { destroy() }      // ctx.intent = { lesson:'L07', index } → harita yerine doğrudan o ders (açıksa)
export { lessonUnlocked, intentLessonIndex }                    // ders-kilit.js'ten yeniden dışa
// home/literature.js (İşçi E)
export function mountLiterature(host, ctx) -> { destroy() }   // ctx.intent = { cat:'atasozu'|'deyim'|'siir'|'tekerleme'|'ozdeyis' } → o türün akışı hemen
export function lineStarts(lines), lineAt(starts, pos)        // şiirde kıta kutusu: dize başları ve imlecin dizesi
// (24 Kas: dailyLine() kaldırıldı; home/scene3d.js _to_delete/ altına taşındı — Merkez 3B kullanmıyor, docs/18-19, docs/23)
// home/sfx.js (İşçi K)
export const sfx = { key(), error(), win(), voice(name) }       // voice: 'welcome'|'great'|'lesson'|'record'
// ctx (home.js verir): { section, intent, back(), sfx, save(obj), load() -> obj, toast(msg) }
```
Ses dosyaları (orkestra üretir, ElevenLabs/Higgsfield): `assets/sfx/home/welcome.mp3`, `great.mp3`, `lesson.mp3`, `record.mp3`,
`chime.mp3`, `fanfare.mp3`. Dosya yoksa sessiz geç (WebAudio yedek bip).

## Var olan uygulamayla bağlantı (home.js)
- `?pvp=` sorgusu varsa ana sayfa hiç açılmaz. `#pvp-root` görünür olunca veya `tuslab:pvp-enter` olayında gizlenir.
- (Eski) "Hız Arenası" kartı kaldırıldı: eski site (`app.js`) kullanıcıya hiç gösterilmez (CLAUDE.md). Merkez'de yalnız Yazma, Dersler, Şiir & Atasözü, PvP ve Performans var.
- "PvP Düello" → `?pvp=lobby` bağlantısı (2026-11-23: PvP LOBİSİ açılır, maç kendiliğinden başlamaz; `?pvp=practice` yalnız test/derin bağlantı); "Çevrimiçi" → `document.dispatchEvent(new CustomEvent('tuslab:pvp-enter'))`.
- Mevcut uygulamaya dönen kullanıcı için sağ altta küçük "⌂ Ana Sayfa" düğmesi (PvP açıkken gizli).
- 2026-11-23 (PvP akış şeridi): PvP'den her çıkış (araç çubuğu/lobi "← Ana Sayfa", Esc) yeni ana sayfaya döner; `?pvp=` sayfasında temiz adrese yönlendirilir.
  Eski uygulama `#app` home.js etkinken hiç görünmez: `html.tlh-app-off` sınıfı (home.js) + `pvp/compact-height.css` sonundaki kural.
