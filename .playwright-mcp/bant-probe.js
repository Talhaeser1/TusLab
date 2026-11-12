// KESINYAP 18: raund arası tek bant ölçümü. params: {style:'timed'|'counted', mode:'rounds'|'arena', sizes:[[w,h],...], keys:true, esc:false, shot:'ad', char:'vargr'}
async (page) => {
  const P = JSON.parse(await (async () => { try { return await page.evaluate(() => localStorage.getItem('__ui')); } catch { return null; } })() || '{}');
  const sizes = P.sizes || [[1920, 1080], [1366, 768], [375, 812]];
  await page.setViewportSize({width: sizes[0][0], height: sizes[0][1]});
  await page.addInitScript(() => { try { localStorage.setItem('tuslab-pvp-sfx-muted', 'true'); } catch {} });
  await page.goto('http://127.0.0.1:5176/index.html'); await page.waitForTimeout(1200);
  await page.evaluate(() => { const e = [...document.querySelectorAll('button, a, [role="button"], [data-view], [data-nav]')].find(x => /PvP Modlar/.test(x.textContent)); e?.click(); });
  await page.waitForSelector('[data-lobby-action="practice"]', {timeout: 15000});
  const mode = P.mode || 'rounds';
  await page.evaluate(m => document.querySelector('[data-mode-scope="practice"][data-mode="' + m + '"]')?.click(), mode);
  if (mode === 'rounds') await page.evaluate(st => document.querySelector('[data-style-picker="practice"] [data-round-style="' + st + '"]')?.click(), P.style || 'timed');
  await page.evaluate(() => document.querySelector('[data-lobby-action="practice"]')?.click());
  await page.waitForSelector('[data-tt-input]', {timeout: 30000}).catch(() => {});
  const waitInter = (open, maxMs) => page.evaluate(async ({open, maxMs}) => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const t0 = performance.now();
    while (performance.now() - t0 < maxMs) {
      const root = document.querySelector('#pvp-root');
      const isOpen = root?.classList.contains('rui-inter-open') || root?.classList.contains('aui-summary-open');
      if (isOpen === open && (!open || document.querySelector('.m33-result'))) return true;
      const input = document.querySelector('[data-tt-input]'), target = document.querySelector('[data-tt-target]')?.textContent?.trim();
      if (input && input.offsetParent && !input.disabled && target) { input.value = target + ' '; input.dispatchEvent(new Event('input', {bubbles: true})); }
      await sleep(120);
    }
    return false;
  }, {open, maxMs});
  const measure = () => page.evaluate(() => {
    const root = document.querySelector('#pvp-root');
    const band = document.querySelector('.rui-inter:not([hidden])') || document.querySelector('.aui-summary:not([hidden])');
    if (!band) return {band: null};
    const vis = e => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).display !== 'none';
    const r = band.getBoundingClientRect(), vw = innerWidth, vh = innerHeight;
    const lum = c => { const m = c.match(/[\d.]+/g).map(Number); const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(m[0]) + .7152 * f(m[1]) + .0722 * f(m[2]); };
    const bgL = lum('rgb(10,12,32)');
    const leaves = [...band.querySelectorAll('*')].filter(e => vis(e) && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()));
    const small = [], narrow = [], multi = [], clipped = []; let minContrast = 99;
    for (const e of leaves) {
      const b = e.getBoundingClientRect(), cs = getComputedStyle(e), fs = parseFloat(cs.fontSize), lh = parseFloat(cs.lineHeight) || fs * 1.3, t = e.textContent.trim();
      const tag = `${e.className || e.tagName}:${t.slice(0, 26)}`;
      if (fs < 12) small.push(`${tag}@${fs}`);
      if (b.width < 40 && t.length > 2) narrow.push(`${tag}@${Math.round(b.width)}`);
      if (e.matches('.m33-dmg,.m33-cap,.m33-who,.m33-title,.m33-next,.m33-count-label,.aui-card-copy strong') && b.height > lh * 1.5) multi.push(`${tag}@h${Math.round(b.height)}`);
      if (e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).textOverflow === 'ellipsis') clipped.push(tag);
      if (!e.matches('.m33-cap,.m33-title')) { const L = lum(cs.color); const c = (Math.max(L, bgL) + .05) / (Math.min(L, bgL) + .05); minContrast = Math.min(minContrast, c); }
    }
    const cards = [...band.querySelectorAll('.rui-skill-cards .aui-card')].filter(vis).map(c => { const b = c.getBoundingClientRect(); return {top: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height), pressed: c.getAttribute('aria-pressed'), key: c.querySelector('.aui-card-key')?.textContent, uses: c.querySelector('.aui-uses')?.textContent}; });
    const q = s => document.querySelector(s);
    const cand = ['.tt', '.pvp2-skillrow', '[data-fhud-rail="1"]', '[data-fhud-rail="2"]', '.tt-type', '.pvp2-hp', '[data-fhud]'].map(s => { const e = q(s); if (!e || !vis(e)) return null; const b = e.getBoundingClientRect(); const ov = Math.max(0, Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top)) > 1 && Math.max(0, Math.min(r.right, b.right) - Math.max(r.left, b.left)) > 1; return `${s}:${Math.round(b.top)}-${Math.round(b.bottom)}${ov ? ' ÇAKIŞIR' : ''}`; }).filter(Boolean);
    const intro = q('.rui-intro'), introVisible = !!intro && vis(intro);
    const players = [...band.querySelectorAll('.m33-player')].map(p => ({who: p.querySelector('.m33-who')?.textContent, dmg: p.querySelector('.m33-dmg')?.textContent, cap: !!p.querySelector('.m33-cap'), detail: p.querySelector('.m33-detail')?.textContent, x: Math.round(p.getBoundingClientRect().left)}));
    const rails = [...document.querySelectorAll('[data-fhud-rail]')].map(e => { const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom), vis(e)]; });
    const cv = [...document.querySelectorAll('canvas')].filter(vis).map(e => { const b = e.getBoundingClientRect(); return [e.className || e.id, Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]; });
    return {cv, rails, vp: [vw, vh], rect: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)], inside: r.left >= 0 && r.top >= 0 && r.right <= vw + .5 && r.bottom <= vh + .5, width: Math.round(r.width),
      bandScroll: band.scrollHeight > band.clientHeight + 1, pageScroll: [document.documentElement.scrollHeight - innerHeight, document.documentElement.scrollWidth - innerWidth],
      label: q('.m33-title')?.textContent, players, pips: [...band.querySelectorAll('.m33-pip')].length + '/' + band.querySelectorAll('.m33-pip.is-won').length, next: band.querySelector('.m33-next')?.textContent, hint: (() => { const h = band.querySelector('.m33-hint'); return h && vis(h) ? h.textContent : null; })(),
      countdown: (() => { const c = band.querySelector('.m33-countdown'); return c && vis(c) ? c.textContent.trim() : null; })(), hpLine: !!band.querySelector('.m33-hpline') || /Kalan can/.test(band.textContent),
      cards, cardsOneRow: new Set(cards.map(c => c.top)).size === 1, pickerBtns: [...band.querySelectorAll('.rui-pick-lock,.rui-pick-skip')].filter(vis).map(b => b.textContent), status: band.querySelector('.rui-pick-status')?.textContent || '',
      introVisible, small, narrow, multi, clipped, minContrast: Math.round(minContrast * 10) / 10, overlaps: cand};
  });
  const out = {style: P.style || mode, runs: []};
  const opened = await waitInter(true, P.maxMs || 150000);
  out.opened = opened; if (!opened) return out;
  await page.waitForTimeout(500);
  for (const [w, h] of (P.keys ? sizes.slice(0, 1) : sizes)) {
    if (!P.keys) { await page.setViewportSize({width: w, height: h}); await page.waitForTimeout(350); }
    const m = await measure(); out.runs.push(m);
    if (P.shot) await page.screenshot({path: `.playwright-mcp/${P.shot}-${w}.png`});
  }
  if (P.keys) {
    await page.setViewportSize({width: sizes[0][0], height: sizes[0][1]}); await page.waitForTimeout(400);
    const pressed = () => page.evaluate(() => [...document.querySelectorAll('.rui-skill-cards .aui-card')].map(c => c.getAttribute('aria-pressed') + (c.disabled ? 'D' : '')).join(',') + ' @' + document.querySelector('.m33-countdown')?.textContent);
    const k = {};
    if (!P.esc) {
    await page.keyboard.press('2'); await page.waitForTimeout(150); k.after2 = await pressed();
    await page.keyboard.press('1'); await page.waitForTimeout(150); k.after1 = await pressed();
    await page.keyboard.press('3'); await page.waitForTimeout(150); k.after3 = await pressed(); }
    if (P.esc) { await page.keyboard.press('Escape'); } else await page.keyboard.press('Enter');
    await page.waitForTimeout(700);
    k.afterLock = await page.evaluate(() => ({locked: !!document.querySelector('.rui-skill-picker.is-locked'), status: document.querySelector('.rui-pick-status')?.textContent, disabled: [...document.querySelectorAll('.rui-pick-lock,.rui-pick-skip')].map(b => b.disabled)}));
    out.keys = k;
  }
  return out;
}
