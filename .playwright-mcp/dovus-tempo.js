// Dövüş temposu ölçümü (iş 1): kare başına iki modelin GERÇEK durum adı + konum; sıra/ara/sıçrama/gecikme/kare boşluğu.
async (page) => {
  const P = Object.assign({mode: 'rounds', w: 1366, h: 768, f1: 'vargr', f2: 'nyx', maxMs: 90000}, globalThis.__P || {});
  await page.setViewportSize({width: P.w, height: P.h});
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.goto(`http://127.0.0.1:5176/index.html?pvp=practice&mode=${P.mode}&bot=easy&karakter=${P.f1}&fighter1=${P.f1}&fighter2=${P.f2}&animprobe=1`);
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    const ATK = /^(q|e|r)$/;
    const L = window.__tp = {frames: 0, bothAtk: 0, bothBusy: 0, overlapStarts: [], jump: 0, jumpAt: 0, jumps: [], gaps: [], keys: [], casts: [], starts: [], turnGaps: [], longFrames: [], combat: []};
    const t0 = L.t0 = performance.now();
    const T = () => Math.round(performance.now() - t0);
    document.addEventListener('keydown', e => { if (e.key === ' ') { let busy = null; try { busy = window.__tuslabVisualQueue?.snapshot?.().busy; } catch {} L.keys.push([T(), busy]); } }, true);
    const root = document.querySelector('#pvp-root');
    root?.addEventListener('tuslab:pvp-cast', e => L.casts.push([T(), e.detail?.seat, e.detail?.skill]), true);
    root?.addEventListener('tuslab:pvp-combat', e => { const d = e.detail || {}; if (d.type === 'SKILL_CAST' && L.combat.length < 300) L.combat.push([T(), d.fromSeat, d.skill]); }, true);
    try { window.__tuslabAnimProbe?.start(); } catch {}
    let prev = null, lastBusyEnd = 0, lastAtkSeat = null, lastT = performance.now();
    const loop = () => {
      const tn = performance.now(); const dt = tn - lastT; lastT = tn;
      if (dt > 150 && L.longFrames.length < 40) L.longFrames.push(T() + '+' + Math.round(dt));
      let m = null; try { m = window.__tuslabArena3d?._debug?.models?.(); } catch {}
      if (m && m[1]?.loaded && m[2]?.loaded) {
        L.frames++;
        const st = [m[1].state, m[2].state], xs = [m[1].x, m[2].x];
        const busy = st.map(s => s && s !== 'idle');
        if (ATK.test(st[0]) && ATK.test(st[1])) L.bothAtk++;
        if (busy[0] && busy[1]) L.bothBusy++;
        if (prev) {
          for (let i = 0; i < 2; i++) {
            const d = Math.abs(xs[i] - prev.xs[i]);
            if (d > L.jump) { L.jump = d; L.jumpAt = T(); }
            if (d > 0.2 && L.jumps.length < 20) L.jumps.push(`${T()} s${i + 1} ${d.toFixed(2)} ${prev.st[i]}>${st[i]} dt${Math.round(dt)}`);
            if (ATK.test(st[i]) && !ATK.test(prev.st[i])) {
              const other = st[1 - i];
              L.starts.push([T(), i + 1, st[i], other]);
              if (other !== 'idle' && L.overlapStarts.length < 30) L.overlapStarts.push(`${T()} s${i + 1}:${st[i]} rakip=${other}`);
              if (lastAtkSeat !== null && lastAtkSeat !== i + 1) L.turnGaps.push([T(), i + 1, T() - lastBusyEnd]);
              lastAtkSeat = i + 1;
            }
          }
          if ((prev.busy[0] || prev.busy[1]) && !busy[0] && !busy[1]) lastBusyEnd = T();
        }
        prev = {st, xs, busy};
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  const tStart = Date.now(); let typed = 0;
  while (Date.now() - tStart < P.maxMs) {
    const s = await page.evaluate(() => { const root = document.querySelector('#pvp-root'); const f = ['rui-inter-open', 'aui-summary-open', 'pvp15-results-open'].filter(x => root?.classList.contains(x)); return {f, w: (document.querySelector('.rui-word.is-active, .aui-word.is-active')?.textContent || document.querySelector('[data-tt-target]')?.textContent || '').trim()}; }).catch(() => ({f: [], w: ''}));
    if (s.f.includes('pvp15-results-open')) break;
    if (!s.f.length && s.w && s.w.length > 1 && !/[✓]/.test(s.w)) { await page.keyboard.type(s.w, {delay: P.key ?? 8}); await page.keyboard.press('Space'); typed++; }
    await page.waitForTimeout(P.gap ?? 260);
  }
  const r = await page.evaluate(() => {
    const L = window.__tp;
    // kelime → ilk hareket: kuyruk boşken basılan Space'ten sonraki ilk seat1 saldırı başlangıcı (≤3 sn)
    const lat = [];
    for (const [t, busy] of L.keys) {
      if (busy) continue;
      const s = L.starts.find(x => x[1] === 1 && x[0] >= t && x[0] - t <= 3000);
      const c = L.casts.find(x => x[1] === 1 && x[0] >= t && x[0] - t <= 3000);
      if (s) lat.push(s[0] - t); else if (c) lat.push('c' + (c[0] - t));
    }
    const castToMove = [];
    for (const c of L.combat) { const s = L.starts.find(x => x[1] === c[1] && x[0] >= c[0] && x[0] - c[0] <= 4000); castToMove.push(s ? s[0] - c[0] : null); }
    // aynı koltuktan sahne başına cast sayısı: 400 ms içinde iki cast = çift olay
    const dupCasts = L.casts.filter((c, i) => i && L.casts[i - 1][1] === c[1] && c[0] - L.casts[i - 1][0] < 400).length;
    const tg = L.turnGaps.map(g => g[2]);
    return {frames: L.frames, bothAtk: L.bothAtk, bothBusy: L.bothBusy, overlapStarts: L.overlapStarts.length, overlapEx: L.overlapStarts.slice(0, 6),
      starts: L.starts.length, seatStarts: [1, 2].map(s => L.starts.filter(x => x[1] === s).length), casts: L.casts.length, dupCasts,
      turnGaps: tg, turnGapMin: tg.length ? Math.min(...tg) : null, turnGapMax: tg.length ? Math.max(...tg) : null,
      maxJump: [Number(L.jump.toFixed(3)), L.jumpAt], jumps: L.jumps.slice(0, 8),
      latency: lat.slice(0, 20), castToMove: castToMove.slice(0, 20), longFrames: L.longFrames.slice(0, 20), longCount: L.longFrames.length};
  });
  r.typed = typed; r.errs = errs.slice(0, 5);
  return r;
}
