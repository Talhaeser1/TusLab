// KESINYAP 11: zamana karşı (timed) bot maçı; yazma sayfa içinde döngüyle (round-trip yok). Raund başına: sayaç, yazılan/eksik kelime, raund hasarı, can. params: {style, maxMs, every}
async (page) => {
  const P = JSON.parse(await (async () => { try { return await page.evaluate(() => localStorage.getItem('__ui')); } catch { return null; } })() || '{}');
  await page.setViewportSize({width: P.w || 1366, height: P.h || 768});
  await page.addInitScript(() => { try { localStorage.setItem('tuslab-pvp-sfx-muted', 'true'); } catch {} });
  await page.goto('http://127.0.0.1:5176/index.html'); await page.waitForTimeout(1200);
  await page.evaluate(() => { const e = [...document.querySelectorAll('button, a, [role="button"], [data-view], [data-nav]')].find(x => /PvP Modlar/.test(x.textContent)); e?.click(); });
  await page.waitForSelector('[data-lobby-action="practice"]', {timeout: 15000});
  await page.click('[data-mode-scope="practice"][data-mode="rounds"]').catch(() => {});
  await page.click(`[data-style-picker="practice"] [data-round-style="${P.style || 'timed'}"]`);
  await page.click('[data-lobby-action="practice"]');
  await page.waitForSelector('[data-tt-input]', {timeout: 30000}).catch(() => {});
  return await page.evaluate(async ({maxMs, every}) => {
    const txt = s => document.querySelector(s)?.textContent?.trim() || null;
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const rounds = [], cards = [];let cur = null, result = null;const t0 = performance.now();
    while (performance.now() - t0 < maxMs) {
      result = txt('[data-rounds-scoreline]');
      if (result) break;
      const card = document.querySelector('.m33-result');
      if (card?.offsetParent) { const c = {title: txt('.m33-result .m33-title'), dmg: txt('.m33-result [data-round-damage]'), hp: txt('.m33-result [data-round-hp]'), next: txt('.m33-result .m33-next')}; if (!cards.some(x => x.title === c.title)) cards.push(c); }
      const mode = txt('[data-tt-mode]') || '';
      const input = document.querySelector('[data-tt-input]');
      const live = input && input.offsetParent && !input.disabled;
      if (/RAUND/.test(mode) && (!cur || cur.key !== mode)) { cur = {key: mode, firstClock: txt('.rui-clock-text strong'), submitted: 0, starved: 0, hpStart: [txt('[data-rui-hp="1"]'), txt('[data-rui-hp="2"]')]}; rounds.push(cur); }
      if (cur) { cur.dmg = txt('[data-rui-dmg="1"]'); cur.hpEnd = [txt('[data-rui-hp="1"]'), txt('[data-rui-hp="2"]')]; const d = Number(String(cur.dmg || '').match(/(\d+)\//)?.[1] || 0); cur.maxDmg = Math.max(cur.maxDmg || 0, d); }
      const target = txt('[data-tt-target]');
      if (live && cur) {
        if (target) { input.value = target + ' '; input.dispatchEvent(new Event('input', {bubbles: true})); cur.submitted++; }
        else cur.starved++;
      }
      await sleep(every);
    }
    return {result, rows: [...document.querySelectorAll('.rui-res-round')].map(li => li.textContent.trim()), rounds, cards, ms: Math.round(performance.now() - t0)};
  }, {maxMs: P.maxMs || 300000, every: P.every || 250});
}
