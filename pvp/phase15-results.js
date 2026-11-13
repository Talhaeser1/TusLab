/** Results are server-derived; client renders presentation only. */
import {getFighter} from './shared/fighters.js';
import {portraitFor} from './portraits.js';
const BOT_ID='practice-bot';
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=n=>Number(n||0).toLocaleString('tr-TR');
export const END_LABELS=Object.freeze({KNOCKOUT:'NAKAVT',TIME_LIMIT:'SÜRE DOLDU',DISCONNECT_FORFEIT:'BAĞLANTI HÜKMEN YENİLGİ',SURRENDER:'TESLİM OLMA',BOTH_DISCONNECTED:'MAÇ İPTALİ'});
/** Sonuç sahnesinin arka planı (tam ekran, net): zafer / yenilgi / berabere-iptal. */
export const RESULT_BG=Object.freeze({victory:'./assets/higgsfield/final/sonuc-zafer.webp',defeat:'./assets/higgsfield/final/sonuc-yenilgi.webp',draw:'./assets/higgsfield/final/ekran-raund-banner.webp',cancelled:'./assets/higgsfield/final/ekran-raund-banner.webp'});
export function resultPanelHTML(){return `<div class="pvp15-backdrop pvp15-scene" data-pvp15-results hidden>
  <img class="pvp15-bgimg" data-pvp15-bg alt="" decoding="async" draggable="false">
  <section class="pvp15-card" role="dialog" aria-modal="true" aria-label="Ruh Düellosu maç sonucu">
    <div class="pvp15-eyebrow">✧ TUŞLAB · RUH DÜELLOSU ✧</div>
    <h2 class="pvp15-title" data-pvp15-title>MAÇ SONA ERDİ</h2>
    <p class="pvp15-reason" data-pvp15-reason></p>
    <div class="pvp15-scorecards" data-pvp15-scores></div>
    <ol class="pvp15-rd-strip" data-pvp15-rounds aria-label="Raund raund hasar: her sütunda sol ve sağ oyuncunun o raunddaki hasarı" hidden></ol>
    <p class="pvp15-best" data-pvp15-best hidden></p>
    <div class="pvp15-meta" data-pvp15-meta></div>
    <div class="pvp15-votes" data-pvp15-votes aria-live="polite"></div>
    <div class="pvp15-buttons"><button class="pvp15-breakdown" type="button" data-pvp15-toggle="breakdown" aria-expanded="false">Raund dökümü</button><button class="pvp15-rematch" type="button" data-pvp15-action="rematch">Rövanşa başla</button><button class="pvp15-exit" type="button" data-pvp15-action="leave">Odadan çık</button></div>
  </section>
</div>`;}
/* Kart alt başlığı: seçilen dövüşçünün özgün adı ("Vargr · Kızıl Balta"); eski kayıtlar arketipten varsayılana düşer. */
function fighterLabel(player){
  try{const f=getFighter(player.fighter,player.character);if(f)return escapeHTML(`${f.name} · ${f.title}`.toLocaleUpperCase('tr-TR'));}catch{}
  return player.character==='rune'?'RÜN MUHAFIZI':'ALEV CELLADI';
}
export function resultCardHTML(player,winnerSeat,mvpSeat){
  const winner=player.seat===winnerSeat;
  const cast=player.skillCasts||{};
  return `<article class="pvp15-player pvp15-${player.character==='rune'?'rune':'fire'} ${winner?'pvp15-winner':''}">
    <div class="pvp15-head"><img class="pvp15-portrait" src="${escapeHTML(portraitFor(player).url)}" alt="" width="768" height="1024" decoding="async" draggable="false" data-portrait="${escapeHTML(portraitFor(player).id)}" data-fallback="${escapeHTML(portraitFor(player).fallback)}">
    <div class="pvp15-player-name"><span>${escapeHTML(player.name)}</span><small>${fighterLabel(player)}${player.seat===mvpSeat?' · MVP':''}</small></div></div>
    <div class="pvp15-figures"><div><strong>${num(player.wpm)}</strong><small>WPM</small></div><div><strong>%${num(player.accuracy)}</strong><small>DOĞRULUK</small></div><div><strong>${num(player.damageDealt)}</strong><small>HASAR</small></div></div>
    <div class="pvp15-detail">${castTotal(cast)>0?(cast.h!==undefined?`<span>Q / W / E / R: ${num(cast.q)} / ${num(cast.e)} / ${num(cast.h)} / ${num(cast.r)}</span><span>Toplam iyileşme: +${num(player.healDone)}</span>`:`<span>Q / W / R: ${num(cast.q)} / ${num(cast.e)} / ${num(cast.r)}</span>`):''}<span>${num(player.correctWords)} doğru / ${num(player.wrongWords)} yanlış</span><span>En yüksek seri: ${num(player.maxCombo)}</span></div>
  </article>`;
}
const castTotal=c=>(Number(c?.q)||0)+(Number(c?.e)||0)+(Number(c?.h)||0)+(Number(c?.r)||0); // KESINYAP 21: e = W (motor), h = E (can)
/** Raund raund hasar şeridi + "en iyi an" satırı modeli (saf; test edilir). Veri yoksa null. */
export function resultHighlights(result){
  const rounds=Array.isArray(result?.rounds)?result.rounds.filter(r=>Array.isArray(r?.scores)):[];
  const players=Array.isArray(result?.players)?result.players:[];
  const nameOf=seat=>String(players.find(p=>p.seat===seat)?.name||`Oyuncu ${seat}`);
  const cols=rounds.map(r=>{const dmg=seat=>Math.max(0,Math.round(Number(r.scores.find(s=>s.seat===seat)?.damageDealt)||0));return {round:Number(r.round)||0,d1:dmg(1),d2:dmg(2),ko:r.reason==='KO'};});
  let bestHit=null;for(const c of cols)for(const [seat,d] of [[1,c.d1],[2,c.d2]])if(d>0&&(!bestHit||d>bestHit.damage))bestHit={seat,round:c.round,damage:d};
  let streak=null;for(const p of players){const s=Number(p.maxCombo)||0;if(s>0&&(!streak||s>streak.count))streak={seat:p.seat,count:s};}
  const parts=[];
  if(streak)parts.push(`En yüksek seri: ${nameOf(streak.seat)} ${streak.count}`);
  if(bestHit)parts.push(`En çok hasar: ${nameOf(bestHit.seat)} · Raund ${bestHit.round} · ${num(bestHit.damage)}`);
  return {cols,best:parts.join('  ·  ')};
}
function renderHighlights(overlay,result){
  const strip=overlay.querySelector('[data-pvp15-rounds]'),best=overlay.querySelector('[data-pvp15-best]');if(!strip||!best)return;
  const m=resultHighlights(result);
  const max=Math.max(1,...m.cols.flatMap(c=>[c.d1,c.d2]));
  strip.innerHTML=m.cols.map(c=>`<li class="pvp15-rd"><span class="pvp15-rd-bars" aria-hidden="true"><i class="s1" style="--h:${(c.d1/max).toFixed(3)}"></i><i class="s2" style="--h:${(c.d2/max).toFixed(3)}"></i></span><b>R${c.round}</b><small>${num(c.d1)} / ${num(c.d2)}${c.ko?' · KO':''}</small></li>`).join('');
  strip.hidden=!m.cols.length;
  best.textContent=m.best;best.hidden=!m.best;
}
export function renderResult(root,match,network){
  const overlay=root.querySelector('[data-pvp15-results]');if(!overlay)return;
  const result=match?.result;if(match?.status!=='ended'||!result){overlay.hidden=true;root.classList.remove('pvp15-results-open');return;}
  overlay.hidden=false;
  root.classList.add('pvp15-results-open');
  const isCancelled=result.endReason==='BOTH_DISCONNECTED';
  const title=overlay.querySelector('[data-pvp15-title]');
  const myWon=result.winnerSeat!==null&&result.players.find(p=>p.seat===result.winnerSeat)?.playerId===network.myId;
  const text=isCancelled?'MAÇ İPTAL':result.winnerSeat===null?'BERABERE':myWon?'ZAFER':'YENİLGİ';
  title.textContent=text;title.dataset.outcome=isCancelled?'cancelled':result.winnerSeat===null?'draw':myWon?'victory':'defeat';
  overlay.dataset.outcome=title.dataset.outcome;
  const bg=overlay.querySelector('[data-pvp15-bg]'),bgUrl=RESULT_BG[title.dataset.outcome]||RESULT_BG.draw;
  if(bg&&bg.getAttribute('src')!==bgUrl)bg.setAttribute('src',bgUrl);
  if(!overlay.dataset.bound){overlay.dataset.bound='1';
    overlay.addEventListener('click',e=>{const t=e.target.closest?.('[data-pvp15-toggle="breakdown"]');if(!t)return;const on=!overlay.classList.contains('is-breakdown');overlay.classList.toggle('is-breakdown',on);t.setAttribute('aria-expanded',String(on));});
    overlay.addEventListener('keydown',e=>{if(e.key==='Escape'&&overlay.classList.contains('is-breakdown')){e.preventDefault();e.stopPropagation();overlay.classList.remove('is-breakdown');overlay.querySelector('[data-pvp15-toggle]')?.setAttribute('aria-expanded','false');}});
  }
  overlay.querySelector('[data-pvp15-reason]').textContent=END_LABELS[result.endReason]||'MAÇ SONUCU';
  overlay.querySelector('[data-pvp15-scores]').innerHTML=result.players.map(p=>resultCardHTML(p,result.winnerSeat,result.mvpSeat)).join('');
  for(const img of overlay.querySelectorAll('.pvp15-portrait'))img.addEventListener('error',()=>{const fb=img.dataset.fallback;if(fb&&!img.src.endsWith(fb.slice(1)))img.src=fb;},{once:true});
  renderHighlights(overlay,result);
  const votes=network.rematchVotes||[],mine=votes.includes(network.myId);
  // Bot maçında "iki oyuncu/sunucu" dili yanıltıcıydı: bot hep hazırdır, sonuç bu cihazda hesaplanır.
  const vsBot=votes.includes(BOT_ID)||result.players.some(p=>p.playerId===BOT_ID);
  const duration=Math.floor(result.durationMs/1000);overlay.querySelector('[data-pvp15-meta]').textContent=`Savaş süresi ${Math.floor(duration/60)}:${String(duration%60).padStart(2,'0')} · ${vsBot?'Bot maçı · sonuçlar bu cihazda hesaplandı':'İki oyuncunun sunucuda doğrulanmış sonuçları'}`;
  const button=overlay.querySelector('[data-pvp15-action="rematch"]');
  button.disabled=!network.myId||network.phase==='rematch_countdown';
  button.textContent=network.phase==='rematch_countdown'?'Rövanş hazırlanıyor…':mine?'Rövanş isteğini geri çek':vsBot?'Rövanşa başla':'Rövanş iste';
  const votesText=overlay.querySelector('[data-pvp15-votes]');
  votesText.textContent=network.phase==='rematch_countdown'&&network.startAt?`RÖVANŞ: ${Math.max(0,Math.ceil((network.startAt-network.serverNow())/1000))} · Yeni maç başlıyor`:vsBot?'Bot rövanşa hazır · tek tıkla yeni maç başlar':`Rövanş onayı: ${votes.length} / 2 · İki oyuncu da kabul etmeli`;
}
