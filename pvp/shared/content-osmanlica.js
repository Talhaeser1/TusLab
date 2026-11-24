/* TuşLab — Osmanlıca kelimeler modu içeriği. Latin harfli Osmanlı Türkçesi kelime
 * + günümüz Türkçesi karşılığı (ipucu). Yazılan yalnız `kelime` alanıdır.
 * Kurallar (sürüm 2, 15 Kas 2026 "zorlaştır"): kelime en az 5 harf, küçük harf, şapkasız, tek kelime;
 * günlük dilde çok bilinenler (şehir, zaman, vatan...) yok. Seçim content-modes.js'te uzunluğa göre sıralanır.
 */
export const OSMANLICA_VERSION = 2;

const RAW = `
kavim:topluluk|kelam:söz|kamer:ay|mektep:okul|nazar:bakış|nisyan:unutma|payitaht:başkent|saadet:mutluluk|seyyah:gezgin|tabip:hekim
tedbir:önlem|tekamül:gelişim|vazife:görev|vicdan:iç ses|zulmet:karanlık|ahenk:uyum|aheste:yavaş|akıbet:son|asude:sakin|aşina:tanıdık
avare:başıboş|ayine:ayna|azamet:büyüklük|beyan:bildiri|bihaber:habersiz|cevher:öz|çehre:yüz|efkar:düşünceler|ehemmiyet:önem|elvan:renkler
encam:son|esaret:tutsaklık|evvel:önce|fazilet:erdem|gurbet:yaban|hikmet:bilgelik|himaye:koruma|hudut:sınır|ikamet:oturma|iktidar:erk
intizam:düzen|irade:istenç|istikbal:gelecek|iştirak:katılım|itimat:güven|kabiliyet:yetenek|kanaat:yetinme|kifayet:yeterlik|kudret:güç|lüzum:gerek
maarif:eğitim|mahsul:ürün|maksat:amaç|malumat:bilgi|medeniyet:uygarlık|mefkure:ülkü|mesuliyet:sorumluluk|meşakkat:zorluk|metanet:dayanıklılık|müdafaa:savunma
mükafat:ödül|münasebet:ilişki|müsabaka:yarışma|müşkül:güç|mütevazı:alçakgönüllü|muvaffakiyet:başarı|muallim:öğretmen|muharebe:savaş|muhafaza:koruma|muhakeme:yargılama
mukavemet:direnç|nezaket:incelik|rağbet:ilgi|refakat:eşlik|sadakat:bağlılık|samimiyet:içtenlik|sebat:direnme|selamet:esenlik|sükunet:dinginlik|şecaat:yiğitlik
tabiat:doğa|tahammül:dayanma|tahayyül:düşleme|tasavvur:zihinde canlandırma|tefekkür:düşünme|tevazu:alçakgönüllülük|vaziyet:durum|vesile:neden|zarafet:incelik|ehemmiyetsiz:önemsiz
mütemadiyen:sürekli|müstesna:ayrıcalıklı|istihsal:üretim|teşekkül:oluşum|mütehassıs:uzman|bilmukabele:karşılık olarak|münhasıran:yalnızca|alelacele:aceleyle|istişare:danışma|müstehzi:alaycı
tezahür:görünme|binaenaleyh:bu nedenle|istikrar:kararlılık|tereddüt:duraksama|mütereddit:kararsız|müteakip:sonraki|mütecaviz:saldırgan|müteessir:üzgün|mütehammil:dayanıklı|mütekabil:karşılıklı
mütemayil:eğilimli|müstakbel:gelecekteki|müstakil:bağımsız|müstağni:gönlü tok|müsamaha:hoşgörü|mütalaa:görüş|münakaşa:tartışma|münazara:karşılıklı tartışma|muhayyile:hayal gücü|muhakkak:kesin
muhtemelen:olasılıkla|muhteva:içerik|muhtıra:uyarı yazısı|mukaddes:kutsal|mukadderat:yazgı|mukayese:karşılaştırma|mukavele:sözleşme|mükellef:yükümlü|mülahaza:düşünce|mümanaat:engel olma
mümessil:temsilci|münevver:aydın|müsavat:eşitlik|müstahdem:hizmetli|müstahkem:berkitilmiş|müstehcen:açık saçık|müstemleke:sömürge|müstekreh:iğrenç|müşterek:ortak|mütareke:ateşkes
müteşebbis:girişimci|müteşekkir:minnettar|mütevelli:vakıf yöneticisi|müteyakkız:uyanık|müzakere:görüşme|tahakkuk:gerçekleşme|tahakküm:baskı|tahammülsüz:sabırsız|tahavvül:değişim|tahkikat:soruşturma
tahribat:yıkım|tahrifat:çarpıtma|tahsisat:ödenek|tanzimat:düzenlemeler|tasarruf:tutum|tashihat:düzeltmeler|tecessüs:merak|tecelli:belirme|tedarik:sağlama|tedavül:dolaşım
tedrici:aşamalı|tehacüm:üşüşme|mütekait:emekli|telakki:anlayış|telaffuz:söyleyiş|temayül:eğilim|temenni:dilek|temerrüt:inatçılık|tenezzül:alçalma|tenzilat:indirim
terakki:ilerleme|tesadüf:rastlantı|tesanüt:dayanışma|teselli:avuntu|teshilat:kolaylıklar|teşebbüs:girişim|teşkilat:örgüt|tetkikat:incelemeler|tezyinat:süslemeler|ihtilaf:anlaşmazlık
ihtilal:ayaklanma|ihtimam:özen|ihtiras:tutku|ihtiyat:sakınım|ihtiyari:isteğe bağlı|ihtizaz:titreşim|ikametgah:konut|iktibas:alıntı|iktisat:ekonomi|iltifat:övgü
iltimas:kayırma|imtiyaz:ayrıcalık|inhisar:tekel|inkılap:devrim|inkişaf:gelişme|inkıraz:çöküş|inşirah:ferahlık|intibak:uyum|intihap:seçim|intikal:geçiş
intizar:bekleme|irtibat:bağlantı|istidat:yetenek|istifade:yararlanma|istihdam:çalıştırma|istihkak:hak ediş|istihza:alay|istikamet:yön|istikrah:iğrenme|istinat:dayanma
istirahat:dinlenme|istiskal:soğuk davranma|istisna:ayrıklık|istitrat:konudan sapma|iştiyak:özlem|ittifak:birlik|ittihat:birleşme|izdiham:kalabalık|izzetinefis:onur|kanaatkar:yetinen
kerahet:tiksinme|mahalli:yerel|mahcubiyet:utanç|mahrumiyet:yoksunluk|malumatfuruş:bilgiç|maneviyat:moral|marifet:hüner|masumiyet:suçsuzluk|mecburiyet:zorunluluk|memnuniyet:hoşnutluk
meşguliyet:uğraş|meşruiyet:yasallık|meveddet:sevgi|mevzuat:yasalar|meziyet:erdem|muahede:antlaşma|muannit:inatçı|muavenet:yardım|muayyen:belirli|muazzam:çok büyük
mufassal:ayrıntılı|muhabere:haberleşme|muhacir:göçmen|muhafazakar:tutucu|muhalefet:karşıtlık|muhalif:karşıt|muhasara:kuşatma|muhasım:düşman|muhtasar:kısaltılmış|mukabele:karşılık
mukaddime:önsöz|muktedir:gücü yeten|musahhih:düzeltmen|muteber:geçerli|muttarit:düzenli|muvakkat:geçici|muvafakat:onay|muvazene:denge|muzaffer:üstün gelen|natamam:eksik
nazariye:kuram|nedamet:pişmanlık|nekahet:iyileşme|safahat:evreler|sahavet:cömertlik|salahiyet:yetki|sarahat:açıklık|sefahat:zevk düşkünlüğü|sefalet:yoksulluk|serbestiyet:serbestlik
sergüzeşt:serüven|serzeniş:sitem|şehadet:tanıklık|şehamet:yiğitlik|tabiiyet:uyrukluk|taaccüp:şaşma|taahhüt:yüklenme|taarruz:saldırı|taassup:bağnazlık|tababet:hekimlik
tadilat:değişiklik|tahassür:özlem|tahayyür:şaşırma|takriben:yaklaşık|tamamiyet:bütünlük|tasdikname:onay belgesi|tasfiye:arıtma|tatbikat:uygulama|tazminat:ödence|tecziye:cezalandırma
tefrika:ayrılık|tekemmül:olgunlaşma|tenakuz:çelişki|teraküm:birikme|tesahüp:sahiplenme|teslimiyet:boyun eğme|teşrifat:protokol|tezkere:belge|ulviyet:yücelik|umumiyetle:genellikle
vahamet:tehlikelilik|vaveyla:çığlık|velhasıl:kısacası|velvele:gürültü|veraset:miras|yekpare:tek parça|zaruret:zorunluluk|bilhassa:özellikle|bilakis:tersine|bilfiil:gerçekten
ekseriyetle:çoğunlukla|ekseriya:çoğunlukla|alelade:sıradan|alelhusus:özellikle|aleyhtar:karşıt|bilahare:sonradan|bilaistisna:ayrıksız|bilvesile:bu fırsatla|fevkalade:olağanüstü|gayriihtiyari:istemeden
gayrimeşru:yasa dışı|hasbelkader:rastlantıyla|kemafissabık:eskisi gibi|lüzumsuz:gereksiz|mahiyet:nitelik|mamafih:bununla birlikte|maazallah:Allah korusun|maatteessüf:ne yazık ki|nazikane:kibarca|ademimerkeziyet:yerinden yönetim
tedricen:yavaş yavaş|tekraren:yeniden|mükerrer:yinelenen|münferit:tek başına|müstefit:yararlanan|müsterih:rahat|mütecessis:meraklı|mütehayyir:şaşkın|mütemmim:tamamlayıcı|müteneffir:tiksinen
muhterem:saygıdeğer|muhtelif:çeşitli|müeyyide:yaptırım|müessese:kurum|müessir:etkili|mülakat:görüşme|münasip:uygun|münzevi:yalnız yaşayan|müracaat:başvuru|mürettep:düzmece
müsadere:el koyma|müsebbip:neden olan|müsellah:silahlı|müstacel:ivedi|müstahak:layık|müstebit:zorba|müşahede:gözlem|müşavir:danışman|mütehakkim:buyurgan|mütenasip:orantılı
müzayaka:darlık|meşveret:danışma|tevekkül:kadere boyun eğme
`;

export const OSMANLICA = Object.freeze(RAW.trim().split(/[|\n]/).map(s => s.trim()).filter(Boolean).map(s => {
  const [kelime, anlam] = s.split(':');
  return Object.freeze({kelime, anlam});
}));
