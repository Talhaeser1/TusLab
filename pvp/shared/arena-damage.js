/** TuşLab arena mode — damage maths (docs/ARENA-MODU.md §5, Ajan 2).
 * Pure ES module with no imports, so the arena engine (pvp/shared/arena.js),
 * the Cloudflare Durable Object and the browser arena UI all share the exact
 * same formulas.
 *
 * Raund sonu `resolve` fazında kelime kelime, gönderim sırasına göre:
 *   amount = Math.round(taban × kombo × (1 − penalty))
 * taban  = ARENA_ROUND_BASE_DAMAGE[roundIndex] (gauntlet +%10)
 * kombo  = ardışık doğru serisine göre §5.3 çarpanı (combostone yükseltir)
 * penalty= ardışık yanlışların toplamsal düşüşü, tavan 0.75 (cleanse → 0)
 *
 * Geçersiz girdiler (negatif, NaN, kesirli, bilinmeyen eşya) asla NaN hasar
 * üretmez: sayaçlar 0'a, raund indeksi en yakın geçerli raunda sıkıştırılır,
 * bilinmeyen eşya "eşya yok" gibi davranır.
 */

// §5.2 — ardışık yanlış katsayıları (toplamsal) ve toplam düşüş tavanı.
// Yüzde uzayında birikilir (10+15+23+30), tek bölmeyle döner; böylece
// 0.48 gibi değerler kayan nokta gürültüsü olmadan tam literal eşitir.
export const ARENA_WRONG_FACTORS=Object.freeze([0.10,0.15,0.23,0.30]);
export const ARENA_PENALTY_CAP=0.75;

// §5.1 — raund başına, doğru kelime başına taban hasar (R1..R6).
export const ARENA_ROUND_BASE_DAMAGE=Object.freeze([100,90,80,80,80,75]);

// §5.3 — kombo eşikleri ve çarpanları. Sayaç 4'te taşmaz: 5+ doğru FİNAL.
export const ARENA_COMBO_RULES=Object.freeze({
  comboAt:4,                       // 4. ardışık doğru → KOMBO vuruşu
  finalAt:5,                       // 5+ ardışık doğru → FİNAL vuruşu
  normal:1.0,
  combo:1.5,                       // combostone: 1.75
  final:2.0,                       // combostone: 2.4
  combostone:Object.freeze({combo:1.75,final:2.4})
});

// §5.4 — eşya kataloğu (hasar etkileri). Kimlikler arena-skills.js'teki
// ARENA_ITEM_IDS aynasıyla birebir aynıdır (combostone, cleanse, gauntlet,
// aegis); seçim ve kullanım hakkı doğrulaması arena-skills.js'tedir.
// aegis burada yalnız savunma etkisi olarak tanımlıdır (defenderReduction).
export const ARENA_ITEMS=Object.freeze({
  combostone:Object.freeze({
    id:'combostone',name:'Kombo Yükselteci',icon:'🔥',
    effect:Object.freeze({type:'comboBoost',combo:1.75,final:2.4})
  }),
  cleanse:Object.freeze({
    id:'cleanse',name:'Arınma Taşı',icon:'🛡️',
    effect:Object.freeze({type:'cleanse'})
  }),
  gauntlet:Object.freeze({
    id:'gauntlet',name:'Ağır Eldiven',icon:'🥊',
    effect:Object.freeze({type:'baseBoost',baseMultiplier:1.1})
  }),
  aegis:Object.freeze({
    id:'aegis',name:'Çelik Kalkan',icon:'⚡',
    effect:Object.freeze({type:'defend',reduction:0.20})
  })
});
export const ARENA_ITEM_IDS=Object.freeze(Object.keys(ARENA_ITEMS));

// Yanlış katsayılarının yüzde karşılıkları (10, 15, 23, 30).
const WRONG_PERCENTS=Object.freeze(ARENA_WRONG_FACTORS.map(f=>Math.round(f*100)));
const CAP_PERCENT=Math.round(ARENA_PENALTY_CAP*100);

// Güvenli sayaç: negatif / NaN / kesirli → 0 veya aşağı yuvarlanmış tam sayı.
function count(n){
  return Number.isFinite(n)&&n>0?Math.floor(n):0;
}

// Güvenli raund indeksi: 0..5 dışı → en yakın geçerli raund (NaN → R1).
function baseFor(roundIndex){
  const last=ARENA_ROUND_BASE_DAMAGE.length-1;
  const i=Number.isFinite(roundIndex)
    ?Math.min(Math.max(Math.floor(roundIndex),0),last):0;
  return ARENA_ROUND_BASE_DAMAGE[i];
}

/** Ardışık `consecutiveWrong` yanlıştan doğan toplamsal hasar düşüşü
 * (0..0.75). 1 yanlış 0.10, 2 → 0.25, 3 → 0.48, 4+ → her biri +0.30,
 * tavan 0.75 (hasar en az %25). `cleanse` → 0. Bilinmeyen eşya etkisizdir.
 * Örnek (§5.2): wrongPenalty(3) = 0.48 → 5. kelime ×0.52. */
export function wrongPenalty(consecutiveWrong,item){
  if(item==='cleanse')return 0;
  const n=count(consecutiveWrong);
  if(n===0)return 0;
  let pct=0;
  for(let i=0;i<n;i++)pct+=WRONG_PERCENTS[Math.min(i,WRONG_PERCENTS.length-1)];
  return Math.min(CAP_PERCENT,pct)/100;
}

/** Bu kelimenin ardışık doğru sayısına (streak) göre kombo çarpanı:
 * 1–3 → 1.0, 4 → 1.5 (combostone 1.75), 5+ → 2.0 (combostone 2.4).
 * Güvenli: streak ≤ 0 / NaN → 1.0. */
export function comboMultiplier(streak,item){
  const n=count(streak);
  const boost=item==='combostone'?ARENA_COMBO_RULES.combostone:null;
  if(n>=ARENA_COMBO_RULES.finalAt)return boost?boost.final:ARENA_COMBO_RULES.final;
  if(n>=ARENA_COMBO_RULES.comboAt)return boost?boost.combo:ARENA_COMBO_RULES.combo;
  return ARENA_COMBO_RULES.normal;
}

/** Savunanın eşyasının gelen hasar düşüşü: aegis → 0.20 (−%20), yoksa 0. */
export function defenderReduction(item){
  return item==='aegis'?ARENA_ITEMS.aegis.effect.reduction:0;
}

/** Bir DOĞRU kelimenin vuruşu (§5.5 sözleşme).
 * `streakBefore`  bu kelimeden ÖNCEKİ ardışık doğru sayısı (bu kelime
 *                doğruyken streak = streakBefore + 1),
 * `consecutiveWrong` bu kelimeden önce birikmiş ardışık yanlış sayısı,
 * `item`          saldırganın o raund eşyası (id; combostone/cleanse/gauntlet).
 * → { amount, multiplier, penalty, tags, base }
 *   amount  = Math.round(base × multiplier × (1 − penalty))
 *   base    = taban (gauntlet ile +%10, yuvarlanmış)
 *   tags    = 'KOMBO' (streak 4), 'FİNAL' (streak 5+), 'ARINMA' (cleanse
 *             gerçek bir cevayı sıfırladıysa), 'AĞIR' (gauntlet) */
export function wordDamage({roundIndex=0,streakBefore=0,consecutiveWrong=0,item=null}={}){
  const gauntlet=item==='gauntlet';
  const cleanse=item==='cleanse';
  const raw=baseFor(roundIndex);
  const base=gauntlet?Math.round(raw*ARENA_ITEMS.gauntlet.effect.baseMultiplier):raw;
  const penalty=wrongPenalty(consecutiveWrong,item);
  const streak=count(streakBefore)+1;
  const multiplier=comboMultiplier(streak,item);
  const amount=Math.round(base*multiplier*(1-penalty));
  const tags=[];
  if(streak>=ARENA_COMBO_RULES.finalAt)tags.push('FİNAL');
  else if(streak>=ARENA_COMBO_RULES.comboAt)tags.push('KOMBO');
  if(cleanse&&count(consecutiveWrong)>0)tags.push('ARINMA');
  if(gauntlet)tags.push('AĞIR');
  return {amount,multiplier,penalty,tags,base};
}

/** Bir raundun saldırı listesi (saf, §5 + motor için birleşik yardımcı).
 * `attempts` oyuncunun gönderim sırasındaki kayıtlarıdır; her biri
 * {index, correct, at}. Her DOĞRU kelime bir vuruş üretir:
 * [{wordIndex, amount, multiplier, penalty, tags, base}].
 * - yanlış → ardışık yanlış sayacı +1, streak 0,
 * - doğru  → vuruş hesaplanır (streak = önceki streak + 1, ceza = önceki
 *   birikim), sonra ceza sayacı 0'lanır.
 * Savunanın aegis'i (defenderItem) amount'a uygulanır ve yuvarlanır;
 * multiplier/penalty/tags/base saldırgana aittir. Geçersiz attempts → []. */
export function resolveRoundAttacks({roundIndex=0,attempts=null,item=null,defenderItem=null}={}){
  if(!Array.isArray(attempts))return [];
  const reduction=1-defenderReduction(defenderItem);
  const shielded=reduction<1;
  let streak=0,consecutiveWrong=0;
  const attacks=[];
  for(const a of attempts){
    if(!a)continue;
    if(a.correct){
      const hit=wordDamage({roundIndex,streakBefore:streak,consecutiveWrong,item});
      streak+=1;
      consecutiveWrong=0;
      attacks.push({
        wordIndex:a.index,
        amount:shielded?Math.round(hit.amount*reduction):hit.amount,
        multiplier:hit.multiplier,
        penalty:hit.penalty,
        tags:hit.tags,
        base:hit.base
      });
    }else{
      streak=0;
      consecutiveWrong+=1;
    }
  }
  return attacks;
}
