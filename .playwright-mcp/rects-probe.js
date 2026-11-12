// Seçili öğelerin dikdörtgenlerini döker (play durumu). __ui: {mode,w,h,sel:[...] ,wait}
async (page) => {
  const P = Object.assign({mode: 'classic', w: 1366, h: 768, wait: 9000, sel: ['.pvp2-side', '.tt', '.tt-type', '[data-tt-target]', '.pvp2-role', '.pvp24-chip', '.rsv-banner', '.pvp-attack-callout', '.pvp-combo-counter']}, JSON.parse(await page.evaluate(() => localStorage.getItem('__ui') || '{}')));
  await page.setViewportSize({width: P.w, height: P.h});
  await page.goto(`http://127.0.0.1:5176/index.html?pvp=practice&mode=${P.mode}&bot=easy&karakter=vargr&fighter1=vargr&fighter2=nyx`);
  await page.waitForTimeout(P.wait);
  return await page.evaluate(sels => sels.map(s => [...document.querySelectorAll(s)].map(e => { const r = e.getBoundingClientRect(), c = getComputedStyle(e); return `${s} ${e.className.toString().slice(0, 40)} [${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}] ${c.display}/${c.visibility}/o${c.opacity} fs${c.fontSize} ${(e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30)}`; })).flat(), P.sel);
}
