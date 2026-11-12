async (page) => {
  const P = JSON.parse(await page.evaluate(() => localStorage.getItem('__ui') || '{}'));
  await page.setViewportSize({width: 375, height: 812});
  await page.goto(`http://127.0.0.1:5176/index.html?pvp=practice&mode=${P.mode}&bot=easy&karakter=vargr&fighter1=vargr&fighter2=nyx`);
  await page.waitForTimeout(9000);
  return await page.evaluate(() => { const out = []; let e = document.querySelector('[data-round-clock]'); while (e && e.id !== 'pvp-root') { const r = e.getBoundingClientRect(), c = getComputedStyle(e); out.push(`${e.tagName}.${e.className} pos=${c.position} ${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}`); e = e.parentElement; } return out; });
}
