/* TuşLab — Neon Arena
 * Offline, no build step or external libraries. Data stays in this browser.
 * Typing telemetry is derived from physical KeyboardEvent keys and stored locally.
 */
(() => {
'use strict';
const STORAGE_KEY='tuslab-neon-v1';
const TR_CHARS='öğüşıçÖĞÜŞİÇ';
const DAY=86400000;
const q=s=>document.querySelector(s);
const qa=s=>Array.from(document.querySelectorAll(s));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const round=n=>Math.round(n||0);
const readable=n=>Number(n||0).toLocaleString('tr-TR');
const dateKey=t=>{let d=new Date(t);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const tzDays=(offset)=>{const d=new Date();d.setDate(d.getDate()+offset);return dateKey(d)};
const cap=s=>s?.length>35?s.slice(0,35)+'…':s||'';
const ICONS={
 bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
 keyboard:'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M7 16h10"/>',
 flame:'<path d="M12 22c4.5 0 7-3 7-7 0-4-3-6-4-10-.6 2.4-2.1 3.6-3 4-1-3-2.6-5-4-7-.2 3-3 5.7-3 10 0 6 3 10 7 10z"/>',
 trophy:'<path d="M8 21h8M12 17v4M7 4h10v6a5 5 0 0 1-10 0zM7 6H4v2c0 3 2 4 5 4M17 6h3v2c0 3-2 4-5 4"/>',
 zap:'<path d="m13 2-9 12h7l-1 8 10-12h-7z"/>',
 target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 crown:'<path d="m2 8 5 4 5-8 5 8 5-4-2 11H4zM4 22h16"/>',
 bot:'<rect x="3" y="6" width="18" height="14" rx="5"/><path d="M12 3v3M8 13h.01M16 13h.01M9 17h6"/>',
 chart:'<path d="M3 20V4M3 20h18M6 15l5-5 4 2 5-7"/>',
 bolt:'<path d="m14 2-9 11h7l-2 9 9-12h-7z"/>',
 play:'<path d="m7 4 13 8-13 8z"/>',
 settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1-2.5 2.5-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21h-4v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1L5 17.2l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3v-4h.9a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8L5 7.4 7.5 5l.1.1a1.7 1.7 0 0 0 1.8.3 1.7 1.7 0 0 0 1-1.5V3h4v.9a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1H21v4h-.1a1.7 1.7 0 0 0-1.5 1.1z"/>',
 pause:'<path d="M7 4v16M17 4v16"/>',
 refresh:'<path d="M20 11a8 8 0 0 0-14-5L4 8M4 4v4h4M4 13a8 8 0 0 0 14 5l2-2M20 20v-4h-4"/>',
 star:'<path d="m12 2 3 6.2 6.9 1-5 4.9 1.2 6.9-6.1-3.3-6.1 3.3 1.2-6.9-5-4.9 6.9-1z"/>',
 shield:'<path d="m12 2 9 4v6c0 6-4 9-9 10-5-1-9-4-9-10V6z"/><path d="m8 12 3 3 5-6"/>',
 arrow:'<path d="M4 12h16m-7-7 7 7-7 7"/>',
 code:'<path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-17-3 22"/>',
 book:'<path d="M12 6C8 3 4 3 2 4v16c3-1 7-.5 10 2 3-2.5 7-3 10-2V4c-2-1-6-1-10 2zm0 0v16"/>',
 swords:'<path d="M14 4 20 2l-2 6-9 9-4-4zM3 21l5-5M10 4 4 2l2 6 9 9 4-4M21 21l-5-5"/>',
 user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
 close:'<path d="M5 5l14 14M19 5 5 19"/>',
 download:'<path d="M12 3v13m-5-5 5 5 5-5M4 18v3h16v-3"/>',
 sound:'<path d="M3 9h5l5-4v14l-5-4H3zM16 8c3 2 3 6 0 8M19 5c5 4 5 10 0 14"/>',
 check:'<path d="m4 12 5 5L20 6"/>',
 magic:'<path d="m3 21 12-12 6 6-12 6zm10-9 4 4M5 3v4M3 5h4m12-3v4m-2-2h4"/>',
 info:'<circle cx="12" cy="12" r="10"/><path d="M12 11v6M12 7h.01"/>',
 activity:'<path d="M2 12h4l3-8 6 16 3-8h4"/>',
 calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>',
 edit:'<path d="M14 4 20 10 10 20 4 21l1-6z"/>',
 medal:'<circle cx="12" cy="14" r="6"/><path d="m8 9-3-7h5l2 6m4 1 3-7h-5l-2 6M12 11v6"/>',
 eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
 mouse:'<rect x="5" y="2" width="14" height="20" rx="7"/><path d="M12 2v8"/>'};
const icon=(name,cls='')=>`<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]||ICONS.star}</svg>`;
const DEFAULT_SETTINGS={strict:false,sound:true,reduceMotion:false,effectsReduced:false,keyboard:true,layout:'TR-Q',caseSensitive:false,ghost:true,duration:60};
const TEXTS={
 classic:[
 'Güçlü bir yazar, kelimelerini birer silah gibi kullanır ve düşüncelerini dünyaya açık, düzenli ve etkileyici biçimde aktarır.',
 'Öğretmen, üç öğrencinin çözümünü dikkatle inceledi; doğru yöntemle çalışan herkesin zamanla hız kazandığını sakin bir dille anlattı.',
 'Yazılım geliştirirken sabır, açık düşünce ve düzenli tekrar gerekir; her doğru vuruş yeni bir beceriye dönüşerek seni ileri taşır.'
 ],
 short:['Öğretmen üç öğrencinin çözümünü inceledi. Çeşitli örnekler üzerinde çalıştılar.','Özgür, güçlü ve çalışkan öğrenciler üç gün boyunca öğrendi.','Günlük tekrarlarla öğrenme gücünü yükselt.'],
 code:[
 'def ogrenci_sayisi(ogrenciler):\n    sayac = 0\n    for ogrenci in ogrenciler:\n        if ogrenci.get("aktif", False):\n            sayac += 1\n    return sayac',
 'const puanlar = [12, 25, 38, 41];\nconst toplam = puanlar.reduce((a, b) => a + b, 0);\nconsole.log(`Toplam: ${toplam}`);',
 'function kontrolEt(deger) {\n  if (deger >= 10 && deger <= 100) {\n    return { gecerli: true };\n  }\n  return { gecerli: false };\n}'
 ],
 boss:'Satranç ustasının gölgesinde ilerleyen savaşçı, kelimelerini dikkatle seçti; her doğru vuruş onu zafere, her hata ise yeni bir derse yaklaştırdı.'
};
const PRACTICE_WORDS=['öğretmen','öğrenmek','öğrenci','öğüt','ölçü','çözüm','çalışma','güçlü','güçlük','üç','düşünce','özgür','gözlük','çünkü','çözmek','görüş','çünkü','görev','düzenli','hızlı','kodlama','gelişim','yazılımcı','örnek','güven','şekil','işlem','değişim','program','tekrar','başarı','yöntem','özen','önce','doğru','yazmak','anlamak','bilgi','çıktı','algoritma','değer','eşik','süre','kullanıcı','veri','test','başlat','üretmek'];
const Q_LAYOUT=['1234567890*?','QWERTYUIOPĞÜ','ASDFGHJKLŞİ','ZXCVBNMÖÇ'];
const F_LAYOUT=['1234567890*?','FGĞIODRNH PQW'.replace(/ /g,''),'UİEAÜTKMLYŞ','JÖVCÇZSB'];
const BASE=()=>({version:1,settings:{...DEFAULT_SETTINGS},sessions:[],xp:0,shards:0,equipment:[],badges:[],adventureRecords:{},weeklyRaids:{},lastAdventure:null,createdAt:Date.now()});
let db=readDB();
let currentView='arena';
let commanderTab='quests';
db.shards??=0;db.equipment??=[];db.adventureRecords??={};db.weeklyRaids??={};
let active=null;
let activeModal=null;
let currentRange='7';
let analyticsTab='keys';
let toastHandle=null;
let restartChordUntil=0;
let activeKey=null;
let weakFocusCache=null;
let lastGoodKey=null;
let lastGoodAt=0;
let lastBadKey=null;
let lastBadAt=0;
let interval=null;
let audioCtx=null;
function readDB(){try{const o=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');if(o&&o.version===1&&Array.isArray(o.sessions))return {...BASE(),...o,settings:{...DEFAULT_SETTINGS,...o.settings}}}catch(err){console.warn('TuşLab: kayıt okunamadı',err)}return BASE()}
function saveDB(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(db))}catch(e){toast('Tarayıcı hafızası doldu. Verilerini dışa aktarabilirsin.')}}
function selectSessions(range=currentRange){const cutoff=range==='all'?0:Date.now()-Number(range)*DAY;return db.sessions.filter(s=>s.endedAt>=cutoff)}
function mean(nums){return nums.length?nums.reduce((a,b)=>a+b,0)/nums.length:0}
function summarize(sessions){const valid=sessions.filter(s=>s.characterCount>=10);return {count:sessions.length,wpm:round(mean(valid.map(s=>s.wpm))),best:round(Math.max(0,...valid.map(s=>s.wpm))),accuracy:round(mean(valid.map(s=>s.accuracy))),minutes:round(sessions.reduce((n,s)=>n+s.elapsedMs/60000,0)),correct:sessions.reduce((n,s)=>n+s.correctAttempts,0),typed:sessions.reduce((n,s)=>n+s.characterCount,0),xp:sessions.reduce((n,s)=>n+s.xp,0)}}
const level=()=>Math.floor(db.xp/1150)+1;
const levelProgress=()=>db.xp%1150/1150*100;
function streak(){let days=new Set(db.sessions.map(s=>dateKey(s.endedAt)));let x=0,shift=days.has(tzDays(0))?0:-1;for(let i=shift;i>-365;i--){if(!days.has(tzDays(i)))break;x++}return x}
function todaySessions(){return db.sessions.filter(s=>dateKey(s.endedAt)===tzDays(0))}
function completedBadges(){const s=db.sessions;return [
 {id:'first',name:'İlk Adım',desc:'İlk antrenmanını tamamla.',emoji:'🎮',ok:s.length>=1},
 {id:'turkish',name:'Türkçe Ustası',desc:'Türkçe karakterlerde toplam 100 doğru basış yap.',emoji:'👑',ok:s.flatMap(x=>x.attempts).filter(a=>a.ok&&TR_CHARS.includes(a.expected)).length>=100},
 {id:'accurate',name:'Kusursuz Vuruş',desc:'En az 50 karakterlik bir testi %100 doğrulukla bitir.',emoji:'🎯',ok:s.some(x=>x.accuracy===100&&x.characterCount>=50)},
 {id:'fast',name:'Hız Avcısı',desc:'60 WPM üzerine çık.',emoji:'⚡',ok:s.some(x=>x.wpm>=60)},
 {id:'code',name:'Kod Ustası',desc:'İlk kod yazma testini tamamla.',emoji:'💻',ok:s.some(x=>x.mode==='code')},
 {id:'streak',name:'İstikrarlı',desc:'7 günlük çalışma serisine ulaş.',emoji:'🔥',ok:streak()>=7},
 {id:'boss',name:'Canavar Avcısı',desc:'Bir boss görevini başarıyla geç.',emoji:'🐉',ok:s.some(x=>x.bossWon)},
 {id:'raid',name:'Baskın Avcısı',desc:'Bir haftada 50.000 boss hasarı ver.',emoji:'🏆',ok:Object.values(db.weeklyRaids||{}).some(x=>x.claimed)}
]}
function quests(){let today=todaySessions(), totalTurkish=today.flatMap(s=>s.attempts).filter(a=>a.ok&&TR_CHARS.includes(a.expected)).length;let code=today.filter(s=>s.mode==='code'||s.adventure==='code').length;return [
 {name:'3 antrenman tamamla',value:Math.min(today.length,3),goal:3,xp:120},
 {name:'Türkçe tuşları 20 kez doğru yaz',value:Math.min(totalTurkish,20),goal:20,xp:170},
 {name:'1 Kod Laboratuvarı görevi bitir',value:Math.min(code,1),goal:1,xp:100}
]}
function builtQuests(){return quests().map((x,i)=>({...x,claimed:todaySessions().some(s=>(s.questsEarned||[]).includes(i))}))}
function analytics(sessions=selectSessions()){let keyMap={},pairMap={};for(let s of sessions){for(let a of s.attempts||[]){const k=a.expected;if(!k||k===' '||k==='\n')continue;let z=keyMap[k]||(keyMap[k]={key:k,hits:0,errors:0,corrections:0,dt:[]});z.hits++;if(!a.ok)z.errors++;if(a.prevExpected&&a.transitionMs>=0&&a.transitionMs<7000&&a.actual!=='∅'){
 let p=a.prevExpected+'→'+k;if(a.prevExpected===' '||a.prevExpected==='\n')continue;
 let z2=pairMap[p]||(pairMap[p]={pair:p,hits:0,errors:0,dt:[]});z2.hits++;if(!a.ok)z2.errors++;if(a.ok)z2.dt.push(a.transitionMs);
 }}}
 let keys=Object.values(keyMap).map(x=>({...x,rate:x.hits?x.errors/x.hits:0,avg:round(mean(x.dt))})).sort((a,b)=>((b.errors*3+b.rate*12)-(a.errors*3+a.rate*12)));
 let pairs=Object.values(pairMap).map(x=>({...x,rate:x.hits?x.errors/x.hits:0,avg:round(mean(x.dt)),score:x.errors*3+Math.max(0,mean(x.dt)-220)/140})).sort((a,b)=>b.score-a.score);return {keys,pairs,keyMap,pairMap}
}
function weakFocus(){if(weakFocusCache)return weakFocusCache;const a=analytics(db.sessions.slice(-24));const weak=a.keys.filter(k=>k.hits>=3).sort((x,y)=>(y.rate*70+y.errors*3)-(x.rate*70+x.errors*3)).slice(0,4).map(x=>x.key.toLocaleLowerCase('tr-TR'));const pair=a.pairs.filter(p=>p.hits>=3).slice(0,4).map(p=>p.pair.toLocaleLowerCase('tr-TR').replace('→',''));return weakFocusCache={keys:weak.length?weak:['ö','ğ','ç','ü'],pairs:pair.length?pair:['öğ','çü','ğr','üş'],hasData:a.keys.length>0}}
function liveCoachText(){
 if(!active?.startedAt)return coachText();
 let recent=active.attempts.slice(-25),errors=recent.filter(a=>!a.ok),focus=weakFocus();
 if(errors.length>=5)return `Son 25 vuruşta ${errors.length} hata var. Biraz yavaşla; özellikle “${errors.at(-1).expected}” karakterinde doğruluğa odaklan.`;
 if(active.combo>=20)return `${active.combo} vuruşluk iyi bir seri! Ritmini koru, acele etmene gerek yok.`;
 if(active.attempts.length>=15&&activeAccuracy()>=95)return `Şu an %${activeAccuracy()} doğrulukla gidiyorsun. Harika! Sıradaki hedef: “${focus.pairs[0]}” geçişini akıcı yapmak.`;
 return coachText();
}
function liveTip(){let errors=active?.attempts.slice(-12).filter(a=>!a.ok)||[];if(errors.length)return `“${errors.at(-1).expected}” yerine “${errors.at(-1).actual==='∅'?'atlanmış':errors.at(-1).actual}” yazdın. Tuşun yerini kontrol et.`;
 let f=weakFocus();return `“${f.pairs[0]}” geçişinde ritmini koru; acele etme.`}
function coachText(){let focus=weakFocus(),last=db.sessions.at(-1);if(!last)return 'İlk yazma testini tamamla. Hangi tuşlarda zorlandığını analiz edip sana özel bir görev hazırlayacağım.';if(last.accuracy<85)return `Son testte doğruluğun %${last.accuracy}. Önce yavaş ve kontrollü yazalım. ${focus.keys.slice(0,2).join(' ve ').toLocaleUpperCase('tr-TR')} tuşları öncelikli.`;if(last.wpm<35&&last.accuracy>=93)return `Doğruluğun %${last.accuracy} ile iyi. Şimdi ritmi artırabiliriz. Özellikle “${focus.pairs[0]}” geçişini çalış.`;return `Güzel ilerliyorsun! “${focus.pairs.slice(0,2).join('” ve “')}” geçişlerine odaklanırsak daha da hızlanabilirsin.`}
function chooseText(mode){let count=db.sessions.length;const seed=nextTusLabSeed();
 if(mode==='adaptive'){const {keys,pairs}=weakFocus();const words=variedPool({seed,difficulty:'normal',extra:PRACTICE_WORDS,fallback:PRACTICE_WORDS});let tough=words.filter(w=>keys.some(c=>w.includes(c))||pairs.some(p=>w.includes(p)));let supporting=words.filter(w=>!tough.includes(w));if(tough.length<5)tough=words.slice(0,22);const pick=(arr,i)=>arr[(i*7+count*11)%arr.length];let result=[];for(let i=0;i<43;i++)result.push(i%20<12?pick(tough,i):i%20<17?pick(supporting,i):pick(words,i));return result.map((x,i)=>i===0?x[0].toLocaleUpperCase('tr-TR')+x.slice(1):x).join(' ')+'.'}
 if(mode==='code')return variedPick(TEXTS.code,seed);
 if(mode==='boss')return bossCampaignText(seed);
 if(mode==='burst')return variedSentences({seed,count:5,words:9,fallback:TEXTS.short});
 if(mode==='time')return variedSentences({seed,count:5,words:18,fallback:TEXTS.classic});
 return variedSentences({seed,count:2,words:9,fallback:TEXTS.classic,single:true});}
// A long boss encounter is composed from distinct short paragraphs; each remains
// readable inside the three-line typing viewport while the player progresses.
function bossCampaignText(seed=nextTusLabSeed()){
 const lines=[
 'Satranç taşları gecenin sessizliğinde kıpırdadı; kalenin kapısı açılırken savaşçı ilk cümlesini dikkatle kurdu.',
 'Gölgeler koridor boyunca uzandı fakat güçlü bir ritim, her vuruşta içindeki korkuyu biraz daha azalttı.',
 'Eski tahtın üzerinde parlayan semboller doğru kelimelerle çözülüyor, yanlışlar yeni derslere dönüşüyordu.',
 'Öğretmen yıllar önce sabrın önemini anlatmıştı; şimdi bu öğüt, zorlu mücadelede yol gösteriyordu.',
 'Üç cesur gezgin aynı haritaya baktı, çözümü düşünerek her ayrıntıyı dikkatlice gözden geçirdi.',
 'Kralın zırhı kırmızı alevlerle parladı ve savaşçı düzenli nefes alarak hızını dengede tutmayı seçti.',
 'Bir sonraki hamleyi görmek için yalnızca öne bakmak yetmezdi; doğru karar, sakin düşünceden doğardı.',
 'Gecenin ortasında yükselen çan sesi, her başarılı kelimenin başka bir kapıyı araladığını haber verdi.',
 'Küçük hatalar büyük yenilgiler değildi; cesaretle sürdürülen çalışma zaman içinde ustalığa dönüşüyordu.',
 'Savaşçı kılıcını değil klavyesini kavradı, çünkü bu kalede en güçlü silah dikkat ve kararlı çalışmaydı.',
 'Uzaktaki mavi ışık güçlendi, sessiz kulelerin gölgesi kayboldu ve herkes yeni bir başlangıca hazırlandı.',
 'Özgün fikirler, güçlü örnekler ve doğru çözümler birleştiğinde en karmaşık sorun bile açıklığa kavuşurdu.',
 'Kral ikinci hamlesini hazırlarken savaşçı zor harflerde acele etmeden ritmini tekrar düzenledi.',
 'Çelik kapılar açıldığında sessiz bir avlu göründü; yerdeki taşlar eski mücadelelerin izlerini taşıyordu.',
 'Karanlık zırhın altından yükselen ses, düşüncelerini açıkça anlatabilenlerin bu sınavı geçeceğini söylüyordu.',
 'Her gün yapılan kısa tekrarlar, parmakların doğru tuşları daha güvenli ve daha hızlı bulmasını sağlıyordu.',
 'Yolun sonunda parlayan taç artık çok yakındı; başarının sırrı vazgeçmeden aynı özenle devam etmekti.',
 'Son hamlede bütün kuleler sustu ve savaşçı öğrendiği yeni becerilerin onu nasıl geliştirdiğini gördü.'
 ];
 // The opening and closing lines stay fixed; the middle of the story is reordered per run.
 return [lines[0],...variedShuffle(lines.slice(1,-1),seed),lines.at(-1)].join(' ');
}
// Shared adventure configuration: every adventure continues to use the existing typing engine.
const ADVENTURES={
 speed:{name:'Hız Koridoru',mode:'time',description:'30 saniyede kısa Türkçe kelimelerle hızını sınayacaksın. %90 doğruluk ve 30/45/60 WPM yıldızları açar.',duration:'30 saniye',metric:'wpm'},
 castle:{name:'Kelime Kalesi',mode:'adaptive',description:'Zorlandığın harf ve geçişlerden oluşan 40 kelimeyi süresiz yaz. %90 / %95 / %98 doğrulukla yıldız kazan.',duration:'40 kelime · süresiz',metric:'accuracy'},
 code:{name:'Kod Patikası',mode:'code',description:'Python ve JavaScript ile üç kısa kod parçasını doğru ve hızlı yaz. Girintiler otomatik tamamlanır.',duration:'3 kod parçası · süresiz',metric:'accuracy'}
};
const SPEED_WORDS=['bir','ve','için','ile','yeni','iyi','hız','gün','çok','ben','sen','onun','biz','şimdi','soru','kod','doğru','her','gel','git','yaz','çöz','öğren','var','ama','son','ilk','üç','iş','daha','kısa','kolay'];
const CASTLE_WORDS=['öğretmen','ölçü','güçlü','çözüm','düşünce','görüş','öğrenci','şöyle','ışık','çalışma','çünkü','şüphe','özgür','büyük','değişim','gözlük','çığır','gülüş','düğüm','üçüncü','çözmek','ışıldak','dönüş','şirket','şişe','başarı','üretim','öğüt','küçük','güçlük','çalışkan','öğrenmek','yüzük','göç','şarkı','çeşitli','şu','ışın','köprü','çevre'];
const CODE_CHUNKS=[
 'def ogrenci_sayisi(ogrenciler):\n    toplam = 0\n    for ogrenci in ogrenciler:\n        if ogrenci["aktif"]:\n            toplam += 1\n    return toplam',
 'const puanlar = [3, 5, 8];\nconst toplam = puanlar.reduce((a, b) => a + b, 0);\nif (toplam > 10) {\n    console.log("Başarılı!");\n}',
 'function analiz(veriler) {\n    const sonuc = veriler.filter(x => x.ok);\n    for (const item of sonuc) {\n        console.log(item.id);\n    }\n    return sonuc.length;\n}'
];
/* <tuslab-words> */
// Home-page word variety. Every run draws a fresh seed (random per page load,
// advanced per run). The shared seeded bank (pvp/shared/words.js, also used by
// PvP) arrives through a dynamic import below; until it has loaded, or when it
// cannot load (e.g. file://), the built-in arrays are shuffled with the same seed.
const tusLabWordState={bank:null,sessionSeed:Math.floor(Math.random()*4294967296)>>>0,run:0};
function setTusLabWordBank(bank){if(bank&&typeof bank.pickWords==='function'&&typeof bank.pickSentence==='function')tusLabWordState.bank=bank;return tusLabWordState.bank;}
function nextTusLabSeed(){tusLabWordState.run++;return (tusLabWordState.sessionSeed^Math.imul(tusLabWordState.run,0x9e3779b1))>>>0;}
function tusLabRng(seed){let s=seed>>>0;return()=>{s=(s+0x6d2b79f5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
function variedShuffle(list,seed){const out=[...list],rng=tusLabRng(seed);for(let i=out.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
function variedPick(list,seed){return list[Math.floor(tusLabRng(seed)()*list.length)];}
// A shuffled, duplicate-free pool: bank words of the given difficulty plus `extra`.
function variedPool({seed,difficulty='normal',extra=[],fallback=[]}){
 const bank=tusLabWordState.bank;let words=[];
 if(bank){try{words=bank.pickWords({seed,count:bank.WORD_COUNT||1000,difficulty});}catch{words=[];}}
 return variedShuffle([...new Set([...words,...extra,...(words.length?[]:fallback)])],seed);
}
// `count` words; a word repeats only after the whole pool has been used once.
function variedWords({seed,count,difficulty='normal',fallback=[],extra=[]}){
 const out=[];let round=0;
 while(out.length<count){const pool=variedPool({seed:(seed+Math.imul(round,0x6d2b79f5))>>>0,difficulty,extra,fallback});if(!pool.length)break;out.push(...pool.slice(0,count-out.length));round++;}
 return out;
}
// `count` generated sentences of `words` words; falls back to shuffled built-in texts.
function variedSentences({seed,count,words,fallback=[],single=false}){
 const bank=tusLabWordState.bank;
 if(bank){try{return Array.from({length:count},(_,i)=>bank.pickSentence({seed:(seed+Math.imul(i+1,0x85ebca6b))>>>0,words})).join(' ');}catch{}}
 if(single)return variedPick(fallback,seed);
 const shuffled=variedShuffle(fallback,seed);
 return Array.from({length:count},(_,i)=>shuffled[i%shuffled.length]).join(' ');
}
/* </tuslab-words> */
try{import('./pvp/shared/words.js').then(setTusLabWordBank,()=>{});}catch{}
function localWeekKey(now=new Date()){
 const d=new Date(now.getFullYear(),now.getMonth(),now.getDate());const delta=(d.getDay()+6)%7;d.setDate(d.getDate()-delta);return dateKey(d.getTime());
}
function mondayEnd(){const d=new Date();const delta=(d.getDay()+6)%7;const end=new Date(d.getFullYear(),d.getMonth(),d.getDate()-delta+7);return end;}
function weekRaid(){db.weeklyRaids??={};const key=localWeekKey();return db.weeklyRaids[key]??(db.weeklyRaids[key]={damage:0,claimed:false});}
function raidDaysLeft(){const diff=mondayEnd().getTime()-Date.now();return Math.max(0,Math.ceil(diff/DAY));}
function addWeeklyDamage(points){if(points<=0)return;const raid=weekRaid();raid.damage+=points;if(raid.damage>=50000&&!raid.claimed){raid.claimed=true;db.xp+=500;toast('🏆 Haftalık Baskın tamamlandı! +500 XP · Baskın Avcısı');}saveDB();updateWeeklyRaidDisplay();}
function updateWeeklyRaidDisplay(){const marker=q('#raid-days');if(marker&&marker.dataset.week!==localWeekKey()){renderApp();return;}const r=weekRaid(),el=q('#raid-damage');if(el)el.textContent=`${readable(Math.min(r.damage,50000))} / 50.000 hasar`;const bar=q('#raid-damage-bar');if(bar)bar.style.width=Math.min(100,r.damage/50000*100)+'%';setText('#raid-days',r.claimed?'Tamamlandı':`${raidDaysLeft()} gün kaldı`);}
function speedWords(){return variedWords({seed:nextTusLabSeed(),count:135,difficulty:'easy',fallback:SPEED_WORDS}).join(' ');}
function castleWords(){const score=analytics(db.sessions.slice(-60));const keys=score.keys.filter(k=>k.hits>=2).slice(0,5).map(k=>k.key.toLocaleLowerCase('tr-TR'));
 const pairs=score.pairs.filter(x=>x.hits>=2).slice(0,3).map(x=>x.pair.replace('→','').toLocaleLowerCase('tr-TR'));
 const seed=nextTusLabSeed();const candidates=variedPool({seed,difficulty:'hard',extra:[...CASTLE_WORDS,...PRACTICE_WORDS],fallback:[...CASTLE_WORDS,...PRACTICE_WORDS]});const focus=keys.length||pairs.length?candidates.filter(w=>keys.some(k=>w.includes(k))||pairs.some(pair=>w.includes(pair))):candidates.filter(w=>/[ğşıöçü]/.test(w));
 const pool=focus.length>=5?focus:variedShuffle(CASTLE_WORDS,seed);return Array.from({length:40},(_,i)=>pool[i%pool.length]).join(' ');
}
function adventureText(id){if(id==='speed')return speedWords();if(id==='castle')return castleWords();return CODE_CHUNKS.join('\n\n');}
function adventureStars(id,rec){if(!rec.completed&&id!=='speed')return 0;
 if(id==='speed'){if(rec.accuracy<90)return 0;return rec.wpm>=60?3:rec.wpm>=45?2:rec.wpm>=30?1:0;}
 if(id==='castle')return rec.accuracy>=98?3:rec.accuracy>=95?2:rec.accuracy>=90?1:0;
 if(id==='code'){const t=rec.codeChunkTimes||[];const max=t.length===3?Math.max(...t):Infinity;return rec.accuracy>=98&&max<30000?3:rec.accuracy>=95&&max<45000?2:rec.accuracy>=90&&max<60000?1:0;}
 return 0;
}
function adventureBest(id){return db.adventureRecords?.[id]||{stars:0,score:0};}
function adventureMetric(id,record){return id==='speed'?record.wpm:record.accuracy;}
function openAdventure(id){const adv=ADVENTURES[id];if(!adv)return;const best=adventureBest(id);
 makeModal(adv.name,`<div class="adventure-detail"><p>${esc(adv.description)}</p><div class="adventure-summary"><span>${esc(adv.duration)}</span><span>En iyi skor: <b>${best.score?best.score+(id==='speed'?' WPM':'%'):'Henüz yok'}</b></span><span class="adventure-stars">${'★'.repeat(best.stars)}${'☆'.repeat(3-best.stars)}</span></div><button class="btn primary" data-action="adventure-start" data-mode="${id}">⚔ Başla →</button></div>`);
}
function startAdventure(id){const adv=ADVENTURES[id];if(!adv)return;db.lastAdventure=id;saveDB();
 startMode(adv.mode,{text:adventureText(id),adventure:id,raid:false});
}
function codeChunkDurations(){if(!active?.codeChunkEnds)return [];let previous=0;return active.codeChunkEnds.map(end=>{const a=active.attempts.findLast(x=>x.slotIndex<=end-1);const t=a?.atMs??0;const duration=t-previous;previous=t;return duration;});}
function improvedPairs(before,after){const now=analytics([after]).pairs.filter(x=>x.hits>=2);return before.filter(b=>b.hits>=2).filter(b=>{const a=now.find(x=>x.pair===b.pair);return a&&a.avg>0&&a.avg<b.avg}).slice(0,3).map(p=>p.pair);}
function defaultTimer(mode){return mode==='time'?db.settings.duration:mode==='burst'?30:mode==='boss'?300:0}
function startMode(mode='classic',options={}){
 if(mode==='custom'&&!options.text){openModal('custom');return}
 const text=options.text||chooseText(mode);if(!text.trim()){toast('Çalışma metni boş olamaz.');return}
 active={id:Date.now()+'-'+Math.random().toString(36).slice(2,6),mode,target:text,slots:[],attempts:[],corrections:0,startedAt:null,finished:false,paused:false,pauseAt:null,pausedDuration:0,timeLimit:defaultTimer(mode),combo:0,comboMax:0,correctAttempts:0,wrongAttempts:0,bossWon:false,shownCoach:null,ghostWpm:summarize(db.sessions).best};
 active.adventure=options.adventure||null;active.raid=!!options.raid;active.beforePairs=active.adventure==='castle'?analytics(db.sessions.slice(-60)).pairs.slice(0,15):[];
 active.codeChunkEnds=active.adventure==='code'?CODE_CHUNKS.map((_,i)=>CODE_CHUNKS.slice(0,i+1).join('\n\n').length):null;
 active.bossStage=1;active.bossMaxHp=440;active.bossHp=440;active.damage=0;
 active.battleCombo=0;active.battleComboMax=0;active.lastHit=0;active.lastHitCritical=false;active.lastLagHp=100;active.lastLagStage=1;active.battleWordErrors=new Set();active.battleAwarded=new Set();active.bossWon=false;active.armourUsed=false;active.battleOutcome=null;
 if(active.adventure==='speed')active.timeLimit=30;
 if(active.adventure==='castle'||active.adventure==='code')active.timeLimit=0;
 if(!active.adventure&&db.equipment?.includes('clock')&&active.timeLimit)active.timeLimit+=15;
 currentView='arena';activeModal=null;renderApp();
 requestAnimationFrame(()=>q('#typing-stage')?.focus({preventScroll:true}));if(!options.silent)toast(`${active.adventure?ADVENTURES[active.adventure].name:modeLabel(mode)} hazır! Yazmaya başlayabilirsin.`)
}
const modeLabel=mode=>({classic:'Klasik Mod',adaptive:'Kişisel Eğitim',time:'Zaman Yarışı',burst:'Kelime Patlaması',custom:'Özel Metin',code:'Kod Laboratuvarı',boss:'Boss Görevi'})[mode]||mode;
const activeSeconds=()=>active?.startedAt?Math.max(0,((active.paused?active.pauseAt:Date.now())-active.startedAt-active.pausedDuration)/1000):0;
const activeAccuracy=()=>active&&active.attempts.length?Math.round(active.correctAttempts/active.attempts.length*100):100;
const activeWpm=()=>active&&activeSeconds()>1?round(active.slots.filter(x=>x.ok).length/5/(activeSeconds()/60)):0;
const activeProgress=()=>active?round(active.slots.length/active.target.length*100):0;
const activeRemaining=()=>active?.timeLimit?Math.max(0,active.timeLimit-activeSeconds()):activeSeconds();
const formatTime=s=>`${Math.floor(s/60).toString().padStart(2,'0')}:${Math.floor(s%60).toString().padStart(2,'0')}`;
function currentCompleted(){return active?.finished||active?.slots.length>=active?.target.length}
function sameKey(x,y){return x===y||(!db.settings.caseSensitive&&active?.mode!=='code'&&x.toLocaleLowerCase('tr-TR')===y.toLocaleLowerCase('tr-TR'))}
function addAttempt(expected,actual,ok,slotIndex,skipped=false){let atMs=activeSeconds()*1000;let prev=active.attempts.length?active.attempts.at(-1):null;let neighbor=prev&&prev.slotIndex===slotIndex-1?prev:null;let transitionMs=neighbor?round(atMs-neighbor.atMs):-1;
 active.attempts.push({expected,actual,ok,atMs:round(atMs),slotIndex,prevExpected:neighbor?.expected||null,transitionMs,skipped});if(ok){active.correctAttempts++;active.combo++;active.comboMax=Math.max(active.combo,active.comboMax)}else{active.wrongAttempts++;active.combo=0}
 document.dispatchEvent(new CustomEvent('tuslab:typing-attempt',{detail:{expected,actual,ok,slotIndex,skipped,sessionId:active.id}}));
}

// FAZ 3: The battle is a separate consumer of typing telemetry.
// The text engine continues to own character checking, Space and Backspace.
const BOSS_STAGE_HP=[440,660,900];
const reducedBattleEffects=()=>db.settings.reduceMotion||db.settings.effectsReduced||window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const wordStartAt=(target,pos)=>{let start=pos;while(start>0&&!/\s/.test(target[start-1]))start--;return start};
function upcomingDamage(){
 if(!active)return 0;
 const start=wordStartAt(active.target,active.slots.length);
 let end=start;while(end<active.target.length&&!/\s/.test(active.target[end]))end++;
 const word=active.target.slice(start,end),letters=[...word].filter(c=>/[\p{L}\p{N}]/u.test(c)).length;
 const dirty=active.battleWordErrors?.has(start);
 const nextCombo=dirty?0:active.battleCombo+1;
 const critical=!dirty&&nextCombo>0&&nextCombo%10===0;
 return Math.round(letters*Math.min(1+nextCombo*.1,3)*(dirty?.5:1)*(critical?2:1));
}
function updateDamagePreview(){setText('#target-damage',upcomingDamage());}
function battleOnAttempt(ev){
 const d=ev.detail;if(!active||active.finished||active.id!==d.sessionId)return;
 const start=wordStartAt(active.target,d.slotIndex);
 if(!d.ok){
   active.battleWordErrors.add(start);
   active.battleCombo=0;
   showBossShield();
   if(db.settings.sound)window.TusLabSFX?.block();
   comboFeedback(false);
 }
 const lastIndex=active.target.length-1;
 const endedBySeparator=/\s/.test(d.expected)&&d.ok;
 const endedByLast=d.slotIndex===lastIndex&&(d.ok||!db.settings.strict);
 if(!endedBySeparator&&!endedByLast)return;
 const end=endedBySeparator?d.slotIndex:d.slotIndex+1;
 let begin=end;while(begin>0&&!/\s/.test(active.target[begin-1]))begin--;
 const word=active.target.slice(begin,end).trim();
 if(!word||active.battleAwarded.has(begin))return;
 active.battleAwarded.add(begin);
 // A skipped whole word is not a correct completion and cannot deal damage.
 const attempted=active.attempts.filter(x=>x.slotIndex>=begin&&x.slotIndex<end);
 if(!attempted.some(x=>x.ok))return;
 const dirty=active.battleWordErrors.has(begin)||attempted.some(x=>!x.ok);
 const combo=dirty?0:++active.battleCombo;
 active.battleComboMax=Math.max(active.battleComboMax,combo);
 const critical=!dirty&&combo%10===0&&combo>0;
 const letters=[...word].filter(c=>/[\p{L}\p{N}]/u.test(c)).length;
 const damage=Math.round(letters*Math.min(1+combo*.1,3)*(dirty?.5:1)*(critical?2:1));
 if(damage>0){dealBossDamage(damage,critical);if(!dirty)comboFeedback(true);}
 updateDamagePreview();
}
function dealBossDamage(amount,critical){
 if(!active||active.bossWon||active.finished)return;
 let remaining=amount,actual=0;
 while(remaining>0&&active.bossStage<=3){
   const taken=Math.min(remaining,active.bossHp);
   active.bossHp-=taken;actual+=taken;remaining-=taken;
   if(active.bossHp<=0){
     if(active.bossStage===3){active.bossWon=true;active.battleOutcome='victory';break}
     active.bossStage++;
     active.bossMaxHp=BOSS_STAGE_HP[active.bossStage-1];
     active.bossHp=active.bossMaxHp;
     showStageTransition(active.bossStage);
   }
 }
 active.damage+=actual;
 active.lastHit=actual;active.lastHitCritical=critical;
 addWeeklyDamage(actual);
 updateBoss();
 if(db.settings.sound)window.TusLabSFX?.hit(actual,critical);
 animateBossHit(amount,critical);
 if(active.bossWon){const sessionId=active.id;queueMicrotask(()=>{if(active?.id===sessionId&&!active.finished)finishSession()})}
}
function addImpactNumber(damage,critical){
 if(reducedBattleEffects())return;
 const root=q('#boss-effect-anchor');if(!root)return;
 // Keep at most six floating damage numbers, even during rapid keyboard input.
 const existing=Array.from(root.querySelectorAll('.faz3-damage'));
 while(existing.length>=6)existing.shift().remove();
 const node=document.createElement('span');
 node.className='faz3-damage combat-number'+(critical?' faz3-critical':'');
 const number=document.createElement('strong');number.textContent=String(damage);
 if(critical){const crit=document.createElement('em');crit.textContent='KRİTİK!';node.appendChild(crit);}
 node.appendChild(number);
 node.style.left=(33+Math.random()*35).toFixed(1)+'%';
 node.style.top=(36+Math.random()*28).toFixed(1)+'%';
 node.style.setProperty('--hit-angle',(Math.random()*28-14).toFixed(1)+'deg');
 root.appendChild(node);
 node.addEventListener('animationend',()=>node.remove(),{once:true});
 setTimeout(()=>node.remove(),950);
}
function animateBossHit(damage,critical){
 if(reducedBattleEffects())return;
 const scene=q('#boss-battle'),art=q('.arena-backdrop img'),flash=q('#boss-battle .boss-flash');
 // A short hit-stop, then a stronger shake on critical hits.
 const shake=critical?11:6;
 art?.animate([{transform:'translateX(-50%) translate3d(0,0,0) scale(1.015)'},{transform:`translateX(-50%) translate3d(-${shake}px,0,0) scale(1.028)`},{transform:`translateX(-50%) translate3d(${shake*.7}px,0,0) scale(1.028)`},{transform:'translateX(-50%) translate3d(0,0,0) scale(1.015)'}],{duration:critical?205:150,easing:'ease-out'});
 flash?.animate([{opacity:0},{opacity:critical?.9:.6},{opacity:0}],{duration:critical?290:190,easing:'ease-out'});
 if(scene){
   scene.classList.toggle('combat-critical',!!critical);
   clearTimeout(scene._criticalTimer);
   scene._criticalTimer=setTimeout(()=>scene.classList.remove('combat-critical'),critical?470:190);
 }
 addImpactNumber(damage,critical);
 const root=q('#boss-effect-anchor');
 if(root){
   while(root.querySelectorAll('.combat-impact-ring').length>=2)root.querySelector('.combat-impact-ring')?.remove();
   const ring=document.createElement('span');ring.className='combat-impact-ring'+(critical?' critical':'');
   ring.style.left=(47+Math.random()*12).toFixed(1)+'%';ring.style.top=(45+Math.random()*12).toFixed(1)+'%';
   root.appendChild(ring);ring.addEventListener('animationend',()=>ring.remove(),{once:true});setTimeout(()=>ring.remove(),650);
 }
}
function showBossShield(){
 if(reducedBattleEffects())return;
 const scene=q('#boss-battle');if(!scene)return;
 const shield=document.createElement('span');shield.className='faz3-shield';scene.appendChild(shield);setTimeout(()=>shield.remove(),480);
}
function comboFeedback(success){
 if(reducedBattleEffects())return;
 const circle=q('#boss-battle .combat-combo');if(!circle)return;
 circle.getAnimations().forEach(a=>a.cancel());
 if(success){
   circle.animate([{transform:'scale(1)'},{transform:'scale(1.16)'},{transform:'scale(1)'}],{duration:250,easing:'cubic-bezier(.18,.85,.22,1)'});
 }else{
   circle.animate([{transform:'translateX(0)',filter:'grayscale(0)'},{transform:'translateX(-7px)',filter:'grayscale(1)'},{transform:'translateX(6px)',filter:'grayscale(1)'},{transform:'translateX(0)',filter:'grayscale(0)'}],{duration:330,easing:'ease-out'});
 }
}
function showStageTransition(stage){
 const scene=q('#boss-battle');if(!scene)return;
 scene.dataset.stage=String(stage);
 if(db.settings.sound)window.TusLabSFX?.stage();
 const banner=document.createElement('div');banner.className='faz3-stage-banner';banner.textContent=`AŞAMA ${stage}!`;
 scene.appendChild(banner);
 setTimeout(()=>banner.remove(),900);
 const lag=q('#boss-meter-lag');if(lag)lag.style.width='100%';
}
function updateBoss(){
 if(!active)return;
 const percentage=clamp(active.bossHp/active.bossMaxHp*100,0,100);
 setText('#boss-hp',`${readable(Math.ceil(active.bossHp))} / ${readable(active.bossMaxHp)} HP`);
 const meter=q('#boss-meter');if(meter)meter.style.width=percentage+'%';
 const lag=q('#boss-meter-lag');if(lag&&(active.lastLagHp!==percentage||active.lastLagStage!==active.bossStage)){const sessionId=active.id,stage=active.bossStage;clearTimeout(active.lagTimer);if(active.lastLagStage!==active.bossStage)lag.style.width='100%';active.lastLagHp=percentage;active.lastLagStage=stage;active.lagTimer=setTimeout(()=>{if(active?.id===sessionId&&active.bossStage===stage)lag.style.width=percentage+'%'},260)}
 setText('#boss-phase',active.bossWon?'♛ YENİLDİ':`Aşama ${active.bossStage}/3`);
 setText('#boss-damage-total',readable(active.damage));setText('#battle-combo',active.battleCombo+'x');setText('#last-hit-value',active.lastHit?'-'+readable(active.lastHit):'—');const lastHit=q('#boss-last-impact');if(lastHit){lastHit.classList.toggle('has-hit',!!active.lastHit);lastHit.classList.toggle('was-critical',!!active.lastHitCritical);}const comboCircle=q('#boss-battle .combat-combo');if(comboCircle){comboCircle.dataset.tier=active.battleCombo>=10?'legendary':active.battleCombo>=5?'high':active.battleCombo>=2?'rising':'idle';}
 const scene=q('#boss-battle');if(scene){scene.dataset.stage=String(active.bossStage);scene.classList.toggle('boss-defeated',active.bossWon)}const backdrop=q('#panel-arena .arena-backdrop');if(backdrop)backdrop.dataset.stage=String(active.bossStage)
 updateDamagePreview();
}

function handleBackspace(){if(!active?.slots.length)return;active.slots.pop();active.corrections++;active.combo=0;active.lastWrong=null;updateLive()}
function handleKey(ev){if(!active||active.finished||activeModal||ev.ctrlKey||ev.metaKey||ev.altKey||ev.isComposing)return;if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
 if(ev.key==='Escape'){ev.preventDefault();togglePause();restartChordUntil=0;return}
 /* Menü erişimi (paket 32): Tab+Enter yeniden başlatma kısayolu yalnız yazmaya başlamışken ve odak yazma alanındayken Tab'ı tutar;
    duraklatılmışken, henüz yazılmamışken ya da odak bir düğmedeyken Tab normal biçimde menülerde gezinir. */
 if(ev.key==='Tab'&&(active.paused||!active.slots.length||!document.activeElement?.closest?.('#typing-stage')&&document.activeElement!==document.body))return;
 if(ev.key==='Tab'){ev.preventDefault();restartChordUntil=Date.now()+1800;return}
 if(ev.key==='Enter'&&Date.now()<restartChordUntil){ev.preventDefault();restartChordUntil=0;startMode(active.mode,{text:active.target,adventure:active.adventure,raid:active.raid});return}
 if(active.paused)return;
 if(document.activeElement?.closest('button'))return;
 if(ev.key==='Backspace'){ev.preventDefault();handleBackspace();return}
 if(ev.key==='Tab')return;
 let key=ev.key==='Enter'?'\n':ev.key;
 if(key.length!==1)return;
 if(ev.key===' '||ev.key==='Enter')ev.preventDefault();
 if(active.slots.length>=active.target.length)return;
 if(!active.startedAt)active.startedAt=Date.now();
 const pos=active.slots.length, expected=active.target[pos];
 if(key===' '&&expected!==' '&&expected!=='\n'&&active.mode!=='code'&&!db.settings.strict){let next=active.target.indexOf(' ',pos);if(next>=0){for(let i=pos;i<next;i++){active.slots.push({actual:'',ok:false,skipped:true});addAttempt(active.target[i],'∅',false,i,true)}let i=active.slots.length;active.slots.push({actual:' ',ok:true});addAttempt(' ',' ',true,i);activeKey='SPACE';updateLive();playClick(true);return}}
 const good=sameKey(key,expected);addAttempt(expected,key,good,pos);
 if(good){lastGoodKey=(key===' '?'SPACE':key.toLocaleUpperCase('tr-TR'));lastGoodAt=performance.now();}
 else {lastBadKey=(key===' '?'SPACE':key.toLocaleUpperCase('tr-TR'));lastBadAt=performance.now();if(active.mode==='boss'&&db.equipment?.includes('shield')&&!active.armourUsed){active.armourUsed=true;active.combo=Math.max(0,active.comboMax);toast('🛡️ İstikrar Zırhı bir hatanı absorbe etti!')}}

 if(good||!db.settings.strict)active.slots.push({actual:key,ok:good});
 else active.lastWrong={at:Date.now(),character:key};
 // Only adventure-code automatically fills indentation after a correct newline.
 if(active.adventure==='code'&&key==='\n'&&good){while(active.target[active.slots.length]===' '){const idx=active.slots.length;active.slots.push({actual:' ',ok:true,autoIndent:true});addAttempt(' ',' ',true,idx);}}
 activeKey=(key===' '?'SPACE':key.toLocaleUpperCase('tr-TR'));playClick(good);
 updateLive();if(active.slots.length>=active.target.length)finishSession();
 setTimeout(()=>{if(activeKey===(key===' '?'SPACE':key.toLocaleUpperCase('tr-TR'))){activeKey=null;updatePressed()}},130);
}
function togglePause(){if(!active||active.finished)return;if(active.paused){if(active.startedAt)active.pausedDuration+=Date.now()-active.pauseAt;active.paused=false;active.pauseAt=null}else{active.paused=true;active.pauseAt=Date.now()}updateLive()}
function finishSession(){if(!active||active.finished)return;if(!active.startedAt){toast('Kaydedilecek bir yazma denemesi yok.');return}if(active.paused){active.pausedDuration+=Date.now()-active.pauseAt;active.paused=false}let elapsedMs=Math.max(1000,round(activeSeconds()*1000));active.finished=true;
 const correct=active.slots.filter(x=>x.ok).length;const accuracy=activeAccuracy();const wpm=round(correct/5/(elapsedMs/60000));const completed=active.slots.length>=active.target.length;const meaningful=active.bossWon||(completed&&active.slots.length>=20)||(active.slots.length>=12&&elapsedMs>=3000);
 const base=summarize(db.sessions).wpm;active.bossWon=!!active.bossWon;
 active.battleOutcome=active.bossWon?'victory':active.timeLimit&&activeSeconds()>=active.timeLimit?'escape':'incomplete';
 let xp=meaningful?(Math.min(200,Math.round(20+correct*.15+accuracy*.4+(completed?25:0)))+(active.bossWon?500:0)):0;
 let record={id:active.id,adventure:active.adventure,raid:active.raid,codeChunkTimes:active.adventure==='code'?codeChunkDurations():[],mode:active.mode,target:active.target,endedAt:Date.now(),elapsedMs,characterCount:active.slots.length,correctCharacters:correct,correctAttempts:active.correctAttempts,wrongAttempts:active.wrongAttempts,corrections:active.corrections,accuracy,wpm,comboMax:active.battleComboMax,damage:active.damage,bossRemaining:Math.ceil(active.bossHp),xp,completed,bossWon:active.bossWon,battleOutcome:active.battleOutcome,bossStage:active.bossStage,attempts:active.attempts.slice(0,3500),questsEarned:[]};
 const previously=todaySessions(),oldBadges=completedBadges().filter(x=>x.ok).map(x=>x.id);db.sessions.push(record);
 if(active.adventure){record.stars=adventureStars(active.adventure,record);record.improvedPairs=active.adventure==='castle'?improvedPairs(active.beforePairs,record):[];const score=adventureMetric(active.adventure,record),old=adventureBest(active.adventure);db.adventureRecords[active.adventure]={stars:Math.max(old.stars,record.stars),score:Math.max(old.score,score)};db.lastAdventure=active.adventure;}
 const nextQuests=quests();nextQuests.forEach((quest,i)=>{const prevWasDone=i===0?previously.length>=quest.goal:i===1?previously.flatMap(x=>x.attempts).filter(a=>a.ok&&TR_CHARS.includes(a.expected)).length>=quest.goal:previously.filter(x=>x.mode==='code'||x.adventure==='code').length>=1;if(quest.value>=quest.goal&&!prevWasDone){xp+=quest.xp;record.xp+=quest.xp;record.questsEarned.push(i)}});
 if(active.bossWon&&db.settings.sound)window.TusLabSFX?.victory();db.xp+=xp;db.shards=(db.shards||0)+(meaningful?Math.max(3,Math.round(correct/12)):0)+(active.bossWon?75:0);db.sessions=db.sessions.slice(-150);weakFocusCache=null;saveDB();const newBadges=completedBadges().filter(x=>x.ok&&!oldBadges.includes(x.id));let banner=newBadges.length?`🏅 ${newBadges.map(x=>x.name).join(', ')} rozeti açıldı!`:null;renderApp();openModal(active.adventure?'adventure-results':'results',{record,banner});toast(`${record.xp} XP kazandın! ${record.wpm} WPM · %${record.accuracy} doğruluk`);
}
function playClick(good){if(db.settings.sound)window.TusLabSFX?.key(good)}
function spawnSpark(label){const el=document.createElement('div');el.className='spark';el.textContent=label;el.style.left=(45+Math.random()*10)+'%';el.style.top='38%';document.body.appendChild(el);setTimeout(()=>el.remove(),800)}
function toast(message){const host=q('#toast-host');if(!host)return;const el=document.createElement('div');el.className='toast';el.textContent=message;host.appendChild(el);setTimeout(()=>el.remove(),2500)}
// DOM helpers
function windowHeader(which){return `<div class="panel-rim"><span class="rim-mark">${icon(which==='home'?'crown':which==='arena'?'swords':'chart')}</span><span>${which==='home'?'MACERA MERKEZİ':which==='arena'?'AKTİF SAHNE':'OYUNCU ANALİZİ'}</span><button title="Bu bölümün görevleri" data-action="${which==='home'?'missions':which==='arena'?'academy-open':'missions'}">${icon('info')}</button></div>`}
function statCard(iconName,val,label,cls='',sub=''){return `<div class="metric"><div class="metric-top"><div class="metric-icon ${cls}">${icon(iconName)}</div><div style="min-width:0"><div class="metric-val">${val}</div><div class="metric-label">${label}</div></div></div>${sub?`<small>${sub}</small>`:''}</div>`}
function hero(){let started=db.sessions.length>0;return `<div class="hero"><div class="hero-image" aria-hidden="true"></div><div class="hero-copy"><div class="eyebrow">KOMUTA MERKEZİ</div><h2>Bir sonraki rekoruna hazır mısın?</h2><p>Hızını keşfet, zayıf tuşlarını geliştir. TuşLab senin kişisel klavye koçun.</p><button class="btn primary" data-action="start" data-mode="${started?'adaptive':'classic'}">${started?'Özel Eğitimi Başlat':'İlk Testi Başlat'} ${icon('arrow','sm')}</button></div></div>`}
function progress(val){return `<div class="progress"><div style="width:${clamp(val,0,100)}%"></div></div>`}
function weeklyBins(){const arr=[];for(let i=-6;i<=0;i++){const key=tzDays(i), d=new Date();d.setDate(d.getDate()+i);const s=db.sessions.filter(x=>dateKey(x.endedAt)===key);arr.push({day:['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'][d.getDay()],wpm:round(mean(s.map(x=>x.wpm))),n:s.length})}return arr}
function weeklyBars(){let a=weeklyBins(),max=Math.max(50,...a.map(x=>x.wpm));return `<div class="bars">${a.map(p=>`<div class="bar-block"><em>${p.n?p.wpm:'–'}</em><div style="height:${p.n?Math.max(3,p.wpm/max*65):2}px;opacity:${p.n?1:.25}"></div><span>${p.day}</span></div>`).join('')}</div>`}
function getKeyboardLayout(){return db.settings.layout==='TR-F'?F_LAYOUT:Q_LAYOUT}
function keyHeatScores(sessions=selectSessions()){const {keyMap}=analytics(sessions),result={};for(let [k,v] of Object.entries(keyMap)){const ratio=v.errors/Math.max(1,v.hits);result[k.toLocaleUpperCase('tr-TR')]=v.hits>=2?(ratio>=.22?'hot':ratio>=.10?'warm':'cool'):''}return result}
function keyboardMarkup(large=false,sessions=selectSessions()){if(large&&!db.settings.keyboard)return `<button class="btn ghost" data-action="settings">Klavye gizli · Ayarlardan aç</button>`;const scores=keyHeatScores(sessions),rows=getKeyboardLayout();return `<div class="heat-keyboard ${large?'large':''}" aria-label="${db.settings.layout} ısı haritası">${rows.slice(1).map(r=>`<div class="heat-row">${[...r].map(k=>`<span class="heat-key ${scores[k]||''}" data-key="${esc(k)}" title="${esc(k)}">${esc(k)}</span>`).join('')}</div>`).join('')}${large?`<div class="heat-row"><span class="heat-key spacekey" data-key="SPACE">SPACE</span></div>`:''}</div>`}
function globalNav(){
 const items=[['arena','nav','arena','<svg data-ve-icon="" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 3 12 12-2 2L3 5V3h2Zm14 0-6 6m6-6h2v2l-6 6M4 16l4 4m-5 1 4-4m9-1 4 4m1 1-4-4"/></svg>','Yazma Arenası'],['home','nav','home','<svg data-ve-icon="" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 3v5l2 2v8l-2 3h14l-2-3v-8l2-2V3h-4v3h-3V3H9v3H5m2 12h10M9 14h6"/></svg>','Maceralar'],['pvp','pvp-enter','','<svg data-ve-icon="" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 3 12 12-2 2L3 5V3h2Zm14 0-6 6m6-6h2v2l-6 6M4 16l4 4m-5 1 4-4m9-1 4 4m1 1-4-4"/></svg>','PvP Modları'],['settings','settings','','<svg data-ve-icon="" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 3-1 3-3 1-2 5 2 5 3 1 1 3h6l1-3 3-1 2-5-2-5-3-1-1-3H9Z"/><circle cx="12" cy="12" r="3"/></svg>','Ayarlar']];
 const earned=db.xp%1150,required=1150,pct=levelProgress();
 const unread=Math.min(9,quests().filter(t=>t.value>=t.goal).length);
 return `<header class="global-header">
 <button class="brand" data-action="nav" data-mode="arena" aria-label="Yazma Arenasına dön"><span class="brand-crown"><svg data-ve-icon="" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 7 5 4 4-7 4 7 5-4-2 11H5L3 7Zm2 14h14"/></svg></span><span><strong>TuşLab <em>— Neon Arena</em></strong><small>Kişisel klavye koçu</small></span></button>
 <nav class="global-nav" aria-label="Ana menü">${items.map(([selected,action,mode,ico,label])=>`<button class="global-link ${currentView===selected?'selected':''}" data-action="${action}" ${mode?`data-mode="${mode}"`:''}${currentView===selected?' aria-current="page"':''}><span class="nav-emoji" aria-hidden="true">${ico}</span><span>${label}</span></button>`).join('')}</nav>
 <div class="header-tools"><button class="notice-button" data-action="missions" title="Görev bildirimleri" aria-label="Günlük görevleri aç">${icon('bell')}<span class="notice-count">${unread}</span></button><button class="profile-joined" data-action="missions" title="Günlük görevler"><span class="profile-orb"></span><span class="profile-details"><b>TuşLab Savaşçısı</b><small>Seviye ${level()}</small><span class="profile-meter"><i style="width:${pct}%"></i></span><small>${readable(earned)} / ${readable(required)} XP</small></span></button><button class="streak-navbar" data-action="missions"><svg data-ve-icon="" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 3c0 5 6 7 6 12a7 7 0 0 1-14 0c0-3 2-5 4-7l1 4c3-2 3-5 3-9Z"/><path d="M12 15c-3 3-2 6 0 6s3-3 0-6Z"/></svg> <b>${streak()}</b><small>günlük seri</small></button></div></header>`;
}
function questListHtml(){return quests().map((t,i)=>`<div class="quest-line"><span class="quest-check ${t.value>=t.goal?'done':''}">${t.value>=t.goal?icon('check'):icon('target')}</span><div class="quest-body"><div class="quest-top"><span>${esc(t.name)}</span><b>${t.value}/${t.goal}</b></div>${progress(t.value/t.goal*100)}</div><span class="quest-reward">+${t.xp} XP</span></div>`).join('')}
function dashboardHTML(){
 const wins=db.sessions.filter(s=>s.bossWon).length;
 const progressNow=db.xp%1150;
 return `<div class="section-heading phase4-heading commander-heading"><span class="panel-title-icon">${icon('crown')}</span><div class="phase4-heading-copy"><h2>Komuta Merkezi</h2><p>Günlük görevlerini tamamla, yeteneklerini geliştir<br class="desktop-caption-break"> ve güçlü rakiplerle arenaya çık!</p></div><button class="round-icon" data-action="settings" aria-label="Komuta Merkezi ayarları">${icon('settings')}</button></div>
 <section class="home-pvp-entry lb3-home" aria-labelledby="home-pvp-title"><div class="lb3-home-banner"><img class="lb3-home-hero fire" src="./assets/arena-king.webp" alt="" width="640" height="960" decoding="async" loading="lazy"><div class="lb3-home-copy"><span class="lb3-home-kicker">1v1 · YAZARAK DÖVÜŞ</span><h3 id="home-pvp-title">PvP Ruh Düellosu</h3><p>Bir mod seç, bota karşı hemen savaşa gir.</p></div><img class="lb3-home-hero rune" src="./assets/rune-preview.webp" alt="" width="640" height="960" decoding="async" loading="lazy"></div><div class="home-pvp-modes"><a href="?pvp=practice&amp;mode=classic" class="home-pvp-mode" data-mode-card="classic"><strong>Klasik</strong><span>120 saniyelik düello</span><em>Klasik başlat →</em></a><a href="?pvp=practice&amp;mode=rounds" class="home-pvp-mode" data-mode-card="rounds"><strong>Zamana Karşı</strong><span>Kısa turlarda yarış</span><em>Zamana Karşı başlat →</em></a><a href="?pvp=practice&amp;mode=arena" class="home-pvp-mode" data-mode-card="arena"><strong>Arena</strong><span>Skill ve eşya seç</span><em>Arena başlat →</em></a></div><div class="lb3-home-foot"><span>Arkadaşınla oynamak için oda kur, kodu paylaş.</span><button class="home-pvp-online" type="button" data-action="pvp-enter">Çevrimiçi lobiyi aç →</button></div></section>
 <section class="player-card phase4-player"><div class="player-avatar" aria-label="Oyuncu avatarı"></div><div class="player-progress"><strong>TuşLab Savaşçısı</strong><span>Seviye ${level()}</span><div class="phase4-xp-meter"><i style="width:${levelProgress()}%"></i></div><small>${readable(progressNow)} / 1.150 XP</small></div><div class="streak-chip">${icon('flame')} <b>${streak()}</b><small>günlük seri</small></div></section>
 <div class="commander-tabs phase4-tabs"><button data-action="command-tab" data-mode="quests" class="${commanderTab==='quests'?'selected':''}">${icon('target')} Günlük Görevler</button><button data-action="command-tab" data-mode="equipment" class="${commanderTab==='equipment'?'selected':''}">${icon('shield')} Ekipman</button><button data-action="command-tab" data-mode="skills" class="${commanderTab==='skills'?'selected':''}">${icon('zap')} Yetenekler</button></div>
 <div class="commander-tab-body phase4-quest-box" id="commander-tab-body">${commanderTab==='quests'?questListHtml():commanderTab==='equipment'?shopInline():skillInline()}</div>
 <button class="challenge-card phase4-challenge" data-action="start" data-mode="boss"><div class="challenge-icon">${icon('swords')}</div><div class="challenge-copy"><b>Harf Muhafızını Yen!</b><span>${wins?'Yeniden savaş ve rekorunu kır':'Arenadaki boss’a meydan oku'}</span><small>${wins?'1/1':'0/1'}</small></div><span class="bonus-xp">+300 XP</span></button>
 <div class="subsection-title phase4-adventure-head"><h3>Roguelike Maceralar</h3><button data-action="academy-open">Tümünü Gör →</button></div>
 <div class="adventure-grid phase4-adventure-grid"><button class="adventure adventure-one" data-action="adventure" data-mode="speed"><span class="adventure-poster"></span><strong>Hız Koridoru</strong><small>${icon('clock')} 30 sn · ${'★'.repeat(adventureBest('speed').stars)}${'☆'.repeat(3-adventureBest('speed').stars)}</small><span><svg data-ve-icon="" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14 3-9 10h6l-1 8 9-11h-6l1-7Z"/></svg> XP kazan</span></button><button class="adventure adventure-two" data-action="adventure" data-mode="castle"><span class="adventure-poster"></span><strong>Kelime Kalesi</strong><small>${icon('clock')} 40 kelime · ${'★'.repeat(adventureBest('castle').stars)}${'☆'.repeat(3-adventureBest('castle').stars)}</small><span><svg data-ve-icon="" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14 3-9 10h6l-1 8 9-11h-6l1-7Z"/></svg> XP kazan</span></button><button class="adventure adventure-three" data-action="adventure" data-mode="code"><span class="adventure-poster"></span><strong>Kod Patikası</strong><small>${icon('clock')} 3 kod · ${'★'.repeat(adventureBest('code').stars)}${'☆'.repeat(3-adventureBest('code').stars)}</small><span><svg data-ve-icon="" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14 3-9 10h6l-1 8 9-11h-6l1-7Z"/></svg> XP kazan</span></button></div>
 <button class="btn launch-button phase4-launch" data-action="adventure-start" data-mode="${db.lastAdventure||'speed'}">${icon('swords')} Maceraya Başla ${icon('arrow')}</button>`
}
function shopInline(){let items=[['pen','Keskin Kalem',130,'+2 hasar / doğru karakter'],['clock','Zaman Tılsımı',170,'Süreli testlere +15 saniye'],['shield','İstikrar Zırhı',220,'Boss savaşında bir hatayı engeller']];return `<div class="mini-shop"><div class="small muted">Kristallerin: <b>${db.shards||0} ◈</b></div>${items.map(([k,n,price,desc])=>`<button class="mini-shop-item" data-action="buy" data-mode="${k}"><span>${k==='pen'?'<svg data-ve-icon="" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m17 3 4 0 0 4-10 10-4-4L17 3ZM5 12l7 7m-9 2 5-5"/></svg>':k==='clock'?'<svg data-ve-icon="" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12M6 21h12M7 3v5l10 8v5M17 3v5L7 16v5M9 18h6"/></svg>':'<svg data-ve-icon="" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 8 3v6c0 4-4 8-8 10-4-2-8-6-8-10V6l8-3Z"/><path d="m8 12 3 3 5-6"/></svg>'}</span><span><b>${n}</b><small>${desc}</small></span><em>${db.equipment?.includes(k)?'✓ Açık':price+' ◈'}</em></button>`).join('')}</div>`}
function skillInline(){return `<div class="mini-shop"><div class="small muted">Yetenekler kazandığın rozetlerle açılır.</div>${[['İlk Hamle',db.sessions.length>=1,'İlk testinle açılır'],['Türkçe Ustalığı',db.sessions.some(s=>s.mode==='adaptive'),'Kişisel eğitimi tamamla'],['Canavar Avcısı',db.sessions.some(s=>s.bossWon),'Boss savaşını kazan']].map(([n,ok,description])=>`<div class="mini-shop-item passive"><span>${ok?'<svg data-ve-icon="" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m11 3 2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6Zm8 13 1 3 2 1-2 1-1 2-1-2-2-1 2-1 1-3Z"/></svg>':'<svg data-ve-icon="" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/></svg>'}</span><span><b>${n}</b><small>${description}</small></span><em>${ok?'Açıldı':'Kilitli'}</em></div>`).join('')}</div>`}
function fireKeyboardHTML(){
 const rows=getKeyboardLayout().slice(1);
 return `<div class="fire-keyboard" role="group" aria-label="Canlı Türkçe klavye">${rows.map((row,i)=>`<div class="fire-key-row row-${i}">${[...row].map(k=>`<button type="button" class="fire-key" tabindex="-1" data-virtual-key="${esc(k)}" data-key="${esc(k)}" aria-label="${esc(k)} tuşuna bas">${esc(k)}</button>`).join('')}</div>`).join('')}<div class="fire-key-row space-row"><button type="button" class="fire-key space" tabindex="-1" data-virtual-key="SPACE" data-key="SPACE" aria-label="Boşluk">BOŞLUK</button></div></div>`;
}
function arenaStats(){return `<div class="battle-stat-row"><div><span>⚡ ANLIK HIZ</span><strong id="live-wpm">0</strong><small>WPM</small></div><div><span>🔥 KOMBO</span><strong id="live-combo">0</strong><small>Seri</small></div><div><span>◎ DOĞRULUK</span><strong id="live-accuracy">%100</strong></div><div><span>★ KAZANILAN XP</span><strong id="live-xp">+0</strong></div></div>`}
function typingText(){if(!active)return '';const chars=Array.from(active.target);const n=active.slots.length;let start=n,end=n;while(start>0&&!/\s/.test(chars[start-1]||''))start--;while(end<chars.length&&!/\s/.test(chars[end]||''))end++;const body=chars.map((c,i)=>{let slot=active.slots[i],classes=[];if(i===n&&!active.finished)classes.push('active');if(i>=start&&i<end&&!active.finished)classes.push('current-word');if(slot?.skipped)classes.push('skipped');else if(slot)classes.push(slot.ok?'correct':'wrong');else classes.push('pending');const display=c==='\n'?'<br>':esc(c);return `<span class="char ${classes.join(' ')}" data-idx="${i}" title="${slot&&!slot.ok?`Beklenen: ${esc(c)} | Yazılan: ${esc(slot.actual||'atlanmış')}`:''}">${display}</span>`}).join('')+(n===chars.length&&!active.finished?'<span class="char active current-word" data-idx="'+chars.length+'">&nbsp;</span>':'');return `<div id="typing-flow" class="typing-flow">${body}</div>`}
function lessonTasks(){const f=weakFocus(), last=active, accuracy=activeAccuracy(),wpm=activeWpm(),target=Math.max(25,round(summarize(db.sessions).wpm*1.05));return [
 {name:'Mevcut metni tamamla',done:last?.slots.length===last?.target.length},
 {name:'%95+ doğruluk elde et',done:(last?.attempts.length||0)>=25&&accuracy>=95},
 {name:`“${f.pairs[0]}” geçişini en az 3 kez yaz`,done:active?.attempts.filter(a=>a.ok&&(a.prevExpected||'')+a.expected===f.pairs[0]).length>=3},
 {name:`${target}+ WPM hıza ulaş`,done:wpm>=target&&(last?.attempts.length||0)>=25}
]}
function sideCoachHTML(){const focus=weakFocus();return `<div class="card"><div class="flex between center"><div class="card-title" style="margin:0">${icon('bot')} Arena Rehberi</div><span class="good tiny">● Canlı analiz</span></div><p id="coach-live">${esc(coachText())}</p></div>
 <div class="card"><div class="card-title">Zayıf Tuş Kombinasyonları</div><div>${focus.pairs.map((p,i)=>`<button class="combo-chip ${i>1?'goodchip':''}" data-action="start" data-mode="adaptive" title="Kişisel eğitim başlat">${esc(p)}</button>`).join('')}</div></div>
 <div class="card"><div class="card-title">${icon('info')} Anlık İpucu</div><p id="instant-tip">${focus.hasData?`“${focus.pairs[0]}” kombinasyonunda ritmi koru. Önce doğru yazmaya odaklan.`:'İlk testin sonrasında yavaş geçişlerine göre özel ipuçları burada gösterilecek.'}</p></div>
 <div class="card"><div class="card-title">Görev Listesi</div><div class="listchecks" id="live-tasks">${taskHTML()}</div></div>`}
function taskHTML(){return lessonTasks().map(t=>`<div class="checkline"><span class="checkmark">${t.done?icon('check','sm'):''}</span>${esc(t.name)}</div>`).join('')}
function gameBossHtml(){
 const hp=active?.bossHp??active?.bossMaxHp??1,max=active?.bossMaxHp||1;
 const bossName=active?.raid?'Satranç Kralı':active?.mode==='code'?'Kod Golemi':'Harf Muhafızı';
 return `<section data-stage="${active?.bossStage||1}" class="boss-battle ${active?.bossHp<=0?'boss-defeated':''}" id="boss-battle">
 <div class="boss-flash" aria-hidden="true"></div>
 <div class="boss-grid">
  <div class="boss-head-left"><div class="arena-mode-label">${esc(active?.adventure?ADVENTURES[active.adventure].name:active?.raid?'Haftalık Baskın':active?.mode==='classic'?'Klasik Savaş':modeLabel(active?.mode))}</div><div class="boss-kicker">${icon('crown','sm')} <span>Boss: ${esc(bossName)}</span></div>
   <small>Tuşların hakimine dönüşen kadim satranç ruhu.</small>
   <div class="boss-health"><div class="health-track"><div id="boss-meter-lag"></div><div id="boss-meter" style="width:${Math.max(0,hp/max*100)}%"></div></div><span id="boss-hp">${readable(Math.ceil(hp))} / ${readable(max)} HP</span></div>
  </div>
  <div class="boss-combo-cell"><div class="combat-combo"><b id="battle-combo">${active?.battleCombo||0}x</b><small>Kombo</small></div></div>
  <div class="boss-figure" aria-label="${esc(bossName)} boss görseli"></div>
  <div class="boss-right-column">
   <span id="boss-phase" class="phase-badge">Aşama 1/3</span>
   <div class="boss-clock"><b id="live-time">00:00</b></div>
   <div class="fire-boss-stats"><div class="fire-boss-stat"><span>⚡</span><b id="battle-live-wpm">0</b><small>WPM</small></div><div class="fire-boss-stat"><span>◎</span><b id="battle-live-acc">%100</b><small>Doğruluk</small></div><div class="fire-boss-stat"><span>★</span><b id="battle-live-xp">+0</b><small>Kazanılan XP</small></div></div><div class="boss-last-impact" id="boss-last-impact"><small>SON VURUŞ</small><strong id="last-hit-value">—</strong></div>
  </div>
 </div>
 <div class="boss-effect-anchor" id="boss-effect-anchor" aria-hidden="true"></div>
 <span class="visually-hidden" id="boss-damage-total">0</span>
 </section>`;
}
function battleCoachHtml(){return `<aside class="battle-guide"><div class="guide-title">${icon('info','sm')} Anlık İpucu</div><p id="instant-tip">${esc(liveTip())}</p></aside>`}

function arenaHTML(){
 const mode=active?.mode||'classic';
 const choices=[['classic','Klasik Mod'],['time','Zaman Yarışı'],['burst','Kelime Patlaması'],['custom','Özel Metin']];
 return `<div class="fire-arena-top"><div class="fire-arena-heading"><span class="fire-swords">⚔️</span><div><h2>Yazma Arenası</h2><p>Doğru yaz, hasar ver, boss'u alt et!</p></div></div><div class="fire-arena-modes">${choices.map(([m,label])=>`<button type="button" class="fire-mode ${m===mode?'selected':''}" data-action="${m==='custom'?'custom-open':'start'}" data-mode="${m}">${label}</button>`).join('')}<button class="fire-audio" type="button" data-action="sound-toggle" aria-label="Sesi aç veya kapat" aria-pressed="${db.settings.sound?'true':'false'}" title="${db.settings.sound?'Ses açık':'Ses kapalı'}">${icon('sound')}</button></div></div>
 <div class="fire-arena-stage"><div class="arena-backdrop" aria-hidden="true" data-stage="${active?.bossStage||1}"><img src="./assets/arena-king.webp" alt="" loading="lazy"><span class="boss-ambient-particles"><i></i><i></i><i></i></span></div>${gameBossHtml()}</div>
 <section class="combat-writing fire-writing"><div id="typing-stage" class="typing-stage" data-mode="${mode}" tabindex="0" aria-label="Yazma alanı"><div id="typing-text" class="text-main">${typingText()}</div></div><div class="typing-meta"><div class="progress typing-progress"><div style="width:${activeProgress()}%"></div></div><span id="live-progress">${active.slots.length} / ${active.target.length} karakter</span></div></section>
 <div id="arena-keyboard" class="fire-keyboard-wrap">${db.settings.keyboard?fireKeyboardHTML():'<button class="btn ghost" data-action="settings">Klavye gizli · Ayarlardan aç</button>'}</div>
 <div class="fire-bottom-stats">${arenaStats()}</div>
 <div class="pause-screen" id="pause-screen" aria-live="polite"><strong>⏸ Arena duraklatıldı</strong><p>Esc = Devam et</p><p>Tab + Enter = Yeniden başlat</p></div>`;
}

function chartLine(){
 let bins=weeklyBins();const W=240,H=123,L=22,R=8,T=16,B=23;
 const max=Math.max(60,Math.ceil(Math.max(...bins.map(x=>x.wpm))/20)*20),plotH=H-T-B;
 const p=(i,v)=>`${round(L+i*(W-L-R)/6)},${round(T+(max-v)/max*plotH)}`;
 const hasData=bins.some(x=>x.n);
 const path=bins.map((x,i)=>`${i?'L':'M'} ${p(i,x.wpm)}`).join(' ');
 const ghost='M 22,91 C 44,85 52,82 66,72 S 98,70 119,54 S 152,52 173,39 S 210,36 232,23';
 const cyan='M 22,106 C 44,99 50,92 66,94 S 100,85 119,80 S 154,72 173,69 S 210,62 232,56';
 return `<svg class="chart-svg ${hasData?'':'chart-placeholder'}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${hasData?'Son 7 gündeki WPM grafiği':'Örnek gelişim eğrisi; henüz kullanıcı verisi yok'}">
 ${[0,1,2,3].map(i=>`<line x1="${L}" x2="${W-R}" y1="${T+i*plotH/3}" y2="${T+i*plotH/3}" stroke="#23365f" stroke-dasharray="2 3"/><text x="1" y="${T+i*plotH/3+3}" fill="#839abc" font-size="8">${round(max*(3-i)/3)}</text>`).join('')}
 ${hasData?`<path d="${path}" fill="none" stroke="#a86cff" stroke-width="2.2"/>${bins.filter(x=>x.n).map(x=>{let i=bins.indexOf(x);return `<circle cx="${p(i,x.wpm).split(',')[0]}" cy="${p(i,x.wpm).split(',')[1]}" r="3" fill="#c8aeff" stroke="#6d3deb"/>`}).join('')}`:`<path d="${ghost}" fill="none" stroke="#a86cff" stroke-opacity=".46" stroke-width="2.3"/><path d="${cyan}" fill="none" stroke="#40e0f7" stroke-opacity=".28" stroke-width="2"/>`}
 ${bins.map((b,i)=>`<text x="${L+i*(W-L-R)/6}" y="${H-5}" text-anchor="middle" font-size="8" fill="#889cbd">${b.day}</text>`).join('')}</svg>
 ${hasData?'':'<div class="chart-sample-note">İlk antrenmandan sonra dolacak</div>'}`;
}
function rankedWords(){
 let errors={};
 for(let session of selectSessions()){
  if(!session.target)continue;
  let original=session.target;
  for(let a of session.attempts||[]){
   if(a.ok||!Number.isInteger(a.slotIndex))continue;
   let index=a.slotIndex;if(index>=original.length)continue;
   let left=index,right=index;
   while(left>0&&!/\s/.test(original[left-1]))left--;
   while(right<original.length&&!/\s/.test(original[right]))right++;
   let word=original.slice(left,right).replace(/^[^\p{L}\d]+|[^\p{L}\d]+$/gu,'').toLocaleLowerCase('tr-TR');
   if(word.length>1&&word.length<35)errors[word]=(errors[word]||0)+1;
  }
 }
 let words=Object.entries(errors).sort((a,b)=>b[1]-a[1]).slice(0,5);
 if(!words.length)return '<div class="big-empty">Henüz hatalı kelime kaydı yok.</div>';
 let top=words[0][1];return words.map(([word,count],i)=>`<div class="rank-row"><span class="rank">${i+1}</span><span class="rank-char" style="width:auto;min-width:55px;font-size:12px;overflow:hidden;text-overflow:ellipsis" title="${esc(word)}">${esc(word)}</span><div class="rank-track"><div style="width:${round(count/top*100)}%"></div></div><span class="rank-rate">${count}</span></div>`).join('');
}
function rankedKeys(){let keys=analytics().keys.filter(x=>x.hits>=1).slice(0,5);if(!keys.length)return '<div class="big-empty">Hata analizi ilk testin ardından oluşacak.</div>';let max=Math.max(1,...keys.map(x=>x.errors));return keys.map((x,i)=>`<div class="rank-row"><span class="rank">${i+1}</span><span class="rank-char">${esc(x.key)}</span><div class="rank-track"><div style="width:${x.errors?Math.max(3,x.errors/max*100):0}%"></div></div><span class="rank-rate">${round(x.rate*100)}%</span></div>`).join('')}
function transitionRows(){let rows=analytics().pairs.filter(x=>x.hits>=2&&x.avg>0).slice(0,5);if(!rows.length)return `<div class="big-empty">Tekrarlanan harf geçişleri kaydedildikçe burada analiz edilecek.</div>`;return rows.map(x=>{let bad=x.avg>450||x.rate>.15,mid=x.avg>300||x.rate>.08;return `<div class="transition-row"><span class="bold">${esc(x.pair)}</span><span class="muted">${x.avg} ms</span><span class="tag ${bad?'danger':mid?'warning':''}">${bad?'Öncelikli':mid?'Tekrar':'Akıcı'}</span></div>`}).join('')}
function statTrend(current,previous){
 if(!Number.isFinite(current)||!Number.isFinite(previous)||previous<=0)return '—';
 const change=round((current-previous)/previous*100);
 return `<span class="${change<0?'trend-negative':'trend-positive'}">${change>=0?'↑ +':'↓ '}${change}%</span>`;
}
function weeklyRaidData(){const r=weekRaid();return {damage:r.damage,bossWins:db.sessions.filter(s=>s.bossWon).length,claimed:r.claimed};}
function daysUntilWeekEnd(){return raidDaysLeft();}
function fullWeekStats(offset=0){
 const end=Date.now()-offset*7*DAY,start=end-7*DAY;
 return summarize(db.sessions.filter(s=>s.endedAt>=start&&s.endedAt<end));
}
function phase4ScoreCards(selected){
 const prev=fullWeekStats(1),cur=fullWeekStats(0);
 const prevTasks=0; // Earlier daily quest completions are not persisted as an independent historical count.
 const tasks=quests().filter(t=>t.value>=t.goal).length;
 const stats=[
  ['zap','Ort. WPM',selected.count?selected.wpm:'—',statTrend(cur.count?cur.wpm:NaN,prev.count?prev.wpm:NaN)],
  ['target','Doğruluk',selected.count?selected.accuracy+'%':'—',statTrend(cur.count?cur.accuracy:NaN,prev.count?prev.accuracy:NaN)],
  ['star','Toplam XP',readable(db.xp),statTrend(cur.xp,prev.xp)],
  ['trophy','Tamamlanan Görev',tasks,'Bugün']
 ];
 return `<div class="score-grid phase4-score-grid">${stats.map(([ico,label,value,delta])=>`<div class="phase4-score"><span class="phase4-score-label">${icon(ico)}<small>${label}</small></span><b>${value}</b><span class="phase4-trend">${delta}</span></div>`).join('')}</div>`;
}
function phase4Chart(){
 const bins=weeklyBins();const any=bins.some(x=>x.n),W=300,H=140,L=18,R=8,T=12,B=23;
 const maxWpm=Math.max(60,...bins.map(x=>x.wpm));
 const xy=(i,v,type)=>[round(L+i*(W-L-R)/6),round(T+(1-v/(type==='acc'?100:maxWpm))*(H-T-B))];
 const makePath=(values,type)=>values.map((x,i)=>{const [px,py]=xy(i,x,type);return `${i?'L':'M'}${px},${py}`}).join(' ');
 const wpms=any?bins.map(x=>x.wpm):[20,27,34,36,44,40,53];
 const acc=[62,65,70,73,79,78,85];
 // Populate actual daily accuracy from the same dates as weeklyBins.
 const accuracyValues=bins.map((x,i)=>{const d=new Date();d.setDate(d.getDate()-6+i);const daySessions=db.sessions.filter(s=>dateKey(s.endedAt)===dateKey(d));return daySessions.length?round(mean(daySessions.map(s=>s.accuracy))):0});
 return `<div class="phase4-graph"><div class="phase4-legend"><span class="legend-wpm">● WPM</span><span class="legend-accuracy">● Doğruluk</span></div><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="phase4-chart-svg" role="img" aria-label="Haftalık WPM ve doğruluk çizgileri">${[0,1,2,3].map(i=>`<line x1="${L}" y1="${T+i*29}" x2="${W-R}" y2="${T+i*29}" stroke="#32466e" stroke-width="1" stroke-dasharray="3 4"/>`).join('')}<path d="${makePath(wpms,'wpm')}" stroke="#aa6aff" stroke-width="3" fill="none" stroke-linecap="round" ${any?'':'stroke-dasharray="6 5" opacity=".35"'}/><path d="${makePath(any?accuracyValues:acc,'acc')}" stroke="#38d6ed" stroke-width="3" fill="none" stroke-linecap="round" ${any?'':'stroke-dasharray="6 5" opacity=".35"'}/>${bins.map((x,i)=>`<text x="${xy(i,0,'wpm')[0]}" y="${H-5}" fill="#a1afd9" font-size="11" text-anchor="middle">${x.day}</text>`).join('')}</svg>${any?'':'<span class="phase4-chart-empty">İlk antrenmandan sonra dolacak</span>'}</div>`;
}
function phase4WeakRows(sessions){
 const entries=analytics(sessions).pairs.filter(x=>x.hits>=2).slice(0,5);
 const demo=[['r→t',72],['g→h',58],['a→r',41],['k→l',39],['ş→i',28]];
 const rows=entries.length?entries.map(x=>[x.pair,round(Math.max(x.rate*100,Math.min(100,x.avg/650*100)))]):demo;
 return `<div class="phase4-weak-list ${entries.length?'':'phase4-sample'}">${rows.map(([pair,n])=>`<div class="weak-row"><b>${esc(pair)}</b><div class="weak-bar"><i style="width:${n}%;background:${n>=55?'#ff5983':n>=35?'#f8a35a':'#4cdebd'}"></i></div><small>${n}%</small></div>`).join('')}${entries.length?'':'<p class="phase4-data-hint">İlk antrenmandan sonra dolacak</p>'}</div>`;
}
function phase4HeatMap(sessions){
 const dict=analytics(sessions).keyMap;const populated=Object.keys(dict).length>0;
 return `<div class="phase4-heat-map ${populated?'':'phase4-no-data'}">${getKeyboardLayout().slice(1).map(line=>`<div class="phase4-heat-row">${[...line].map(key=>{const item=dict[key]||dict[key.toLocaleLowerCase('tr-TR')];const err=item?.hits>=2?item.errors/item.hits:-1;const tier=err<0?'no-data':err>=.26?'hot':err>=.17?'orange':err>=.09?'yellow':err>=.04?'green':'blue';return `<span title="${esc(key)}${err>=0?' · Hata: %'+round(err*100):''}" class="phase4-heat-key ${tier}">${esc(key)}</span>`}).join('')}</div>`).join('')}${populated?'<div class="phase4-heat-legend"><span>● Zor</span><span>● Orta</span><span>● İyi</span></div>':'<p class="phase4-data-hint">İlk antrenmandan sonra dolacak</p>'}</div>`;
}
function performanceHTML(){
 const sessions=selectSessions(),summary=summarize(sessions);
 const raid=weeklyRaidData(),days=daysUntilWeekEnd(),raidGoal=50000;
 const raidProgress=Math.min(100,raid.damage/raidGoal*100);
 return `<div class="section-heading phase4-heading performance-heading"><span class="panel-title-icon">${icon('chart')}</span><div class="phase4-heading-copy"><h2>Performans Merkezi</h2><p>Gelişimini takip et, zayıf yönlerini güçlendir.</p></div><select id="range-select" class="range-select" aria-label="Veri aralığı"><option value="7" ${currentRange==='7'?'selected':''}>Son 7 gün</option><option value="30" ${currentRange==='30'?'selected':''}>Son 30 gün</option><option value="all" ${currentRange==='all'?'selected':''}>Tüm zamanlar</option></select></div>
 ${phase4ScoreCards(summary)}
 <div class="analytics-rogue-grid phase4-analytics-grid"><section class="analysis-card phase4-graph-card"><h3>${icon('chart')} Gelişim Grafiği</h3>${phase4Chart()}</section><section class="analysis-card phase4-weak-card"><h3>${icon('activity')} Zayıf Geçiş Analizi</h3>${phase4WeakRows(sessions)}</section></div>
 <section class="weekly-raid phase4-weekly-raid"><div class="raid-bg"></div><div class="raid-content"><div class="phase4-raid-top"><span class="raid-eyebrow">${icon('crown')} Haftalık Baskın</span><span id="raid-days" data-week="${localWeekKey()}" class="raid-countdown">${raid.claimed?'Tamamlandı':`${days} gün kaldı`}</span></div><h3>Satranç Kralı'nın Dönüşü</h3><p>Haftalık boss'a karşı gücünü göster!</p><div class="raid-progress"><div class="progress"><div id="raid-damage-bar" style="width:${raidProgress}%"></div></div><span id="raid-damage">${readable(Math.min(raid.damage,raidGoal))} / ${readable(raidGoal)} hasar</span></div><div class="phase4-raid-bottom"><span class="raid-reward" title="Boss zaferi ödülü"><svg data-ve-icon="" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V3h8v4M3 12h18m-13-2v4m8-4v4"/></svg> <small>Ödül: +500 XP</small></span><button class="btn primary" data-action="start" data-mode="boss" data-raid="true" ${raid.claimed?'disabled':''}>${raid.claimed?'Tamamlandı':'Baskına Katıl'} ${icon('arrow')}</button></div></div></section>`;
}
function hubHTML(){return `<div class="full-center-page"><span class="eyebrow ember"><svg data-ve-icon="" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 7 5 4 4-7 4 7 5-4-2 11H5L3 7Zm2 14h14"/></svg> MACERA HARİTASI</span><h2>Yeni bir maceraya çık</h2><p>Sol panelden göreve hazırlan, arenada savaş veya bir becerini geliştir.</p><div class="hub-hero"><div class="hub-scene"></div><div><h3>Harf Muhafızı seni bekliyor!</h3><p>Yazdığın her doğru karakter saldırıya dönüşür. Düşmanın canını sıfıra indir.</p><button class="btn primary" data-action="start" data-mode="boss">Boss savaşına gir →</button></div></div><div class="hub-grid"><button data-action="start" data-mode="adaptive"><svg data-ve-icon="" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="13" r="8"/><circle cx="11" cy="13" r="4"/><path d="m11 13 9-10m-1 0h3v3"/></svg><b>Kişisel Eğitim</b><small>Hatalarınla savaş</small></button><button data-action="start" data-mode="time"><svg data-ve-icon="" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14 3-9 10h6l-1 8 9-11h-6l1-7Z"/></svg><b>Hız Arenası</b><small>Zamana karşı yarış</small></button><button data-action="nav" data-mode="academy"><svg data-ve-icon="" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m2 8 10-5 10 5-10 5L2 8Zm4 2v7l6 3 6-3v-7m4-2v9"/></svg><b>Akademi</b><small>Yeteneklerini geliştir</small></button><button data-action="start" data-mode="code"><svg data-ve-icon="" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-14-2 16"/></svg><b>Kod Dövüşü</b><small>Kod yazarak savaş</small></button></div></div>`}
function academyHTML(){const f=weakFocus();let lessons=[['adaptive','<svg data-ve-icon="" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="13" r="8"/><circle cx="11" cy="13" r="4"/><path d="m11 13 9-10m-1 0h3v3"/></svg>','Kişisel Zayıflıklar',`Öncelikli harfler: ${f.keys.join(', ')}`],['classic','<svg data-ve-icon="" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 9h1m4 0h1m4 0h1M6 12h1m4 0h1m4 0h1M7 16h10"/></svg>','Türkçe Akıcılık','Dengeli paragraflarla yazma'],['time','<svg data-ve-icon="" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14 3-9 10h6l-1 8 9-11h-6l1-7Z"/></svg>','Hız Kampı','Zamana karşı ritim çalışması'],['burst','<svg data-ve-icon="" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 2 2 6 6-3-3 6 5 2-6 2 2 6-6-3-4 4 1-7-7-2 6-3-2-6 6 3V2Z"/></svg>','Kelime Patlaması','Seri kelime savaşları'],['code','<svg data-ve-icon="" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-14-2 16"/></svg>','Kod Ustalığı','Parantez, sembol, girinti'],['boss','<svg data-ve-icon="" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 7 5 4 4-7 4 7 5-4-2 11H5L3 7Zm2 14h14"/></svg>','Boss Sınavı','Tekrarları gerçek bir dövüşle test et']];return `<div class="full-center-page"><span class="eyebrow cyan"><svg data-ve-icon="" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m2 8 10-5 10 5-10 5L2 8Zm4 2v7l6 3 6-3v-7m4-2v9"/></svg> BECERİ AĞACI</span><h2>Eğitim Akademisi</h2><p>Bir eğitim seçtiğinde metin üretilir, her tuş ölçülür ve performansına göre yeni dersler hazırlanır.</p><div class="academy-grid">${lessons.map(([mode,em,title,detail])=>`<button class="academy-lesson" data-action="start" data-mode="${mode}"><span>${em}</span><strong>${title}</strong><small>${esc(detail)}</small><em>Başlat →</em></button>`).join('')}</div><div class="academy-info"><b><svg data-ve-icon="" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 3 12 12-2 2L3 5V3h2Zm14 0-6 6m6-6h2v2l-6 6M4 16l4 4m-5 1 4-4m9-1 4 4m1 1-4-4"/></svg> Arena Rehberi'nin önerisi</b><p>${esc(coachText())}</p></div></div>`}
function detailHTML(){return `<div class="full-center-page"><span class="eyebrow cyan"><svg data-ve-icon="" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 21V5h18v16H3Zm4-4v-5m5 5V8m5 9v-7M3 21h18"/></svg> VERİ MERKEZİ</span><h2>Performans Analizi</h2><p>Oturumlarının ayrıntılı dökümü, hata nedenleri ve gelişim bilgileri.</p><div class="detail-cards"><div class="analysis-card"><h3>7 günlük gelişim</h3>${chartLine()}</div><div class="analysis-card"><h3>Karakter hataları</h3>${rankedKeys()}</div><div class="analysis-card"><h3>Geçiş süreleri</h3>${transitionRows()}</div><div class="analysis-card"><h3>Problemli kelimeler</h3>${rankedWords()}</div></div><button class="btn primary" data-action="start" data-mode="adaptive">Zayıf noktalara göre çalış →</button></div>`}
function renderApp(){document.documentElement.classList.toggle('reduced-motion',db.settings.reduceMotion);document.documentElement.classList.toggle('effects-reduced',db.settings.effectsReduced);const center=currentView==='home'?hubHTML():currentView==='academy'?academyHTML():currentView==='analytics'?detailHTML():arenaHTML();q('#app').innerHTML=`<div class="app-layout rogue-app">${globalNav()}<div class="three-windows"><section id="panel-home" class="browser-window commander-window" aria-label="Komuta Merkezi">${windowHeader('home')}<div class="window-content">${dashboardHTML()}</div></section><section id="panel-arena" class="browser-window arena-window" aria-label="${currentView==='academy'?'Eğitim Akademisi':'Yazma Arenası'}">${windowHeader('arena')}<div class="window-content">${center}</div></section><section id="panel-analytics" class="browser-window analytics-window" aria-label="Performans Merkezi">${windowHeader('analytics')}<div class="window-content">${performanceHTML()}</div></section></div></div><div id="modal-host"></div>`;const typing=q('#typing-text');if(typing)typing.dataset.renderedCount=String(active?.slots.length||0);updateLive(false)}
function updateLive(renderText=true){if(!active)return;if(renderText&&q('#typing-text')){
 const area=q('#typing-text'),flow=q('#typing-flow');const next=active.slots.length;
 const prev=Number(area.dataset.renderedCount??Math.max(0,next-1));
 const children=flow?.querySelectorAll('.char')||[];
 if(children.length<active.target.length){area.innerHTML=typingText();}
 else {
  const chars=Array.from(active.target);
  let first=next,last=next;
  while(first>0&&!/\s/.test(chars[first-1]||''))first--;
  while(last<chars.length&&!/\s/.test(chars[last]||''))last++;
  const from=Math.max(0,Math.min(prev,next)-36),to=Math.min(chars.length-1,Math.max(prev,next)+40);
  for(let i=from;i<=to;i++){
   const el=children[i],slot=active.slots[i];if(!el)continue;
   const classes=['char'];if(i===next&&!active.finished)classes.push('active');
   if(i>=first&&i<last&&!active.finished)classes.push('current-word');
   if(slot?.skipped)classes.push('skipped');else if(slot)classes.push(slot.ok?'correct':'wrong');else classes.push('pending');
   const wanted=classes.join(' ');if(el.className!==wanted)el.className=wanted;
   if(slot&&!slot.ok)el.title='Beklenen: '+chars[i]+' | Yazılan: '+(slot.actual||'atlanmış');else if(el.title)el.removeAttribute('title');
  }
 }
 area.dataset.renderedCount=String(next);
}const earnedXp='+'+round(Math.min(200,active.slots.length*.15+activeAccuracy()*.4));setText('#live-wpm',activeWpm());setText('#battle-live-wpm',activeWpm());setText('#battle-live-acc','%'+activeAccuracy());setText('#battle-live-xp',earnedXp);if(q('#next-word')){const pos=active.slots.length;const rest=active.target.slice(pos).trimStart();setText('#next-word',(rest.match(/^[^\s]+/)||rest.match(/\S+/)||['Bitti!'])[0]);}setText('#live-accuracy','%'+activeAccuracy());setText('#live-combo',active.battleCombo+'x');setText('#live-time',formatTime(activeRemaining()));setText('#arena-hud-time',formatTime(activeRemaining()));setText('#arena-hud-accuracy','%'+activeAccuracy());setText('#arena-hud-remaining',`${Math.max(0,active.target.slice(active.slots.length).trim().split(/\s+/).filter(Boolean).length)} kelime`);setText('#live-xp',earnedXp);setText('#live-progress',`${active.slots.length} / ${active.target.length} karakter`);const bar=q('.typing-progress>div');if(bar)bar.style.width=activeProgress()+'%';let stage=q('#typing-stage');if(stage){stage.classList.toggle('paused',active.paused);stage.classList.toggle('completed',active.finished)}const flow=q('#typing-flow');if(flow){const cursor=flow.querySelector('.char.active')||flow.lastElementChild;if(cursor){const first=flow.querySelector('.char');const lineHeight=parseFloat(getComputedStyle(flow).lineHeight)||32;const line=Math.max(0,Math.round((cursor.offsetTop-(first?.offsetTop||0))/lineHeight));const shift=Math.max(0,line-2)*lineHeight;const nextTransform=`translateY(${-shift}px)`;if(flow.style.transform!==nextTransform)flow.style.transform=nextTransform;}}const pauseScreen=q('#pause-screen');if(pauseScreen)pauseScreen.classList.toggle('open',!!active.paused);const bossBackdrop=q('#panel-arena .arena-backdrop');if(bossBackdrop)bossBackdrop.classList.toggle('boss-paused',!!active.paused);setText('#coach-live',liveCoachText());setText('#instant-tip',liveTip());const ghost=q('#ghost-progress');if(ghost)ghost.style.width=Math.min(100,activeSeconds()*active.ghostWpm*5/60/active.target.length*100)+'%';const tasks=q('#live-tasks');if(tasks){const html=taskHTML();if(tasks.innerHTML!==html)tasks.innerHTML=html;}const pause=q('#pause-control');if(pause)pause.innerHTML=`${icon(active.paused?'play':'pause','sm')} ${active.paused?'Devam':'Duraklat'}`;
 updatePressed();updateBoss();if(active.startedAt&&active.timeLimit&&activeSeconds()>=active.timeLimit&&!active.finished)finishSession()}
function setText(selector,value){const el=q(selector),text=String(value);if(el&&el.textContent!==text)el.textContent=text}
function updatePressed(){
 const next=(active?.target[active?.slots.length]||'').toLocaleUpperCase('tr-TR');
 const now=performance.now();
 document.querySelectorAll('.heat-key,.fire-key').forEach(el=>{
  const key=(el.dataset.key||el.textContent.trim()).toLocaleUpperCase('tr-TR');
  el.classList.toggle('pressed',key===(activeKey||''));
  el.classList.toggle('focus-key',!!next&&key===next);
  el.classList.toggle('last-good',!!lastGoodKey&&key===lastGoodKey&&now-lastGoodAt<430);
  el.classList.toggle('last-bad',!!lastBadKey&&key===lastBadKey&&now-lastBadAt<540);
 });
}

function renderKeyboards(){if(q('#arena-keyboard'))q('#arena-keyboard').innerHTML=fireKeyboardHTML();if(q('#dash-keyboard'))q('#dash-keyboard').innerHTML=keyboardMarkup(false)}
/* Menü pencereleri: klavyeyle açılınca odak pencereye girer, Tab pencere içinde döner, kapanınca açan düğmeye geri döner.
   Fareyle açılınca odak geri verilmez (yazma alanı klavyeyi dinlemeye devam etsin). */
let modalReturn=null;
function makeModal(title,body,wide=false){const opener=document.activeElement;modalReturn=opener&&opener!==document.body&&opener.matches?.(':focus-visible')&&opener.dataset?.action?{action:opener.dataset.action,mode:opener.dataset.mode||''}:null;activeModal={type:title};q('#modal-host').innerHTML=`<div class="modal-backdrop" data-backdrop="true"><section class="modal ${wide?'wide':''}" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1"><button class="modal-close" data-action="close-modal" aria-label="Pencereyi kapat (Esc)">${icon('close')}</button><h2 id="modal-title">${title}</h2>${body}</section></div>`;q('#modal-host .modal')?.focus({preventScroll:true})}
function closeModal(){activeModal=null;q('#modal-host').innerHTML='';renderApp();const back=modalReturn;modalReturn=null;if(back){const sel=`[data-action="${back.action}"]${back.mode?`[data-mode="${back.mode}"]`:''}`;(q('.global-header '+sel)||q(sel))?.focus({preventScroll:true})}}
document.addEventListener('keydown',ev=>{if(activeModal&&(ev.key==='Enter'||ev.key===' ')&&document.activeElement?.matches?.('label.import-button')){ev.preventDefault();document.activeElement.querySelector('input')?.click();return}if(ev.key!=='Tab'||!activeModal)return;const box=q('#modal-host .modal');if(!box)return;const items=[...box.querySelectorAll('button,a[href],input:not([type=file]),select,textarea,[tabindex]:not([tabindex="-1"])')].filter(e=>e.offsetParent&&!e.disabled);if(!items.length)return;const first=items[0],last=items[items.length-1];if(!box.contains(document.activeElement)||document.activeElement===box){ev.preventDefault();(ev.shiftKey?last:first).focus();return}if(ev.shiftKey&&document.activeElement===first){ev.preventDefault();last.focus()}else if(!ev.shiftKey&&document.activeElement===last){ev.preventDefault();first.focus()}},true);
function openModal(type,details={}){let content='';switch(type){
 case 'settings':makeModal('Ayarlar',`<p>Klavye deneyimini kişiselleştir. Verilerin yalnızca bu tarayıcıda tutulur.</p><div class="form-field"><label for="keyboard-layout">Klavye düzeni</label><select id="keyboard-layout"><option value="TR-Q" ${db.settings.layout==='TR-Q'?'selected':''}>Türkçe Q</option><option value="TR-F" ${db.settings.layout==='TR-F'?'selected':''}>Türkçe F (görsel düzen)</option></select></div><div class="form-field"><label for="test-duration">Zaman Yarışı süresi</label><select id="test-duration">${[15,30,60,120].map(x=>`<option value="${x}" ${db.settings.duration===x?'selected':''}>${x} saniye</option>`).join('')}</select></div>${[
 ['strict','Hassas mod','Yanlış karakteri düzeltmeden ilerlemeyi engeller.'],['caseSensitive','Büyük/küçük harf duyarlı','Türkçe kelimelerde Shift de gerekir; kodda her zaman açık.'],['sound','Klavye ses efektleri','Doğru ve yanlış tuşlarda hafif ses üretir.'],['keyboard','Canlı klavyeyi göster','Arenada fiziksel klavye görselini gösterir.'],['ghost','Hayalet rakip','En iyi hızınla ilerleme karşılaştırması için açık tut.'],['reduceMotion','Hareketleri azalt','Tüm hareketli animasyonları kapatır.'],['effectsReduced','Efektleri azalt','Hasar sayıları, flaş ve boss sarsıntısını devre dışı bırakır.']].map(([id,label,desc])=>`<label class="toggle-row"><span><b>${label}</b><br><span class="muted small">${desc}</span></span><input type="checkbox" data-setting="${id}" ${db.settings[id]?'checked':''}></label>`).join('')}<div class="flex gap8 mt14"><button class="btn primary" data-action="close-modal">Kaydet ve kapat</button><button class="btn ghost" data-action="export">${icon('download','sm')} JSON indir</button><label class="btn ghost import-button" tabindex="0" role="button" aria-label="JSON yedeğini içe aktar">${icon('download','sm')} JSON içe aktar<input id="import-file" type="file" accept=".json,application/json" style="display:none"></label><button class="btn danger-btn" data-action="reset-confirm">Verileri sıfırla</button></div>`);break;
 case 'custom':makeModal('Özel Metin',`<p>Kendi paragrafını yapıştır. Yazdığın karakterler, boşluklar ve noktalama işaretleri testin bir parçası olur.</p><label class="form-field" for="custom-text">Metin<textarea id="custom-text" placeholder="Yazmak istediğin paragrafı buraya yapıştır...">${esc(TEXTS.short[0])}</textarea></label><div class="flex gap8 mt14"><button class="btn primary" data-action="custom-start">${icon('play','sm')} Metinle Başla</button><button class="btn ghost" data-action="close-modal">Vazgeç</button></div>`);break;
 case 'academy':{let f=weakFocus();makeModal('Eğitim Akademisi',`<p>Çalışmak istediğin uzmanlığı seç. Arena Rehberi, en zorlandığın harflere ve kombinasyonlara özel yeni metin üretir.</p><div class="lesson-list">${[
 ['adaptive','🎯','Kişisel Zayıflıklar',`Öncelik: ${f.keys.join(', ').toLocaleUpperCase('tr-TR')}`],['classic','⌨️','Türkçe Akıcılık','Gerçek Türkçe cümlelerle genel antrenman'],['time','⏱️','Süreli Hız','15–120 saniyelik hedefli yazma'],['code','💻','Kod Laboratuvarı','Parantez, noktalama ve girinti']].map(([m,ico,title,desc])=>`<button class="lesson" data-action="start" data-mode="${m}"><b>${ico} ${title}</b><span>${desc}</span><span class="accent">Antrenmanı aç →</span></button>`).join('')}</div>`);break}
 case 'missions':makeModal('Günlük Görevler',`<p>Günün görevlerini tamamladığında bonus XP otomatik olarak hesabına eklenir.</p>${quests().map((x,i)=>`<div class="card mt10"><div class="flex between center"><b>${i+1}. ${esc(x.name)}</b><span class="pill">+${x.xp} XP</span></div><p>${x.value}/${x.goal} ilerleme</p>${progress(x.value/x.goal*100)}</div>`).join('')}<div class="flex gap8 mt14"><button class="btn primary" data-action="start" data-mode="adaptive">${icon('play','sm')} Antrenmana Başla</button><button class="btn ghost" data-action="close-modal">Kapat</button></div>`);break;
 case 'adventure-results':{const r=details.record,a=ADVENTURES[r.adventure];makeModal(`${a.name} · Sonuç`, `<div class="adventure-result"><div class="adventure-stars big">${'★'.repeat(r.stars||0)}${'☆'.repeat(3-(r.stars||0))}</div><div class="adventure-result-grid"><div>Hız<strong>${r.wpm} WPM</strong></div><div>Doğruluk<strong>%${r.accuracy}</strong></div><div>Verilen hasar<strong>${readable(r.damage)}</strong></div><div>XP<strong>+${r.xp}</strong></div></div>${r.adventure==='code'?`<p>Kod parçaları: ${(r.codeChunkTimes||[]).map(x=>(x/1000).toFixed(1)+' sn').join(' · ')}</p>`:''}${r.adventure==='castle'?`<p>İyileşen geçişler: ${(r.improvedPairs||[]).join(', ')||'Henüz doğrulanmış iyileşme yok'}</p>`:''}<div class="result-buttons"><button class="btn primary" data-action="adventure-start" data-mode="${r.adventure}">Tekrar Oyna</button><button class="btn ghost" data-action="nav" data-mode="home">Komuta Merkezine Dön</button></div></div>`,true);break;}
 case 'results':{
 const r=details.record;
 if(r.battleOutcome==='victory'||r.battleOutcome==='escape'){
  const victory=r.battleOutcome==='victory';
  makeModal(victory?'ZAFER!':'Boss kaçtı!',`<div class="faz3-results ${victory?'won':'lost'}"><div class="faz3-result-icon">${victory?'♛':'♟'}</div><h3>${victory?'Harf Muhafızı yenildi!':'Boss savaş alanından kaçtı!'}</h3><p>${victory?'Üç aşamayı geçtin. Savaş istatistiklerin kaydedildi.':'Süre doldu. Bu denemede verdiğin hasar kaydedildi.'}</p><div class="faz3-result-grid"><div><b>${readable(r.damage)}</b><small>Toplam hasar</small></div><div><b>${r.comboMax}x</b><small>En yüksek kombo</small></div><div><b>${r.wpm}</b><small>WPM</small></div><div><b>%${r.accuracy}</b><small>Doğruluk</small></div><div><b>+${r.xp}</b><small>Kazanılan XP</small></div></div><div class="faz3-result-actions"><button class="btn primary" data-action="start" data-mode="boss">⚔ Tekrar Savaş</button><button class="btn ghost" data-action="nav" data-mode="home">♛ Komuta Merkezine Dön</button></div></div>`,true);
 }else{
  makeModal('Antrenman Tamamlandı!',`<p>Performansın kaydedildi. Boss'a verilen hasar: ${readable(r.damage)}.</p><div class="faz3-result-grid"><div><b>${r.wpm}</b><small>WPM</small></div><div><b>%${r.accuracy}</b><small>Doğruluk</small></div><div><b>${readable(r.damage)}</b><small>Hasar</small></div><div><b>${r.comboMax}x</b><small>Kombo</small></div><div><b>+${r.xp}</b><small>XP</small></div></div><div class="faz3-result-actions"><button class="btn primary" data-action="start" data-mode="${r.mode}">Tekrar Yaz</button><button class="btn ghost" data-action="nav" data-mode="home">Komuta Merkezine Dön</button></div>`,true);
 }
 break;
 }
 case 'reset-confirm':makeModal('Verileri sıfırla?',`<p>Bu tarayıcıdaki tüm oturumlar, XP, rozetler ve istatistikler silinecek. Bu işlem geri alınamaz. Önce JSON dışa aktarmanı öneririz.</p><div class="flex gap8 mt14"><button class="btn danger-btn" data-action="reset">Evet, tüm verilerimi sil</button><button class="btn ghost" data-action="close-modal">Vazgeç</button></div>`);break;
 case 'about':makeModal('TuşLab hakkında',`<p>Bu prototip gerçek bir çevrimdışı yazma eğitmenidir. İstatistikler cihazında saklanır, uzak sunucuya gönderilmez.</p><p>Yazma motoru hız, doğruluk, zamanlama, karakter karışıklığı, Backspace ve ikili karakter geçişlerini ölçer. Arena Rehberi yerel kural tabanlı bir adaptif motor kullanır; dış yapay zekâ API'sine ihtiyaç duymaz.</p><button class="btn primary" data-action="close-modal">Pencereyi kapat</button>`);break;
 }}
function navigate(action){if(!['home','academy','arena','code','analytics'].includes(action))return;currentView=action;if(action==='code')startMode('code',{silent:true});else if(action==='arena'&&!active)startMode('classic',{silent:true});renderApp();toast(({home:'Komuta Merkezi',academy:'Eğitim Akademisi',arena:'Hız Arenası',code:'Kod Laboratuvarı',analytics:'Performans Merkezi'})[action]+' açıldı.');}
function handleActions(ev){
 const vk=ev.target.closest('[data-virtual-key]');
 if(vk){
   const key=vk.dataset.virtualKey==='SPACE'?' ':vk.dataset.virtualKey.toLocaleLowerCase('tr-TR');
   vk.blur();handleKey({key,preventDefault(){},ctrlKey:false,metaKey:false,altKey:false,isComposing:false});
   q('#typing-stage')?.focus({preventScroll:true});return;
 }
 const el=ev.target.closest('[data-action]');if(!el)return;const action=el.dataset.action,mode=el.dataset.mode;switch(action){
 case 'command-tab':commanderTab=mode;renderApp();break;
 case 'academy-open':navigate('academy');break;
 case 'equipment':commanderTab='equipment';renderApp();break;
 case 'adventure':openAdventure(mode);break;
 case 'adventure-start':startAdventure(mode);break;
 case 'buy':{const items={pen:{price:130,name:'Keskin Kalem'},clock:{price:170,name:'Zaman Tılsımı'},shield:{price:220,name:'İstikrar Zırhı'}};const item=items[mode];if(!item)break;db.equipment??=[];if(db.equipment.includes(mode)){toast('Bu ekipmana zaten sahipsin.');break}if((db.shards||0)<item.price){toast(`${item.name} için ${item.price-(db.shards||0)} kristal daha gerekiyor.`);break}db.shards-=item.price;db.equipment.push(mode);saveDB();renderApp();toast(`✨ ${item.name} açıldı!`);break}
 case 'custom-open':openModal('custom');break;
 case 'start':startMode(mode,mode==='boss'&&el.dataset.raid==='true'?{raid:true}:{});break;
 case 'restart':if(active)startMode(active.mode,{text:active.target,adventure:active.adventure,raid:active.raid});break;
 case 'pause':togglePause();break;
 case 'finish':finishSession();break;
 case 'nav':navigate(mode);break;
 case 'pvp-enter':{if(active?.startedAt&&!active.finished&&!active.paused)togglePause();document.dispatchEvent(new CustomEvent('tuslab:pvp-enter'));break;}
 case 'settings':openModal('settings');break;
 case 'sound-toggle':db.settings.sound=!db.settings.sound;saveDB();const toggle=q('.fire-audio');if(toggle){toggle.setAttribute('aria-pressed',String(db.settings.sound));toggle.title=db.settings.sound?'Ses açık':'Ses kapalı';toggle.classList.toggle('is-muted',!db.settings.sound)}if(db.settings.sound)window.TusLabSFX?.start();toast(db.settings.sound?'Sesler açıldı':'Sesler kapatıldı');break;
 case 'custom-start':{let text=q('#custom-text')?.value||'';if(!text.trim()){toast('Özel metin boş olamaz.');return}if(text.length>15000){toast('Özel metin en fazla 15.000 karakter olabilir.');return}startMode('custom',{text});break}
 case 'missions':openModal('missions');break;

 case 'close-modal':closeModal();break;
 case 'reset-confirm':openModal('reset-confirm');break;
 case 'reset':db=BASE();weakFocusCache=null;saveDB();startMode('classic',{silent:true});toast('Yerel TuşLab verileri sıfırlandı.');break;
 case 'focus-analytics':navigate('analytics');break;
 case 'analysis-tab':analyticsTab=mode;renderApp();break;
 case 'export':{const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),...db},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=`tuslab-veriler-${dateKey(Date.now())}.json`;document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);toast('Verilerin JSON dosyası olarak indirildi.');break}
 }}
function handleChanges(ev){let el=ev.target;
 if(el.id==='import-file'&&el.files?.[0]){const file=el.files[0];if(file.size>8*1024*1024){toast('JSON dosyası 8 MB altında olmalı.');return}if(!confirm('JSON içe aktarılırsa bu tarayıcıdaki mevcut TuşLab verilerinin üzerine yazılacak. Devam edilsin mi?'))return;file.text().then(raw=>{const incoming=JSON.parse(raw);if(incoming.version!==1||!Array.isArray(incoming.sessions)||typeof incoming.xp!=='number')throw Error('Geçersiz TuşLab JSON dosyası');db={...BASE(),...incoming,settings:{...DEFAULT_SETTINGS,...incoming.settings},sessions:incoming.sessions.slice(-150),shards:incoming.shards||0,equipment:incoming.equipment||[],adventureRecords:incoming.adventureRecords||{},weeklyRaids:incoming.weeklyRaids||{}};weakFocusCache=null;saveDB();startMode('classic',{silent:true});toast('Verilerin başarıyla içe aktarıldı.')}).catch(()=>toast('JSON içe aktarılamadı. Dosya biçimini kontrol et.'));return}
if(el.id==='range-select'){currentRange=el.value;renderApp();return}if(el.dataset.setting){db.settings[el.dataset.setting]=el.checked;saveDB();if(el.dataset.setting==='reduceMotion')document.documentElement.classList.toggle('reduced-motion',el.checked);if(el.dataset.setting==='effectsReduced')document.documentElement.classList.toggle('effects-reduced',el.checked);if(el.dataset.setting==='keyboard'){const kb=q('#arena-keyboard');if(kb)kb.innerHTML=db.settings.keyboard?fireKeyboardHTML():''}return}if(el.id==='keyboard-layout'){db.settings.layout=el.value;saveDB();renderKeyboards();return}if(el.id==='test-duration'){db.settings.duration=Number(el.value);saveDB()}}
function init(){document.addEventListener('tuslab:typing-attempt',battleOnAttempt);startMode('classic',{silent:true});document.addEventListener('click',handleActions);document.addEventListener('change',handleChanges);document.addEventListener('keydown',handleKey);document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&activeModal){ev.stopImmediatePropagation();closeModal()}},true);document.addEventListener('click',e=>{if(e.target.dataset.backdrop==='true')closeModal()});
 let lastTilt=0;
 document.querySelector('#app')?.addEventListener('pointermove',ev=>{if(db.settings.reduceMotion||active?.startedAt&&!active.finished||ev.timeStamp-lastTilt<70)return;
   const card=ev.target.closest('.browser-window');if(!card)return;lastTilt=ev.timeStamp;
   const box=card.getBoundingClientRect();const dx=(ev.clientX-box.left)/box.width-.5;const dy=(ev.clientY-box.top)/box.height-.5;
   card.style.setProperty('--hoverY',(dx*1.35).toFixed(2)+'deg');card.style.setProperty('--hoverX',(-dy*1.05).toFixed(2)+'deg');
 });
 document.querySelector('#app')?.addEventListener('pointerout',ev=>{const card=ev.target.closest('.browser-window');if(card&&!card.contains(ev.relatedTarget)){card.style.removeProperty('--hoverY');card.style.removeProperty('--hoverX')}});

 interval=setInterval(()=>{if(active?.startedAt&&!active.paused&&!active.finished&&!document.hidden)updateLive(false);if(!document.hidden&&q('#raid-damage'))updateWeeklyRaidDisplay()},400);
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&active?.startedAt&&!active.paused&&!active.finished)togglePause()});
 window.addEventListener('beforeunload',()=>clearInterval(interval));}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
