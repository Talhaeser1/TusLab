// J2 yardımcı: seçili elemanların kutuları (varsayılan 1366x768)
async (page) => {
  const p = JSON.parse(await page.evaluate(() => localStorage.getItem('__ui') || '{}'));
  const [w, h] = p.size || [1366, 768];
  await page.setViewportSize({width: w, height: h});
  await page.goto('http://127.0.0.1:5176/index.html'); await page.waitForTimeout(1500);
  await page.evaluate(() => { const e = [...document.querySelectorAll('button, a, [role="button"], [data-view], [data-nav]')].find(x => /PvP Modlar/.test(x.textContent)); e?.click(); });
  await page.waitForSelector('.lb3-fighter', {timeout: 8000}).catch(() => {}); await page.waitForTimeout(1000);
  return await page.evaluate((sels) => sels.map(s => [...document.querySelectorAll(s)].slice(0, 6).map(e => { const b = e.getBoundingClientRect(); return `${s} ${Math.round(b.left)},${Math.round(b.top)} ${Math.round(b.width)}x${Math.round(b.height)}`; })).flat(),
    p.sels || ['.lb3-head', '.j2-modes', '.j2-settings', '.j2-settings .rui-picker', '.j2-arena', '.j2-online', '.j2-online > *', '.j2-go', '.j2-info']);
}
