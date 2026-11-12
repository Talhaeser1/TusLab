async (page) => {
  const P = JSON.parse(await page.evaluate(() => localStorage.getItem('__ui') || '{}'));
  await page.setViewportSize({width: P.w || 375, height: P.h || 812});
  await page.goto(`http://127.0.0.1:5176/index.html?pvp=practice&mode=${P.mode || 'rounds'}&bot=easy&karakter=vargr&fighter1=vargr&fighter2=nyx`);
  await page.waitForTimeout(9500);
  await page.screenshot({path: `.playwright-mcp/mac-shot-${P.mode || 'rounds'}-${P.w || 375}.png`});
  return await page.evaluate(() => { const b = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; };
    return {hp1: b('.pvp2-side[data-seat="1"] .pvp2-health'), hp2: b('.pvp2-side[data-seat="2"] .pvp2-health'), s1: b('[data-typed-strip="1"]'), s2: b('[data-typed-strip="2"]'), clock: b('[data-round-clock]'), label: b('[data-round-label]')}; });
}
