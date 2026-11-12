// J2 lobi ölçümü: her çözünürlükte kutu, taşma, çakışma, yazı boyutu, kart sütunları
async (page) => {
  const out = [];
  const prm = JSON.parse(await page.evaluate(() => localStorage.getItem('__ui') || '{}'));
  const sizes = prm.sizes || [[1920, 1080], [1366, 768], [375, 812]];
  for (const [w, h] of sizes) {
    await page.setViewportSize({width: w, height: h});
    const errs = []; const onErr = m => { if (m.type() === 'error') errs.push(m.text().slice(0, 120)); }; page.on('console', onErr);
    await page.goto('http://127.0.0.1:5176/index.html'); await page.waitForTimeout(1500);
    await page.evaluate(() => { const e = [...document.querySelectorAll('button, a, [role="button"], [data-view], [data-nav]')].find(x => /PvP Modlar/.test(x.textContent)); e?.click(); });
    await page.waitForSelector('.lb3-fighter', {timeout: 8000}).catch(() => {}); await page.waitForTimeout(1200);
    const r = await page.evaluate(() => {
      const W = innerWidth, H = innerHeight, R = e => { const b = e.getBoundingClientRect(); return [b.left, b.top, b.width, b.height].map(Math.round); };
      const panel = document.querySelector('#pvp-lobby-panel');
      const vis = e => { if (!e) return false; const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
      const q = s => document.querySelector(s);
      const cards = [...document.querySelectorAll('[data-fighter-group="lobby"] [data-fighter]')].filter(vis);
      const rows = new Set(cards.map(c => Math.round(c.getBoundingClientRect().top / 10))).size;
      const cols = new Set(cards.map(c => Math.round(c.getBoundingClientRect().left))).size;
      const modes = [...document.querySelectorAll('[data-mode-picker="practice"] [data-mode]')];
      const strip = q('[data-mode-picker="practice"] .rui-seg');
      const stages = [...document.querySelectorAll('[data-stage-group="practice"] [data-stage-pick]')];
      const small = [...(panel?.querySelectorAll('*') || [])].filter(e => vis(e) && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1) && parseFloat(getComputedStyle(e).fontSize) < 12).map(e => `${e.className.toString().slice(0, 24)}:${getComputedStyle(e).fontSize}`);
      const clipped = [...(panel?.querySelectorAll('*') || [])].filter(e => vis(e) && e.children.length === 0 && e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflow !== 'visible' && e.textContent.trim()).map(e => e.className.toString().slice(0, 24) + ':' + e.textContent.trim().slice(0, 14));
      const parts = {};
      for (const [k, s] of Object.entries({modes: '[data-mode-picker="practice"]', chars: '[data-fighter-group="lobby"]', info: '[data-fighter-info]', settings: '[data-j2-settings]', stage: '[data-stage-box="practice"]', start: '[data-lobby-action="practice"]', online: '.lb3-online', rules: '[data-typing-box]'})) { const e = q(s); parts[k] = e && vis(e) ? R(e) : null; }
      // çakışma: üst düzey bölümler arası
      const names = Object.keys(parts).filter(k => parts[k] && !['rules'].includes(k)); const overlaps = [];
      for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) { const a = parts[names[i]], b = parts[names[j]]; if (a[0] < b[0] + b[2] - 1 && b[0] < a[0] + a[2] - 1 && a[1] < b[1] + b[3] - 1 && b[1] < a[1] + a[3] - 1) overlaps.push(names[i] + '×' + names[j]); }
      return {panel: panel ? R(panel) : null, scrollBox: panel ? [panel.scrollHeight, panel.clientHeight] : null, hscroll: document.documentElement.scrollWidth > W + 1 || (panel && panel.scrollWidth > panel.clientWidth + 1),
        chars: cards.length, charRows: rows, charCols: cols, charBox: cards[0] ? R(cards[0]) : null, charIds: cards.map(c => c.dataset.fighter), selected: cards.find(c => c.getAttribute('aria-checked') === 'true')?.dataset.fighter,
        modeCount: modes.length, modeIds: modes.map(m => m.dataset.mode), modeSnap: strip ? [getComputedStyle(strip).scrollSnapType, strip.scrollWidth, strip.clientWidth, getComputedStyle(strip).overflowX] : null,
        stageCount: stages.length, stageBoxes: stages.map(s => R(s)), stagePersp: (() => { const g = q('[data-stage-group="practice"]'); return g ? getComputedStyle(g).perspective : null; })(),
        parts, overlaps, rulesPanel: !!q('[data-typing-box]'), rulesText: /Maç kuralları/.test(panel?.innerText || ''), small: [...new Set(small)].slice(0, 6), clipped: clipped.slice(0, 6),
        infoText: q('[data-fighter-info]')?.innerText.replace(/\s+/g, ' ').slice(0, 220)};
    });
    page.off('console', onErr);
    out.push({vp: `${w}x${h}`, errs: [...new Set(errs)].slice(0, 4), ...r});
  }
  return out;
}
