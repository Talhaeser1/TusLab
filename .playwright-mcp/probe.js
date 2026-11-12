async (page) => {
  const P = globalThis.__probe || {};
  const url = P.url || 'http://127.0.0.1:5176/index.html?pvp=practice&mode=rounds&bot=easy&karakter=vargr&fighter1=vargr&fighter2=sira';
  const words = P.words ?? 8, maxMs = P.maxMs ?? 100000;
  await page.goto(url);
  await page.waitForTimeout(6000);
  await page.evaluate(() => {
    const d = window.__tuslabArena3d._debug; window.__S = []; const t0 = performance.now();
    const vis = s => { const e = document.querySelector(s); if (!e || e.hidden) return false; const r = e.getBoundingClientRect(); const c = getComputedStyle(e); return r.width > 0 && r.height > 0 && c.display !== 'none' && c.visibility !== 'hidden' && Number(c.opacity) > 0.05; };
    const tick = () => {
      const m = d.models(); const q = window.__tuslabVisualQueue.snapshot(); const inter = document.querySelector('.rui-inter');
      window.__S.push({t: Math.round(performance.now() - t0), busy: q.busy,
        s1: m[1].state + '/' + m[1].clip, s2: m[2].state + '/' + m[2].clip, ts: Math.max(m[1].timeScale, m[2].timeScale), tsMin: Math.min(m[1].timeScale, m[2].timeScale),
        ui: vis('.rui-inter') ? 'inter:' + (inter.dataset.stage || inter.className.replace('rui-inter', '').trim()) : vis('.rui-intro') ? 'intro' : '',
        title: document.querySelector('.rui-title')?.textContent || '', clock: document.querySelector('.rui-clock-text')?.textContent || ''});
      if (window.__S.length < 12000) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const active = () => page.evaluate(() => document.querySelector('.rui-word.is-active')?.textContent?.trim() || null);
  await page.click('#tt-input').catch(() => {});
  for (let i = 0; i < words; i++) { const w = await active(); if (!w) break; await page.keyboard.type(w, {delay: 20}); await page.keyboard.press('Space'); await page.waitForTimeout(150); }
  await page.waitForFunction(ms => { const S = window.__S; const L = S.at(-1); return L.t > ms || (S.some(r => r.ui.startsWith('inter')) && L.title !== S[0].title && !L.ui); }, maxMs, {timeout: maxMs + 20000}).catch(() => {});
  const S = await page.evaluate(() => window.__S);
  const segs = key => { const out = []; let cur = null; for (const r of S) { if (!cur || cur.v !== r[key]) { cur = {v: r[key], t: r.t, d: 0}; out.push(cur); } cur.d = r.t - cur.t; } return out; };
  const fmt = a => a.map(s => `${s.t}:${s.v}(${s.d})`).join(' | ');
  let hitstops = 0, maxTs = 0; for (let i = 1; i < S.length; i++) { if (S[i].tsMin <= 0.06 && S[i - 1].tsMin > 0.06) hitstops++; maxTs = Math.max(maxTs, S[i].ts); }
  const clock = []; let last = ''; for (const r of S) { if (r.clock !== last) { clock.push([r.t, r.clock]); last = r.clock; } }
  const secs = clock.filter(c => /^\d+sn$/.test(c[1])); const steps = []; for (let i = 1; i < secs.length; i++) steps.push(secs[i][0] - secs[i - 1][0]);
  return {frames: S.length, lastT: S.at(-1).t, hitstops, maxTimeScale: maxTs,
    seat1: fmt(segs('s1')).slice(0, 2500), seat2: fmt(segs('s2')).slice(0, 2500), ui: fmt(segs('ui')), title: fmt(segs('title')), busy: fmt(segs('busy')).slice(0, 800),
    clockFirst: clock.slice(0, 3), clockStepMs: {min: Math.min(...steps), max: Math.max(...steps), avg: Math.round(steps.reduce((a, b) => a + b, 0) / (steps.length || 1)), n: steps.length, slow: steps.filter(s => s > 1300).length}};
}
