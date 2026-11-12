// Maç ekranı DOM dökümü (keşif). Parametreler: {mode, w, h}
async (page) => {
  const P = Object.assign({mode: 'rounds', w: 1366, h: 768}, JSON.parse(await page.evaluate(() => localStorage.getItem('__ui') || '{}')));
  await page.setViewportSize({width: P.w, height: P.h});
  await page.goto(`http://127.0.0.1:5176/index.html?pvp=practice&mode=${P.mode}&bot=easy&karakter=vargr&fighter1=vargr&fighter2=nyx`);
  await page.waitForTimeout(9000);
  return page.evaluate(() => {
    const root = document.querySelector('#pvp-root');
    const vis = e => { const r = e.getBoundingClientRect(); const c = getComputedStyle(e); return !e.hidden && r.width > 1 && r.height > 1 && c.display !== 'none' && c.visibility !== 'hidden'; };
    const out = [];
    for (const e of root.querySelectorAll('[class*="rui-"],[class*="aui-"],[class*="pvp2-side"],[class*="pvp2-health"],[data-tt-target],[class*="tt-"]')) {
      if (!vis(e)) continue; const r = e.getBoundingClientRect();
      out.push(`${e.tagName.toLowerCase()}.${String(e.className).slice(0, 40)} [${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}] ${(e.children.length ? '' : (e.textContent || '').trim().slice(0, 20))}`);
    }
    return out.slice(0, 120);
  });
}
