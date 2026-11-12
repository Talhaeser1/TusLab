// HUD v2 ölçümü: çakışma, taşma, <12px yazı, halka dolumu, atım, hayalet can, sayfa hatası. Params: mode,w,h,secs
async (page) => {
  const P = Object.assign({mode: 'rounds', w: 1366, h: 768, secs: 40}, JSON.parse(await page.evaluate(() => { try { return localStorage.getItem('__ui') || '{}'; } catch { return '{}'; } }).catch(() => '{}')));
  await page.setViewportSize({width: P.w, height: P.h});
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  page.on('console', m => { if (m.type() === 'error') errs.push('console:' + m.text().slice(0, 120)); });
  await page.goto(`http://127.0.0.1:5176/index.html?pvp=practice&mode=${P.mode}&bot=easy&karakter=vargr&fighter1=vargr&fighter2=nyx`);
  await page.waitForTimeout(P.mode === 'arena' ? 4500 : 7000);
  await page.evaluate(() => { window.__h = {small: new Set(), over: new Set(), off: new Set(), ov: new Set(), states: {}, dash: {}, cast: 0, ghost: 0, maxSeries: 0, low: 0, notchVar: '', samples: 0, senVisible: 0, emptyStrip: 0, hpTexts: new Set()}; });
  const SAMPLE = () => {
    const H = window.__h, root = document.querySelector('#pvp-root'), W = innerWidth, HH = innerHeight; H.samples++;
    const vis = e => { const r = e.getBoundingClientRect(), c = getComputedStyle(e); if (r.width < 2 || r.height < 2 || c.display === 'none' || c.visibility === 'hidden') return false; for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) { const pc = getComputedStyle(p); if (pc.display === 'none' || pc.visibility === 'hidden') return false; } return true; };
    const nm = e => (e.className && e.className.toString ? e.className.toString().split(' ')[0] : e.tagName) + '«' + (e.textContent || '').trim().slice(0, 14) + '»';
    for (const e of root.querySelectorAll('.fhud2 *, .mi *, .tt *, .rui-medal *, .aui-medal *')) {
      if (!vis(e)) continue;
      const own = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
      if (!own) continue;
      const fs = parseFloat(getComputedStyle(e).fontSize); if (fs < 12) H.small.add(nm(e) + ' ' + fs);
      const r = e.getBoundingClientRect(); if (r.right > W + 1 || r.left < -1 || r.bottom > HH + 1 || r.top < -1) H.off.add(nm(e));
      if (e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflowX !== 'visible' && e.clientWidth > 0) H.over.add(nm(e));
    }
    const groups = {s1: '.fhud2-seat-1', s2: '.fhud2-seat-2', r1: '.fhud2-rail-1', r2: '.fhud2-rail-2', tt: '.pvp2-shell>.tt', medal: '.rui-medal,.aui-medal', strip1: '.mi-strip-1', strip2: '.mi-strip-2', banner: '.rsv-banner', clock: '.mi-clock', words: '.rui-words'};
    const R = {}; for (const [k, s] of Object.entries(groups)) { const e = [...root.querySelectorAll(s)].find(vis); if (e) R[k] = e.getBoundingClientRect(); }
    const ks = Object.keys(R);
    for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) { const a = R[ks[i]], b = R[ks[j]]; const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left), iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top); if (ix > 3 && iy > 3) H.ov.add(`${ks[i]}×${ks[j]} ${Math.round(ix)}x${Math.round(iy)}`); }
    const s1 = root.querySelector('.fhud2-seat-1');
    if (s1 && !s1.hidden) {
      const n = Number(s1.querySelector('.fhud2-ser-n span')?.textContent) || 0; H.maxSeries = Math.max(H.maxSeries, n);
      const fill = getComputedStyle(s1.querySelector('.fhud2-fill')).transform, ghost = getComputedStyle(s1.querySelector('.fhud2-ghost')).transform;
      const sx = t => (t && t !== 'none' ? parseFloat(t.slice(7)) : 0);
      if (sx(ghost) - sx(fill) > 0.01) H.ghost++;
      if (s1.classList.contains('is-low')) H.low++;
      H.notchVar = s1.querySelector('.fhud2-bar').style.getPropertyValue('--fhud-notch');
      H.hpTexts.add(s1.querySelector('.fhud2-hp').textContent);
    }
    for (const c of root.querySelectorAll('.fhud2-rail-1 .fhud2-sk')) {
      const k = c.dataset.key; H.states[k] = H.states[k] || new Set(); H.states[k].add(c.dataset.state);
      H.dash[k] = H.dash[k] || new Set(); H.dash[k].add(c.querySelector('.hx-prog').getAttribute('stroke-dasharray').split(' ')[0]);
      if (c.classList.contains('is-cast')) H.cast++;
    }
    const sen = root.querySelector('[data-sen-badge]'); if (sen && vis(sen)) H.senVisible++;
    for (const st of root.querySelectorAll('.mi-strip')) if (vis(st) && !st.querySelector('.mi-words')?.children.length && !st.querySelector('.mi-live:not([hidden])')) H.emptyStrip++;
    root.classList.contains('rui-inter-open') && (H.inter = (H.inter || 0) + 1);
  };
  const t0 = Date.now(); let typed = 0;
  while (Date.now() - t0 < P.secs * 1000) {
    await page.evaluate(SAMPLE).catch(() => {});
    const w = await page.evaluate(() => { const root = document.querySelector('#pvp-root'); if (['rui-inter-open', 'aui-summary-open'].some(f => root?.classList.contains(f))) return ''; return (document.querySelector('[data-tt-target]')?.textContent || '').trim(); }).catch(() => '');
    if (w && w.length > 1 && !/[✓…]/.test(w)) { await page.keyboard.type(w, {delay: 4}); await page.keyboard.press('Space'); typed++; }
    await page.waitForTimeout(60);
  }
  const out = await page.evaluate(() => { const H = window.__h; const o = {}; for (const k of Object.keys(H)) o[k] = H[k] instanceof Set ? [...H[k]].slice(0, 12) : H[k]; o.states = Object.fromEntries(Object.entries(H.states).map(([k, v]) => [k, [...v]])); o.dash = Object.fromEntries(Object.entries(H.dash).map(([k, v]) => [k, [...v].slice(0, 10)])); return o; });
  return {mode: P.mode, vp: `${P.w}x${P.h}`, typed, errs: errs.slice(0, 5), ...out};
}
