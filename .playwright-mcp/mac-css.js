async (page) => {
  await page.setViewportSize({width: 1366, height: 768});
  await page.goto('http://127.0.0.1:5176/index.html?pvp=practice&mode=rounds&bot=easy&karakter=vargr&fighter1=vargr&fighter2=nyx');
  await page.waitForTimeout(9000);
  return page.evaluate(() => { const t = document.querySelector('.rui-title'); const r = document.querySelector('#pvp-root');
    return {layout: r.dataset.layout, pos: getComputedStyle(t).position, css: [...document.querySelectorAll('link[rel=stylesheet]')].map(l => l.href.split('/').pop()).filter(x => /match-info|rounds/.test(x)), cls: r.className.slice(0, 120)}; });
}
