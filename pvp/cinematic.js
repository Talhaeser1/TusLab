// Olay: tuslab:pvp-cinematic (COUNTDOWN / MATCH_START) — tuslab:pvp-match her maç güncellemesinde gider, ona bağlanmayın.
// Dövüş oyunu tarzı sinematik katman (özgün TuşLab tasarımı; başka bir oyunun görünümü kopyalanmaz).
//  - Maç başı: VS girişi (iki dövüşçü iki yandan kayar, ortada VS çarpar)
//  - Raund başı / sonu: çapraz bant + büyük yazı ("RAUND 2 · YAZ!", "K.O.!", "SÜRE!")
//  - Zamana Karşı raund sonu: yazma paneli aşağı iner, arena öne çıkar, tur arası paneli bandın ardından açılır
// Yalnız görseldir: oyun durumunu değiştirmez, tıklamayı engellemez, herhangi bir tuş sinematiği hızla kapatır.
// Yalnız transform/opacity animasyonu; sonsuz animasyon yok; hareket azaltmada kısa solma.

import {getFighter} from './shared/fighters.js';
import {getStage} from './shared/stages.js';
import {portraitFor, PORTRAITS} from './portraits.js';

export const CIN_TIMES = Object.freeze({vs: 2200, vsLite: 1500, banner: 900, bannerShort: 900, roundEndHold: 1250, roundStart: 650});

const CHAR = Object.freeze({
  fire: {name: 'Alev Celladı', image: './assets/arena-king.webp'},
  rune: {name: 'Rün Muhafızı', image: './assets/rune-preview.webp'}
});

/** Raund sonu bandının yazısı (saf; test edilir). */
export function roundEndText({reason, winnerSeat, round, players = [], suddenDeath = false} = {}) {
  const winner = players.find(p => p.seat === winnerSeat);
  const sub = winner ? `${winner.name || `Oyuncu ${winnerSeat}`} kazandı` : 'Berabere';
  if (reason === 'KO') return {title: 'K.O.!', sub, tone: 'ko'};
  if (!winnerSeat) return {title: 'BERABERE', sub: round ? `Raund ${round}` : '', tone: 'draw'};
  if (reason === 'TIME' || reason === 'TIMEOUT') return {title: 'SÜRE!', sub, tone: 'time'};
  return {title: suddenDeath ? 'ANİ ÖLÜM BİTTİ' : `RAUND ${round || ''} BİTTİ`.replace('  ', ' '), sub, tone: 'end'};
}

/** DEVIR-PVP 1: yazma süresi bitti, çözüm başlıyor (ROUND_RESOLVE) bandı (saf; test edilir).
 *  Zamana karşı: "SÜRE!" · kelime raundu (ilk bitiren kapattı): "RAUND N BİTTİ". Kazanan henüz belli değil (vuruşlar oynamadı). */
export function roundResolveText({round, style, turns, suddenDeath = false} = {}) {
  const sub = Number(turns) > 0 ? 'Vuruşlar sırayla geliyor' : 'Vuruş yok';
  if (style !== 'counted') return {title: 'SÜRE!', sub, tone: 'time'};
  return {title: suddenDeath ? 'ANİ ÖLÜM BİTTİ' : `RAUND ${round || ''} BİTTİ`.replace('  ', ' ').trim(), sub, tone: 'end'};
}

/** VS girişi için iki tarafın görünen bilgisi (saf; test edilir). */
export function vsModel(match) {
  const players = Array.isArray(match?.players) ? match.players : [];
  return [1, 2].map(seat => {
    const p = players.find(x => x.seat === seat) || {};
    const id = p.character === 'rune' || (!p.character && seat === 2) ? 'rune' : 'fire';
    const fighter = getFighter(p.fighter, id);
    const portrait = portraitFor({fighter: p.fighter, character: id});
    return {seat, side: id, name: String(p.name || `Oyuncu ${seat}`), character: fighter.name, fighterId: portrait.id,
      title: fighter.title, accent: fighter.palette.accent, image: portrait.url, fallback: CHAR[id].image, arena: `ARENA: ${getStage(match?.stage).name}`};
  });
}

/** Sinematik sesleri: mevcut özgün ses dosyaları (assets/sfx). Oyuncunun ses ayarına (sessiz/düzey) uyar. */
export const CIN_SFX = Object.freeze({
  vs: [['clash', 1, 0], ['critical', .9, 320]],
  ko: [['shatter', 1, 0], ['critical', 1, 60]],
  time: [['time-freeze', .9, 0], ['clash', .7, 80]],
  end: [['clash', .85, 0]],
  draw: [['block', .9, 0]],
  start: [['round-start', 1, 0]]
});

export function attachCinematic({root, isReduced = () => false, scheduler = globalThis, doc = globalThis.document, sfx = null} = {}) {
  if (!root?.addEventListener || !doc?.createElement) return {destroy() {}, play() {}};
  let layer = null, timers = [], keyHandler = null, warmTimer = null, warmIdle = null;
  const later = (fn, ms) => { const id = scheduler.setTimeout(fn, ms); timers.push(id); return id; };
  const clearAll = () => { for (const id of timers) scheduler.clearTimeout(id); timers = []; };
  const el = (tag, cls, text) => { const n = doc.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const reduced = () => {
    if (root.classList?.contains?.('pvp4-reduced')) return true;
    try { if (doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return true; } catch {}
    try { return Boolean(isReduced()); } catch { return false; }
  };
  const sound = key => { if (typeof sfx !== 'function') return; for (const [name, gain, delay] of CIN_SFX[key] || []) { if (delay) later(() => { try { sfx(name, gain); } catch {} }, delay); else { try { sfx(name, gain); } catch {} } } };
  // Güçlü vuruş: şok dalgası + renkli patlama + kıvılcımlar + kısa ekran sarsıntısı (tek seferlik; hareket azaltmada yok).
  const impact = (tone, delay = 0) => {
    if (reduced()) return [];
    const wrap = el('div', `cin-impact cin-tone-${tone}`);
    wrap.style?.setProperty?.('--cin-delay', `${delay}ms`);
    wrap.append(el('i', 'cin-burst'), el('i', 'cin-ring'), el('i', 'cin-ring cin-ring-2'));
    for (let i = 0; i < 14; i++) {
      const sp = el('i', 'cin-spark');
      const ang = (i / 14) * Math.PI * 2 + (i % 2 ? .18 : -.12), dist = 180 + (i * 37) % 160;
      sp.style?.setProperty?.('--dx', `${Math.round(Math.cos(ang) * dist)}px`);
      sp.style?.setProperty?.('--dy', `${Math.round(Math.sin(ang) * dist * .7)}px`);
      sp.style?.setProperty?.('--rot', `${Math.round(ang * 57.3)}deg`);
      wrap.append(sp);
    }
    return [wrap];
  };
  // show() eski zamanlayıcıları temizler: sarsıntı show() SONRASI kurulmalı.
  const shake = delay => { if (reduced()) return; later(() => { root.classList?.add('cin-shake'); later(() => root.classList?.remove('cin-shake'), 340); }, delay); };
  // VS girişindeki dövüşçü resimleri ilk maçta hazır olsun (~400 KB, bir kez; boşta indirilir).
  try {
    const warm = () => {
      warmTimer = null; warmIdle = null;
      if (typeof globalThis.Image !== 'function') return;
      try { for (const src of Object.values(PORTRAITS)) { const im = new globalThis.Image(); im.decoding = 'async'; im.src = src; } } catch { /* yalnız iyileştirme */ }
    };
    const idle = globalThis.requestIdleCallback;
    if (idle) warmIdle = idle(warm, {timeout: 4000});
    else warmTimer = scheduler.setTimeout(warm, 2500);
  } catch { /* önyükleme yalnız iyileştirmedir */ }

  function ensureLayer() {
    if (layer && layer.isConnected) return layer;
    layer = el('div', 'cin');
    layer.setAttribute('aria-hidden', 'true');
    layer.hidden = true;
    root.appendChild(layer);
    return layer;
  }
  function stop() {
    clearAll();
    if (layer) { layer.hidden = true; layer.replaceChildren(); layer.className = 'cin'; }
    root.classList?.remove('cin-playing', 'cin-shake');
    if (keyHandler) { doc.removeEventListener?.('keydown', keyHandler, true); keyHandler = null; }
  }
  function show(kind, children, ms, box = null) {
    stop();
    const l = ensureLayer();
    l.className = `cin cin-${kind}${reduced() ? ' cin-still' : ''}${box ? ' cin-boxed' : ''}`;
    l.style?.setProperty?.('--cin-ms', `${ms}ms`);
    // Kutulu mod: yalnız verilen alanı kaplar (ör. arena), yazma paneli görünür kalır.
    for (const k of ['top', 'left', 'width', 'height']) l.style?.setProperty?.(k, box ? `${Math.round(box[k])}px` : '');
    l.replaceChildren(...children);
    l.hidden = false;
    root.classList?.add('cin-playing');
    // Atlanabilir: tuşa basmak sinematiği kapatır ama tuşun oyuna gitmesini ENGELLEMEZ.
    keyHandler = () => { l.classList.add('cin-out'); later(stop, 140); };
    doc.addEventListener?.('keydown', keyHandler, true);
    later(() => l.classList.add('cin-out'), Math.max(0, ms - 260));
    later(stop, ms);
  }

  // lite: maç saati çalışırken (geri sayımsız başlangıç) yalnız arena alanında oynar; yazma paneli açık kalır.
  function playVs(match, {lite = false} = {}) {
    const [a, b] = vsModel(match);
    let box = null;
    if (lite) {
      const duel = root.querySelector?.('.pvp2-duel')?.getBoundingClientRect?.();
      if (!duel || duel.height < 160) return; // arena görünmüyorsa hiç oynatma: yazı alanını asla kapatma
      box = {top: duel.top, left: duel.left, width: duel.width, height: duel.height};
    }
    const half = m => {
      const box = el('div', `cin-half cin-${m.side} cin-seat-${m.seat}`);
      box.style?.setProperty?.('--cin-accent', m.accent);
      const img = el('img', 'cin-fighter'); img.alt = ''; img.decoding = 'async'; img.setAttribute?.('data-portrait', m.fighterId);
      img.addEventListener?.('error', () => { if (!img.src.endsWith(m.fallback.slice(1))) img.src = m.fallback; }, {once: true});
      img.src = m.image;
      const tag = el('div', 'cin-tag');
      tag.append(el('small', 'cin-player', `OYUNCU ${m.seat}`), el('strong', 'cin-name', m.name),
        el('span', 'cin-char', m.character), el('span', 'cin-fighter-title', m.title));
      box.append(img, tag);
      return box;
    };
    const ms = reduced() ? 900 : lite ? CIN_TIMES.vsLite : CIN_TIMES.vs;
    show('vs', [half(a), half(b), el('div', 'cin-flash'), ...impact('vs', 320), el('strong', 'cin-vs-text', 'VS'), el('span', 'cin-arena', a.arena)], ms, box);
    sound('vs'); shake(320);
  }
  function playBanner({title, sub = '', tone = 'start'}, ms = CIN_TIMES.banner) {
    const band = el('div', `cin-band cin-tone-${tone}`);
    band.append(el('i', 'cin-sweep'), el('strong', 'cin-title', title));
    if (sub) band.append(el('span', 'cin-sub', sub));
    show('banner', [el('div', 'cin-flash'), ...impact(tone, 60), band], Math.min(ms, reduced() ? 800 : 900));
    sound(tone); shake(60);
  }
  // Zamana Karşı raund sonu sıralaması: bant → (yazma paneli aşağı iner, arena öne çıkar) → tur arası paneli.
  // Sıralama zamanlayıcıları bantlardan AYRI tutulur: bant kapanırken (stop) silinmemeli,
  // yoksa "raund sonu" sınıfı kalkmaz ve tur arası paneli bütün ara boyunca gizli kalır.
  const seq = {end: null, start: null};
  const seqLater = (key, fn, ms) => { if (seq[key] !== null) scheduler.clearTimeout(seq[key]); seq[key] = scheduler.setTimeout(() => { seq[key] = null; fn(); }, ms); };
  function roundEndSequence() {
    root.classList?.add('cin-round-end');
    seqLater('end', () => root.classList?.remove('cin-round-end'), reduced() ? 300 : CIN_TIMES.roundEndHold);
  }
  function roundStartSequence() {
    if (seq.end !== null) { scheduler.clearTimeout(seq.end); seq.end = null; }
    root.classList?.remove('cin-round-end');
    root.classList?.add('cin-round-start');
    seqLater('start', () => root.classList?.remove('cin-round-start'), CIN_TIMES.roundStart);
  }

  const players = () => [];
  // Geri sayımda tam ekran VS (maç saati çalışmıyor). Geri sayım görülmediyse (antrenman) maç başında
  // yalnız arena alanında kısa VS: yazma paneli ve kelime asla kapanmaz.
  let countdownAt = -Infinity;
  const onMatch = e => {
    const d = e.detail || {};
    if (d.type === 'COUNTDOWN' && d.match) { countdownAt = Date.now(); playVs(d.match); }
    else if (d.type === 'MATCH_START' && d.match && Date.now() - countdownAt > 15000) playVs(d.match, {lite: true});
  };
  // DEVIR-PVP 1: raund sonu bandı yazma süresi bitince (ROUND_RESOLVE = çözümün BAŞI) oynar; ROUND_END çözümün SONUdur
  // (vuruşlar bitti, tur arası açılıyor) → orada "SÜRE!" yeniden çıkmaz, yalnız K.O. ya da çözüm paketi görülmediyse
  // (çevrimiçi oda: vuruşlar yazarken çözülür, ROUND_RESOLVE yok) eski bant oynar.
  let resolvedRound = null;
  const onRound = e => {
    const {type, payload: p = {}} = e.detail || {};
    if (type === 'ROUND_RESOLVE') {
      const r = p.match?.round || {};
      resolvedRound = `${p.match?.matchId ?? ''}:${p.round ?? r.index}`;
      playBanner(roundResolveText({round: p.round ?? r.index, style: r.style, turns: p.turns, suddenDeath: r.suddenDeath}));
      roundEndSequence();
    } else if (type === 'ROUND_END') {
      const m = p.match || {};
      const seen = resolvedRound === `${m.matchId ?? ''}:${p.round}`;
      if (p.reason === 'KO' || !seen) {
        playBanner(roundEndText({reason: p.reason, winnerSeat: p.winnerSeat, round: p.round, players: m.players || players(), suddenDeath: p.suddenDeath}));
        if (!seen) roundEndSequence();
      }
    } else if (type === 'ROUND_START') {
      // "RAUND n · BAŞLA!" yazısını rounds-ui zaten gösteriyor; burada yalnız panel geri iner.
      roundStartSequence();
    }
  };
  const onArena = e => {
    const {type, payload: p = {}} = e.detail || {};
    if (type === 'ARENA_ROUND_START') playBanner({title: `RAUND ${p.round || ''}`.trim(), sub: 'YAZ!', tone: 'start'}, CIN_TIMES.bannerShort);
    else if (type === 'ARENA_ROUND_END') playBanner({title: `RAUND ${p.round || ''} BİTTİ`.trim(), sub: 'Vuruşlar sırayla geliyor', tone: 'end'}, CIN_TIMES.banner);
  };
  root.addEventListener('tuslab:pvp-cinematic', onMatch);
  root.addEventListener('tuslab:pvp-round', onRound);
  root.addEventListener('tuslab:pvp-arena', onArena);
  return {
    play: {vs: playVs, banner: playBanner, roundEnd: roundEndSequence, roundStart: roundStartSequence},
    destroy() {
      stop();
      if (warmTimer !== null) scheduler.clearTimeout(warmTimer);
      if (warmIdle !== null) globalThis.cancelIdleCallback?.(warmIdle);
      warmTimer = warmIdle = null;
      for (const k of Object.keys(seq)) if (seq[k] !== null) { scheduler.clearTimeout(seq[k]); seq[k] = null; }
      root.removeEventListener('tuslab:pvp-cinematic', onMatch);
      root.removeEventListener('tuslab:pvp-round', onRound);
      root.removeEventListener('tuslab:pvp-arena', onArena);
      layer?.remove?.(); layer = null;
      root.classList?.remove('cin-round-end', 'cin-round-start');
    }
  };
}
