// TusLab ana sayfa: Osmanlı padişahları (yazma içeriği). Baştan başlayarak sırayla eklenir.
// Şimdilik ilk 10 padişah (Osman Gazi → Kanuni Sultan Süleyman); sıradaki: II. Selim (11).
// Yalnız genel kabul gören bilgiler; tartışmalı tarihler yazılmaz. Klavyeyle yazılsın diye â/î/û yok.
// reign: saltanat yılları (gösterim için). facts: her biri ayrı yazılan bir cümle.

export const SULTANS = [
  {
    no: 1, id: 'osman-gazi', name: 'Osman Gazi', reign: 'yak. 1299–1324',
    facts: [
      "Osman Gazi, Ertuğrul Gazi'nin oğludur ve devlete adını veren Osmanlı Beyliği'nin kurucusudur.",
      "Osmanlı Beyliği'nin kuruluş yılı geleneksel olarak 1299 kabul edilir.",
      "Osman Gazi, 1302'de Koyunhisar'da Bizans kuvvetlerini yendi.",
    ],
  },
  {
    no: 2, id: 'orhan-gazi', name: 'Orhan Gazi', reign: '1324–1362',
    facts: [
      "Orhan Gazi, 1326'da Bursa'yı alarak beyliğin merkezi yaptı.",
      "Orhan Gazi döneminde ilk Osmanlı akçesi basıldı ve İznik'te ilk Osmanlı medresesi açıldı.",
      "Orhan Gazi döneminde Osmanlılar, Gelibolu yarımadasındaki Çimpe Kalesi ile Rumeli'ye geçti.",
    ],
  },
  {
    no: 3, id: 'murad-1', name: 'I. Murad (Hüdavendigar)', reign: '1362–1389',
    facts: [
      "Birinci Murad, Hüdavendigar lakabıyla da anılır; onun döneminde Edirne Osmanlı başkenti oldu.",
      "Birinci Murad döneminde yeniçeri ocağı kuruldu.",
      "Birinci Murad, 1389'daki Kosova Savaşı'nı kazandı ancak savaş alanında şehit edildi.",
    ],
  },
  {
    no: 4, id: 'bayezid-1', name: 'I. Bayezid (Yıldırım)', reign: '1389–1402',
    facts: [
      "Birinci Bayezid, seferlerde çok hızlı hareket ettiği için Yıldırım lakabıyla anılır.",
      "Yıldırım Bayezid, 1396'da Niğbolu'da Haçlı ordusunu yendi.",
      "Yıldırım Bayezid, 1402'deki Ankara Savaşı'nda Timur'a yenilip esir düştü; ardından Fetret Devri başladı.",
    ],
  },
  {
    no: 5, id: 'mehmed-1', name: 'I. Mehmed (Çelebi)', reign: '1413–1421',
    facts: [
      "Çelebi Mehmed, kardeşleriyle süren taht mücadelesini kazanarak 1413'te Fetret Devri'ni sona erdirdi.",
      "Devleti yeniden birleştirdiği için Çelebi Mehmed, Osmanlı'nın ikinci kurucusu olarak anılır.",
      "Çelebi Mehmed döneminde Şeyh Bedreddin isyanı bastırıldı.",
    ],
  },
  {
    no: 6, id: 'murad-2', name: 'II. Murad', reign: '1421–1444, 1446–1451',
    facts: [
      "İkinci Murad, tahtı oğlu Mehmed'e bırakıp çekildikten sonra yeniden padişah oldu; iki kez tahta çıktı.",
      "İkinci Murad, 1444'te Varna'da Haçlı ordusunu yendi.",
      "İkinci Murad, 1448'deki İkinci Kosova Savaşı'nı da kazandı.",
    ],
  },
  {
    no: 7, id: 'mehmed-2', name: 'II. Mehmed (Fatih)', reign: '1444–1446, 1451–1481',
    facts: [
      "İkinci Mehmed, 29 Mayıs 1453'te İstanbul'u fethetti ve Fatih unvanıyla anıldı.",
      "Fatih Sultan Mehmed, fetihten önce Boğaz'ın Avrupa yakasında Rumeli Hisarı'nı yaptırdı.",
      "Fatih Sultan Mehmed, şiirlerinde Avni mahlasını kullandı.",
    ],
  },
  {
    no: 8, id: 'bayezid-2', name: 'II. Bayezid', reign: '1481–1512',
    facts: [
      "İkinci Bayezid, saltanatının başında kardeşi Cem Sultan ile taht mücadelesi yaşadı.",
      "1492'de İspanya'dan sürülen Yahudiler, İkinci Bayezid döneminde Osmanlı topraklarına yerleştirildi.",
      "İkinci Bayezid, dindar ve sakin kişiliği yüzünden Veli lakabıyla da anılır.",
    ],
  },
  {
    no: 9, id: 'selim-1', name: 'I. Selim (Yavuz)', reign: '1512–1520',
    facts: [
      "Yavuz Sultan Selim, 1514'te Çaldıran'da Safevi hükümdarı Şah İsmail'i yendi.",
      "Yavuz Sultan Selim, 1516'da Mercidabık ve 1517'de Ridaniye savaşlarıyla Memlükleri yenip Mısır'ı aldı.",
      "Yavuz Sultan Selim'in Mısır seferinden sonra halifelik Osmanlı padişahlarına geçti.",
    ],
  },
  {
    no: 10, id: 'suleyman-1', name: 'I. Süleyman (Kanuni)', reign: '1520–1566',
    facts: [
      "Kanuni Sultan Süleyman 46 yıl tahtta kaldı; en uzun süre hüküm süren Osmanlı padişahıdır.",
      "Kanuni, 1521'de Belgrad'ı, 1522'de Rodos'u aldı ve 1526'da Mohaç'ta Macarları yendi.",
      "Kanuni Sultan Süleyman, 1566'da Zigetvar kuşatması sırasında öldü; şiirlerinde Muhibbi mahlasını kullandı.",
    ],
  },
];
