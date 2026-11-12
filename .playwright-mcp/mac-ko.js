async (page) => {
  const P = JSON.parse(await page.evaluate(() => localStorage.getItem('__ui') || '{}'));
  await page.evaluate(s => { localStorage.setItem('tuslab-pvp-practice-round-style', s); localStorage.setItem('tuslab-pvp-practice-rounds', '5'); }, P.style || 'counted');
  await page.setViewportSize({width: 1366, height: 768});
  await page.goto(`http://127.0.0.1:5176/index.html?pvp=practice&mode=${P.mode}&bot=easy&karakter=vargr&fighter1=vargr&fighter2=nyx`);
  await page.waitForTimeout(P.mode === 'arena' ? 4500 : 9500);
  const t0 = Date.now(); let res = null;
  while (Date.now() - t0 < (P.ms || 150000)) {
    res = await page.evaluate(() => { const t = document.querySelector('[data-pvp15-title]'); const o = t && t.offsetParent !== null ? t.dataset.outcome + ':' + t.textContent : null; return o; });
    if (res) break;
    const w = await page.evaluate(() => (document.querySelector('[data-tt-target]')?.textContent || '').trim());
    if (w && w.length > 1 && !/[✓…]/.test(w)) { await page.keyboard.type(w, {delay: 4}); await page.keyboard.press('Space'); }
    await page.waitForTimeout(60);
  }
  const score = await page.evaluate(() => (document.querySelector('.rui-res-score, [data-rui-scoreline], .pvp15-score')?.textContent || '').trim().slice(0, 40));
  return {mode: P.mode, outcome: res, score, secs: Math.round((Date.now() - t0) / 1000)};
}
