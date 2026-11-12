// Mekanik probu: lobiden (via=lobby) ya da URL ile (via=url) bot maçı; raund başına yazılan kelime sayısı, kelime tükenmesi.
// params: {via, mode, style, words, rounds, delay, maxMs, content}
async (page) => {
  const P = JSON.parse(await (async () => { try { return await page.evaluate(() => localStorage.getItem('__ui')); } catch { return null; } })() || '{}');
  const via = P.via || 'lobby', mode = P.mode || 'rounds', style = P.style, words = P.words, delay = P.delay || 350, maxMs = P.maxMs || 120000;
  await page.setViewportSize({width: P.w || 1366, height: P.h || 768});
  const out = {params: P};
  const openLobby = async () => {
    await page.goto('http://127.0.0.1:5176/index.html'); await page.waitForTimeout(1200);
    await page.evaluate(() => { const e = [...document.querySelectorAll('button, a, [role="button"], [data-view], [data-nav]')].find(x => /PvP Modlar/.test(x.textContent)); e?.click(); });
    await page.waitForSelector('[data-lobby-action="practice"]', {timeout: 10000});
  };
  if (via === 'lobby') {
    await openLobby();
    await page.click(`[data-mode-scope="practice"][data-mode="${P.content || mode}"]`);
    if (P.rounds) await page.click(`[data-rounds-picker="practice"] [data-rounds="${P.rounds}"]`).catch(() => {});
    if (style) await page.click(`[data-style-picker="practice"] [data-round-style="${style}"]`);
    if (words) await page.click(`[data-style-picker="practice"] [data-round-words="${words}"]`);
    out.lobbyPressed = await page.evaluate(() => ({style: [...document.querySelectorAll('[data-style-picker="practice"] [data-round-style][aria-pressed="true"]')].map(b => b.dataset.roundStyle), words: [...document.querySelectorAll('[data-style-picker="practice"] [data-round-words][aria-pressed="true"]')].map(b => b.dataset.roundWords), mode: [...document.querySelectorAll('[data-mode-picker="practice"] [aria-pressed="true"]')].map(b => b.dataset.mode), store: {s: localStorage.getItem('tuslab-pvp-practice-round-style'), w: localStorage.getItem('tuslab-pvp-practice-round-words')}}));
    await page.click('[data-lobby-action="practice"]');
  } else {
    await page.goto(`http://127.0.0.1:5176/index.html?pvp=practice&mode=${mode}&bot=easy`);
  }
  await page.waitForSelector('[data-tt-input]', {timeout: 30000}).catch(() => {});
  const t0 = Date.now(), rounds = [];
  let cur = null, last = null;
  const snap = () => page.evaluate(() => ({
    label: document.querySelector('[data-round-label]')?.textContent?.trim(), clock: document.querySelector('[data-round-clock]')?.textContent?.trim(),
    target: document.querySelector('[data-tt-target]')?.textContent?.trim(), mode: document.querySelector('[data-tt-mode]')?.textContent?.trim(),
    over: /ZAFER|YENİLGİ|MAÇ BİTTİ|BERABERLİK/i.test(document.body.innerText.slice(0, 4000)) && !!document.querySelector('[data-result], .pvp-result, [data-phase15-result]'),
    input: !!document.querySelector('[data-tt-input]')?.offsetParent
  }));
  while (Date.now() - t0 < maxMs) {
    const s = await snap();
    const key = s.label || s.mode || '?';
    if (!cur || cur.key !== key) { cur = {key, typed: 0, firstTarget: s.target, firstClock: s.clock, empty: 0, lastClock: s.clock, startMs: Date.now() - t0}; rounds.push(cur); }
    cur.lastClock = s.clock; cur.endMs = Date.now() - t0;
    if (s.target && s.input) {
      await page.focus('[data-tt-input]').catch(() => {});
      await page.keyboard.type(s.target + ' ', {delay: 0}).catch(() => {});
      cur.typed++; last = s.target;
    } else cur.empty++;
    if (s.over) { out.over = true; break; }
    await page.waitForTimeout(delay);
  }
  out.rounds = rounds; out.elapsed = Date.now() - t0;
  out.final = await snap();
  return out;
}
