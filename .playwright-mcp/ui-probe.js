// Tam maç UI ölçümü. Parametreler: globalThis.__ui = {mode, w, h, fighter, maxMs, typeEvery}
async (page) => {
  const P = Object.assign({mode: 'rounds', w: 1366, h: 768, fighter: 'doran', maxMs: 100000, typeEvery: 350}, JSON.parse(await page.evaluate(() => { try { return localStorage.getItem('__ui') || '{}'; } catch { return '{}'; } }).catch(() => '{}')));
  await page.setViewportSize({width: P.w, height: P.h});
  await page.goto(`http://127.0.0.1:5176/index.html?pvp=practice&mode=${P.mode}&bot=easy&karakter=${P.fighter}&fighter1=${P.fighter}&fighter2=nyx`);
  await page.waitForTimeout(6500);
  const snap = () => page.evaluate(() => {
    const root = document.querySelector('#pvp-root'); if (!root) return {state: 'no-root'};
    const vis = e => { if (!e || e.hidden) return false; const r = e.getBoundingClientRect(); const c = getComputedStyle(e); return r.width > 1 && r.height > 1 && c.display !== 'none' && c.visibility !== 'hidden' && Number(c.opacity) > 0.05; };
    const q = s => [...root.querySelectorAll(s)].filter(vis);
    const flags = ['rui-inter-open', 'aui-summary-open', 'pvp15-results-open'].filter(f => root.classList.contains(f));
    const cards = q('.aui-card');
    const state = flags.join('+') || (cards.length ? 'prep-cards' : q('[data-tt-target]').length && (document.querySelector('[data-tt-target]').textContent || '').trim().length > 1 ? 'typing' : 'other');
    const W = innerWidth, H = innerHeight; const issues = [];
    if (document.documentElement.scrollWidth > W + 1) issues.push(`hscroll ${document.documentElement.scrollWidth}>${W}`);
    // kartlar
    let cardInfo = null;
    if (cards.length) {
      const ws = cards.map(c => Math.round(c.getBoundingClientRect().width));
      const cols = new Set(cards.map(c => Math.round(c.getBoundingClientRect().left))).size;
      let overlap = 0, multi = 0, off = 0, clipped = 0;
      for (const c of cards) {
        const t = c.querySelector('.aui-card-copy strong, strong'), u = c.querySelector('.aui-uses'); const cr = c.getBoundingClientRect();
        if (cr.right > W + 1 || cr.bottom > H + 1 || cr.left < -1) off++;
        if (t) { const tr = t.getBoundingClientRect(); const lh = parseFloat(getComputedStyle(t).lineHeight) || tr.height; if (tr.height > lh * 1.5) multi++; if (t.scrollWidth > t.clientWidth + 1) clipped++;
          if (u && vis(u)) { const ur = u.getBoundingClientRect(); if (!(ur.left >= tr.right - 1 || ur.right <= tr.left + 1 || ur.top >= tr.bottom - 1 || ur.bottom <= tr.top + 1)) overlap++; } }
      }
      cardInfo = {n: cards.length, cols, minW: Math.min(...ws), maxW: Math.max(...ws), titleMultiLine: multi, titleClipped: clipped, badgeOverlap: overlap, offscreen: off};
    }
    // özet/sonuç kökü ekran içinde mi, alt panel gizli mi
    const panel = q('.rui-inter, .aui-summary, [data-pvp15-results]')[0]; let panelInfo = null;
    if (panel) { const r = panel.getBoundingClientRect(); panelInfo = {sel: panel.className.toString().slice(0, 40) || 'results', box: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)], out: r.right > W + 1 || r.bottom > H + 1 || r.left < -1 || r.top < -1,
      bg: getComputedStyle(panel).backgroundImage.includes('higgsfield') || [...panel.querySelectorAll('*')].some(e => getComputedStyle(e).backgroundImage.includes('higgsfield') || (e.tagName === 'IMG' && /higgsfield/.test(e.src))),
      font: getComputedStyle(panel.querySelector('h1,h2,h3,[class*="title"]') || panel).fontFamily.slice(0, 40)}; }
    const under = flags.length ? q('.aui-words, .rui-words, .aui-bar, .rui-strip, .tt').filter(e => !panel || !panel.contains(e)).map(e => e.className.toString().slice(0, 24)) : [];
    // kesilen (ellipsis) etiketler
    const ell = [...root.querySelectorAll('*')].filter(e => vis(e) && e.children.length === 0 && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).textOverflow === 'ellipsis').map(e => (e.textContent || '').trim().slice(0, 30)).slice(0, 5);
    const dbg = window.__tuslabArena3d?._debug?.models?.();
    const models = dbg ? Object.values(dbg).map(m => `${m.fighter}:${m.variant || '?'}:${m.loaded ? 'ok' : m.loading ? 'load' : 'none'}:h${m.height != null ? Number(m.height).toFixed(2) : '?'}`) : null;
    const ae = document.activeElement;
    return {state, issues, cardInfo, panelInfo, under, ell, models, focus: ae ? (ae.id || ae.tagName) : null, title: (root.querySelector('.rui-title, .aui-title')?.textContent || '').slice(0, 24)};
  });
  const log = []; let prevKey = ''; const t0 = Date.now(); let typed = 0, lastType = 0, focusAtTyping = [];
  while (Date.now() - t0 < P.maxMs) {
    const s = await snap();
    const key = s.state + '|' + s.title;
    if (key !== prevKey) { log.push({t: Date.now() - t0, ...s}); prevKey = key; if (s.state === 'typing') focusAtTyping.push(s.focus); }
    if (s.state === 'pvp15-results-open' || s.state.includes('pvp15-results-open')) { await page.waitForTimeout(1200); log.push({t: Date.now() - t0, final: true, ...(await snap())}); break; }
    if (s.state === 'typing' && Date.now() - lastType > P.typeEvery) {
      const w = await page.evaluate(() => (document.querySelector('.rui-word.is-active, .aui-word.is-active')?.textContent || document.querySelector('[data-tt-target]')?.textContent || '').trim());
      if (w && w.length > 1 && !/[✓]/.test(w)) { await page.keyboard.type(w, {delay: 12}); await page.keyboard.press('Space'); typed++; lastType = Date.now(); }
    }
    await page.waitForTimeout(120);
  }
  const con = await page.evaluate(() => window.__errs || []);
  // sıkıştır: sorunlu olmayan alanları at
  const slim = log.map(e => { const o = {t: e.t, state: e.state, title: e.title}; if (e.final) o.final = true; if (e.issues?.length) o.issues = e.issues; if (e.cardInfo) o.cards = e.cardInfo; if (e.panelInfo) o.panel = e.panelInfo; if (e.under?.length) o.under = e.under; if (e.ell?.length) o.ell = e.ell; if (e.state === 'typing') o.focus = e.focus; return o; });
  return {mode: P.mode, vp: `${P.w}x${P.h}`, typed, ms: Date.now() - t0, models: log.at(-1)?.models, modelsStart: log[0]?.models, focusAtTyping, events: slim.slice(0, 40), con};
}
