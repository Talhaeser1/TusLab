// İş 15: sayfa açılış tanısı (maç başlıyor mu, 3B örnek ve imza kancası var mı).
async (page) => {
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  const logs = []; page.on('console', m => { if (m.type() === 'error' && logs.length < 8) logs.push(m.text().slice(0, 160)); });
  await page.setViewportSize({width: 1366, height: 768});
  const res = await page.goto('http://127.0.0.1:5176/index.html?pvp=practice&mode=classic&bot=easy&karakter=konyali&fighter1=konyali&fighter2=nyx&vfxprobe=1');
  const out = {status: res?.status()};
  for (const t of [3000, 6000, 10000]) {
    await page.waitForTimeout(t === 3000 ? 3000 : 3500);
    out['t' + t] = await page.evaluate(() => ({
      arena: Boolean(window.__tuslabArena3d), vfx: Boolean(window.__tuslabVfx),
      models: (() => { try { return JSON.stringify(window.__tuslabArena3d?._debug?.models?.()).slice(0, 120); } catch (e) { return String(e); } })(),
      cls: [...(document.querySelector('#pvp-root')?.classList || [])].join(' ').slice(0, 200),
    }));
  }
  out.errs = errs; out.logs = logs;
  return out;
}
