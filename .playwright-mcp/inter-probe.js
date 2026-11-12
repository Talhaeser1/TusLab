// Tur arası tanı: hangi katman ne zaman görünür.
async (page) => {
  await page.setViewportSize({width: 1366, height: 768});
  await page.goto('http://127.0.0.1:5176/index.html?pvp=practice&mode=rounds&bot=easy&karakter=vargr&fighter1=vargr&fighter2=nyx');
  const snap = () => page.evaluate(() => {
    const root = document.querySelector('#pvp-root'); const t = (root.querySelector('.rui-title')?.textContent || '').trim();
    const d = [...root.querySelectorAll('.rui-inter, .rui-summary, .rui-banner, .rui-intro')].map(e => { const r = e.getBoundingClientRect(); const c = getComputedStyle(e); return `${e.className.toString().split(' ')[0]}${e.hidden ? ':H' : ''}:${Math.round(r.width)}x${Math.round(r.height)}@${Math.round(r.top)}:o${Number(c.opacity).toFixed(1)}:${c.display === 'none' ? 'none' : c.visibility}`; });
    return {t, open: root.classList.contains('rui-inter-open'), d: d.join(' ')};
  });
  const log = []; let prev = ''; const t0 = Date.now(); let lastType = 0, seenInter = 0;
  while (Date.now() - t0 < 80000) {
    const s = await snap(); const key = JSON.stringify(s);
    if (/TUR ARASI|ÇÖZÜL/.test(s.t)) { if (key !== prev) log.push({ms: Date.now() - t0, ...s}); seenInter = 1; } else if (seenInter) break;
    prev = key;
    if (!seenInter && Date.now() - lastType > 300) { const w = await page.evaluate(() => (document.querySelector('[data-tt-target]')?.textContent || '').trim()); if (w && w.length > 1) { await page.keyboard.type(w, {delay: 10}); await page.keyboard.press('Space'); lastType = Date.now(); } }
    await page.waitForTimeout(150);
  }
  return log.slice(0, 30);
}
