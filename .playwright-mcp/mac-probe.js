// Görev I2/I1 ölçümü: [data-sen-badge], [data-typed-strip], [data-round-clock], [data-round-label] görünür ve çakışmasız mı?
// Parametreler: {mode:'rounds'|'classic'|'arena', style:'timed'|'counted', w, h, samples, typeMs}
async (page) => {
  const P = Object.assign({mode: 'rounds', style: 'timed', w: 1366, h: 768, samples: 4, typeMs: 14000}, JSON.parse(await page.evaluate(() => localStorage.getItem('__ui') || '{}')));
  await page.evaluate(s => { localStorage.setItem('tuslab-pvp-practice-round-style', s); localStorage.setItem('tuslab-pvp-practice-rounds', '5'); }, P.style);
  await page.setViewportSize({width: P.w, height: P.h});
  await page.goto(`http://127.0.0.1:5176/index.html?pvp=practice&mode=${P.mode}&bot=easy&karakter=vargr&fighter1=vargr&fighter2=nyx`);
  await page.waitForTimeout(P.mode === 'arena' ? 4500 : 9500);
  const measure = () => page.evaluate(() => {
    const vis = e => { if (!e || e.hidden) return false; const r = e.getBoundingClientRect(), c = getComputedStyle(e); return r.width > 1 && r.height > 1 && c.display !== 'none' && c.visibility !== 'hidden' && Number(c.opacity) > .05 && r.bottom > 0 && r.right > 0 && r.left < innerWidth && r.top < innerHeight; };
    const box = e => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; };
    const handles = {sen: '[data-sen-badge]', s1: '[data-typed-strip="1"]', s2: '[data-typed-strip="2"]', clock: '[data-round-clock]', label: '[data-round-label]'};
    const out = {}, boxes = {};
    for (const [k, sel] of Object.entries(handles)) {
      const el = [...document.querySelectorAll(sel)].find(vis);
      out[k] = el ? {box: box(el), text: (el.textContent || '').trim().slice(0, 40), font: parseFloat(getComputedStyle(el).fontSize)} : null;
      if (el) boxes[k] = box(el);
    }
    // Çakışma: tutamaçlar kendi aralarında ve yazma paneli/can çubuğu/kelime şeridi ile.
    const others = {tt: '.tt-type, .tt-arena', hp1: '.pvp2-side[data-seat="1"] .pvp2-health', hp2: '.pvp2-side[data-seat="2"] .pvp2-health', words: '.rui-words', skillbar: '.sk-bar, .skillbar, [class*="skillbar"]'};
    const ob = {}; for (const [k, sel] of Object.entries(others)) { const el = [...document.querySelectorAll(sel)].find(vis); if (el) ob[k] = box(el); }
    const inter = (a, b) => !(a[2] <= b[0] + 1 || b[2] <= a[0] + 1 || a[3] <= b[1] + 1 || b[3] <= a[1] + 1);
    const overlaps = [];
    const names = Object.keys(boxes);
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
      // rozet kendi şeridinin içindedir (beklenen); onu şeritle karşılaştırma
      if ((names[i] === 'sen' && /^s[12]$/.test(names[j])) || (names[j] === 'sen' && /^s[12]$/.test(names[i]))) continue;
      if (inter(boxes[names[i]], boxes[names[j]])) overlaps.push(`${names[i]}×${names[j]}`);
    }
    for (const n of names) for (const [k, b] of Object.entries(ob)) {
      if (n === 'sen' || (/^s1$/.test(n) && k === 'hp1') || (/^s2$/.test(n) && k === 'hp2')) continue;
      if (inter(boxes[n], b)) overlaps.push(`${n}×${k}`);
    }
    const W = innerWidth, H = innerHeight;
    const off = names.filter(n => boxes[n][0] < -1 || boxes[n][2] > W + 1 || boxes[n][3] > H + 1);
    const small = names.filter(n => out[n].font < 12 && out[n].text);
    const phase = document.querySelector('#pvp-root').className.match(/(rui-inter-open|aui-summary-open|pvp15-results-open)/)?.[0] || 'play';
    return {phase, vp: `${W}x${H}`, ...out, overlaps, off, small, hscroll: document.documentElement.scrollWidth > W + 1};
  });
  const typeOne = async () => {
    const w = await page.evaluate(() => (document.querySelector('[data-tt-target]')?.textContent || '').trim());
    if (w && w.length > 1 && !/[✓…]/.test(w)) { await page.keyboard.type(w, {delay: 8}); await page.keyboard.press('Space'); return w; }
    return null;
  };
  const rows = []; const t0 = Date.now(); let typed = 0, lastSample = 0;
  // arena'da önce hazırlık; yazma durumuna gelene kadar bekle (en çok 30 sn)
  if (P.mode === 'arena') for (let i = 0; i < 100; i++) { const t = await page.evaluate(() => (document.querySelector('[data-tt-target]')?.textContent || '').trim().length > 1 && !document.querySelector('.aui-card:not([hidden])')); if (t) break; await page.waitForTimeout(300); }
  while (Date.now() - t0 < P.typeMs) {
    if (await typeOne()) typed++;
    if (Date.now() - lastSample > P.typeMs / P.samples) { lastSample = Date.now(); rows.push(await measure()); }
    await page.waitForTimeout(180);
  }
  rows.push(await measure());
  return {mode: P.mode, style: P.style, typed, rows};
}
