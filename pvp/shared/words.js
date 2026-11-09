/* TuşLab — shared seeded Turkish word bank.
 * Pure ES module, no dependencies, no Intl/locale APIs: the same seed and
 * arguments give the same output in the Worker (server) and in the browser.
 * Randomness only uses Math.imul / bit operations (mulberry32), which are
 * bit-exact on every JS engine.
 */
export const WORD_BANK_VERSION = 1;

// Words grouped by role so pickSentence can build natural-ish phrases.
const ADJECTIVES = [
  'güçlü','yeni','büyük','küçük','sakin','hızlı','yavaş','parlak','karanlık','sıcak',
  'soğuk','temiz','uzun','kısa','geniş','dar','yüksek','alçak','derin','hafif',
  'ağır','tatlı','ekşi','taze','eski','genç','güzel','mutlu','neşeli','sessiz',
  'renkli','mavi','kırmızı','yeşil','sarı','beyaz','siyah','mor','turuncu','pembe',
  'gri','cesur','dikkatli','akıllı','çalışkan','sabırlı','meraklı','nazik','dürüst','cömert',
  'kibar','şirin','yorgun','ıslak','kuru','yumuşak','sert','düz','yuvarlak','keskin',
  'kalın','ince','basit','kolay','zor','önemli','gizli','açık','kapalı','dolu',
  'boş','yakın','uzak','erken','özel','ortak','doğal','canlı','çevik','tuhaf',
  'komik','değerli','ucuz','pahalı','rahat','kararlı','ılık','serin','bulutlu','güneşli',
  'yağmurlu','karlı','rüzgarlı','çiçekli','ışıklı','gümüş','sağlam','dengeli','düzenli','çeşitli',
  'güvenli','özgür','ölçülü','şaşkın','sevimli','görkemli','heyecanlı','mükemmel','muhteşem','olağanüstü',
  'şaşırtıcı','iyi','aynı','minik','kocaman','çalışkanca','dikdörtgen','üçgen','sıradan','eğlenceli',
];
const NOUNS = [
  // nature & weather
  'güneş','ay','yıldız','bulut','yağmur','kar','rüzgar','fırtına','gökyüzü','deniz',
  'göl','nehir','dere','dağ','tepe','orman','ağaç','yaprak','çiçek','çimen',
  'toprak','taş','kum','kaya','ada','dalga','şelale','gökkuşağı','şimşek','sis',
  'buz','ateş','duman','ışık','gölge','sabah','akşam','gece','öğle','mevsim',
  'bahar','yaz','kış','sonbahar','ilkbahar',
  // animals
  'kedi','köpek','kuş','balık','at','inek','koyun','keçi','tavuk','ördek',
  'kaz','tavşan','sincap','kaplumbağa','kelebek','arı','karınca','yunus','penguen','zürafa',
  'fil','aslan','kaplan','ayı','tilki','kurt','baykuş','martı','serçe','güvercin',
  'kirpi','geyik','zebra','papağan','kartal','yengeç','ahtapot','salyangoz','ceylan','kunduz',
  // food & drink
  'ekmek','peynir','zeytin','domates','biber','patates','soğan','havuç','elma','armut',
  'kiraz','çilek','üzüm','karpuz','kavun','muz','portakal','limon','şeftali','erik',
  'incir','ceviz','fındık','bal','reçel','süt','yoğurt','çorba','pilav','makarna',
  'börek','simit','pasta','kurabiye','çikolata','dondurma','salata','yumurta','çay','kahve',
  'limonata','meyve','sebze','ayçiçeği','mısır','fasulye','mercimek','nohut','kekik','nane',
  // home & objects
  'ev','kapı','pencere','duvar','masa','sandalye','koltuk','yatak','yastık','battaniye',
  'halı','perde','lamba','ayna','saat','tabak','bardak','kaşık','çatal','bıçak',
  'tencere','tava','fincan','şişe','kutu','çanta','cüzdan','anahtar','kalem','silgi',
  'defter','kitap','kağıt','zarf','resim','fotoğraf','harita','pusula','şemsiye','gözlük',
  'şapka','eldiven','atkı','ceket','gömlek','ayakkabı','çorap','düğme','yüzük','kolye',
  'top','uçurtma','oyuncak','bisiklet','araba','otobüs','tren','gemi','uçak','kayık',
  'telefon','bilgisayar','klavye','ekran','fare','kablo','pil','radyo','televizyon','buzdolabı',
  'çekiç','makas','ip','iğne','fırça','boya','kova','merdiven','sepet','kalkan',
  'kılıç','zırh','kule','şato','köprü','çeşme','bahçe','tarla','köy','şehir',
  'sokak','cadde','meydan','çarşı','pazar','okul','sınıf','kütüphane','müze','park',
  'hastane','fırın','mutfak','oda','salon','balkon','çatı','bodrum','arena','yol',
  // people & roles
  'çocuk','arkadaş','komşu','öğretmen','öğrenci','doktor','aşçı','pilot','çiftçi','ressam',
  'yazar','şoför','bekçi','usta','kaptan','savaşçı','gezgin','oyuncu','takım','aile',
  'kardeş','dede','nine','teyze','amca','bebek','misafir','yolcu','kullanıcı','yazılımcı',
  // abstract & school
  'bilgi','fikir','soru','cevap','sorun','çözüm','sonuç','hedef','plan','ders',
  'sınav','ödev','proje','örnek','görev','oyun','şarkı','müzik','dans','hikaye',
  'masal','rüya','umut','sevgi','cesaret','dikkat','sabır','başarı','hata','deneme',
  'hız','güç','gücü','zaman','dakika','saniye','hafta','yıl','gün','tatil',
  'yolculuk','macera','sürpriz','hediye','mektup','haber','dostluk','arkadaşlık','mutluluk','özgürlük',
  'güzellik','dürüstlük','sorumluluk','değişim','gelişim','düşünce','görüş','yöntem','kural','ritim',
  'algoritma','program','kod','veri','test','işlem','değer','süre','eşik','çıktı',
  'şekil','renk','ses','koku','tat','adım','adımlar','rün','rünler','tuş',
  'kelime','cümle','paragraf','harf','sayfa','satır','puan','rekor','seviye','ödül',
  'güven','özen','öğüt','ölçü','şüphe','çığır','gülüş','düğüm','ışın','dönüş',
  'üretim','çevre','şirket','ışıldak','güçlük','çalışma','düello','düellonun','kalkanın','kelimeyle',
];
const PLACES = [
  'evde','okulda','parkta','bahçede','denizde','ormanda','dağda','köyde','şehirde','yolda',
  'sokakta','odada','mutfakta','masada','kapıda','çarşıda','pazarda','sınıfta','müzede','tarlada',
  'arenada','şatoda','kulede','köprüde','gölde','nehirde','sahilde','adada','meydanda','balkonda',
  'çatıda','trende','gemide','otobüste','kütüphanede','salonda','koridorda','yaylada','vadide','bulutlarda',
];
const ADVERBS = [
  'yavaşça','hızla','sessizce','dikkatle','birlikte','bugün','yarın','şimdi','sonra','önce',
  'hemen','bazen','daima','çabucak','usulca','neşeyle','sabırla','cesaretle','özenle','kolayca',
  'güzelce','yeniden','tekrar','erkenden','sabahleyin','gülerek','koşarak','düşünerek','sakince','gerçekten',
  'aniden','nihayet','yine','artık','sürekli','dikkatlice','ışıldarken','mutlulukla','sevinçle','heyecanla',
];
const VERBS = [
  'koşar','yürür','uyur','okur','bekler','gülümser','çalışır','oynar','söyler','dinler',
  'izler','bakar','açar','taşır','toplar','kurar','bulur','arar','sever','öğrenir',
  'öğretir','düşünür','anlatır','konuşur','başlar','biter','döner','gelir','gider','kalır',
  'uçar','yüzer','zıplar','tırmanır','saklanır','parlar','eser','yağar','akar','büyür',
  'değişir','kazanır','artar','verir','buluşur','hazırlar','pişirir','yıkar','temizler','çizer',
  'boyar','keser','diker','sular','besler','sayar','ölçer','seçer','dener','çözer',
  'düzenler','paylaşır','dinlenir','uyanır','ışıldar','parıldar','titrer','sallanır','dolaşır','gezer',
  'keşfeder','tanır','hatırlar','bekleşir','yankılanır','gülüşür','mırıldanır','ilerler','yükselir','tamamlar',
];
// Words that do not fit the sentence templates (function words, verb roots,
// longer derived forms). Includes the home-page practice vocabulary.
const EXTRA = [
  've','bir','her','ile','için','gibi','daha','çok','az','ama',
  'fakat','çünkü','belki','kadar','şöyle','böyle','ben','sen','biz','siz',
  'onun','şu','bu','var','yok','son','ilk','üç','iki','beş',
  'altı','yedi','sekiz','dokuz','on','yüz','bin','iş','su','el',
  'göz','kol','baş','çöz','gel','git','öğren','yazmak','anlamak',
  'öğrenmek','çözmek','üretmek','başlat','doğru','kodlama','yazılım','gözlem',
  'yankılanan','başladığını',
  'üçüncü','dördüncü','beşinci','çeşitlilik','düşünceler','pencereler','sandalyeler','öğretmenler','öğrenciler',
  'arkadaşlar','çalışkanlık','değişiklik','geliştirme','çözümleme','düzenleme','güçlendirme','hatırlatma','gülümseme','yürüyüş',
  'koşucu','yüzücü','dalgıç','gözlükçü','kitapçı','çiçekçi','bahçıvan','fırıncı','dondurmacı','çikolatalı',
  'şekerleme','meyveli','sütlaç','kahvaltı','akşamüstü','gündüz','gecelik','yağmurluk','şemsiyeli','kardan',
  'buzlu','güneşlik','tırnak','parmak','avuç','bilek','omuz','diz','ayak','kulak',
  'burun','ağız','dudak','diş','saç','kaş','yüzücülük','matara','kalemlik','defterler',
  'kitaplık','dolap','çekmece','raf','kilit','zil','düdük','davul','gitar','keman',
  'piyano','flüt','nota','melodi','şarkıcı','orkestra','sahne','perdeler','alkış','gösteri',
  'yarışma','yarış','koşu','yüzme','tırmanış','kayak','paten','satranç','bulmaca','yapboz',
  'hızlanmak','yavaşlamak','düşünmek','görüşmek','çalışmak','dinlemek','konuşmak','okumak','gülmek','uyumak',
  'beklemek','yüzmek','koşmak','yürümek','çizmek','boyamak','pişirmek','temizlemek','sulamak','toplamak',
  'öğrendik','yazdık','çözdük','başardık','kazandık','geldik','gördük','bulduk','sevdik','güldük',
  'mükemmellik','heyecanlılık','sabırsızlık','dikkatsizlik','düzensizlik','güvenilir','öngörülü','çözülebilir','ölçülebilir','gülümseyerek',
  'şıkırdayan','kıpırdayan','pırıldayan','çıtırdayan','gürüldeyen','fısıldayan','çağıldayan','çınlayan','ışıldayan','titreşen',
];

function unique(list){
  const out=[],seen=new Set();
  for(const word of list){if(word&&!seen.has(word)){seen.add(word);out.push(word);}}
  return out;
}
const SENTENCE_PARTS = Object.freeze({
  adj: Object.freeze(unique(ADJECTIVES)),
  noun: Object.freeze(unique(NOUNS)),
  place: Object.freeze(unique(PLACES)),
  adv: Object.freeze(unique(ADVERBS)),
  verb: Object.freeze(unique(VERBS)),
});
/** Every word in a stable, documented order (do not reorder: seeds depend on it). */
export const WORD_BANK = Object.freeze([...ADJECTIVES,...NOUNS,...PLACES,...ADVERBS,...VERBS,...EXTRA]);
export const WORD_COUNT = WORD_BANK.length;

const SPECIAL_LETTERS = new Set(['ç','ğ','ı','ö','ş','ü']);
const specialCount = word => {let n=0;for(const ch of word)if(SPECIAL_LETTERS.has(ch))n++;return n;};
// Length buckets: BUCKETS[len] is the list of words with that length (bank order).
const BUCKETS = (() => {
  const buckets=[];
  for(const word of WORD_BANK)(buckets[word.length] ??= []).push(word);
  return buckets.map(b=>Object.freeze(b||[]));
})();
const DIFFICULTY = Object.freeze({
  easy:{minLen:3,maxLen:6,specialWeight:1},
  normal:{minLen:4,maxLen:9,specialWeight:1},
  hard:{minLen:6,maxLen:12,specialWeight:3},
});

function hashString(text){
  // FNV-1a over UTF-16 code units — deterministic everywhere.
  let h=0x811c9dc5;
  for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,0x01000193);}
  return h>>>0;
}
function toSeed(seed){
  if(typeof seed==='string')return hashString(seed);
  const n=Number(seed);
  return Number.isFinite(n)?(Math.trunc(n)>>>0):0;
}

/** A fresh uint32 seed. Inject `rng` for tests or for crypto-backed randomness. */
export function createSeed(rng = Math.random){
  const x=Number(rng());
  const value=Math.floor((Number.isFinite(x)?Math.min(Math.max(x,0),1):0)*4294967296);
  return Math.min(value,0xffffffff)>>>0;
}

/** mulberry32: deterministic PRNG returning numbers in [0,1). Accepts number or string seeds. */
export function createRng(seed){
  let state=toSeed(seed);
  return function next(){
    state=(state+0x6d2b79f5)>>>0;
    let t=state;
    t=Math.imul(t^(t>>>15),t|1);
    t^=t+Math.imul(t^(t>>>7),t|61);
    return ((t^(t>>>14))>>>0)/4294967296;
  };
}
const randomIndex=(rng,length)=>Math.floor(rng()*length);

/**
 * Unique words, deterministic for the same arguments.
 * The difficulty narrows the [minLen,maxLen] window (easy 3-6, normal 4-9,
 * hard 6-12 with Turkish letters weighted ×3). When fewer words qualify than
 * `count`, every qualifying word is returned (shorter array, never repeats).
 */
export function pickWords({seed, count, minLen = 3, maxLen = 12, exclude = [], difficulty = 'normal'} = {}){
  const rule=DIFFICULTY[difficulty];
  if(!rule)throw new RangeError(`Unknown difficulty: ${difficulty}`);
  const wanted=Math.max(0,Math.trunc(Number(count)||0));
  if(!wanted)return [];
  const lo=Math.max(rule.minLen,Math.trunc(minLen)||0),hi=Math.min(rule.maxLen,Math.trunc(maxLen)||0);
  const banned=new Set(Array.from(exclude||[],w=>String(w).normalize('NFC')));
  const pool=[];
  for(let len=lo;len<=hi;len++)for(const word of BUCKETS[len]||[])if(!banned.has(word))pool.push(word);
  const rng=createRng(toSeed(seed)^Math.imul(lo*31+hi,0x9e3779b1)^(rule.specialWeight*0x85ebca6b));
  if(rule.specialWeight===1){
    // Partial Fisher–Yates shuffle.
    const n=Math.min(wanted,pool.length);
    for(let i=0;i<n;i++){const j=i+randomIndex(rng,pool.length-i);[pool[i],pool[j]]=[pool[j],pool[i]];}
    return pool.slice(0,n);
  }
  // Weighted draw without replacement: words with ç ğ ı ö ş ü get extra tickets.
  const tickets=[];
  for(const word of pool){const w=specialCount(word)>0?rule.specialWeight:1;for(let k=0;k<w;k++)tickets.push(word);}
  const chosen=[],taken=new Set();
  while(chosen.length<wanted&&taken.size<pool.length){
    const word=tickets[randomIndex(rng,tickets.length)];
    if(taken.has(word))continue;
    taken.add(word);chosen.push(word);
    if(taken.size*2>pool.length){ // compact once half is used so the loop stays fast
      for(let i=tickets.length-1;i>=0;i--)if(taken.has(tickets[i]))tickets.splice(i,1);
      if(!tickets.length)break;
    }
  }
  return chosen;
}

const UPPER={i:'İ',ı:'I',ç:'Ç',ğ:'Ğ',ö:'Ö',ş:'Ş',ü:'Ü'};
const capitalise=word=>(UPPER[word[0]]||word[0].toUpperCase())+word.slice(1);
// Clause templates (Turkish SOV-ish order). Lengths 2..5.
const TEMPLATES=[
  ['noun','verb'],
  ['adj','noun','verb'],
  ['noun','adv','verb'],
  ['adj','noun','place','verb'],
  ['noun','place','adv','verb'],
  ['adj','noun','place','adv','verb'],
];
/** A deterministic, capitalised Turkish phrase of exactly `words` words, ending with '.'. */
export function pickSentence({seed, words = 8} = {}){
  const total=Math.max(1,Math.trunc(Number(words)||8));
  const rng=createRng(toSeed(seed)^0x5bd1e995);
  const used=new Set();
  const draw=role=>{
    const list=SENTENCE_PARTS[role];
    for(let tries=0;tries<8;tries++){const w=list[randomIndex(rng,list.length)];if(!used.has(w)){used.add(w);return w;}}
    return list[randomIndex(rng,list.length)];
  };
  const clauses=[];let left=total;
  while(left>0){
    let options=TEMPLATES.filter(t=>t.length<=left&&(left-t.length!==1));
    if(!options.length)options=left===1?[['verb']]:TEMPLATES.filter(t=>t.length===left);
    const template=options[randomIndex(rng,options.length)];
    clauses.push(template.map(draw));left-=template.length;
  }
  const text=clauses.map(c=>c.join(' ')).join(', ');
  return capitalise(text)+'.';
}
