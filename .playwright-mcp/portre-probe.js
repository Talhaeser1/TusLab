async (page) => {
  const P = JSON.parse(await page.evaluate(() => localStorage.getItem('__ui') || '{}'));
  const W = P.w || 1366, H = P.h || 768, f1 = P.f1 || 'konyali', f2 = P.f2 || 'sira';
  await page.evaluate(() => { localStorage.setItem('tuslab-pvp-practice-round-style', 'counted'); localStorage.setItem('tuslab-pvp-practice-rounds', '5'); });
  await page.setViewportSize({width: W, height: H});
  await page.goto(`http://127.0.0.1:5176/index.html?pvp=practice&mode=${P.mode}&bot=easy&karakter=${f1}&fighter1=${f1}&fighter2=${f2}`);
  const tag = `${P.mode}-${W}`;
  // Ortak ölçüm: bir kapsayıcı için taşma/küçük yazı/örtüşme/portre.
  const scan = (sel) => page.evaluate((sel) => {
    const box = document.querySelector(sel); if (!box) return {missing: sel};
    const vis = e => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 1 && r.height > 1 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05; };
    const names = [...box.querySelectorAll('.m33-player h3,.pvp15-player-name,.cin-tag')].map(e => e.textContent.trim().replace(/\s+/g, ' ').slice(0, 70));
    const imgs = [...box.querySelectorAll('img')].filter(i => i.getBoundingClientRect().width > 1).map(i => ({src: i.getAttribute('src'), nw: i.naturalWidth, p: i.dataset.portrait || null, w: Math.round(i.getBoundingClientRect().width), h: Math.round(i.getBoundingClientRect().height), fit: getComputedStyle(i).objectFit}));
    const small = [...box.querySelectorAll('*')].filter(e => vis(e) && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 12).map(e => e.className + ':' + getComputedStyle(e).fontSize).slice(0, 5);
    const kids = [...box.querySelectorAll('.m33-player,.pvp15-player,.pvp15-buttons button,.pvp15-title,.pvp15-meta,.aui-res-player,.rui-res-score,.m33-footer,.m33-winner,.m33-title')].filter(vis).map(e => ({c: (e.className + '').split(' ')[0], r: e.getBoundingClientRect()}));
    const ov = [];
    for (let a = 0; a < kids.length; a++) for (let b = a + 1; b < kids.length; b++) { const x = kids[a].r, y = kids[b].r; if (x.left < y.right - 1 && y.left < x.right - 1 && x.top < y.bottom - 1 && y.top < x.bottom - 1 && !(kids[a].r.contains) && kids[a].c !== kids[b].c) { const inside = (o, i) => o.left <= i.left + 1 && o.right >= i.right - 1 && o.top <= i.top + 1 && o.bottom >= i.bottom - 1; if (!inside(x, y) && !inside(y, x)) ov.push(kids[a].c + '×' + kids[b].c); } }
    const btn = [...box.querySelectorAll('.pvp15-buttons button')].map(b => { const r = b.getBoundingClientRect(); return {t: b.textContent.trim().slice(0, 14), inView: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth}; });
    const br = box.getBoundingClientRect();
    const scroll = {sh: box.scrollHeight, ch: box.clientHeight, cardScroll: [...box.querySelectorAll('.pvp15-card,.rui-inter,.rui-summary')].map(e => (e.className + '').split(' ')[0] + ':' + (e.scrollHeight - e.clientHeight) + ':' + getComputedStyle(e).overflowY).filter(d => !/:[01]:/.test(d))};
    const q = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return {inView: r.top >= 0 && r.bottom <= innerHeight, bottom: Math.round(r.bottom)}; };
    return {names, imgs, small, ov: [...new Set(ov)], btn, hOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth, box: {t: Math.round(br.top), b: Math.round(br.bottom), l: Math.round(br.left), r: Math.round(br.right)}, scroll, meta: q('[data-pvp15-meta]'), next: q('.m33-next'), cd: q('.m33-countdown')};
  }, sel);
  const out = {mode: P.mode, w: W, h: H, vs: null, inter: null, result: null};
  // VS
  const t0 = Date.now();
  while (Date.now() - t0 < 16000) {
    const ok = await page.evaluate(() => { const i = document.querySelector('.cin-vs .cin-fighter'); return !!i && i.complete && i.naturalWidth > 0; });
    if (ok) { await page.waitForTimeout(450); out.vs = await scan('.cin-vs'); await page.screenshot({path: `.playwright-mcp/portre-vs-${tag}.png`}); break; }
    await page.waitForTimeout(60);
  }
  // Maç: yaz, raund arası ve sonucu yakala
  const t1 = Date.now();
  while (Date.now() - t1 < (P.ms || 170000)) {
    const st = await page.evaluate(() => {
      const t = document.querySelector('[data-pvp15-title]'); if (t && t.getBoundingClientRect().width > 5) return 'result';
      const m = document.querySelector('.m33-result'); if (m && m.getBoundingClientRect().width > 5) return 'inter';
      return '';
    });
    if (st === 'result') { await page.waitForTimeout(900); out.result = await scan('[data-pvp15-results]'); out.result.outcome = await page.evaluate(() => document.querySelector('[data-pvp15-results]').dataset.outcome); out.result.bg = await page.evaluate(() => getComputedStyle(document.querySelector('.pvp15-backdrop')).backgroundImage.match(/ekran-[a-z-]+\.webp/)?.[0] || null); await page.screenshot({path: `.playwright-mcp/portre-sonuc-${tag}.png`}); break; }
    if (st === 'inter' && !out.inter) { await page.waitForTimeout(500); out.inter = await scan('.rui-inter'); out.inter.rect = await page.evaluate(() => { const r = document.querySelector('.rui-inter').getBoundingClientRect(); return {t: Math.round(r.top), b: Math.round(r.bottom), h: Math.round(r.height)}; }); await page.screenshot({path: `.playwright-mcp/portre-inter-${tag}.png`}); out.dbg = await page.evaluate(() => { const i = document.querySelector('.m33-portrait'); const cs = getComputedStyle(i); const chain = []; for (let e = i; e && e !== document.body; e = e.parentElement) { const s = getComputedStyle(e); if ((s.zoom && s.zoom !== '1') || (s.transform && s.transform !== 'none')) chain.push((e.className + '').split(' ')[0] + ' z=' + s.zoom + ' t=' + s.transform); } return {w: cs.width, h: cs.height, mw: cs.maxWidth, mh: cs.maxHeight, disp: cs.display, gridcol: getComputedStyle(i.parentElement).gridTemplateColumns, chain}; }); if (P.stopAt === 'inter') break; }
    const w = await page.evaluate(() => (document.querySelector('[data-tt-target]')?.textContent || '').trim());
    if (w && w.length > 1 && !/[✓…]/.test(w)) { await page.keyboard.type(w, {delay: 0}); await page.keyboard.press('Space'); }
    await page.waitForTimeout(10);
  }
  return out;
}
