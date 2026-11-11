/* TuşLab — Osmanlıca kelimeler modu içeriği. Latin harfli Osmanlı Türkçesi kelime
 * + günümüz Türkçesi karşılığı (ipucu). Yazılan yalnız `kelime` alanıdır.
 * Sıra kolaydan zora (kısa → uzun); raund ilerledikçe ileriden seçilir.
 */
export const OSMANLICA_VERSION = 1;

const RAW = `
ab:su|ateş:od|baht:talih|bab:kapı|can:ruh|cenk:savaş|dem:an|dest:el|dil:gönül|ebr:bulut
elem:acı|eser:yapıt|fen:bilim|gam:keder|gül:çiçek|had:sınır|hak:doğru|har:diken|his:duygu|hür:özgür
ilim:bilim|kalp:yürek|kavim:topluluk|kelam:söz|kamer:ay|leyl:gece|lisan:dil|mah:ay|mana:anlam|mekteb:okul
merd:yiğit|misal:örnek|nazar:bakış|nefes:soluk|nehir:ırmak|necm:yıldız|nisyan:unutma|pak:temiz|payitaht:başkent|pir:yaşlı
rah:yol|reis:başkan|ruz:gün|rüya:düş|saadet:mutluluk|sabah:tan|sada:ses|sahil:kıyı|sebeb:neden|sema:gök
seyyah:gezgin|sual:soru|sulh:barış|şems:güneş|şeb:gece|şehir:kent|şuur:bilinç|tabib:hekim|talebe:öğrenci|tarz:biçim
tedbir:önlem|tekamül:gelişim|ufuk:çevren|usul:yöntem|vakit:zaman|vatan:yurt|vazife:görev|vicdan:içses|yad:anı|yar:sevgili
zafer:utku|zaman:çağ|zemin:yer|ziya:ışık|zulmet:karanlık|ahenk:uyum|aheste:yavaş|akıbet:son|alaka:ilgi|asude:sakin
aşina:tanıdık|avare:başıboş|ayine:ayna|azamet:büyüklük|bahar:ilkyaz|bedel:karşılık|beyan:bildiri|bihaber:habersiz|cesaret:yüreklilik|cevher:öz
cihan:dünya|civar:çevre|çehre:yüz|çeşm:göz|derya:deniz|destan:öykü|devir:çağ|diyar:ülke|dua:yakarış|efkar:düşünceler
ehemmiyet:önem|elvan:renkler|emniyet:güven|encam:son|endişe:kaygı|esaret:tutsaklık|evvel:önce|faaliyet:etkinlik|fazilet:erdem|felaket:yıkım
ferah:geniş|feryat:çığlık|gayret:çaba|gurbet:yaban|hadise:olay|hakikat:gerçek|hamle:atılım|hareket:devinim|hasret:özlem|hatıra:anı
hayal:düş|hediye:armağan|hikaye:öykü|hikmet:bilgelik|himaye:koruma|hudut:sınır|hürriyet:özgürlük|ihtimal:olasılık|ihtiyaç:gereksinim|ikamet:oturma
iktidar:erk|imkan:olanak|imtihan:sınav|intizam:düzen|irade:istenç|istikbal:gelecek|istiklal:bağımsızlık|iştirak:katılım|itimat:güven|kabiliyet:yetenek
kainat:evren|kanaat:yetinme|kıymet:değer|kifayet:yeterlik|kudret:güç|lüzum:gerek|maarif:eğitim|mağlup:yenik|mahcup:utangaç|mahsul:ürün
maksat:amaç|malumat:bilgi|medeniyet:uygarlık|mefkure:ülkü|memleket:ülke|menfaat:çıkar|merhamet:acıma|mesafe:uzaklık|mesele:sorun|mesuliyet:sorumluluk
meşakkat:zorluk|metanet:dayanıklılık|mevsim:dönem|mücadele:savaşım|müdafaa:savunma|mükafat:ödül|mümkün:olanaklı|münasebet:ilişki|müsabaka:yarışma|müşkül:güç
mütevazı:alçakgönüllü|muvaffakiyet:başarı|muallim:öğretmen|muharebe:savaş|muhabbet:sevgi|muhafaza:koruma|muhakeme:yargılama|muhteşem:görkemli|mukavemet:direnç|nihayet:son
nezaket:incelik|rağbet:ilgi|rekabet:yarış|refakat:eşlik|sadakat:bağlılık|samimiyet:içtenlik|sebat:direnme|selamet:esenlik|seyahat:gezi|sükunet:dinginlik
şecaat:yiğitlik|şefkat:sevecenlik|şöhret:ün|tabiat:doğa|tahammül:dayanma|tahayyül:düşleme|tahsil:öğrenim|takdir:beğeni|tasavvur:tasarım|tebessüm:gülümseme
tecrübe:deneyim|tefekkür:düşünme|teşekkür:sağol|tevazu:alçakgönüllülük|ümit:umut|vaziyet:durum|vesile:neden|zarafet:incelik|ziyaret:görüşme|ehemmiyetsiz:önemsiz
`;

export const OSMANLICA = Object.freeze(RAW.trim().split(/[|\n]/).map(s => s.trim()).filter(Boolean).map(s => {
  const [kelime, anlam] = s.split(':');
  return Object.freeze({kelime, anlam});
}));
