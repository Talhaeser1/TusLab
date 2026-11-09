/** TuşLab arena mode — skill & item catalogue, Harf Kaosu scrambler, pick
 * validation and pre-round skill resolution (docs/ARENA-MODU.md §6, Ajan 3).
 * Pure ES module; imports only pvp/shared/words.js (createRng), so the arena
 * engine (pvp/shared/arena.js), the Cloudflare Durable Object and the browser
 * practice UI can all share the exact same rules.
 *
 * Prep fazında seçilen skill'ler BİR SONRAKİ raunda etki eder. Her skill ve
 * her eşya maçta en fazla ARENA_MAX_USES kez kullanılır; `skillUses`/
 * `itemUses` sayaçları motorun katılımcı state'inde tutulur (§7). Eşya
 * kataloğunda yalnız arayüz metni vardır; tüm hasar sayıları (çarpanlar,
 * azaltımlar) arena-damage.js'tedir (Ajan 2'nin sahası).
 */

import {createRng} from './words.js';

// §2 ayar değerleri — motor (arena.js) seçimlerle birlikte bunları kullanır.
export const ARENA_OVERTIME_MS=5_000;        // Zaman Hediyesi: rakip bitirince kendine +5 sn
export const ARENA_FREEZE_MS=3_000;          // Donmuş An: kendi süren +3 sn
export const ARENA_TIME_THIEF_MS=5_000;      // Zaman Hırsızı: rakibin süresinden −5 sn
export const ARENA_ROUND_DURATION_MS=40_000; // §2 yazma süresi (arena.js'teki sabitin aynası)
export const ARENA_MAX_USES=2;               // her skill ve her eşya maçta en fazla 2 kez

/** id → {id, ad, ikon, açıklama, hedef, tür, effect}. `hedef` etkinin kime
 * düştüğünü ('self'|'opponent'), `tür` seçim fazını ('pre-round') belirtir.
 * `effect` motorun switch yaptığı makine etiketidir; `ms` varsa §2 süresini
 * taşır. Kayıtlar ve katalog donmuştur (freeze). */
export const ARENA_SKILLS=Object.freeze({
  scramble:Object.freeze({
    id:'scramble',ad:'Harf Kaosu',ikon:'🔀',
    açıklama:'Rakibin o raund kelimelerinin harfleri karışık gösterilir; rakip karışık haliyle yazmak zorundadır (karpuz → zurpak)',
    hedef:'opponent',tür:'pre-round',
    effect:Object.freeze({type:'scramble'})
  }),
  overtime:Object.freeze({
    id:'overtime',ad:'Zaman Hediyesi',ikon:'⏰',
    açıklama:'Rakip kelimeleri bitirse de sana +5 sn yazma süresi',
    hedef:'self',tür:'pre-round',
    effect:Object.freeze({type:'overtime',ms:ARENA_OVERTIME_MS})
  }),
  timethief:Object.freeze({
    id:'timethief',ad:'Zaman Hırsızı',ikon:'🕜',
    açıklama:'Rakibin o raund süresinden −5 sn',
    hedef:'opponent',tür:'pre-round',
    effect:Object.freeze({type:'timethief',ms:ARENA_TIME_THIEF_MS})
  }),
  freeze:Object.freeze({
    id:'freeze',ad:'Donmuş An',ikon:'❄️',
    açıklama:'Kendi süren 3 sn donar (+3 sn eşdeğeri)',
    hedef:'self',tür:'pre-round',
    effect:Object.freeze({type:'freeze',ms:ARENA_FREEZE_MS})
  }),
  blindclock:Object.freeze({
    id:'blindclock',ad:'Karanlık Saat',ikon:'🌑',
    açıklama:'Rakip kalan süreni göremez (rakibin anlık görüntüsünde süren null gösterilir)',
    hedef:'opponent',tür:'pre-round',
    effect:Object.freeze({type:'blindclock'})
  })
});
export const ARENA_SKILL_IDS=Object.freeze(Object.keys(ARENA_SKILLS));

/** §5.4 eşya kataloğu — kimlikler arena-damage.js'teki (Ajan 2) ARENA_ITEMS
 * listesiyle birebir aynıdır (combostone, cleanse, gauntlet, aegis). Burada
 * yalnız görünen metin vardır; hasar sayıları Ajan 2'nin modülündedir. */
export const ARENA_ITEM_CATALOG=Object.freeze({
  combostone:Object.freeze({
    id:'combostone',ad:'Kombo Yükselteci',ikon:'🔥',
    açıklama:'Bu raund kombo vuruşlarının hasar çarpanını yükseltir',
    hedef:'self',tür:'pre-round'
  }),
  cleanse:Object.freeze({
    id:'cleanse',ad:'Arınma Taşı',ikon:'🛡️',
    açıklama:'Bu raund yanlış ceza çarpanı uygulanmaz',
    hedef:'self',tür:'pre-round'
  }),
  gauntlet:Object.freeze({
    id:'gauntlet',ad:'Ağır Eldiven',ikon:'🥊',
    açıklama:'Bu raund her doğru kelimenin taban hasarı artar',
    hedef:'self',tür:'pre-round'
  }),
  aegis:Object.freeze({
    id:'aegis',ad:'Çelik Kalkan',ikon:'⚡',
    açıklama:'Bu raund aldığın hasar azalır',
    hedef:'self',tür:'pre-round'
  })
});
export const ARENA_ITEM_IDS=Object.freeze(Object.keys(ARENA_ITEM_CATALOG));

const ITEM_ID_SET=new Set(ARENA_ITEM_IDS);

export function validateSkillId(id){return typeof id==='string'&&Object.hasOwn(ARENA_SKILLS,id);}
export function validateItemId(id){return typeof id==='string'&&ITEM_ID_SET.has(id);}

// ── Harf Kaosu (scramble) ─────────────────────────────────────────────────

// Fisher–Yates needs a rare draw to hit the identity permutation; 20 retries
// make a stuck loop impossible in practice and the rotation fallback below
// removes even that residual case.
const MAX_SCRAMBLE_ATTEMPTS=20;

/** A deterministic anagram of `word` (same code-point multiset, never the
 * original when the word has ≥2 distinct letters). Unicode-safe: the word is
 * split into code points (`[...word]`), so Turkish letters (ş ğ İ …) survive
 * intact. `rng` must return numbers in [0,1); inject `createRng(seed)` for
 * reproducible output (engine seed: match.seed + round.index + wordIndex).
 * Words that cannot change (fewer than 2 code points, or all letters equal)
 * are returned unchanged. */
export function scrambleWord(word,rng=Math.random){
  const letters=[...String(word??'')];
  if(letters.length<2||new Set(letters).size<2)return letters.join('');
  const original=letters.join('');
  const draw=typeof rng==='function'?rng:Math.random;
  for(let attempt=0;attempt<MAX_SCRAMBLE_ATTEMPTS;attempt++){
    for(let i=letters.length-1;i>0;i--){
      // min() guards against an rng that (against contract) returns ≥1.
      const j=Math.min(i,Math.floor(draw()*(i+1)));
      [letters[i],letters[j]]=[letters[j],letters[i]];
    }
    const candidate=letters.join('');
    if(candidate!==original)return candidate;
  }
  // Deterministic last resort: rotate one step. With ≥2 distinct letters this
  // is always different from the original and still a true anagram.
  return `${letters.slice(1).join('')}${letters[0]}`;
}

/** §6 tohum formülü: sayısal tohumda `matchSeed + roundIndex + wordIndex`
 * (arena.js'in startRound'unda kullandığı `m.seed + r.index + i` ile birebir
 * aynı), dize tohumunda `${matchSeed}:${roundIndex}:${wordIndex}`. Böylece
 * scrambleWordsFor motorun karıştırmalarını bit-bit yeniden üretir. */
export function scrambleSeed(matchSeed,roundIndex,wordIndex){
  const r=Math.trunc(Number(roundIndex))||0,w=Math.trunc(Number(wordIndex))||0;
  if(typeof matchSeed==='string')return `${matchSeed}:${r}:${w}`;
  const n=Number(matchSeed);
  return (Number.isFinite(n)?Math.trunc(n):0)+r+w;
}

/** Bir raundun tüm kelime listesini §6'ya göre karıştırır:
 * `words[i] → scrambleWord(words[i], createRng(scrambleSeed(matchSeed,
 * roundIndex, i)))`. Safdır: yeni dizi döner, girdiye dokunmaz; değişemeyen
 * kelimeler (tek harf, aynı harfler) aynen geçer. */
export function scrambleWordsFor(words,{matchSeed=0,roundIndex=0}={}){
  return Array.from(words??[],(word,i)=>
    scrambleWord(String(word??''),createRng(scrambleSeed(matchSeed,roundIndex,i))));
}

// ── Prep seçimi doğrulama ─────────────────────────────────────────────────

/** Bir koltuk prep seçimini gönderdiyse kilitlidir. Motor (arena.js)
 * `pickLocked` bayrağını atar; `pickLockedAt`/`picked` takma adları da kabul
 * edilir. `roundSkill`/`roundItem` bilinçli olarak kilit işareti SAYILMAZ:
 * motor her prep'te bunları null'a sıfırlar (boş {null,null} seçimi de bir
 * kilitli seçimdir), yani undefined kontrolü yanlış kilit üretirdi. */
const isLocked=p=>p.pickLocked===true||p.pickLockedAt!=null||p.picked===true;

/** Bir prep seçimini doğrular. Safdır: match'i asla değiştirmez.
 *
 * Minimal `match` sözleşmesi (arena motoru state'inin alt kümesi, bkz. §7):
 * ```
 * {
 *   status: 'running',                    // yalnız çalışan maç seçim kabul eder
 *   round: { phase: 'prep' },
 *   participants: [{ seat: 1|2, skillUses?: {}, itemUses?: {}, pickLocked? }],
 * }
 * ```
 * `skill`/`item` null/undefined olabilir ("hiçbir şey seçmedim"); bunun
 * dışındakiler katalogda olmalı ve kullanım hakkı kalmalıdır. Skill ve eşya
 * bütçeleri AYRI sayılır (her id için ARENA_MAX_USES).
 * Hata sırası: NOT_PREP_PHASE → ALREADY_LOCKED → UNKNOWN_SKILL →
 * NO_USES_LEFT(skill) → UNKNOWN_ITEM → NO_USES_LEFT(item). Bilinmeyen koltuk
 * prep fazında olamaz → NOT_PREP_PHASE. NO_USES_LEFT ek olarak hangi bütçe
 * tükendiğini {kind:'skill'|'item', id} ile taşır. */
export function validatePick(match,seat,{skill,item}={}){
  if(!match||match.status!=='running'||match.round?.phase!=='prep')
    return {ok:false,error:'NOT_PREP_PHASE'};
  const p=match.participants?.find(x=>x.seat===seat);
  if(!p)return {ok:false,error:'NOT_PREP_PHASE'};
  if(isLocked(p))return {ok:false,error:'ALREADY_LOCKED'};
  if(skill!==null&&skill!==undefined){
    if(!validateSkillId(skill))return {ok:false,error:'UNKNOWN_SKILL'};
    if((Number(p.skillUses?.[skill])||0)>=ARENA_MAX_USES)
      return {ok:false,error:'NO_USES_LEFT',kind:'skill',id:skill};
  }
  if(item!==null&&item!==undefined){
    if(!validateItemId(item))return {ok:false,error:'UNKNOWN_ITEM'};
    if((Number(p.itemUses?.[item])||0)>=ARENA_MAX_USES)
      return {ok:false,error:'NO_USES_LEFT',kind:'item',id:item};
  }
  return {ok:true};
}

// ── Raund öncesi skill çözümü ─────────────────────────────────────────────

const SEATS=[1,2];
const otherSeat=seat=>seat===1?2:1;
const num=(value,fallback)=>{
  if(value==null)return fallback;
  const n=Number(value);
  return Number.isFinite(n)?Math.trunc(n):fallback;
};
/** Koltuğun seçimi: katalogda olmayan (veya null/dize olmayan) değerler
 * "seçilmemiş" sayılır — motor seçimi zaten validatePick ile doğrulamıştır. */
const pickOf=(map,seat)=>{
  const value=map?.[seat]??map?.[String(seat)];
  return typeof value==='string'&&Object.hasOwn(ARENA_SKILLS,value)?value:null;
};

/** İki koltuğun prep skill seçimlerini raund başı etkilerine çözer (saf, §6).
 * Girdi:
 *   skillsBySeat  {1: skillId|null, 2: skillId|null} ('1'/'2' dize anahtar da
 *                 kabul edilir; tanınmayan id'ler seçilmemiş sayılır)
 *   roundStartAt  raundun başlama damgası (ms)
 *   durationMs    yazma süresi (varsayılan ARENA_ROUND_DURATION_MS)
 * Çıktı: koltuk → {personalEndsAt, overtimeMs, frozenMs, blindClock, scrambled}
 *   personalEndsAt  kişisel bitiş: start+süre; Donmuş An +3 sn, rakipten
 *                   Zaman Hırsızı −5 sn (toplamsal — arena.js'in startRound
 *                   formülüyle aynı: at+süre+freeze−timethief)
 *   overtimeMs      Zaman Hediyesi hakkı: rakip ilk bitirirse bu koltuğun
 *                   kişisel bitişi bitirenAnı+5 sn'e uzar (koşullu uzatma
 *                   motora aittir; personalEndsAt'e ÖNCEDEN gömülmez)
 *   frozenMs        Donmuş An süresi (UI'da buz efekti; +3 sn zaten
 *                   personalEndsAt'e ekli)
 *   blindClock      BU koltuk Karanlık Saat oynadı → bu koltuğun kalan
 *                   süresi rakibin anlık görüntüsünde null gösterilir
 *                   (§7.2 opponent.remainingMs | null; motor kuralı:
 *                   izleyicin rakibinin kaydında blindClock=true ise gizle)
 *   scrambled       rakip Harf Kaosu oynadı → bu koltuğun kelimeleri
 *                   karıştırılmış gösterilir/yazılır (§6: yalnız etkilenen
 *                   oyuncunun roundWords'i değişir)
 * İki taraf aynı anda seçebilir; karşılıklı skill'ler toplamsal birleşir
 * (ör. iki taraf timethief → iki bitiş de −5 sn). */
export function applyPreRoundSkills({skillsBySeat,roundStartAt,durationMs}={}){
  const start=num(roundStartAt,0);
  const base=start+num(durationMs,ARENA_ROUND_DURATION_MS);
  const picks={};for(const seat of SEATS)picks[seat]=pickOf(skillsBySeat,seat);
  const out={};
  for(const seat of SEATS){
    const skill=picks[seat],opponentSkill=picks[otherSeat(seat)];
    let personalEndsAt=base,frozenMs=0;
    if(skill==='freeze'){frozenMs=ARENA_FREEZE_MS;personalEndsAt+=ARENA_FREEZE_MS;}
    if(opponentSkill==='timethief')personalEndsAt-=ARENA_TIME_THIEF_MS;
    out[seat]={
      personalEndsAt,
      overtimeMs:skill==='overtime'?ARENA_OVERTIME_MS:0,
      frozenMs,
      blindClock:skill==='blindclock',
      scrambled:opponentSkill==='scramble'
    };
  }
  return out;
}

// ── Kalan kullanım hakları ────────────────────────────────────────────────

/** Girdi katılımcı (`skillUses`/`itemUses` alanlı) veya doğrudan bir uses
 * haritası olabilir; eksik sayaç "hiç kullanmamış" demektir. */
const usesOf=(player,field)=>player&&typeof player==='object'?(player[field]??player):{};
const remainingOf=used=>Math.min(ARENA_MAX_USES,Math.max(0,ARENA_MAX_USES-(Number(used)||0)));

/** Katalogdaki her skill için kalan kullanım hakkı (0..ARENA_MAX_USES).
 * Hazırlayan UI (§7.2 me.usesLeft) ve botlar bunu doğrudan gösterir. */
export function skillRemainingUses(player){
  const uses=usesOf(player,'skillUses'),out={};
  for(const id of ARENA_SKILL_IDS)out[id]=remainingOf(uses[id]);
  return out;
}

/** Aynısı eşyalar için — skill bütçesinden bağımsız sayılır. */
export function itemRemainingUses(player){
  const uses=usesOf(player,'itemUses'),out={};
  for(const id of ARENA_ITEM_IDS)out[id]=remainingOf(uses[id]);
  return out;
}
