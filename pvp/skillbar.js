/**
 * Yetenek çubuğu (Q / E / S / R) — pasif HUD göstergesi.
 * Oyuncu tıklamaz: doğru kelimeler ölçeri doldurur, eşikte yetenek sunucuda kendiliğinden çıkar.
 * Bu modül yalnız görünümü üretir/günceller; hiçbir maç verisini değiştirmez.
 * Hareket: yalnız transform/opacity, tek seferlik (WAAPI); sonsuz animasyon yok.
 */
export const SKILL_ORDER=Object.freeze(['Q','E','S','R']);
export const SKILL_THRESHOLDS=Object.freeze({
  classic:Object.freeze({Q:2,E:4,S:0,R:5}),
  rounds:Object.freeze({Q:3,E:5,S:0,R:7})
});

const svg=body=>`<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const SKILL_INFO=Object.freeze({
  fire:Object.freeze({
    Q:{name:'Alev Kesişi',effect:'Hızlı alev kesiği',icon:svg('<path d="M5 19C10 15.5 14 10.5 18 4"/><path d="M9.5 20.5c4-2.6 7.2-6 9.5-10.5"/><path d="M4 13.5c2.5-1.2 4.6-3 6.2-5.5"/>')},
    E:{name:'Yer Yaran Darbe',effect:'Ağır darbe, yeri yarar',icon:svg('<path d="M12 3v8"/><path d="M8.5 7.5 12 11l3.5-3.5"/><path d="M3 16h5.5l1.6 2.4 1.9-3 1.9 3 1.6-2.4H21"/><path d="M12 15.4V21"/>')},
    S:{name:'Kor Kalkanı',effect:'Eş kelimede %30 blok',icon:svg('<path d="M12 3 19 6v5c0 4.8-3.2 8.3-7 10-3.8-1.7-7-5.2-7-10V6z"/><path d="M12 9.2c1.6 1.4 2.3 2.6 2.3 3.7a2.3 2.3 0 0 1-4.6 0c0-.9.5-1.6 1-2.2.2.8.6 1.1 1.3 1.1z"/>')},
    R:{name:'Kızıl Fırtına',effect:'Üç vuruşlu final',icon:svg('<path d="M12 12a1.6 1.6 0 1 1 1.6-1.6 3.6 3.6 0 1 1-3.6-3.6 5.8 5.8 0 1 1-5.8 5.8"/><path d="M20 4.5 17.6 7"/><path d="M21 9h-2.4"/>')}
  }),
  rune:Object.freeze({
    Q:{name:'Rün Kesişi',effect:'Hızlı rün kesiği',icon:svg('<path d="M12 3.5 17.5 12 12 20.5 6.5 12z"/><path d="M4 19.5 20 4.5"/>')},
    E:{name:'Sarsıcı Darbe',effect:'Ağır darbe, sarsar',icon:svg('<circle cx="12" cy="12" r="2"/><path d="M8 8a5.7 5.7 0 0 0 0 8"/><path d="M16 8a5.7 5.7 0 0 1 0 8"/><path d="M5 5a9.9 9.9 0 0 0 0 14"/><path d="M19 5a9.9 9.9 0 0 1 0 14"/>')},
    S:{name:'Mavi Mühür',effect:'Eş kelimede %30 blok',icon:svg('<path d="M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9z"/><path d="M12 8.2v7.6"/><path d="M9.2 10.6 12 8.2l2.8 2.4"/>')},
    R:{name:'Sonsuz Mühür',effect:'Üç vuruşlu mühür',icon:svg('<path d="M12 12c-1.9-2.6-3.5-3.8-5.3-3.8a3.8 3.8 0 0 0 0 7.6c1.8 0 3.4-1.2 5.3-3.8s3.5-3.8 5.3-3.8a3.8 3.8 0 0 1 0 7.6c-1.8 0-3.4-1.2-5.3-3.8z"/>')}
  })
});

const escapeHTML=value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

function ariaFor(key,name,threshold){
  const how=threshold?`${threshold} doğru kelimede kendiliğinden çıkar`:'rakiple aynı anda doğru kelimede kendiliğinden devreye girer';
  return `${key} ${name}: ${how}`;
}

/** Kart işaretlemesi. İlk <small> durum satırıdır (network.js eski metni buraya yazar; gizli tutulur). */
export function skillCardHTML(kind,key,label,threshold){
  const info=SKILL_INFO[kind]?.[key]||{name:label,effect:'',icon:''};
  const name=label||info.name;
  const state=threshold?'charging':'ready';
  const fill=threshold?0:1;
  return `<button type="button" class="pvp2-skill pvp2-skill-${key.toLowerCase()} sk-card" data-skill="${key}" data-demo-action="${key.toLowerCase()}" data-target="${kind}" data-sk-kind="${kind}" data-sk-state="${state}" style="--sk-fill:${fill};--sk-seg:${threshold||1}" aria-pressed="false" aria-label="${escapeHTML(ariaFor(key,name,threshold))}">`
    +`<span class="pvp2-skill-key sk-key" aria-hidden="true">${key}</span>`
    +`<span class="sk-icon" aria-hidden="true">${info.icon}</span>`
    +`<span class="pvp2-skill-copy sk-copy"><strong>${escapeHTML(name)}</strong><small class="sk-legacy" aria-hidden="true"></small><span class="sk-fx">${escapeHTML(info.effect)}</span></span>`
    +`<span class="sk-foot" aria-hidden="true"><span class="sk-meter"><span class="sk-fill"></span><span class="sk-cd"></span></span>`
    +`<span class="sk-status">${escapeHTML(skillStatusText({key,energy:0,threshold,cooldownMs:0,shieldActive:false}))}</span></span>`
    +`<span class="sk-glow" aria-hidden="true"></span><span class="sk-burst" aria-hidden="true"></span>`
    +`</button>`;
}

/** Sunucu oyuncu görüntüsünden tek yeteneğin ham durumu. */
export function readSkillState(player,key,{rounds=false,now=Date.now()}={}){
  const k=key.toLowerCase();
  const threshold=(rounds?SKILL_THRESHOLDS.rounds:SKILL_THRESHOLDS.classic)[key]??0;
  const energy=key==='S'?0:rounds
    ?Math.min(threshold,Math.max(0,Number(player?.streak??player?.combo)||0))
    :Math.min(threshold,Math.max(0,Number(player?.skillCharge?.[k])||0));
  const cooldownMs=Math.max(0,(Number(player?.cooldownUntil?.[k])||0)-now);
  const shieldActive=key==='S'&&Boolean(player?.shieldUntil&&player.shieldUntil>now);
  const shieldMs=shieldActive?player.shieldUntil-now:0;
  const casts=key==='S'?(Number(player?.shieldUntil)||0):(Number(player?.combatStats?.casts?.[k])||0);
  return {key,energy,threshold,cooldownMs,shieldActive,shieldMs,casts};
}

/** Görsel durum: charging | ready | cooldown | active. fill 0..1. */
export function skillMeter({key,energy,threshold,cooldownMs,shieldActive}){
  if(key==='S'){
    if(shieldActive)return {state:'active',fill:1};
    if(cooldownMs>0)return {state:'cooldown',fill:0};
    return {state:'ready',fill:1};
  }
  const fill=threshold?Math.min(1,energy/threshold):0;
  if(cooldownMs>0)return {state:'cooldown',fill};
  return {state:fill>=1?'ready':'charging',fill};
}

export function skillStatusText({key,energy,threshold,cooldownMs,shieldActive}){
  if(key==='S')return shieldActive?'Kalkan açık':cooldownMs>0?'Doluyor':'Hazır';
  if(cooldownMs>0)return `Bekle ${Math.ceil(cooldownMs/1000)} sn`;
  if(energy>=threshold)return 'Hazır';
  return `${energy}/${threshold} kelime`;
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
    if(prev==='charging'&&state==='ready')flash(el,'ready',reduced);
  }
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
  for(const key of SKILL_ORDER)paintSkillCard(section.querySelector(`[data-skill="${key}"]`),readSkillState(player,key,{rounds,now}),{reduced,live:true});
}

/** Maç dışı yerel önizleme: yazılan doğru kelime zinciri ölçeri doldurur. */
export function applySkillPreview(section,{chain=0,reduced=false}={}){
  if(!section)return;
  const t=SKILL_THRESHOLDS.classic;
  for(const key of SKILL_ORDER){
    const threshold=t[key];
    paintSkillCard(section.querySelector(`[data-skill="${key}"]`),{key,energy:Math.min(threshold,chain),threshold,cooldownMs:0,shieldActive:false,shieldMs:0,casts:0},{reduced,live:false});
  }
}
