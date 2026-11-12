// Yerleşim ölçümü: tam maç boyunca durum başına (typing/resolve/inter/results) font<12, taşma, çakışma; kazanan + data-tone + hp/ev zamanı.
async (page) => {
  const P = Object.assign({mode: 'rounds', w: 1366, h: 768, maxMs: 170000}, JSON.parse(await page.evaluate(() => { try { return localStorage.getItem('__ui') || '{}'; } catch { return '{}'; } }).catch(() => '{}')));
  await page.setViewportSize({width: P.w, height: P.h});
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  const bad = []; page.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url().slice(-60)); });
  await page.goto(`http://127.0.0.1:5176/index.html?pvp=practice&mode=${P.mode}&bot=easy&karakter=vargr&fighter1=vargr&fighter2=nyx${P.q || ''}`);
  await page.waitForTimeout(P.mode === 'arena' ? 4500 : 7000);
  await page.evaluate(() => {
    const L = window.__ly = {issues: {}, tones: new Set(), hp: [], ev: [], crystal: null, t0: performance.now()};
    document.querySelector('#pvp-root')?.addEventListener('tuslab:pvp-combat', e => { const d = e.detail || {}; if (L.ev.length < 300) L.ev.push([Math.round(performance.now() - L.t0), d.type, d.amount ?? '', d.hpAfter ?? ''].join(' ')); }, true);
    let lastHp = '';
    setInterval(() => { const hp = [1, 2].map(s => (document.querySelector(`.pvp2-side[data-seat="${s}"] [data-server-hp]`)?.textContent || '').split('/')[0]).join('/'); if (hp !== lastHp) { lastHp = hp; L.hp.push(Math.round(performance.now() - L.t0) + ':' + hp); } }, 40);
  });
  const MEASURE = () => {
    const root = document.querySelector('#pvp-root'); if (!root) return null;
    const W = innerWidth, H = innerHeight;
    const vis = e => { const dt = e.closest('details:not([open])'); if (dt && !e.closest('summary')) return false; const r = e.getBoundingClientRect(), c = getComputedStyle(e); if (r.width < 2 || r.height < 2 || c.display === 'none' || c.visibility === 'hidden' || Number(c.opacity) < 0.15) return false; for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) { const pc = getComputedStyle(p); if (pc.display === 'none' || pc.visibility === 'hidden' || Number(pc.opacity) < 0.05) return false; } return true; };
    const flags = ['rui-inter-open', 'aui-summary-open', 'pvp15-results-open'].filter(f => root.classList.contains(f));
    const state = flags.join('+') || (document.querySelector('.rsv-banner') && vis(document.querySelector('.rsv-banner')) ? 'resolve' : 'play');
    const out = {state, small: [], over: [], off: [], ov: []};
    if (document.documentElement.scrollWidth > W + 1) out.over.push('PAGE-HSCROLL ' + document.documentElement.scrollWidth);
    const nm = e => (e.className && e.className.toString ? e.className.toString().split(' ')[0] : e.tagName) + '«' + (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 18) + '»';
    for (const e of root.querySelectorAll('*')) {
      if (!vis(e)) continue;
      const own = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 0);
      if (!own) continue;
      const fs = parseFloat(getComputedStyle(e).fontSize);
      if (fs > 0 && fs < 12) out.small.push(nm(e) + ' ' + fs);
      if (!e.closest('.pvp24-chip') && e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflowX !== 'visible' && e.clientWidth > 0) out.over.push(nm(e) + ' ' + e.scrollWidth + '>' + e.clientWidth);
      const r = e.getBoundingClientRect(); if (r.right > W + 2 || r.left < -2 || r.bottom > H + 2 || r.top < -2) { if (!e.closest('canvas')) out.off.push(nm(e) + ` [${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}]`); }
    }
    const OV = {banner: '.rsv-banner', callout: '[data-attack-callout],.pvp-attack-callout', combo: '[data-combo-counter],.pvp-combo-counter', crit: '[data-crit-text],.fhud-call-crit', words: '.tt-type,.rui-words,.aui-words,.rui-strip', card: '.m33-result,.rui-intro,.rui-inter,.aui-summary,[data-pvp15-results]'};
    const HUD = '.pvp2-health,.pvp2-player-top,.pvp2-skillrow,.fhud-super,.fhud-assist,.pvp2-toolbar,.pvp2-role,.pvp7-combo,.pvp2-announce';
    const els = {}; for (const [k, s] of Object.entries(OV)) { const l = [...root.querySelectorAll(s)].filter(vis); if (l.length) els[k] = l[0]; }
    const hud = [...root.querySelectorAll(HUD)].filter(vis);
    const keys = Object.keys(els);
    const inter = (A, B) => ({ix: Math.min(A.right, B.right) - Math.max(A.left, B.left), iy: Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top)});
    for (let i = 0; i < keys.length; i++) {
      const a = els[keys[i]], A = a.getBoundingClientRect();
      for (let j = i + 1; j < keys.length; j++) { const b = els[keys[j]]; if (a.contains(b) || b.contains(a)) continue; const {ix, iy} = inter(A, b.getBoundingClientRect()); if (ix > 3 && iy > 3) out.ov.push(`${keys[i]}×${keys[j]} ${Math.round(ix)}x${Math.round(iy)}`); }
      if (keys[i] === 'card') continue;
      for (const h of hud) { if (a.contains(h) || h.contains(a)) continue; const {ix, iy} = inter(A, h.getBoundingClientRect()); if (ix > 3 && iy > 3) out.ov.push(`${keys[i]}×${h.className.toString().split(' ')[0]} ${Math.round(ix)}x${Math.round(iy)}`); }
    }
    out.rects = {}; for (const [k, e] of Object.entries(els)) { const r = e.getBoundingClientRect(); out.rects[k] = [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; }
    for (const h of hud) { const r = h.getBoundingClientRect(); out.rects[h.className.toString().split(' ')[0]] = [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; }
    const c = els.card; if (c) { const r = c.getBoundingClientRect(); if (r.right > W + 1 || r.bottom > H + 1 || r.left < -1 || r.top < -1) out.off.push(`CARD ${keys.includes('card') ? c.className.toString().split(' ')[0] : ''} [${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}] vp ${W}x${H}`); }
    out.tone = document.querySelector('[data-tone]')?.dataset.tone || null;
    return out;
  };
  const seen = new Set(); const rows = []; const t0 = Date.now(); let typed = 0, crystal = null, res = null;
  while (Date.now() - t0 < P.maxMs) {
    const m = await page.evaluate(MEASURE).catch(() => null);
    if (m) {
      if (m.tone) await page.evaluate(t => window.__ly.tones.add(t), m.tone);
      const key = m.state + '|' + [...m.small, ...m.over, ...m.off, ...m.ov].join(';');
      if (!seen.has(key) && (m.small.length || m.over.length || m.off.length || m.ov.length)) { seen.add(key); rows.push({t: Date.now() - t0, state: m.state, small: m.small.slice(0, 4), over: m.over.slice(0, 4), off: m.off.slice(0, 4), ov: m.ov.slice(0, 6), rects: m.ov.length || m.off.length ? m.rects : undefined}); }
      if (!seen.has('S|' + m.state)) { seen.add('S|' + m.state); rows.push({t: Date.now() - t0, stateSeen: m.state}); }
      if (m.state === 'play' && !crystal) crystal = await page.evaluate(() => window.__tuslabArena3d?._debug?.screen?.() ?? null).catch(() => null);
    }
    res = await page.evaluate(() => { const t = document.querySelector('[data-pvp15-title]'); return t && t.getBoundingClientRect().width > 5 ? {outcome: t.dataset.outcome, text: t.textContent.trim().slice(0, 30)} : null; }).catch(() => null);
    if (res) break;
    const w = await page.evaluate(() => { const root = document.querySelector('#pvp-root'); if (['rui-inter-open', 'aui-summary-open'].some(f => root?.classList.contains(f))) return ''; return (document.querySelector('[data-tt-target]')?.textContent || '').trim(); }).catch(() => '');
    if (w && w.length > 1 && !/[✓…]/.test(w)) { await page.keyboard.type(w, {delay: 4}); await page.keyboard.press('Space'); typed++; }
    await page.waitForTimeout(90);
  }
  await page.waitForTimeout(900);
  const fin = await page.evaluate(MEASURE).catch(() => null);
  if (fin) rows.push({final: true, state: fin.state, small: fin.small.slice(0, 5), over: fin.over.slice(0, 5), off: fin.off.slice(0, 5), ov: fin.ov.slice(0, 5)});
  const resInfo = await page.evaluate(() => { const r = document.querySelector('[data-pvp15-results]'); if (!r) return null; const rc = e => { const b = e.getBoundingClientRect(); return `[${Math.round(b.left)},${Math.round(b.top)},${Math.round(b.right)},${Math.round(b.bottom)}]`; }; const out = [`root ${r.className.toString().slice(0, 30)} ${rc(r)} ov:${getComputedStyle(r).overflowY} sh:${r.scrollHeight}/${r.clientHeight}`]; for (const c of r.querySelectorAll('*')) { const b = c.getBoundingClientRect(); if (b.width > 40 && b.height > 14 && /pvp15-(card|panel|meta|votes|rematch|exit|actions|stats|grid)|rui-res/.test(c.className.toString())) out.push(`${c.className.toString().split(' ')[0]} ${rc(c)} ov:${getComputedStyle(c).overflowY} sh:${c.scrollHeight}/${c.clientHeight}`); } return out.slice(0, 16); }).catch(() => null);
  const tail = await page.evaluate(() => ({tones: [...window.__ly.tones], hp: window.__ly.hp.slice(-14), ev: window.__ly.ev.slice(0, 40), score: (document.querySelector('.rui-res-score, [data-rui-scoreline], .pvp15-score')?.textContent || '').trim().slice(0, 40), reason: [...document.querySelectorAll('[data-pvp15-results] .rui-ko, [data-pvp15-results] [data-pvp15-reason]')].map(e => e.textContent.trim()).join('|'), hpNow: [1, 2].map(s => document.querySelector(`.pvp2-side[data-seat="${s}"] [data-server-hp]`)?.textContent || '')}));
  return {mode: P.mode, vp: `${P.w}x${P.h}`, secs: Math.round((Date.now() - t0) / 1000), typed, res, resInfo, ...tail, crystal, rows, errs: errs.slice(0, 4), bad: [...new Set(bad)].slice(0, 5)};
}
