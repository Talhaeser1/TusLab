// Maç HUD'u v2 (KESINYAP 14): eğik can barları + hayalet can, seri göstergesi, yetenek rayı.
// Yalnız görsel katman: sunucu maç görüntüsünü okur (fight-hud.js update() çağırır), oyuna dokunmaz.
// Performans: yalnız değer değişince DOM yazılır; hareket transform/opacity (+ halka stroke-dasharray) ile; kare başına okuma yok.
import {getFighter, SKILL_KEY} from './shared/fighters.js';
import {SKILL_THRESHOLDS, streakSkill, streakMultiplier} from './shared/match.js';
import {SKILL_INFO, readSkillState, skillMeter, fighterSkillLabels} from './skillbar.js';
import {portraitFor} from './portraits.js';

export const HEX = '30,3 53.4,16.5 53.4,43.5 30,57 6.6,43.5 6.6,16.5';
const seatOf = (match, seat) => (match?.players || []).find(p => p && p.seat === seat) || null;
const modeOf = match => (match?.mode === 'arena' ? 'arena' : match?.mode === 'rounds' ? 'rounds' : 'classic');
const fmt = n => Number(n).toLocaleString('tr-TR');
export const fmtMult = m => `×${String(Math.round(m * 100) / 100).replace('.', ',')}`;

/** Seri göstergesi modeli (saf; test edilir): kaç pip, kaçı yanık, eşik işaretleri, çarpan, sıradaki adım. */
export function seriesModel(match, p) {
  const mode = modeOf(match);
  const combo = Math.max(0, Math.floor(Number(p?.streak ?? p?.combo) || 0));
  if (mode === 'rounds') {
    const t = SKILL_THRESHOLDS.rounds;
    let next = null;
    for (let s = combo + 1; s <= combo + 11; s++) { const k = streakSkill(s); if (k) { next = {key: SKILL_KEY[k] || k.toUpperCase(), steps: s - combo}; break; } }
    const mult = streakMultiplier(combo);
    // KESINYAP 21: seri pipleri 10'a göre (3 Q · 5 W · 7 E · 10 R).
    return {mode, count: combo, total: t.R, lit: Math.min(t.R, combo), marks: {[t.Q]: 'Q', [t.W]: 'W', [t.E]: 'E', [t.R]: 'R'}, mult: mult > 1 ? mult : null, next};
  }
  if (mode === 'arena') {
    const mult = combo >= 5 ? 2 : combo >= 4 ? 1.5 : null;
    const next = combo < 4 ? {key: 'KOMBO', steps: 4 - combo} : combo < 5 ? {key: 'FİNAL', steps: 1} : null;
    return {mode, count: combo, total: 5, lit: Math.min(5, combo), marks: {4: 'KOMBO', 5: 'FİNAL'}, mult, next};
  }
  const t = SKILL_THRESHOLDS.classic;
  const charge = Number(p?.skillCharge?.r);
  const lit = Math.min(5, Math.max(0, Number.isFinite(charge) ? charge : combo));
  let next = null;
  for (const [key, thr] of [['Q', t.Q], ['W', t.W], ['R', t.R]]) if (lit < thr) { next = {key, steps: thr - lit}; break; }
  return {mode, count: combo, total: 5, lit, marks: {[t.Q]: 'Q', [t.W]: 'W', [t.R]: 'R'}, mult: null, next};
}

/** Yetenek rayı modeli: arena'da boş; rounds Q/W/E/R (E = kendine can); classic Q/W/S/R (W = eski E vuruşu, kural aynı). */
export function railModel(match, p, now = Date.now()) {
  const mode = modeOf(match);
  if (mode === 'arena' || !p) return [];
  const rounds = mode === 'rounds';
  const labels = fighterSkillLabels(p.fighter);
  const kind = p.character === 'rune' ? 'rune' : 'fire';
  return (rounds ? ['Q', 'W', 'E', 'R'] : ['Q', 'W', 'S', 'R']).map(key => {
    const st = readSkillState(p, key, {rounds, now});
    const {state, fill} = skillMeter(st);
    const name = labels?.[key]?.name || SKILL_INFO[kind]?.[key]?.name || key;
    return {key, name, fill, state, threshold: st.threshold, energy: st.energy, casts: st.casts, icon: SKILL_INFO[kind]?.[rounds && key === 'E' ? 'H' : key]?.icon || '',
      sub: key === 'S' ? '' : (state === 'cooldown' && st.cooldownMs > 0 ? `${Math.ceil(st.cooldownMs / 1000)} sn` : `seri ${st.threshold}`), wait: Math.max(st.cooldownMs, st.shieldMs || 0)};
  });
}

export function createHudV2({root, doc = root?.ownerDocument || globalThis.document, reduced = () => false, later = (fn, ms) => globalThis.setTimeout(fn, ms), cancel = id => globalThis.clearTimeout(id)} = {}) {
  const el = doc.createElement('div');
  el.className = 'fhud2'; el.hidden = true; el.setAttribute('data-fhud2', '');
  el.setAttribute('aria-hidden', 'true');
  const sideHTML = seat => `<section class="fhud2-side fhud2-seat-${seat}" data-fhud-seat="${seat}">
    <span class="fhud2-medal"><img alt="" decoding="async" draggable="false"></span>
    <div class="fhud2-top"><span class="fhud2-who"><b class="fhud2-name"></b><small class="fhud2-char"></small></span><span class="fhud2-sen-slot" data-sen-slot="${seat}"></span><em class="fhud2-shield" hidden>KALKAN</em></div>
    <div class="fhud2-bar"><div class="fhud2-clip"><i class="fhud2-ghost"></i><i class="fhud2-fill"></i><i class="fhud2-notch"></i></div><span class="fhud2-hp"></span></div>
    <div class="fhud2-series" data-fhud-series="${seat}"><b class="fhud2-ser-n"><small>SERİ</small><span>0</span></b><span class="fhud2-pips"></span><b class="fhud2-ser-x" hidden></b><span class="fhud2-ser-next"></span></div></section>`;
  const railHTML = seat => `<div class="fhud2-rail fhud2-rail-${seat}" data-fhud-rail="${seat}"><div class="fhud2-skills"></div><small class="fhud2-rail-note">Seri dolunca yetenek kendiliğinden atılır</small></div>`;
  el.innerHTML = sideHTML(1) + sideHTML(2) + railHTML(1) + railHTML(2);
  root.appendChild(el);

  const S = {1: null, 2: null};
  for (const seat of [1, 2]) {
    const q = sel => el.querySelector(`[data-fhud-seat="${seat}"] ${sel}`);
    S[seat] = {side: el.querySelector(`[data-fhud-seat="${seat}"]`), img: q('.fhud2-medal img'), name: q('.fhud2-name'), char: q('.fhud2-char'), shield: q('.fhud2-shield'),
      bar: q('.fhud2-bar'), ghost: q('.fhud2-ghost'), fill: q('.fhud2-fill'), hp: q('.fhud2-hp'),
      serN: q('.fhud2-ser-n span'), pips: q('.fhud2-pips'), serX: q('.fhud2-ser-x'), serNext: q('.fhud2-ser-next'),
      rail: el.querySelector(`[data-fhud-rail="${seat}"]`), skills: el.querySelector(`[data-fhud-rail="${seat}"] .fhud2-skills`),
      ratio: null, hpText: '', max: 0, portrait: '', pipKey: '', railKey: '', cards: new Map(), timer: null};
  }
  const setText = (n, t) => { if (n && n.textContent !== t) n.textContent = t; };
  const setHidden = (n, h) => { if (n && n.hidden !== h) n.hidden = h; };
  const setVar = (n, k, v) => { if (n.style.getPropertyValue(k) !== v) n.style.setProperty(k, v); };
  const play = (n, frames, opt) => { if (n && typeof n.animate === 'function' && !reduced()) { try { n.animate(frames, opt); } catch { /* süs */ } } };
  let lastBottom = null, destroyed = false, lastMatch = null, lastMy = null;

  function paintHp(seat, p, mine) {
    const s = S[seat];
    const valid = Number.isFinite(p.hp) && Number.isFinite(p.maxHp) && p.maxHp > 0;
    const hp = valid ? Math.max(0, Math.min(p.maxHp, p.hp)) : 0, max = valid ? p.maxHp : 1;
    const ratio = hp / max;
    if (s.ratio !== ratio) {
      const scale = `scaleX(${Math.round(ratio * 1000) / 1000})`;
      s.fill.style.transform = scale; s.ghost.style.transform = scale; // hayalet: CSS gecikmeli erir (400 ms)
      if (s.ratio !== null && ratio > s.ratio) { // E (kendine can): bar yukarı dolar, yeşil parıltı
        s.bar.classList.add('is-heal'); later(() => s.bar.classList.remove('is-heal'), 900);
      }
      if (s.ratio !== null && ratio < s.ratio) {
        s.bar.classList.add('is-hit');
        play(s.bar, [{transform: 'translateX(0)'}, {transform: `translateX(${seat === 1 ? -6 : 6}px)`, offset: .25}, {transform: `translateX(${seat === 1 ? 4 : -4}px)`, offset: .55}, {transform: 'translateX(0)'}], {duration: 240, easing: 'ease-out'});
        later(() => s.bar.classList.remove('is-hit'), 400);
      }
      s.ratio = ratio;
      s.side.classList.toggle('is-low', valid && ratio < .25);
    }
    if (s.max !== max) { s.max = max; setVar(s.bar, '--fhud-notch', `${(1000 / max) * 100}%`); }
    const txt = valid ? `${fmt(hp)} / ${fmt(max)}` : '— / —';
    if (txt !== s.hpText) { s.hpText = txt; s.hp.textContent = txt; }
  }

  function paintIdent(seat, p, mine, shieldOn) {
    const s = S[seat];
    const f = getFighter(p.fighter, p.character || (seat === 2 ? 'rune' : 'fire'));
    setText(s.name, String(p.name || `Oyuncu ${seat}`));
    setText(s.char, `${f.name} · ${f.title}`);
    setHidden(s.shield, !shieldOn);
    const pt = portraitFor({fighter: p.fighter, character: p.character});
    if (s.portrait !== pt.url) { s.portrait = pt.url; s.img.src = pt.url; s.img.dataset.portrait = pt.id; setVar(s.side, '--fhud-a', f.palette.accent); setVar(el, `--fhud-a${seat}`, f.palette.accent); if (root.style) setVar(root, `--fhud-a${seat}`, f.palette.accent); }
  }

  function paintSeries(seat, m) {
    const s = S[seat];
    const key = `${m.mode}|${m.total}|${Object.entries(m.marks).join()}`;
    if (key !== s.pipKey) {
      s.pipKey = key; s.pips.replaceChildren();
      for (let i = 1; i <= m.total; i++) {
        const pip = doc.createElement('i'); pip.className = m.marks[i] ? 'fhud2-pip is-mark' : 'fhud2-pip';
        if (m.marks[i]) pip.dataset.mark = m.marks[i];
        s.pips.appendChild(pip);
      }
    }
    const kids = s.pips.children;
    for (let i = 0; i < kids.length; i++) { const on = i < m.lit; if (kids[i].classList.contains('is-on') !== on) kids[i].classList.toggle('is-on', on); }
    setText(s.serN, String(m.count));
    s.side.classList.toggle('has-series', m.count > 0);
    setHidden(s.serX, !m.mult); if (m.mult) setText(s.serX, fmtMult(m.mult));
    setText(s.serNext, m.next ? `→ ${m.next.key} ${m.next.steps}` : '');
  }

  function buildRail(seat, model, key) {
    const s = S[seat]; s.cards.clear(); s.skills.replaceChildren();
    for (const r of model) {
      const card = doc.createElement('div');
      card.className = `fhud2-sk fhud2-sk-${r.key.toLowerCase()}`; card.dataset.key = r.key;
      card.innerHTML = `<span class="fhud2-hexwrap"><svg class="fhud2-hex" viewBox="0 0 60 60" focusable="false"><polygon class="hx-bg" points="${HEX}"/><polygon class="hx-ring" points="${HEX}" pathLength="100"/><polygon class="hx-prog" points="${HEX}" pathLength="100" stroke-dasharray="0 100"/></svg>`
        + `<span class="fhud2-glyph">${r.icon}</span><b class="fhud2-key">${r.key}</b><i class="fhud2-flash"></i></span><span class="fhud2-skname"></span><small class="fhud2-sksub"></small>`;
      s.skills.appendChild(card);
      s.cards.set(r.key, {card, prog: card.querySelector('.hx-prog'), name: card.querySelector('.fhud2-skname'), sub: card.querySelector('.fhud2-sksub'), flash: card.querySelector('.fhud2-flash'), wrap: card.querySelector('.fhud2-hexwrap'), fill: -1, state: '', casts: null});
    }
    s.railKey = key;
  }
  function paintRail(seat, model, p) {
    const s = S[seat];
    const key = `${model.map(r => r.key).join('')}|${p.fighter || ''}|${p.character || ''}`;
    if (key !== s.railKey) buildRail(seat, model, key);
    setHidden(s.rail, !model.length);
    for (const r of model) {
      const c = s.cards.get(r.key); if (!c) continue;
      const pct = Math.round(r.fill * 100);
      if (pct !== c.fill) { c.fill = pct; c.prog.setAttribute('stroke-dasharray', `${pct} 100`); }
      if (c.state !== r.state) {
        const prev = c.state; c.state = r.state; c.card.dataset.state = r.state;
        if (prev === 'charging' && r.state === 'ready') play(c.flash, [{opacity: 0}, {opacity: 1, offset: .3}, {opacity: 0}], {duration: 420, easing: 'ease-out'});
      }
      if (c.casts !== null && r.casts > c.casts) { // atım: ikon büyür, parlama
        play(c.wrap, [{transform: 'scale(1)'}, {transform: 'scale(1.28)', offset: .3}, {transform: 'scale(1)'}], {duration: 520, easing: 'cubic-bezier(.16,1,.3,1)'});
        play(c.flash, [{opacity: 0}, {opacity: 1, offset: .2}, {opacity: 0}], {duration: 650, easing: 'ease-out'});
        c.card.classList.add('is-cast'); later(() => c.card.classList.remove('is-cast'), 700);
      }
      c.casts = r.casts;
      setText(c.name, r.name); setText(c.sub, r.sub);
    }
  }

  // Sunucu anlık görüntüsü gelmese de bekleme/kalkan süresi bitince yeniden çizer.
  function schedule(seat, wait) {
    const s = S[seat]; cancel(s.timer); s.timer = null;
    if (wait > 0 && wait < 60000) s.timer = later(() => { s.timer = null; if (!destroyed && lastMatch) update(lastMatch, lastMy); }, wait + 60);
  }

  function railOffset() {
    const tt = root.querySelector?.('.pvp2-shell>.tt');
    const r = tt?.getBoundingClientRect?.();
    if (!r || r.height < 20) return;
    const b = Math.max(8, Math.round((globalThis.innerHeight || 768) - r.top + 8));
    if (b !== lastBottom) { lastBottom = b; el.style.setProperty('--fhud2-rail-b', `${b}px`); }
  }

  function update(match, myId) {
    if (destroyed || !match) return;
    lastMatch = match; lastMy = myId;
    const live = match.status === 'running' || match.status === 'paused';
    setHidden(el, !live);
    if (!live) return;
    const mode = modeOf(match);
    if (el.dataset.mode !== mode) el.dataset.mode = mode;
    const now = Date.now();
    const mineSeat = (match.players || []).find(p => p && myId != null && p.playerId === myId)?.seat ?? null;
    const meTag = String(mineSeat ?? 1); if (root.dataset && root.dataset.fhudMe !== meTag) root.dataset.fhudMe = meTag; // HUD v3: yazma paneli kendi rengimi bilir
    for (const seat of [1, 2]) {
      const p = seatOf(match, seat), s = S[seat];
      setHidden(s.side, !p);
      if (!p) { setHidden(s.rail, true); continue; }
      const mine = mineSeat === null || mineSeat === seat;
      s.side.classList.toggle('is-mine', mineSeat === seat);
      s.rail.classList.toggle('is-mine', mine); s.rail.classList.toggle('is-opp', !mine);
      s.side.classList.toggle('is-opp', mineSeat !== null && mineSeat !== seat);
      paintHp(seat, p, mine);
      paintIdent(seat, p, mine, Boolean(p.shieldUntil && p.shieldUntil > now));
      paintSeries(seat, seriesModel(match, p));
      const model = railModel(match, p, now);
      paintRail(seat, model, p);
      schedule(seat, Math.max(0, ...model.map(r => r.wait), p.shieldUntil && p.shieldUntil > now ? p.shieldUntil - now : 0));
    }
    railOffset();
  }
  const onResize = () => { lastBottom = null; railOffset(); };
  globalThis.addEventListener?.('resize', onResize);
  let ro = null;
  try { const tt = root.querySelector?.('.pvp2-shell>.tt'); if (tt && typeof globalThis.ResizeObserver === 'function') { ro = new globalThis.ResizeObserver(() => railOffset()); ro.observe(tt); } } catch { /* süs */ }

  return {
    update, el,
    hide() { setHidden(el, true); },
    destroy() { destroyed = true; for (const seat of [1, 2]) cancel(S[seat].timer); ro?.disconnect?.(); globalThis.removeEventListener?.('resize', onResize); el.remove(); },
  };
}
