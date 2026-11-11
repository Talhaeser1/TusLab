// Dövüş sunumu ölçümü: sıra sıra saldırı, kombo sayacı, saldırı yazısı, kritik katmanı, model durumları.
async (page) => {
  const P = Object.assign({mode: 'rounds', w: 1366, h: 768, f1: 'vargr', f2: 'nyx', maxMs: 75000}, globalThis.__P || {});
  await page.setViewportSize({width: P.w, height: P.h});
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.goto(`http://127.0.0.1:5176/index.html?pvp=practice&mode=${P.mode}&bot=easy&karakter=${P.f1}&fighter1=${P.f1}&fighter2=${P.f2}&animprobe=1${P.q || ''}`);
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    const L = window.__dv = {samples: [], combo: new Set(), callout: new Set(), crit: new Set(), status: new Set(), both: 0, n: 0, phases: [], lastKey: ''};
    const txt = e => (e?.textContent || '').replace(/\s+/g, ' ').trim();
    const vis = e => { if (!e) return false; const r = e.getBoundingClientRect(), c = getComputedStyle(e); return r.width > 2 && r.height > 2 && c.display !== 'none' && c.visibility !== 'hidden' && Number(c.opacity) > 0.05; };
    const t0 = performance.now(); L.t0 = t0; L.hp = []; L.lastHp = ''; L.ev = [];
    document.querySelector('#pvp-root')?.addEventListener('tuslab:pvp-combat', e => { const d = e.detail || {}; if (L.ev.length < 400) L.ev.push(Math.round(performance.now() - t0) + ' EV ' + [d.type, 's' + (d.fromSeat ?? d.seat ?? ''), d.skill || '', d.phase ? 'p' + d.phase : '', d.amount ?? '', d.blocked ? 'BLOK:' + (d.blockKind || '') : '', d.hpAfter ?? '', (d.bonusTags || d.tags || []).join('+'), d.kind || ''].join(' ').replace(/ +/g, ' ')); }, true); try { window.__tuslabAnimProbe?.start(); } catch { /* yok */ }
    setInterval(() => {
      L.n++;
      let q = null, m = null;
      try { q = window.__tuslabVisualQueue?.snapshot?.(); } catch { /* yok */ }
      try { m = window.__tuslabArena3d?._debug?.models?.(); } catch { /* yok */ }
      const cc = document.querySelector('[data-combo-counter]'), ac = document.querySelector('[data-attack-callout]'), cr = document.querySelector('[data-crit-text]');
      if (vis(cc)) L.combo.add(txt(cc)); if (vis(ac)) L.callout.add(txt(ac) + ' @' + Math.round(ac.getBoundingClientRect().top) + ' fs' + parseFloat(getComputedStyle(ac).fontSize));
      if (vis(cr)) L.crit.add(txt(cr) + ' op' + getComputedStyle(cr).opacity);
      for (const s of document.querySelectorAll('[data-status]')) if (vis(s)) L.status.add(s.dataset.status + ':' + txt(s).slice(0, 20));
      const states = m ? (Array.isArray(m) ? m : Object.values(m)).map(x => `${x?.seat ?? ''}${x?.state ?? x?.anim ?? ''}/${x?.clip ?? ''}`) : [];
      const atk = states.filter(s => /attack|skill|ulti|[qer]\//i.test(s)).length;
      if (atk >= 2) L.both++;
      const hp = [1, 2].map(s => (document.querySelector(`.pvp2-side[data-seat="${s}"] [data-server-hp]`)?.textContent || '').split('/')[0].replace(/D/g, '')).join('/');
      if (hp !== L.lastHp) { L.lastHp = hp; L.hp.push([Math.round(performance.now() - t0), hp]); }
      const ts = m ? Object.values(m).map(x => (x?.paused ? 'P' : '') + (Math.round((x?.timeScale ?? 1) * 100) / 100)).join(',') : '';
      const xs = m ? Object.values(m).map(x => Math.round((x?.x ?? 0) * 100) / 100) : [];
      if (L.px) xs.forEach((x, i) => { const d = Math.abs(x - L.px[i]); if (d > (L.jump || 0)) { L.jump = d; L.jumpAt = Math.round(performance.now() - t0); } });
      L.px = xs;
      const key = JSON.stringify([q?.activeSeat, q?.phase, q?.comboIndex, q?.queued, states, ts]);
      if (key !== L.lastKey) { L.lastKey = key; if (L.phases.length < 260) L.phases.push([Math.round(performance.now() - t0), q?.activeSeat ?? null, q?.phase ?? null, q?.comboIndex ?? null, q?.queued ?? null, states.join(' '), 'ts=' + ts, 'x=' + xs.join(',')]); }
    }, 50);
  });
  const t0 = Date.now(); let typed = 0;
  while (Date.now() - t0 < P.maxMs) {
    const s = await page.evaluate(() => { const root = document.querySelector('#pvp-root'); const f = ['rui-inter-open', 'aui-summary-open', 'pvp15-results-open'].filter(x => root?.classList.contains(x)); return {f, w: (document.querySelector('.rui-word.is-active, .aui-word.is-active')?.textContent || document.querySelector('[data-tt-target]')?.textContent || '').trim()}; }).catch(() => ({f: [], w: ''}));
    if (s.f.includes('pvp15-results-open')) break;
    if (!s.f.length && s.w && s.w.length > 1 && !/[✓]/.test(s.w)) { await page.keyboard.type(s.w, {delay: P.key ?? 8}); await page.keyboard.press('Space'); typed++; }
    await page.waitForTimeout(P.gap ?? 260);
  }
  const r = await page.evaluate(() => { const L = window.__dv; return {n: L.n, both: L.both, combo: [...L.combo], callout: [...L.callout].slice(0, 14), crit: [...L.crit].slice(0, 4), maxJump: [L.jump, L.jumpAt], status: [...L.status].slice(0, 8), phases: L.phases, hp: L.hp.slice(0, 80),
      ev: L.ev,
      gaps: (() => { const fr = window.__tuslabAnimProbe?.frames || [], g = []; for (let i = 1; i < fr.length; i++) { const d = fr[i].t - fr[i - 1].t; if (d > 150) g.push(Math.round(fr[i - 1].t - L.t0) + '+' + Math.round(d)); } return g.slice(0, 30); })(),
      critDbg: (() => { try { return window.__tuslabArena3d?._debug?.crit?.() ?? null; } catch { return null; } })(),
      stall: (() => { const fr = window.__tuslabAnimProbe?.frames || [], b = new Map(); for (const f of fr) { const k = Math.floor((f.t - L.t0) / 500) * 500; const o = b.get(k) || {n: 0, ts: 0, hs: 0}; o.n++; o.ts += f.ts; o.hs += f.hs; b.set(k, o); } return [...b].filter(([, o]) => o.ts / o.n < 0.85 || o.hs / o.n > 0.15).map(([k, o]) => `${k}: ts=${(o.ts / o.n).toFixed(2)} hs=${(o.hs / o.n).toFixed(2)} n=${o.n}`); })(),
      marks: (window.__tuslabAnimProbe?.events || []).slice(0, 300).map(e => { const {t, type, ...d} = e; return Math.round(t - L.t0) + ' ' + type + ' ' + JSON.stringify(d); })}; });
  r.typed = typed; r.errs = errs.slice(0, 5); r.phases = r.phases.slice(0, P.rows || 260);
  return r;
}
