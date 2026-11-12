// İş 15: yeteneği arena örneğine doğrudan ver (yalnız görsel SKILL_CAST, hasar 0) → imza sayaçları + kare süresi.
async (page) => {
  let P = {};
  try { P = JSON.parse(await page.evaluate(() => localStorage.getItem('__ui') || '{}')); } catch { P = {}; }
  P = Object.assign({f1: 'doran', f2: 'sira', skills: ['e', 'e', 'q', 'r']}, P);
  await page.setViewportSize({width: 1366, height: 768});
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  const ch = ['nyx', 'doran', 'konyali'].includes(P.f1) ? 'rune' : 'fire';
  await page.goto(`http://127.0.0.1:5176/index.html?pvp=practice&mode=classic&bot=easy&char=${ch}&karakter=${P.f1}&fighter1=${P.f1}&fighter2=${P.f2}&vfxprobe=1`);
  await page.waitForTimeout(6000);
  const out = [];
  for (const skill of P.skills) {
    const r = await page.evaluate(async ([skill, id]) => {
      const A = window.__tuslabArena3d, fx = window.__tuslabVfx;
      const m = A._debug.models();
      const seat = m[1]?.fighter === id ? 1 : 2;
      const c0 = {...(fx.stats().signature.counts || {})};
      const frames = []; let last = performance.now(), on = true;
      const loop = () => { const t = performance.now(); frames.push(t - last); last = t; if (on) requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
      A.handle({type: 'SKILL_CAST', fromSeat: seat, toSeat: 3 - seat, skill, amount: 0});
      await new Promise(res => setTimeout(res, skill === 'r' ? 4200 : 3200));
      on = false;
      const c1 = fx.stats().signature.counts || {};
      const diff = Object.fromEntries(Object.entries(c1).filter(([k, v]) => v !== (c0[k] || 0)).map(([k, v]) => [k, v - (c0[k] || 0)]));
      const f = frames.slice(2);
      return {skill, seat, diff, avg: +(f.reduce((a, b) => a + b, 0) / f.length).toFixed(2), max: Math.round(Math.max(...f)), over250: f.filter(x => x > 250).length};
    }, [skill, P.f1]);
    out.push(r);
  }
  return {out, errs};
}
