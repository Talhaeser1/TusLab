// fps ölçümü
async (page) => {
  await page.setViewportSize({width: 1366, height: 768});
  await page.goto('http://127.0.0.1:5176/index.html?pvp=practice&mode=rounds&bot=easy&karakter=vargr&fighter1=vargr&fighter2=nyx');
  await page.waitForTimeout(4000);
  await page.evaluate(() => { window.__f = {raf: 0, iv: 0}; const l = () => { window.__f.raf++; requestAnimationFrame(l); }; l(); setInterval(() => window.__f.iv++, 50); });
  await page.waitForTimeout(8000);
  return await page.evaluate(() => ({...window.__f, q: window.__tuslabVisualQueue?.snapshot?.(), models: window.__tuslabArena3d?._debug?.models?.(), dbg: Object.keys(window.__tuslabArena3d?._debug || {})}));
}
