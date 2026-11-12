// Dövüş temposu ölçümü (iş 1): her karede iki modelin GERÇEK durum adı + konumu.
async (page) => {
  let P = {};
  try { P = JSON.parse(await page.evaluate(() => localStorage.getItem('__ui') || '{}')); } catch { P = {}; }
  P = Object.assign({mode: 'rounds', w: 1366, h: 768, f1: 'vargr', f2: 'nyx', maxMs: 60000, gap: 260}, P);
  await page.setViewportSize({width: P.w, height: P.h});
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  // Kasma tanısı: gölgelendirici bağlama (linkProgram) zamanları + süreleri.
  await page.addInitScript(() => {
    window.__links = []; window.__lt = [];
    try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lt.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({type: 'longtask', buffered: true}); } catch { /* yok */ }
    for (const C of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) {
      if (!C) continue;
      const orig = C.prototype.linkProgram;
      C.prototype.linkProgram = function (p) { const a = performance.now(); const r = orig.call(this, p); window.__links.push([Math.round(a), Math.round(performance.now() - a)]); return r; };
      const gp = C.prototype.getProgramParameter;
      C.prototype.getProgramParameter = function (p, k) { const a = performance.now(); const r = gp.call(this, p, k); const d = performance.now() - a; if (d > 30) window.__links.push([Math.round(a), Math.round(d), 'status']); return r; };
    }
  });
  await page.goto(`http://127.0.0.1:5176/index.html?pvp=practice&mode=${P.mode}&bot=easy&karakter=${P.f1}&fighter1=${P.f1}&fighter2=${P.f2}&animprobe=1`);
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    const ATK = new Set(['q', 'e', 'r', 'walkBack']);
    const L = window.__tp = {t0: performance.now(), n: 0, bothAtk: 0, bothAtkAt: [], frames: [], segs: [], cur: {1: null, 2: null},
      maxJump: 0, jumpAt: null, px: null, submits: [], lat: [], evs: [], casts: []};
    const root = document.querySelector('#pvp-root');
    root?.addEventListener('tuslab:pvp-cast', e => L.casts.push([Math.round(performance.now() - L.t0), e.detail?.seat, e.detail?.skill]), true);
    root?.addEventListener('tuslab:pvp-strike', e => L.evs.push([Math.round(performance.now() - L.t0), 'strike', e.detail?.seat]), true);
    try { window.__tuslabAnimProbe?.start(); } catch { /* yok */ }
    let last = performance.now();
    const loop = () => {
      const t = performance.now(), rel = Math.round(t - L.t0);
      L.frames.push(Math.round(t - last)); if (t - last > 150 && (L.long ||= []).length < 40) L.long.push(rel + '+' + Math.round(t - last)); last = t; L.n++;
      let m = null; try { m = window.__tuslabArena3d?._debug?.models?.(); } catch { /* yok */ }
      let q = null; try { q = window.__tuslabVisualQueue?.snapshot?.(); } catch { /* yok */ }
      if (m && m[1] && m[2]) {
        const st = [m[1].state, m[2].state], xs = [m[1].x, m[2].x];
        const home = [1, 2].map(s => { try { return window.__tuslabArena3d._debug.fighter(s).home.x; } catch { return xs[s - 1]; } });
        // Saldıran = gerçek saldırı durumu ya da aktif sahnenin sahibi olarak yerinden oynamış; savunan tepkisi sayılmaz.
        const act = [0, 1].map(i => ATK.has(st[i]) || (q?.activeSeat === i + 1 && Math.abs(xs[i] - home[i]) > 0.06));
        if (ATK.has(st[0]) && ATK.has(st[1])) { L.bothAtk++; if (L.bothAtkAt.length < 12) L.bothAtkAt.push(rel + ':' + st.join('/') + ':' + xs.map(x => x.toFixed(2)).join(',')); }
        if (L.px) xs.forEach((x, i) => { const d = Math.abs(x - L.px[i]); if (d > L.maxJump) { L.maxJump = d; L.jumpAt = rel + ' s' + (i + 1) + ' ' + st[i] + ' dt' + L.frames[L.frames.length - 1]; } });
        L.px = xs;
        // segment: saldırı/hareket + tepki (non-idle) aralıkları
        const busy = [0, 1].map(i => st[i] !== 'idle' || Math.abs(xs[i] - home[i]) > 0.06);
        for (const i of [0, 1]) {
          const s = i + 1;
          if (act[i] && !L.cur[s]) L.cur[s] = {seat: s, a: rel, b: rel, q: q?.busy};
          if (act[i]) L.cur[s].b = rel;
          if (!act[i] && L.cur[s]) { L.segs.push(L.cur[s]); L.cur[s] = null; }
        }
        L.lastBusy = busy[0] || busy[1] ? rel : (L.lastBusy ?? rel);
        if (busy[0] || busy[1]) L.lastBusyAt = rel;
        // gecikme: son kelime gönderiminden seat1 saldırı başlangıcına (kuyruk boşken)
        if (act[0] && !L.prevAct1 && L.submits.length) {
          const sub = L.submits[L.submits.length - 1];
          if (sub.idle && !sub.used) { sub.used = true; L.lat.push(rel - sub.t); }
        }
        L.prevAct1 = act[0];
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    window.__tpSubmit = () => {
      let q = null; try { q = window.__tuslabVisualQueue?.snapshot?.(); } catch { /* yok */ }
      let m = null; try { m = window.__tuslabArena3d?._debug?.models?.(); } catch { /* yok */ }
      const idle = !q?.busy && m?.[1]?.state === 'idle' && m?.[2]?.state === 'idle';
      L.submits.push({t: Math.round(performance.now() - L.t0), idle});
    };
  });
  const t0 = Date.now(); let typed = 0;
  while (Date.now() - t0 < P.maxMs) {
    const s = await page.evaluate(() => { const root = document.querySelector('#pvp-root'); const f = ['rui-inter-open', 'aui-summary-open', 'pvp15-results-open'].filter(x => root?.classList.contains(x)); return {f, w: (document.querySelector('.rui-word.is-active, .aui-word.is-active')?.textContent || document.querySelector('[data-tt-target]')?.textContent || '').trim()}; }).catch(() => ({f: [], w: ''}));
    if (s.f.includes('pvp15-results-open')) break;
    if (!s.f.length && s.w && s.w.length > 1 && !/[✓]/.test(s.w)) { await page.keyboard.type(s.w, {delay: P.key ?? 8}); await page.evaluate(() => window.__tpSubmit?.()); await page.keyboard.press('Space'); typed++; }
    await page.waitForTimeout(P.gap);
  }
  const r = await page.evaluate(() => {
    const L = window.__tp;
    for (const s of [1, 2]) if (L.cur[s]) L.segs.push(L.cur[s]);
    const segs = L.segs.filter(s => s.b - s.a >= 60).sort((a, b) => a.a - b.a);
    // saldıran değişimi: ardışık segmentlerde koltuk değişince arada geçen boşluk
    const switches = [];
    for (let i = 1; i < segs.length; i++) if (segs[i].seat !== segs[i - 1].seat) switches.push(segs[i].a - segs[i - 1].b);
    const fr = L.frames.slice(5).sort((a, b) => a - b);
    const pct = p => fr[Math.min(fr.length - 1, Math.floor(fr.length * p))];
    const marks = (window.__tuslabAnimProbe?.events || []).map(e => Math.round(e.t - L.t0) + ' ' + e.type + ' s' + (e.seat ?? '') + ' ' + (e.skill || '') + (e.forced ? ' FORCED' : ''));
    const links = (window.__links || []).map(([a, d, k]) => [Math.round(a - L.t0), d, k || '']);
    return {longTasks: (window.__lt || []).map(([a, d]) => [Math.round(a - L.t0), d]).filter(x => x[0] > 0 && x[1] > 150).map(x => x.join('+')).slice(0, 30), linksDuringFight: links.filter(l => l[0] > 0).map(l => l.join(':')).slice(0, 40), linksBefore: links.filter(l => l[0] <= 0).length, long: L.long || [], frames: L.n, bothAtk: L.bothAtk, bothAtkAt: L.bothAtkAt, maxJump: +L.maxJump.toFixed(3), jumpAt: L.jumpAt,
      segs: segs.length, switches, switchMin: switches.length ? Math.min(...switches) : null, switchMax: switches.length ? Math.max(...switches) : null,
      lat: L.lat, frameP50: pct(0.5), frameP95: pct(0.95), frameMax: fr[fr.length - 1], over150: fr.filter(x => x > 150).length,
      casts: L.casts.length, castsDup: L.casts.filter((c, i, a) => i && a[i - 1][1] === c[1] && c[0] - a[i - 1][0] < 60).length,
      segList: segs.slice(0, 40).map(s => `${s.seat}:${s.a}-${s.b}`).join(' '), marks: marks.slice(0, 80)};
  });
  r.typed = typed; r.errs = errs.slice(0, 5);
  return r;
}
