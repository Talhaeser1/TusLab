// KESINYAP 11 probu: lobiden bot maçı (rounds), raund başına kelime/sayaç/can/raund hasarı, raund arası kartı, sonuç ekranı. params: {style, delay, maxMs, w, h}
async (page) => {
  const P = JSON.parse(await (async () => { try { return await page.evaluate(() => localStorage.getItem('__ui')); } catch { return null; } })() || '{}');
  const style = P.style || 'counted', delay = P.delay || 250, maxMs = P.maxMs || 300000;
  await page.setViewportSize({width: P.w || 1366, height: P.h || 768});
  await page.addInitScript(() => { try { localStorage.setItem('tuslab-pvp-sfx-muted', 'true'); localStorage.setItem('tuslab-pvp-practice-round-words', '15'); localStorage.setItem('tuslab-pvp-practice-rounds', '10'); } catch {} });
  const out = {style};
  await page.goto('http://127.0.0.1:5176/index.html'); await page.waitForTimeout(1200);
  await page.evaluate(() => { const e = [...document.querySelectorAll('button, a, [role="button"], [data-view], [data-nav]')].find(x => /PvP Modlar/.test(x.textContent)); e?.click(); });
  await page.waitForSelector('[data-lobby-action="practice"]', {timeout: 15000});
  await page.click('[data-mode-scope="practice"][data-mode="rounds"]').catch(() => {});
  await page.click(`[data-style-picker="practice"] [data-round-style="${style}"]`);
  out.lobby = await page.evaluate(() => {
    const hint = document.querySelector('[data-style-picker="practice"] [data-damage-rules]');
    const r = hint?.getBoundingClientRect();
    return {roundsPicker: !!document.querySelector('[data-rounds-picker]'), wordButtons: document.querySelectorAll('[data-round-words]').length,
      styles: [...document.querySelectorAll('[data-style-picker="practice"] [data-round-style]')].map(b => `${b.textContent.trim()}:${b.getAttribute('aria-pressed')}`),
      hint: hint?.textContent?.trim(), hintFont: hint ? getComputedStyle(hint).fontSize : null, hintVisible: !!(r && r.width && r.height),
      overflowX: document.documentElement.scrollWidth > innerWidth + 1};
  });
  await page.click('[data-lobby-action="practice"]');
  await page.waitForSelector('[data-tt-input]', {timeout: 30000}).catch(() => {});
  const t0 = Date.now(), rounds = [], cards = [];
  let cur = null;
  const snap = () => page.evaluate(() => {
    const txt = s => document.querySelector(s)?.textContent?.trim() || null;
    const card = document.querySelector('.m33-result');
    return {mode: txt('[data-tt-mode]'), target: txt('[data-tt-target]'), next: (txt('[data-tt-next]') || '').split(/\s+/).filter(Boolean), clock: txt('.rui-clock-text strong') || txt('[data-round-clock]'),
      hp1: txt('[data-rui-hp="1"]'), hp2: txt('[data-rui-hp="2"]'), dmg1: txt('[data-rui-dmg="1"]'), dmg2: txt('[data-rui-dmg="2"]'),
      prog: txt('.rui-side-1 .rui-progress'), pips: document.querySelectorAll('.rui-side-1 .rui-pips i').length, pipsOn: document.querySelectorAll('.rui-side-1 .rui-pips i.is-won').length,
      card: card && card.offsetParent ? {dmg: txt('.m33-result [data-round-damage]'), hp: txt('.m33-result [data-round-hp]'), next: txt('.m33-result .m33-next'), title: txt('.m33-result .m33-title')} : null,
      result: txt('[data-rounds-scoreline]'), resRows: [...document.querySelectorAll('.rui-res-round')].map(li => li.textContent.trim()),
      input: !!document.querySelector('[data-tt-input]')?.offsetParent};
  });
  while (Date.now() - t0 < maxMs) {
    const s = await snap();
    if (s.card && !cards.some(c => c.title === s.card.title)) cards.push(s.card);
    if (s.result) { out.result = s.result; out.resRows = s.resRows; break; }
    if (P.trace && Date.now() - t0 < P.trace) (out.trace ||= []).push([Date.now() - t0, s.target, s.input, s.clock, s.prog, await page.evaluate(() => [document.querySelector('[data-tt-input]')?.disabled, document.querySelector('[data-tt-input]')?.value, document.querySelector('[data-tt-notice], .tt-notice')?.textContent?.trim()?.slice(0, 60)]).catch(() => null)]);
    if (P.trace && Date.now() - t0 >= P.trace) break;
    const key = s.mode || '?';
    if (/RAUND|ALTIN/.test(key) && (!cur || cur.key !== key)) { cur = {key, firstClock: s.clock, typed: 0, maxDmg1: 0, startHp: [s.hp1, s.hp2], prog: s.prog, pips: `${s.pipsOn}/${s.pips}`, starved: 0}; rounds.push(cur); }
    if (cur) { const d = Number(String(s.dmg1 || '').match(/(\d+)\//)?.[1] || 0); cur.maxDmg1 = Math.max(cur.maxDmg1, d); cur.dmgText = s.dmg1; cur.endHp = [s.hp1, s.hp2]; cur.lastClock = s.clock; }
    if (s.target && s.input) {
      await page.focus('[data-tt-input]').catch(() => {});
      const batch = P.batch ? [s.target, ...s.next.slice(0, P.batch - 1)] : [s.target];
      for (const w of batch) await page.keyboard.type(w + ' ', {delay: 0}).catch(() => {});
      if (cur) cur.typed += batch.length;
    } else if (cur && s.input && !s.target) cur.starved++;
    await page.waitForTimeout(delay);
  }
  out.rounds = rounds; out.cards = cards; out.elapsed = Date.now() - t0;
  out.layout = await page.evaluate(() => {
    const small = [...document.querySelectorAll('#pvp-root .rui *, #pvp-root [data-rounds-result] *, #pvp-root .m33-result *')].filter(e => e.offsetParent && e.childElementCount === 0 && e.textContent.trim() && parseFloat(getComputedStyle(e).fontSize) < 12).map(e => `${e.className}:${getComputedStyle(e).fontSize}`);
    return {overflowX: document.documentElement.scrollWidth > innerWidth + 1, small: [...new Set(small)].slice(0, 8)};
  });
  await page.screenshot({path: `.playwright-mcp/raund11-${style}-${P.w || 1366}.jpg`, type: 'jpeg', quality: 60}).catch(() => {});
  return out;
}
