// Sıralı saldırı (çözüm fazı) göstergesi — U3.
// Motor saldırıları sırayla çözer (klasik: EXCHANGE_RESOLVE, Zamana Karşı: ROUND_RESOLVE,
// arena: ARENA_ATTACK.turn). Bu modül yalnız sunucu olaylarını gösterir; hiçbir şey hesaplamaz.
//   - Çözüm başlarken: "SALDIRI SIRASI · 0/8"
//   - Her vuruşta: sıra numarası, saldıran taraf vurgusu, savunana "SİPER" etiketi
//   - Pencere / tur bitince 1,5 sn: "PENCERE 2 SONU · Sen 340 · Rakip 210"

export function resolveBannerText({turn = 0, total = 0} = {}) {
  const t = Math.max(0, Number(turn) || 0), n = Math.max(t, Number(total) || 0);
  return n > 0 ? `SALDIRI SIRASI · ${t}/${n}` : 'SALDIRI SIRASI';
}

export function resolveSummaryText({label = 'PENCERE', index = 0, mine = 0, theirs = 0} = {}) {
  const head = index ? `${label} ${index} SONU` : `${label} SONU`;
  return `${head} · Sen ${Math.round(mine)} · Rakip ${Math.round(theirs)}`;
}

/**
 * @param {{root: HTMLElement, getSeat?: () => number|null, isReduced?: () => boolean, sfx?: (name: string, gain: number) => void, scheduler?: {setTimeout:Function, clearTimeout:Function}}} opts
 */
export function attachResolveUi({root, getSeat = () => null, isReduced = () => false, sfx = null, scheduler = globalThis, quietRounds = false} = {}) {
  if (!root?.addEventListener) return {destroy() {}, state: () => null};
  // KESINYAP 22: quietRounds → rounds (ROUND_*) çözümünde "SALDIRI SIRASI" / "RAUND SONU · Sen · Rakip" hapı gösterilmez
  // (sahnede raund bandı ve can barları zaten var; kalabalık). Klasik pencere (EXCHANGE_*) aynen kalır.
  const st = {active: false, label: 'PENCERE', index: 0, total: 0, turn: 0, dmg: {1: 0, 2: 0}, hideTimer: null, idleTimer: null, quiet: false};
  let el = null;
  // Pencere ↔ çözüm geçişlerinde tek seferlik ipucu (pvp/sound.js'teki mevcut 'attack-turn').
  // Yalnız begin/finish çalar; her vuruşta değil. Ses yoksa (sfx verilmediyse) sessizce atlanır.
  const cue = () => { if (sfx) sfx('attack-turn', 0.5); };

  // Çözüm sırasında yazma paneli boştadır: etiket oraya oturur, oyuncu başlıklarını kapatmaz.
  // (Tur arası paneli açılınca yazma paneli gizlenir → etiket de gizlenir, özet iki kez görünmez.)
  // Arena odağında (stage-focus) yazma paneli katlanır: etiket o zaman arenanın üst ortasına geçer.
  const host = () => {
    const tt = root.querySelector?.('.tt-type');
    if (tt && !root.classList?.contains?.('stage-focus')) return tt;
    return root.querySelector?.('.pvp2-duel') || tt || null;
  };
  function ensure() {
    const h = host();
    if (!h) return null;
    if (!el || !el.isConnected || el.parentNode !== h) {
      // Yer değişince (arena odağı ↔ yazma paneli) eski etiket kaldırılır: iki etiket görünmesin.
      if (el?.isConnected) el.remove?.();
      el = root.ownerDocument.createElement('div');
      el.className = 'rsv-banner';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      el.hidden = true;
      h.appendChild(el);
    }
    return el;
  }
  function sides(fn) { root.querySelectorAll?.('.pvp2-side[data-seat]').forEach(fn); }
  function clearSides() { sides(s => { s.classList.remove('rsv-attacker', 'rsv-defender'); }); }
  function show(text, mode) {
    const b = ensure(); if (!b) return;
    b.textContent = text;
    b.dataset.mode = mode;
    b.classList.toggle('rsv-still', Boolean(isReduced()));
    b.hidden = false;
  }
  function hide() { if (el) el.hidden = true; clearSides(); }
  function clearTimers() {
    if (st.hideTimer !== null) { scheduler.clearTimeout(st.hideTimer); st.hideTimer = null; }
    if (st.idleTimer !== null) { scheduler.clearTimeout(st.idleTimer); st.idleTimer = null; }
  }
  function begin(label, index, total) {
    clearTimers();
    Object.assign(st, {active: true, label, index: Number(index) || 0, total: Number(total) || 0, turn: 0, dmg: {1: 0, 2: 0}});
    show(resolveBannerText(st), 'run');
    cue();
  }
  function finish() {
    if (!st.active) return;
    st.active = false;
    clearTimers(); clearSides();
    const me = getSeat() === 2 ? 2 : 1, op = me === 1 ? 2 : 1;
    show(resolveSummaryText({label: st.label, index: st.index, mine: st.dmg[op], theirs: st.dmg[me]}), 'sum');
    cue();
    st.hideTimer = scheduler.setTimeout(() => { st.hideTimer = null; hide(); }, 1500);
  }
  // Son vuruştan sonra yeni olay gelmezse özet kendiliğinden çıkar (arena gibi başlangıç olayı olmayan akışlar için).
  function armIdle() {
    if (st.idleTimer !== null) scheduler.clearTimeout(st.idleTimer);
    st.idleTimer = scheduler.setTimeout(() => { st.idleTimer = null; finish(); }, 1600);
  }

  const onRound = event => {
    const {type, payload = {}} = event.detail || {};
    if (typeof type === 'string' && type.startsWith('EXCHANGE_')) st.quiet = false;
    else if (quietRounds && typeof type === 'string' && type.startsWith('ROUND_')) { st.quiet = true; st.active = false; clearTimers(); hide(); return; }
    if (type === 'EXCHANGE_RESOLVE') begin('PENCERE', payload.index, payload.turns);
    else if (type === 'ROUND_RESOLVE') begin('RAUND', payload.round, payload.turns);
    else if (type === 'ROUND_END') {st.active=false;clearTimers();hide();}
    else if (type === 'EXCHANGE_START' || type === 'ROUND_START') finish();
  };
  const onCombat = event => {
    const e = event.detail || {};
    // Arena'nın kendi çözüm ekranı ve özeti var (arena-ui.js); çift gösterim olmasın diye yalnız klasik/tur.
    const isTurn = e.resolve === true && Number.isInteger(e.turn);
    if (!isTurn || st.quiet) return;
    if (!st.active) begin('PENCERE', 0, 0);
    st.turn = Math.max(st.turn, e.turn);
    if (st.total < st.turn) st.total = st.turn;
    if (e.type === 'DAMAGE_APPLIED') {
      const to = e.toSeat === 2 ? 2 : 1;
      if (!e.blocked) st.dmg[to] += Math.max(0, Number(e.amount) || 0);
    }
    const from = e.fromSeat === 2 ? 2 : e.fromSeat === 1 ? 1 : null;
    if (from) sides(s => {
      const seat = Number(s.dataset.seat);
      s.classList.toggle('rsv-attacker', seat === from);
      s.classList.toggle('rsv-defender', seat !== from);
    });
    show(resolveBannerText(st), 'run');
    armIdle();
  };
  root.addEventListener('tuslab:pvp-round', onRound);
  root.addEventListener('tuslab:pvp-combat', onCombat);
  return {
    destroy() { clearTimers(); hide(); root.removeEventListener('tuslab:pvp-round', onRound); root.removeEventListener('tuslab:pvp-combat', onCombat); el?.remove?.(); el = null; },
    state: () => ({...st, dmg: {...st.dmg}})
  };
}
