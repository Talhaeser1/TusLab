// Görev 4 / madde 9, 10, 13, 14 — saldırı bilgi yazısı, durum rozeti ve "gösterilen can".
// Yalnız sunum: oyun durumu/sunucu olayları aynen işlenir; burada sadece EKRANDA ne zaman görüneceği seçilir.
//   • createAttackCallout: temas anında "VARGR → NYX · BALTA SAVURUŞU · −120" (tek şerit, yığılmaz).
//   • createStatusBadge: hedefin üstünde kısa durum rozeti (BLOK, KALKAN, SİPER SARSILDI).
//   • createDisplayedHp: HUD can barı, sahnenin temas karesine kadar eski değerde tutulur (kuyruk bitince eşitlenir).
import {FIGHTERS, isFighterId} from './shared/fighters.js';

export const CALLOUT = Object.freeze({showMs: 1000, ultimateMs: 1200, badgeMs: 900, hpHoldMaxMs: 3500, hpPollMs: 100});

const upper = s => String(s || '').toLocaleUpperCase('tr-TR');

/** Saf: "A → B · AD · −N" (blokta "· BLOK −N" / tamamen engellenmişse "BLOK"). */
export function calloutText({attacker, defender, skill, amount = 0, blocked = false, blockKind = ''} = {}) {
  const skillName = isFighterId(attacker) ? FIGHTERS[attacker].skills[skill]?.name || '' : '';
  const a = isFighterId(attacker) ? FIGHTERS[attacker].name : 'Rakip';
  const d = isFighterId(defender) ? FIGHTERS[defender].name : 'Rakip';
  const dmg = Math.max(0, Math.round(Number(amount) || 0));
  const tail = blocked ? (dmg > 0 ? `BLOK${blockKind === 'PARRY' ? ' · PARRY' : ''} −${dmg}` : 'BLOK') : `−${dmg}`;
  return `${upper(a)} → ${upper(d)} · ${upper(skillName || 'SALDIRI')} · ${tail}`;
}

const sideOf = seat => (seat === 2 ? 'rune' : 'fire'); // Ateş turuncu-kırmızı / Rün camgöbeği

function mount(root, doc, el) { (root.append ? root.append(el) : root.appendChild(el)); return el; }

export function createAttackCallout({root, getFighterId = () => null, isReduced = () => false, setTimer = null, clearTimer = null} = {}) {
  const doc = root?.ownerDocument || globalThis.document || null;
  if (!root || !doc?.createElement || typeof root.addEventListener !== 'function') return {destroy() {}, show() {}, el: null};
  const later = setTimer || ((fn, ms) => globalThis.setTimeout(fn, ms));
  const unlater = clearTimer || (id => globalThis.clearTimeout(id));
  const el = mount(root, doc, doc.createElement('div'));
  el.className = 'pvp-attack-callout';
  el.setAttribute('data-attack-callout', '');
  el.setAttribute('aria-hidden', 'true');
  el.hidden = true;
  const badges = new Map(); // seat → {el, timer}
  let timer = null;
  const reduced = () => { try { return Boolean(isReduced()); } catch { return false; } };

  function show(detail = {}) {
    const text = calloutText({attacker: getFighterId(detail.fromSeat), defender: getFighterId(detail.toSeat),
      skill: detail.skill, amount: detail.amount, blocked: detail.blocked, blockKind: detail.blockKind});
    if (timer != null) unlater(timer);
    const size = detail.skill === 'r' ? 'r' : detail.skill === 'e' ? 'e' : 'q';
    el.hidden = false;
    el.textContent = text; // öncekinin yerini alır (yığılmaz)
    el.className = `pvp-attack-callout pvp-attack-callout--${size} is-${sideOf(detail.fromSeat)}${detail.blocked ? ' is-blocked' : ''}`;
    el.setAttribute('data-skill', size);
    el.setAttribute('data-seat', String(detail.fromSeat));
    if (!reduced()) { el.classList.remove('is-in'); void el.offsetWidth; el.classList.add('is-in'); }
    timer = later(() => { timer = null; el.hidden = true; }, size === 'r' ? CALLOUT.ultimateMs : CALLOUT.showMs);
    if (detail.blocked) badge(detail.toSeat, detail.blockKind === 'PARRY' ? 'PARRY' : 'BLOK', 'block');
  }

  /** Hedefin sahnesinde kısa durum rozeti + renkli aura (data-status). */
  function badge(seat, text, tone = 'status', ms = CALLOUT.badgeMs) {
    const stage = root.querySelector?.(`.pvp2-side[data-seat="${seat}"] .pvp2-stage`);
    if (!stage || !doc.createElement) return null;
    const old = badges.get(seat);
    if (old) { unlater(old.timer); old.el.remove?.(); }
    const b = doc.createElement('span');
    b.className = `pvp-status-badge is-${tone}`;
    b.setAttribute('data-status-badge', tone);
    b.setAttribute('aria-hidden', 'true');
    b.textContent = text;
    (stage.append ? stage.append(b) : stage.appendChild?.(b));
    stage.setAttribute?.('data-status', tone);
    const t = later(() => { b.remove?.(); stage.removeAttribute?.('data-status'); badges.delete(seat); }, ms);
    badges.set(seat, {el: b, timer: t});
    return b;
  }

  const onImpact = e => show(e.detail || {});
  const onStatus = e => badge(e.detail?.seat, e.detail?.text || '', e.detail?.tone || 'status', e.detail?.ms);
  root.addEventListener('tuslab:pvp-impact', onImpact);
  root.addEventListener('tuslab:pvp-status', onStatus);
  return {
    el, show, badge,
    destroy() {
      if (timer != null) unlater(timer);
      for (const b of badges.values()) { unlater(b.timer); b.el.remove?.(); }
      badges.clear();
      root.removeEventListener?.('tuslab:pvp-impact', onImpact);
      root.removeEventListener?.('tuslab:pvp-status', onStatus);
      el.remove?.();
    },
  };
}

/**
 * Saf model: gösterilen can. Gerçek can düşse bile temas karesine kadar eski değer görünür;
 * impact(seat, hpAfter) gösterileni indirir; kuyruk boşalınca release() gerçeğe eşitler (sapma kalmaz).
 */
export function createDisplayedHpModel() {
  const shown = new Map();
  const real = new Map();
  const guards = new Set(); // hasar olayı geldi, ama maç durumu henüz kuyruğa girmemiş olabilir
  return {
    /** Hasar olayı (DAMAGE_APPLIED) görüldü: bu koltuğun düşüşü temasa kadar tutulur. */
    expect(seat) { if (seat === 1 || seat === 2) guards.add(seat); },
    /** Maç durumu geldi. busy: görsel kuyruk meşgul mü. Dönen: seat → gösterilecek HP. */
    sync(players, busy) {
      for (const p of players || []) {
        const hp = Number(p?.hp);
        if (!(p?.seat === 1 || p?.seat === 2) || !Number.isFinite(hp)) continue;
        real.set(p.seat, hp);
        const cur = shown.get(p.seat);
        if ((!busy && !guards.has(p.seat)) || cur === undefined || hp >= cur) shown.set(p.seat, hp); // iyileşme/idle: anında
      }
      return this.values();
    },
    impact(seat, hpAfter) {
      const r = real.get(seat);
      if (r === undefined || !Number.isFinite(Number(hpAfter))) return this.values();
      const cur = shown.get(seat) ?? r;
      shown.set(seat, Math.max(r, Math.min(cur, Number(hpAfter))));
      return this.values();
    },
    release() { guards.clear(); for (const [seat, hp] of real) shown.set(seat, hp); return this.values(); },
    held() { for (const [seat, hp] of real) if (shown.get(seat) !== hp) return true; return false; },
    values() { return Object.fromEntries(shown); },
  };
}

/** DOM uygulayıcı: network.js'in yazdığı can çubuğunu (okuyup) gösterilen değerle geçersiz kılar. */
export function createDisplayedHp({root, getPlayers = () => [], isBusy = () => false, setTimer = null, clearTimer = null, now = () => Date.now()} = {}) {
  if (!root || typeof root.addEventListener !== 'function') return {destroy() {}, impact() {}, model: null};
  const later = setTimer || ((fn, ms) => globalThis.setInterval(fn, ms));
  const unlater = clearTimer || (id => globalThis.clearInterval(id));
  const model = createDisplayedHpModel();
  let poll = null, heldSince = 0;

  function paint() {
    const shown = model.values();
    for (const seat of [1, 2]) {
      if (shown[seat] === undefined) continue;
      const p = (getPlayers() || []).find(x => x?.seat === seat);
      const max = Number(p?.maxHp);
      if (!(max > 0)) continue;
      const side = root.querySelector?.(`.pvp2-side[data-seat="${seat}"]`);
      if (!side) continue;
      const hp = Math.max(0, Math.min(max, shown[seat]));
      const scale = `scaleX(${hp / max})`;
      for (const sel of ['[data-server-hp-fill]', '[data-server-hp-trail]']) {
        const n = side.querySelector(sel); if (n && n.style.transform !== scale) n.style.transform = scale;
      }
      const text = side.querySelector('[data-server-hp]');
      const label = `${hp.toLocaleString('tr-TR')} / ${max.toLocaleString('tr-TR')} HP`;
      if (text && text.textContent !== label) text.textContent = label;
    }
  }
  // network.js can çubuğunu her anlık görüntüde ve 250 ms'lik tikte GERÇEK değerle yeniden yazar. Yoklama (100 ms)
  // arada gerçek değerin bir kare görünmesine yol açıyordu (gösterilen can geri zıplıyordu). MutationObserver
  // aynı görevin sonunda (boyamadan önce) tutulan değeri geri yazar → ekranda tek yönlü düşüş.
  const MO = root.ownerDocument?.defaultView?.MutationObserver || globalThis.MutationObserver;
  let observer = null;
  function watch() {
    if (observer || typeof MO !== 'function') return;
    observer = new MO(() => { if (model.held()) paint(); });
    for (const seat of [1, 2]) {
      const side = root.querySelector?.(`.pvp2-side[data-seat="${seat}"]`);
      for (const sel of ['[data-server-hp]', '[data-server-hp-fill]', '[data-server-hp-trail]']) {
        const n = side?.querySelector?.(sel);
        if (n) observer.observe(n, {childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['style']});
      }
    }
  }
  function unwatch() { observer?.disconnect?.(); observer = null; }
  function stopPoll() { if (poll != null) { unlater(poll); poll = null; } unwatch(); }
  function releaseAll() { model.release(); heldSince = 0; stopPoll(); paint(); }
  function tick() {
    if (!model.held()) { heldSince = 0; stopPoll(); return; }
    if (!isBusy() || now() - heldSince > CALLOUT.hpHoldMaxMs) { releaseAll(); return; }
    paint();
  }
  function sync() {
    model.sync(getPlayers(), Boolean(isBusy()));
    if (model.held()) {
      if (!heldSince) heldSince = now(); // tavan bu tutuşun başından sayılır (önceki tutuştan kalmaz)
      if (poll == null) poll = later(tick, CALLOUT.hpPollMs);
      watch();
      paint();
    } else heldSince = 0;
  }
  const onMatch = () => sync();
  root.addEventListener('tuslab:pvp-match', onMatch);
  return {
    model, sync,
    /** Temas karesi: bu hasar artık ekranda görünebilir. */
    expect(action) { model.expect(action?.toSeat); },
    // Her temas ilerlemedir: tavan (hpHoldMaxMs) son temastan sayılır; sahneler sürdükçe can sahnesiz düşmez.
    impact(action) { model.impact(action?.toSeat, action?.hpAfter); paint(); if (!model.held()) { heldSince = 0; stopPoll(); } else heldSince = now(); },
    destroy() { stopPoll(); root.removeEventListener?.('tuslab:pvp-match', onMatch); },
  };
}
