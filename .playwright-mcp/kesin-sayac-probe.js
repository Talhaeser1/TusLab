// Sayılı raund sayacı: ilk raund başlar başlamaz saniye sayacını 100 ms'de bir örnekler. node .playwright-mcp/run.mjs .playwright-mcp/kesin-sayac-probe.js '{"words":"10"}'
async (page) => {
  const P = Object.assign({words: '10', style: 'counted', maxMs: 40000}, JSON.parse(process.argv[3] || '{}'));
  await page.addInitScript(p => { try { localStorage.setItem('tuslab-pvp-practice-round-style', p.style); localStorage.setItem('tuslab-pvp-practice-round-words', p.words); localStorage.setItem('tuslab-pvp-sfx-muted', 'true'); } catch {} }, P);
  await page.goto('http://127.0.0.1:5176/index.html?pvp=practice&mode=rounds&bot=easy&karakter=vargr&fighter1=vargr&fighter2=nyx');
  await page.waitForTimeout(1500); await page.mouse.click(300, 300);
  const t0 = Date.now(); const seen = [];
  while (Date.now() - t0 < P.maxMs) {
    const s = await page.evaluate(() => { const root = document.querySelector('#pvp-root'); return {c: (document.querySelector('.rui-clock-text')?.textContent || '').trim(), open: ['rui-inter-open'].some(x => root?.classList.contains(x)), words: document.querySelectorAll('.rui-word').length}; }).catch(() => null);
    if (s && /^\d+/.test(s.c) && !s.open) { seen.push([Date.now() - t0, s.c]); if (seen.length >= 6) break; }
    await page.waitForTimeout(100);
  }
  return {style: P.style, words: P.words, first6: seen};
}
