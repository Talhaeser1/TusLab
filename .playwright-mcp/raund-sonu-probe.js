// KESINYAP iş 12: raund sonu eşzamanı + kamera + kasma. params {mode, style:'counted'|'timed', f1, f2, maxMs, gap, w, h}
async (page) => {
  let P = {};
  try { P = JSON.parse(await page.evaluate(() => localStorage.getItem('__ui') || '{}')); } catch { P = {}; }
  P = Object.assign({mode: 'rounds', style: 'counted', w: 1366, h: 768, f1: 'doran', f2: 'vargr', maxMs: 150000, gap: 240}, P);
  await page.setViewportSize({width: P.w, height: P.h});
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)); });
  // Yerel sunucu eşzamanlı isteklerde bağlantı reddedebiliyor: yeniden dene (ölçümü bozmasın).
  await page.route('http://127.0.0.1:5176/**', async route => {
    for (let i = 0; i < 6; i++) {
      try { const res = await route.fetch(); return route.fulfill({response: res}); } catch { await new Promise(r => setTimeout(r, 150 * (i + 1))); }
    }
    return route.abort();
  });
  {
    const fs = await import('node:fs');
    const list = fs.existsSync('.playwright-mcp/head/list.txt') ? fs.readFileSync('.playwright-mcp/head/list.txt', 'utf8').split(/\r?\n/).filter(Boolean) : [];
    for (const f of list) await page.route(`**/${f}`, route => route.fulfill({status: 200, contentType: f.endsWith('.css') ? 'text/css' : 'text/javascript', body: fs.readFileSync(`.playwright-mcp/head/${f}`, 'utf8')}));
  }
  await page.addInitScript(({style, finish, listeners}) => {
    try { localStorage.setItem('tuslab-pvp-practice-round-style', style); localStorage.setItem('tuslab-pvp-sfx-muted', 'true'); } catch { /* yok */ }
    const E = window.__kev = [];
    if (listeners) { // tanı: tuslab:* dinleyicilerinin süresi (işlev kaynağının başı ile gruplanır)
      const LS = window.__lst = {};
      const oA = EventTarget.prototype.addEventListener;
      EventTarget.prototype.addEventListener = function (type, fn, opt) {
        if (typeof fn !== 'function' || !/^tuslab:/.test(type)) return oA.call(this, type, fn, opt);
        const key = `${type}|${(fn.name || '') + ':' + String(fn).slice(0, 70).replace(/\s+/g, ' ')}`;
        const w = function (ev) { const t = performance.now(); try { return fn.call(this, ev); } finally { const d = performance.now() - t; const s = LS[key] ||= [0, 0, 0]; s[0]++; s[1] += d; s[2] = Math.max(s[2], d); } };
        return oA.call(this, type, w, opt);
      };
    }
    if (finish) {
      // Tanı: her çizimden sonra gl.finish → GPU tarafı takılma hangi programın/hedefin çiziminde (SHADER_NAME + çerçeve tamponu).
      const C = window.WebGL2RenderingContext; const names = new WeakMap(); let cur = null, fb = 'scr', draws = 0;
      const oL = C.prototype.linkProgram; C.prototype.linkProgram = function (p) { try { const src = (this.getAttachedShaders(p) || []).map(s => this.getShaderSource(s) || '').join('\n'); names.set(p, (src.match(/#define SHADER_NAME (\S+)/) || [])[1] || (src.match(/#define SHADER_TYPE (\S+)/) || [])[1] || `len${src.length}`); } catch { /* yok */ } return oL.call(this, p); };
      const oU = C.prototype.useProgram; C.prototype.useProgram = function (p) { cur = p; return oU.call(this, p); };
      const oB = C.prototype.bindFramebuffer; C.prototype.bindFramebuffer = function (t, f) { if (t !== this.READ_FRAMEBUFFER) fb = f ? 'rt' : 'scr'; return oB.call(this, t, f); };
      for (const fn of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
        const o = C.prototype[fn];
        C.prototype[fn] = function (...a) { const r = o.apply(this, a); if (finish === 'frame') return r; const t = performance.now(); if (finish === 'flush') this.flush(); else this.finish(); const d = performance.now() - t; draws++;
          if (d > 60 && E.length < 4000) E.push([t, 'slowdraw', `${names.get(cur) || '?'} ${fn} m${a[0]} n${a[1]} ${fb}`, Math.round(d)]); return r; };
      }
      if (finish === 'frame') { // kare başına tek finish
        const raf = window.requestAnimationFrame.bind(window); let ctx = null;
        const oG = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (...a) { const c = oG.apply(this, a); if (c && /webgl2/.test(a[0]) && !ctx) ctx = c; return c; };
        const tick = () => { if (ctx) { const t = performance.now(); ctx.finish(); const d = performance.now() - t; if (d > 60 && E.length < 4000) E.push([t, 'slowdraw', 'frame-finish', Math.round(d)]); } raf(tick); };
        window.addEventListener('load', () => setTimeout(() => raf(tick), 0));
      }
    }
    const push = (k, d, ms = 0, at = performance.now()) => { if (E.length < 4000) E.push([at, k, String(d).slice(0, 90), Math.round(ms)]); };
    window.__kpush = push;
    // LoAF: girdinin kendi başlangıç anı (geri çağırma donmadan SONRA gelir); betik + stil/yerleşim payı ayrı.
    try { new PerformanceObserver(l => { for (const e of l.getEntries()) { const sc = [...(e.scripts || [])].sort((a, b) => b.duration - a.duration); const s = sc[0]; const js = sc.reduce((n, x) => n + x.duration, 0);
      push('loaf', `${s ? (s.sourceFunctionName || s.invoker || '') + '@' + String(s.sourceURL || '').split('/').pop() + ':' + Math.round(s.duration) : '-'} js${Math.round(js)} sl${Math.round(e.styleAndLayoutStart ? e.startTime + e.duration - e.styleAndLayoutStart : 0)} rs${Math.round(e.renderStart ? e.startTime + e.duration - e.renderStart : 0)}`, e.duration, e.startTime); } }).observe({type: 'long-animation-frame', buffered: true}); } catch { /* yok */ }
    for (const C of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) {
      if (!C) continue;
      for (const fn of ['linkProgram', 'texImage2D', 'texSubImage2D', 'bufferData']) {
        const orig = C.prototype[fn]; if (!orig) continue;
        C.prototype[fn] = function (...a) { const t = performance.now(); const r = orig.apply(this, a); const d = performance.now() - t; if (d > 4 || fn === 'linkProgram') push('gl.' + fn, '', d); return r; };
      }
    }
    const disp = EventTarget.prototype.dispatchEvent;
    EventTarget.prototype.dispatchEvent = function (ev) { const t = performance.now(); const r = disp.call(this, ev); const d = performance.now() - t; if (d > 12 && /^tuslab/.test(ev.type)) push('disp', ev.type + ':' + (ev.detail?.type || ''), d); return r; };
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC?.prototype?.decodeAudioData) { const o = AC.prototype.decodeAudioData; AC.prototype.decodeAudioData = function (...a) { const t = performance.now(); const p = o.apply(this, a); Promise.resolve(p).then(() => push('decode', 'audio', performance.now() - t)).catch(() => {}); return p; }; }
  }, {style: P.style, finish: P.finish || false, listeners: Boolean(P.listeners)});
  await page.goto(`http://127.0.0.1:5176/index.html?pvp=practice&mode=${P.mode}&bot=easy&karakter=${P.f1}&fighter1=${P.f1}&fighter2=${P.f2}&animprobe=1`);
  await page.waitForTimeout(2500);
  if (P.css) await page.addStyleTag({content: P.css}); // tanı deneyi: bir katmanı kapat
  await page.evaluate(P2 => {
    const L = window.__rs ={t0: performance.now(), frames: [], fightStart: null, phase: 'pre', casts: {typing: 0, end: 0}, viol: [], floatsCard: [], cardOpens: [], cam: [], ev: [], long: [], hp: {}};
    const root = document.querySelector('#pvp-root');
    const rel = () => Math.round(performance.now() - L.t0);
    const vis = sel => { const n = document.querySelector(sel); return Boolean(n && !n.hidden && n.getClientRects().length); };
    const card = () => root.classList.contains('rui-inter-open') || root.classList.contains('aui-summary-open') || vis('.rui-intro') || vis('.rui-banner');
    const onPhase = e => {
      const t = e.detail?.type;
      if (['ROUND_START', 'EXCHANGE_START', 'ARENA_ROUND_START'].includes(t)) L.phase = 'typing';
      if (['ROUND_RESOLVE', 'EXCHANGE_RESOLVE', 'ARENA_ROUND_END', 'ROUND_END'].includes(t)) L.phase = 'end';
      L.ev.push([rel(), 'P', t]);
    };
    root.addEventListener('tuslab:pvp-round', onPhase, true);
    root.addEventListener('tuslab:pvp-arena', onPhase, true);
    root.addEventListener('tuslab:pvp-cast', e => { L.casts[L.phase === 'typing' ? 'typing' : 'end']++; L.ev.push([rel(), 'cast', e.detail?.seat, e.detail?.skill]); if (card()) L.viol.push(`${rel()} cast s${e.detail?.seat}`); }, true);
    new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.classList?.contains('pxd-float')) { L.ev.push([rel(), 'float', (n.textContent || '').trim().slice(0, 20), /seat-2/.test(n.className) ? 2 : 1]); if (card()) L.floatsCard.push(`${rel()} ${(n.textContent || '').trim().slice(0, 20)}`); } }).observe(root, {childList: true, subtree: true});
    try { window.__tuslabAnimProbe?.start(); } catch { /* yok */ }
    let last = performance.now(), wasCard = false, camUntil = 0;
    const loop = () => {
      const t = performance.now(), dt = t - last; last = t;
      let q = null; try { q = window.__tuslabVisualQueue?.snapshot?.(); } catch { /* yok */ }
      const a3 = window.__tuslabArena3d;
      const c = card();
      if (L.fightStart === null && a3) { try { const m = a3._debug.models(); if (m[1].loaded && m[2].loaded) L.fightStart = rel(); } catch { /* yok */ } }
      if (L.fightStart !== null) L.frames.push(Math.round(dt));
      if (a3 && L.frames.length % 10 === 0) { try { const p = a3._debug.perf(); const k = `step${p.step} ${p.quality} bloom${p.bloom} r${p.ratio} ${a3._debug.lights?.() || ''}`; if (k !== L.perfKey) { L.perfKey = k; L.ev.push([rel(), 'perf', k]); } } catch { /* yok */ } }
      if (L.fightStart !== null && !L.prog0 && rel() > L.fightStart + 4000) {
        try { L.prog0 = a3._debug.programs(); L.full0 = a3._debug.programs(true); } catch { L.prog0 = []; }
        // Not: Material.prototype.onBeforeCompile'ı yamamak program anahtarını değiştirir (sahte derleme) — kullanılmaz.
      }
      if (P2.gpu && a3) { try { const p = a3._debug.perf(); (L.gq ||= []).push(`${p.calls}/${Math.round(p.tris / 1000)}k/p${p.programs}/t${p.textures}/g${p.geometries}`); if (L.gq.length > 4) L.gq.shift(); } catch { /* yok */ } }
      if (dt > 250 && L.long.length < 40 && L.fightStart !== null) L.long.push({t: rel(), dt: Math.round(dt), at: t - dt, gq: (L.gq || []).join(' ')});
      if (c && q?.active) L.viol.push(`${rel()} sahne s${q.activeSeat}:${q.phase}`);
      if (c && !wasCard) { L.cardOpens.push(rel()); camUntil = t + 4000; }
      wasCard = c;
      if (c && t < camUntil && a3 && L.cam.length < 400) {
        try {
          const s = a3._debug.screen();
          const vw = innerWidth, vh = innerHeight;
          const boxes = (s.boxes || []).map(b => ({seat: b.seat, in: b.l >= -2 && b.t >= -2 && b.r <= vw + 2 && b.b <= vh + 2, hFrac: +((b.b - b.t) / vh).toFixed(2)}));
          L.cam.push({t: rel(), boxes});
        } catch { /* yok */ }
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }, P);
  const t0 = Date.now(); let typed = 0;
  while (Date.now() - t0 < P.maxMs) {
    const s = await page.evaluate(() => { const root = document.querySelector('#pvp-root'); const f = ['rui-inter-open', 'aui-summary-open', 'pvp15-results-open'].filter(x => root?.classList.contains(x)); const inp = document.querySelector('[data-tt-input]'); return {f, lock: Boolean(inp?.disabled), w: (document.querySelector('.rui-word.is-active, .aui-word.is-active')?.textContent || document.querySelector('[data-tt-target]')?.textContent || '').trim()}; }).catch(() => ({f: [], w: ''}));
    if (s.f.includes('pvp15-results-open')) { await page.waitForTimeout(2500); break; }
    if (!s.f.length && !s.lock && s.w && s.w.length > 1 && !/[✓]/.test(s.w)) { await page.keyboard.type(s.w, {delay: P.key ?? 8}); await page.keyboard.press('Space'); typed++; }
    await page.waitForTimeout(P.gap);
  }
  const r = await page.evaluate(() => {
    const L = window.__rs, E = window.__kev || [];
    const PM = (window.__tuslabAnimProbe?.events || []);
    const fr = L.frames.slice(5), srt = fr.slice().sort((a, b) => a - b);
    const pct = p => srt.length ? srt[Math.min(srt.length - 1, Math.floor(srt.length * p))] : null;
    const long = L.long.map(x => `${x.t}+${x.dt} ${x.gq || ''} || ` + E.filter(e => e[0] >= x.at - 300 && e[0] <= x.at + x.dt).map(e => `${Math.round(e[0] - x.at)}:${e[1]}:${e[2]}(${e[3]})`).slice(0, 6).join(' ; ')
      + ' | ' + PM.filter(e => e.t >= x.at - 400 && e.t <= x.at + 50).map(e => `${Math.round(e.t - x.at)}:${e.type}${e.seat ?? ''}${e.skill || ''}`).slice(0, 5).join(' ')
      + ' | ' + L.ev.filter(e => e[0] >= x.t - x.dt - 400 && e[0] <= x.t).map(e => `${e[1]}:${e[2]}`).slice(0, 4).join(' '));
    const camBad = L.cam.filter(c => c.boxes.length < 2 || c.boxes.some(b => !b.in || b.hFrac > 0.7));
    const contacts = PM.filter(e => e.type === 'contact').length;
    // Sahne süreleri (cast → end, aynı koltuk) ve önceki sahne bitişinden ara: motor planının üst sınırlarıyla karşılaştırma.
    const scenes = []; { const open = {}; let lastEnd = null;
      for (const e of PM) {
        if (e.type === 'cast') open[e.seat] = {t: e.t, skill: e.skill, n: e.chain?.strikes || 1};
        if (e.type === 'extend' && open[e.seat]) open[e.seat].n++;
        if (e.type === 'end' && open[e.seat] && !e.cancelled) { const o = open[e.seat]; scenes.push(`${Math.round(o.t - L.t0)} s${e.seat}${o.skill}x${o.n} ${Math.round(e.t - o.t)}ms gap${lastEnd === null ? '-' : Math.round(o.t - lastEnd)}${e.forced ? ' F' : ''}`); lastEnd = e.t; delete open[e.seat]; }
      } }
    const slow = E.filter(e => e[1] === 'slowdraw').map(e => `${Math.round(e[0] - L.t0)}:${e[2]}(${e[3]})`).slice(0, 30);
    const lst = Object.entries(window.__lst || {}).sort((a, b) => b[1][1] - a[1][1]).slice(0, 10).map(([k, v]) => `${k.slice(0, 110)} n${v[0]} top${Math.round(v[1])} max${Math.round(v[2])}`);
    // E: her hasar sayısı (yazı değil, rakam içeren) → saldıranın en yakın temas işaretine uzaklık (ms).
    const cts = PM.filter(e => e.type === 'contact' || e.type === 'impact').map(e => [Math.round(e.t - L.t0), e.seat]);
    const fl = L.ev.filter(e => e[1] === 'float' && /\d/.test(e[2]) && !/PERFECT|PARRY/.test(e[2]));
    const fdist = fl.map(f => { const atk = f[3] === 2 ? 1 : 2; const d = cts.filter(c => c[1] === atk).map(c => f[0] - c[0]); const best = d.length ? d.reduce((a, b) => Math.abs(b) < Math.abs(a) ? b : a) : null; return {t: f[0], txt: f[2], seat: f[3], d: best}; });
    const floatFar = fdist.filter(x => x.d === null || Math.abs(x.d) > 100);
    return {floatsN: fdist.length, floatFar: floatFar.length, floatFarSample: floatFar.slice(0, 6).map(x => `${x.t}:s${x.seat}:${x.txt}:d${x.d} || ` + PM.filter(e => Math.abs(e.t - L.t0 - x.t) < 2500).map(e => `${Math.round(e.t - L.t0 - x.t)}:${e.type}${e.seat ?? ''}${e.skill || ''}${e.forced ? 'F' : ''}`).slice(-10).join(' ')),
      lst, scenes, slow, frames: fr.length, p50: pct(0.5), p95: pct(0.95), max: srt.at(-1), over250: fr.filter(x => x > 250).length, long: long.slice(0, 12),
      casts: L.casts, contacts, ultSkip: PM.filter(e => e.type === 'ultSkip').map(e => `${Math.round(e.t - L.t0)}:s${e.seat}:${e.skill}`).slice(0, 8), silent: PM.filter(e => e.type === 'silent').map(e => `${Math.round(e.t - L.t0)}:s${e.seat}:${e.skill || ''} || ` + PM.filter(x => x.t >= e.t - 1500 && x.t <= e.t + 300 && x !== e).map(x => `${Math.round(x.t - e.t)}:${x.type}${x.seat ?? ''}${x.skill || ''}`).slice(-8).join(' ') + ' || ' + L.ev.filter(x => x[0] >= e.t - L.t0 - 1500 && x[0] <= e.t - L.t0 + 300).map(x => x.join(':')).slice(-6).join(' ')).slice(0, 12),
      forced: PM.filter(e => e.type === 'end' && e.forced).length,
      cardOpens: L.cardOpens, viol: L.viol.length, violSample: [...new Set(L.viol.map(v => v.split(' ').slice(1).join(' ')))].slice(0, 6), violFirst: L.viol.slice(0, 4),
      floatsCard: L.floatsCard.slice(0, 8), camSamples: L.cam.length, camBad: camBad.length, camBadSample: camBad.slice(0, 3),
      camMaxH: L.cam.length ? Math.max(...L.cam.flatMap(c => c.boxes.map(b => b.hFrac))) : null,
      gl: E.filter(e => /^gl\.linkProgram|decode/.test(e[1]) && e[0] - L.t0 > (L.fightStart || 0)).length,
      disp: Object.entries(E.filter(e => e[1] === 'disp' && e[0] - L.t0 > (L.fightStart || 0)).reduce((o, e) => { const k = e[2]; o[k] = o[k] || [0, 0]; o[k][0]++; o[k][1] = Math.max(o[k][1], e[3]); return o; }, {})).sort((a, b) => b[1][1] - a[1][1]).slice(0, 10).map(([k, v]) => `${k} n${v[0]} max${v[1]}`),
      newPrograms: (() => { try { const now = window.__tuslabArena3d._debug.programs(); const base = new Set(L.prog0 || []); return {start: (L.prog0 || []).length, end: now.length, added: now.filter(p => !base.has(p)).slice(0, 8)}; } catch (e) { return String(e).slice(0, 80); } })(),
      keyDiff: (() => { try {
        const base = L.full0 || [], now = window.__tuslabArena3d._debug.programs(true), set = new Set(base);
        const nw = now.filter(k => !set.has(k)); const phys = nw.find(k => /^physical/.test(k)) || nw[0];
        if (phys) return [phys, ...base.filter(b => b.split(',').slice(0, 2).join() === phys.split(',').slice(0, 2).join()).slice(0, 1)];
        return nw.slice(0, 4).map(k => {
          const t = k.split(','); let best = null, bd = 1e9;
          for (const b of base) { const u = b.split(','); if (u.length !== t.length) continue; const d = t.filter((x, i) => x !== u[i]).length; if (d < bd) { bd = d; best = u; } }
          return best ? t.map((x, i) => x !== best[i] ? `${i}:${best[i]}→${x}` : null).filter(Boolean).join(' ') : 'eşsiz ' + t.length;
        });
      } catch (e) { return String(e).slice(0, 80); } })(),
      compiles: (L.compiles || []).map(c => c.split(' Kt ')[0]),
      perf: L.ev.filter(e => e[1] === 'perf').map(e => `${e[0]}:${e[2]}`),
      floatCtx: L.floatsCard.slice(0, 3).map(f => { const t = +f.split(' ')[0]; const marks = PM.map(e => [Math.round(e.t - L.t0), 'm:' + e.type, e.seat ?? '', e.skill || '', e.forced ? 'F' : '']); return L.ev.concat(marks).sort((a, b) => a[0] - b[0]).filter(e => e[0] > t - 4000 && e[0] <= t + 50).map(e => e.join(' ')).slice(-12); }),
      phases: L.ev.filter(e => e[1] === 'P').map(e => `${e[0]}:${e[2]}`).slice(0, 40)};
  });
  r.typed = typed; r.errs = errs.slice(0, 5); r.P = P;
  return r;
}
