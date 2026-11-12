// Raund arası anında kart/beceri seçimi dikdörtgenleri + kaydırma ölçüleri. __ui:{w,h}
async (page) => {
  const P = Object.assign({mode: 'rounds', w: 375, h: 812}, JSON.parse(await page.evaluate(() => localStorage.getItem('__ui') || '{}')));
  await page.setViewportSize({width: P.w, height: P.h});
  await page.goto(`http://127.0.0.1:5176/index.html?pvp=practice&mode=${P.mode}&bot=easy&karakter=vargr&fighter1=vargr&fighter2=nyx`);
  await page.waitForTimeout(6000);
  const t0 = Date.now(); let out = null;
  while (Date.now() - t0 < 150000 && !out) {
    out = await page.evaluate(() => {
      const root = document.querySelector('#pvp-root'); if (!root.classList.contains('rui-inter-open')) return null;
      const f = s => [...root.querySelectorAll(s)].filter(e => { const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2; }).map(e => { const r = e.getBoundingClientRect(), c = getComputedStyle(e); return `${s} [${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}] pos:${c.position} ov:${c.overflowY} ${(e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24)}`; });
      const card = root.querySelector('.aui-card'); const chain = []; for (let p = card; p && p !== document.documentElement; p = p.parentElement) { const c = getComputedStyle(p), r = p.getBoundingClientRect(); chain.push(`${p.tagName}.${p.className.toString().split(' ')[0]} [${Math.round(r.top)},${Math.round(r.bottom)}] ov:${c.overflowY} pos:${c.position} sh:${p.scrollHeight}/${p.clientHeight}`); }
      return {vp: [innerWidth, innerHeight], doc: [document.documentElement.scrollHeight, document.documentElement.scrollTop], rows: [...f('.rui-inter'), ...f('.rui-inter *').filter(s => /card|choice|pick|skill/.test(s)).slice(0, 12)], chain: chain.slice(0, 8)};
    }).catch(() => null);
    if (!out) {
      const w = await page.evaluate(() => (document.querySelector('[data-tt-target]')?.textContent || '').trim()).catch(() => '');
      if (w && w.length > 1 && !/[✓…]/.test(w)) { await page.keyboard.type(w, {delay: 4}); await page.keyboard.press('Space'); }
      await page.waitForTimeout(150);
    }
  }
  if (out) { await page.waitForTimeout(1500); }
  return out;
}
