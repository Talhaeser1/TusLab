// Kalite kademesi ne zaman düşüyor: 250 ms'de bir step/quality + o aralıktaki kare süresi ortancası.
async (page) => {
  await page.setViewportSize({width: 1366, height: 768});
  await page.addInitScript(() => {
    const P = window.__k = {log: [], f: []}; let last = performance.now();
    const loop = t => { P.f.push(t - last); last = t; requestAnimationFrame(loop); }; requestAnimationFrame(loop);
    setInterval(() => { let p = null; try { p = window.__tuslabArena3d?._debug?.perf?.(); } catch (e) {}
      const a = P.f.splice(0).sort((x, y) => x - y); const med = a.length ? a[a.length >> 1] : 0, max = a.length ? a[a.length - 1] : 0;
      let w = null; try { w = window.__tuslabArena3d?._debug?.warmup?.(); } catch (e) {}
      const key = p ? p.step + '/' + p.quality + '/' + p.bloom + '/' + p.ratio : 'yok';
      P.log.push([Math.round(performance.now()), key, a.length, +med.toFixed(1), Math.round(max), w ? w.queued + ':' + w.pendingCompiles : '', p && p.gov ? JSON.stringify(p.gov) : '']); }, 500);
  });
  await page.goto('http://127.0.0.1:5176/index.html?pvp=practice&mode=rounds&bot=easy&karakter=konyali&fighter1=konyali&fighter2=vargr&icerik=atasozu');
  await page.waitForSelector('[data-tt-target]', {timeout: 60000});
  await page.waitForTimeout(13000);
  return await page.evaluate(() => window.__k.log.map(l => l.join(' | ')));
}
