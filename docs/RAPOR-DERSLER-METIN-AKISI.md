# Rapor — Klavye dersleri zorluğu ve kesintisiz metin akışı (23 Kas 2026)

Kapsam: `home/arena.js`, `home/literature.js`, `home/typing.js`, `home/lessons.js`, `home/data/lessons.js`, `home/data/texts.js`, `home/egitim.css`, yeni testler `tests/home-*.test.mjs`. `home/home.js`, `home/home.css`, `pvp/*`, `cloudflare/*` değiştirilmedi. Commit yapılmadı.

## 1) Yapılanlar

1. **Şiir & Atasözü = kategori düğmeleri + kesintisiz oturum**
   - Seçme listeleri, sekmeler, zorluk çipleri, "Rastgele seç", "Atasözü Maratonu" ve öğe sonrası sonuç ekranı kaldırıldı. Yerine 5 düğme var: Atasözleri, Deyimler, Tekerlemeler, Özdeyişler, Şiirler. → `home/literature.js:13` (`CATEGORIES`), `:132` (`renderMenu`).
   - Düğmeye basınca oturum başlar: biten metnin yerine sıradaki **aynı tuş vuruşunda** gelir, arada ekran yok. Üstte kaynak satırı (şiir: yazar — başlık, özdeyiş: yazar, atasözü/zincir, deyim), altta son 3 yazılan. → `home/literature.js:161` (`startSession`).
   - Sürekli görünen toplamlar: WPM, doğruluk, hata, süre, **Metin** (biten öğe sayısı) ve **Bitir (Esc)** düğmesi. Esc, oturum açıkken ana sayfaya dönmez, oturumu bitirir (`keydown` yakalama aşaması + `preventDefault`). → `home/literature.js:98`.
   - Bitir sonrası tek özet (WPM, %, metin, hata, süre), kategori başına en iyi/son sonuç `litStreams[kategori]` olarak kaydedilir; "Devam et" kaldığı yerden tekrarsız sürer. Hiç yazmadan Bitir → menüye döner, kayıt yok. → `home/literature.js:210`.
   - `dailyLine()` aynen korundu.
2. **Akış motoru** → `home/arena.js`
   - `itemsFor(mode)` (`:40`), `difficulty(text)` (`:25`: uzunluk + noktalama×4 + Türkçe özel harf×2 + büyük harf×2), `createStream(mode, {rng})` (`:98`), `nextChunk(mode)` (`:136`), `STREAM_MODES`, `isStreamMode` (`:17`).
   - Sıra: önce zor kademe, kademe içi karışık. Atasözünde seviye 3–4 önce, sonra 2, sonra 1; diğerlerinde zorluk puanına göre üçte birlik dilimler. Bir turda öğe tekrar etmez; zincir atasözünün parçaları da aynı turda ayrıca gelmez. Havuz bitince yeniden karışır, sınırda aynı öğe art arda gelmez.
   - Deyimler anlamıyla yazılır ("Gözü dönmek: öfkeyle kendini kaybetmek…"), yalnız 2–3 kelime yazılmasın diye. Kaynak satırı "Deyim — anlamıyla birlikte". (İstenen "kaynak satırında anlam" yerine anlam yazılan metnin içinde.)
   - `pickText(mode)` eski arabirim olarak kaldı. Akış modlarında ≥ 110 karakter olana kadar sıradaki öğeleri birleştirir. home.js değişmese de ana ekran tekrarsız ve zor-önce çalışır.
3. **Yazma motoru akış kipi** → `home/typing.js`
   - `mountTyper(host, { stream, onChunk })`: `stream()` sıradaki parçayı verir; parça bitince `advance()` (`:503`) yeni metni hemen yükler, istatistikler sürer (`stats.chunks`, birikimli `typed/total`). Bitiş yalnız `stop()` (`:538`), Esc (`:460`) ya da "Bitir" ile. Akış biterse kendiliğinden biter. Akış verilmezse davranış eskisiyle aynı.
   - Dönen nesneye `stop`, `stats`, `item` eklendi. CSS: `home/egitim.css` "kesintisiz akış" bölümü (6 sütunlu stat çubuğu, telefonda 3 sütun, kategori kartları).
4. **Dersler orta zorluk** → `home/data/lessons.js`, `home/lessons.js`
   - Yeni `makeKeysDrill` (`data/lessons.js:216`) üç bölümden oluşur: (a) %25 yeni tuşla ritim grupları, 2–4 harf; tek yeni tuşta komşu 3 eski tuşla. (b) %50 karışık kalıp; ≥ 4 harf biliniyorsa %60 gerçek kelime. (c) %25 karışık tekrar: yarısı yalnız eski tuşlar, yarısı hepsi. Aynı harf art arda üç kez gelmez (`noTriple`), aynı grup art arda gelmez.
   - `makeWordDrill` (`:361`): her derste son %20 önceki derslerin malzemesiyle karışık tekrar. Combo derslerinde ≥ 30 gerçek kelime varsa kelime parçası kullanılmaz. Büyük harf (L34, L35) ve noktalama (L36, L37) derslerinde gerçek atasözü cümleleri var (`realSentences`, `:342`): virgül dersinde virgüllüler önce, Ç/Ş/Ğ/İ/Ö/Ü dersinde bu harflerle başlayanlar önce.
   - `rate()` daha sıkı (`lessons.js:95`). `lessonUnlocked()` (`:120`): önceki ders yıldızlıysa ya da dersin kendi kaydı varsa açık. Ders kimlikleri değişmedi.
   - Ders ekranına 3 yıldız hedefi rozeti eklendi (`lessons.js:338`).
5. **İçerik** → `home/data/texts.js` (ayrıntı 4. bölümde).
6. **Testler** (yeni): `tests/home-metin-akisi.test.mjs` (6), `tests/home-dersler.test.mjs` (8), `tests/home-typing-akis.test.mjs` (3; küçük sahte DOM ile typer akışı ve Şiir & Atasözü oturumu uçtan uca).

## 2) Yeni ders zorluk tablosu (hedef WPM / % doğruluk / uzunluk; eski değer parantezde)

| Ünite | Dersler |
|---|---|
| Temel | L01 8/94/160 (6/90/90) · L02 9/94/180 · L03 10/94/200 · L04 11/94/210 · L05 12/95/220 · L06 12/95/220 · L07 14/95/240 (10/92/150) |
| Üst | L08 13/95/220 · L09 14/95/230 · L10 15/95/240 · L11 16/95/240 · L12 16/95/240 · L13 14/94/160 · L14 18/95/260 (14/93/170) |
| Alt | L15 18/95/240 · L16 19/95/250 · L17 19/95/250 · L18 20/95/250 · L19 18/95/200 · L20 21/95/280 (17/93/190) |
| Özel | L21–L22 21/95/260 · L23–L25 22/95/260 · L26 22/96/260 (18/94/180) |
| Kombi | L27–L28 23/95/260 · L29–L30 24/95/260 · L31–L33 25/96/280 (20/94/190) |
| Büyük | L34–L35 22/95/260 · L36 23/95/280 · L37 24/96/300 (20/94/220) |
| Hız | L38 30/96/320 · L39 32/96/340 · L40 30/96/340 · L41 35/96/400 (30/95/320) |
| Ustalık | L42 28/96/300 · L43 28/96/380 · L44 26/95/320 · L45 28/96/360 · L46 28/96/320 · L47 30/96/360 |

Yıldız: ★ = hedef hız ve hedef doğruluk; ★★ = hızın 1,3 katı ve ≥ %97 (eski: 1,25 kat, doğruluk şartı yok); ★★★ = 1,6 kat ve ≥ %99 (eski: 1,5 kat ve %98). Kayıtlı yıldızlar `max` ile korunduğu için kimse kilitlenmez.

## 3) Örnek akışlar ve alıştırmalar (gerçek çıktı, sabit tohum)

Her kategoriden 3 akış, her akıştan ilk 3 öğe:

### atasozu
- akış 11: «At binenin, kılıç kuşananın.» (Atasözü, sv 3) → «Düşenin dostu olmaz; kervan yolda düzülür.» (Atasözü zinciri, sv 4) → «Mum dibine ışık vermez; güneş balçıkla sıvanmaz.» (Atasözü zinciri, sv 4)
- akış 22: «Misafir umduğunu değil, bulduğunu yer.» (Atasözü, sv 3) → «Bana arkadaşını söyle, sana kim olduğunu söyleyeyim; üzüm üzüme baka baka kararır.» (Atasözü zinciri, sv 4) → «El eli yıkar, iki el yüzü yıkar; veren el alan elden üstündür.» (Atasözü zinciri, sv 4)
- akış 33: «Azıcık aşım, kaygısız başım.» (Atasözü, sv 3) → «Çok yaşayan bilmez, çok gezen bilir; çok söyleyen çok yanılır.» (Atasözü zinciri, sv 4) → «Sağlık varsa her şey var; her şeyin başı sağlık.» (Atasözü zinciri, sv 4)
### deyim
- akış 11: «Burnundan kıl aldırmamak: çok kibirli olmak, kimseye boyun eğmemek.» (Deyim — anlamıyla birlikte) → «Mum gibi erimek: hasta olup çok zayıflamak veya çok üzülmek.» (Deyim — anlamıyla birlikte) → «Gönlünü almak: kırılan birini yatıştırmak, hoşnut etmek.» (Deyim — anlamıyla birlikte)
- akış 22: «Bir ayağı çukurda: çok yaşlı veya çok hasta, ölümün eşiğinde.» (Deyim — anlamıyla birlikte) → «Bir kulağından girip öbüründen çıkmak: dinlediğini önemsememek.» (Deyim — anlamıyla birlikte) → «Gözü dönmek: öfkeyle kendini kaybetmek, aşırı hırslanmak.» (Deyim — anlamıyla birlikte)
- akış 33: «Ağzını bıçak açmamak: üzüntü veya öfkeden hiç konuşamamak.» (Deyim — anlamıyla birlikte) → «Dilinin ucunda olmak: tam hatırlayamamak, söylemek üzereyken unutmak.» (Deyim — anlamıyla birlikte) → «Kaş yapayım derken göz çıkarmak: bir şeyi düzelteyim derken daha da bozmak.» (Deyim — anlamıyla birlikte)
### tekerleme
- akış 11: «Fırıncı fırında fırça fırça fırın fırın fırınlamış.» (Tekerleme) → «Bu yoğurdu sarımsaklasak da mı saklasak, sarımsaklamasak da mı saklasak?» (Tekerleme) → «Düdüklü düdük düdük çalınca düdüklü düdük düdüklemiş.» (Tekerleme)
- akış 22: «Gözlükçü gözlüğü gözlükçüden gözlükçüye gösterirken göz gezdirmiş.» (Tekerleme) → «Bülbül kuşu bülbülü bülbüle bulmuş, bülbül bülbülü bölmüş.» (Tekerleme) → «Şıp şıp şipşak şaşıran şapkacı şapkayı şapşal şapşala şapkalamış.» (Tekerleme)
- akış 33: «Ayşe ayakkabıyı ayağına giyince ayağı ağrımış, ağlayıp ağlayıp ağabeyine gitmiş.» (Tekerleme) → «Fırıncı fırında fırça fırça fırın fırın fırınlamış.» (Tekerleme) → «Düdüklü düdük düdük çalınca düdüklü düdük düdüklemiş.» (Tekerleme)
### ozdeyis
- akış 11: «Dünyada her şey için, medeniyet için, hayat için, muvaffakiyet için en hakiki mürşit il…» (Mustafa Kemal Atatürk) → «Muhtaç olduğun kudret damarlarındaki asil kanda mevcuttur.» (Mustafa Kemal Atatürk) → «Dün geride kaldı cancağızım, bugün yeni şeyler söylemek lazım.» (Mevlana)
- akış 22: «Dünyada her şey için, medeniyet için, hayat için, muvaffakiyet için en hakiki mürşit il…» (Mustafa Kemal Atatürk) → «Dün geride kaldı cancağızım, bugün yeni şeyler söylemek lazım.» (Mevlana) → «Ben gelmedim dava için, benim işim sevi içindir.» (Yunus Emre)
- akış 33: «Cumhuriyet sizden fikri hür, vicdanı hür, irfanı hür nesiller ister.» (Mustafa Kemal Atatürk) → «Muhtaç olduğun kudret damarlarındaki asil kanda mevcuttur.» (Mustafa Kemal Atatürk) → «Sanatsız kalan bir milletin hayat damarlarından biri kopmuş demektir.» (Mustafa Kemal Atatürk)
### siir
- akış 11: «Şu Boğaz harbi nedir? Var mı ki dünyada eşi? En kesif orduların yükleniyor dördü beşi. …» (Mehmet Akif Ersoy — Çanakkale Şehitlerine) → «Ruhumun senden, ilahi, şudur ancak emeli: Değmesin mabedimin göğsüne namahrem eli. Bu e…» (Mehmet Akif Ersoy — İstiklal Marşı (6. kıta)) → «Dadaloğlu yarın kavga kurulur, Öter tüfek, davulbazlar vurulur, Nice koç yiğitler yere …» (Dadaloğlu — Dadaloğlu yarın kavga kurulur)
- akış 22: «Ben ezelden beridir hür yaşadım, hür yaşarım. Hangi çılgın bana zincir vuracakmış? Şaşa…» (Mehmet Akif Ersoy — İstiklal Marşı (3. kıta)) → «Çatma, kurban olayım, çehreni ey nazlı hilal! Kahraman ırkıma bir gül! Ne bu şiddet, bu…» (Mehmet Akif Ersoy — İstiklal Marşı (2. kıta)) → «Ruhumun senden, ilahi, şudur ancak emeli: Değmesin mabedimin göğsüne namahrem eli. Bu e…» (Mehmet Akif Ersoy — İstiklal Marşı (6. kıta))
- akış 33: «Kim bu cennet vatanın uğruna olmaz ki feda? Şüheda fışkıracak toprağı sıksan, şüheda! C…» (Mehmet Akif Ersoy — İstiklal Marşı (5. kıta)) → «Bastığın yerleri toprak diyerek geçme, tanı! Düşün altındaki binlerce kefensiz yatanı. …» (Mehmet Akif Ersoy — İstiklal Marşı (4. kıta)) → «Çatma, kurban olayım, çehreni ey nazlı hilal! Kahraman ırkıma bir gül! Ne bu şiddet, bu…» (Mehmet Akif Ersoy — İstiklal Marşı (2. kıta))

Erken, orta ve geç derslerden 5 alıştırma:

## L01 F ve J (164/160)
fj jjf ffj jfj ffjf jjff fjf ff ffjj fjjf jjfjf fjff ffjfj jfjjf jff jffj fjjff jjfj fjjfj jjfjj jfjff fjfjj fjj jjffj fjfj jfjjfj jjfjff jjfjjf fjffj fjjfjj ffjffj

## L05 G ve H (220/220)
hg hgh ggh hhg hh gghg ghh gghh hhgg hgg gh hggh hghh hhgh halada hala hhaa halk aaga kahkaha fah halka haga aaşfa gaha gaşa aahaa ahaa aja aha aasha aşaha gag ahags şaka şakada dal sakala asasaa adada ala sakalda asafal

## L20 Alt sıra kelimeleri (286/280)
bacaktan voleybollardan meraklarda eğlence eylülde sabrım kuaförler zeytinden tilkiden mutlulukta kapamak ekmek kırdı üzerinde yemekte dondurmadan gözetmek ağ sürükledi hazirana tırmalayacak azalacak gözetti gülüşlerde oyuncuda yıkıyor aştı poliste karakollar işe heykeller ayılarda ütü

## L31 ler ve lar (293/280)
kirpikler matkaplar tavuklarda gezegenlerde tellerden biyolojiler ailelerde anneler testerelerden şişelerden televizyonlarda vatanlardan kilitlerden doktorlarda şiirler ülkelerde torunlarda pazartesilerden klavyelerde mahallelerden tiyatrocu spora köğe bakkaldan taşımaz dağılmalı çizgim borca

## L41 Kelime akışı (407/400)
küpeye katlanacak anımsamış korumaz pilava nisan korumalı ballarda bahçe aylardan eşekten gemim ulaşım yürüdü serüvenim usanmış kebabım türküm saniyeler fuarlar komşularda baharlarda dağcım futbollar şoförler teyzelerde rokette kum kuzu yanılmaz temizliyor rüya köye gürültüm tekrarlayacak tilkim tazeliyor ayırmalı tuttu tencereye kola caddeye baharım çoraplar dolaşmalı baharda küsmeli tüketmez balıkçılar


## 4) İçerik düzeltmeleri ve emin olunmayan metinler

**Yapılan düzeltmeler**
- İstiklal Marşı 4. kıta: "Düşün altında binlerce" → "Düşün **altındaki** binlerce". 6. kıta: "şehadetleri" → "**şahadetleri**". 7. kıta: "ruh-i" → "ruh-ı". 6. ve 7. kıtada "ilahi" → "İlahi".
- Nedim: "şehr-i Stanbul … bahadır" → "şehr-i **Sitanbul** … **behadır**".
- Ziya Paşa (şiir ve özdeyiş): "Ayine-i iştir" → "**Ayinesi** iştir kişinin lafa bakılmaz".
- Çanakkale türküsü: "Anne ben gidiyorum" → "**Ana** ben gidiyorum".
- Dadaloğlu: "Öter tüfek davlumbazlar" → "Öter tüfek, **davulbazlar** vurulur" (davlumbaz = ocak davlumbazı; kaynaklarda davulbaz).
- Atatürk: "Hayatta en hakiki mürşit…" → asıl cümle "Dünyada her şey için, medeniyet için, hayat için, muvaffakiyet için en hakiki mürşit ilimdir, fendir." "…nesiller isteriz" → "Cumhuriyet sizden fikri hür, vicdanı hür, irfanı hür nesiller ister." "…kayıtsız kalanları yakar, yok eder" → "…ona bigane olanları yakar, mahveder."
- Yanlış atıf işaretlendi: "Ne olursan ol yine gel" (şiir ve özdeyiş) ile "Ya olduğun gibi görün…" artık "Mevlana (atfedilen)". Bunlar Mevlana'nın eserlerinde yer almaz. "Yaratılanı hoş gör, Yaratandan ötürü" artık "Yunus Emre (atfedilen)"; Divan'da bulunmaz.
- Silinen uydurma görünümlü özdeyişler (kaynak bulunamadı): "Gönül yıkma, bir kez yıkılırsa yeniden yapılmaz." ve "Kimseye kızma, kızarsan kendi kalbini yorarsın." (Mevlana'ya atfediliyordu).
- Atasözü listesindeki 4 deyim Deyimler'e taşındı (anlamıyla): Saman altından su yürütmek, Gözünü budaktan esirgememek, Kaş yapayım derken göz çıkarmak, Yağmurdan kaçarken doluya tutulmak. Kısa tekrar "İşleyen demir ışıldar." silindi; uzun hali duruyor.
- **51 uydurma "zincir" silindi.** Gerçek bir atasözünün sonuna model yazımı yan cümle eklenmişti ve "atasözü" diye gösteriliyordu (örnek: "…; vakit nakittir, geçen gün geri gelmez", "Öğrenmek için yaşın yoktur; …"). Kalan 68 zincirin her parçası listedeki gerçek bir atasözü.
- Seviyeler kurala göre yeniden hesaplandı (49 değişiklik). Tek atasözünde puan = uzunluk + virgül×4 + özel harf×2 + kesme×2; ≤ 26 → 1, ≤ 40 → 2, üstü → 3. Zincirler 4. Örnek: "Ayağını yorganına göre uzat." 3 → 2. Yeni dağılım: 1: 25, 2: 87, 3: 54, 4: 68 (toplam 234; eski 290).
- Deyimler: "Işıkları söndürmek" silindi (anlamı uydurma). "Sözünü esirgememek" anlamı düzeltildi ("Düşündüğünü çekinmeden, açıkça söylemek"). "Burnundan kıl aldırmamak" anlamının dil bilgisi düzeltildi.
- Tekerlemeler: anlamsız ya da bozuk 4 tanesi silindi ("Kırmızı kırmızı kırmızı kız…", "Mavi mavi mavi gözlü…", "Bu yaz yağmur yağmazsa…", "Kürkçü kürkü…"). "Kırk küp kırık küpe…" geleneksel biçimine çevrildi: "Kırk küp, kırkının da kulpu kırık küp." 5 geleneksel tekerleme eklendi: Şemsi Paşa pasajı, Dal sarkar kartal kalkar, Yoğurdu sarımsaklasak, Takatukalar, Çekoslovakyalılaştıramadıklarımızdan.

**Emin olunmayanlar (değiştirilmedi, bir Türkçe okuyucusu bakmalı)**
- Fuzuli: "Aşıkı sadık **menem**" (bazı baskılarda "benem").
- Dadaloğlu: "Ağır ağır giden eller bizim el mi" (söyleyişler farklı).
- Yunus Emre "Bilmek istersen seni, can içre ara canı" (atıf: Yunus mu, başka bir mutasavvıf mı?), "Dört kitabın manası / Budur eğer var ise".
- Hacı Bektaş: "Bilgi ile yoğrulmamış yürek, gece gibidir" (kaynağı bulunamadı).
- Atatürk: "Sanatsız kalan bir milletin… kopmuş **demektir**" (asıl metinde "kopmuş olur" olabilir), "Türk milleti çalışkandır, zekidir" (sıra ve biçim).
- Mevlana: "Dün geride kaldı cancağızım…" (çeviri; çevirmen bilinmiyor).
- Atasözleri: "Konuşan gümüşse, susan altındır" (yaygın biçim "Söz gümüşse sükut altındır"), "Zaman her yarayı iyileştirir" ve "Sağlık varsa her şey var" (atasözü sözlüğünde olmayabilir), "Ağır ol, batman gelsin".
- Deyimler: "Gözünün yağı erimek", "Kırk kat", "Ters köşe yapmak" (günlük dil).
- Kalan tekerlemelerin bir kısmı geleneksel değil, geleneksel kalıpta yeni yazılmış (`docs/EGITIM-ARASTIRMA.md` bunu zaten belirtiyor).
- `docs/EGITIM-ARASTIRMA.md`'deki "zincirlerin bir kısmı açıklayıcı yan cümle ekler" notu artık geçersiz. Belge veri işçisine ait olduğu için dokunulmadı.

## 5) Doğrulama

- `node --check`: `home/arena.js`, `home/literature.js`, `home/lessons.js`, `home/typing.js`, `home/data/lessons.js`, `home/data/texts.js`, `home/data/words.js` hatasız.
- `node --test tests/home-*.test.mjs`: **20 test, 20 geçti, 0 kaldı** (17 yeni + 3 eski `home-boss3d`).
- `node --test tests/*.test.mjs`: **930 test, 907 geçti, 23 kaldı.** Kalanların hepsi `pvp-*` dosyalarında (assist31, cloudflare, dort-yetenek, fighters32, kelime-raundu-kural, mac-mekanik-i, practice, practice-rounds, raund-bant, raund-sistemi, raund-sonu, results15, rounds-engine, rounds-room, rounds-ui, runes22). Bunlar diğer işçilerin şu an değişmiş `pvp/*`, `cloudflare/*` dosyalarına bağlı; hiçbiri `home/` dosyası içermiyor. Toplamın 974'ten 930'a düşmesinin sebebi, bazı pvp test dosyalarının yüklenirken çökmesi (dosya başına 1 hata sayılıyor). Bunlara dokunulmadı.
- Tarayıcı: Bu kabukta chromium, chrome, firefox ya da playwright (node ve python) **yok**, tarayıcıda deneme **yapılmadı**. Uçtan uca davranış yalnız sahte DOM testiyle (`tests/home-typing-akis.test.mjs`) doğrulandı: 5 kategori düğmesi; liste yok; 3 atasözü ara ekransız ve tekrarsız geliyor; son yazılanlar listesi; Bitir → "Oturum bitti" ve `litStreams.atasozu = {runs:1, items:3}`; Esc'nin `preventDefault` yaptığı.

## 6) home.js'te gereken değişiklik

GEREKEN DEĞİŞİKLİK: `home/home.js` → `startTyper()` içinde `mountTyperFn(arenaHost, {` çağrısında

```js
        text: current.text,
```
satırının yerine:
```js
        text: arenaMod.isStreamMode?.(current.mode) ? '' : current.text,
        stream: arenaMod.isStreamMode?.(current.mode) ? () => arenaMod.nextChunk(current.mode) : null,
        onChunk(c) {
          const src = root.querySelector('[data-s="src"]');
          if (src) src.textContent = c && c.item && c.item.source ? '— ' + c.item.source : '';
        },
```
`newText()` içinde, metin boşa harcanmasın diye:
```js
    if (!same || !current) current = Object.assign(arenaMod.pickText(mode), { mode });
```
yerine:
```js
    if (!same || !current) current = arenaMod.isStreamMode?.(mode) ? { text: '', source: '', mode } : Object.assign(arenaMod.pickText(mode), { mode });
```
İsteğe bağlı: `finishArena(s)` sonuç kartındaki `tlh-result-nums` içine `<span><b>${num(s.chunks)}</b> metin</span>`.

Bu değişiklikle atasözü, deyim, tekerleme, özdeyiş ve şiir modlarında metinler ana ekranda da ara sonuç olmadan akar. Sonuç kartı yalnız Esc ya da "Bitir" ile çıkar. Kelime modu ve "Aynısını tekrar" eskisi gibi çalışır (akış modunda "tekrar" yeni bir akış başlatır). Değişiklik yapılmazsa da ana ekran çalışır: `pickText` artık zor-önce ve tekrarsız, ama her metinden sonra sonuç kartı çıkar.

## 7) Kalan sorunlar

- Gerçek tarayıcıda gözle kontrol yapılmadı (bu kabukta tarayıcı yok): kategori kartları, 6 sütunlu stat çubuğu, telefon görünümü ve klavye açıkken yükseklik kontrol edilmeli.
- Akış kipinde parçalar arasında düşünme süresi de toplam süreye sayılıyor (kesintisiz oturum için bilinçli seçim).
- L07 (yalnız ana sıra) için `words.js`'te sadece 30 uygun gerçek kelime var; kalan yer sözde-kelimeyle doluyor. L02–L04'te ünlü olmadığı için gruplar ünsüz dizisi.
- `home/egitim.css`'teki eski liste ve maraton stilleri (`.tl-lit-grid`, `.tl-item`, `.tl-marathon`, `.tl-seq-*`) artık kullanılmıyor ama silinmedi.
- `docs/codex/ANASAYFA-SOZLESME.md`'deki `mountTyper` imzasına `stream`, `onChunk`, `stop` eklenmeli (orkestra belgesi, dokunulmadı).
- 4. bölümdeki "emin olunmayan" metinler insan gözüyle doğrulanmalı.
