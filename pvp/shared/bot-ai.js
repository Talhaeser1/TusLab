/** TuşLab PvP — karakter başına küçük "fayda" (utility) bot zekâsı. Saf ES modülü: DOM/ağ/zaman yok.
 *
 * Beceriler tuşla değil seriyle kendiliğinden atılır (3 Q · 5 W · 7 E · 10 R). Botun gerçek kararları bu yüzden:
 *   1) yazma planı (her kelimede): 'push' (hızlı, daha çok hata) · 'steady' · 'careful' (yavaş, az hata → seriyi korur,
 *      E kalkanına/canına ya da R ultisine ulaşır);
 *   2) hedef beceri: 'h' (E savunma), 'r' (ulti), 'finish' (bitir) ya da null;
 *   3) raund arası süre becerisi seçimi (zaman hırsızı / donmuş an / karanlık saat ya da hiçbiri).
 * Girdi: kendi canı, rakip canı, seriler, E bu raund kullanıldı mı, rakip son raundda ne vurdu, rakip ultiye yakın mı, kalan süre.
 * Rastgelelik enjekte edilen rng'den gelir (practice maç tohumundan ayrı bir akış kurar) → testte tohumla deterministik.
 */
import {fighterBody} from './fighters.js';
export const BOT_PLANS=Object.freeze({
  push:Object.freeze({wpm:1.01,typo:1.2}),
  steady:Object.freeze({wpm:1,typo:1}),
  careful:Object.freeze({wpm:0.99,typo:0.8})
});
/** Ağırlıklar 0..1. aggro: bitirmeye/hıza eğilim · guard: rakip ultisine karşı savunma · sustain: düşük canda E ·
 * burst: R'ye ulaşmak için seriyi koruma · noise: karar gürültüsü (rastgelelik payı). */
export const BOT_PERSONAS=Object.freeze({
  vargr:Object.freeze({label:'saldırgan',aggro:1.0,guard:0.25,sustain:0.45,burst:0.55,noise:0.30}),
  sira:Object.freeze({label:'fırsatçı',aggro:0.75,guard:0.55,sustain:0.25,burst:0.70,noise:0.35}),
  doran:Object.freeze({label:'savunmacı',aggro:0.45,guard:0.6,sustain:0.50,burst:0.45,noise:0.20}),
  nyx:Object.freeze({label:'patlayıcı',aggro:0.55,guard:0.35,sustain:0.40,burst:1.0,noise:0.30}),
  konyali:Object.freeze({label:'dayanıklı',aggro:0.40,guard:0.45,sustain:1.0,burst:0.50,noise:0.25})
});
const DEFAULT_PERSONA=Object.freeze({label:'dengeli',aggro:0.5,guard:0.5,sustain:0.5,burst:0.5,noise:0.3});
export const personaOf=fighter=>BOT_PERSONAS[fighter]||BOT_PERSONAS[fighterBody(fighter)]||DEFAULT_PERSONA;
const clamp01=x=>Math.max(0,Math.min(1,Number(x)||0));

/** Motor durumundan (match.participants, iç durum) bot bağlamı. Arena dışı (classic/rounds). */
export function botContext(match,botSeat,at=0){
  const me=match?.participants?.find(p=>p.seat===botSeat),foe=match?.participants?.find(p=>p.seat!==botSeat);
  if(!me||!foe)return null;
  const rounds=match.mode==='rounds';
  const last=rounds?match.roundHistory?.at(-1):null;
  const foeLast=last?.scores?.find(s=>s.seat===foe.seat)?.damageDealt||0;
  const end=rounds?me.roundEndsAt:match.exchange?.endsAt??match.endsAt;
  const span=rounds?Math.max(1,(me.roundEndsAt||0)-(match.round?.startedAt||0)):Math.max(1,match.exchange?.duration||10000);
  return {rounds,hp:me.hp,maxHp:me.maxHp||1,foeHp:foe.hp,foeMaxHp:foe.maxHp||1,streak:me.combo||0,foeStreak:foe.combo||0,
    defense:me.fighter,defenseUsed:rounds?((me.roundHeal||0)>0||(me.shieldHp||0)>0||(me.healBank||0)>0):false,
    foeLastDamage:foeLast,timeLeft:clamp01(((end||0)-at)/span)};
}

/** Saf karar fonksiyonu: plan + hedef + puanlar. `kind` = 'shield' | 'heal' (karakterin E türü). */
export function decideBotPlan(ctx,persona=DEFAULT_PERSONA,rng=Math.random,kind='heal'){
  if(!ctx)return {plan:'steady',goal:null,scores:{}};
  const hpFrac=clamp01(ctx.hp/ctx.maxHp),foeFrac=clamp01(ctx.foeHp/ctx.foeMaxHp);
  const hurt=clamp01(ctx.foeLastDamage/(ctx.maxHp*0.25));          // rakip geçen raund sert vurdu mu
  const foeUlt=ctx.rounds&&ctx.foeStreak>=6&&ctx.foeStreak<10?1:0;   // rakip R'ye (10) yaklaşıyor
  const canDefend=ctx.rounds&&!ctx.defenseUsed&&ctx.streak<7;
  const noise=()=>(rng()-0.5)*persona.noise;
  const scores={
    // E savunma: kalkan → rakip ultisine/sert vuruşa karşı; can → düşük canda.
    h:canDefend?(kind==='shield'?persona.guard*(0.9*foeUlt+0.6*hurt)+0.3*(1-hpFrac)
                               :persona.sustain*(1.4*(1-hpFrac)+0.4*hurt)+0.2*foeUlt)+noise():-1,
    // R: seri 5–9 arasıysa seriyi koru (careful), ultiyi kaçırma.
    r:ctx.rounds&&ctx.streak>=5&&ctx.streak<10?persona.burst*(0.55+0.25*ctx.streak/10)+noise():-1,
    // Bitir: rakip düşük canda, ya da süre azalıyorsa hızlan.
    finish:persona.aggro*(1.3*(1-foeFrac)**2+0.35*(1-ctx.timeLeft))+0.15*(hpFrac-foeFrac)+noise(),
    steady:0.45+noise()
  };
  let goal='steady';
  for(const k of ['h','r','finish'])if(scores[k]>scores[goal])goal=k;
  const plan=goal==='finish'?'push':goal==='steady'?'steady':'careful';
  return {plan,goal:goal==='steady'?null:goal,scores};
}

/** Raund arası süre becerisi: null (seçmez) ya da available içinden biri. chance = zorluğa göre deneme olasılığı. */
export function pickBotTimeSkill(ctx,persona=DEFAULT_PERSONA,rng=Math.random,{available=[],chance=0.45}={}){
  if(!ctx||!available.length||rng()>=chance)return null;
  const hpFrac=clamp01(ctx.hp/ctx.maxHp),foeFrac=clamp01(ctx.foeHp/ctx.foeMaxHp);
  // Denge (RAPOR-PVP-KALANLAR §2): becerinin GÜCÜ herkes için aynı sıradadır (Zaman Hırsızı −5 sn rakip > Donmuş An +3 sn kendine
  // > Karanlık Saat — bota karşı süreyi gizlemek hiçbir şey değiştirmez). Kişilik yalnız küçük bir eğilim ekler (±0,15).
  // Önceden Nyx/Doran gibi kişilikler çoğunlukla Karanlık Saat seçip Zaman Hırsızı seçen Vargr'a %10–30 kaybediyordu.
  const tilt=w=>0.3*(clamp01(w)-0.5);
  const want={
    timethief:1.0+tilt(persona.aggro)+0.1*(hpFrac-foeFrac)+0.1*(rng()-0.5),
    freeze:0.7+tilt((persona.sustain+persona.guard)/2)+0.1*(foeFrac-hpFrac)+0.1*(rng()-0.5),
    blindclock:0.35+tilt(persona.burst)+0.1*(rng()-0.5)
  };
  return available.filter(id=>Object.hasOwn(want,id)).sort((a,b)=>want[b]-want[a])[0]??null;
}
/** Plan çarpanlarını bot yazma profiline uygular (yeni nesne; typo en çok 0,5). */
export function applyPlan(profile,plan){
  const p=BOT_PLANS[plan]||BOT_PLANS.steady;
  return {...profile,wpm:profile.wpm*p.wpm,typo:Math.min(0.5,profile.typo*p.typo)};
}
