// Çözüm (SALDIRI SIRASI) anında başlık/announce/words/tt dikdörtgenleri. __ui:{mode,w,h}
async (page) => {
  const P = Object.assign({mode: 'rounds', w: 1366, h: 768}, JSON.parse(await page.evaluate(() => localStorage.getItem('__ui') || '{}')));
  await page.setViewportSize({width: P.w, height: P.h});
  await page.goto(`http://127.0.0.1:5176/index.html?pvp=practice&mode=${P.mode}&bot=easy&karakter=vargr&fighter1=vargr&fighter2=nyx`);
  await page.waitForTimeout(6000);
  const t0 = Date.now(); const shots = [];
  while (Date.now() - t0 < 140000 && shots.length < 2) {
    const r = await page.evaluate(() => {
      const b = document.querySelector('.rsv-banner'); if (!b) return null; const br = b.getBoundingClientRect(), c = getComputedStyle(b); if (br.width < 5 || c.display === 'none') return null;
      const f = s => [...document.querySelectorAll(s)].map(e => { const r = e.getBoundingClientRect(); return `${s} ${e.className.toString().slice(0, 30)} [${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}] ${getComputedStyle(e).display} ${(e.textContent || '').trim().slice(0, 25)}`; });
      return [...f('.rsv-banner'), ...f('.pvp2-announce'), ...f('.pvp2-announce *').filter(s => !/ 0,0\]|\[0,0,0,0\]/.test(s)), ...f('.pvp-attack-callout'), ...f('.pvp-combo-counter')].map(s => s.slice(0, 110));
    }).catch(() => null);
    if (r) { shots.push(r); await page.waitForTimeout(1500); }
    const w = await page.evaluate(() => (document.querySelector('[data-tt-target]')?.textContent || '').trim()).catch(() => '');
    if (w && w.length > 1 && !/[✓…]/.test(w)) { await page.keyboard.type(w, {delay: 4}); await page.keyboard.press('Space'); }
    await page.waitForTimeout(150);
  }
  return shots;
}
