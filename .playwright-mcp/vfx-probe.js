// İş 15 ölçümü: ?karakter=<id> bot maçında imza efektleri (ad, parçacık, süre) + kare süresi + R anı ekran görüntüsü.
async (page) => {
  let P = {};
  try { P = JSON.parse(await page.evaluate(() => localStorage.getItem('__ui') || '{}')); } catch { P = {}; }
  P = Object.assign({mode: 'classic', w: 1366, h: 768, f1: 'konyali', f2: 'nyx', maxMs: 75000, gap: 240}, P);
  await page.setViewportSize({width: P.w, height: P.h});
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.addInitScript(() => {
    const K = window.__vk = {links: 0};
    for (const C of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) {
      if (!C) continue;
      const o = C.prototype.linkProgram;
      C.prototype.linkProgram = function (...a) { K.links++; return o.apply(this, a); };    }
  });
  await page.goto(`http://127.0.0.1:5176/index.html?pvp=practice&mode=${P.mode}&bot=easy&char=${['nyx', 'doran', 'konyali'].includes(P.f1) ? 'rune' : 'fire'}&karakter=${P.f1}&fighter1=${P.f1}&fighter2=${P.f2}&vfxprobe=1`);
  await page.waitForTimeout(3000);
  await page.evaluate(off => {
    window.__vfxOff = off;
    const L = window.__vp = {t0: performance.now(), frames: [], upd: [], casts: [], rAt: 0, fightLinks: null, startLinks: null};
    const root = document.querySelector('#pvp-root');
    root?.addEventListener('tuslab:pvp-cast', e => {
      const d = e.detail || {};
      L.casts.push([Math.round(performance.now() - L.t0), d.seat, d.skill]);
      if (d.seat === 1 && d.skill === 'r' && !L.rAt) L.rAt = performance.now();
    }, true);
    let wrapped = false, last = performance.now();
    const loop = () => {
      const t = performance.now(), dt = t - last; last = t;
      const fx = window.__tuslabVfx;
      if (fx && !wrapped) {
        wrapped = true;
        fx.sigOff = Boolean(window.__vfxOff);
        const orig = fx.update;
        fx.update = (a, b) => { const s = performance.now(); orig(a, b); L.upd.push(performance.now() - s); };
      }
      let busy = 0;
      try {
        const s = fx?.stats?.().signature;
        if (s) busy = s.projectiles + s.emitters + s.decals + s.waves + s.glyphs + s.chunks + s.ribbons + s.edge;
      } catch { /* yok */ }
      let fight = false, action = 0;
      try {
        const m = window.__tuslabArena3d?._debug?.models?.();
        fight = Boolean(m?.[1]);
        action = [1, 2].some(s => /^(q|e|r)$/.test(String(m?.[s]?.state))) ? 1 : 0;
      } catch { /* yok */ }
      if (fight && L.startLinks === null) L.startLinks = window.__vk.links;
      const rel = Math.round(t - L.t0);
      const cls = () => [...(root?.classList || [])].filter(c => /open|ko|ult|super|crit|end|inter|result|count|vs|focus/i.test(c)).join(' ');
      let q = '-'; try { q = window.__tuslabArena3d?.api?.quality?.() || '-'; } catch { /* yok */ }
      if (L.lastLinks !== undefined && window.__vk.links !== L.lastLinks && (L.linkAt || (L.linkAt = [])).length < 20) L.linkAt.push(`${rel}:+${window.__vk.links - L.lastLinks} b${busy > 0 ? 1 : 0} ${q} ${cls()}`);
      L.lastLinks = window.__vk.links;
      if (dt > 250 && (L.longAt || (L.longAt = [])).length < 20) L.longAt.push(`${rel}:${Math.round(dt)} b${busy > 0 ? 1 : 0} ${q} ${cls()}`);
      L.frames.push([Math.round(dt * 10) / 10, busy > 0 ? 1 : 0, fight ? 1 : 0, action]);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }, Boolean(P.off));
  const t0 = Date.now(); let shot = false;
  while (Date.now() - t0 < P.maxMs) {
    const s = await page.evaluate(() => {
      const root = document.querySelector('#pvp-root');
      const f = ['rui-inter-open', 'aui-summary-open', 'pvp15-results-open'].filter(x => root?.classList.contains(x));
      const L = window.__vp;
      return {f, rMs: L.rAt ? performance.now() - L.rAt : -1,
        w: (document.querySelector('.rui-word.is-active, .aui-word.is-active')?.textContent || document.querySelector('[data-tt-target]')?.textContent || '').trim()};
    }).catch(() => ({f: [], w: '', rMs: -1}));
    if (!shot && !P.off && s.rMs >= 1050) { shot = true; await page.screenshot({path: `.playwright-mcp/vfx-${P.f1}-r.png`}); }
    if (s.f.includes('pvp15-results-open')) break;
    if (!s.f.length && s.w && s.w.length > 1 && !/[✓]/.test(s.w)) { await page.keyboard.type(s.w, {delay: 8}); await page.keyboard.press('Space'); }
    await page.waitForTimeout(shot || s.rMs < 0 ? P.gap : 60);
  }
  const r = await page.evaluate(() => {
    const L = window.__vp, fx = window.__tuslabVfx;
    const sig = fx?.stats?.().signature || {};
    const fight = L.frames.slice(10).filter(f => f[2]);
    const avg = a => (a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(2) : null);
    const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
    const busy = fight.filter(f => f[1]).map(f => f[0]).filter(x => x < 250), idle = fight.filter(f => !f[1]).map(f => f[0]).filter(x => x < 250);
    // imza kayıtları: ad → {n, parçacık ort., yürütme ort/maks ms}
    const per = {};
    for (const row of sig.log || []) { const p = per[row.name] || (per[row.name] = {n: 0, particles: 0, msMax: 0}); p.n++; p.particles += row.particles; p.msMax = Math.max(p.msMax, row.ms); }
    for (const k of Object.keys(per)) per[k].particles = Math.round(per[k].particles / per[k].n);
    const upd = L.upd.slice(10);
    const act = fight.filter(f => f[3]).map(f => f[0]).filter(x => x < 250);
    return {casts: L.casts, counts: sig.counts, lastLog: per, frames: fight.length, off: Boolean(window.__vfxOff), linkAt: L.linkAt, longAt: L.longAt,
      avgAction: avg(act), medAction: med(act), nAction: act.length, avgFight: avg(fight.map(f => f[0]).filter(x => x < 250)),
      avgBusy: avg(busy), avgIdle: avg(idle), medBusy: med(busy), medIdle: med(idle), nBusy: busy.length,
      over250: fight.filter(f => f[0] > 250).length, over250Busy: fight.filter(f => f[0] > 250 && f[1]).length, maxFrame: Math.max(...fight.map(f => f[0])),
      fxUpdAvg: avg(upd), fxUpdMax: upd.length ? +Math.max(...upd).toFixed(2) : null,
      linksInFight: window.__vk.links - (L.startLinks ?? window.__vk.links), edgePulses: sig.edgePulses};
  });
  r.shot = shot; r.errs = errs.slice(0, 5); r.elapsed = Date.now() - t0;
  r.diag = await page.evaluate(() => ({cls: [...(document.querySelector('#pvp-root')?.classList || [])].join(' '), arena: Boolean(window.__tuslabArena3d), vfx: Boolean(window.__tuslabVfx), url: location.search})).catch(e => String(e));
  return r;
}
