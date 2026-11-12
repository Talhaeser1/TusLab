// Teşhis: sayfa açılıyor mu, 3B arena ve modeller hazır mı?
async (page) => {
  const fs = await import('node:fs');
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  const fails = []; page.on('requestfailed', r => fails.push(r.url().split('/').slice(-2).join('/')));
  const cons = []; page.on('console', m => { if (/error|warn/i.test(m.type())) cons.push(m.text().slice(0, 160)); });
  const list = fs.readFileSync('.playwright-mcp/head/list.txt', 'utf8').split(/\r?\n/).filter(Boolean);
  for (const f of list) await page.route(`**/${f}`, route => route.fulfill({status: 200, contentType: 'text/javascript', body: fs.readFileSync(`.playwright-mcp/head/${f}`, 'utf8')}));
  await page.setViewportSize({width: 1366, height: 768});
  await page.goto('http://127.0.0.1:5176/index.html?pvp=practice&mode=rounds&bot=easy&karakter=vargr&fighter1=vargr&fighter2=doran&animprobe=1');
  await page.waitForTimeout(9000);
  return await page.evaluate(() => ({arena: Boolean(window.__tuslabArena3d), q: Boolean(window.__tuslabVisualQueue), cls: document.querySelector('#pvp-root')?.className, hidden: document.querySelector('#pvp-root')?.hidden,
    models: (() => { try { return window.__tuslabArena3d._debug.models(); } catch (e) { return String(e); } })(),
    word: document.querySelector('.rui-word.is-active, .aui-word.is-active')?.textContent || document.querySelector('[data-tt-target]')?.textContent})).then(r => ({...r, errs, fails: fails.slice(0, 10), cons: cons.slice(0, 10)}));
}
