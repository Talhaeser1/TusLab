// KESINYAP iş 13: bot maçında 8 doğru + 1 yanlış → seri 8→4 (etiket + ses perdesi).
// node .playwright-mcp/run.mjs .playwright-mcp/yanlis-yarim-probe.js '{}'
async (page) => {
  page.on('dialog', d => d.accept().catch(() => {}));
  await page.setViewportSize({width: 1366, height: 768});
  await page.addInitScript(() => {
    try { localStorage.setItem('tuslab-pvp-sfx-muted', 'false'); localStorage.setItem('tuslab-pvp-music-muted', 'true');
      localStorage.setItem('tuslab-pvp-practice-round-style', 'timed'); localStorage.setItem('tuslab-pvp-practice-round-words', '10'); } catch {}
    const S = window.__k = {pings: [], labels: []};
    const sv = AudioParam.prototype.setValueAtTime;
    AudioParam.prototype.setValueAtTime = function (v, t) { try { this.__v = v; } catch {} return sv.call(this, v, t); };
    const ost = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (...a) { if (this.type === 'sine' && this.frequency.__v > 200 && this.frequency.__v < 2100) S.pings.push(Math.round(this.frequency.__v * 100) / 100); return ost.apply(this, a); };
    S.results = []; document.addEventListener('tuslab:pvp-word-result', e => { const d = e.detail || {}; S.results.push([d.accepted, d.correct, d.streakBefore, d.streak]); }, true);
    setInterval(() => { const l = [...document.querySelectorAll('.rui-meter-label')].map(x => x.textContent.trim()).join('|'); if (l && S.labels.at(-1) !== l) S.labels.push(l); }, 40);
  });
  await page.goto('http://127.0.0.1:5176/index.html?pvp=practice&mode=rounds&bot=easy&karakter=vargr&fighter1=vargr&fighter2=nyx');
  await page.waitForTimeout(2500);
  await page.mouse.click(300, 300);
  const t0 = Date.now(); let typed = 0, done = false, pre = '';
  while (Date.now() - t0 < 60000 && typed < 12) {
    const w = await page.evaluate(() => (document.querySelector('.rui-word.is-active')?.textContent || document.querySelector('[data-tt-target]')?.textContent || '').trim()).catch(() => '');
    if (w && w.length > 1 && !/[✓]/.test(w)) {
      const lab = await page.evaluate(() => document.querySelectorAll('.rui-meter-label')[1]?.textContent.trim() || '');
      const wrong = !done && /^Seri [3-9]/.test(lab); if (wrong) { done = true; pre = lab; } // seri >=4 iken bilerek yanlış
      await page.keyboard.type(wrong ? w.slice(0, -1) + (w.endsWith('x') ? 'y' : 'x') : w, {delay: 8}); await page.keyboard.press('Space'); typed++;
      if (wrong) await page.waitForTimeout(300);
    }
    await page.waitForTimeout(220);
  }
  const r = await page.evaluate(() => window.__k);
  return {results: r.results, pre, typed, pings: r.pings, labels: r.labels.slice(0, 40)};
}
