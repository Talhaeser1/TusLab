// P0 ekran kontrolü: VS yok, üst yazı yok, rol etiketi kesik değil, özet/maç sonu tasarımı, alt panel gizli, küçük yazı, taşma.
async (page) => {
  const P = Object.assign({mode: 'rounds', w: 1366, h: 768, f1: 'vargr', f2: 'nyx', maxMs: 330000, typeEvery: 300}, JSON.parse(await page.evaluate(() => localStorage.getItem('__ui') || '{}').catch(() => '{}')));
  await page.setViewportSize({width: P.w, height: P.h});
  await page.goto(`http://127.0.0.1:5176/index.html?pvp=practice&mode=${P.mode}&bot=easy&karakter=${P.f1}&fighter1=${P.f1}&fighter2=${P.f2}`);
  const snap = () => page.evaluate(() => {
    const root = document.querySelector('#pvp-root'); if (!root) return {state: 'no-root'};
    const W = innerWidth, H = innerHeight;
    const vis = e => { if (!e || e.hidden) return false; const r = e.getBoundingClientRect(); const c = getComputedStyle(e); if (!(r.width > 2 && r.height > 2) || c.display === 'none' || c.visibility === 'hidden' || Number(c.opacity) < 0.05) return false; if (c.clip === 'rect(0px, 0px, 0px, 0px)' || c.clipPath === 'inset(50%)') return false; return r.right > 0 && r.bottom > 0 && r.left < W && r.top < H; };
    const q = s => [...root.querySelectorAll(s)].filter(vis);
    const txt = e => (e.textContent || '').replace(/\s+/g, ' ').trim();
    const flags = ['rui-inter-open', 'aui-summary-open', 'pvp15-results-open'].filter(f => root.classList.contains(f));
    const title = txt(root.querySelector('.rui-title, .aui-title') || {textContent: ''}).slice(0, 22);
    const out = {state: flags.join('+') || 'play', title, bad: []};
    if (document.documentElement.scrollWidth > W + 1) out.bad.push(`hscroll ${document.documentElement.scrollWidth}`);
    const vs = q('.fhud-layer').map(txt).filter(t => /\bVS\b|OYUNCU 1/.test(t)); if (vs.length) out.bad.push('VS:' + vs[0].slice(0, 40));
    out.hud = q('.fhud-layer').map(txt).join('|').slice(0, 60) || undefined;
    const top = q('[data-match-status], [data-practice-chip]').map(txt).filter(t => /CANLI|ANTRENMAN|çevrimdışı/i.test(t)); if (top.length) out.bad.push('TOP:' + top.join('/').slice(0, 50));
    const anyTop = [...root.querySelectorAll('*')].filter(e => e.children.length === 0 && vis(e) && /CANLI MAÇ|ANTRENMAN ·|çevrimdışı/.test(txt(e))).map(e => `${e.className}:${txt(e).slice(0, 30)}`); if (anyTop.length) out.bad.push('TOPTXT:' + anyTop.slice(0, 2).join('|'));
    // rol etiketi (Kılıç · A) kesilmesi
    for (const e of q('.pvp2-role')) { const r = e.getBoundingClientRect(); const c = getComputedStyle(e); if (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1 || r.left < -1 || r.right > W + 1 || r.bottom > H + 1) out.bad.push(`ROLE-CLIP:${txt(e).slice(0, 24)} sw${e.scrollWidth}/cw${e.clientWidth} sh${e.scrollHeight}/ch${e.clientHeight} ${c.overflow}`); }
    // küçük yazı
    const small = [...root.querySelectorAll('*')].filter(e => vis(e) && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1) && parseFloat(getComputedStyle(e).fontSize) < 12).map(e => `${(e.className || e.tagName).toString().slice(0, 22)}:${parseFloat(getComputedStyle(e).fontSize)}`);
    if (small.length) out.small = [...new Set(small)].slice(0, 6);
    if (flags.length) {
      const panel = q('.rui-inter, .aui-summary, [data-pvp15-results]')[0];
      if (!panel) out.bad.push('PANEL-YOK'); else {
        const r = panel.getBoundingClientRect();
        const head = [...panel.querySelectorAll('.rui-res-line, .aui-sum-winner, .pvp15-title, .m33-title, h1, h2, h3, [class*="title"]')].filter(vis)[0];
        const hs = head ? getComputedStyle(head) : null;
        const bg = [panel, ...panel.querySelectorAll('*')].some(e => /higgsfield/.test(getComputedStyle(e).backgroundImage) || /higgsfield/.test(getComputedStyle(e, '::before').backgroundImage) || (e.tagName === 'IMG' && /higgsfield/.test(e.src)));
        out.panel = {box: [r.left, r.top, r.right, r.bottom].map(Math.round), head: head ? `${head.className.toString().slice(0, 20)}:"${txt(head).slice(0, 24)}" ${parseFloat(hs.fontSize)}px ${hs.fontFamily.slice(0, 14)}` : 'baslik-yok', bg};
        if (r.right > W + 1 || r.bottom > H + 1 || r.left < -1 || r.top < -1) out.bad.push('PANEL-TASMA');
        const under = q('.tt, .aui-words, .rui-words, .rui-strip').filter(e => !panel.contains(e)).map(e => e.className.toString().slice(0, 20)); if (under.length) out.bad.push('ALT-PANEL:' + under.join(','));
        const lbl = [...root.querySelectorAll('*')].filter(e => e.children.length === 0 && vis(e) && !panel.contains(e) && /ARENA · RAUND|SENİN KELİMEN|RAKİP YAZIYOR/.test(txt(e))).map(e => txt(e).slice(0, 30)); if (lbl.length) out.bad.push('ALT-ETIKET:' + lbl[0]);
      }
    }
    return out;
  });
  const log = []; let prev = ''; const t0 = Date.now(); let typed = 0, lastType = 0;
  const allBad = new Set(), allSmall = new Set();
  while (Date.now() - t0 < P.maxMs) {
    const s = await snap().catch(() => ({state: 'err', bad: []}));
    (s.bad || []).forEach(b => allBad.add(`[${s.state}] ${b}`)); (s.small || []).forEach(b => allSmall.add(b));
    const key = s.state + '|' + s.title + '|' + (s.hud || '');
    if (key !== prev) { const o = {t: Date.now() - t0, state: s.state, title: s.title}; if (s.hud) o.hud = s.hud; if (s.panel) o.panel = s.panel; log.push(o); prev = key; }
    if (s.state.includes('pvp15-results-open')) { await page.waitForTimeout(1500); const f = await snap(); log.push({t: Date.now() - t0, final: true, panel: f.panel}); (f.bad || []).forEach(b => allBad.add(`[final] ${b}`)); break; }
    if (s.state === 'play' && Date.now() - lastType > P.typeEvery) {
      const w = await page.evaluate(() => (document.querySelector('.rui-word.is-active, .aui-word.is-active')?.textContent || document.querySelector('[data-tt-target]')?.textContent || '').trim());
      if (w && w.length > 1 && !/[✓]/.test(w)) { await page.keyboard.type(w, {delay: 10}); await page.keyboard.press('Space'); typed++; lastType = Date.now(); }
    }
    await page.waitForTimeout(150);
  }
  return {mode: P.mode, vp: `${P.w}x${P.h}`, typed, ms: Date.now() - t0, BAD: [...allBad].slice(0, 20), SMALL: [...allSmall].slice(0, 12), events: log.slice(0, 45)};
}
