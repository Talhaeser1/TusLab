// Dövüş sunumu ölçümü: sıra sıra saldırı, kombo sayacı, saldırı yazısı, kritik katmanı, model durumları.
async (page) => {
  const P = Object.assign({mode: 'rounds', w: 1366, h: 768, f1: 'vargr', f2: 'nyx', maxMs: 75000}, globalThis.__P || {});
  await page.setViewportSize({width: P.w, height: P.h});
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.goto(`http://127.0.0.1:5176/index.html?pvp=practice&mode=${P.mode}&bot=easy&karakter=${P.f1}&fighter1=${P.f1}&fighter2=${P.f2}`);
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    const L = window.__dv = {samples: [], combo: new Set(), callout: new Set(), crit: new Set(), status: new Set(), both: 0, n: 0, phases: [], lastKey: ''};
    const txt = e => (e?.textContent || '').replace(/\s+/g, ' ').trim();
    const vis = e => { if (!e) return false; const r = e.getBoundingClientRect(), c = getComputedStyle(e); return r.width > 2 && r.height > 2 && c.display !== 'none' && c.visibility !== 'hidden' && Number(c.opacity) > 0.05; };
    const t0 = performance.now();
    setInterval(() => {
      L.n++;
      let q = null, m = null;
      try { q = window.__tuslabVisualQueue?.snapshot?.(); } catch { /* yok */ }
      try { m = window.__tuslabArena3d?._debug?.models?.(); } catch { /* yok */ }
      const cc = document.querySelector('[data-combo-counter]'), ac = document.querySelector('[data-attack-callout]'), cr = document.querySelector('[data-crit-text]');
      if (vis(cc)) L.combo.add(txt(cc)); if (vis(ac)) L.callout.add(txt(ac) + ' @' + Math.round(ac.getBoundingClientRect().top) + ' fs' + parseFloat(getComputedStyle(ac).fontSize));
      if (vis(cr)) L.crit.add(txt(cr) + ' op' + getComputedStyle(cr).opacity);
      for (const s of document.querySelectorAll('[data-status]')) if (vis(s)) L.status.add(s.dataset.status + ':' + txt(s).slice(0, 20));
      const states = m ? (Array.isArray(m) ? m : Object.values(m)).map(x => `${x?.seat ?? ''}${x?.state ?? x?.anim ?? ''}/${x?.clip ?? ''}`) : [];
      const atk = states.filter(s => /attack|skill|ulti|[qer]\//i.test(s)).length;
      if (atk >= 2) L.both++;
      const key = JSON.stringify([q?.activeSeat, q?.phase, q?.comboIndex, q?.queued, states]);
      if (key !== L.lastKey) { L.lastKey = key; if (L.phases.length < 260) L.phases.push([Math.round(performance.now() - t0), q?.activeSeat ?? null, q?.phase ?? null, q?.comboIndex ?? null, q?.queued ?? null, states.join(' ')]); }
    }, 50);
  });
  const t0 = Date.now(); let typed = 0;
  while (Date.now() - t0 < P.maxMs) {
    const s = await page.evaluate(() => { const root = document.querySelector('#pvp-root'); const f = ['rui-inter-open', 'aui-summary-open', 'pvp15-results-open'].filter(x => root?.classList.contains(x)); return {f, w: (document.querySelector('.rui-word.is-active, .aui-word.is-active')?.textContent || document.querySelector('[data-tt-target]')?.textContent || '').trim()}; }).catch(() => ({f: [], w: ''}));
    if (s.f.includes('pvp15-results-open')) break;
    if (!s.f.length && s.w && s.w.length > 1 && !/[✓]/.test(s.w)) { await page.keyboard.type(s.w, {delay: 8}); await page.keyboard.press('Space'); typed++; }
    await page.waitForTimeout(260);
  }
  const r = await page.evaluate(() => { const L = window.__dv; return {n: L.n, both: L.both, combo: [...L.combo], callout: [...L.callout].slice(0, 14), crit: [...L.crit].slice(0, 4), status: [...L.status].slice(0, 8), phases: L.phases}; });
  r.typed = typed; r.errs = errs.slice(0, 5); r.phases = r.phases.slice(0, P.rows || 70);
  return r;
}
