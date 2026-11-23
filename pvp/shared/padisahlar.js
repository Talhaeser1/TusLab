/** Osmanlı padişahları — PvP dövüşçüleri (baştan ilk 10: Osman Gazi → Kanuni Sultan Süleyman).
 * Saf ES modülü (sunucu, bot ve tarayıcı ortak). fighters.js bu tanımları temel kadroya ekler.
 *
 * GÖVDE (body): padişahlara özel 3B model ve portre henüz yok. Her padişah, temel kadrodaki bir
 * Meshy gövdesinin modelini, kliplerini, koreografisini ve efekt türünü kullanır (body alanı).
 * Ad, unvan, renk, beceri adları/açıklamaları, sözler ve tarih notu padişahın kendisinindir.
 * Hasar/denge arketipten gelir (fire/rune); E savunması (can/kalkan) gövdeninkiyle aynıdır, çünkü
 * E sahnesinin görseli gövdenin motifidir. Kendi modeli gelince yalnız `body` kaldırılıp
 * fighters3d.js MODEL_VARIANTS'a padişahın girişi eklenir.
 *
 * Tarih notları yalnız genel kabul gören bilgilerdir. "sozler" oyun içi repliklerdir (özgün);
 * tarihe atfedilen sözler "(atfedilen)" diye işaretlidir. Padişahların sesli repliği yok (voice:false):
 * sözler ekranda yazı olarak görünür.
 */

/** Gövdeden alınan teknik alanlar (klip, efekt, savunma türü); metinler padişahın kendisinden. */
const TECH = ['clip', 'clips', 'fx', 'heal', 'shield', 'defense', 'motif'];

/** [id, gövde, tanım] — sıra: saltanat sırası. */
export const PADISAH_DEFS = [
  ['osman', 'doran', {
    no: 1, name: 'Osman Gazi', title: 'Kurucu Bey', reign: 'yak. 1299–1324', weapon: 'Kılıç & kalkan',
    palette: {main: '#8a1c1c', accent: '#e8c15a'},
    blurb: "Ertuğrul Gazi'nin oğlu; Söğüt çevresinde kurduğu beylik, onun adıyla Osmanlı diye anıldı.",
    tarih: "1302'de Koyunhisar'da Bizans kuvvetlerini yendi.",
    skills: {
      q: {name: 'Söğüt Kılıcı', short: 'Tepeden bey kılıcı', desc: 'Bey kılıcını tepeden indirir; dengeli, net vuruş.'},
      w: {name: 'Koyunhisar Hamlesi', short: 'Yürüyüp kalkanla ezer', desc: 'Koyunhisar meydanındaki gibi öne yürür, kalkanla rakibin siperini sarsar.'},
      e: {name: 'Edebali Duası', desc: 'Şeyh Edebali\'nin duasını anar; altın kalkan ışığı bedenini sarar, o raund gelen 300 hasarı emer (kalkan).'},
      r: {name: 'Kuruluş Rüyası', short: 'Sıçrayıp yere çakılır', desc: 'Rüyasındaki ulu çınar gibi yükselir, yere çakılıp yatay keser; üç evreli ulti.'},
      s: {name: 'Bey Siperi', desc: "Söğüt'ün bey kalkanını kaldırır; darbeyi azaltır, tam zamanlamada savuşturur."},
    },
    sozler: {soz: 'Bu topraklara adalet getirmeye geldim.', e: 'Duam kalkanımdır!', r: 'Ulu çınarın gölgesi düşsün üstüne!', savunma: 'Söğüt sağlam durur!', zafer: 'Beylik ayakta, sancak yerinde.'},
  }],
  ['orhan', 'sira', {
    no: 2, name: 'Orhan Gazi', title: 'Bursa Fatihi', reign: '1324–1362', weapon: 'Akıncı mızrağı & hançer',
    palette: {main: '#1f6b4a', accent: '#d9b45a'},
    blurb: "1326'da Bursa'yı alıp merkez yaptı; ilk Osmanlı akçesi ve İznik'teki ilk medrese onun dönemindedir.",
    tarih: "Onun döneminde Osmanlılar Çimpe Kalesi ile Rumeli'ye geçti.",
    skills: {
      q: {name: 'Akıncı Mızrağı', short: 'Mızrak fırlatır', desc: 'Akıncı mızrağını rakibe fırlatır; mermi uçarak saplanır.'},
      w: {name: 'Bursa Baskını', short: 'Atılıp çifte saplar', desc: 'Bursa surlarına koşar gibi atılır, iki hançerle saplar; yakın dövüş.'},
      e: {name: 'Gece Geçişi', desc: "Boğaz'ı gece geçen akıncılar gibi sise bürünür; o raund gelen 300 hasarı yutar (kalkan)."},
      r: {name: 'Rumeli Yağmuru', short: 'Üç mızrak yağdırır', desc: 'Yana kayıp art arda üç mızrak yağdırır; üç evreli ulti.'},
      s: {name: 'Gazi Adımı', desc: 'Akıncı çevikliğiyle yana kayıp darbeyi karşılar; tam zamanlamada savuşturur.'},
    },
    sozler: {soz: 'Bursa bizim, sıra Rumeli\'de.', e: 'Sis örter, akıncı geçer.', r: 'Rumeli\'ye yağmur gibi!', savunma: 'Gazi geri adım atmaz, yer değiştirir.', zafer: 'Akçe de benim, meydan da.'},
  }],
  ['murad1', 'doran', {
    no: 3, name: 'I. Murad', title: 'Hüdavendigar', reign: '1362–1389', weapon: 'Kılıç & kalkan',
    palette: {main: '#2b3f8c', accent: '#f0c75e'},
    blurb: 'Hüdavendigar diye de anılır; döneminde Edirne başkent oldu ve yeniçeri ocağı kuruldu.',
    tarih: "1389'daki Kosova Savaşı'nı kazandı, savaş alanında şehit edildi.",
    skills: {
      q: {name: 'Edirne Kılıcı', short: 'Tepeden kılıç', desc: 'Kılıcını tepeden indirir; dengeli vuruş.'},
      w: {name: 'Yeniçeri Hücumu', short: 'Yürüyüp kalkanla ezer', desc: 'Yeni kurulan ocağın düzeniyle yürür, kalkanla ezer; yakın dövüş.'},
      e: {name: 'Ocak Kalkanı', desc: 'Yeniçeri ocağının saflarını sıklaştırır; altın kalkan bedenini sarar, o raund gelen 300 hasarı emer (kalkan).'},
      r: {name: 'Kosova Darbesi', short: 'Sıçrayıp yere çakılır', desc: 'Kosova ovasına iner gibi sıçrar, yere çakılıp yatay keser; üç evreli ulti.'},
      s: {name: 'Hüdavendigar Siperi', desc: 'Ocağın kalkan duvarını kurar; tam zamanlamada savuşturur.'},
    },
    sozler: {soz: 'Ocak hazır, saflar sık!', e: 'Ocak dağılmaz!', r: 'Kosova\'da bitireceğiz!', savunma: 'Saf bozulmaz!', zafer: 'Meydan Hüdavendigar\'ındır.'},
  }],
  ['bayezid1', 'vargr', {
    no: 4, name: 'Yıldırım Bayezid', title: 'Yıldırım', reign: '1389–1402', weapon: 'Savaş baltası',
    palette: {main: '#c99a12', accent: '#fff1a8'},
    blurb: "Seferlerde çok hızlı davrandığı için Yıldırım diye anılır; 1396'da Niğbolu'da Haçlı ordusunu yendi.",
    tarih: "1402'deki Ankara Savaşı'nda Timur'a yenildi; ardından Fetret Devri başladı.",
    skills: {
      q: {name: 'Yıldırım Darbesi', short: 'Tepeden balta darbesi', desc: 'Göz açıp kapayıncaya dek baltayı tepeden indirir; hızlı, net vuruş.'},
      w: {name: 'Niğbolu Kasırgası', short: 'Koşup dönerek çoklu vuruş', desc: 'Rakibe koşar, dönerek art arda vurur; yakın dövüş.'},
      e: {name: 'Ulu Cami Adağı', desc: "Bursa Ulu Camii'nin adağını anar; nabız nabız yükselen ışık yaralarını kapatır, 300 can toplar."},
      r: {name: 'Şimşek Fırtınası', short: 'Üç evreli girdap', desc: 'Sıçrayıp dönen bir şimşek girdabına dönüşür; üç evreli ulti.'},
      s: {name: 'Anadolu Hisarı', desc: 'Boğaz kıyısındaki hisarı gibi dimdik durur; tam zamanlamada savuşturur.'},
    },
    sozler: {soz: 'Beni bekleme, ben geldim bile!', e: 'Adağım var, düşmem!', r: 'Yıldırım iki kez düşer!', savunma: 'Hisar yerinde!', zafer: 'Gök gürledi, iş bitti.'},
  }],
  ['mehmed1', 'nyx', {
    no: 5, name: 'Çelebi Mehmed', title: 'Birleştirici', reign: '1413–1421', weapon: 'Mühür asası',
    palette: {main: '#1d7f6e', accent: '#bfe9a8'},
    blurb: "Kardeşleriyle süren taht mücadelesini kazanıp 1413'te Fetret Devri'ni bitirdi; devletin ikinci kurucusu sayılır.",
    tarih: 'Döneminde Şeyh Bedreddin isyanı bastırıldı.',
    skills: {
      q: {name: 'Birlik Oku', short: 'Işık mermisi fırlatır', desc: 'Avucundan parlayan bir mühür ışığı fırlatır.'},
      w: {name: 'Fetret Sütunu', short: 'Yakından ışık sütunu', desc: 'Kardeş kavgasını bitirir gibi rakibin dibine yürüyüp altından ışık sütunu yükseltir.'},
      e: {name: 'Yeşil Türbe Şifası', desc: "Bursa'daki Yeşil'in çinileri gibi yeşil bir halka çizer; yükselen ışık yaralarını kapatır, 300 can toplar."},
      r: {name: 'Devlet Yıldızı', short: 'Gökten yıldız indirir', desc: 'Dağılan devleti toplar gibi gökten bir yıldız indirir; üç evreli ulti.'},
      s: {name: 'Çelebi Perdesi', desc: 'Önüne ışık perdesi örer; tam zamanlamada savuşturur.'},
    },
    sozler: {soz: 'Dağılanı toplamaya geldim.', e: 'Yara kapanır, devlet toparlanır.', r: 'Tek devlet, tek yıldız!', savunma: 'Perde inik!', zafer: 'Fetret bitti.'},
  }],
  ['murad2', 'sira', {
    no: 6, name: 'II. Murad', title: 'Varna Galibi', reign: '1421–1444, 1446–1451', weapon: 'Mızrak & çifte hançer',
    palette: {main: '#5b2a86', accent: '#e2c26e'},
    blurb: "Tahtı oğlu Mehmed'e bırakıp çekildi, sonra yeniden döndü; 1444'te Varna'da Haçlı ordusunu yendi.",
    tarih: "1448'deki İkinci Kosova Savaşı'nı kazandı.",
    skills: {
      q: {name: 'Varna Mızrağı', short: 'Mızrak fırlatır', desc: 'Mızrağını rakibe fırlatır; mermi uçarak saplanır.'},
      w: {name: 'Kosova Atılışı', short: 'Atılıp çifte saplar', desc: "İkinci Kosova'daki gibi ileri atılır, iki hançerle saplar; yakın dövüş."},
      e: {name: 'Manisa İnzivası', desc: "Manisa'ya çekildiği günlerin sükûnetine bürünür; o raund gelen 300 hasarı yutar (kalkan)."},
      r: {name: 'Haçlı Bozgunu', short: 'Üç mızrak yağdırır', desc: 'Yana kayıp art arda üç mızrak yağdırır; üç evreli ulti.'},
      s: {name: 'Dönüş Adımı', desc: 'Geri çekilir ama hep geri döner; tam zamanlamada savuşturur.'},
    },
    sozler: {soz: 'Çekildim sanma, döndüm.', e: 'Sükûnet de bir kalkandır.', r: 'Varna\'yı hatırla!', savunma: 'Bir adım geri, iki adım ileri.', zafer: 'İkinci kez kazandım.'},
  }],
  ['fatih', 'nyx', {
    no: 7, name: 'Fatih Sultan Mehmed', title: 'Fatih', reign: '1444–1446, 1451–1481', weapon: 'Şahi topu & asa',
    palette: {main: '#a3121f', accent: '#ffd36b'},
    blurb: "29 Mayıs 1453'te İstanbul'u fethetti; fetihten önce Boğaz'ın Avrupa yakasında Rumeli Hisarı'nı yaptırdı.",
    tarih: 'Şiirlerinde Avni mahlasını kullandı.',
    skills: {
      q: {name: 'Şahi Güllesi', short: 'Gülle fırlatır', desc: 'Şahi topunun güllesi gibi parlayan bir mermi fırlatır.'},
      w: {name: 'Rumeli Hisarı', short: 'Yakından ışık sütunu', desc: 'Rakibin dibinden hisar burcu gibi bir ışık sütunu yükseltir.'},
      e: {name: 'Akşemseddin Duası', desc: 'Hocası Akşemseddin\'in duasını anar; dönen bir şifa halkası yaralarını kapatır, 300 can toplar.'},
      r: {name: 'Gemiler Karadan', short: 'Gökten dev gülle', desc: "Gemileri karadan Haliç'e indirir gibi umulmadık yerden vurur: gökten dev bir gülle iner; üç evreli ulti."},
      s: {name: 'Sur Dibi Perdesi', desc: 'Surların dibinde perde örer; tam zamanlamada savuşturur.'},
    },
    sozler: {soz: "Ya ben İstanbul'u alırım, ya İstanbul beni! (atfedilen)", e: 'Hocamın duası yanımda.', r: 'Gemiler karadan yürüsün!', savunma: 'Sur sağlam!', zafer: 'Bir çağ kapandı, bir çağ açıldı.'},
  }],
  ['bayezid2', 'nyx', {
    no: 8, name: 'II. Bayezid', title: 'Veli', reign: '1481–1512', weapon: 'Külliye asası',
    palette: {main: '#2f6e9e', accent: '#e8f1d0'},
    blurb: "Sakin ve dindar kişiliği için Veli diye anılır; 1492'de İspanya'dan sürülen Yahudiler onun döneminde Osmanlı topraklarına yerleşti.",
    tarih: 'Saltanatının başında kardeşi Cem Sultan ile taht mücadelesi yaşadı.',
    skills: {
      q: {name: 'Külliye Işığı', short: 'Işık mermisi fırlatır', desc: 'Avucundan külliye kandili gibi bir ışık fırlatır.'},
      w: {name: 'Veli Sütunu', short: 'Yakından ışık sütunu', desc: 'Sakin adımlarla rakibin dibine yürür, altından külliye minaresi gibi bir ışık sütunu yükseltir.'},
      e: {name: 'Darüşşifa', desc: "Edirne'deki darüşşifasının şifasını taşır; dönen halkadan yükselen ışık yaralarını kapatır, 300 can toplar."},
      r: {name: 'Kemal Reis Donanması', short: 'Gökten ateş indirir', desc: 'Kemal Reis\'in donanmasının topları gibi gökten ateş indirir; üç evreli ulti.'},
      s: {name: 'Veli Perdesi', desc: 'Sabırla önüne bir perde örer; tam zamanlamada savuşturur.'},
    },
    sozler: {soz: 'Kavga istemem, ama kaçmam da.', e: 'Şifa herkese.', r: 'Kemal Reis, ateş!', savunma: 'Sabır kalkandır.', zafer: 'Hayırlı olsun.'},
  }],
  ['yavuz', 'vargr', {
    no: 9, name: 'Yavuz Sultan Selim', title: 'Yavuz', reign: '1512–1520', weapon: 'Savaş baltası',
    palette: {main: '#5a0f1a', accent: '#e0a64a'},
    blurb: "1514'te Çaldıran'da Şah İsmail'i yendi; 1516 Mercidabık ve 1517 Ridaniye ile Mısır'ı aldı.",
    tarih: 'Mısır seferinden sonra halifelik Osmanlı padişahlarına geçti.',
    skills: {
      q: {name: 'Çaldıran Baltası', short: 'Tepeden balta darbesi', desc: 'Baltayı iki elle tepeden indirir; hızlı, sert vuruş.'},
      w: {name: 'Ridaniye Kasırgası', short: 'Koşup dönerek çoklu vuruş', desc: 'Rakibe koşar, dönerek art arda vurur; yakın dövüş.'},
      e: {name: 'Sina Çölü Nefesi', desc: 'Sina Çölü\'nü aşan ordunun inadıyla yaralarını dağlar; 300 can toplar.'},
      r: {name: 'Mercidabık Fırtınası', short: 'Üç evreli girdap', desc: 'Mercidabık ovasındaki hücum gibi sıçrayıp dönen bir girdaba dönüşür; üç evreli ulti.'},
      s: {name: 'Yavuz Duruşu', desc: 'Keskin bakışıyla baltayı siper alır; tam zamanlamada savuşturur.'},
    },
    sozler: {soz: 'Sekiz yıl yeter, oyalanmayalım.', e: 'Çölü geçtim, bunu da geçerim.', r: 'Mercidabık\'tan selam!', savunma: 'Yavuz geri durmaz.', zafer: 'Doğu da batı da duydu.'},
  }],
  ['kanuni', 'doran', {
    no: 10, name: 'Kanuni Sultan Süleyman', title: 'Kanuni', reign: '1520–1566', weapon: 'Kılıç & kalkan',
    palette: {main: '#0f5e4f', accent: '#f4d47c'},
    blurb: '46 yıl tahtta kaldı; en uzun süre hüküm süren Osmanlı padişahıdır. Şiirlerinde Muhibbi mahlasını kullandı.',
    tarih: "1521'de Belgrad'ı, 1522'de Rodos'u aldı; 1526'da Mohaç'ta Macarları yendi.",
    skills: {
      q: {name: 'Belgrad Kılıcı', short: 'Tepeden kılıç', desc: 'Kılıcını tepeden indirir; dengeli vuruş.'},
      w: {name: 'Mohaç Hücumu', short: 'Yürüyüp kalkanla ezer', desc: 'Mohaç ovasındaki gibi öne yürür, kalkanla ezer; yakın dövüş.'},
      e: {name: 'Kanunname Kalkanı', desc: 'Kanunnamesini kalkan yapar; altın ışık bedenini sarar, o raund gelen 300 hasarı emer (kalkan).'},
      r: {name: 'Rodos Kuşatması', short: 'Sıçrayıp yere çakılır', desc: 'Kale burcundan iner gibi sıçrar, yere çakılıp yatay keser; üç evreli ulti.'},
      s: {name: 'Muhibbi Siperi', desc: 'Divanın ağırbaşlılığıyla kalkanı kaldırır; tam zamanlamada savuşturur.'},
    },
    sozler: {soz: 'Halk içinde muteber bir nesne yok devlet gibi. (Muhibbi)', e: 'Kanun herkesi korur.', r: 'Rodos da düştü!', savunma: 'Adalet sağlamdır.', zafer: 'Kırk altı yıl, bir gün daha.'},
  }],
];

/** Temel kadroyla birleştirilecek padişah dövüşçüleri ({id: fighter}). */
export function buildPadisahlar(base) {
  const out = {};
  for (const [id, body, d] of PADISAH_DEFS) {
    const b = base[body];
    if (!b) throw new Error(`padişah gövdesi yok: ${body}`);
    const skills = {};
    for (const key of Object.keys(b.skills)) {
      const tech = {};
      for (const t of TECH) if (b.skills[key][t] !== undefined) tech[t] = b.skills[key][t];
      const own = d.skills[key] || {};
      skills[key] = {...tech, short: b.skills[key].short, ...own, ...(key === 'e' || key === 's' ? {short: b.skills[key].short} : {})};
    }
    out[id] = {
      id, name: d.name, title: d.title, archetype: b.archetype, source: b.source, weapon: d.weapon,
      model: b.model, body, padisah: d.no, reign: d.reign, voice: false,
      palette: {...d.palette, hex: parseInt(d.palette.main.slice(1), 16)},
      blurb: d.blurb, tarih: d.tarih, sozler: {...d.sozler}, skills,
    };
  }
  return out;
}
