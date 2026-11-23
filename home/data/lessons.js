// TusLab ana sayfa: klavye dersleri (parmak haritası, ünite ve dersler) ve alıştırma üretici.
// Türkçe Q klavye. keys: o derste izinli birikimli tuşlar; newKeys: o derste yeni öğrenilenler.
import { PROVERBS, POEMS, IDIOMS, TWISTERS, QUOTES } from './texts.js';

// Parmaklar: L5 sol serçe ... L2 sol işaret, R2 sağ işaret ... R5 sağ serçe, T başparmak (boşluk).
export const FINGERS = {
  "q": "L5",
  "a": "L5",
  "z": "L5",
  "w": "L4",
  "s": "L4",
  "x": "L4",
  "e": "L3",
  "d": "L3",
  "c": "L3",
  "r": "L2",
  "t": "L2",
  "f": "L2",
  "g": "L2",
  "v": "L2",
  "b": "L2",
  "y": "R2",
  "u": "R2",
  "h": "R2",
  "j": "R2",
  "n": "R2",
  "m": "R2",
  "ı": "R3",
  "k": "R3",
  "ö": "R3",
  "o": "R4",
  "l": "R4",
  "ç": "R4",
  "p": "R5",
  "ğ": "R5",
  "ü": "R5",
  "ş": "R5",
  "i": "R5",
  ",": "R5",
  ".": "R5",
  " ": "T",
};

export const KEY_ROWS = [
  ["\"", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "*", "-"],
  ["q", "w", "e", "r", "t", "y", "u", "ı", "o", "p", "ğ", "ü"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l", "ş", "i", ","],
  ["<", "z", "x", "c", "v", "b", "n", "m", "ö", "ç", "."],
];

export const UNITS = [
  { id: "temel", title: "Temel Sıra", desc: "Parmaklar a s d f ve j k l ş tuşlarında dinlenir; önce bu sırayı öğrenin." },
  { id: "ust", title: "Üst Sıra", desc: "Ana sıranın bir üstündeki harfler: e r u ı o p t y ğ ü ve kısa bir q w dersi." },
  { id: "alt", title: "Alt Sıra", desc: "Ana sıranın altındaki harfler ve nokta: v m c n b z ö ç x ." },
  { id: "ozel", title: "Türkçe Özel Harfler", desc: "Ö, Ğ, Ş, Ç, Ü ve ı ile i ayrımı; her harf için ayrı bir ders." },
  { id: "kombi", title: "Kombinasyonlar", desc: "Türkçeye özgü harf ikilileri, ekler, ünlü uyumu kalıpları, ler/lar ve yor." },
  { id: "buyuk", title: "Büyük Harf ve Noktalama", desc: "Shift ile büyük harfler, Ç Ş Ğ İ Ö Ü, virgül ve nokta." },
  { id: "hiz", title: "Hız", desc: "Kısa, orta ve uzun kelimelerle akıcı ve hızlı yazma." },
  { id: "ustalik", title: "Ustalık", desc: "Atasözü, tekerleme, şiir ve deyimlerle gerçek metin yazma." },
];

export const LESSONS = [
  {"id": "L01", "unit": "temel", "title": "F ve J", "desc": "İşaret parmaklarınız: sol işaret f, sağ işaret j. Tuşlardaki çıkıntıyı hissedin.", "newKeys": ["f", "j"], "keys": ["f", "j"], "kind": "keys", "goalWpm": 6, "goalAcc": 90, "length": 90},
  {"id": "L02", "unit": "temel", "title": "D ve K", "desc": "Orta parmaklar: sol orta d, sağ orta k.", "newKeys": ["d", "k"], "keys": ["f", "j", "d", "k"], "kind": "keys", "goalWpm": 7, "goalAcc": 90, "length": 100},
  {"id": "L03", "unit": "temel", "title": "S ve L", "desc": "Yüzük parmakları: sol yüzük s, sağ yüzük l.", "newKeys": ["s", "l"], "keys": ["f", "j", "d", "k", "s", "l"], "kind": "keys", "goalWpm": 8, "goalAcc": 90, "length": 110},
  {"id": "L04", "unit": "temel", "title": "A ve Ş", "desc": "Serçe parmakları: sol serçe a, sağ serçe ş.", "newKeys": ["a", "ş"], "keys": ["f", "j", "d", "k", "s", "l", "a", "ş"], "kind": "keys", "goalWpm": 8, "goalAcc": 90, "length": 120},
  {"id": "L05", "unit": "temel", "title": "G ve H", "desc": "İşaret parmaklarını yana uzatın: sol g, sağ h; sonra ana sıraya dönün.", "newKeys": ["g", "h"], "keys": ["f", "j", "d", "k", "s", "l", "a", "ş", "g", "h"], "kind": "keys", "goalWpm": 9, "goalAcc": 90, "length": 130},
  {"id": "L06", "unit": "temel", "title": "İ harfi", "desc": "Sağ serçe ş tuşunun yanındaki i tuşuna uzanır.", "newKeys": ["i"], "keys": ["f", "j", "d", "k", "s", "l", "a", "ş", "g", "h", "i"], "kind": "keys", "goalWpm": 10, "goalAcc": 90, "length": 140},
  {"id": "L07", "unit": "temel", "title": "Temel sıra kelimeleri", "desc": "Yalnız ana sıra harfleriyle gerçek kelimeler.", "newKeys": [], "keys": ["f", "j", "d", "k", "s", "l", "a", "ş", "g", "h", "i"], "kind": "words", "focus": ["g", "h", "i"], "goalWpm": 10, "goalAcc": 92, "length": 150},
  {"id": "L08", "unit": "ust", "title": "E ve R", "desc": "Sol orta parmak e'ye, sol işaret parmak r'ye yukarı uzanır.", "newKeys": ["e", "r"], "keys": ["f", "j", "d", "k", "s", "l", "a", "ş", "g", "h", "i", "e", "r"], "kind": "keys", "goalWpm": 10, "goalAcc": 92, "length": 130},
  {"id": "L09", "unit": "ust", "title": "U ve ı", "desc": "Sağ işaret parmak u'ya, sağ orta parmak ı'ya uzanır.", "newKeys": ["u", "ı"], "keys": ["f", "j", "d", "k", "s", "l", "a", "ş", "g", "h", "i", "e", "r", "u", "ı"], "kind": "keys", "goalWpm": 11, "goalAcc": 92, "length": 140},
  {"id": "L10", "unit": "ust", "title": "T ve Y", "desc": "İşaret parmakları t ve y tuşlarına uzanır, sonra geri döner.", "newKeys": ["t", "y"], "keys": ["f", "j", "d", "k", "s", "l", "a", "ş", "g", "h", "i", "e", "r", "u", "ı", "t", "y"], "kind": "keys", "goalWpm": 12, "goalAcc": 92, "length": 140},
  {"id": "L11", "unit": "ust", "title": "O ve P", "desc": "Yüzük parmağı o'ya, sağ serçe p'ye uzanır.", "newKeys": ["o", "p"], "keys": ["f", "j", "d", "k", "s", "l", "a", "ş", "g", "h", "i", "e", "r", "u", "ı", "t", "y", "o", "p"], "kind": "keys", "goalWpm": 12, "goalAcc": 92, "length": 150},
  {"id": "L12", "unit": "ust", "title": "Ğ ve Ü", "desc": "Sağ serçe parmak ğ ve ü tuşlarına uzanır.", "newKeys": ["ğ", "ü"], "keys": ["f", "j", "d", "k", "s", "l", "a", "ş", "g", "h", "i", "e", "r", "u", "ı", "t", "y", "o", "p", "ğ", "ü"], "kind": "keys", "goalWpm": 13, "goalAcc": 92, "length": 150},
  {"id": "L13", "unit": "ust", "title": "Q ve W", "desc": "Az kullanılan q ve w tuşları: kısa bir tanışma dersi.", "newKeys": ["q", "w"], "keys": ["f", "j", "d", "k", "s", "l", "a", "ş", "g", "h", "i", "e", "r", "u", "ı", "t", "y", "o", "p", "ğ", "ü", "q", "w"], "kind": "keys", "goalWpm": 10, "goalAcc": 90, "length": 80},
  {"id": "L14", "unit": "ust", "title": "Üst sıra kelimeleri", "desc": "Ana sıra ve üst sıra harfleriyle kelimeler.", "newKeys": [], "keys": ["f", "j", "d", "k", "s", "l", "a", "ş", "g", "h", "i", "e", "r", "u", "ı", "t", "y", "o", "p", "ğ", "ü", "q", "w"], "kind": "words", "focus": ["e", "r", "u", "ı", "t", "y", "o", "p", "ğ", "ü"], "goalWpm": 14, "goalAcc": 93, "length": 170},
  {"id": "L15", "unit": "alt", "title": "V ve M", "desc": "Sol işaret parmak v'ye, sağ işaret parmak m'ye aşağı iner.", "newKeys": ["v", "m"], "keys": ["f", "j", "d", "k", "s", "l", "a", "ş", "g", "h", "i", "e", "r", "u", "ı", "t", "y", "o", "p", "ğ", "ü", "q", "w", "v", "m"], "kind": "keys", "goalWpm": 14, "goalAcc": 92, "length": 140},
  {"id": "L16", "unit": "alt", "title": "C ve N", "desc": "Sol orta parmak c'ye, sağ işaret parmak n'ye iner.", "newKeys": ["c", "n"], "keys": ["f", "j", "d", "k", "s", "l", "a", "ş", "g", "h", "i", "e", "r", "u", "ı", "t", "y", "o", "p", "ğ", "ü", "q", "w", "v", "m", "c", "n"], "kind": "keys", "goalWpm": 15, "goalAcc": 92, "length": 150},
  {"id": "L17", "unit": "alt", "title": "B ve Z", "desc": "Sol işaret parmak b'ye, sol serçe z'ye iner.", "newKeys": ["b", "z"], "keys": ["f", "j", "d", "k", "s", "l", "a", "ş", "g", "h", "i", "e", "r", "u", "ı", "t", "y", "o", "p", "ğ", "ü", "q", "w", "v", "m", "c", "n", "b", "z"], "kind": "keys", "goalWpm": 15, "goalAcc": 92, "length": 150},
  {"id": "L18", "unit": "alt", "title": "Ö ve Ç", "desc": "Sağ orta parmak ö'ye, sağ yüzük parmak ç'ye iner.", "newKeys": ["ö", "ç"], "keys": ["f", "j", "d", "k", "s", "l", "a", "ş", "g", "h", "i", "e", "r", "u", "ı", "t", "y", "o", "p", "ğ", "ü", "q", "w", "v", "m", "c", "n", "b", "z", "ö", "ç"], "kind": "keys", "goalWpm": 16, "goalAcc": 92, "length": 150},
  {"id": "L19", "unit": "alt", "title": "X ve nokta", "desc": "x tuşuna sol yüzük parmak, nokta tuşuna sağ serçe iner.", "newKeys": ["x", "."], "keys": ["f", "j", "d", "k", "s", "l", "a", "ş", "g", "h", "i", "e", "r", "u", "ı", "t", "y", "o", "p", "ğ", "ü", "q", "w", "v", "m", "c", "n", "b", "z", "ö", "ç", "x", "."], "kind": "keys", "goalWpm": 14, "goalAcc": 90, "length": 100},
  {"id": "L20", "unit": "alt", "title": "Alt sıra kelimeleri", "desc": "Alt sıra harflerini içeren kelimeler.", "newKeys": [], "keys": ["f", "j", "d", "k", "s", "l", "a", "ş", "g", "h", "i", "e", "r", "u", "ı", "t", "y", "o", "p", "ğ", "ü", "q", "w", "v", "m", "c", "n", "b", "z", "ö", "ç", "x", "."], "kind": "words", "focus": ["v", "m", "c", "n", "b", "z", "ö", "ç"], "goalWpm": 17, "goalAcc": 93, "length": 190},
  {"id": "L21", "unit": "ozel", "title": "Ö harfi", "desc": "Ö içeren kelimeler: öğretmen, göz, güzel.", "newKeys": [], "keys": ["f", "j", "d", "k", "s", "l", "a", "ş", "g", "h", "i", "e", "r", "u", "ı", "t", "y", "o", "p", "ğ", "ü", "q", "w", "v", "m", "c", "n", "b", "z", "ö", "ç", "x", "."], "kind": "combo", "combos": ["ö"], "goalWpm": 16, "goalAcc": 93, "length": 170},
  {"id": "L22", "unit": "ozel", "title": "Ğ harfi", "desc": "Yumuşak g: dağ, ağaç, öğrenci.", "newKeys": [], "keys": ["f", "j", "d", "k", "s", "l", "a", "ş", "g", "h", "i", "e", "r", "u", "ı", "t", "y", "o", "p", "ğ", "ü", "q", "w", "v", "m", "c", "n", "b", "z", "ö", "ç", "x", "."], "kind": "combo", "combos": ["ğ"], "goalWpm": 16, "goalAcc": 93, "length": 170},
  {"id": "L23", "unit": "ozel", "title": "Ş harfi", "desc": "Ş içeren kelimeler: şiir, kuş, arkadaş.", "newKeys": [], "keys": ["f", "j", "d", "k", "s", "l", "a", "ş", "g", "h", "i", "e", "r", "u", "ı", "t", "y", "o", "p", "ğ", "ü", "q", "w", "v", "m", "c", "n", "b", "z", "ö", "ç", "x", "."], "kind": "combo", "combos": ["ş"], "goalWpm": 17, "goalAcc": 93, "length": 170},
  {"id": "L24", "unit": "ozel", "title": "Ç harfi", "desc": "Ç içeren kelimeler: çiçek, çocuk, ağaç.", "newKeys": [], "keys": ["f", "j", "d", "k", "s", "l", "a", "ş", "g", "h", "i", "e", "r", "u", "ı", "t", "y", "o", "p", "ğ", "ü", "q", "w", "v", "m", "c", "n", "b", "z", "ö", "ç", "x", "."], "kind": "combo", "combos": ["ç"], "goalWpm": 17, "goalAcc": 93, "length": 170},
  {"id": "L25", "unit": "ozel", "title": "Ü harfi", "desc": "Ü içeren kelimeler: üzüm, gül, yürümek.", "newKeys": [], "keys": ["f", "j", "d", "k", "s", "l", "a", "ş", "g", "h", "i", "e", "r", "u", "ı", "t", "y", "o", "p", "ğ", "ü", "q", "w", "v", "m", "c", "n", "b", "z", "ö", "ç", "x", "."], "kind": "combo", "combos": ["ü"], "goalWpm": 17, "goalAcc": 93, "length": 170},
  {"id": "L26", "unit": "ozel", "title": "ı ve i ayrımı", "desc": "Noktasız ı ile noktalı i'yi karıştırmadan, ikisini birlikte içeren kelimeler.", "newKeys": [], "keys": ["f", "j", "d", "k", "s", "l", "a", "ş", "g", "h", "i", "e", "r", "u", "ı", "t", "y", "o", "p", "ğ", "ü", "q", "w", "v", "m", "c", "n", "b", "z", "ö", "ç", "x", "."], "kind": "combo", "must": ["ı", "i"], "goalWpm": 18, "goalAcc": 94, "length": 180},
  {"id": "L27", "unit": "kombi", "title": "ğı ğü öğ", "desc": "Ğ ile ünlü ve ö ile ğ ikilileri: yağı, dağı, öğ, öğle.", "newKeys": [], "keys": ["f", "j", "d", "k", "s", "l", "a", "ş", "g", "h", "i", "e", "r", "u", "ı", "t", "y", "o", "p", "ğ", "ü", "q", "w", "v", "m", "c", "n", "b", "z", "ö", "ç", "x", "."], "kind": "combo", "combos": ["ğı", "ğü", "ğu", "öğ"], "goalWpm": 18, "goalAcc": 93, "length": 170},
  {"id": "L28", "unit": "kombi", "title": "şç çı ış şı", "desc": "Ş ile ç ve ç, ı ile ş ikilileri: aşçı, işçi, çıkış, kuşçu.", "newKeys": [], "keys": ["f", "j", "d", "k", "s", "l", "a", "ş", "g", "h", "i", "e", "r", "u", "ı", "t", "y", "o", "p", "ğ", "ü", "q", "w", "v", "m", "c", "n", "b", "z", "ö", "ç", "x", "."], "kind": "combo", "combos": ["şç", "çı", "ış", "şı"], "goalWpm": 18, "goalAcc": 93, "length": 170},
  {"id": "L29", "unit": "kombi", "title": "ük ök üş öş", "desc": "Ön ünlüler ile k ve ş: gözlük, yüzük, düşmek, göz.", "newKeys": [], "keys": ["f", "j", "d", "k", "s", "l", "a", "ş", "g", "h", "i", "e", "r", "u", "ı", "t", "y", "o", "p", "ğ", "ü", "q", "w", "v", "m", "c", "n", "b", "z", "ö", "ç", "x", "."], "kind": "combo", "combos": ["ük", "ök", "üş", "öş"], "goalWpm": 19, "goalAcc": 93, "length": 170},
  {"id": "L30", "unit": "kombi", "title": "ğı ği ğu ğü ekleri", "desc": "Yumuşak g ile biten ek biçimleri: -ğı, -ği, -ğu, -ğü.", "newKeys": [], "keys": ["f", "j", "d", "k", "s", "l", "a", "ş", "g", "h", "i", "e", "r", "u", "ı", "t", "y", "o", "p", "ğ", "ü", "q", "w", "v", "m", "c", "n", "b", "z", "ö", "ç", "x", "."], "kind": "combo", "combos": ["ğı", "ği", "ğu", "ğü"], "goalWpm": 19, "goalAcc": 93, "length": 180},
  {"id": "L31", "unit": "kombi", "title": "ler ve lar", "desc": "Çoğul ekleri ve ünlü uyumu: kitaplar, gözler, çiçekler.", "newKeys": [], "keys": ["f", "j", "d", "k", "s", "l", "a", "ş", "g", "h", "i", "e", "r", "u", "ı", "t", "y", "o", "p", "ğ", "ü", "q", "w", "v", "m", "c", "n", "b", "z", "ö", "ç", "x", "."], "kind": "combo", "combos": ["ler", "lar"], "goalWpm": 20, "goalAcc": 94, "length": 190},
  {"id": "L32", "unit": "kombi", "title": "yor eki", "desc": "Şimdiki zaman: geliyor, çalışıyor, düşünüyor, yürüyor.", "newKeys": [], "keys": ["f", "j", "d", "k", "s", "l", "a", "ş", "g", "h", "i", "e", "r", "u", "ı", "t", "y", "o", "p", "ğ", "ü", "q", "w", "v", "m", "c", "n", "b", "z", "ö", "ç", "x", "."], "kind": "combo", "combos": ["ıyor", "iyor", "uyor", "üyor"], "goalWpm": 20, "goalAcc": 94, "length": 190},
  {"id": "L33", "unit": "kombi", "title": "Ünlü uyumu kalıpları", "desc": "ı-i-u-ü uyumu: -cı, -ci, -cu, -cü ve -ıldı, -ildi, -uldu, -üldü.", "newKeys": [], "keys": ["f", "j", "d", "k", "s", "l", "a", "ş", "g", "h", "i", "e", "r", "u", "ı", "t", "y", "o", "p", "ğ", "ü", "q", "w", "v", "m", "c", "n", "b", "z", "ö", "ç", "x", "."], "kind": "combo", "combos": ["ıcı", "ici", "ucu", "ücü", "ıldı", "ildi", "uldu", "üldü"], "goalWpm": 20, "goalAcc": 94, "length": 190},
  {"id": "L34", "unit": "buyuk", "title": "Büyük harf (Shift)", "desc": "Sağ ya da sol Shift'i karşı elle basın; her kelime büyük harfle başlar.", "newKeys": [], "keys": ["f", "j", "d", "k", "s", "l", "a", "ş", "g", "h", "i", "e", "r", "u", "ı", "t", "y", "o", "p", "ğ", "ü", "q", "w", "v", "m", "c", "n", "b", "z", "ö", "ç", "x", "."], "kind": "words", "format": "caps", "goalWpm": 18, "goalAcc": 93, "length": 170},
  {"id": "L35", "unit": "buyuk", "title": "Ç Ş Ğ İ Ö Ü büyük harfleri", "desc": "Türkçe büyük harfler; İ ve I ayrımına dikkat.", "newKeys": [], "keys": ["f", "j", "d", "k", "s", "l", "a", "ş", "g", "h", "i", "e", "r", "u", "ı", "t", "y", "o", "p", "ğ", "ü", "q", "w", "v", "m", "c", "n", "b", "z", "ö", "ç", "x", "."], "kind": "words", "format": "caps-special", "focus": ["ç", "ş", "ğ", "ö", "ü", "ı"], "goalWpm": 18, "goalAcc": 93, "length": 170},
  {"id": "L36", "unit": "buyuk", "title": "Virgül", "desc": "Virgül tuşu ve kısa cümleler.", "newKeys": [","], "keys": ["f", "j", "d", "k", "s", "l", "a", "ş", "g", "h", "i", "e", "r", "u", "ı", "t", "y", "o", "p", "ğ", "ü", "q", "w", "v", "m", "c", "n", "b", "z", "ö", "ç", "x", ".", ","], "kind": "words", "format": "sentence", "commaRate": 0.5, "goalWpm": 19, "goalAcc": 94, "length": 190},
  {"id": "L37", "unit": "buyuk", "title": "Nokta ve cümle", "desc": "Cümle başında büyük harf, sonunda nokta.", "newKeys": [], "keys": ["f", "j", "d", "k", "s", "l", "a", "ş", "g", "h", "i", "e", "r", "u", "ı", "t", "y", "o", "p", "ğ", "ü", "q", "w", "v", "m", "c", "n", "b", "z", "ö", "ç", "x", ".", ","], "kind": "words", "format": "sentence", "commaRate": 0.2, "goalWpm": 20, "goalAcc": 94, "length": 220},
  {"id": "L38", "unit": "hiz", "title": "Kısa kelimeler", "desc": "İki-dört harfli kelimelerle seri yazma.", "newKeys": [], "keys": ["f", "j", "d", "k", "s", "l", "a", "ş", "g", "h", "i", "e", "r", "u", "ı", "t", "y", "o", "p", "ğ", "ü", "q", "w", "v", "m", "c", "n", "b", "z", "ö", "ç", "x", ".", ","], "kind": "words", "minLen": 2, "maxLen": 4, "goalWpm": 24, "goalAcc": 94, "length": 220},
  {"id": "L39", "unit": "hiz", "title": "Orta kelimeler", "desc": "Beş-yedi harfli kelimeler.", "newKeys": [], "keys": ["f", "j", "d", "k", "s", "l", "a", "ş", "g", "h", "i", "e", "r", "u", "ı", "t", "y", "o", "p", "ğ", "ü", "q", "w", "v", "m", "c", "n", "b", "z", "ö", "ç", "x", ".", ","], "kind": "words", "minLen": 5, "maxLen": 7, "goalWpm": 26, "goalAcc": 94, "length": 250},
  {"id": "L40", "unit": "hiz", "title": "Uzun kelimeler", "desc": "Sekiz harf ve üzeri kelimeler.", "newKeys": [], "keys": ["f", "j", "d", "k", "s", "l", "a", "ş", "g", "h", "i", "e", "r", "u", "ı", "t", "y", "o", "p", "ğ", "ü", "q", "w", "v", "m", "c", "n", "b", "z", "ö", "ç", "x", ".", ","], "kind": "words", "minLen": 8, "maxLen": 15, "goalWpm": 26, "goalAcc": 94, "length": 250},
  {"id": "L41", "unit": "hiz", "title": "Kelime akışı", "desc": "Her uzunlukta karışık kelimeler: ritim tutturun.", "newKeys": [], "keys": ["f", "j", "d", "k", "s", "l", "a", "ş", "g", "h", "i", "e", "r", "u", "ı", "t", "y", "o", "p", "ğ", "ü", "q", "w", "v", "m", "c", "n", "b", "z", "ö", "ç", "x", ".", ","], "kind": "words", "goalWpm": 30, "goalAcc": 95, "length": 320},
  {"id": "L42", "unit": "ustalik", "title": "Atasözleri (kolay)", "desc": "Kısa ve sade atasözleri.", "newKeys": [], "keys": ["f", "j", "d", "k", "s", "l", "a", "ş", "g", "h", "i", "e", "r", "u", "ı", "t", "y", "o", "p", "ğ", "ü", "q", "w", "v", "m", "c", "n", "b", "z", "ö", "ç", "x", ".", ","], "kind": "text", "source": "proverbs", "levelMin": 1, "levelMax": 2, "goalWpm": 22, "goalAcc": 94, "length": 220},
  {"id": "L43", "unit": "ustalik", "title": "Atasözleri (zor)", "desc": "Uzun, noktalamalı ve zincirli atasözleri.", "newKeys": [], "keys": ["f", "j", "d", "k", "s", "l", "a", "ş", "g", "h", "i", "e", "r", "u", "ı", "t", "y", "o", "p", "ğ", "ü", "q", "w", "v", "m", "c", "n", "b", "z", "ö", "ç", "x", ".", ","], "kind": "text", "source": "proverbs", "levelMin": 3, "levelMax": 4, "goalWpm": 24, "goalAcc": 94, "length": 320},
  {"id": "L44", "unit": "ustalik", "title": "Tekerlemeler", "desc": "Dilinizi ve parmaklarınızı çalıştırın.", "newKeys": [], "keys": ["f", "j", "d", "k", "s", "l", "a", "ş", "g", "h", "i", "e", "r", "u", "ı", "t", "y", "o", "p", "ğ", "ü", "q", "w", "v", "m", "c", "n", "b", "z", "ö", "ç", "x", ".", ","], "kind": "text", "source": "twisters", "goalWpm": 22, "goalAcc": 92, "length": 260},
  {"id": "L45", "unit": "ustalik", "title": "Şiir dizeleri", "desc": "Yunus Emre'den İstiklal Marşı'na telifsiz şiirler.", "newKeys": [], "keys": ["f", "j", "d", "k", "s", "l", "a", "ş", "g", "h", "i", "e", "r", "u", "ı", "t", "y", "o", "p", "ğ", "ü", "q", "w", "v", "m", "c", "n", "b", "z", "ö", "ç", "x", ".", ","], "kind": "text", "source": "poems", "goalWpm": 24, "goalAcc": 94, "length": 280},
  {"id": "L46", "unit": "ustalik", "title": "Deyimler", "desc": "Sık kullanılan deyimler.", "newKeys": [], "keys": ["f", "j", "d", "k", "s", "l", "a", "ş", "g", "h", "i", "e", "r", "u", "ı", "t", "y", "o", "p", "ğ", "ü", "q", "w", "v", "m", "c", "n", "b", "z", "ö", "ç", "x", ".", ","], "kind": "text", "source": "idioms", "goalWpm": 24, "goalAcc": 94, "length": 240},
  {"id": "L47", "unit": "ustalik", "title": "Özdeyişler", "desc": "Mevlana, Yunus Emre ve Atatürk'ten sözler.", "newKeys": [], "keys": ["f", "j", "d", "k", "s", "l", "a", "ş", "g", "h", "i", "e", "r", "u", "ı", "t", "y", "o", "p", "ğ", "ü", "q", "w", "v", "m", "c", "n", "b", "z", "ö", "ç", "x", ".", ","], "kind": "text", "source": "quotes", "goalWpm": 26, "goalAcc": 95, "length": 280},
];

// ----------------------------------------------------------------------------
// buildDrill: saf fonksiyon (DOM yok). Bir alıştırma metni üretir.
//   lesson.kind 'keys'  -> yalnız izinli harflerden sözde-kelimeler (kademeli uzunluk)
//   lesson.kind 'words' -> yalnız izinli harflerden oluşan WORDS kelimeleri
//   lesson.kind 'combo' -> combos (veya must) içeren kelimeler + kombinasyon tekrarları
//   lesson.kind 'text'  -> texts.js içinden atasözü / şiir / tekerleme / deyim / özdeyiş
// Aynı alıştırmada bir kelime ikinci kez kullanılmaz; havuz biterse sözde-kelime üretilir.
// ----------------------------------------------------------------------------
const VOWELS = 'aeıioöuü';

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}

function pick(arr, rng) {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

function upperTr(s) {
  let out = '';
  for (const ch of s) out += ch === 'i' ? '\u0130' : ch === '\u0131' ? 'I' : ch.toUpperCase();
  return out;
}

function capFirst(s) {
  return s ? upperTr(s.charAt(0)) + s.slice(1) : s;
}

function onlyLetters(keys) {
  return keys.filter((k) => k.length === 1 && k !== ',' && k !== '.');
}

function pseudoWord(letters, focus, len, rng) {
  const vow = letters.filter((c) => VOWELS.includes(c));
  const con = letters.filter((c) => !VOWELS.includes(c));
  const fv = focus.filter((c) => vow.includes(c));
  const fc = focus.filter((c) => con.includes(c));
  const both = vow.length > 0 && con.length > 0;
  let nextVowel = vow.length === 0 ? false : con.length === 0 ? true : rng() < 0.5;
  let out = '';
  for (let i = 0; i < len; i++) {
    const pool = nextVowel ? vow : con;
    const fpool = nextVowel ? fv : fc;
    const src = fpool.length && rng() < 0.6 ? fpool : pool.length ? pool : letters;
    out += pick(src, rng);
    if (both) nextVowel = rng() < 0.2 ? nextVowel : !nextVowel;
  }
  return out;
}

const RARE = 'qwx';

function makeKeysDrill(L, rng) {
  const letters = onlyLetters(L.keys).filter((c) => !RARE.includes(c) || (L.newKeys || []).includes(c));
  if (!letters.length) return '';
  const focus = (L.newKeys || []).filter((k) => letters.includes(k));
  const marks = L.keys.filter((k) => k === ',' || k === '.');
  const newMarks = (L.newKeys || []).filter((k) => k === ',' || k === '.');
  const target = L.length;
  const used = new Set();
  const out = [];
  let size = 0;
  let bump = 0;
  let guard = 0;
  while (size < target && guard++ < 5000) {
    const p = size / target;
    const maxLen = (p < 0.34 ? 3 : p < 0.67 ? 4 : 5) + bump;
    let w = '';
    for (let t = 0; t < 30; t++) {
      const len = 2 + Math.floor(rng() * (maxLen - 1));
      w = pseudoWord(letters, focus, len, rng);
      if (marks.length && rng() < (newMarks.length ? 0.5 : 0.15)) {
        w += pick(newMarks.length && rng() < 0.8 ? newMarks : marks, rng);
      }
      if (!used.has(w)) break;
      w = '';
    }
    if (!w) {
      bump++;
      continue;
    }
    if (size > 0 && size + 1 + w.length > target * 1.1 && size >= target * 0.8) break;
    used.add(w);
    out.push(w);
    size += (size ? 1 : 0) + w.length;
  }
  return out.join(' ');
}

function poolFor(L, words) {
  const keySet = new Set(L.keys);
  const minLen = L.minLen || 2;
  const maxLen = L.maxLen || 15;
  const seen = new Set();
  const pool = [];
  for (const w of words || []) {
    if (typeof w !== 'string' || w.length < minLen || w.length > maxLen || seen.has(w)) continue;
    let ok = true;
    for (const ch of w) {
      if (!keySet.has(ch)) {
        ok = false;
        break;
      }
    }
    if (ok) {
      seen.add(w);
      pool.push(w);
    }
  }
  return pool;
}

function comboTokens(L, letters, rng, source) {
  const out = new Set();
  const combos = L.combos || [];
  if (!combos.length) return [];
  for (const w of shuffle(source, rng).slice(0, 400)) {
    const c = combos.find((x) => w.includes(x));
    if (!c) continue;
    const idx = w.indexOf(c);
    const start = Math.max(0, idx - Math.floor(rng() * 3));
    const end = Math.min(w.length, idx + c.length + Math.floor(rng() * 3));
    const frag = w.slice(start, end);
    if (frag.length >= 2 && frag.length <= 6) out.add(frag);
    if (out.size >= 60) break;
  }
  for (const c of combos) {
    if (c.length >= 2) out.add(c);
    else if (!out.size) {
      for (let i = 0; i < 6; i++) out.add(pick(letters, rng) + c + pick(letters, rng));
    }
  }
  return Array.from(out);
}

function assemble(L, prim, sec, rng, makePseudo) {
  const target = L.length;
  const P = shuffle(prim, rng);
  const S = shuffle(sec, rng);
  const used = new Set();
  const out = [];
  let size = 0;
  let skips = 0;
  let guard = 0;
  while (size < target && guard++ < 4000) {
    let w;
    if (P.length && (rng() < 0.75 || !S.length)) w = P.pop();
    else if (S.length) w = S.pop();
    else w = makePseudo(used);
    if (!w || used.has(w)) continue;
    if (size > 0 && size + 1 + w.length > target * 1.1 && size >= target * 0.8) {
      if (++skips > 25) break;
      continue;
    }
    used.add(w);
    out.push(w);
    size += (size ? 1 : 0) + w.length;
  }
  return out;
}

function toSentences(tokens, rng, commaRate) {
  const sents = [];
  let i = 0;
  while (i < tokens.length) {
    const n = Math.min(tokens.length - i, 3 + Math.floor(rng() * 4));
    const part = tokens.slice(i, i + n);
    i += n;
    let s = '';
    for (let k = 0; k < part.length; k++) {
      let t = k === 0 ? capFirst(part[k]) : part[k];
      if (commaRate > 0 && k > 0 && k < part.length - 1 && rng() < commaRate) t += ',';
      s += (k ? ' ' : '') + t;
    }
    sents.push(s + '.');
  }
  return sents.join(' ');
}

function applyFormat(tokens, L, rng) {
  if (L.format === 'caps') return tokens.map(capFirst).join(' ');
  if (L.format === 'caps-special') {
    return tokens.map((w) => (w.length <= 8 && rng() < 0.5 ? upperTr(w) : capFirst(w))).join(' ');
  }
  if (L.format === 'sentence') return toSentences(tokens, rng, L.commaRate || 0);
  return tokens.join(' ');
}

function makeWordDrill(L, words, rng) {
  const letters = onlyLetters(L.keys).filter((c) => !RARE.includes(c));
  const pool = poolFor(L, words);
  const combos = L.combos || [];
  const must = L.must || [];
  const focus = (L.focus && L.focus.length ? L.focus : L.newKeys || []).filter((k) => letters.includes(k));
  let prim;
  let sec;
  let pseudoFocus = focus;
  if (L.kind === 'combo') {
    const has = (w) => (!combos.length || combos.some((c) => w.includes(c))) && must.every((c) => w.includes(c));
    prim = pool.filter(has);
    sec = comboTokens(L, letters, rng, prim).filter((t) => !prim.includes(t));
    pseudoFocus = Array.from(new Set(combos.join('').split('').concat(must))).filter((c) => letters.includes(c));
  } else if (focus.length) {
    const hasFocus = (w) => focus.some((c) => w.includes(c));
    prim = pool.filter(hasFocus);
    sec = pool.filter((w) => !hasFocus(w));
  } else {
    prim = pool;
    sec = [];
  }
  const tokens = assemble(L, prim, sec, rng, (used) => {
    if (!letters.length) return null;
    for (let t = 0; t < 20; t++) {
      const w = pseudoWord(letters, pseudoFocus, 3 + Math.floor(rng() * 3), rng);
      if (!used.has(w)) return w;
    }
    return null;
  });
  return applyFormat(tokens, L, rng);
}

function textCandidates(L) {
  let list = [];
  if (L.source === 'proverbs') {
    const lo = L.levelMin || 1;
    const hi = L.levelMax || 4;
    list = PROVERBS.filter((p) => p.level >= lo && p.level <= hi).map((p) => p.text);
  } else if (L.source === 'poems') {
    for (const poem of POEMS) {
      for (let i = 0; i < poem.lines.length; i += 2) list.push(poem.lines.slice(i, i + 2).join(' '));
    }
  } else if (L.source === 'twisters') list = TWISTERS.slice();
  else if (L.source === 'idioms') list = IDIOMS.map((x) => x.text);
  else if (L.source === 'quotes') list = QUOTES.map((q) => q.text);
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const s = String(raw).replace(/\s+/g, ' ').trim();
    if (s && !seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

function makeTextDrill(L, words, rng) {
  const cands = shuffle(textCandidates(L), rng);
  const target = L.length;
  let out = '';
  for (const s of cands) {
    if (!out) out = s;
    else if (out.length + 1 + s.length <= target * 1.15) out += ' ' + s;
    if (out.length >= target * 0.9) break;
  }
  return out || makeWordDrill(Object.assign({}, L, { kind: 'words' }), words, rng);
}

export function buildDrill(lesson, words, rng = Math.random) {
  const r = typeof rng === 'function' ? rng : Math.random;
  const L = Object.assign({ length: 150, newKeys: [], keys: [] }, lesson);
  let text;
  if (L.kind === 'text') text = makeTextDrill(L, words, r);
  else if (L.kind === 'keys') text = makeKeysDrill(L, r);
  else text = makeWordDrill(L, words, r);
  return text.replace(/\s+/g, ' ').trim();
}
