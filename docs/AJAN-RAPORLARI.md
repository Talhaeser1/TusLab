# Ajan Raporları — TuşLab Arena geliştirmesi

> Kural: Her ajan işini bitirince bu dosyanın **sonuna** kendi bölümünü EKLER (mevcut metni silmez/değiştirmez).
> Biçim:
>
> ```
> ## <Ajan adı> — <görev> (<model>, <saat>)
> - Ne yaptım:
> - Değişen/oluşan dosyalar:
> - API / önemli kararlar:
> - Test sonucu (sayılarla):
> - Bilinen eksikler / sonraki adım:
> ```
>
> Denetçi: Claude (koordinatör). Dalgalar: A = çekirdek modüller, B = arayüz+çevrimiçi+zamana karşı, C = denetim, D = arayüz fikirleri ve iyileştirme.

---

## Fikir Ajanı 1 — Menüler ve gezinme (GLM 5.3)

*(8 Kasım 2026 · Kaynak koda dokunulmadı, yalnızca bu rapor eklendi. Ajan 2 savaş ekranı/yazma alanını aldı; burada ana menü, lobi, bot paneli, mod seçimi, araç çubuğu ve ayar yapısı. Ekran görüntüleri bu oturumda görsel okunamadı; teşhis tamamen kaynak koddan.)*

### 1. Teşhis (somut)

- **Araç çubuğu iki satıra sarıyor:** `pvp/index.js` `screen()` (satır 155) `.pvp2-actions`'a tek satırda 13+ kontrol basıyor: 3 lobi düğmesi + bağlantı durumu, müzik aç/kapa+kaydırak, ses aç/kapa+kaydırak, efekt, 3B, "GPU dostu · ≤6 parçacık" çipi, ping, maç durumu, Teslim Ol, Geri. `pvp/pvp.css:56-63` açıklaması taşmayı zaten kabul ediyor ("düğmeler sığmazsa alt satıra sarar"); ~2.000 px'lik içerik 1920×1080 %100'de bile iki satıra sığıp arenadan ~45 px yer çalıyor (sahibin bildirdiği sorun).
- **%80 yakınlaştırmada punto çöküyor:** etkin viewport ~2400×1350 CSS px olur; `max-width:1100/1500` sorguları hiç tetiklenmez (zoom-out viewport'u BÜYÜTÜR), sabit küçük puntolar 0.8 ile çarpınır: `.pvp4-toggle` 10px→8px (combat-fx.css:27), `.pvp2-identity small` ve `.pvp2-typing-bottom` 9px→7.2px (pvp.css:17,29), `.fire-mode` `clamp(9px,.71vw,12px)` üst sınırı →9.6px (arena-fire.css:15).
- **Ana menü kalabalık, ikonlar çakışıyor:** `app.js` `globalNav()` (472-479) 6 uzun etiketli öğe basıyor; "Yazma Arenası" ile "PvP: Ruh Düellosu" **aynı ⚔ ikonunu** kullanıyor. Marka `min-width:260px` (rogue.css:4) + 3 başlık aracı. `.global-link` stili 7 dosyada `!important`'la tekrar tanımlı (rogue, phase1, exact-ui, layout-fixes, stage1, adventures, vibrant); index.html toplam **35 stil sayfası** yüklüyor — menü için tek gerçek kaynak yok.
- **Mod seçimi UI'da hiç yok:** lobide/bot panelinde yalnız tur uzunluğu seçici var (`roundsPickerHTML`); şartname §1'in istediği "lobide Arena seçeneği" ve "Zamana Karşı" düğmesi yok (bot yalnız `?pvp=practice&mode=arena&bot=…` URL'iyle açılıyor). Solo "Zaman Yarışı" (app.js:539) adı PvP "Zamana Karşı"sıyla karışıyor.
- **Lobi paneli tek uzun sütun:** `network.js` `networkConsoleHTML()` 548 px genişlikte (lobby.css:3) isim+oda kur+kodla katıl+bot kutusu+iki yardım metnini üst üste diziyor; `pvp6-help` son kullanıcıya "http://127.0.0.1:8787/" gibi geliştirici bilgisi veriyor; 16 karakterlik oda kodu girişi, asıl akış olan davet-linkiyle aynı görsel ağırlıkta.
- **Ayarlar üç yerde dağınık:** ana sayfa modalı (app.js:680) 7 solo anahtar; PvP ekranında müzik/ses/efekt/3B dört ayrı grup kalıcı görünür. Tercihler localStorage'da (`tuslab-pvp-sfx-muted`, `tuslab-pvp-music-volume`, `tuslab-pvp-arena3d`) ama ana Ayarlar'dan erişilemiyor.

### 2. Öneriler (ne/neden/nasıl · emek/öncelik; öncelik 1 = en yüksek)

1. **⚙ Ayarlar popover'ı → araç çubuğu TEK satır.** Müzik/ses/efekt/3B ve "GPU dostu" çipi `⚙` ile açılan popover'a taşınır; satırda yalnız PvP/Profil/Arkadaşlar + birleşik durum + ⚙ + Teslim + Geri kalır. Maçta ses kaydıracağına dokunulmaz ama hep yer kaplar. Nasıl: `pvp/index.js` `screen()` — dört bloğu `<div class="pvp2-settings" hidden>` içine al + `<button data-pvp-action="settings">⚙</button>` (mevcut click işleyicisine tek dal; Ajan 2 #8 ile aynı hedef). `pvp/pvp.css` sonuna: `.pvp2-actions{flex-wrap:nowrap}` + `.pvp2-settings{position:absolute;top:54px;right:12px;z-index:220;display:grid;gap:8px;padding:12px;border-radius:12px;background:#130b2cf2;border:1px solid #56daff9f}`. **S / 1**
2. **Durum hücresi birleşimi.** `.pvp12-ping` + `.pvp2-network` + `data-practice-chip` tek `[data-pvp-status]` çipinde birleşir ("● 42 ms · MAÇ BEKLENİYOR"). Üç ayrı gösterge ~300 px yer kaplıyor; ping rengi `data-quality` (good/medium/high) korunur. Nasıl: `network.js` `updateArena()` iki `writeText`'i tek hedefe yazar. **S / 1**
3. **Teslim Ol / Geri akıllı görünürlük.** `.pvp15-surrender` yalnız `running|paused` maçta görünür; `.pvp2-back` etiketi "← Geri" olur (tam ad `title`'da). Maç dışı Teslim Ol anlamsız; iki uzun düğme ~230 px. Nasıl: `index.js`'teki `tuslab:pvp-match` dinleyicisine 2 satır: `root.querySelector('.pvp15-surrender')?.toggleAttribute('hidden',!['running','paused'].includes(m?.status))`. **S / 2**
4. **Maç sırasında lobi/profil/arkadaşlar kilitli.** Online maç `running` iken `[data-lobby-action="toggle"]` kilitlenir ve panel kapalı tutulur — `pvp6-panel` z-150 sağ üstte, yanlış tıkla yazma alanını örtüyor. Nasıl: `network.js` `render()` içine `const lock=!this.practice&&['running','paused'].includes(this.match?.status)`; düğmelere `disabled` (antrenmanda panel gerekli: "Antrenmanı Bitir" orada). **S / 2**
5. **Birleşik mod seçici — lobi VE bot paneli.** `MODE_OPTIONS=['classic','rounds','time','arena']`; Ajan 2 #10'un `.rui-seg` deseni, ama iki kapsamda: `room` (yalnız host, `MATCH_CONFIG {mode}`) ve `practice` (bot panelinde hep etkin, localStorage `tuslab-pvp-mode`). Şu an UI'da hiç mod seçimi yok; §1/§8.3 Arena lobi seçeneğini şart koşuyor. Etiketler: "Klasik · 90 sn" / "Tur · 5/7/10" / "Zamana Karşı · 30 sn" / "Arena · skill+eşya" (solo "Zaman Yarışı" adı aynen kalır; karışıklık etikette çözülür). **M / 1**
6. **Lobi sekmeleri: Oyna / Antrenman / Yardım.** `.pvp6-before` tek sütunu üç sekme yapar. Oyna: isim + Oda Oluştur + katlanmış kod girişi; Antrenman: bot zorluğu/karakter/mod/tur + Başlat; Yardım: 127.0.0.1 metni, davet-linki açıklaması, maç kuralları özeti. 768 px dizüstünde tek sütun kaydırma gerektiriyor; geliştirici metni kullanıcı ekranına değil Yardım'a ait. Nasıl: `networkConsoleHTML()`'de `.pvp6-tabs` + `[data-lobby-tab]`; mevcut root click'e `action==='tab'` dalı; `lobby.css`'e `.pvp6-tab` stilleri (dashboardHTML `.commander-tabs` görünümü). Odaya katılınca görünen `data-lobby-after` bölümü sekmesiz aynen kalır. **S-M / 2**
7. **Kodla katılım katlanmış.** "VEYA ARKADAŞININ ODASINA KATIL" + 16 karakterlik input → `<details class="pvp6-join-fold"><summary>Kod ile katıl ▾</summary>…</details>`. Asıl akış davet linki (kopyala zaten var); kod satırı ~90 px + hata riski. Yalnız HTML'i sarmak yeterli; `data-lobby-action="join"` değişmez. **S / 3**
8. **%80 zoom için punto tabanı (menü/düğme metinleri).** Okunacak tüm etiketlerde alt sınır: düğmeler ≥12 px, ikincil etiketler ≥11 px (Ajan 2 #2 yazma alanını alıyor; burada menüler). Nasıl: `pvp/pvp.css` sonuna: `.pvp4-toggle{font-size:12px}`, `.pvp2-identity small{font-size:11px}`, `.pvp2-typing-bottom{font-size:10px}`, `.pvp2-hero-tag{font-size:11px}`; `arena-fire.css` `.fire-mode{font-size:clamp(12px,.8vw,15px)}`. Yeni dosya yok, sona ekleme — düşük risk. **S / 1**
9. **Ana menü: ikon ayrımı + kısa etiketler.** "Yazma Arenası" ⌨ ikonuna geçer (solo antrenman), ⚔ PvP'ye kalır; ≤1600 px'de kısa etiketler ("Arena", "PvP", "Liderlik"…). İki ⚔ kafa karıştırıyor; 6 uzun etiket + 260 px marka + başlık araçları satırı sıkıştırıyor. Nasıl: `app.js` `globalNav()` öğelerine tam/kısa çift: `<span class="nav-full">Yazma Arenası</span><span class="nav-short">Arena</span>`; `layout-fixes.css`'e `@media(max-width:1600px){.nav-full{display:none}.nav-short{display:inline}}`. (Uzun vade: menü stilleri için en sonda yüklenen tek `menu.css` — 7 dosyalık `!important` savaşını dondurur.) **S / 2**
10. **PvP tercihleri ana Ayarlar modalında.** app.js:680 modalına "PvP" bölümü: müzik/ses seviyesi+sessize alma, efekt azalt, 3B tercih — mevcut localStorage anahtarlarına okuma/yazma. Tercihler zaten kalıcı ama yalnız PvP ekranındaki 4 kontrolden erişilebilir; sahibin "temiz ayarlar menüsü" isteğini karşılar. Nasıl: modal şablonuna `data-pvp-setting` kontrolleri; `change` işleyicisinde aynı anahtarlara yaz; PvP açıksa canlı uygula (`document.dispatchEvent(new CustomEvent('tuslab:pvp-settings'))` + `index.js`'te dinleyici). **M / 2**

### 3. Yerleşim taslağı — Lobi + araç çubuğu (arena içi ekran için Ajan 2'nin taslağı esas)

```
ARAÇ ÇUBUĞU — her zaman TEK satır:
┌──────────────────────────────────────────────────────────────────────────────┐
│ ⚔ TUŞLAB·RUH DÜELLOSU  [⚔ PvP][🏆 Profil][👥 Arkadaşlar] ●42ms·MAÇ BEKLENİYOR ⚙ ←Geri │
└──────────────────────────────────────────────────────────────────────────────┘
  ⚙ popover: ♫ Müzik [aç] %20 · 🔊 Ses [aç] %55 · ✧ Efektler · ◈ 3B Arena · GPU ≤6 parçacık
  (popover dışına tıklayınca kapanır; maç sırasında da erişilebilir)

LOBİ PANELİ — sağ üst, 548 px, sekmeli:
┌─ ⚔ RUH DÜELLOSU ──────────────────────────────────── [PvP] ─┐
│ [ Oyna ] [ Antrenman ] [ Yardım ]            ← .pvp6-tabs   │
│──────────────────────────────────────────────────────────────│
│ OYUNCU ADIN   [Savaşçı___________________]                   │
│ [ ✦ ODA OLUŞTUR ]                      ← tek birincil düğme │
│ ▸ Kod ile katıl ▾                      ← <details>, katlı   │
└──────────────────────────────────────────────────────────────┘
  odaya katılınca (Oyna, host görünümü — data-lobby-after):
┌─ ODA X7Q2… · 👥 2/2 ─────────────────────────────────────────┐
│ [I·KIZIL: OY1 ✓ HAZIR]        [II·MAVİ: OY2 ● Bağlandı]     │
│ Savaşçın: [🔥 Alev Celladı] [❄ Rün Muhafızı] + rün ızgarası │
│ MOD: (Klasik)(Tur)(Zamana Karşı·30 sn)(Arena)  ← .rui-seg   │
│      Tur seçilince altında: (5)(7)(10) tur                   │
│ [⚔ Hazırım] [Odadan Çık]     👑 [Rakibi Çıkar][Odayı Kapat]  │
└──────────────────────────────────────────────────────────────┘
  Antrenman sekmesi: bot (kolay/orta/zor) + savaşçı + MOD + tur + [🤖 Bota Karşı Oyna]
  Yardım sekmesi: davet linki nasıl çalışır · 127.0.0.1 notu · maç kuralları · kısayollar
```

### 4. Uygulama ajanına ilk 3 iş

1. **Araç çubuğu tek satır + ⚙ popover + durum birleşimi** — `pvp/index.js` `screen()`: dört ayar bloğunu `.pvp2-settings[hidden]` popover'ına taşı, `data-pvp-action="settings"` dalını click işleyicisine ekle; `.pvp12-ping`+`.pvp2-network`'ü tek `[data-pvp-status]`'ta birleştir (`network.js` `updateArena()`). `pvp/pvp.css` sonuna `.pvp2-actions{flex-wrap:nowrap}` + `.pvp2-settings{position:absolute;top:54px;right:12px;z-index:220;display:grid;gap:8px;padding:12px;border-radius:12px;background:#130b2cf2;border:1px solid #56daff9f}`. Doğrulama: 1366×768 %100'de araç çubuğu tek satır; popover dış tıklayınca kapanır.
2. **Mod seçici** — `pvp/rounds-ui.js`: `MODE_OPTIONS` + `modePickerHTML(scope)`/`syncModePicker` (`.rui-seg` sınıfları yeniden kullanılır, `roundsPickerHTML` deseni); `pvp/network.js`: click'e `action==='mode'` dalı — practice → localStorage `tuslab-pvp-mode`, room → `MATCH_CONFIG {mode}` (yalnız host, `waiting/countdown`; `roundsPickDecision` deseni). `networkConsoleHTML()`'de bot kutusuna (practice) ve `data-lobby-after` bölümüne (room) yerleştir.
3. **Punto tabanı + ana menü ikonları** — `pvp/pvp.css` sonuna öneri 8'deki 6 kural; `arena-fire.css`'te `.fire-mode` alt sınırı 12 px; `app.js` `globalNav()`: "Yazma Arenası" ikonu ⌨, PvP ⚔'te kalır + `.nav-full/.nav-short` mekanizması (`layout-fixes.css`'e `@media(max-width:1600px)` kuralı). Doğrulama: %80 zoomda düğme metinleri ≥9.6 px fiziksel (12×0.8) kalır.

## Fikir Ajanı 2 — PvP savaş ekranı ve yazma alanı (GLM 5.3)

### 1. Teşhis (somut)

- **Yazma alanı en altta ve çift kutu:** `pvp/index.js` `playerHTML()` içindeki `.pvp2-typebox` her `.pvp2-side`'ın SON çocuğu (pvp.css:13 ızgara, `auto auto 1fr auto auto`). 1920'de iki ayrı ~900px kutu ekranın dibinde; oyun sahibinin "yukarıda, okunaklı, iki oyuncuya da aynı" isteğinin tam tersi. Spec §8.2 "üst-orta" diyor — henüz `pvp/arena-ui.js`/`.css` yok (glob doğruladı).
- **%80 zoom = 2400 CSS px viewport:** `@media(max-width:1500/1100px)` (pvp.css:34-35) HİÇ tetiklenmez (viewport zoom-out'la BÜYÜR), `clamp()`'lı yazılar max'ta kalır; ama sabit 9–10px etiketler (`.pvp2-identity small` 9px, `.pvp2-typing-bottom` 9px, `.rui-tick` 9px, `.pvp2-hero-tag`/`.pvp2-health-meta` 10px) fiziksel ~7–8px'e düşer; "bazen daha küçük" zoomda okunmaz.
- **Birincil etkileşim en küçük yazı:** `.pvp2-input` 13px mono (~10.4 fiziksel px @%80) ve 31px yükseklik (pvp.css:29); `.pvp2-sample` `clamp(12px,.93vw,16px)`; `.rui-word` 12px, `.rui-cell` 7px.
- **HUD 4 yere dağılmış:** HP panel başında (`.pvp2-health`), seri/savunma/WPM panel dibinde (`pvp7-combo`/`pvp13-defense`/`pvp8-score`), tur HUD'u `.pvp2-announce` şeridinde (rounds-ui.js), yetenek göstergeleri `.pvp2-skillrow` (2×4 buton). Arena'da HP maç boyu kalıcı (5000): bu dağınıklık raund takibini imkânsızlaştırır.
- **Şerit ölçeklenmiyor:** rounds-ui.js `ROUND_WORDS=10` sabit — `wordEls` 10 hücre. Arena raundları 5→20 kelime (ARENA-MODU §2), kombo 4'te (§5.3): mevcut `rui-words`/`rui-cells` uyumsuz.
- **İniş mekanizması yok:** §8.2'nin `translateY()` panel inişi için hiçbir kod yok; `.rui-summary{top:clamp(96px,17vh,170px)}` (rounds-ui.css:110) panel üste taşınırsa yazma alanının ÜSTÜNE biner.
- **Araç çubuğu kalabalık:** 10+ kontrol (müzik+slider, ses+slider, efekt, 3B, perf chip, ping, durum, teslim, geri); maç sırasında dikkat dağıtır, `flex-wrap` yalnız <1500px'te → %80 zoomda tek uzun satır.
- **3B denge:** `.pvp26-canvas` tüm `.pvp2-duel`'i kaplar (arena3d.css:13, z0, `pointer-events:none` ✓) ama `.pvp2-side` koyu perdesi ilk 124px ile sınırlı (arena3d.css:42-46): parlak kolezyum fonunda üstteki yeni HUD/panel kontrastı kaybedebilir.

### 2. İyileştirme önerileri (ne / neden / nasıl / emek / öncelik)

1. **Ortak üst yazma paneli** — Oyun sahibi isteği + §8.2. `pvp/arena-ui.js` tek `[data-arena-ui]` kökü üretir, `.pvp2-duel`'den ÖNCE tek ızgara satırı olarak eklenir (kabuk şablonu değişmez; `roundsUiCreate` deseni). İçinde `.aui-typestage`: ortak kelime `font:700 clamp(18px,1.4vw,24px)/1.3 var(--rui-mono)` (rounds-ui.css'teki değişkeni paylaşıyor), giriş `min-height:44px;font:600 18px mono`, altında iki küçük durum `sen 8/15 · %92 · 61 WPM | rakip 7/15 · %88`. Tek kutu = iki oyuncuya da aynı genişlik/yazı. **M / 1**
2. **%80 zoom tipografisi** — Küçük etiketler 7–8px'e düşüyor. `.aui-*` kendi ölçeğini getirir: HUD sayıları 14px `tabular-nums`, etiketler 12px (9–10px yok), örnek kelime ≥18px, D/Y şeridi 14px, hücre `height:9px`. Yalnız arena-ui.css'te — klasik/rounds pvp.css'e dokunulmaz (§0). **S / 1**
3. **Tek üst HUD şeridi** — HP+raund+süre+seri tek bakışta. `.aui-hud` = genişletilmiş `.rui-bar` deseni: `[isim+HP çubuğu] [◉ RAUND 3/6 + süre halkası (rui-clock 58px)] [isim+HP]`; her yanda 4 kombo hücresi (`--rui-gold` dolunca `KOMBO ×1.5` rozeti, §5.3) ve `.aui-penalty{background:#5a0f22;color:#ff8ea2}` `−%48` çipi (§5.2). Arena maçında `[data-mode="arena"] .pvp2-skillrow,.pvp22-passive,.pvp13-defense,.pvp7-combo,.pvp8-score{display:none}` — klasik ekranda aynen kalır. **M / 1**
4. **Dinamik D/Y şeridi** — Sabit 10 hücre 5–20 kelimeye uymuyor. `wordEls` yerine snapshot `round.words.length` kadar `li.aui-word` üretilir (`replaceChildren`, textContent); `flex-wrap:wrap` üst-orta; durumlar mevcut `is-good/is-bad/is-active` + rakip `has-opp` alt çizgisi deseni (rounds-ui.css:103) aynen taşınır. **S / 2**
5. **Çözüm fazında panelin inişi (§8.2)** — `[data-phase="resolve"] .aui-typestage{transform:translateY(var(--aui-drop));transition:transform 420ms cubic-bezier(.16,1,.3,1),opacity 200ms}`; `arena-ui.js` faz değişince `--aui-drop`'u bir kez hesaplar (`duelRect.bottom − stageRect.top`, resize'da yeniden). `prefers-reduced-motion` + `.pvp4-reduced`'da anında yer değişimi (rounds-ui.css:203 deseni). Hasar adımları `ARENA_RESOLVE_STEP_MS=350`, `fx-damage.js` piksel sayıları boşalan üst alanda; `.aui-summary{top:150px}` örtüsü yazma alanına binmez. **M / 1**
6. **Kişisel süre çipleri (Zamana Karşı dahil)** — `me.remainingMs`/`opponent.remainingMs` anlık görüntüsünden (§7.2): halka kişisel oranla dolar; rakip süresi `null` (Karanlık Saat) → `🌑 —`; `frozen` → `❄` + `is-frozen` mavi çizgi (rounds-ui.css:87'den); Zaman Hediyesi aktifken `+5 sn` rozeti. Zamana Karşı'da aynı HUD, raund etiketi `30 SN` olur. Sunucu saati `network.serverNow()` — yerel hesap yok (mevcut ilke). **S / 2**
7. **3B/HUD dengesi** — Parlak fon üstünde kontrast: `#pvp-root.pvp26-3d .aui-hud,.aui-typestage{background:linear-gradient(180deg,rgba(7,4,18,.92),rgba(7,4,18,.55) 70%,transparent);backdrop-filter:blur(6px)}` (arena3d.css:42 perde deseni); `[data-mode="arena"] .pvp2-midline,.pvp2-vs{opacity:.28}` (görsel gürültü azalır, KO'da ulti `VS` çekme animasyonu `arena3d.js`'te zaten bağımsız). Süs katmanları `pointer-events:none` ilkesi korunur. **S / 2**
8. **Maç içi araç çubuğu sadeleşmesi** — `[data-mode="arena"][data-phase="round"] .pvp23-audio,.pvp10-audio-controls,.pvp4-perf{display:none}`; ses/müzik/efekt/3B düğmeleri mevcut `pvp4-aux-buttons` grubunu `<details class="pvp4-aux">⚙ Ayarlar</details>` içine topla (JS: `toggle` yerine `details` — kod değişimi `screen()` şablonunda 1 satır). Kalan: Geri, Teslim Ol, durum, ping. **S / 3**
9. **Prep kart ızgarası (skill+eşya)** — §8.2 RAUND ÖNCESİ: `.aui-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px}`; kart `min-height:72px`, ad 14px, etki 12px, kalan hak rozeti `2/2` (ARENA_MAX_USES); klavye `1–5` seç, `Enter` onay, `Esc` geç; kilit geri sayımı `rui-clock` halkası. Seçimler rakibe kapalı — yalnız `ARENA_PICK_ACK` ile onay (§7.1). **M / 2**
10. **Lobiye mod seçici** — `networkConsoleHTML()`'de `roundsPickerHTML()` yanına `arenaPickerHTML()`: aynı `.rui-seg` segment düğmeleri ("Klasik / Tur / Arena / Zamana Karşı"); `data-lobby-action="mode"` → `MATCH_CONFIG` deseni (roundsPickDecision'in genelleştirilmiş hali). Pratik URL `?pvp=practice&mode=arena` zaten §1'de tanımlı. **S / 2**

### 3. Yerleşim taslağı — RAUND fazı (1920×1080 @%80)

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ⚔ TUŞLAB·ARENA   [⚙ Ayarlar] [Teslim Ol] [← Geri]      ● 42ms  ⚔ CANLI    │
├────────────────────────────────────────────────────────────────────────────┤
│ OY1 ████████░░ 3200/5000   (◉ RAUND 3/6 · ⏱12)    OY2 ██████████ 4100/5k  │ ← .aui-hud (14px)
│    seri ▮▮▮▯ ×1.5  −%18                       seri ▮▮▮▮▯  🌑 —            │
├────────────────────────────────────────────────────────────────────────────┤
│  karpuz✓  zurpak✗  özgürlük▸  kale  meşale✓  gölge … (ortak set, 14px)   │ ← .aui-words
│  ┌────────────── ORTAK YAZMA ALANI — üst-orta, iki tarafa da aynı ──────┐ │
│  │  özgürlük          ← 24px mono, harf harf renkli (good/bad/next)     │ │
│  │  [ ö zg ü r l _                                              ]      │ │ ← .aui-typestage
│  │  sen 8/15 · %92 · 61 WPM              rakip 7/15 · %88 · 55 WPM     │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│                 3B ARENA / karakter sahnesi  (minmax(0,1fr))               │
│                                · VS ·                                      │
├────────────────────────────────────────────────────────────────────────────┤
│ ÇÖZÜM FAZI: panel translateY(--aui-drop) ile footer üstüne iner;           │
│ hasar sayıları 350 ms adımlarla + .aui-summary(top:150px) boş üst alanda   │
└────────────────────────────────────────────────────────────────────────────┘
```

### 4. Uygulama ajanına ilk 3 iş

1. **`pvp/arena-ui.js` + `pvp/arena-ui.css` oluştur** (rounds-ui.js deseni: yalnız anlık görüntü, skor yerelde hesaplanmaz, tüm metin `textContent`): `createArenaUi(root,{now,isReduced,onLockChange})`; kökte `data-phase="prep|round|resolve|summary|ended"`; dinamik `.aui-words` (5–20); `.aui-hud` + `.aui-typestage`; `ARENA_ROUND_START`'ta `input.focus({preventScroll:true})` (index.js:458 deseni). Test: `tests/pvp-arena-ui.test.mjs` (§9: bölümler, kişisel kelime görünümü, süre gizleme).
2. **`pvp/index.js` entegrasyonu:** `roundsUiCreate()` yanına `arenaUiCreate()`; `tuslab:pvp-match` dinleyicisinde `match.mode==='arena'` iken köke `data-mode="arena" data-phase="…"` yaz, arena-ui'yi `.pvp2-duel`'den önce mount et; klasik/rounds yolları AYNEN kalır (§0, 232 test kırmadan).
3. **`pvp/arena-ui.css` mekanizmaları:** `--aui-drop` + `translateY` inişi + `prefers-reduced-motion`/`.pvp4-reduced` kısayolu (madde 5), `#pvp-root.pvp26-3d .aui-*` scrim (madde 7), `[data-mode="arena"] .pvp2-skillrow,.pvp22-passive,.pvp13-defense,.pvp7-combo,.pvp8-score{display:none}` (madde 3) ve %80 zoom tipografi değerleri (madde 2).

## Fikir Ajanı 3 — Butonlar, yazılar ve geri bildirim (GLM 5.3)

> Fikir/tasarım görevi — kaynak kod değişmedi (8 Kasım 2026). Okunanlar: docs/KULLANICI-ISTEKLERI-ARENA.md,
> docs/ARENA-MODU.md §8.2, index.html, app.js (menü/renderApp), pvp/index.js, pvp/network.js, pvp/rounds-ui.js,
> pvp/pvp.css, pvp/rounds-ui.css, pvp/lobby.css, pvp/combat-fx.css, pvp/net-sync.css, PVP-FAZ21 ekran görüntüleri.

### 1. Teşhis (somut)
- Araç çubuğu tek düzey (pvp/index.js `screen()`, `.pvp2-actions`): 10+ eşit ağırlıklı kontrol yan yana (lobi/profil/
  arkadaş + müzik ve ses kaydırıcıları + efekt + 3B + ping + maç durumu + "Teslim Ol" + "Geri Dön"). Yıkıcı "Teslim Ol"
  (`.pvp15-surrender`) menü anahtarlarıyla aynı hizada; asıl çıkış düğmesi "Geri Dön" hiç öne çıkmıyor.
- %80 zoom kör noktası: Brave'de %80 yakınlaştırma CSS viewport'i 1920→2400 px yapar; `max-width:1500/1100px` ve
  `max-height:820px` kuralları HİÇ tetiklenmez. Sabit 9–10px yazılar (`.pvp2-skill-copy small`, `.pvp2-typing-bottom`,
  `.rui-tick` 9px, `.rui-secs-unit` 7.5px, `.pvp7-combo` 10px) fiziksel 7–8px'e düşer; `.pvp4-toggle` (10px yazı,
  6×9px padding) ~20px dokunma hedefi kalır. Daha küçük zoomda orantılı olarak daha kötü.
- Odak eksik: `pvp/lobby.css` `.pvp6-panel button` için `:focus-visible` yok — Oda Oluştur/Katıl/Hazırım/rün seçimi
  klavyede görünmez odakla gezer; `.pvp5-net-button` ve `.rui-seg button` için de yok.
- Durum placeholder'a emanet: `textUpdate()` (pvp/index.js:182) kilit sebebini ("Tur arası · sonraki raund
  bekleniyor") `input.placeholder`'a yazar; placeholder ekran okuyucuda güvenilmez ve devre dışı girişe odak
  alınamaz. `data-reconnect-banner` (`role=status`) iyi desen — yaygınlaştırılmalı.
- Esc tehlikesi: pvp/index.js:465 odak textarea/input değilse tüm PvP'yi kapatır → `network.reset()` →
  `disconnect(true)`. Lobide yanlış Esc = odadan atılma, onaysız (onay yalnız "Teslim Ol"'da, :509).
- Hata mesajları kod sızdırır: network.js:319 `'Kelime reddedildi: '+p.code` → kullanıcı WORD_INDEX_MISMATCH gibi
  İngilizce kod görür; ERROR paketleri de ham kod geçer (network.js:325). Ellipsis tutarsız: pvp/index.js:148
  "Yazmaya başla..." (üç nokta) vs "Sunucu doğruluyor…" (…).
- `.pvp2-skill` kartları buton gibi görünür ama canlı maçta pasif göstergedir; `disabled` + `opacity:.7`
  (combat-fx.css:53) koyu zeminde kontrastı düşürür.
- İyi olanlar (korunmalı): `aria-pressed` anahtarları (müzik/ses/efekt/3B), `data-quality` renkli ping çipi + `title`
  açıklaması, `.rui-sr` aria-live duyuruları, `.rui-seg button` 44px coarse-pointer hedefi, `role=log` lobi günlüğü,
  `writeText` paint optimizasyonları.

### 2. İyileştirme önerileri (ne / neden / nasıl / emek / öncelik)
1. Araç çubuğunu 3 katmanlı yap — Ne: birincil "Geri Dön", ikincil anahtar grubu (ses/müzik/efekt/3B), yıkıcı
   "Teslim Ol" sağda ayrık. Neden: 10+ eşit düğme arasında yanlış "Teslim Ol" vuruşu kolay. Nasıl (pvp/pvp.css):
   `.pvp4-aux-buttons{display:flex;gap:6px;padding:4px;border-radius:12px;background:#0f0b2eaa}` grup plakası;
   `.pvp15-surrender{margin-left:auto;border-color:#ff6b81}`; `.pvp2-back{font-size:13px;padding:11px 16px;
   border-color:#c9a6ff}`. Emek S · Öncelik 1.
2. Ses/müzik kaydırıcılarını popover'a al — Ne: iki `input[type=range]` + yüzde etiketi araç çubuğunda kalıcı yer
   kaplar. Neden: dar alan/satır taşıma riski ve dövüş düğmelerinin yanında kaydırıcı kazara dokunması. Nasıl
   (pvp/index.js `screen()`): tek "🔊" düğmesi `aria-expanded` + `.pvp-audio-pop{position:absolute;top:56px;
   right:18px;display:grid;gap:12px;padding:14px;border:1px solid #7b5cc0;border-radius:12px;background:#0d0a2aee}`;
   mevcut iki slider + etiket içine taşınır, click handler'a `data-pvp-action="audio"`. Emek M · Öncelik 2.
3. `zoom-out` modu (%80 için) — Neden: zoom medya kurallarını tetiklemez; Brave/Chromium'da %80 zoom
   `devicePixelRatio`'yu ~0.8 yapar (güvenilir JS sinyali). Nasıl (pvp/index.js `show()`): `root.classList.toggle(
   'zoom-out',(window.devicePixelRatio||1)<1)`; pvp/pvp.css: `.zoom-out .pvp4-toggle{font-size:12px;min-height:30px;
   padding:8px 10px}` `.zoom-out .pvp2-typing-bottom,.zoom-out .pvp7-combo{font-size:11px}`; rounds-ui.css:
   `.zoom-out .rui-tick{font-size:11px}` `.zoom-out .rui-secs-unit{font-size:9px}`. HiDPI tabanlı ekranlarda
   yakalayamayabilir; ilk adım sezgiseldir. Emek S · Öncelik 1 (oyun sahibinin birinci isteği okunabilirlik).
4. Lobi odak halkası — Neden: klavye/Tab erişimi şu an görünmez (WCAG 2.4.7). Nasıl (pvp/lobby.css sonuna tek
   blok): `.pvp6-panel button:focus-visible,.pvp5-net-button:focus-visible{outline:2px solid #7fd7ff;
   outline-offset:2px}` (`.rui-seg` panel içinde olduğundan kapsanır). Emek S · Öncelik 1.
5. Placeholder yerine aria-live durum satırı — Neden: kilit/bekleme durumu tüm oyunculara (ekran okuyucuya)
   duyurulmalı. Nasıl (pvp/index.js): `playerHTML()` typeheader'a `<span data-type-status role="status"
   aria-live="polite"></span>` ekle; `textUpdate()` satır 182'deki metnin aynısını buraya `textContent` ile yaz.
   Emek S · Öncelik 1.
6. Esc'yi korumalı yap — Neden: lobide/maçta yanlış Esc = odadan atılma (durum kaybı). Nasıl (pvp/index.js:465):
   `PVP_CLOSE` öncesi `if(network.code||['running','paused'].includes(network.match?.status)){if(!window.confirm(
   "PvP'den çıkmak seni odadan ayırır. Çıkılsın mı?"))return;}`. Emek S · Öncelik 2.
7. Hata sözlüğü + satır içi hata — Neden: kullanıcı İngilizce kod görmemeli; hata oda-kodu alanının yanında
   görünmeli (şu an yalnız günlükte). Nasıl (pvp/network.js): `const ERR_TEXT={ROOM_FULL:'Oda dolu (2/2).',
   ROOM_NOT_FOUND:'Oda bulunamadı; kodu kontrol et.',ROOM_BUSY:'Oda meşgul; biraz bekle.',MATCH_ALREADY_STARTED:
   'Maç zaten başladı; yeni oda kur.',INVALID_JOIN:'Oturum geçersiz; sayfayı yenile.',WORD_INDEX_MISMATCH:'Sıra
   rakibe geçti; güncel durum alınıyor…',ROUND_NOT_ACTIVE:'Raund kapalı; gönderim yok sayıldı.'}`; `receive()`
   319/325'te `ERR_TEXT[p.code]||p.code`; `networkConsoleHTML()` oda-kodu girişi altına `<em class="pvp6-err"
   role="alert" data-lobby-error hidden>`; `join()`/`create()` başarısızlığında doldur. Ayrıca pvp/index.js:148
   "Yazmaya başla..." → "Yazmaya başla…". Emek S · Öncelik 1.
8. Yetenek kartı = gösterge — Neden: buton görünümü "basılabilir" izlenimi verir, oysa canlı maçta pasif
   göstergedir; `opacity:.7` kontrast kaybettirir. Nasıl: canlı maçta `.pvp2-skill`'e `aria-disabled="true"` +
   `.pvp2-skill[aria-disabled="true"]{opacity:1;border-style:dashed;filter:saturate(.5)}` ve
   `title="Yetenek doğru kelimelerle otomatik tetiklenir"`. Emek M · Öncelik 3.
9. Arena prep kartları (§8.2, yeni ekran) — Ne: skill/eşya kartları fiil öncelikli, büyük dokunma hedefli.
   Neden: 10 sn'lik seçim penceresinde okunabilirlik ve hız kritik. Nasıl (pvp/arena-ui.css): `.arena-prep-card{
   min-height:64px;display:grid;grid-template-columns:44px 1fr auto;gap:10px;padding:10px;border:1px solid
   #7b5cc0;border-radius:12px;background:#0e0a2a99}`; etiketler "Harfleri Karıştır", "Süreye +5 sn Ekle",
   "Rakibin Süresinden 5 sn Düş"; seçim `aria-pressed="true"` + `.is-picked{border-color:#ffc87a;box-shadow:
   0 0 12px #ffc87a55}`; kalan hak çipi `.arena-uses{font-variant-numeric:tabular-nums}` → "2/2 hakkı";
   birincil düğme `.arena-lock-btn` canlı sayaçlı "Seçimi Kilitle · 7 sn" → kilitte "✓ Kilitlendi · rakip
   bekleniyor"; ikincil "Seçmeden Devam". Emek M · Öncelik 1.
10. Kontrast/boyut mikro düzeltmeleri — Neden: 7.5–9px etiketler hem küçük hem bazıları sınırda kontrastta.
    Nasıl: rounds-ui.css `.rui-tick{color:#ffffffb3}` (≈4.6:1) ve `.rui-secs-unit{font-size:max(8px,.6em)}`;
    pvp/pvp.css `.pvp2-input:disabled{opacity:.85}` ve `.pvp2-reset{padding:6px 10px;font-size:11px}` (≥26px
    hedef); net-sync.css `@media(max-width:1600px)` içindeki `.pvp12-ping{font-size:9px}` küçültmesini kaldır
    (11px kalsın). Emek S · Öncelik 2.

### 3. Yerleşim taslağı — Arena RAUND (yazma) ekranı (§8.2)

```
┌─ TUŞLAB · ARENA ─────────────────────────── [🔊][✧][◈] ● 42 ms ─┐
│ ⚔ RAUND 2/6 · YAZMA                CANLI · sunucu sıra #84     │
│                                                                │
│ SEN 3.850/5.000 ██████████░░    24 sn    RAKİP 4.120/5.000     │
│ seri 3 [▪▪▪▫▫] kombo 4'te                   seri 5 [▪▪▪▪▪]     │
│                                                                │
│  özgürlük   karpuz   ▸kalemlilik◂   dürüstlük   kalemlik       │
│ ┌────────── YAZMA ALANI (üst-orta, iki tarafa aynı) ─────────┐ │
│ │ «kalemlilik»   [ kalem_ ]       ceza −%48 · kombo ▫▫▫◦◦   │ │
│ └──────────────────────────────────────────────────────────────┘ │
│      (resolve fazında bu panel translateY ile aşağı iner)      │
│                                                                │
│   🔥 ALEV CELLADI        V  S        ❄ RÜN MUHAFIZI            │
│        [ dövüş sahnesi + fx-damage hasar sayıları ]            │
└────────────────────────────────────────────────────────────────┘
```

### 4. Uygulama ajanına ilk 3 iş
1. `pvp/lobby.css` sonuna tek blok: `.pvp6-panel button:focus-visible,.pvp5-net-button:focus-visible{outline:
   2px solid #7fd7ff;outline-offset:2px}` (`.rui-seg` dahil).
2. `pvp/network.js`: `ERR_TEXT` sözlüğü (öneri 7) + `receive()` 319/325'te kullanımı; `networkConsoleHTML()`
   oda-kodu girişi altına `<em class="pvp6-err" role="alert" data-lobby-error hidden>`; `join()`/`create()`
   hatalarında bu alanı doldur. `pvp/index.js:148` "..." → "…".
3. `pvp/index.js`: `playerHTML()` typeheader'a `<span data-type-status role="status" aria-live="polite"></span>`
   + `textUpdate()` 182'de aynı metni oraya yaz; `show()` içine `root.classList.toggle('zoom-out',
   (window.devicePixelRatio||1)<1)` ve `pvp/pvp.css`'e `.zoom-out` kuralları (öneri 3).

## Fikir Ajanı 4 — Arena modu ekranları (GLM 5.3)

> Ne yaptım: hiçbir kaynak dosya değiştirilmedi. `docs/ARENA-MODU.md` (§8.2), `docs/KULLANICI-ISTEKLERI-ARENA.md`, `index.html`, `pvp/index.js`, `pvp/network.js`, `pvp/rounds-ui.js`, `pvp/rounds-ui.css`, `pvp/pvp.css`, `app.js` okundu. Not: `PVP-FAZ21-*.png` içerikleri bu modelle okunamadı, `.verification_video/` bu sürümde yok; teşhis koddan çıkarıldı.

### 1. Teşhis (somut)

- **Yazma alanı yanlış yerde ve ikili:** `pvp/index.js` `playerHTML()` (L145–150) her `.pvp2-side`'e ayrı `.pvp2-typebox` koyar; `.pvp2-side` ızgarası (`pvp.css` L13: `grid-template-rows:auto auto minmax(0,1fr) auto auto`) onu panelin en alt satırına iter. Sahip isteği "yukarıda, okunaklı, iki oyuncuya da aynı" — mevcut yapıda iki ayrı `textarea` var, rakip tarafınki `disabled` + küçük placeholder ("Rakibin kelimesi · izleme modu", index.js L182). Resolve'da "panel alta insin, dövüş başlasın" geçişi hiç yok.
- **%80 yakınlaştırma tuzağı:** Brave'de %80 zoom → etkin viewport ~2400×1350 CSS px; `pvp.css` L33 `@media(max-height:820px)` ve L34 `@media(max-width:1500px)` kompakt kırılımları **tetiklenmez**. 9–10px etiketler (`.pvp2-typing-bottom` 9px, `.pvp2-identity small` 9px, `.pvp2-skill-copy small` 9px, `.pvp2-hero-tag` 10px) ve rounds-ui 12px baz yazılar (`.rui-word`, `[data-rounds-ui]`) fiziksel ~7–10 px'e küçülür. `min-width` tabanlı büyütme kırılımı projede hiç yok.
- **Prep arayüzü tamamen eksik:** `rounds-ui.js` yalnız `round/settling/intermission` bilir; skill/eşya kartı, `ARENA_MAX_USES=2` kalan-hak rozeti, kilit sayacı, rakip gizliliği ("???") için element yok. Lobilik tek emsal `.pvp22-rune-grid` (`network.js` L519) — kullanım hakkı göstermez.
- **Kelime şeridi 20 kelimeye çıkmaz:** `rounds-ui.js` L12 `ROUND_WORDS=10`, L256 `wordEls` 10 `<li>` üretir. Arena raundları `[5,10,15,15,15,20]` kelime; 11. kelimeden sonrası **hiç render edilmez**. 5→20 geçişinde şerit satır sayısı zıplar → panel konumu raundlar arası kayar (layout shift).
- **Saat kişiselleştirilemez:** `timerOf()` (rounds-ui.js L70–79) ortak `round.endsAt`'tan sayar; arena'da süre oyuncu başına (`remainingMs`) ve Karanlık Saat'te rakip süresi `null` → mevcut kod 0/boş basar; "rakip süresini görememe" görsel dili yok.
- **Hasar görsel dili eksik:** HUD'da `−%48` ceza göstergesi ve 4 hücreli kombo sayacı yok (`.rui-meter` 10 hücre + 3/5/7 çentik tur moduna özel, L17–18). `ARENA_ATTACK`'ların `ARENA_RESOLVE_STEP_MS=350` aralıklı sıralı gösterimi `fx-damage.js`/`arena3d.js` köküne bağlanmamış; Harf Kaosu / Donmuş An / Zaman Hırsızı'nın ayırt edilebilir kısa animasyonları yok.
- **Maç sonu karnesi arena'ya uymuyor:** `phase15-results.js` `resultCardHTML` (L19–23) Q/E/R atış + blok/parry sayar; arena için kombo/FİNAL vuruş, ceza ortalaması, skill kullanımı, final HP satırları gerekir. `renderRoundsResult` deseni (rounds-ui.js L450) genişletmeye hazır ama arena modeli yok.

### 2. İyileştirme önerileri (ne / neden / nasıl / emek / öncelik)

1. **Tek paylaşımlı yazma paneli + iniş** — Arena fazında yazma alanının üst-ortada tek kutu olması, resolve'da yumuşakça alta inmesi. Nasıl: `#pvp-root[data-mode="arena"]`'da `.pvp2-shell` satırları `auto auto auto minmax(0,1fr) auto` yapıp 3. satıra `[data-arena-typebox]` konur; `.arena-typebox{transition:transform .5s cubic-bezier(.16,1,.3,1),opacity .5s}`; resolve'da köke `.is-resolving` → panel `transform:translateY(min(42vh,420px))`, `opacity:.35`; `prefers-reduced-motion` ve `#pvp-root.pvp4-reduced`'da geçişsiz. Klasik moda hiçbir kural dokunmaz. Emek **M**, öncelik **1**.
2. **Prep kart ızgarası** — `arenaPrepHTML()`: 5 skill + 4 eşya kartı `.arena-prep-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}`; kart `.arena-card` (emoji, ad, tek satır etki, `aria-pressed`), sağ üst kalan-hak rozeti `.arena-uses` (`2/2`; `0/2`'de `.is-empty`+`disabled`); üst şerit `.arena-prep-head` = "RAUND 3/6 · SEÇİM · ⏱08 · RAKİP: ???" (kilit sayacı `network.serverNow()` tick'iyle); tıklama `network.send('ARENA_PICK',{skill,item})` → `.is-picked`, sunucu `ARENA_PICK_ACK` ile kalıcılaşır. Rakip seçimi istemcide hiç tutulmaz, yalnız `???` render edilir. Emek **M**, öncelik **1**.
3. **%80 zoom tipografi kırılımı** — `rounds-ui.css`/`pvp.css` sonuna `@media (min-width:2000px){[data-rounds-ui],[data-arena-ui]{font-size:15px}.rui-word{font:600 15px/1.4 var(--rui-mono)}.pvp2-typing-bottom{font-size:12px}.pvp2-identity small{font-size:11px}}` ve kritik boyutları `clamp(12px,.8vw,15px)`'e çevir (`.rui-secs` 22px yeterli). Neden: %80 zoom kırılımları ters tetikliyor; ~%25 büyüme okunaklığı geri getirir. Emek **S**, öncelik **1**.
4. **Harf Kaosu kurban görünümü** — Kurban karışık kelimeleri "ceza" sanmasın: `.rui-word.is-scrambled{border-color:#b77bff;color:#e4d6ff;letter-spacing:.08em}` + `::before{content:'🔀 '}`; kalıcı `.arena-debuff` çipi "HARF KAOSU · kelimeleri GÖRDÜĞÜN GİBİ yaz" (`aria-live:polite`, input `aria-describedby`); ilk aktiflikte 900 ms `.arena-debuff-pop`. Emek **S**, öncelik **2**.
5. **Karanlık Saat saat yüzü** — `.rui-medal.is-blind`: `.rui-secs` metni `--:--`, ring sabit yarım dolu (`stroke-dashoffset:50%`), `stroke:#6b5ca5`, `👁` ikonu; rakibin `roundDone` durumu görünür kalır. `timerOf()` yerine `arenaTimerOf()` kişisel `remainingMs` okur, `null`'da `{blind:true}` döner. Emek **S**, öncelik **2**.
6. **Zaman skill görselleri (Zamana Karşı)** — Donmuş An: `.rui-medal.is-freeze` (mevcut `.is-frozen` = duraklatma, rounds-ui.css L87; ayrı sınıf şart): `❄` çipi + `stroke:#9fd8ff` + 3 sn `rui-freeze-pulse`. Zaman Hırsızı: hedef saatte uçan kırmızı `.arena-timechip.is-theft` (`−5 sn`, `translate(-50%,-120%)→0` 600 ms). Zaman Hediyesi: altın `.arena-timechip.is-gift` (`+5 sn`). `fx24Reduc()` iken çipler anında belirip 800 ms kalır. Emek **M**, öncelik **2**.
7. **Kişisel saatler + kombo/ceza HUD'u + çözüm sırası** — Taraf kartlarına `.arena-sideclock` (kendi `remainingMs` her zaman; rakibinki Karanlık Saat'te `--:--`), madalyon raund kapanışını sayar. D/Y şeridi yanına `.arena-combo` (4 hücre; 4. hücre `.is-final` altın, FİNAL'de `rui-pulse`) ve `.arena-penalty` (`−%48`, `color:#ff8ea2`, `font-variant-numeric:tabular-nums`; 0'da gizli). `ARENA_ATTACK` paketleri gönderim sırasıyla 350 ms'lik kuyruktan `fx24.damage.handle()` + `arena3d.instance.handle()`'a akar; HP 0 → kalan vuruşlar kuyruktan düşer (index.js L317–376 deseni). Emek **M**, öncelik **1**.
8. **Kelime şeridini raunda ölçekle** — `arena-ui.js`'te `wordEls` raund başına `ARENA_ROUND_WORDS[i]` ile `replaceChildren`'la üretilir; 15+ kelimede `.rui-words.is-compact{font-size:11px;gap:3px 4px}` + şeride 2 satır `min-height` rezervi → raundlar arası zıplama ve layout shift kesilir. Emek **S**, öncelik **1**.
9. **Arena raund özeti** — `arenaSummaryModel()`: `.rui-summary` iskeleti (rounds-ui.js L329–342) korunur, satırlar → Doğru/Yanlış/Kombo vuruş/FİNAL vuruş/Ort. ceza/Hasar; KO'da `.rui-ko` + "kalan vuruşlar iptal edildi" dipnotu; altta "SIRADAKİ: RAUND 4 · 15 KELİME" önizlemesi (mevcut `.rui-sum-foot` yeri). Emek **M**, öncelik **2**.
10. **Maç sonu karnesi + lobi girişleri** — `phase15-results.js`'e `arenaResultModel` → `[data-arena-result]` bloğu (final HP, toplam hasar, en uzun kombo, toplam ceza, kullanılan skill/eşya dökümü), `renderRoundsResult` (L450) deseniyle `.pvp15-card` içine. Lobi: `networkConsoleHTML()` `.pvp24-practice-row` (network.js L498–503) yanına `<select data-practice-mode>` (Klasik/Tur/**Arena**/**Zamana Karşı**) + host oda modu için `data-lobby-action="mode"` segmenti; URL `?pvp=practice&mode=arena&bot=orta&char=fire` (§8.1). Emek **M**, öncelik **3**.

### 3. Prep ekranı yerleşim taslağı (raund öncesi · 10 sn)

```
┌──────────────────────────────────────────────────────────────────────┐
│ ⚔ TUŞLAB · ARENA    ♫  🔊  ✧  ◈3B        ◌ 12 ms     [Teslim Ol]     │ .pvp2-toolbar
├──────────────────────────────────────────────────────────────────────┤
│ ALEV ●4.850 HP   RAUND 3/6 · SEÇİM      RAKİP: ???    RÜN ●4.200 HP  │ .arena-prep-head
│ ▓▓▓▓▓▓▓▓▓░░           ⏱ 08 ────────────░                 ▓▓▓▓▓▓▓░░░░ │
├──────────────────────────────────────────────────────────────────────┤
│ ✦ BECERİ — 1 seç · maçta en fazla 2 kez                              │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│ │🔀 Harf   │ │⏰ Zaman  │ │🕜 Zaman  │ │❄ Donmuş  │ │🌑 Karanlk│     │
│ │  Kaosu   │ │ Hediyesi │ │ Hırsızı  │ │    An    │ │   Saat   │     │
│ │  [2/2]   │ │ [1/2] ✓  │ │  [2/2]   │ │ [0/2] ✕  │ │  [2/2]   │     │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘     │
│ ✧ EŞYA — 1 seç · 2 kez                      [ ⏻ SEÇİMİ KİLİTLE ]    │
│ [🔥 Kombo+] [🛡 Arınma] [🥊 Eldiven] [⚡ Kalkan]                      │
├──────────────────────────────────────────────────────────────────────┤
│          (yazma alanı kapalı: "Kelime seti hazırlanıyor…")           │
├──────────────────────────────────────────────────────────────────────┤
│            SİNEMATİK ARENA (CSS/3B) · VS madalyonu ortada            │
│  RAUND fazında [data-arena-typebox] üst-ortada çıkar; resolve'da     │
│  .is-resolving ile yumuşakça alta iner, hasarlar 350 ms'lik sırayla. │
└──────────────────────────────────────────────────────────────────────┘
```

### 4. Uygulama ajanına ilk 3 iş

1. **`pvp/arena-ui.js` + `pvp/arena-ui.css` oluştur** (rounds-ui deseni: yalnız anlık görüntü gösterir, skor yerelde hesaplanmaz): `createArenaUi(root,{now:()=>network.serverNow(),isReduced:fx24Reduced})` → `{update,handle,tick,destroy}`; saf modeller `arenaViewModel/arenaTimerOf/arenaSummaryModel`. `pvp/index.js`'te `roundsUiCreate()` (L112–117) yanına `arenaUiCreate()`; `pvp/network.js` `receive`'e `ARENA_*` paket kümesi (L9 `ROUND_PACKETS` deseni) + `tuslab:pvp-arena` olay dağıtımı. `index.html` L44 sonrasına `<link rel="stylesheet" href="./pvp/arena-ui.css">`. Test: `tests/pvp-arena-ui.test.mjs` (DOM bölümleri, kişisel kelime görünümü, süre gizleme — spec §9).
2. **`pvp/index.js` yazma panelini tekilleştir** (arena koşullu): `screen()`/`playerHTML()` arena'da iki `.pvp2-typebox` yerine kabuğun 3. satırında tek `[data-arena-typebox]` (öneri 1); `.pvp2-side` satırları `auto auto minmax(0,1fr) auto`; `textUpdate()` (L166) arena'da tek paneli günceller; `roundInputLock` yanına `arenaInputLock` (kilit nedenleri: "Seçim yapılıyor" / "Hasarlar çözülüyor" / "Raund özeti").
3. **`pvp/network.js` + `pvp/practice.js` lobi/bot:** `.pvp24-practice-row`'a `data-practice-mode` seçicisi, host oda modu segmenti, `ARENA_PICK`/`ARENA_PREP_START`/`ARENA_ROUND_START`/`ARENA_ATTACK` yönlendirmesi; `practice.js` botu prep fazında elindeki skill/eşyalardan rastgele seçer, `?pvp=practice&mode=arena&bot=…` açılır (§8.1).

## Ajan 1 — Arena motoru (Codex, 04:35)


### Yapılanlar

- `pvp/shared/arena.js`: Altı raundluk saf geçiş motoru, 5000 kalıcı HP, hazırlık/yazma/vuruş/özet/bitiş fazları, kişisel süreler, skill ve eşya seçimleri, kelime güvenliği, sıralı hasar ve KO.
- `tests/pvp-arena-engine.test.mjs`: 10 deterministik senaryo; fazlar, güvenlik, ilk bitiren, uzatma, süre becerileri, gizlilik, karıştırma, vuruş sırası, KO, altı raund, eşitlik ve teslim.
- `cloudflare/src/match.js` değiştirilmedi. Eski `pvp-practice` testi ihracat listesini birebir sabitlediğinden isteğe bağlı Arena re-export'u eklenmedi; online entegrasyon bunu kendi testini güncelleyerek yapmalı.

### API

```js
createArenaMatch(players, at = Date.now(), id = crypto.randomUUID(), {seed?, pickWords?} = {}) â†’ match
submitArenaPick(match, {playerId, skill?, item?}, at = Date.now()) â†’ {match, result} | {error}
submitArenaWord(match, {playerId, matchId, wordIndex, text, round?}, at = Date.now()) â†’ {match, result} | {error, expectedIndex?, round?}
advanceArenaMatch(match, at = Date.now(), rng = Math.random) â†’ {match, events, roundEvents}
nextArenaDeadline(match) â†’ number | null
arenaPublicMatch(match, viewerSeat) â†’ snapshot | null
arenaMatchResult(match) â†’ result | null
surrenderArenaMatch(match, loserSeat, at = Date.now()) â†’ match
```

`submitArenaPick` sonucu `{type:'ARENA_PICK_ACK',seat,skill,item}` yalnızca seçen oyuncuya gönderilmelidir. `submitArenaWord` sonucu `{accepted:true,matchId,wordIndex,expected,submitted,correct,round,roundWordIndex,roundDone,correctWords,wrongWords,combo,wpm,accuracy}` yalnızca gönderen oyuncuya gönderilmelidir.

### Olay yükleri

`roundEvents` öğeleri `{type,payload,sequence}` biçimindedir. Kişisel başlangıç olayına ayrıca hedef `seat` alanı eklenir.

| Olay | Tam `payload` alanları |
|---|---|
| `ARENA_PREP_START` | `{round,endsAt}` |
| `ARENA_ROUND_START` | `{round,totalRounds,words,endsAt}`; `roundEvents` öğesindeki `seat` hedef oyuncudur, kelimeler ve bitiş zamanı kişiseldir |
| `ARENA_ROUND_END` | `{round,scores,roundsWon}`; `scores` öğeleri `{seat,correct,wrong,bestStreak,damageDealt,hpLeft}` |
| `ARENA_MATCH_END` | `{result}` |

`events` içindeki `ARENA_ATTACK` nesnesi `{id,type,fromSeat,toSeat,wordIndex,amount,multiplier,penalty,tags,hpAfter}` alanlarını taşır. `ARENA_PREP_START` ilk maç oluşturulurken `combatEvents` içine de kaydedilir. `ARENA_MATCH_END` hem `roundEvents` hem `combatEvents` içindedir. `combatEvents` son 24 olayı tutar.

### Şartnameden ayrılan noktalar ve gerekçeler

- `arena-skills.js` rapor anında `scrambleWordsFor`, `scrambleSeed`, `ARENA_ITEM_IDS` ve kullanım hakkı yardımcılarını ihraç etmiyordu. Motor, `scrambleWord` + `createRng` ile yerel deterministik karıştırma ve mevcut kataloglardan kullanım hakkı hesabı yapar. Sayısal seed için `seed + roundIndex + wordIndex` kullanılır.
- `ARENA_ROUND_START` ortak yayında kişisel kelimeleri sızdırmamak için her koltuğa ayrı olay olarak üretilir. Sunucu `seat` alanına göre tek bağlantıya göndermelidir.
- `ARENA_ROUND_END` yazma fazı kapanınca üretilir; `scores.damageDealt` bu anda henüz uygulanmamış raund hasarını içermez. Nihai hasar ve kazanan raund özeti `roundHistory` ve maç sonucunda bulunur.
- `arenaPublicMatch` saf kalmak için kalan süreyi maç durumundaki son motor saati (`clockAt`) üzerinden verir. Sunucu düzenli anlık geri sayım için gelen `serverTime` ile istemcide sayacı ilerletmelidir.

### Doğrulama

Son tam koşuda `node --test tests/*.test.mjs`: **376/376 geçti**. Motorun 10 testi geçti. `npm run cf:build` ve `cf:validate` çalıştırılmadı (görev kısıtı).

> Denetçi notu (Claude): 376/376 test bağımsız olarak doğrulandı. Motor, beceri modülünün eksik yardımcıları için yerel karıştırma kullanıyor; Ajan 3 bitince sadeleştirilecek.

## Ajan 2 — Arena hasar modülü (GLM 5.3 / OpenCode Go, 04:35)

> GLM ajanı kodu ve testleri bitirdi, rapor yazarken "Go kullanım sınırı" ile kesildi. Bu bölümü denetçi (Claude) ajanın çıktısını doğrulayarak yazdı.

- **Ne yaptım:** `pvp/shared/arena-damage.js` — şartname §5'in tamamı: yanlış çarpanları (0.10 / 0.15 / 0.23 / 0.30, toplamsal, tavan 0.75), en fazla 4'lü kombo (4. doğru ×1.5, 5. ve sonrası FİNAL ×2.0), eşyalar (Kombo Yükselteci ×1.75/×2.4, Arınma Taşı ceza yok, Ağır Eldiven +%20 taban, Çelik Kalkan −%20 alınan), `resolveRoundAttacks` ile raund sonu vuruş listesi.
- **Dosyalar:** `pvp/shared/arena-damage.js` (yeni), `tests/pvp-arena-damage.test.mjs` (25 test).
- **API:** `wrongPenalty`, `comboMultiplier`, `wordDamage`, `defenderReduction`, `resolveRoundAttacks({roundIndex, attempts, item, defenderItem})`, sabitler `ARENA_WRONG_FACTORS, ARENA_PENALTY_CAP, ARENA_COMBO_RULES, ARENA_ROUND_BASE_DAMAGE, ARENA_ITEMS, ARENA_ITEM_IDS`.
- **Sahibin örneği doğrulandı:** `D Y Y Y D` (1. raund) → vuruşlar `[100, 52]` (5. kelime ×0.52).
- **Hasar tablosu (raund başına toplam, eşyasız; %80/%60 = 200 rastgele raund ortalaması):**

| Raund | Kelime | Kusursuz | %80 doğru | %60 doğru |
|---|---|---|---|---|
| 1 | 5 | 650 | 449 | 285 |
| 2 | 10 | 1485 | 899 | 561 |
| 3–5 | 15 | 2120 | 1267 | 758 |
| 6 | 20 | 2738 | 1621 | 971 |

- **Denge yorumu (5000 HP):** kusursuz oyuncu 3. raundda (650+1485+2120 = 4255) değil 4. raundda KO eder; %80 doğrulukla 5. raundda KO; %60 doğrulukla 6 raund biter, kalan HP kazananı belirler. Şartnamenin "tipik maç 4–6 raund" hedefiyle uyumlu.
- **Test sonucu:** arena hasar + motor testleri 35/35 geçti (tüm paket 376/376, denetçi koşusu).
- **Eksikler:** yok; denge sayıları canlı oyunda ayarlanabilir.

## Ajan 5 — Arena çevrimiçi oda (Codex, 04:41)

### Ne yaptım
- Durable Object odasına Arena modu, hazırlık seçimi, kelime gönderimi, alarm geçişleri, kişisel görüntü ve kişisel raund başlangıcı ekledim.
- Yeniden bağlanmada koltuğa özel anlık görüntü; teslimde Arena sonucu; rövanşta aynı modla yeni maç ve kelimeler sağladım. Klasik ve tur akışları korundu.

### Dosyalar
- `cloudflare/src/room.js`, `cloudflare/src/match.js`, `pvp/contracts.js`, `tests/pvp-arena-online.test.mjs`.

### Protokol (uygulandığı biçimiyle)
- `MATCH_CONFIG {mode:'arena'|'classic'}` veya `{mode:'rounds',rounds}`; eski `{rounds}` de geçerli. `ROOM_STATE.summary.mode` oda modunu bildirir.
- `ARENA_PICK {skill,item}` yalnız hazırlıkta işlenir; `ARENA_PICK_ACK` yalnız seçene, hatalar yalnız gönderene gider. `WORD_SUBMIT` Arena maçında `submitArenaWord` kullanır.
- Maç içeren her Arena paketi koltuğa özel `arenaPublicMatch(match,seat)` taşır. `ARENA_ROUND_START` hedef koltuğa, `ARENA_ATTACK` iki tarafa gider. Alarm `nextArenaDeadline` ve `advanceArenaMatch` kullanır.

### Test sonucu
- `node --test tests/*.test.mjs`: 381 test, 379 geçti, 2 başarısız. Mevcut klasik/tur oda testleri geçti. `cf:build` ve `cf:validate` çalıştırılmadı.

### Eksikler
- `pvp/shared/arena.js` içindeki `arenaPublicMatch` satır 233, `blindclock` gizlemesini `me.roundSkill` üzerinden yapıyor. Şartnameye göre gizleme beceriyi seçenin rakibinde olmalı; bu yüzden yeni çevrimiçi testte mağdurun saati gizlenmiyor. Motor dosyası görev kapsamım dışında.
- `tests/pvp-practice.test.mjs` satır 58–59, Worker ihracat adlarını eski listeyle birebir karşılaştırıyor ve her ihracatı `pvp/shared/match.js` ile eşitliyor. Yeni Arena re-export'ları ayrı `arena.js` modülünden geldiğinden yalnız `ORIGINAL_EXPORTS` listesini değiştirmek bu testi düzeltemiyor. İzin verilen değişiklik sınırını korudum.

## Ajan 4b — Arena bot antrenmanı (Codex, 04:42)

- **Ne yaptım:** `mode:'arena'` için çevrimdışı altı raundluk antrenman akışı, kişisel Arena görüntüsü, hazırlık seçimi, insan kelime gönderimi, sıralı vuruşlar, teslim ve yeni tohumlu rövanş ekledim. Classic ve rounds akışını korudum.
- **Dosyalar:** `pvp/practice.js`; yeni `tests/pvp-practice-arena.test.mjs`.
- **Paket sırası:** `MATCH_START` → `ARENA_PREP_START` → kişisel `ARENA_ROUND_START` → insanın `WORD_RESULT` olayları → `ARENA_ROUND_END` → artan kimlikli `ARENA_ATTACK` olayları → sonraki hazırlık veya `ARENA_MATCH_END` → `MATCH_END`. Her çevrimdışı pakette insan koltuğunun `arenaPublicMatch` görüntüsü ve `serverTime` var. `ARENA_PICK_ACK` yalnız insanın seçimine gönderiliyor.
- **Bot zamanlamaları:** Hazırlıkta 350–1000 ms sonra hakkı kalan rastgele skill/eşya (bazen boş); yazmada raund tepkisi sonrası Kolay/Orta/Zor yaklaşık 25/45/70 WPM, jitter ve %10/%6/%3 yazım yanlışı. Hazırlık, çözüm ve özette yazmıyor; `dispose()` bütün zamanlayıcıları temizliyor.
- **Test sonucu:** Yeni 5/5 Arena antrenman testi geçti. `node --test tests/*.test.mjs`: 386 test, 384 geçti, 2 başka dosyaya ait hata kaldı.
- **Eksikler:** `tests/pvp-arena-online.test.mjs` kör saat testinde `remainingMs` için `null` beklerken `30000` alıyor (sunucu alanı). `tests/pvp-practice.test.mjs` eski `cloudflare/src/match.js` ihracat listesini sabitliyor; sunucu ajanının Arena re-export eklemesiyle uyuşmuyor. Bu dosyalar görev alanım dışında.

## Denetçi (Claude) — Dalga A/B entegrasyon denetimi (04:50)
- **Karanlık Saat hatası (Ajan 1 motoru, Ajan 5 bulgusu):** `arenaPublicMatch` süreyi beceriyi SEÇENDEN gizliyordu. Düzeltildi: rakibi Karanlık Saat seçtiyse KURBAN o raund hem kendi (`me.remainingMs=null`, `me.blindClock=true`) hem rakibin süresini göremez; seçen taraf her şeyi görür. Motor testi buna göre güncellendi.
- **Yeniden bağlanma hatası (Ajan 5, `cloudflare/src/room.js:142`):** yeniden bağlanan oyuncunun kişisel görüntüsü eski oturumun koltuğuyla (`session.seat`) kuruluyordu → kendi kelimeleri boş geliyordu. `player.seat` ile düzeltildi.
- **İhracat testi (`tests/pvp-practice.test.mjs`):** birebir liste eşleşmesi yerine "eski ihracatların hepsi var + ek ihracatlar yalnızca Arena" kuralına çevrildi.
- **GLM kaynakları:** Evren anahtarı bu ortamda tanımlı değil; OpenCode Go ve OpenCode Console hesaplarının kotası/bakiyesi bitti. Ağır işler Codex'e, hafif işler ücretsiz `glm-5.3-flash-free` modeline verildi.
- **Doğrulama:** `node --test tests/*.test.mjs` → **386/386 geçti**.

## Raund Denetçisi 3 — Protokol tutarlılığı (Codex)

- **Kritik — Arena istemci akışı bağlı değil.** "'`pvp/network.js:9,177-184,295-300`, `pvp/index.js:174,405-420`, `pvp/shared/arena.js:235-247`. Senaryo: insan koltuğu Arena raunduna girip kelime yazıyor. İstemci yalnız `ROUND_*` olaylarını ayrı işler; `ARENA_PICK_ACK/ARENA_ROUND_START/ARENA_ROUND_END/ARENA_ATTACK/ARENA_MATCH_END` için dal yok ve denetim anında `pvp/arena-ui.js` bulunmadı. Mevcut yazma ekranı `players[].currentWord` okuyor; iki üreticinin ortak `arenaPublicMatch` görüntüsündeki `players[]` bu alanı göndermiyor. `wordLength=0` olduğu için yazılan kelime kesilir; `network.submitWord` Arena için `round` alanını da yollamıyor (motor opsiyonel kabul ediyor). Betik kanıtı: her iki akışta `ARENA_ROUND_START` ve 5 kabul edilmiş `WORD_RESULT` var, fakat `players[].currentWord` yok; hedef testler 10/10 geçerken UI entegrasyonu kapsam dışı. **Düzeltme:** `network.js` Arena olaylarını yönlendirip kişisel `match.round.words[match.me.roundWordIndex]` üzerinden hedef kelimeyi ve faz kilidini kullansın; `arena-ui.js` bağlansın; Arena kelime gönderimine raund eklensin.
- **Yüksek — Karanlık Saat bitiş zamanlarıyla açığa çıkıyor.** `pvp/shared/arena.js:95-96,240-244`. Senaryo: rakip `blindclock` seçmiş. Betik çıktısı: `blindVictim {meRemainingMs:null,opponentRemainingMs:null,matchEndsAt:31100,roundEndsAt:31100,startPayloadEndsAt:31100}`. `remainingMs` gizli olsa da `ARENA_ROUND_START.payload.endsAt`, `match.endsAt` ve `match.round.endsAt` gerçek zamanı bildiriyor; istemci bunlardan geri sayabilir. **Düzeltme:** mağdurun kişisel paketinde ve görüntüsünde bu mutlak son zamanlarını gizleyin veya yalnız kamuya açık, süreyi çıkarmaya elvermeyen faz bilgisi gönderin; kör saat testine alan sızıntısı kontrolü ekleyin.
- **Orta — Vuruş ve rövanş paket zarfı offline/online farklı.** `pvp/practice.js:321-328,386-388,461-471`, `cloudflare/src/room.js:20-25,265,223-234`. Aynı insan koltuğunun tam maç ve rövanş betiğinde offline `ARENA_ATTACK` alanları `event,match,serverTime`, üst alanları `eventId,matchId,sequence`; online yalnız `event` ve üstte `serverTime`. Offline `REMATCH_STATUS/COUNTDOWN` da `match` ve kimlik alanları taşıyor, online yalnız `votes,startAt`. Her iki tarafta üst `serverTime` var; online vuruş/rövanşta `payload.serverTime` yok. **Düzeltme:** paket sözleşmesinde ortak zarfı seçip iki üreticiye uygulayın; vuruş için `event.id` tabanlı dedupe açıkça tanımlansın.
- **Orta — Offline rövanş durumunda aynı `eventId` yeniden kullanılıyor.** `pvp/practice.js:324-327,343-349,463-471`. Betik: `offline eventIds 164 unique 163 duplicates ["off-1:109:REMATCH_STATUS"]`; online `57 unique 57` (maç olayları), online rövanşta ise `eventId` yok. Aynı `sequence` ile iki farklı oy durumu gönderildiğinden olay kimliğiyle dedupe yapan tüketici ikinci durumu kaybedebilir. **Düzeltme:** rövanş durumuna ayrı artan sayaç/oy revizyonu verin veya zarfı kimliksiz online sözleşmesiyle eşitleyin.
- **Düşük — Temel olay alanları/sırası ve kişisel gizlilik uyumlu.** `pvp/practice.js:320-328,384-395,435-443`, `cloudflare/src/room.js:68-72,263-268,350-357`. Betikte iki tarafta da `MATCH_START → ARENA_PREP_START → ARENA_PICK_ACK → ARENA_ROUND_START → WORD_RESULT×5 → ARENA_ROUND_END → ARENA_ATTACK → ARENA_MATCH_END → MATCH_END → REMATCH_* → MATCH_START` izlendi; `WORD_RESULT` alan adları birebir aynı, tüm paketlerde üst `serverTime` var. Hazırlık görüntüsünde `round.words=[]`, rakibin seçimi ve kelimesi yok; `tests/pvp-arena-online.test.mjs` karışık kelime ve kör saat kişisel görüntüsünü doğruluyor. Vuruş sayısı botun davranışı nedeniyle farklı (offline 39, online 5); bu protokol sırası farkı değil. Son kontrolde `node --test tests/pvp-arena-online.test.mjs tests/pvp-practice-arena.test.mjs` → 10/10 geçti.

## Ajan 6 — Zamana Karşı süre becerileri (Codex, 04:51)

### Ne yaptım
Zamana Karşı raundlarının 5 saniyelik arasında kişi başına tek beceri seçimi ekledim. Seçim raund başlayana dek rakibe açıklanmıyor; kişisel bitiş zamanları, son çağrı ve kör saat görüntüsü motor, oda sunucusu ve çevrimdışı botta aynı kurallarla işliyor. İlk raund hemen başladığı için beceri seçimi ikinci raunddan itibaren mümkün.

### Dosyalar
`pvp/shared/match.js`, `cloudflare/src/room.js`, `pvp/contracts.js`, `pvp/practice.js`, `tests/pvp-time-skills.test.mjs`, `tests/pvp-rounds-engine.test.mjs`. Son testteki tek mevcut test değişikliği, `ROUND_START.skills` zorunlu alanını beklenen pakete eklemekti. `cloudflare/src/match.js` ihracatları korunuyor; oda yeni motor fonksiyonunu doğrudan ortak modülden alıyor.

### Kurallar
| Beceri kimliği | Etki | Sınır |
| --- | --- | --- |
| `timethief` | Rakibin kişisel süresinden 5 saniye düşer. | Maçta 2 kullanım |
| `blindclock` | Etkin raundda kurbanın kendi ve rakibinin saatlerini gizler. | Maçta 2 kullanım |
| `freeze` | Seçenin kişisel süresine 3 saniye ekler. | Maçta 2 kullanım |
| `null` | Beceri kullanmadan o raundun seçimini kilitler. | Hak tüketmez |

Her oyuncu bir arada bir kez seçim yapabilir; seçim değiştirilmez. İki beceri aynı anda uygulanır: iki `timethief` iki tarafı da 25 saniyeye indirir; `timethief` ile rakibin `freeze` seçimi birleşince rakip 28 saniye alır. İlk 10 kelimeyi bitiren, bitirmeyen oyuncunun kalan süresini en fazla 5 saniyeye indirir; önceden daha kısa olan süre uzamaz. Raund iki kişisel süre de dolduğunda veya iki taraf da bitirdiğinde kapanır. Süre sabitleri ve kullanım sınırı `arena-skills.js` üzerinden alınır.

### Protokol: mesajlar ve snapshot alanları
- İstemci yalnızca ara fazda `ROUND_SKILL_PICK` ile `{skill:'timethief'|'blindclock'|'freeze'|null}` gönderir. Başarılı seçim yalnızca gönderen oyuncuya `ROUND_SKILL_ACK` döner: `{seat,skill,round,usesLeft,match,serverTime}`. `usesLeft` üç beceri kimliğinden kalan hak sayısını taşır. Geçersiz seçim `ERROR.code` ile döner (`INVALID_ROUND_SKILL`, `ROUND_SKILL_NOT_INTERMISSION`, `ROUND_SKILL_LOCKED`, `ROUND_SKILL_EXHAUSTED`).
- `ROUND_START.payload.skills` tam olarak `{1:id|null,2:id|null}` biçimindedir. `ROUND_START.payload.endsAt` genel raund bitişidir; `match.round.personalEndsAt` koltuk numarasından kişisel mutlak bitiş zamanına giden haritadır. Oyuncu satırlarında `players[].roundEndsAt` bulunur. `ROUND_LAST_CALL.payload.endsAt` yeni genel bitişi taşır.
- Kişisel `match` görüntüsünde `round.skills`, `round.personalEndsAt`, `blindClock`, `roundSkillUsesLeft`, `roundSkillPick`, `roundSkillPickLocked` alanları vardır. Ara fazda `roundSkillPick` ve kilit yalnızca görüntünün sahibinin seçimidir; rakibin seçimi `round.skills` içine raund başlayınca girer. Koltuk verilmeyen `publicMatch(match)` eski alan yapısını korur.
- Kör saat kurbanında etkin raund boyunca `match.blindClock=true`; `match.endsAt`, `match.round.startedAt`, `match.round.endsAt`, `match.round.personalEndsAt`, iki `players[].roundEndsAt` ve `ROUND_START` paketinin `startedAt`/`endsAt` alanları `null` olur. Sunucu bütün round snapshotlarını koltuğa göre gönderir; klasik mod akışı aynı kalır. Bot insan koltuğunun görüntüsünü ve aynı `ROUND_*` paketlerini üretir. Botun beceri seçme olasılığı kolay/orta/zorda sırasıyla %20/%45/%70'tir.

### Test sonucu
`node --test tests/pvp-time-skills.test.mjs`: 7/7 geçti. İlgili round, oda, pratik ve yeniden bağlanma testleri geçti. Son `node --test tests/*.test.mjs` koşusunda 405 testin 398'i geçti; kalan 7 hata eşzamanlı değiştirilen UI/perf alanındaki `pvp-arena-ui.test.mjs` (1) ve `pvp-fx-particles.test.mjs` (6) dosyalarında. Önceki tam koşuda 404 testin 403'ü geçmişti ve tek hata Arena UI bağlantı testiydi.

### Eksikler
Bu iş paketinde UI dosyalarına dokunulmadı. UI ajanı `ROUND_SKILL_PICK` seçicisini ve `ROUND_START.skills`, `match.round.personalEndsAt`, `match.blindClock`, `match.roundSkillUsesLeft` alanlarının gösterimini bağlamalı. Diğer ajanların eşzamanlı UI/perf değişiklikleri tamamlanınca tam test takımı yeniden çalıştırılmalı.

## Denetçi (Claude) — Raund Denetçisi 3 bulgularının düzeltilmesi (05:05)
- **Yüksek — Karanlık Saat bitiş zamanı sızıntısı:** düzeltildi. Kurbanın kişisel `ARENA_ROUND_START` paketinde `endsAt=null` ve `blindClock=true`; görüntüsünde `endsAt` ve `round.endsAt` de `null`. Testle korunuyor (`tests/pvp-arena-engine.test.mjs`).
- **Orta — Bot rövanşında yinelenen `eventId`:** `pvp/practice.js` artık her `REMATCH_*` paketine `:v<n>` revizyonu ekliyor (klasik/tur ve arena oturumları).
- **Kritik — İstemci arena olaylarını işlemiyor:** arayüz ajanı (Ajan 4a) bu işi yapıyordu; bulgular ona iletildi (hedef kelime `match.round.words[match.me.roundWordIndex]`, gönderimde `round`, arena paketlerinin yönlendirilmesi).
- Doğrulama: 405 testten 404'ü geçiyordu; kalan 1 test Ajan 4a'nın henüz bitmemiş bağlantı testiydi (Ajan 4a bitince 416/416).
> Not: bu bölüm 05:05'te yazılmış, dosya 05:10 civarında üzerine yazılınca kaybolmuştu; denetçi tarafından kendi kaydından geri kondu.

## Raund Denetçisi 1 — İsteklere uygunluk (GLM)

*(8 Kasım 2026 ~04:55 · Bu bir DENETİM görevidir: hiçbir kaynak/test dosyasına dokunulmadı. Kontrol betiği `%TEMP%\opencode\denetci1\sim.mjs` içinde yazıldı ve orada çalıştırıldı; modüller `pvp/shared/arena.js`, `arena-damage.js`, `arena-skills.js`, `pvp/practice.js` mutlak yolla import edildi. Sahibin kelimesi kelimesine isteği `docs/KULLANICI-ISTEKLERI-ARENA.md` esas alındı.)*

### 1. Yöntem

- Sahibin isteği cümle cümle maddeye çevrildi (12 madde) ve her biri için kod karşılığı arandı: `pvp/shared/arena.js`, `pvp/shared/arena-damage.js`, `pvp/shared/arena-skills.js`, `pvp/practice.js` (arena akışı 308–483), `pvp/arena-ui.js`, `pvp/typing-top.css`, `pvp/index.js` (arena entegrasyonu 121–135, 186–202, 342, 646–649).
- En az 3 madde **motor üzeri gerçek simülasyonla** doğrulandı (`createArenaMatch → submitArenaPick → submitArenaWord → advanceArenaMatch` zinciri; deterministik tohum). Toplam 11 senaryo koşuldu; tamamı aşağıda ayrı ayrı kanıtlanmıştır.
- Test durumu (bu denetim sırasında, saat ~04:55): `node --test tests/*.test.mjs` → **405/405 geçti** (önceki denetçinin 386/386 kaydından sonra Ajan 4a UI dosyaları ve testleri eklenmiş).

### 2. Madde madde uygunluk tablosu

| # | Sahibin isteği (kelimesi) | Durum | Kanıt |
|---|---|---|---|
| 1 | "raund raund olucak ilk round 5 tane kelime ... ikinci raund 10 kelime sonra 15 sonra 15 sonra 15 ... son raund 20" | KARŞILANDI | `arena.js:6` `ARENA_ROUND_WORDS=[5,10,15,15,15,20]`; motor simülasyonu: `roundPlan uzunlukları = 5,10,15,15,15,20 \| toplam = 80, tekrarsız`. 6 raundun uzunluk/zorluk kuralları da `arena.js:14-16` (§2 tablosuyla birebir). |
| 2 | "5 tane kelimeyi ilk kim yazarsa raund biter sonra kimler ne kadar doğru yazmış o kontrol edilir" | KARŞILANDI | `submitArenaWord` ilk bitirende `finishedSeat` atar, rakibin kişisel bitişi bitirenAnı'na kırpılır (`arena.js:156-165`); raund sonra `resolve` fazında kelime kelime değerlendirilir (`closeTyping`, `arena.js:101-117`). Sim: A 5 kelimeyi 640 ms'de bitirdi → `round.endsAt === A.bitirenAnı: true`; overtime'sız rakip gönderimi `RED ROUND_NOT_ACTIVE`. |
| 3 | "kartebi doğruysa ona göre hasar ... yanlış çarpanı 0.1, 0.15, 0.23 ... ve 5. nin hasarı bu oranda düşer" | KARŞILANDI | `arena-damage.js:20` `ARENA_WRONG_FACTORS=[0.10,0.15,0.23,0.30]`. Motor simülasyonu 1. raund: gönderim `D Y Y Y D` → vuruşlar **`k0: 100 (tam)`, `k4: 52 (pen 0.48 = 0.10+0.15+0.23)`** — sahibin örneği birebir. `D Y D` → `k2: 90 (pen 0.1)`. Ardışık yanlış tavanı: `wrongPenalty(5)=0.75` → hasar 25 (en az %25), `resolveRoundAttacks` aynı motor yoluyla `k6: 25 (pen 0.75)`. |
| 4 | "maks kombo hasarı 4 tane ard arda ... sonda da çarpan olsun ... 4 tane lik kombo vurulsun 5. de çarpanlı bir hasar versin" | KARŞILANDI | `arena-damage.js:27-34` `comboAt:4, finalAt:5`. Motor simülasyonu: `D D D D D` → **100, 100, 100, 150 (KOMBO ×1.5), 200 (FİNAL ×2.0)**; `comboMultiplier(6)=2` (sayaç 4'te taşmıyor, FİNAL sürüyor). |
| 5 | "hasarlar verilmeden önce eşyalar olsun: kombolar daha fazla vur, üst üste yanlış yaparsan azaltma katmanını kaldır" | KARŞILANDI | Eşyalar prep fazında seçilir, o raund hasarına,yansır (`arena.js:62-75` + `arena-damage.js:40-57`). Sim: **combostone** → 175 (KOMBO ×1.75) / 240 (FİNAL ×2.4); **cleanse** → `D Y Y D` → 100, 100 (pen 0, `[ARINMA]` etiketi). Ek olarak gauntlet (+%20 taban) ve aegis (−%20 alınan) spec'li ekstra. |
| 6 | "raunda başlamadan skiller: rakibin yazmasını engellecek (karpuz→zurpak, onu yazmak zorunda)" | KARŞILANDI | `scramble` skill'i (`arena-skills.js:28-33`); yalnız kurbanın `roundWords`'ü gerçek anagramla değişir (`arena.js:84-86`). Motor simülasyonu: A'ya `perde` → B görür **`eerdp`** (anagram: true, farklı: true); B **orijinali yazınca YANLIŞ**, karışık halini yazınca DOĞRU; kaos kuran A orijinali yazıp `true` aldı. |
| 7 | "raund başlamadan öncekli skiller ekstra süre: karşı taraf bitirse normalde raund biter ama ona 5 saniye daha eklensin" | KARŞILANDI | `overtime` (`arena-skills.js:34-39`), motor uygulaması `arena.js:158-164`. Sim: A 640 ms'de bitirdi → B'nin kişisel bitişi **bitirenAnı + 5 s;** B bitirenAnı+300 ms'de yeni gönderim kabul edildi (EVET). Negatif kontrol: overtime'sız aynı senaryoda `RED ROUND_NOT_ACTIVE`. |
| 8 | "Kelimeler hep aynı olmasın; iki tarafa aynı kelimeler verilsin" | KARŞILANDI | Maç başına tek plan, iki katılımcı aynı `roundPlan`'ı alır (`arena.js:27-38, 84`). Sim: tohum 888'de iki oyuncunun `roundWords` bire bir EŞİT; farklı tohumlar (999 vs 998) → **0/80 örtüşme** (ilk kelimeler 'örnek' vs 'hediye'). Tek istisna Harf Kaosu (sahibin kendi istediği bozma; belgelidir). |
| 9 | "yazma ekranı da düzenlensin, sayfada güzel bi yerde dursun, sonra alta insin fightlar başlasın" | KARŞILANDI (bu oturumda tamamlandı) | **Önemli zaman çizgisi:** denetimin başında `pvp/arena-ui.js`/`.css` **yoktu** (glob kanıtlı; önceki rapor satır 23'te de var). Bu oturumun başında Ajan 4a teslim etti: `pvp/arena-ui.js` (650 satır), `pvp/arena-ui.css`, `pvp/typing-top.css` (131 satır). Yazma paneli **üst-orta** (`typing-top.css:11-20` "ÜST YAZMA PANELİ", `#pvp-root .pvp2-shell` 5-satırlı ızgara); `resolve|summary` fazında `transform:translateY(var(--tt-drop))` ile **alta iner** (`typing-top.css:59`, hesap `index.js:186-202` `typeTopDrop()`), `prefers-reduced-motion` desteği (typing-top.css:61). Dövüş `ARENA_ATTACK` olayları `fx-damage.js` + arena-ui combatActions ile `resolve` adımlarında oynar (`index.js:342, 646-649` entegrasyonu). `tests/pvp-arena-ui.test.mjs` 12/12; paket 405/405. |
| 10 | "arena zamana karşı olsun, 30 saniyede kim ne kadar yazarsa ... karşısındakinden eksi 5 sn siler / zamanı göremesin / kendi zamanını dondurursun" | KARŞILANDI (arena içinde) | 30 sn kişisel süre: `ARENA_ROUND_DURATION_MS=30_000` (`arena.js:9`), kişisel bitiş hesabı `startRound` (`arena.js:81-92`). Sim: **timethief** kurban 25 sn; **freeze** +3 sn (frozen pencere 3 sn); **blindclock** kurbanın GÖRÜNTÜSÜNDE kendi ve rakip süresi `null`, seçen taraf iki süreyi de görüyor. |
| 11 | (aynı cümlenin diğer yarısı) skilleri bağımsız "Zamana Karşı" moduna da entegre et | **KISMEN** | Are.skiller (−5 sn silme, saat gizleme, dondurma) **yalnız arena modunda** var; bağımsız Zamana Karşı (solo/klasik) akışında hiçbiri yok (taranan `pvp/*.js` içinde zaman skilleri sadece `arena-ui.js:26-28` kataloğunda). Bekleyen iş, `docs/KULLANICI-ISTEKLERI-ARENA.md:21`'de zaten kayıtlı: "Zamana Karşı modu olarak yeni skillerle genişletilecek". |
| 12 | "her göreve bir ajan baksın ve onları denetleyen bir ajan olsun ve skiller kullanın" (organizasyon) | KARŞILANDI | `docs/AJAN-RAPORLARI.md`'de Ajan 1 (motor), Ajan 2 (hasar), Ajan 3 (skill), Ajan 4a/b (UI/bot), Ajan 5 (online) + denetçi kayıtları; bot da skill/eşya kullanıyor (`practice.js:355-364` `botPick`). Bu dosya o denetimin (Raund Denetçisi 1) çıktısıdır. |

### 3. Bulgular (önem sırasıyla)

**KRİTİK:** yok. Temel isteklerin tamamı kodlanmış ve 9'u gerçek motor simülasyonuyla doğrulanmış durumda; test paketi 405/405.

**YÜKSEK:** yok.

**ORTA-1 — Bağımsız "Zamana Karşı" moduna skill entegrasyonu eksik.**
- Dosya/kanıt: `pvp/shared/*arena*.js` zaman skillerleri yalnız arena; `tests/pvp-arena.test.mjs` en bağımsız zamana karşı akışlarda blindclock/freeze/timethief yok (tarama: zaman skill kodları yalnız `arena-ui.js:26-28` + `arena-skills.js` ikonları).
- Senaryo: sahibin 3. paragrafı "arena zamana karşı olsun ... bu sistemi ona entegre et, mesela onda da karşısındakinden eksi 5 sn siler / zamanı göremesin / kendi zamanını dondurursun". Arena modu bu üçünü kişisel süreyle tam uygularken, sahibin ayrıca oynadığı bağımsız Zamana Karşı modu (önceki istek `docs/TUR-SISTEMI.md`) bu skillerden yine yararlanamıyor.
- Önerilen düzeltme: ayrı iş kırılımı (Ajan 4a/5 tarafında): Zamana Karşı maçlarında aynı `ARENA_SKILLS` kataloğu prep橱 fazında sunulsun (engine: kişisel süre alanları klasik `match.js`e taşınmalı ya da zamansız süreli modda skill listesi ters çevrilmeli). Kod bu denetim kapsamında değiştirilmemelidir — fikir (öneri) olarak raporlandı.

**ORTA-2 — Overtime "+5 sn", rakibin kalan süresi fazlaysa KIRPILMA oldu (kelime okuma riski).**
- Dosya/satır: `pvp/shared/arena.js:158-164` (`opponent.personalEndsAt=opponent.overtimeUntil??at`).
- Senaryo: rakip 30 snin 24 sn'inde hâlâ yazarken, karşı taraf 5 kelimeyi 0.5 sn'de bitirdi → rakibin raundu bitirenAnı+5 sn'e**AYARLANDI**; eli hâlâ 24 sn hakkı vardı ama süre bitti.
- Kanıt (motor simülasyonu): `t1.m round.endsAt - B: 0` (bitirenAnı + 5 sn'e kırpılıp uzatıldı); `B kişisel bitişi bitirenAnı+ 5 s` (beklentinin kod tarafı doğru)、ama rakip kalan `29.56 sn → 5.4 sn`'e düştü.
- Bu davranış sahibin "ilk kim yazarsa raund biter ... ama ona 5 saniye daha eklensin" cümlesiyle **uyumlu** ve spec §3'te açıkça tarifli; KARŞILANDI işaretlendi ama çağırma riski yüksek. Önerilen düzeltme (sahibe sorulmalı): "5 saniye daha ekledimsin" niyeti okunursa `arena.js:162` şu olmalı: `opponent.personalEndsAt=opponent.roundSkill==='overtime'?Math.max(opponent.personalEndsAt,at+ARENA_OVERTIME_MS):at` — yani kalan süre asla kırpılmaz, yalnız uzatılır; `docs/ARENA-MODU.md` §3'te de kesin kelime değişimi gerek.

**DÜŞÜK-1 — "Donmuş An" gerçekten "dondurant" değil: +3 sn sadece ön yükleme.**
- Dosya/satır: `pvp/shared/arena.js:88-90` (`personalEndsAt+=ARENA_FREEZE_MS; frozenUntil=at+ARENA_FREEZE_MS`).
- Senaryo: freeze seçen oyuncunun süresi raund başında toptan +3 sn uzuyor; donma penceresinde yazma engellenmiyor, sayaç durdurulmuyor (yalnız `frozen` bayrağı UI'da buz etiketi vurguluyor).
- Kanıt (sim): `A kalan = 33 sn (şartname +3 sn ile uyumlu), frozenWhile: 3 sn`; şartname §2 "kendi süren +3 sn (donar)" ile sözleşme tutarlı ama sahibin "kendi zamanını dondurursun" algısına tam eşlik etmiyor.
- Önerilen düzeltme: UI tarafında (pvp/arena-ui.js) frozen penceresinde sayaç gösterilmesi `me.frozen=true` iken saniyeyi sabitleyip buz animasyonu göstermek yeterli; motor değişikliği gerektirmez. Spec §§ yorumu netleştirilmeli.

**DÜŞÜK-2 — Karanlık Saat'te kurban kendi süresini de göremiyor; spec §7.2 örneği yalnız rakibin süresini gizliyor.**
- Dosya/satır: `pvp/shared/arena.js:233-247` (`hidden` → `me.remainingMs=null` ve `opponent.remainingMs=null`), comment açıkça "KURBAN ... ne kendi ne rakibin" diyor.
- Kanıt (sim): `kurban B kendi süresi: null | B rakip süresi: null` ve `seçen A kendi: 30000 | A rakip: 30000`.
- Şu anki davranış, önceki denetçi düzelte mesinde bilinçli seçim (AJAN-RAPORLARI.md:343*) ve sahibin "zamanı göremesin" ifadesine uyumlu. Rapor içlindeki çelişki: *docs/ARENA-MODU.md* §7.2 örneği `me:{remainingMs...}` gizlemeyi tarif etmiyor. Önerilen düzeltme: spec örneği güncellensin (kurbana iki süre de null). Kod değişikliği gerekmez.

### 4. Simülasyon çıktısı özeti (motor yoluyla madde doğrulama)

```
MADDE 3  D Y Y Y D            → [k0:100 (pen 0), k4:52 (pen 0.48)]             (sahibin örneği birebir)
MADDE 3b D Y D                → [k0:100, k2:90 (pen .10)]
MADDE 3c D + 5Y + D           → [k0:100, k6:25 (pen .75)]  wrongPenalty(5)=0.75
MADDE 4  D D D D D            → [100,100,100,150 KOMBO,200 FİNAL]              comboMultiplier(6)=2
MADDE 5  combostone           → [..,175 (×1.75 KOMBO), 240 (×2.4 FİNAL)]
         cleanse              → [100, 100 (pen 0, [ARINMA])]
MADDE 6  scramble             → B 'perde'→'eerdp'; orijinal yazım=YANLIŞ, anagram yazım=DOĞRU, kaos kuranı etkilenmez
MADDE 7  overtime             → bitirenAnı+5 sn; gönderim EVET; overtime'sız RED
MADDE 7b ilk bitiren          → rakip kalan süresi bitirenAnına kırpılır (overtime'sız)
MADDE 7c timethief/freeze/blindclock → 25 sn / 33 sn(+3 donma) / kurban süresi null-null
MADDE 1/2/8 raund planı 5-10-15-15-15-20 (80 benzersiz), iki taraf EŞİT kelimeler, tohum farklı→0/80 örtüşme
```

### 5. Sonuç

Sahibin 12 maddelik arena isteğinin **11'i KARŞILANDI, 1'i (bağımsız Zamana Karşı entegrasyonu) KISMEN**. Kod kalitesi yüksek (saf ES modülleri, tohumlanabilir RNG, kişisel görüntü, 405/405 test). İzlenen üç küçük bulgu (ORTA-2 overtime kırpma sözel belirsizliği, DÜŞÜK-1 donma görselliği, DÜŞÜK-2 Karanlık Saat self-gizleme) işlevsel değer kaybı değil, sahibin kelime okumasına bağlı tasarım kararlarıdır; ORTA-2 için oyun sahibinden davranış netlemesi beklenmelidir. Bu denetimde OKUL kaynak değiştirilmedi.

## Ajan 4a — Arena arayüzü ve üst yazma paneli (Claude, 05:00)

- **Ne yaptım:**
  - **Ortak üst yazma paneli (bütün modlar):** Klasik, Zamana Karşı/tur ve Arena modlarında yazma alanı artık sayfanın üst-ortasında TEK kutu (`[data-typetop]`; kabuk satırları: araç çubuğu, HUD, panel, arena, alt bilgi). İki oyuncu aynı yerleşimi görür; rakip yalnızca kısa bir satır ve ince yarış çubuğuyla gösterilir. Taraflardaki eski çift `.pvp2-typebox` gizlendi ama DOM'da duruyor, bu yüzden eski testler bozulmadı. Mevcut `[data-input]` giriş işleyicisi değiştirilmeden yeni girişe bağlandı. Kilit ya da bekleme nedeni artık `role=status aria-live` satırında da yazıyor.
  - **%80 yakınlaştırma okunaklılığı:** Hedef kelime `clamp(24px,1.6vw,38px)`, giriş 50 px yüksekliğinde, panel metinleri en az 12 px. PvP'deki 9–11 px'lik eski etiketler `typing-top.css` içinde 12 px tabanına çekildi. Playwright ile görünür metin taraması: 1536×864 ve 2400×1350'de 12 px altında 0 öğe var, yatay taşma yok.
  - **Arena 4 bölümlü akış (`pvp/arena-ui.js` + `.css`):**
    - **RAUND ÖNCESİ:** Fiil öncelikli 5 skill ve 4 eşya kartı. Her kartta kalan hak rozeti (`2/2`), 0 hakta kart devre dışı. Kilit geri sayımı ve "Rakibin seçimi gizli" notu var. Klavye: `1–5` skill, `6–9` eşya, `Enter` kilitler, `Esc` seçmeden geçer. Süre dolmadan 0,7 sn önce seçili kartlar otomatik kilitlenir. Seçim `ARENA_PICK` olarak gider, `ARENA_PICK_ACK` ile onaylanır.
    - **RAUND:** HUD'da kalıcı HP çubukları (5.000) ve kişisel süre çipleri. Karanlık Saat etkisinde iki saat de "🌑 —" gösterir. Donmuş An için ❄ (ilk 3 sn saat durur), Zaman Hediyesi için `+5 sn` rozeti, Zaman Hırsızı çipi. Ayrıca 4 hücreli kombo (`KOMBO ×1.5` / `FİNAL ×2`; Kombo Yükselteci ile ×1.75/×2.4), `−%48` ceza çipi (Arınma Taşı ile "ARINMA · ceza yok") ve raundun kelime sayısına göre 5–20 hücreli D/Y şeridi. Harf Kaosu kurbanı "🔀 HARF KAOSU · kelimeyi gördüğün gibi yaz" etiketini görür. Madalyonda raund numarası ve 4 adımlı akış (Hazırlık, Yazma, Vuruşlar, Özet) yer alır.
    - **RAUND SONRASI:** Panel arenanın altına taşınır; geçiş FLIP ile `transform: translateY` olarak oynar, azaltılmış harekette anında olur. Arena yukarı doğru büyür ve dövüş açıkta kalır. `ARENA_ATTACK`, `arenaCombatActions()` ile `SKILL_CAST` + `DAMAGE_APPLIED` çiftine çevrilir; mevcut `fx-damage.js`, 3B arena ve 2B katmanlar bunu aynı `tuslab:pvp-combat` yolundan oynatır.
    - **ÖZET:** Boşalan üst alanda özet kartı: doğru, yanlış, en iyi seri, raundda verilen hasar (`combatStats` farkından hesaplanır), kalan HP, raundu kazanan ve "Sıradaki: RAUND N · K kelime" bilgisi geri sayımla. Maç sonunda sonuç paneline `[data-arena-result]` bloğu eklenir.
  - **Mod seçici:** Lobide (yalnız host; `MATCH_CONFIG {mode}` gönderir) ve bot panelinde "Klasik · Zamana Karşı · Arena". Tur uzunluğu seçicisi yalnız Zamana Karşı seçiliyken görünür. `?pvp=practice&mode=arena&bot=orta` ve `?pvp=arena&bot=…` çalışıyor.
  - **network.js:** `ARENA_*` paketleri önce kişisel anlık görüntüyü uygular, sonra `tuslab:pvp-arena` olayını yayınlar. `ARENA_ATTACK` combatEvents içinden id ile tekilleştirilir. Arena'da `WORD_SUBMIT` `roundWordIndex` ve `round` alanlarıyla gider. `sendArenaPick()` eklendi. `createPracticeSession({mode})` bağlandı. Hata kodları oyuncu diline çevrildi (`errorText`).
  - **Araç çubuğu (Fikir 1/3):** Ayarlar `⚙` simge düğmesiyle açılan `<details>` kutusunda toplandı (44×44 düğme, araç ipucu, `aria-label`; Esc kutuyu kapatıp odağı düğmeye geri verir). Etiketler fiil öncelikli. "Teslim ol" yalnız maç sırasında görünür. Araç çubuğu 1536 ve 2400 px'te tek satır. Lobi, segment ve kart düğmelerine odak halkası eklendi. Canlı maçta Esc ile çıkış artık onay ister.
- **Değişen/oluşan dosyalar:** yeni `pvp/arena-ui.js`, `pvp/arena-ui.css`, `pvp/typing-top.css`, `tests/pvp-arena-ui.test.mjs` (12 test), `tests/pvp-typing-top.test.mjs` (3 test). Değişen: `pvp/index.js`, `pvp/network.js`, `index.html`. `pvp/shared/*` ve `pvp.css` değişmedi.
- **API / önemli kararlar:**
  - `createArenaUi({hudHost,stageHost,overlayHost,now,send,onLockChange})` → `{update, handle, handleKey, lockState, personalEnd, tick, destroy}`.
  - Saf modeller: `arenaInputLock`, `arenaTarget`, `arenaPenalty`, `arenaComboModel`, `arenaCombatActions`, `arenaSummaryModel`, `arenaResultModel`, `looksScrambled`, `modePickDecision`.
  - Kişisel süre `serverNow + remainingMs` ile hesaplanır, raund boyunca en küçüğü tutulur; `ARENA_ROUND_START.endsAt` üst sınırdır.
  - Harf Kaosu tespiti: kelimelerin en az yarısı `WORD_BANK` içinde yoksa karışık sayılır.
  - Kart metinleri sunum için aynalandı, çünkü `arena-skills.js` eşzamanlı düzenleniyordu.
  - Raund Denetçisi 3'ün 5 maddesinin hepsi uygulandı.
- **Test sonucu:** `node --test tests/*.test.mjs` → **416/416 geçti**. Playwright + Chromium ile 1536×864 ve 2400×1350, rounds/classic/arena, 2B ve 3B denendi. Hazırlık, kilit, yazma (D Y Y D D), vuruşlar (panel iner, hasar sayıları görünür), özet ve sonraki hazırlık uçtan uca çalıştı. 2B'de konsol hatası yok. 3B'de headless SwiftShader'da bir kez `THREE.WebGLProgram: Shader Error 0 - VALIDATE_STATUS false` görüldü (performans ajanının alanı). Sunucu durduruldu.
- **Bilinen eksikler / ertelenenler:**
  - Ertelenenler: Fikir 1 #2 (durum çiplerini birleştirme; yalnız metinler kısaltıldı), #4, #6, #7, #9, #10; Fikir 3 #3 (`devicePixelRatio` sınıfı; yerine 12 px tabanı uygulandı) ve #8; Fikir 4 #6'daki uçan süre animasyonları (statik çip yapıldı).
  - Bot panelinde "Klasik" seçilebiliyor ama `practice.js` klasik modu desteklemediği için antrenmanda tur maçı açılıyor. Codex'in `mode:'classic'` desteği eklemesi gerekiyor.
  - Karanlık Saat'te `ARENA_ROUND_START.endsAt` kişisel bitiş zamanını hâlâ taşıyor. Arayüz bunu ekranda göstermiyor, yalnız giriş kilidi için kullanıyor.
  - `fx-damage.js`'in "KOMBO ×N · toplam" sayacı arena kombosuyla karışabilir; arena vuruşlarında (`event.arena===true`) kapatılabilir.

## Ajan 7 — Zamana Karşı arayüzü ve klasik bot (Codex, 05:08)

- Tur arasında üç süre becerisi kartı ve “Seçme” eklendi. Kalan haklar, 1–3 / Enter / Esc kısayolları ve "'`ROUND_SKILL_ACK` onayı gösterilir. Rakibin seçimi yalnız `ROUND_START.skills` sonrasında kısa çağrıyla açılır. Kartlar Arena'"'nın "'`.aui-card` görsel dilini kullanır.
- Tur HUD'"'u kişisel bitiş zamanlarını kullanır; −5 sn ve ❄ +3 sn rozetleri vardır. Karanlık Saat kurbanında iki saat de "'`🌑 —` görünür ve gizli süre başka alandan hesaplanmaz.
- Botun Klasik seçimi artık seçenek verilmeden `createMatch` klasik motorunu çalıştırır; tur paketleri oluşturmaz. Çevrimdışı süre becerisi seçimi çevrimiçi akışla aynı `ROUND_SKILL_PICK` / `ROUND_SKILL_ACK` yolundan geçer.
- Yeni testler: `tests/pvp-time-skills-ui.test.mjs`, `tests/pvp-practice-classic.test.mjs`. `node --test tests/*.test.mjs`: 419/419 geçti. Playwright Chromium'"'da rounds/classic bağlantıları 1536×864 ve 2400×1350 boyutlarında konsol hatası ve yatay taşma olmadan açıldı. Tur arasındaki üç kart, klavyeyle seçim ve bot onayı ayrıca doğrulandı. Geliştirme sunucusu durduruldu.



## Raund Denetçisi 2 — Zamanlama ve uç durumlar (GLM)

Denetim salt okunurdu: hiçbir kaynak veya test dosyası değiştirilmedi. Tüm simülasyonlar `%TEMP%/opencode/denetci2/audit.mjs` içinde, proje dışında koşuldu; modüller mutlak `file://` yolu ile import edildi. Kapsam: `docs/ARENA-MODU.md` §3–§7, `pvp/shared/arena.js`, `pvp/shared/arena-damage.js`, `pvp/shared/arena-skills.js`, `cloudflare/src/room.js` (arena yolları), `pvp/practice.js` (arena kısmı). Senaryolar: iki oyuncunun aynı ms'de bitirmesi, hiç yazmayan oyuncu (30 sn), overtime+timethief+freeze birleşimleri, hazırlıkta kimse seçmezse, resolve'da KO, 6 raund sonunda eşit HP, her fazda teslim, `nextArenaDeadline` zinciri (kilit testi), ARENA_ATTACK çift üretimi, 55 ms sınırları, yanlış raund numarası; ayrıca kod okumasından çıkan bulgular.

### 1. Bulgular (önem sırasına göre)

#### ORTA-1 — Aynı ms'a denk çifte bitişte ikinci oyuncunun son kelimesi düşüyor
- **Dosya:satır:** `pvp/shared/arena.js:141` (`at>=p.personalEndsAt||at>=match.round.endsAt → ROUND_NOT_ACTIVE`), `arena.js:156-164` (ilk bitiren; `m.round.endsAt=roundCloseAt()` bitiren anına kırpılır), `cloudflare/src/room.js:297-300` (`arenaWordSubmit`, submit'ten ÖNCE `advanceArenaMatch(match, now)` çağırır).
- **Senaryo:** İki oyuncu her kelimeyi aynı milisaniyede göndererek beş kelimeyi tamamlıyor. Önce işlenen oyuncu bitince `round.endsAt` o ana kırpılır; AYNI ms'de gelen ikinci oyuncunun son kelimesi, hem oda akışındaki advance'in raundu kapatıp `resolve`'a geçirtmesi, hem de motor guard'ı nedeniyle reddediliyor.
- **Kanıt (script çıktısı):**
  - Motor-doğrudan: `t=+0..+165ms A:ok0-3 B:ok0-3; t=+220ms A:ok4 (bitirdi) B:ROUND_NOT_ACTIVE` → attempts 5/4, bekleyen saldırı 9 (A'nın 5 + B'nin 4 kelime vuruşu). B'nin 5. kelimesi (yaklaşık 100 hasar) yitirildi; işlenme sırası kazananı belirliyor.
  - Oda akışı (önce advance sonra submit, `room.js`'deki gerçek sıra): sonuç yine `ROUND_NOT_ACTIVE`.
- **Önerilen düzeltme:** (a) Motor: submit'teki bitiş sınırı kapsayıcı yapılmalı (`at>endsAt` reddet; `at===endsAt` kabul) ve ilk-bitiren dalı ikinci bitişle uyumlu olmalı (ikisi de `roundDone` olduğunda `roundCloseAt` iki `finishedAt`'in max'ini zaten doğru döner). (b) Oda: submit gelişinde giriş-advance `Math.min(now, match.round.endsAt+1)` ile sınırlanabilir. (a) tek satırlık değişiklik; §3'ün "raund anında biter" kuralını 1 ms farkla korur.

#### ORTA-2 — Rakip erken bitirdiğinde Donmuş An bonusu tamamen siliniyor (spec-uyumlu; kullanıcının anlayışına muhtaç davranış)
- **Dosya:satır:** `pvp/shared/arena.js:165` (`opponent.personalEndsAt=opponent.overtimeUntil??at`).
- **Senaryo:** A `freeze` seçti (kişisel bitiş RS+33.000); B skill'siz, 0,74 saniyede beş kelimeyi bitirdi. İlk-bitiren kuralı A'nın 33 saniyelik hakkını aniden RS+740'a kırpıyor; donma göstergesinin hiçbir etkisi olmadan raund bitiyor.
- **Kanıt:** `(c) B erken bitirdi (+740), A freeze (+33 sn hakki vardi): A kisisel=RS+740 (beklenen 740, freeze bonusu silindi), endsAt=RS+740`.
- **Önerilen düzeltme:** Davranış şartname §3'e (ilk bitiren → raund anında biter; istisna yalnız rakipte Zaman Hediyesi) birebir uyumlu; kod değişikliği gerekmez. Arayüzde erken bitiş anında "donmuş" göstergesi kaldırılıp "raundu rakip kapattı" bilgisinin gösterilmesi önerilir; istenirse §3'e "ilk bitiren kuralı freeze/overtime bonuslarını geçersiz kılar" cümlesi eklenmeli.

#### DÜŞÜK-1 — Zaman Hediyesi kişisel bitişi "uzatma" değil "değiştirme" olarak uygulanıyor (bitiren+5 sn)
- **Dosya:satır:** `pvp/shared/arena.js:165`; `pvp/shared/arena-skills.js:34-39` (§6 tanımı).
- **Senaryo:** A timethief (B kişisel bitiş RS+25.000), B overtime. A 0,74 saniyede bitirdi; B'nin kişisel bitişi bitiren+5.000 = RS+5.740'a çekildi; B'nin kalan 24 saniyesi 5 saniyeye indirildi.
- **Kanıt:** `(b) A bitirdi (+740): B onceki kisisel=RS+25000 → yeni=RS+5740 (=bitiren+5000), endsAt=RS+5740`. Karşı not: skill olmasaydı raund hemen kapanacağından +5 saniye yine net kazanç; spec §3 tam olarak bunu istiyor.
- **Önerilen düzeltme:** Spec-uyumlu; dokümantasyon notu yeterli: "overtime, rakip bittiğinde kişisel bitişi bitiren+5 sn'e AYARLAR; kendi kalan süreniz bundan uzunsa üzerine eklenmez".

#### DÜŞÜK-2 — `advanceArenaMatch` idempotent değil; eski (persist edilmemiş) state ile ikinci çağrı aynı ARENA_ATTACK'ı yeniden üretir
- **Dosya:satır:** `pvp/shared/arena.js:182-217` (saf; her çağrıda `structuredClone`, `pendingAttacks` yeni kopyadan türetilir), `cloudflare/src/room.js:270` (`this.broadcast(event.type,{event})` — payload'da `match` yok), `cloudflare/src/room.js:19-25` (`wrap()` yalnız `payload.match?.matchId` varken `eventId` üretir).
- **Senaryo:** Eski match nesnesiyle advance iki kez çağrılırsa her çağrı kuyruğun başındaki aynı vuruşu yeniden üretir; çağıran yeni state'i persist etmezse saldırı iki kez hasar verir. Normal oda akışında her handler yeni state'i kaydettiği ve takip eden çağrılar güncel state'ten yapıldığı için çift vuruş yoktur; risk hibernasyon/tekrar alarm senaryoları ve istemci dedupesidir (ARENA_ATTACK paketlerinde `matchId/sequence/eventId` metası yok).
- **Kanıt:** `ayni eski snapshot ile 2x advance: id1=[2] id2=[2] hpB1=4900 hpB2=4900`. Doğru akış: `persist akisi: 6 benzersiz vurus, cift=false, son hpB=4700`.
- **Önerilen düzeltme:** `room.js:270`'teki ARENA_ATTACK broadcast'ine `sendMatch`/snapshot deseni eklenerek `eventId` metası üretilmeli; istemci yine de `event.id` ile dedupe edebilir. Normal akışta zorunlu bir değişiklik yok.

#### DÜŞÜK-3 — `ARENA_ROUND_END` içindeki `roundsWon` daima geride kalıyor (kapsadığı raundun kazananını içermiyor)
- **Dosya:satır:** `pvp/shared/arena.js:114-118` (`roundsWon`, `roundHistory`'den hesaplanır), `arena.js:203-205` (raundun kazananı summary geçişinde `roundHistory`'ye eklenir).
- **Senaryo:** Her `ARENA_ROUND_END` olayı, daha önce tamamlanmış raundların kazançlarını sayar; bu raundun kazananı henüz atanmadığı için listede yok.
- **Kanıt (tam sessiz maç):** `ARENA_ROUND_END payloads: [raund:1 {1:0,2:0}, raund:2 {1:0,2:0}, ..., raund:6 {1:0,2:0}, son=ARENA_DRAW]` — altı olayın tamamı 0.
- **Önerilen düzeltme:** Kazanan atandıktan sonra (summary geçişinde) ayrı bir raund-sonuç olayı yayınlanmalı ya da `roundsWon` hesabı buraya değil özet olayına taşınmalı.

#### DÜŞÜK-4 — `openPrep` `lastSubmittedAt`/`lastWordAt` alanlarını sıfırlamıyor
- **Dosya:satır:** `pvp/shared/arena.js:44-46` (sıfırlama listesi), `arena.js:154` (atama).
- **Senaryo:** Rauntlar arasında 55 ms limiti pratikte hiç tetiklenmez (en az 4 saniyelik özet gap'i vardır) ancak sayaç invariant'ı eksik kalıyor.
- **Kanıt:** Sıfırlama listesinde bu iki alan yok; S10 sınır testi yalnız raund içinde.
- **Önerilen düzeltme:** `openPrep`'e `lastSubmittedAt:null, lastWordAt:null` sıfırlaması eklenebilir (kod güzelliği; risk yok).

#### DÜŞÜK-5 — Arena'da istemsiz bağlantı kopması maçı durdurmuyor; maç zaman aşımıyla akmaya devam ediyor
- **Dosya:satır:** `cloudflare/src/room.js:383-391` (`next=explicit?surrenderArenaMatch(match,p.seat,now):match;` — `pauseMatch`/`endDisconnectedMatch` yalnız rounds/classic dalında), `pvp/shared/arena.js` (pause/resume yok).
- **Senaryo:** Arena oyuncusunun ağı düşerse (LEAVE değil, socket close) maç `running` kalır; kişisel süre işleyerek dolduğunda rakip süre aşımıyla kazanır.
- **Kanıt:** Kod-yolu incelemesi — ARENA-MODU.md'de arena için pause/resume tanımı yok (spec sessiz); açık bir tasarım boşluğu.
- **Önerilen düzeltme:** Ya ARENA-MODU.md'ye "arena modunda pause yok" maddesi açıkça yazılıp lobi metni düzeltilmeli, ya da `REJOIN_GRACE` süresince kişisel bitişlerin dondurulması (DO alarmı ile) ve `endDisconnectedMatch` deseninin arena'ya uyarlanması tasarlanmalı.

#### DÜŞÜK-6 — Practice botu tur geçişlerini güvenle yönetiyor (bilgi)
- **Dosya:satır:** `pvp/practice.js:365-370` (`botType` yazma koşulu `match.round.index===round`), `practice.js:402-405` (tick yalnızca deadline geçince advance eder).
- **Senaryo:** Bot, kendi tetiklediği advance faz geçişinden sonra koşulu kendi kontrol eder (raund değişirse yazmayı keser); "aynı ms'de bitiş" ucu ORTA-1 kapsamında motor seviyesinde ele alınmalı, bot tarafında ek bir risk saptanmadı.
- **Kanıt:** S8 sürücüsünde bot etkisi olmadan 18 adımda deadline zinciri sorunsuz ilerledi.
- **Önerilen düzeltme:** Yok — bilgi.

### 2. Doğrulanan (hata saptanmayan) davranışlar

- **Hiç yazmayan oyuncu (30 sn):** İkisi sessiz → raund RS+30.000'de kapanıp 0 saldırıyla sonraki hazırlık başlar. A iki doğru yazıp durursa raund RS+30.000'de kapanır; ilk vuruşta B hp 5000→4900. (`S2`)
- **freeze+timethief formülü:** A freeze + B timethief → A kişisel RS+28.000 (30+3−5), B RS+30.000, endsAt bu ikisinin maksimumu; spec formülü birebir. (`S3-a`)
- **Overtime baz süreyi bozmaz:** A freeze (33 s) + B overtime (30 s), ikisi de sessiz → A hakkını tam kullanır, endsAt RS+33.000. (`S3-d`)
- **Hazırlık uçları:** Kimse seçmezse raund tam `prepEndsAt` anında başlar ve skill'ler null olur; tek taraf seçince yine +10.000 ms başlar; AYNI ms'de çift kilitte `min(at,prepEndsAt)` ile erken başlangıç (+2000); `at===prepEndsAt` anındaki seçim `ARENA_PICK_NOT_PREP` ile reddedilir. (`S4`)
- **resolve'da KO:** Kuyruk 6 vuruşlu; savunmacı hp 80'e indirilince ilk vuruşta 0'a iner → `KNOCKOUT`, doğru winner, bekleyen 5 vuruş iptal (`pendingAttacks=[]`), yalnız 1 ARENA_ATTACK event; 2. vuruşta KO senaryosu da benzer şekilde doğrulandı (2 vuruşta KO, kalan 4 iptal). (`S5`)
- **Beraberlik kuralları:** R1'de 2'şer doğru + 5 sessiz raund → hp/correct/damage eşit → `ARENA_DRAW`, winnerSeat=null. Tamamen sessiz 6 raund da aynı sonuca bağlanır (hp 5000/5000). Eşit hp + farklı doğru: desen araması "2 doğru, 180 hasar" ve "3 doğru, 180 hasar" eşleşmesini buldu; GERÇEK 6 raundluk motor maçında doğrulandı: `hp=4820/4820, correct=2/3 → winner=2, endReason='ROUNDS'` (sıra hp → doğru kelime → toplam hasar sağlam). (`S6`)
- **Teslim olma her fazda:** prep / round / resolve (bekleyen 6 vuruş silinir) / summary — winner ve `endReason='SURRENDER'` her zaman doğru; `ended` durumunda no-op (idempotent döner). (`S7`)
- **nextArenaDeadline:** 6 raund sıfır-katılım maçında 18 adımda deadline zinciri sorunsuz ilerledi: hiç null/NaN/geriye düşen değer yok; toplam süre tam 264.000 ms. Resolve'da boş kuyruk → `r.endedAt` geçmiş değer döner, alarm hemen çalışır, kilit oluşmaz; `ended` fazında null döner ve schedule oda TTL'ine döner. (`S8`, `S2-a`)
- **ARENA_ATTACK tekilleştirme (persist ile):** Persist + deadline sürücü akışında 6 benzersiz vuruş, çift yok. (`S9`)
- **WORD_BURST_LIMIT:** [0,1,54,55,56] ms aralıklar → [KABUL, RED, RED, KABUL(55 sınır), RED(önceki 55 ms referansına göre 1 ms)] — 55'in altı reddedilir, 55 ve üstü kabul; limit kişisel sayaçla sınırlıdır. (`S10`)
- **Yanlış raund numarası:** `round:2` gönderimine `ROUND_MISMATCH` + `round:1` ipucu; `round:null` kabul; `MATCH_ID_MISMATCH`; resolve'ta `ROUND_NOT_ACTIVE`; ended maçta `MATCH_NOT_ACTIVE`. (`S11`)
- **Oda alarmları ve hibernasyon:** `room.js:55` arena alarmını `nextArenaDeadline`'dan alır; her işleyici `put('match', step.match)` sonrası `schedule`'ı yeniler; hibernasyon uyanışı (`room.js:564-568`) kalıcı state üzerinden advance eder. `practice.js:402-405` tick'i yalnızca deadline geçince advance eder (doğru).
- **Event kimlikleri ve dedupe:** `combatEvents` son 24 tutulur; `nextCombatId` maç boyunca monoton artar; `practice.js:386-388` id ile dedupe yapar; `ARENA_PICK_ACK` yalnız ilgili oyuncuya gider (`broadcastArenaRounds` event.seat filtresi).

### 3. Sonuç

Arena motoru (`pvp/shared/arena.js`) zamanlama ve uç durumlar açısından kayda değer sağlamlıkta: deadline zinciri hiç kilitlenmiyor, KO ve teslim her fazda temiz, beraberlik kırıcı sırası (hp → doğru kelime → toplam hasar → beraberlik) gerçek motor maçında onaylandı, 55 ms / raund numarası / geçersiz id kontrolleri savunma hizada. Bulgular: 2 ORTA (aynı-ms çifte bitişte son kelime kaybı; ARENA_ATTACK broadcast'lerinde eventId metasının olmaması) ve 6 DÜŞÜK (üçü spec-uyumlu davranışların dokümantasyon/UI bildirimi; reset invarian'ının tamamlanması; roundsWon gecikmesi; bot bilgi notu; arena pause boşluğu). ORTA-1 için tek satırlık motor düzeltmesi (submit sınırının kapsayıcı yapılması) önerildi; ORTA-2 ve DÜŞÜK-1 spec ile birebir uyumlu olduğu için kod yerine dokümantasyon/UI çalışması gerektirir. Bu denetimde hiçbir kaynak dosya değiştirilmedi.

> Denetçi notu: bu bölüm GLM kotası dolduğu için ajanın geçici kopyasından denetçi (Claude) tarafından eklendi.

## Performans Ajanı — %80 yakınlaştırma / zayıf GPU optimizasyonu (Claude Opus, 2026-11-08)
- Ne yaptım:
  - ÖNCE ÖLÇÜM: Python Playwright + gerçek Intel UHD (ANGLE D3D11) ile `?pvp=practice&bot=orta&arena=3d|2d` açıldı, kelimeler otomatik yazılarak savaş tetiklendi. Ölçülenler: rAF kare sayısı, p95, >25 ms / >50 ms kareler, canvas backing-store pikselleri, canlı/sonsuz animasyonlar, savaş SIRASINDA bağlanan WebGL programları (`linkProgram` kancası), Chrome trace (GPU iş parçacığı, raster, render pass) ve Long-Animation-Frame kaynakları. "Önce" ölçümleri A/B yöntemiyle alındı: `cloudflare/public/pvp/` içindeki değişmemiş kopyalar Playwright route ile servis edildi.
  - Bulunan kök nedenler: (1) `arena3d.js` oranı `Math.max(1, …)` ile 1'e sabitliyordu. Uzaklaştırınca (dpr < 1) GPU ekranda görünenden fazla piksel boyuyordu: 3B canvas 3.8 MP'ye, parçacık canvas'ı 5.9 MP'ye kadar çıkıyordu. (2) Otomatik kalite düşüşü ışıkları gizleyince ya da bloom hedefi değişince savaş ortasında ~30 shader programı yeniden bağlanıyordu. Bu, 0.5–1 sn'lik donmalara yol açıyordu (linkProgram zamanlarıyla eşleşti). Dokular yüklenince savaşçı malzemeleri, ilk mermi/halka/sütun malzemeleri de ilk kullanımda derleniyordu. (3) 3B modda `display:none` olan 2B parçacık canvas'ı yine tam boyutta (1–6 MP) ayrılıyordu. 2B modda ise boştayken bile tüm düelloyu kaplayan saydam katman her karede birleştiriliyordu. (4) 3B modda gizli DOM rig'i 5–6 sonsuz animasyon ve `will-change` katmanlarıyla çalışmaya devam ediyordu. (5) 3B canvas'ın üstündeki `.pvp2-role` `backdrop-filter` kullanıyordu; her karede değişen WebGL görüntüsü yeniden bulanıklaştırılıyordu. Kabuktaki 160px iç gölge de her raster'da yeniden çiziliyordu.
  - Düzeltmeler:
    - Yeni `pvp/perf-governor.js` (saf, test edilebilir):
      - `budgetRatio()`: mutlak piksel bütçesi uygular. 3B: yüksek ≤2.0 MP, orta ≤1.4 MP, düşük ≤1.0 MP. Parçacık: ≤1.0 MP, düşükte ≤0.7 MP. Oran dpr'yi 1'in altında da izler, alt sınır 0.5.
      - `createFrameGovernor()`: 45 kare ısınma, 40 karelik pencere. Ortalama >20 ms ise bir kademe iner. >250 ms duraklamaları saymaz. Tek yönlüdür.
    - 3B otomatik kalite artık kademeli: 0 bloom açık → 1 bloom kapalı → 2 çözünürlük düşük → 3 düşük kalite (kalabalık/ışık/efekt azalır). Sekme geri gelince vali sıfırlanır.
    - Shader ön-derleme: üç düzen (yüksek+bloom hedefi, yüksek+ekran, düşük+ekran) kare başına bir düzen olacak şekilde `renderer.compileAsync/compile` ile derlenir. Gizli nesneler bir kez "ısınma çizimi" ile çizilir (ANGLE ilk-çizim varyantları için). Ön-derleme doku yüklenince ve eklenti kaydında yeniden kuyruğa alınır.
    - `arena3d-fx.js`: birer halka, sütun ve her türden bir mermi baştan gizli kurulur, böylece programları önceden ısınır.
    - `fx-particles.js`: oran bütçeyle sınırlı. Backing store ilk efekte kadar 1×1 kalır. 3B açılınca `clear()` belleği bırakır. Uyurken `visibility:hidden`.
    - CSS: 3B modda gizli rig'in animasyonu, filtresi ve will-change'i kapatıldı. `.pvp2-role` için backdrop-filter yerine opak zemin kullanıldı. Kabuktaki iç gölge yerine radyal degrade vinyet geldi. `.pvp26-canvas{contain:strict}` eklendi. `pvp.css` sonuna yorumlu bir blok eklendi: en küçük düello etiketleri `clamp(10px,.55vw,12px)`.
- Değişen/oluşan dosyalar: `pvp/perf-governor.js` (yeni), `pvp/arena3d.js`, `pvp/arena3d-fx.js`, `pvp/fx-particles.js`, `pvp/arena3d.css`, `pvp/pvp.css` (sona eklenen yorumlu blok), `tests/pvp-perf-zoom.test.mjs` (yeni, 8 test), `tests/pvp-fx-particles.test.mjs` (DPR 2 beklentisi yerine bütçe ve tembel ayırma beklentisi).
- API / önemli kararlar:
  - `arena3d.js` artık `AUTO_QUALITY` dışa aktarıyor. `api.quality()` sözleşmesi değişmedi ('high'|'low'; kademe 3 = 'low').
  - `desynchronized` kullanılmadı. WebGL context-loss geri dönüşü korundu; bağlam geri gelince ön-derleme yeniden kuyruğa alınır.
  - Bloom hedefini yarım çözünürlüğe İNDİRMEDİM. Birleştirme geçişi temel sahneyi de aynı hedeften okuyor; yarım çözünürlük tüm arenayı bulanıklaştırırdı. Bunun yerine bloom yalnızca kademe 0'da çalışıyor ve valinin ilk kapattığı şey o. Hedef zaten ≤1.5 MP ile sınırlı.
  - `index.js`, `shared/*`, `app.js` ve `index.html`'e dokunulmadı; koordinatörün uygulaması gereken zorunlu bir yama yok.
- Test sonucu (sayılarla): `node --test tests/*.test.mjs` → 419 test, 419 geçti, 0 kaldı (pvp-blackscreen26 ve pvp-dedupe26 dahil).
  - Ölçüm ortamı: Intel UHD, headless Chromium + ANGLE D3D11, 8 sn otomatik yazma.
  - Sütunlar: "uzun" = >25 ms süren kare sayısı. "prog." = ölçüm penceresinde savaş sırasında bağlanan shader programı sayısı. "3B MP" ve "parç. MP" = 3B canvas ile parçacık canvas'ının backing-store boyutu (megapiksel).
  - Sonra sütunundaki aralıklar tekrarlanan ölçümlerdir.

  | Görüş alanı (CSS) @dpr | Sahibin karşılığı | Önce 3B: fps / p95 / uzun / prog. / 3B MP / parç. MP | Sonra 3B: fps / p95 / uzun / prog. / 3B MP / parç. MP |
  |---|---|---|---|
  | 1536×864 @1.25 | %100 | 59.8 / 16.8 / 3 / 3 / 0.86 / 0.86 | 59.4–60.1 / 16.7 / 0–6 / 0 / 0.97 / 0 |
  | 1536×864 @1.0 | — | 60.1 / 16.7 / 0 / 3 / 0.62 / 0.62 | 59.5–60.1 / 16.7 / 0–5 / 0–1 / 0.62 / 0 |
  | 1920×1080 @1.0 | **%80** | 60.3 / 16.8 / 0 / 5 / 1.17 / 1.17 | 59.9–60.1 / 16.7 / 0–2 / 0 / 1.17 / 0 |
  | 1920×1080 @1.25 | — | 39.6–59.8 / 16.8–33.4 / 3–34 / 5–9 / 1.17* / 1.82 | 53.6–60.1 / 16.8 / 1–3 / 0–1 / 1.82 / 0 |
  | 2400×1350 @1.0 | — | 39.9 / 66.6 / 52 / 4 / 2.07 / 2.07 | 50.9–52.1 / 16.8 / 4–5 / 0 / 1.99 / 0 |
  | 2400×1350 @1.25 | — | 42.5 / 16.8 / 5 / 7 / 2.07 / 3.23 | 28.8–50.8 / 16.8 / 3–4 / 0 / 1.99 / 0 |
  | 2304×1296 @0.833 | **%67** | 50.4 / 16.7 / 2 / 4 / 1.87 / 1.87 | 41.9–60.1 / 16.7 / 0–3 / 0–1 / 1.28 / 0 |
  | 3072×1728 @0.625 | **%50** | 24.4 / 16.8 / 3 / 7 / 3.80 / 3.80 | 22.4–35.5 / 16.7 / 2–8 / 0–1 / 1.46 / 0 |
  | 3072×1728 @1.0 | — | 42.5 / 16.8 / 3 / 4 / 3.80 / 3.80 | 25.9–46.8 / 16.8 / 2–3 / 0–1 / 1.97 / 0 |
  | 3072×1728 @1.25 | 4K benzeri | 23.6 / 16.8 / 5 / **29** / 3.80 / 5.94 | 23.0–40.1 / 16.8 / 3–4 / 0–1 / 1.97 / 0 |

  (*) Eski otomatik kalite, 90 karelik ısınmadaki başlangıç takılmalarını da sayıyordu; bu yüzden hızlı makinede bile 'low'a düşüyordu.

  2B arena (parçacık canvas'ı MP, önce → sonra):

  | Görüş alanı @dpr | Parç. MP | fps | p95 (ms) | uzun |
  |---|---|---|---|---|
  | 1536×864 @1.25 | 0.62 → 0.62 | 57.5–59.8 → 57.1–60 | — | — |
  | 1920×1080 @1.0 | 1.17 → 0.69 | — | — | — |
  | 2400×1350 @1.0 | 2.07 → 0.70 | 24.4 → 32.9 | 100 → 66.7 | — |
  | 2304×1296 @0.833 | 1.87 → 0.69 | — | — | — |
  | 3072×1728 @0.625 | 3.80 → 0.99 | 23.4 → 25.8 | 99.9 → 16.8 | 26 → 10 |

  - 3B modda sonsuz CSS animasyonu sayısı 6 → 0.
  - Savaş ortasında bağlanan shader programı tüm 3B yapılandırmalarda 3–29 → 0–1. Geride kalan tek program da düzeltildi; son zaman çizelgesi ölçümünde 0.
- Bilinen eksikler / sonraki adım:
  - ÖLÇÜM GÜRÜLTÜSÜ: Ölçüm sırasında makineyi diğer ajanların testleri ve tarayıcıları da kullanıyordu. Aynı yapılandırmanın tekrarları ±15 fps oynadı (ör. 2B 1536@1.25 "önce": 57.5 ↔ 59.8). Ortalama fps'yi birkaç saniyelik seyrek duraklamalar belirliyor. p95 daha güvenilir bir gösterge: değişiklik sonrası 3B'de her yapılandırmada 16.7–16.8 ms.
  - Büyük görüş alanlarında (≥2400 CSS px) 3B modda hâlâ seyrek 0.7–2 sn'lik duraklamalar var. Trace'te bu sürede betik, stil ya da program bağlama görünmüyor; bekleme GPU işlem iş parçacığında (raster flush / render pass). Trace açıkken yeniden üretilemedi; kısmen makine paylaşımından kaynaklanıyor olabilir. Sahibin kendi makinesinde Brave ile doğrulanmalı (%80 yakınlaştırma, DevTools → Performance).
  - Benim dosyalarım dışındaki DOM maliyetleri:
    - `.pvp2-typebox` üzerindeki `:has()` seçicisi her tuşta stil yeniden hesabı tetikliyor (trace: 6 sn'de 698 geçersizleştirme).
    - `rounds-ui.css` içindeki `rui-word` geçişleri renk/kenarlık animasyonu yapıyor; bu raster maliyeti demek.
    - 2B modda `.pvp3-rig{filter:drop-shadow(22px)}` sonsuz `will-change` animasyonuyla birlikte her karede bir GPU filtre geçişi yaratıyor. 4K benzeri görüntüde render pass süresi 6 sn'de 1.4 sn; filtre kaldırılınca 0.24 sn.
    - Öneri (koordinatöre, dosya sahiplerine): `character-motion.css` içindeki `.pvp3-rig` filtresi kaldırılıp yerine radyal degrade aura kullanılsın; `:has()` kuralı sınıf tabanlı hale getirilsin.
  - 3B modda yazmaya ilk başlandığında tek seferlik ~1 sn takılma görüldü (2B'de yok). İlk tuşta `pvpAudio.keyClick()` AudioContext kuruyor olabilir. `index.js` sahibi ses kilidini `pointerdown` anında ya da ilk odakta önceden açmayı değerlendirebilir.
  - Ayrıca ölçüm sırasında başka bir ajanın yarım kalmış arayüz değişikliği görüldü: sol üstte stilsiz "CANLI MAÇ · SENİN KELİMEN" bloğu. Düello alanı aşağı itilmiş durumda; bu benim kapsamım dışında.

## Denetçi (Claude) — Raund Denetçisi 2 ve arayüz bulgularının düzeltilmesi (05:30)
- **ORTA-1 (aynı ms'de çifte bitiş):** düzeltildi. Gönderim kontrolü artık kapsayıcı (`at > bitiş` reddedilir, tam bitiş anı kabul); sunucu (`room.js` arenaWordSubmit) ve bot (`practice.js` wordSubmit) gönderimden önceki ilerletmeyi 1 ms geriden yapıyor. Böylece aynı milisaniyede bitiren ikinci oyuncunun son kelimesi de sayılıyor. Yeni test: "same-millisecond double finish".
- **ORTA-2 (Donmuş An rakip bitirince siliniyor):** şartnameye uygun; değiştirilmedi (rakip bitirince süre zaten kapanıyor, Zaman Hediyesi bu durum için var).
- **Sonuç ekranı:** Arena maçında anlamsız "0 — 0" tur skoru gösteriliyordu (arenada HP kazananı belirler). `rounds-ui.js` artık arena sonucunda tur skoru bloğunu çizmiyor; testle korunuyor.
- **Tarayıcı doğrulaması (2400×1350 ≈ %80 yakınlaştırma, gerçek GPU):** hazırlık → raund (Harf Kaosu dahil) → çözüm (panel aşağı iner, vuruşlar sırayla) → özet → sonraki hazırlık → nakavt → sonuç → rövanş döngüsü hatasız; konsol temiz; ~72 FPS, 3B canvas ≈1 MP.
- **Doğrulama:** 425/425 test.
- **Açık iş:** `fx-damage.js`'in kendi "KOMBO ×N · toplam" sayacı arena vuruşlarında görünüyor (arenanın 4'lü kombo kuralıyla çelişiyor) — performans ajanı bitince düzeltilecek.

## Denetçi (Claude) — Arena hasar etiketleri (05:40)
- `pvp/fx-damage.js`: arena vuruşları (`event.arena`) artık motorun etiketlerini piksel yazıyla gösteriyor: `KOMBO x1.5` (4. ardışık doğru), `FİNAL x2` (5.+), yanlış cezası kırmızı `-%48`, `ARINMA`. Eski klasik "KOMBO xN · toplam" sayacı arenada kapatıldı (arenanın 4'lü kombo kuralıyla çelişiyordu; tarayıcıda "KOMBO x13" görülmüştü). Piksel fonta `%` ve `.` karakterleri eklendi.
- Doğrulama: 426/426 test.
- Optimizasyon ajanının başka dosyalara dair önerileri (2B rig `drop-shadow` filtresi, `.pvp2-typebox :has()` kuralı, `rui-word` geçişleri, ses kilidini ilk odakta açma) Ajan 8 bitince ikinci performans dalgasında uygulanacak.

## Ajan 8 — Menü, buton ve yazı iyileştirmeleri (Codex, 05:20)

- Fikir 1 #2, #4, #6, #7, #9, #10; Fikir 3 #3, #8; Fikir 4 #6 için verilen erteleme hedefleri doğrultusunda ana sayfa PvP mod girişleri, lobi/bot açıklığı, buton hiyerarşisi, durum alanları ve arena/tur okunabilirliği düzenlendi. Kaynak rapor dosyası işe başlarken 0 bayttı; madde metinleri ve diğer öncelik 1/2 maddelerinin numara bazında doğrulanması mümkün olmadı.
- Önce: PvP tek menü girişiydi; bot ile çevrimiçi akış karışıyordu; küçük etiketler 12px altına düşüyordu. Sonra: Klasik, Zamana Karşı ve Arena ana sayfadan doğrudan açılıyor; lobi adımları ve hata kurtarma metinleri açık; maç/ping durumları tek grupta; görünür klavye odağı ve birincil/ikincil/hayalet buton düzeni var. Sonuç ekranında rövanş ve çıkış eylemlerinin görsel sırası belirginleştirildi.
- Yeni test: tests/pvp-ui-polish.test.mjs. Tam takım: node --test tests/*.test.mjs → 426/426 geçti. Python Playwright/Chromium: 1536×864 ve 2400×1350 boyutlarında ana sayfa, PvP lobi, bot Arena, Zamana Karşı ve Klasik; konsol hatası, yatay taşma ve görünür 12px altı metin yok. Geliştirme sunucusu durduruldu. cf:build/cf:validate çalıştırılmadı.
- Kalan: Boş kaynak rapor nedeniyle fikir maddelerinin özgün kapsamı ve kalan öncelik 1/2 işleri doğrulanamıyor. Sonuç ekranının dinamik rövanş etiketi pvp/phase15-results.js içinde; dosya bu görevin sahipliğinde olmadığı için metni değiştirilmedi.

## Hasar Denetçisi — Denge ve doğruluk (Codex)

Kapsam: Sahip isteği, ARENA-MODU §5/§10, arena-damage.js, arena.js çözümleme/Çelik Kalkan/KO akışı ve “Ajan 2” bölümü. Kaynak/test dosyaları değiştirilmedi. Betikler %TEMP%/arena-damage-audit-codex*.mjs altında; modüller mutlak file:// yolu ile yüklendi.

**Sahibin örneği birebir doğru:** D Y Y Y D için R1 saldırıları [100, 52]. Beşinci kelimede ceza 0,10+0,15+0,23=0,48, çarpan ×0,52. İlk doğru tam hasar veriyor. Çelik Kalkan gelen vuruşu yuvarlayarak %20 düşürüyor; KO'da kalan vuruş kuyruğu iptal ediliyor.

### Eşya × kelime sayısı × isabet

Hücreler tüm kelimeler gönderildiğinde ortalama toplam verilen hasar. %80/%60, kelime başına bağımsız doğru olasılığı ve 12.000 deterministik örnek; %100 kesin değer. 5/10/15/20 kelime sırasıyla R1/R2/R3/R6 tabanı. Çelik Kalkan yalnız alınan hasarı düşürdüğü için verilen hasar yok ile aynı.

| Eşya | Kelime | %100 | %80 | %60 |
|---|---:|---:|---:|---:|
| Yok | 5 | 650 | 450 | 300 |
| Yok | 10 | 1485 | 919 | 560 |
| Yok | 15 | 2120 | 1277 | 763 |
| Yok | 20 | 2738 | 1629 | 964 |
| Kombo Yükselteci | 5 | 715 | 476 | 308 |
| Kombo Yükselteci | 10 | 1724 | 1011 | 586 |
| Kombo Yükselteci | 15 | 2492 | 1419 | 805 |
| Kombo Yükselteci | 20 | 3236 | 1818 | 1019 |
| Arınma Taşı | 5 | 650 | 458 | 316 |
| Arınma Taşı | 10 | 1485 | 937 | 597 |
| Arınma Taşı | 15 | 2120 | 1302 | 817 |
| Arınma Taşı | 20 | 2738 | 1660 | 1033 |
| Ağır Eldiven | 5 | 780 | 540 | 360 |
| Ağır Eldiven | 10 | 1782 | 1103 | 671 |
| Ağır Eldiven | 15 | 2544 | 1532 | 915 |
| Ağır Eldiven | 20 | 3285 | 1953 | 1156 |
| Çelik Kalkan | 5 | 650 | 450 | 300 |
| Çelik Kalkan | 10 | 1485 | 919 | 560 |
| Çelik Kalkan | 15 | 2120 | 1277 | 763 |
| Çelik Kalkan | 20 | 2738 | 1629 | 964 |

### Tam motor simülasyonu

Akış: createArenaMatch → iki oyuncunun seçimleri → submitArenaWord → advanceArenaMatch, her son tarihte. Hızlar her raund bağımsız 40–60 WPM. Harf Kaosu kurbanına model varsayımı olarak %20 yazma süresi eklendi, isabet değiştirilmedi. Beceri/eşya, kalan kullanım hakkına göre yok + geçerli seçenekler arasından eşit olasılıkla çekildi. Karanlık Saat'in psikolojik etkisi modellenmedi.

| İsabet A/B | Maç | Ort. raund | KO | R1–2 KO | A kazanır | R6'ya varır |
|---|---:|---:|---:|---:|---:|---:|
| %60/%60 | 200 | 6,00 | %9 | %0 | %41,5 | %99,5 |
| %70/%60 | 200 | 5,91 | %44 | %0 | %87 | %91 |
| %80/%60 | 200 | 5,46 | %95 | %0 | %99 | %49 |
| %90/%70 | 200 | 4,62 | %100 | %0 | %99,5 | %4 |
| %90/%90 | 200 | 4,42 | %100 | %0 | %59,5 | %0,5 |

Eşit isabette A kazanma oranı yetenek üstünlüğü değildir; hız/tohum örneklemesi etkiler. Daha isabetli oyuncu oranları yalnız eşit olmayan üç satırda değerlendirilmelidir. Bu 1.000 maçta R1–2 KO yoktu.

Eşya/beceri etkisi: %60/%60, aynı 200 tohum, A'nın seçimi ilk iki raund sabit; B ve sonraki seçimler rastgele. A kazanma oranı ve aynı türdeki yok seçimine farkı, yüzde puan:

| Eşya | A kazanır | Fark |
|---|---:|---:|
| Yok | %40 | — |
| Kombo Yükselteci | %42,5 | +2,5 |
| Arınma Taşı | %43 | +3 |
| Ağır Eldiven | %44 | +4 |
| Çelik Kalkan | %42,5 | +2,5 |

| Beceri | A kazanır | Fark |
|---|---:|---:|
| Yok | %40 | — |
| Harf Kaosu (scramble) | %41,5 | +1,5 |
| Zaman Hediyesi (overtime) | %43,5 | +3,5 |
| Zaman Hırsızı (timethief) | %40 | 0 |
| Donmuş An (freeze) | %40 | 0 |
| Karanlık Saat (blindclock) | %40 | 0 |

Bu küçük farklar 200 maçta yaklaşık ±7 puan örnekleme belirsizliğinin içindedir; kesin nedensel sıralama sayılmamalı. %80/%60 deneyinde A zaten %99–100 kazandığı için eşyalar ayrışmadı.

### Öncelikli bulgular ve sayısal öneriler

1. **YÜKSEK — %60 isabette maçlar neredeyse daima altıncı raunda yığılıyor.** Şartname §10'un %60 doğrulukta 4–6 raundda KO beklentisi 5.000 HP ile karşılanmıyor: R6 %99,5, KO yalnız %9. Öneri ARENA_MATCH_HP = 5000 → 3000. Aynı 200 tohumda önce/sonra: ortalama raund 6,00 → 5,10; KO %8 → %100; R6 %100 → %29,5; R1–2 KO %0 → %0. Ara denemeler: 3500 HP = 5,66 raund / %88 KO / %69 R6; 2500 HP = 4,45 raund / %100 KO / %2,5 R6. 3000 HP son raundu erişilebilir bırakırken KO'yu yaygınlaştırıyor. Uygulanırsa bağlayıcı §2/§10 ve kod birlikte güncellenmeli.
2. **ORTA — Ağır Eldiven doğrudan hasarda öbür saldırı eşyalarından güçlü.** 20 kelime, %60 isabette yok 964; Ağır Eldiven 1156 (+%19,9); Kombo Yükselteci 1019 (+%5,7); Arınma Taşı 1033 (+%7,2). Öneri Ağır Eldiven taban çarpanı 1,20 → 1,10. Aynı 12.000 dizinin vuruş hesabında %60 hasar 5/10/15/20 kelimede önce→sonra 360→330 / 671→615 / 915→839 / 1156→1066; %80'de 540→495 / 1103→1011 / 1532→1405 / 1953→1802. Bu raund hasarı projeksiyonudur; yeni eşya değerinin tam maç kazanma oranı kaynak kodu değiştirilmeden ölçülmedi.
3. **DÜŞÜK — Beceri sürelerinde büyük bir kazanma sıçraması gözlenmedi.** İlk iki raund zorlama deneyinde en büyük artış Zaman Hediyesi +3,5 puan; Harf Kaosu +1,5; Zaman Hırsızı 0. Harf Kaosu'nun %20 yavaşlatması dış varsayımdır. Beceri süreleri ve ARENA_ROUND_BASE_DAMAGE = [100,90,80,80,80,75] şimdilik korunsun; R1–2 KO %0.



## Hasar Denetçisi — Denge ve doğruluk (GLM)

*(8 Kasım 2026 · Saf denetim: hiçbir kaynak veya test dosyası değiştirilmedi. Kontrol scriptleri `%TEMP%/opencode/hasar-denetci/` altında yazıldı (audit1/audit2/audit3/tani.mjs), modüller mutlak `pvp/shared/*.js` yolundan import edildi; motor saf API (`createArenaMatch`/`submitArenaWord`/`advanceArenaMatch`) timestamp simülasyonuyla sürüldü. Kaynak koda tek byte dokunulmadı.)*

**Denetlenen şartname:** `docs/KULLANICI-ISTEKLERI-ARENA.md` (sahibin kelimesi kelimesine isteği), `docs/ARENA-MODU.md` §5 (hasar) ve §10 (tunable), "Ajan 2 — Arena hasar modülü" tablosu.

### 1. Sahibin örneği — BİREBİR DOĞRULANDI ✅

Sahibin senaryosu: `D Y Y Y D` → "5. nin hasarı ×(1−0.10−0.15−0.23)=×0.52 düşürülür".

- Kanıt (audit1.mjs çıktısı): `resolveRoundAttacks(D Y Y Y D, R1) → [100, 52]`; `wrongPenalty(3)=0.48`; `wordDamage(5. kelime) = {amount:52, penalty:0.48, multiplier:1, base:100}` (×0.52).
- Uçlar: `wrongPenalty(7)=0.75` (tavan, hasar tabanı %25), `cleanse` ile 0; Ceza tablosu (taban 100): yanlış 1/2/3/4+ → 90/75/52/25 (×1.00/×0.75/×0.52/×0.25). Kombo: 1–3→×1.0, 4→×1.5 KOMBO, 5+→×2.0 FİNAL (combostone 1.75/2.4) — «maks kombo 4, 5'te çarpanlı FINAL» isteği kodda doğru.
- `tests/pvp-arena-damage.test.mjs`: 25/25 geçti (bağımsız koşu).

### 2. Hasar tabloları (tüm eşyalar + Çelik Kalkan)

**Tablo A — kusursuz raund toplam hasarı, saldırgan eşyası × savunan `aegis` (biçim: eşyasız savunan / aegisli savunan):**

| Saldırgan eşyası | R1 (5 kelime) | R2 (10) | R3–R5 (15) | R6 (20) |
|---|---|---|---|---|
| yok | 650 / 520 | 1485 / 1188 | 2120 / 1696 | 2738 / 2190 |
| combostone | 715 / 572 | 1724 / 1380 | 2492 / 1998 | 3236 / 2589 |
| cleanse | 650 / 520 | 1485 / 1188 | 2120 / 1696 | 2738 / 2190 |
| gauntlet | 780 / 624 | 1782 / 1426 | 2544 / 2040 | 3285 / 2628 |

Ajan 2'nin tablosu bağımsızda doğrulandı: eşyasız %80/%60 (400 rastgele raund) → R1: 457/310, R2: 928/557, R3: 1243/740, R6: 1636/968 (rastgelele benzer/tohum farkıyla; Ajan 2: 449/285, 899/561, 1267/758, 1621/971). Düzeltilmiş bir değer yok; iki bağımsız ölçüm tutarlı.

**Tablo D — KO tahmini (aynı doğruluk çiftinin 50/50 kesiştiği raund, HP'ye göre):** HP 4000 → %60/%65 6., %70/%80 5.; HP 4500 → %60 >6, %65/%70 6., %80 5.; **HP 5000 → %60/%65 >6, %70 6., %80 5.**; HP 5500/6000 → %80 bile 6. Bu, §10'daki "tipik 4–6 raund" hedefiyle uyumlu; HP artışı önerilmiyor.

### 3. 1000 rastgele maç (gerçek arena.js motoruyla)

Kurulum: 16 sıralı doğruluk çifti (%60/70/80/90 × %60/70/80/90), her maçta prep fazında rastgele eşya (%60 olasılık, maçta id başına ≤2 kullanım `ARENA_MAX_USES`) ve rastgele beceri (%50 olasılık, ≤2 kullanım); botlar raundu ~25 sn'de yazar (30 sn penceresi), Harf Kaosu kurbanının doğruluğu −15 puan. Tam motor: ilk bitiren rakip süresini keser, overtime/freezetimethief motorca uygulanır.

- **Ortalama raund:** 5.25. **KO oranı:** %84.7 (ROUNDS/beraberlik %15.3).
- **İLK RAUND KO: 0 adet** (beklendiği gibi 0). R1 üst hasar sınırı: gauntlet kusursuz 780 (combostone 715; ikisi aynı raund kullanılamaz — zorunlu kılınsaydı bile 858 < 5000 HP; aegisli savunmacıda 687). İlk raund KO matematiksel olarak imkansız ✅.
- KO raund dağılımı: R4=174, R5=404, R6=269 — hiçbir KO R1–R3'te olmadı; "4–6 raund" hedefi simülasyonda tutuyor.
- Maç sonu ortalama kalan HP: 794/5000 (oyuncu başı ortalama maç hasarı 4233).
- Rastgele maçlarda eşya başına raund hasarı (yok = 793.6): combostone +60, cleanse +40, **gauntlet +140** en güçlü ofanatif; aegis saldırıda −10 (değeri savunmada).
- Simetri kanıtı (tani.mjs): aynı botlar 2000 maç → seat1=%50.0, seat2=%50.0; kontrol eşitsiz botlar %3.5 vs %96.5 ile beklendiği gibi ayrışıyor → motor koltuk-bias göstermiyor.

**Kontrollü eşya düellosu (audit3.mjs; iki bot %70/%70, aynı hız; tutucu R1–R2'de eşya seçer, rakibi eşyasız; 300+300 maç, roller ters):**

| Tutucunun eşyası | Tutanın kazanma % | Ort. raund |
|---|---|---|
| (tabansız kontrol, ikisi de eşyasız) | 51.0 | 5.92 |
| combostone | 53.8 | 5.90 |
| cleanse | **50.0 (300–300, hiç fark yok)** | 5.90 |
| gauntlet | 55.8 | 5.88 |
| aegis | **57.3** | 5.93 |

### 4. Bulgular (öncelik sırasıyla)

**KRİTİK: yok.** Sahibin örneği, sözleşme fonksiyonları, uç-değer güvenliği (`NaN`/negatif/kesirli sayaçlar → NaNsız; `amount` hep tam sayı), Ajan 2 tabloları ve §10 hedefleri tutarlı. HP 5000 + taban `[100,90,80,80,80,75]` değişiklik **gerektirmiyor** (Tablo D: hedef aralık %70→6. raunda kadar tam oturuyor).

**YÜKSEK — blindclock kurbanın kendi süresini de gizliyor.** `pvp/shared/arena.js:233-247`. Kanıt: `const hidden=opponent?.roundSkill==='blindclock'&&r.phase==='round'` — kurban (me) ile saldırganın (opponent) alanlarına birlikte uygulanıyor: `me.remainingMs: hidden?null:..., me.blindClock: hidden` (satır 243-244) ve `opponent.remainingMs: hidden?null:...` (satır 247). §6'ya göre gizlenen yalnız **Karşıdakinin (kurbana view sunulan rakip, yani Blindclock sahibinin) kalan süresi** olmalı; `arena-skills.js:241-248` `applyPreRoundSkills` de yalnız oynatan koltuğunu işaretliyor (`blindClock: skill==='blindclock'`). Mevcut kod kurbanın kendi zamanlayıcısını da `null` yaparak o oyuncuyu oyundan çıkarma etkisi yaratmış oluyor — sahibin isteğinden ("kendi zamanını dondurursun gibisinden") bir üstünlük değil, kısıt. Önerilen düzeltme: gizlemeyi yalnız rakip alanına uygulat (`opponent.remainingMs = casterPickedBlindclock?null:...`), `me.blindClock` bayrağını kurbanın görünümünden kaldır. Ajan 5 aynı alanı raporlamıştı; bu analiz tam kapsamı gösteriyor: yanlışlık çift yönlü, hem kurbanın saati hem yabancı saati gizleniyor. Dahası: kurban kendi saati de kaybettiği için skill saldırgana istenenden fazla avantaj veriyor — bu ayrıca denge etkisi. (Motor dosyası bu denetimin kapsamı değil; düzeltme şartnameyi izleyen aunque bir Ajan 1/3 işidir.)

**ORTA — cleanse izole ölçümde tam etkisiz.** Kanıt: 600 kontrollü maçta 300–300 → kazanma %50.0 (tutucu lehine 0.0 pp); rastgele maçlarda raund hasarı yalnız +40 (combostone +60, gauntlet +140). Sebep: %70 doğruluk botunda ardışık yanlış zincirleri kısa (ceza ortalaması düşük) → arıtma değeri görünmüyor; ama mağdurda (%60) değer dengeli (+48 потолок each 3 yanlışta). Önerilen sayısal düzeltme (sadece öneri; kaynak koda dokunulmadı): `ARENA_ITEMS.cleanse.effect`'e kalıcı taban artışı ekleyin — `penalty=0` + taban +%10: beklenen raund etkisi %70 botta yaklaşık +84 → cleanse ~917/raund olur; bu gauntlet'in 933'üne yakınlaşır ve ceza-tavan tavanı (%25 hasar) ile çevrilen "düşük doğruluk≅ cleanse" senaryosunu güçlendirir. Alternatif: cleanse'i Ardışık yanlış sayacını '1'e sabitle' (penalty maks 0.10) yapın — etkisi +40'tan +112'ye çıkar (percent-based sayım Rectified: yanlış 4+ → 90/52/25 yerine 90/90 her vuruş). İkisi de Mevcut test sözleşmelerini (sahibin ×0.52 örneği eşyasız senaryo) bozmaz çünkü cleanse eşyalı yolda davranıştır.

**ORTA — gauntlet/offansif eşya farkı dar ama combostone'un kusursuz-oyuncu üst limiti yüksek.** Kusursuzlu oynayan bir oyuncu (kaç kaç özelleşilmiş turnuva senaryosu) gaunlet kusursuz R6'da 3285 hasar atar (2×5000'in %66'sı) ve R1–R4'te 2544×... kusursuz R1+R2+R3 toplam 2544'süz 4255 → kusursuz oyuncu en erken 4. raunda KO-alt edilebilir — istenen "kuruşlucu oyun 4–6 raund" tutarlı. Aksiyon önerisi YOK; tek dikkat: gauntlet +aegis aynı raund seçilebilir mi? — Evet (farklı id'ler): saldırgan gauntlet & savunan aegis → 2040 (Tablo A son sütun). Karşılıklı seçimler simetrik → denge zaten sınıf-benzer.

**DÜŞÜK — aynı milisaniyede çifte-KO sıralama koltuğu birinciye verir.** `pvp/shared/arena.js:111`: `attacks.sort(... a.submittedAt-b.submittedAt || a.fromSeat-b.fromSeat ...)` → eşit zaman damgası sıralaması seat1 lehine; resolve'daki KO kontrolü (satır 197) sıradaki ilk vuruşta maç bitirir. Kanıt: tani.mjs 2000 eşit-bot maçında KO kazananları seat1=793, seat2=789 (ölçülebilir etkisiz); pratik etki sıfıra yakın (55 ms burst limiti de var). Not olarak kaydederim; değişiklik önerilmez.

### 5. Sonuç

Hasar matematiği (arena-damage.js) sözleşmesine ve sahibin kelimelerine birebir sadık; denge değerleri (§10) simülasyonla korunmaya değer — HP veya taban değişikliği ileri sürmem gerekiyor, gerekmiyor. Tek somut düzeltme önerileri: (1) blindclock gizleme kapsamı (YÜKSEK), (2) cleanse'e sayısal güçlendirme (ORTA). Rapor üretimi sırasında tamamı proje dışı `%TEMP%\opencode\hasar-denetci\` klasöründe çalıştırıldı; proje klasörüne yalnızca bu rapor eklenmiştir.

## Ajan 9 — Rapor dosyasının kurtarılması (Codex, 05:36)

Başlık ve biçim kuralları, Fikir Ajanı 1–4, Ajan 1–2, Ajan 5, Ajan 4b, Denetçi 04:50, Raund Denetçisi 3, Ajan 6, Raund Denetçisi 1, Ajan 4a, Ajan 7 ve Hasar Denetçisi (GLM) bölümleri eski rapor çıktısı, ajan günlükleri, OpenCode denetim kaydı ve kurtarilan.json üzerinden geri alındı. Mevcut bölümler aynı sırada ve içerikte korundu. Denetçi 05:05 bölümünün yalnız başlığı bulundu; tam metin kurtarılamadı.

## Ajan 10 — Performans dalgası 2 (Codex, 05:34)

- **2B çizim:** `pvp/character-motion.css` içindeki hareketli rig filtresini statik radyal aurayla değiştirdim; sürekli `will-change` katmanlarını kaldırdım.
- **Yazma alanı:** `.pvp2-typebox` ve üst panelin `:has()` odak kurallarını, `pvp/index.js` tarafından açılıp kapanan sınıflara çevirdim.
- **Geçişler:** `rui-word` renk/kenarlık geçişlerini ve üst paneldeki genişlik geçişini kaldırdım.
- **Ses:** İlk kullanıcı tıklamasında ses bağlamlarını hazırladım. Tarayıcı kancası iki `AudioContext` oluşturmasının da ilk tıklamada gerçekleştiğini, ilk tuşta yeni bağlam açılmadığını doğruladı.

| Görüş alanı @ DPR 1 | Mod | Önce fps / p95 ms | Sonra fps / p95 ms |
|---|---|---:|---:|
| 1920×1080 | Arena 3B | 7,7 / 200 | 7,7 / 166,8 |
| 1920×1080 | Arena 2B | 60,1 / 16,7 | 60,2 / 16,7 |
| 1920×1080 | Klasik | 47,1 / 50 | 52,5 / 33,4 |
| 2400×1350 | Arena 3B | 5,7 / 233,4 | 5,5 / 200,1 |
| 2400×1350 | Arena 2B | 26,2 / 50,1 | 45,9 / 33,4 |
| 2400×1350 | Klasik | 21,3 / 100 | 37,0 / 50 |

Ölçüm, headless Chromium’da üç kelime otomatik yazılarak yapıldı. “Önce”, eski CSS maliyetlerinin aynı sürüme yeniden uygulanmasıdır; ayrı bir eski sürüm çalıştırılmadı. 3B’nin bu ortamda çok düşük FPS vermesi yazılım çizimiyle ilişkili görünüyor; Brave ve gerçek GPU’da ayrıca doğrulanmalı.

Yeni regresyon testi eklendi. `node --test tests/*.test.mjs`: **430/430 geçti**. Ölçüm sunucusu durduruldu.

> Denetçi notu: Ajan 10 dosyaya doğrudan yazmadı (rapor kurtarma işiyle çakışmasın diye); bölüm denetçi tarafından eklendi. Headless 3B FPS değerleri yazılım çizimiyle ölçüldü; gerçek GPU ölçümü (Performans Ajanı) 1920×1080 @dpr1 için ~60 FPS.

## Denetçi (Claude) — Denge kararı ve rapor dosyası olayı (05:35–09:25)
- **Denge (Hasar Denetçisi önerisi uygulandı):** `ARENA_MATCH_HP` 5000 → **3000**; Ağır Eldiven taban çarpanı ×1.2 → **×1.1** (+%10). Gerekçe: 5000 HP'de %60/%60 maçların %99,5'i 6. raunda gidiyor ve kazananı nakavt değil kalan HP belirliyordu; 3000 HP ile ortalama 5,1 raund, ilk iki raundda KO yok. Arayüz metinleri (`arena-ui.js`, `network.js`) ve şartname (`docs/ARENA-MODU.md`) güncellendi; testleri Ajan 9 yeni sabitlere bağladı.
- **Rapor dosyası olayı:** 05:05–05:10 arasında bir ajan (büyük olasılıkla bir GLM denetçisi, dosyayı baştan yazan bir araçla) bu dosyanın üzerine yazdı; erken bölümler kayboldu. Ajan 9 (Codex) bölümleri ajan günlüklerinden kelimesi kelimesine geri kurdu; kurtarılamayan tek bölümü (05:05) denetçi kendi kaydından geri koydu. Bundan sonra ajanlar raporlarını dosyaya değil denetçiye veriyor; ekleme yalnızca denetçi tarafından yapılıyor.
- **GLM kaynakları tükendi:** Evren anahtarı bu ortamda tanımlı değil; OpenCode Go kotası, OpenCode Console bakiyesi ve ücretsiz `glm-5.3-flash-free` kotası doldu. Kalan işler Codex ve Claude ajanlarıyla yürüyor.
- **Doğrulama:** 430/430 test.

## Ajan 11 — Buton ve ekran iyileştirmeleri 2 (Codex, 09:33)

- **Fikir 3 #8:** Canlı maçtaki yetenek kartları pasif gösterge olarak işaretlendi; otomatik tetiklendikleri açıklanıyor.
- **Fikir 4 #10 (kısmen):** Arena sonucunda iki oyuncunun son HP’si ve sunucunun belirlediği MVP gösteriliyor. **Rövanş** birincil, **Lobiye dön** ikincil eylem oldu.
- PvP’ye girişte sabit “Arena hazırlanıyor…” ekranı hemen açılıyor, PvP ekranı kurulunca kapanıyor.

| Ekran | Tarayıcı kontrolü |
|---|---|
| 375×812 | Klasik, Zamana Karşı, Arena hazırlık/raund ve sonuç incelendi; sonuç kartı 326 px genişlikte. |
| 768×1024 | Üç mod ve sonuç incelendi; sonuç kartı 716 px genişlikte. |
| 1920×1080 | Üç mod ve sonuç incelendi. |
| 2400×1350 | Üç mod ve sonuç incelendi. |

Dört boyutta konsol hatası, yatay taşma ve açılış ekranlarında 12 px altı görünür metin yoktu. Telefon ve tablette ölçülen görünür düğmeler en az 44 px. Geciktirilmiş betik denemesi yükleme ekranının bekleme sırasında görünüp ekran kurulunca kapandığını doğruladı. Geliştirme sunucusu durduruldu.

`node --test tests/*.test.mjs`: **432/432 geçti.** `npm.cmd run cf:validate`: **59/59 kontrol geçti.**

**Kalan fikirler:** Fikir 4 #9’daki ayrıntılı raund özeti ile #10’daki toplam ceza ve kullanılan skill/eşya dökümü tamamlanmadı.

> Denetçi notu (Claude, 09:35): 432/432 test ve 59/59 yayın kontrolü bağımsız olarak doğrulandı. Ayrıca denetçi: `ui-polish-home.css` yayın derlemesine eklenmemişti (sitede 404 verecekti) → `cloudflare/build-assets.mjs` düzeltildi ve index.html bağlantılarının derlemeye girdiğini kontrol eden test eklendi.

## Ajan 12 — Arena raund özeti ve sonuç dökümü (Codex, 09:46)

Raund özetine oyuncu başına doğru/yanlış, en iyi seri, KOMBO/FİNAL sayısı, yanlış kelime cezasıyla kaybedilen hasar, skill/eşya, verilen hasar ve kalan HP eklendi. Maç sonucuna raund bazında hasar ve seçim dökümü ile toplam hasar ve ceza kaybı tablosu eklendi. **Rövanş** ve **Lobiye dön** eylemleri korundu.

Rakibin seçimi sunucunun açık maç verisinde yer almıyor. Saldırı ve görünür etkilerden güvenilir biçimde anlaşılabilen seçimler gösteriliyor; diğerleri **“Açıklanmadı”** olarak işaretleniyor.

375×812 ve 1920×1080 Chromium kontrolünde özet ve sonuç görüntülendi, yatay taşma olmadı. Son 375 px tekrarında konsol hatası yoktu; önceki bir çalıştırmada iki geçici kaynak bağlantısı hatası görüldü. Sunucu durduruldu. `node --test tests/*.test.mjs`: **434/434 geçti**. `npm.cmd run cf:validate`: **59/59 kontrol geçti**.
> Denetçi notu (Claude, 09:48): 434/434 test ve 59/59 yayın kontrolü bağımsız olarak doğrulandı.

## Denetçi (Claude) — Gece çalışmasının kapanış özeti (09:50)
- **Sahibin istekleri:** Raund Arena (5/10/15/15/15/20 kelime, ilk bitiren raundu kapatır, hasar sonradan sırayla, yanlış çarpanı 0.10/0.15/0.23…, en fazla 4'lü kombo + 5.'de FİNAL, eşyalar, raund öncesi engel becerileri: Harf Kaosu, Zaman Hediyesi +5 sn, Zaman Hırsızı −5 sn, Donmuş An, Karanlık Saat), Zamana Karşı modu ve süre becerileri, üstte ortak ve okunaklı yazma paneli (çözümde aşağı iner), mod seçici, ana sayfadan doğrudan giriş, %80 yakınlaştırma optimizasyonu — hepsi uygulandı ve tarayıcıda oynandı.
- **Doğrulama:** 434/434 test, 59/59 yayın kontrolü; tarayıcıda Arena (nakavt ve rövanş dahil), Zamana Karşı, klasik; 1920×1080 ve 2400×1350 (≈%80) boyutlarında konsol hatası yok.
- **Açık kalanlar:** (1) Rakibin seçtiği beceri/eşya raund bitince de sunucudan açıklanmıyor (özet "Açıklanmadı" gösteriyor) — motor `ARENA_ROUND_END` yüküne iki tarafın seçimlerini eklemeli. (2) 4K benzeri çok büyük görüntülerde 3B modda seyrek takılmalar; sahibin Brave'inde %80'de doğrulanmalı. (3) Cloudflare'a yayın yapılmadı. (4) Siyah ekran düzeltmesi sahibin Brave'inde Ctrl+F5 ile doğrulanmalı.

## Ajan 13 — Raund sonunda seçimlerin açıklanması (Codex, 10:20)

Yazma fazı kapanınca iki oyuncunun seçimi `ARENA_ROUND_END.payload.picks` alanında açıklanıyor. Seçimler ayrıca `roundHistory[].picks` ve `arenaMatchResult(...).rounds[].picks` içinde yer alıyor. Özet sırasında yeniden bağlanan oyuncu bunları `arenaPublicMatch.lastRoundPicks` üzerinden görebiliyor; faz kapanmadan önce rakibin seçimi gizli kalıyor.

Arayüz, açıklanan seçimleri raund özetinde ve maç sonucunda gösteriyor. Seçim yapılmadıysa “—”, eski yükte seçim bilgisi yoksa “Açıklanmadı” kullanıyor. Oda ve antrenman akışlarının olay yükünü değiştirmeden ilettiği doğrulandı.

**Doğrulama:** `node --test tests/*.test.mjs` — 436/436 geçti. `npm.cmd run cf:validate` — 59/59 kontrol geçti.

> Denetçi notu (Claude, 10:25): 436/436 test ve 59/59 yayın kontrolü bağımsız olarak doğrulandı. Sahibin talimatıyla OpenCode Go / OpenCode Console GLM modelleri artık KULLANILMIYOR; yalnızca Evren API (evren/glm-5.3) kullanılacak. 10:20 civarında başlatılan iki OpenCode Go işi (oyuncu rehberi, arayüz denetimi) durduruldu, dosya bırakmadılar.

## Denetçi (Claude) — U4 ve U1 işleri (12:45)
GLM ajanları Evren'in 4 eşzamanlı istek sınırı yüzünden bu işleri teslim edemediği için denetçi yaptı.
- **U4 — Klasik moddaki pencere süresi hatası (düzeltildi):** `pvp/shared/match.js` bir sonraki 10 sn'lik pencereyi, çözümün (vuruşların sırayla oynatılması) bitişinden değil önceki pencerenin bitişinden başlatıyordu; çözüm süresi sonraki pencereden yeniyordu ("Pencere 3 · 3 sn"). Artık sonraki pencere çözüm bitince başlıyor ve tam 10 sn sürüyor. `tests/pvp-exchange.test.mjs` bu kurala göre güncellendi (eski test hatalı davranışı sabitliyordu). Sunucu ve bot aynı motoru kullandığı için düzeltme her yerde geçerli.
- **U1 — Arayüz denetimi düzeltmeleri:** `pvp/rounds-ui.css` içindeki 15 adet 12 px altı yazı 12 px'e çıkarıldı; sonsuz yanıp sönen sayaç animasyonu ve gölge geçişi kaldırıldı; `pvp/lobby.css` lobi panelindeki `backdrop-filter: blur(14px)` kaldırıldı (zemin zaten opak); `app.js` ana sayfadaki 10 px yazı 12 px oldu. Tarayıcıda (1920×1080, Zamana Karşı) 12 px altı yazı ve taşma yok.
- **Doğrulama:** 471/471 test.
- **Kalan:** U2 (`network.js` gereksiz yeniden çizim), U3 (saldırı sırası göstergesi), U5 (Nasıl oynanır paneli), P1–P13 sayfa cilası, R1–R3, K (karakter belgesi) — GLM kuyruğunda.

## Denetçi (Claude) — U2: network.js gereksiz yeniden çizim (13:20)
- Her maç paketinde arena iki kez çiziliyordu (`applyMatch` içinde `updateArena()` ve paket sonundaki `render()` içinde yine `updateArena()`), `render()` ayrıca bağlantı satırını iki kez yeniliyordu. Artık aynı paketteki ikinci arena çizimi atlanıyor (`arenaFresh` bayrağı) ve bağlantı satırı bir kez yenileniyor. Zamanlama ve davranış değişmedi (eşzamanlı).
- Test: `tests/pvp-dedupe26.test.mjs` içine kural testi; tüm paket 472/472.
- Tarayıcı: klasik bot maçında 25 sn boyunca can barları doğru güncellendi (2000 → 925 / 905), konsol hatası yok.

## Denetçi (Claude) — U3: Sıralı saldırı göstergesi (13:40)
- Yeni `pvp/resolve-ui.js` + `pvp/resolve-ui.css` (index.html'e bağlandı; `pvp/index.js`'e bir import + bir çağrı eklendi).
- Klasik (10 sn değiş tokuş) ve Zamana Karşı (tur sonu çözüm) modlarında: çözüm başlarken düellonun üstünde "SALDIRI SIRASI · 0/N", her vuruşta sıra numarası, saldıran tarafa turuncu çerçeve, savunana camgöbeği çerçeve + "SİPER" etiketi; çözüm bitince 1,5 sn "PENCERE n SONU · Sen X · Rakip Y". Arena'da gösterilmez (arenanın kendi çözüm ekranı var, çift özet olmasın).
- Performans: yalnız tek seferlik opacity/transform girişi, sonsuz animasyon yok; "Efektleri azalt" ve prefers-reduced-motion'da animasyonsuz.
- Test: yeni `tests/pvp-resolve-ui.test.mjs` (4 test); tüm paket 476/476. Tarayıcı (klasik bot): "SALDIRI SIRASI 0/12 … 11/12" ve "PENCERE 1 SONU · Sen 1275 · Rakip 160" görüldü, konsol hatası yok.

---

## U5 — Oyun içi "Nasıl oynanır" paneli (baş ajan Claude, GLM kuyruğu başarısız olduğu için devraldı)

**Kullanılan beceriler:** vectorlab `surfaces` (slide-over panel), `keyboard` (odak tuzağı, Esc, odak geri dönüşü), `icon-buttons` (? düğmesi + aria-label + ipucu), `reduced-motion`, `motion` (tek seferlik 200 ms giriş), `anti-slop` (blur yok, opak zemin), `viewports` (375 px'te tam genişlik).

**Yapılanlar**
- `pvp/howto.js` (yeni): 5 sekme (Modlar, Hasar ve kombo, Eşyalar, Beceriler, Kontroller). İçerik `docs/OYUN-REHBERI.md`'den, sayılar motordan (Arena 3000 HP, 5·10·15·15·15·20 kelime, Ağır Eldiven +%10). Esc `stopImmediatePropagation` ile yalnız paneli kapatır, PvP'den çıkış onayını tetiklemez. Tab odak tuzağı, ←/→ sekme geçişi.
- `pvp/howto.css` (yeni): sağdan 440 px panel, sonsuz animasyon yok, `pvp4-reduced` ve `prefers-reduced-motion` desteği.
- `pvp/index.js`: ayarlar düğmesinin soluna `?` düğmesi, `attachHowto({root})`. Yedek: scratchpad/index.before-u5.js.
- `index.html`: howto.css bağlantısı.
- `tests/pvp-howto.test.mjs` (yeni, 4 test).

**Doğrulama:** 480/480 test, cf:validate 65/65. Tarayıcı: panel açılıyor (440×768), 5 sekme, Eşyalar sekmesi geçişi, Esc paneli kapattı, odak düğmeye döndü, PvP açık kaldı.

---

## Yayın ve yükleme hızı düzeltmesi (baş ajan Claude, 8 Kasım akşamı)

**Kullanılan beceriler:** superpowers `systematic-debugging` (önce ölçüm: tünel/yerel süre, kaynak boyutları), `verification-before-completion` (tarayıcıda ölçüm + test + yayın sonrası curl).

- **Sorun:** Staging'de arena boş görünüyordu. Sayfa açılışta 22 MB indiriyordu: karakter katmanları (6 × ~2 MB, 1024×1536 PNG, ekranda ~400 px), castle-scene.png 3,2 MB, arena-king.png 2,4 MB. Yavaş bağlantıda bu resimler hiç gelmiyordu.
- **Düzeltme:** Bu 9 resim WebP'ye çevrildi; karakterler 640×960 boyutunda, toplam 19,8 MB → 1,07 MB. Kodda yollar güncellendi: app.js, arena-fire.css, exact-ui.css, pvp/pvp.css, pvp/index.js, pvp/characters.js, pvp/arena3d.js. PNG orijinalleri yerinde duruyor. Yedekler scratchpad/webp-yedek klasöründe.
- **Sonuç:** Sayfa indirmesi 22 MB → 5,4 MB. Kalanın çoğu WAV müzik ve ses dosyaları (yaklaşık 2,5 MB).
- **Testler:** Testler WebP'ye güncellendi; büyük resimlerin 400 KB altında kalmasını denetleyen yeni bir test eklendi. 481/481 test, cf:validate 65/65.
- **Yayın:** Eski staging çalışanı geçiş çakışması verdi (10074, PvPRoom). Ona dokunulmadı; oyun `tuslab-neon-pvp-staging2` adıyla yayınlandı.
- **Yerel başlatma:** `.bat` dosyaları CRLF ve ASCII yapıldı. wrangler artık `node node_modules/wrangler/bin/wrangler.js` ile çağrılıyor. Bozuk workerd yeniden kuruldu. `BASLAT-AG.bat` ve `cf:dev:lan` eklendi.

### Ek: müzik erteleme (9 Kasım)
- `pvp/index.js`: Müzik (~1,8 MB WAV) artık ekran açılır açılmaz değil, sayfa yüklendikten sonra tarayıcı boştayken (`requestIdleCallback`) indiriliyor. İlk tuşta `unlock()` müziği gerekirse yine kendisi indirir. Tuş sesleri hemen yüklenmeye devam ediyor.
- Tarayıcı ölçümü: resimler 3–5. saniyede geldi, müzik ancak bunlardan sonra başladı; hatalı istek yok. Yeni test eklendi. 482/482 test, cf:validate 65/65, staging2'ye yüklendi.
- GLM kuyruğu (P1–P13, K, R2, R3) Evren üzerinden 4 eşzamanlı ajanla yeniden başlatıldı. Önceki turda her ajan ECONNRESET bağlantı kopmalarıyla düştü. page-*.css dosyaları taranarak kurala uygun bulundu (blur kapalı, sonsuz animasyon yok, 12 px altı yazı yok), ama ajanlar bitirene kadar index.html'e bağlanmayacak.

---

## Tur arası ekranı ve ekran ölçüm düzeni (baş ajan Claude, 9 Kasım)

**Kullanılan beceriler:** superpowers `systematic-debugging`, `verification-before-completion`; vectorlab `surfaces` (tek panel, kaymasız), `viewports`, `typography`. Uyulan kural dosyası: `docs/EKRAN-KONTROL-KURALLARI.md`.

**Yeni araç:** `scripts/ekran-denetim.mjs` (yalnız geliştirme; yayına gitmez, yayında 404). Ölçtükleri: katman çakışması, içeriği kapatan katman, kesik yazı, ezilmiş kart, VS çakışması, küçük yazı, yatay taşma, ezilmiş arena, karakter boyu.

**Bulunan ve düzeltilen sorunlar (ölçülerek):**
| Ekran | Önce | Sonra |
|---|---|---|
| 1920×940 maç ortası | karakter 172 px | 0 sorun, karakter 257 px |
| 1920×940 tur arası | sonuç ve seçim kutusu ayrı ayrı; seçim kutusu beceri kartlarını ve arenayı kapatıyordu; "Donmuş An" kesik; kartlar 138 px (5 sütun) | 0 sorun; tek `.rui-inter` paneli yazma panelinin yerinde (1180×234); kartlar 235 px, adlar tam |
| 1366×650 | arena sahnesi **0 px**; kart adları kesik; panel başlıklara taşıyordu | sahne 117 px; adlar tam; panel yazma paneline sığıyor. **Kalan:** karakter 145 px, hedef 150 |
| 2400×1175 (%80 yakınlaştırma) | 35 yazı ekranda 12 px altı | 1 kalan: Q/E/R işaretleri (sabit kutu, bilerek bırakıldı) |
| Saldırı sırası etiketi | oyuncu başlıklarını ("ATEŞ" rozeti) kapatıyordu | boştaki yazma panelinin ortasında |
| Sağ "Bekleme" etiketi | VS dairesinin altına giriyordu | sağ köşeye aynalandı |

**Dosyalar:** `pvp/rounds-ui.js` (`.rui-inter`, `syncInter`), `pvp/rounds-ui.css`, `pvp/resolve-ui.js`/`.css`, yeni `pvp/compact-height.css` (index.html'de en son), `scripts/ekran-denetim.mjs`, `tests/pvp-ekran-duzen.test.mjs` (4 test).

**Doğrulama:** 486/486 test, cf:validate 66/66, staging2'ye yüklendi.

**Denetlenmeyen durumlar:** Raund Arena hazırlık, çözüm ve sonuç ekranları; klasik maç; maç sonu ekranı; telefon boyutu. Sıradaki iş bunlar.

### Ek: kalan ekranların denetimi (9 Kasım)
Ölçüm `scripts/ekran-denetim.mjs` ile yapıldı. Betikte düzeltilen yanlış alarmlar: aynı adlı öğelerin tek sayılması, kapalı `<details>` içeriği, arkası kararan modal, `font-size:0` gizli metin, açılış animasyonundaki saydam katman.

| Durum | 1920×940 (kullanıcı) | 1366×650 (dizüstü) | Not |
|---|---|---|---|
| Raund Arena hazırlık | kart başlıkları kesikti ("Harfleri kar…") → tam; **kalan: karakter 223 px (<250)** | sahne 36 → 98 px; VS "ATEŞ" rozetine biniyordu → düzeltildi; **kalan: karakter 122 px** | kısa ekranda kart açıklamaları gizlenir (aria-label'da duruyor) |
| Raund Arena yazma / çözüm / özet | 0 sorun | sahne 115 px, **karakter 142 px** | — |
| Zamana Karşı yazma + tur arası | 0 sorun | önceki turda düzeltildi | — |
| Klasik yazma + saldırı sırası | 0 sorun; saldırı sırasında giriş kapalı, etiket boştaki yazma panelinde | — | — |
| Maç sonu (modal) | 0 sorun | — | — |
| Telefon 375×812 | — | — | yatay taşma yok |

- **Değişen dosyalar:** `pvp/arena-ui.css` (kart başlığı en fazla 2 satıra sarılır), `pvp/compact-height.css` (hazırlık sıkıştırma, VS boşluğu).
- **Geri alınan deneme:** Raund Arena'da yan HP çubuğunu gizlemek oyuncu panelinin ızgarasını bozdu; sahne 0 px'e indi. Bu kural geri alındı.
- **Doğrulama:** 486/486 test, cf:validate 66/66, staging2'ye yüklendi.

---

## Dövüş oyunu tarzı sinematik geçişler (baş ajan Claude, 9 Kasım · /goal)

**Hedef:** Siteye 2XKO gibi dövüş oyunlarının hissini veren animasyonlar. 2XKO'nun görünümü, karakterleri ve markası **kopyalanmadı**. Türün ortak öğeleri TuşLab'ın kendi neon tarzıyla, özgün olarak yapıldı.
**Kullanılan beceriler:** superpowers `systematic-debugging`, `verification-before-completion`; vectorlab `motion`, `transitions`, `reduced-motion`; kural dosyası `docs/EKRAN-KONTROL-KURALLARI.md`.
**GLM:** P1–P13, K, R2 ve R3 Evren kuyruğunda yine 4 denemede de düştü (ECONNRESET, "model dolu", zaman aşımı). Hiçbirinden rapor gelmedi; iş baş ajan tarafından yapıldı.

**Zaten vardı (dokunulmadı):** vuruş donması (`choreography21`), arena sarsıntısı ve geri tepme (`fight-motion`), gecikmeli HP izi (`pvp2-health-trail`), hasar sayıları ve kombo yazısı.

**Yeni (`pvp/cinematic.js` + `pvp/cinematic.css`):**
- **VS girişi:** Kızıl ve mavi yarımlar çapraz kesilip iki yandan kayar, dövüşçüler birbirine bakar, ortada eğik büyük "VS" çarpar ve ışık çakar.
  - Online maçta 3-2-1 **geri sayımında** tam ekran oynar (2,6 sn). O sırada maç saati çalışmadığı için kimsenin yazma süresi kapanmaz.
  - Geri sayımsız başlangıçta (antrenman) **yalnız arena alanında** 1,5 sn oynar. Yazma paneli ve kelime açık kalır; ölçüldü: VS 434 px'ten başlıyor, yazma paneli 424'te bitiyor. Arena görünmüyorsa hiç oynamaz.
- **Raund bantları:** Eğik neon bant, ışık süpürmesi ve büyük yazı çarpması. Zamana Karşı'da raund sonu "K.O.!", "SÜRE!", "RAUND n BİTTİ" ve "BERABERE"; Raund Arena'da raund başı "RAUND n · YAZ!", raund sonu "RAUND n BİTTİ".
- **Zamana Karşı raund sonu sıralaması:** bant → yazma paneli aşağı iner ve söner → tur arası paneli perde gibi açılır → arena hafifçe öne çıkar (scale 1,012) → yeni raundda yazma paneli yukarıdan geri iner. Ölçülen zaman çizelgesi: bant 23,2–24,4 sn, panel 24,5 sn, yeni raund 28,2 sn.
- **"RAUND n · BAŞLA!":** Mevcut yazıya çarpma animasyonu eklendi.
- **Atlanabilirlik:** Herhangi bir tuş sinematiği kapatır; tuş oyuna gitmeye devam eder.
- **Performans:** Yalnız transform ve opacity; sonsuz animasyon ve blur yok. Hareket azaltmada yalnız kısa solma.
- **`pvp/network.js`:** COUNTDOWN ve MATCH_START için `tuslab:pvp-match` olayı eklendi (yalnız görsel).

**Bulunan ve düzeltilen hatalar:**
1. Bant kapanırken sıralama zamanlayıcısı da siliniyordu; tur arası paneli bütün ara boyunca gizli kalıyordu. Zaman çizelgesi ölçümüyle yakalandı.
2. `font:… inherit` kısaltması geçersizdi ve yazılar varsayılan boyuta düşüyordu. Aynı hata `howto.css`'de de vardı; ikisi de düzeltildi ve teste bağlandı.
3. VS yazısı ile katman aynı sınıfı taşıyordu.
4. VS ilk anda maç saatini kapatıyordu; geri sayıma ve yalnız arenaya taşındı.

**Doğrulama:**
- Testler: `tests/pvp-cinematic.test.mjs` (7 test); toplam 493/493, cf:validate 67/67.
- Tarayıcı: Panel gizliyken animasyonlar ilerlemediği için katman kopyalanıp animasyonlar 700–950. ms'de dondurularak ekran görüntüsü alındı (VS tam ekran, VS arena, K.O. bandı).
- Ekran ölçümü: 1920×940'ta maç ortası ve tur arası 0 sorun; arena büyümesi taşma yapmıyor.
- Yayın: staging2.

**Kontrol edilmeyenler:** Gerçek iki kişilik online maçta geri sayım VS'si (yalnız olay simülasyonuyla denendi); 3B arena modu.

### Ek: gerçek oyunla doğrulama (9 Kasım)
- **3B arena** (`arena=3d`, WebGL tuvali 1856×453): ekran denetimi 0 sorun, konsol hatası yok, "SÜRE!" bandı ve raund sonu sıralaması çalışıyor.
- **Gerçek iki kişilik online maç** (yerel `wrangler dev`, iki sekme: 127.0.0.1 ve localhost ayrı kimlik; oda API ile kuruldu):
  - Hazırım → COUNTDOWN → tam ekran VS 0,06–2,65 sn
  - MATCH_START 3,05 sn, VS tekrar açılmadı
  - Durum "Düello aktif · sunucu otoriteli"
- **Bulunan hata 1:** `tuslab:pvp-match` adı zaten her maç güncellemesinde gidiyordu (index.js'te 7 dinleyici). Sinematik olaylar `tuslab:pvp-cinematic` adına taşındı, test eklendi.
- **Bulunan hata 2 (önceden vardı):** `index.html`'deki satır içi betik CSP (`script-src 'self'`) tarafından her açılışta engelleniyordu; konsol hatası veriyor, "Arena hazırlanıyor…" ipucu hiç görünmüyordu. Betik `pvp/loading-hint.js` dosyasına taşındı ve teste bağlandı.
- **Doğrulama:** 494/494 test, cf:validate 68/68, staging2'ye yüklendi.

---

## Kullanıcı düzeltmeleri: güçlü efekt, ses, tam ekran arena, sıra sıra saldırı (baş ajan Claude, 9 Kasım)

**İstek:** "Daha güçlü efekt + ses efektleri" (seçim) ve "arena tam ekran olsun, altta kalmasın; saldırılar bir anda olmasın, sıra sıra olsun" (ekran görüntüsü: "SALDIRI SIRASI 5/6" anında iki saldırı birden oynuyordu).
**Kullanılan beceriler:** superpowers `systematic-debugging`, `verification-before-completion`; vectorlab `motion`, `reduced-motion`, `viewports`; `docs/EKRAN-KONTROL-KURALLARI.md`.

1. **Sıra sıra saldırı (motor):**
   - `match.js`: Adım 450 → **900 ms**; ultiden sonra ayrıca **600 ms** toparlanma.
   - `arena.js`: Aralık vuruş sayısına göre 350–800 ms (`arenaResolveStep`); toplam ≈9 sn ile sınırlı, çünkü bir raundda 40 vuruşa kadar çıkabiliyor.
   - Test: ardışık vuruşlar arası ≥900 ms; arena adım fonksiyonu. Eski iki testin bekleme süreleri yeni aralığa göre uzatıldı.
2. **Tam ekran arena (`pvp/stage-focus.js`):**
   - Saldırı sırasında yazma paneli katlanır, arena yukarı uzar ve yumuşak kayar (FLIP, yalnız transform).
   - Ölçümler (1920×940):
     | Mod | Arena (yazarken → saldırı) | Karakter (yazarken → saldırı) |
     |---|---|---|
     | Zamana Karşı | 452 → 698 px | 253 → 560 px |
     | Raund Arena | 442 → 716 px | 329 → 670 px |
     | Klasik | 531 → 775 px | 322 → 625 px |
   - Tur arasında kelime şeridi gizlenir, panel ~188 px'e iner; arena 538 px.
   - Hata: Izgara 5 satırdı; panel gizlenince alt şerit şişip arena *küçülüyordu* (452 → 248). Odakta 4 satıra indirildi.
3. **Güçlü efekt (`cinematic.js/.css`):**
   - VS ve bütün bantlara renk tonlu patlama ışığı, iki şok dalgası halkası, 14 kıvılcım ve 340 ms ekran sarsıntısı eklendi.
   - Tek seferlik, yalnız transform/opacity; hareket azaltmada kapalı.
   - Hata: `show()` eski zamanlayıcıları sildiği için sarsıntı zamanlayıcısı da siliniyordu; düzeltildi.
4. **Sesler:**
   - Mevcut özgün ses dosyaları kullanıldı: VS clash+critical, K.O. shatter+critical, SÜRE time-freeze+clash, raund başı round-start.
   - `pvpAudio.play` üzerinden çalar, oyuncunun SFX ayarına (sessiz/düzey) uyar.
5. **Yolda düzeltilenler:**
   - "RAUND n · BAŞLA!" ve "Rakip: …" yazıları raund saati çalışırken ilk kelimeyi kapatıyordu → arenanın ortasına, HP çubuklarının altına (620–716 px) taşındı.
   - Klasik modda odak kapanınca iki "SALDIRI SIRASI" etiketi kalıyordu → yer değişiminde eski etiket kaldırılıyor (test eklendi).
   - Denetim betiğine animasyonları sona sarma (gizli panede ilerlemiyorlar) ve kısa durum etiketleri için belgeli istisna eklendi.
6. **Doğrulama:** 499/499 test, cf:validate 68/68; üç modda bütün aşamalar ölçüldü (kalan tek not: Raund Arena hazırlığında karakter 223 px, önceden de vardı); staging2'ye yüklendi.

---

## Lobi paneli, dövüş hareketi v2, saldırı temposu, maç sonu ekranı (baş ajan Claude, 9 Kasım akşamı)

**Kullanılan beceriler:** vectorlab `motion` (yalnız transform/opacity, hareket azaltma; dövüş hareketi oyun içeriği olduğu için UI süre sınırı uygulanmadı), `surfaces`, `viewports`; superpowers `systematic-debugging`, `verification-before-completion`; `docs/EKRAN-KONTROL-KURALLARI.md`. GLM bu turda kullanılmadı: önceki üç turda Evren bağlantısı sürekli koptu.

1. **Lobi paneli** ("çok kötü duruyor"):
   - Sağdan açılan, ekran yüksekliğine oturan panel; iki kart: "⚔ Arkadaşınla oyna" ve "🤖 Bota karşı antrenman".
   - Teknik günlük oda dışında gizli (paneli taşırıyordu).
   - Ölçüm: 1920×940'ta kaydırmasız sığıyor; 1366×650 ve 375×812'de yalnız panel içi kayıyor; taşma ve kesik yazı yok.
   - Dosyalar: `pvp/network.js` (şablon, bütün `data-` bağlantıları korundu), yeni `pvp/lobby-v2.css`.
2. **Dövüş hareketi v2** ("sadece 12° dönüyorlar"):
   - Sebep: Bütün karakter tek parça %11–17 kayıp 4–12° dönüyordu; silah 0,38 sn'de bitiyordu.
   - Yeni koreografi (`pvp/fight-motion.js`, `FIGHT_MOVES`): hazırlık (geri çekil + çömel, silah geri) → atılış (hız çizgileri + toz) → silah 70–120° yay → temas donması → sıçrayarak dönüş. Q 0,76 sn, E 1 sn, ulti aşamaları 0,82–1,2 sn.
   - Savunanın tepkisi saldıranın vuruş anına bağlandı (`strikeAt`); geri savrulma uzatıldı.
   - Atılış mesafesi sahnede kalan boş alanla sınırlı. Bulunan hata: Önce panel kenarına göre hesaplanıyordu, oysa taşanı kesen kutu sahne (`.pvp2-stage`); arena odağında 17–37 px kesilme vardı. Düzeltildi: bütün durumlarda taşma ≤0. Atılış odakta 135–293 px, normalde 70–152 px.
   - Kare kare doğrulandı: 0 / 230 / 470 / 560 ms.
3. **Saldırı temposu** ("bi tık yavaş olsun"): Klasik ve Zamana Karşı'da adım 900 → **1300 ms**, ulti toparlanma 600 → **800 ms**; Raund Arena'da 450–1100 ms, toplam ≤12 sn.
4. **Maç sonu ekranı:**
   - Skor satırı simetrik: sağ ad kartın ortalamasını miras alıp kayıyordu; ölçüm 18/18 px.
   - Raund çipleri eşit ızgarada (en fazla 190 px).
   - Ayrıntı yazıları 13 px.
   - Yeni dosya: `pvp/results-v2.css`.
5. **Yolda düzeltilen:**
   - "Arena hazırlanıyor…" ipucu, bir dosya yüklenemezse sonsuza kadar kalıyordu → 12 sn güvenlik süresi eklendi.
   - Yerel Python sunucusu yük altında tek istek düşürmüştü; kod hatası değildi.
6. **Doğrulama:** 500/500 test, cf:validate 69/69, staging2'ye yüklendi.
