// KESINYAP iş 9: ana ekran yatay taşma kontrolü. node .playwright-mcp/run.mjs .playwright-mcp/home-overflow-probe.js '{"w":1366,"h":768}'
async (page) => {
  const P = Object.assign({w: 1366, h: 768}, JSON.parse(process.argv[3] || '{}'));
  await page.setViewportSize({width: P.w, height: P.h});
  await page.goto('http://127.0.0.1:5176/index.html');
  await page.waitForTimeout(4000);
  return await page.evaluate(() => {
    const d = document.documentElement, img = document.querySelector('#panel-arena .arena-backdrop img');
    const b = img?.getBoundingClientRect();
    return {vw: innerWidth, scrollW: d.scrollWidth, bodyScrollW: document.body.scrollWidth, hOverflow: d.scrollWidth > innerWidth + 1,
      imgRight: b && Math.round(b.right), imgLeft: b && Math.round(b.left), imgInViewportX: b ? b.left >= -1 && b.right <= innerWidth + 1 : null};
  });
}
