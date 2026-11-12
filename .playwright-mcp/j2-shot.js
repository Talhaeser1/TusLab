// J2 ekran görüntüsü: lobi (çözünürlük listesi __ui parametresinden)
async (page) => {
  const p = JSON.parse(await page.evaluate(() => localStorage.getItem('__ui') || '{}'));
  const sizes = p.sizes || [[1920, 1080]];
  const out = [];
  for (const [w, h] of sizes) {
    await page.setViewportSize({width: w, height: h});
    await page.goto('http://127.0.0.1:5176/index.html'); await page.waitForTimeout(1500);
    await page.evaluate(() => { const e = [...document.querySelectorAll('button, a, [role="button"], [data-view], [data-nav]')].find(x => /PvP Modlar/.test(x.textContent)); e?.click(); });
    await page.waitForSelector('.lb3-fighter, .j2-char', {timeout: 8000}).catch(() => {}); await page.waitForTimeout(1200);
    await page.screenshot({path: `.playwright-mcp/j2-${w}.png`, fullPage: true});
    out.push(`${w}x${h} ok`);
  }
  return out;
}
