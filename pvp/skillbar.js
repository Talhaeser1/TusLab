/**
 * Yetenek çubuğu (Q / E / S / R) — pasif HUD göstergesi.
 * Oyuncu tıklamaz: doğru kelimeler ölçeri doldurur, eşikte yetenek sunucuda kendiliğinden çıkar.
 * Bu modül yalnız görünümü üretir/günceller; hiçbir maç verisini değiştirmez.
 * Hareket: yalnız transform/opacity, tek seferlik (WAAPI); sonsuz animasyon yok.
 */
import {FIGHTERS,isFighterId,SKILL_FIELD,fighterDefense} from './shared/fighters.js';
import {SKILL_THRESHOLDS as ENGINE_THRESHOLDS,chainProgress,ULTIMATE_MULTIPLIER_CAP} from './shared/match.js';
export const SKILL_ORDER=Object.freeze(['Q','E','S','R']); // eski (klasik) kart satırı: E kartı = motor 'e' (yakın vuruş)
/** Kart satırı modlara göre: klasik Q/E(=W rozetli yakın vuruş)/S/R · rounds Q/W/E/R (E = savunma). Satırda beş kart vardır; görünmeyen gizlenir. */
export const ROW_KEYS=Object.freeze({classic:Object.freeze(['Q','E','S','R']),rounds:Object.freeze(['Q','W','E','R'])});
const ALL_KEYS=Object.freeze(['Q','W','E','S','R']);
export const rowKeysFor=rounds=>rounds?ROW_KEYS.rounds:ROW_KEYS.classic;
/** Satırdaki kartları moda göre göster/gizle (W yalnız rounds, S yalnız klasik). */
export function syncRowLayout(section,{rounds=false}={}){
  if(!section)return;
  const keys=rowKeysFor(rounds);
  for(const key of ALL_KEYS){
    const card=section.querySelector(`[data-skill="${key}"]`);if(!card)continue;
    const hide=!keys.includes(key);
    if(card.hidden!==hide)card.hidden=hide;
  }
  const tag=rounds?'rounds':'classic';
  if(section.dataset&&section.dataset.skRow!==tag)section.dataset.skRow=tag;
}
/** KESINYAP 21 — tuş → motor anahtarı. W = motor 'e' (yakın vuruş); E rounds'ta motor 'h' (kendine can), klasikte eski 'e'. */
export const engineKeyOf=(key,rounds=false)=>key==='W'?'e':key==='E'?(rounds?'h':'e'):String(key).toLowerCase();
// Eşikler tek kaynaktan (pvp/shared/match.js) gelir; burada kopya sabit tutulmaz.
export const SKILL_THRESHOLDS=ENGINE_THRESHOLDS;

const svg=body=>`<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const SKILL_INFO=Object.freeze({
  fire:Object.freeze({
    Q:{name:'Alev Kesişi',effect:'Hızlı alev kesiği',icon:svg('<path d="M5 19C10 15.5 14 10.5 18 4"/><path d="M9.5 20.5c4-2.6 7.2-6 9.5-10.5"/><path d="M4 13.5c2.5-1.2 4.6-3 6.2-5.5"/>')},
    H:{name:'Kor Nefesi',effect:'Kendine can verir',icon:svg('<path d="M12 20s-7-4.4-7-9.6A4 4 0 0 1 12 8a4 4 0 0 1 7 2.4C19 15.6 12 20 12 20z"/><path d="M12 11v5"/><path d="M9.5 13.5h5"/>')},
    W:{name:'Yer Yaran Darbe',effect:'Ağır darbe, yeri yarar',icon:svg('<path d="M12 3v8"/><path d="M8.5 7.5 12 11l3.5-3.5"/><path d="M3 16h5.5l1.6 2.4 1.9-3 1.9 3 1.6-2.4H21"/><path d="M12 15.4V21"/>')},
    E:{name:'Yer Yaran Darbe',effect:'Ağır darbe, yeri yarar',icon:svg('<path d="M12 3v8"/><path d="M8.5 7.5 12 11l3.5-3.5"/><path d="M3 16h5.5l1.6 2.4 1.9-3 1.9 3 1.6-2.4H21"/><path d="M12 15.4V21"/>')},
    S:{name:'Kor Kalkanı',effect:'Eş kelimede %30 blok',icon:svg('<path d="M12 3 19 6v5c0 4.8-3.2 8.3-7 10-3.8-1.7-7-5.2-7-10V6z"/><path d="M12 9.2c1.6 1.4 2.3 2.6 2.3 3.7a2.3 2.3 0 0 1-4.6 0c0-.9.5-1.6 1-2.2.2.8.6 1.1 1.3 1.1z"/>')},
    R:{name:'Kızıl Fırtına',effect:'Üç vuruşlu final',icon:svg('<path d="M12 12a1.6 1.6 0 1 1 1.6-1.6 3.6 3.6 0 1 1-3.6-3.6 5.8 5.8 0 1 1-5.8 5.8"/><path d="M20 4.5 17.6 7"/><path d="M21 9h-2.4"/>')}
  }),
  rune:Object.freeze({
    Q:{name:'Rün Kesişi',effect:'Hızlı rün kesiği',icon:svg('<path d="M12 3.5 17.5 12 12 20.5 6.5 12z"/><path d="M4 19.5 20 4.5"/>')},
    H:{name:'Mühür Şifası',effect:'Kendine can verir',icon:svg('<path d="M12 20s-7-4.4-7-9.6A4 4 0 0 1 12 8a4 4 0 0 1 7 2.4C19 15.6 12 20 12 20z"/><path d="M12 11v5"/><path d="M9.5 13.5h5"/>')},
    W:{name:'Sarsıcı Darbe',effect:'Ağır darbe, sarsar',icon:svg('<circle cx="12" cy="12" r="2"/><path d="M8 8a5.7 5.7 0 0 0 0 8"/><path d="M16 8a5.7 5.7 0 0 1 0 8"/><path d="M5 5a9.9 9.9 0 0 0 0 14"/><path d="M19 5a9.9 9.9 0 0 1 0 14"/>')},
    E:{name:'Sarsıcı Darbe',effect:'Ağır darbe, sarsar',icon:svg('<circle cx="12" cy="12" r="2"/><path d="M8 8a5.7 5.7 0 0 0 0 8"/><path d="M16 8a5.7 5.7 0 0 1 0 8"/><path d="M5 5a9.9 9.9 0 0 0 0 14"/><path d="M19 5a9.9 9.9 0 0 1 0 14"/>')},
    S:{name:'Mavi Mühür',effect:'Eş kelimede %30 blok',icon:svg('<path d="M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9z"/><path d="M12 8.2v7.6"/><path d="M9.2 10.6 12 8.2l2.8 2.4"/>')},
    R:{name:'Sonsuz Mühür',effect:'Üç vuruşlu mühür',icon:svg('<path d="M12 12c-1.9-2.6-3.5-3.8-5.3-3.8a3.8 3.8 0 0 0 0 7.6c1.8 0 3.4-1.2 5.3-3.8s3.5-3.8 5.3-3.8a3.8 3.8 0 0 1 0 7.6c-1.8 0-3.4-1.2-5.3-3.8z"/>')}
  })
});

const escapeHTML=value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

function ariaFor(key,name,threshold){
  const how=threshold?`${threshold} doğru kelimede kendiliğinden çıkar`:'rakiple aynı anda doğru kelimede kendiliğinden devreye girer';
  // Kullanıcı kuralı "ultide max 2 kombo": R kartının açıklamasında görünür.
  return `${key} ${name}: ${how}${key==='R'?`. Ulti çarpanı en çok ×${String(ULTIMATE_MULTIPLIER_CAP).replace('.',',')}`:''}`;
}

/** Kart işaretlemesi. İlk <small> durum satırıdır (network.js eski metni buraya yazar; gizli tutulur).
 * Maç dışında (ilk çizim) hiçbir kart "Hazır" görünmez: eşikli kartlar 0/N doluyor, S kartı 'idle' (maçta açılır). */
export function skillCardHTML(kind,key,label,threshold){
  const info=SKILL_INFO[kind]?.[key]||{name:label,effect:'',icon:''};
  const name=label||info.name;
  const state=threshold?'charging':'idle';
  const fill=0;
  return `<button type="button" class="pvp2-skill pvp2-skill-${key.toLowerCase()} sk-card" data-skill="${key}" data-demo-action="${key.toLowerCase()}" data-target="${kind}" data-sk-kind="${kind}" data-sk-state="${state}" style="--sk-fill:${fill};--sk-seg:${threshold||1}" aria-pressed="false" aria-label="${escapeHTML(ariaFor(key,name,threshold))}">`
    +`<span class="pvp2-skill-key sk-key" aria-hidden="true">${key}</span>`
    +`<span class="sk-icon" aria-hidden="true">${info.icon}</span>`
    +`<span class="pvp2-skill-copy sk-copy"><strong>${escapeHTML(name)}</strong><small class="sk-legacy" aria-hidden="true"></small><span class="sk-fx">${escapeHTML(info.effect)}</span></span>`
    +`<span class="sk-foot" aria-hidden="true"><span class="sk-meter"><span class="sk-fill"></span><span class="sk-cd"></span></span>`
    +`<span class="sk-status">${escapeHTML(skillStatusText({key,energy:0,threshold,cooldownMs:0,shieldActive:false,idle:!threshold}))}</span></span>`
    +`<span class="sk-glow" aria-hidden="true"></span><span class="sk-burst" aria-hidden="true"></span>`
    +`</button>`;
}

/** Saf: seri (streak/combo) → tek kartın dolumu. Beceriler eşikte KENDİLİĞİNDEN atılır (oyuncunun basacağı tuş yok), bu yüzden kart:
 *  - eşiğin altında 'doluyor' (n/N kelime),
 *  - eşiğe ulaşılan kelimede ve sonrasında 'atıldı' (energy N/N ya da used:true; aynı seride yeniden atılmaz;
 *    seri düşüp eşik yeniden geçilince ya da yeni çevrimde yeniden dolar). Görünüm: skillMeter → state 'cast'.
 * classic: 5'li çevrim (2 Q · 4 W/E · 5 R; combo 6 → yeni çevrimin 1. kelimesi). rounds: mutlak seri (3 Q · 5 W · 7 E · 10 R);
 * 10'dan sonra Q zinciri chainProgress ile yeniden dolar (13, sonra 21, 29 …). Bilinmeyen/eşiksiz anahtar → {threshold:0}. */
export function skillCharge(key,streak,{rounds=false}={}){
  const threshold=(rounds?SKILL_THRESHOLDS.rounds:SKILL_THRESHOLDS.classic)[key]??0;
  if(!threshold)return {energy:0,threshold:0,used:false};
  const s=Math.max(0,Math.floor(Number(streak)||0));
  if(rounds&&key==='Q'&&s>SKILL_THRESHOLDS.rounds.R){
    // Zincir (motorla aynı kaynak): 13'e kadar her 3, sonra her 8 kelime (13 → 21 → 29 …).
    const {pos,every}=chainProgress(s);
    return pos===0?{energy:every,threshold:every,used:false,chain:true}:{energy:pos,threshold:every,used:false,chain:true};
  }
  const c=rounds?s:(s===0?0:((s-1)%5)+1);
  if(c<=threshold)return {energy:c,threshold,used:false};
  return {energy:0,threshold,used:true};
}

/** Sunucu oyuncu görüntüsünden tek yeteneğin ham durumu. */
export function readSkillState(player,key,{rounds=false,now=Date.now()}={}){
  const k=engineKeyOf(key,rounds);
  const streak=rounds?(player?.streak??player?.combo):player?.combo;
  const c=key==='S'?null:skillCharge(key,streak,{rounds});
  const {energy,threshold,used}=c||{energy:0,threshold:0,used:false};
  const cooldownMs=Math.max(0,(Number(player?.cooldownUntil?.[k])||0)-now);
  const shieldActive=key==='S'&&Boolean(player?.shieldUntil&&player.shieldUntil>now);
  const shieldMs=shieldActive?player.shieldUntil-now:0;
  const casts=key==='S'?(Number(player?.shieldUntil)||0):(Number(player?.combatStats?.casts?.[k])||0);
  // Rounds'ta S (klasik rastgele blok) yoktur: kart 'off'. Savunma rounds'ta E kartıdır (kalkan ya da can).
  // Rounds E (savunma): can doluyken atılan can bekletilir (healBank) → 'BEKLİYOR'; uygulanan can (roundHeal) / kalkan (shieldHp) yazılır.
  const defense=rounds&&key==='E'?{
    defense:fighterDefense(player?.fighter),pending:Math.max(0,Math.round(Number(player?.healBank)||0)),
    healed:Math.max(0,Math.round(Number(player?.roundHeal)||0)),shieldHp:Math.max(0,Math.round(Number(player?.shieldHp)||0))}:{};
  return {key,energy,threshold,cooldownMs,shieldActive,shieldMs,casts,used,...(c?.chain?{chain:true}:{}),...defense,...(key==='S'&&rounds?{off:true}:{})};
}

/** Görsel durum: charging | cast (bu seride atıldı) | pending (E atıldı, can ilk darbeyi bekliyor) | cooldown | active | ready (yalnız klasik S)
 * | idle (maç yok) | off (bu modda yok). fill 0..1. Eşikli kartta "HAZIR" yoktur: beceri eşikte kendiliğinden atılır. */
export function skillMeter({key,energy,threshold,cooldownMs,shieldActive,used=false,idle=false,off=false,pending=0}){
  if(idle)return {state:'idle',fill:0};
  if(key==='S'){
    if(off)return {state:'off',fill:0};
    if(shieldActive)return {state:'active',fill:1};
    if(cooldownMs>0)return {state:'cooldown',fill:0};
    return {state:'ready',fill:1};
  }
  if(pending>0&&(used||threshold&&energy>=threshold))return {state:'pending',fill:1};
  if(used)return {state:'cast',fill:1};
  const fill=threshold?Math.min(1,energy/threshold):0;
  if(cooldownMs>0)return {state:'cooldown',fill};
  return {state:fill>=1?'cast':'charging',fill};
}

/** Kart alt yazısı. compact: HUD rayı (n/N, kısa). */
export function skillStatusText({key,energy,threshold,cooldownMs,shieldActive,used=false,idle=false,off=false,chain=false,defense=null,pending=0,healed=0,shieldHp=0},{compact=false}={}){
  if(idle)return 'Maçta açılır';
  if(key==='S')return off?'Yalnız klasik':shieldActive?'Kalkan açık':cooldownMs>0?'Doluyor':'Devrede';
  const {state}=skillMeter({key,energy,threshold,cooldownMs,shieldActive,used,pending});
  if(state==='pending')return 'BEKLİYOR';
  if(state==='cast'){
    if(defense==='shield')return shieldHp>0?`KALKAN ${shieldHp}`:healed>0?'KIRILDI':'ATILDI ✓'; // kırıldı: hasarı emdi, bitti
    if(defense==='heal'&&healed>0)return `+${healed} can`;
    return 'ATILDI ✓';
  }
  if(cooldownMs>0)return `Bekle ${Math.ceil(cooldownMs/1000)} sn`;
  return compact?`${energy}/${threshold}`:`${energy}/${threshold} kelime`;
}
/** Kısa yardım satırı (doğru olanı söyler): rounds eşikleri + yanlış kelime seriyi yarıya indirir; klasik 5'li çevrim. */
export function skillRowNote(streak,{rounds=false,pending=0}={}){
  const s=Math.max(0,Math.floor(Number(streak)||0));
  const t=rounds?SKILL_THRESHOLDS.rounds:SKILL_THRESHOLDS.classic;
  if(pending>0)return `Seri ${s} · E bekliyor: ilk yediğin darbeden sonra +${pending} can`;
  return rounds?`Seri ${s} · seri ${t.Q} / ${t.W} / ${t.E} / ${t.R}'da kendiliğinden atılır · yanlış kelime seriyi yarıya indirir`
    :`Seri ${s} · ${t.Q} / ${t.W} / ${t.R} doğru kelimede kendiliğinden atılır`;
}

const timers=new WeakMap();
function play(node,frames,options){
  if(node&&typeof node.animate==='function'){try{node.animate(frames,options);}catch{/* eski tarayıcı: sessizce geç */}}
}
function flash(el,kind,reduced){
  const glow=el.querySelector(kind==='cast'?'.sk-burst':'.sk-glow');
  if(reduced){play(glow,[{opacity:0},{opacity:.85},{opacity:0}],{duration:150,easing:'ease-out'});return;}
  play(glow,[{opacity:0},{opacity:1,offset:.35},{opacity:0}],{duration:300,easing:'ease-out'});
  if(kind==='cast')play(el.querySelector('.sk-icon'),[{transform:'translateY(-4px) scale(1.12)'},{transform:'none'}],{duration:300,easing:'cubic-bezier(.16,1,.3,1)'});
  else play(el.querySelector('.sk-key'),[{transform:'scale(1)'},{transform:'scale(1.16)',offset:.4},{transform:'scale(1)'}],{duration:300,easing:'cubic-bezier(.16,1,.3,1)'});
}

/** Tek kartı boya; durum geçişlerinde tek seferlik geri bildirim oynatır. */
export function paintSkillCard(el,info,{reduced=false,live=true}={}){
  if(!el)return;
  const {state,fill}=skillMeter(info);
  const seg=String(info.threshold||1);
  if(el.style.getPropertyValue('--sk-seg')!==seg)el.style.setProperty('--sk-seg',seg);
  const fillText=String(Math.round(fill*1000)/1000);
  if(el.style.getPropertyValue('--sk-fill')!==fillText)el.style.setProperty('--sk-fill',fillText);
  const prev=el.dataset.skState;
  if(prev!==state){
    el.dataset.skState=state;
    if(prev==='charging'&&(state==='cast'||state==='pending'))flash(el,'ready',reduced);
  }
  // Seri düştü (yanlış kelime → yarıya / yeni raund → 0): kart kısa bir sarsıntıyla geri iner.
  const prevFill=Number(el.dataset.skFillPrev);
  if(live&&Number.isFinite(prevFill)&&fill<prevFill-1e-6&&!reduced)play(el,[{transform:'translateX(0)'},{transform:'translateX(-3px)',offset:.3},{transform:'translateX(3px)',offset:.6},{transform:'none'}],{duration:240,easing:'ease-out'});
  el.dataset.skFillPrev=String(fill);
  if(live){
    const before=el.dataset.skCasts;
    if(before!==undefined&&info.casts>Number(before))flash(el,'cast',reduced);
    el.dataset.skCasts=String(info.casts);
  }else delete el.dataset.skCasts;
  const status=el.querySelector('.sk-status');const text=skillStatusText(info);
  if(status&&status.textContent!==text)status.textContent=text;
  const name=el.querySelector('.sk-copy strong')?.textContent||'';
  const aria=ariaFor(info.key,name,info.threshold)+`. Durum: ${text}`;
  if(el.getAttribute('aria-label')!==aria)el.setAttribute('aria-label',aria);
  // Bekleme süpürmesi: yeni bitiş zamanı için bir kez, transform ile.
  const cd=el.querySelector('.sk-cd');
  if(state==='cooldown'&&info.cooldownMs>0){
    const end=String(Math.round((Date.now()+info.cooldownMs)/100));
    if(el.dataset.skCdEnd!==end){
      el.dataset.skCdEnd=end;
      if(!reduced)play(cd,[{transform:'scaleX(1)'},{transform:'scaleX(0)'}],{duration:info.cooldownMs,easing:'linear',fill:'forwards'});
    }
  }else if(el.dataset.skCdEnd)delete el.dataset.skCdEnd;
  // Süre dolunca yeni bir anlık görüntü gelmese de durumu kendisi çevirir.
  clearTimeout(timers.get(el));
  const wait=Math.max(info.cooldownMs,info.shieldMs||0);
  if(wait>0)timers.set(el,setTimeout(()=>paintSkillCard(el,{...info,cooldownMs:0,shieldActive:false,shieldMs:0},{reduced,live}),wait+40));
}

/** Canlı maç: sunucu oyuncusundan dört kartı güncelle. Arena modunda satır gizlidir; yine de zararsız. */
export function applySkillRow(section,{player,rounds=false,now=Date.now(),reduced=false}={}){
  if(!section||!player)return;
  syncRowLayout(section,{rounds});
  applyFighterNames(section,player.fighter,{rounds});
  for(const key of rowKeysFor(rounds))paintSkillCard(section.querySelector(`[data-skill="${key}"]`),readSkillState(player,key,{rounds,now}),{reduced,live:true});
}

/** Maç dışı yerel önizleme: yazılan doğru kelime zinciri ölçeri doldurur. */
export function applySkillPreview(section,{chain=0,reduced=false}={}){
  if(!section)return;
  syncRowLayout(section,{rounds:false});
  for(const key of SKILL_ORDER){
    // Maç yok: Q/E/R yerel yazma testinin zinciriyle (klasik çevrim) dolar; S hiçbir zaman "Hazır" görünmez (idle).
    const c=key==='S'?{energy:0,threshold:0,used:false}:skillCharge(key,chain,{rounds:false});
    paintSkillCard(section.querySelector(`[data-skill="${key}"]`),{key,...c,cooldownMs:0,shieldActive:false,shieldMs:0,casts:0,idle:key==='S'},{reduced,live:false});
  }
}

/** Paket 32: karakterin beceri adlarını kartlara yazar (yalnız metin; değişmediyse DOM'a dokunmaz).
 * Bilinmeyen/eksik karakterde arketipin genel adları (SKILL_INFO) kalır. */
export function fighterSkillLabels(fighterId){
  if(!isFighterId(fighterId))return null;
  const f=FIGHTERS[fighterId];
  return Object.fromEntries(['Q','W','E','S','R'].map(key=>{const sk=f.skills[key.toLowerCase()];return [key,{name:sk.name,effect:sk.short||sk.desc}];}));
}
export function applyFighterNames(section,fighterId,{rounds=false}={}){
  const tag=(fighterId||'')+(rounds?'|r':'');
  if(!section||section.dataset?.skFighter===tag)return;
  const all=fighterSkillLabels(fighterId);
  if(!all){
    // Karakter bilinmiyor: rounds E kartı yine savunma (can) adını göstersin, klasik E vuruş adını.
    const card=section.querySelector('[data-skill="E"]');const kind=card?.dataset?.skKind;const info=SKILL_INFO[kind]?.[rounds?'H':'E'];
    if(card&&info){const strong=card.querySelector('.sk-copy strong'),fx=card.querySelector('.sk-fx'),icon=card.querySelector('.sk-icon');
      if(strong&&strong.textContent!==info.name)strong.textContent=info.name;if(fx&&fx.textContent!==info.effect)fx.textContent=info.effect;if(icon&&icon.innerHTML!==info.icon)icon.innerHTML=info.icon;}
    return;
  }
  if(section.dataset)section.dataset.skFighter=tag;
  const eCard=section.querySelector('[data-skill="E"]');const eIcon=eCard?.querySelector('.sk-icon');const eInfo=SKILL_INFO[eCard?.dataset?.skKind];
  // Rounds E = savunma: karaktere göre kalkan (S simgesi) YA can (H simgesi); klasik E = yakın vuruş simgesi.
  if(eIcon&&eInfo){const icon=(rounds?eInfo[fighterDefense(fighterId)==='shield'?'S':'H']:eInfo.E).icon;if(eIcon.innerHTML!==icon)eIcon.innerHTML=icon;}
  // Eski kart satırı motor anahtarıyla: klasik E kartı = W (yakın vuruş) adı, rounds E kartı = E (can) adı.
  const keys=rowKeysFor(rounds);
  const labels=Object.fromEntries(keys.map(key=>[key,all[SKILL_FIELD[engineKeyOf(key,rounds)].toUpperCase()]]));
  for(const key of keys){
    const card=section.querySelector(`[data-skill="${key}"]`);if(!card)continue;
    const strong=card.querySelector('.sk-copy strong'),fx=card.querySelector('.sk-fx'),badge=card.querySelector('.sk-key');
    // Klasikte E kartı yakın vuruşu (W) gösterir: rozet de W olsun (önceden "E Kasırga" yazıyordu; E = savunma rounds'ta).
    const shown=key==='E'&&!rounds?'W':key;
    if(badge&&badge.textContent!==shown)badge.textContent=shown;
    if(strong&&strong.textContent!==labels[key].name)strong.textContent=labels[key].name;
    if(fx&&fx.textContent!==labels[key].effect)fx.textContent=labels[key].effect;
  }
}
