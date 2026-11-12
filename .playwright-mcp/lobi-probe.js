// Karakter seçme ekranı ölçümü (3 çözünürlük) + seçimin maça geçişi.
async (page) => {
  const out = [];
  for (const [w, h] of [[1920, 1080], [1366, 768], [375, 812]]) {
    await page.setViewportSize({width: w, height: h});
    await page.goto('http://127.0.0.1:5176/index.html'); await page.waitForTimeout(1500); await page.evaluate(() => { const e = [...document.querySelectorAll('button, a, [role="button"], [data-view], [data-nav]')].find(x => /PvP Modlar/.test(x.textContent)); e?.click(); }); await page.waitForSelector('.lb3-fighter', {timeout: 8000}).catch(() => {}); await page.waitForTimeout(800);
    const r = await page.evaluate(async () => {
      const W = innerWidth, H = innerHeight; const cards = [...document.querySelectorAll('.lb3-fighter')];
      if (!cards.length) return {err: 'kart yok', url: location.href, body: document.body.innerText.slice(0, 120)};
      cards[2].scrollIntoView({block: 'center'}); cards[2].click(); await new Promise(r => setTimeout(r, 500));
      const cs = [...document.querySelectorAll('.lb3-fighter')];
      const info = cs.map(c => { const r = c.getBoundingClientRect(); const s = getComputedStyle(c); const nm = c.querySelector('.lb3-f-name, strong, b'); const ns = nm ? getComputedStyle(nm) : null;
        const img = [c, ...c.querySelectorAll('*')].map(e => getComputedStyle(e).backgroundImage).find(b => /portre|higgsfield/.test(b)) || '';
        return {id: c.dataset.fighter, on: c.getAttribute('aria-checked'), box: [r.left, r.top, r.width, r.height].map(Math.round), clip: s.clipPath !== 'none', shadow: s.boxShadow !== 'none' || s.filter !== 'none', tf: s.transform !== 'none', name: nm ? `${nm.textContent.trim()} ${parseFloat(ns.fontSize)}px ${ns.fontFamily.slice(0, 8)}` : null, portre: /portre-\w+/.exec(img)?.[0] || !!img,
          off: r.left < -1 || r.right > W + 1, clipTxt: [...c.querySelectorAll('*')].filter(e => e.children.length === 0 && e.scrollWidth > e.clientWidth + 2 && e.clientWidth > 0).map(e => e.textContent.trim().slice(0, 16))}; });
      const small = [...document.querySelectorAll('.lb3-fighter *, .lb3-hero *')].filter(e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1) && e.getBoundingClientRect().width > 0 && parseFloat(getComputedStyle(e).fontSize) < 12).map(e => `${e.className}:${getComputedStyle(e).fontSize}`);
      const bgEl = [...document.querySelectorAll('.lb3-hero, .lb3-stage, .lb3, [class*="lb3-"]')].find(e => /higgsfield/.test(getComputedStyle(e).backgroundImage) || /higgsfield/.test(getComputedStyle(e, '::before').backgroundImage));
      const sel = cs.find(c => c.getAttribute('aria-checked') === 'true'); const mark = sel ? (getComputedStyle(sel, '::after').content + getComputedStyle(sel, '::before').content + sel.textContent).includes('SEÇİLDİ') : false;
      return {hscroll: document.documentElement.scrollWidth > W + 1, cols: new Set(info.map(i => i.box[0])).size, bg: bgEl ? bgEl.className.toString().slice(0, 30) : null, selected: sel?.dataset.fighter, secildi: mark, small: [...new Set(small)].slice(0, 5), cards: info};
    });
    out.push({vp: `${w}x${h}`, ...r});
  }
  return out;
}
