// KESINYAP 18: classic'te .rsv-banner ↔ yazma paneli geometrisi. params: {w,h,maxMs}
async (page) => {
  const P = JSON.parse(await (async () => { try { return await page.evaluate(() => localStorage.getItem('__ui')); } catch { return null; } })() || '{}');
  await page.setViewportSize({width: P.w || 1366, height: P.h || 768});
  await page.addInitScript(() => { try { localStorage.setItem('tuslab-pvp-sfx-muted', 'true'); } catch {} });
  await page.goto('http://127.0.0.1:5176/index.html'); await page.waitForTimeout(1200);
  await page.evaluate(() => { const e = [...document.querySelectorAll('button, a, [role="button"], [data-view], [data-nav]')].find(x => /PvP Modlar/.test(x.textContent)); e?.click(); });
  await page.waitForSelector('[data-lobby-action="practice"]', {timeout: 15000});
  await page.evaluate(() => document.querySelector('[data-mode-scope="practice"][data-mode="classic"]')?.click());
  await page.evaluate(() => document.querySelector('[data-lobby-action="practice"]')?.click());
  await page.waitForSelector('[data-tt-input]', {timeout: 30000}).catch(() => {});
  return await page.evaluate(async ({maxMs}) => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const t0 = performance.now(); const seen = [];
    const rect = s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]; };
    while (performance.now() - t0 < maxMs && seen.length < 3) {
      const ban = document.querySelector('.rsv-banner:not([hidden])');
      if (ban && ban.getClientRects().length) {
        const b = ban.getBoundingClientRect();
        const kids = ['.tt', '.tt-type', '[data-tt-target]', '[data-tt-input]', '.tt-mode', '.tt-head', '.pvp2-duel'].map(s => [s, rect(s)]);
        const ov = kids.filter(([, r]) => r && Math.min(b.bottom, r[3]) - Math.max(b.top, r[1]) > 1 && Math.min(b.right, r[2]) - Math.max(b.left, r[0]) > 1).map(([s, r]) => `${s}:${r.join(',')}`);
        seen.push({banner: [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)], text: ban.textContent, parent: ban.parentElement.className, kids, ov});
        await sleep(700);
      }
      const input = document.querySelector('[data-tt-input]'), target = document.querySelector('[data-tt-target]')?.textContent?.trim();
      if (input && input.offsetParent && !input.disabled && target) { input.value = target + ' '; input.dispatchEvent(new Event('input', {bubbles: true})); }
      await sleep(120);
    }
    return seen;
  }, {maxMs: P.maxMs || 90000});
}
