// Arena raund özeti (aui-summary) dikdörtgenleri. __ui:{w,h}
async (page) => {
  const P = Object.assign({mode: 'arena', w: 375, h: 812}, JSON.parse(await page.evaluate(() => localStorage.getItem('__ui') || '{}')));
  await page.setViewportSize({width: P.w, height: P.h});
  await page.goto(`http://127.0.0.1:5176/index.html?pvp=practice&mode=${P.mode}&bot=easy&karakter=vargr&fighter1=vargr&fighter2=nyx`);
  await page.waitForTimeout(4500);
  const t0 = Date.now(); let out = null;
  while (Date.now() - t0 < 240000 && !out) {
    out = await page.evaluate(() => {
      const root = document.querySelector('#pvp-root'); if (!root.classList.contains('aui-summary-open')) return null;
      const s = root.querySelector('.aui-summary'); if (!s) return null; const sr = s.getBoundingClientRect(); if (sr.width < 20) return null;
      const rc = e => { const b = e.getBoundingClientRect(), c = getComputedStyle(e); return `[${Math.round(b.left)},${Math.round(b.top)},${Math.round(b.right)},${Math.round(b.bottom)}] pos:${c.position} ov:${c.overflowY} sh:${e.scrollHeight}/${e.clientHeight}`; };
      const rows = [`summary ${s.className.toString().slice(0, 30)} ${rc(s)}`];
      for (const c of s.querySelectorAll('*')) { const b = c.getBoundingClientRect(); if (b.width > 30 && b.height > 10 && c.children.length < 8 && (b.bottom > innerHeight - 60)) rows.push(`${c.className.toString().split(' ')[0] || c.tagName} ${rc(c)} ${(c.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 20)}`); }
      return {vp: [innerWidth, innerHeight], rows: rows.slice(0, 20)};
    }).catch(() => null);
    if (!out) {
      const w = await page.evaluate(() => { const root = document.querySelector('#pvp-root'); return (document.querySelector('[data-tt-target]')?.textContent || '').trim(); }).catch(() => '');
      if (w && w.length > 1 && !/[✓…]/.test(w)) { await page.keyboard.type(w, {delay: 4}); await page.keyboard.press('Space'); }
      await page.waitForTimeout(120);
    }
  }
  return out;
}
