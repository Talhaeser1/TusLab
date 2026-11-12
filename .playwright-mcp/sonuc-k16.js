// KESINYAP 16 ölçümü: sonuç ekranı adlar tam, blok satırı yok, şerit/en iyi an dolu, <12px yok, taşma yok. Params: mode,w,h
async (page) => {
  const P = Object.assign({mode: 'rounds', w: 1366, h: 768}, JSON.parse(await page.evaluate(() => { try { return localStorage.getItem('__ui') || '{}'; } catch { return '{}'; } }).catch(() => '{}')));
  await page.evaluate(() => { localStorage.setItem('tuslab-pvp-practice-round-style', 'counted'); localStorage.setItem('tuslab-pvp-practice-rounds', '5'); });
  await page.setViewportSize({width: P.w, height: P.h});
  await page.goto(`http://127.0.0.1:5176/index.html?pvp=practice&mode=${P.mode}&bot=easy&karakter=vargr&fighter1=vargr&fighter2=nyx`);
  await page.waitForTimeout(P.mode === 'arena' ? 4500 : 9500);
  const t0 = Date.now(); let ok = false;
  while (Date.now() - t0 < 520000) {
    ok = await page.evaluate(() => { const t = document.querySelector('[data-pvp15-title]'); return !!(t && t.dataset.outcome && !t.closest('[data-pvp15-results]').hidden); });
    if (ok) break;
    const w = await page.evaluate(() => (document.querySelector('[data-tt-target]')?.textContent || '').trim());
    if (w && w.length > 1 && !/[✓…]/.test(w)) { await page.keyboard.type(w, {delay: 0}); await page.keyboard.press('Space'); }
    await page.waitForTimeout(10);
  }
  await page.waitForTimeout(1500);
  return await page.evaluate(() => {
    const o = document.querySelector('[data-pvp15-results]'); if (!o) return {ok: false};
    const vis = e => { const r = e.getBoundingClientRect(), c = getComputedStyle(e); return r.width > 1 && r.height > 1 && c.display !== 'none' && c.visibility !== 'hidden'; };
    const small = [], trunc = [], names = [...o.querySelectorAll('.rui-res-name, .pvp15-player-name span')].map(e => e.textContent.trim() + '|' + (e.scrollWidth > e.clientWidth + 1 ? 'KESIK' : 'tam'));
    for (const e of o.querySelectorAll('*')) { if (!vis(e) || ![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue; const fs = parseFloat(getComputedStyle(e).fontSize); if (fs < 12) small.push(e.className + ' ' + fs); if (e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflowX !== 'visible') trunc.push(e.className); }
    const cards = o.querySelector('.pvp15-scorecards')?.textContent || '';
    return {ok: true, hidden: o.hidden, cls: document.querySelector('#pvp-root').className.slice(0, 200), html: o.innerHTML.replace(/\s+/g, ' ').slice(0, 1200), names, small, trunc, hscroll: document.documentElement.scrollWidth > innerWidth + 1, blockLines: /blok|savuşturma|karşı saldırı|kalkan kırma/i.test(cards), qmark: /\?|undefined|NaN/.test(cards), strip: o.querySelectorAll('.pvp15-rd').length, best: o.querySelector('[data-pvp15-best]')?.textContent || '', detail: [...o.querySelectorAll('.pvp15-detail')].map(e => e.textContent.trim())};
  });
}
