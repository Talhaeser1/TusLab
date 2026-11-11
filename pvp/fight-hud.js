// TuşLab Ruh Düellosu — dövüş HUD'u (paket 29).
// Özgün TuşLab neon tasarımı: ateş (oyuncu 1, sol, turuncu/kırmızı) · rün (oyuncu 2, sağ, mavi).
//
//   const hud = createFightHud({root, isReduced, scheduler, getArenaApi});
//   hud.matchStart({players:[{seat,name,character}], mode})  -> maç başı girişi (RAUND 1 → SAVAŞ!)
//   hud.update(match, myId)                                  -> süper bar, destek barı (paket 31), raund yazısı, isimler
//   hud.handle(combatEvent)                                  -> kombo sayacı + anons yazıları
//   hud.matchEnd({winnerSeat, reason})                       -> NAKAVT! + ZAFER / YENİLGİ
//   hud.clear() / hud.destroy()
//
// Yalnız görseldir: oyun durumuna dokunmaz, tıklama/yazmayı engellemez (pointer-events:none),
// yazma kutusunun üstüne çıkmaz (katman yalnız arena alanını kaplar), tüm metin textContent ile yazılır.

import {FIGHTERS,isFighterId,getFighter} from './shared/fighters.js';

export const HUD_TIMES = Object.freeze({
  round: 500, fight: 550, // giriş toplamı 1050 ms (≤ 2200); VS ekranı kaldırıldı
  call: 700, final: 850, reducedCall: 520, reducedIntro: 700,
  comboWindow: 1400, comboOut: 180, startDelay: 60, busyMax: 1600, busyPoll: 100,
  superFlash: 900, freeze: 450, slowRate: 0.25, slowMs: 900, sweep: 1800,
});
export const MAX_PENDING_CALLS = 2;
export const CALLS = Object.freeze({
  crit: 'KRİTİK!', parry: 'PARRY!', counter: 'KONTRA!', shieldBreak: 'KALKAN KIRIK!',
  ultimate: 'ULTİ!', assist: 'DESTEK!', knockout: 'NAKAVT!', victory: 'ZAFER', defeat: 'YENİLGİ', draw: 'BERABERE', fight: 'SAVAŞ!',
});
/** Paket 32: karakterin R (ulti) adı anons metni olarak; bilinmeyen karakterde genel 'ULTİ!'. */
export function ultimateCall(fighterId) {
  return isFighterId(fighterId) ? `${FIGHTERS[fighterId].skills.r.name.toLocaleUpperCase('tr-TR')}!` : CALLS.ultimate;
}
const PRIORITY = new Set([CALLS.knockout, CALLS.victory, CALLS.defeat, CALLS.draw]);

const seatOf = v => (v === 1 || v === 2 ? v : null);
const sideOf = seat => (seat === 2 ? 'rune' : 'fire');

/** Süper bar doluluğu 0..1; gösterilmeyecekse null (saf; test edilir). */
export function superValue(match, player) {
  if (!match || !player) return null;
  const mode = match.mode === 'arena' ? 'arena' : match.mode === 'rounds' ? 'rounds' : 'classic';
  if (mode === 'arena') return null; // arenada R/süper yok: gizli
  if (mode === 'rounds') {
    const streak = Number(player.streak ?? player.combo);
    return Number.isFinite(streak) ? Math.max(0, Math.min(1, streak / 7)) : null;
  }
  const r = Number(player.skillCharge?.r);
  return Number.isFinite(r) ? Math.max(0, Math.min(1, r / 5)) : null;
}

/** Paket 31 — destek barı: {value 0..1, ready, partner} ya da gösterilmeyecekse null (saf; test edilir). */
export function assistValue(match, player) {
  if (!match || !player || match.assistEnabled !== true || match.mode === 'arena') return null;
  const a = player.assist;
  const meter = Number(a?.meter);
  if (!a || !Number.isFinite(meter)) return null;
  const value = Math.max(0, Math.min(1, meter / 100));
  const partner = a.partner === 'fire' || a.partner === 'rune' ? a.partner : player.character === 'fire' ? 'rune' : 'fire';
  return {value, ready: a.ready === true || value >= 1, partner};
}

/** Bu combat olayı hangi anonsu doğurur? {text, seat} ya da null (saf; test edilir). */
export function callFor(event, fighterOf = () => null) {
  if (!event || typeof event !== 'object') return null;
  switch (event.type) {
    case 'DAMAGE_APPLIED': {
      if (event.blocked || !(Number(event.amount) > 0)) return null;
      const tags = Array.isArray(event.bonusTags) ? event.bonusTags : [];
      const crit = event.arena ? (Array.isArray(event.tags) && event.tags.includes('FİNAL')) : tags.length > 0;
      return crit ? {text: CALLS.crit, seat: seatOf(event.fromSeat)} : null;
    }
    case 'PARRY_TRIGGERED': return {text: CALLS.parry, seat: seatOf(event.seat)};
    case 'COUNTERATTACK_CAST': return {text: CALLS.counter, seat: seatOf(event.fromSeat)};
    case 'SHIELD_BROKEN': return {text: CALLS.shieldBreak, seat: seatOf(event.seat === 1 ? 2 : event.seat === 2 ? 1 : null)};
    case 'SKILL_CAST': return event.skill === 'r' && !event.arena ? {text: ultimateCall(fighterOf(seatOf(event.fromSeat))), seat: seatOf(event.fromSeat)} : null;
    case 'ASSIST_CAST': return {text: CALLS.assist, seat: seatOf(event.fromSeat)};
    case 'KNOCKOUT': return {text: CALLS.knockout, seat: null};
    default: return null;
  }
}

export function createFightHud({root, isReduced = () => false, scheduler = globalThis, getArenaApi = () => null} = {}) {
  const doc = root?.ownerDocument || globalThis.document || null;
  const noop = () => {};
  if (!root || !doc?.createElement) return {handle: noop, matchStart: noop, update: noop, matchEnd: noop, clear: noop, destroy: noop};

  let destroyed = false;
  const timers = new Set();
  const later = (fn, ms) => {
    const id = scheduler.setTimeout(() => { timers.delete(id); if (!destroyed) fn(); }, ms);
    timers.add(id); return id;
  };
  const cancel = id => { if (id != null) { scheduler.clearTimeout(id); timers.delete(id); } };
  const reduced = () => {
    if (root.classList?.contains?.('pvp4-reduced')) return true;
    try { if (doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return true; } catch {}
    try { return Boolean(isReduced()); } catch { return false; }
  };
  const api = () => { try { return getArenaApi?.() || null; } catch { return null; } };
  const callApi = (name, ...args) => { if (reduced()) return; const a = api(); if (a && typeof a[name] === 'function') { try { a[name](...args); } catch { /* yalnız süs */ } } };
  const el = (tag, cls, text) => { const n = doc.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = String(text); return n; };

  root.classList?.add('fhud-on'); // fight-hud.css: fx-damage'ın küçük "KOMBO xN" sayacını gizler (tek sayaç)

  const stageOf = seat => root.querySelector?.(`.pvp2-side[data-seat="${seat}"] .pvp2-stage`)
    || root.querySelector?.(`.pvp2-side[data-player="${sideOf(seat)}"] .pvp2-stage`) || null;

  // Merkez katmanı yalnız arena (düello) alanını kaplar; yazma kutusu açık kalır.
  function centerBox() {
    const vw = globalThis.innerWidth || 1280, vh = globalThis.innerHeight || 720;
    const duel = root.querySelector?.('.pvp2-duel')?.getBoundingClientRect?.();
    const type = root.querySelector?.('.tt-type, [data-input]')?.getBoundingClientRect?.();
    if (duel && duel.height >= 120 && duel.width >= 200) {
      // Yazma kutusu görünüyorsa katman onun altından başlar (asla üstüne binmez).
      const typeBottom = type && type.height > 0 && type.bottom > duel.top ? type.bottom + 8 : duel.top;
      const top = Math.max(duel.top, typeBottom), bottom = Math.min(duel.bottom ?? duel.top + duel.height, vh);
      if (bottom - top >= 120) return {top, left: duel.left, width: duel.width, height: bottom - top};
    }
    const top = type && type.bottom > 0 ? Math.min(vh - 120, type.bottom + 8) : vh * 0.3;
    return {top, left: 0, width: vw, height: Math.max(120, vh - top)};
  }
  function makeLayer(kind) {
    const layer = el('div', `fhud-layer fhud-${kind}${reduced() ? ' fhud-reduced' : ''}`);
    layer.setAttribute?.('aria-hidden', 'true');
    const box = centerBox();
    for (const k of ['top', 'left', 'width', 'height']) layer.style?.setProperty?.(k, `${Math.round(box[k])}px`);
    root.appendChild(layer);
    return layer;
  }

  // ---- Durum -------------------------------------------------------------
  const players = new Map(); // seat -> {name, character}
  let mySeat = null, mode = 'classic', lastRound = null, introRound = null, lastPhase = null, introWaitsForRound = false;
  function fighterAccent(node, seat) {
    if (!seat) return;
    const p = players.get(seat) || {};
    const color = getFighter(p.fighter, p.character || sideOf(seat)).palette.accent;
    for (const key of ['--fhud-accent', '--fhud-glow', '--fhud-hot']) node.style?.setProperty?.(key, color);
  }
  const bands = tone => reduced() ? [] : [el('i', `fhud-band fhud-band-top fhud-tone-${tone}`), el('i', `fhud-band fhud-band-bottom fhud-tone-${tone}`)];

  // ---- Anonslar (aynı anda tek; en fazla 2 bekleyen) ---------------------
  let call = null; // {el, timer, text}
  const queue = [];
  function enqueueCall(text, seat = null, {ms = null, priority = PRIORITY.has(text), sub = null} = {}) {
    if (destroyed || !text) return false;
    if (call?.text === text && !priority) return false; // aynı yazı üst üste gelmesin
    if (queue.some(q => q.text === text)) return false;
    const item = {text, seat, ms, priority, sub};
    if (!call && !intro) { showCall(item); return true; }
    if (queue.length >= MAX_PENDING_CALLS) {
      if (!priority) return false;
      const idx = queue.findIndex(q => !q.priority);
      if (idx < 0) return false;
      queue.splice(idx, 1);
    }
    queue.push(item);
    return true;
  }
  // Maç sonucu gibi bir pencere açılınca anons hemen çekilir: pencerenin üstüne binmeyiz.
  const modalOpen = () => {
    const m = root.querySelector?.('.pvp15-backdrop:not([hidden]), [aria-modal="true"]:not([hidden])');
    return Boolean(m && (typeof m.getClientRects !== 'function' || m.getClientRects().length));
  };
  function finishCall() {
    if (!call) return;
    cancel(call.timer); cancel(call.watch);
    call.el.remove?.(); call = null;
    if (modalOpen()) { queue.length = 0; return; }
    const next = queue.shift();
    if (next) showCall(next);
  }
  function showCall({text, seat, ms, sub = null}) {
    if (modalOpen()) { queue.length = 0; return; }
    const red = reduced();
    const tone = text === CALLS.victory ? 'win' : text === CALLS.defeat ? 'lose' : text === CALLS.knockout ? 'ko'
      : seat ? sideOf(seat) : 'neutral';
    const layer = makeLayer('call');
    const word = el('strong', `fhud-call-text fhud-tone-${tone}`, text);
    fighterAccent(layer, seat); fighterAccent(word, seat);
    for (const band of bands(tone)) { fighterAccent(band, seat); layer.append(band); }
    if (sub) {
      const stack = el('div', 'fhud-call-stack');
      stack.append(word, el('span', `fhud-call-sub fhud-tone-${sub === CALLS.victory ? 'win' : sub === CALLS.defeat ? 'lose' : 'neutral'}`, sub));
      layer.append(stack);
    } else layer.append(word);
    const dur = red ? HUD_TIMES.reducedCall : Math.min(900, ms ?? HUD_TIMES.call);
    layer.style?.setProperty?.('--fhud-dur', `${dur}ms`);
    call = {el: layer, text, timer: null, watch: null};
    call.timer = later(finishCall, dur);
    const watch = () => { if (!call || call.el !== layer) return; if (modalOpen()) finishCall(); else call.watch = later(watch, 100); };
    call.watch = later(watch, 100);
  }
  function dropCalls() {
    queue.length = 0;
    if (call) { cancel(call.timer); cancel(call.watch); call.el.remove?.(); call = null; }
  }

  // ---- Giriş (RAUND 1 → SAVAŞ!) ------------------------------------------
  let intro = null; // {el, timers:[]}
  // Başka modüllerin girişleri: cinematic.js (VS / raund bandı), rounds-ui.js (geri sayım, "RAUND n · BAŞLA!").
  const bannerBusy = () => Boolean(root.querySelector?.('.cin.cin-banner:not([hidden])')
    || root.querySelector?.('.rui-intro:not([hidden])') || root.querySelector?.('.rui-flash:not([hidden])'));
  const busy = () => Boolean(call || root.classList?.contains?.('cin-playing') || bannerBusy());
  function stopIntro(drain = true) {
    if (!intro) return;
    for (const t of intro.timers) cancel(t);
    intro.el?.remove?.();
    intro = null;
    if (drain && !call && queue.length) showCall(queue.shift());
  }
  function introStep(layer, kind, nodes) {
    layer.replaceChildren?.(...bands('neutral'), ...nodes);
    layer.className = `fhud-layer fhud-intro fhud-step-${kind}${reduced() ? ' fhud-reduced' : ''}`;
  }
  function playIntro(round = 1, {withRound = true, sweep = false} = {}) {
    stopIntro(false);
    const layer = makeLayer('intro');
    intro = {el: layer, timers: []};
    const at = (fn, ms) => intro.timers.push(later(fn, ms));
    const roundText = `RAUND ${round}`;
    if (reduced()) {
      introStep(layer, 'fight', [el('strong', 'fhud-intro-word', `${roundText} · ${CALLS.fight}`)]);
      at(stopIntro, HUD_TIMES.reducedIntro);
      return;
    }
    // Kamera süpürmesi yalnız giriş hemen başlarken çağrılır (VS beklemesi yok).
    if (sweep) callApi('introSweep', HUD_TIMES.sweep);
    const step = (fn, ms) => { if (ms === 0) fn(); else at(fn, ms); };
    let t = 0;
    if (withRound) {
      step(() => introStep(layer, 'round', [el('strong', 'fhud-intro-word', roundText)]), t);
      t += HUD_TIMES.round;
    }
    step(() => introStep(layer, 'fight', [el('strong', 'fhud-intro-word fhud-intro-fight', CALLS.fight)]), t);
    t += HUD_TIMES.fight;
    at(stopIntro, t);
  }
  // Başka bir sinematik (VS / raund bandı) oynuyorsa üst üste binmeyiz: bitmesini bekler, yalnız kısa kısmı oynarız.
  function startIntro(round) {
    let waited = 0, sawBanner = false;
    const tryStart = () => {
      if (destroyed) return;
      // Arena: maç hazırlık (skill/eşya seçimi) evresinde başlar; giriş ilk yazma raundunu bekler.
      if (mode === 'arena' && lastPhase && lastPhase !== 'round') { introWaitsForRound = true; return; }
      if (!busy()) {
        // Başka modül raund yazısını zaten gösterdiyse "RAUND N" tekrarlanmaz, yalnız SAVAŞ! gelir.
        playIntro(round, {withRound: !sawBanner, sweep: waited === 0});
        return;
      }
      if (bannerBusy()) sawBanner = true;
      if (waited >= HUD_TIMES.busyMax) return; // hâlâ dolu: giriş atlanır
      waited += HUD_TIMES.busyPoll;
      pendingIntro = later(tryStart, HUD_TIMES.busyPoll);
    };
    pendingIntro = later(tryStart, HUD_TIMES.startDelay);
  }
  let pendingIntro = null;

  // ---- Kombo sayacı -------------------------------------------------------
  const combos = new Map(); // attacker seat -> {count, total, el, timer, flip}
  function hideCombo(seat, fade = true) {
    const c = combos.get(seat);
    if (!c) return;
    cancel(c.timer); combos.delete(seat);
    if (!c.el) return;
    if (fade && !reduced()) { c.el.classList?.add('fhud-out'); later(() => c.el.remove?.(), HUD_TIMES.comboOut); }
    else c.el.remove?.();
  }
  function bumpCombo(seat, amount) {
    let c = combos.get(seat);
    if (!c) { c = {count: 0, total: 0, el: null, timer: null, flip: false}; combos.set(seat, c); }
    c.count += 1; c.total += amount;
    cancel(c.timer);
    c.timer = later(() => hideCombo(seat), HUD_TIMES.comboWindow);
    if (c.count < 2) return;
    const stage = stageOf(seat);
    if (!stage) return;
    if (!c.el || c.el.parentNode !== stage) {
      c.el = el('div', '');
      c.el.setAttribute?.('aria-hidden', 'true');
      c.el.append(el('strong', 'fhud-combo-n'), el('span', 'fhud-combo-w', 'VURUŞ'), el('span', 'fhud-combo-dmg'));
      stage.appendChild(c.el);
    }
    c.flip = !c.flip;
    c.el.className = ['fhud-combo', `fhud-seat-${seat}`, `fhud-tone-${sideOf(seat)}`,
      reduced() ? 'fhud-reduced' : c.flip ? 'fhud-bump-a' : 'fhud-bump-b'].join(' ');
    const [n, , dmg] = c.el.children || [];
    if (n) n.textContent = String(c.count);
    if (dmg) dmg.textContent = `${c.total} HASAR`;
  }

  // ---- Süper bar ----------------------------------------------------------
  const supers = new Map(); // seat -> {el, fill, label, value, flashUntil, flashTimer}
  function superFor(seat) {
    let s = supers.get(seat);
    const stage = stageOf(seat);
    if (!stage) return null;
    if (s && s.el.parentNode === stage) return s;
    s?.el.remove?.();
    const box = el('div', `fhud-super fhud-seat-${seat} fhud-tone-${sideOf(seat)}`);
    box.setAttribute?.('aria-hidden', 'true');
    const label = el('span', 'fhud-super-label', 'SÜPER');
    const track = el('span', 'fhud-super-track');
    const fill = el('span', 'fhud-super-fill');
    track.append(fill); box.append(label, track);
    stage.appendChild(box);
    s = {el: box, fill, label, value: -1, flash: false, flashTimer: null};
    supers.set(seat, s);
    return s;
  }
  function paintSuper(seat, value) {
    const s = superFor(seat);
    if (!s) return;
    if (value === null) { s.el.hidden = true; s.value = null; return; }
    s.el.hidden = false;
    const shown = s.flash ? 1 : value;
    const ready = shown >= 1;
    s.fill.style?.setProperty?.('transform', `scaleX(${Math.round(shown * 1000) / 1000})`);
    s.label.textContent = ready ? 'SÜPER HAZIR' : 'SÜPER';
    s.el.classList?.toggle?.('fhud-ready', ready);
    s.el.classList?.toggle?.('fhud-reduced', reduced());
    s.value = value;
  }
  function flashSuper(seat) {
    const s = superFor(seat);
    if (!s || s.value === null) return;
    s.flash = true; cancel(s.flashTimer);
    paintSuper(seat, s.value);
    s.flashTimer = later(() => { s.flash = false; paintSuper(seat, s.value); }, HUD_TIMES.superFlash);
  }
  function hideSupers() { for (const s of supers.values()) { cancel(s.flashTimer); s.el.remove?.(); } supers.clear(); }

  // ---- Destek barı (paket 31): süper barın hemen üstünde, ince; partnerin renginde ----
  const assists = new Map(); // seat -> {el, fill, label, key}
  function assistFor(seat) {
    let s = assists.get(seat);
    const stage = stageOf(seat);
    if (!stage) return null;
    if (s && s.el.parentNode === stage) return s;
    s?.el.remove?.();
    const box = el('div', `fhud-assist fhud-seat-${seat}`);
    box.setAttribute?.('aria-hidden', 'true');
    const label = el('span', 'fhud-assist-label', 'DESTEK');
    const track = el('span', 'fhud-assist-track');
    const fill = el('span', 'fhud-assist-fill');
    track.append(fill); box.append(label, track);
    stage.appendChild(box);
    s = {el: box, fill, label, key: ''};
    assists.set(seat, s);
    return s;
  }
  function paintAssist(seat, state) {
    if (!state) { const old = assists.get(seat); if (old) { old.el.hidden = true; old.key = ''; } return; }
    const s = assistFor(seat);
    if (!s) return;
    const key = `${state.value}|${state.ready}|${state.partner}|${reduced()}`;
    if (s.key === key && !s.el.hidden) return;
    s.key = key; s.el.hidden = false;
    s.el.className = `fhud-assist fhud-seat-${seat} fhud-tone-${state.partner}${state.ready ? ' fhud-ready' : ''}${reduced() ? ' fhud-reduced' : ''}`;
    s.fill.style?.setProperty?.('transform', `scaleX(${Math.round(state.value * 1000) / 1000})`);
    s.label.textContent = state.ready ? 'DESTEK HAZIR' : 'DESTEK';
  }
  function hideAssists() { for (const s of assists.values()) s.el.remove?.(); assists.clear(); }

  // ---- Genel API ----------------------------------------------------------
  function rememberPlayers(list) {
    for (const p of Array.isArray(list) ? list : []) {
      const seat = seatOf(p?.seat);
      if (seat) players.set(seat, {name: String(p.name || `Oyuncu ${seat}`).slice(0, 40), character: p.character === 'rune' || p.character === 'fire' ? p.character : sideOf(seat), fighter: isFighterId(p.fighter) ? p.fighter : null});
    }
  }

  function handle(event) {
    if (destroyed || !event || typeof event !== 'object') return false;
    try {
      if (event.type === 'DAMAGE_APPLIED') {
        const from = seatOf(event.fromSeat), to = seatOf(event.toSeat);
        const amount = Math.max(0, Math.round(Number(event.amount) || 0));
        if (from) {
          if (event.blocked || !amount) hideCombo(from);
          else { bumpCombo(from, amount); if (to) hideCombo(to); }
        }
      } else if (event.type === 'SKILL_CAST' && event.skill === 'r' && !event.arena) {
        const seat = seatOf(event.fromSeat);
        if (seat) { callApi('superFreeze', seat, HUD_TIMES.freeze); flashSuper(seat); }
      } else if (event.type === 'KNOCKOUT') {
        callApi('slowMo', HUD_TIMES.slowRate, HUD_TIMES.slowMs);
      }
      const c = callFor(event, seat => players.get(seat)?.fighter || null);
      if (c) enqueueCall(c.text, c.seat, PRIORITY.has(c.text) ? {ms: HUD_TIMES.final} : {});
      return true;
    } catch { return false; }
  }

  function matchStart({players: list = [], mode: m = 'classic', round = 1, phase = null} = {}) {
    if (destroyed) return;
    clear();
    players.clear(); mySeat = null;
    rememberPlayers(list);
    mode = m === 'arena' || m === 'rounds' ? m : 'classic';
    lastPhase = phase || null; introWaitsForRound = false;
    introRound = Number(round) || 1;
    lastRound = introRound;
    startIntro(introRound);
  }

  function update(match, myId) {
    if (destroyed || !match) return;
    try {
      rememberPlayers(match.players);
      mode = match.mode === 'arena' || match.mode === 'rounds' ? match.mode : 'classic';
      const mine = (match.players || []).find(p => p && myId != null && p.playerId === myId);
      mySeat = seatOf(mine?.seat) ?? mySeat;
      const live = match.status === 'running' || match.status === 'paused';
      for (const seat of [1, 2]) {
        const p = (match.players || []).find(x => x?.seat === seat);
        paintSuper(seat, live && p ? superValue(match, p) : null);
        paintAssist(seat, live && p ? assistValue(match, p) : null);
      }
      // Raund modlarında her raund başında "RAUND N" (1. raund girişte gösterilir).
      if (live && (mode === 'rounds' || mode === 'arena') && match.round) {
        const idx = Number(match.round.index), phase = match.round.phase;
        lastPhase = phase || null;
        if (introWaitsForRound && phase === 'round') {
          introWaitsForRound = false; introRound = lastRound = Number.isFinite(idx) ? idx : 1;
          startIntro(introRound);
        } else if (Number.isFinite(idx) && phase === 'round' && idx !== lastRound) {
          lastRound = idx;
          // Raund olayı ile banner aynı anda gelir: kısa bekleyip, başka raund yazısı yoksa gösteririz.
          if (idx !== introRound) later(() => { if (!busy()) enqueueCall(`RAUND ${idx}`, null); }, HUD_TIMES.startDelay + 40);
        }
      }
    } catch { /* görsel katman oyunu bozmaz */ }
  }

  function matchEnd({winnerSeat = null, reason = null} = {}) {
    if (destroyed) return;
    stopIntro(false); cancel(pendingIntro); pendingIntro = null;
    dropCalls();
    for (const seat of [...combos.keys()]) hideCombo(seat, false);
    hideSupers(); hideAssists();
    const w = seatOf(winnerSeat);
    const text = !w ? CALLS.draw : mySeat ? (w === mySeat ? CALLS.victory : CALLS.defeat)
      : `${players.get(w)?.name || `OYUNCU ${w}`} KAZANDI`;
    // Sonuç penceresi ~850 ms sonra açılır: nakavtta tek kart (NAKAVT! + alt satırda ZAFER/YENİLGİ) gösterilir.
    if (reason === 'KNOCKOUT') {
      callApi('slowMo', HUD_TIMES.slowRate, HUD_TIMES.slowMs);
      enqueueCall(CALLS.knockout, null, {ms: HUD_TIMES.final, priority: true, sub: text});
    } else enqueueCall(text, w, {ms: HUD_TIMES.final, priority: true});
  }

  function clear() {
    stopIntro(false); cancel(pendingIntro); pendingIntro = null;
    dropCalls();
    for (const seat of [...combos.keys()]) hideCombo(seat, false);
    hideSupers(); hideAssists();
    lastRound = null; introRound = null; lastPhase = null; introWaitsForRound = false;
  }

  function destroy() {
    if (destroyed) return;
    clear();
    for (const id of timers) scheduler.clearTimeout(id);
    timers.clear();
    destroyed = true;
    root.classList?.remove('fhud-on');
  }

  return {handle, matchStart, update, matchEnd, clear, destroy};
}
