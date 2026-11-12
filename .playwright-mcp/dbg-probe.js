async (page) => {
  await page.setViewportSize({width: 1366, height: 768});
  await page.goto('http://127.0.0.1:5176/index.html?pvp=practice&mode=rounds&bot=easy&karakter=vargr&fighter1=vargr&fighter2=nyx');
  await page.waitForTimeout(4000);
  await page.mouse.click(300, 300);
  await page.waitForTimeout(3000);
  return await page.evaluate(() => ({url: location.href, root: document.querySelector('#pvp-root')?.className, btns: [...document.querySelectorAll('[data-pvp15-action]')].map(b => b.dataset.pvp15Action + ':' + b.hidden), title: document.title, text: document.body.innerText.slice(0, 300)}));
}
