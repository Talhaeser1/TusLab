/* TuşLab — Şiir modu içeriği. YALNIZ telifsiz (kamu malı) eski şiirler:
 * tüm şairler 1900'den önce vefat etmiştir (Ziya Paşa 1880; diğerleri 13.–18. yy ya da halk/âşık geleneği).
 * 23 Kas 2026: Nedim dizesinde "Sıtanbul" → "Sitanbul" (aslı: şehr-i Sitanbul). Yazım kolaylığı için düzeltme
 * işaretleri (â, î, û) sadeleştirilmiştir. Dizeler sırayla yazılır.
 */
export const SIIR_VERSION = 1;

const P = (sair, baslik, dizeler) => Object.freeze({sair, baslik, dizeler: Object.freeze(dizeler)});

export const SIIRLER = Object.freeze([
  P('Yunus Emre', 'Gel Gör Beni Aşk Neyledi', ['Ben yürürüm yane yane', 'Aşk boyadı beni kane', 'Ne akilem ne divane', 'Gel gör beni aşk neyledi']),
  P('Yunus Emre', 'Gel Gör Beni Aşk Neyledi', ['Gah eserim yeller gibi', 'Gah tozarım yollar gibi', 'Gah akarım seller gibi', 'Gel gör beni aşk neyledi']),
  P('Yunus Emre', 'İlim', ['İlim ilim bilmektir', 'İlim kendin bilmektir', 'Sen kendini bilmezsin', 'Ya nice okumaktır']),
  P('Yunus Emre', 'Selam Olsun', ['Biz dünyadan gider olduk', 'Kalanlara selam olsun', 'Bizim için hayır dua', 'Kılanlara selam olsun']),
  P('Yunus Emre', 'Bana Seni Gerek Seni', ['Aşkın aldı benden beni', 'Bana seni gerek seni', 'Ben yanarım dün ü günü', 'Bana seni gerek seni']),
  P('Yunus Emre', 'Bana Seni Gerek Seni', ['Ne varlığa sevinirim', 'Ne yokluğa yerinirim', 'Aşkın ile avunurum', 'Bana seni gerek seni']),
  P('Yunus Emre', 'Çağırayım Mevlam Seni', ['Dağlar ile taşlar ile', 'Çağırayım Mevlam seni', 'Seherlerde kuşlar ile', 'Çağırayım Mevlam seni']),
  P('Yunus Emre', 'Gelin Tanış Olalım', ['Gelin tanış olalım', 'İşi kolay kılalım', 'Sevelim sevilelim', 'Dünya kimseye kalmaz']),
  P('Yunus Emre', 'Gönüller Yapmaya Geldim', ['Ben gelmedim dava için', 'Benim işim sevi için', 'Dostun evi gönüllerdir', 'Gönüller yapmaya geldim']),
  P('Yunus Emre', 'Mal Sahibi Mülk Sahibi', ['Mal sahibi mülk sahibi', 'Hani bunun ilk sahibi', 'Mal da yalan mülk de yalan', 'Var biraz da sen oyalan']),
  P('Yunus Emre', 'Şol Cennetin Irmakları', ['Şol cennetin ırmakları', 'Akar Allah deyu deyu', 'Çıkmış İslam bülbülleri', 'Öter Allah deyu deyu']),
  P('Yunus Emre', 'Bir Kez Gönül Yıktın İse', ['Bir kez gönül yıktın ise', 'Bu kıldığın namaz değil', 'Yetmiş iki millet dahi', 'Elin yüzün yumaz değil']),
  P('Yunus Emre', 'Yaratandan Ötürü', ['Elif okuduk ötürü', 'Pazar eyledik götürü', 'Yaratılanı severiz', 'Yaratandan ötürü']),
  P('Karacaoğlan', 'Elif', ['İncecikten bir kar yağar', 'Tozar Elif Elif diye', 'Deli gönül abdal olmuş', 'Gezer Elif Elif diye']),
  P('Karacaoğlan', 'Elif', ['Elifin uğru nakışlı', 'Yavru balaban bakışlı', 'Yayla çiçeği kokuşlu', 'Kokar Elif Elif diye']),
  P('Karacaoğlan', 'Ala Gözlüm', ['Ala gözlüm ben bu ilden gidersem', 'Zülfü perişanım kal melil melil', 'Kerem et aklından çıkarma beni', 'Ağla gözyaşını sil melil melil']),
  P('Karacaoğlan', 'Bir Ayrılık Bir Yoksulluk Bir Ölüm', ['Vara vara vardım ol kara taşa', 'Hasret ettin beni kavim kardaşa', 'Sebep ne gözden akan kanlı yaşa', 'Bir ayrılık bir yoksulluk bir ölüm']),
  P('Karacaoğlan', 'Nedendir', ['Nedendir de kömür gözlüm nedendir', 'Şu geceki benim uyumadığım', 'Çetin derler ayrılığın derdini', 'Ayrılık derdine doyamadığım']),
  P('Karacaoğlan', 'Üryan Geldim', ['Üryan geldim gene üryan giderim', 'Ölmemeye elde fermanım mı var', 'Azrail gelmiş de can talep eyler', 'Benim can vermeye dermanım mı var']),
  P('Pir Sultan Abdal', 'Yıldız Dağı', ['Gelmiş iken bir habercik sorayım', 'Niçin gitmez Yıldız Dağı dumanın', 'Gerçek erenlere yüzler süreyim', 'Niçin gitmez Yıldız Dağı dumanın']),
  P('Pir Sultan Abdal', 'Ötme Bülbül', ['Ötme bülbül ötme şen değil bağım', 'Dost senin derdinden ben yana yana', 'Tükendi fitilim eridi yağım', 'Dost senin derdinden ben yana yana']),
  P('Pir Sultan Abdal', 'Dostun Gülü', ['Şu kanlı zalimin ettiği işler', 'Garip bülbül gibi zareler beni', 'Yağmur gibi yağar başıma taşlar', 'Dostun bir fiskesi yaralar beni']),
  P('Köroğlu', 'Bolu Beyine', ['Benden selam olsun Bolu Beyine', 'Çıkıp şu dağlara yaslanmalıdır', 'Ok gıcırtısından kalkan sesinden', 'Dağlar seda verip seslenmelidir']),
  P('Köroğlu', 'Mertlik Bozuldu', ['Tüfek icat oldu mertlik bozuldu', 'Eğri kılıç kında paslanmalıdır']),
  P('Dadaloğlu', 'Dağlar Bizimdir', ['Kalktı göç eyledi Avşar elleri', 'Ağır ağır giden eller bizimdir', 'Arap atlar yakın eder ırağı', 'Yüce dağdan aşan yollar bizimdir']),
  P('Dadaloğlu', 'Dağlar Bizimdir', ['Belimizde kılıcımız Kirmani', 'Taşı deler mızrağımın temreni', 'Hakkımızda devlet etmiş fermanı', 'Ferman padişahın dağlar bizimdir']),
  P('Fuzuli', 'Gazel', ['Beni candan usandırdı cefadan yar usanmaz mı', 'Felekler yandı ahımdan muradım şemi yanmaz mı']),
  P('Fuzuli', 'Gazel', ['Aşk derdiyle hoşem el çek ilacımdan tabib', 'Kılma derman kim helakim zehri dermanındadır']),
  P('Baki', 'Gazel', ['Avazeyi bu aleme Davud gibi sal', 'Baki kalan bu kubbede bir hoş sada imiş']),
  P('Nedim', 'İstanbul Kasidesi', ['Bu şehri Sitanbul ki bimisl ü bahadır', 'Bir sengine yekpare Acem mülkü fedadır']),
  P('Muhibbi', 'Gazel', ['Halk içinde muteber bir nesne yok devlet gibi', 'Olmaya devlet cihanda bir nefes sıhhat gibi']),
  P('Ziya Paşa', 'Terkibibent', ['Ayinesi iştir kişinin lafa bakılmaz', 'Şahsın görünür rütbei aklı eserinde']),
]);

/** Sıralı dize akışı: [{metin, sair, baslik}] — raund/kelime akışına dizeler bu sırayla verilir. */
export const SIIR_DIZELERI = Object.freeze(SIIRLER.flatMap(s => s.dizeler.map(metin => Object.freeze({metin, sair: s.sair, baslik: s.baslik}))));
