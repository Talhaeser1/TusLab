// Zincir planı tanısı: her karakter için chainPlan(q), (q,e), (e) özetleri.
async (page) => {
  const out = {};
  for (const f of ['nyx', 'sira', 'doran', 'vargr']) {
    await page.goto(`http://127.0.0.1:5176/index.html?pvp=practice&mode=rounds&bot=easy&karakter=vargr&fighter1=vargr&fighter2=${f}`);
    await page.setViewportSize({width: 1366, height: 768});
    await page.waitForFunction(() => window.__tuslabArena3d?._debug?.models?.()[2]?.loaded && window.__tuslabArena3d._debug.models()[2].fighter, null, {timeout: 40000}).catch(() => {});
    out[f] = await page.evaluate(() => { const d = window.__tuslabArena3d?._debug; const s = p => p ? {n: p.contacts.length, c: p.contacts.map(c => c.ms), total: p.totalMs, moveIn: p.moveIn, steps: p.steps.map(s => s.clip)} : null;
      if (!d) return null; return {model: d.models()[2], q: s(d.chainPlan(2, ['q'])), qe: s(d.chainPlan(2, ['q', 'e'])), e: s(d.chainPlan(2, ['e'])), qqq: s(d.chainPlan(2, ['q', 'q', 'q']))}; });
  }
  return out;
}
