/** Results are server-derived; client renders presentation only. */
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=n=>Number(n||0).toLocaleString('tr-TR');
export const END_LABELS=Object.freeze({KNOCKOUT:'NAKAVT',TIME_LIMIT:'SÜRE DOLDU',DISCONNECT_FORFEIT:'BAĞLANTI HÜKMEN YENİLGİ',SURRENDER:'TESLİM OLMA',BOTH_DISCONNECTED:'MAÇ İPTALİ'});
export function resultPanelHTML(){return `<div class="pvp15-backdrop" data-pvp15-results hidden>
  <section class="pvp15-card" role="dialog" aria-modal="true" aria-label="Ruh Düellosu maç sonucu">
    <div class="pvp15-eyebrow">✧ TUŞLAB · RUH DÜELLOSU ✧</div>
    <h2 class="pvp15-title" data-pvp15-title>MAÇ SONA ERDİ</h2>
    <p class="pvp15-reason" data-pvp15-reason></p>
    <div class="pvp15-scorecards" data-pvp15-scores></div>
    <div class="pvp15-meta" data-pvp15-meta></div>
    <div class="pvp15-votes" data-pvp15-votes aria-live="polite"></div>
    <div class="pvp15-buttons"><button class="pvp15-rematch" type="button" data-pvp15-action="rematch">⚔ Rövanş İste</button><button class="pvp15-exit" type="button" data-pvp15-action="leave">Odadan Çık</button></div>
  </section>
</div>`;}
export function resultCardHTML(player,winnerSeat,mvpSeat){
  const winner=player.seat===winnerSeat;
  const d=player.defense||{};const cast=player.skillCasts||{};
  return `<article class="pvp15-player pvp15-${player.character==='rune'?'rune':'fire'} ${winner?'pvp15-winner':''}">
    <div class="pvp15-player-name"><span>${winner?'👑 ':''}${escapeHTML(player.name)}</span><small>${player.character==='rune'?'RÜN MUHAFIZI':'ALEV CELLADI'}${player.seat===mvpSeat?' · MVP':''}</small></div>
    <div class="pvp15-figures"><div><strong>${num(player.wpm)}</strong><small>WPM</small></div><div><strong>%${num(player.accuracy)}</strong><small>DOĞRULUK</small></div><div><strong>${num(player.damageDealt)}</strong><small>HASAR</small></div></div>
    <div class="pvp15-detail"><span>🔥 Q / E / R: ${num(cast.q)} / ${num(cast.e)} / ${num(cast.r)}</span><span>🛡 ${num(d.normalBlocks)} blok · ${num(d.perfectBlocks)} perfect · ${num(d.parries)} parry</span><span>⚔ ${num(d.counters)} karşı saldırı · ${num(d.shieldBreaks)} kalkan kırma</span><span>⌨ ${num(player.correctWords)} doğru / ${num(player.wrongWords)} yanlış · ${num(player.maxCombo)} en yüksek kombo</span></div>
  </article>`;
}
export function renderResult(root,match,network){
  const overlay=root.querySelector('[data-pvp15-results]');if(!overlay)return;
  const result=match?.result;if(match?.status!=='ended'||!result){overlay.hidden=true;return;}
  overlay.hidden=false;
  const isCancelled=result.endReason==='BOTH_DISCONNECTED';
  const title=overlay.querySelector('[data-pvp15-title]');
  const myWon=result.winnerSeat!==null&&result.players.find(p=>p.seat===result.winnerSeat)?.playerId===network.myId;
  const text=isCancelled?'MAÇ İPTAL':result.winnerSeat===null?'BERABERE':myWon?'ZAFER!':'YENİLGİ';
  title.textContent=text;title.dataset.outcome=isCancelled?'cancelled':result.winnerSeat===null?'draw':myWon?'victory':'defeat';
  overlay.querySelector('[data-pvp15-reason]').textContent=END_LABELS[result.endReason]||'MAÇ SONUCU';
  overlay.querySelector('[data-pvp15-scores]').innerHTML=result.players.map(p=>resultCardHTML(p,result.winnerSeat,result.mvpSeat)).join('');
  const duration=Math.floor(result.durationMs/1000);overlay.querySelector('[data-pvp15-meta]').textContent=`Savaş süresi ${Math.floor(duration/60)}:${String(duration%60).padStart(2,'0')} · İki oyuncunun sunucuda doğrulanmış sonuçları`;
  const votes=network.rematchVotes||[],mine=votes.includes(network.myId);
  const button=overlay.querySelector('[data-pvp15-action="rematch"]');
  button.disabled=!network.myId||network.phase==='rematch_countdown';
  button.textContent=network.phase==='rematch_countdown'?'⏳ Rövanş hazırlanıyor…':mine?'✕ Rövanş isteğini geri çek':'⚔ Rövanş İste';
  const votesText=overlay.querySelector('[data-pvp15-votes]');
  votesText.textContent=network.phase==='rematch_countdown'&&network.startAt?`RÖVANŞ: ${Math.max(0,Math.ceil((network.startAt-network.serverNow())/1000))} · Yeni maç başlıyor`:`Rövanş onayı: ${votes.length} / 2 · İki oyuncu da kabul etmeli`;
}
