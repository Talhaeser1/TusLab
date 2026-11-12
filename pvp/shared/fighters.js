/** Paket 32 — TuşLab Ruh Düellosu karakter kadrosu (paylaşılan sözleşme).
 * Saf ES modülü: Cloudflare Durable Object, yerel bot motoru ve tarayıcı aynı dosyayı kullanır.
 * `archetype` motorun mevcut `character` alanıdır ('fire' saldırgan, 'rune' savunmacı). Hasar/denge
 * arketipten gelir; karakter farkı görsel + ad + efekt + animasyondur.
 * Kaynak modeller: KayKit Adventurers 1.0 (CC0, Kay Lousberg) — oyunda özgün kimliklerle sunulur.
 */
const freezeDeep=o=>{for(const v of Object.values(o))if(v&&typeof v==='object')freezeDeep(v);return Object.freeze(o);};

export const FIGHTERS=freezeDeep({
 vargr:{
  id:'vargr',name:'Vargr',title:'Kızıl Balta',archetype:'fire',source:'Barbarian',weapon:'Çift başlı savaş baltası',
  model:'./assets/models/vargr/vargr.glb',
  palette:{main:'#c2412d',accent:'#f2a541',hex:0xc2412d},
  blurb:'Kuzey buzullarında kor yakıp kışı deviren balta ustası; her yenilgiyi bir sonraki savuruşa öfke olarak saklar.',
  skills:{
   q:{name:'Balta Savuruşu',short:'Tepeden balta darbesi',desc:'İki elle tepeden balta indirir; hızlı, net vuruş.',clip:'2H_Melee_Attack_Chop',fx:'axe-chop'},
   e:{name:'Kasırga',short:'Dönerek çoklu vuruş',desc:'Baltayla dönerek art arda vurur; çok vuruşlu darbe.',clip:'2H_Melee_Attack_Spin',fx:'spin'},
   r:{name:'Kan Fırtınası',short:'Üç evreli kızıl girdap',desc:'Sıçrayıp dönen kızıl bir girdaba dönüşür; üç evreli ulti.',clip:'2H_Melee_Attack_Spinning',clips:['Jump_Start','2H_Melee_Attack_Spinning','Jump_Land'],fx:'blood-storm'},
   s:{name:'Demir Duruş',short:'Eş kelimede %30 blok',desc:'Baltayı siper alır; gelen darbeyi azaltır, tam zamanlamada savuşturur.',clip:'Blocking',fx:'guard'}
  }
 },
 sira:{
  id:'sira',name:'Sira',title:'Gölge Mızrak',archetype:'fire',source:'Rogue',weapon:'Mızrak & çifte hançer',
  model:'./assets/models/sira/sira.glb',
  palette:{main:'#7b3fc4',accent:'#3ee0c8',hex:0x7b3fc4},
  blurb:'Çöl kervanlarının izini gölgelerden süren iz sürücü; mızrağını ancak hedefi ışığa çıktığında fırlatır.',
  skills:{
   q:{name:'Mızrak Atışı',short:'Mızrak mermisi fırlatır',desc:'Sağ elini kaldırıp mızrak fırlatır; mermi rakibe uçar.',clip:'Throw',fx:'projectile-spear'},
   e:{name:'Çifte Hançer',short:'Atılıp çifte saplar',desc:'İleri atılıp iki hançerle saplar.',clip:'Dualwield_Melee_Attack_Stab',clips:['Dodge_Forward','Dualwield_Melee_Attack_Stab'],fx:'dual-stab'},
   r:{name:'Gölge Yağmuru',short:'Üç gölge mızrağı',desc:'Yana kayıp art arda üç gölge mızrağı yağdırır; üç evreli ulti.',clip:'Throw',clips:['Dodge_Left','Throw','Throw','Throw'],fx:'shadow-volley'},
   s:{name:'Gölge Adımı',short:'Eş kelimede %30 blok',desc:'Geri kayarak darbeyi karşılar; tam zamanlamada savuşturur.',clip:'Blocking',fx:'guard'}
  }
 },
 doran:{
  id:'doran',name:'Doran',title:'Demir Sur',archetype:'rune',source:'Knight',weapon:'Kılıç & kalkan',
  model:'./assets/models/doran/doran.glb',
  palette:{main:'#2f6fb5',accent:'#d9c27a',hex:0x2f6fb5},
  blurb:'Yıkılan kale kentinin son muhafızı; surları yeniden örene dek kalkanını kimseye indirmeyeceğine ant içti.',
  skills:{
   q:{name:'Kılıç Darbesi',short:'Dengeli kılıç vuruşu',desc:'Tek elle tepeden kılıç indirir; dengeli vuruş.',clip:'1H_Melee_Attack_Chop',fx:'sword-chop'},
   e:{name:'Kalkan Ezici',short:'Kalkanla ezer, sarsar',desc:'Kalkanla ezer; rakibin siperini sarsar.',clip:'Block_Attack',fx:'shield-bash'},
   r:{name:'Sur Çöküşü',short:'Sıçrayıp yere çakılır',desc:'Havaya sıçrayıp yere çakılır, ardından yatay keser; üç evreli ulti.',clip:'1H_Melee_Attack_Slice_Horizontal',clips:['Jump_Start','Jump_Land','1H_Melee_Attack_Slice_Horizontal'],fx:'wall-crash'},
   s:{name:'Kale Kalkanı',short:'Eş kelimede %30 blok',desc:'Kalkanı kaldırır; gelen darbeyi azaltır, tam zamanlamada savuşturur.',clip:'Blocking',fx:'guard'}
  }
 },
 nyx:{
  id:'nyx',name:'Nyx',title:'Rün Kâhini',archetype:'rune',source:'Mage',weapon:'Rün asası',
  model:'./assets/models/nyx/nyx.glb',
  palette:{main:'#1f9e8f',accent:'#b79cff',hex:0x1f9e8f},
  blurb:'Gece gökyüzündeki takımyıldızları rün diye okuyan kâhin; her savaşı yıldızlarda önceden görmüş gibi dövüşür.',
  skills:{
   q:{name:'Rün Oku',short:'Rün mermisi fırlatır',desc:'Avucundan parlayan bir rün mermisi fırlatır.',clip:'Spellcast_Shoot',fx:'projectile-rune'},
   e:{name:'Rün Sütunu',short:'Yerden ışık sütunu',desc:'Rakibin altından ışık sütunu yükseltir.',clip:'Spellcast_Raise',fx:'pillar'},
   r:{name:'Yıldız Çöküşü',short:'Gökten meteor indirir',desc:'Uzun bir büyüyle gökten meteor indirir; üç evreli ulti.',clip:'Spellcast_Long',fx:'meteor'},
   s:{name:'Rün Perdesi',short:'Eş kelimede %30 blok',desc:'Önüne rün perdesi örer; tam zamanlamada savuşturur.',clip:'Blocking',fx:'guard'}
  }
 },
 konyali:{
  id:'konyali',name:'Hacı Usta',title:'Ney Ustası',archetype:'rune',source:'Meshy',weapon:'Etli ekmek & ney',
  model:'./assets/models/konyali/konyali.glb',
  palette:{main:'#d6a53a',accent:'#b8512f',hex:0xd6a53a},
  blurb:'Konya pazarının fırınından çıkıp meydanlara düşen usta; etli ekmeği fırlatır, neyini üfleyince meydan susar.',
  skills:{
   q:{name:'Etli Ekmek Fırlatışı',short:'Sıcak etli ekmek fırlatır',desc:'Omuz üstünden sıcak etli ekmeği rakibe fırlatır; menzilli vuruş.',clip:'Over_Shoulder_Throw',fx:'projectile-bread'},
   e:{name:'Sema Dönüşü',short:'Dönerek alan hasarı',desc:'Sema dönüşüyle sıçrayıp çevresine dönerek alan hasarı verir.',clip:'360_Power_Spin_Jump',fx:'spin'},
   r:{name:'Ney Feryadı',short:'Ses dalgasıyla ulti',desc:'Neyi öyle bir üfler ki ses dalgası rakibin kulaklarını patlatır; sinematik ulti.',clip:'Ney_Ulti',fx:'ney-shockwave'},
   s:{name:'Hacı Duruşu',short:'Eş kelimede %30 blok',desc:'Yere sağlam basıp darbeyi karşılar; tam zamanlamada savuşturur.',clip:'Block1',fx:'guard'}
  }
 }
});

export const FIGHTER_IDS=Object.freeze(Object.keys(FIGHTERS));
export const SHARED_CLIPS=Object.freeze({block:'Blocking',blockHit:'Block_Hit',hit:['Hit_A','Hit_B'],ko:'Death_A',win:'Cheer',idle:'Idle',idleCombat:'2H_Melee_Idle'});
const DEFAULTS=Object.freeze({fire:'vargr',rune:'doran'});

export function isFighterId(id){return typeof id==='string'&&Object.hasOwn(FIGHTERS,id);}
export function defaultFighter(archetype){return DEFAULTS[archetype]||DEFAULTS.fire;}
/** Geçerli kimliği döndürür. Arketip verilmişse ve kimlik o arketipe ait değilse arketipin varsayılanı döner. */
export function normalizeFighter(id,archetype){
 const valid=isFighterId(id);
 if(archetype==='fire'||archetype==='rune'){
  return valid&&FIGHTERS[id].archetype===archetype?id:defaultFighter(archetype);
 }
 return valid?id:defaultFighter('fire');
}
export function fighterSide(id){return isFighterId(id)?FIGHTERS[id].archetype:'fire';}
export function getFighter(id,archetype){return FIGHTERS[normalizeFighter(id,archetype)];}
export function fighterSkillName(id,skill,archetype){return getFighter(id,archetype).skills[skill]?.name||'';}
