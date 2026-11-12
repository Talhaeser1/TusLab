// Dövüş animasyonu 3. tur ölçümü: HER rAF karesinde iki modelin dünya konumu, baskın klip/ağırlık/hız, yön;
// sahne başına çizelge (gidiş, vuruş, temas, hasar/can, dönüş, idle arası). Çıktı özettir.
async (page) => {
  let P = {};
  try { P = JSON.parse(await page.evaluate(() => localStorage.getItem('__ui') || '{}')); } catch { P = {}; }
  P = Object.assign({mode: 'rounds', w: 1366, h: 768, f1: 'vargr', f2: 'doran', maxMs: 100000, gap: 260}, P);
  await page.setViewportSize({width: P.w, height: P.h});
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  // Başka işçinin yarım bıraktığı dosyalar ölçümü bozmasın: HEAD kopyası sunulur (P.head=false ile kapanır).
  if (P.head !== false) {
    const fs = await import('node:fs');
    const list = fs.existsSync('.playwright-mcp/head/list.txt') ? fs.readFileSync('.playwright-mcp/head/list.txt', 'utf8').split(/\r?\n/).filter(Boolean) : [];
    for (const f of list) {
      const file = `.playwright-mcp/head/${f}`;
      const type = f.endsWith('.css') ? 'text/css' : 'text/javascript';
      if (fs.existsSync(file)) await page.route(`**/${f}`, route => route.fulfill({status: 200, contentType: type, body: fs.readFileSync(file, 'utf8')}));
    }
  }
  await page.goto(`http://127.0.0.1:5176/index.html?pvp=practice&mode=${P.mode}&bot=easy&karakter=${P.f1}&fighter1=${P.f1}&fighter2=${P.f2}&animprobe=1`);
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    const L = window.__a3 = {t0: performance.now(), F: [], ev: [], calloutFrames: 0, calloutText: ''};
    const root = document.querySelector('#pvp-root');
    const rel = () => Math.round(performance.now() - L.t0);
    root.addEventListener('tuslab:pvp-cast', e => L.ev.push([rel(), 'cast', e.detail?.seat, e.detail?.skill]), true);
    root.addEventListener('tuslab:pvp-strike', e => L.ev.push([rel(), 'strike', e.detail?.seat, e.detail?.skill]), true);
    root.addEventListener('tuslab:pvp-impact', e => L.ev.push([rel(), 'impact', e.detail?.fromSeat, e.detail?.skill, e.detail?.amount]), true);
    new MutationObserver(ms => {
      for (const m of ms) {
        if (m.type === 'childList') for (const n of m.addedNodes) { if (n.classList?.contains('pxd-float')) L.ev.push([rel(), 'float', /seat-2/.test(n.className) ? 2 : 1, (n.textContent || '').trim().slice(0, 24)]); }
      }
    }).observe(root, {childList: true, subtree: true});
    L.hpLast = {};
    try { window.__tuslabAnimProbe?.start(); } catch { /* yok */ }
    let last = performance.now();
    const loop = () => {
      const t = performance.now(), dt = t - last; last = t;
      let m = null, q = null;
      try { m = window.__tuslabArena3d?._debug?.models?.(); } catch { /* yok */ }
      try { q = window.__tuslabVisualQueue?.snapshot?.(); } catch { /* yok */ }
      if (m && m[1]?.loaded && m[2]?.loaded) {
        const row = [Math.round(t - L.t0), Math.round(dt)];
        for (const s of [1, 2]) { const a = m[s]; row.push(+a.x.toFixed(4), +(a.z || 0).toFixed(4), a.top || a.clip || '', +(a.topW || 0).toFixed(2), +(a.topTs || 0).toFixed(2), a.state, +(a.rotY || 0).toFixed(3), +(a.homeX ?? a.x).toFixed(3), +(a.timeScale ?? 1).toFixed(2)); }
        row.push(q ? `${q.activeSeat ?? '-'}:${q.phase}` : '-');
        if (L.F.length < 40000) L.F.push(row);
        // Boyanan can (rAF anında): yalnız gerçekten görünen düşüşler sayılır.
        for (const s of [1, 2]) {
          const n = root.querySelector(`.pvp2-side[data-seat="${s}"] [data-server-hp-fill]`);
          const sx = n && /scaleX\(([\d.]+)\)/.exec(n.style.transform || ''); const v = sx ? +sx[1] : null;
          if (v !== null && L.hpLast[s] !== undefined && v < L.hpLast[s] - 1e-4) L.ev.push([row[0], 'hp', s, +(L.hpLast[s] - v).toFixed(3)]);
          if (v !== null) L.hpLast[s] = v;
        }
        const c = document.querySelector('[data-attack-callout]');
        if (c && !c.hidden && getComputedStyle(c).display !== 'none' && (c.textContent || '').trim()) { L.calloutFrames++; L.calloutText = c.textContent.trim().slice(0, 60); }
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  const t0 = Date.now(); let typed = 0;
  while (Date.now() - t0 < P.maxMs) {
    const s = await page.evaluate(() => { const root = document.querySelector('#pvp-root'); const f = ['rui-inter-open', 'aui-summary-open', 'pvp15-results-open'].filter(x => root?.classList.contains(x)); return {f, w: (document.querySelector('.rui-word.is-active, .aui-word.is-active')?.textContent || document.querySelector('[data-tt-target]')?.textContent || '').trim()}; }).catch(() => ({f: [], w: ''}));
    if (s.f.includes('pvp15-results-open')) { await page.waitForTimeout(4000); break; }
    if (!s.f.length && s.w && s.w.length > 1 && !/[✓]/.test(s.w)) { await page.keyboard.type(s.w, {delay: P.key ?? 8}); await page.keyboard.press('Space'); typed++; }
    await page.waitForTimeout(P.gap);
  }
  const r = await page.evaluate(() => {
    const L = window.__a3, F = L.F, ev = L.ev;
    // satır: t dt | s1: x z top w ts state rotY homeX rigTs | s2: ... | q
    const S = s => (s === 1 ? 2 : 11);
    const IDLE = /Combat_Stance|Idle/i, MOVE = /Run_Charge|Forward_Charge|Walk|Dodge_Forward/i;
    const get = (row, s) => { const o = S(s); return {x: row[o], z: row[o + 1], top: row[o + 2], w: row[o + 3], ts: row[o + 4], st: row[o + 5], rot: row[o + 6], home: row[o + 7]}; };
    let maxJump = 0, jumpAt = '', maxJump60 = 0, bothAtk = 0;
    const ATK = new Set(['q', 'e', 'r']);
    let idleSlide = 0, idleSlideAt = [];
    for (let i = 1; i < F.length; i++) {
      for (const s of [1, 2]) {
        const a = get(F[i], s), b = get(F[i - 1], s);
        const d = Math.hypot(a.x - b.x, a.z - b.z);
        if (d > maxJump) { maxJump = d; jumpAt = `${F[i][0]} s${s} ${a.st} ${a.top} dt${F[i][1]}`; }
        if (F[i][1] <= 20 && d > maxJump60) maxJump60 = d;
        const v = d / Math.max(0.001, F[i][1] / 1000);
        if (v > 0.6 && IDLE.test(a.top) && F[i][1] < 100) { idleSlide++; if (idleSlideAt.length < 6) idleSlideAt.push(`${F[i][0]} s${s} ${a.st} v${v.toFixed(2)}`); }
      }
      if (ATK.has(get(F[i], 1).st) && ATK.has(get(F[i], 2).st)) bothAtk++;
    }
    // Sahneler: koltuğun SALDIRI bölümleri (durum q/e/r ya da evden > 0,03 uzakta ve tepki klibinde değil),
    // aralar < 200 ms birleşir. Her bölümün başındaki cast olayı becerisini verir.
    // Sahne pencereleri: arena'nın kendi işaretleri (cast → aynı koltuğun end'i) — görsel kuyruğun gerçek sahnesi.
    const PM = (window.__tuslabAnimProbe?.events || []).map(e => ({t: Math.round(e.t - L.t0), type: e.type, seat: e.seat, skill: e.skill, forced: e.forced}));
    const scenes = [];
    for (const c of PM.filter(e => e.type === 'cast')) {
      const s = c.seat, tc = c.t, skill = c.skill;
      const endM = PM.find(e => e.type === 'end' && e.seat === s && e.t >= tc);
      const tEnd = endM ? endM.t : tc + 8000;
      const rows = F.filter(r => r[0] >= tc && r[0] <= tEnd + 400);
      if (!rows.length) continue;
      const home = get(rows[0], s).home;
      const disp = rows.map(r => Math.abs(get(r, s).x - home));
      const mx = Math.max(...disp);
      const sc = {seat: s, skill, t: tc, maxDisp: +mx.toFixed(2)};
      const clipsIn = (a, b) => { const c = {}; for (let i = a; i <= b && i < rows.length; i++) { const n = get(rows[i], s).top || '-'; c[n] = (c[n] || 0) + 1; } return c; };
      if (mx > 0.25) {
        const i0 = disp.findIndex(d => d > 0.03);
        const iA = disp.findIndex(d => d >= mx * 0.97);
        let iR = iA; for (let i = iA; i < disp.length; i++) if (disp[i] >= mx * 0.97) iR = i; else if (disp[i] < mx * 0.9) break;
        let iE = disp.findIndex((d, i) => i > iR && d < 0.03); if (iE < 0) iE = disp.length - 1;
        sc.goMs = rows[iA][0] - rows[i0][0]; sc.goClips = clipsIn(i0, iA);
        sc.retMs = rows[iE][0] - rows[iR][0]; sc.retClips = clipsIn(iR + 1, iE);
        let back = 0, n = 0, jr = 0;
        for (let i = iR + 1; i <= iE; i++) {
          const a = get(rows[i], s), b = get(rows[i - 1], s); const dx = a.x - b.x;
          jr = Math.max(jr, Math.abs(dx));
          if (Math.abs(dx) > 1e-4) { n++; if (Math.sign(Math.sin(a.rot)) !== Math.sign(dx)) back++; }
        }
        sc.retMaxStep = +jr.toFixed(3); sc.retBackFacing = n ? Math.round(100 * back / n) : null;
        // dönüş sonrası idle'a geçiş
        const iI = rows.findIndex((r, i) => i >= iE && IDLE.test(get(r, s).top));
        sc.idleAfterRetMs = iI >= 0 ? rows[iI][0] - rows[iE][0] : null;
        sc.endT = rows[iE][0];
      } else {
        const iI = rows.findIndex((r, i) => i > 5 && IDLE.test(get(r, s).top));
        sc.endT = iI >= 0 ? rows[iI][0] : rows[rows.length - 1][0];
        sc.clips = clipsIn(0, Math.max(0, iI));
      }
      // vuruş klibi: ilk saldırı klibi (hareket/idle değil)
      const atkRow = rows.find(r => { const a = get(r, s); return a.top && !IDLE.test(a.top) && !MOVE.test(a.top); });
      if (atkRow) { const a = get(atkRow, s); sc.atkClip = a.top; const tsList = rows.filter(r => get(r, s).top === a.top).map(r => get(r, s).ts); sc.atkTs = [Math.min(...tsList), Math.max(...tsList)].map(v => +v.toFixed(2)); sc.atkMs = rows.filter(r => get(r, s).top === a.top).length ? rows.filter(r => get(r, s).top === a.top).slice(-1)[0][0] - atkRow[0] : 0; }
      sc.endT = tEnd; sc.forced = Boolean(endM?.forced);
      const win = e => e[0] >= tc && e[0] < tEnd + 300;
      const strikes = ev.filter(e => e[1] === 'strike' && e[2] === s && win(e)).map(e => e[0] - tc);
      const impacts = ev.filter(e => e[1] === 'impact' && e[2] === s && win(e)).map(e => e[0] - tc);
      const floats = ev.filter(e => e[1] === 'float' && e[2] === (s === 1 ? 2 : 1) && win(e)).map(e => e[0] - tc);
      const hps = ev.filter(e => e[1] === 'hp' && e[2] === (s === 1 ? 2 : 1) && win(e)).map(e => e[0] - tc);
      const first = Math.min(...strikes, ...impacts, Infinity);
      sc.early = ev.filter(e => e[1] === 'float' && e[2] === (s === 1 ? 2 : 1) && win(e) && e[0] - tc < first - 100).map(e => (e[0] - tc) + ':' + e[3]);
      Object.assign(sc, {strike: strikes, impact: impacts, float: floats, hp: hps});
      scenes.push(sc);
    }
    // saldıran değişimi arası idle: bir sahnenin bitişinden (yerinde) karşı koltuğun sonraki cast'ine
    const switches = [];
    for (let k = 1; k < scenes.length; k++) if (scenes[k].seat !== scenes[k - 1].seat && scenes[k - 1].endT) switches.push(scenes[k].t - scenes[k - 1].endT);
    // sahnesiz hasar: hp düşüşü / float, hiçbir sahnenin [cast, end+300] penceresinde değilse
    const inScene = (t, seatDef) => scenes.some(sc => sc.seat !== seatDef && t >= sc.t && t <= (sc.endT ?? sc.t + 6000) + 300);
    const orphanHp = ev.filter(e => e[1] === 'hp' && !inScene(e[0], e[2])).map(e => e[0]);
    const orphanFloat = ev.filter(e => e[1] === 'float' && !inScene(e[0], e[2])).map(e => `${e[0]}:${e[3]}`);
    // Teşhis: sahnesiz hasarların çevresindeki olaylar (DOM + arena probe: cast/contact/end/forced/compact).
    const marks = (window.__tuslabAnimProbe?.events || []).map(e => [Math.round(e.t - L.t0), 'm:' + e.type, e.seat ?? '', (e.skill || '') + (e.forced ? ' FORCED' : '') + (e.cancelled ? ' CANCEL' : '') + (e.folded ? ' fold' + e.folded : '')]);
    const all = ev.concat(marks).sort((a, b) => a[0] - b[0]);
    const probs = ev.filter(e => (e[1] === 'float' || e[1] === 'hp') && !inScene(e[0], e[2])).map(e => e[0]).slice(0, 4);
    const evlog = [];
    for (const t of probs) { evlog.push(`--- ${t}`); for (const e of all) if (e[0] >= t - 2500 && e[0] <= t + 200) evlog.push(e.join(' ')); }
    const forcedEnds = PM.filter(e => e.type === 'end' && e.forced).length;
    const silents = PM.filter(e => e.type === 'silent').map(e => e.t + ':' + e.skill);
    const fr = F.map(r => r[1]).slice(5);
    return {frames: F.length, avgDt: +(fr.reduce((a, b) => a + b, 0) / Math.max(1, fr.length)).toFixed(1), over250: fr.filter(x => x > 250).length, maxDt: Math.max(...fr),
      maxJump: +maxJump.toFixed(3), maxJump60: +maxJump60.toFixed(3), jumpAt, bothAtk, idleSlide, idleSlideAt,
      forcedEnds, silents: silents.slice(0, 12), evlog: evlog.slice(0, 60), switches, orphanHp: orphanHp.slice(0, 10), orphanFloat: orphanFloat.slice(0, 10), calloutFrames: L.calloutFrames, calloutText: L.calloutText,
      scenes: scenes.slice(0, 40).map(sc => {
        const top = o => o ? Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k}×${v}`).join(',') : '';
        const near = (list, ref) => list.length && ref.length ? Math.max(...list.map(x => Math.min(...ref.map(y => Math.abs(x - y))))) : null;
        return `s${sc.seat}${sc.skill}@${sc.t} disp${sc.maxDisp}` + (sc.goMs !== undefined ? ` GO ${sc.goMs}ms[${top(sc.goClips)}] RET ${sc.retMs}ms[${top(sc.retClips)}] step${sc.retMaxStep} back${sc.retBackFacing}% idle+${sc.idleAfterRetMs}` : ` STAY[${top(sc.clips)}]`) +
          ` ATK ${sc.atkClip || '-'} ts${(sc.atkTs || []).join('-')} ${sc.atkMs ?? ''}ms | strike ${sc.strike.join(',')} | float ${sc.float.join(',')} | hp ${sc.hp.join(',')} | dFloat${near(sc.float, sc.strike.concat(sc.impact))} early[${sc.early.join(',')}] dHp${near(sc.hp, sc.strike.concat(sc.impact))} end${sc.endT - sc.t}`;
      })};
  });
  r.diag = await page.evaluate(() => ({url: location.search.slice(0, 80), cls: document.querySelector('#pvp-root')?.className, hidden: document.querySelector('#pvp-root')?.hidden,
    arena: Boolean(window.__tuslabArena3d), loaded: (() => { try { const m = window.__tuslabArena3d._debug.models(); return [m[1].loaded, m[2].loaded]; } catch (e) { return String(e).slice(0, 80); } })(),
    word: (document.querySelector('.rui-word.is-active, .aui-word.is-active')?.textContent || document.querySelector('[data-tt-target]')?.textContent || '').trim().slice(0, 20)})).catch(e => String(e).slice(0, 120));
  r.typed = typed; r.errs = errs.slice(0, 5); r.P = P;
  return r;
}
