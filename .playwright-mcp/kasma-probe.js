// Kasma tanısı (iş 1, 2. tur): dövüş temposu ölçümü + her uzun karenin (>150 ms) o anda başlayan olaylarla eşlenmesi.
async (page) => {
  let P = {};
  try { P = JSON.parse(await page.evaluate(() => localStorage.getItem('__ui') || '{}')); } catch { P = {}; }
  P = Object.assign({mode: 'rounds', w: 1366, h: 768, f1: 'vargr', f2: 'nyx', maxMs: 100000, gap: 260}, P);
  await page.setViewportSize({width: P.w, height: P.h});
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  // Başka işçinin yarım dosyaları: HEAD kopyası (anim3-probe ile aynı yalıtım).
  {
    const fs = await import('node:fs');
    const list = fs.existsSync('.playwright-mcp/head/list.txt') ? fs.readFileSync('.playwright-mcp/head/list.txt', 'utf8').split(/\r?\n/).filter(Boolean) : [];
    for (const f of list) await page.route(`**/${f}`, route => route.fulfill({status: 200, contentType: f.endsWith('.css') ? 'text/css' : 'text/javascript', body: fs.readFileSync(`.playwright-mcp/head/${f}`, 'utf8')}));
  }
  await page.addInitScript(() => {
    const E = window.__kev = []; // [t, tür, ayrıntı, süre]
    const push = (k, d, ms = 0) => { if (E.length < 4000) E.push([performance.now(), k, String(d).slice(0, 60), Math.round(ms)]); };
    window.__kpush = push;
    try { new PerformanceObserver(l => { for (const e of l.getEntries()) push('res', e.name.split('/').pop().split('?')[0], e.duration); }).observe({type: 'resource', buffered: false}); } catch { /* yok */ }
    try { new PerformanceObserver(l => { for (const e of l.getEntries()) push('longtask', e.name, e.duration); }).observe({type: 'longtask'}); } catch { /* yok */ }
    try { new PerformanceObserver(l => { for (const e of l.getEntries()) { const s = [...(e.scripts || [])].sort((a, b) => b.duration - a.duration)[0]; push('loaf', `blk${Math.round(e.blockingDuration)} rnd${Math.round(e.duration - (e.renderStart - e.startTime))} sty${Math.round(e.styleAndLayoutStart ? e.startTime + e.duration - e.styleAndLayoutStart : 0)} ${s ? (s.sourceFunctionName || s.invoker || '') + '@' + String(s.sourceURL || '').split('/').pop() + ':' + Math.round(s.duration) : ''}`, e.duration); } }).observe({type: 'long-animation-frame'}); } catch { /* yok */ }
    for (const C of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) {
      if (!C) continue;
      for (const fn of ['texImage2D', 'texSubImage2D', 'compressedTexImage2D', 'texStorage2D', 'generateMipmap', 'linkProgram', 'bufferData', 'readPixels', 'finish']) {
        const orig = C.prototype[fn]; if (!orig) continue;
        C.prototype[fn] = function (...a) { const t = performance.now(); const r = orig.apply(this, a); const d = performance.now() - t; if (d > 4 || fn === 'linkProgram' || fn === 'readPixels' || fn === 'finish') push('gl.' + fn, (a[5]?.src || a[6]?.constructor?.name || a[5]?.constructor?.name || '').toString().split('/').pop(), d); return r; };
      }
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC?.prototype?.decodeAudioData) { const o = AC.prototype.decodeAudioData; AC.prototype.decodeAudioData = function (...a) { const t = performance.now(); const p = o.apply(this, a); Promise.resolve(p).then(() => push('decode', 'audio', performance.now() - t)).catch(() => {}); return p; }; }
    const play = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function () { push('play', String(this.currentSrc || this.src).split('/').pop()); return play.call(this); };
  });
  await page.goto(`http://127.0.0.1:5176/index.html?pvp=practice&mode=${P.mode}&bot=easy&karakter=${P.f1}&fighter1=${P.f1}&fighter2=${P.f2}&animprobe=1`);
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    const ATK = new Set(['q', 'e', 'r', 'walkBack']);
    const L = window.__tp = {t0: performance.now(), n: 0, bothAtk: 0, bothAtkAt: [], frames: [], segs: [], cur: {1: null, 2: null},
      maxJump: 0, jumpAt: null, px: null, submits: [], lat: [], long: [], fightStart: null, clips: [{}, {}], slides: 0, slideAt: []};
    const root = document.querySelector('#pvp-root');
    const push = window.__kpush;
    root?.addEventListener('tuslab:pvp-cast', e => push('cast', 's' + e.detail?.seat + ' ' + e.detail?.skill), true);
    root?.addEventListener('tuslab:pvp-strike', e => push('strike', 's' + e.detail?.seat), true);
    try { new MutationObserver(ms => { for (const m of ms) { if (m.type === 'attributes') push('class', [...m.target.classList].filter(c => /open|ko|ult|super|crit|end|inter|result|count|vs/i.test(c)).join(' ')); else if (m.addedNodes.length > 2) push('dom+', m.addedNodes.length + ' ' + (m.target.className || '').toString().slice(0, 30)); } }).observe(root, {attributes: true, attributeFilter: ['class'], childList: true, subtree: true}); } catch { /* yok */ }
    try { window.__tuslabAnimProbe?.start(); } catch { /* yok */ }
    let last = performance.now(), lastClip = ['', ''], lastPos = null;
    const loop = () => {
      const t = performance.now(), rel = Math.round(t - L.t0), dt = t - last;
      L.frames.push(Math.round(dt)); last = t; L.n++;
      let m = null; try { m = window.__tuslabArena3d?._debug?.models?.(); } catch { /* yok */ }
      let q = null; try { q = window.__tuslabVisualQueue?.snapshot?.(); } catch { /* yok */ }
      if (dt > 150 && L.long.length < 60) {
        let pf = null; try { pf = window.__tuslabArena3d?._debug?.perf?.(); } catch { /* yok */ }
        const fx = (() => { try { return window.__tuslabArena3d?._debug?.skillFx?.(); } catch { return null; } })();
        L.long.push({t: rel, dt: Math.round(dt), st: m ? `${m[1].state}/${m[2].state} ${m[1].clip}/${m[2].clip}` : '-', q: q ? `${q.activeSeat}:${q.phase}` : '-', fx: fx?.live, pf, cls: [...(root?.classList || [])].filter(c => /open|ko|ult|super|crit|end|inter|result|count|vs/i.test(c)).join(' '), at: t - dt});
      }
      if (m && m[1] && m[2]) {
        if (L.fightStart === null) L.fightStart = rel;
        const st = [m[1].state, m[2].state], xs = [m[1].x, m[2].x];
        for (const i of [0, 1]) if (m[i + 1].clip !== lastClip[i]) { push('clip', `s${i + 1} ${m[i + 1].clip}`); lastClip[i] = m[i + 1].clip; }
        const home = [1, 2].map(s => { try { return window.__tuslabArena3d._debug.fighter(s).home.x; } catch { return xs[s - 1]; } });
        const act = [0, 1].map(i => ATK.has(st[i]) || (q?.activeSeat === i + 1 && Math.abs(xs[i] - home[i]) > 0.06));
        if (ATK.has(st[0]) && ATK.has(st[1])) { L.bothAtk++; if (L.bothAtkAt.length < 12) L.bothAtkAt.push(rel + ':' + st.join('/')); }
        if (L.px) xs.forEach((x, i) => {
          const d = Math.abs(x - L.px[i]);
          if (d > L.maxJump) { L.maxJump = d; L.jumpAt = rel + ' s' + (i + 1) + ' ' + st[i] + ' dt' + Math.round(dt); }
          // Ayak kayması: idle klibinde yatay hız > 0,6 birim/sn (yürüme/koşu klibi yok)
          const v = d / Math.max(0.001, dt / 1000);
          if (v > 0.6 && /idle/i.test(String(m[i + 1].clip || '')) && dt < 100) { L.slides++; if (L.slideAt.length < 10) L.slideAt.push(`${rel} s${i + 1} ${st[i]} ${m[i + 1].clip} v${v.toFixed(2)}`); }
        });
        L.px = xs;
        for (const i of [0, 1]) {
          const s = i + 1;
          if (act[i] && !L.cur[s]) L.cur[s] = {seat: s, a: rel, b: rel};
          if (act[i]) L.cur[s].b = rel;
          if (!act[i] && L.cur[s]) { L.segs.push(L.cur[s]); L.cur[s] = null; }
        }
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
    const L = window.__tp, E = window.__kev || [];
    for (const s of [1, 2]) if (L.cur[s]) L.segs.push(L.cur[s]);
    const segs = L.segs.filter(s => s.b - s.a >= 60).sort((a, b) => a.a - b.a);
    const switches = [];
    for (let i = 1; i < segs.length; i++) if (segs[i].seat !== segs[i - 1].seat) switches.push(segs[i].a - segs[i - 1].b);
    const fs = L.fightStart ?? 0;
    const fr = L.frames.slice(5);
    const inFight = []; { let acc = 0; for (const d of L.frames) { acc += d; if (acc >= fs) inFight.push(d); } }
    const avg = a => a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : null;
    const srt = fr.slice().sort((a, b) => a - b);
    const pct = p => srt[Math.min(srt.length - 1, Math.floor(srt.length * p))];
    // Her uzun kare: o karenin başladığı andan 400 ms öncesine dek başlayan olaylar
    const long = L.long.map(x => {
      const near = E.filter(e => e[0] >= x.at - 400 && e[0] <= x.at + x.dt && !/^(dom\+|class|decode)$/.test(e[1])).map(e => `${Math.round(e[0] - x.at)}:${e[1]}:${e[2]}${e[3] ? '(' + e[3] + ')' : ''}`).slice(0, 14);
      return `${x.t}+${x.dt} [${x.st}] q${x.q} fx${x.fx} ${x.cls} ${x.pf ? `step${x.pf.step} r${x.pf.ratio} ${x.pf.w}x${x.pf.h} calls${x.pf.calls} prog${x.pf.programs} tex${x.pf.textures}` : ''} || ${near.join(' ; ')}`;
    });
    const pf = (() => { try { return window.__tuslabArena3d?._debug?.perf?.(); } catch { return null; } })();
    return {long, frames: L.n, fightStartMs: fs, avgAll: avg(fr), avgFight: avg(inFight), over250Fight: inFight.filter(x => x > 250).length, over150Fight: inFight.filter(x => x > 150).length,
      frameP50: pct(0.5), frameP95: pct(0.95), frameMax: srt[srt.length - 1], perfEnd: pf,
      bothAtk: L.bothAtk, bothAtkAt: L.bothAtkAt, maxJump: +L.maxJump.toFixed(3), jumpAt: L.jumpAt, slides: L.slides, slideAt: L.slideAt,
      segs: segs.length, switchMin: switches.length ? Math.min(...switches) : null, switchMax: switches.length ? Math.max(...switches) : null, switchesBad: switches.filter(s => s < 600 || s > 2000),
      lat: L.lat, latMax: L.lat.length ? Math.max(...L.lat) : null, gl: E.filter(e => /^gl\.|decode|longtask/.test(e[1]) && e[0] - L.t0 > 0).map(e => `${Math.round(e[0] - L.t0)}:${e[1]}:${e[2]}(${e[3]})`).slice(0, 30)};
  });
  r.typed = typed; r.errs = errs.slice(0, 5);
  return r;
}
