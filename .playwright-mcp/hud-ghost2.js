// Hayalet can tanı: computed transition + elle hasar simülasyonu yerine gerçek vuruşta 0/100/300/600 ms örnekleri.
async (page) => {
  await page.setViewportSize({width: 1366, height: 768});
  await page.goto('http://127.0.0.1:5176/index.html?pvp=practice&mode=rounds&bot=easy&karakter=vargr&fighter1=vargr&fighter2=nyx');
  await page.waitForSelector('.fhud2-seat-1 .fhud2-fill', {state: 'attached', timeout: 40000});
  await page.evaluate(() => {
    window.__s = [];
    const sx = t => (t && t !== 'none' ? parseFloat(t.slice(7)) : 1);
    const side = document.querySelector('.fhud2-seat-1'), fill = side.querySelector('.fhud2-fill'), ghost = side.querySelector('.fhud2-ghost');
    window.__tr = getComputedStyle(ghost).transition;
    let last = 1;
    new MutationObserver(() => {
      const now = sx(fill.style.transform);
      if (now < last - 0.001) { const row = {to: now}; window.__s.push(row); for (const ms of [0, 100, 300, 600, 1000]) setTimeout(() => { row['t' + ms] = [sx(getComputedStyle(fill).transform).toFixed(3), sx(getComputedStyle(ghost).transform).toFixed(3)].join('/'); }, ms); }
      last = now;
    }).observe(fill, {attributes: true, attributeFilter: ['style']});
  });
  const t0 = Date.now();
  while (Date.now() - t0 < 40000) {
    const w = await page.evaluate(() => (document.querySelector('[data-tt-target]')?.textContent || '').trim()).catch(() => '');
    if (w && w.length > 1 && !/[✓…]/.test(w)) { await page.keyboard.type(w, {delay: 4}); await page.keyboard.press('Space'); }
    await page.waitForTimeout(50);
  }
  await page.waitForTimeout(1500);
  return await page.evaluate(() => ({tr: window.__tr, s: window.__s.slice(0, 4)}));
}
