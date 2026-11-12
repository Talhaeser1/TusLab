async (page) => {
  const P = JSON.parse(await page.evaluate(() => localStorage.getItem('__ui') || '{}'));
  await page.evaluate(() => { localStorage.setItem('tuslab-pvp-practice-round-style', 'counted'); localStorage.setItem('tuslab-pvp-practice-rounds', '5'); });
  await page.setViewportSize({width: 1366, height: 768});
  await page.goto(`http://127.0.0.1:5176/index.html?pvp=practice&mode=${P.mode}&bot=easy&karakter=vargr&fighter1=vargr&fighter2=nyx`);
  await page.waitForTimeout(9500);
  const log = []; let typed = 0;
  for (let i = 0; i < 400; i++) {
    const w = await page.evaluate(() => (document.querySelector('[data-tt-target]')?.textContent || '').trim());
    if (w && w.length > 1 && !/[✓…]/.test(w)) { await page.keyboard.type(w, {delay: 4}); await page.keyboard.press('Space'); typed++; }
    if (i % 60 === 0) log.push(await page.evaluate(() => (document.querySelector('[data-round-label]')?.textContent || '') + '|' + document.querySelector('#pvp-root').className.match(/(rui-inter-open|aui-summary-open|pvp15-results-open)/)?.[0] + '|' + (document.querySelector('[data-tt-target]')?.textContent || '').slice(0, 30)));
    await page.waitForTimeout(60);
  }
  return {typed, log};
}
