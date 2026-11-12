// KELİME RAUNDU kural probu: params {who:'human'|'bot', w, h}. human = oyuncu 5 kelimeyi yazar; bot = oyuncu yazmaz, bot bitirir.
async (page) => {
  const P = JSON.parse(await page.evaluate(() => localStorage.getItem('__ui')) || '{}');
  const who = P.who || 'human';
  await page.setViewportSize({width: P.w || 1366, height: P.h || 768});
  await page.addInitScript(() => { try { localStorage.setItem('tuslab-pvp-sfx-muted', 'true'); } catch {} });
  const out = {who};
  await page.goto('http://127.0.0.1:5176/index.html'); await page.waitForTimeout(1200);
  await page.evaluate(() => { const e = [...document.querySelectorAll('button, a, [role="button"], [data-view], [data-nav]')].find(x => /PvP Modlar/.test(x.textContent)); e?.click(); });
  await page.waitForSelector('[data-lobby-action="practice"]', {timeout: 15000});
  await page.click('[data-mode-scope="practice"][data-mode="rounds"]').catch(() => {});
  await page.click('[data-style-picker="practice"] [data-round-style="counted"]');
  out.hint = await page.evaluate(() => document.querySelector('[data-style-picker="practice"] [data-round-style="counted"]')?.title || null);
  await page.click('[data-lobby-action="practice"]');
  await page.waitForSelector('[data-tt-input]', {timeout: 30000});
  const snap = () => page.evaluate(() => {
    const vis = e => !!(e && e.offsetParent && !e.hidden);
    const t = s => document.querySelector(s)?.textContent?.trim() || '';
    const sideProg = [...document.querySelectorAll('.rui-side .rui-progress, .rui-side-1 .rui-progress, .rui-side-2 .rui-progress')].map(e => e.textContent.trim());
    return {mode: t('[data-tt-mode]'), title: t('.rui-title'), secs: t('.rui-secs'), unit: t('.rui-secs-unit'), lastcall: vis(document.querySelector('.rui-lastcall')) ? t('.rui-lastcall') : '',
      picker: vis(document.querySelector('.rui-skill-picker')), sideClocks: [...document.querySelectorAll('.rui-side .rui-clock, .rui-side-clock')].map(e => e.textContent.trim()).filter(Boolean),
      sideProg, target: t('[data-tt-target]'), input: vis(document.querySelector('[data-tt-input]')) && !document.querySelector('[data-tt-input]').disabled,
      inputNote: t('[data-tt-notice], .tt-notice'), overflowX: document.documentElement.scrollWidth > innerWidth + 1,
      titleBox: (r => r && {x: Math.round(r.x), w: Math.round(r.width), vw: innerWidth})(document.querySelector('.rui-title')?.getBoundingClientRect())};
  });
  const t0 = Date.now(), samples = [];
  let first = null, closedAt = null, lastTypeAt = null, typed = 0;
  while (Date.now() - t0 < 90000) {
    const s = await snap();
    if (/KELİME RAUNDU/.test(s.mode) && !first) first = s;
    if (first && samples.length < 4 || (samples.length < 40 && Date.now() % 3 === 0)) samples.push([Date.now() - t0, s.title, s.secs, s.unit, s.lastcall, s.picker]);
    const resolved = /ÇÖZÜLÜYOR|TUR ARASI/.test(s.title) || /ÇÖZÜLÜYOR|TUR ARASI/.test(s.secs);
    if (first && resolved) { closedAt = Date.now(); break; }
    if (who === 'human' && s.target && s.input && typed < 5) {
      await page.focus('[data-tt-input]').catch(() => {});
      const nxt = (await page.evaluate(() => document.querySelector('[data-tt-next]')?.textContent || '')).split(/\s+/).filter(Boolean);
      const batch = [s.target, ...nxt].slice(0, 5 - typed);
      for (const w of batch) { await page.keyboard.type(w + ' ', {delay: 0}).catch(() => {}); typed++; lastTypeAt = Date.now(); }
      out.afterTyped = (out.afterTyped || []); out.afterTyped.push([typed, (await snap()).title]);
    }
    await page.waitForTimeout(who === 'human' ? 120 : 400);
  }
  out.first = first; out.typed = typed; out.closedMsAfterLastWord = closedAt && lastTypeAt ? closedAt - lastTypeAt : null;
  out.closedAtMs = closedAt ? closedAt - t0 : null; out.samples = samples.slice(0, 12);
  out.final = await snap();
  out.hasCountdownLikeSeconds = samples.some(x => /^\d+$/.test(String(x[2])) && x[3] === 'sn');
  await page.screenshot({path: `.playwright-mcp/kelime-kural-${who}-${P.w || 1366}.jpg`, type: 'jpeg', quality: 55}).catch(() => {});
  return out;
}
